"""Daily dunning sequence — Day 0/3/7/14 (GAP 12)."""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime

from app.core.cron_ping import ping_cron_health
from app.core.tenant import get_supabase_service_client
from app.domain.billing.email import send_dunning_reminder_email, send_downgrade_email
from app.domain.billing.plan_downgrade import apply_plan_downgrade

logger = logging.getLogger(__name__)

DUNNING_DAYS = (3, 7, 14)


def _days_since(iso_ts: str) -> int:
    start = datetime.fromisoformat(iso_ts.replace("Z", "+00:00"))
    if start.tzinfo is None:
        start = start.replace(tzinfo=UTC)
    return (datetime.now(UTC) - start).days


def _admin_email(supa, tenant_id: str) -> str | None:
    profiles = (
        supa.table("profiles")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("role", "admin")
        .limit(1)
        .execute()
    )
    if not profiles.data:
        return None
    try:
        user = supa.auth.admin.get_user_by_id(profiles.data[0]["id"])
        return user.user.email if user and user.user else None
    except Exception:
        return None


def _dunning_already_sent(supa, tenant_id: str, day_offset: int) -> bool:
    result = (
        supa.table("dunning_events")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("day_offset", day_offset)
        .eq("channel", "email")
        .maybe_single()
        .execute()
    )
    return bool(result.data)


async def run_dunning_cycle() -> None:
    supa = get_supabase_service_client()
    tenants = (
        supa.table("tenants")
        .select("id, plan_status, past_due_since, plan")
        .eq("plan_status", "past_due")
        .execute()
    )

    for tenant in tenants.data or []:
        since = tenant.get("past_due_since")
        if not since:
            continue
        days = _days_since(since)
        email = _admin_email(supa, tenant["id"])
        if not email:
            continue

        for offset in DUNNING_DAYS:
            if days >= offset and not _dunning_already_sent(supa, tenant["id"], offset):
                ok = send_dunning_reminder_email(email, offset)
                supa.table("dunning_events").insert({
                    "tenant_id": tenant["id"],
                    "day_offset": offset,
                    "channel": "email",
                    "status": "sent" if ok else "failed",
                }).execute()

        if days >= 14 and tenant.get("plan") != "free":
            apply_plan_downgrade(tenant["id"], "free", reason="dunning_day_14")
            if not _dunning_already_sent(supa, tenant["id"], 14):
                send_downgrade_email(email)
                supa.table("dunning_events").insert({
                    "tenant_id": tenant["id"],
                    "day_offset": 14,
                    "channel": "email",
                    "status": "sent",
                }).execute()
            logger.info("Downgraded tenant %s after 14-day dunning", tenant["id"])


async def dunning_loop(interval_seconds: int = 86400) -> None:
    while True:
        try:
            await run_dunning_cycle()
        except Exception as exc:
            logger.exception("Dunning cycle failed: %s", exc)
        await asyncio.sleep(interval_seconds)


async def main() -> None:
    """Run one dunning cycle and exit (Railway cron: python -m app.workers.dunning)."""
    logger.info("Starting dunning cycle")
    try:
        await run_dunning_cycle()
        ping_cron_health("dunning")
    except Exception:
        logger.exception("Dunning cycle failed")
        raise
    finally:
        logger.info("Dunning cycle complete")


if __name__ == "__main__":
    asyncio.run(main())
