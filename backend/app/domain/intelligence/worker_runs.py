"""worker_runs helper + retry/dead-letter (AD-P10-004/005)."""

from __future__ import annotations

import logging
import time
from collections.abc import Callable
from typing import Any
from uuid import uuid4

logger = logging.getLogger(__name__)

RETRY_DELAYS = (30, 120, 480)
MAX_RETRIES = 3


def start_run(worker_name: str, tenant_id: str | None = None) -> dict[str, Any]:
    return {
        "id": str(uuid4()),
        "worker_name": worker_name,
        "tenant_id": tenant_id,
        "status": "running",
        "retry_attempt": 0,
        "tenants_processed": 0,
        "errors_count": 0,
        "success_count": 0,
        "metadata": {},
    }


def finish_run(run: dict[str, Any], *, status: str, **meta: Any) -> dict[str, Any]:
    run["status"] = status
    run["metadata"] = {**run.get("metadata", {}), **meta}
    return run


def run_with_retry(
    fn: Callable[[], Any],
    *,
    sleep: Callable[[float], None] = time.sleep,
    delays: tuple[int, ...] = RETRY_DELAYS,
) -> dict[str, Any]:
    run = start_run("generic")
    last_exc: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            fn()
            run["retry_attempt"] = attempt
            return finish_run(run, status="success")
        except Exception as exc:
            last_exc = exc
            run["retry_attempt"] = attempt + 1
            logger.warning("worker_retry attempt=%s err=%s", attempt + 1, exc)
            if attempt < MAX_RETRIES - 1:
                sleep(float(delays[attempt] if attempt < len(delays) else 0))
    logger.error("worker_dead_letter err=%s", last_exc)
    return finish_run(run, status="dead_letter")
