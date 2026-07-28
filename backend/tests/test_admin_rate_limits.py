"""Rate limit wiring on admin billing endpoints."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from tests.conftest import TENANT_PRO, USER_PRO
from tests.test_billing_endpoint import _make_tenant_supa


@pytest.fixture
def authed_admin_client() -> TestClient:
    from app.core.auth import AuthenticatedUser, get_current_user
    from app.main import app

    fake_user = AuthenticatedUser(user_id=USER_PRO, email="admin@akara.test", role="admin")
    app.dependency_overrides[get_current_user] = lambda: fake_user
    client = TestClient(app, headers={"Authorization": "Bearer fake-test-token"})
    yield client
    app.dependency_overrides.pop(get_current_user, None)


@patch("app.api.routes.admin.billing.get_supabase_service_client")
@patch("app.core.tenant.get_supabase_service_client")
def test_admin_billing_read_rate_limit(mock_ctx_supa, mock_admin_supa, authed_admin_client):
    mock_ctx_supa.return_value = _make_tenant_supa("pro")
    supa = MagicMock()
    events_mock = MagicMock()
    events_mock.execute.return_value = MagicMock(data=[])
    supa.table.return_value.select.return_value.gte.return_value.order.return_value.limit.return_value = (
        events_mock
    )
    mock_admin_supa.return_value = supa

    last_status = 200
    for _ in range(31):
        response = authed_admin_client.get("/admin/billing/webhooks/status")
        last_status = response.status_code

    assert last_status == 429
    body = response.json()
    assert body.get("code") == "RATE_LIMITED"
