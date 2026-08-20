"""Public and superadmin system settings tests."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from tests.conftest import USER_SUPERADMIN


@pytest.fixture
def client() -> TestClient:
    from app.main import app

    return TestClient(app)


@pytest.fixture
def authed_superadmin_client() -> TestClient:
    from app.core.auth import AuthenticatedUser, get_current_user
    from app.main import app

    fake_user = AuthenticatedUser(
        user_id=USER_SUPERADMIN,
        email="superadmin@akara.test",
        role="superadmin",
    )
    app.dependency_overrides[get_current_user] = lambda: fake_user
    client = TestClient(app, headers={"Authorization": "Bearer fake-test-token"})
    yield client
    app.dependency_overrides.pop(get_current_user, None)


@patch("app.api.v1.system.get_supabase_service_client")
def test_public_system_settings(mock_supa, client: TestClient):
    supa = MagicMock()

    def table_side_effect(name: str):
        m = MagicMock()
        if name == "global_settings":
            m.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
                data=None
            )
        return m

    supa.table.side_effect = table_side_effect
    mock_supa.return_value = supa

    response = client.get("/system/settings")
    assert response.status_code == 200
    body = response.json()
    assert body["maintenance_mode"] is False
    assert body["signup_open"] is True


@patch("app.core.superadmin.get_supabase_service_client")
@patch("app.api.superadmin.system.get_supabase_service_client")
@patch("app.api.v1.system.get_supabase_service_client")
def test_superadmin_patch_system_settings(
    mock_public, mock_admin_system, mock_core, authed_superadmin_client
):
    session_id = uuid4()
    expires = (datetime.now(UTC) + timedelta(minutes=10)).isoformat()
    upsert_mock = MagicMock()
    upsert_mock.execute.return_value = MagicMock(data=[{}])

    def table_side_effect(name: str):
        m = MagicMock()
        if name == "profiles":
            m.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
                data={"role": "superadmin"}
            )
        elif name == "sudo_sessions":
            m.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
                data={"id": str(session_id), "user_id": str(USER_SUPERADMIN), "expires_at": expires}
            )
        elif name == "global_settings":
            m.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
                data={"value": False}
            )
            m.upsert = MagicMock(return_value=upsert_mock)
        elif name == "audit_log":
            m.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
                data=None
            )
            m.insert.return_value.execute.return_value = MagicMock(data=[{"id": "a1"}])
        return m

    supa = MagicMock()
    supa.table.side_effect = table_side_effect
    mock_public.return_value = supa
    mock_admin_system.return_value = supa
    mock_core.return_value = supa

    client = authed_superadmin_client
    client.cookies.set("akara_sudo", str(session_id))
    client.cookies.set("akara_csrf", "csrf-ok")

    response = client.patch(
        "/superadmin/system/settings",
        json={"signup_open": False, "reason": "Closing signups for maintenance window test"},
        headers={"X-CSRF-Token": "csrf-ok"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["settings"]["signup_open"] is False
