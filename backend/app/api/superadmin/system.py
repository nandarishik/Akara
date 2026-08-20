"""Superadmin system health and cron management."""

from __future__ import annotations

import logging
import time
from datetime import UTC, datetime
from typing import Any

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request
from pydantic import BaseModel

from app.core.config import settings
from app.core.cron_ping import record_cron_run
from app.core.rate_limit import ADMIN_READ_LIMIT, ADMIN_WRITE_LIMIT, limiter
from app.core.superadmin import SuperAdmin, SudoCtx, request_actor_meta, require_csrf
from app.core.tenant import get_supabase_service_client
from app.api.v1.system import _load_setting
from app.domain.superadmin.audit import record_operation
from app.domain.superadmin.mutations import SuperadminMutation, dry_run_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/system", tags=["superadmin-system"])

CRON_TASKS = frozenset({
    "retention_cleanup",
    "alert_evaluator",
    "activation_emails",
    "dunning",
    "morning_brief",
    "weekly_debrief",
    "founder_brief",
    "revenue_snapshot",
    "broadcast_scheduler",
    "content_scheduler",
})


class CronHealthItem(BaseModel):
    task_name: str
    last_run: str | None = None
    status: str | None = None
    details: dict[str, Any] = {}


class CronHealthResponse(BaseModel):
    tasks: list[CronHealthItem]


class CronRunBody(SuperadminMutation):
    pass


class SuperadminSystemSettingsResponse(BaseModel):
    maintenance_mode: bool
    signup_open: bool
    system_banner: dict[str, Any] | None = None


class SystemSettingsPatchBody(SuperadminMutation):
    maintenance_mode: bool | None = None
    signup_open: bool | None = None


def _upsert_setting(key: str, value: Any) -> None:
    get_supabase_service_client().table("global_settings").upsert({
        "key": key,
        "value": value,
        "updated_at": datetime.now(UTC).isoformat(),
    }).execute()


@router.get("/settings", response_model=SuperadminSystemSettingsResponse)
@limiter.limit(ADMIN_READ_LIMIT)
def get_superadmin_system_settings(
    request: Request,
    _admin: SuperAdmin,
) -> SuperadminSystemSettingsResponse:
    banner = _load_setting("system_banner", None)
    return SuperadminSystemSettingsResponse(
        maintenance_mode=bool(_load_setting("maintenance_mode", False)),
        signup_open=bool(_load_setting("signup_open", True)),
        system_banner=banner if isinstance(banner, dict) else None,
    )


@router.patch("/settings")
@limiter.limit(ADMIN_WRITE_LIMIT)
def patch_superadmin_system_settings(
    request: Request,
    body: SystemSettingsPatchBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    before = {
        "maintenance_mode": bool(_load_setting("maintenance_mode", False)),
        "signup_open": bool(_load_setting("signup_open", True)),
    }
    if body.dry_run:
        after = dict(before)
        if body.maintenance_mode is not None:
            after["maintenance_mode"] = body.maintenance_mode
        if body.signup_open is not None:
            after["signup_open"] = body.signup_open
        return dry_run_response(
            action="superadmin.system.settings",
            before=before,
            impact=after,
        )

    after = dict(before)
    if body.maintenance_mode is not None:
        _upsert_setting("maintenance_mode", body.maintenance_mode)
        after["maintenance_mode"] = body.maintenance_mode
    if body.signup_open is not None:
        _upsert_setting("signup_open", body.signup_open)
        after["signup_open"] = body.signup_open

    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.system.settings",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        operation_id=body.operation_id,
        before_state=before,
        after_state=after,
        **meta,
    )
    return {"ok": True, "settings": after, "audit": audit}


def _latest_cron_runs() -> dict[str, dict[str, Any]]:
    supa = get_supabase_service_client()
    runs: dict[str, dict[str, Any]] = {}
    for task in CRON_TASKS:
        row = (
            supa.table("cron_runs")
            .select("task_name, status, details, finished_at")
            .eq("task_name", task)
            .order("finished_at", desc=True)
            .limit(1)
            .execute()
        )
        if row.data:
            runs[task] = row.data[0]
    return runs


def _run_task(task_name: str) -> None:
    import asyncio

    started = datetime.now(UTC)
    status = "ok"
    details: dict[str, Any] = {}
    try:
        if task_name == "retention_cleanup":
            from app.workers.retention_cleanup import run

            run(dry_run=False)
        elif task_name == "alert_evaluator":
            from app.workers.alert_evaluator import run_alert_evaluator_cycle

            details = run_alert_evaluator_cycle()
        elif task_name == "activation_emails":
            from app.workers.activation_emails import run_activation_emails

            details = run_activation_emails()
        elif task_name == "dunning":
            from app.workers.dunning import run_dunning_cycle

            asyncio.run(run_dunning_cycle())
        elif task_name == "weekly_debrief":
            from app.workers.weekly_debrief import run_weekly_debrief_cycle

            details = run_weekly_debrief_cycle()
        elif task_name == "morning_brief":
            details = {"message": "morning_brief requires per-tenant trigger via /reports/morning-brief"}
        elif task_name == "founder_brief":
            from app.workers.founder_brief import run_founder_brief

            details = run_founder_brief()
        elif task_name == "revenue_snapshot":
            from app.workers.revenue_snapshot import run_revenue_snapshot

            details = run_revenue_snapshot()
        elif task_name == "broadcast_scheduler":
            from app.workers.broadcast_scheduler import run_broadcast_scheduler

            details = run_broadcast_scheduler()
        elif task_name == "content_scheduler":
            from app.workers.content_scheduler import run_content_scheduler

            details = run_content_scheduler()
        else:
            status = "failed"
            details = {"error": "unknown task"}
    except Exception as exc:
        status = "failed"
        details = {"error": str(exc)}
        logger.exception("Manual cron run failed for %s", task_name)

    record_cron_run(
        task_name=task_name,
        status=status,
        details=details,
        started_at=started,
    )


@router.get("/cron-health", response_model=CronHealthResponse)
@limiter.limit(ADMIN_READ_LIMIT)
def cron_health(
    request: Request,
    _admin: SuperAdmin,
) -> CronHealthResponse:
    latest = _latest_cron_runs()
    items = []
    for task in sorted(CRON_TASKS):
        row = latest.get(task)
        items.append(
            CronHealthItem(
                task_name=task,
                last_run=row.get("finished_at") if row else None,
                status=row.get("status") if row else None,
                details=row.get("details") or {} if row else {},
            )
        )
    return CronHealthResponse(tasks=items)


@router.get("/cron-logs/{task_name}")
@limiter.limit(ADMIN_READ_LIMIT)
def cron_logs(
    request: Request,
    task_name: str,
    _admin: SuperAdmin,
    limit: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    if task_name not in CRON_TASKS:
        from app.core.errors import AkaraHTTPException

        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Unknown cron task")
    supa = get_supabase_service_client()
    rows = (
        supa.table("cron_runs")
        .select("task_name, status, details, started_at, finished_at")
        .eq("task_name", task_name)
        .order("finished_at", desc=True)
        .limit(limit)
        .execute()
    ).data or []
    return {"items": rows, "total": len(rows)}


@router.post("/cron-run/{task_name}")
@limiter.limit(ADMIN_WRITE_LIMIT)
def cron_run(
    request: Request,
    task_name: str,
    body: CronRunBody,
    background_tasks: BackgroundTasks,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    if task_name not in CRON_TASKS:
        from app.core.errors import AkaraHTTPException

        raise AkaraHTTPException(
            status_code=400,
            code="VALIDATION_ERROR",
            message=f"Unknown task. Valid: {', '.join(sorted(CRON_TASKS))}",
        )

    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.system.cron_run",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        operation_id=body.operation_id,
        details={"task_name": task_name},
        **meta,
    )

    background_tasks.add_task(_run_task, task_name)
    return {
        "ok": True,
        "triggered": True,
        "task_name": task_name,
        "check_results_in": 30,
        "audit": audit,
    }


@router.get("/health")
@limiter.limit(ADMIN_READ_LIMIT)
def system_health(
    request: Request,
    _admin: SuperAdmin,
) -> dict[str, Any]:
    checks: dict[str, str] = {"api_status": "ok"}
    db_latency_ms: int | None = None

    try:
        start = time.perf_counter()
        get_supabase_service_client().table("tenants").select("id").limit(1).execute()
        db_latency_ms = round((time.perf_counter() - start) * 1000)
        checks["db"] = "ok"
    except Exception as exc:
        checks["db"] = f"error: {type(exc).__name__}"

    if settings.openrouter_api_key:
        try:
            httpx.get(
                "https://openrouter.ai/api/v1/models",
                headers={"Authorization": f"Bearer {settings.openrouter_api_key}"},
                timeout=5.0,
            ).raise_for_status()
            checks["openrouter_status"] = "ok"
        except Exception:
            checks["openrouter_status"] = "degraded"
    else:
        checks["openrouter_status"] = "not_configured"

    checks["sendgrid_status"] = "ok" if settings.sendgrid_api_key else "not_configured"
    checks["zaptilo_status"] = "ok" if settings.zaptilo_api_key else "not_configured"
    checks["razorpay_status"] = (
        "ok" if settings.razorpay_key_id and settings.razorpay_key_secret else "not_configured"
    )

    try:
        supa = get_supabase_service_client()
        jobs = (
            supa.table("import_jobs")
            .select("id", count="exact")
            .in_("status", ["queued", "processing"])
            .execute()
        )
        active_import_jobs = jobs.count or 0
    except Exception:
        active_import_jobs = 0

    return {
        "api_status": "ok",
        "db_latency_ms": db_latency_ms,
        "checks": checks,
        "active_import_jobs": active_import_jobs,
        "environment": settings.environment,
        "timestamp": datetime.now(UTC).isoformat(),
    }
