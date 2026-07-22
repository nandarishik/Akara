import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.copilot.planner import Plan, Planner


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
