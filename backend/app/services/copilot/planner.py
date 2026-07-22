import json
import logging
import re
from dataclasses import dataclass

from app.services.llm.manager import LLMManager

logger = logging.getLogger(__name__)

_PLAN_SYSTEM = """
You are a data analytics planning assistant for an FMCG distribution company.
Given a user question, you must output a JSON plan with SQL queries to answer it.

Output ONLY valid JSON in this exact format:
{
  "intent": "brief description of what the user wants",
  "steps": [
    {
      "step_id": 1,
      "description": "what this step computes",
      "sql": "SELECT ... FROM public.sales_data WHERE tenant_id = :tenant_id AND ..."
    }
  ],
  "requires_context": ["weather" | "news" | "holiday"],
  "response_format": "table" | "summary" | "chart_data"
}

Rules:
- Always filter by tenant_id = :tenant_id (parameterized, never hardcoded)
- Always filter by invoice_date when a time range is implied
- Only use tables: public.sales_data, public.context_cache
- Maximum 3 SQL steps
- Use :start_date and :end_date placeholders for date ranges
"""


@dataclass
class PlanStep:
    step_id: int
    description: str
    sql: str


@dataclass
class Plan:
    intent: str
    steps: list[PlanStep]
    requires_context: list[str]
    response_format: str


class Planner:
    """
    Given a user question + schema context, produces a structured execution plan.
    """

    def __init__(self, llm: LLMManager) -> None:
        self._llm = llm

    async def plan(
        self,
        question: str,
        schema_context: str,
        date_range: tuple[str, str],
    ) -> Plan:
        prompt = (
            f"Schema context:\n{schema_context}\n\n"
            f"Date range available: {date_range[0]} to {date_range[1]}\n\n"
            f"User question: {question}\n\n"
            f"Output the JSON plan:"
        )
        raw = await self._llm.complete(prompt=prompt, system=_PLAN_SYSTEM)
        return self._parse_plan(raw)

    def _parse_plan(self, raw: str) -> Plan:
        json_match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not json_match:
            raise ValueError(f"LLM did not return valid JSON plan. Raw: {raw[:200]}")
        data = json.loads(json_match.group())
        return Plan(
            intent=data.get("intent", ""),
            steps=[
                PlanStep(
                    step_id=s["step_id"],
                    description=s["description"],
                    sql=s["sql"],
                )
                for s in data.get("steps", [])
            ],
            requires_context=data.get("requires_context", []),
            response_format=data.get("response_format", "summary"),
        )
