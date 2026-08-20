"""Tests for Copilot debrief context authorization."""

from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.services.debrief.copilot_context import load_debrief_context_addendum
from tests.conftest import TENANT_PRO

REPORT_ID = UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")


@patch("app.services.debrief.copilot_context.get_supabase_service_client")
def test_load_debrief_context_success(mock_supa):
    supa = MagicMock()
    mock_supa.return_value = supa
    supa.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
        data={"title": "Weekly Debrief", "metadata": {"headline": "Good week", "week_start": "2026-07-14", "week_end": "2026-07-20"}}
    )

    addendum = load_debrief_context_addendum(TENANT_PRO, REPORT_ID)
    assert "AUTHORIZED WEEKLY DEBRIEF CONTEXT" in addendum
    assert "Good week" in addendum


@patch("app.services.debrief.copilot_context.get_supabase_service_client")
def test_load_debrief_context_cross_tenant_rejected(mock_supa):
    supa = MagicMock()
    mock_supa.return_value = supa
    supa.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
        data=None
    )

    with pytest.raises(HTTPException) as exc:
        load_debrief_context_addendum(TENANT_PRO, uuid4())
    assert exc.value.status_code == 404
