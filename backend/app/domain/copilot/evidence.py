"""Server-derived copilot evidence (Phase 9). Never accept client-supplied evidence."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Any


@dataclass
class CopilotEvidence:
    data_range: str
    data_range_from: str | None = None
    data_range_to: str | None = None
    order_count: int = 0
    last_import_at: str | None = None
    last_updated_minutes_ago: int | None = None
    sql_summary: str = "Aggregated café metrics from tenant-scoped order data"
    metric_versions: dict[str, int] = field(default_factory=lambda: {"revenue": 1})
    confidence: str = "medium"
    confidence_reason: str = ""
    warnings: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "data_range": self.data_range,
            "data_range_from": self.data_range_from,
            "data_range_to": self.data_range_to,
            "order_count": self.order_count,
            "last_import_at": self.last_import_at,
            "last_updated_minutes_ago": self.last_updated_minutes_ago,
            "sql_summary": self.sql_summary,
            "metric_versions": self.metric_versions,
            "confidence": self.confidence,
            "confidence_reason": self.confidence_reason,
            "warnings": self.warnings,
        }


def _parse_range(data_range: str | None) -> tuple[date | None, date | None, int]:
    if not data_range:
        return None, None, 0
    parts = data_range.replace("–", "-").replace("to", "-").split("-")
    # Accept "YYYY-MM-DD to YYYY-MM-DD"
    text = data_range.replace("–", "to")
    if " to " in text:
        left, right = [p.strip() for p in text.split(" to ", 1)]
        try:
            start = date.fromisoformat(left[:10])
            end = date.fromisoformat(right[:10])
            days = max(1, (end - start).days + 1)
            return start, end, days
        except ValueError:
            return None, None, 0
    _ = parts
    return None, None, 0


def build_evidence(
    *,
    data_range: str | None = None,
    order_count: int = 0,
    last_import_at: str | None = None,
    sql_summary: str | None = None,
    metric_versions: dict[str, int] | None = None,
) -> CopilotEvidence:
    start, end, days = _parse_range(data_range)
    warnings: list[str] = []
    if days and days < 3:
        confidence = "low"
        warnings.append(f"Limited data: only {days} day(s) available")
        reason = f"Based on {order_count} orders over {days} days"
    elif order_count < 10:
        confidence = "medium"
        warnings.append("Very few orders in this period")
        reason = f"Based on {order_count} orders"
    else:
        confidence = "high"
        reason = f"Based on {order_count:,} orders" + (f" over {days} days" if days else "")

    minutes_ago = None
    if last_import_at:
        try:
            ts = datetime.fromisoformat(last_import_at.replace("Z", "+00:00"))
            minutes_ago = int((datetime.now(timezone.utc) - ts.astimezone(timezone.utc)).total_seconds() // 60)
        except ValueError:
            minutes_ago = None

    summary = sql_summary or "Aggregated café metrics from tenant-scoped order data"
    if any(tok in summary.lower() for tok in ("select ", "insert ", "update ", "delete ")):
        summary = "Aggregated café metrics from tenant-scoped order data"

    return CopilotEvidence(
        data_range=data_range or "",
        data_range_from=start.isoformat() + "T00:00:00Z" if start else None,
        data_range_to=end.isoformat() + "T23:59:59Z" if end else None,
        order_count=order_count,
        last_import_at=last_import_at,
        last_updated_minutes_ago=minutes_ago,
        sql_summary=summary,
        metric_versions=metric_versions or {"revenue": 1},
        confidence=confidence,
        confidence_reason=reason,
        warnings=warnings,
    )
