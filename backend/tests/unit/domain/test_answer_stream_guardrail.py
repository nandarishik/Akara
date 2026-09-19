"""DEV2: answer_stream must append ⚠️ Note: when a guardrail fails."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest

from app.domain.copilot.agent import CopilotAgent
from app.domain.copilot.guardrails.checks import GuardrailResult


@pytest.mark.asyncio
async def test_answer_stream_appends_guardrail_warning() -> None:
    planner = MagicMock()
    plan = MagicMock()
    plan.steps = []
    plan.intent = "chat"
    plan.requires_context = []
    planner.plan = AsyncMock(return_value=plan)

    async def _stream(**_kwargs):
        yield "hello "

        yield "world"

    synthesizer = MagicMock()
    synthesizer.conversational_stream = MagicMock(return_value=_stream())
    synthesizer.synthesize_stream = MagicMock(return_value=_stream())

    sql_tool = MagicMock()
    context_tool = MagicMock()

    agent = CopilotAgent(
        planner=planner,
        synthesizer=synthesizer,
        sql_tool=sql_tool,
        context_tool=context_tool,
        tenant_id=UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
    )

    with (
        patch(
            "app.domain.copilot.agent.is_conversational",
            return_value=True,
        ),
        patch(
            "app.domain.copilot.agent.run_all_guardrails",
            return_value=[
                GuardrailResult(
                    passed=False,
                    check_name="numeric_digest",
                    message="boom",
                )
            ],
        ),
    ):
        chunks: list[str] = []
        async for chunk in agent.answer_stream(
            question="hi",
            schema_context="",
            available_columns=[],
            date_range=("2024-01-01", "2026-09-09"),
        ):
            chunks.append(chunk)

    joined = "".join(chunks)
    assert "⚠️ Note: boom" in joined
