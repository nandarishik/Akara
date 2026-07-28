"""Optional healthchecks.io ping after cron tasks complete."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def record_cron_run(
    task_name: str,
    status: str = "ok",
    details: dict[str, Any] | None = None,
    started_at: datetime | None = None,
) -> None:
    """Persist a cron_runs row when a scheduled task completes."""
    finished_at = datetime.now(UTC)
    started = started_at or finished_at
    if started.tzinfo is None:
        started = started.replace(tzinfo=UTC)

    try:
        from app.core.tenant import get_supabase_service_client

        get_supabase_service_client().table("cron_runs").insert({
            "task_name": task_name,
            "status": status,
            "details": details or {},
            "started_at": started.isoformat(),
            "finished_at": finished_at.isoformat(),
        }).execute()
    except Exception as exc:
        logger.warning("Could not record cron_run for %s: %s", task_name, exc)


def ping_cron_health(job: str, status: str = "ok", details: dict[str, Any] | None = None) -> None:
    """Ping HEALTHCHECKS_PING_URL/{job} if configured. Failures are logged only."""
    record_cron_run(job, status=status, details=details)
    base = (settings.healthchecks_ping_url or "").rstrip("/")
    if not base:
        return
    url = f"{base}/{job}" if not base.endswith(job) else base
    if status == "partial":
        url = f"{url}/fail"
    try:
        httpx.get(url, timeout=10.0).raise_for_status()
    except Exception as exc:
        logger.warning("Cron health ping failed for %s: %s", job, exc)
