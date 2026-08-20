"""Resolve query date ranges from user language + tenant data bounds."""

from __future__ import annotations

import re
from datetime import date, timedelta


def parse_result_limit(question: str, default: int, max_limit: int) -> int:
    match = re.search(r"\btop\s+(\d+)\b", question.lower())
    if match:
        return min(int(match.group(1)), max_limit)
    return default


def resolve_date_range_for_question(
    question: str,
    available_range: tuple[str, str] | None,
    reference_date: date | None = None,
) -> tuple[str, str]:
    """
    Map relative phrases (last month, last week, etc.) to concrete dates.
    Clamps to the tenant's available data range when data exists.
    """
    ref = reference_date or date.today()

    if available_range is None:
        day = ref.isoformat()
        return day, day

    data_min = date.fromisoformat(available_range[0])
    data_max = date.fromisoformat(available_range[1])
    q = question.lower()

    if "last month" in q:
        first_of_this_month = ref.replace(day=1)
        last_of_prev_month = first_of_this_month - timedelta(days=1)
        start = last_of_prev_month.replace(day=1)
        end = last_of_prev_month
    elif "last week" in q:
        end = ref - timedelta(days=1)
        start = end - timedelta(days=6)
    elif "yesterday" in q:
        start = end = ref - timedelta(days=1)
    elif "this month" in q:
        start = ref.replace(day=1)
        end = ref
    elif "today" in q:
        start = end = ref
    else:
        return available_range[0], available_range[1]

    clamped_start = max(start, data_min)
    clamped_end = min(end, data_max)
    if clamped_start > clamped_end:
        return available_range[0], available_range[1]
    return clamped_start.isoformat(), clamped_end.isoformat()
