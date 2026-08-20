"""Tests for import job cancel/retry endpoints."""

from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from tests.conftest import TENANT_FREE, USER_FREE


@pytest.fixture
def authed_admin_client() -> TestClient:
    from app.core.auth import AuthenticatedUser, get_current_user
    from app.core.tenant import TenantContext, get_tenant_context
    from app.main import app

    fake_user = AuthenticatedUser(user_id=USER_FREE, email="admin@akara.test", role="admin")
    fake_tenant = TenantContext(
        tenant_id=TENANT_FREE,
        role="admin",
        user_id=USER_FREE,
        plan="free",
    )
    app.dependency_overrides[get_current_user] = lambda: fake_user
    app.dependency_overrides[get_tenant_context] = lambda: fake_tenant
    client = TestClient(app, headers={"Authorization": "Bearer fake-test-token"})
    yield client
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_tenant_context, None)


@patch("app.api.v1.data.get_supabase_service_client")
def test_cancel_import_job_success(mock_supa, authed_admin_client):
    job_id = str(uuid4())
    supa = MagicMock()
    job_chain = MagicMock()
    job_chain.single.return_value.execute.return_value = MagicMock(
        data={"id": job_id, "status": "queued", "tenant_id": str(TENANT_FREE)}
    )
    supa.table.return_value.select.return_value.eq.return_value.eq.return_value = job_chain
    update_chain = MagicMock()
    supa.table.return_value.update.return_value.eq.return_value = update_chain
    mock_supa.return_value = supa

    res = authed_admin_client.post(f"/data/import/jobs/{job_id}/cancel")
    assert res.status_code == 200
    assert res.json()["status"] == "cancelled"


@patch("app.api.v1.data.get_supabase_service_client")
def test_cancel_import_job_not_found(mock_supa, authed_admin_client):
    job_id = str(uuid4())
    supa = MagicMock()
    job_chain = MagicMock()
    job_chain.single.return_value.execute.side_effect = Exception("not found")
    supa.table.return_value.select.return_value.eq.return_value.eq.return_value = job_chain
    mock_supa.return_value = supa

    res = authed_admin_client.post(f"/data/import/jobs/{job_id}/cancel")
    assert res.status_code == 404


def test_get_tenant_import_job_helper_exists():
    from app.api.v1.data import _get_tenant_import_job

    assert callable(_get_tenant_import_job)
