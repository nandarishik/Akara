"""Tests for Razorpay webhook idempotency."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from app.services.billing.webhook_handler import _already_processed, dispatch_razorpay_event


@patch("app.services.billing.webhook_handler._already_processed")
@patch("app.services.billing.webhook_handler._mark_processed")
@patch("app.services.billing.webhook_handler.handle_subscription_activated")
def test_webhook_skips_duplicate(mock_handle, mock_mark, mock_dup):
    mock_dup.return_value = True
    body = {
        "event": "subscription.activated",
        "payload": {"subscription": {"entity": {"id": "sub_test", "notes": {"tenant_id": "x"}}}},
    }
    dispatch_razorpay_event(body, "evt_test")
    mock_handle.assert_not_called()
    mock_mark.assert_not_called()


@patch("app.services.billing.webhook_handler._supa")
def test_already_processed_handles_empty_maybe_single(mock_supa):
    chain = MagicMock()
    chain.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = None
    mock_supa.return_value.table.return_value = chain
    assert _already_processed("evt_new") is False


@patch("app.services.billing.webhook_handler._already_processed", return_value=False)
@patch("app.services.billing.webhook_handler._mark_processed")
@patch("app.services.billing.webhook_handler.handle_subscription_activated")
def test_webhook_processes_new_event(mock_handle, mock_mark, mock_dup):
    sub = {
        "id": "sub_new",
        "customer_id": "cust_1",
        "notes": {"tenant_id": "tenant-uuid", "plan": "pro"},
    }
    body = {"event": "subscription.activated", "payload": {"subscription": {"entity": sub}}}
    dispatch_razorpay_event(body, "evt_new")
    mock_handle.assert_called_once()
    mock_mark.assert_called_once()
