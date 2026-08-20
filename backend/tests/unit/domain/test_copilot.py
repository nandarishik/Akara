"""Tests for copilot functionality including LLM degradation, feedback, and provenance."""

from __future__ import annotations

from contextlib import ExitStack
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from uuid import UUID

import openai
import pytest
from fastapi.testclient import TestClient

from app.domain.copilot.agent import CopilotResponse
from tests.conftest import TENANT_PRO, USER_PRO

CONV_ID = UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
MSG_ID = "test-msg-456"


@pytest.fixture
def authed_copilot_client() -> TestClient:
    from app.core.auth import AuthenticatedUser, get_current_user
    from app.core.tenant import TenantContext, get_tenant_context
    from app.main import app

    fake_user = AuthenticatedUser(user_id=USER_PRO, email="pro@akara.test", role="admin")
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


def _mock_copilot_supabase(*, feedback_rows: list | None = None) -> MagicMock:
    supa = MagicMock()
    supa.rpc.return_value.execute.return_value = MagicMock(data=None)

    import_chain = MagicMock()
    import_chain.execute.return_value = MagicMock(
        data=[{"created_at": "2026-07-20T00:00:00+00:00"}]
    )

    feedback_table = MagicMock()
    feedback_insert = MagicMock()
    feedback_insert.execute.return_value = MagicMock(
        data=feedback_rows if feedback_rows is not None else [{"id": "fb-1"}]
    )
    feedback_table.insert.return_value = feedback_insert
    supa._feedback_table = feedback_table

    def table_side(name: str) -> MagicMock:
        m = MagicMock()
        if name == "import_jobs":
            m.select.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value = (
                import_chain
            )
        elif name == "copilot_feedback":
            return feedback_table
        elif name == "conversations":
            insert_chain = MagicMock()
            insert_chain.execute.return_value = MagicMock(data=[{"id": str(CONV_ID)}])
            m.insert.return_value = insert_chain
            update_chain = MagicMock()
            update_chain.eq.return_value.execute.return_value = MagicMock(data=[{}])
            m.update.return_value = update_chain
        elif name == "chat_history":
            insert_chain = MagicMock()
            insert_chain.execute.return_value = MagicMock(data=[{}])
            m.insert.return_value = insert_chain
        return m

    supa.table.side_effect = table_side
    return supa


def _mock_agent_result(**overrides) -> CopilotResponse:
    defaults = {
        "question": "What was the revenue in Q1?",
        "intent": "revenue_query",
        "response": "Revenue for Q1 was ₹45L",
        "sql_queries_run": ["SELECT SUM(total_amount) FROM sales WHERE date >= '2024-01-01'"],
        "llm_model": "test-model",
        "response_time_ms": 120,
    }
    defaults.update(overrides)
    return CopilotResponse(**defaults)


def _patch_copilot_stack(mock_build_agent, mock_supa):
    """Common patches for /copilot/chat non-streaming tests."""
    return [
        patch("app.core.plan_guard._get_current_usage", return_value={"copilot_calls": 5}),
        patch("app.api.routes.copilot.get_supabase_service_client", return_value=mock_supa),
        patch("app.api.routes.copilot.SchemaDiscovery"),
        patch("app.api.routes.copilot.PromptGenerator"),
        patch("app.api.routes.copilot.log_llm_cost"),
        patch("app.api.routes.copilot.record_user_event"),
        patch("app.api.routes.copilot.maybe_notify_copilot_quota_threshold"),
        patch("app.api.routes.copilot._build_agent", mock_build_agent),
    ]


class TestCopilotChat:
    """Tests for basic copilot chat functionality."""

    def test_chat_success(self, authed_copilot_client):
        mock_agent = MagicMock()
        mock_agent.answer = AsyncMock(return_value=_mock_agent_result())
        mock_supa = _mock_copilot_supabase()

        with ExitStack() as stack:
            for p in _patch_copilot_stack(MagicMock(return_value=mock_agent), mock_supa):
                stack.enter_context(p)
            mock_schema = stack.enter_context(patch("app.api.routes.copilot.SchemaDiscovery"))
            mock_prompt = stack.enter_context(patch("app.api.routes.copilot.PromptGenerator"))
            mock_schema.return_value.get_columns.return_value = ["total_amount"]
            mock_schema.return_value.get_allowed_vocabulary.return_value = []
            mock_prompt.return_value.build_schema_context.return_value = "schema ctx"
            mock_prompt.return_value.build_planner_addendum.return_value = ""
            mock_prompt.return_value.build_synthesizer_addendum.return_value = ""
            mock_prompt.return_value.build_language_addendum.return_value = ""

            response = authed_copilot_client.post(
                "/copilot/chat",
                json={"question": "What was the revenue in Q1?", "stream": False},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["response"] == "Revenue for Q1 was ₹45L"
        assert "conversation_id" in data
        assert "sql_used" in data

    def test_chat_stream_success(self, authed_copilot_client):
        mock_agent = MagicMock()

        async def mock_stream():
            yield "Revenue "
            yield "for Q1 was ₹45L"

        mock_agent.answer_stream = mock_stream
        mock_supa = _mock_copilot_supabase()

        with ExitStack() as stack:
            for p in _patch_copilot_stack(MagicMock(return_value=mock_agent), mock_supa):
                stack.enter_context(p)
            mock_schema = stack.enter_context(patch("app.api.routes.copilot.SchemaDiscovery"))
            mock_prompt = stack.enter_context(patch("app.api.routes.copilot.PromptGenerator"))
            mock_schema.return_value.get_columns.return_value = ["total_amount"]
            mock_schema.return_value.get_allowed_vocabulary.return_value = []
            mock_prompt.return_value.build_schema_context.return_value = "schema ctx"
            mock_prompt.return_value.build_planner_addendum.return_value = ""
            mock_prompt.return_value.build_synthesizer_addendum.return_value = ""
            mock_prompt.return_value.build_language_addendum.return_value = ""

            response = authed_copilot_client.post(
                "/copilot/chat",
                json={"question": "What was the revenue in Q1?"},
            )

        assert response.status_code == 200


class TestLLMDegradation:
    """Tests for graceful LLM degradation scenarios."""

    def test_llm_rate_limit_429(self, authed_copilot_client):
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
            mock_schema = stack.enter_context(patch("app.api.routes.copilot.SchemaDiscovery"))
            mock_prompt = stack.enter_context(patch("app.api.routes.copilot.PromptGenerator"))
            mock_schema.return_value.get_columns.return_value = []
            mock_schema.return_value.get_allowed_vocabulary.return_value = []
            mock_prompt.return_value.build_schema_context.return_value = ""
            mock_prompt.return_value.build_planner_addendum.return_value = ""
            mock_prompt.return_value.build_synthesizer_addendum.return_value = ""
            mock_prompt.return_value.build_language_addendum.return_value = ""

            response = authed_copilot_client.post(
                "/copilot/chat",
                json={"question": "What was the revenue?", "stream": False},
            )

        assert response.status_code == 503
        detail = response.json()["detail"]
        assert detail["error"] == "ai_rate_limited"
        assert "temporarily busy" in detail["message"]

    def test_llm_server_error_503(self, authed_copilot_client):
        mock_agent = MagicMock()
        mock_agent.answer = AsyncMock(
            side_effect=openai.APIStatusError(
                "Service unavailable",
                response=MagicMock(status_code=503),
                body={"error": {"message": "Service unavailable"}},
            )
        )
        mock_supa = _mock_copilot_supabase()

        with ExitStack() as stack:
            for p in _patch_copilot_stack(MagicMock(return_value=mock_agent), mock_supa):
                stack.enter_context(p)
            mock_schema = stack.enter_context(patch("app.api.routes.copilot.SchemaDiscovery"))
            mock_prompt = stack.enter_context(patch("app.api.routes.copilot.PromptGenerator"))
            mock_schema.return_value.get_columns.return_value = []
            mock_schema.return_value.get_allowed_vocabulary.return_value = []
            mock_prompt.return_value.build_schema_context.return_value = ""
            mock_prompt.return_value.build_planner_addendum.return_value = ""
            mock_prompt.return_value.build_synthesizer_addendum.return_value = ""
            mock_prompt.return_value.build_language_addendum.return_value = ""

            response = authed_copilot_client.post(
                "/copilot/chat",
                json={"question": "What was the revenue?", "stream": False},
            )

        assert response.status_code == 503
        assert response.json()["detail"]["error"] == "ai_unavailable"

    def test_llm_timeout_error(self, authed_copilot_client):
        mock_agent = MagicMock()
        mock_agent.answer = AsyncMock(side_effect=openai.APITimeoutError("Request timeout"))
        mock_supa = _mock_copilot_supabase()

        with ExitStack() as stack:
            for p in _patch_copilot_stack(MagicMock(return_value=mock_agent), mock_supa):
                stack.enter_context(p)
            mock_schema = stack.enter_context(patch("app.api.routes.copilot.SchemaDiscovery"))
            mock_prompt = stack.enter_context(patch("app.api.routes.copilot.PromptGenerator"))
            mock_schema.return_value.get_columns.return_value = []
            mock_schema.return_value.get_allowed_vocabulary.return_value = []
            mock_prompt.return_value.build_schema_context.return_value = ""
            mock_prompt.return_value.build_planner_addendum.return_value = ""
            mock_prompt.return_value.build_synthesizer_addendum.return_value = ""
            mock_prompt.return_value.build_language_addendum.return_value = ""

            response = authed_copilot_client.post(
                "/copilot/chat",
                json={"question": "What was the revenue?", "stream": False},
            )

        assert response.status_code == 504
        assert "taking too long" in response.json()["detail"]["message"]

    def test_llm_general_server_error_5xx(self, authed_copilot_client):
        mock_agent = MagicMock()
        mock_agent.answer = AsyncMock(
            side_effect=openai.APIStatusError(
                "Internal server error",
                response=MagicMock(status_code=500),
                body={"error": {"message": "Internal server error"}},
            )
        )
        mock_supa = _mock_copilot_supabase()

        with ExitStack() as stack:
            for p in _patch_copilot_stack(MagicMock(return_value=mock_agent), mock_supa):
                stack.enter_context(p)
            mock_schema = stack.enter_context(patch("app.api.routes.copilot.SchemaDiscovery"))
            mock_prompt = stack.enter_context(patch("app.api.routes.copilot.PromptGenerator"))
            mock_schema.return_value.get_columns.return_value = []
            mock_schema.return_value.get_allowed_vocabulary.return_value = []
            mock_prompt.return_value.build_schema_context.return_value = ""
            mock_prompt.return_value.build_planner_addendum.return_value = ""
            mock_prompt.return_value.build_synthesizer_addendum.return_value = ""
            mock_prompt.return_value.build_language_addendum.return_value = ""

            response = authed_copilot_client.post(
                "/copilot/chat",
                json={"question": "What was the revenue?", "stream": False},
            )

        assert response.status_code == 503
        assert response.json()["detail"]["error"] == "ai_unavailable"

    def test_quota_not_incremented_on_llm_failure(self, authed_copilot_client):
        mock_agent = MagicMock()
        mock_agent.answer = AsyncMock(
            side_effect=openai.RateLimitError(
                "Rate limit exceeded",
                response=MagicMock(status_code=429),
                body={"error": {"message": "Rate limit exceeded"}},
            )
        )
        mock_supa = _mock_copilot_supabase()

        with ExitStack() as stack:
            for p in _patch_copilot_stack(MagicMock(return_value=mock_agent), mock_supa):
                stack.enter_context(p)
            mock_schema = stack.enter_context(patch("app.api.routes.copilot.SchemaDiscovery"))
            mock_prompt = stack.enter_context(patch("app.api.routes.copilot.PromptGenerator"))
            mock_schema.return_value.get_columns.return_value = []
            mock_schema.return_value.get_allowed_vocabulary.return_value = []
            mock_prompt.return_value.build_schema_context.return_value = ""
            mock_prompt.return_value.build_planner_addendum.return_value = ""
            mock_prompt.return_value.build_synthesizer_addendum.return_value = ""
            mock_prompt.return_value.build_language_addendum.return_value = ""

            response = authed_copilot_client.post(
                "/copilot/chat",
                json={"question": "What was the revenue?", "stream": False},
            )

        assert response.status_code == 503
        mock_supa.rpc.assert_not_called()

    def test_streaming_llm_failure(self, authed_copilot_client):
        mock_agent = MagicMock()

        async def failing_stream():
            yield "Revenue "
            raise openai.APIStatusError(
                "Rate limit exceeded",
                response=MagicMock(status_code=429),
                body={"error": {"message": "Rate limit exceeded"}},
            )

        mock_agent.answer_stream = failing_stream
        mock_supa = _mock_copilot_supabase()

        with ExitStack() as stack:
            for p in _patch_copilot_stack(MagicMock(return_value=mock_agent), mock_supa):
                stack.enter_context(p)
            mock_schema = stack.enter_context(patch("app.api.routes.copilot.SchemaDiscovery"))
            mock_prompt = stack.enter_context(patch("app.api.routes.copilot.PromptGenerator"))
            mock_schema.return_value.get_columns.return_value = []
            mock_schema.return_value.get_allowed_vocabulary.return_value = []
            mock_prompt.return_value.build_schema_context.return_value = ""
            mock_prompt.return_value.build_planner_addendum.return_value = ""
            mock_prompt.return_value.build_synthesizer_addendum.return_value = ""
            mock_prompt.return_value.build_language_addendum.return_value = ""

            response = authed_copilot_client.post(
                "/copilot/chat",
                json={"question": "What was the revenue?"},
            )

        assert response.status_code == 200


class TestCopilotFeedback:
    """Tests for copilot feedback functionality."""

    @patch("app.api.routes.copilot.get_supabase_service_client")
    def test_positive_feedback_success(
        self, mock_supa_fn, authed_copilot_client, mock_conversation_id, mock_message_id
    ):
        mock_supa_fn.return_value = _mock_copilot_supabase()

        response = authed_copilot_client.post(
            "/copilot/feedback",
            json={
                "conversation_id": mock_conversation_id,
                "message_id": mock_message_id,
                "rating": 1,
                "comment": "Very helpful answer",
            },
        )

        assert response.status_code == 200
        assert response.json()["success"] is True

    @patch("app.api.routes.copilot.get_supabase_service_client")
    def test_negative_feedback_with_comment(
        self, mock_supa_fn, authed_copilot_client, mock_conversation_id, mock_message_id
    ):
        mock_supa = _mock_copilot_supabase()
        mock_supa_fn.return_value = mock_supa

        response = authed_copilot_client.post(
            "/copilot/feedback",
            json={
                "conversation_id": mock_conversation_id,
                "message_id": mock_message_id,
                "rating": -1,
                "comment": "Answer was incorrect",
            },
        )

        assert response.status_code == 200
        insert_payload = mock_supa._feedback_table.insert.call_args[0][0]
        assert insert_payload["rating"] == -1
        assert insert_payload["comment"] == "Answer was incorrect"

    @patch("app.api.routes.copilot.get_supabase_service_client")
    def test_feedback_without_comment(
        self, mock_supa_fn, authed_copilot_client, mock_conversation_id, mock_message_id
    ):
        mock_supa = _mock_copilot_supabase()
        mock_supa_fn.return_value = mock_supa

        response = authed_copilot_client.post(
            "/copilot/feedback",
            json={
                "conversation_id": mock_conversation_id,
                "message_id": mock_message_id,
                "rating": 1,
            },
        )

        assert response.status_code == 200
        insert_payload = mock_supa._feedback_table.insert.call_args[0][0]
        assert insert_payload["rating"] == 1
        assert insert_payload.get("comment") is None

    def test_feedback_invalid_rating(
        self, authed_copilot_client, mock_conversation_id, mock_message_id
    ):
        response = authed_copilot_client.post(
            "/copilot/feedback",
            json={
                "conversation_id": mock_conversation_id,
                "message_id": mock_message_id,
                "rating": 5,
            },
        )

        assert response.status_code == 400

    def test_feedback_missing_required_fields(self, authed_copilot_client):
        response = authed_copilot_client.post(
            "/copilot/feedback",
            json={"rating": 1},
        )

        assert response.status_code == 422

    @patch("app.api.routes.copilot.get_supabase_service_client")
    def test_feedback_database_error(
        self, mock_supa_fn, authed_copilot_client, mock_conversation_id, mock_message_id
    ):
        mock_supa = MagicMock()
        mock_supa.table.return_value.insert.return_value.execute.side_effect = Exception(
            "Database error"
        )
        mock_supa_fn.return_value = mock_supa

        response = authed_copilot_client.post(
            "/copilot/feedback",
            json={
                "conversation_id": mock_conversation_id,
                "message_id": mock_message_id,
                "rating": 1,
            },
        )

        assert response.status_code == 500


@pytest.fixture
def mock_conversation_id():
    return str(CONV_ID)


@pytest.fixture
def mock_message_id():
    return MSG_ID


class TestDataProvenance:
    """Tests for data provenance in copilot responses."""

    def test_provenance_extraction_with_sql(self, authed_copilot_client):
        mock_agent = MagicMock()
        mock_agent.answer = AsyncMock(
            return_value=_mock_agent_result(
                response="Total revenue is ₹1.2Cr",
                sql_queries_run=[
                    "SELECT SUM(total_amount) FROM sales WHERE date >= '2024-01-01'"
                ],
            )
        )
        mock_supa = _mock_copilot_supabase()

        with ExitStack() as stack:
            stack.enter_context(
                patch(
                    "app.api.routes.copilot._extract_provenance",
                    return_value={
                        "sql_used": "SELECT SUM(total_amount) FROM sales WHERE date >= '2024-01-01'",
                        "row_count": 1247,
                        "date_range": "2024-01-01 to 2024-03-31",
                        "data_freshness": "Updated today",
                    },
                )
            )
            for p in _patch_copilot_stack(MagicMock(return_value=mock_agent), mock_supa):
                stack.enter_context(p)
            mock_schema = stack.enter_context(patch("app.api.routes.copilot.SchemaDiscovery"))
            mock_prompt = stack.enter_context(patch("app.api.routes.copilot.PromptGenerator"))
            mock_schema.return_value.get_columns.return_value = ["total_amount"]
            mock_schema.return_value.get_allowed_vocabulary.return_value = []
            mock_prompt.return_value.build_schema_context.return_value = "schema"
            mock_prompt.return_value.build_planner_addendum.return_value = ""
            mock_prompt.return_value.build_synthesizer_addendum.return_value = ""
            mock_prompt.return_value.build_language_addendum.return_value = ""

            response = authed_copilot_client.post(
                "/copilot/chat",
                json={"question": "What was Q1 revenue?", "stream": False},
            )

        assert response.status_code == 200
        data = response.json()
        assert "SUM(total_amount)" in (data["sql_used"] or "")
        assert data["row_count"] == 1247

    def test_provenance_without_sql(self, authed_copilot_client):
        mock_agent = MagicMock()
        mock_agent.answer = AsyncMock(
            return_value=_mock_agent_result(
                response="I don't have enough information to answer that question.",
                sql_queries_run=[],
            )
        )
        mock_supa = _mock_copilot_supabase()

        with ExitStack() as stack:
            stack.enter_context(
                patch(
                    "app.api.routes.copilot._extract_provenance",
                    return_value={
                        "sql_used": None,
                        "row_count": None,
                        "date_range": None,
                        "data_freshness": None,
                    },
                )
            )
            for p in _patch_copilot_stack(MagicMock(return_value=mock_agent), mock_supa):
                stack.enter_context(p)
            mock_schema = stack.enter_context(patch("app.api.routes.copilot.SchemaDiscovery"))
            mock_prompt = stack.enter_context(patch("app.api.routes.copilot.PromptGenerator"))
            mock_schema.return_value.get_columns.return_value = []
            mock_schema.return_value.get_allowed_vocabulary.return_value = []
            mock_prompt.return_value.build_schema_context.return_value = ""
            mock_prompt.return_value.build_planner_addendum.return_value = ""
            mock_prompt.return_value.build_synthesizer_addendum.return_value = ""
            mock_prompt.return_value.build_language_addendum.return_value = ""

            response = authed_copilot_client.post(
                "/copilot/chat",
                json={"question": "What's the weather like?", "stream": False},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["sql_used"] is None
        assert data["row_count"] is None

    @patch("app.api.routes.copilot.get_supabase_service_client")
    def test_extract_provenance_function(self, mock_supa_fn):
        from app.api.routes.copilot import _extract_provenance

        supa = MagicMock()
        supa.table.return_value.select.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[{"created_at": "2026-07-20T00:00:00+00:00"}]
        )
        mock_supa_fn.return_value = supa

        result = SimpleNamespace(
            sql_executed="SELECT * FROM sales WHERE date >= '2024-01-01'",
            rows_analyzed=1247,
        )

        provenance = _extract_provenance(result, supa, TENANT_PRO)

        assert "SELECT" in (provenance["sql_used"] or "")
        assert provenance["row_count"] == 1247
        assert provenance["data_freshness"] is not None

    def test_provenance_with_complex_query(self, authed_copilot_client):
        complex_sql = """
                SELECT p.product_name, SUM(s.total_amount) as revenue
                FROM sales s
                JOIN products p ON s.product_id = p.id
                WHERE s.date >= '2024-01-01'
                GROUP BY p.product_name
                ORDER BY revenue DESC
                LIMIT 10
                """
        mock_agent = MagicMock()
        mock_agent.answer = AsyncMock(
            return_value=_mock_agent_result(
                response="Top product analysis complete",
                sql_queries_run=[complex_sql],
            )
        )
        mock_supa = _mock_copilot_supabase()

        with ExitStack() as stack:
            stack.enter_context(
                patch(
                    "app.api.routes.copilot._extract_provenance",
                    return_value={
                        "sql_used": complex_sql,
                        "row_count": 10,
                        "date_range": "2024-01-01 to 2024-03-31",
                        "data_freshness": "Updated today",
                    },
                )
            )
            for p in _patch_copilot_stack(MagicMock(return_value=mock_agent), mock_supa):
                stack.enter_context(p)
            mock_schema = stack.enter_context(patch("app.api.routes.copilot.SchemaDiscovery"))
            mock_prompt = stack.enter_context(patch("app.api.routes.copilot.PromptGenerator"))
            mock_schema.return_value.get_columns.return_value = ["product_name"]
            mock_schema.return_value.get_allowed_vocabulary.return_value = []
            mock_prompt.return_value.build_schema_context.return_value = ""
            mock_prompt.return_value.build_planner_addendum.return_value = ""
            mock_prompt.return_value.build_synthesizer_addendum.return_value = ""
            mock_prompt.return_value.build_language_addendum.return_value = ""

            response = authed_copilot_client.post(
                "/copilot/chat",
                json={"question": "What are the top 10 products by revenue?", "stream": False},
            )

        assert response.status_code == 200
        assert "JOIN" in (response.json()["sql_used"] or "")


class TestConversationManagement:
    """Tests for conversation soft delete and rename functionality."""

    @patch("app.api.routes.conversations.get_supabase_service_client")
    def test_conversation_soft_delete(self, mock_supa_fn, authed_copilot_client):
        supa = MagicMock()
        update_chain = MagicMock()
        update_chain.eq.return_value.eq.return_value.is_.return_value.execute.return_value = MagicMock(
            data=[{"id": str(CONV_ID)}]
        )
        supa.table.return_value.update.return_value = update_chain
        mock_supa_fn.return_value = supa

        response = authed_copilot_client.delete(f"/copilot/conversations/{CONV_ID}")

        assert response.status_code == 204
        update_call = supa.table.return_value.update.call_args
        assert "deleted_at" in update_call[0][0]

    @patch("app.api.routes.conversations.get_supabase_service_client")
    def test_conversation_list_excludes_deleted(self, mock_supa_fn, authed_copilot_client):
        supa = MagicMock()
        rpc_chain = MagicMock()
        rpc_chain.execute.return_value = MagicMock(
            data=[{"id": "conv-1", "title": "Active conversation", "deleted_at": None}]
        )
        supa.rpc.return_value = rpc_chain
        mock_supa_fn.return_value = supa

        response = authed_copilot_client.get("/copilot/conversations/")

        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestErrorScenarios:
    """Tests for various error scenarios."""

    def test_unauthenticated_request(self):
        from app.main import app

        with TestClient(app) as client:
            response = client.post(
                "/copilot/chat",
                json={"question": "What was the revenue?", "stream": False},
            )
        assert response.status_code == 401

    @patch("app.core.plan_guard._get_current_usage")
    def test_quota_exceeded(self, mock_usage, authed_copilot_client):
        mock_usage.return_value = {"copilot_calls": 400}

        response = authed_copilot_client.post(
            "/copilot/chat",
            json={"question": "What was the revenue?", "stream": False},
        )

        assert response.status_code == 402

    def test_malformed_json(self, authed_copilot_client):
        response = authed_copilot_client.post(
            "/copilot/chat",
            content="invalid json",
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 422
