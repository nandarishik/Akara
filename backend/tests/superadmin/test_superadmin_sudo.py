"""Superadmin sudo session tests."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from tests.conftest import USER_SUPERADMIN


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


def _profile_supa(role: str):
    supa = MagicMock()
    profile_mock = MagicMock()
    profile_mock.execute.return_value = MagicMock(data={"role": role})
    supa.table.return_value.select.return_value.eq.return_value.maybe_single.return_value = (
        profile_mock
    )
    return supa


@patch("app.core.superadmin.get_supabase_service_client")
@patch("app.api.superadmin.sudo.verify_superadmin_password", return_value=True)
@patch("app.api.superadmin.sudo.create_sudo_session")
def test_sudo_start_sets_cookies(mock_create, _mock_pw, mock_supa, authed_superadmin_client):
    mock_supa.return_value = _profile_supa("superadmin")
    session_id = uuid4()
    expires = datetime.now(UTC) + timedelta(minutes=15)
    mock_create.return_value = (session_id, expires, "csrf-test-token")

    response = authed_superadmin_client.post(
        "/superadmin/sudo",
        json={"password": "correct-password"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["csrf_token"] == "csrf-test-token"
    assert "akara_sudo" in response.cookies
    assert "akara_csrf" in response.cookies


@patch("app.core.superadmin.get_supabase_service_client")
def test_write_without_sudo_returns_403(mock_supa, authed_superadmin_client):
    mock_supa.return_value = _profile_supa("superadmin")
    response = authed_superadmin_client.patch(
        "/superadmin/system/settings",
        json={"maintenance_mode": True, "reason": "Testing sudo requirement gate"},
        headers={"X-CSRF-Token": "anything"},
    )
    assert response.status_code == 403
