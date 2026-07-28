"""Superadmin billing, revenue, and cost endpoints."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.core.errors import AkaraHTTPException
from app.core.rate_limit import ADMIN_READ_LIMIT, ADMIN_WRITE_LIMIT, limiter
from app.core.superadmin import SuperAdmin, SudoCtx, request_actor_meta, require_csrf
from app.core.tenant import get_supabase_service_client
from app.services.billing.checkout import fetch_subscription_status
from app.services.billing.email import send_payment_success_email
from app.services.superadmin.audit import record_operation
from app.services.superadmin.mutations import SuperadminMutation, dry_run_response

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
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    if body.dry_run:
        return dry_run_response(
            action="superadmin.billing.refund",
            impact={
                "payment_id": body.payment_id,
                "amount_paise": body.amount_paise,
                "partial": body.partial,
            },
        )

    from app.services.billing.checkout import _client

    payload: dict[str, Any] = {}
    if body.amount_paise:
        payload["amount"] = body.amount_paise

    try:
        result = _client().payment.refund(body.payment_id, payload or None)
    except Exception as exc:
        raise AkaraHTTPException(
            status_code=502,
            code="PAYMENT_PROVIDER_ERROR",
            message=f"Refund failed: {exc}",
        ) from exc

    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.billing.refund",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        operation_id=body.operation_id,
        resource_type="payment",
        resource_id=body.payment_id,
        after_state={"refund": result},
        **meta,
    )
    return {"ok": True, "refund": result, "audit": audit}


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
    supa = get_supabase_service_client()
    tenants = supa.table("tenants").select("id, plan, plan_status, created_at").execute()
    rows = tenants.data or []

    by_plan = {"free": 0, "pro": 0, "business": 0}
    mrr = 0
    for t in rows:
        plan = t.get("plan") or "free"
        if plan in by_plan:
            by_plan[plan] += 1
        if t.get("plan_status") in ("active", "trialing") and plan in PLAN_MRR_INR:
            mrr += PLAN_MRR_INR[plan]

    month_start = datetime.now(UTC).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    new_paid = sum(
        1
        for t in rows
        if t.get("plan") in ("pro", "business")
        and t.get("created_at")
        and str(t["created_at"]) >= month_start.isoformat()
    )
    churned = sum(1 for t in rows if t.get("plan_status") == "cancelled")

    llm = (
        supa.table("llm_cost_log")
        .select("cost_usd")
        .gte("created_at", month_start.isoformat())
        .execute()
    )
    llm_cost = sum(float(r.get("cost_usd") or 0) for r in (llm.data or []))
    margin_pct = round((1 - (llm_cost * 85 / max(mrr, 1))) * 100, 2) if mrr else 0

    return {
        "mrr_inr": mrr,
        "arr_inr": mrr * 12,
        "tenants_by_plan": by_plan,
        "new_paid_this_month": new_paid,
        "churned_this_month": churned,
        "total_llm_cost_usd_this_month": round(llm_cost, 4),
        "estimated_gross_margin_pct": margin_pct,
    }


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
