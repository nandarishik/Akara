"""Superadmin auth guard and sudo session tests."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from tests.conftest import USER_FREE, USER_SUPERADMIN


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


@pytest.fixture
def authed_non_superadmin_client() -> TestClient:
    from app.core.auth import AuthenticatedUser, get_current_user
    from app.main import app

    fake_user = AuthenticatedUser(user_id=USER_FREE, email="free@akara.test", role="admin")
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
def test_superadmin_routes_return_404_for_non_superadmin(
    mock_supa, authed_non_superadmin_client
):
    mock_supa.return_value = _profile_supa("admin")
    response = authed_non_superadmin_client.get("/superadmin/sudo")
    assert response.status_code == 404


@patch("app.core.superadmin.get_supabase_service_client")
def test_superadmin_responses_include_noindex(mock_supa, authed_superadmin_client):
    mock_supa.return_value = _profile_supa("superadmin")
    response = authed_superadmin_client.get("/superadmin/sudo")
    assert response.status_code == 200
    assert response.headers.get("X-Robots-Tag") == "noindex, nofollow"


@patch("app.core.superadmin.get_supabase_service_client")
def test_superadmin_sudo_status_for_superadmin(mock_supa, authed_superadmin_client):
    mock_supa.return_value = _profile_supa("superadmin")
    response = authed_superadmin_client.get("/superadmin/sudo")
    assert response.status_code == 200
    assert response.json()["active"] is False
