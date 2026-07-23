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
