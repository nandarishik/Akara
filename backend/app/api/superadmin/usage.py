"""Superadmin usage — at-risk tenant queues."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Request

from app.core.rate_limit import ADMIN_READ_LIMIT, limiter
from app.core.superadmin import SuperAdmin
from app.core.tenant import get_supabase_service_client

router = APIRouter(prefix="/usage", tags=["superadmin-usage"])


def _iso_days_ago(days: int) -> str:
    return (datetime.now(UTC) - timedelta(days=days)).isoformat()


def _tenant_last_active(supa, tenant_id: str) -> str | None:
    profiles = (
        supa.table("profiles")
        .select("id")
        .eq("tenant_id", tenant_id)
        .execute()
    )
    latest: str | None = None
    for profile in profiles.data or []:
        try:
            user = supa.auth.admin.get_user_by_id(profile["id"])
            ts = user.user.last_sign_in_at if user and user.user else None
            if not ts:
                continue
            ts_str = ts if isinstance(ts, str) else ts.isoformat()
            if latest is None or ts_str > latest:
                latest = ts_str
        except Exception:
            continue
    return latest


def _at_risk_row(row: dict[str, Any], *, reason: str, last_active_at: str | None) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row.get("name", ""),
        "plan": row.get("plan", "free"),
        "plan_status": row.get("plan_status", "active"),
        "is_active": row.get("is_active", True),
        "last_import_at": row.get("last_import_at"),
        "last_active_at": last_active_at,
        "reason": reason,
    }


@router.get("/at-risk")
@limiter.limit(ADMIN_READ_LIMIT)
def at_risk_tenants(
    request: Request,
    _admin: SuperAdmin,
) -> dict[str, Any]:
    supa = get_supabase_service_client()
    cutoff = _iso_days_ago(14)
    tenants = (
        supa.table("tenants")
        .select("id, name, plan, plan_status, is_active, created_at")
        .eq("is_active", True)
        .execute()
    ).data or []

    no_import_14d: list[dict[str, Any]] = []
    no_login_14d: list[dict[str, Any]] = []
    past_due: list[dict[str, Any]] = []

    for row in tenants:
        tid = row["id"]
        if row.get("plan_status") == "past_due":
            past_due.append(
                _at_risk_row(row, reason="past_due", last_active_at=_tenant_last_active(supa, tid))
            )
            continue

        last_import = (
            supa.table("import_jobs")
            .select("created_at")
            .eq("tenant_id", tid)
            .eq("status", "completed")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        last_import_at = last_import.data[0]["created_at"] if last_import.data else None
        row["last_import_at"] = last_import_at

        if not last_import_at or last_import_at < cutoff:
            no_import_14d.append(
                _at_risk_row(row, reason="no_import_14d", last_active_at=_tenant_last_active(supa, tid))
            )

        last_active = _tenant_last_active(supa, tid)
        if not last_active or last_active < cutoff:
            no_login_14d.append(
                _at_risk_row(row, reason="no_login_14d", last_active_at=last_active)
            )

    return {
        "no_import_14d": no_import_14d,
        "no_login_14d": no_login_14d,
        "past_due": past_due,
    }
