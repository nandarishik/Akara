"""Dedup: same tenant + type + primary_item_id within 30d → supersede older open."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any


def should_supersede(
    existing: dict[str, Any],
    incoming_type: str,
    incoming_item: str | None,
    *,
    now: datetime,
    window_days: int = 30,
) -> bool:
    if existing.get("status") != "open":
        return False
    if existing.get("recommendation_type") != incoming_type:
        return False
    if (existing.get("primary_item_id") or "") != (incoming_item or ""):
        return False
    created = existing.get("created_at")
    if isinstance(created, str):
        created = datetime.fromisoformat(created.replace("Z", "+00:00"))
    if created is None:
        return True
    if created.tzinfo and now.tzinfo is None:
        now = now.replace(tzinfo=created.tzinfo)
    return created >= now - timedelta(days=window_days)
