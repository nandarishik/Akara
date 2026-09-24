"""In-memory circuit breaker for LLM providers (Phase 9 Partial)."""

from __future__ import annotations

import time
from dataclasses import dataclass, field

_FAILURE_WINDOW_S = 300
_OPEN_FOR_S = 60
_THRESHOLD = 3


@dataclass
class _Window:
    failures: list[float] = field(default_factory=list)
    opened_at: float | None = None


_STATE = _Window()


def record_failure() -> None:
    now = time.monotonic()
    _STATE.failures = [t for t in _STATE.failures if now - t < _FAILURE_WINDOW_S]
    _STATE.failures.append(now)
    if len(_STATE.failures) >= _THRESHOLD:
        _STATE.opened_at = now


def record_success() -> None:
    _STATE.failures.clear()
    _STATE.opened_at = None


def is_open() -> bool:
    if _STATE.opened_at is None:
        return False
    if time.monotonic() - _STATE.opened_at >= _OPEN_FOR_S:
        _STATE.opened_at = None
        _STATE.failures.clear()
        return False
    return True
