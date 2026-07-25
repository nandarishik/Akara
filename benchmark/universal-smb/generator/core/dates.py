"""Date helpers for benchmark generation."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from random import Random


def date_range(start: date, end: date) -> list[date]:
    days: list[date] = []
    current = start
    while current <= end:
        days.append(current)
        current += timedelta(days=1)
    return days


def month_key(d: date) -> str:
    return d.strftime("%Y-%m")


def random_business_date(rng: Random, start: date, end: date) -> date:
    span = (end - start).days
    return start + timedelta(days=rng.randint(0, span))


def format_date_variant(rng: Random, d: date, variant: int | None = None) -> str:
    """Return one of several messy date string formats."""
    v = variant if variant is not None else rng.randint(0, 4)
    if v == 0:
        return d.strftime("%d/%m/%Y")
    if v == 1:
        return d.strftime("%d-%m-%y")
    if v == 2:
        return d.isoformat()
    if v == 3:
        return d.strftime("%d-%b-%y")
    return d.strftime("%Y/%m/%d")


def excel_serial(d: date) -> float:
    """Excel serial date (1900 date system approximation)."""
    epoch = date(1899, 12, 30)
    return float((d - epoch).days)


def parse_iso(s: str) -> date:
    return datetime.strptime(s, "%Y-%m-%d").date()
