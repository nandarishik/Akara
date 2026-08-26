"""LLM Control Room APIs and customer-safe prompt resolution."""

from __future__ import annotations

import hashlib
import logging
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from app.api.superadmin.control_plane import resolve_published_prompt
from app.core.config import settings
from app.core.errors import AkaraHTTPException
from app.core.superadmin import SuperAdmin, SudoCtx, request_actor_meta, require_csrf
from app.core.tenant import get_supabase_service_client
from app.domain.superadmin.audit import record_operation
from app.domain.superadmin.mutations import SuperadminMutation

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["superadmin-ai"])


class PromptVersionBody(SuperadminMutation):
    content: str = Field(..., min_length=1, max_length=100_000)
    model: str | None = Field(default=None, max_length=200)
    regression_set: list[dict[str, Any]] = Field(default_factory=list)


class PromptTestBody(BaseModel):
    content: str | None = None
    questions: list[str] = Field(default_factory=list, max_length=100)


class PromptVersionAction(SuperadminMutation):
    version_id: UUID | None = None


class RoutingBody(SuperadminMutation):
    routes: dict[str, dict[str, Any]]


class BudgetBody(SuperadminMutation):
    global_monthly_usd: float = Field(..., ge=0, le=1_000_000)
    per_tenant_monthly_usd: float = Field(..., ge=0, le=100_000)
    kill_switch: bool = False
    circuit_breakers: dict[str, bool] = Field(default_factory=dict)


def _table(name: str):
    return get_supabase_service_client().table(name)


def tenant_rollout_bucket(tenant_id: UUID | str, prompt_key: str) -> int:
    """Stable 0..99 bucket used for percentage rollouts."""
    digest = hashlib.sha256(f"{tenant_id}:{prompt_key}".encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % 100


def should_route_model(tenant_id: UUID | str, prompt_key: str, rollout_percent: int | float) -> bool:
    return tenant_rollout_bucket(tenant_id, prompt_key) < max(0, min(100, int(rollout_percent)))


def is_ai_allowed(*, global_kill_switch: bool, tenant_breaker_open: bool, global_spend_usd: float, tenant_spend_usd: float, global_budget_usd: float, tenant_budget_usd: float, is_test_traffic: bool = False) -> bool:
    if is_test_traffic:
        return not global_kill_switch
    return not global_kill_switch and not tenant_breaker_open and global_spend_usd < global_budget_usd and tenant_spend_usd < tenant_budget_usd


@router.get("/requests")
def list_ai_requests(_admin: SuperAdmin, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0), tenant_id: UUID | None = None, feature: str | None = None) -> dict[str, Any]:
    query = _table("llm_requests").select("*").order("created_at", desc=True).range(offset, offset + limit - 1)
    if tenant_id: query = query.eq("tenant_id", str(tenant_id))
    if feature: query = query.eq("feature", feature)
    result = query.execute()
    return {"items": result.data or [], "total": len(result.data or [])}


@router.get("/requests/{request_id}")
def get_ai_request(request_id: UUID, _admin: SuperAdmin) -> dict[str, Any]:
    result = _table("llm_requests").select("*").eq("id", str(request_id)).maybe_single().execute()
    if not result.data: raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="AI request not found")
    row = dict(result.data)
    # Raw secret-bearing SQL is never returned to the browser.
    row.pop("sql", None); row.pop("raw_prompt", None); row.pop("raw_response", None)
    return row


@router.get("/prompts")
def list_prompts(_admin: SuperAdmin) -> dict[str, Any]:
    result = _table("prompt_definitions").select("*").order("prompt_key").execute()
    return {"items": result.data or [], "total": len(result.data or [])}


@router.post("/prompts/{prompt_key}/versions")
def create_prompt_version(prompt_key: str, body: PromptVersionBody, request: Request, sudo: SudoCtx, _: None = Depends(require_csrf)) -> dict[str, Any]:
    row = {"id": str(uuid4()), "prompt_key": prompt_key, "content": body.content, "model": body.model or settings.openrouter_model, "status": "draft", "created_by": str(sudo.user_id), "regression_set": body.regression_set}
    result = _table("prompt_versions").insert(row).execute()
    audit = record_operation(action="ai.prompt.version.create", actor_id=sudo.user_id, actor_email=sudo.email, reason=body.reason, resource_type="prompt", resource_id=prompt_key, details={"version_id": row["id"]}, **request_actor_meta(request))
    return {"item": (result.data or [row])[0], "audit": audit}


@router.post("/prompts/{prompt_key}/test")
def test_prompt(prompt_key: str, body: PromptTestBody, _admin: SuperAdmin) -> dict[str, Any]:
    fallback, used_fallback = resolve_published_prompt(prompt_key, "")
    content = body.content or fallback
    if not content: raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Prompt not found")
    questions = body.questions or ["What is revenue this month?", "Which tenant is isolated?", "What failed?"]
    results = [{"question": question, "status": "not_run", "output": None} for question in questions]
    return {"prompt_key": prompt_key, "used_fallback": used_fallback, "results": results, "estimated_cost_usd": round(len(content) / 4 * len(questions) / 1_000_000 * 0.15, 6)}


@router.post("/prompts/{prompt_key}/publish")
def publish_prompt(prompt_key: str, body: PromptVersionAction, request: Request, sudo: SudoCtx, _: None = Depends(require_csrf)) -> dict[str, Any]:
    version_id = body.version_id or body.operation_id
    if not version_id: raise AkaraHTTPException(status_code=400, code="VALIDATION_ERROR", message="operation_id must identify the draft version")
    version = _table("prompt_versions").select("*").eq("id", str(version_id)).eq("prompt_key", prompt_key).maybe_single().execute()
    if not version.data: raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Prompt version not found")
    _table("prompt_versions").update({"status": "archived"}).eq("prompt_key", prompt_key).eq("status", "published").execute()
    result = _table("prompt_versions").update({"status": "published", "published_by": str(sudo.user_id)}).eq("id", str(version_id)).execute()
    _table("prompt_definitions").upsert({"prompt_key": prompt_key, "published_version_id": str(version_id), "updated_by": str(sudo.user_id)}).execute()
    audit = record_operation(action="ai.prompt.publish", actor_id=sudo.user_id, actor_email=sudo.email, reason=body.reason, resource_type="prompt", resource_id=prompt_key, details={"version_id": str(version_id)}, **request_actor_meta(request))
    return {"ok": True, "item": (result.data or [version.data])[0], "audit": audit}


@router.post("/prompts/{prompt_key}/rollback")
def rollback_prompt(prompt_key: str, body: PromptVersionAction, request: Request, sudo: SudoCtx, _: None = Depends(require_csrf)) -> dict[str, Any]:
    target = body.version_id or body.operation_id
    if not target: raise AkaraHTTPException(status_code=400, code="VALIDATION_ERROR", message="operation_id must identify the target version")
    version = _table("prompt_versions").select("id").eq("id", str(target)).eq("prompt_key", prompt_key).maybe_single().execute()
    if not version.data: raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Prompt version not found")
    _table("prompt_versions").update({"status": "archived"}).eq("prompt_key", prompt_key).eq("status", "published").execute()
    _table("prompt_versions").update({"status": "published", "published_by": str(sudo.user_id)}).eq("id", str(target)).execute()
    _table("prompt_definitions").upsert({"prompt_key": prompt_key, "published_version_id": str(target), "updated_by": str(sudo.user_id)}).execute()
    audit = record_operation(action="ai.prompt.rollback", actor_id=sudo.user_id, actor_email=sudo.email, reason=body.reason, resource_type="prompt", resource_id=prompt_key, details={"version_id": str(target)}, **request_actor_meta(request))
    return {"ok": True, "prompt_key": prompt_key, "published_version_id": str(target), "audit": audit}


@router.patch("/routing")
def update_ai_routing(body: RoutingBody, request: Request, sudo: SudoCtx, _: None = Depends(require_csrf)) -> dict[str, Any]:
    for feature, route in body.routes.items():
        if not feature or not isinstance(route.get("model"), str): raise AkaraHTTPException(status_code=400, code="VALIDATION_ERROR", message="Each route needs a model")
        rollout = route.get("rollout_percent", 100)
        if not isinstance(rollout, int | float) or not 0 <= rollout <= 100: raise AkaraHTTPException(status_code=400, code="VALIDATION_ERROR", message="rollout_percent must be 0..100")
    _table("ai_routing_rules").upsert({"rules": body.routes, "updated_by": str(sudo.user_id)}).execute()
    audit = record_operation(action="ai.routing.update", actor_id=sudo.user_id, actor_email=sudo.email, reason=body.reason, details={"features": list(body.routes)}, **request_actor_meta(request))
    return {"ok": True, "routes": body.routes, "audit": audit}


@router.patch("/budgets")
def update_ai_budgets(body: BudgetBody, request: Request, sudo: SudoCtx, _: None = Depends(require_csrf)) -> dict[str, Any]:
    row = {"global_monthly_usd": body.global_monthly_usd, "per_tenant_monthly_usd": body.per_tenant_monthly_usd, "kill_switch": body.kill_switch, "circuit_breakers": body.circuit_breakers, "updated_by": str(sudo.user_id)}
    _table("ai_budgets").upsert(row).execute()
    audit = record_operation(action="ai.budgets.update", actor_id=sudo.user_id, actor_email=sudo.email, reason=body.reason, details={"kill_switch": body.kill_switch}, **request_actor_meta(request))
    return {"ok": True, "budgets": row, "audit": audit}


@router.post("/requests/{request_id}/replay")
def replay_ai_request(request_id: UUID, body: SuperadminMutation, request: Request, sudo: SudoCtx, _: None = Depends(require_csrf)) -> dict[str, Any]:
    source = _table("llm_requests").select("tenant_id, user_id, feature, prompt_version_id, model").eq("id", str(request_id)).maybe_single().execute()
    if not source.data: raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="AI request not found")
    replay_id = uuid4()
    row = {"id": str(replay_id), **source.data, "is_test_traffic": True, "excluded_from_quota": True, "status": "queued", "replayed_from": str(request_id), "actor_id": str(sudo.user_id)}
    _table("llm_requests").insert(row).execute()
    audit = record_operation(action="ai.request.replay", actor_id=sudo.user_id, actor_email=sudo.email, reason=body.reason, operation_id=replay_id, resource_type="llm_request", resource_id=str(request_id), details={"test_traffic": True, "excluded_from_quota": True}, **request_actor_meta(request))
    return {"ok": True, "request_id": str(replay_id), "is_test_traffic": True, "excluded_from_quota": True, "audit": audit}


def resolve_prompt(prompt_key: str, fallback: str) -> tuple[str, bool]:
    """Customer-facing adapter: published DB prompt first, checked-in fallback second."""
    return resolve_published_prompt(prompt_key, fallback)
