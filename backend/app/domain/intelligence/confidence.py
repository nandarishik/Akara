"""Deterministic confidence — AD-P11-002. Never LLM-guessed."""

from __future__ import annotations


def compute_confidence(
    data_days: int,
    coefficient_of_variation: float,
    data_freshness_days: int,
) -> float:
    """
    data_days: how many days of daily data available
    coefficient_of_variation: stddev/mean of the metric (lower = more consistent)
    data_freshness_days: days since most recent import (0 = today, 7 = week-old data)
    """
    volume_score = min(1.0, (data_days - 14) / (90 - 14)) if data_days >= 14 else 0.0
    consistency_score = max(0.0, 1.0 - coefficient_of_variation)
    freshness_penalty = min(0.5, data_freshness_days * 0.10)
    raw_confidence = (volume_score * 0.5 + consistency_score * 0.5) - freshness_penalty
    return round(max(0.0, min(1.0, raw_confidence)), 2)


def uncertainty_label(data_days: int) -> str:
    if data_days < 30:
        return f"⚠ Based on limited data ({data_days} days). Treat with caution."
    if data_days < 90:
        return f"Based on {data_days} days of data. Results should strengthen as more data accumulates."
    return f"Based on {data_days} days of data. Statistically reliable estimate."
