"""LLM synthesis for weekly debrief prose."""

from __future__ import annotations

import json
import logging
import time
from typing import Any
from uuid import UUID

from app.core.config import settings
from app.services.llm_cost_logger import log_llm_cost
from app.services.debrief.engine import format_inr
from app.services.debrief.models import DebriefData
from app.services.debrief.validator import validate_metadata
from app.services.llm.openrouter import OpenRouterClient

logger = logging.getLogger(__name__)

SYSTEM = """You are AKARA's weekly business debrief writer for Indian FMCG distributors.
Return ONLY valid JSON matching the schema. Use plain English, max 2 sentences per detail.
Never calculate totals — use only numbers from the provided context.
Name specific parties, zones, and products when present in context."""


def _fallback_metadata(data: DebriefData) -> dict[str, Any]:
    wm = data.week_metrics
    change = wm.revenue - wm.prior_revenue
    direction = "up" if change >= 0 else "down"
    headline = (
        f"Revenue {'grew' if change >= 0 else 'fell'} {format_inr(abs(change))} vs last week."
        if wm.prior_revenue
        else f"This week revenue was {format_inr(wm.revenue)}."
    )

    went_right = []
    for z in sorted(data.zone_changes, key=lambda x: x.change_inr, reverse=True):
        if z.change_inr > 0:
            went_right.append({
                "title": f"{z.zone} gained {format_inr(z.change_inr)}",
                "detail": f"{format_inr(z.this_week)} this week vs {format_inr(z.prior_week)} prior week.",
                "impact_inr": z.change_inr,
            })
        if len(went_right) >= (2 if data.limited_mode else 3):
            break
    while len(went_right) < (2 if data.limited_mode else 3):
        went_right.append({
            "title": "No qualifying positive change",
            "detail": "Upload more data or wait for next week for clearer patterns.",
            "impact_inr": 0,
        })

    went_wrong = []
    for z in sorted(data.zone_changes, key=lambda x: x.change_inr):
        if z.change_inr < 0:
            went_wrong.append({
                "title": f"{z.zone} dropped {format_inr(abs(z.change_inr))}",
                "detail": f"{format_inr(z.this_week)} this week vs {format_inr(z.prior_week)} prior week.",
                "hypothesis": "Follow up with parties in this zone early this week.",
                "impact_inr": abs(z.change_inr),
            })
        if len(went_wrong) >= (2 if data.limited_mode else 3):
            break
    while len(went_wrong) < (2 if data.limited_mode else 3):
        went_wrong.append({
            "title": "No qualifying negative change",
            "detail": "No significant declines detected this week.",
            "hypothesis": "",
            "impact_inr": 0,
        })

    actions = []
    for p in data.churned_parties[:3]:
        actions.append({
            "title": f"Call {p.party}",
            "detail": f"Party ordered last week but not this week ({p.zone or 'unknown zone'}).",
            "urgency": "high",
        })
    while len(actions) < (2 if data.limited_mode else 3):
        actions.append({
            "title": "Review top outstanding parties",
            "detail": "Collect overdue balances to improve cash flow.",
            "urgency": "medium",
        })

    wow_pct = 0.0
    if wm.prior_revenue:
        wow_pct = round((wm.revenue - wm.prior_revenue) / wm.prior_revenue * 100, 1)

    return {
        "schema_version": 1,
        "week_start": data.week_start.isoformat(),
        "week_end": data.week_end.isoformat(),
        "headline": headline,
        "went_right": went_right[: 2 if data.limited_mode else 3],
        "went_wrong": went_wrong[: 2 if data.limited_mode else 3],
        "momentum": {
            "this_week_revenue": wm.revenue,
            "this_week_revenue_fmt": format_inr(wm.revenue),
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
        "actions": actions[: 2 if data.limited_mode else 3],
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
actions (max {max_items}), momentum (use provided rolling numbers).
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
            merged["schema_version"] = 1
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
