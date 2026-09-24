"""Café alert metric names + legacy FMCG skip."""

from __future__ import annotations

CAFE_ALERT_METRICS = frozenset({
    "revenue_below_threshold",
    "food_cost_above_threshold",
    "orders_below_expected",
    "item_not_selling",
    "anomaly",
})

LEGACY_FMCG_METRICS = frozenset({
    "secondary_sales_total",
    "primary_sales_total",
    "outstanding_amount",
    "beat_adherence_pct",
})

SKIP_LEGACY = "legacy_fmcg_metric"


def skip_reason_for_metric(metric: str) -> str | None:
    if metric in LEGACY_FMCG_METRICS:
        return SKIP_LEGACY
    if metric not in CAFE_ALERT_METRICS:
        return "unknown_metric"
    return None
