"""Superadmin billing, revenue, and cost endpoints."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.errors import AkaraHTTPException
from app.core.idempotency import IdempotencyKey, OptionalIdempotencyKey
from app.core.plan_limits import PLAN_LIMITS, get_limit
from app.core.rate_limit import ADMIN_READ_LIMIT, ADMIN_WRITE_LIMIT, limiter
from app.core.superadmin import SuperAdmin, SudoCtx, request_actor_meta, require_csrf
from app.core.tenant import get_supabase_service_client
from app.services.billing.checkout import fetch_subscription_status
from app.services.billing.email import send_payment_success_email
from app.services.superadmin.audit import record_operation
from app.services.superadmin.mutations import SuperadminMutation, dry_run_response
from app.services.superadmin.revenue import compute_revenue_summary

logger = logging.getLogger(__name__)

router = APIRouter(tags=["superadmin-billing"])

VALID_PLANS = frozenset({"free", "pro", "business"})
PLAN_MRR_INR = {"free": 0, "pro": 4999, "business": 14999}


class ManualUpgradeBody(SuperadminMutation):
    plan: str = Field(..., pattern="^(free|pro|business)$")
    clear_past_due: bool = True


class ExtendTrialBody(SuperadminMutation):
    days: int = Field(..., ge=1, le=90)


class VoidInvoiceBody(SuperadminMutation):
    invoice_id: UUID | None = None
    stripe_invoice_id: str | None = None


class RefundBody(SuperadminMutation):
    payment_id: str
    amount_paise: int | None = Field(default=None, ge=100)
    partial: bool = False


def _get_tenant_row(tenant_id: str) -> dict[str, Any]:
    supa = get_supabase_service_client()
    result = (
        supa.table("tenants")
        .select(
            "id, name, plan, plan_status, past_due_since, trial_ends_at, "
            "razorpay_subscription_id, razorpay_customer_id"
        )
        .eq("id", tenant_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Tenant not found")
    return result.data


def _subscription_payload(tenant_id: UUID) -> dict[str, Any]:
    data = fetch_subscription_status(tenant_id)
    return {
        "has_subscription": data.get("has_subscription"),
        "subscription_status": data.get("razorpay_status"),
        "plan": data.get("plan"),
        "razorpay_plan": data.get("razorpay_plan"),
        "current_period_end": data.get("current_end"),
        "trial_ends_at": data.get("trial_ends_at"),
        "provider": "razorpay",
    }


@router.get("/billing/razorpay-status/{tenant_id}")
@limiter.limit(ADMIN_READ_LIMIT)
def razorpay_status(
    request: Request,
    tenant_id: UUID,
    _admin: SuperAdmin,
) -> dict[str, Any]:
    _get_tenant_row(str(tenant_id))
    return {"tenant_id": str(tenant_id), **_subscription_payload(tenant_id)}


@router.get("/billing/stripe-status/{tenant_id}")
@limiter.limit(ADMIN_READ_LIMIT)
def stripe_status_alias(
    request: Request,
    tenant_id: UUID,
    _admin: SuperAdmin,
) -> dict[str, Any]:
    """Legacy alias — billing provider is Razorpay."""
    return razorpay_status(request, tenant_id, _admin)


@router.post("/billing/manual-upgrade/{tenant_id}")
@limiter.limit(ADMIN_WRITE_LIMIT)
def manual_upgrade(
    request: Request,
    tenant_id: UUID,
    body: ManualUpgradeBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    before = _get_tenant_row(str(tenant_id))
    if body.dry_run:
        return dry_run_response(
            action="superadmin.billing.manual_upgrade",
            before={"plan": before.get("plan"), "plan_status": before.get("plan_status")},
            impact={"plan": body.plan, "plan_status": "active", "clear_past_due": body.clear_past_due},
        )

    update: dict[str, Any] = {"plan": body.plan, "plan_status": "active"}
    if body.clear_past_due:
        update["past_due_since"] = None

    get_supabase_service_client().table("tenants").update(update).eq("id", str(tenant_id)).execute()
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.billing.manual_upgrade",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=tenant_id,
        before_state={"plan": before.get("plan"), "plan_status": before.get("plan_status")},
        after_state={"plan": body.plan, "plan_status": "active"},
        operation_id=body.operation_id,
        resource_type="tenant",
        resource_id=str(tenant_id),
        **meta,
    )
    return {"ok": True, "tenant_id": str(tenant_id), "plan": body.plan, "audit": audit}


@router.post("/billing/extend-trial/{tenant_id}")
@limiter.limit(ADMIN_WRITE_LIMIT)
def extend_trial(
    request: Request,
    tenant_id: UUID,
    body: ExtendTrialBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    row = _get_tenant_row(str(tenant_id))
    base = datetime.now(UTC)
    existing = row.get("trial_ends_at")
    if existing:
        try:
            parsed = datetime.fromisoformat(str(existing).replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=UTC)
            if parsed > base:
                base = parsed
        except ValueError:
            pass

    trial_ends_at = (base + timedelta(days=body.days)).isoformat()

    if body.dry_run:
        return dry_run_response(
            action="superadmin.billing.extend_trial",
            before={"trial_ends_at": row.get("trial_ends_at")},
            impact={"trial_ends_at": trial_ends_at, "days": body.days},
        )

    get_supabase_service_client().table("tenants").update({
        "plan_status": "trialing",
        "trial_ends_at": trial_ends_at,
    }).eq("id", str(tenant_id)).execute()

    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.billing.extend_trial",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=tenant_id,
        before_state={"trial_ends_at": row.get("trial_ends_at")},
        after_state={"trial_ends_at": trial_ends_at},
        operation_id=body.operation_id,
        resource_type="tenant",
        resource_id=str(tenant_id),
        details={"days": body.days},
        **meta,
    )
    return {"ok": True, "tenant_id": str(tenant_id), "trial_ends_at": trial_ends_at, "audit": audit}


@router.post("/billing/void-invoice/{invoice_ref}")
@limiter.limit(ADMIN_WRITE_LIMIT)
def void_invoice(
    request: Request,
    invoice_ref: str,
    body: VoidInvoiceBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    supa = get_supabase_service_client()
    query = supa.table("invoices").select("*")
    if body.invoice_id:
        query = query.eq("id", str(body.invoice_id))
    elif body.stripe_invoice_id:
        query = query.eq("stripe_invoice_id", body.stripe_invoice_id)
    else:
        query = query.or_(f"id.eq.{invoice_ref},stripe_invoice_id.eq.{invoice_ref},invoice_number.eq.{invoice_ref}")

    row = query.maybe_single().execute()
    if not row.data:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Invoice not found")

    before = row.data
    if body.dry_run:
        return dry_run_response(
            action="superadmin.billing.void_invoice",
            before={"status": before.get("status")},
            impact={"status": "void"},
        )

    supa.table("invoices").update({"status": "void"}).eq("id", before["id"]).execute()
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.billing.void_invoice",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=UUID(before["tenant_id"]),
        before_state={"status": before.get("status")},
        after_state={"status": "void"},
        operation_id=body.operation_id,
        resource_type="invoice",
        resource_id=before["id"],
        **meta,
    )
    return {"ok": True, "invoice_id": before["id"], "status": "void", "audit": audit}


@router.post("/billing/refund")
@limiter.limit(ADMIN_WRITE_LIMIT)
def refund_payment(
    request: Request,
    body: RefundBody,
    admin: SudoCtx,
    idempotency_key: OptionalIdempotencyKey = None,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    from app.services.billing.ledger import (
        check_idempotency_replay,
        preview_refund,
        record_ledger_entry,
        store_idempotency_response,
    )

    if body.dry_run:
        return preview_refund(
            payment_id=body.payment_id,
            amount_paise=body.amount_paise,
            partial=body.partial,
        )

    if not idempotency_key:
        raise AkaraHTTPException(
            status_code=400,
            code="VALIDATION_ERROR",
            message="Idempotency-Key header is required when dry_run=false",
        )

    replay = check_idempotency_replay(idempotency_key)
    if replay:
        return replay

    from app.services.billing.checkout import _client

    payload: dict[str, Any] = {}
    if body.amount_paise:
        payload["amount"] = body.amount_paise

    preview = preview_refund(
        payment_id=body.payment_id,
        amount_paise=body.amount_paise,
        partial=body.partial,
    )

    supa = get_supabase_service_client()
    inv = (
        supa.table("invoices")
        .select("tenant_id, invoice_number")
        .eq("provider_payment_id", body.payment_id)
        .maybe_single()
        .execute()
    )

    try:
        result = _client().payment.refund(body.payment_id, payload or None)
        status = "confirmed"
    except Exception as exc:
        record_ledger_entry(
            tenant_id=UUID(inv.data["tenant_id"]) if inv.data else None,
            entry_type="refund",
            amount_minor=body.amount_paise or 0,
            status="failed",
            provider_ref=body.payment_id,
            idempotency_key=idempotency_key,
            metadata={"error": str(exc)},
            created_by=admin.user_id,
        )
        raise AkaraHTTPException(
            status_code=502,
            code="PAYMENT_PROVIDER_ERROR",
            message=f"Refund failed: {exc}",
        ) from exc

    credit_note = None
    if preview.get("gst_credit_note_required") and body.amount_paise and inv.data:
        from app.services.billing.gst_invoice import generate_credit_note

        credit_note = generate_credit_note(
            tenant_id=UUID(inv.data["tenant_id"]),
            original_invoice_number=inv.data["invoice_number"],
            refund_amount_paise=body.amount_paise,
        )

    ledger = record_ledger_entry(
        tenant_id=UUID(inv.data["tenant_id"]) if inv.data else None,
        entry_type="refund",
        amount_minor=body.amount_paise or int(result.get("amount") or 0),
        status=status,
        provider_ref=body.payment_id,
        idempotency_key=idempotency_key,
        metadata={"refund": result, "credit_note": credit_note},
        created_by=admin.user_id,
    )
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.billing.refund",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        operation_id=body.operation_id,
        resource_type="payment",
        resource_id=body.payment_id,
        after_state={"refund": result, "ledger_id": ledger.get("id"), "credit_note": credit_note},
        **meta,
    )
    response = {"ok": True, "refund": result, "ledger": ledger, "credit_note": credit_note, "audit": audit}
    store_idempotency_response(idempotency_key, response)
    return response


@router.post("/billing/resend-invoice/{tenant_id}")
@limiter.limit(ADMIN_WRITE_LIMIT)
def resend_invoice(
    request: Request,
    tenant_id: UUID,
    body: SuperadminMutation,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    supa = get_supabase_service_client()
    _get_tenant_row(str(tenant_id))

    invoice = (
        supa.table("invoices")
        .select("invoice_number, pdf_storage_path")
        .eq("tenant_id", str(tenant_id))
        .order("created_at", desc=True)
        .limit(1)
        .maybe_single()
        .execute()
    )
    if not invoice.data:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="No invoice found")

    profiles = (
        supa.table("profiles")
        .select("id")
        .eq("tenant_id", str(tenant_id))
        .eq("role", "admin")
        .limit(1)
        .execute()
    )
    if not profiles.data:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="No admin user")

    try:
        user = supa.auth.admin.get_user_by_id(profiles.data[0]["id"])
        email = user.user.email if user and user.user else None
    except Exception as exc:
        raise AkaraHTTPException(
            status_code=502,
            code="SERVICE_UNAVAILABLE",
            message="Could not resolve admin email",
        ) from exc

    if not email:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Admin email not found")

    if body.dry_run:
        return dry_run_response(
            action="superadmin.billing.resend_invoice",
            impact={"email": email, "invoice_number": invoice.data["invoice_number"]},
        )

    pdf_bytes = None
    path = invoice.data.get("pdf_storage_path")
    if path:
        try:
            pdf_bytes = supa.storage.from_("storage").download(path)
        except Exception:
            pass

    send_payment_success_email(email, invoice.data["invoice_number"], "pro", pdf_bytes=pdf_bytes)

    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.billing.resend_invoice",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=tenant_id,
        operation_id=body.operation_id,
        resource_type="invoice",
        resource_id=invoice.data["invoice_number"],
        details={"email": email},
        **meta,
    )
    return {
        "ok": True,
        "status": "sent",
        "invoice_number": invoice.data["invoice_number"],
        "audit": audit,
    }


@router.get("/revenue")
@limiter.limit(ADMIN_READ_LIMIT)
def revenue_summary(
    request: Request,
    _admin: SuperAdmin,
) -> dict[str, Any]:
    return compute_revenue_summary()


@router.get("/revenue/snapshots")
@limiter.limit(ADMIN_READ_LIMIT)
def revenue_snapshots(
    request: Request,
    _admin: SuperAdmin,
    months: int = 6,
) -> dict[str, Any]:
    supa = get_supabase_service_client()
    cutoff = (datetime.now(UTC) - timedelta(days=months * 31)).date().isoformat()
    rows = (
        supa.table("revenue_snapshots")
        .select("*")
        .gte("snapshot_date", cutoff)
        .order("snapshot_date", desc=False)
        .execute()
    ).data or []
    return {"items": rows, "total": len(rows)}


@router.get("/billing/recent-payments")
@limiter.limit(ADMIN_READ_LIMIT)
def recent_payments(
    request: Request,
    _admin: SuperAdmin,
    limit: int = Query(default=10, ge=1, le=50),
) -> dict[str, Any]:
    supa = get_supabase_service_client()
    invoices = (
        supa.table("invoices")
        .select("id, tenant_id, invoice_number, total_amount, status, created_at")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    ).data or []
    tenant_names: dict[str, str] = {}
    items: list[dict[str, Any]] = []
    for row in invoices:
        tid = str(row.get("tenant_id") or "")
        if tid and tid not in tenant_names:
            tenant = (
                supa.table("tenants")
                .select("name")
                .eq("id", tid)
                .maybe_single()
                .execute()
            )
            tenant_names[tid] = (tenant.data or {}).get("name") or tid[:8]
        items.append(
            {
                "id": row.get("id"),
                "tenant_id": tid,
                "tenant_name": tenant_names.get(tid),
                "invoice_number": row.get("invoice_number"),
                "amount_inr": float(row.get("total_amount") or 0),
                "status": row.get("status") or "unknown",
                "created_at": row.get("created_at"),
            }
        )
    return {"items": items, "total": len(items)}


@router.get("/plan-limits")
@limiter.limit(ADMIN_READ_LIMIT)
def plan_limits_catalog(
    request: Request,
    _admin: SuperAdmin,
) -> dict[str, Any]:
    return {"plans": PLAN_LIMITS}


@router.get("/costs/tenants")
@limiter.limit(ADMIN_READ_LIMIT)
def tenant_cost_diagnostics(
    request: Request,
    _admin: SuperAdmin,
) -> list[dict[str, Any]]:
    supa = get_supabase_service_client()
    month_start = datetime.now(UTC).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    tenants = supa.table("tenants").select("id, name, plan, plan_status, feature_overrides").execute()
    usage_rows = (
        supa.table("usage_tracking")
        .select("tenant_id, copilot_calls, rows_imported")
        .gte("month", month_start.strftime("%Y-%m"))
        .execute()
    ).data or []
    usage_by_tenant = {r["tenant_id"]: r for r in usage_rows}
    llm_rows = (
        supa.table("llm_cost_log")
        .select("tenant_id, cost_usd")
        .gte("created_at", month_start.isoformat())
        .execute()
    ).data or []
    cost_by_tenant: dict[str, float] = {}
    for r in llm_rows:
        tid = r.get("tenant_id") or ""
        cost_by_tenant[tid] = cost_by_tenant.get(tid, 0) + float(r.get("cost_usd") or 0)

    out: list[dict[str, Any]] = []
    for t in tenants.data or []:
        tid = t["id"]
        plan = t.get("plan") or "free"
        u = usage_by_tenant.get(tid, {})
        out.append(
            {
                "tenant_id": tid,
                "tenant_name": t.get("name") or tid,
                "plan": plan,
                "plan_status": t.get("plan_status") or "active",
                "copilot_calls_used": int(u.get("copilot_calls") or 0),
                "copilot_calls_limit": get_limit(plan, "copilot_calls_per_month"),
                "rows_used": int(u.get("rows_imported") or 0),
                "rows_limit": get_limit(plan, "rows_total"),
                "cost_usd_this_month": round(cost_by_tenant.get(tid, 0), 6),
                "retention_days": get_limit(plan, "retention_days"),
                "feature_overrides": t.get("feature_overrides") or {},
            }
        )
    return out


@router.get("/costs")
@limiter.limit(ADMIN_READ_LIMIT)
def costs_summary(
    request: Request,
    _admin: SuperAdmin,
) -> dict[str, Any]:
    supa = get_supabase_service_client()
    month_start = datetime.now(UTC).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    rows = (
        supa.table("llm_cost_log")
        .select("tenant_id, feature, cost_usd")
        .gte("created_at", month_start.isoformat())
        .execute()
    ).data or []

    total = sum(float(r.get("cost_usd") or 0) for r in rows)
    by_feature: dict[str, float] = {}
    by_tenant: dict[str, float] = {}
    for r in rows:
        feat = r.get("feature") or "unknown"
        by_feature[feat] = by_feature.get(feat, 0) + float(r.get("cost_usd") or 0)
        tid = r.get("tenant_id") or "unknown"
        by_tenant[tid] = by_tenant.get(tid, 0) + float(r.get("cost_usd") or 0)

    tenant_costs = sorted(
        [{"tenant_id": k, "cost_usd": round(v, 6)} for k, v in by_tenant.items()],
        key=lambda x: x["cost_usd"],
        reverse=True,
    )
    copilot_rows = [r for r in rows if r.get("feature") == "copilot"]
    avg_per_question = (
        total / len(copilot_rows) if copilot_rows else 0
    )

    return {
        "total_cost_usd_this_month": round(total, 6),
        "cost_by_feature": {k: round(v, 6) for k, v in by_feature.items()},
        "cost_by_tenant": tenant_costs[:50],
        "avg_cost_per_question": round(avg_per_question, 8),
        "avg_cost_per_tenant_per_month": round(total / max(len(by_tenant), 1), 6),
    }


class WebhookStatusResponse(BaseModel):
    last_24h_total: int
    last_24h_processed: int
    last_24h_errors: int
    recent_events: list[dict]


class TimelineResponse(BaseModel):
    tenant_id: str
    events: list[dict]


class ReconcileBody(SuperadminMutation):
    apply: bool = False


@router.get("/billing/webhooks/status", response_model=WebhookStatusResponse)
@limiter.limit(ADMIN_READ_LIMIT)
def webhook_status(
    request: Request,
    _admin: SuperAdmin,
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


@router.get("/billing/timeline/{tenant_id}", response_model=TimelineResponse)
@limiter.limit(ADMIN_READ_LIMIT)
def payment_timeline(
    request: Request,
    tenant_id: str,
    _admin: SuperAdmin,
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
    events: list[dict] = []
    for inv in invoices.data or []:
        events.append({"type": "invoice", **inv})
    for d in dunning.data or []:
        events.append({"type": "dunning", **d})
    events.sort(key=lambda e: e.get("created_at") or e.get("sent_at", ""), reverse=True)
    return TimelineResponse(tenant_id=tenant_id, events=events)


@router.post("/billing/reconcile/{tenant_id}")
@limiter.limit(ADMIN_WRITE_LIMIT)
def reconcile_tenant(
    request: Request,
    tenant_id: str,
    body: ReconcileBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    from app.services.billing.checkout import sync_subscription_from_razorpay

    row = _get_tenant_row(tenant_id)
    snapshot = fetch_subscription_status(UUID(tenant_id))
    mismatches: list[str] = []
    db_plan = row.get("plan")
    rz_plan = snapshot.get("plan")
    if db_plan != rz_plan and rz_plan:
        mismatches.append(f"plan: db={db_plan} razorpay={rz_plan}")

    applied = False
    if body.apply and mismatches:
        sync_subscription_from_razorpay(UUID(tenant_id))
        applied = True

    meta = request_actor_meta(request)
    record_operation(
        action="superadmin.billing.reconcile",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=UUID(tenant_id),
        details={"mismatches": mismatches, "applied": applied},
        **meta,
    )
    return {
        "tenant_id": tenant_id,
        "db": {"plan": db_plan, "plan_status": row.get("plan_status")},
        "razorpay": snapshot,
        "mismatches": mismatches,
        "applied": applied,
    }


# ---------------------------------------------------------------------------
# Day 10 GAP 2 — ledger, refund preview, coupons, subscription ops
# ---------------------------------------------------------------------------


class RefundPreviewBody(BaseModel):
    payment_id: str
    amount_paise: int | None = Field(default=None, ge=100)
    partial: bool = False


class CreditBody(SuperadminMutation):
    tenant_id: UUID
    amount_minor: int = Field(..., ge=100)
    reason_note: str = ""


class CouponBody(BaseModel):
    code: str = Field(..., min_length=3, max_length=32)
    name: str
    discount_type: str = Field(..., pattern="^(percent|fixed)$")
    discount_value: int = Field(..., ge=1)
    duration: str = Field(default="once", pattern="^(once|repeating|forever)$")
    max_redemptions: int | None = None
    eligible_plans: list[str] = Field(default_factory=list)
    first_time_only: bool = False
    expires_at: str | None = None


class MarkPaidBody(SuperadminMutation):
    bank_reference: str = Field(..., min_length=4)
    payment_method: str = Field(default="NEFT", pattern="^(NEFT|UPI|CHEQUE)$")
    evidence_storage_path: str | None = None


class ManualPaymentBody(SuperadminMutation):
    tenant_id: UUID
    amount_minor: int = Field(..., ge=100)
    bank_reference: str
    payment_method: str = Field(default="NEFT", pattern="^(NEFT|UPI|CHEQUE)$")
    invoice_id: UUID | None = None
    evidence_storage_path: str | None = None


class PromotionCodeBody(BaseModel):
    coupon_id: UUID
    code: str = Field(..., min_length=3, max_length=32)


class CouponPatchBody(BaseModel):
    is_active: bool | None = None
    max_redemptions: int | None = Field(default=None, ge=1)
    expires_at: str | None = None


class SubscriptionActionBody(SuperadminMutation):
    action: str = Field(..., pattern="^(pause|resume|cancel|change_date)$")
    new_date: str | None = None


@router.get("/billing/ledger")
@limiter.limit(ADMIN_READ_LIMIT)
def billing_ledger(
    request: Request,
    _admin: SuperAdmin,
    tenant_id: UUID | None = None,
    entry_type: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    from app.services.billing.ledger import list_ledger

    return list_ledger(tenant_id=tenant_id, entry_type=entry_type, limit=limit, offset=offset)


@router.post("/billing/refunds/preview")
@limiter.limit(ADMIN_READ_LIMIT)
def refund_preview(
    request: Request,
    body: RefundPreviewBody,
    _admin: SuperAdmin,
) -> dict[str, Any]:
    from app.services.billing.ledger import preview_refund

    return preview_refund(
        payment_id=body.payment_id,
        amount_paise=body.amount_paise,
        partial=body.partial,
    )


@router.post("/billing/refunds/idempotent")
@limiter.limit(ADMIN_WRITE_LIMIT)
def refund_payment_idempotent(
    request: Request,
    body: RefundBody,
    admin: SudoCtx,
    idempotency_key: IdempotencyKey,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    """Legacy alias — prefer POST /billing/refund with Idempotency-Key."""
    return refund_payment(request, body, admin, idempotency_key, None)


@router.post("/billing/credits")
@limiter.limit(ADMIN_WRITE_LIMIT)
def issue_credit(
    request: Request,
    body: CreditBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    from app.services.billing.ledger import record_ledger_entry

    if body.dry_run:
        return dry_run_response(
            action="superadmin.billing.credit",
            impact={"tenant_id": str(body.tenant_id), "amount_minor": body.amount_minor},
        )
    ledger = record_ledger_entry(
        tenant_id=body.tenant_id,
        entry_type="credit",
        amount_minor=body.amount_minor,
        status="confirmed",
        metadata={"reason_note": body.reason_note},
        created_by=admin.user_id,
    )
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.billing.credit",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=body.tenant_id,
        after_state=ledger,
        operation_id=body.operation_id,
        resource_type="billing_ledger",
        resource_id=str(ledger.get("id", "")),
        **meta,
    )
    return {"ok": True, "ledger": ledger, "audit": audit}


@router.get("/billing/coupons")
@limiter.limit(ADMIN_READ_LIMIT)
def list_coupons(request: Request, _admin: SuperAdmin) -> dict[str, Any]:
    supa = get_supabase_service_client()
    rows = supa.table("billing_coupons").select("*").order("created_at", desc=True).execute()
    return {"items": rows.data or []}


@router.post("/billing/coupons")
@limiter.limit(ADMIN_WRITE_LIMIT)
def create_coupon(
    request: Request,
    body: CouponBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    supa = get_supabase_service_client()
    payload = body.model_dump()
    result = supa.table("billing_coupons").insert(payload).execute()
    coupon = (result.data or [{}])[0]
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.billing.create_coupon",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason="Coupon created",
        after_state=coupon,
        resource_type="billing_coupon",
        resource_id=str(coupon.get("id", body.code)),
        **meta,
    )
    return {"ok": True, "coupon": coupon, "audit": audit}


@router.post("/billing/promotion-codes")
@limiter.limit(ADMIN_WRITE_LIMIT)
def create_promotion_code(
    request: Request,
    body: PromotionCodeBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    supa = get_supabase_service_client()
    coupon = (
        supa.table("billing_coupons")
        .select("id")
        .eq("id", str(body.coupon_id))
        .maybe_single()
        .execute()
    )
    if not coupon.data:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Coupon not found")
    payload = {"coupon_id": str(body.coupon_id), "code": body.code.upper()}
    result = supa.table("billing_promotion_codes").insert(payload).execute()
    promo = (result.data or [{}])[0]
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.billing.create_promotion_code",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason="Promotion code created",
        after_state=promo,
        resource_type="billing_promotion_code",
        resource_id=str(promo.get("id", body.code)),
        **meta,
    )
    return {"ok": True, "promotion_code": promo, "audit": audit}


@router.patch("/billing/coupons/{coupon_id}")
@limiter.limit(ADMIN_WRITE_LIMIT)
def patch_coupon(
    request: Request,
    coupon_id: UUID,
    body: CouponPatchBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    supa = get_supabase_service_client()
    update: dict[str, Any] = {"updated_at": datetime.now(UTC).isoformat()}
    if body.is_active is not None:
        update["is_active"] = body.is_active
    if body.max_redemptions is not None:
        update["max_redemptions"] = body.max_redemptions
    if body.expires_at is not None:
        update["expires_at"] = body.expires_at
    supa.table("billing_coupons").update(update).eq("id", str(coupon_id)).execute()
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.billing.patch_coupon",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason="Coupon updated",
        after_state=update,
        resource_type="billing_coupon",
        resource_id=str(coupon_id),
        **meta,
    )
    return {"ok": True, "coupon_id": str(coupon_id), "audit": audit}


@router.post("/billing/invoices/{invoice_id}/retry")
@limiter.limit(ADMIN_WRITE_LIMIT)
def retry_invoice(
    request: Request,
    invoice_id: UUID,
    body: SuperadminMutation,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    supa = get_supabase_service_client()
    inv = supa.table("invoices").select("*").eq("id", str(invoice_id)).maybe_single().execute()
    if not inv.data:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Invoice not found")

    tenant_id = UUID(inv.data["tenant_id"])
    if body.dry_run:
        return dry_run_response(
            action="superadmin.billing.retry_invoice",
            impact={"invoice_id": str(invoice_id), "tenant_id": str(tenant_id)},
        )

    row = _get_tenant_row(str(tenant_id))
    profiles = (
        supa.table("profiles")
        .select("email")
        .eq("tenant_id", str(tenant_id))
        .eq("role", "admin")
        .limit(1)
        .maybe_single()
        .execute()
    )
    admin_email = (profiles.data or {}).get("email")
    if not admin_email:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="No admin email found")

    pdf_bytes = None
    pdf_path = inv.data.get("pdf_storage_path")
    if pdf_path:
        try:
            pdf_bytes = supa.storage.from_(settings.supabase_imports_bucket).download(pdf_path)
        except Exception:
            pdf_bytes = None

    try:
        sent = send_payment_success_email(
            to_email=admin_email,
            invoice_number=inv.data["invoice_number"],
            plan=row.get("plan") or "pro",
            pdf_bytes=pdf_bytes,
        )
        result = {"resent": sent, "invoice_number": inv.data["invoice_number"], "to": admin_email}
    except Exception as exc:
        raise AkaraHTTPException(status_code=502, code="EMAIL_ERROR", message=str(exc)) from exc

    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.billing.retry_invoice",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=tenant_id,
        after_state=result,
        operation_id=body.operation_id,
        resource_type="invoice",
        resource_id=str(invoice_id),
        **meta,
    )
    return {"ok": True, **result, "audit": audit}


@router.post("/billing/invoices/{invoice_id}/mark-paid")
@limiter.limit(ADMIN_WRITE_LIMIT)
def mark_invoice_paid(
    request: Request,
    invoice_id: UUID,
    body: MarkPaidBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    from app.services.billing.ledger import record_ledger_entry

    supa = get_supabase_service_client()
    inv = supa.table("invoices").select("*").eq("id", str(invoice_id)).maybe_single().execute()
    if not inv.data:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Invoice not found")

    if body.dry_run:
        return dry_run_response(
            action="superadmin.billing.mark_paid",
            before={"status": inv.data.get("status")},
            impact={"status": "paid", "bank_reference": body.bank_reference},
        )

    amount_minor = int(float(inv.data.get("total_amount") or 0) * 100)
    supa.table("invoices").update({"status": "paid"}).eq("id", str(invoice_id)).execute()
    ledger = record_ledger_entry(
        tenant_id=UUID(inv.data["tenant_id"]),
        entry_type="manual_payment",
        amount_minor=amount_minor,
        status="confirmed",
        invoice_id=invoice_id,
        evidence_path=body.evidence_storage_path,
        metadata={"bank_reference": body.bank_reference, "method": body.payment_method},
        created_by=admin.user_id,
    )
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.billing.mark_paid",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=UUID(inv.data["tenant_id"]),
        after_state={"status": "paid", "ledger_id": ledger.get("id")},
        operation_id=body.operation_id,
        resource_type="invoice",
        resource_id=str(invoice_id),
        **meta,
    )
    return {"ok": True, "invoice_id": str(invoice_id), "ledger": ledger, "audit": audit}


@router.post("/billing/invoices/{invoice_id}/write-off")
@limiter.limit(ADMIN_WRITE_LIMIT)
def write_off_invoice(
    request: Request,
    invoice_id: UUID,
    body: SuperadminMutation,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    from app.services.billing.ledger import record_ledger_entry

    supa = get_supabase_service_client()
    inv = supa.table("invoices").select("*").eq("id", str(invoice_id)).maybe_single().execute()
    if not inv.data:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Invoice not found")

    if body.dry_run:
        return dry_run_response(action="superadmin.billing.write_off", impact={"status": "written_off"})

    amount_minor = int(float(inv.data.get("total_amount") or 0) * 100)
    supa.table("invoices").update({"status": "void"}).eq("id", str(invoice_id)).execute()
    ledger = record_ledger_entry(
        tenant_id=UUID(inv.data["tenant_id"]),
        entry_type="write_off",
        amount_minor=amount_minor,
        status="confirmed",
        invoice_id=invoice_id,
        created_by=admin.user_id,
    )
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.billing.write_off",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=UUID(inv.data["tenant_id"]),
        operation_id=body.operation_id,
        resource_type="invoice",
        resource_id=str(invoice_id),
        after_state={"ledger_id": ledger.get("id")},
        **meta,
    )
    return {"ok": True, "ledger": ledger, "audit": audit}


@router.post("/billing/manual-payment")
@limiter.limit(ADMIN_WRITE_LIMIT)
def manual_payment(
    request: Request,
    body: ManualPaymentBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    from app.services.billing.ledger import record_ledger_entry

    if body.dry_run:
        return dry_run_response(
            action="superadmin.billing.manual_payment",
            impact={
                "tenant_id": str(body.tenant_id),
                "amount_minor": body.amount_minor,
                "bank_reference": body.bank_reference,
            },
        )
    ledger = record_ledger_entry(
        tenant_id=body.tenant_id,
        entry_type="manual_payment",
        amount_minor=body.amount_minor,
        status="confirmed",
        invoice_id=body.invoice_id,
        evidence_path=body.evidence_storage_path,
        metadata={"bank_reference": body.bank_reference, "method": body.payment_method},
        created_by=admin.user_id,
    )
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.billing.manual_payment",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=body.tenant_id,
        after_state=ledger,
        operation_id=body.operation_id,
        resource_type="billing_ledger",
        resource_id=str(ledger.get("id", "")),
        **meta,
    )
    return {"ok": True, "ledger": ledger, "audit": audit}


@router.post("/billing/subscriptions/{tenant_id}/action")
@limiter.limit(ADMIN_WRITE_LIMIT)
def subscription_action(
    request: Request,
    tenant_id: UUID,
    body: SubscriptionActionBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    row = _get_tenant_row(str(tenant_id))
    sub_id = row.get("razorpay_subscription_id")
    if body.dry_run:
        return dry_run_response(
            action=f"superadmin.billing.subscription.{body.action}",
            impact={"subscription_id": sub_id, "new_date": body.new_date},
        )
    if not sub_id:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="No Razorpay subscription")

    from app.services.billing.checkout import _client

    client = _client()
    result: dict[str, Any] = {"action": body.action}
    try:
        if body.action == "pause":
            result["provider"] = client.subscription.pause(sub_id)
        elif body.action == "resume":
            result["provider"] = client.subscription.resume(sub_id)
        elif body.action == "cancel":
            result["provider"] = client.subscription.cancel(sub_id)
        elif body.action == "change_date" and body.new_date:
            get_supabase_service_client().table("tenants").update({"trial_ends_at": body.new_date}).eq("id", str(tenant_id)).execute()
            result["new_date"] = body.new_date
    except Exception as exc:
        raise AkaraHTTPException(status_code=502, code="PAYMENT_PROVIDER_ERROR", message=str(exc)) from exc

    meta = request_actor_meta(request)
    audit = record_operation(
        action=f"superadmin.billing.subscription.{body.action}",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=tenant_id,
        after_state=result,
        operation_id=body.operation_id,
        resource_type="subscription",
        resource_id=sub_id,
        **meta,
    )
    return {"ok": True, **result, "audit": audit}


@router.get("/billing/reconciliation/{tenant_id}")
@limiter.limit(ADMIN_READ_LIMIT)
def reconciliation_view(
    request: Request,
    tenant_id: UUID,
    _admin: SuperAdmin,
) -> dict[str, Any]:
    supa = get_supabase_service_client()
    row = _get_tenant_row(str(tenant_id))
    snapshot = fetch_subscription_status(tenant_id)
    invoice = (
        supa.table("invoices")
        .select("id, invoice_number, total_amount, status, gst_amount, provider_payment_id")
        .eq("tenant_id", str(tenant_id))
        .order("created_at", desc=True)
        .limit(1)
        .maybe_single()
        .execute()
    )
    ledger = (
        supa.table("billing_ledger_entries")
        .select("id, entry_type, amount_minor, status, provider_ref, created_at")
        .eq("tenant_id", str(tenant_id))
        .order("created_at", desc=True)
        .limit(1)
        .maybe_single()
        .execute()
    )
    return {
        "tenant_id": str(tenant_id),
        "razorpay": {
            "status": snapshot.get("razorpay_status"),
            "amount_paise": snapshot.get("amount_paid"),
            "plan": snapshot.get("plan"),
        },
        "invoice": invoice.data,
        "ledger": ledger.data,
        "entitlement": {"plan": row.get("plan"), "plan_status": row.get("plan_status")},
        "aligned": row.get("plan") == snapshot.get("plan"),
        "columns": ["razorpay", "invoice", "ledger", "entitlement"],
    }
