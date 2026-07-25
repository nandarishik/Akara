"""Tests for Razorpay subscription sync and plan resolution."""

from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import uuid4

from app.services.billing.checkout import resolve_plan_from_subscription, sync_subscription_from_razorpay
from app.services.billing.webhook_handler import dispatch_razorpay_event, handle_subscription_activated


def test_resolve_plan_from_notes():
    sub = {"notes": {"plan": "business", "tenant_id": "x"}, "plan_id": "plan_other"}
    assert resolve_plan_from_subscription(sub) == "business"


@patch("app.services.billing.checkout.settings")
def test_resolve_plan_from_plan_id(mock_settings):
    mock_settings.razorpay_business_monthly_plan_id = "plan_THccEuVM4dLyuV"
    mock_settings.razorpay_pro_monthly_plan_id = ""
    mock_settings.razorpay_pro_annual_plan_id = ""
    mock_settings.razorpay_business_annual_plan_id = ""
    sub = {"notes": {}, "plan_id": "plan_THccEuVM4dLyuV"}
    assert resolve_plan_from_subscription(sub) == "business"


@patch("app.services.billing.webhook_handler._already_processed", return_value=False)
@patch("app.services.billing.webhook_handler._mark_processed")
@patch("app.services.billing.webhook_handler.handle_subscription_activated", return_value=False)
def test_webhook_not_marked_when_handler_fails(mock_handle, mock_mark, _mock_dup):
    body = {
        "event": "subscription.activated",
        "payload": {"subscription": {"entity": {"id": "sub_test"}}},
    }
    dispatch_razorpay_event(body, "evt_fail")
    mock_handle.assert_called_once()
    mock_mark.assert_not_called()


@patch("app.services.billing.webhook_handler._supa")
def test_tenant_lookup_by_subscription_id(mock_supa):
    tenant_row = {"id": str(uuid4()), "plan": "free", "billing_details": {}}
    table = MagicMock()
    select = MagicMock()
    select.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(data=tenant_row)
    table.select.return_value = select
    table.update.return_value.eq.return_value.execute.return_value = MagicMock()
    mock_supa.return_value.table.return_value = table

    sub = {
        "id": "sub_THcgnjdy0IpY5D",
        "customer_id": "cust_unknown",
        "notes": {},
        "plan_id": "plan_business",
    }
    with patch(
        "app.services.billing.webhook_handler._tenant_by_id",
        return_value=None,
    ), patch(
        "app.services.billing.webhook_handler._tenant_by_customer",
        return_value=None,
    ), patch(
        "app.services.billing.webhook_handler._tenant_by_subscription_id",
        return_value=tenant_row,
    ), patch(
        "app.services.billing.webhook_handler.resolve_plan_from_subscription",
        return_value="business",
    ):
        assert handle_subscription_activated(sub) is True


@patch("app.services.billing.checkout.fetch_subscription_status")
@patch("app.services.billing.checkout.get_supabase_service_client")
@patch("app.services.billing.checkout._client")
def test_sync_upgrades_free_tenant(mock_client, mock_supa, mock_fetch):
    tenant_id = uuid4()
    mock_fetch.return_value = {
        "has_subscription": True,
        "plan": "free",
        "plan_status": "active",
        "razorpay_status": "active",
        "razorpay_plan": "business",
        "current_end": 123,
        "cancel_at_cycle_end": False,
        "trial_ends_at": None,
        "synced": False,
    }

    supa = MagicMock()
    tenant_select = MagicMock()
    tenant_select.single.return_value.execute.return_value = MagicMock(
        data={"razorpay_subscription_id": "sub_test", "plan": "free", "plan_status": "active"}
    )
    update_mock = MagicMock()
    update_mock.eq.return_value.execute.return_value = MagicMock()
    tenants_table = MagicMock()
    tenants_table.select.return_value.eq.return_value = tenant_select
    tenants_table.update.return_value = update_mock
    supa.table.return_value = tenants_table
    mock_supa.return_value = supa

    mock_client.return_value.subscription.fetch.return_value = {
        "id": "sub_test",
        "customer_id": "cust_test",
        "status": "active",
        "notes": {"plan": "business"},
    }

    result = sync_subscription_from_razorpay(tenant_id)
    assert result["synced"] is True
    assert result["plan"] == "business"
    tenants_table.update.assert_called_once()
