"""Superadmin mutation contract tests."""

from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from tests.conftest import TENANT_FREE, USER_SUPERADMIN


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


@patch("app.core.superadmin.get_supabase_service_client")
def test_short_reason_rejected(mock_supa, authed_superadmin_client):
    from app.services.superadmin.mutations import SuperadminMutation
    import pydantic

    with pytest.raises(pydantic.ValidationError):
        SuperadminMutation(reason="short")

    profile_mock = MagicMock()
    profile_mock.execute.return_value = MagicMock(data={"role": "superadmin"})
    mock_supa.return_value.table.return_value.select.return_value.eq.return_value.maybe_single.return_value = (
        profile_mock
    )

    response = authed_superadmin_client.patch(
        f"/superadmin/tenants/{TENANT_FREE}/quota",
        json={"reason": "short", "copilot_bonus": 5},
        headers={"X-CSRF-Token": "x"},
    )
    assert response.status_code in (403, 422)


@patch("app.api.routes.superadmin.tenants.get_supabase_service_client")
@patch("app.core.superadmin.get_supabase_service_client")
def test_tenant_delete_wrong_confirm_rejected(mock_core, mock_tenants, authed_superadmin_client):
    tenant_row = {"id": str(TENANT_FREE), "name": "Acme Corp", "version": 1}
    tenants_table = MagicMock()
    tenants_table.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = (
        MagicMock(data=tenant_row)
    )
    mock_tenants.return_value.table.return_value = tenants_table

    profile_mock = MagicMock()
    profile_mock.execute.return_value = MagicMock(data={"role": "superadmin"})
    mock_core.return_value.table.return_value.select.return_value.eq.return_value.maybe_single.return_value = (
        profile_mock
    )

    response = authed_superadmin_client.request(
        "DELETE",
        f"/superadmin/tenants/{TENANT_FREE}",
        json={"reason": "Attempting delete with wrong confirm string", "confirm": "WRONG"},
    )
    assert response.status_code in (400, 403)


@patch("app.services.superadmin.audit.get_supabase_service_client")
def test_operation_id_idempotent_replay(mock_audit):
    op_id = uuid4()
    audit_table = MagicMock()
    existing_responses = [MagicMock(data=None), MagicMock(data={"id": "existing-audit", "action": "test.action", "created_at": "2026-01-01"})]
    audit_table.select.return_value.eq.return_value.maybe_single.return_value.execute.side_effect = existing_responses
    audit_table.insert.return_value.execute.return_value = MagicMock(data=[{"id": "new"}])
    mock_audit.return_value.table.side_effect = lambda n: audit_table if n == "audit_log" else MagicMock()

    from app.services.superadmin.audit import record_operation

    first = record_operation(
        action="test.action",
        actor_id=USER_SUPERADMIN,
        actor_email="superadmin@akara.test",
        reason="Idempotent operation replay test case",
        operation_id=op_id,
    )
    second = record_operation(
        action="test.action",
        actor_id=USER_SUPERADMIN,
        actor_email="superadmin@akara.test",
        reason="Idempotent operation replay test case",
        operation_id=op_id,
    )
    assert first["idempotent_replay"] is False
    assert second["idempotent_replay"] is True
