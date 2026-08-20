"""Superadmin CSRF protection tests."""

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


def _sudo_supa():
    supa = MagicMock()
    session_id = uuid4()
    expires = (datetime.now(UTC) + timedelta(minutes=10)).isoformat()

    def table_side_effect(name: str):
        m = MagicMock()
        if name == "profiles":
            profile_mock = MagicMock()
            profile_mock.execute.return_value = MagicMock(data={"role": "superadmin"})
            m.select.return_value.eq.return_value.maybe_single.return_value = profile_mock
        elif name == "sudo_sessions":
            row_mock = MagicMock()
            row_mock.execute.return_value = MagicMock(
                data={"id": str(session_id), "user_id": str(USER_SUPERADMIN), "expires_at": expires}
            )
            m.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value = row_mock
        elif name == "global_settings":
            m.upsert.return_value.execute.return_value = MagicMock(data=[{}])
        elif name == "audit_log":
            m.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
                data=None
            )
            m.insert.return_value.execute.return_value = MagicMock(data=[{"id": "audit-1"}])
        return m

    supa.table.side_effect = table_side_effect
    return supa, session_id


@patch("app.core.superadmin.get_supabase_service_client")
@patch("app.api.routes.superadmin.system.get_supabase_service_client")
@patch("app.api.routes.system.get_supabase_service_client")
def test_mutation_without_csrf_header_rejected(
    mock_public, mock_system, mock_core, authed_superadmin_client
):
    supa, session_id = _sudo_supa()
    mock_core.return_value = supa
    mock_system.return_value = supa
    mock_public.return_value = supa

    client = authed_superadmin_client
    client.cookies.set("akara_sudo", str(session_id))
    client.cookies.set("akara_csrf", "valid-csrf")

    response = client.patch(
        "/superadmin/system/settings",
        json={"maintenance_mode": True, "reason": "Testing CSRF rejection path"},
    )
    assert response.status_code == 403


@patch("app.core.superadmin.get_supabase_service_client")
@patch("app.api.routes.superadmin.system.get_supabase_service_client")
@patch("app.api.routes.system.get_supabase_service_client")
def test_mutation_with_mismatched_csrf_rejected(
    mock_public, mock_system, mock_core, authed_superadmin_client
):
    supa, session_id = _sudo_supa()
    mock_core.return_value = supa
    mock_system.return_value = supa
    mock_public.return_value = supa

    client = authed_superadmin_client
    client.cookies.set("akara_sudo", str(session_id))
    client.cookies.set("akara_csrf", "cookie-token")

    response = client.patch(
        "/superadmin/system/settings",
        json={"maintenance_mode": False, "reason": "Testing CSRF mismatch rejection"},
        headers={"X-CSRF-Token": "wrong-token"},
    )
    assert response.status_code == 403
