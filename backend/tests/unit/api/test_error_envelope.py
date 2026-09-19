"""ErrorEnvelope consistency tests for Phase 2."""

from __future__ import annotations

from contextlib import ExitStack
from unittest.mock import AsyncMock, MagicMock, patch

import openai
import pytest
from fastapi.testclient import TestClient

from tests.conftest import TENANT_PRO, USER_PRO
from tests.unit.domain.test_copilot import _mock_copilot_supabase, _patch_copilot_stack


@pytest.fixture
def authed_copilot_client() -> TestClient:
    from app.core.auth import AuthenticatedUser, get_current_user
    from app.core.tenant import TenantContext, get_tenant_context
    from app.main import app

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
    client = TestClient(app, headers={"Authorization": "Bearer fake-test-token"})
    yield client
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_tenant_context, None)


def test_copilot_rate_limit_envelope(authed_copilot_client: TestClient) -> None:
    mock_agent = MagicMock()
    mock_agent.answer = AsyncMock(
        side_effect=openai.APIStatusError(
            "Rate limit exceeded",
            response=MagicMock(status_code=429),
            body={"error": {"message": "Rate limit exceeded"}},
        )
    )
    mock_supa = _mock_copilot_supabase()

    with ExitStack() as stack:
        for p in _patch_copilot_stack(MagicMock(return_value=mock_agent), mock_supa):
            stack.enter_context(p)
        mock_schema = stack.enter_context(patch("app.api.v1.copilot.SchemaDiscovery"))
        mock_prompt = stack.enter_context(patch("app.api.v1.copilot.PromptGenerator"))
        mock_schema.return_value.get_columns.return_value = []
        mock_schema.return_value.get_allowed_vocabulary.return_value = []
        mock_prompt.return_value.build_schema_context.return_value = ""
        mock_prompt.return_value.build_planner_addendum.return_value = ""
        mock_prompt.return_value.build_synthesizer_addendum.return_value = ""
        mock_prompt.return_value.build_language_addendum.return_value = ""

        response = authed_copilot_client.post(
            "/v1/copilot/chat",
            json={"question": "What was the revenue?", "stream": False},
        )

    assert response.status_code == 503
    body = response.json()
    assert body["ok"] is False
    assert body["code"] == "LLM_UNAVAILABLE"
    assert body["detail"]["retry_after"] == 30
    dumped = str(body)
    assert "Traceback" not in dumped
    assert 'File "' not in dumped


def test_webhook_invalid_signature_envelope() -> None:
    from app.main import app

    client = TestClient(app)
    response = client.post(
        "/v1/billing/webhook",
        content=b"{}",
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 400
    body = response.json()
    assert body["ok"] is False
    assert isinstance(body["code"], str)
    assert body["code"]
    dumped = str(body)
    assert "Traceback" not in dumped
    assert 'File "' not in dumped


def test_copilot_validation_envelope() -> None:
    from app.core.auth import AuthenticatedUser, get_current_user
    from app.core.tenant import TenantContext, get_tenant_context
    from app.main import app
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
        dumped = str(body)
        assert "Traceback" not in dumped
        assert 'File "' not in dumped
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_tenant_context, None)


def test_kpi_unauthenticated_envelope() -> None:
    from app.main import app

    client = TestClient(app)
    response = client.get("/v1/kpi/")
    assert response.status_code == 401
    body = response.json()
    assert body["ok"] is False
    assert body["code"] == "UNAUTHENTICATED"
    dumped = str(body)
    assert "Traceback" not in dumped
    assert 'File "' not in dumped
