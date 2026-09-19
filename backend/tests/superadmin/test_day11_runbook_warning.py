"""BUG-11: runbook execute must expose non-operational stub warning (DEV2)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import uuid4

from tests.conftest import TENANT_FREE, USER_FREE
from tests.superadmin.superadmin_helpers import (
    QaMatrixSupabase,
    clear_auth_override,
    make_superadmin_client,
    patch_supabase_everywhere,
    sudo_session_row,
)


def test_execute_runbook_returns_not_operational_warning() -> None:
    session_id = uuid4()
    supa = QaMatrixSupabase(sudo_session=sudo_session_row(session_id=session_id))
    # Allow runbook_executions insert
    rb_table = MagicMock()
    rb_table.insert.return_value.execute.return_value = MagicMock(data=[{}])
    original_table = supa.table

    def table_router(name: str):
        if name == "runbook_executions":
            return rb_table
        return original_table(name)

    supa.table = table_router  # type: ignore[method-assign]

    client = make_superadmin_client()
    client.cookies.set("akara_sudo", str(session_id))
    client.cookies.set("akara_csrf", "csrf-ok")

    try:
        with (
            patch_supabase_everywhere(supa),
            patch(
                "app.api.superadmin.day11.get_supabase_service_client",
                return_value=supa,
            ),
            patch(
                "app.api.superadmin.day11.record_operation",
                return_value={"id": str(uuid4())},
            ),
        ):
            response = client.post(
                "/superadmin/runbooks/repair_missing_profile/execute",
                json={
                    "reason": "Phase 1 DEV2 stub warning verification — long enough reason text",
                    "parameters": {
                        "user_id": str(USER_FREE),
                        "tenant_id": str(TENANT_FREE),
                        "role": "owner",
                    },
                },
                headers={"X-CSRF-Token": "csrf-ok"},
            )
    finally:
        clear_auth_override()

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "queued"
    assert (
        body["warning"]
        == "Runbook execution is not yet operational. No worker is processing this queue."
    )
    assert body["ok"] is True
