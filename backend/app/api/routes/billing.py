"""Billing API — usage, checkout, portal, webhooks, GST details, invoices."""

from __future__ import annotations

import hashlib
import json
import logging
import re

from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.core.auth import CurrentUser
from app.core.idempotency import IdempotencyKey
from app.core.plan_guard import _get_current_usage
from app.core.plan_limits import PLAN_LIMITS
from app.core.rate_limit import limiter
from app.core.tenant import TenantCtx, get_supabase_service_client
from app.domain.billing.checkout import (
    cancel_subscription,
    create_checkout_session,
    fetch_subscription_status,
    sync_subscription_from_razorpay,
)
from app.domain.billing.idempotency_store import get_cached_response, store_response
from app.domain.billing.webhook_handler import dispatch_razorpay_event, verify_webhook_signature

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["billing"])

GSTIN_RE = re.compile(
    r"^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
)

CHECKOUT_ENDPOINT = "POST /billing/create-checkout-session"


class UsageResponse(BaseModel):
    plan: str
    plan_status: str
    copilot_calls_used: int
    copilot_calls_limit: int
    rows_used: int
    rows_limit: int
    uploads_used: int
    uploads_limit: int
    uploads_today: int
    uploads_per_day: int
    undos_today: int
    undos_per_day: int
    users_used: int
    users_limit: int
    debrief_count_used: int = 0
    debrief_lifetime_limit: int = 1
    features: dict
    retention_days: int


class CheckoutRequest(BaseModel):
    plan: str = Field(..., pattern="^(pro|business)$")
    interval: str = Field(default="month", pattern="^(month|year)$")


class CheckoutResponse(BaseModel):
    checkout_url: str
    subscription_id: str
    razorpay_key_id: str


class SubscriptionResponse(BaseModel):
    has_subscription: bool
    plan: str
    plan_status: str
    razorpay_status: str | None = None
    razorpay_plan: str | None = None
    current_end: int | None = None
    cancel_at_cycle_end: bool = False
    trial_ends_at: str | None = None
    synced: bool | None = None
    reason: str | None = None


class CancelSubscriptionResponse(BaseModel):
    status: str
    at_cycle_end: bool
    subscription_id: str


class BillingDetailsRequest(BaseModel):
    gstin: str | None = None
    company_name: str | None = None
    billing_address: str | None = None
    billing_state: str | None = None


class BillingDetailsResponse(BaseModel):
    billing_details: dict


class InvoiceSummary(BaseModel):
    id: str
    invoice_number: str
    total_amount: float
    tax_type: str
    status: str
    created_at: str
    pdf_storage_path: str | None = None


class InvoiceListResponse(BaseModel):
    invoices: list[InvoiceSummary]


@router.get("/usage", response_model=UsageResponse)
@limiter.limit("30/minute")
def get_usage(request: Request, user: CurrentUser, tenant: TenantCtx) -> UsageResponse:
    supa = get_supabase_service_client()
    limits = PLAN_LIMITS.get(tenant.plan, PLAN_LIMITS["free"])

    effective_features: dict = {}
    for feature, default in limits["features"].items():
        if feature in tenant.feature_overrides:
            effective_features[feature] = bool(tenant.feature_overrides[feature])
        else:
            effective_features[feature] = default

    usage: dict = _get_current_usage(tenant.tenant_id)

    rows_result = (
        supa.table("sales_data")
        .select("id", count="exact")
        .eq("tenant_id", str(tenant.tenant_id))
        .execute()
    )

    users_result = (
        supa.table("profiles")
        .select("id", count="exact")
        .eq("tenant_id", str(tenant.tenant_id))
        .execute()
    )

    return UsageResponse(
        plan=tenant.plan,
        plan_status=tenant.plan_status,
        copilot_calls_used=usage.get("copilot_calls", 0),
        copilot_calls_limit=limits["copilot_calls_per_month"],
        rows_used=rows_result.count or 0,
        rows_limit=limits["rows_total"],
        uploads_used=usage.get("uploads_count", 0),
        uploads_limit=limits["uploads_per_month"],
        uploads_today=usage.get("uploads_today", 0),
        uploads_per_day=limits["uploads_per_day"],
        undos_today=usage.get("undos_today", 0),
        undos_per_day=limits["undos_per_day"],
        users_used=users_result.count or 0,
        users_limit=limits["users"],
        debrief_count_used=usage.get("debrief_count", 0),
        debrief_lifetime_limit=limits.get("weekly_debriefs_lifetime", 1),
        features=effective_features,
        retention_days=limits["retention_days"],
    )


@router.post("/create-checkout-session", response_model=CheckoutResponse)
@limiter.limit("10/minute")
def create_checkout(
    request: Request,
    body: CheckoutRequest,
    user: CurrentUser,
    tenant: TenantCtx,
    idempotency_key: IdempotencyKey,
) -> CheckoutResponse:
    cached = get_cached_response(idempotency_key, tenant.tenant_id, CHECKOUT_ENDPOINT)
    if cached:
        status_code, response_body = cached
        if status_code != 200:
            raise HTTPException(status_code=status_code, detail=response_body)
        return CheckoutResponse(**response_body)

    if not user.email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="User email required for checkout")

    try:
        result = create_checkout_session(
            tenant_id=tenant.tenant_id,
            user_email=user.email,
            plan=body.plan,
            interval=body.interval,
        )
    except HTTPException as exc:
        store_response(idempotency_key, tenant.tenant_id, CHECKOUT_ENDPOINT, exc.status_code, {"detail": exc.detail})
        raise

    response = CheckoutResponse(**result)
    store_response(idempotency_key, tenant.tenant_id, CHECKOUT_ENDPOINT, 200, response.model_dump())
    return response


@router.get("/subscription", response_model=SubscriptionResponse)
@limiter.limit("30/minute")
def get_subscription(request: Request, tenant: TenantCtx) -> SubscriptionResponse:
    data = fetch_subscription_status(tenant.tenant_id)
    return SubscriptionResponse(**data)


@router.post("/sync-subscription", response_model=SubscriptionResponse)
@limiter.limit("10/minute")
def sync_subscription(request: Request, tenant: TenantCtx) -> SubscriptionResponse:
    """Pull Razorpay subscription state and apply plan upgrade if payment is active."""
    data = sync_subscription_from_razorpay(tenant.tenant_id)
    return SubscriptionResponse(**data)


@router.post("/cancel-subscription", response_model=CancelSubscriptionResponse)
@limiter.limit("10/minute")
def cancel_sub(request: Request, tenant: TenantCtx) -> CancelSubscriptionResponse:
    if not tenant.is_admin:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Only admins can cancel the subscription",
        )
    result = cancel_subscription(tenant.tenant_id, at_cycle_end=True)
    return CancelSubscriptionResponse(**result)


@router.post("/webhook")
async def razorpay_webhook(request: Request) -> dict[str, bool]:
    payload = await request.body()
    sig_header = request.headers.get("X-Razorpay-Signature")
    event_id = request.headers.get("X-Razorpay-Event-Id") or hashlib.sha256(payload).hexdigest()[:32]

    try:
        verify_webhook_signature(payload, sig_header)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    body = json.loads(payload.decode("utf-8"))
    dispatch_razorpay_event(body, event_id)
    return {"received": True}


@router.patch("/details", response_model=BillingDetailsResponse)
@limiter.limit("10/minute")
def update_billing_details(
    request: Request,
    body: BillingDetailsRequest,
    tenant: TenantCtx,
) -> BillingDetailsResponse:
    if body.gstin and not GSTIN_RE.match(body.gstin.upper()):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid GSTIN format")

    supa = get_supabase_service_client()
    current = (
        supa.table("tenants")
        .select("billing_details")
        .eq("id", str(tenant.tenant_id))
        .single()
        .execute()
    )
    details = (current.data or {}).get("billing_details") or {}

    if body.gstin is not None:
        details["gstin"] = body.gstin.upper()
    if body.company_name is not None:
        details["company_name"] = body.company_name
    if body.billing_address is not None:
        details["billing_address"] = body.billing_address
    if body.billing_state is not None:
        details["billing_state"] = body.billing_state

    supa.table("tenants").update({"billing_details": details}).eq(
        "id", str(tenant.tenant_id)
    ).execute()
    return BillingDetailsResponse(billing_details=details)


@router.get("/details", response_model=BillingDetailsResponse)
@limiter.limit("30/minute")
def get_billing_details(request: Request, tenant: TenantCtx) -> BillingDetailsResponse:
    supa = get_supabase_service_client()
    result = (
        supa.table("tenants")
        .select("billing_details")
        .eq("id", str(tenant.tenant_id))
        .single()
        .execute()
    )
    details = (result.data or {}).get("billing_details") or {}
    return BillingDetailsResponse(billing_details=details)


@router.get("/invoices", response_model=InvoiceListResponse)
@limiter.limit("30/minute")
def list_invoices(request: Request, tenant: TenantCtx) -> InvoiceListResponse:
    supa = get_supabase_service_client()
    result = (
        supa.table("invoices")
        .select("id, invoice_number, total_amount, tax_type, status, created_at, pdf_storage_path")
        .eq("tenant_id", str(tenant.tenant_id))
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    invoices = [
        InvoiceSummary(
            id=str(row["id"]),
            invoice_number=row["invoice_number"],
            total_amount=float(row["total_amount"]),
            tax_type=row["tax_type"],
            status=row["status"],
            created_at=row["created_at"],
            pdf_storage_path=row.get("pdf_storage_path"),
        )
        for row in (result.data or [])
    ]
    return InvoiceListResponse(invoices=invoices)


@router.get("/invoices/{invoice_id}/download")
@limiter.limit("10/minute")
def download_invoice(request: Request, invoice_id: UUID, tenant: TenantCtx) -> Response:
    supa = get_supabase_service_client()
    result = (
        supa.table("invoices")
        .select("invoice_number, pdf_storage_path")
        .eq("id", str(invoice_id))
        .eq("tenant_id", str(tenant.tenant_id))
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    path = result.data.get("pdf_storage_path")
    if not path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Invoice PDF not available")

    try:
        pdf_bytes = supa.storage.from_("storage").download(path)
    except Exception as exc:
        logger.error("Failed to download invoice PDF %s: %s", path, exc)
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, detail="Could not retrieve invoice PDF"
        ) from exc

    filename = f"{result.data['invoice_number']}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
