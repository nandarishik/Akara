from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from app.domain.data_import.cafe.column_aliases import REQUIRED_ORDER_FIELDS


class ValidationEngine:
    def validate_order(self, row: dict[str, Any]) -> list[dict[str, str]]:
        errors: list[dict[str, str]] = []
        for field in REQUIRED_ORDER_FIELDS:
            if row.get(field) in (None, ""):
                errors.append({"field": field, "type": "missing_required", "message": f"{field} is missing"})
        amount = row.get("total_amount")
        if amount not in (None, ""):
            try:
                value = float(amount)
                if value <= 0 or value > 1_000_000:
                    errors.append({"field": "total_amount", "type": "out_of_range", "message": "total_amount out of range"})
            except (TypeError, ValueError):
                errors.append({"field": "total_amount", "type": "type_mismatch", "message": "total_amount must be numeric"})
        when = row.get("order_time")
        if when not in (None, ""):
            parsed = _parse_dt(when)
            if parsed is None:
                errors.append({"field": "order_time", "type": "type_mismatch", "message": "order_time is not parseable"})
            else:
                now = datetime.now(UTC)
                if parsed > now + timedelta(hours=1) or parsed < now - timedelta(days=365 * 5):
                    errors.append({"field": "order_time", "type": "out_of_range", "message": "order_time out of range"})
        return errors


def _parse_dt(value: Any) -> datetime | None:
    text = str(value)
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(text.replace("Z", "+00:00")[:19] if "T" in text else text[:19], fmt.replace("%z", ""))
            return dt.replace(tzinfo=UTC)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
