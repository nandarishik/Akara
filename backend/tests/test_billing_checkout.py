"""Tests for billing checkout endpoint."""

from __future__ import annotations

from unittest.mock import patch

from tests.test_billing_endpoint import _make_tenant_supa


@patch("app.api.routes.billing.store_response")
@patch("app.api.routes.billing.get_cached_response", return_value=None)
@patch("app.api.routes.billing.create_checkout_session")
@patch("app.core.tenant.get_supabase_service_client")
def test_create_checkout_session(
    mock_tenant_supa,
    mock_checkout,
    mock_cached,
    mock_store,
    authed_client_free,
):
    mock_tenant_supa.return_value = _make_tenant_supa("free")
    mock_checkout.return_value = {
        "checkout_url": "https://rzp.io/i/test",
        "subscription_id": "sub_test",
        "razorpay_key_id": "rzp_test_key",
    }

    response = authed_client_free.post(
        "/billing/create-checkout-session",
        json={"plan": "pro", "interval": "month"},
        headers={"Idempotency-Key": "550e8400-e29b-41d4-a716-446655440000"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["checkout_url"].startswith("https://")


@patch("app.core.tenant.get_supabase_service_client")
def test_create_checkout_requires_idempotency_key(mock_tenant_supa, authed_client_free):
    mock_tenant_supa.return_value = _make_tenant_supa("free")
    response = authed_client_free.post(
        "/billing/create-checkout-session",
        json={"plan": "pro", "interval": "month"},
    )
    assert response.status_code in (400, 422)
