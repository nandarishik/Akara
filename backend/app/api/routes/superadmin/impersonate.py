"""Superadmin impersonation."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from app.core.config import settings
from app.core.errors import AkaraHTTPException
from app.core.rate_limit import ADMIN_WRITE_LIMIT, limiter
from app.core.superadmin import SudoCtx, request_actor_meta, require_csrf
from app.core.tenant import get_supabase_service_client
from app.services.superadmin.audit import record_operation
from app.services.superadmin.mutations import SuperadminMutation, dry_run_response

router = APIRouter(prefix="/impersonate", tags=["superadmin-impersonate"])

IMPERSONATION_TTL = timedelta(minutes=15)


class ImpersonateBody(SuperadminMutation):
    target_user_id: UUID | None = None


class ImpersonateResponse(BaseModel):
    ok: bool = True
    session_id: str | None = None
    expires_at: str | None = None
    magic_link: str | None = None
    tenant_name: str | None = None
    target_user_id: str | None = None


class ImpersonateStopBody(SuperadminMutation):
    session_id: UUID | None = None


@router.post("/stop")
@limiter.limit(ADMIN_WRITE_LIMIT)
def stop_impersonation(
    request: Request,
    body: ImpersonateStopBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    supa = get_supabase_service_client()
    now = datetime.now(UTC).isoformat()

    if body.dry_run:
        return dry_run_response(
            action="superadmin.impersonate.stop",
            impact={"session_id": str(body.session_id) if body.session_id else "all_active"},
        )

    query = (
        supa.table("impersonation_sessions")
        .update({"ended_at": now})
        .eq("superadmin_id", str(admin.user_id))
        .is_("ended_at", "null")
    )
    if body.session_id:
        query = query.eq("id", str(body.session_id))
    result = query.execute()
    ended = len(result.data or [])

    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.impersonate.stop",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        operation_id=body.operation_id,
        details={"ended_count": ended, "session_id": str(body.session_id) if body.session_id else None},
        **meta,
    )
    return {"ok": True, "ended_count": ended, "audit": audit}


@router.post("/{tenant_id}")
@limiter.limit(ADMIN_WRITE_LIMIT)
def impersonate_tenant(
    request: Request,
    tenant_id: UUID,
    body: ImpersonateBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    supa = get_supabase_service_client()
    tenant = (
        supa.table("tenants")
        .select("id, name")
        .eq("id", str(tenant_id))
        .maybe_single()
        .execute()
    )
    if not tenant.data:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Tenant not found")

    if body.target_user_id:
        profile = (
            supa.table("profiles")
            .select("id, tenant_id")
            .eq("id", str(body.target_user_id))
            .maybe_single()
            .execute()
        )
        if not profile.data or profile.data.get("tenant_id") != str(tenant_id):
            raise AkaraHTTPException(
                status_code=400,
                code="VALIDATION_ERROR",
                message="Target user does not belong to tenant",
            )
        target_user_id = str(body.target_user_id)
    else:
        admins = (
            supa.table("profiles")
            .select("id")
            .eq("tenant_id", str(tenant_id))
            .eq("role", "admin")
            .limit(1)
            .execute()
        )
        if not admins.data:
            raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="No admin user for tenant")
        target_user_id = admins.data[0]["id"]

    expires_at = datetime.now(UTC) + IMPERSONATION_TTL
    session_id = uuid4()

    if body.dry_run:
        return dry_run_response(
            action="superadmin.impersonate",
            impact={
                "tenant_id": str(tenant_id),
                "target_user_id": target_user_id,
                "expires_at": expires_at.isoformat(),
            },
        )

    supa.table("impersonation_sessions").insert({
        "id": str(session_id),
        "superadmin_id": str(admin.user_id),
        "tenant_id": str(tenant_id),
        "target_user_id": target_user_id,
        "expires_at": expires_at.isoformat(),
    }).execute()

    try:
        auth_user = supa.auth.admin.get_user_by_id(target_user_id)
        email = auth_user.user.email if auth_user and auth_user.user else None
    except Exception as exc:
        raise AkaraHTTPException(
            status_code=502,
            code="SERVICE_UNAVAILABLE",
            message=f"Could not resolve target user: {exc}",
        ) from exc

    if not email:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Target user email not found")

    magic_link: str | None = None
    try:
        link_resp = supa.auth.admin.generate_link({
            "type": "magiclink",
            "email": email,
            "options": {"redirect_to": settings.customer_frontend_url},
        })
        props = getattr(link_resp, "properties", None)
        if props:
            magic_link = getattr(props, "action_link", None)
    except Exception as exc:
        raise AkaraHTTPException(
            status_code=502,
            code="SERVICE_UNAVAILABLE",
            message=f"Could not generate impersonation link: {exc}",
        ) from exc

    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.impersonate",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=tenant_id,
        operation_id=body.operation_id,
        resource_type="tenant",
        resource_id=str(tenant_id),
        details={
            "session_id": str(session_id),
            "target_user_id": target_user_id,
            "expires_at": expires_at.isoformat(),
        },
        **meta,
    )

    return ImpersonateResponse(
        session_id=str(session_id),
        expires_at=expires_at.isoformat(),
        magic_link=magic_link,
        tenant_name=tenant.data.get("name"),
        target_user_id=target_user_id,
    ).model_dump()
