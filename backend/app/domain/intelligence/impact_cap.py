"""Cap expected_impact_max at MAX_EXPECTED_IMPACT_INR. Store row with note."""

from __future__ import annotations

from app.core.config import settings

IMPACT_CAP_NOTE = "Impact capped at configured Phase 11 ceiling."


def apply_impact_cap(expected_min: float, expected_max: float) -> tuple[float, float, str | None]:
    cap = float(getattr(settings, "max_expected_impact_inr", 500_000) or 500_000)
    note = None
    if expected_max > cap:
        scale = cap / expected_max if expected_max else 1.0
        expected_min = round(expected_min * scale, 2)
        expected_max = cap
        note = IMPACT_CAP_NOTE
    return expected_min, expected_max, note
