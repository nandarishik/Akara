"""StatsForecast AutoARIMA 7-day demand (AD-P10-002)."""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any

import pandas as pd

logger = logging.getLogger(__name__)

MIN_DATA_DAYS = 14
HORIZON = 7
SKIP_REASON = "insufficient_data"


def consecutive_days(series_dates: list[date]) -> int:
    if not series_dates:
        return 0
    ordered = sorted(set(series_dates))
    streak = 1
    best = 1
    for prev, cur in zip(ordered, ordered[1:], strict=False):
        if (cur - prev).days == 1:
            streak += 1
            best = max(best, streak)
        else:
            streak = 1
    return best if len(ordered) == 1 else best


def unique_id(item_id: str, location_id: str | None) -> str:
    return f"{item_id}::{location_id or 'none'}"


def forecast_skip_reason(days: int) -> str | None:
    if days < MIN_DATA_DAYS:
        return SKIP_REASON
    return None


def run_autoarima(
    history: list[tuple[date, float]],
    *,
    n_jobs: int = 1,
    horizon: int = HORIZON,
) -> list[dict[str, Any]]:
    """Fit AutoARIMA on synthetic or real daily revenue. Requires statsforecast."""
    if forecast_skip_reason(consecutive_days([d for d, _ in history])):
        return []
    from statsforecast import StatsForecast
    from statsforecast.models import AutoARIMA

    start = min(d for d, _ in history)
    by_day = dict(history)
    rows = []
    cursor = start
    last = max(d for d, _ in history)
    while cursor <= last:
        rows.append({"unique_id": "series", "ds": pd.Timestamp(cursor), "y": float(by_day.get(cursor, 0.0))})
        cursor += timedelta(days=1)
    df = pd.DataFrame(rows)
    sf = StatsForecast(models=[AutoARIMA(season_length=7)], freq="D", n_jobs=n_jobs)
    fcst = sf.forecast(df=df, h=horizon)
    out: list[dict[str, Any]] = []
    for i, rec in enumerate(fcst.to_dict("records")):
        pred = float(rec.get("AutoARIMA") or rec.get("autoarima") or 0)
        lo = float(rec.get("AutoARIMA-lo-90") or pred * 0.85)
        hi = float(rec.get("AutoARIMA-hi-90") or pred * 1.15)
        out.append(
            {
                "forecast_date": (last + timedelta(days=i + 1)).isoformat(),
                "predicted_revenue": pred,
                "confidence_interval_low": lo,
                "confidence_interval_high": hi,
                "model_used": "AutoARIMA",
            }
        )
    return out
