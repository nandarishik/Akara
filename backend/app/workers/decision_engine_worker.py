"""Daily decision engine — Analyst → Decision → Reviewer → upsert. No auto-apply."""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from app.core.config import settings
from app.domain.intelligence import recommendation_repo as repo
from app.domain.intelligence.analyst_agent import run_analyst
from app.domain.intelligence.data_collector import collect_for_tenant
from app.domain.intelligence.decision_agent import generate_candidate_recommendations
from app.domain.intelligence.reviewer_agent import review_recommendations
from app.domain.intelligence.worker_runs import finish_run, start_run

logger = logging.getLogger(__name__)


async def _complete(prompt: str, system: str = "") -> str:
    from app.infra.llm.manager import LLMManager

    mgr = LLMManager(settings.openrouter_api_key)
    return await mgr.complete(prompt, system)


def _row_from_candidate(tenant_id: str, cand: Any) -> dict[str, Any]:
    rec_id = str(uuid4())
    now = datetime.now(UTC)
    return {
        "id": rec_id,
        "tenant_id": tenant_id,
        "recommendation_type": cand.recommendation_type,
        "title": cand.title,
        "description": cand.description,
        "evidence": cand.evidence,
        "confidence_score": cand.confidence_score,
        "confidence_methodology": cand.confidence_methodology,
        "data_days": cand.data_days,
        "expected_impact_min": cand.expected_impact_min,
        "expected_impact_max": cand.expected_impact_max,
        "expected_impact_currency": "INR",
        "assumptions": cand.assumptions,
        "risks": cand.risks,
        "cost_or_effort": cand.cost_or_effort,
        "status": "open",
        "outcome_measured": None,
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(days=settings.decision_engine_expiry_days)).isoformat(),
        "snooze_until": None,
        "reject_reason": None,
        "uncertainty_label": cand.uncertainty_label,
        "primary_item_id": cand.primary_item_id,
        "model_version": cand.model_version,
        "playbook_version": cand.playbook_version,
        "data_range": {"start": cand.data_range_start.isoformat(), "end": cand.data_range_end.isoformat()},
    }


async def run_decision_engine_for_tenant(
    tenant_id: str,
    *,
    frames: dict[str, Any] | None = None,
    complete: Any | None = None,
) -> dict[str, Any]:
    if not settings.decision_engine_enabled:
        return {"skipped": True, "skip_reason": "disabled"}
    frames = frames or collect_for_tenant(UUID(str(tenant_id)))
    orders = frames.get("orders")
    if orders is None or getattr(orders, "empty", True):
        logger.info("decision_engine_tenant_complete tenant=%s skip=no_orders_data", tenant_id)
        return {"skipped": True, "skip_reason": "no_orders_data"}
    report = run_analyst(frames)
    candidates = await generate_candidate_recommendations(
        report,
        complete=complete,
    )
    reviewed = await review_recommendations(candidates, complete=complete)
    inserted = 0
    for cand in reviewed[: settings.decision_engine_max_recs_per_tenant]:
        repo.upsert(_row_from_candidate(tenant_id, cand))
        inserted += 1
    logger.info(
        "decision_engine_tenant_complete tenant=%s inserted=%s narrative_calls<=5",
        tenant_id,
        inserted,
    )
    return {"skipped": False, "inserted": inserted}


def run_decision_engine(tenant_ids: list[str] | None = None) -> dict[str, Any]:
    run = start_run("decision_engine")
    if not settings.decision_engine_enabled:
        return finish_run(run, status="success", skip_reason="disabled")
    ids = tenant_ids or []
    inserted = 0
    for tid in ids:
        result = asyncio.run(run_decision_engine_for_tenant(tid))
        inserted += int(result.get("inserted") or 0)
    run["tenants_processed"] = len(ids)
    run["success_count"] = inserted
    return finish_run(run, status="success", inserted=inserted)
