from __future__ import annotations

from datetime import time as dtime

from app.workers.combined import cron_intelligence_worker as worker


def test_cron_intelligence_monday_schedule() -> None:
    jobs = worker.scheduler.jobs
    monday = [
        j
        for j in jobs
        if getattr(j, "start_day", None) == "monday" and j.at_time is not None
    ]
    times = {j.at_time for j in monday}
    assert dtime(1, 30) in times
    assert dtime(2, 0) in times
    assert dtime(2, 30) in times


def test_cron_intelligence_daily_p10_schedule() -> None:
    jobs = worker.scheduler.jobs
    daily = [
        j
        for j in jobs
        if getattr(j, "start_day", None) is None and j.at_time is not None
    ]
    times = {j.at_time for j in daily}
    assert dtime(20, 30) in times
    assert dtime(21, 30) in times
    assert dtime(1, 30) in times


def test_snapshot_failure_does_not_block_founder_brief(monkeypatch) -> None:
    called = {"founder": False}
    pings: list[dict[str, str]] = []

    def boom() -> None:
        raise RuntimeError("snapshot down")

    def founder_ok() -> dict[str, int]:
        called["founder"] = True
        return {}

    def capture(job: str, status: str = "ok", details=None) -> None:
        pings.append({"job": job, "status": status})

    monkeypatch.setattr(worker.revenue_snapshot, "run_revenue_snapshot", boom)
    monkeypatch.setattr(worker.founder_brief, "run_founder_brief", founder_ok)
    monkeypatch.setattr(worker, "ping_cron_health", capture)

    worker.job_revenue_snapshot()
    worker.job_founder_brief()

    assert called["founder"] is True
    assert any(p["status"] == "fail" for p in pings)
