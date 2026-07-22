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
        system_addendum: str = "",
    ) -> Plan:
        prompt = (
            f"Schema context:\n{schema_context}\n\n"
            f"Date range available: {date_range[0]} to {date_range[1]}\n\n"
            f"User question: {question}\n\n"
            f"Output the JSON plan:"
        )
        system = _PLAN_SYSTEM + system_addendum
        raw = await self._llm.complete(prompt=prompt, system=system)
        return self._parse_plan(raw)

    def _parse_plan(self, raw: str) -> Plan:
        json_match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not json_match:
            logger.warning("No JSON object in planner output, using fallback")
            return self._fallback_plan("general inquiry")

        json_str = json_match.group()
        # LLM SQL strings often contain raw newlines — strip control chars that break json.loads.
        json_str = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", " ", json_str)
        try:
            data = json.loads(json_str)
        except json.JSONDecodeError:
            logger.warning("Invalid planner JSON, using fallback. Raw: %s", raw[:200])
            return self._fallback_plan("general inquiry")

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

    def _fallback_plan(self, intent: str) -> Plan:
        """Used when the planner LLM returns unparseable JSON (e.g. greetings)."""
        return Plan(
            intent=intent,
            steps=[],
            requires_context=[],
            response_format="summary",
        )
