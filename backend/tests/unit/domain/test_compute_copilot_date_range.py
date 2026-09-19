"""Unit tests for compute_copilot_date_range (DEV2)."""

from datetime import date

from app.domain.copilot.date_range import compute_copilot_date_range


def test_compute_copilot_date_range_uses_min_and_today() -> None:
    result = compute_copilot_date_range(
        ("2026-03-01", "2026-08-30"),
        today=date(2026, 9, 9),
    )
    assert result == ("2026-03-01", "2026-09-09")


def test_compute_copilot_date_range_fallback_2024() -> None:
    result = compute_copilot_date_range(None, today=date(2026, 9, 9))
    assert result == ("2024-01-01", "2026-09-09")
