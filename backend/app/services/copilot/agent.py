import logging
import time
from collections.abc import AsyncGenerator
from dataclasses import dataclass, field
from datetime import date
from uuid import UUID

from app.services.copilot.guardrails.checks import GuardrailResult, run_all_guardrails
from app.services.copilot.planner import Planner
from app.services.copilot.synthesizer import Synthesizer
from app.services.copilot.tools.context_tool import ContextTool
from app.services.copilot.tools.sql_tool import SQLTool

logger = logging.getLogger(__name__)


@dataclass
class CopilotResponse:
    question: str
    intent: str
    response: str
    sql_queries_run: list[str] = field(default_factory=list)
    llm_model: str = ""
    tokens_used: int = 0
    guardrail_results: list[dict] = field(default_factory=list)
    response_time_ms: int = 0


class CopilotAgent:
    """
    Orchestrates the Plan → Execute → Synthesize pipeline.
    Dependency-injected — no global state.
    """

    def __init__(
        self,
        planner: Planner,
        synthesizer: Synthesizer,
        sql_tool: SQLTool,
        context_tool: ContextTool,
        tenant_id: UUID,
    ) -> None:
        self._planner = planner
        self._synthesizer = synthesizer
        self._sql_tool = sql_tool
        self._context_tool = context_tool
        self._tenant_id = tenant_id

    async def answer(
        self,
        question: str,
        schema_context: str,
        available_columns: list[str],
        date_range: tuple[str, str],
    ) -> CopilotResponse:
        start_ms = int(time.time() * 1000)

        plan = await self._planner.plan(question, schema_context, date_range)
        logger.info(
            "Plan produced with %d steps for intent: %s", len(plan.steps), plan.intent
        )

        all_results: list[dict] = []
        queries_run: list[str] = []
        for step in plan.steps:
            result = self._sql_tool.run(step.sql)
            all_results.extend(result.get("rows", []))
            queries_run.append(step.sql)

        context_data = None
        today = date.today()
        for ctx_type in plan.requires_context:
            context_data = self._context_tool.get_context(today, ctx_type)
            if context_data:
                break

        response_text = await self._synthesizer.synthesize(
            question=question,
            sql_results=all_results,
            context_data=context_data,
            intent=plan.intent,
        )

        guardrail_results: list[GuardrailResult] = run_all_guardrails(
            question=question,
            response=response_text,
            sql_results=all_results,
            available_columns=available_columns,
            tenant_date_range=date_range,
        )

        for gr in guardrail_results:
            if not gr.passed:
                logger.warning(
                    "Guardrail failed: %s — %s", gr.check_name, gr.message
                )
                response_text += f"\n\n⚠️ Note: {gr.message}"

        elapsed_ms = int(time.time() * 1000) - start_ms

        return CopilotResponse(
            question=question,
            intent=plan.intent,
            response=response_text,
            sql_queries_run=queries_run,
            guardrail_results=[
                {"check": gr.check_name, "passed": gr.passed, "message": gr.message}
                for gr in guardrail_results
            ],
            response_time_ms=elapsed_ms,
        )

    async def answer_stream(
        self,
        question: str,
        schema_context: str,
        available_columns: list[str],
        date_range: tuple[str, str],
    ) -> AsyncGenerator[str, None]:
        """Streaming version — yields text chunks as they arrive."""
        plan = await self._planner.plan(question, schema_context, date_range)

        all_results: list[dict] = []
        for step in plan.steps:
            result = self._sql_tool.run(step.sql)
            all_results.extend(result.get("rows", []))

        context_data = None
        for ctx_type in plan.requires_context:
            context_data = self._context_tool.get_context(date.today(), ctx_type)

        async for chunk in self._synthesizer.synthesize_stream(
            question=question,
            sql_results=all_results,
            context_data=context_data,
            intent=plan.intent,
        ):
            yield chunk
