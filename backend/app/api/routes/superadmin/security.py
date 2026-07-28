"""Superadmin security and delivery diagnostics."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Request

from app.core.rate_limit import ADMIN_READ_LIMIT, limiter
from app.core.superadmin import SuperAdmin
from app.core.tenant import get_supabase_service_client
from app.api.routes.admin.security import DeliveryLogRow, SecuritySummaryResponse

router = APIRouter(prefix="/security", tags=["superadmin-security"])


@router.get("/communications", response_model=SecuritySummaryResponse)
@limiter.limit(ADMIN_READ_LIMIT)
def communications_summary(
    request: Request,
    _admin: SuperAdmin,
) -> SecuritySummaryResponse:
    return _communications()


def _communications() -> SecuritySummaryResponse:
    supa = get_supabase_service_client()
    since = (datetime.now(UTC) - timedelta(hours=24)).isoformat()

    alert_triggers = (
        supa.table("alert_triggers")
        .select("id", count="exact")
        .gte("created_at", since)
        .execute()
    )
    last_trigger = (
        supa.table("alert_triggers")
        .select("created_at")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    deliveries = (
        supa.table("delivery_logs")
        .select("id, channel, template, status, created_at, tenant_id, error_message")
        .gte("created_at", since)
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    rows = deliveries.data or []
    whatsapp_skipped = sum(
        1 for r in rows if r.get("channel") == "whatsapp" and r.get("status") == "skipped"
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
        created = datetime.fromisoformat(str(p["created_at"]).replace("Z", "+00:00"))
        if (datetime.now(UTC) - created.replace(tzinfo=UTC)).days >= 1:
            pending_day1 += 1
        has_copilot = (
            supa.table("user_events")
            .select("event")
            .eq("user_id", uid)
            .eq("event", "first_copilot")
            .maybe_single()
            .execute()
        ).data
        if not has_copilot and (datetime.now(UTC) - created.replace(tzinfo=UTC)).days >= 3:
            pending_day3 += 1

    recent = [
        DeliveryLogRow(
            id=str(r["id"]),
            channel=r.get("channel", ""),
            template=r.get("template", ""),
            status=r.get("status", ""),
            created_at=str(r.get("created_at", "")),
            tenant_id=r.get("tenant_id"),
            error_message=r.get("error_message"),
        )
        for r in rows
    ]

    return SecuritySummaryResponse(
        alert_triggers_24h=getattr(alert_triggers, "count", None) or len(alert_triggers.data or []),
        last_alert_trigger_at=(
            last_trigger.data[0]["created_at"] if last_trigger.data else None
        ),
        residency_note="Customer data stored in Supabase (region configured at project creation).",
        delivery_logs_24h=len(rows),
        whatsapp_skipped_24h=whatsapp_skipped,
        activation_pending_day1=pending_day1,
        activation_pending_day3=pending_day3,
        recent_deliveries=recent,
    )
