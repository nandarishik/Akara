"""Billing refund idempotency on main /refund path."""

from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import uuid4

from app.services.billing.ledger import check_idempotency_replay, preview_refund


def test_idempotency_replay_returns_stored_response():
    key = str(uuid4())
    stored = {"ok": True, "refund": {"id": "rfnd_test"}}
    with patch("app.services.billing.ledger.get_supabase_service_client") as mock_supa:
        mock_supa.return_value.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
            data={"response_body": stored}
        )
        replay = check_idempotency_replay(key)
        assert replay == stored


def test_preview_refund_gst_flag():
    result = preview_refund(payment_id="pay_123", amount_paise=10000, partial=False)
    assert result["gst_credit_note_required"] is True
    assert result["payment_id"] == "pay_123"


def test_idempotency_replay_on_second_call():
    """Second check_idempotency_replay with stored body returns same payload."""
    key = str(uuid4())
    stored = {"ok": True, "refund": {"id": "rfnd_test"}}
    with patch("app.services.billing.ledger.get_supabase_service_client") as mock_supa:
        mock_supa.return_value.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
            data={"response_body": stored}
        )
        assert check_idempotency_replay(key) == stored
        assert check_idempotency_replay(key) == stored
