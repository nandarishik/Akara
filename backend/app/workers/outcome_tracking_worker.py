"""05:00 IST outcome scan — 14d pre/post + EMA weights."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from app.core.config import settings
from app.domain.intelligence import recommendation_repo as repo
from app.domain.intelligence.outcome import calibrate_weight, measure_outcome
from app.domain.intelligence.worker_runs import finish_run, start_run

logger = logging.getLogger(__name__)


def run_outcome_tracking(
    *,
    pre_post: dict[str, tuple[float, float]] | None = None,
    as_of: datetime | None = None,
) -> dict[str, Any]:
    run = start_run("outcome_tracking")
    measured = 0
    for row in repo.all_watching_due(as_of):
        expected = float(row.get("expected_impact_max") or row.get("expected_impact_min") or 0)
        pair = (pre_post or {}).get(row["id"], (0.0, expected))
        outcome = measure_outcome(pair[0], pair[1], expected)
        row["outcome_measured"] = outcome
        row["outcome_measured_at"] = (as_of or repo.now_utc()).isoformat()
        row["status"] = "resolved"
        if expected > 0:
            calibrate_weight(
                1.0,
                expected,
                float(outcome["actual_impact_inr"]),
                alpha=settings.playbook_weight_alpha,
                min_w=settings.playbook_weight_min,
                max_w=settings.playbook_weight_max,
            )
        measured += 1
    run["success_count"] = measured
    return finish_run(run, status="success", measured=measured)
