"""Phase 9 DEV1 unit tests — evidence + guard_sql (no Settings import)."""

from __future__ import annotations

from app.domain.copilot.evidence import build_evidence
from app.infra.db.guard import add_row_limit, guard_sql


def test_evidence_low_confidence_two_days() -> None:
    ev = build_evidence(data_range="2026-09-01 to 2026-09-02", order_count=4)
    assert ev.confidence == "low"
    assert any("Limited data: only 2 day" in w for w in ev.warnings)


def test_evidence_high_confidence() -> None:
    ev = build_evidence(data_range="2026-08-31 to 2026-09-06", order_count=1247)
    assert ev.confidence == "high"
    assert ev.as_dict()["order_count"] == 1247


def test_evidence_strips_raw_sql_summary() -> None:
    ev = build_evidence(sql_summary="SELECT * FROM canonical_orders")
    assert "select " not in ev.sql_summary.lower()


def test_guard_insert_rejected() -> None:
    result = guard_sql("INSERT INTO t VALUES (1)")
    assert result.ok is False


def test_guard_select_allowed() -> None:
    result = guard_sql("SELECT 1")
    assert result.ok is True


def test_add_row_limit() -> None:
    assert "LIMIT 1000" in add_row_limit("SELECT 1")
