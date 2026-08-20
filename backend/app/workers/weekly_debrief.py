"""Weekly debrief cron — Monday 01:30 UTC (07:00 IST)."""

from __future__ import annotations

import logging

from app.core.cron_ping import ping_cron_health
from app.domain.debrief.service import run_weekly_debrief_for_all_tenants

logger = logging.getLogger(__name__)


def run_weekly_debrief_cycle() -> dict[str, int]:
    stats = run_weekly_debrief_for_all_tenants()
    logger.info("Weekly debrief cron complete: %s", stats)
    status = "ok" if stats.get("errors", 0) == 0 else "partial"
    ping_cron_health("weekly_debrief", status=status)
    return stats


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(run_weekly_debrief_cycle())
