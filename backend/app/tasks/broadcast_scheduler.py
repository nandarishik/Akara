"""Process scheduled broadcast_history rows."""

from __future__ import annotations

import logging

from app.core.cron_ping import ping_cron_health
from app.services.superadmin.broadcast import process_scheduled_broadcasts

logger = logging.getLogger(__name__)


def run_broadcast_scheduler() -> dict:
    result = process_scheduled_broadcasts()
    logger.info(
        "Broadcast scheduler: processed=%s failed=%s due=%s",
        result["processed"],
        result["failed"],
        result["due_count"],
    )
    return {"ok": True, **result}


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    try:
        details = run_broadcast_scheduler()
        ping_cron_health("broadcast_scheduler", details=details)
    except Exception:
        logger.exception("Broadcast scheduler failed")
        ping_cron_health("broadcast_scheduler", status="failed")
        raise


if __name__ == "__main__":
    main()
