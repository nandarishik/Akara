"""Phase 2 prefix + alias route tests."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app

BASELINE = (
    Path(__file__).resolve().parents[3]
    / "docs"
    / "akara-phases"
    / "p02-routes-baseline.txt"
)
SKIP_PREFIXES = ("/superadmin", "/admin", "/docs", "/redoc", "/openapi.json")


def _customer_paths() -> list[str]:
    paths: list[str] = []
    for line in BASELINE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith(SKIP_PREFIXES):
            continue
        paths.append(line)
    return paths


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_health_prefixed_and_unprefixed(client: TestClient) -> None:
    for path in ("/health", "/v1/health"):
        response = client.get(path)
        assert response.status_code != 404
        assert response.status_code == 200


def test_ready_prefixed_and_unprefixed(client: TestClient) -> None:
    for path in ("/ready", "/v1/ready"):
        assert client.get(path).status_code != 404


def test_version_prefixed_and_unprefixed(client: TestClient) -> None:
    for path in ("/version", "/v1/version"):
        assert client.get(path).status_code != 404


def test_auth_me_prefixed_and_unprefixed(client: TestClient) -> None:
    for path in ("/auth/me", "/v1/auth/me"):
        assert client.get(path).status_code != 404


def test_kpi_prefixed_and_unprefixed(client: TestClient) -> None:
    for path in ("/kpi/", "/v1/kpi/"):
        assert client.get(path).status_code != 404


def test_copilot_chat_prefixed_and_unprefixed(client: TestClient) -> None:
    for path in ("/copilot/chat", "/v1/copilot/chat"):
        response = client.post(path, json={"question": "hi"})
        assert response.status_code != 404


def test_401_returns_error_envelope(client: TestClient) -> None:
    response = client.get("/v1/auth/me")
    assert response.status_code == 401
    body = response.json()
    assert body["ok"] is False
    assert body["code"] == "UNAUTHENTICATED"


def test_422_returns_error_envelope() -> None:
    from app.core.auth import AuthenticatedUser, get_current_user
    from app.core.tenant import TenantContext, get_tenant_context
    from tests.conftest import TENANT_PRO, USER_PRO

    fake_user = AuthenticatedUser(
        user_id=USER_PRO, email="pro@akara.test", role="admin"
    )
    fake_tenant = TenantContext(
        tenant_id=TENANT_PRO,
        role="admin",
        user_id=USER_PRO,
        plan="pro",
        plan_status="active",
    )
    app.dependency_overrides[get_current_user] = lambda: fake_user
    app.dependency_overrides[get_tenant_context] = lambda: fake_tenant
    try:
        client = TestClient(app, headers={"Authorization": "Bearer fake-test-token"})
        response = client.post("/v1/copilot/chat", json={})
        assert response.status_code == 422
        body = response.json()
        assert body["ok"] is False
        assert body["code"] == "VALIDATION_ERROR"
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_tenant_context, None)


def test_billing_webhook_aliased(client: TestClient) -> None:
    for path in ("/billing/webhook", "/v1/billing/webhook"):
        response = client.post(
            path, content=b"{}", headers={"Content-Type": "application/json"}
        )
        assert response.status_code != 404


@pytest.mark.parametrize("path", _customer_paths())
def test_customer_path_mounted_prefixed_and_alias(path: str) -> None:
    spec_paths = app.openapi()["paths"]
    assert path in spec_paths, f"alias missing from OpenAPI: {path}"
    v1_path = path if path.startswith("/v1") else f"/v1{path}"
    assert v1_path in spec_paths, f"/v1 mount missing from OpenAPI: {v1_path}"
