from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.domain.copilot.agent import CopilotResponse
from app.infra.llm.cost_logger import estimate_cost_usd


def test_copilot_response_has_token_fields():
    r = CopilotResponse(
        question="q", intent="i", response="a", input_tokens=11, output_tokens=7
    )
    assert r.input_tokens == 11
    assert r.output_tokens == 7


def test_estimate_cost_usd_nonzero_for_known_model():
    cost = estimate_cost_usd("openai/gpt-4o-mini", 1_000_000, 1_000_000)
    assert cost > 0


def test_log_llm_cost_uses_copilot_response_token_fields():
    result = CopilotResponse(
        question="q", intent="i", response="a", input_tokens=9, output_tokens=4
    )
    input_tokens = result.input_tokens or 0
    output_tokens = result.output_tokens or 0
    assert input_tokens == 9 and output_tokens == 4
    with patch("app.core.tenant.get_supabase_service_client") as m:
        m.return_value.table.return_value.insert.return_value.execute.return_value = (
            MagicMock()
        )
        from app.infra.llm.cost_logger import log_llm_cost

        log_llm_cost(
            tenant_id=uuid4(),
            user_id=uuid4(),
            feature="copilot",
            model="openai/gpt-4o-mini",
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )
        payload = m.return_value.table.return_value.insert.call_args[0][0]
        assert payload["input_tokens"] == 9
        assert payload["output_tokens"] == 4
        assert payload["cost_usd"] > 0


@pytest.mark.asyncio
async def test_openrouter_complete_captures_usage():
    from app.infra.llm.openrouter import OpenRouterClient

    client = OpenRouterClient(api_key="sk-test", model="openai/gpt-4o-mini")
    fake_response = MagicMock()
    fake_response.json.return_value = {
        "choices": [{"message": {"content": "hi"}}],
        "usage": {"prompt_tokens": 3, "completion_tokens": 5},
    }
    fake_response.raise_for_status = MagicMock()

    mock_async_client = MagicMock()
    mock_async_client.__aenter__ = AsyncMock(return_value=mock_async_client)
    mock_async_client.__aexit__ = AsyncMock(return_value=False)
    mock_async_client.post = AsyncMock(return_value=fake_response)

    with patch(
        "app.infra.llm.openrouter.httpx.AsyncClient", return_value=mock_async_client
    ):
        text = await client.complete("hello")
    assert text == "hi"
    assert client.last_input_tokens == 3
    assert client.last_output_tokens == 5
