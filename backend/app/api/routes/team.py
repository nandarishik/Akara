"""Team invites and member management."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jinja2 import Environment, FileSystemLoader, select_autoescape
from pydantic import BaseModel, Field

from app.core.auth import CurrentUser
from app.core.config import settings
from app.core.plan_guard import require_feature
from app.core.plan_limits import get_limit
from app.core.rate_limit import limiter
from app.core.tenant import TenantContext, get_supabase_service_client, get_tenant_context
from app.services.billing.email import _send

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/team", tags=["team"])


class MemberOut(BaseModel):
    id: UUID
    email: str | None = None
    display_name: str | None = None
    role: str
    membership_status: str


class InviteOut(BaseModel):
    id: UUID
    email_normalized: str
    role: str
    status: str
    expires_at: datetime
    created_at: datetime


class InviteRequest(BaseModel):
    email: str = Field(min_length=3)
    role: str = Field(default="user", pattern="^(admin|user)$")


class AcceptInviteRequest(BaseModel):
    token: str


class DowngradeSeatSelection(BaseModel):
    keep_user_ids: list[UUID]


class RoleUpdate(BaseModel):
    role: str = Field(pattern="^(admin|user)$")


_TEMPLATE_DIR = Path(__file__).resolve().parents[2] / "services" / "email" / "templates"


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _seat_limit(tenant: TenantContext) -> int:
    return int(get_limit(tenant.plan, "users"))


@router.get("/members", response_model=list[MemberOut])
def list_members(
    user: CurrentUser,
    tenant: TenantContext = Depends(get_tenant_context),
) -> list[MemberOut]:
    supa = get_supabase_service_client()
    profiles = (
        supa.table("profiles")
        .select("id, display_name, role, membership_status")
        .eq("tenant_id", str(tenant.tenant_id))
        .execute()
    )
    members: list[MemberOut] = []
    for row in profiles.data or []:
        email = None
        try:
            auth_user = supa.auth.admin.get_user_by_id(row["id"])
            email = auth_user.user.email if auth_user and auth_user.user else None
        except Exception:
            pass
        members.append(
            MemberOut(
                id=UUID(row["id"]),
                email=email,
                display_name=row.get("display_name"),
                role=row["role"],
                membership_status=row.get("membership_status") or "active",
            )
        )
    return members


@router.get("/invites", response_model=list[InviteOut])
def list_invites(
    user: CurrentUser,
    tenant: TenantContext = Depends(get_tenant_context),
    _: None = Depends(require_feature("team_invites")),
) -> list[InviteOut]:
    supa = get_supabase_service_client()
    result = (
        supa.table("team_invites")
        .select("*")
        .eq("tenant_id", str(tenant.tenant_id))
        .eq("status", "pending")
        .order("created_at", desc=True)
        .execute()
    )
    return [InviteOut(**row) for row in (result.data or [])]


def _send_invite_email(to_email: str, token: str, tenant_name: str) -> None:
    frontend = settings.customer_frontend_url.rstrip("/")
    link = f"{frontend}/signup?invite={token}"
    jinja = Environment(
        loader=FileSystemLoader(str(_TEMPLATE_DIR)),
        autoescape=select_autoescape(["html"]),
    )
    html = jinja.get_template("team_invite.html").render(
        tenant_name=tenant_name,
        invite_url=link,
    )
    _send(to_email, f"AKARA — Team invite to {tenant_name}", html)


@router.post("/invite", response_model=InviteOut)
@limiter.limit("10/minute")
def create_invite(
    request: Request,
    body: InviteRequest,
    user: CurrentUser,
    tenant: TenantContext = Depends(get_tenant_context),
    _: None = Depends(require_feature("team_invites")),
) -> InviteOut:
    if not tenant.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Admin role required")

    supa = get_supabase_service_client()
    seat_limit = _seat_limit(tenant)
    try:
        rpc = supa.rpc(
            "reserve_team_invite",
            {
                "p_tenant_id": str(tenant.tenant_id),
                "p_email": body.email,
                "p_role": body.role,
                "p_invited_by": str(user.user_id),
                "p_seat_limit": seat_limit,
            },
        ).execute()
    except Exception as exc:
        if "seat_limit_reached" in str(exc):
            raise HTTPException(
                status.HTTP_402_PAYMENT_REQUIRED,
                detail="Team seat limit reached. Upgrade or cancel pending invites.",
            ) from exc
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    row = (rpc.data or [{}])[0]
    invite_id = row.get("invite_id")
    if not invite_id:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Invite failed")

    invite = (
        supa.table("team_invites")
        .select("*")
        .eq("id", str(invite_id))
        .single()
        .execute()
    ).data
    if not invite:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Invite not found")

    tenant_name = "your team"
    try:
        t = supa.table("tenants").select("name").eq("id", str(tenant.tenant_id)).single().execute()
        if t.data:
            tenant_name = t.data.get("name") or tenant_name
    except Exception:
        pass

    if not row.get("existing"):
        _send_invite_email(body.email, invite["invite_token"], tenant_name)

    return InviteOut(**invite)


@router.post("/invites/{invite_id}/resend")
@limiter.limit("10/minute")
def resend_invite(
    request: Request,
    invite_id: UUID,
    user: CurrentUser,
    tenant: TenantContext = Depends(get_tenant_context),
    _: None = Depends(require_feature("team_invites")),
) -> dict[str, str]:
    if not tenant.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Admin role required")

    supa = get_supabase_service_client()
    invite = (
        supa.table("team_invites")
        .select("*")
        .eq("id", str(invite_id))
        .eq("tenant_id", str(tenant.tenant_id))
        .eq("status", "pending")
        .single()
        .execute()
    ).data
    if not invite:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Invite not found")

    supa.table("team_invites").update({
        "expires_at": (datetime.now(UTC).replace(microsecond=0) + timedelta(days=7)).isoformat(),
    }).eq("id", str(invite_id)).execute()

    tenant_name = "your team"
    try:
        t = supa.table("tenants").select("name").eq("id", str(tenant.tenant_id)).single().execute()
        if t.data:
            tenant_name = t.data.get("name") or tenant_name
    except Exception:
        pass

    _send_invite_email(invite["email_normalized"], invite["invite_token"], tenant_name)
    return {"status": "ok"}


@router.delete("/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
def cancel_invite(
    request: Request,
    invite_id: UUID,
    user: CurrentUser,
    tenant: TenantContext = Depends(get_tenant_context),
    _: None = Depends(require_feature("team_invites")),
) -> None:
    if not tenant.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Admin role required")

    supa = get_supabase_service_client()
    supa.table("team_invites").update({
        "status": "cancelled",
        "cancelled_at": datetime.now(UTC).isoformat(),
        "reserves_seat": False,
    }).eq("id", str(invite_id)).eq("tenant_id", str(tenant.tenant_id)).eq(
        "status", "pending"
    ).execute()


@router.post("/accept")
@limiter.limit("10/minute")
def accept_invite(request: Request, body: AcceptInviteRequest, user: CurrentUser) -> dict[str, str]:
    supa = get_supabase_service_client()
    invite = (
        supa.table("team_invites")
        .select("*")
        .eq("invite_token", body.token)
        .eq("status", "pending")
        .maybe_single()
        .execute()
    ).data
    if not invite:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Invalid or expired invite")

    expires = datetime.fromisoformat(str(invite["expires_at"]).replace("Z", "+00:00"))
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    if expires < datetime.now(UTC):
        supa.table("team_invites").update({"status": "expired", "reserves_seat": False}).eq(
            "id", invite["id"]
        ).execute()
        raise HTTPException(status.HTTP_410_GONE, detail="Invite expired")

    user_email = (user.email or "").lower()
    if user_email != invite["email_normalized"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Invite email does not match")

    supa.table("profiles").update({
        "tenant_id": invite["tenant_id"],
        "role": invite["role"],
        "membership_status": "active",
    }).eq("id", str(user.user_id)).execute()

    supa.table("team_invites").update({
        "status": "accepted",
        "accepted_by": str(user.user_id),
        "accepted_at": datetime.now(UTC).isoformat(),
        "reserves_seat": False,
    }).eq("id", invite["id"]).execute()

    return {"status": "ok", "tenant_id": invite["tenant_id"]}


@router.patch("/members/{member_id}/role")
@limiter.limit("10/minute")
def update_member_role(
    request: Request,
    member_id: UUID,
    body: RoleUpdate,
    user: CurrentUser,
    tenant: TenantContext = Depends(get_tenant_context),
) -> dict[str, str]:
    if not tenant.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Admin role required")

    supa = get_supabase_service_client()
    supa.table("profiles").update({"role": body.role}).eq(
        "id", str(member_id)
    ).eq("tenant_id", str(tenant.tenant_id)).execute()
    return {"status": "ok"}


@router.delete("/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
def remove_member(
    request: Request,
    member_id: UUID,
    user: CurrentUser,
    tenant: TenantContext = Depends(get_tenant_context),
) -> None:
    if not tenant.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Admin role required")

    supa = get_supabase_service_client()
    admins = (
        supa.table("profiles")
        .select("id")
        .eq("tenant_id", str(tenant.tenant_id))
        .eq("role", "admin")
        .eq("membership_status", "active")
        .execute()
    )
    admin_ids = {r["id"] for r in (admins.data or [])}
    if str(member_id) in admin_ids and len(admin_ids) <= 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Cannot remove the last admin")

    supa.table("profiles").update({
        "membership_status": "suspended",
        "tenant_id": None,
    }).eq("id", str(member_id)).eq("tenant_id", str(tenant.tenant_id)).execute()


@router.post("/downgrade-seat-selection")
@limiter.limit("10/minute")
def downgrade_seat_selection(
    request: Request,
    body: DowngradeSeatSelection,
    user: CurrentUser,
    tenant: TenantContext = Depends(get_tenant_context),
) -> dict[str, str]:
    if not tenant.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Admin role required")

    supa = get_supabase_service_client()
    keep = {str(uid) for uid in body.keep_user_ids}
    members = (
        supa.table("profiles")
        .select("id")
        .eq("tenant_id", str(tenant.tenant_id))
        .eq("membership_status", "active")
        .execute()
    )
    for row in members.data or []:
        mid = row["id"]
        if mid in keep:
            continue
        supa.table("profiles").update({"membership_status": "seat_locked"}).eq("id", mid).execute()
    return {"status": "ok"}


@router.post("/members/{member_id}/reactivate")
@limiter.limit("10/minute")
def reactivate_member(
    request: Request,
    member_id: UUID,
    user: CurrentUser,
    tenant: TenantContext = Depends(get_tenant_context),
) -> dict[str, str]:
    if not tenant.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Admin role required")

    supa = get_supabase_service_client()
    occupied = supa.rpc("count_occupied_seats", {"p_tenant_id": str(tenant.tenant_id)}).execute()
    seat_limit = _seat_limit(tenant)
    if int((occupied.data or 0)) >= seat_limit:
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, detail="No seats available")

    supa.table("profiles").update({"membership_status": "active"}).eq(
        "id", str(member_id)
    ).eq("tenant_id", str(tenant.tenant_id)).execute()
    return {"status": "ok"}
