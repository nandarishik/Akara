"""Café KPI v2 service shell — no Settings / app import."""

from __future__ import annotations

from unittest.mock import MagicMock
from uuid import uuid4

from app.domain.kpi.cafe_service import CafeKPIService


def test_cafe_service_summary_null_values() -> None:
    svc = CafeKPIService(supabase=MagicMock())
    out = svc.summary(uuid4(), "2026-09-01", "2026-09-07")
    assert out.metrics.revenue.value is None
    assert out.evidence.partial is True
    assert out.metrics.food_cost_pct.setup_cta == "expense_tracking"
    dumped = out.model_dump(by_alias=True)
    assert "from" in dumped["period"]


def test_cafe_service_daypart_grid() -> None:
    svc = CafeKPIService(supabase=MagicMock())
    out = svc.daypart(uuid4(), "2026-09-01", "2026-09-07")
    assert len(out.cells) == 35  # 5 dayparts × 7 days


def test_cafe_service_food_cost_setup_cta() -> None:
    svc = CafeKPIService(supabase=MagicMock())
    out = svc.food_cost_alert(uuid4(), "2026-09-01", "2026-09-07")
    assert out.setup_cta == "expense_tracking"
    assert out.food_cost_pct is None
