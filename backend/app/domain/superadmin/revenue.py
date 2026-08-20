"""Shared revenue summary computation for superadmin endpoints and cron tasks."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from app.core.tenant import get_supabase_service_client

PLAN_MRR_INR: dict[str, int] = {
    "pro": 7999,
    "business": 13999,
}

USD_INR = 85


def _margin_pct(mrr_inr: float, llm_cost_usd: float) -> float:
    if mrr_inr <= 0:
        return 0.0
    return round((1 - (llm_cost_usd * USD_INR / mrr_inr)) * 100, 2)


def _snapshot_near_date(supa: Any, target: datetime) -> dict[str, Any] | None:
    """Return revenue snapshot closest to target date (within 7 days)."""
    window_start = (target - timedelta(days=7)).date().isoformat()
    window_end = (target + timedelta(days=7)).date().isoformat()
    rows = (
        supa.table("revenue_snapshots")
        .select("snapshot_date, mrr_inr, tenant_count, llm_cost_usd")
        .gte("snapshot_date", window_start)
        .lte("snapshot_date", window_end)
        .order("snapshot_date", desc=False)
        .execute()
    ).data or []
    if not rows:
        return None
    target_date = target.date()
    return min(
        rows,
        key=lambda r: abs(
            (datetime.fromisoformat(str(r["snapshot_date"])).date() - target_date).days
        ),
    )


def compute_mom_deltas(summary: dict[str, Any]) -> dict[str, Any]:
    supa = get_supabase_service_client()
    prior = _snapshot_near_date(supa, datetime.now(UTC) - timedelta(days=30))
    if not prior:
        return {
            "mrr_mom_pct": None,
            "margin_delta_pp": None,
            "active_tenants_delta": None,
        }

    prev_mrr = float(prior.get("mrr_inr") or 0)
    prev_tenants = int(prior.get("tenant_count") or 0)
    prev_margin = _margin_pct(prev_mrr, float(prior.get("llm_cost_usd") or 0))
    cur_mrr = float(summary["mrr_inr"])
    cur_margin = float(summary["estimated_gross_margin_pct"])
    cur_tenants = int(summary["total_active_tenants"])

    mrr_mom_pct = (
        round(((cur_mrr - prev_mrr) / prev_mrr) * 100, 1) if prev_mrr > 0 else None
    )
    return {
        "mrr_mom_pct": mrr_mom_pct,
        "margin_delta_pp": round(cur_margin - prev_margin, 1),
        "active_tenants_delta": cur_tenants - prev_tenants,
    }


def compute_revenue_summary() -> dict[str, Any]:
    supa = get_supabase_service_client()
    tenants = supa.table("tenants").select("id, plan, plan_status, created_at, is_active").execute()
    rows = tenants.data or []

    by_plan = {"free": 0, "pro": 0, "business": 0}
    mrr = 0
    active_count = 0
    for t in rows:
        plan = t.get("plan") or "free"
        if plan in by_plan:
            by_plan[plan] += 1
        if t.get("is_active", True):
            active_count += 1
        if t.get("plan_status") in ("active", "trialing") and plan in PLAN_MRR_INR:
            mrr += PLAN_MRR_INR[plan]

    month_start = datetime.now(UTC).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    new_paid = sum(
        1
        for t in rows
        if t.get("plan") in ("pro", "business")
        and t.get("created_at")
        and str(t["created_at"]) >= month_start.isoformat()
    )
    churned = sum(1 for t in rows if t.get("plan_status") == "cancelled")

    llm = (
        supa.table("llm_cost_log")
        .select("cost_usd")
        .gte("created_at", month_start.isoformat())
        .execute()
    )
    llm_cost = sum(float(r.get("cost_usd") or 0) for r in (llm.data or []))
    margin_pct = _margin_pct(mrr, llm_cost)

    summary = {
        "mrr_inr": mrr,
        "arr_inr": mrr * 12,
        "tenants_by_plan": by_plan,
        "total_active_tenants": active_count,
        "new_paid_this_month": new_paid,
        "churned_this_month": churned,
        "total_llm_cost_usd_this_month": round(llm_cost, 4),
        "estimated_gross_margin_pct": margin_pct,
    }
    summary.update(compute_mom_deltas(summary))
    return summary
