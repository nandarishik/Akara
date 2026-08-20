"""Tenant cost diagnostics endpoint."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from tests.conftest import TENANT_FREE
from tests.superadmin.superadmin_helpers import clear_auth_override, make_superadmin_client


@patch("app.api.superadmin.billing.get_supabase_service_client")
@patch("app.core.superadmin.get_supabase_service_client")
def test_costs_tenants_shape(mock_core, mock_billing):
    profile_mock = MagicMock()
    profile_mock.execute.return_value = MagicMock(data={"role": "superadmin"})
    mock_core.return_value.table.return_value.select.return_value.eq.return_value.maybe_single.return_value = (
        profile_mock
    )

    supa = MagicMock()

    def table_side_effect(name: str):
        m = MagicMock()
        if name == "tenants":
            m.select.return_value.execute.return_value = MagicMock(
                data=[{"id": str(TENANT_FREE), "name": "Acme", "plan": "free", "plan_status": "active", "feature_overrides": {}}]
            )
        elif name == "usage_tracking":
            m.select.return_value.gte.return_value.execute.return_value = MagicMock(
                data=[{"tenant_id": str(TENANT_FREE), "copilot_calls": 5, "rows_imported": 100}]
            )
        elif name == "llm_cost_log":
            m.select.return_value.gte.return_value.execute.return_value = MagicMock(data=[])
        return m

    supa.table.side_effect = table_side_effect
    mock_billing.return_value = supa

    client = make_superadmin_client()
    try:
        res = client.get("/superadmin/costs/tenants")
        assert res.status_code == 200
        rows = res.json()
        assert isinstance(rows, list)
        assert rows[0]["tenant_id"] == str(TENANT_FREE)
        assert "copilot_calls_used" in rows[0]
    finally:
        clear_auth_override()
