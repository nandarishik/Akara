"""Redact high-risk Indian PII before text is sent to an LLM (DPDP compliance)."""

from __future__ import annotations

import re
from typing import Any

_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(r"\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b"),
        "[GST_REDACTED]",
    ),
    (re.compile(r"\b[A-Z]{5}\d{4}[A-Z]{1}\b"), "[PAN_REDACTED]"),
    (re.compile(r"\b(?:\+91[\-\s]?)?[6-9]\d{9}\b"), "[PHONE_REDACTED]"),
    (re.compile(r"\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b"), "[AADHAAR_REDACTED]"),
    (
        re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"),
        "[EMAIL_REDACTED]",
    ),
]

_SENSITIVE_FIELDS = frozenset({
    "contact_number",
    "email",
    "gst_number",
    "pan_number",
    "aadhaar",
    "phone",
    "mobile",
})


def redact(text: str) -> str:
    """Remove high-risk PII patterns from free text. Business names are preserved."""
    for pattern, replacement in _PATTERNS:
        text = pattern.sub(replacement, text)
    return text


def redact_row(row: dict[str, Any]) -> dict[str, Any]:
    """Redact known sensitive column values in a result row."""
    return {
        k: ("[REDACTED]" if k.lower() in _SENSITIVE_FIELDS else v)
        for k, v in row.items()
    }


def redact_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [redact_row(r) for r in rows]
