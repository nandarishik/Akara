"""CMS content, media, and placement slot services."""

from __future__ import annotations

import logging
import re
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from app.core.config import settings
from app.core.errors import AkaraHTTPException
from app.core.tenant import get_supabase_service_client

logger = logging.getLogger(__name__)

_UNSAFE_HTML = re.compile(r"<script|javascript:|on\w+\s*=", re.IGNORECASE)
_URL_RE = re.compile(r"https?://[^\s\"'<>]+")


def list_content_entries() -> list[dict[str, Any]]:
    supa = get_supabase_service_client()
    result = supa.table("content_entries").select("*").order("key").execute()
    return result.data or []


def get_content_entry(key: str, locale: str = "en-IN") -> dict[str, Any] | None:
    supa = get_supabase_service_client()
    row = (
        supa.table("content_entries")
        .select("*")
        .eq("key", key)
        .eq("locale", locale)
        .maybe_single()
        .execute()
    )
    return row.data


def upsert_content_draft(
    key: str,
    value: dict[str, Any],
    *,
    locale: str = "en-IN",
    updated_by: UUID | None = None,
) -> dict[str, Any]:
    supa = get_supabase_service_client()
    existing = get_content_entry(key, locale)
    payload = {
        "key": key,
        "locale": locale,
        "draft_value": value,
        "updated_by": str(updated_by) if updated_by else None,
        "updated_at": datetime.now(UTC).isoformat(),
        "version": int((existing or {}).get("version") or 1) + (1 if existing else 0),
    }
    supa.table("content_entries").upsert(payload, on_conflict="key,locale").execute()
    return payload


def validate_content(value: dict[str, Any]) -> list[str]:
    warnings: list[str] = []
    text = str(value)
    if _UNSAFE_HTML.search(text):
        warnings.append("Unsafe HTML detected")
    for url in _URL_RE.findall(text):
        if url.endswith(".local") or "localhost" in url:
            warnings.append(f"Broken or local link: {url}")
    if "alt" in value and not value.get("alt"):
        warnings.append("Missing alt text on image reference")
    return warnings


def publish_content(key: str, locale: str = "en-IN", *, force: bool = False) -> dict[str, Any]:
    entry = get_content_entry(key, locale)
    if not entry:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Content entry not found")

    now = datetime.now(UTC)
    scheduled_at = entry.get("scheduled_at")
    if scheduled_at and not force:
        sched = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
        if sched > now:
            return {"key": key, "locale": locale, "deferred": True, "scheduled_at": scheduled_at}

    warnings = validate_content(entry.get("draft_value") or {})
    if any("Unsafe" in w for w in warnings):
        raise AkaraHTTPException(status_code=400, code="VALIDATION_ERROR", message="Unsafe content blocked", detail={"warnings": warnings})

    supa = get_supabase_service_client()
    now_iso = now.isoformat()
    update = {
        "published_value": entry["draft_value"],
        "published_at": now_iso,
        "scheduled_at": None,
        "version": int(entry.get("version") or 1) + 1,
    }
    supa.table("content_entries").update(update).eq("key", key).eq("locale", locale).execute()
    return {"key": key, "locale": locale, "published_at": now_iso, "warnings": warnings}


def schedule_content(key: str, scheduled_at: str, locale: str = "en-IN") -> dict[str, Any]:
    entry = get_content_entry(key, locale)
    if not entry:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Content entry not found")
    supa = get_supabase_service_client()
    supa.table("content_entries").update({"scheduled_at": scheduled_at}).eq("key", key).eq("locale", locale).execute()
    return {"key": key, "locale": locale, "scheduled_at": scheduled_at}


def preview_content(key: str, locale: str = "en-IN") -> dict[str, Any]:
    entry = get_content_entry(key, locale)
    if not entry:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Content entry not found")
    value = entry.get("draft_value") or {}
    return {"key": key, "locale": locale, "value": value, "warnings": validate_content(value)}


def publish_due_scheduled_content() -> dict[str, int]:
    """Publish content entries whose scheduled_at has passed."""
    supa = get_supabase_service_client()
    now = datetime.now(UTC).isoformat()
    due = (
        supa.table("content_entries")
        .select("key, locale")
        .not_.is_("scheduled_at", "null")
        .lte("scheduled_at", now)
        .execute()
    )
    published = 0
    for row in due.data or []:
        try:
            publish_content(row["key"], row.get("locale") or "en-IN", force=True)
            published += 1
        except Exception as exc:
            logger.warning("Scheduled content publish failed for %s: %s", row.get("key"), exc)
    return {"published": published, "due_count": len(due.data or [])}


def record_placement_event(
    slot_key: str,
    event_type: str,
    *,
    user_id: UUID | None = None,
    tenant_id: UUID | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if event_type not in ("impression", "click"):
        raise AkaraHTTPException(status_code=400, code="VALIDATION_ERROR", message="Invalid event_type")
    supa = get_supabase_service_client()
    payload = {
        "slot_key": slot_key,
        "event_type": event_type,
        "user_id": str(user_id) if user_id else None,
        "tenant_id": str(tenant_id) if tenant_id else None,
        "metadata": metadata or {},
    }
    result = supa.table("placement_events").insert(payload).execute()
    return (result.data or [payload])[0]


def placement_stats(*, days: int = 30) -> list[dict[str, Any]]:
    supa = get_supabase_service_client()
    since = (datetime.now(UTC) - timedelta(days=days)).isoformat()
    try:
        rows = (
            supa.table("placement_events")
            .select("slot_key, event_type")
            .gte("created_at", since)
            .execute()
        )
    except Exception as exc:
        logger.warning("placement_events unavailable: %s", exc)
        return []

    counts: dict[str, dict[str, int]] = {}
    for row in rows.data or []:
        key = row["slot_key"]
        counts.setdefault(key, {"impressions": 0, "clicks": 0})
        if row["event_type"] == "impression":
            counts[key]["impressions"] += 1
        else:
            counts[key]["clicks"] += 1
    return [{"slot_key": k, **v} for k, v in sorted(counts.items())]


def rollback_content(key: str, locale: str = "en-IN") -> dict[str, Any]:
    entry = get_content_entry(key, locale)
    if not entry or not entry.get("published_value"):
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Nothing to rollback")
    supa = get_supabase_service_client()
    supa.table("content_entries").update({"draft_value": entry["published_value"]}).eq("key", key).eq("locale", locale).execute()
    return {"key": key, "rolled_back": True}


def list_placements() -> list[dict[str, Any]]:
    supa = get_supabase_service_client()
    result = supa.table("placement_slots").select("*").order("key").execute()
    return result.data or []


def upsert_placement(
    key: str,
    content: dict[str, Any],
    kind: str = "promotion",
    *,
    starts_at: str | None = None,
    ends_at: str | None = None,
    audience_rules: dict[str, Any] | None = None,
) -> dict[str, Any]:
    supa = get_supabase_service_client()
    payload: dict[str, Any] = {
        "key": key,
        "kind": kind,
        "draft_content": content,
        "updated_at": datetime.now(UTC).isoformat(),
    }
    if starts_at is not None:
        payload["starts_at"] = starts_at
    if ends_at is not None:
        payload["ends_at"] = ends_at
    if audience_rules is not None:
        payload["audience_rules"] = audience_rules
    supa.table("placement_slots").upsert(payload, on_conflict="key").execute()
    return payload


def publish_placement(key: str) -> dict[str, Any]:
    supa = get_supabase_service_client()
    row = supa.table("placement_slots").select("*").eq("key", key).maybe_single().execute()
    if not row.data:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Placement not found")
    warnings = validate_content(row.data.get("draft_content") or {})
    now = datetime.now(UTC).isoformat()
    supa.table("placement_slots").update({
        "published_content": row.data["draft_content"],
        "published_at": now,
        "is_active": True,
        "version": int(row.data.get("version") or 1) + 1,
    }).eq("key", key).execute()
    return {"key": key, "published_at": now, "warnings": warnings}


def _matches_audience(rules: dict[str, Any] | None, *, plan: str | None, page: str | None) -> bool:
    if not rules:
        return True
    plans = rules.get("plans")
    if plans and plan and plan not in plans:
        return False
    if plans and not plan:
        return False
    pages = rules.get("pages")
    if pages and page:
        if not any(page.startswith(str(p)) for p in pages):
            return False
    elif pages and not page:
        return False
    return True


def get_active_placements(*, plan: str | None = None, page: str | None = None) -> list[dict[str, Any]]:
    supa = get_supabase_service_client()
    now = datetime.now(UTC).isoformat()
    try:
        result = (
            supa.table("placement_slots")
            .select("key, kind, published_content, audience_rules, starts_at, ends_at")
            .eq("is_active", True)
            .execute()
        )
        items = []
        for row in result.data or []:
            if row.get("starts_at") and row["starts_at"] > now:
                continue
            if row.get("ends_at") and row["ends_at"] < now:
                continue
            if not _matches_audience(row.get("audience_rules"), plan=plan, page=page):
                continue
            if row.get("published_content"):
                items.append({
                    "key": row["key"],
                    "kind": row["kind"],
                    "published_content": row["published_content"],
                    "audience_rules": row.get("audience_rules") or {},
                })
        return items
    except Exception as exc:
        logger.warning("placement_slots unavailable: %s", exc)
        return []


def list_media() -> list[dict[str, Any]]:
    supa = get_supabase_service_client()
    result = supa.table("media_assets").select("*").order("created_at", desc=True).execute()
    return result.data or []


def create_media_asset(
    *,
    storage_path: str,
    public_url: str,
    kind: str,
    alt_text: str,
    created_by: UUID | None = None,
    **extra: Any,
) -> dict[str, Any]:
    if not alt_text.strip():
        raise AkaraHTTPException(status_code=400, code="VALIDATION_ERROR", message="alt_text is required")
    supa = get_supabase_service_client()
    payload = {
        "storage_path": storage_path,
        "public_url": public_url,
        "kind": kind,
        "alt_text": alt_text,
        "created_by": str(created_by) if created_by else None,
        **{k: v for k, v in extra.items() if k in ("width", "height", "bytes", "mime_type")},
    }
    result = supa.table("media_assets").insert(payload).execute()
    return (result.data or [{}])[0]


def delete_media_asset(asset_id: str) -> dict[str, Any]:
    supa = get_supabase_service_client()
    row = supa.table("media_assets").select("*").eq("id", asset_id).maybe_single().execute()
    if not row.data:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Media asset not found")
    storage_path = row.data.get("storage_path")
    if storage_path:
        try:
            supa.storage.from_(settings.supabase_imports_bucket).remove([storage_path])
        except Exception as exc:
            logger.warning("storage remove failed for %s: %s", storage_path, exc)
    supa.table("media_assets").delete().eq("id", asset_id).execute()
    return {"id": asset_id, "deleted": True}
