"""Rate limit smoke tests for newly limited customer routes."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from tests.conftest import TENANT_FREE, USER_FREE
from tests.test_billing_endpoint import _make_tenant_supa, make_mock_usage


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


@patch("app.api.routes.auth.get_supabase_service_client")
def test_auth_consent_status_rate_limit_429(mock_supa, authed_admin_client):
    supa = MagicMock()
    consent_chain = MagicMock()
    consent_chain.limit.return_value.execute.return_value = MagicMock(
        data=[{"version_tos": "2025-01-01", "version_privacy": "2025-01-01", "ai_processing": True}]
    )
    supa.table.return_value.select.return_value.eq.return_value.order.return_value = consent_chain
    mock_supa.return_value = supa

    last = 200
    for _ in range(31):
        last = authed_admin_client.get("/auth/consent-status").status_code
    assert last == 429


@patch("app.api.routes.billing._get_current_usage", return_value=make_mock_usage())
@patch("app.api.routes.billing.get_supabase_service_client")
@patch("app.core.tenant.get_supabase_service_client")
def test_billing_subscription_rate_limit(mock_ctx, mock_billing, mock_usage, authed_admin_client):
    mock_ctx.return_value = _make_tenant_supa("free")

    with patch("app.api.routes.billing.fetch_subscription_status", return_value={"has_subscription": False, "plan": "free", "plan_status": "active"}):
        last = 200
        for _ in range(31):
            last = authed_admin_client.get("/billing/subscription").status_code
        assert last == 429
