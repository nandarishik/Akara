"""User activation funnel events."""

from __future__ import annotations

import logging
from uuid import UUID

from app.core.tenant import get_supabase_service_client

logger = logging.getLogger(__name__)

VALID_EVENTS = frozenset({
    "signed_up",
    "onboarded",
    "first_import",
    "first_copilot",
    "first_debrief",
})


def record_user_event(user_id: UUID, event: str) -> None:
    if event not in VALID_EVENTS:
        return
    try:
        get_supabase_service_client().table("user_events").upsert(
            {"user_id": str(user_id), "event": event},
            on_conflict="user_id,event",
        ).execute()
    except Exception as exc:
        logger.warning("Could not record user_event %s: %s", event, exc)


def has_user_event(user_id: UUID, event: str) -> bool:
    try:
        res = (
            get_supabase_service_client()
            .table("user_events")
            .select("event")
            .eq("user_id", str(user_id))
            .eq("event", event)
            .maybe_single()
            .execute()
        )
        return bool(res.data)
    except Exception:
        return False
