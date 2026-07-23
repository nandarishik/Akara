"""Shared pytest fixtures — Phase 2 Day 1.

Deterministic tenant/user UUIDs mirror frontend/src/test/fixtures.ts.
These IDs must never change — tests depend on them.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

# ── Deterministic fixture IDs ─────────────────────────────────────────────────
TENANT_FREE = uuid.UUID("11111111-0000-0000-0000-000000000001")
TENANT_PRO = uuid.UUID("22222222-0000-0000-0000-000000000002")
TENANT_BUSINESS = uuid.UUID("33333333-0000-0000-0000-000000000003")
TENANT_PAST_DUE = uuid.UUID("44444444-0000-0000-0000-000000000004")
TENANT_TRIAL = uuid.UUID("55555555-0000-0000-0000-000000000005")
TENANT_EMPTY = uuid.UUID("66666666-0000-0000-0000-000000000006")
USER_SUPERADMIN = uuid.UUID("00000000-aaaa-0000-0000-000000000001")


@pytest.fixture
def client() -> TestClient:
    from app.main import app

    return TestClient(app)


@pytest.fixture
def tenant_ids() -> dict[str, uuid.UUID]:
    return {
        "free": TENANT_FREE,
        "pro": TENANT_PRO,
        "business": TENANT_BUSINESS,
        "past_due": TENANT_PAST_DUE,
        "trial": TENANT_TRIAL,
        "empty": TENANT_EMPTY,
    }


USER_FREE = uuid.UUID("11111111-0001-0000-0000-000000000001")
USER_PRO = uuid.UUID("22222222-0001-0000-0000-000000000002")

# ── Authenticated test clients per plan ──────────────────────────────────────
# These provide a TestClient with the Authorization header pre-set to a
# deterministic fake JWT. The auth middleware is mocked at the unit level
# so only the token presence matters, not its signature.

def _make_authed_client(plan: str) -> TestClient:
    """Build a TestClient with get_current_user overridden (survives requests)."""
    from app.core.auth import AuthenticatedUser, get_current_user
    from app.main import app

    uid_map = {
        "free": USER_FREE,
        "pro": USER_PRO,
        "business": USER_SUPERADMIN,
    }
    uid = uid_map.get(plan, USER_FREE)
    fake_user = AuthenticatedUser(user_id=uid, email=f"{plan}@akara.test", role="admin")
    app.dependency_overrides[get_current_user] = lambda: fake_user
    return TestClient(app, headers={"Authorization": "Bearer fake-test-token"})


def _clear_auth_override() -> None:
    from app.core.auth import get_current_user
    from app.main import app

    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def authed_client_free() -> TestClient:
    client = _make_authed_client("free")
    yield client
    _clear_auth_override()


@pytest.fixture
def authed_client_pro() -> TestClient:
    client = _make_authed_client("pro")
    yield client
    _clear_auth_override()


@pytest.fixture
def authed_client_business() -> TestClient:
    client = _make_authed_client("business")
    yield client
    _clear_auth_override()
