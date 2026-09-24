"""Festival signals — 14-day inclusive window."""

from __future__ import annotations

from datetime import date, datetime


def _as_date(value: object) -> date | None:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        return date.fromisoformat(value[:10])
    return None


def generate_festival_signals(festival_calendar: list[dict], today: date) -> list[dict]:
    signals: list[dict] = []
    for festival in festival_calendar:
        fest_date = _as_date(festival.get("festival_date"))
        if fest_date is None:
            continue
        days_away = (fest_date - today).days
        if days_away < 0 or days_away > 14:
            continue
        name = str(festival.get("festival_name") or "")
        ptype = str(festival.get("playbook_type") or "")
        action = "Plan a themed promotion and staff the expected rush."
        if name == "Diwali" and ptype == "pre_festival":
            action = "Launch gift set bundles (₹499-999) and festive hamper pre-orders"
        elif name == "Eid al-Fitr":
            action = "Offer iftar/sehri combo sets; extend operating hours"
        elif name in {"Christmas", "Christmas Eve"}:
            action = "Offer festive platters and reserved-table packages"
        elif name == "Valentine Day":
            action = "Launch a two-cover prix-fixe and dessert add-on"
        elif name in {"New Year", "New Year Eve"}:
            action = "Sell countdown tickets and late-night snack menus"
        elif name == "Onam":
            action = "Feature a sadhya thali and banana-leaf service"
        elif name in {"Ugadi", "Gudi Padwa"}:
            action = "Offer a New Year tasting plate and regional sweets"
        signals.append(
            {
                "festival": name,
                "days_away": days_away,
                "action": action,
                "playbook_type": ptype,
                "rationale": "Festival within 14 days.",
            }
        )
    return signals
