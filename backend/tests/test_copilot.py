"""Tests for copilot functionality including LLM degradation, feedback, and provenance."""
from unittest.mock import Mock, patch

import openai
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    """Test client for FastAPI app."""
    return TestClient(app)


@pytest.fixture
def mock_auth_headers():
    """Mock authentication headers."""
    return {"Authorization": "Bearer test-token"}


@pytest.fixture
def mock_conversation_id():
    """Mock conversation ID."""
    return "test-conv-123"


@pytest.fixture
def mock_message_id():
    """Mock message ID."""
    return "test-msg-456"


class TestCopilotChat:
    """Tests for basic copilot chat functionality."""

    @patch("app.api.routes.copilot.copilot_agent")
    @patch("app.api.routes.copilot._extract_provenance")
    def test_chat_success(self, mock_provenance, mock_agent, client, mock_auth_headers):
        """Test successful chat response."""
        # Mock agent response
        mock_agent.answer.return_value = {
            "answer": "Revenue for Q1 was ₹45L",
            "sql_used": "SELECT SUM(total_amount) FROM sales WHERE ...",
            "conversation_id": "conv-123"
        }

        # Mock provenance extraction
        mock_provenance.return_value = {
            "sql_used": "SELECT SUM(total_amount) FROM sales WHERE date >= '2024-01-01'",
            "row_count": 1247,
            "date_range": "2024-01-01 to 2024-03-31",
            "data_freshness": "2024-03-15"
        }

        response = client.post(
            "/api/copilot/chat",
            json={"question": "What was the revenue in Q1?"},
            headers=mock_auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        assert "sql_used" in data
        assert "row_count" in data
        assert "conversation_id" in data

    @patch("app.api.routes.copilot.copilot_agent")
    def test_chat_stream_success(self, mock_agent, client, mock_auth_headers):
        """Test successful streaming chat response."""
        # Mock streaming agent response
        async def mock_stream():
            yield {"content": "Revenue ", "type": "content"}
            yield {"content": "for Q1 was ₹45L", "type": "content"}
            yield {"content": "", "type": "done", "conversation_id": "conv-123"}

        mock_agent.answer_stream.return_value = mock_stream()

        response = client.post(
            "/api/copilot/chat/stream",
            json={"question": "What was the revenue in Q1?"},
            headers=mock_auth_headers
        )

        assert response.status_code == 200


class TestLLMDegradation:
    """Tests for graceful LLM degradation scenarios."""

    @patch("app.api.routes.copilot.copilot_agent")
    def test_llm_rate_limit_429(self, mock_agent, client, mock_auth_headers):
        """Test handling of LLM rate limit (429) errors."""
        # Mock OpenAI rate limit error
        mock_agent.answer.side_effect = openai.RateLimitError(
            "Rate limit exceeded",
            response=Mock(status_code=429),
            body={"error": {"message": "Rate limit exceeded"}}
        )

        response = client.post(
            "/api/copilot/chat",
            json={"question": "What was the revenue?"},
            headers=mock_auth_headers
        )

        assert response.status_code == 429
        data = response.json()
        assert "AI is temporarily busy" in data["detail"]

    @patch("app.api.routes.copilot.copilot_agent")
    def test_llm_server_error_503(self, mock_agent, client, mock_auth_headers):
        """Test handling of LLM server errors (503)."""
        # Mock OpenAI server error
        mock_agent.answer.side_effect = openai.APIStatusError(
            "Service unavailable",
            response=Mock(status_code=503),
            body={"error": {"message": "Service unavailable"}}
        )

        response = client.post(
            "/api/copilot/chat",
            json={"question": "What was the revenue?"},
            headers=mock_auth_headers
        )

        assert response.status_code == 503
        data = response.json()
        assert "AI is temporarily unavailable" in data["detail"]

    @patch("app.api.routes.copilot.copilot_agent")
    def test_llm_timeout_error(self, mock_agent, client, mock_auth_headers):
        """Test handling of LLM timeout errors."""
        # Mock OpenAI timeout error
        mock_agent.answer.side_effect = openai.APITimeoutError("Request timeout")

        response = client.post(
            "/api/copilot/chat",
            json={"question": "What was the revenue?"},
            headers=mock_auth_headers
        )

        assert response.status_code == 504
        data = response.json()
        assert "taking too long" in data["detail"]

    @patch("app.api.routes.copilot.copilot_agent")
    def test_llm_general_server_error_5xx(self, mock_agent, client, mock_auth_headers):
        """Test handling of general LLM server errors (5xx)."""
        # Mock OpenAI 500 error
        mock_agent.answer.side_effect = openai.APIStatusError(
            "Internal server error",
            response=Mock(status_code=500),
            body={"error": {"message": "Internal server error"}}
        )

        response = client.post(
            "/api/copilot/chat",
            json={"question": "What was the revenue?"},
            headers=mock_auth_headers
        )

        assert response.status_code == 503
        data = response.json()
        assert "AI is temporarily unavailable" in data["detail"]

    @patch("app.api.routes.copilot.copilot_agent")
    @patch("app.api.routes.copilot.supabase")
    def test_quota_not_incremented_on_llm_failure(self, mock_supabase, mock_agent, client, mock_auth_headers):
        """Test that copilot quota is NOT incremented when LLM fails."""
        # Mock rate limit error
        mock_agent.answer.side_effect = openai.RateLimitError(
            "Rate limit exceeded",
            response=Mock(status_code=429),
            body={"error": {"message": "Rate limit exceeded"}}
        )

        # Mock quota check
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
            "copilot_calls": 50,
            "copilot_limit": 100
        }

        response = client.post(
            "/api/copilot/chat",
            json={"question": "What was the revenue?"},
            headers=mock_auth_headers
        )

        assert response.status_code == 429

        # Verify quota was NOT incremented by checking that update wasn't called for usage increment
        # The usage should only be incremented on successful LLM responses
        update_calls = [call for call in mock_supabase.table.return_value.update.call_args_list
                       if 'copilot_calls' in str(call)]
        assert len(update_calls) == 0

    @patch("app.api.routes.copilot.copilot_agent")
    def test_streaming_llm_failure(self, mock_agent, client, mock_auth_headers):
        """Test LLM failure during streaming."""
        # Mock streaming failure
        async def failing_stream():
            yield {"content": "Revenue ", "type": "content"}
            raise openai.RateLimitError(
                "Rate limit exceeded",
                response=Mock(status_code=429),
                body={"error": {"message": "Rate limit exceeded"}}
            )

        mock_agent.answer_stream.return_value = failing_stream()

        response = client.post(
            "/api/copilot/chat/stream",
            json={"question": "What was the revenue?"},
            headers=mock_auth_headers
        )

        # Stream should handle the error gracefully
        assert response.status_code in [200, 429]


class TestCopilotFeedback:
    """Tests for copilot feedback functionality."""

    @patch("app.api.routes.copilot.supabase")
    def test_positive_feedback_success(self, mock_supabase, client, mock_auth_headers, mock_conversation_id, mock_message_id):
        """Test successful positive feedback submission."""
        # Mock successful feedback insertion
        mock_supabase.table.return_value.insert.return_value.execute.return_value = Mock()

        response = client.post(
            "/api/copilot/feedback",
            json={
                "conversation_id": mock_conversation_id,
                "message_id": mock_message_id,
                "rating": 1,
                "comment": "Very helpful answer"
            },
            headers=mock_auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Feedback recorded successfully"

        # Verify feedback was inserted
        mock_supabase.table.assert_called_with("copilot_feedback")

    @patch("app.api.routes.copilot.supabase")
    def test_negative_feedback_with_comment(self, mock_supabase, client, mock_auth_headers, mock_conversation_id, mock_message_id):
        """Test negative feedback with comment."""
        # Mock successful feedback insertion
        mock_supabase.table.return_value.insert.return_value.execute.return_value = Mock()

        response = client.post(
            "/api/copilot/feedback",
            json={
                "conversation_id": mock_conversation_id,
                "message_id": mock_message_id,
                "rating": -1,
                "comment": "Answer was incorrect"
            },
            headers=mock_auth_headers
        )

        assert response.status_code == 200

        # Verify feedback was inserted with correct rating
        call_args = mock_supabase.table.return_value.insert.call_args[0][0]
        assert call_args["rating"] == -1
        assert call_args["comment"] == "Answer was incorrect"

    @patch("app.api.routes.copilot.supabase")
    def test_feedback_without_comment(self, mock_supabase, client, mock_auth_headers, mock_conversation_id, mock_message_id):
        """Test feedback submission without comment."""
        # Mock successful feedback insertion
        mock_supabase.table.return_value.insert.return_value.execute.return_value = Mock()

        response = client.post(
            "/api/copilot/feedback",
            json={
                "conversation_id": mock_conversation_id,
                "message_id": mock_message_id,
                "rating": 1
            },
            headers=mock_auth_headers
        )

        assert response.status_code == 200

        # Verify feedback was inserted without comment
        call_args = mock_supabase.table.return_value.insert.call_args[0][0]
        assert call_args["rating"] == 1
        assert call_args.get("comment") is None

    def test_feedback_invalid_rating(self, client, mock_auth_headers, mock_conversation_id, mock_message_id):
        """Test feedback with invalid rating."""
        response = client.post(
            "/api/copilot/feedback",
            json={
                "conversation_id": mock_conversation_id,
                "message_id": mock_message_id,
                "rating": 5  # Invalid rating (should be 1 or -1)
            },
            headers=mock_auth_headers
        )

        assert response.status_code == 422  # Validation error

    def test_feedback_missing_required_fields(self, client, mock_auth_headers):
        """Test feedback with missing required fields."""
        response = client.post(
            "/api/copilot/feedback",
            json={
                "rating": 1
                # Missing conversation_id and message_id
            },
            headers=mock_auth_headers
        )

        assert response.status_code == 422  # Validation error

    @patch("app.api.routes.copilot.supabase")
    def test_feedback_database_error(self, mock_supabase, client, mock_auth_headers, mock_conversation_id, mock_message_id):
        """Test feedback submission with database error."""
        # Mock database error
        mock_supabase.table.return_value.insert.return_value.execute.side_effect = Exception("Database error")

        response = client.post(
            "/api/copilot/feedback",
            json={
                "conversation_id": mock_conversation_id,
                "message_id": mock_message_id,
                "rating": 1
            },
            headers=mock_auth_headers
        )

        assert response.status_code == 500


class TestDataProvenance:
    """Tests for data provenance in copilot responses."""

    @patch("app.api.routes.copilot.copilot_agent")
    @patch("app.api.routes.copilot._extract_provenance")
    def test_provenance_extraction_with_sql(self, mock_provenance, mock_agent, client, mock_auth_headers):
        """Test provenance extraction includes SQL and metadata."""
        # Mock agent response with SQL
        mock_agent.answer.return_value = {
            "answer": "Total revenue is ₹1.2Cr",
            "sql_used": "SELECT SUM(total_amount) FROM sales WHERE date >= '2024-01-01' AND date <= '2024-03-31'",
            "conversation_id": "conv-123"
        }

        # Mock detailed provenance
        mock_provenance.return_value = {
            "sql_used": "SELECT SUM(total_amount) FROM sales WHERE date >= '2024-01-01' AND date <= '2024-03-31'",
            "row_count": 1247,
            "date_range": "2024-01-01 to 2024-03-31",
            "data_freshness": "2024-03-15"
        }

        response = client.post(
            "/api/copilot/chat",
            json={"question": "What was Q1 revenue?"},
            headers=mock_auth_headers
        )

        assert response.status_code == 200
        data = response.json()

        # Verify provenance fields are included
        assert data["sql_used"] == "SELECT SUM(total_amount) FROM sales WHERE date >= '2024-01-01' AND date <= '2024-03-31'"
        assert data["row_count"] == 1247
        assert data["date_range"] == "2024-01-01 to 2024-03-31"
        assert data["data_freshness"] == "2024-03-15"

    @patch("app.api.routes.copilot.copilot_agent")
    @patch("app.api.routes.copilot._extract_provenance")
    def test_provenance_without_sql(self, mock_provenance, mock_agent, client, mock_auth_headers):
        """Test provenance when no SQL was used."""
        # Mock agent response without SQL
        mock_agent.answer.return_value = {
            "answer": "I don't have enough information to answer that question.",
            "conversation_id": "conv-123"
        }

        # Mock empty provenance
        mock_provenance.return_value = {
            "sql_used": None,
            "row_count": None,
            "date_range": None,
            "data_freshness": None
        }

        response = client.post(
            "/api/copilot/chat",
            json={"question": "What's the weather like?"},
            headers=mock_auth_headers
        )

        assert response.status_code == 200
        data = response.json()

        # Verify provenance fields are None when no data was queried
        assert data["sql_used"] is None
        assert data["row_count"] is None
        assert data["date_range"] is None
        assert data["data_freshness"] is None

    @patch("app.api.routes.copilot.supabase")
    def test_extract_provenance_function(self, mock_supabase):
        """Test the _extract_provenance helper function."""
        from app.api.routes.copilot import _extract_provenance

        # Mock database query for row count and freshness
        mock_supabase.table.return_value.select.return_value.execute.return_value.data = [
            {"count": 1247},
            {"max_date": "2024-03-15"}
        ]

        agent_result = {
            "sql_used": "SELECT * FROM sales WHERE date >= '2024-01-01'",
            "answer": "Revenue data..."
        }

        provenance = _extract_provenance(agent_result, "tenant-123")

        assert provenance["sql_used"] == "SELECT * FROM sales WHERE date >= '2024-01-01'"
        assert isinstance(provenance["row_count"], int)
        assert provenance["data_freshness"] is not None

    def test_provenance_with_complex_query(self, client, mock_auth_headers):
        """Test provenance extraction with complex multi-table queries."""
        with patch("app.api.routes.copilot.copilot_agent") as mock_agent, \
             patch("app.api.routes.copilot._extract_provenance") as mock_provenance:

            # Mock complex query result
            mock_agent.answer.return_value = {
                "answer": "Top product analysis complete",
                "sql_used": """
                SELECT p.product_name, SUM(s.total_amount) as revenue
                FROM sales s 
                JOIN products p ON s.product_id = p.id 
                WHERE s.date >= '2024-01-01' 
                GROUP BY p.product_name 
                ORDER BY revenue DESC 
                LIMIT 10
                """,
                "conversation_id": "conv-123"
            }

            # Mock provenance for complex query
            mock_provenance.return_value = {
                "sql_used": mock_agent.answer.return_value["sql_used"],
                "row_count": 10,
                "date_range": "2024-01-01 to 2024-03-31",
                "data_freshness": "2024-03-15"
            }

            response = client.post(
                "/api/copilot/chat",
                json={"question": "What are the top 10 products by revenue?"},
                headers=mock_auth_headers
            )

            assert response.status_code == 200
            data = response.json()
            assert "JOIN" in data["sql_used"]
            assert "GROUP BY" in data["sql_used"]


class TestConversationManagement:
    """Tests for conversation soft delete and rename functionality."""

    @patch("app.api.routes.conversations.supabase")
    def test_conversation_soft_delete(self, mock_supabase, client, mock_auth_headers):
        """Test soft deletion of conversations."""
        # Mock successful soft delete
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = Mock()

        response = client.delete(
            "/api/conversations/conv-123",
            headers=mock_auth_headers
        )

        assert response.status_code == 200

        # Verify soft delete (update with deleted_at) was called instead of hard delete
        update_call = mock_supabase.table.return_value.update.call_args
        assert "deleted_at" in str(update_call)

    @patch("app.api.routes.conversations.supabase")
    def test_conversation_list_excludes_deleted(self, mock_supabase, client, mock_auth_headers):
        """Test that conversation listing excludes soft-deleted conversations."""
        # Mock conversation list response excluding deleted conversations
        mock_supabase.table.return_value.select.return_value.eq.return_value.is_.return_value.order.return_value.execute.return_value.data = [
            {"id": "conv-1", "title": "Active conversation", "deleted_at": None},
            # Soft-deleted conversations should not appear in this list
        ]

        response = client.get(
            "/api/conversations/",
            headers=mock_auth_headers
        )

        assert response.status_code == 200
        data = response.json()

        # Verify that the query filters out deleted conversations
        # (checking that is_(None) was called to filter deleted_at IS NULL)
        mock_supabase.table.return_value.select.return_value.eq.return_value.is_.assert_called_with("deleted_at", None)


class TestErrorScenarios:
    """Tests for various error scenarios."""

    def test_unauthenticated_request(self, client):
        """Test copilot request without authentication."""
        response = client.post(
            "/api/copilot/chat",
            json={"question": "What was the revenue?"}
            # No authorization header
        )

        assert response.status_code == 401

    @patch("app.api.routes.copilot.supabase")
    def test_quota_exceeded(self, mock_supabase, client, mock_auth_headers):
        """Test behavior when copilot quota is exceeded."""
        # Mock quota exceeded scenario
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
            "copilot_calls": 100,
            "copilot_limit": 100  # At limit
        }

        response = client.post(
            "/api/copilot/chat",
            json={"question": "What was the revenue?"},
            headers=mock_auth_headers
        )

        assert response.status_code == 402  # Payment required / quota exceeded

    def test_malformed_json(self, client, mock_auth_headers):
        """Test handling of malformed JSON requests."""
        response = client.post(
            "/api/copilot/chat",
            data="invalid json",
            headers={**mock_auth_headers, "Content-Type": "application/json"}
        )

        assert response.status_code == 422


if __name__ == "__main__":
    pytest.main([__file__])
