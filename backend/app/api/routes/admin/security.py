"""Superadmin security ops summary."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.routes.admin.tenants import _require_superadmin
from app.core.plan_limits import PLAN_LIMITS
from app.core.tenant import TenantContext, get_supabase_service_client

router = APIRouter(prefix="/admin/security", tags=["admin-security"])


class SecuritySummaryResponse(BaseModel):
    alert_triggers_24h: int
    last_alert_trigger_at: str | None
    residency_note: str
    delivery_logs_24h: int = 0
    whatsapp_skipped_24h: int = 0
    activation_pending_day1: int = 0
    activation_pending_day3: int = 0
    recent_deliveries: list["DeliveryLogRow"] = []


class DeliveryLogRow(BaseModel):
    id: str
    channel: str
    template: str
    status: str
    created_at: str
    tenant_id: str | None = None
    error_message: str | None = None


def communications_summary(
    _admin: TenantContext = Depends(_require_superadmin),
) -> SecuritySummaryResponse:
    base = security_summary(_admin)
    supa = get_supabase_service_client()
    since = (datetime.now(UTC) - timedelta(hours=24)).isoformat()
    deliveries = (
        supa.table("delivery_logs")
        .select("status, channel, error_message")
        .gte("created_at", since)
        .execute()
    )
    rows = deliveries.data or []
    whatsapp_skipped = sum(
        1 for r in rows
        if r.get("channel") == "whatsapp" and r.get("status") == "skipped"
    )

    profiles = supa.table("profiles").select("id, created_at").not_.is_("tenant_id", "null").execute()
    pending_day1 = pending_day3 = 0
    for p in profiles.data or []:
        uid = p["id"]
        has_import = (
            supa.table("user_events")
            .select("event")
            .eq("user_id", uid)
            .eq("event", "first_import")
            .maybe_single()
            .execute()
        ).data
        if has_import:
            continue
        days = (datetime.now(UTC) - datetime.fromisoformat(str(p["created_at"]).replace("Z", "+00:00"))).days
        if days >= 1:
            pending_day1 += 1
        has_copilot = (
            supa.table("user_events")
            .select("event")
            .eq("user_id", uid)
            .eq("event", "first_copilot")
            .maybe_single()
            .execute()
        ).data
        if not has_copilot and days >= 3:
            pending_day3 += 1

    return SecuritySummaryResponse(
        alert_triggers_24h=base.alert_triggers_24h,
        last_alert_trigger_at=base.last_alert_trigger_at,
        residency_note=base.residency_note,
        delivery_logs_24h=len(rows),
        whatsapp_skipped_24h=whatsapp_skipped,
        activation_pending_day1=pending_day1,
        activation_pending_day3=pending_day3,
        recent_deliveries=[
            DeliveryLogRow(
                id=str(r.get("id", "")),
                channel=r.get("channel", ""),
                template=r.get("template", ""),
                status=r.get("status", ""),
                created_at=str(r.get("created_at", "")),
                tenant_id=r.get("tenant_id"),
                error_message=r.get("error_message"),
            )
            for r in (supa.table("delivery_logs")
                .select("id, channel, template, status, created_at, tenant_id, error_message")
                .order("created_at", desc=True)
                .limit(20)
                .execute()
            ).data or []
        ],
    )


@router.get("/summary", response_model=SecuritySummaryResponse)
def security_summary(
    _admin: TenantContext = Depends(_require_superadmin),
) -> SecuritySummaryResponse:
    supa = get_supabase_service_client()
    since = (datetime.now(UTC) - timedelta(hours=24)).isoformat()
    events = (
        supa.table("alert_trigger_events")
        .select("created_at")
        .gte("created_at", since)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    rows = events.data or []
    last_at = rows[0]["created_at"] if rows else None
    return SecuritySummaryResponse(
        alert_triggers_24h=len(rows),
        last_alert_trigger_at=last_at,
        residency_note=(
            "Verify Supabase project region is ap-south-1 or ap-south-2 in dashboard settings."
        ),
    )
