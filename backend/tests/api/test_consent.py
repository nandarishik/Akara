from __future__ import annotations

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.core.auth import AuthenticatedUser, get_current_user
from tests.conftest import USER_PRO


def test_consent_requires_accepted() -> None:
    from app.main import app

    fake_user = AuthenticatedUser(
        user_id=USER_PRO, email="admin@akara.test", role="admin"
    )
    app.dependency_overrides[get_current_user] = lambda: fake_user
    client = TestClient(app, headers={"Authorization": "Bearer fake"})
    resp = client.post(
        "/auth/consent",
        json={"consent_type": "terms", "accepted": False, "source": "settings"},
    )
    app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 400


@patch("app.api.v1.auth.get_supabase_service_client")
def test_consent_records(mock_supa) -> None:
    from app.main import app

    fake_user = AuthenticatedUser(
        user_id=USER_PRO, email="admin@akara.test", role="admin"
    )
    app.dependency_overrides[get_current_user] = lambda: fake_user
    mock_supa.return_value.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[{}]
    )
    client = TestClient(app, headers={"Authorization": "Bearer fake"})
    resp = client.post(
        "/auth/consent",
        json={"consent_type": "terms", "accepted": True, "source": "reaccept_modal"},
    )
    app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 200
    assert resp.json()["recorded"] is True
