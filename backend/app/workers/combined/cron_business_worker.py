"""Always-on business cron — dunning, alerts, schedulers, retention, deletions."""

from __future__ import annotations

import asyncio
import logging
import sys
import time
from collections.abc import Callable
from typing import Any

import schedule

from app.core.config import settings
from app.core.cron_ping import ping_cron_health
from app.workers import (
    account_deletion_worker,
    account_export_worker,
    activation_emails,
    alert_evaluator,
    broadcast_scheduler,
    content_scheduler,
    dunning,
    retention_cleanup,
)

logger = logging.getLogger("akara.cron.business")

scheduler = schedule.Scheduler()
_registered = False


def _isolated(
    job_name: str,
    fn: Callable[[], Any],
    *,
    ping_success: str | None = None,
) -> Callable[[], None]:
    def _run() -> None:
        try:
            fn()
            if ping_success:
                ping_cron_health(ping_success, status="ok")
        except Exception:
            logger.exception("cron job failed job=%s", job_name)
            ping_cron_health(job_name, status="fail")

    _run.__name__ = job_name
    return _run


def job_retention() -> None:
    _isolated("retention_cleanup", lambda: retention_cleanup.run(dry_run=False))()


def job_dunning() -> None:
    _isolated(
        "dunning",
        lambda: asyncio.run(dunning.run_dunning_cycle()),
        ping_success="dunning",
    )()


def job_alerts() -> None:
    _isolated(
        "alerts",
        alert_evaluator.run_alert_evaluator_cycle,
        ping_success="alerts",
    )()


def job_content() -> None:
    _isolated(
        "content_scheduler",
        content_scheduler.run_content_scheduler,
        ping_success="content_scheduler",
    )()


def job_broadcast() -> None:
    _isolated(
        "broadcast_scheduler",
        broadcast_scheduler.run_broadcast_scheduler,
        ping_success="broadcast_scheduler",
    )()


def job_activation() -> None:
    _isolated("activation_emails", activation_emails.run_activation_emails)()


def job_deletion() -> None:
    _isolated(
        "account_deletion",
        account_deletion_worker.process_deletion_queue,
        ping_success="account_deletion",
    )()


def job_export() -> None:
    _isolated(
        "account_export",
        account_export_worker.run_export_cycle,
        ping_success="account_export",
    )()


def register_jobs() -> schedule.Scheduler:
    global _registered
    if _registered:
        return scheduler
    scheduler.every().day.at("03:00").do(job_retention)
    scheduler.every().day.at("04:00").do(job_dunning)
    scheduler.every().day.at("06:00").do(job_content)
    scheduler.every().day.at("06:30").do(job_broadcast)
    scheduler.every().day.at("08:00").do(job_activation)
    scheduler.every(5).minutes.do(job_deletion)
    scheduler.every(5).minutes.do(job_export)
    _registered = True
    return scheduler


register_jobs()


def main() -> None:
    if (
        settings.environment != "production"
        and "staging" not in (settings.sendgrid_from_email or "").lower()
    ):
        logger.error(
            "E-03: SENDGRID_FROM_EMAIL must contain 'staging' outside production"
        )
        sys.exit(1)
    register_jobs()
    logger.info("cron_business_worker started environment=%s", settings.environment)
    while True:
        scheduler.run_pending()
        time.sleep(60)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
