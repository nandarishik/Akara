"""Tests for GST invoice tax breakdown."""

from decimal import Decimal

from app.domain.billing.gst_invoice import compute_tax_breakdown


def test_igst_interstate():
    breakdown = compute_tax_breakdown(
        Decimal("1180.00"),
        customer_state="Karnataka",
        company_state="Maharashtra",
    )
    assert breakdown["tax_type"] == "igst"
    assert breakdown["igst_amount"] == Decimal("180.00")
    assert breakdown["cgst_amount"] == Decimal("0")
    assert breakdown["total_amount"] == Decimal("1180.00")


def test_cgst_sgst_same_state():
    breakdown = compute_tax_breakdown(
        Decimal("1180.00"),
        customer_state="Maharashtra",
        company_state="Maharashtra",
    )
    assert breakdown["tax_type"] == "cgst_sgst"
    assert breakdown["cgst_amount"] == breakdown["sgst_amount"]
    assert breakdown["igst_amount"] == Decimal("0")
    assert breakdown["amount_excl_tax"] + breakdown["cgst_amount"] + breakdown["sgst_amount"] == Decimal("1180.00")
