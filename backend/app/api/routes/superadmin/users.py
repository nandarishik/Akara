"""Superadmin user management."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.errors import AkaraHTTPException
from app.core.pagination import OffsetPage, OffsetParams
from app.core.rate_limit import ADMIN_READ_LIMIT, ADMIN_WRITE_LIMIT, limiter
from app.core.superadmin import SuperAdmin, SudoCtx, request_actor_meta, require_csrf
from app.core.tenant import get_supabase_service_client
from app.services.superadmin.audit import record_operation
from app.services.superadmin.mutations import SuperadminMutation, dry_run_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["superadmin-users"])


class UserListItem(BaseModel):
    id: UUID
    display_name: str | None = None
    email: str | None = None
    role: str
    tenant_id: UUID | None = None
    tenant_name: str | None = None
    plan: str | None = None
    membership_status: str | None = None
    created_at: str | None = None
    last_sign_in_at: str | None = None


class UserRoleBody(SuperadminMutation):
    role: str


class UserTenantBody(SuperadminMutation):
    tenant_id: UUID


class UserDeleteBody(SuperadminMutation):
    confirm: bool = False


def _resolve_auth_fields(user_id: str) -> tuple[str | None, str | None]:
    supa = get_supabase_service_client()
    try:
        user = supa.auth.admin.get_user_by_id(user_id)
        if not user or not user.user:
            return None, None
        last_sign_in = user.user.last_sign_in_at
        if last_sign_in is not None and not isinstance(last_sign_in, str):
            last_sign_in = last_sign_in.isoformat()
        return user.user.email, last_sign_in
    except Exception:
        return None, None


def _resolve_email(user_id: str) -> str | None:
    return _resolve_auth_fields(user_id)[0]


@router.get("", response_model=OffsetPage[UserListItem])
@limiter.limit(ADMIN_READ_LIMIT)
def list_users(
    request: Request,
    _admin: SuperAdmin,
    params: OffsetParams = Depends(),
    tenant_id: UUID | None = Query(default=None),
    role: str | None = Query(default=None),
    plan: str | None = Query(default=None),
    search: str | None = Query(default=None),
) -> OffsetPage[UserListItem]:
    supa = get_supabase_service_client()
    query = supa.table("profiles").select("*", count="exact")
    if tenant_id:
        query = query.eq("tenant_id", str(tenant_id))
    if role:
        query = query.eq("role", role)

    result = (
        query.order("created_at", desc=True)
        .range(params.offset, params.offset + params.limit - 1)
        .execute()
    )

    tenant_cache: dict[str, dict[str, Any]] = {}
    items: list[UserListItem] = []
    for row in result.data or []:
        tid = row.get("tenant_id")
        tenant_name = plan_name = None
        if tid:
            if tid not in tenant_cache:
                t = (
                    supa.table("tenants")
                    .select("name, plan")
                    .eq("id", tid)
                    .maybe_single()
                    .execute()
                )
                tenant_cache[tid] = t.data or {}
            tenant_name = tenant_cache[tid].get("name")
            plan_name = tenant_cache[tid].get("plan")

        if plan and plan_name != plan:
            continue

        email, last_sign_in_at = _resolve_auth_fields(row["id"])
        if search:
            hay = f"{email or ''} {row.get('display_name') or ''}".lower()
            if search.lower() not in hay:
                continue

        items.append(
            UserListItem(
                id=UUID(row["id"]),
                display_name=row.get("display_name"),
                email=email,
                role=row.get("role", "user"),
                tenant_id=UUID(tid) if tid else None,
                tenant_name=tenant_name,
                plan=plan_name,
                membership_status=row.get("membership_status"),
                created_at=row.get("created_at"),
                last_sign_in_at=last_sign_in_at,
            )
        )

    total = result.count or len(items)
    return OffsetPage.build(items, total, params)


@router.patch("/{user_id}/role")
@limiter.limit(ADMIN_WRITE_LIMIT)
def update_user_role(
    request: Request,
    user_id: UUID,
    body: UserRoleBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    if body.role not in ("admin", "user", "superadmin"):
        raise AkaraHTTPException(
            status_code=400,
            code="VALIDATION_ERROR",
            message="Role must be admin, user, or superadmin",
        )

    supa = get_supabase_service_client()
    before = (
        supa.table("profiles")
        .select("*")
        .eq("id", str(user_id))
        .maybe_single()
        .execute()
    )
    if not before.data:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="User not found")

    if body.dry_run:
        return dry_run_response(
            action="superadmin.user.role",
            before={"role": before.data.get("role")},
            impact={"role": body.role},
        )

    result = (
        supa.table("profiles")
        .update({"role": body.role})
        .eq("id", str(user_id))
        .execute()
    )
    after = result.data[0]
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.user.role",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=UUID(after["tenant_id"]) if after.get("tenant_id") else None,
        before_state={"role": before.data.get("role")},
        after_state={"role": body.role},
        operation_id=body.operation_id,
        resource_type="user",
        resource_id=str(user_id),
        **meta,
    )
    return {"ok": True, "user": after, "audit": audit}


@router.patch("/{user_id}/tenant")
@limiter.limit(ADMIN_WRITE_LIMIT)
def move_user_tenant(
    request: Request,
    user_id: UUID,
    body: UserTenantBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    supa = get_supabase_service_client()
    tenant = (
        supa.table("tenants")
        .select("id")
        .eq("id", str(body.tenant_id))
        .maybe_single()
        .execute()
    )
    if not tenant.data:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Target tenant not found")

    before = (
        supa.table("profiles")
        .select("*")
        .eq("id", str(user_id))
        .maybe_single()
        .execute()
    )
    if not before.data:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="User not found")

    if body.dry_run:
        return dry_run_response(
            action="superadmin.user.tenant",
            before={"tenant_id": before.data.get("tenant_id")},
            impact={"tenant_id": str(body.tenant_id)},
        )

    result = (
        supa.table("profiles")
        .update({"tenant_id": str(body.tenant_id)})
        .eq("id", str(user_id))
        .execute()
    )
    after = result.data[0]
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.user.tenant",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=body.tenant_id,
        before_state={"tenant_id": before.data.get("tenant_id")},
        after_state={"tenant_id": str(body.tenant_id)},
        operation_id=body.operation_id,
        resource_type="user",
        resource_id=str(user_id),
        **meta,
    )
    return {"ok": True, "user": after, "audit": audit}


@router.patch("/{user_id}/suspend")
@limiter.limit(ADMIN_WRITE_LIMIT)
def suspend_user(
    request: Request,
    user_id: UUID,
    body: SuperadminMutation,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    return _set_membership_status(
        request, user_id, body, admin, "suspended", "superadmin.user.suspend"
    )


@router.patch("/{user_id}/activate")
@limiter.limit(ADMIN_WRITE_LIMIT)
def activate_user(
    request: Request,
    user_id: UUID,
    body: SuperadminMutation,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    return _set_membership_status(
        request, user_id, body, admin, "active", "superadmin.user.activate"
    )


def _set_membership_status(
    request: Request,
    user_id: UUID,
    body: SuperadminMutation,
    admin: SudoCtx,
    status: str,
    action: str,
) -> dict[str, Any]:
    supa = get_supabase_service_client()
    before = (
        supa.table("profiles")
        .select("*")
        .eq("id", str(user_id))
        .maybe_single()
        .execute()
    )
    if not before.data:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="User not found")

    if body.dry_run:
        return dry_run_response(
            action=action,
            before={"membership_status": before.data.get("membership_status")},
            impact={"membership_status": status},
        )

    result = (
        supa.table("profiles")
        .update({"membership_status": status})
        .eq("id", str(user_id))
        .execute()
    )
    after = result.data[0]
    meta = request_actor_meta(request)
    audit = record_operation(
        action=action,
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=UUID(after["tenant_id"]) if after.get("tenant_id") else None,
        before_state={"membership_status": before.data.get("membership_status")},
        after_state={"membership_status": status},
        operation_id=body.operation_id,
        resource_type="user",
        resource_id=str(user_id),
        **meta,
    )
    return {"ok": True, "user": after, "audit": audit}


@router.post("/{user_id}/reset-password")
@limiter.limit(ADMIN_WRITE_LIMIT)
def reset_password(
    request: Request,
    user_id: UUID,
    body: SuperadminMutation,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    email = _resolve_email(str(user_id))
    if not email:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="User email not found")

    if body.dry_run:
        return dry_run_response(
            action="superadmin.user.reset_password",
            impact={"email": email, "reset_sent": True},
        )

    supa = get_supabase_service_client()
    try:
        supa.auth.reset_password_email(email)
    except Exception as exc:
        raise AkaraHTTPException(
            status_code=502,
            code="SERVICE_UNAVAILABLE",
            message=f"Could not send reset email: {exc}",
        ) from exc

    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.user.reset_password",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        operation_id=body.operation_id,
        resource_type="user",
        resource_id=str(user_id),
        details={"email": email},
        **meta,
    )
    return {"ok": True, "status": "sent", "audit": audit}


@router.post("/{user_id}/magic-link")
@limiter.limit(ADMIN_WRITE_LIMIT)
def magic_link(
    request: Request,
    user_id: UUID,
    body: SuperadminMutation,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    email = _resolve_email(str(user_id))
    if not email:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="User email not found")

    if body.dry_run:
        return dry_run_response(
            action="superadmin.user.magic_link",
            impact={"email": email, "link_generated": True},
        )

    supa = get_supabase_service_client()
    try:
        link_resp = supa.auth.admin.generate_link({
            "type": "magiclink",
            "email": email,
            "options": {
                "redirect_to": settings.customer_frontend_url,
            },
        })
        action_link = getattr(link_resp, "properties", None)
        url = None
        if action_link:
            url = getattr(action_link, "action_link", None)
        if not url and hasattr(link_resp, "model_dump"):
            dumped = link_resp.model_dump()
            url = dumped.get("properties", {}).get("action_link")
    except Exception as exc:
        raise AkaraHTTPException(
            status_code=502,
            code="SERVICE_UNAVAILABLE",
            message=f"Could not generate magic link: {exc}",
        ) from exc

    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.user.magic_link",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        operation_id=body.operation_id,
        resource_type="user",
        resource_id=str(user_id),
        details={"email": email},
        **meta,
    )
    return {"ok": True, "magic_link": url, "audit": audit}


@router.delete("/{user_id}")
@limiter.limit(ADMIN_WRITE_LIMIT)
def delete_user(
    request: Request,
    user_id: UUID,
    body: UserDeleteBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    if not body.confirm and not body.dry_run:
        raise AkaraHTTPException(
            status_code=400,
            code="VALIDATION_ERROR",
            message="confirm=true is required",
        )

    supa = get_supabase_service_client()
    before = (
        supa.table("profiles")
        .select("*")
        .eq("id", str(user_id))
        .maybe_single()
        .execute()
    )
    if not before.data:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="User not found")

    if body.dry_run:
        return dry_run_response(
            action="superadmin.user.delete",
            before=before.data,
            impact={"hard_delete": True},
            warnings=["User will be removed from auth.users"],
        )

    try:
        supa.auth.admin.delete_user(str(user_id))
    except Exception as exc:
        raise AkaraHTTPException(
            status_code=502,
            code="SERVICE_UNAVAILABLE",
            message=f"Could not delete user: {exc}",
        ) from exc

    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.user.delete",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=UUID(before.data["tenant_id"]) if before.data.get("tenant_id") else None,
        before_state=before.data,
        after_state={},
        operation_id=body.operation_id,
        resource_type="user",
        resource_id=str(user_id),
        **meta,
    )
    return {"ok": True, "deleted_user_id": str(user_id), "audit": audit}
