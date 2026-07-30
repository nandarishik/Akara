"""Broadcast delivery for superadmin comms."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.core.tenant import get_supabase_service_client

logger = logging.getLogger(__name__)


def _deliver_to_tenant(
    supa: Any,
    tenant: dict[str, Any],
    *,
    subject: str,
    body_html: str,
    body_whatsapp: str,
    channels: list[str],
) -> bool:
    profiles = (
        supa.table("profiles")
        .select("id")
        .eq("tenant_id", tenant["id"])
        .eq("role", "admin")
        .limit(1)
        .execute()
    )
    if not profiles.data:
        return False
    profile_id = profiles.data[0]["id"]
    try:
        user = supa.auth.admin.get_user_by_id(profile_id)
        email = user.user.email if user and user.user else None
    except Exception:
        email = None

    delivered = False
    if email and "email" in channels:
        try:
            from app.services.billing.email import _send

            if _send(email, subject, body_html):
                delivered = True
        except Exception as exc:
            logger.warning("Broadcast email failed for %s: %s", tenant["id"], exc)

    if "whatsapp" in channels and body_whatsapp.strip():
        try:
            from app.core.config import settings
            from app.services.notifications.whatsapp import send_whatsapp_template

            if settings.whatsapp_sends_enabled:
                phone_row = (
                    supa.table("profiles")
                    .select("phone")
                    .eq("id", profile_id)
                    .maybe_single()
                    .execute()
                )
                phone = (phone_row.data or {}).get("phone")
                if phone:
                    ok = asyncio.run(
                        send_whatsapp_template(
                            to_phone=phone,
                            template_name="broadcast_notice",
                            variables=[subject[:80], body_whatsapp[:200]],
                            tenant_id=tenant["id"],
                            user_id=profile_id,
                        )
                    )
                    if ok:
                        delivered = True
        except Exception as exc:
            logger.warning("Broadcast WhatsApp failed for %s: %s", tenant["id"], exc)

    return delivered


def execute_broadcast(
    *,
    subject: str,
    body_html: str,
    body_whatsapp: str = "",
    channels: list[str] | None = None,
    plan_filter: str | None = None,
    status_filter: str | None = None,
    actor_id: str | None = None,
    history_id: str | None = None,
) -> dict[str, Any]:
    """Send broadcast to matching tenants and update history row if provided."""
    channels = channels or ["email"]
    supa = get_supabase_service_client()
    query = supa.table("tenants").select("id, name, plan, plan_status")
    if plan_filter:
        query = query.eq("plan", plan_filter)
    if status_filter:
        query = query.eq("plan_status", status_filter)
    tenants = query.execute().data or []

    sent = 0
    for tenant in tenants:
        if _deliver_to_tenant(
            supa,
            tenant,
            subject=subject,
            body_html=body_html,
            body_whatsapp=body_whatsapp,
            channels=channels,
        ):
            sent += 1

    row = {
        "subject": subject,
        "channels": channels,
        "tenant_count": len(tenants),
        "sent_count": sent,
        "plan_filter": plan_filter,
        "status_filter": status_filter,
        "body_html": body_html,
        "whatsapp_body": body_whatsapp,
        "status": "sent",
    }
    if actor_id:
        row["actor_id"] = actor_id

    if history_id:
        supa.table("broadcast_history").update(row).eq("id", history_id).execute()
    else:
        try:
            supa.table("broadcast_history").insert(row).execute()
        except Exception as exc:
            logger.warning("Could not persist broadcast_history: %s", exc)

    return {"sent": sent, "tenant_count": len(tenants)}


def process_scheduled_broadcasts() -> dict[str, Any]:
    """Pick due scheduled broadcasts and send them."""
    from datetime import UTC, datetime

    supa = get_supabase_service_client()
    now = datetime.now(UTC).isoformat()
    due = (
        supa.table("broadcast_history")
        .select("*")
        .eq("status", "scheduled")
        .lte("scheduled_at", now)
        .order("scheduled_at")
        .limit(20)
        .execute()
    ).data or []

    processed = 0
    failed = 0
    for row in due:
        bid = row["id"]
        supa.table("broadcast_history").update({"status": "sending"}).eq("id", bid).execute()
        try:
            channels = row.get("channels") or ["email"]
            if isinstance(channels, str):
                channels = [channels]
            execute_broadcast(
                subject=row.get("subject") or "",
                body_html=row.get("body_html") or "",
                body_whatsapp=row.get("whatsapp_body") or "",
                channels=channels,
                plan_filter=row.get("plan_filter"),
                status_filter=row.get("status_filter"),
                history_id=bid,
            )
            processed += 1
        except Exception:
            logger.exception("Scheduled broadcast %s failed", bid)
            supa.table("broadcast_history").update({"status": "failed"}).eq("id", bid).execute()
            failed += 1

    return {"processed": processed, "failed": failed, "due_count": len(due)}
