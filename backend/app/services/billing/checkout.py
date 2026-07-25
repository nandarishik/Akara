"""Razorpay Subscriptions checkout and subscription management."""

from __future__ import annotations

import logging
import time
from typing import TypedDict
from uuid import UUID

import razorpay
from fastapi import HTTPException, status

from app.core.config import settings
from app.core.tenant import get_supabase_service_client

logger = logging.getLogger(__name__)

PLAN_ID_MAP: dict[str, dict[str, str]] = {
    "pro": {
        "month": "razorpay_pro_monthly_plan_id",
        "year": "razorpay_pro_annual_plan_id",
    },
    "business": {
        "month": "razorpay_business_monthly_plan_id",
        "year": "razorpay_business_annual_plan_id",
    },
}

# Billing cycles per subscription (Razorpay total_count)
TOTAL_COUNT: dict[str, int] = {"month": 120, "year": 10}

# Authorisation link validity (Razorpay expire_by)
CHECKOUT_EXPIRE_SECONDS = 30 * 24 * 60 * 60

PENDING_SUB_STATUSES = frozenset({"created", "authenticated"})
ACTIVE_SUB_STATUSES = frozenset({"active", "authenticated"})
VALID_PLANS = frozenset({"pro", "business"})


class CheckoutResult(TypedDict):
    checkout_url: str
    subscription_id: str
    razorpay_key_id: str


def _client() -> razorpay.Client:
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment provider is not configured. Please contact support.",
        )
    return razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))


def _resolve_plan_id(plan: str, interval: str) -> str:
    plan = plan.lower()
    interval = interval.lower()
    if plan not in PLAN_ID_MAP:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"Invalid plan: {plan}")
    if interval not in ("month", "year"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="interval must be month or year")

    attr = PLAN_ID_MAP[plan][interval]
    plan_id = getattr(settings, attr, "")
    if not plan_id:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Plan not configured for {plan} ({interval})",
        )
    return plan_id


def _get_or_create_razorpay_customer(tenant_id: UUID, email: str, name: str | None = None) -> str:
    supa = get_supabase_service_client()
    tenant = (
        supa.table("tenants")
        .select("razorpay_customer_id, name")
        .eq("id", str(tenant_id))
        .single()
        .execute()
    )
    data = tenant.data or {}
    if data.get("razorpay_customer_id"):
        return data["razorpay_customer_id"]

    client = _client()
    customer = client.customer.create({
        "name": name or data.get("name") or email.split("@")[0],
        "email": email,
        "notes": {"tenant_id": str(tenant_id)},
    })
    customer_id = customer["id"]
    supa.table("tenants").update({
        "razorpay_customer_id": customer_id,
    }).eq("id", str(tenant_id)).execute()
    return customer_id


def _cancel_stale_subscription(client: razorpay.Client, sub_id: str) -> None:
    try:
        sub = client.subscription.fetch(sub_id)
        if sub.get("status") in PENDING_SUB_STATUSES:
            client.subscription.cancel(sub_id)
    except Exception as exc:
        logger.warning("Could not cancel stale subscription %s: %s", sub_id, exc)


def resolve_plan_from_subscription(sub: dict, fallback: str = "pro") -> str:
    """Map Razorpay subscription notes or plan_id to internal plan name."""
    notes = sub.get("notes") or {}
    note_plan = notes.get("plan")
    if note_plan in VALID_PLANS:
        return note_plan

    plan_id = sub.get("plan_id")
    if plan_id:
        for plan_name, intervals in PLAN_ID_MAP.items():
            for interval in ("month", "year"):
                attr = intervals[interval]
                if getattr(settings, attr, "") == plan_id:
                    return plan_name

    if fallback in VALID_PLANS:
        return fallback
    return "pro"


def _checkout_url_from_subscription(subscription: dict) -> str | None:
    short_url = subscription.get("short_url")
    if short_url:
        return short_url
    sub_id = subscription.get("id")
    if sub_id:
        return f"https://api.razorpay.com/v1/l/subscriptions/{sub_id}"
    return None


def create_checkout_session(
    tenant_id: UUID,
    user_email: str,
    plan: str,
    interval: str = "month",
) -> CheckoutResult:
    supa = get_supabase_service_client()
    tenant_row = (
        supa.table("tenants")
        .select("plan, plan_status, razorpay_subscription_id, name")
        .eq("id", str(tenant_id))
        .single()
        .execute()
    )
    data = tenant_row.data or {}
    current_plan = data.get("plan", "free")
    sub_id = data.get("razorpay_subscription_id")
    plan_status = data.get("plan_status", "active")

    if (
        current_plan in ("pro", "business")
        and sub_id
        and plan_status in ("active", "trialing", "past_due")
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="You already have an active subscription. Manage it from Billing.",
        )

    plan_id = _resolve_plan_id(plan, interval)
    customer_id = _get_or_create_razorpay_customer(
        tenant_id, user_email, name=data.get("name")
    )
    client = _client()

    if sub_id and current_plan == "free":
        _cancel_stale_subscription(client, sub_id)

    now = int(time.time())
    subscription = client.subscription.create({
        "plan_id": plan_id,
        "customer_id": customer_id,
        "total_count": TOTAL_COUNT.get(interval, 120),
        "quantity": 1,
        "customer_notify": 1,
        "expire_by": now + CHECKOUT_EXPIRE_SECONDS,
        "notes": {
            "tenant_id": str(tenant_id),
            "plan": plan,
            "interval": interval,
        },
    })

    sub_id = subscription.get("id")
    checkout_url = _checkout_url_from_subscription(subscription)
    if not checkout_url or not sub_id:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail="Razorpay did not return a checkout URL",
        )

    supa.table("tenants").update({
        "razorpay_subscription_id": sub_id,
    }).eq("id", str(tenant_id)).execute()

    return CheckoutResult(
        checkout_url=checkout_url,
        subscription_id=sub_id,
        razorpay_key_id=settings.razorpay_key_id,
    )


def fetch_subscription_status(tenant_id: UUID) -> dict:
    supa = get_supabase_service_client()
    tenant = (
        supa.table("tenants")
        .select("razorpay_subscription_id, razorpay_customer_id, plan, plan_status, trial_ends_at")
        .eq("id", str(tenant_id))
        .single()
        .execute()
    )
    data = tenant.data or {}
    sub_id = data.get("razorpay_subscription_id")
    db_plan = data.get("plan", "free")
    result = {
        "has_subscription": bool(sub_id),
        "plan": db_plan,
        "plan_status": data.get("plan_status", "active"),
        "razorpay_status": None,
        "razorpay_plan": None,
        "current_end": None,
        "cancel_at_cycle_end": False,
        "trial_ends_at": data.get("trial_ends_at"),
        "synced": False,
    }
    if not sub_id:
        return result

    try:
        sub = _client().subscription.fetch(sub_id)
        rz_status = sub.get("status")
        rz_plan = resolve_plan_from_subscription(sub, db_plan if db_plan in VALID_PLANS else "pro")
        result["razorpay_status"] = rz_status
        result["razorpay_plan"] = rz_plan
        result["current_end"] = sub.get("current_end")
        result["cancel_at_cycle_end"] = bool(
            sub.get("remaining_count") == 0 and rz_status == "active"
        )
    except Exception as exc:
        logger.warning("Could not fetch Razorpay subscription %s: %s", sub_id, exc)

    return result


def sync_subscription_from_razorpay(tenant_id: UUID) -> dict:
    """Pull active Razorpay subscription and upgrade tenant plan if payment landed."""
    supa = get_supabase_service_client()
    tenant = (
        supa.table("tenants")
        .select("razorpay_subscription_id, plan, plan_status")
        .eq("id", str(tenant_id))
        .single()
        .execute()
    )
    data = tenant.data or {}
    sub_id = data.get("razorpay_subscription_id")
    result = fetch_subscription_status(tenant_id)

    if not sub_id:
        result["synced"] = False
        result["reason"] = "no_subscription"
        return result

    rz_status = result.get("razorpay_status")
    rz_plan = result.get("razorpay_plan")
    if rz_status not in ACTIVE_SUB_STATUSES:
        result["synced"] = False
        result["reason"] = f"subscription_{rz_status or 'unknown'}"
        return result

    if not rz_plan or rz_plan not in VALID_PLANS:
        result["synced"] = False
        result["reason"] = "plan_unknown"
        return result

    db_plan = data.get("plan", "free")
    db_status = data.get("plan_status", "active")
    needs_update = db_plan == "free" or db_plan != rz_plan or db_status != "active"

    if not needs_update:
        result["synced"] = False
        result["reason"] = "already_synced"
        return result

    try:
        sub = _client().subscription.fetch(sub_id)
    except Exception as exc:
        logger.warning("Could not fetch Razorpay subscription %s during sync: %s", sub_id, exc)
        result["synced"] = False
        result["reason"] = "fetch_failed"
        return result

    supa.table("tenants").update({
        "plan": rz_plan,
        "plan_status": "active",
        "past_due_since": None,
        "razorpay_customer_id": sub.get("customer_id"),
        "razorpay_subscription_id": sub.get("id"),
    }).eq("id", str(tenant_id)).execute()

    result["plan"] = rz_plan
    result["plan_status"] = "active"
    result["synced"] = True
    result["reason"] = None
    logger.info("Synced tenant %s to plan=%s from Razorpay sub=%s", tenant_id, rz_plan, sub_id)
    return result


def cancel_subscription(tenant_id: UUID, at_cycle_end: bool = True) -> dict:
    supa = get_supabase_service_client()
    tenant = (
        supa.table("tenants")
        .select("razorpay_subscription_id, plan_status")
        .eq("id", str(tenant_id))
        .single()
        .execute()
    )
    sub_id = (tenant.data or {}).get("razorpay_subscription_id")
    if not sub_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="No active subscription found.",
        )

    client = _client()
    if at_cycle_end:
        client.subscription.cancel(sub_id, {"cancel_at_cycle_end": 1})
    else:
        client.subscription.cancel(sub_id)

    return {"status": "cancelled", "at_cycle_end": at_cycle_end, "subscription_id": sub_id}
