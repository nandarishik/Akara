"""Café master data: locations, channels, flags, data-quality."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request, status
from pydantic import BaseModel, Field

from app.core.errors import AkaraHTTPException
from app.core.plan_limits import is_feature_enabled, resolve_limit
from app.core.rate_limit import limiter
from app.core.tenant import TenantCtx, get_supabase_service_client

router = APIRouter(prefix="/data/cafe", tags=["cafe-data"])


class LocationCreate(BaseModel):
    location_name: str
    address: str | None = None
    city: str | None = None
    state_code: str | None = None
    gstin: str | None = None
    fssai_number: str | None = None


class ChannelCreate(BaseModel):
    channel_name: str
    channel_type: str = Field(..., pattern="^(dine-in|takeaway|delivery|aggregator|online|other)$")
    commission_rate: float | None = None


def _admin(tenant: TenantCtx) -> None:
    if not tenant.is_admin:
        raise AkaraHTTPException(status_code=status.HTTP_403_FORBIDDEN, code="FORBIDDEN", message="Admins only")


@router.get("/locations")
@limiter.limit("30/minute")
def list_locations(request: Request, tenant: TenantCtx) -> dict[str, Any]:
    _admin(tenant)
    rows = (
        get_supabase_service_client()
        .table("canonical_locations")
        .select("id, location_name, city, state_code, is_active")
        .eq("tenant_id", str(tenant.tenant_id))
        .execute()
    )
    locations = [
        {
            "location_id": r["id"],
            "location_name": r.get("location_name"),
            "city": r.get("city"),
            "state_code": r.get("state_code"),
            "is_active": r.get("is_active", True),
        }
        for r in (rows.data or [])
    ]
    return {"locations": locations}


@router.post("/locations")
@limiter.limit("20/minute")
def create_location(request: Request, body: LocationCreate, tenant: TenantCtx) -> dict[str, Any]:
    _admin(tenant)
    row = {
        "tenant_id": str(tenant.tenant_id),
        "location_name": body.location_name,
        "address": body.address,
        "city": body.city,
        "state_code": body.state_code,
        "gstin": body.gstin,
        "fssai_number": body.fssai_number,
        "is_active": True,
    }
    result = get_supabase_service_client().table("canonical_locations").insert(row).execute()
    return {"location": (result.data or [row])[0]}


@router.get("/channels")
@limiter.limit("30/minute")
def list_channels(request: Request, tenant: TenantCtx) -> dict[str, Any]:
    _admin(tenant)
    rows = (
        get_supabase_service_client()
        .table("canonical_channels")
        .select("id, channel_name, channel_type, commission_rate, is_active")
        .eq("tenant_id", str(tenant.tenant_id))
        .execute()
    )
    channels = [
        {
            "channel_id": r["id"],
            "channel_name": r.get("channel_name"),
            "channel_type": r.get("channel_type"),
            "commission_rate": r.get("commission_rate"),
            "is_active": r.get("is_active", True),
        }
        for r in (rows.data or [])
    ]
    return {"channels": channels}


@router.post("/channels")
@limiter.limit("20/minute")
def upsert_channel(request: Request, body: ChannelCreate, tenant: TenantCtx) -> dict[str, Any]:
    _admin(tenant)
    row = {
        "tenant_id": str(tenant.tenant_id),
        "channel_name": body.channel_name,
        "channel_type": body.channel_type,
        "commission_rate": body.commission_rate,
        "is_active": True,
    }
    result = (
        get_supabase_service_client()
        .table("canonical_channels")
        .upsert(row, on_conflict="tenant_id,channel_name")
        .execute()
    )
    return {"channel": (result.data or [row])[0]}


@router.get("/data-quality")
@limiter.limit("30/minute")
def data_quality(request: Request, tenant: TenantCtx) -> dict[str, Any]:
    _admin(tenant)
    jobs = (
        get_supabase_service_client()
        .table("import_jobs")
        .select("completed_at, canonical_row_count, quarantine_row_count")
        .eq("tenant_id", str(tenant.tenant_id))
        .like("import_type", "cafe_%")
        .order("completed_at", desc=True)
        .limit(1)
        .execute()
    )
    latest = (jobs.data or [None])[0]
    canonical = int((latest or {}).get("canonical_row_count") or 0)
    quarantine = int((latest or {}).get("quarantine_row_count") or 0)
    denom = canonical + quarantine
    completeness = 100.0 if denom == 0 else round(100 * canonical / denom, 1)
    return {
        "last_import_at": (latest or {}).get("completed_at"),
        "coverage_days": 0,
        "completeness_pct": completeness,
        "quarantine_unresolved": quarantine,
        "channels_mapped": 0,
        "channels_total": 0,
    }


@router.get("/flags")
@limiter.limit("60/minute")
def cafe_flags(request: Request, tenant: TenantCtx) -> dict[str, Any]:
    overrides = tenant.feature_overrides or {}
    return {
        "cafe_import": is_feature_enabled(tenant.plan, "cafe_import", overrides),
        "ai_mapping": is_feature_enabled(tenant.plan, "ai_mapping", overrides),
        "quarantine_ui": is_feature_enabled(tenant.plan, "quarantine_ui", overrides),
        "max_upload_bytes": int(resolve_limit(tenant, "max_upload_bytes") or 10_000_000),
    }
