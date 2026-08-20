"""Detect and fix debrief narrative that contradicts computed week metrics."""

from __future__ import annotations

import re
from typing import Any

from app.domain.debrief.engine import format_inr
from app.domain.debrief.models import DebriefData

_DECLINE_WORDS = re.compile(
    r"\b(declin\w*|drop\w*|fell|fallen|down|decrease\w*|slipped|lost|below)\b",
    re.I,
)
_GROWTH_WORDS = re.compile(
    r"\b(grew|growth|gain\w*|up|increase\w*|rose|ris\w*|higher|beat)\b",
    re.I,
)
_REVENUE_HINT = re.compile(r"\brevenue\b|₹|\binr\b", re.I)


def _item_text(item: dict[str, Any]) -> str:
    return " ".join(
        str(item.get(k, "") or "")
        for k in ("title", "detail", "hypothesis")
    )


def _item_claims_revenue_decline(item: dict[str, Any]) -> bool:
    text = _item_text(item)
    if not _REVENUE_HINT.search(text):
        return False
    return bool(_DECLINE_WORDS.search(text))


def _item_claims_revenue_growth(item: dict[str, Any]) -> bool:
    text = _item_text(item)
    if not _REVENUE_HINT.search(text):
        return False
    return bool(_GROWTH_WORDS.search(text))


def _headline_contradicts(revenue_up: bool, headline: str) -> bool:
    if not headline:
        return False
    if revenue_up and _DECLINE_WORDS.search(headline) and _REVENUE_HINT.search(headline):
        return True
    if not revenue_up and _GROWTH_WORDS.search(headline) and _REVENUE_HINT.search(headline):
        return True
    return False


def _week_revenues(metadata: dict[str, Any]) -> tuple[int | None, int | None]:
    momentum = metadata.get("momentum") or {}
    rev = momentum.get("this_week_revenue")
    prior = momentum.get("prior_week_revenue")
    wm = (metadata.get("insights") or {}).get("week_metrics") or {}
    if rev is None:
        rev = wm.get("revenue")
    if prior is None:
        prior = wm.get("prior_revenue")
    if rev is None or prior is None:
        return None, None
    return int(rev), int(prior)


def narrative_contradicts_metrics(metadata: dict[str, Any]) -> bool:
    """True when stored narrative direction disagrees with momentum / week_metrics."""
    rev, prior = _week_revenues(metadata)
    if rev is None or prior is None:
        return False

    revenue_up = rev >= prior

    for item in metadata.get("went_wrong", []):
        if isinstance(item, dict) and _item_claims_revenue_decline(item) and revenue_up:
            return True

    for item in metadata.get("went_right", []):
        if isinstance(item, dict) and _item_claims_revenue_growth(item) and not revenue_up:
            return True

    headline = str(metadata.get("headline") or "")
    if _headline_contradicts(revenue_up, headline):
        return True

    return False


def narrative_contradicts_data(metadata: dict[str, Any], data: DebriefData) -> bool:
    """Validate synthesized narrative against engine-computed week metrics."""
    wm = data.week_metrics
    if not wm.prior_revenue:
        return False

    probe = {
        **metadata,
        "momentum": {
            **(metadata.get("momentum") or {}),
            "this_week_revenue": wm.revenue,
            "prior_week_revenue": wm.prior_revenue,
        },
    }
    return narrative_contradicts_metrics(probe)


def strip_contradictory_narrative(metadata: dict[str, Any]) -> dict[str, Any]:
    """Remove narrative bullets that disagree with known revenue direction."""
    rev, prior = _week_revenues(metadata)
    if rev is None or prior is None:
        return metadata

    revenue_up = rev >= prior
    if revenue_up:
        metadata["went_wrong"] = [
            i
            for i in metadata.get("went_wrong", [])
            if not (isinstance(i, dict) and _item_claims_revenue_decline(i))
        ]
        if _headline_contradicts(revenue_up, str(metadata.get("headline") or "")):
            metadata["headline"] = (
                f"Revenue grew {format_inr(rev - prior)} vs last week."
            )
    else:
        metadata["went_right"] = [
            i
            for i in metadata.get("went_right", [])
            if not (isinstance(i, dict) and _item_claims_revenue_growth(i))
        ]
        if _headline_contradicts(revenue_up, str(metadata.get("headline") or "")):
            metadata["headline"] = (
                f"Revenue fell {format_inr(prior - rev)} vs last week."
            )
    return metadata


def reconcile_narrative(
    metadata: dict[str, Any],
    data: DebriefData | None,
) -> dict[str, Any]:
    """Replace stale LLM narrative with engine-built copy when metrics disagree."""
    if not narrative_contradicts_metrics(metadata):
        return metadata

    if data is not None and data.days_of_data >= 7:
        from app.domain.debrief.synthesizer import _fallback_metadata

        fb = _fallback_metadata(data)
        metadata["went_right"] = fb["went_right"]
        metadata["went_wrong"] = fb["went_wrong"]
        metadata["actions"] = fb["actions"]
        metadata["headline"] = fb["headline"]
        return metadata

    return strip_contradictory_narrative(metadata)
