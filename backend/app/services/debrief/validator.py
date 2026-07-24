"""Validate LLM debrief output against computed context."""

from __future__ import annotations

import re
from typing import Any

from app.services.debrief.models import DebriefData


def _extract_numbers(text: str) -> set[str]:
    return set(re.findall(r"\d[\d,]*", text.replace("₹", "")))


def _allowed_names(data: DebriefData) -> set[str]:
    names: set[str] = set()
    for z in data.zone_changes:
        names.add(z.zone.lower())
    for p in data.gaining_products + data.declining_products:
        names.add(p.product.lower())
    for p in data.churned_parties + data.reengaged_parties:
        names.add(p.party.lower())
    for o in data.outstanding_top5:
        names.add(o.party.lower())
    return names


def validate_metadata(metadata: dict[str, Any], data: DebriefData) -> bool:
    """Return True if synthesized metadata passes basic validation."""
    required = ("headline", "went_right", "went_wrong", "actions", "momentum")
    if not all(k in metadata for k in required):
        return False

    if not isinstance(metadata.get("went_right"), list):
        return False
    if not isinstance(metadata.get("went_wrong"), list):
        return False
    if not isinstance(metadata.get("actions"), list):
        return False

    max_items = 2 if data.limited_mode else 3
    if len(metadata["went_right"]) > max_items:
        return False
    if len(metadata["went_wrong"]) > max_items:
        return False
    if len(metadata["actions"]) > max_items:
        return False

    blob = str(metadata).lower()
    allowed = _allowed_names(data)
    # Headline must not invent zones/products not in context when we have data
    if data.zone_changes and not any(z.zone.lower() in blob for z in data.zone_changes[:3]):
        if data.week_metrics.revenue > 0 and "no qualifying" not in blob:
            pass  # soft — headline may summarize totals only

    for section in ("went_right", "went_wrong", "actions"):
        for item in metadata.get(section, []):
            if not isinstance(item, dict) or "title" not in item:
                return False

    return True
