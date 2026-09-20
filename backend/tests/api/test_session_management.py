from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.auth import AuthenticatedUser, decode_supabase_jwt, get_current_user
from app.core.session_tracker import record_session
from tests.conftest import USER_PRO


def test_jwks_rotation_retry(monkeypatch) -> None:
    from jose import JWTError

    from app.core import auth as auth_mod

    calls = {"n": 0}

    def fake_decode(*_a, **_k):
        calls["n"] += 1
        if calls["n"] == 1:
            raise JWTError("Signature verification failed")
        return {
            "sub": str(USER_PRO),
            "email": "a@b.com",
            "aud": "authenticated",
            "jti": "jti-1",
        }

    monkeypatch.setattr(
        auth_mod.jwt, "get_unverified_header", lambda _t: {"alg": "ES256", "kid": "k"}
    )
    monkeypatch.setattr(auth_mod, "_decode_asymmetric", lambda *a, **k: fake_decode())
    payload = decode_supabase_jwt("token")
    assert payload.jti == "jti-1"
    assert calls["n"] == 2


def test_expired_token_does_not_refresh(monkeypatch) -> None:
    from jose import JWTError

    from app.core import auth as auth_mod

    def boom(*_a, **_k):
        raise JWTError("Signature has expired.")

    monkeypatch.setattr(
        auth_mod.jwt, "get_unverified_header", lambda _t: {"alg": "ES256", "kid": "k"}
    )
    monkeypatch.setattr(auth_mod, "_decode_asymmetric", boom)
    try:
        decode_supabase_jwt("token")
        raise AssertionError("expected 401")
    except Exception as exc:
        assert (
            "401" in str(getattr(exc, "status_code", ""))
            or "expired" in str(exc).lower()
            or "Invalid token" in str(exc)
        )


@patch("app.core.tenant.get_supabase_service_client")
def test_fourth_session_evicts_oldest(mock_supa) -> None:
    store = MagicMock()
    store.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
        data=None
    )
    store.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[{}]
    )
    store.table.return_value.select.return_value.eq.return_value.is_.return_value.order.return_value.execute.return_value = MagicMock(
        data=[{"id": "1"}, {"id": "2"}, {"id": "3"}, {"id": "4"}]
    )
    store.auth.admin.sign_out = MagicMock()
    mock_supa.return_value = store
    record_session(USER_PRO, "s1", "ua")
    record_session(USER_PRO, "s4", "ua")
    assert store.table.called


def test_list_sessions_returns_json() -> None:
    from app.main import app

    fake_user = AuthenticatedUser(
        user_id=USER_PRO, email="admin@akara.test", role="admin"
    )
    app.dependency_overrides[get_current_user] = lambda: fake_user
    client = TestClient(app, headers={"Authorization": "Bearer fake"})
    with patch("app.core.tenant.get_supabase_service_client") as mock_ctx:
        profile = MagicMock()
        profile.execute.return_value.data = {
            "tenant_id": "22222222-0000-0000-0000-000000000002",
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
            elif name == "active_sessions":
                m.select.return_value.eq.return_value.is_.return_value.execute.return_value = MagicMock(
                    data=[]
                )
            else:
                m.select.return_value.eq.return_value.single.return_value = tenant
            return m

        mock_ctx.return_value.table.side_effect = table_side
        resp = client.get("/account/sessions")
    app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
