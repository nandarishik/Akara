"""POST /data/sync — JSON push used by agents."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

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


async def _quota_ok(_tenant) -> None:
    return None


@patch("app.api.v1.data.require_import_quota")
@patch("app.api.v1.data.get_supabase_service_client")
def test_sync_returns_201_and_inserts_rows(mock_supa, mock_quota, authed_admin_client):
    mock_quota.return_value = _quota_ok
    supabase = MagicMock()
    supabase.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[])
    supabase.rpc.return_value.execute.return_value = MagicMock(data=None)
    mock_supa.return_value = supabase

    res = authed_admin_client.post(
        "/data/sync",
        json={
            "source_type": "primary",
            "rows": [
                {
                    "invoice_date": "2026-01-15",
                    "invoice_number": "INV-1",
                    "party_name": "Sharma Traders",
                    "total_amount": 1500,
                }
            ],
        },
    )

    assert res.status_code == 201, res.text
    body = res.json()
    assert body["rows_inserted"] == 1
    assert body["rows_skipped"] == 0
    assert body["import_id"]

    table_names = [c.args[0] for c in supabase.table.call_args_list]
    assert "sales_data" in table_names


@patch("app.api.v1.data.require_import_quota")
@patch("app.api.v1.data.get_supabase_service_client")
def test_sync_empty_rows_skips_write(mock_supa, mock_quota, authed_admin_client):
    mock_quota.return_value = _quota_ok
    res = authed_admin_client.post("/data/sync", json={"source_type": "primary", "rows": []})
    assert res.status_code == 201
    assert res.json()["rows_inserted"] == 0
    mock_supa.assert_not_called()
