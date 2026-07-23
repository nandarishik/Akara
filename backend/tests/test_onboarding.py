"""
Unit tests for onboarding routes — Sprint Phase 2, Day 3.

Tests:
  - POST /onboarding/setup → 201 with tenant_id + tenant_slug
  - POST /onboarding/setup idempotent → returns same tenant on second call
  - POST /onboarding/setup missing company_name → 422
  - POST /onboarding/setup unauthenticated → 401
  - POST /onboarding/setup disposable email → 422 disposable_email
  - POST /onboarding/setup Turnstile failure → 403
  - POST /auth/onboarding-complete → 200

All Supabase calls and auth are mocked via FastAPI dependency_overrides.
"""

from __future__ import annotations

import uuid
from contextlib import contextmanager
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

USER_ID = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000099")
TENANT_ID = "cccccccc-0000-0000-0000-000000000099"
TENANT_SLUG = "sharma-test-ab12cd34"


# ---------------------------------------------------------------------------
# Auth override helpers
# ---------------------------------------------------------------------------

@contextmanager
def _override_auth(email: str = "valid@company.com"):
    """Context manager: override get_current_user on the FastAPI app."""
    from app.core.auth import AuthenticatedUser, get_current_user
    from app.main import app

    fake_user = AuthenticatedUser(user_id=USER_ID, email=email, role=None)

    def fake_get_current_user():
        return fake_user

    app.dependency_overrides[get_current_user] = fake_get_current_user
    try:
        yield fake_user
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def _get_test_client() -> TestClient:
    from app.main import app
    return TestClient(app, headers={"Authorization": "Bearer fake-token"})


# ---------------------------------------------------------------------------
# Supabase mock helpers
# ---------------------------------------------------------------------------

def _make_supabase_mock(profile_tenant_id: str | None = None) -> MagicMock:
    """Return a mock Supabase service client for common test scenarios."""
    mock_client = MagicMock()

    # profiles.select via maybe_single
    profile_data: dict[str, Any] | None = None
    if profile_tenant_id:
        profile_data = {"tenant_id": profile_tenant_id}

    mock_profile_result = MagicMock()
    mock_profile_result.data = profile_data
    (
        mock_client.table.return_value
        .select.return_value
        .eq.return_value
        .maybe_single.return_value
        .execute.return_value
    ) = mock_profile_result

    # tenants.select via single — idempotent path
    mock_tenant_result = MagicMock()
    mock_tenant_result.data = {"id": profile_tenant_id or TENANT_ID, "slug": TENANT_SLUG}
    (
        mock_client.table.return_value
        .select.return_value
        .eq.return_value
        .single.return_value
        .execute.return_value
    ) = mock_tenant_result

    # tenants.insert
    mock_insert_result = MagicMock()
    mock_insert_result.data = [{"id": TENANT_ID, "slug": TENANT_SLUG}]
    mock_client.table.return_value.insert.return_value.execute.return_value = mock_insert_result

    # profiles.upsert
    mock_upsert_result = MagicMock()
    mock_upsert_result.data = [{"id": str(USER_ID)}]
    mock_client.table.return_value.upsert.return_value.execute.return_value = mock_upsert_result

    # profiles.update (onboarding-complete)
    mock_update_result = MagicMock()
    mock_update_result.data = [{"id": str(USER_ID)}]
    (
        mock_client.table.return_value
        .update.return_value
        .eq.return_value
        .execute.return_value
    ) = mock_update_result

    return mock_client


# ---------------------------------------------------------------------------
# POST /onboarding/setup — 201 success
# ---------------------------------------------------------------------------

def test_onboarding_setup_creates_tenant():
    client = _get_test_client()
    mock_db = _make_supabase_mock()

    with (
        _override_auth(),
        patch("app.api.routes.onboarding.get_supabase_service_client", return_value=mock_db),
        patch("app.api.routes.onboarding._verify_turnstile", new_callable=AsyncMock, return_value=True),
    ):
        resp = client.post(
            "/onboarding/setup",
            json={"company_name": "Sharma Traders", "industry": "fmcg_distribution"},
        )

    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert "tenant_id" in data
    assert "tenant_slug" in data


# ---------------------------------------------------------------------------
# POST /onboarding/setup — idempotent
# ---------------------------------------------------------------------------

def test_onboarding_setup_is_idempotent():
    client = _get_test_client()
    mock_db = _make_supabase_mock(profile_tenant_id=TENANT_ID)

    with (
        _override_auth(),
        patch("app.api.routes.onboarding.get_supabase_service_client", return_value=mock_db),
        patch("app.api.routes.onboarding._verify_turnstile", new_callable=AsyncMock, return_value=True),
    ):
        resp = client.post(
            "/onboarding/setup",
            json={"company_name": "Sharma Traders"},
        )

    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["tenant_id"] == TENANT_ID


# ---------------------------------------------------------------------------
# POST /onboarding/setup — missing company_name → 422
# ---------------------------------------------------------------------------

def test_onboarding_setup_missing_company_name():
    client = _get_test_client()

    with _override_auth():
        resp = client.post("/onboarding/setup", json={"industry": "general"})

    assert resp.status_code == 422, resp.text


# ---------------------------------------------------------------------------
# POST /onboarding/setup — unauthenticated → 401
# ---------------------------------------------------------------------------

def test_onboarding_setup_unauthenticated():
    from app.main import app
    unauthed = TestClient(app)
    resp = unauthed.post("/onboarding/setup", json={"company_name": "Test Co"})
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# POST /onboarding/setup — disposable email → 422 disposable_email
# ---------------------------------------------------------------------------

def test_onboarding_setup_disposable_email_blocked():
    client = _get_test_client()
    mock_db = _make_supabase_mock()

    with (
        _override_auth(email="user@mailinator.com"),
        patch("app.api.routes.onboarding.get_supabase_service_client", return_value=mock_db),
        patch("app.api.routes.onboarding._verify_turnstile", new_callable=AsyncMock, return_value=True),
    ):
        resp = client.post("/onboarding/setup", json={"company_name": "Test"})

    assert resp.status_code == 422, resp.text
    detail = resp.json().get("detail", {})
    if isinstance(detail, dict):
        assert detail.get("error") == "disposable_email"


# ---------------------------------------------------------------------------
# POST /onboarding/setup — Turnstile failure → 403
# ---------------------------------------------------------------------------

def test_onboarding_setup_turnstile_failure():
    client = _get_test_client()
    mock_db = _make_supabase_mock()

    with (
        _override_auth(),
        patch("app.api.routes.onboarding.get_supabase_service_client", return_value=mock_db),
        patch("app.api.routes.onboarding._verify_turnstile", new_callable=AsyncMock, return_value=False),
        patch("app.api.routes.onboarding.settings") as mock_settings,
    ):
        mock_settings.turnstile_secret_key = "real-secret-key"
        resp = client.post(
            "/onboarding/setup",
            json={"company_name": "Bot Co", "turnstile_token": "bad-token"},
        )

    assert resp.status_code == 403, resp.text
    detail = resp.json().get("detail", {})
    if isinstance(detail, dict):
        assert detail.get("error") == "turnstile_failed"


# ---------------------------------------------------------------------------
# POST /auth/onboarding-complete → 200
# ---------------------------------------------------------------------------

def test_onboarding_complete_sets_flag():
    client = _get_test_client()
    mock_db = _make_supabase_mock()

    with (
        _override_auth(),
        patch("app.api.routes.onboarding.get_supabase_service_client", return_value=mock_db),
    ):
        resp = client.post("/auth/onboarding-complete")

    assert resp.status_code == 200, resp.text
    assert resp.json() == {"ok": True}
