"""Tenant alert CRUD API."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel, Field

from app.core.errors import AkaraHTTPException
from app.core.plan_guard import FeatureBlocked, _effective_plan
from app.core.plan_limits import get_limit
from app.core.rate_limit import limiter
from app.core.tenant import (
    TenantContext,
    get_supabase_service_client,
    get_tenant_context,
)
from app.domain.intelligence.alert_metrics import CAFE_ALERT_METRICS

router = APIRouter(prefix="/alerts", tags=["alerts"])


class AlertCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    metric: str
    condition: str = Field(..., pattern="^(below|above|equals)$")
    threshold: float
    dimension: str | None = None
    delivery: list[str] = Field(default_factory=lambda: ["email"])
    cooldown_hours: int = Field(default=24, ge=1, le=168)
    escalation_level: str = "daily_digest"
    channel_email: bool = True
    channel_whatsapp: bool = False
    channel_in_app: bool = True
    anomaly_detection: bool = False


class AlertUpdate(BaseModel):
    name: str | None = None
    threshold: float | None = None
    dimension: str | None = None
    is_active: bool | None = None
    cooldown_hours: int | None = Field(default=None, ge=1, le=168)
    escalation_level: str | None = None
    channel_email: bool | None = None
    channel_whatsapp: bool | None = None
    channel_in_app: bool | None = None


class AlertOut(BaseModel):
    id: UUID
    name: str
    metric: str
    condition: str
    threshold: float
    dimension: str | None
    delivery: list[str]
    cooldown_hours: int
    is_active: bool
    last_triggered: str | None
    escalation_level: str | None = None
    channel_email: bool | None = None
    channel_whatsapp: bool | None = None
    channel_in_app: bool | None = None


def _require_alerts_feature(
    tenant: TenantContext = Depends(get_tenant_context),
) -> TenantContext:
    plan = _effective_plan(tenant)
    max_alerts = get_limit(plan, "alerts_max")
    if max_alerts == 0:
        raise FeatureBlocked(
            message="Alerts are available on Pro and Business plans.",
            feature="alerts",
        )
    return tenant


def _count_alerts(tenant_id: UUID) -> int:
    supa = get_supabase_service_client()
    result = (
        supa.table("tenant_alerts")
        .select("id", count="exact")
        .eq("tenant_id", str(tenant_id))
        .execute()
    )
    return result.count or 0


class AlertHistoryItem(BaseModel):
    id: UUID
    metric: str
    metric_label: str
    value: float
    threshold: float
    channel: str
    escalation_level: str
    timestamp: str


METRIC_LABELS = {
    "revenue_below_threshold": "Daily revenue falls below ₹X",
    "food_cost_above_threshold": "Food cost ratio exceeds X%",
    "orders_below_expected": "Order count falls below X",
    "item_not_selling": "Item not sold for 3+ days",
    "anomaly": "Unusual pattern detected (AI)",
}


@router.get("/history")
@limiter.limit("30/minute")
async def alert_history(
    request: Request,
    tenant: TenantContext = Depends(_require_alerts_feature),
) -> dict:
    supa = get_supabase_service_client()
    rows = (
        supa.table("alert_trigger_events")
        .select("*")
        .eq("tenant_id", str(tenant.tenant_id))
        .order("created_at", desc=True)
        .limit(100)
        .execute()
        .data
        or []
    )
    items = []
    for r in rows:
        metric = r.get("metric") or ""
        items.append(
            {
                "id": r["id"],
                "metric": metric,
                "metric_label": METRIC_LABELS.get(metric, metric),
                "value": float(r.get("metric_value") or 0),
                "threshold": float(r.get("threshold") or 0),
                "channel": r.get("channel") or "email",
                "escalation_level": r.get("escalation_level") or "daily_digest",
                "timestamp": r.get("created_at"),
            }
        )
    return {"items": items}


@router.get("", response_model=list[AlertOut])
@limiter.limit("30/minute")
async def list_alerts(
    request: Request,
    tenant: TenantContext = Depends(_require_alerts_feature),
) -> list[AlertOut]:
    supa = get_supabase_service_client()
    rows = (
        supa.table("tenant_alerts")
        .select("*")
        .eq("tenant_id", str(tenant.tenant_id))
        .order("created_at", desc=True)
        .execute()
    )
    return [
        AlertOut(
            id=UUID(r["id"]),
            name=r["name"],
            metric=r["metric"],
            condition=r["condition"],
            threshold=float(r["threshold"]),
            dimension=r.get("dimension"),
            delivery=r.get("delivery") or ["email"],
            cooldown_hours=int(r.get("cooldown_hours") or 24),
            is_active=bool(r.get("is_active", True)),
            last_triggered=r.get("last_triggered"),
        )
        for r in (rows.data or [])
    ]


@router.post("", response_model=AlertOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def create_alert(
    request: Request,
    body: AlertCreate,
    tenant: TenantContext = Depends(_require_alerts_feature),
) -> AlertOut:
    if body.metric not in CAFE_ALERT_METRICS:
        raise AkaraHTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="VALIDATION_ERROR",
            message="Invalid metric",
        )

    plan = _effective_plan(tenant)
    max_alerts = get_limit(plan, "alerts_max")
    if max_alerts != -1 and _count_alerts(tenant.tenant_id) >= max_alerts:
        raise AkaraHTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            code="QUOTA_EXCEEDED",
            message=f"Alert limit reached ({max_alerts} on {plan} plan)",
        )

    supa = get_supabase_service_client()
    row = {
        "tenant_id": str(tenant.tenant_id),
        "name": body.name,
        "metric": body.metric,
        "condition": body.condition,
        "threshold": body.threshold,
        "dimension": body.dimension,
        "delivery": body.delivery,
        "cooldown_hours": body.cooldown_hours,
        "is_active": True,
        "escalation_level": body.escalation_level,
        "channel_email": body.channel_email,
        "channel_whatsapp": body.channel_whatsapp,
        "channel_in_app": body.channel_in_app,
        "anomaly_detection": body.anomaly_detection,
    }
    result = supa.table("tenant_alerts").insert(row).execute()
    if not result.data:
        raise AkaraHTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code="INTERNAL_ERROR",
            message="Could not create alert",
        )
    r = result.data[0]
    return AlertOut(
        id=UUID(r["id"]),
        name=r["name"],
        metric=r["metric"],
        condition=r["condition"],
        threshold=float(r["threshold"]),
        dimension=r.get("dimension"),
        delivery=r.get("delivery") or ["email"],
        cooldown_hours=int(r.get("cooldown_hours") or 24),
        is_active=True,
        last_triggered=None,
    )


@router.put("/{alert_id}", response_model=AlertOut)
@limiter.limit("30/minute")
async def put_alert(
    request: Request,
    alert_id: UUID,
    body: AlertUpdate,
    tenant: TenantContext = Depends(_require_alerts_feature),
) -> AlertOut:
    return await update_alert(request, alert_id, body, tenant)


@router.patch("/{alert_id}", response_model=AlertOut)
@limiter.limit("30/minute")
async def update_alert(
    request: Request,
    alert_id: UUID,
    body: AlertUpdate,
    tenant: TenantContext = Depends(_require_alerts_feature),
) -> AlertOut:
    supa = get_supabase_service_client()
    existing = (
        supa.table("tenant_alerts")
        .select("*")
        .eq("id", str(alert_id))
        .eq("tenant_id", str(tenant.tenant_id))
        .maybe_single()
        .execute()
    )
    if not existing.data:
        raise AkaraHTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="NOT_FOUND",
            message="Alert not found",
        )

    update: dict = {"updated_at": datetime.now(UTC).isoformat()}
    if body.name is not None:
        update["name"] = body.name
    if body.threshold is not None:
        update["threshold"] = body.threshold
    if body.dimension is not None:
        update["dimension"] = body.dimension
    if body.is_active is not None:
        update["is_active"] = body.is_active
    if body.cooldown_hours is not None:
        update["cooldown_hours"] = body.cooldown_hours
    if body.escalation_level is not None:
        update["escalation_level"] = body.escalation_level
    if body.channel_email is not None:
        update["channel_email"] = body.channel_email
    if body.channel_whatsapp is not None:
        update["channel_whatsapp"] = body.channel_whatsapp
    if body.channel_in_app is not None:
        update["channel_in_app"] = body.channel_in_app

    supa.table("tenant_alerts").update(update).eq("id", str(alert_id)).execute()
    refreshed = (
        supa.table("tenant_alerts")
        .select("*")
        .eq("id", str(alert_id))
        .single()
        .execute()
    )
    r = refreshed.data
    return AlertOut(
        id=UUID(r["id"]),
        name=r["name"],
        metric=r["metric"],
        condition=r["condition"],
        threshold=float(r["threshold"]),
        dimension=r.get("dimension"),
        delivery=r.get("delivery") or ["email"],
        cooldown_hours=int(r.get("cooldown_hours") or 24),
        is_active=bool(r.get("is_active", True)),
        last_triggered=r.get("last_triggered"),
    )


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("30/minute")
async def delete_alert(
    request: Request,
    alert_id: UUID,
    tenant: TenantContext = Depends(_require_alerts_feature),
) -> None:
    supa = get_supabase_service_client()
    supa.table("tenant_alerts").delete().eq("id", str(alert_id)).eq(
        "tenant_id", str(tenant.tenant_id)
    ).execute()
