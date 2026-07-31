"""GST-compliant invoice PDF generation."""

from __future__ import annotations

import io
import logging
from typing import Any
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from app.core.config import settings
from app.core.tenant import get_supabase_service_client

logger = logging.getLogger(__name__)

GST_RATE = Decimal("0.18")
SAC_CODE = "998314"


def _quantize(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def compute_tax_breakdown(
    total_incl_tax: Decimal,
    customer_state: str,
    company_state: str,
) -> dict[str, Decimal | str]:
    """Split total (tax-inclusive) into excl tax + CGST/SGST or IGST."""
    total = _quantize(total_incl_tax)
    excl = _quantize(total / (1 + GST_RATE))
    tax = _quantize(total - excl)

    same_state = (
        customer_state.strip().lower() == company_state.strip().lower()
        and bool(customer_state.strip())
    )

    if same_state:
        half = _quantize(tax / 2)
        return {
            "tax_type": "cgst_sgst",
            "amount_excl_tax": excl,
            "cgst_amount": half,
            "sgst_amount": half,
            "igst_amount": Decimal("0"),
            "total_amount": total,
        }

    return {
        "tax_type": "igst",
        "amount_excl_tax": excl,
        "cgst_amount": Decimal("0"),
        "sgst_amount": Decimal("0"),
        "igst_amount": tax,
        "total_amount": total,
    }


def _generate_pdf_bytes(
    invoice_number: str,
    customer_name: str,
    customer_gstin: str,
    customer_state: str,
    customer_address: str,
    plan_label: str,
    breakdown: dict,
) -> bytes:
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 30 * mm

    c.setFont("Helvetica-Bold", 16)
    c.drawString(30 * mm, y, settings.company_name)
    y -= 8 * mm
    c.setFont("Helvetica", 10)
    c.drawString(30 * mm, y, f"GSTIN: {settings.company_gstin}")
    y -= 5 * mm
    c.drawString(30 * mm, y, settings.company_address or "India")
    y -= 10 * mm

    c.setFont("Helvetica-Bold", 14)
    c.drawString(30 * mm, y, "TAX INVOICE")
    y -= 8 * mm
    c.setFont("Helvetica", 10)
    c.drawString(30 * mm, y, f"Invoice No: {invoice_number}")
    y -= 5 * mm
    c.drawString(30 * mm, y, f"SAC Code: {SAC_CODE}")

    y -= 12 * mm
    c.setFont("Helvetica-Bold", 11)
    c.drawString(30 * mm, y, "Bill To:")
    y -= 6 * mm
    c.setFont("Helvetica", 10)
    c.drawString(30 * mm, y, customer_name or "Customer")
    y -= 5 * mm
    if customer_gstin:
        c.drawString(30 * mm, y, f"GSTIN: {customer_gstin}")
        y -= 5 * mm
    if customer_state:
        c.drawString(30 * mm, y, f"State: {customer_state}")
        y -= 5 * mm
    if customer_address:
        c.drawString(30 * mm, y, customer_address[:80])
        y -= 5 * mm

    y -= 8 * mm
    c.drawString(30 * mm, y, f"Description: AKARA {plan_label} subscription")
    y -= 8 * mm
    c.drawString(30 * mm, y, f"Taxable value: ₹{breakdown['amount_excl_tax']}")
    y -= 5 * mm

    if breakdown["tax_type"] == "cgst_sgst":
        c.drawString(30 * mm, y, f"CGST @ 9%: ₹{breakdown['cgst_amount']}")
        y -= 5 * mm
        c.drawString(30 * mm, y, f"SGST @ 9%: ₹{breakdown['sgst_amount']}")
    else:
        c.drawString(30 * mm, y, f"IGST @ 18%: ₹{breakdown['igst_amount']}")
    y -= 8 * mm
    c.setFont("Helvetica-Bold", 11)
    c.drawString(30 * mm, y, f"Total: ₹{breakdown['total_amount']}")

    c.showPage()
    c.save()
    return buffer.getvalue()


def generate_and_store_invoice(
    tenant_id: UUID,
    provider_payment_id: str | None,
    total_paise: int,
    plan: str,
    provider_order_id: str | None = None,
) -> dict:
    """Create invoice row + PDF bytes. Returns invoice record dict."""
    supa = get_supabase_service_client()
    tenant = (
        supa.table("tenants")
        .select("billing_details, name")
        .eq("id", str(tenant_id))
        .single()
        .execute()
    )
    billing = (tenant.data or {}).get("billing_details") or {}
    customer_state = billing.get("billing_state") or ""
    company_state = settings.company_state_code or "Maharashtra"

    total = Decimal(total_paise) / 100
    breakdown = compute_tax_breakdown(total, customer_state, company_state)

    seq_result = supa.rpc("next_invoice_number", {}).execute()
    invoice_number = seq_result.data if seq_result.data else f"INV-{total_paise}"

    pdf_bytes = _generate_pdf_bytes(
        invoice_number=invoice_number,
        customer_name=billing.get("company_name") or (tenant.data or {}).get("name", "Customer"),
        customer_gstin=billing.get("gstin", ""),
        customer_state=customer_state,
        customer_address=billing.get("billing_address", ""),
        plan_label=plan.capitalize(),
        breakdown=breakdown,
    )

    storage_path = f"invoices/{tenant_id}/{invoice_number}.pdf"
    try:
        supa.storage.from_(settings.supabase_imports_bucket).upload(
            storage_path,
            pdf_bytes,
            {"content-type": "application/pdf", "x-upsert": "true"},
        )
    except Exception as exc:
        logger.warning("Invoice PDF upload failed: %s", exc)
        storage_path = ""

    row = {
        "tenant_id": str(tenant_id),
        "invoice_number": invoice_number,
        "provider_payment_id": provider_payment_id,
        "provider_order_id": provider_order_id,
        "amount_excl_tax": float(breakdown["amount_excl_tax"]),
        "cgst_amount": float(breakdown["cgst_amount"]),
        "sgst_amount": float(breakdown["sgst_amount"]),
        "igst_amount": float(breakdown["igst_amount"]),
        "total_amount": float(breakdown["total_amount"]),
        "tax_type": breakdown["tax_type"],
        "customer_gstin": billing.get("gstin"),
        "customer_state": customer_state,
        "pdf_storage_path": storage_path,
        "status": "issued",
    }
    result = supa.table("invoices").insert(row).execute()
    invoice = (result.data or [row])[0]
    invoice["pdf_bytes"] = pdf_bytes
    return invoice


def generate_credit_note(
    *,
    tenant_id: UUID,
    original_invoice_number: str,
    refund_amount_paise: int,
    reason: str = "Refund",
) -> dict[str, Any]:
    """Generate GST credit note PDF for a refund."""
    supa = get_supabase_service_client()
    tenant = (
        supa.table("tenants")
        .select("billing_details, name")
        .eq("id", str(tenant_id))
        .single()
        .execute()
    )
    billing = (tenant.data or {}).get("billing_details") or {}
    customer_state = billing.get("billing_state") or ""
    company_state = settings.company_state_code or "Maharashtra"

    total = Decimal(refund_amount_paise) / 100
    breakdown = compute_tax_breakdown(total, customer_state, company_state)

    seq_result = supa.rpc("next_invoice_number", {}).execute()
    credit_number = f"CN-{(seq_result.data or '0001')}"

    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 30 * mm
    c.setFont("Helvetica-Bold", 16)
    c.drawString(30 * mm, y, settings.company_name)
    y -= 10 * mm
    c.setFont("Helvetica-Bold", 14)
    c.drawString(30 * mm, y, "CREDIT NOTE")
    y -= 8 * mm
    c.setFont("Helvetica", 10)
    c.drawString(30 * mm, y, f"Credit Note No: {credit_number}")
    y -= 5 * mm
    c.drawString(30 * mm, y, f"Against Invoice: {original_invoice_number}")
    y -= 5 * mm
    c.drawString(30 * mm, y, f"Reason: {reason[:80]}")
    y -= 8 * mm
    c.drawString(30 * mm, y, f"Taxable value: ₹{breakdown['amount_excl_tax']}")
    y -= 5 * mm
    if breakdown["tax_type"] == "cgst_sgst":
        c.drawString(30 * mm, y, f"CGST @ 9%: ₹{breakdown['cgst_amount']}")
        y -= 5 * mm
        c.drawString(30 * mm, y, f"SGST @ 9%: ₹{breakdown['sgst_amount']}")
    else:
        c.drawString(30 * mm, y, f"IGST @ 18%: ₹{breakdown['igst_amount']}")
    y -= 8 * mm
    c.setFont("Helvetica-Bold", 11)
    c.drawString(30 * mm, y, f"Total credit: ₹{breakdown['total_amount']}")
    c.showPage()
    c.save()
    pdf_bytes = buffer.getvalue()

    storage_path = f"credit-notes/{tenant_id}/{credit_number}.pdf"
    try:
        supa.storage.from_(settings.supabase_imports_bucket).upload(
            storage_path,
            pdf_bytes,
            {"content-type": "application/pdf", "x-upsert": "true"},
        )
    except Exception as exc:
        logger.warning("Credit note PDF upload failed: %s", exc)
        storage_path = ""

    return {
        "credit_note_number": credit_number,
        "original_invoice_number": original_invoice_number,
        "total_amount": float(breakdown["total_amount"]),
        "pdf_storage_path": storage_path,
        "pdf_bytes": pdf_bytes,
    }
