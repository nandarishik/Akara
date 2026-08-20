"""Overview activity feed endpoint."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from tests.superadmin.superadmin_helpers import clear_auth_override, make_superadmin_client


@patch("app.api.routes.superadmin.overview.get_supabase_service_client")
@patch("app.core.superadmin.get_supabase_service_client")
def test_overview_activity_returns_items(mock_core, mock_overview):
    profile_mock = MagicMock()
    profile_mock.execute.return_value = MagicMock(data={"role": "superadmin"})
    mock_core.return_value.table.return_value.select.return_value.eq.return_value.maybe_single.return_value = (
        profile_mock
    )

    audit_rows = [
        {
            "id": "1",
            "action": "copilot.question_asked",
            "created_at": "2026-01-01T00:00:00+00:00",
            "tenant_id": "t1",
            "actor_email": "u@akara.test",
            "details": {},
        }
    ]
    audit_chain = MagicMock()
    audit_chain.limit.return_value.execute.return_value = MagicMock(data=audit_rows)
    tenant_chain = MagicMock()
    tenant_chain.maybe_single.return_value.execute.return_value = MagicMock(data={"name": "Acme"})

    supa = MagicMock()

    def table_side_effect(name: str):
        m = MagicMock()
        if name == "audit_log":
            m.select.return_value.order.return_value = audit_chain
        elif name == "tenants":
            m.select.return_value.eq.return_value = tenant_chain
        return m

    supa.table.side_effect = table_side_effect
    mock_overview.return_value = supa

    client = make_superadmin_client()
    try:
        res = client.get("/superadmin/overview/activity?limit=20")
        assert res.status_code == 200
        body = res.json()
        assert len(body["items"]) <= 20
        assert body["items"][0]["action"] == "copilot.question_asked"
    finally:
        clear_auth_override()
