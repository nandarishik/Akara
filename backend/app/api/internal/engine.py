"""Internal decision-engine triggers — X-Service-Key or superadmin."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Header, Request

from app.api.internal.reports import _authorize
from app.workers.decision_engine_worker import (
    run_decision_engine,
    run_decision_engine_for_tenant,
)
from app.workers.outcome_tracking_worker import run_outcome_tracking

router = APIRouter(prefix="/admin/engine", tags=["internal"])


@router.post("/run")
async def run_all(
    request: Request,
    x_service_key: str | None = Header(default=None, alias="X-Service-Key"),
) -> dict:
    _authorize(x_service_key, request)
    return run_decision_engine()


@router.post("/run/{tenant_id}")
async def run_one(
    tenant_id: UUID,
    request: Request,
    x_service_key: str | None = Header(default=None, alias="X-Service-Key"),
) -> dict:
    _authorize(x_service_key, request)
    return await run_decision_engine_for_tenant(str(tenant_id))


@router.post("/outcome-scan")
async def outcome_scan(
    request: Request,
    x_service_key: str | None = Header(default=None, alias="X-Service-Key"),
) -> dict:
    _authorize(x_service_key, request)
    return run_outcome_tracking()
