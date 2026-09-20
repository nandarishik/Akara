"""Team invites and member management."""

from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, Request, status
from jinja2 import Environment, FileSystemLoader, select_autoescape
from pydantic import BaseModel, Field

from app.core.auth import Capability, CurrentUser, check_role_capability
from app.core.config import settings
from app.core.errors import AkaraHTTPException
from app.core.plan_guard import UsageExceeded, require_feature
from app.core.plan_limits import get_limit
from app.core.rate_limit import limiter
from app.core.tenant import (
    TenantContext,
    get_supabase_service_client,
    get_tenant_context,
)
from app.domain.billing.email import _send

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


_TEMPLATE_DIR = Path(__file__).resolve().parents[2] / "infra" / "email" / "templates"


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _hmac_invite_token() -> str:
    return hmac.new(
        settings.jwt_secret.encode(),
        secrets.token_bytes(32),
        hashlib.sha256,
    ).hexdigest()


def get_team_member_verified(tenant_id: UUID, member_id: UUID) -> dict:
    supa = get_supabase_service_client()
    row = (
        supa.table("profiles")
        .select("*")
        .eq("id", str(member_id))
        .eq("tenant_id", str(tenant_id))
        .maybe_single()
        .execute()
    ).data
    if not row:
        raise AkaraHTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="NOT_FOUND",
            message="Member not found",
        )
    return row


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
    link = f"{frontend}/invite/accept?token={token}"
    logger.debug("invite_url_for_testing=%s", link)
    jinja = Environment(
        loader=FileSystemLoader(str(_TEMPLATE_DIR)),
        autoescape=select_autoescape(["html"]),
    )
    html = jinja.get_template("team_invite.html").render(
        tenant_name=tenant_name,
        invite_url=link,
    )
    _send(to_email, f"AKARA — Team invite to {tenant_name}", html)


@router.post("/invite")
@limiter.limit("10/minute")
def create_invite(
    request: Request,
    body: InviteRequest,
    user: CurrentUser,
    tenant: TenantContext = Depends(get_tenant_context),
    _: None = Depends(require_feature("team_invites")),
) -> dict:
    check_role_capability(tenant.role, Capability.INVITE_MEMBER)

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
            raise UsageExceeded(
                "Team seat limit reached. Upgrade or cancel pending invites.",
                feature="team_invites",
            ) from exc
        if "already" in str(exc).lower() or "duplicate" in str(exc).lower():
            raise AkaraHTTPException(
                status_code=status.HTTP_409_CONFLICT,
                code="CONFLICT",
                message="Email already an active member of this tenant",
            ) from exc
        raise AkaraHTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code="INTERNAL_ERROR",
            message=str(exc),
        ) from exc

    row = (rpc.data or [{}])[0]
    invite_id = row.get("invite_id")
    if not invite_id:
        raise AkaraHTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code="INTERNAL_ERROR",
            message="Invite failed",
        )

    token = _hmac_invite_token()
    expires_at = datetime.now(UTC) + timedelta(hours=settings.invite_token_expiry_hours)
    supa.table("team_invites").update(
        {
            "invite_token": token,
            "email_normalized": _normalize_email(body.email),
            "expires_at": expires_at.isoformat(),
        }
    ).eq("id", str(invite_id)).execute()

    invite = (
        supa.table("team_invites")
        .select("*")
        .eq("id", str(invite_id))
        .single()
        .execute()
    ).data
    if not invite:
        raise AkaraHTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code="INTERNAL_ERROR",
            message="Invite not found",
        )

    tenant_name = "your team"
    try:
        t = (
            supa.table("tenants")
            .select("name")
            .eq("id", str(tenant.tenant_id))
            .single()
            .execute()
        )
        if t.data:
            tenant_name = t.data.get("name") or tenant_name
    except Exception:
        pass

    if not row.get("existing"):
        _send_invite_email(body.email, invite["invite_token"], tenant_name)

    out = InviteOut(**invite).model_dump(mode="json")
    out.update(
        {
            "invited": True,
            "email": _normalize_email(body.email),
            "expires_at": invite.get("expires_at"),
        }
    )
    return out


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
        raise AkaraHTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="FORBIDDEN",
            message="Admin role required",
        )

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
        raise AkaraHTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="NOT_FOUND",
            message="Invite not found",
        )

    supa.table("team_invites").update(
        {
            "expires_at": (
                datetime.now(UTC).replace(microsecond=0) + timedelta(days=7)
            ).isoformat(),
        }
    ).eq("id", str(invite_id)).execute()

    tenant_name = "your team"
    try:
        t = (
            supa.table("tenants")
            .select("name")
            .eq("id", str(tenant.tenant_id))
            .single()
            .execute()
        )
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
        raise AkaraHTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="FORBIDDEN",
            message="Admin role required",
        )

    supa = get_supabase_service_client()
    supa.table("team_invites").update(
        {
            "status": "cancelled",
            "cancelled_at": datetime.now(UTC).isoformat(),
            "reserves_seat": False,
        }
    ).eq("id", str(invite_id)).eq("tenant_id", str(tenant.tenant_id)).eq(
        "status", "pending"
    ).execute()


@router.post("/accept")
@limiter.limit("10/minute")
def accept_invite(
    request: Request, body: AcceptInviteRequest, user: CurrentUser
) -> dict[str, str]:
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
        raise AkaraHTTPException(
            status_code=status.HTTP_410_GONE,
            code="NOT_FOUND",
            message="Invalid or expired invite",
        )

    expires = datetime.fromisoformat(str(invite["expires_at"]).replace("Z", "+00:00"))
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    if expires < datetime.now(UTC):
        supa.table("team_invites").update(
            {"status": "expired", "reserves_seat": False}
        ).eq("id", invite["id"]).execute()
        raise AkaraHTTPException(
            status_code=status.HTTP_410_GONE,
            code="NOT_FOUND",
            message="Invite expired",
        )

    user_email = (user.email or "").lower()
    if user_email != invite["email_normalized"]:
        raise AkaraHTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="FORBIDDEN",
            message="Invite email does not match",
        )

    profile = (
        supa.table("profiles")
        .select("tenant_id")
        .eq("id", str(user.user_id))
        .maybe_single()
        .execute()
    ).data
    if profile and profile.get("tenant_id"):
        raise AkaraHTTPException(
            status_code=status.HTTP_409_CONFLICT,
            code="CONFLICT",
            message="Account already belongs to a workspace",
        )

    supa.table("profiles").update(
        {
            "tenant_id": invite["tenant_id"],
            "role": invite["role"],
            "membership_status": "active",
        }
    ).eq("id", str(user.user_id)).execute()

    supa.table("team_invites").update(
        {
            "status": "accepted",
            "accepted_by": str(user.user_id),
            "accepted_at": datetime.now(UTC).isoformat(),
            "reserves_seat": False,
        }
    ).eq("id", invite["id"]).execute()

    return {
        "status": "ok",
        "tenant_id": invite["tenant_id"],
        "role": invite.get("role", "user"),
    }


@router.patch("/members/{member_id}/role")
@limiter.limit("10/minute")
def update_member_role(
    request: Request,
    member_id: UUID,
    body: RoleUpdate,
    user: CurrentUser,
    tenant: TenantContext = Depends(get_tenant_context),
) -> dict[str, str]:
    check_role_capability(tenant.role, Capability.CHANGE_MEMBER_ROLE)
    if member_id == user.user_id:
        raise AkaraHTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="VALIDATION_ERROR",
            message="Cannot change your own role",
        )
    member = get_team_member_verified(tenant.tenant_id, member_id)
    if member.get("role") == "owner":
        raise AkaraHTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="FORBIDDEN",
            message="Cannot change the owner role",
        )

    supa = get_supabase_service_client()
    supa.table("profiles").update({"role": body.role}).eq("id", str(member_id)).eq(
        "tenant_id", str(tenant.tenant_id)
    ).execute()
    return {"status": "ok"}


@router.delete("/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
def remove_member(
    request: Request,
    member_id: UUID,
    user: CurrentUser,
    tenant: TenantContext = Depends(get_tenant_context),
) -> None:
    check_role_capability(tenant.role, Capability.REMOVE_MEMBER)
    member = get_team_member_verified(tenant.tenant_id, member_id)
    if member.get("role") == "owner":
        raise AkaraHTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="FORBIDDEN",
            message="Cannot remove the workspace owner",
        )

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
        raise AkaraHTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="VALIDATION_ERROR",
            message="Cannot remove the last admin",
        )

    supa.table("profiles").update(
        {
            "membership_status": "suspended",
            "tenant_id": None,
        }
    ).eq("id", str(member_id)).eq("tenant_id", str(tenant.tenant_id)).execute()


@router.post("/downgrade-seat-selection")
@limiter.limit("10/minute")
def downgrade_seat_selection(
    request: Request,
    body: DowngradeSeatSelection,
    user: CurrentUser,
    tenant: TenantContext = Depends(get_tenant_context),
) -> dict[str, str]:
    if not tenant.is_admin:
        raise AkaraHTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="FORBIDDEN",
            message="Admin role required",
        )

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
        supa.table("profiles").update({"membership_status": "seat_locked"}).eq(
            "id", mid
        ).execute()
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
        raise AkaraHTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="FORBIDDEN",
            message="Admin role required",
        )

    supa = get_supabase_service_client()
    occupied = supa.rpc(
        "count_occupied_seats", {"p_tenant_id": str(tenant.tenant_id)}
    ).execute()
    seat_limit = _seat_limit(tenant)
    if int(occupied.data or 0) >= seat_limit:
        raise AkaraHTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            code="QUOTA_EXCEEDED",
            message="No seats available",
        )

    supa.table("profiles").update({"membership_status": "active"}).eq(
        "id", str(member_id)
    ).eq("tenant_id", str(tenant.tenant_id)).execute()
    return {"status": "ok"}


def _invite_preview(token: str) -> dict:
    supa = get_supabase_service_client()
    invite = (
        supa.table("team_invites")
        .select("*")
        .eq("invite_token", token)
        .maybe_single()
        .execute()
    ).data
    if not invite or invite.get("status") != "pending":
        raise AkaraHTTPException(
            status_code=status.HTTP_410_GONE,
            code="NOT_FOUND",
            message="Invalid or expired invite",
        )
    expires = datetime.fromisoformat(str(invite["expires_at"]).replace("Z", "+00:00"))
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    if expires < datetime.now(UTC):
        raise AkaraHTTPException(
            status_code=status.HTTP_410_GONE,
            code="NOT_FOUND",
            message="Invite expired",
        )
    workspace_name = ""
    invited_by_name = ""
    try:
        tenant = (
            supa.table("tenants")
            .select("name")
            .eq("id", invite["tenant_id"])
            .maybe_single()
            .execute()
        ).data
        workspace_name = (tenant or {}).get("name") or ""
    except Exception:
        pass
    return {
        "email": invite.get("email_normalized"),
        "role": invite.get("role"),
        "workspace_name": workspace_name,
        "invited_by_name": invited_by_name,
        "token": token,
    }


@router.get("/invite/accept")
def preview_invite(token: str) -> dict:
    return _invite_preview(token)


@router.post("/invite/accept")
@limiter.limit("10/minute")
def accept_invite_v2(
    request: Request, body: AcceptInviteRequest, user: CurrentUser
) -> dict:
    result = accept_invite(request, body, user)
    return {
        "joined": True,
        "tenant_id": result["tenant_id"],
        "role": result.get("role", "user"),
    }


@router.delete("/invite/{invite_id}")
@limiter.limit("10/minute")
def revoke_invite_alias(
    request: Request,
    invite_id: UUID,
    user: CurrentUser,
    tenant: TenantContext = Depends(get_tenant_context),
) -> dict[str, bool]:
    check_role_capability(tenant.role, Capability.INVITE_MEMBER)
    cancel_invite(request, invite_id, user, tenant)
    return {"revoked": True}
