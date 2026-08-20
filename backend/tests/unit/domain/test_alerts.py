"""Tests for tenant alert API."""

from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from tests.conftest import TENANT_PRO, USER_PRO
from tests.api.test_billing_endpoint import _make_tenant_supa


@pytest.fixture
def authed_pro_client() -> TestClient:
    from app.core.auth import AuthenticatedUser, get_current_user
    from app.main import app

    fake_user = AuthenticatedUser(user_id=USER_PRO, email="pro@akara.test", role="admin")
    app.dependency_overrides[get_current_user] = lambda: fake_user
    client = TestClient(app, headers={"Authorization": "Bearer fake-test-token"})
    yield client
    app.dependency_overrides.pop(get_current_user, None)


def _alerts_supa(existing_count: int = 0):
    supa = MagicMock()
    tenant_row = {
        "config": {"industry": "fmcg_distribution"},
        "plan": "pro",
        "plan_status": "active",
        "feature_overrides": {},
    }
    profile_mock = MagicMock()
    profile_mock.execute.return_value.data = {
        "tenant_id": str(TENANT_PRO),
        "role": "admin",
    }
    tenant_mock = MagicMock()
    tenant_mock.execute.return_value.data = tenant_row

    alerts_list = MagicMock()
    alerts_list.execute.return_value = MagicMock(data=[], count=existing_count)

    insert_mock = MagicMock()
    insert_mock.execute.return_value = MagicMock(data=[{
        "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "name": "Low secondary sales",
        "metric": "secondary_sales_total",
        "condition": "below",
        "threshold": 50000,
        "dimension": None,
        "delivery": ["email"],
        "cooldown_hours": 24,
        "is_active": True,
        "last_triggered": None,
    }])

    def table_side_effect(name: str):
        m = MagicMock()
        if name == "profiles":
            m.select.return_value.eq.return_value.single.return_value = profile_mock
        elif name == "tenants":
            m.select.return_value.eq.return_value.single.return_value = tenant_mock
        elif name == "tenant_alerts":
            m.select.return_value.eq.return_value.order.return_value = alerts_list
            m.select.return_value.eq.return_value = alerts_list
            m.insert.return_value = insert_mock
        return m

    supa.table.side_effect = table_side_effect
    return supa


@patch("app.api.routes.alerts.get_supabase_service_client")
@patch("app.core.tenant.get_supabase_service_client")
def test_create_alert_pro(mock_ctx, mock_alerts, authed_pro_client):
    mock_ctx.return_value = _make_tenant_supa("pro")
    mock_alerts.return_value = _alerts_supa(0)

    res = authed_pro_client.post(
        "/alerts",
        json={
            "name": "Low secondary sales",
            "metric": "secondary_sales_total",
            "condition": "below",
            "threshold": 50000,
        },
    )
    assert res.status_code == 201, res.text
    assert res.json()["metric"] == "secondary_sales_total"


def test_check_condition():
    from decimal import Decimal

    from app.services.alerts.metrics import check_condition

    assert check_condition(Decimal("40"), "below", Decimal("50"))
    assert check_condition(Decimal("60"), "above", Decimal("50"))
    assert check_condition(Decimal("50"), "equals", Decimal("50"))
