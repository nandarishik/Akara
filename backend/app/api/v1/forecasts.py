"""Customer forecast APIs."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from app.core.rate_limit import limiter
from app.core.tenant import (
    TenantContext,
    get_supabase_service_client,
    get_tenant_context,
)

router = APIRouter(prefix="/forecasts", tags=["forecasts"])


class DayForecast(BaseModel):
    forecast_date: str
    predicted_revenue: float
    confidence_interval_low: float
    confidence_interval_high: float


@router.get("")
@limiter.limit("30/minute")
async def list_forecasts(
    request: Request,
    tenant: TenantContext = Depends(get_tenant_context),
    location_id: str | None = None,
    item_id: str | None = None,
) -> list[dict]:
    supa = get_supabase_service_client()
    q = supa.table("forecasts").select("*").eq("tenant_id", str(tenant.tenant_id))
    if location_id:
        q = q.eq("location_id", location_id)
    if item_id:
        q = q.eq("item_id", item_id)
    rows = q.order("forecast_date").execute().data or []
    grouped: dict[tuple[str, str | None], list] = {}
    for r in rows:
        key = (r["item_id"], r.get("location_id"))
        grouped.setdefault(key, []).append(
            {
                "forecast_date": r["forecast_date"],
                "predicted_revenue": float(r["predicted_revenue"]),
                "confidence_interval_low": float(r["confidence_interval_low"]),
                "confidence_interval_high": float(r["confidence_interval_high"]),
            }
        )
    return [
        {"item_id": item, "location_id": loc, "days": days}
        for (item, loc), days in grouped.items()
    ]


@router.get("/summary")
@limiter.limit("30/minute")
async def forecast_summary(
    request: Request,
    tenant: TenantContext = Depends(get_tenant_context),
) -> dict:
    items = await list_forecasts(request, tenant)
    total = 0.0
    count = 0
    for item in items:
        for day in item["days"]:
            total += day["predicted_revenue"]
        count += 1
    return {"predicted_revenue_7d": total, "item_count": count}
