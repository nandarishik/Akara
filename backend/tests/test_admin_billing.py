"""Tests for superadmin billing ops endpoints."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from tests.conftest import TENANT_FREE, TENANT_PRO, USER_PRO
from tests.test_billing_endpoint import _make_tenant_supa


@pytest.fixture
def authed_admin_client() -> TestClient:
    from app.core.auth import AuthenticatedUser, get_current_user
    from app.main import app

    fake_user = AuthenticatedUser(user_id=USER_PRO, email="admin@akara.test", role="admin")
    app.dependency_overrides[get_current_user] = lambda: fake_user
    client = TestClient(app, headers={"Authorization": "Bearer fake-test-token"})
    yield client
    app.dependency_overrides.pop(get_current_user, None)


def _admin_tenant_supa():
    return _make_tenant_supa("pro")


def _target_tenant_supa(plan: str = "free", plan_status: str = "active"):
    supa = MagicMock()
    tenant_row = {
        "id": str(TENANT_FREE),
        "plan": plan,
        "plan_status": plan_status,
        "past_due_since": None,
        "trial_ends_at": None,
        "razorpay_subscription_id": None,
        "razorpay_customer_id": None,
    }

    update_mock = MagicMock()
    update_mock.eq.return_value.execute.return_value = MagicMock(data=[tenant_row])

    select_mock = MagicMock()
    select_mock.maybe_single.return_value.execute.return_value = MagicMock(data=tenant_row)

    tenants_table = MagicMock()
    tenants_table.select.return_value.eq.return_value = select_mock
    tenants_table.update.return_value = update_mock

    def table_side_effect(name: str):
        m = MagicMock()
        if name == "profiles":
            profile_mock = MagicMock()
            profile_mock.execute.return_value.data = {
                "tenant_id": str(TENANT_PRO),
                "role": "admin",
            }
            m.select.return_value.eq.return_value.single.return_value = profile_mock
        elif name == "tenants":
            return tenants_table
        elif name == "audit_log":
            m.insert.return_value.execute.return_value = MagicMock(data=[{}])
        return m

    supa.table.side_effect = table_side_effect
    return supa, tenants_table


@patch("app.api.routes.admin.billing.get_supabase_service_client")
@patch("app.core.tenant.get_supabase_service_client")
def test_manual_upgrade(mock_ctx_supa, mock_admin_supa, authed_admin_client):
    mock_ctx_supa.return_value = _admin_tenant_supa()
    target_supa, tenants_table = _target_tenant_supa()
    mock_admin_supa.return_value = target_supa

    response = authed_admin_client.post(
        f"/admin/billing/manual-upgrade/{TENANT_FREE}",
        json={"plan": "pro", "reason": "NEFT payment received", "clear_past_due": True},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["plan"] == "pro"
    assert body["plan_status"] == "active"
    tenants_table.update.assert_called()
    assert tenants_table.update.call_args[0][0]["plan"] == "pro"


@patch("app.api.routes.admin.billing.get_supabase_service_client")
@patch("app.core.tenant.get_supabase_service_client")
def test_extend_trial(mock_ctx_supa, mock_admin_supa, authed_admin_client):
    mock_ctx_supa.return_value = _admin_tenant_supa()
    target_supa, tenants_table = _target_tenant_supa(plan_status="trialing")
    mock_admin_supa.return_value = target_supa

    response = authed_admin_client.post(
        f"/admin/billing/extend-trial/{TENANT_FREE}",
        json={"days": 14, "reason": "Sales demo extension"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["plan_status"] == "trialing"
    assert body["trial_ends_at"]
    tenants_table.update.assert_called()


@patch("app.api.routes.admin.billing.fetch_subscription_status")
@patch("app.api.routes.admin.billing.get_supabase_service_client")
@patch("app.core.tenant.get_supabase_service_client")
def test_reconcile_reports_mismatch(
    mock_ctx_supa, mock_admin_supa, mock_fetch_sub, authed_admin_client
):
    mock_ctx_supa.return_value = _admin_tenant_supa()
    supa = MagicMock()
    tenant_row = {
        "id": str(TENANT_FREE),
        "plan": "pro",
        "plan_status": "past_due",
        "past_due_since": None,
        "trial_ends_at": None,
        "razorpay_subscription_id": "sub_test",
        "razorpay_customer_id": "cust_test",
    }
    profile_mock = MagicMock()
    profile_mock.execute.return_value.data = {
        "tenant_id": str(TENANT_PRO),
        "role": "admin",
    }
    tenant_select = MagicMock()
    tenant_select.maybe_single.return_value.execute.return_value = MagicMock(data=tenant_row)
    tenants_table = MagicMock()
    tenants_table.select.return_value.eq.return_value = tenant_select

    def table_side_effect(name: str):
        m = MagicMock()
        if name == "profiles":
            m.select.return_value.eq.return_value.single.return_value = profile_mock
        elif name == "tenants":
            return tenants_table
        elif name == "audit_log":
            m.insert.return_value.execute.return_value = MagicMock(data=[{}])
        return m

    supa.table.side_effect = table_side_effect
    mock_admin_supa.return_value = supa

    mock_fetch_sub.return_value = {
        "has_subscription": True,
        "plan": "pro",
        "plan_status": "active",
        "razorpay_status": "active",
        "current_end": int((datetime.now(UTC) + timedelta(days=30)).timestamp()),
        "cancel_at_cycle_end": False,
        "trial_ends_at": None,
    }

    response = authed_admin_client.post(
        f"/admin/billing/reconcile/{TENANT_FREE}",
        json={"apply": False},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert any("past_due" in m for m in body["mismatches"])
    assert body["applied"] is False
