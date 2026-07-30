"""Revenue snapshot task and API tests."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

from tests.superadmin_helpers import clear_auth_override, make_superadmin_client


@patch("app.services.superadmin.revenue.get_supabase_service_client")
def test_compute_mom_deltas(mock_supa):
    from app.services.superadmin.revenue import compute_mom_deltas

    prior_date = (datetime.now(UTC) - timedelta(days=30)).date().isoformat()
    chain = MagicMock()
    chain.execute.return_value = MagicMock(
        data=[
            {
                "snapshot_date": prior_date,
                "mrr_inr": 10000,
                "tenant_count": 5,
                "llm_cost_usd": 10,
            }
        ]
    )
    mock_supa.return_value.table.return_value.select.return_value.gte.return_value.lte.return_value.order.return_value = (
        chain
    )

    summary = {
        "mrr_inr": 12000,
        "estimated_gross_margin_pct": 90.0,
        "total_active_tenants": 7,
    }
    deltas = compute_mom_deltas(summary)
    assert deltas["mrr_mom_pct"] == 20.0
    assert deltas["active_tenants_delta"] == 2
    assert deltas["margin_delta_pp"] is not None


@patch("app.tasks.revenue_snapshot.get_supabase_service_client")
@patch("app.tasks.revenue_snapshot.compute_revenue_summary")
def test_revenue_snapshot_upserts(mock_summary, mock_supa):
    mock_summary.return_value = {
        "mrr_inr": 1000,
        "arr_inr": 12000,
        "total_active_tenants": 2,
        "total_llm_cost_usd_this_month": 1.5,
    }
    supa = MagicMock()
    mock_supa.return_value = supa

    from app.tasks.revenue_snapshot import run_revenue_snapshot

    result = run_revenue_snapshot()
    assert result["ok"] is True
    supa.table.return_value.upsert.assert_called_once()


@patch("app.api.routes.superadmin.billing.get_supabase_service_client")
@patch("app.core.superadmin.get_supabase_service_client")
def test_revenue_snapshots_endpoint(mock_core, mock_billing):
    profile_mock = MagicMock()
    profile_mock.execute.return_value = MagicMock(data={"role": "superadmin"})
    mock_core.return_value.table.return_value.select.return_value.eq.return_value.maybe_single.return_value = (
        profile_mock
    )

    rows = [
        {"snapshot_date": "2026-01-01", "mrr_inr": 100, "arr_inr": 1200, "tenant_count": 1, "llm_cost_usd": 0.1},
        {"snapshot_date": "2026-02-01", "mrr_inr": 200, "arr_inr": 2400, "tenant_count": 2, "llm_cost_usd": 0.2},
    ]
    chain = MagicMock()
    chain.execute.return_value = MagicMock(data=rows)
    mock_billing.return_value.table.return_value.select.return_value.gte.return_value.order.return_value = chain

    client = make_superadmin_client()
    try:
        res = client.get("/superadmin/revenue/snapshots?months=6")
        assert res.status_code == 200
        data = res.json()
        assert len(data["items"]) == 2
    finally:
        clear_auth_override()
