import json
import logging
import re
from dataclasses import dataclass

from app.services.llm.manager import LLMManager

logger = logging.getLogger(__name__)

_PLAN_SYSTEM = """
You are a data analytics planning assistant for a sales analytics platform.
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
  "requires_context": [],
  "response_format": "table"
}

Rules:
- Always filter by tenant_id = :tenant_id (parameterized, never hardcoded)
- Always filter by invoice_date using :start_date and :end_date when a time range applies
- Only use table: public.sales_data
- Maximum 3 SQL steps
- Use :start_date and :end_date placeholders for date ranges
- For top products: GROUP BY product_name, ORDER BY SUM(total_amount) DESC, LIMIT 5
- For greetings or chitchat with no data question, return "steps": []
"""

_ANALYTICS_KEYWORDS = (
    "top",
    "best",
    "selling",
    "product",
    "revenue",
    "sales",
    "order",
    "party",
    "customer",
    "store",
    "location",
    "zone",
    "region",
    "city",
    "total",
    "amount",
    "how many",
    "count",
    "show",
    "list",
    "compare",
    "trend",
    "last month",
    "last week",
    "yesterday",
    "this month",
    "breakdown",
    "performance",
)

_GREETING_PATTERN = re.compile(
    r"^\s*(hi|hello|hey|thanks|thank you|good morning|good afternoon|"
    r"good evening|how are you|who are you|what can you do)\s*[!.?]*\s*$",
    re.IGNORECASE,
)


def is_conversational(question: str) -> bool:
    """True only for greetings/chitchat — not for analytics questions."""
    q = question.strip()
    if _GREETING_PATTERN.match(q):
        return True
    lower = q.lower()
    if any(keyword in lower for keyword in _ANALYTICS_KEYWORDS):
        return False
    return len(q.split()) <= 3


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
        if is_conversational(question):
            return self._greeting_plan()

        prompt = (
            f"Schema context:\n{schema_context}\n\n"
            f"Date range available: {date_range[0]} to {date_range[1]}\n\n"
            f"User question: {question}\n\n"
            f"Output the JSON plan:"
        )
        system = _PLAN_SYSTEM + system_addendum
        raw = await self._llm.complete(prompt=prompt, system=system)
        return self._parse_plan(raw, question, date_range)

    def _parse_plan(
        self, raw: str, question: str, date_range: tuple[str, str]
    ) -> Plan:
        json_str = _extract_json_str(raw)
        if not json_str:
            logger.warning("No JSON object in planner output, using analytics fallback")
            return self._resolve_fallback(question, date_range, "general inquiry")

        json_str = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", " ", json_str)
        try:
            data = json.loads(json_str)
        except json.JSONDecodeError:
            logger.warning("Invalid planner JSON, using analytics fallback. Raw: %s", raw[:200])
            return self._resolve_fallback(question, date_range, "general inquiry")

        steps = [
            PlanStep(
                step_id=s["step_id"],
                description=s["description"],
                sql=s["sql"],
            )
            for s in data.get("steps", [])
        ]
        if not steps:
            return self._resolve_fallback(
                question, date_range, data.get("intent", "general inquiry")
            )

        return Plan(
            intent=data.get("intent", ""),
            steps=steps,
            requires_context=data.get("requires_context", []),
            response_format=data.get("response_format", "summary"),
        )

    def _resolve_fallback(
        self, question: str, date_range: tuple[str, str], intent: str
    ) -> Plan:
        if is_conversational(question):
            return self._greeting_plan()
        analytics = self._fallback_analytics_plan(question, date_range)
        if analytics:
            return analytics
        return Plan(intent=intent, steps=[], requires_context=[], response_format="summary")

    def _greeting_plan(self) -> Plan:
        return Plan(
            intent="greeting",
            steps=[],
            requires_context=[],
            response_format="summary",
        )

    def _fallback_analytics_plan(
        self, question: str, date_range: tuple[str, str]
    ) -> Plan | None:
        """Deterministic SQL when the LLM plan cannot be parsed."""
        q = question.lower()

        if any(w in q for w in ("top", "best", "selling", "product")):
            limit = 5
            m = re.search(r"top\s+(\d+)", q)
            if m:
                limit = min(int(m.group(1)), 20)
            return Plan(
                intent="top products by revenue",
                steps=[
                    PlanStep(
                        step_id=1,
                        description=f"Top {limit} products by revenue",
                        sql=(
                            "SELECT product_name, "
                            "SUM(total_amount) AS revenue, "
                            "SUM(quantity) AS quantity "
                            "FROM public.sales_data "
                            "WHERE tenant_id = :tenant_id "
                            "AND invoice_date BETWEEN :start_date AND :end_date "
                            "AND product_name IS NOT NULL AND product_name != '' "
                            "GROUP BY product_name "
                            "ORDER BY revenue DESC "
                            f"LIMIT {limit}"
                        ),
                    )
                ],
                requires_context=[],
                response_format="table",
            )

        if any(w in q for w in ("revenue", "sales", "total")):
            return Plan(
                intent="total revenue",
                steps=[
                    PlanStep(
                        step_id=1,
                        description="Total revenue in date range",
                        sql=(
                            "SELECT SUM(total_amount) AS total_revenue, "
                            "COUNT(DISTINCT invoice_number) AS order_count, "
                            "COUNT(DISTINCT party_name) AS unique_parties "
                            "FROM public.sales_data "
                            "WHERE tenant_id = :tenant_id "
                            "AND invoice_date BETWEEN :start_date AND :end_date"
                        ),
                    )
                ],
                requires_context=[],
                response_format="summary",
            )

        if any(w in q for w in ("zone", "region", "city", "location", "store")):
            return Plan(
                intent="sales by location",
                steps=[
                    PlanStep(
                        step_id=1,
                        description="Revenue by party/location",
                        sql=(
                            "SELECT party_name, party_city, "
                            "SUM(total_amount) AS revenue, "
                            "SUM(quantity) AS quantity "
                            "FROM public.sales_data "
                            "WHERE tenant_id = :tenant_id "
                            "AND invoice_date BETWEEN :start_date AND :end_date "
                            "GROUP BY party_name, party_city "
                            "ORDER BY revenue DESC "
                            "LIMIT 10"
                        ),
                    )
                ],
                requires_context=[],
                response_format="table",
            )

        return None


def _extract_json_str(raw: str) -> str | None:
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
    if fenced:
        return fenced.group(1)
    json_match = re.search(r"\{.*\}", raw, re.DOTALL)
    return json_match.group() if json_match else None
