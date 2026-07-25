import json
import logging
import re
from dataclasses import dataclass

from app.services.copilot.channel_queries import (
    match_channel_count_plan,
    match_channel_revenue_plan,
    match_repeat_customer_plan,
    product_group_filter_sql,
)
from app.services.copilot.date_range import parse_result_limit
from app.services.copilot.fallback_queries import (
    sales_by_location_sql,
    top_products_sql,
    total_revenue_sql,
)
from app.services.copilot.pii_redactor import redact
from app.services.llm.manager import LLMManager
from app.services.schema.columns import (
    COMPANION_DATA_TABLE,
    DEFAULT_RESULT_LIMIT,
    MAX_RESULT_LIMIT,
    SALES_DATA_TABLE,
)

logger = logging.getLogger(__name__)

_PLAN_SYSTEM = f"""
You are a data analytics planning assistant for a sales analytics platform.
Given a user question, you must output a JSON plan with SQL queries to answer it.

Output ONLY valid JSON in this exact format:
{{
  "intent": "brief description of what the user wants",
  "steps": [
    {{
      "step_id": 1,
      "description": "what this step computes",
      "sql": "SELECT ... FROM {SALES_DATA_TABLE} WHERE tenant_id = :tenant_id AND ..."
    }}
  ],
  "requires_context": [],
  "response_format": "table"
}}

Rules:
- Always filter by tenant_id = :tenant_id (parameterized, never hardcoded UUIDs)
- Always filter by invoice_date using :start_date and :end_date from the provided date range
- Only use tables listed in schema context: {SALES_DATA_TABLE} and optionally {COMPANION_DATA_TABLE}
- Maximum 3 SQL steps
- Parse LIMIT from the user's question when they say "top N"; otherwise omit LIMIT or use a reasonable default
- For greetings or chitchat with no data question, return "steps": []
- sales_data is LINE-ITEM level (one row per product/service line). For orders/bills/jobs/visits use COUNT(DISTINCT invoice_number), NOT COUNT(*)
- Filter order channels (dine-in, swiggy, zomato, OTC, insurance, etc.) on route — NOT product_category unless categories are populated
- For repeat customers/patients: GROUP BY party_name, count DISTINCT invoice_number (or DISTINCT invoice_date for visit frequency)
- Average discount %: SUM(discount_amount) / NULLIF(SUM(gross_amount), 0) * 100
- Only reference columns listed in schema context; extra POS fields may be in raw_data JSONB (e.g. raw_data->>'cashier')
- Do NOT invent columns (e.g. final_bill, order_type) — use mapped columns from schema context
- Cross-file metrics: query {COMPANION_DATA_TABLE} filtered by dataset_type and record_date
- Invoice mismatch detection: GROUP BY invoice_number, compare SUM(total_amount) consistently (line-level exports)
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
            f"Schema context:\n{redact(schema_context)}\n\n"
            f"Query date range (use :start_date and :end_date): "
            f"{date_range[0]} to {date_range[1]}\n\n"
            f"User question: {redact(question)}\n\n"
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
        analytics = self._fallback_analytics_plan(question)
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

    def _fallback_analytics_plan(self, question: str) -> Plan | None:
        """Deterministic SQL templates when the LLM plan cannot be parsed."""
        q = question.lower()
        limit = parse_result_limit(question, DEFAULT_RESULT_LIMIT, MAX_RESULT_LIMIT)

        channel_sql = match_channel_count_plan(question)
        if channel_sql:
            return Plan(
                intent="channel order count",
                steps=[PlanStep(step_id=1, description="Count distinct orders by channel", sql=channel_sql)],
                requires_context=[],
                response_format="summary",
            )

        revenue_sql = match_channel_revenue_plan(question)
        if revenue_sql:
            return Plan(
                intent="channel revenue",
                steps=[PlanStep(step_id=1, description="Channel revenue", sql=revenue_sql)],
                requires_context=[],
                response_format="summary",
            )

        repeat_sql = match_repeat_customer_plan(question)
        if repeat_sql:
            return Plan(
                intent="repeat customers",
                steps=[PlanStep(step_id=1, description="Repeat customer count", sql=repeat_sql)],
                requires_context=[],
                response_format="summary",
            )

        if "spare part" in q or ("parts" in q and "top" in q):
            return Plan(
                intent="top spare parts",
                steps=[
                    PlanStep(
                        step_id=1,
                        description="Top spare parts by revenue",
                        sql=product_group_filter_sql("part", limit),
                    )
                ],
                requires_context=[],
                response_format="table",
            )

        if any(w in q for w in ("top", "best", "selling", "product")):
            return Plan(
                intent="top products by revenue",
                steps=[
                    PlanStep(
                        step_id=1,
                        description=f"Top {limit} products by revenue",
                        sql=top_products_sql(limit),
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
                        sql=total_revenue_sql(),
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
                        description=f"Top {limit} parties/locations by revenue",
                        sql=sales_by_location_sql(limit),
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
