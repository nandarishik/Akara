from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient

from tests.conftest import TENANT_PRO, USER_PRO


@patch("app.api.v1.team.get_team_member_verified", side_effect=Exception)
def test_cross_tenant_member_is_404(mock_verified) -> None:
    from app.core.auth import AuthenticatedUser, get_current_user
    from app.core.errors import AkaraHTTPException
    from app.main import app
    from fastapi import status as http_status

    mock_verified.side_effect = AkaraHTTPException(
        status_code=http_status.HTTP_404_NOT_FOUND,
        code="NOT_FOUND",
        message="Member not found",
    )
    fake_user = AuthenticatedUser(
        user_id=USER_PRO, email="admin@akara.test", role="admin"
    )
    app.dependency_overrides[get_current_user] = lambda: fake_user
    client = TestClient(app, headers={"Authorization": "Bearer fake"})
    other = uuid4()
    with patch("app.core.tenant.get_supabase_service_client") as mock_ctx:
        profile = MagicMock()
        profile.execute.return_value.data = {
            "tenant_id": str(TENANT_PRO),
            "role": "admin",
        }
        tenant = MagicMock()
        tenant.execute.return_value.data = {
            "config": {},
            "plan": "pro",
            "plan_status": "active",
            "feature_overrides": {},
        }

        def table_side(name: str):
            m = MagicMock()
            if name == "profiles":
                m.select.return_value.eq.return_value.single.return_value = profile
            else:
                m.select.return_value.eq.return_value.single.return_value = tenant
            return m

        mock_ctx.return_value.table.side_effect = table_side
        resp = client.patch(
            f"/team/members/{other}/role",
            json={"role": "user"},
        )
    app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 404
