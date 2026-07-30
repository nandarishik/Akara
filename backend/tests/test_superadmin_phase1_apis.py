"""Phase 1 superadmin API endpoints — recent payments, stats, at-risk, cron logs."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from tests.superadmin_helpers import clear_auth_override, make_superadmin_client


def _profile_supa():
    supa = MagicMock()
    profile_mock = MagicMock()
    profile_mock.execute.return_value = MagicMock(data={"role": "superadmin"})
    supa.table.return_value.select.return_value.eq.return_value.maybe_single.return_value = (
        profile_mock
    )
    return supa


@patch("app.api.routes.superadmin.billing.get_supabase_service_client")
@patch("app.core.superadmin.get_supabase_service_client")
def test_recent_payments(mock_core, mock_billing):
    mock_core.return_value = _profile_supa()
    supa = MagicMock()
    invoice_chain = MagicMock()
    invoice_chain.limit.return_value.execute.return_value = MagicMock(
        data=[
            {
                "id": "inv-1",
                "tenant_id": "t1",
                "invoice_number": "INV-001",
                "total_amount": 4999,
                "status": "paid",
                "created_at": "2026-01-01T00:00:00+00:00",
            }
        ]
    )
    tenant_chain = MagicMock()
    tenant_chain.maybe_single.return_value.execute.return_value = MagicMock(data={"name": "Acme"})
    supa.table.side_effect = lambda name: (
        MagicMock(
            select=MagicMock(
                return_value=MagicMock(
                    order=MagicMock(return_value=invoice_chain),
                    eq=MagicMock(return_value=tenant_chain),
                )
            )
        )
        if name == "invoices"
        else MagicMock()
    )
    mock_billing.return_value = supa

    client = make_superadmin_client()
    try:
        res = client.get("/superadmin/billing/recent-payments?limit=10")
        assert res.status_code == 200
        body = res.json()
        assert body["total"] >= 1
        assert body["items"][0]["invoice_number"] == "INV-001"
    finally:
        clear_auth_override()


@patch("app.api.routes.superadmin.overview.get_supabase_service_client")
@patch("app.core.superadmin.get_supabase_service_client")
def test_overview_stats(mock_core, mock_overview):
    mock_core.return_value = _profile_supa()
    supa = MagicMock()

    def count_chain():
        chain = MagicMock()
        chain.execute.return_value = MagicMock(count=3)
        return chain

    def table_side(name: str):
        m = MagicMock()
        if name in ("llm_cost_log", "tenants", "audit_log"):
            m.select.return_value.eq.return_value.gte.return_value = count_chain()
            m.select.return_value.gte.return_value = count_chain()
            m.select.return_value.gte.return_value.or_.return_value = count_chain()
        return m

    supa.table.side_effect = table_side
    mock_overview.return_value = supa

    client = make_superadmin_client()
    try:
        res = client.get("/superadmin/overview/stats")
        assert res.status_code == 200
        body = res.json()
        assert "questions_today" in body
        assert "new_this_week" in body
    finally:
        clear_auth_override()


@patch("app.api.routes.superadmin.usage.get_supabase_service_client")
@patch("app.core.superadmin.get_supabase_service_client")
def test_at_risk_tenants(mock_core, mock_usage):
    mock_core.return_value = _profile_supa()
    supa = MagicMock()
    tenants_chain = MagicMock()
    tenants_chain.execute.return_value = MagicMock(
        data=[
            {
                "id": "t1",
                "name": "Acme",
                "plan": "free",
                "plan_status": "past_due",
                "is_active": True,
            }
        ]
    )
    empty_chain = MagicMock()
    empty_chain.limit.return_value.execute.return_value = MagicMock(data=[])
    profiles_chain = MagicMock()
    profiles_chain.execute.return_value = MagicMock(data=[])

    def table_side(name: str):
        m = MagicMock()
        if name == "tenants":
            m.select.return_value.eq.return_value = tenants_chain
        elif name == "import_jobs":
            m.select.return_value.eq.return_value.eq.return_value.order.return_value = empty_chain
        elif name == "profiles":
            m.select.return_value.eq.return_value = profiles_chain
        return m

    supa.table.side_effect = table_side
    mock_usage.return_value = supa

    client = make_superadmin_client()
    try:
        res = client.get("/superadmin/usage/at-risk")
        assert res.status_code == 200
        body = res.json()
        assert "past_due" in body
        assert len(body["past_due"]) == 1
    finally:
        clear_auth_override()


@patch("app.api.routes.superadmin.system.get_supabase_service_client")
@patch("app.core.superadmin.get_supabase_service_client")
def test_cron_logs(mock_core, mock_system):
    mock_core.return_value = _profile_supa()
    supa = MagicMock()
    logs_chain = MagicMock()
    logs_chain.limit.return_value.execute.return_value = MagicMock(
        data=[{"task_name": "founder_brief", "status": "ok", "details": {"text": "hi"}}]
    )
    supa.table.return_value.select.return_value.eq.return_value.order.return_value = logs_chain
    mock_system.return_value = supa

    client = make_superadmin_client()
    try:
        res = client.get("/superadmin/system/cron-logs/founder_brief?limit=5")
        assert res.status_code == 200
        assert res.json()["total"] == 1
    finally:
        clear_auth_override()
