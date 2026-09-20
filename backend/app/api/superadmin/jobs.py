"""Superadmin job controls — trigger, pause, resume, history."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Request

from app.api.superadmin.system import CRON_TASKS
from app.core.errors import AkaraHTTPException
from app.core.rate_limit import ADMIN_READ_LIMIT, ADMIN_WRITE_LIMIT, limiter
from app.core.superadmin import (
    SudoCtx,
    SuperAdmin,
    SuperadminRole,
    request_actor_meta,
    require_csrf,
    require_role,
)
from app.core.tenant import get_supabase_service_client
from app.domain.superadmin.audit import record_operation
from app.domain.superadmin.mutations import SuperadminMutation, dry_run_response
from app.workers.base import is_paused

router = APIRouter(tags=["superadmin-jobs"])

KNOWN_JOBS = frozenset(CRON_TASKS) | {
    "import_worker",
    "account_deletion_worker",
    "account_export_worker",
    "connector_sync_worker",
}


class PauseBody(SuperadminMutation):
    paused_until: str | None = None


class TenantOverrideBody(SuperadminMutation):
    paused_until: str | None = None


def _job_or_404(job_name: str) -> None:
    if job_name not in KNOWN_JOBS:
        raise AkaraHTTPException(
            status_code=404,
            code="NOT_FOUND",
            message=f"Unknown job. Valid: {', '.join(sorted(KNOWN_JOBS))}",
        )


@router.get("/jobs")
@limiter.limit(ADMIN_READ_LIMIT)
def list_jobs(request: Request, _admin: SuperAdmin) -> dict[str, Any]:
    items = []
    for name in sorted(KNOWN_JOBS):
        items.append({
            "job_name": name,
            "paused": is_paused(name),
        })
    return {"items": items}


@router.get("/jobs/{job_name}/history")
@limiter.limit(ADMIN_READ_LIMIT)
def job_history(request: Request, job_name: str, _admin: SuperAdmin) -> dict[str, Any]:
    _job_or_404(job_name)
    result = (
        get_supabase_service_client()
        .table("worker_run_log")
        .select("*")
        .eq("job_name", job_name)
        .order("started_at", desc=True)
        .limit(50)
        .execute()
    )
    return {"items": result.data or []}


@router.post("/jobs/{job_name}/trigger")
@limiter.limit(ADMIN_WRITE_LIMIT)
def trigger_job(
    request: Request,
    job_name: str,
    body: SuperadminMutation,
    sudo: SudoCtx,
    _: None = Depends(require_csrf),
    __: None = Depends(require_role(SuperadminRole.SUPER_ADMIN)),
) -> dict[str, Any]:
    _job_or_404(job_name)
    if body.dry_run:
        return dry_run_response(action="jobs.trigger", impact={"job_name": job_name})
    get_supabase_service_client().table("worker_run_log").insert({
        "job_name": job_name,
        "status": "queued",
        "started_at": datetime.now(UTC).isoformat(),
        "details": {"triggered_by": str(sudo.user_id), "reason": body.reason},
    }).execute()
    audit = record_operation(
        action="jobs.trigger",
        actor_id=sudo.user_id,
        actor_email=sudo.email,
        reason=body.reason,
        details={"job_name": job_name},
        **request_actor_meta(request),
    )
    return {"ok": True, "job_name": job_name, "status": "queued", "audit": audit}


@router.post("/jobs/{job_name}/pause")
@limiter.limit(ADMIN_WRITE_LIMIT)
def pause_job(
    request: Request,
    job_name: str,
    body: PauseBody,
    sudo: SudoCtx,
    _: None = Depends(require_csrf),
    __: None = Depends(require_role(SuperadminRole.SUPER_ADMIN)),
) -> dict[str, Any]:
    _job_or_404(job_name)
    if body.dry_run:
        return dry_run_response(action="jobs.pause", impact={"job_name": job_name})
    get_supabase_service_client().table("worker_pause_config").upsert({
        "job_name": job_name,
        "tenant_id": None,
        "paused_until": body.paused_until,
        "reason": body.reason,
        "updated_at": datetime.now(UTC).isoformat(),
    }).execute()
    audit = record_operation(
        action="jobs.pause",
        actor_id=sudo.user_id,
        actor_email=sudo.email,
        reason=body.reason,
        details={"job_name": job_name, "paused_until": body.paused_until},
        **request_actor_meta(request),
    )
    return {"ok": True, "paused": True, "audit": audit}


@router.post("/jobs/{job_name}/resume")
@limiter.limit(ADMIN_WRITE_LIMIT)
def resume_job(
    request: Request,
    job_name: str,
    body: SuperadminMutation,
    sudo: SudoCtx,
    _: None = Depends(require_csrf),
    __: None = Depends(require_role(SuperadminRole.SUPER_ADMIN)),
) -> dict[str, Any]:
    _job_or_404(job_name)
    if body.dry_run:
        return dry_run_response(action="jobs.resume", impact={"job_name": job_name})
    get_supabase_service_client().table("worker_pause_config").delete().eq(
        "job_name", job_name
    ).is_("tenant_id", "null").execute()
    audit = record_operation(
        action="jobs.resume",
        actor_id=sudo.user_id,
        actor_email=sudo.email,
        reason=body.reason,
        details={"job_name": job_name},
        **request_actor_meta(request),
    )
    return {"ok": True, "paused": False, "audit": audit}


@router.get("/tenants/{tenant_id}/jobs")
@limiter.limit(ADMIN_READ_LIMIT)
def tenant_jobs(request: Request, tenant_id: UUID, _admin: SuperAdmin) -> dict[str, Any]:
    items = [{"job_name": name, "paused": is_paused(name, tenant_id)} for name in sorted(KNOWN_JOBS)]
    return {"tenant_id": str(tenant_id), "items": items}


@router.post("/tenants/{tenant_id}/jobs/{job_name}/override")
@limiter.limit(ADMIN_WRITE_LIMIT)
def tenant_job_override(
    request: Request,
    tenant_id: UUID,
    job_name: str,
    body: TenantOverrideBody,
    sudo: SudoCtx,
    _: None = Depends(require_csrf),
    __: None = Depends(require_role(SuperadminRole.SUPER_ADMIN)),
) -> dict[str, Any]:
    _job_or_404(job_name)
    if body.dry_run:
        return dry_run_response(
            action="jobs.tenant_override",
            impact={"job_name": job_name, "tenant_id": str(tenant_id)},
        )
    get_supabase_service_client().table("worker_pause_config").upsert({
        "job_name": job_name,
        "tenant_id": str(tenant_id),
        "paused_until": body.paused_until,
        "reason": body.reason,
        "updated_at": datetime.now(UTC).isoformat(),
    }).execute()
    audit = record_operation(
        action="jobs.tenant_override",
        actor_id=sudo.user_id,
        actor_email=sudo.email,
        reason=body.reason,
        tenant_id=tenant_id,
        details={"job_name": job_name},
        **request_actor_meta(request),
    )
    return {"ok": True, "audit": audit}
