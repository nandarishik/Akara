"""Tests for account routes."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from tests.conftest import TENANT_PRO, USER_PRO
from tests.api.test_billing_endpoint import _make_tenant_supa


@pytest.fixture
def authed_client() -> TestClient:
    from app.core.auth import AuthenticatedUser, get_current_user
    from app.main import app

    fake_user = AuthenticatedUser(user_id=USER_PRO, email="admin@akara.test", role="admin")
    app.dependency_overrides[get_current_user] = lambda: fake_user
    client = TestClient(app, headers={"Authorization": "Bearer fake-test-token"})
    yield client
    app.dependency_overrides.pop(get_current_user, None)


@patch("app.api.v1.account.get_supabase_service_client")
@patch("app.core.tenant.get_supabase_service_client")
def test_get_channels_whatsapp_gated(mock_ctx, mock_account, authed_client):
    mock_ctx.return_value = _make_tenant_supa("pro")
    mock_account.return_value = MagicMock()
    resp = authed_client.get("/account/channels")
    assert resp.status_code == 200
    body = resp.json()
    assert body["whatsapp_enabled"] is False
    assert body["whatsapp_reason"] == "templates_not_ready"


@patch("app.api.v1.account.get_supabase_service_client")
@patch("app.core.tenant.get_supabase_service_client")
def test_update_preferences(mock_ctx, mock_account, authed_client):
    mock_ctx.return_value = _make_tenant_supa("pro")
    supa = MagicMock()
    profile_mock = MagicMock()
    profile_mock.execute.return_value.data = {"preferences": {"morning_brief_enabled": True}}
    supa.table.return_value.select.return_value.eq.return_value.single.return_value = profile_mock
    update_mock = MagicMock()
    supa.table.return_value.update.return_value.eq.return_value = update_mock
    mock_account.return_value = supa

    resp = authed_client.patch(
        "/account/preferences",
        json={"email_debrief_enabled": False},
    )
    assert resp.status_code == 200
    assert resp.json()["preferences"]["email_debrief_enabled"] is False


@patch("app.api.v1.account.get_supabase_service_client")
@patch("app.core.tenant.get_supabase_service_client")
def test_export_account(mock_ctx, mock_account, authed_client):
    mock_ctx.return_value = _make_tenant_supa("pro")
    supa = MagicMock()

    def table_side(name: str):
        m = MagicMock()
        if name == "profiles":
            m.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(
                data={"id": str(USER_PRO), "email": "admin@akara.test"}
            )
        else:
            m.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
            m.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
        return m

    supa.table.side_effect = table_side
    mock_account.return_value = supa

    resp = authed_client.get("/account/export")
    assert resp.status_code == 200
    assert "application/json" in resp.headers["content-type"]
