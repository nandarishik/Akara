"""14-day pre/post outcome + EMA playbook weight calibration."""

from __future__ import annotations

from typing import Any

STATISTICAL_NOTE = (
    "Based on 14-day post-action vs 14-day pre-action revenue for affected items. "
    "No control group; confounders (seasonality, weather) not adjusted for. "
    "Minimum 90 days of data required for statistically reliable causal estimates."
)


def measure_outcome(pre_revenue: float, post_revenue: float, expected_impact_inr: float) -> dict[str, Any]:
    actual = post_revenue - pre_revenue
    delta_pct = 0.0
    if expected_impact_inr:
        delta_pct = ((actual - expected_impact_inr) / abs(expected_impact_inr)) * 100
    return {
        "actual_impact_inr": round(actual, 2),
        "expected_impact_inr": round(expected_impact_inr, 2),
        "delta_pct": round(delta_pct, 1),
        "measurement_window_days": 14,
        "measurement_method": "revenue_comparison",
        "statistical_note": STATISTICAL_NOTE,
    }


def calibrate_weight(
    current: float,
    predicted: float,
    actual: float,
    *,
    alpha: float = 0.3,
    min_w: float = 0.5,
    max_w: float = 2.0,
) -> float | None:
    if predicted <= 0:
        return None
    accuracy = actual / predicted
    nxt = (1 - alpha) * current + alpha * accuracy
    return round(max(min_w, min(max_w, nxt)), 4)
