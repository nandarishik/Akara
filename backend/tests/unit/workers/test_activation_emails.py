"""Tests for activation email stages."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

from app.tasks.activation_emails import (
    STAGES,
    _already_sent,
    _copilot_usage_pct,
    _should_send_stage,
)


def test_stages_include_day7_and_day14():
    stage_ids = {s[0] for s in STAGES}
    assert "day7_no_phone" in stage_ids
    assert "day14_upgrade_nudge" in stage_ids


@patch("app.tasks.activation_emails._already_sent", return_value=False)
@patch("app.tasks.activation_emails._has_event", return_value=False)
def test_day7_requires_missing_phone(mock_event, mock_sent):
    supa = MagicMock()
    profile = {
        "id": "user-1",
        "tenant_id": "tenant-1",
        "phone_number": None,
    }
    assert _should_send_stage(supa, profile, "day7_no_phone", "first_debrief", 7, 8, "a@b.com")


@patch("app.tasks.activation_emails._already_sent", return_value=False)
def test_day7_skips_when_phone_set(mock_sent):
    supa = MagicMock()
    profile = {"id": "user-1", "tenant_id": "tenant-1", "phone_number": "+91999"}
    assert not _should_send_stage(supa, profile, "day7_no_phone", "first_debrief", 7, 8, "a@b.com")


def test_ledger_dedupe_helper():
    supa = MagicMock()
    supa.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
        data={"id": "x"}
    )
    assert _already_sent(supa, "user-1", "day1_no_import") is True


def test_copilot_usage_pct_from_rpc():
    supa = MagicMock()
    supa.rpc.return_value.execute.return_value = MagicMock(data={"copilot_calls": 12})
    pct = _copilot_usage_pct(supa, "tenant-1")
    assert pct >= 80.0
