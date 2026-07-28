"""Fill missing momentum / insights on stored debrief reports for display."""

from __future__ import annotations

import copy
from datetime import date
from uuid import UUID

from supabase import Client

from app.services.debrief.engine import WeeklyDebriefEngine, format_inr
from app.services.debrief.synthesizer import _fallback_metadata


def _momentum_incomplete(momentum: dict) -> bool:
    if momentum.get("this_week_revenue") is not None:
        return False
    fmt = momentum.get("this_week_revenue_fmt")
    return fmt in (None, "", "—", "₹—")


def _apply_week_metrics(momentum: dict, wm: dict) -> None:
    rev = int(wm.get("revenue") or 0)
    prior = int(wm.get("prior_revenue") or 0)
    momentum["this_week_revenue"] = rev
    momentum["prior_week_revenue"] = prior
    momentum["this_week_revenue_fmt"] = format_inr(rev)
    momentum["prior_week_revenue_fmt"] = format_inr(prior)
    wow = 0.0
    if prior:
        wow = round((rev - prior) / prior * 100, 1)
    momentum["wow_change_pct"] = wow
    momentum["wow_direction"] = "up" if rev >= prior else "down"


def enrich_debrief_metadata(
    metadata: dict,
    *,
    tenant_id: UUID | None = None,
    supabase: Client | None = None,
) -> dict:
    """Ensure momentum KPIs exist for UI — from insights, engine recompute, or leave as-is."""
    meta = copy.deepcopy(metadata)
    momentum = meta.setdefault("momentum", {})
    insights = meta.setdefault("insights", {})
    wm = insights.get("week_metrics")

    if wm and _momentum_incomplete(momentum):
        _apply_week_metrics(momentum, wm)
        return meta

    if not _momentum_incomplete(momentum):
        return meta

    if tenant_id is None or supabase is None:
        return meta

    week_end = meta.get("week_end")
    if not week_end:
        return meta

    try:
        ref = date.fromisoformat(str(week_end)[:10])
    except ValueError:
        return meta

    data = WeeklyDebriefEngine(supabase).compute(tenant_id, reference=ref)
    if data.days_of_data < 7:
        return meta

    fb = _fallback_metadata(data)
    meta["momentum"] = {**momentum, **fb["momentum"]}
    if not insights.get("week_metrics"):
        meta["insights"] = {**insights, **(fb.get("insights") or {})}
    return meta
