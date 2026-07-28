"""Plan downgrade: seat reconciliation and optional session revocation."""

from __future__ import annotations

import logging
from uuid import UUID

from app.core.plan_limits import get_limit
from app.core.tenant import get_supabase_service_client

logger = logging.getLogger(__name__)


def apply_plan_downgrade(
    tenant_id: str | UUID,
    target_plan: str = "free",
    *,
    revoke_sessions: bool = False,
    reason: str = "billing_downgrade",
) -> dict:
    """Downgrade tenant plan and lock excess members beyond seat limit."""
    supa = get_supabase_service_client()
    tid = str(tenant_id)

    tenant = (
        supa.table("tenants")
        .select("id, plan, owner_user_id")
        .eq("id", tid)
        .maybe_single()
        .execute()
    )
    if not tenant.data:
        return {"status": "skipped", "reason": "tenant_not_found"}

    owner_id = tenant.data.get("owner_user_id")
    seat_limit = int(get_limit(target_plan, "users") or 1)

    members = (
        supa.table("profiles")
        .select("id, role, membership_status")
        .eq("tenant_id", tid)
        .in_("membership_status", ["active", "suspended"])
        .execute()
    )
    active = [m for m in (members.data or []) if m.get("membership_status") == "active"]

    keep_ids: set[str] = set()
    if owner_id:
        keep_ids.add(str(owner_id))
    for m in active:
        if len(keep_ids) >= seat_limit:
            break
        if m["id"] not in keep_ids:
            keep_ids.add(m["id"])

    locked: list[str] = []
    for m in active:
        mid = m["id"]
        if mid in keep_ids:
            continue
        supa.table("profiles").update({"membership_status": "seat_locked"}).eq("id", mid).execute()
        locked.append(mid)
        if revoke_sessions:
            try:
                supa.auth.admin.sign_out(mid)
            except Exception as exc:
                logger.warning("Could not revoke session for %s: %s", mid, exc)

    supa.table("tenants").update({
        "plan": target_plan,
        "plan_status": "cancelled",
        "razorpay_subscription_id": None,
    }).eq("id", tid).execute()

    try:
        supa.table("audit_log").insert({
            "tenant_id": tid,
            "action": "plan_downgrade",
            "resource_type": "tenant",
            "resource_id": tid,
            "details": {
                "target_plan": target_plan,
                "reason": reason,
                "seat_limit": seat_limit,
                "locked_member_ids": locked,
                "kept_member_ids": list(keep_ids),
            },
        }).execute()
    except Exception as exc:
        logger.debug("Audit log for downgrade skipped: %s", exc)

    return {
        "status": "ok",
        "target_plan": target_plan,
        "seat_limit": seat_limit,
        "locked_count": len(locked),
    }
