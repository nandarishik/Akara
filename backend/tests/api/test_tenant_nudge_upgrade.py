"""Tenant nudge-upgrade email tests."""

from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import uuid4

from tests.conftest import TENANT_FREE, USER_SUPERADMIN
from tests.superadmin.superadmin_helpers import (
    QaMatrixSupabase,
    clear_auth_override,
    default_tenant_row,
    make_superadmin_client,
    patch_supabase_everywhere,
    sudo_session_row,
)


@patch("app.services.billing.email._send", return_value=True)
@patch("app.api.routes.superadmin.tenants.record_operation", return_value={"id": "audit-1"})
def test_nudge_upgrade_sends_email(mock_audit, mock_send):
    session_id = uuid4()
    supa = QaMatrixSupabase(
        sudo_session=sudo_session_row(session_id=session_id),
        tenant_row=default_tenant_row(),
    )
    auth_user = MagicMock()
    auth_user.user.email = "admin@akara.test"
    supa.auth.admin.get_user_by_id.return_value = auth_user

    client = make_superadmin_client()
    client.cookies.set("akara_sudo", str(session_id))
    client.cookies.set("akara_csrf", "csrf-ok")
    try:
        with patch_supabase_everywhere(supa):
            res = client.post(
                f"/superadmin/tenants/{TENANT_FREE}/nudge-upgrade",
                json={"reason": "Nudge upgrade smoke test for tenant admin"},
                headers={"X-CSRF-Token": "csrf-ok"},
            )
        assert res.status_code == 200
        mock_send.assert_called_once()
    finally:
        clear_auth_override()
