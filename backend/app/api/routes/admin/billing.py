"""Superadmin billing ops — webhook status, timeline, invoice resend, manual ops."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.api.routes.admin.tenants import _require_superadmin
from app.core.rate_limit import ADMIN_READ_LIMIT, ADMIN_WRITE_LIMIT, limiter
from app.core.tenant import TenantContext, get_supabase_service_client
from app.services.billing.checkout import fetch_subscription_status, sync_subscription_from_razorpay
from app.services.billing.email import send_payment_success_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/billing", tags=["admin-billing"])

VALID_PLANS = frozenset({"free", "pro", "business"})


class WebhookStatusResponse(BaseModel):
    last_24h_total: int
    last_24h_processed: int
    last_24h_errors: int
    recent_events: list[dict]


class TimelineResponse(BaseModel):
    tenant_id: str
    events: list[dict]


class ManualUpgradeRequest(BaseModel):
    plan: str = Field(..., pattern="^(free|pro|business)$")
    reason: str = Field(..., min_length=3, max_length=500)
    clear_past_due: bool = True


class ManualUpgradeResponse(BaseModel):
    tenant_id: str
    plan: str
    plan_status: str
    reason: str


class ExtendTrialRequest(BaseModel):
    days: int = Field(..., ge=1, le=90)
    reason: str = Field(..., min_length=3, max_length=500)


class ExtendTrialResponse(BaseModel):
    tenant_id: str
    plan_status: str
    trial_ends_at: str
    reason: str


class ReconcileRequest(BaseModel):
    apply: bool = False


class ReconcileResponse(BaseModel):
    tenant_id: str
    db: dict
    razorpay: dict
    mismatches: list[str]
    applied: bool = False


def _get_tenant_row(tenant_id: str) -> dict:
    supa = get_supabase_service_client()
    result = (
        supa.table("tenants")
        .select(
            "id, plan, plan_status, past_due_since, trial_ends_at, "
            "razorpay_subscription_id, razorpay_customer_id"
        )
        .eq("id", tenant_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    return result.data


def _log_billing_action(action: str, tenant_id: str, actor_id: str, details: dict) -> None:
    try:
        get_supabase_service_client().table("audit_log").insert({
            "tenant_id": tenant_id,
            "user_id": actor_id,
            "action": action,
            "details": details,
        }).execute()
    except Exception as exc:
        logger.warning("Could not write audit_log for %s: %s", action, exc)


@router.get("/webhooks/status", response_model=WebhookStatusResponse)
@limiter.limit(ADMIN_READ_LIMIT)
def webhook_status(
    request: Request,
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
@limiter.limit(ADMIN_READ_LIMIT)
def payment_timeline(
    request: Request,
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
@limiter.limit(ADMIN_WRITE_LIMIT)
def resend_invoice(
    request: Request,
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


@router.post("/manual-upgrade/{tenant_id}", response_model=ManualUpgradeResponse)
@limiter.limit(ADMIN_WRITE_LIMIT)
def manual_upgrade(
    request: Request,
    tenant_id: str,
    body: ManualUpgradeRequest,
    admin: TenantContext = Depends(_require_superadmin),
) -> ManualUpgradeResponse:
    """Apply plan change without Razorpay (NEFT / bank transfer / support deal)."""
    _get_tenant_row(tenant_id)

    update: dict = {
        "plan": body.plan,
        "plan_status": "active",
    }
    if body.clear_past_due:
        update["past_due_since"] = None

    get_supabase_service_client().table("tenants").update(update).eq("id", tenant_id).execute()

    _log_billing_action(
        "billing.manual_upgrade",
        tenant_id,
        str(admin.user_id),
        {"plan": body.plan, "reason": body.reason, "clear_past_due": body.clear_past_due},
    )

    return ManualUpgradeResponse(
        tenant_id=tenant_id,
        plan=body.plan,
        plan_status="active",
        reason=body.reason,
    )


@router.post("/extend-trial/{tenant_id}", response_model=ExtendTrialResponse)
@limiter.limit(ADMIN_WRITE_LIMIT)
def extend_trial(
    request: Request,
    tenant_id: str,
    body: ExtendTrialRequest,
    admin: TenantContext = Depends(_require_superadmin),
) -> ExtendTrialResponse:
    row = _get_tenant_row(tenant_id)

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

    get_supabase_service_client().table("tenants").update({
        "plan_status": "trialing",
        "trial_ends_at": trial_ends_at,
    }).eq("id", tenant_id).execute()

    _log_billing_action(
        "billing.extend_trial",
        tenant_id,
        str(admin.user_id),
        {"days": body.days, "reason": body.reason, "trial_ends_at": trial_ends_at},
    )

    return ExtendTrialResponse(
        tenant_id=tenant_id,
        plan_status="trialing",
        trial_ends_at=trial_ends_at,
        reason=body.reason,
    )


@router.post("/reconcile/{tenant_id}", response_model=ReconcileResponse)
@limiter.limit(ADMIN_WRITE_LIMIT)
def reconcile_tenant_billing(
    request: Request,
    tenant_id: str,
    body: ReconcileRequest,
    admin: TenantContext = Depends(_require_superadmin),
) -> ReconcileResponse:
    """Compare DB billing state with Razorpay subscription; optionally sync from Razorpay."""
    row = _get_tenant_row(tenant_id)
    db_snapshot = {
        "plan": row.get("plan", "free"),
        "plan_status": row.get("plan_status", "active"),
        "razorpay_subscription_id": row.get("razorpay_subscription_id"),
    }

    razorpay_snapshot = fetch_subscription_status(UUID(tenant_id))
    mismatches: list[str] = []

    rz_status = razorpay_snapshot.get("razorpay_status")
    rz_plan = razorpay_snapshot.get("razorpay_plan")
    if row.get("razorpay_subscription_id") and not rz_status:
        mismatches.append("Razorpay subscription could not be fetched")
    if rz_status in ("active", "authenticated") and db_snapshot["plan_status"] == "past_due":
        mismatches.append("Razorpay active but DB plan_status is past_due")
    if rz_status in ("halted", "pending") and db_snapshot["plan_status"] == "active":
        mismatches.append("Razorpay halted/pending but DB plan_status is active")
    if (
        rz_status in ("active", "authenticated")
        and db_snapshot["plan"] == "free"
        and rz_plan in ("pro", "business")
    ):
        mismatches.append(f"Razorpay active ({rz_plan}) but DB plan is still free")
    if (
        rz_plan
        and db_snapshot["plan"] not in ("free",)
        and rz_plan != db_snapshot["plan"]
    ):
        mismatches.append(
            f"plan mismatch: DB={db_snapshot['plan']} vs Razorpay={rz_plan}"
        )

    applied = False
    if body.apply and mismatches and rz_status in ("active", "authenticated"):
        sync_result = sync_subscription_from_razorpay(UUID(tenant_id))
        if sync_result.get("synced"):
            applied = True
            db_snapshot["plan"] = sync_result["plan"]
            db_snapshot["plan_status"] = sync_result["plan_status"]
            _log_billing_action(
                "billing.reconcile_apply",
                tenant_id,
                str(admin.user_id),
                {"mismatches": mismatches, "razorpay_status": rz_status},
            )
        else:
            plan = rz_plan or db_snapshot["plan"]
            if plan in VALID_PLANS and plan != "free":
                get_supabase_service_client().table("tenants").update({
                    "plan": plan,
                    "plan_status": "active",
                    "past_due_since": None,
                }).eq("id", tenant_id).execute()
                applied = True
                db_snapshot["plan"] = plan
                db_snapshot["plan_status"] = "active"
                _log_billing_action(
                    "billing.reconcile_apply",
                    tenant_id,
                    str(admin.user_id),
                    {"mismatches": mismatches, "razorpay_status": rz_status},
                )

    return ReconcileResponse(
        tenant_id=tenant_id,
        db=db_snapshot,
        razorpay={
            "has_subscription": razorpay_snapshot.get("has_subscription"),
            "razorpay_status": rz_status,
            "plan": razorpay_snapshot.get("plan"),
            "razorpay_plan": rz_plan,
            "current_end": razorpay_snapshot.get("current_end"),
        },
        mismatches=mismatches,
        applied=applied,
    )
