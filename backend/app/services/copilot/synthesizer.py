import logging
from collections.abc import AsyncGenerator

from app.services.llm.manager import LLMManager

logger = logging.getLogger(__name__)

_SYNTHESIZE_SYSTEM = """
You are AKARA Copilot, an AI analytics assistant for FMCG distribution businesses.
You are given a user question, SQL query results, and optionally some business context.
Your job is to write a clear, accurate, business-focused answer.

Rules:
- Ground every number in the data provided. Do not invent figures.
- Be concise but complete. Use bullet points for lists.
- Mention the time range covered by the data.
- If data is empty or insufficient, say so clearly.
- Do not make causal claims. Use "associated with" or "correlated with" instead of "caused by".
- End with a one-sentence actionable insight if the data supports it.
"""


class Synthesizer:
    """
    Takes SQL results and context, generates a natural language response.
    Supports both full response and streaming.
    """

    def __init__(self, llm: LLMManager) -> None:
        self._llm = llm

    def _build_prompt(
        self,
        question: str,
        sql_results: list[dict],
        context_data: dict | None,
        intent: str,
    ) -> str:
        results_str = str(sql_results[:100])  # cap at 100 rows for prompt
        context_str = str(context_data) if context_data else "No additional context."
        return (
            f"User question: {question}\n\n"
            f"Intent: {intent}\n\n"
            f"SQL Results:\n{results_str}\n\n"
            f"Business Context:\n{context_str}\n\n"
            f"Write a business-focused answer:"
        )

    async def synthesize(
        self,
        question: str,
        sql_results: list[dict],
        context_data: dict | None,
        intent: str,
    ) -> str:
        prompt = self._build_prompt(question, sql_results, context_data, intent)
        return await self._llm.complete(prompt=prompt, system=_SYNTHESIZE_SYSTEM)

    async def synthesize_stream(
        self,
        question: str,
        sql_results: list[dict],
        context_data: dict | None,
        intent: str,
    ) -> AsyncGenerator[str, None]:
        prompt = self._build_prompt(question, sql_results, context_data, intent)
        async for chunk in self._llm.stream(prompt=prompt, system=_SYNTHESIZE_SYSTEM):
            yield chunk
