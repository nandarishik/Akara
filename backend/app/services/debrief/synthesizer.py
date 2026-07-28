"""LLM synthesis for weekly debrief prose."""

from __future__ import annotations

import json
import logging
import time
from datetime import date, timedelta
from typing import Any
from uuid import UUID

from app.core.config import settings
from app.services.llm_cost_logger import log_llm_cost
from app.services.debrief.engine import format_inr
from app.services.debrief.models import DebriefData, ProductChange, ZoneChange
from app.services.debrief.validator import validate_metadata
from app.services.llm.openrouter import OpenRouterClient

logger = logging.getLogger(__name__)

SYSTEM = """You are AKARA's weekly business debrief writer for Indian SMB owners
(FMCG distributors, garages, pharmacies, cafés, retail).
Return ONLY valid JSON. Write like a sharp CFO briefing the owner over chai —
specific names, rupee amounts, and one clear takeaway per bullet.
Never invent numbers. Never say "boost marketing" unless context supports it.
Headline: one punchy sentence with the biggest rupee move."""


def _next_monday_after(d: date) -> date:
    days_ahead = (7 - d.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    return d + timedelta(days=days_ahead)


def _zones_meaningful(zones: list[ZoneChange]) -> bool:
    if not zones:
        return False
    non_unknown = [z for z in zones if z.zone != "Unknown"]
    if non_unknown:
        return any(z.change_inr != 0 for z in non_unknown)
    return len(zones) > 1 and any(z.change_inr != 0 for z in zones)


def _product_insight(p: ProductChange, positive: bool) -> dict[str, Any]:
    change = abs(p.change_inr)
    if positive:
        return {
            "title": f"{p.product} surged {format_inr(change)}",
            "detail": (
                f"{format_inr(p.this_week)} this week vs {format_inr(p.prior_week)} last week "
                f"(+{p.change_pct:.0f}%)."
            ),
            "impact_inr": change,
            "hypothesis": "",
        }
    return {
        "title": f"{p.product} lost {format_inr(change)}",
        "detail": (
            f"{format_inr(p.this_week)} this week vs {format_inr(p.prior_week)} last week "
            f"({p.change_pct:.0f}%)."
        ),
        "hypothesis": "Check pricing, stock-outs, or competitor activity on this SKU.",
        "impact_inr": change,
    }


def _build_went_right(data: DebriefData) -> list[dict[str, Any]]:
    max_items = 2 if data.limited_mode else 3
    items: list[dict[str, Any]] = []

    if _zones_meaningful(data.zone_changes):
        for z in sorted(data.zone_changes, key=lambda x: x.change_inr, reverse=True):
            if z.change_inr > 0 and z.zone != "Unknown":
                items.append({
                    "title": f"{z.zone} gained {format_inr(z.change_inr)}",
                    "detail": (
                        f"{format_inr(z.this_week)} this week vs "
                        f"{format_inr(z.prior_week)} prior week."
                    ),
                    "impact_inr": z.change_inr,
                })
            if len(items) >= max_items:
                break

    for p in data.gaining_products:
        if len(items) >= max_items:
            break
        items.append(_product_insight(p, positive=True))

    for party in data.reengaged_parties:
        if len(items) >= max_items:
            break
        items.append({
            "title": f"{party.party} is back",
            "detail": "Ordered this week after 3+ weeks of silence — worth a thank-you call.",
            "impact_inr": 0,
        })

    best_day = max(data.weekday_patterns, key=lambda w: w.this_week, default=None)
    if best_day and best_day.trailing_avg and best_day.this_week > best_day.trailing_avg * 1.08:
        if len(items) < max_items:
            items.append({
                "title": f"Strong {best_day.weekday}",
                "detail": (
                    f"{format_inr(best_day.this_week)} vs {format_inr(best_day.trailing_avg)} "
                    f"trailing average — best day of the week."
                ),
                "impact_inr": best_day.this_week - best_day.trailing_avg,
            })

    wm = data.week_metrics
    if len(items) < max_items and wm.prior_orders and wm.orders > wm.prior_orders:
        items.append({
            "title": "Order volume held up",
            "detail": f"{wm.orders} orders vs {wm.prior_orders} last week despite revenue mix.",
            "impact_inr": 0,
        })

    while len(items) < max_items:
        items.append({
            "title": "Steady week",
            "detail": "No major positive spikes — focus on the actions below.",
            "impact_inr": 0,
        })
    return items[:max_items]


def _build_went_wrong(data: DebriefData) -> list[dict[str, Any]]:
    max_items = 2 if data.limited_mode else 3
    items: list[dict[str, Any]] = []

    if _zones_meaningful(data.zone_changes):
        for z in sorted(data.zone_changes, key=lambda x: x.change_inr):
            if z.change_inr < 0 and z.zone != "Unknown":
                items.append({
                    "title": f"{z.zone} dropped {format_inr(abs(z.change_inr))}",
                    "detail": (
                        f"{format_inr(z.this_week)} this week vs "
                        f"{format_inr(z.prior_week)} prior week."
                    ),
                    "hypothesis": "Follow up with parties in this zone early this week.",
                    "impact_inr": abs(z.change_inr),
                })
            if len(items) >= max_items:
                break

    for p in data.declining_products:
        if len(items) >= max_items:
            break
        item = _product_insight(p, positive=False)
        items.append(item)

    for party in data.churned_parties:
        if len(items) >= max_items:
            break
        items.append({
            "title": f"{party.party} went quiet",
            "detail": "Ordered last week but not this week.",
            "hypothesis": "Credit limit, stock issue, or switched supplier — call today.",
            "impact_inr": 0,
        })

    wm = data.week_metrics
    if len(items) < max_items and wm.prior_revenue and wm.revenue < wm.prior_revenue:
        drop = wm.prior_revenue - wm.revenue
        items.append({
            "title": f"Revenue down {format_inr(drop)}",
            "detail": (
                f"{format_inr(wm.revenue)} this week vs {format_inr(wm.prior_revenue)} "
                f"last week."
            ),
            "hypothesis": "Mix of fewer orders or lower ticket size — see product movers.",
            "impact_inr": drop,
        })

    while len(items) < max_items:
        items.append({
            "title": "No major red flags",
            "detail": "Nothing critical flagged this week.",
            "hypothesis": "",
            "impact_inr": 0,
        })
    return items[:max_items]


def _build_actions(data: DebriefData) -> list[dict[str, Any]]:
    max_items = 2 if data.limited_mode else 3
    actions: list[dict[str, Any]] = []

    for p in data.churned_parties[:3]:
        actions.append({
            "title": f"Call {p.party}",
            "detail": f"Silent this week{f' ({p.zone})' if p.zone else ''}.",
            "urgency": "high",
        })

    for p in data.declining_products[:2]:
        if len(actions) >= max_items:
            break
        actions.append({
            "title": f"Review {p.product}",
            "detail": f"Down {abs(p.change_pct):.0f}% WoW ({format_inr(abs(p.change_inr))}).",
            "urgency": "medium",
        })

    for o in data.outstanding_top5[:2]:
        if len(actions) >= max_items:
            break
        actions.append({
            "title": f"Collect from {o.party}",
            "detail": f"{format_inr(o.amount)} outstanding — cash stuck on the table.",
            "urgency": "high" if o.amount >= 50_000 else "medium",
        })

    while len(actions) < max_items:
        actions.append({
            "title": "Scan party-level sales in Copilot",
            "detail": "Ask who grew and who slipped before your next customer round.",
            "urgency": "low",
        })
    return actions[:max_items]


def _build_insights(data: DebriefData) -> dict[str, Any]:
    wm = data.week_metrics
    churn = [{"party": p.party, "zone": p.zone} for p in data.churned_parties[:8]]
    winback = [{"party": p.party, "zone": p.zone} for p in data.reengaged_parties[:5]]
    movers: list[dict[str, Any]] = []
    for p in data.gaining_products[:4]:
        movers.append({
            "name": p.product,
            "change_inr": p.change_inr,
            "change_pct": p.change_pct,
            "direction": "up",
            "this_week": p.this_week,
            "prior_week": p.prior_week,
        })
    for p in data.declining_products[:4]:
        movers.append({
            "name": p.product,
            "change_inr": p.change_inr,
            "change_pct": p.change_pct,
            "direction": "down",
            "this_week": p.this_week,
            "prior_week": p.prior_week,
        })

    next_drop = _next_monday_after(data.week_end)
    if churn:
        hook = (
            f"Next Monday ({next_drop.strftime('%d %b')}): we'll score whether "
            f"{churn[0]['party']} and {max(len(churn) - 1, 0)} other quiet accounts came back."
        )
    elif data.declining_products:
        prod = data.declining_products[0].product
        hook = f"Next Monday: does {prod} keep sliding, or did you stop the bleed?"
    elif wm.prior_revenue and wm.revenue > wm.prior_revenue:
        hook = f"Next Monday: can you beat {format_inr(wm.revenue)} two weeks in a row?"
    else:
        hook = f"Next debrief drops {next_drop.strftime('%A %d %b')}, 7:00 AM IST."

    return {
        "week_metrics": {
            "revenue": wm.revenue,
            "prior_revenue": wm.prior_revenue,
            "orders": wm.orders,
            "prior_orders": wm.prior_orders,
            "parties": wm.parties,
            "prior_parties": wm.prior_parties,
        },
        "weekday_pulse": [
            {
                "day": w.weekday[:3],
                "weekday": w.weekday,
                "revenue": w.this_week,
                "trailing_avg": w.trailing_avg,
            }
            for w in data.weekday_patterns
        ],
        "product_movers": movers,
        "churn_watch": churn,
        "win_back": winback,
        "outstanding": [
            {"party": o.party, "amount": o.amount, "amount_fmt": format_inr(o.amount)}
            for o in data.outstanding_top5
        ],
        "next_drop": next_drop.isoformat(),
        "next_hook": hook,
    }


def _fallback_metadata(data: DebriefData) -> dict[str, Any]:
    wm = data.week_metrics
    change = wm.revenue - wm.prior_revenue
    direction = "up" if change >= 0 else "down"
    headline = (
        f"Revenue {'grew' if change >= 0 else 'fell'} {format_inr(abs(change))} vs last week."
        if wm.prior_revenue
        else f"This week revenue was {format_inr(wm.revenue)}."
    )

    went_right = _build_went_right(data)
    went_wrong = _build_went_wrong(data)
    actions = _build_actions(data)

    wow_pct = 0.0
    if wm.prior_revenue:
        wow_pct = round((wm.revenue - wm.prior_revenue) / wm.prior_revenue * 100, 1)

    return {
        "schema_version": 2,
        "week_start": data.week_start.isoformat(),
        "week_end": data.week_end.isoformat(),
        "headline": headline,
        "went_right": went_right,
        "went_wrong": went_wrong,
        "momentum": {
            "this_week_revenue": wm.revenue,
            "this_week_revenue_fmt": format_inr(wm.revenue),
            "prior_week_revenue": wm.prior_revenue,
            "prior_week_revenue_fmt": format_inr(wm.prior_revenue),
            "wow_change_pct": wow_pct,
            "wow_direction": direction,
            "avg_30d_daily": data.rolling.avg_30d_daily,
            "avg_60d_daily": data.rolling.avg_60d_daily,
            "avg_90d_daily": data.rolling.avg_90d_daily,
            "trend_30d": data.rolling.trend_30d,
            "trend_60d": data.rolling.trend_60d,
            "trend_90d": data.rolling.trend_90d,
            "projected_month": data.rolling.projected_month,
            "projected_month_fmt": format_inr(data.rolling.projected_month),
            "projection_note": f"At current pace, this month projects to {format_inr(data.rolling.projected_month)}.",
        },
        "actions": actions,
        "insights": _build_insights(data),
        "data_freshness": (data.data_freshness or data.week_end).isoformat(),
        "days_of_data": data.days_of_data,
        "limited_mode": data.limited_mode,
    }


def _build_prompt(data: DebriefData) -> str:
    ctx = json.dumps(data.to_context_dict(), indent=2)
    max_items = 2 if data.limited_mode else 3
    return f"""Write a weekly debrief JSON from this computed data only.

Context:
{ctx}

Return JSON with keys: headline, went_right (max {max_items}), went_wrong (max {max_items}),
actions (max {max_items}). Do not include momentum — it is computed separately.
Each went_right/went_wrong item: title, detail, impact_inr (int). went_wrong adds hypothesis.
Each action: title, detail, urgency (high|medium|low).
Do not invent names or numbers not in context."""


async def synthesize_metadata(
    data: DebriefData,
    tenant_id: UUID | None = None,
) -> dict[str, Any]:
    fallback = _fallback_metadata(data)
    if not settings.openrouter_api_key:
        return fallback

    client = OpenRouterClient(settings.openrouter_api_key)
    prompt = _build_prompt(data)
    started = time.monotonic()

    for attempt in range(2):
        try:
            raw = await client.complete(prompt, system=SYSTEM)
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0]
            parsed = json.loads(cleaned)
            merged = {**fallback, **parsed}
            merged["momentum"] = fallback["momentum"]
            merged["insights"] = fallback["insights"]
            merged["schema_version"] = 2
            merged["week_start"] = data.week_start.isoformat()
            merged["week_end"] = data.week_end.isoformat()
            merged["days_of_data"] = data.days_of_data
            merged["limited_mode"] = data.limited_mode
            merged["data_freshness"] = (data.data_freshness or data.week_end).isoformat()
            if validate_metadata(merged, data):
                if tenant_id:
                    latency_ms = int((time.monotonic() - started) * 1000)
                    est_in = max(1, len(prompt) // 4)
                    est_out = max(1, len(raw) // 4)
                    log_llm_cost(
                        tenant_id=tenant_id,
                        user_id=UUID("00000000-0000-0000-0000-000000000000"),
                        feature="weekly_debrief",
                        model=settings.openrouter_model,
                        input_tokens=est_in,
                        output_tokens=est_out,
                        latency_ms=latency_ms,
                    )
                return merged
            logger.warning("Debrief validation failed on attempt %d", attempt + 1)
        except Exception as exc:
            logger.warning("Debrief synthesis attempt %d failed: %s", attempt + 1, exc)

    return fallback
