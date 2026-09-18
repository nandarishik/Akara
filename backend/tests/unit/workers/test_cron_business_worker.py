from __future__ import annotations

from datetime import time as dtime

from app.workers.combined import cron_business_worker as worker


def test_cron_business_schedules_all_seven_jobs() -> None:
    jobs = worker.scheduler.jobs
    at_times = {j.at_time for j in jobs if j.at_time is not None}
    assert dtime(3, 0) in at_times
    assert dtime(4, 0) in at_times
    assert dtime(5, 0) in at_times
    assert dtime(6, 0) in at_times
    assert dtime(6, 30) in at_times
    assert dtime(8, 0) in at_times
    assert any(getattr(j, "interval", None) == 5 for j in jobs)


def test_alert_failure_does_not_block_content(monkeypatch) -> None:
    called = {"content": False}
    pings: list[dict[str, str]] = []

    def boom() -> None:
        raise RuntimeError("alerts down")

    def content_ok() -> dict[str, int]:
        called["content"] = True
        return {}

    def capture(job: str, status: str = "ok", details=None) -> None:
        pings.append({"job": job, "status": status})

    monkeypatch.setattr(worker.alert_evaluator, "run_alert_evaluator_cycle", boom)
    monkeypatch.setattr(worker.content_scheduler, "run_content_scheduler", content_ok)
    monkeypatch.setattr(worker, "ping_cron_health", capture)

    worker.job_alerts()
    worker.job_content()

    assert called["content"] is True
    assert any(p["status"] == "fail" for p in pings)
