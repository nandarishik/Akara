"""Superadmin overview — activity feed and KPI stats."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Query, Request

from app.core.rate_limit import ADMIN_READ_LIMIT, limiter
from app.core.superadmin import SuperAdmin
from app.core.tenant import get_supabase_service_client

router = APIRouter(prefix="/overview", tags=["superadmin-overview"])
CUSTOMER_ACTIONS = (
    "question_asked",
    "import_completed",
    "import_failed",
    "payment_failed",
    "subscription_activated",
    "signup_completed",
    "superadmin_impersonate",
)


@router.get("/activity")
@limiter.limit(ADMIN_READ_LIMIT)
def overview_activity(
    request: Request,
    _admin: SuperAdmin,
    limit: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    supa = get_supabase_service_client()
    result = (
        supa.table("audit_log")
        .select("id, action, created_at, tenant_id, actor_email, details")
        .order("created_at", desc=True)
        .limit(limit * 3)
        .execute()
    )
    rows = result.data or []
    items: list[dict[str, Any]] = []
    tenant_names: dict[str, str] = {}
    tenant_plans: dict[str, str] = {}

    for row in rows:
        action = row.get("action") or ""
        if not any(k in action for k in CUSTOMER_ACTIONS) and not action.startswith(
            ("superadmin", "billing", "copilot")
        ):
            continue
        tid = row.get("tenant_id")
        tenant_name = None
        if tid:
            if tid not in tenant_names:
                t = (
                    supa.table("tenants")
                    .select("name, plan")
                    .eq("id", tid)
                    .maybe_single()
                    .execute()
                )
                tenant_names[tid] = (t.data or {}).get("name") or tid[:8]
                tenant_plans[tid] = (t.data or {}).get("plan") or "free"
            tenant_name = tenant_names[tid]
            tenant_plan = tenant_plans.get(tid)
        else:
            tenant_plan = None
        items.append(
            {
                "id": row["id"],
                "action": action,
                "created_at": row["created_at"],
                "tenant_id": tid,
                "tenant_name": tenant_name,
                "tenant_plan": tenant_plan,
                "actor_email": row.get("actor_email"),
                "details": row.get("details") or {},
                "highlight": action in (
                    "subscription_activated",
                    "payment_failed",
                    "superadmin_impersonate",
                ),
            }
        )
        if len(items) >= limit:
            break

    return {"items": items, "total": len(items)}


@router.get("/stats")
@limiter.limit(ADMIN_READ_LIMIT)
def overview_stats(
    request: Request,
    _admin: SuperAdmin,
) -> dict[str, Any]:
    supa = get_supabase_service_client()
    today_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)

    questions = (
        supa.table("llm_cost_log")
        .select("id", count="exact")
        .eq("feature", "copilot")
        .gte("created_at", today_start.isoformat())
        .execute()
    )
    signups = (
        supa.table("tenants")
        .select("id", count="exact")
        .gte("created_at", week_start.isoformat())
        .execute()
    )
    upgrades = (
        supa.table("audit_log")
        .select("id", count="exact")
        .gte("created_at", week_start.isoformat())
        .or_("action.ilike.%upgrade%,action.eq.subscription_activated")
        .execute()
    )
    churns = (
        supa.table("audit_log")
        .select("id", count="exact")
        .gte("created_at", week_start.isoformat())
        .or_("action.ilike.%churn%,action.ilike.%cancel%")
        .execute()
    )

    return {
        "questions_today": int(questions.count or 0),
        "new_this_week": {
            "signups": int(signups.count or 0),
            "upgrades": int(upgrades.count or 0),
            "churns": int(churns.count or 0),
        },
    }