"""Full superadmin QA matrix — sudo, CSRF, conflicts, impersonation, endpoint coverage."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from tests.conftest import TENANT_FREE, USER_FREE, USER_SUPERADMIN
from tests.superadmin.superadmin_helpers import (
    QaMatrixSupabase,
    SUPERADMIN_READ_ENDPOINTS,
    SUPERADMIN_WRITE_ENDPOINTS_NO_SUDO,
    clear_auth_override,
    default_tenant_row,
    make_non_superadmin_client,
    make_superadmin_client,
    patch_supabase_everywhere,
    profile_only_supabase,
    sudo_session_row,
)


@pytest.fixture
def superadmin_client() -> TestClient:
    client = make_superadmin_client()
    yield client
    clear_auth_override()


@pytest.fixture
def non_superadmin_client() -> TestClient:
    client = make_non_superadmin_client()
    yield client
    clear_auth_override()


# ── Sudo session matrix ───────────────────────────────────────────────────────


@patch("app.api.routes.superadmin.system.get_supabase_service_client")
@patch("app.core.superadmin.get_supabase_service_client")
def test_stale_sudo_session_rejected(mock_core, mock_system, superadmin_client: TestClient):
    session_id = uuid4()
    expired = datetime.now(UTC) - timedelta(minutes=1)
    supa = QaMatrixSupabase(
        sudo_session=sudo_session_row(session_id=session_id, expires_at=expired),
    )
    mock_core.return_value = supa
    mock_system.return_value = supa

    client = superadmin_client
    client.cookies.set("akara_sudo", str(session_id))
    client.cookies.set("akara_csrf", "csrf-valid")

    response = client.patch(
        "/superadmin/system/settings",
        json={"maintenance_mode": True, "reason": "Stale sudo session rejection test"},
        headers={"X-CSRF-Token": "csrf-valid"},
    )
    assert response.status_code == 403
    body = response.json()
    assert body["code"] == "SUDO_EXPIRED"


@patch("app.api.routes.superadmin.system.get_supabase_service_client")
@patch("app.core.superadmin.get_supabase_service_client")
def test_sudo_session_wrong_user_rejected(mock_core, mock_system, superadmin_client: TestClient):
    session_id = uuid4()
    supa = QaMatrixSupabase(
        sudo_session=sudo_session_row(
            session_id=session_id,
            user_id=USER_FREE,
            expires_at=datetime.now(UTC) + timedelta(minutes=10),
        ),
    )
    mock_core.return_value = supa
    mock_system.return_value = supa

    client = superadmin_client
    client.cookies.set("akara_sudo", str(session_id))
    client.cookies.set("akara_csrf", "csrf-valid")

    response = client.patch(
        "/superadmin/system/settings",
        json={"signup_open": False, "reason": "Wrong sudo user rejection test"},
        headers={"X-CSRF-Token": "csrf-valid"},
    )
    assert response.status_code == 403
    assert response.json()["code"] == "SUDO_REQUIRED"


@patch("app.core.superadmin.get_supabase_service_client")
@patch("app.api.routes.superadmin.sudo.get_supabase_service_client")
def test_sudo_status_inactive_when_expired(
    mock_route_supa, mock_core_supa, superadmin_client: TestClient
):
    session_id = uuid4()
    expired = datetime.now(UTC) - timedelta(minutes=5)
    mock_core_supa.return_value = QaMatrixSupabase(profile_role="superadmin")

    sudo_table = MagicMock()
    sudo_table.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
        data={"expires_at": expired.isoformat()}
    )
    route_supa = MagicMock()
    route_supa.table.return_value = sudo_table
    mock_route_supa.return_value = route_supa

    client = superadmin_client
    client.cookies.set("akara_sudo", str(session_id))

    response = client.get("/superadmin/sudo")
    assert response.status_code == 200
    assert response.json()["active"] is False


@patch("app.core.superadmin.get_supabase_service_client")
def test_forged_jwt_superadmin_role_still_requires_db_profile(mock_supa):
    """JWT claims superadmin but profiles.role != superadmin → 404."""
    mock_supa.return_value = profile_only_supabase("admin")
    client = make_superadmin_client(role="superadmin")
    try:
        response = client.get("/superadmin/tenants")
        assert response.status_code == 404
    finally:
        clear_auth_override()


# ── Optimistic locking / 409 conflicts ────────────────────────────────────────


def test_expected_version_mismatch_raises_conflict():
    from app.core.errors import AkaraHTTPException
    from app.domain.superadmin.mutations import check_expected_version

    with pytest.raises(AkaraHTTPException) as exc:
        check_expected_version(current_version=3, expected_version=2)
    assert exc.value.status_code == 409
    assert exc.value.code == "CONFLICT"


@patch("app.api.routes.superadmin.tenants.get_supabase_service_client")
@patch("app.core.superadmin.get_supabase_service_client")
def test_tenant_patch_version_mismatch_returns_409(
    mock_core, mock_tenants, superadmin_client: TestClient
):
    session_id = uuid4()
    supa = QaMatrixSupabase(
        sudo_session=sudo_session_row(session_id=session_id),
        tenant_row=default_tenant_row(version=5),
    )
    mock_core.return_value = supa
    mock_tenants.return_value = supa

    client = superadmin_client
    client.cookies.set("akara_sudo", str(session_id))
    client.cookies.set("akara_csrf", "csrf-ok")

    response = client.patch(
        f"/superadmin/tenants/{TENANT_FREE}",
        json={
            "name": "Stale version patch attempt",
            "expected_version": 3,
            "reason": "Testing optimistic lock version mismatch path",
        },
        headers={"X-CSRF-Token": "csrf-ok"},
    )
    assert response.status_code == 409
    assert response.json()["code"] == "CONFLICT"


@patch("app.api.routes.superadmin.tenants.get_supabase_service_client")
@patch("app.core.superadmin.get_supabase_service_client")
@patch("app.domain.superadmin.audit.get_supabase_service_client")
def test_tenant_patch_update_race_returns_409(
    mock_audit, mock_core, mock_tenants, superadmin_client: TestClient
):
    session_id = uuid4()
    supa = QaMatrixSupabase(
        sudo_session=sudo_session_row(session_id=session_id),
        tenant_row=default_tenant_row(version=2),
        tenant_update_empty=True,
    )
    mock_core.return_value = supa
    mock_tenants.return_value = supa
    mock_audit.return_value = supa

    client = superadmin_client
    client.cookies.set("akara_sudo", str(session_id))
    client.cookies.set("akara_csrf", "csrf-ok")

    response = client.patch(
        f"/superadmin/tenants/{TENANT_FREE}",
        json={
            "name": "Concurrent update race scenario",
            "reason": "Testing database optimistic lock empty update",
        },
        headers={"X-CSRF-Token": "csrf-ok"},
    )
    assert response.status_code == 409
    assert response.json()["code"] == "CONFLICT"


# ── Impersonation expiry ──────────────────────────────────────────────────────


@patch("app.api.routes.auth.get_supabase_service_client")
def test_auth_me_omits_impersonation_when_session_expired(
    mock_supa, non_superadmin_client: TestClient
):
    """Active impersonation query filters expires_at > now — expired rows excluded."""
    supa = MagicMock()

    def table_side_effect(name: str):
        m = MagicMock()
        if name == "profiles":
            m.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
                data={"tenant_id": str(TENANT_FREE), "role": "admin"}
            )
        elif name == "impersonation_sessions":
            m.select.return_value.eq.return_value.is_.return_value.gt.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
                data=[]
            )
        return m

    supa.table.side_effect = table_side_effect
    mock_supa.return_value = supa

    response = non_superadmin_client.get("/auth/me")
    assert response.status_code == 200
    body = response.json()
    assert body["impersonating_tenant_id"] is None
    assert body["impersonation_session_id"] is None


@patch("app.api.routes.auth.get_supabase_service_client")
def test_auth_me_omits_impersonation_when_no_active_session(
    mock_supa, non_superadmin_client: TestClient
):
    supa = MagicMock()

    def table_side_effect(name: str):
        m = MagicMock()
        if name == "profiles":
            m.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
                data={"tenant_id": str(TENANT_FREE), "role": "admin"}
            )
        elif name == "impersonation_sessions":
            m.select.return_value.eq.return_value.is_.return_value.gt.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
                data=[]
            )
        return m

    supa.table.side_effect = table_side_effect
    mock_supa.return_value = supa

    response = non_superadmin_client.get("/auth/me")
    assert response.status_code == 200
    body = response.json()
    assert body.get("impersonating_tenant_id") is None
    assert body.get("impersonation_session_id") is None


@patch("app.api.routes.auth.get_supabase_service_client")
def test_auth_me_includes_active_impersonation_before_expiry(
    mock_supa, non_superadmin_client: TestClient
):
    session_id = str(uuid4())
    expires = (datetime.now(UTC) + timedelta(minutes=10)).isoformat()

    def table_side_effect(name: str):
        m = MagicMock()
        if name == "profiles":
            m.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
                data={"tenant_id": str(TENANT_FREE), "role": "admin"}
            )
        elif name == "impersonation_sessions":
            m.select.return_value.eq.return_value.is_.return_value.gt.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
                data=[{"id": session_id, "tenant_id": str(TENANT_FREE), "expires_at": expires}]
            )
        elif name == "tenants":
            m.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
                data={"name": "Acme Corp"}
            )
        return m

    supa = MagicMock()
    supa.table.side_effect = table_side_effect
    mock_supa.return_value = supa

    response = non_superadmin_client.get("/auth/me")
    assert response.status_code == 200
    body = response.json()
    assert body["impersonating_tenant_id"] == str(TENANT_FREE)
    assert body["impersonation_session_id"] == session_id


# ── Role matrix: read endpoints ───────────────────────────────────────────────


@pytest.mark.parametrize("method,path", SUPERADMIN_READ_ENDPOINTS)
@patch("app.core.superadmin.get_supabase_service_client")
def test_read_endpoints_return_404_for_non_superadmin(
    mock_supa, method: str, path: str, non_superadmin_client: TestClient
):
    mock_supa.return_value = profile_only_supabase("admin")
    response = non_superadmin_client.request(method, path)
    assert response.status_code == 404


@pytest.mark.parametrize("method,path", SUPERADMIN_READ_ENDPOINTS)
def test_read_endpoints_accessible_for_superadmin(method: str, path: str, superadmin_client: TestClient):
    supa = QaMatrixSupabase()
    billing_patch = patch(
        "app.api.routes.superadmin.billing.fetch_subscription_status",
        return_value={
            "has_subscription": False,
            "plan": "free",
            "plan_status": "active",
            "razorpay_status": None,
            "current_end": None,
            "trial_ends_at": None,
        },
    )
    with patch_supabase_everywhere(supa), billing_patch:
        response = superadmin_client.request(method, path)
    assert response.status_code == 200, f"{method} {path}: {response.text}"
    assert response.headers.get("X-Robots-Tag") == "noindex, nofollow"


# ── Write endpoints require sudo ──────────────────────────────────────────────


@pytest.mark.parametrize("method,path,body", SUPERADMIN_WRITE_ENDPOINTS_NO_SUDO)
@patch("app.core.superadmin.get_supabase_service_client")
def test_write_endpoints_reject_without_sudo(
    mock_supa,
    method: str,
    path: str,
    body: dict[str, object] | None,
    superadmin_client: TestClient,
):
    mock_supa.return_value = QaMatrixSupabase()
    kwargs: dict[str, object] = {}
    if body is not None:
        kwargs["json"] = body
    kwargs["headers"] = {"X-CSRF-Token": "csrf-token"}
    response = superadmin_client.request(method, path, **kwargs)
    assert response.status_code == 403
    assert response.json()["code"] == "SUDO_REQUIRED"


# ── Destructive confirmation + audit completeness ─────────────────────────────


@patch("app.api.routes.superadmin.tenants.get_supabase_service_client")
@patch("app.core.superadmin.get_supabase_service_client")
def test_tenant_wipe_requires_exact_confirm_phrase(
    mock_core, mock_tenants, superadmin_client: TestClient
):
    session_id = uuid4()
    supa = QaMatrixSupabase(
        sudo_session=sudo_session_row(session_id=session_id),
        tenant_row=default_tenant_row(),
    )
    mock_core.return_value = supa
    mock_tenants.return_value = supa

    client = superadmin_client
    client.cookies.set("akara_sudo", str(session_id))
    client.cookies.set("akara_csrf", "csrf-ok")

    response = client.request(
        "DELETE",
        f"/superadmin/tenants/{TENANT_FREE}/data",
        json={"reason": "Wrong confirm phrase for tenant data wipe", "confirm": "WRONG"},
        headers={"X-CSRF-Token": "csrf-ok"},
    )
    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"


@patch("app.domain.superadmin.audit.get_supabase_service_client")
def test_audit_operation_records_actor_and_reason(mock_audit):
    from app.domain.superadmin.audit import record_operation

    captured: dict[str, object] = {}

    def capture_insert(row: dict[str, object]):
        captured.update(row)
        chain = MagicMock()
        chain.execute.return_value = MagicMock(data=[{"id": str(uuid4())}])
        return chain

    audit_table = MagicMock()
    audit_table.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
        data=None
    )
    audit_table.insert.side_effect = capture_insert
    mock_audit.return_value.table.side_effect = lambda n: audit_table if n == "audit_log" else MagicMock()

    record_operation(
        action="superadmin.qa.test",
        actor_id=USER_SUPERADMIN,
        actor_email="superadmin@akara.test",
        reason="Audit completeness verification for QA matrix",
        tenant_id=TENANT_FREE,
        ip_address="127.0.0.1",
        user_agent="pytest",
    )

    assert captured["action"] == "superadmin.qa.test"
    assert captured["actor_id"] == str(USER_SUPERADMIN)
    assert captured["actor_email"] == "superadmin@akara.test"
    assert captured["reason"] == "Audit completeness verification for QA matrix"
    assert captured["ip_address"] == "127.0.0.1"


# ── Unauthenticated access ────────────────────────────────────────────────────


@pytest.mark.parametrize("method,path", SUPERADMIN_READ_ENDPOINTS[:5])
def test_unauthenticated_superadmin_routes_rejected(method: str, path: str):
    from app.main import app

    app.dependency_overrides.clear()
    client = TestClient(app)
    response = client.request(method, path)
    assert response.status_code in (401, 403)


# ── Sudo DELETE requires CSRF ─────────────────────────────────────────────────


@patch("app.core.superadmin.get_supabase_service_client")
def test_sudo_end_requires_csrf_header(mock_supa, superadmin_client: TestClient):
    session_id = uuid4()
    mock_supa.return_value = QaMatrixSupabase(
        sudo_session=sudo_session_row(session_id=session_id),
    )
    client = superadmin_client
    client.cookies.set("akara_sudo", str(session_id))
    client.cookies.set("akara_csrf", "csrf-token")

    response = client.delete("/superadmin/sudo")
    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"
