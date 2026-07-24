"""Superadmin billing ops — webhook status, timeline, invoice resend."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.routes.admin.tenants import _require_superadmin
from app.core.tenant import TenantContext, get_supabase_service_client
from app.services.billing.email import send_payment_success_email

router = APIRouter(prefix="/admin/billing", tags=["admin-billing"])


class WebhookStatusResponse(BaseModel):
    last_24h_total: int
    last_24h_processed: int
    last_24h_errors: int
    recent_events: list[dict]


class TimelineResponse(BaseModel):
    tenant_id: str
    events: list[dict]


@router.get("/webhooks/status", response_model=WebhookStatusResponse)
def webhook_status(
    _admin: TenantContext = Depends(_require_superadmin),
) -> WebhookStatusResponse:
    supa = get_supabase_service_client()
    since = (datetime.now(UTC) - timedelta(hours=24)).isoformat()
    events = (
        supa.table("payment_webhook_events")
        .select("event_id, event_type, processed_at, error_message, created_at")
        .gte("created_at", since)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    rows = events.data or []
    processed = sum(1 for r in rows if r.get("processed_at") and not r.get("error_message"))
    errors = sum(1 for r in rows if r.get("error_message"))
    return WebhookStatusResponse(
        last_24h_total=len(rows),
        last_24h_processed=processed,
        last_24h_errors=errors,
        recent_events=rows,
    )


@router.get("/timeline/{tenant_id}", response_model=TimelineResponse)
def payment_timeline(
    tenant_id: str,
    _admin: TenantContext = Depends(_require_superadmin),
) -> TimelineResponse:
    supa = get_supabase_service_client()
    invoices = (
        supa.table("invoices")
        .select("invoice_number, total_amount, status, created_at")
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    dunning = (
        supa.table("dunning_events")
        .select("day_offset, channel, status, sent_at")
        .eq("tenant_id", tenant_id)
        .order("sent_at", desc=True)
        .limit(20)
        .execute()
    )
    events = []
    for inv in invoices.data or []:
        events.append({"type": "invoice", **inv})
    for d in dunning.data or []:
        events.append({"type": "dunning", **d})
    events.sort(key=lambda e: e.get("created_at") or e.get("sent_at", ""), reverse=True)
    return TimelineResponse(tenant_id=tenant_id, events=events)


@router.post("/resend-invoice/{tenant_id}")
def resend_invoice(
    tenant_id: str,
    _admin: TenantContext = Depends(_require_superadmin),
) -> dict[str, str]:
    supa = get_supabase_service_client()
    invoice = (
        supa.table("invoices")
        .select("invoice_number, pdf_storage_path")
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .limit(1)
        .maybe_single()
        .execute()
    )
    if not invoice.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No invoice found")

    profiles = (
        supa.table("profiles")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("role", "admin")
        .limit(1)
        .execute()
    )
    if not profiles.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No admin user")

    try:
        user = supa.auth.admin.get_user_by_id(profiles.data[0]["id"])
        email = user.user.email if user and user.user else None
    except Exception as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not resolve admin email") from exc

    if not email:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Admin email not found")

    pdf_bytes = None
    path = invoice.data.get("pdf_storage_path")
    if path:
        try:
            pdf_bytes = supa.storage.from_("storage").download(path)
        except Exception:
            pass

    send_payment_success_email(email, invoice.data["invoice_number"], "pro", pdf_bytes=pdf_bytes)
    return {"status": "sent", "invoice_number": invoice.data["invoice_number"]}
