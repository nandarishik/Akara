"""Always-on intelligence cron — weekly debrief, revenue snapshot, founder brief."""

from __future__ import annotations

import logging
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import schedule

from app.core.config import settings
from app.core.cron_ping import ping_cron_health
from app.workers import alert_evaluator, founder_brief, revenue_snapshot, weekly_debrief
from app.workers.decision_engine_worker import run_decision_engine
from app.workers.forecast_worker import run_forecast_worker
from app.workers.morning_brief_worker import run_morning_brief_worker
from app.workers.outcome_tracking_worker import run_outcome_tracking

logger = logging.getLogger("akara.cron.intelligence")

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


def job_weekly_debrief() -> None:
    def _submit() -> None:
        weekly_debrief.run_weekly_debrief_cycle()

    def _via_pool() -> None:
        with ThreadPoolExecutor(max_workers=2) as pool:
            pool.submit(_submit).result()

    _isolated("weekly_debrief", _via_pool)()


def job_revenue_snapshot() -> None:
    _isolated(
        "revenue_snapshot",
        revenue_snapshot.run_revenue_snapshot,
        ping_success="revenue_snapshot",
    )()


def job_founder_brief() -> None:
    _isolated(
        "founder_brief",
        founder_brief.run_founder_brief,
        ping_success="founder_brief",
    )()


def register_jobs() -> schedule.Scheduler:
    global _registered
    if _registered:
        return scheduler
    scheduler.every().monday.at("01:30").do(job_weekly_debrief)
    scheduler.every().monday.at("02:00").do(job_revenue_snapshot)
    scheduler.every().monday.at("02:30").do(job_founder_brief)
    scheduler.every().day.at("20:30").do(
        _isolated("forecast_worker", lambda: run_forecast_worker(n_jobs=1))
    )
    scheduler.every().day.at("21:30").do(
        _isolated("alert_evaluator", alert_evaluator.run_alert_evaluator_cycle)
    )
    scheduler.every().day.at("01:30").do(
        _isolated("morning_brief", run_morning_brief_worker)
    )
    scheduler.every().day.at("22:30").do(
        _isolated("decision_engine", run_decision_engine)
    )
    scheduler.every().day.at("23:30").do(
        _isolated("outcome_tracking", run_outcome_tracking)
    )
    _registered = True
    return scheduler


register_jobs()


def main() -> None:
    register_jobs()
    logger.info("cron_intelligence_worker started environment=%s", settings.environment)
    while True:
        scheduler.run_pending()
        time.sleep(60)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
