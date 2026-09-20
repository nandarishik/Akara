"""Café metrics v2 wire models (snake_case). Frozen Shared Integration Contract."""

from __future__ import annotations

from pydantic import BaseModel, Field


class MetricEvidencePayload(BaseModel):
    order_count: int = 0
    data_range: str | None = None
    last_import_at: str | None = None
    last_updated_minutes_ago: int | None = None
    metric_versions: dict[str, int] = Field(default_factory=dict)
    partial: bool = False
    partial_message: str | None = None


class VsCompare(BaseModel):
    value: float | None = None
    change_pct: float | None = None


class MetricValue(BaseModel):
    value: float | None = None
    currency: str | None = None
    unit: str | None = None
    alert: bool = False
    alert_message: str | None = None
    threshold: float | None = None
    data_quality: str | None = None
    setup_cta: str | None = None
    vs_yesterday: VsCompare | None = None
    vs_same_day_last_week: VsCompare | None = None


class PeriodWindow(BaseModel):
    from_: str = Field(alias="from")
    to: str
    timezone: str = "Asia/Kolkata"

    model_config = {"populate_by_name": True, "ser_json_by_alias": True}


class CafeSummaryMetrics(BaseModel):
    revenue: MetricValue
    food_cost_pct: MetricValue
    orders: MetricValue
    aov: MetricValue


class CafeSummaryResponse(BaseModel):
    period: PeriodWindow
    evidence: MetricEvidencePayload
    metrics: CafeSummaryMetrics


class TrendPoint(BaseModel):
    date: str
    revenue: float | None = None
    orders: float | None = None
    prior_week_revenue: float | None = None
    labour_cost_pct: float | None = None


class CafeTrendsResponse(BaseModel):
    period: PeriodWindow
    evidence: MetricEvidencePayload
    trend_7d: list[TrendPoint] = Field(default_factory=list)
    trend_30d: list[TrendPoint] = Field(default_factory=list)


class ChannelSlice(BaseModel):
    channel: str
    revenue: float | None = None
    orders: float | None = None
    pct: float | None = None


class CafeChannelResponse(BaseModel):
    evidence: MetricEvidencePayload
    channels: list[ChannelSlice] = Field(default_factory=list)


class DaypartCell(BaseModel):
    daypart: str
    day_of_week: int
    orders: float | None = None
    revenue: float | None = None


class CafeDaypartResponse(BaseModel):
    evidence: MetricEvidencePayload
    cells: list[DaypartCell] = Field(default_factory=list)


class ItemRow(BaseModel):
    item_name: str
    revenue: float | None = None
    orders: float | None = None
    contribution_margin: float | None = None
    rank: str  # top | bottom


class CafeItemsResponse(BaseModel):
    evidence: MetricEvidencePayload
    items: list[ItemRow] = Field(default_factory=list)


class FoodCostAlertResponse(BaseModel):
    food_cost_pct: float | None = None
    threshold: float | None = None
    alert: bool = False
    alert_message: str | None = None
    setup_cta: str | None = None
    evidence: MetricEvidencePayload


class DashboardFlags(BaseModel):
    cafe_metrics_v2: bool
    new_dashboard: bool


class MetricDef(BaseModel):
    metric_id: str
    name: str
    description: str
    unit: str | None = None
    version: int | None = 1


class MetricsListResponse(BaseModel):
    metrics: list[MetricDef] = Field(default_factory=list)
