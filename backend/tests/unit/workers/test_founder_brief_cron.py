"""Founder brief cron registration tests."""

from __future__ import annotations

from unittest.mock import patch
from uuid import uuid4

from app.api.superadmin.system import CRON_TASKS
from tests.superadmin.superadmin_helpers import (
    QaMatrixSupabase,
    clear_auth_override,
    make_superadmin_client,
    patch_supabase_everywhere,
    sudo_session_row,
)


def test_founder_brief_in_cron_tasks():
    assert "founder_brief" in CRON_TASKS
    assert "revenue_snapshot" in CRON_TASKS


@patch("app.api.superadmin.system.record_operation", return_value={"id": "audit-1"})
def test_manual_founder_brief_trigger(mock_audit):
    session_id = uuid4()
    supa = QaMatrixSupabase(sudo_session=sudo_session_row(session_id=session_id))

    client = make_superadmin_client()
    client.cookies.set("akara_sudo", str(session_id))
    client.cookies.set("akara_csrf", "csrf-ok")
    try:
        with patch_supabase_everywhere(supa):
            res = client.post(
                "/superadmin/system/cron-run/founder_brief",
                json={"reason": "Manual founder brief smoke test run"},
                headers={"X-CSRF-Token": "csrf-ok"},
            )
        assert res.status_code == 200
        body = res.json()
        assert body["triggered"] is True
        assert body["task_name"] == "founder_brief"
    finally:
        clear_auth_override()
