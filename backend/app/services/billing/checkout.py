"""Razorpay Subscriptions checkout and subscription management."""

from __future__ import annotations

import logging
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


def create_checkout_session(
    tenant_id: UUID,
    user_email: str,
    plan: str,
    interval: str = "month",
) -> str:
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

    subscription = client.subscription.create({
        "plan_id": plan_id,
        "customer_id": customer_id,
        "total_count": TOTAL_COUNT.get(interval, 120),
        "quantity": 1,
        "customer_notify": 1,
        "notes": {
            "tenant_id": str(tenant_id),
            "plan": plan,
            "interval": interval,
        },
    })

    checkout_url = subscription.get("short_url")
    if not checkout_url:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail="Razorpay did not return a checkout URL",
        )

    supa.table("tenants").update({
        "razorpay_subscription_id": subscription.get("id"),
    }).eq("id", str(tenant_id)).execute()

    return checkout_url


def fetch_subscription_status(tenant_id: UUID) -> dict:
    supa = get_supabase_service_client()
    tenant = (
        supa.table("tenants")
        .select("razorpay_subscription_id, plan, plan_status, trial_ends_at")
        .eq("id", str(tenant_id))
        .single()
        .execute()
    )
    data = tenant.data or {}
    sub_id = data.get("razorpay_subscription_id")
    result = {
        "has_subscription": bool(sub_id),
        "plan": data.get("plan", "free"),
        "plan_status": data.get("plan_status", "active"),
        "razorpay_status": None,
        "current_end": None,
        "cancel_at_cycle_end": False,
        "trial_ends_at": data.get("trial_ends_at"),
    }
    if not sub_id:
        return result

    try:
        sub = _client().subscription.fetch(sub_id)
        result["razorpay_status"] = sub.get("status")
        result["current_end"] = sub.get("current_end")
        result["cancel_at_cycle_end"] = bool(sub.get("remaining_count") == 0 and sub.get("status") == "active")
    except Exception as exc:
        logger.warning("Could not fetch Razorpay subscription %s: %s", sub_id, exc)

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
