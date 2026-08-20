"""Tests for team invite API."""

from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from tests.conftest import TENANT_PRO, USER_PRO
from tests.api.test_billing_endpoint import _make_tenant_supa


@pytest.fixture
def authed_pro_admin() -> TestClient:
    from app.core.auth import AuthenticatedUser, get_current_user
    from app.main import app

    fake_user = AuthenticatedUser(user_id=USER_PRO, email="admin@akara.test", role="admin")
    app.dependency_overrides[get_current_user] = lambda: fake_user
    client = TestClient(app, headers={"Authorization": "Bearer fake-test-token"})
    yield client
    app.dependency_overrides.pop(get_current_user, None)


def _team_supa():
    supa = MagicMock()
    tenant_row = {"config": {}, "plan": "pro", "plan_status": "active", "feature_overrides": {}}
    profile_mock = MagicMock()
    profile_mock.execute.return_value.data = {"tenant_id": str(TENANT_PRO), "role": "admin"}
    tenant_mock = MagicMock()
    tenant_mock.execute.return_value.data = tenant_row

    rpc_mock = MagicMock()
    rpc_mock.execute.return_value = MagicMock(
        data=[{
            "invite_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "occupied": 2,
            "seat_limit": 3,
            "remaining": 1,
            "existing": False,
        }]
    )

    invite_row = {
        "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "email_normalized": "new@akara.test",
        "role": "user",
        "status": "pending",
        "invite_token": "abc123token",
        "expires_at": "2026-08-01T00:00:00Z",
        "created_at": "2026-07-24T00:00:00Z",
    }
    invite_mock = MagicMock()
    invite_mock.execute.return_value.data = invite_row

    def table_side_effect(name: str):
        m = MagicMock()
        if name == "profiles":
            m.select.return_value.eq.return_value.single.return_value = profile_mock
            m.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
        elif name == "tenants":
            m.select.return_value.eq.return_value.single.return_value = tenant_mock
        elif name == "team_invites":
            m.select.return_value.eq.return_value.single.return_value = invite_mock
            m.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(data=[])
        return m

    supa.table.side_effect = table_side_effect
    supa.rpc.return_value = rpc_mock
    return supa


@patch("app.api.routes.team.get_supabase_service_client")
@patch("app.core.tenant.get_supabase_service_client")
@patch("app.api.routes.team._send_invite_email")
def test_create_invite_pro(mock_email, mock_ctx, mock_team, authed_pro_admin):
    mock_ctx.return_value = _make_tenant_supa("pro")
    mock_team.return_value = _team_supa()

    resp = authed_pro_admin.post(
        "/team/invite",
        json={"email": "new@akara.test", "role": "user"},
    )
    assert resp.status_code == 200
    assert resp.json()["email_normalized"] == "new@akara.test"
    mock_email.assert_called_once()


@patch("app.api.routes.team.get_supabase_service_client")
@patch("app.core.tenant.get_supabase_service_client")
def test_list_members(mock_ctx, mock_team, authed_pro_admin):
    mock_ctx.return_value = _make_tenant_supa("pro")
    supa = _team_supa()
    mock_team.return_value = supa
    resp = authed_pro_admin.get("/team/members")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@patch("app.api.routes.team.get_supabase_service_client")
@patch("app.core.tenant.get_supabase_service_client")
def test_seat_limit_402(mock_ctx, mock_team, authed_pro_admin):
    mock_ctx.return_value = _make_tenant_supa("pro")
    supa = MagicMock()
    profile_mock = MagicMock()
    profile_mock.execute.return_value.data = {"tenant_id": str(TENANT_PRO), "role": "admin"}
    tenant_mock = MagicMock()
    tenant_mock.execute.return_value.data = {"config": {}, "plan": "pro", "plan_status": "active", "feature_overrides": {}}

    rpc_mock = MagicMock()
    rpc_mock.execute.side_effect = Exception("seat_limit_reached")

    def table_side(name: str):
        m = MagicMock()
        if name == "profiles":
            m.select.return_value.eq.return_value.single.return_value = profile_mock
        elif name == "tenants":
            m.select.return_value.eq.return_value.single.return_value = tenant_mock
        return m

    supa.table.side_effect = table_side
    supa.rpc.return_value = rpc_mock
    mock_team.return_value = supa

    resp = authed_pro_admin.post(
        "/team/invite",
        json={"email": "full@akara.test", "role": "user"},
    )
    assert resp.status_code == 402


@patch("app.api.routes.team.get_supabase_service_client")
@patch("app.core.tenant.get_supabase_service_client")
@patch("app.api.routes.team._send_invite_email")
def test_resend_invite_extends_expiry(mock_email, mock_ctx, mock_team, authed_pro_admin):
    mock_ctx.return_value = _make_tenant_supa("pro")
    supa = _team_supa()
    invite_row = {
        "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "email_normalized": "new@akara.test",
        "invite_token": "abc123token",
        "status": "pending",
    }
    invite_fetch = MagicMock()
    invite_fetch.execute.return_value.data = invite_row
    update_mock = MagicMock()

    def table_side(name: str):
        m = MagicMock()
        if name == "profiles":
            profile_mock = MagicMock()
            profile_mock.execute.return_value.data = {"tenant_id": str(TENANT_PRO), "role": "admin"}
            m.select.return_value.eq.return_value.single.return_value = profile_mock
        elif name == "tenants":
            tenant_mock = MagicMock()
            tenant_mock.execute.return_value.data = {"name": "Test Co"}
            m.select.return_value.eq.return_value.single.return_value = tenant_mock
        elif name == "team_invites":
            m.select.return_value.eq.return_value.eq.return_value.eq.return_value.single.return_value = invite_fetch
            m.update.return_value.eq.return_value = update_mock
        return m

    supa.table.side_effect = table_side
    mock_team.return_value = supa

    resp = authed_pro_admin.post("/team/invites/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/resend")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
    mock_email.assert_called_once()
    update_mock.execute.assert_called_once()
