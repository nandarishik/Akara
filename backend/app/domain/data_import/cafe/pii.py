from __future__ import annotations

import re

_EMAIL = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)
_PHONE = re.compile(r"(?:\+91[\s-]?)?[6-9]\d{9}")
_GSTIN = re.compile(r"\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]", re.I)


def redact_value(value: str) -> str:
    text = value or ""
    text = _EMAIL.sub("[EMAIL]", text)
    text = _PHONE.sub("[PHONE]", text)
    text = _GSTIN.sub("[GSTIN]", text)
    return text


def redact_samples(values: list[str]) -> list[str]:
    return [redact_value(str(v)) for v in values[:3]]
