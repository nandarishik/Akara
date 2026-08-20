import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.domain.copilot.planner import Plan, Planner, is_conversational


@pytest.fixture
def mock_llm() -> MagicMock:
    llm = MagicMock()
    llm.complete = AsyncMock(
        return_value=json.dumps(
            {
                "intent": "top products by revenue",
                "steps": [
                    {
                        "step_id": 1,
                        "description": "Get top products",
                        "sql": (
                            "SELECT product_name, SUM(total_amount) "
                            "FROM public.sales_data "
                            "WHERE tenant_id = :tenant_id "
                            "GROUP BY product_name "
                            "ORDER BY 2 DESC LIMIT 5"
                        ),
                    }
                ],
                "requires_context": [],
                "response_format": "table",
            }
        )
    )
    return llm


def test_is_conversational_greeting() -> None:
    assert is_conversational("hello") is True
    assert is_conversational("hi!") is True


def test_is_conversational_data_question() -> None:
    assert is_conversational("what are my top 5 selling products") is False
    assert is_conversational("What were my top 5 selling products last month?") is False


async def test_planner_returns_plan(mock_llm: MagicMock) -> None:
    planner = Planner(llm=mock_llm)
    plan = await planner.plan(
        question="What are my top products?",
        schema_context="sales_data",
        date_range=("2024-01-01", "2024-12-31"),
    )
    assert isinstance(plan, Plan)
    assert plan.intent == "top products by revenue"
    assert len(plan.steps) == 1
    assert "SELECT" in plan.steps[0].sql


async def test_planner_analytics_fallback_when_json_invalid() -> None:
    llm = MagicMock()
    llm.complete = AsyncMock(return_value="not json at all")
    planner = Planner(llm=llm)
    plan = await planner.plan(
        question="what are my top 5 selling products",
        schema_context="sales_data",
        date_range=("2025-12-01", "2025-12-07"),
    )
    assert len(plan.steps) == 1
    assert "product_name" in plan.steps[0].sql
    assert "LIMIT 5" in plan.steps[0].sql


async def test_planner_greeting_skips_sql() -> None:
    llm = MagicMock()
    llm.complete = AsyncMock(return_value="should not be called")
    planner = Planner(llm=llm)
    plan = await planner.plan(
        question="hello",
        schema_context="sales_data",
        date_range=("2025-12-01", "2025-12-07"),
    )
    assert plan.steps == []
    assert plan.intent == "greeting"
    llm.complete.assert_not_called()


def test_fallback_channel_count_plan() -> None:
    planner = Planner(llm=MagicMock())
    plan = planner._fallback_analytics_plan("How many Swiggy orders in February 2026?")
    assert plan is not None
    assert "COUNT(DISTINCT" in plan.steps[0].sql
