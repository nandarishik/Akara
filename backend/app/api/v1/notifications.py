"""Notification preference matrix — GET/PUT /notifications/preferences."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict

from app.core.rate_limit import limiter
from app.core.tenant import (
    TenantContext,
    get_supabase_service_client,
    get_tenant_context,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])

PREF_KEYS = ("revenue_drop", "food_cost_high", "orders_low", "item_not_selling", "anomaly")


class ChannelPreference(BaseModel):
    email: bool
    whatsapp: bool
    in_app: bool


class NotificationPreferencesPut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revenue_drop: ChannelPreference
    food_cost_high: ChannelPreference
    orders_low: ChannelPreference
    item_not_selling: ChannelPreference
    anomaly: ChannelPreference


def _default_prefs() -> dict:
    row = {"email": True, "whatsapp": False, "in_app": True}
    return {k: dict(row) for k in PREF_KEYS}


@router.get("/preferences")
@limiter.limit("30/minute")
async def get_prefs(
    request: Request,
    tenant: TenantContext = Depends(get_tenant_context),
) -> dict:
    supa = get_supabase_service_client()
    profile = (
        supa.table("tenant_profiles")
        .select("alert_prefs")
        .eq("tenant_id", str(tenant.tenant_id))
        .maybe_single()
        .execute()
        .data
    )
    prefs = (profile or {}).get("alert_prefs") or _default_prefs()
    user_prefs = (
        supa.table("profiles")
        .select("preferences")
        .eq("id", str(tenant.user_id))
        .maybe_single()
        .execute()
        .data
    )
    whatsapp = True
    if user_prefs and isinstance(user_prefs.get("preferences"), dict):
        whatsapp = bool(user_prefs["preferences"].get("whatsapp_alerts_enabled", True))
    return {**_default_prefs(), **prefs, "whatsapp_alerts_enabled": whatsapp}


@router.put("/preferences")
@limiter.limit("30/minute")
async def put_prefs(
    request: Request,
    body: NotificationPreferencesPut,
    tenant: TenantContext = Depends(get_tenant_context),
) -> dict:
    payload = body.model_dump()
    supa = get_supabase_service_client()
    supa.table("tenant_profiles").upsert(
        {"tenant_id": str(tenant.tenant_id), "alert_prefs": payload}
    ).execute()
    return await get_prefs(request, tenant)
