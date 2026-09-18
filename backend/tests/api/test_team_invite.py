from __future__ import annotations

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.core.auth import Capability, check_role_capability
from app.core.tenant import TenantContext
from tests.conftest import TENANT_PRO, USER_FREE, USER_PRO


def test_owner_is_admin() -> None:
    ctx = TenantContext(TENANT_PRO, "owner", USER_PRO)
    assert ctx.is_admin is True


def test_pending_deletion_not_active() -> None:
    ctx = TenantContext(TENANT_PRO, "owner", USER_PRO, plan_status="pending_deletion")
    assert ctx.is_active is False


def test_viewer_cannot_invite() -> None:
    from fastapi import HTTPException

    try:
        check_role_capability("user", Capability.INVITE_MEMBER)
        raise AssertionError("expected 403")
    except HTTPException as exc:
        assert exc.status_code == 403
        assert "does not have permission" in str(exc.detail)


@patch("app.api.v1.team.get_supabase_service_client")
@patch("app.core.tenant.get_supabase_service_client")
def test_viewer_invite_forbidden(mock_ctx, mock_team) -> None:
    from app.core.auth import AuthenticatedUser, get_current_user
    from app.main import app

    fake_user = AuthenticatedUser(
        user_id=USER_FREE, email="viewer@akara.test", role="user"
    )
    app.dependency_overrides[get_current_user] = lambda: fake_user
    tenant_row = {
        "config": {},
        "plan": "pro",
        "plan_status": "active",
        "feature_overrides": {},
    }
    mock_ctx.return_value = MagicMock()
    mock_ctx.return_value.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
        "tenant_id": str(TENANT_PRO),
        "role": "user",
    }
    # get_tenant_context uses two table calls
    profile = MagicMock()
    profile.execute.return_value.data = {"tenant_id": str(TENANT_PRO), "role": "user"}
    tenant = MagicMock()
    tenant.execute.return_value.data = tenant_row

    def table_side(name: str):
        m = MagicMock()
        if name == "profiles":
            m.select.return_value.eq.return_value.single.return_value = profile
        else:
            m.select.return_value.eq.return_value.single.return_value = tenant
        return m

    mock_ctx.return_value.table.side_effect = table_side
    client = TestClient(app, headers={"Authorization": "Bearer fake"})
    try:
        resp = client.post("/team/invite", json={"email": "a@b.com", "role": "user"})
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)
