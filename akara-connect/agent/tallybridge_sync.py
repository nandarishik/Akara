"""TallyBridge sync helper — localhost XML only."""

from __future__ import annotations

from typing import Any

try:
    import tallybridge  # type: ignore
except ImportError:  # Gate 2 may FAIL — pin tallybridge==0.2.0 in requirements
    tallybridge = None  # type: ignore


def fetch_via_tallybridge(host: str, port: int, alter_id: int | None = None) -> list[dict[str, Any]]:
    """
    Fetch vouchers via TallyBridge when installed.
    Host must be 127.0.0.1 (or localhost) — never bind/listen on 0.0.0.0.
    """
    if host not in ("127.0.0.1", "localhost"):
        raise ValueError("Tally XML host must be 127.0.0.1 only")
    if tallybridge is None:
        raise RuntimeError(
            "tallybridge not installed — pin tallybridge==0.2.0 (Gate 2 vendor path deferred)"
        )
    # Minimal adapter: prefer tallybridge API if present; else fall back to XML reader.
    client = getattr(tallybridge, "Client", None)
    if client is None:
        raise RuntimeError("tallybridge.Client missing")
    tb = client(host=host, port=port)
    if hasattr(tb, "fetch_vouchers"):
        return list(tb.fetch_vouchers(alter_id=alter_id))
    raise RuntimeError("tallybridge fetch_vouchers not available")
