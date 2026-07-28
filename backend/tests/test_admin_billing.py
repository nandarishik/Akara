"""Tests for superadmin billing ops endpoints."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from tests.conftest import TENANT_FREE, TENANT_PRO, USER_SUPERADMIN
from tests.test_billing_endpoint import _make_tenant_supa


@pytest.fixture
def authed_superadmin_billing_client() -> TestClient:
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


def _superadmin_profile_supa():
    supa = MagicMock()
    profile_mock = MagicMock()
    profile_mock.execute.return_value = MagicMock(data={"role": "superadmin"})
    supa.table.return_value.select.return_value.eq.return_value.maybe_single.return_value = profile_mock
    return supa


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
                "role": "superadmin",
            }
            m.select.return_value.eq.return_value.single.return_value = profile_mock
        elif name == "tenants":
            return tenants_table
        elif name == "audit_log":
            m.insert.return_value.execute.return_value = MagicMock(data=[{}])
        return m

    supa.table.side_effect = table_side_effect
    return supa, tenants_table


@patch("app.api.routes.superadmin.billing.get_supabase_service_client")
@patch("app.core.superadmin.get_supabase_service_client")
def test_manual_upgrade_requires_sudo(mock_core, mock_billing_supa, authed_superadmin_billing_client):
    mock_core.return_value = _superadmin_profile_supa()
    target_supa, _ = _target_tenant_supa()
    mock_billing_supa.return_value = target_supa

    response = authed_superadmin_billing_client.post(
        f"/superadmin/billing/manual-upgrade/{TENANT_FREE}",
        json={"plan": "pro", "reason": "NEFT payment received", "clear_past_due": True},
        headers={"X-CSRF-Token": "token"},
    )
    assert response.status_code == 403


@patch("app.api.routes.superadmin.billing.fetch_subscription_status")
@patch("app.api.routes.superadmin.billing.get_supabase_service_client")
@patch("app.core.superadmin.get_supabase_service_client")
def test_reconcile_reports_mismatch(
    mock_core, mock_billing_supa, mock_fetch_sub, authed_superadmin_billing_client
):
    mock_core.return_value = _superadmin_profile_supa()
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
    tenant_select = MagicMock()
    tenant_select.maybe_single.return_value.execute.return_value = MagicMock(data=tenant_row)
    tenants_table = MagicMock()
    tenants_table.select.return_value.eq.return_value = tenant_select

    def table_side_effect(name: str):
        m = MagicMock()
        if name == "profiles":
            m.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
                "role": "superadmin",
            }
        elif name == "tenants":
            return tenants_table
        elif name == "audit_log":
            m.insert.return_value.execute.return_value = MagicMock(data=[{}])
        return m

    supa.table.side_effect = table_side_effect
    mock_billing_supa.return_value = supa

    mock_fetch_sub.return_value = {
        "has_subscription": True,
        "plan": "pro",
        "plan_status": "active",
        "razorpay_status": "active",
        "current_end": int((datetime.now(UTC) + timedelta(days=30)).timestamp()),
        "cancel_at_cycle_end": False,
        "trial_ends_at": None,
    }

    response = authed_superadmin_billing_client.post(
        f"/superadmin/billing/reconcile/{TENANT_FREE}",
        json={"apply": False, "reason": "Reconcile mismatch detection test run"},
        headers={"X-CSRF-Token": "token"},
    )
    assert response.status_code == 403
