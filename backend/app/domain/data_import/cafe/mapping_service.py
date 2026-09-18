from __future__ import annotations

import difflib
from typing import Any

from app.domain.data_import.cafe.column_aliases import CANONICAL_ORDER_ALIASES, REQUIRED_ORDER_FIELDS, norm
from app.domain.data_import.cafe.pii import redact_samples


class AIMappingService:
    def propose(self, headers: list[str], samples: dict[str, list[str]], import_type: str = "cafe_orders") -> dict[str, Any]:
        columns = []
        mapped: set[str] = set()
        for raw in headers:
            canonical, confidence = self._match(raw)
            band = _band(confidence, matched=canonical is not None)
            if canonical:
                mapped.add(canonical)
            columns.append({
                "raw_column": raw,
                "canonical_field": canonical,
                "confidence": confidence,
                "band": band,
                "sample_values": redact_samples(samples.get(raw, [])[:3]),
            })
        required = sorted(REQUIRED_ORDER_FIELDS) if import_type == "cafe_orders" else []
        unmapped_required = [f for f in required if f not in mapped]
        return {
            "import_type": import_type,
            "status": "mapping_proposed",
            "ai_mapping_used": False,
            "ai_mapping_confidence": None,
            "columns": columns,
            "required_fields": required,
            "unmapped_required": unmapped_required,
        }

    def _match(self, raw: str) -> tuple[str | None, float]:
        key = norm(raw)
        if key in CANONICAL_ORDER_ALIASES:
            return CANONICAL_ORDER_ALIASES[key], 0.99
        options = list(CANONICAL_ORDER_ALIASES)
        hits = difflib.get_close_matches(key, options, n=1, cutoff=0.7)
        if hits:
            return CANONICAL_ORDER_ALIASES[hits[0]], 0.8
        return None, 0.0


def _band(confidence: float, *, matched: bool) -> str:
    if confidence >= 0.95:
        return "accepted"
    if confidence >= 0.70:
        return "suggested"
    if matched:
        return "uncertain"
    return "unmapped"
