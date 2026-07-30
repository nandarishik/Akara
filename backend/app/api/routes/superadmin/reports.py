"""Superadmin report triggers and system banner."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from app.core.errors import AkaraHTTPException
from app.core.pagination import OffsetPage, OffsetParams
from app.core.rate_limit import ADMIN_READ_LIMIT, BROADCAST_LIMIT, limiter
from app.core.superadmin import SuperAdmin, SudoCtx, request_actor_meta, require_csrf
from app.core.tenant import get_supabase_service_client
from app.services.debrief.service import WeeklyDebriefService
from app.services.email.morning_brief import MorningBriefService
from app.services.superadmin.audit import record_operation
from app.services.superadmin.broadcast import execute_broadcast
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
    scheduled_at: str | None = None


class SystemBannerBody(SuperadminMutation):
    message: str
    severity: str = Field(default="info", pattern="^(info|warning|error)$")
    expires_at: str | None = None


class BroadcastHistoryItem(BaseModel):
    id: str
    subject: str
    channels: list[str]
    tenant_count: int
    sent_count: int
    plan_filter: str | None = None
    status_filter: str | None = None
    body_html: str | None = None
    whatsapp_body: str | None = None
    scheduled_at: str | None = None
    status: str = "sent"
    created_at: str


@router.get("/reports/broadcast-history", response_model=OffsetPage[BroadcastHistoryItem])
@limiter.limit(ADMIN_READ_LIMIT)
def list_broadcast_history(
    request: Request,
    _admin: SuperAdmin,
    params: OffsetParams = Depends(),
) -> OffsetPage[BroadcastHistoryItem]:
    supa = get_supabase_service_client()
    result = (
        supa.table("broadcast_history")
        .select("*", count="exact")
        .order("created_at", desc=True)
        .range(params.offset, params.offset + params.limit - 1)
        .execute()
    )
    items = []
    for row in result.data or []:
        channels = row.get("channels") or []
        if isinstance(channels, str):
            channels = [channels]
        items.append(
            BroadcastHistoryItem(
                id=str(row["id"]),
                subject=row.get("subject") or "",
                channels=channels,
                tenant_count=int(row.get("tenant_count") or 0),
                sent_count=int(row.get("sent_count") or 0),
                plan_filter=row.get("plan_filter"),
                status_filter=row.get("status_filter"),
                body_html=row.get("body_html"),
                whatsapp_body=row.get("whatsapp_body"),
                scheduled_at=str(row["scheduled_at"]) if row.get("scheduled_at") else None,
                status=str(row.get("status") or "sent"),
                created_at=str(row.get("created_at") or ""),
            )
        )
    total = result.count or len(items)
    return OffsetPage.build(items, total, params)


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
                "scheduled_at": body.scheduled_at,
            },
        )

    scheduled_at: datetime | None = None
    if body.scheduled_at:
        try:
            scheduled_at = datetime.fromisoformat(body.scheduled_at.replace("Z", "+00:00"))
            if scheduled_at.tzinfo is None:
                scheduled_at = scheduled_at.replace(tzinfo=UTC)
        except ValueError as exc:
            raise AkaraHTTPException(
                status_code=400,
                code="VALIDATION_ERROR",
                message="Invalid scheduled_at datetime",
            ) from exc

    if scheduled_at and scheduled_at > datetime.now(UTC):
        row = {
            "subject": body.subject,
            "channels": body.channels,
            "tenant_count": len(tenants),
            "sent_count": 0,
            "plan_filter": body.plan_filter,
            "status_filter": body.status_filter,
            "body_html": body.body_html,
            "whatsapp_body": body.body_whatsapp,
            "scheduled_at": scheduled_at.isoformat(),
            "status": "scheduled",
            "actor_id": str(admin.user_id),
        }
        inserted = supa.table("broadcast_history").insert(row).execute()
        history_id = (inserted.data or [{}])[0].get("id")
        meta = request_actor_meta(request)
        audit = record_operation(
            action="superadmin.reports.broadcast_scheduled",
            actor_id=admin.user_id,
            actor_email=admin.email,
            reason=body.reason,
            operation_id=body.operation_id,
            details={"history_id": history_id, "scheduled_at": row["scheduled_at"]},
            **meta,
        )
        return {
            "ok": True,
            "scheduled": True,
            "history_id": history_id,
            "scheduled_at": row["scheduled_at"],
            "tenant_count": len(tenants),
            "audit": audit,
        }

    result = execute_broadcast(
        subject=body.subject,
        body_html=body.body_html,
        body_whatsapp=body.body_whatsapp,
        channels=body.channels,
        plan_filter=body.plan_filter,
        status_filter=body.status_filter,
        actor_id=str(admin.user_id),
    )

    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.reports.broadcast",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        operation_id=body.operation_id,
        details={
            "sent": result["sent"],
            "tenant_count": result["tenant_count"],
            "subject": body.subject,
        },
        **meta,
    )
    return {"ok": True, "sent": result["sent"], "tenant_count": result["tenant_count"], "audit": audit}


@router.post("/reports/broadcast/{history_id}/cancel")
@limiter.limit(BROADCAST_LIMIT)
def cancel_scheduled_broadcast(
    request: Request,
    history_id: UUID,
    body: SuperadminMutation,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    supa = get_supabase_service_client()
    row = (
        supa.table("broadcast_history")
        .select("id, status, subject")
        .eq("id", str(history_id))
        .maybe_single()
        .execute()
    )
    if not row.data:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Broadcast not found")
    if row.data.get("status") != "scheduled":
        raise AkaraHTTPException(
            status_code=400,
            code="VALIDATION_ERROR",
            message="Only scheduled broadcasts can be cancelled",
        )
    if body.dry_run:
        return dry_run_response(
            action="superadmin.reports.broadcast_cancel",
            impact={"history_id": str(history_id), "subject": row.data.get("subject")},
        )

    supa.table("broadcast_history").update({"status": "cancelled"}).eq("id", str(history_id)).execute()
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.reports.broadcast_cancel",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        operation_id=body.operation_id,
        details={"history_id": str(history_id)},
        **meta,
    )
    return {"ok": True, "cancelled": True, "audit": audit}


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
