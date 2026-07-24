"""Tests for async account deletion queue."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from tests.conftest import USER_PRO
from tests.test_billing_endpoint import _make_tenant_supa


@pytest.fixture
def authed_client() -> TestClient:
    from app.core.auth import AuthenticatedUser, get_current_user
    from app.main import app

    fake_user = AuthenticatedUser(user_id=USER_PRO, email="admin@akara.test", role="admin")
    app.dependency_overrides[get_current_user] = lambda: fake_user
    client = TestClient(app, headers={"Authorization": "Bearer fake-test-token"})
    yield client
    app.dependency_overrides.pop(get_current_user, None)


@patch("app.api.routes.account.get_supabase_service_client")
@patch("app.core.tenant.get_supabase_service_client")
def test_delete_account_queues(mock_ctx, mock_account, authed_client):
    mock_ctx.return_value = _make_tenant_supa("pro")
    supa = MagicMock()

    profile_mock = MagicMock()
    profile_mock.execute.return_value.data = {"tenant_id": "t-1", "role": "admin"}
    queue_table = MagicMock()
    queue_check = MagicMock()
    queue_check.execute.return_value.data = None
    queue_table.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value = queue_check

    def table_side(name: str):
        m = MagicMock()
        if name == "profiles":
            m.select.return_value.eq.return_value.single.return_value = profile_mock
        elif name == "account_deletion_queue":
            return queue_table
        return m

    supa.table.side_effect = table_side
    supa.auth.admin.sign_out = MagicMock()
    mock_account.return_value = supa

    resp = authed_client.request(
        "DELETE",
        "/account",
        json={"confirm_email": "admin@akara.test"},
    )
    assert resp.status_code == 202
    assert resp.json()["status"] == "queued"
    queue_table.insert.assert_called_once()
