"""Tests for WeeklyDebriefEngine computations."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import MagicMock
from uuid import UUID

import pytest

from app.core.time_utils import last_completed_week_ist
from app.domain.debrief.engine import WeeklyDebriefEngine
from app.domain.debrief.synthesizer import _fallback_metadata
from app.domain.debrief.validator import validate_metadata

TENANT = UUID("22222222-0000-0000-0000-000000000002")


def _week_bounds():
    return last_completed_week_ist(date(2026, 7, 21))  # Monday


def test_last_completed_week_monday_boundary():
    week_start, week_end = last_completed_week_ist(date(2026, 7, 21))
    assert week_start.weekday() == 0
    assert week_end.weekday() == 6
    assert (week_end - week_start).days == 6


def test_engine_skips_under_seven_days():
    supa = MagicMock()

    def table_side(name: str):
        m = MagicMock()
        if name == "sales_data":
            count_exec = MagicMock()
            count_exec.data = [{"invoice_date": f"2026-07-0{i}"} for i in range(1, 6)]
            m.select.return_value.eq.return_value.execute.return_value = count_exec
            latest_exec = MagicMock()
            latest_exec.data = [{"invoice_date": "2026-07-05"}]
            m.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = latest_exec
        return m

    supa.table.side_effect = table_side

    engine = WeeklyDebriefEngine(supa)
    data = engine.compute(TENANT, reference=date(2026, 7, 21))
    assert data.days_of_data == 5
    assert data.week_metrics.revenue == 0


def test_fallback_metadata_limited_mode():
    from app.domain.debrief.models import DebriefData, WeekMetrics

    week_start, week_end = _week_bounds()
    data = DebriefData(
        week_start=week_start,
        week_end=week_end,
        days_of_data=10,
        limited_mode=True,
        week_metrics=WeekMetrics(revenue=100_000, prior_revenue=80_000),
    )
    meta = _fallback_metadata(data)
    assert meta["limited_mode"] is True
    assert len(meta["went_right"]) <= 2
    assert validate_metadata(meta, data)


def test_fallback_metadata_full_mode():
    from app.domain.debrief.models import DebriefData, WeekMetrics, ZoneChange

    week_start, week_end = _week_bounds()
    data = DebriefData(
        week_start=week_start,
        week_end=week_end,
        days_of_data=20,
        limited_mode=False,
        week_metrics=WeekMetrics(revenue=210_000, prior_revenue=180_000),
        zone_changes=[
            ZoneChange(zone="North", this_week=100_000, prior_week=80_000, change_inr=20_000, change_pct=25.0),
        ],
    )
    meta = _fallback_metadata(data)
    assert len(meta["actions"]) == 3
    assert "headline" in meta


def test_idempotency_key_format():
    week_start, week_end = _week_bounds()
    key = f"{week_start.isoformat()}_{week_end.isoformat()}"
    assert len(key.split("_")) == 2
