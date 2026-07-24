"""Superadmin security ops summary."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.routes.admin.tenants import _require_superadmin
from app.core.tenant import TenantContext, get_supabase_service_client

router = APIRouter(prefix="/admin/security", tags=["admin-security"])


class SecuritySummaryResponse(BaseModel):
    alert_triggers_24h: int
    last_alert_trigger_at: str | None
    residency_note: str


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
