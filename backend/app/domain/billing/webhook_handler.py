"""Razorpay webhook dispatch with idempotency."""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import razorpay

from app.core.config import settings
from app.core.tenant import get_supabase_service_client
from app.domain.billing.checkout import resolve_plan_from_subscription
from app.domain.billing.email import send_payment_failed_email, send_payment_success_email
from app.domain.billing.gst_invoice import generate_and_store_invoice
from app.domain.billing.plan_downgrade import apply_plan_downgrade

logger = logging.getLogger(__name__)

GRACE_DAYS = 30
WEBHOOK_TABLE = "payment_webhook_events"


def _supa():
    return get_supabase_service_client()


def _already_processed(event_id: str) -> bool:
    result = (
        _supa()
        .table(WEBHOOK_TABLE)
        .select("event_id, processed_at")
        .eq("event_id", event_id)
        .maybe_single()
        .execute()
    )
    if result is None or not result.data:
        return False
    return bool(result.data.get("processed_at"))


def _mark_processed(
    event_id: str,
    event_type: str,
    payload_hash: str,
    error: str | None = None,
) -> None:
    _supa().table(WEBHOOK_TABLE).upsert({
        "event_id": event_id,
        "event_type": event_type,
        "payload_hash": payload_hash,
        "processed_at": datetime.now(UTC).isoformat(),
        "error_message": error,
        "provider": "razorpay",
    }).execute()


def _tenant_by_customer(customer_id: str) -> dict | None:
    if not customer_id:
        return None
    result = (
        _supa()
        .table("tenants")
        .select("id, plan, billing_details")
        .eq("razorpay_customer_id", customer_id)
        .maybe_single()
        .execute()
    )
    if result is None or not result.data:
        return None
    return result.data


def _tenant_by_id(tenant_id: str) -> dict | None:
    if not tenant_id:
        return None
    result = (
        _supa()
        .table("tenants")
        .select("id, plan, billing_details")
        .eq("id", tenant_id)
        .maybe_single()
        .execute()
    )
    if result is None or not result.data:
        return None
    return result.data


def _tenant_by_subscription_id(subscription_id: str) -> dict | None:
    if not subscription_id:
        return None
    result = (
        _supa()
        .table("tenants")
        .select("id, plan, billing_details")
        .eq("razorpay_subscription_id", subscription_id)
        .maybe_single()
        .execute()
    )
    if result is None or not result.data:
        return None
    return result.data


def _tenant_from_subscription(sub: dict[str, Any]) -> dict | None:
    notes = sub.get("notes") or {}
    tenant_id = notes.get("tenant_id")
    if tenant_id:
        tenant = _tenant_by_id(str(tenant_id))
        if tenant:
            return tenant
    tenant = _tenant_by_customer(sub.get("customer_id", ""))
    if tenant:
        return tenant
    return _tenant_by_subscription_id(sub.get("id", ""))


def _admin_email(tenant_id: str) -> str | None:
    profiles = (
        _supa()
        .table("profiles")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("role", "admin")
        .limit(1)
        .execute()
    )
    if not profiles.data:
        return None
    user_id = profiles.data[0]["id"]
    try:
        user = _supa().auth.admin.get_user_by_id(user_id)
        return user.user.email if user and user.user else None
    except Exception:
        return None


def _admin_phone(tenant_id: str) -> str | None:
    profiles = (
        _supa()
        .table("profiles")
        .select("phone_number")
        .eq("tenant_id", tenant_id)
        .eq("role", "admin")
        .limit(1)
        .execute()
    )
    if not profiles.data:
        return None
    phone = profiles.data[0].get("phone_number")
    return str(phone).strip() if phone else None


def _send_dunning_day0_whatsapp(tenant_id: str) -> bool:
    """Day 0 payment-failure WhatsApp — gated until BSP templates are approved."""
    import asyncio

    from app.infra.notifications.whatsapp import send_whatsapp_template

    phone = _admin_phone(tenant_id)
    if not phone:
        return False
    try:
        return asyncio.run(
            send_whatsapp_template(
                to_phone=phone,
                template_name="payment_failed",
                variables=["AKARA"],
                tenant_id=tenant_id,
            )
        )
    except Exception as exc:
        logger.warning("Dunning Day 0 WhatsApp skipped for %s: %s", tenant_id, exc)
        return False


def _plan_from_subscription(sub: dict[str, Any], fallback: str = "pro") -> str:
    return resolve_plan_from_subscription(sub, fallback)


def handle_subscription_activated(sub: dict[str, Any]) -> bool:
    tenant = _tenant_from_subscription(sub)
    if not tenant:
        logger.warning(
            "Razorpay subscription activated: tenant not found (sub=%s customer=%s)",
            sub.get("id"),
            sub.get("customer_id"),
        )
        return False

    plan = _plan_from_subscription(sub, tenant.get("plan", "pro"))

    _supa().table("tenants").update({
        "plan": plan,
        "plan_status": "active",
        "razorpay_customer_id": sub.get("customer_id"),
        "razorpay_subscription_id": sub.get("id"),
        "past_due_since": None,
    }).eq("id", tenant["id"]).execute()
    logger.info("Upgraded tenant %s to plan=%s via subscription.activated", tenant["id"], plan)
    return True


def handle_subscription_halted_or_pending(sub: dict[str, Any]) -> bool:
    tenant = _tenant_from_subscription(sub)
    if not tenant:
        logger.warning(
            "Razorpay subscription halted/pending: tenant not found (sub=%s customer=%s)",
            sub.get("id"),
            sub.get("customer_id"),
        )
        return False

    now = datetime.now(UTC).isoformat()
    _supa().table("tenants").update({
        "plan_status": "past_due",
        "past_due_since": now,
    }).eq("id", tenant["id"]).execute()

    email = _admin_email(tenant["id"])
    if email:
        send_payment_failed_email(email)

    if not _dunning_sent(tenant["id"], 0):
        _supa().table("dunning_events").insert({
            "tenant_id": tenant["id"],
            "day_offset": 0,
            "channel": "email",
            "status": "sent",
            "sent_at": now,
        }).execute()
        if _send_dunning_day0_whatsapp(tenant["id"]):
            _supa().table("dunning_events").insert({
                "tenant_id": tenant["id"],
                "day_offset": 0,
                "channel": "whatsapp",
                "status": "sent",
                "sent_at": now,
            }).execute()
    return True


def handle_subscription_cancelled(sub: dict[str, Any]) -> bool:
    tenant = _tenant_from_subscription(sub)
    if not tenant:
        logger.warning(
            "Razorpay subscription cancelled: tenant not found (sub=%s customer=%s)",
            sub.get("id"),
            sub.get("customer_id"),
        )
        return False

    apply_plan_downgrade(
        tenant["id"],
        "free",
        revoke_sessions=False,
        reason="subscription_cancelled",
    )
    _supa().table("tenants").update({
        "trial_ends_at": (datetime.now(UTC) + timedelta(days=GRACE_DAYS)).isoformat(),
    }).eq("id", tenant["id"]).execute()
    return True


def handle_payment_refunded(payment: dict[str, Any]) -> bool:
    tenant = None
    if payment.get("customer_id"):
        tenant = _tenant_by_customer(payment["customer_id"])
    if not tenant and payment.get("subscription_id"):
        tenant = _tenant_by_subscription_id(payment["subscription_id"])
    if not tenant:
        logger.warning(
            "Razorpay payment refunded: tenant not found (payment=%s)",
            payment.get("id"),
        )
        return False

    apply_plan_downgrade(
        tenant["id"],
        "free",
        revoke_sessions=False,
        reason="payment_refunded",
    )
    logger.info("Downgraded tenant %s after refund webhook", tenant["id"])
    return True


def _dunning_sent(tenant_id: str, day_offset: int) -> bool:
    result = (
        _supa()
        .table("dunning_events")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("day_offset", day_offset)
        .eq("channel", "email")
        .limit(1)
        .execute()
    )
    return bool(result.data)


def handle_payment_succeeded(payment: dict[str, Any], subscription: dict[str, Any] | None) -> bool:
    tenant = None
    if subscription:
        tenant = _tenant_from_subscription(subscription)
    if not tenant and payment.get("customer_id"):
        tenant = _tenant_by_customer(payment["customer_id"])
    if not tenant and payment.get("subscription_id"):
        tenant = _tenant_by_subscription_id(payment["subscription_id"])
    if not tenant:
        logger.warning(
            "Razorpay payment succeeded: tenant not found (payment=%s customer=%s sub=%s)",
            payment.get("id"),
            payment.get("customer_id"),
            payment.get("subscription_id"),
        )
        return False

    if subscription:
        plan = _plan_from_subscription(subscription, tenant.get("plan", "pro"))
    else:
        plan = resolve_plan_from_subscription(
            {"notes": payment.get("notes") or {}},
            tenant.get("plan", "pro"),
        )

    _supa().table("tenants").update({
        "plan": plan,
        "plan_status": "active",
        "past_due_since": None,
        "razorpay_subscription_id": (subscription or {}).get("id") or payment.get("subscription_id"),
    }).eq("id", tenant["id"]).execute()
    logger.info("Upgraded tenant %s to plan=%s via payment webhook", tenant["id"], plan)

    payment_id = payment.get("id")
    if not payment_id:
        return True

    existing = (
        _supa()
        .table("invoices")
        .select("id")
        .eq("provider_payment_id", payment_id)
        .maybe_single()
        .execute()
    )
    if existing is None or not existing.data:
        return True

    amount = payment.get("amount") or payment.get("base_amount") or 0
    record = generate_and_store_invoice(
        tenant_id=UUID(tenant["id"]),
        provider_payment_id=payment_id,
        provider_order_id=payment.get("order_id"),
        total_paise=int(amount),
        plan=plan,
    )

    email = _admin_email(tenant["id"])
    if email:
        send_payment_success_email(
            email,
            record.get("invoice_number", "INV"),
            plan,
            pdf_bytes=record.get("pdf_bytes"),
        )
        if record.get("id"):
            _supa().table("invoices").update({
                "emailed_at": datetime.now(UTC).isoformat(),
            }).eq("id", record["id"]).execute()
    return True


def _extract_entity(payload: dict[str, Any], key: str) -> dict[str, Any]:
    block = payload.get(key) or {}
    if isinstance(block, dict) and "entity" in block:
        return block["entity"] or {}
    return block if isinstance(block, dict) else {}


def dispatch_razorpay_event(body: dict[str, Any], event_id: str) -> None:
    event_type = body.get("event", "unknown")
    payload = body.get("payload") or {}
    payload_hash = hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()

    if _already_processed(event_id):
        logger.info("Skipping duplicate Razorpay webhook %s", event_id)
        return

    subscription = _extract_entity(payload, "subscription")
    payment = _extract_entity(payload, "payment")
    refund = _extract_entity(payload, "refund")
    handled = True

    try:
        if event_type in ("subscription.authenticated", "subscription.activated", "subscription.resumed"):
            if subscription:
                handled = handle_subscription_activated(subscription)
            else:
                handled = False
        elif event_type in ("subscription.halted", "subscription.pending"):
            if subscription:
                handled = handle_subscription_halted_or_pending(subscription)
            else:
                handled = False
        elif event_type in ("subscription.cancelled", "subscription.completed"):
            if subscription:
                handled = handle_subscription_cancelled(subscription)
            else:
                handled = False
        elif event_type in ("subscription.charged", "payment.captured"):
            if payment:
                handled = handle_payment_succeeded(payment, subscription or None)
            else:
                handled = False
        elif event_type == "payment.failed":
            if subscription:
                handled = handle_subscription_halted_or_pending(subscription)
            elif payment.get("customer_id"):
                tenant = _tenant_by_customer(payment["customer_id"])
                if tenant:
                    handled = handle_subscription_halted_or_pending({
                        "customer_id": payment["customer_id"],
                        "notes": {},
                    })
                else:
                    handled = False
            else:
                handled = False
        elif event_type in ("payment.refunded", "refund.processed", "refund.created"):
            refund_payment = payment or refund
            if refund_payment:
                handled = handle_payment_refunded(refund_payment)
            else:
                handled = False

        if handled:
            _mark_processed(event_id, event_type, payload_hash)
        else:
            logger.warning(
                "Razorpay webhook %s (%s) not marked processed — handler could not apply",
                event_id,
                event_type,
            )
    except Exception as exc:
        logger.exception("Razorpay webhook handler failed for %s: %s", event_id, exc)
        _mark_processed(event_id, event_type, payload_hash, error=str(exc))
        raise


def verify_webhook_signature(payload: bytes, signature: str | None) -> None:
    if not settings.razorpay_webhook_secret:
        raise ValueError("Webhook secret not configured")
    if not signature:
        raise ValueError("Missing X-Razorpay-Signature header")

    client = razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))
    try:
        client.utility.verify_webhook_signature(
            payload.decode("utf-8"),
            signature,
            settings.razorpay_webhook_secret,
        )
    except razorpay.errors.SignatureVerificationError as exc:
        raise ValueError("Invalid webhook signature") from exc
