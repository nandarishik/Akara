"""Rate limit wiring on superadmin billing endpoints."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from tests.superadmin.superadmin_helpers import clear_auth_override, make_superadmin_client, profile_only_supabase


@pytest.fixture
def superadmin_client() -> TestClient:
    client = make_superadmin_client()
    yield client
    clear_auth_override()


@patch("app.api.superadmin.billing.get_supabase_service_client")
@patch("app.core.superadmin.get_supabase_service_client")
def test_admin_billing_read_rate_limit(mock_sa_supa, mock_billing_supa, superadmin_client):
    mock_sa_supa.return_value = profile_only_supabase("superadmin")

    billing_supa = MagicMock()
    events_mock = MagicMock()
    events_mock.execute.return_value = MagicMock(data=[])
    billing_supa.table.return_value.select.return_value.gte.return_value.order.return_value.limit.return_value = (
        events_mock
    )
    mock_billing_supa.return_value = billing_supa

    last_status = 200
    for _ in range(31):
        response = superadmin_client.get("/superadmin/billing/webhooks/status")
        last_status = response.status_code

    assert last_status == 429
    body = response.json()
    assert body.get("code") == "RATE_LIMITED"
