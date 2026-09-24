from datetime import date

from app.domain.intelligence.playbooks.festivals import generate_festival_signals


def test_fourteen_day_window() -> None:
    today = date(2026, 10, 10)
    cal = [
        {"festival_name": "Diwali", "festival_date": date(2026, 10, 19), "playbook_type": "pre_festival"},
        {"festival_name": "Christmas", "festival_date": date(2026, 12, 25), "playbook_type": "festival_day"},
    ]
    signals = generate_festival_signals(cal, today)
    assert any(s["festival"] == "Diwali" for s in signals)
    assert all(s["festival"] != "Christmas" for s in signals)
