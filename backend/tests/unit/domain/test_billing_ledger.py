"""Day 10 billing ledger and refund preview."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from tests.superadmin.superadmin_helpers import clear_auth_override, make_superadmin_client


@patch("app.core.superadmin.get_supabase_service_client")
def test_refund_preview(mock_core):
    profile_mock = MagicMock()
    profile_mock.execute.return_value = MagicMock(data={"role": "superadmin"})
    mock_core.return_value.table.return_value.select.return_value.eq.return_value.maybe_single.return_value = (
        profile_mock
    )

    client = make_superadmin_client()
    try:
        res = client.post(
            "/superadmin/billing/refunds/preview",
            json={"payment_id": "pay_test123", "amount_paise": 10000, "partial": True},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["payment_id"] == "pay_test123"
        assert body["gst_credit_note_required"] is True
    finally:
        clear_auth_override()


@patch("app.core.superadmin.get_supabase_service_client")
@patch("app.services.billing.ledger.get_supabase_service_client")
def test_billing_ledger_list(mock_ledger_supa, mock_core):
    profile_mock = MagicMock()
    profile_mock.execute.return_value = MagicMock(data={"role": "superadmin"})
    mock_core.return_value.table.return_value.select.return_value.eq.return_value.maybe_single.return_value = (
        profile_mock
    )

    ledger_table = MagicMock()
    ledger_table.select.return_value.order.return_value.range.return_value.execute.return_value = MagicMock(
        data=[{"id": "1", "entry_type": "refund", "amount_minor": 10000, "status": "confirmed"}],
        count=1,
    )
    mock_ledger_supa.return_value.table.return_value = ledger_table

    client = make_superadmin_client()
    try:
        res = client.get("/superadmin/billing/ledger")
        assert res.status_code == 200
        assert res.json()["total"] == 1
    finally:
        clear_auth_override()
