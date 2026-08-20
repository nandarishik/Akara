from datetime import date

from app.domain.copilot.date_range import (
    parse_result_limit,
    resolve_date_range_for_question,
)


def test_parse_result_limit_from_question() -> None:
    assert parse_result_limit("top 5 products", default=10, max_limit=50) == 5
    assert parse_result_limit("show products", default=10, max_limit=50) == 10


def test_resolve_uses_full_data_range_by_default() -> None:
    start, end = resolve_date_range_for_question(
        "what are my top products",
        ("2025-12-01", "2025-12-07"),
        reference_date=date(2026, 7, 23),
    )
    assert start == "2025-12-01"
    assert end == "2025-12-07"


def test_resolve_last_month_clamped_to_data() -> None:
    start, end = resolve_date_range_for_question(
        "top products last month",
        ("2025-12-01", "2025-12-07"),
        reference_date=date(2026, 7, 23),
    )
    assert start == "2025-12-01"
    assert end == "2025-12-07"


def test_resolve_no_data_uses_reference_day() -> None:
    start, end = resolve_date_range_for_question(
        "hello",
        None,
        reference_date=date(2026, 7, 23),
    )
    assert start == "2026-07-23"
    assert end == "2026-07-23"
