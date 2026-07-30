"""Superadmin plan limits catalog endpoint."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from app.core.plan_limits import PLAN_LIMITS
from tests.superadmin_helpers import clear_auth_override, make_superadmin_client


@patch("app.core.superadmin.get_supabase_service_client")
def test_plan_limits_catalog(mock_core):
    profile_mock = MagicMock()
    profile_mock.execute.return_value = MagicMock(data={"role": "superadmin"})
    mock_core.return_value.table.return_value.select.return_value.eq.return_value.maybe_single.return_value = (
        profile_mock
    )

    client = make_superadmin_client()
    try:
        res = client.get("/superadmin/plan-limits")
        assert res.status_code == 200
        body = res.json()
        assert body["plans"]["free"]["copilot_calls_per_month"] == PLAN_LIMITS["free"]["copilot_calls_per_month"]
        assert body["plans"]["pro"]["copilot_calls_per_month"] == PLAN_LIMITS["pro"]["copilot_calls_per_month"]
        assert body["plans"]["business"]["copilot_calls_per_month"] == PLAN_LIMITS["business"]["copilot_calls_per_month"]
    finally:
        clear_auth_override()
