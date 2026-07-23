"""Tests for GET /billing/usage endpoint.

Covers:
  - 401 for unauthenticated requests
  - 200 with correct plan/limits for each fixture tenant
  - feature flags reflect plan (no overrides)
  - retention_days correct per plan
  - daily counters present
  - plan_status returned correctly
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.core.plan_limits import PLAN_LIMITS
from tests.conftest import TENANT_BUSINESS, TENANT_FREE, TENANT_PRO

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_mock_usage(
    copilot_calls: int = 0,
    uploads_today: int = 0,
    uploads_count: int = 0,
    undos_today: int = 0,
) -> dict:
    return {
        "copilot_calls": copilot_calls,
        "rows_imported": 0,
        "uploads_count": uploads_count,
        "debrief_count": 0,
        "uploads_today": uploads_today,
        "undos_today": undos_today,
    }


def mock_supa_for_usage(copilot_calls: int = 0, rows: int = 0, users: int = 1):
    """Return a patched Supabase service client mock for billing endpoint tests."""
    supa = MagicMock()

    # RPC call — get_current_usage
    supa.rpc.return_value.execute.return_value.data = make_mock_usage(
        copilot_calls=copilot_calls
    )

    # Table query — sales_data count
    sales_mock = MagicMock()
    sales_mock.execute.return_value.count = rows
    supa.table.return_value.select.return_value.eq.return_value = sales_mock

    # Table query — profiles count (users)
    profiles_mock = MagicMock()
    profiles_mock.execute.return_value.count = users

    # Make second .eq() call return profiles mock
    def side_effect_table(table_name):
        m = MagicMock()
        if table_name == "sales_data":
            m.select.return_value.eq.return_value = sales_mock
        elif table_name == "profiles":
            m.select.return_value.eq.return_value = profiles_mock
        return m

    supa.table.side_effect = side_effect_table
    return supa


# ---------------------------------------------------------------------------
# 401 — unauthenticated
# ---------------------------------------------------------------------------


def test_billing_usage_401_unauthenticated(client: TestClient):
    """No Authorization header → 401 Unauthorized."""
    response = client.get("/billing/usage")
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# 200 — free plan
# ---------------------------------------------------------------------------


@patch("app.api.routes.billing.get_supabase_service_client")
@patch("app.core.tenant.get_supabase_service_client")
def test_billing_usage_free_plan(mock_tenant_supa, mock_billing_supa, authed_client_free):
    """Free plan: copilot_calls_limit=10, rows_limit=10000, uploads_limit=5."""
    supa = mock_supa_for_usage(copilot_calls=3, rows=500, users=1)
    mock_billing_supa.return_value = supa
    mock_tenant_supa.return_value = _make_tenant_supa("free")

    response = authed_client_free.get("/billing/usage")
    assert response.status_code == 200, response.text

    data = response.json()
    limits = PLAN_LIMITS["free"]

    assert data["plan"] == "free"
    assert data["plan_status"] == "active"
    assert data["copilot_calls_used"] == 3
    assert data["copilot_calls_limit"] == limits["copilot_calls_per_month"]
    assert data["rows_limit"] == limits["rows_total"]
    assert data["uploads_limit"] == limits["uploads_per_month"]
    assert data["uploads_per_day"] == 3
    assert data["undos_per_day"] == 2
    assert data["retention_days"] == limits["retention_days"]
    assert data["features"]["scheme_leakage"] is False
    assert data["features"]["simulator"] is False


@patch("app.api.routes.billing.get_supabase_service_client")
@patch("app.core.tenant.get_supabase_service_client")
def test_billing_usage_pro_plan(mock_tenant_supa, mock_billing_supa, authed_client_pro):
    """Pro plan: copilot_calls_limit=400, uploads_limit=-1."""
    supa = mock_supa_for_usage(copilot_calls=50, rows=10_000, users=2)
    mock_billing_supa.return_value = supa
    mock_tenant_supa.return_value = _make_tenant_supa("pro")

    response = authed_client_pro.get("/billing/usage")
    assert response.status_code == 200, response.text

    data = response.json()
    limits = PLAN_LIMITS["pro"]

    assert data["plan"] == "pro"
    assert data["copilot_calls_limit"] == limits["copilot_calls_per_month"]
    assert data["uploads_limit"] == -1  # unlimited
    assert data["features"]["simulator"] is True
    assert data["features"]["scheme_leakage"] is False  # Business only


@patch("app.api.routes.billing.get_supabase_service_client")
@patch("app.core.tenant.get_supabase_service_client")
def test_billing_usage_business_plan(mock_tenant_supa, mock_billing_supa, authed_client_business):
    """Business plan: all features enabled."""
    supa = mock_supa_for_usage(copilot_calls=200, rows=100_000, users=5)
    mock_billing_supa.return_value = supa
    mock_tenant_supa.return_value = _make_tenant_supa("business")

    response = authed_client_business.get("/billing/usage")
    assert response.status_code == 200, response.text

    data = response.json()
    limits = PLAN_LIMITS["business"]

    assert data["plan"] == "business"
    assert data["copilot_calls_limit"] == limits["copilot_calls_per_month"]
    assert data["rows_limit"] == limits["rows_total"]
    assert data["retention_days"] == 1095
    assert data["features"]["scheme_leakage"] is True
    assert data["features"]["tally_connector"] is True
    assert data["features"]["api_keys"] is True


# ---------------------------------------------------------------------------
# Response shape validation
# ---------------------------------------------------------------------------


@patch("app.api.routes.billing.get_supabase_service_client")
@patch("app.core.tenant.get_supabase_service_client")
def test_billing_usage_has_all_required_fields(mock_tenant_supa, mock_billing_supa, authed_client_free):
    supa = mock_supa_for_usage()
    mock_billing_supa.return_value = supa
    mock_tenant_supa.return_value = _make_tenant_supa("free")

    response = authed_client_free.get("/billing/usage")
    assert response.status_code == 200

    data = response.json()
    required_fields = {
        "plan", "plan_status",
        "copilot_calls_used", "copilot_calls_limit",
        "rows_used", "rows_limit",
        "uploads_used", "uploads_limit",
        "uploads_today", "uploads_per_day",
        "undos_today", "undos_per_day",
        "users_used", "users_limit",
        "features", "retention_days",
    }
    missing = required_fields - data.keys()
    assert not missing, f"Response missing fields: {missing}"


# ---------------------------------------------------------------------------
# Helper — mock Supabase tenant lookup
# ---------------------------------------------------------------------------


def _make_tenant_supa(plan: str):
    """Mock for get_tenant_context's Supabase calls."""

    tenant_id_map = {"free": str(TENANT_FREE), "pro": str(TENANT_PRO), "business": str(TENANT_BUSINESS)}
    supa = MagicMock()

    # profiles lookup
    profile_mock = MagicMock()
    profile_mock.execute.return_value.data = {
        "tenant_id": tenant_id_map[plan],
        "role": "admin",
    }
    supa.table.return_value.select.return_value.eq.return_value.single.return_value = profile_mock

    # tenants lookup
    tenant_mock = MagicMock()
    tenant_mock.execute.return_value.data = {
        "config": {"industry": "fmcg_distribution", "currency": "INR", "language": "en"},
        "plan": plan,
        "plan_status": "active",
        "feature_overrides": {},
    }

    def table_side_effect(table_name):
        m = MagicMock()
        if table_name == "profiles":
            m.select.return_value.eq.return_value.single.return_value = profile_mock
        elif table_name == "tenants":
            m.select.return_value.eq.return_value.single.return_value = tenant_mock
        return m

    supa.table.side_effect = table_side_effect
    return supa
