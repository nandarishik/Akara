"""FIX-04 / helper table cases for compute_copilot_date_range (DEV2).

Do not import chat() — helper only.
"""

from datetime import date

from app.domain.copilot.date_range import compute_copilot_date_range


def test_empty_tuple_uses_fallback() -> None:
    result = compute_copilot_date_range(("", ""), today=date(2026, 9, 9))
    assert result == ("2024-01-01", "2026-09-09")


def test_falsy_start_uses_fallback() -> None:
    result = compute_copilot_date_range(("", "2026-08-01"), today=date(2026, 9, 9))
    assert result == ("2024-01-01", "2026-09-09")
