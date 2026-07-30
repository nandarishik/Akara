"""Structured operational snapshot for founder AI — no raw tenant PII."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.core.tenant import get_supabase_service_client

PLAN_MRR_INR = {"pro": 7999, "business": 13999}


def build_ops_context() -> dict[str, Any]:
    supa = get_supabase_service_client()
    now = datetime.now(UTC)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    tenants = supa.table("tenants").select(
        "id, plan, plan_status, created_at"
    ).execute().data or []

    by_plan = {"free": 0, "pro": 0, "business": 0}
    mrr = 0
    churned = 0
    for t in tenants:
        plan = t.get("plan") or "free"
        if plan in by_plan:
            by_plan[plan] += 1
        if t.get("plan_status") in ("active", "trialing") and plan in PLAN_MRR_INR:
            mrr += PLAN_MRR_INR[plan]
        if t.get("plan_status") == "cancelled":
            churned += 1

    llm_rows = (
        supa.table("llm_cost_log")
        .select("cost_usd, feature")
        .gte("created_at", month_start.isoformat())
        .execute()
    ).data or []
    llm_cost = sum(float(r.get("cost_usd") or 0) for r in llm_rows)

    cron_failures = (
        supa.table("cron_runs")
        .select("job_name, status, error_message, finished_at")
        .eq("status", "failed")
        .order("finished_at", desc=True)
        .limit(10)
        .execute()
    ).data or []

    feedback = (
        supa.table("copilot_feedback")
        .select("rating")
        .gte("created_at", month_start.isoformat())
        .execute()
    ).data or []
    positive = sum(1 for f in feedback if f.get("rating") == 1)
    negative = sum(1 for f in feedback if f.get("rating") == -1)

    quota_hotspots: list[dict[str, Any]] = []
    for t in tenants[:100]:
        tid = t["id"]
        try:
            usage = supa.rpc("get_current_usage", {"p_tenant_id": tid}).execute()
            data = usage.data or {}
            used = int(data.get("copilot_calls") or 0)
            plan = t.get("plan") or "free"
            limit = 15 if plan == "free" else (500 if plan == "pro" else -1)
            if limit > 0 and used / limit >= 0.8:
                quota_hotspots.append({
                    "tenant_id": tid,
                    "plan": plan,
                    "copilot_used": used,
                    "copilot_limit": limit,
                    "pct": round(used / limit * 100, 1),
                })
        except Exception:
            continue

    quota_hotspots.sort(key=lambda x: x["pct"], reverse=True)

    return {
        "generated_at": now.isoformat(),
        "mrr_inr": mrr,
        "arr_inr": mrr * 12,
        "tenants_by_plan": by_plan,
        "total_tenants": len(tenants),
        "churned_this_month": churned,
        "llm_cost_usd_this_month": round(llm_cost, 4),
        "estimated_gross_margin_pct": round((1 - (llm_cost * 85 / max(mrr, 1))) * 100, 2) if mrr else 0,
        "cron_failures": cron_failures,
        "copilot_feedback": {"positive": positive, "negative": negative},
        "quota_hotspots": quota_hotspots[:10],
    }


def ops_context_prompt(ctx: dict[str, Any]) -> str:
    """System prompt with exact numbers — founder copilot must cite these only."""
    import json

    return (
        "You are AKARA's founder operations copilot. Answer ONLY using the JSON snapshot below. "
        "If data is missing, say so — never invent numbers.\n\n"
        f"OPS_SNAPSHOT:\n{json.dumps(ctx, indent=2)}"
    )
