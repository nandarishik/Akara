"""Optional healthchecks.io ping after cron tasks complete."""

from __future__ import annotations

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def ping_cron_health(job: str) -> None:
    """Ping HEALTHCHECKS_PING_URL/{job} if configured. Failures are logged only."""
    base = (settings.healthchecks_ping_url or "").rstrip("/")
    if not base:
        return
    url = f"{base}/{job}" if not base.endswith(job) else base
    try:
        httpx.get(url, timeout=10.0).raise_for_status()
    except Exception as exc:
        logger.warning("Cron health ping failed for %s: %s", job, exc)
