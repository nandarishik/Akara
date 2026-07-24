"""UTC / IST (Asia/Kolkata) time utilities for AKARA Phase 2.

All timestamps are stored as UTC in the database.
All display/reset logic that refers to Indian Standard Time uses this module.

Key rules:
 - UTC+5:30 is IST (Asia/Kolkata). IST has no DST.
 - Daily counters reset at midnight IST = 18:30 UTC previous day.
 - Monthly counters reset on the 1st of each month at 00:00 IST.
 - Weekly debrief scheduler runs at 01:30 UTC Monday = 07:00 IST Monday.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
UTC = UTC


def now_utc() -> datetime:
    """Current moment as a UTC-aware datetime."""
    return datetime.now(UTC)


def now_ist() -> datetime:
    """Current moment expressed in IST."""
    return datetime.now(IST)


def to_ist(dt: datetime) -> datetime:
    """Convert any aware datetime to IST."""
    return dt.astimezone(IST)


def to_utc(dt: datetime) -> datetime:
    """Convert any aware datetime to UTC."""
    return dt.astimezone(UTC)


def today_ist() -> date:
    """The current calendar date in IST (may differ from UTC date near midnight)."""
    return now_ist().date()


def start_of_month_utc() -> datetime:
    """Midnight IST on the first of the current IST month, expressed as UTC.

    Used for monthly counter resets.  The reset boundary is 00:00 IST which
    equals 18:30 UTC on the last day of the previous month.
    """
    ist_now = now_ist()
    first_of_month_ist = ist_now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return to_utc(first_of_month_ist)


def start_of_day_utc() -> datetime:
    """Midnight IST today, expressed as UTC.

    Used for daily counter resets.
    """
    ist_now = now_ist()
    midnight_ist = ist_now.replace(hour=0, minute=0, second=0, microsecond=0)
    return to_utc(midnight_ist)


def ist_date_for(dt: datetime) -> date:
    """Return the IST calendar date for the given UTC-aware datetime."""
    return to_ist(dt).date()


def month_key_ist(dt: datetime | None = None) -> date:
    """Return the first-of-month IST date, used as a monthly counter key.

    Stored as DATE in the `usage_tracking.month` column.
    Always the 1st of the month in IST time.
    """
    reference = to_ist(dt) if dt else now_ist()
    return reference.replace(day=1).date()


def format_ist(dt: datetime) -> str:
    """Human-readable IST timestamp for logs and UI."""
    return to_ist(dt).strftime("%Y-%m-%d %H:%M:%S IST")


def last_completed_week_ist(reference: date | None = None) -> tuple[date, date]:
    """Return (Monday, Sunday) for the most recently completed Mon–Sun week in IST."""
    today = reference or today_ist()
    this_monday = today - timedelta(days=today.weekday())
    last_sunday = this_monday - timedelta(days=1)
    last_monday = last_sunday - timedelta(days=6)
    return last_monday, last_sunday


def weekly_debrief_utc_schedule() -> str:
    """Cron expression for weekly debrief: 07:00 IST Monday = 01:30 UTC Monday."""
    return "30 1 * * 1"
