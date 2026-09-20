from __future__ import annotations

from fastapi.testclient import TestClient

from tests.api.test_onboarding import TENANT_ID, _override_auth


def test_onboarding_workspace_name_alias() -> None:
    from unittest.mock import MagicMock, patch

    from app.main import app

    with _override_auth():
        with patch("app.api.v1.onboarding.get_supabase_service_client") as mock_supa:
            client_mock = MagicMock()
            profile = MagicMock()
            profile.execute.return_value.data = {"tenant_id": None}
            insert = MagicMock()
            insert.execute.return_value.data = [{"id": TENANT_ID}]
            client_mock.table.return_value.select.return_value.eq.return_value.maybe_single.return_value = profile
            client_mock.table.return_value.insert.return_value = insert
            client_mock.table.return_value.upsert.return_value.execute.return_value = (
                MagicMock()
            )
            mock_supa.return_value = client_mock
            client = TestClient(app)
            resp = client.post(
                "/onboarding/setup",
                json={"workspace_name": "Cafe One", "business_type": "cafe"},
            )
    assert resp.status_code == 201
    body = resp.json()
    assert "redirect_hint" in body
    assert body["tenant_id"] == TENANT_ID


def test_onboarding_skip() -> None:
    from unittest.mock import MagicMock, patch

    from app.main import app

    with _override_auth():
        with patch("app.api.v1.onboarding.get_supabase_service_client") as mock_supa:
            mock_supa.return_value.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()
            client = TestClient(app)
            resp = client.post("/onboarding/skip")
    assert resp.status_code == 200
    assert resp.json()["skipped"] is True
    assert resp.json()["redirect"] == "/dashboard"
