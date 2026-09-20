"""Shared worker pause + run logging."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from app.core.tenant import get_supabase_service_client


def is_paused(job_name: str, tenant_id: UUID | str | None = None) -> bool:
    supa = get_supabase_service_client()
    now = datetime.now(UTC).isoformat()
    query = (
        supa.table("worker_pause_config")
        .select("paused_until, tenant_id")
        .eq("job_name", job_name)
    )
    rows = query.execute().data or []
    for row in rows:
        until = row.get("paused_until")
        if until and str(until) <= now:
            continue
        row_tenant = row.get("tenant_id")
        if row_tenant is None:
            return True
        if tenant_id is not None and str(row_tenant) == str(tenant_id):
            return True
    return False


def run_with_log(job_name: str, fn: Callable[[], Any], tenant_id: UUID | str | None = None) -> Any:
    if is_paused(job_name, tenant_id):
        return {"skipped": True, "reason": "paused"}
    supa = get_supabase_service_client()
    started = datetime.now(UTC)
    row = {
        "job_name": job_name,
        "tenant_id": str(tenant_id) if tenant_id else None,
        "status": "running",
        "started_at": started.isoformat(),
    }
    inserted = supa.table("worker_run_log").insert(row).execute()
    run_id = (inserted.data or [{}])[0].get("id")
    try:
        result = fn()
        if run_id:
            supa.table("worker_run_log").update({
                "status": "succeeded",
                "finished_at": datetime.now(UTC).isoformat(),
                "details": {"ok": True},
            }).eq("id", str(run_id)).execute()
        return result
    except Exception as exc:
        if run_id:
            supa.table("worker_run_log").update({
                "status": "failed",
                "finished_at": datetime.now(UTC).isoformat(),
                "details": {"error": str(exc)[:500]},
            }).eq("id", str(run_id)).execute()
        raise
