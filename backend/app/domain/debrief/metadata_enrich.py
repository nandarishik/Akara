"""Fill missing momentum / insights on stored debrief reports for display."""

from __future__ import annotations

import copy
from datetime import date
from uuid import UUID

from supabase import Client

from app.domain.debrief.engine import WeeklyDebriefEngine, format_inr
from app.domain.debrief.models import DebriefData
from app.domain.debrief.narrative_reconcile import reconcile_narrative
from app.domain.debrief.synthesizer import _fallback_metadata


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


def _load_debrief_data(
    supabase: Client,
    tenant_id: UUID,
    week_end: str,
) -> DebriefData | None:
    try:
        ref = date.fromisoformat(str(week_end)[:10])
    except ValueError:
        return None
    return WeeklyDebriefEngine(supabase).compute(tenant_id, reference=ref)


def enrich_debrief_metadata(
    metadata: dict,
    *,
    tenant_id: UUID | None = None,
    supabase: Client | None = None,
) -> dict:
    """Ensure momentum KPIs exist and narrative matches computed week metrics."""
    meta = copy.deepcopy(metadata)
    momentum = meta.setdefault("momentum", {})
    insights = meta.setdefault("insights", {})
    wm = insights.get("week_metrics")
    data: DebriefData | None = None

    if wm and _momentum_incomplete(momentum):
        _apply_week_metrics(momentum, wm)

    elif _momentum_incomplete(momentum) and tenant_id and supabase and meta.get("week_end"):
        data = _load_debrief_data(supabase, tenant_id, meta["week_end"])
        if data and data.days_of_data >= 7:
            fb = _fallback_metadata(data)
            meta["momentum"] = {**momentum, **fb["momentum"]}
            if not insights.get("week_metrics"):
                meta["insights"] = {**insights, **(fb.get("insights") or {})}

    elif tenant_id and supabase and meta.get("week_end"):
        loaded = _load_debrief_data(supabase, tenant_id, meta["week_end"])
        if loaded and loaded.days_of_data >= 7:
            data = loaded

    return reconcile_narrative(meta, data)
