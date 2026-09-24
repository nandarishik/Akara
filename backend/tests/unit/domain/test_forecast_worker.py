from datetime import date, timedelta

from app.domain.intelligence.forecast import (
    consecutive_days,
    forecast_skip_reason,
    run_autoarima,
)


def test_skip_ten_days() -> None:
    days = [date(2026, 1, 1) + timedelta(days=i) for i in range(10)]
    assert forecast_skip_reason(consecutive_days(days)) == "insufficient_data"


def test_thirty_days_forecasts_seven_rows() -> None:
    hist = [(date(2026, 1, 1) + timedelta(days=i), 1000.0 + i) for i in range(30)]
    rows = run_autoarima(hist, n_jobs=1)
    assert len(rows) == 7
    assert all("confidence_interval_low" in r and "confidence_interval_high" in r for r in rows)
