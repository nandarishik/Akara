from unittest.mock import MagicMock, patch
from uuid import uuid4

from app.domain.billing.webhook_handler import handle_payment_succeeded


def _tenant() -> dict:
    return {"id": str(uuid4()), "plan": "pro"}


def _supa_with_invoice(data):
    supa = MagicMock()

    def table(name: str):
        chain = MagicMock()
        if name == "tenants":
            chain.update.return_value.eq.return_value.execute.return_value = MagicMock()
        elif name == "invoices":
            result = MagicMock()
            result.data = data
            chain.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = result
            chain.update.return_value.eq.return_value.execute.return_value = MagicMock()
        return chain

    supa.table.side_effect = table
    return supa


@patch("app.domain.billing.webhook_handler.send_payment_success_email")
@patch("app.domain.billing.webhook_handler.generate_and_store_invoice")
@patch("app.domain.billing.webhook_handler._admin_email", return_value=None)
@patch("app.domain.billing.webhook_handler._tenant_from_subscription")
@patch("app.domain.billing.webhook_handler._supa")
def test_invoice_generated_on_first_payment(
    mock_supa,
    mock_tenant,
    _mock_email,
    mock_generate,
    _mock_send,
):
    tenant = _tenant()
    mock_tenant.return_value = tenant
    mock_supa.return_value = _supa_with_invoice(None)
    mock_generate.return_value = {
        "id": "inv-1",
        "invoice_number": "INV-1",
        "pdf_bytes": b"%PDF",
    }

    ok = handle_payment_succeeded(
        {"id": "pay_1", "amount": 799900, "customer_id": "cust_1"},
        {"id": "sub_1", "notes": {"plan": "pro"}},
    )

    assert ok is True
    mock_generate.assert_called_once()
    assert mock_generate.call_args.kwargs["provider_payment_id"] == "pay_1"


@patch("app.domain.billing.webhook_handler.send_payment_success_email")
@patch("app.domain.billing.webhook_handler.generate_and_store_invoice")
@patch("app.domain.billing.webhook_handler._admin_email", return_value=None)
@patch("app.domain.billing.webhook_handler._tenant_from_subscription")
@patch("app.domain.billing.webhook_handler._supa")
def test_invoice_not_duplicated(
    mock_supa,
    mock_tenant,
    _mock_email,
    mock_generate,
    _mock_send,
):
    tenant = _tenant()
    mock_tenant.return_value = tenant
    mock_supa.return_value = _supa_with_invoice({"id": "existing"})

    ok = handle_payment_succeeded(
        {"id": "pay_1", "amount": 799900, "customer_id": "cust_1"},
        {"id": "sub_1", "notes": {"plan": "pro"}},
    )

    assert ok is True
    mock_generate.assert_not_called()
