"""Concurrent session tracking against active_sessions (Phase 4)."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger("akara.sessions")

_DEBOUNCE = timedelta(seconds=60)


def record_session(
    user_id: UUID,
    session_id: str,
    device_hint: str = "",
    ip_address: str | None = None,
) -> None:
    """Upsert the current jti; evict oldest sessions beyond max_concurrent_sessions.

    Missing table / columns are swallowed so DEV2 migration 032 can land later.
    """
    if not session_id:
        return
    from app.core.tenant import get_supabase_service_client

    try:
        supa = get_supabase_service_client()
        now = datetime.now(UTC)
        row = (
            supa.table("active_sessions")
            .select("*")
            .eq("user_id", str(user_id))
            .eq("session_id", session_id)
            .maybe_single()
            .execute()
        ).data
        if row and row.get("revoked_at"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session revoked",
                headers={"WWW-Authenticate": "Bearer"},
            )

        last_seen = None
        if row and row.get("last_seen_at"):
            try:
                last_seen = datetime.fromisoformat(
                    str(row["last_seen_at"]).replace("Z", "+00:00")
                )
            except ValueError:
                last_seen = None
        if row and last_seen and (now - last_seen) < _DEBOUNCE:
            return

        payload = {
            "user_id": str(user_id),
            "session_id": session_id,
            "device_hint": (device_hint or "")[:120],
            "last_seen_at": now.isoformat(),
            "revoked_at": None,
        }
        if ip_address:
            payload["ip_address"] = ip_address
        if row:
            supa.table("active_sessions").update(payload).eq("id", row["id"]).execute()
        else:
            payload["created_at"] = now.isoformat()
            supa.table("active_sessions").insert(payload).execute()

        active = (
            supa.table("active_sessions")
            .select("id, last_seen_at")
            .eq("user_id", str(user_id))
            .is_("revoked_at", "null")
            .order("last_seen_at")
            .execute()
        ).data or []
        overflow = len(active) - int(settings.max_concurrent_sessions)
        if overflow > 0:
            for old in active[:overflow]:
                supa.table("active_sessions").update(
                    {"revoked_at": now.isoformat()}
                ).eq("id", old["id"]).execute()
                try:
                    supa.auth.admin.sign_out(str(user_id))
                except Exception:
                    logger.debug("sign_out best-effort failed for %s", user_id)
    except HTTPException:
        raise
    except Exception as exc:
        logger.debug("session tracker skipped: %s", exc)
