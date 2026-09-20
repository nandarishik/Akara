"""Café KPI v2 service — Partial shell until full 18-metric SQL lands.

Returns frozen contract shapes with null metric values and partial evidence
so DEV2 can bind. Queries stay tenant-scoped via TenantCtx on the route.
"""

from __future__ import annotations

from datetime import date, timedelta
from uuid import UUID

from supabase import Client

from app.domain.kpi.cafe_models import (
    CafeChannelResponse,
    CafeDaypartResponse,
    CafeItemsResponse,
    CafeSummaryMetrics,
    CafeSummaryResponse,
    CafeTrendsResponse,
    DaypartCell,
    FoodCostAlertResponse,
    MetricDef,
    MetricEvidencePayload,
    MetricValue,
    MetricsListResponse,
    PeriodWindow,
    TrendPoint,
)

_DAYPARTS = ("breakfast", "lunch", "afternoon", "dinner", "late_night")

_DEFAULT_METRICS: list[MetricDef] = [
    MetricDef(
        metric_id="revenue",
        name="Revenue",
        description="Gross sales for the selected period.",
        unit="INR",
        version=1,
    ),
    MetricDef(
        metric_id="food_cost_pct",
        name="Food Cost %",
        description="Food cost as a percentage of revenue.",
        unit="%",
        version=1,
    ),
    MetricDef(
        metric_id="aov",
        name="Average Order Value",
        description="Revenue divided by order count.",
        unit="INR",
        version=1,
    ),
    MetricDef(
        metric_id="orders",
        name="Orders",
        description="Count of orders in the selected period.",
        unit="count",
        version=1,
    ),
]


def _period(from_date: str, to_date: str) -> PeriodWindow:
    return PeriodWindow(**{"from": from_date, "to": to_date, "timezone": "Asia/Kolkata"})


def _empty_evidence(*, partial: bool = True) -> MetricEvidencePayload:
    return MetricEvidencePayload(
        order_count=0,
        last_import_at=None,
        last_updated_minutes_ago=None,
        metric_versions={"revenue": 1, "food_cost_pct": 1, "orders": 1, "aov": 1},
        partial=partial,
        partial_message="Café metrics v2 shell — full SQL pending ops apply of 052–055."
        if partial
        else None,
    )


class CafeKPIService:
    """Partial café metrics. Tenant id is accepted for future SQL filters."""

    def __init__(self, supabase: Client) -> None:
        self._supabase = supabase

    def summary(
        self,
        tenant_id: UUID,
        from_date: str,
        to_date: str,
        *,
        location_id: str | None = None,
        channel: str | None = None,
        category: str | None = None,
    ) -> CafeSummaryResponse:
        _ = (tenant_id, location_id, channel, category)
        evidence = _empty_evidence()
        return CafeSummaryResponse(
            period=_period(from_date, to_date),
            evidence=evidence,
            metrics=CafeSummaryMetrics(
                revenue=MetricValue(value=None, currency="INR"),
                food_cost_pct=MetricValue(
                    value=None,
                    unit="%",
                    setup_cta="expense_tracking",
                ),
                orders=MetricValue(value=None, unit="count"),
                aov=MetricValue(value=None, currency="INR"),
            ),
        )

    def trends(
        self,
        tenant_id: UUID,
        from_date: str,
        to_date: str,
        *,
        location_id: str | None = None,
        channel: str | None = None,
        category: str | None = None,
    ) -> CafeTrendsResponse:
        _ = (tenant_id, location_id, channel, category)
        start = date.fromisoformat(from_date)
        points_7: list[TrendPoint] = []
        for i in range(7):
            d = (start + timedelta(days=i)).isoformat()
            points_7.append(TrendPoint(date=d, revenue=None, orders=None))
        return CafeTrendsResponse(
            period=_period(from_date, to_date),
            evidence=_empty_evidence(),
            trend_7d=points_7,
            trend_30d=points_7,
        )

    def channel(
        self,
        tenant_id: UUID,
        from_date: str,
        to_date: str,
        *,
        location_id: str | None = None,
        channel: str | None = None,
        category: str | None = None,
    ) -> CafeChannelResponse:
        _ = (tenant_id, from_date, to_date, location_id, channel, category)
        return CafeChannelResponse(evidence=_empty_evidence(), channels=[])

    def daypart(
        self,
        tenant_id: UUID,
        from_date: str,
        to_date: str,
        *,
        location_id: str | None = None,
        channel: str | None = None,
        category: str | None = None,
    ) -> CafeDaypartResponse:
        _ = (tenant_id, from_date, to_date, location_id, channel, category)
        cells = [
            DaypartCell(daypart=dp, day_of_week=dow, orders=None, revenue=None)
            for dow in range(7)
            for dp in _DAYPARTS
        ]
        return CafeDaypartResponse(evidence=_empty_evidence(), cells=cells)

    def items(
        self,
        tenant_id: UUID,
        from_date: str,
        to_date: str,
        *,
        location_id: str | None = None,
        channel: str | None = None,
        category: str | None = None,
    ) -> CafeItemsResponse:
        _ = (tenant_id, from_date, to_date, location_id, channel, category)
        return CafeItemsResponse(evidence=_empty_evidence(), items=[])

    def food_cost_alert(
        self,
        tenant_id: UUID,
        from_date: str,
        to_date: str,
        *,
        location_id: str | None = None,
        channel: str | None = None,
        category: str | None = None,
    ) -> FoodCostAlertResponse:
        _ = (tenant_id, from_date, to_date, location_id, channel, category)
        return FoodCostAlertResponse(
            food_cost_pct=None,
            threshold=30.0,
            alert=False,
            alert_message=None,
            setup_cta="expense_tracking",
            evidence=_empty_evidence(),
        )

    def list_metrics(self, tenant_id: UUID) -> MetricsListResponse:
        _ = tenant_id
        try:
            result = (
                self._supabase.table("metric_definitions")
                .select("metric_key,version,formula")
                .execute()
            )
            rows = result.data or []
            if rows:
                metrics = [
                    MetricDef(
                        metric_id=str(row.get("metric_key", "")),
                        name=str(row.get("metric_key", "")).replace("_", " ").title(),
                        description=str(row.get("formula") or "Café metric definition."),
                        version=int(row.get("version") or 1),
                    )
                    for row in rows
                    if row.get("metric_key")
                ]
                if metrics:
                    return MetricsListResponse(metrics=metrics)
        except Exception:
            pass
        return MetricsListResponse(metrics=list(_DEFAULT_METRICS))

    def get_metric(self, tenant_id: UUID, metric_id: str) -> MetricDef | None:
        listed = self.list_metrics(tenant_id).metrics
        for m in listed:
            if m.metric_id == metric_id:
                return m
        return None
