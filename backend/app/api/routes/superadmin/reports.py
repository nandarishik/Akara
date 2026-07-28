"""Superadmin report triggers and system banner."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.core.errors import AkaraHTTPException
from app.core.rate_limit import BROADCAST_LIMIT, limiter
from app.core.superadmin import SudoCtx, request_actor_meta, require_csrf
from app.core.tenant import get_supabase_service_client
from app.services.debrief.service import WeeklyDebriefService
from app.services.email.morning_brief import MorningBriefService
from app.services.superadmin.audit import record_operation
from app.services.superadmin.mutations import SuperadminMutation, dry_run_response

logger = logging.getLogger(__name__)

router = APIRouter(tags=["superadmin-reports"])


class MorningBriefBody(SuperadminMutation):
    channel: str = Field(default="email", pattern="^(email|whatsapp|both)$")
    recipient_email: str | None = None


class WeeklyDebriefBody(SuperadminMutation):
    force_regenerate: bool = False


class BroadcastBody(SuperadminMutation):
    subject: str
    body_html: str
    body_whatsapp: str = ""
    channels: list[str] = Field(default_factory=lambda: ["email"])
    plan_filter: str | None = None
    status_filter: str | None = None


class SystemBannerBody(SuperadminMutation):
    message: str
    severity: str = Field(default="info", pattern="^(info|warning|error)$")
    expires_at: str | None = None


@router.post("/reports/morning-brief/{tenant_id}")
@limiter.limit(BROADCAST_LIMIT)
async def trigger_morning_brief(
    request: Request,
    tenant_id: UUID,
    body: MorningBriefBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    supa = get_supabase_service_client()
    tenant = (
        supa.table("tenants")
        .select("name")
        .eq("id", str(tenant_id))
        .maybe_single()
        .execute()
    )
    if not tenant.data:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Tenant not found")

    profiles = (
        supa.table("profiles")
        .select("id")
        .eq("tenant_id", str(tenant_id))
        .eq("role", "admin")
        .limit(1)
        .execute()
    )
    if not profiles.data:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="No admin user")

    try:
        auth_user = supa.auth.admin.get_user_by_id(profiles.data[0]["id"])
        email = body.recipient_email or (
            auth_user.user.email if auth_user and auth_user.user else None
        )
    except Exception as exc:
        raise AkaraHTTPException(
            status_code=502,
            code="SERVICE_UNAVAILABLE",
            message="Could not resolve recipient",
        ) from exc

    if not email:
        raise AkaraHTTPException(status_code=400, code="VALIDATION_ERROR", message="No recipient email")

    if body.dry_run:
        return dry_run_response(
            action="superadmin.reports.morning_brief",
            impact={"tenant_id": str(tenant_id), "email": email, "channel": body.channel},
        )

    service = MorningBriefService(supabase=supa)
    result = service.send_brief(
        tenant_id=tenant_id,
        recipient_email=email,
        recipient_name="",
        tenant_name=tenant.data.get("name", "AKARA Tenant"),
    )
    if not result.success:
        raise AkaraHTTPException(
            status_code=500,
            code="INTERNAL_ERROR",
            message=result.message,
        )

    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.reports.morning_brief",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=tenant_id,
        operation_id=body.operation_id,
        details={"email": email, "channel": body.channel},
        **meta,
    )
    return {"ok": True, "result": result.model_dump(), "audit": audit}


@router.post("/reports/weekly-debrief/{tenant_id}")
@limiter.limit(BROADCAST_LIMIT)
async def trigger_weekly_debrief(
    request: Request,
    tenant_id: UUID,
    body: WeeklyDebriefBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    if body.dry_run:
        return dry_run_response(
            action="superadmin.reports.weekly_debrief",
            impact={"tenant_id": str(tenant_id), "force_regenerate": body.force_regenerate},
        )

    supa = get_supabase_service_client()
    service = WeeklyDebriefService(supabase=supa)
    result = await service.generate_for_tenant(
        tenant_id,
        force_regenerate=body.force_regenerate,
        manual=True,
    )
    if result.status not in ("ok", "skipped", "skipped_insufficient_data"):
        raise AkaraHTTPException(
            status_code=500,
            code="INTERNAL_ERROR",
            message=result.message,
        )

    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.reports.weekly_debrief",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=tenant_id,
        operation_id=body.operation_id,
        details={"status": result.status, "report_id": result.report_id},
        **meta,
    )
    return {
        "ok": True,
        "status": result.status,
        "report_id": result.report_id,
        "message": result.message,
        "audit": audit,
    }


@router.post("/reports/broadcast")
@limiter.limit(BROADCAST_LIMIT)
def broadcast_message(
    request: Request,
    body: BroadcastBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    supa = get_supabase_service_client()
    query = supa.table("tenants").select("id, name, plan, plan_status")
    if body.plan_filter:
        query = query.eq("plan", body.plan_filter)
    if body.status_filter:
        query = query.eq("plan_status", body.status_filter)
    tenants = query.execute().data or []

    if body.dry_run:
        return dry_run_response(
            action="superadmin.reports.broadcast",
            impact={
                "tenant_count": len(tenants),
                "channels": body.channels,
                "subject": body.subject,
            },
        )

    sent = 0
    for tenant in tenants:
        profiles = (
            supa.table("profiles")
            .select("id")
            .eq("tenant_id", tenant["id"])
            .eq("role", "admin")
            .limit(1)
            .execute()
        )
        if not profiles.data:
            continue
        try:
            user = supa.auth.admin.get_user_by_id(profiles.data[0]["id"])
            email = user.user.email if user and user.user else None
        except Exception:
            email = None
        if email and "email" in body.channels:
            try:
                from app.services.billing.email import _send

                if _send(email, body.subject, body.body_html):
                    sent += 1
            except Exception as exc:
                logger.warning("Broadcast email failed for %s: %s", tenant["id"], exc)

    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.reports.broadcast",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        operation_id=body.operation_id,
        details={"sent": sent, "tenant_count": len(tenants), "subject": body.subject},
        **meta,
    )
    return {"ok": True, "sent": sent, "tenant_count": len(tenants), "audit": audit}


@router.post("/notifications/system-banner")
@limiter.limit(BROADCAST_LIMIT)
def set_system_banner(
    request: Request,
    body: SystemBannerBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    banner = {
        "message": body.message,
        "severity": body.severity,
        "expires_at": body.expires_at,
    }
    if body.dry_run:
        return dry_run_response(
            action="superadmin.notifications.system_banner",
            impact={"banner": banner},
        )

    supa = get_supabase_service_client()
    supa.table("global_settings").upsert({
        "key": "system_banner",
        "value": banner,
        "updated_at": "now()",
    }).execute()

    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.notifications.system_banner",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        operation_id=body.operation_id,
        after_state=banner,
        **meta,
    )
    return {"ok": True, "banner": banner, "audit": audit}


@router.delete("/notifications/system-banner")
@limiter.limit(BROADCAST_LIMIT)
def clear_system_banner(
    request: Request,
    body: SuperadminMutation,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    if body.dry_run:
        return dry_run_response(
            action="superadmin.notifications.system_banner_clear",
            impact={"system_banner": None},
        )

    supa = get_supabase_service_client()
    supa.table("global_settings").upsert({
        "key": "system_banner",
        "value": None,
        "updated_at": "now()",
    }).execute()

    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.notifications.system_banner_clear",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        operation_id=body.operation_id,
        **meta,
    )
    return {"ok": True, "cleared": True, "audit": audit}
