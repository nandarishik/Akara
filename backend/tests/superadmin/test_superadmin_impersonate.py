"""Impersonation and /auth/me tests."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from tests.conftest import TENANT_FREE, USER_FREE


@pytest.fixture
def authed_user_client() -> TestClient:
    from app.core.auth import AuthenticatedUser, get_current_user
    from app.main import app

    fake_user = AuthenticatedUser(user_id=USER_FREE, email="free@akara.test", role="admin")
    app.dependency_overrides[get_current_user] = lambda: fake_user
    client = TestClient(app, headers={"Authorization": "Bearer fake-test-token"})
    yield client
    app.dependency_overrides.pop(get_current_user, None)


@patch("app.api.v1.auth.get_supabase_service_client")
def test_auth_me_includes_impersonation_fields(mock_supa, authed_user_client):
    session_id = str(uuid4())
    expires = (datetime.now(UTC) + timedelta(minutes=10)).isoformat()

    def table_side_effect(name: str):
        m = MagicMock()
        if name == "profiles":
            m.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
                data={"tenant_id": str(TENANT_FREE), "role": "admin"}
            )
        elif name == "impersonation_sessions":
            m.select.return_value.eq.return_value.is_.return_value.gt.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
                data=[{"id": session_id, "tenant_id": str(TENANT_FREE), "expires_at": expires}]
            )
        elif name == "tenants":
            m.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
                data={"name": "Acme Corp"}
            )
        return m

    mock_supa.return_value.table.side_effect = table_side_effect

    response = authed_user_client.get("/auth/me")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["impersonating_tenant_id"] == str(TENANT_FREE)
    assert body["impersonating_tenant_name"] == "Acme Corp"
    assert body["impersonation_session_id"] == session_id
