"""Broadcast history persistence tests."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from tests.superadmin.superadmin_helpers import clear_auth_override, make_superadmin_client


@patch("app.api.routes.superadmin.reports.get_supabase_service_client")
@patch("app.core.superadmin.get_supabase_service_client")
def test_list_broadcast_history(mock_core, mock_reports):
    profile_mock = MagicMock()
    profile_mock.execute.return_value = MagicMock(data={"role": "superadmin"})
    mock_core.return_value.table.return_value.select.return_value.eq.return_value.maybe_single.return_value = (
        profile_mock
    )

    history_list = MagicMock()
    history_list.range.return_value.execute.return_value = MagicMock(
        data=[
            {
                "id": "bh-1",
                "subject": "Hello",
                "channels": ["email"],
                "tenant_count": 1,
                "sent_count": 1,
                "plan_filter": None,
                "status_filter": None,
                "created_at": "2026-01-01T00:00:00+00:00",
            }
        ],
        count=1,
    )
    mock_reports.return_value.table.return_value.select.return_value.order.return_value = history_list

    client = make_superadmin_client()
    try:
        res = client.get("/superadmin/reports/broadcast-history")
        assert res.status_code == 200
        body = res.json()
        assert body["items"][0]["subject"] == "Hello"
        mock_reports.return_value.table.assert_called_with("broadcast_history")
    finally:
        clear_auth_override()
