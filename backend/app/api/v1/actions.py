"""Frozen /actions contract. Approval-first. Static paths before {id}."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.core.errors import AkaraHTTPException
from app.core.tenant import TenantContext, get_tenant_context
from app.domain.intelligence import recommendation_repo as repo

router = APIRouter(prefix="/actions", tags=["actions"])


class EvidenceItem(BaseModel):
    type: str
    label: str
    value: float | str
    unit: str | None = None


class RecommendationResponse(BaseModel):
    id: UUID
    recommendation_type: str
    title: str
    description: str
    evidence: list[EvidenceItem]
    confidence_score: float
    confidence_methodology: str
    data_days: int | None = None
    expected_impact_min: float | None = None
    expected_impact_max: float | None = None
    expected_impact_currency: str = "INR"
    assumptions: list[str] = []
    risks: list[str] = []
    cost_or_effort: str | None = None
    status: str
    outcome_measured: dict[str, Any] | None = None
    created_at: str
    expires_at: str
    snooze_until: str | None = None
    reject_reason: str | None = None
    uncertainty_label: str | None = None
    data_range: dict[str, str] | None = None


class AcceptRecommendationRequest(BaseModel):
    notes: str | None = None


class SnoozeRecommendationRequest(BaseModel):
    reason: str | None = None
    days: int = 7


class RejectRecommendationRequest(BaseModel):
    reason: str = Field(..., min_length=3)


def _to_response(row: dict[str, Any]) -> RecommendationResponse:
    return RecommendationResponse.model_validate(
        {
            **row,
            "assumptions": row.get("assumptions") or [],
            "risks": row.get("risks") or [],
            "evidence": row.get("evidence") or [],
            "expected_impact_currency": row.get("expected_impact_currency") or "INR",
        }
    )


def _require_admin(tenant: TenantContext) -> None:
    if not tenant.is_admin:
        raise AkaraHTTPException(status_code=403, code="FORBIDDEN", message="Admin required")


@router.get("")
def list_actions(
    tenant: TenantContext = Depends(get_tenant_context),
    sort: str = Query(default="confidence", pattern="^(confidence|impact|date)$"),
    type: str | None = None,
) -> dict[str, Any]:
    items = [_to_response(r) for r in repo.list_open(str(tenant.tenant_id), sort=sort, rec_type=type)]
    return {"items": items, "open_count": len(items)}


@router.get("/history")
def action_history(tenant: TenantContext = Depends(get_tenant_context)) -> dict[str, Any]:
    return {"items": [_to_response(r) for r in repo.list_history(str(tenant.tenant_id))]}


@router.get("/outcomes")
def action_outcomes(tenant: TenantContext = Depends(get_tenant_context)) -> dict[str, Any]:
    return {"items": [_to_response(r) for r in repo.list_outcomes(str(tenant.tenant_id))]}


@router.get("/summary")
def action_summary(tenant: TenantContext = Depends(get_tenant_context)) -> dict[str, Any]:
    return repo.summary(str(tenant.tenant_id))


@router.get("/{rec_id}")
def get_action(rec_id: UUID, tenant: TenantContext = Depends(get_tenant_context)) -> RecommendationResponse:
    row = repo.get(str(rec_id), str(tenant.tenant_id))
    if not row:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Not found")
    return _to_response(row)


@router.post("/{rec_id}/accept")
def accept_action(
    rec_id: UUID,
    body: AcceptRecommendationRequest,
    tenant: TenantContext = Depends(get_tenant_context),
) -> RecommendationResponse:
    _require_admin(tenant)
    row = repo.accept(str(rec_id), str(tenant.tenant_id), body.notes)
    if not row:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Not found")
    return _to_response(row)


@router.post("/{rec_id}/snooze")
def snooze_action(
    rec_id: UUID,
    body: SnoozeRecommendationRequest,
    tenant: TenantContext = Depends(get_tenant_context),
) -> RecommendationResponse:
    _require_admin(tenant)
    row = repo.snooze(str(rec_id), str(tenant.tenant_id), body.days, body.reason)
    if not row:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Not found")
    return _to_response(row)


@router.post("/{rec_id}/reject")
def reject_action(
    rec_id: UUID,
    body: RejectRecommendationRequest,
    tenant: TenantContext = Depends(get_tenant_context),
) -> RecommendationResponse:
    _require_admin(tenant)
    row = repo.reject(str(rec_id), str(tenant.tenant_id), body.reason)
    if not row:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Not found")
    return _to_response(row)
