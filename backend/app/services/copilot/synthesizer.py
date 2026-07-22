import logging
from collections.abc import AsyncGenerator

from app.services.llm.manager import LLMManager

logger = logging.getLogger(__name__)

_SYNTHESIZE_SYSTEM = """
You are AKARA Copilot, an AI analytics assistant.
You are given a user question, SQL query results, and optionally some business context.
Your job is to write a clear, accurate, business-focused answer.

Rules:
- Write the answer directly to the user. Never describe, explain, or comment on your response.
- Never use phrases like "here is a response" or "I have greeted the user".
- Ground every number in the data provided. Do not invent figures.
- Be concise but complete. Use bullet points for lists.
- Mention the time range covered by the data.
- If data is empty or insufficient, say so clearly.
- Do not make causal claims. Use "associated with" or "correlated with" instead of "caused by".
- End with a one-sentence actionable insight if the data supports it.
- Respond in English by default. Follow any language rules provided in the system addendum.
"""

_CONVERSATIONAL_SYSTEM = """
You are AKARA Copilot, an AI assistant for sales and distribution analytics.
The user sent a greeting or general message — not a data question.

Rules:
- Reply naturally and briefly (1-3 sentences).
- Introduce yourself as AKARA Copilot and offer to help with sales data
  (revenue, orders, products, zones, trends).
- Write only the message the user should read — no meta-commentary.
- Do not mention SQL, queries, planners, or internal processes.
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
        system_addendum: str = "",
    ) -> str:
        prompt = self._build_prompt(question, sql_results, context_data, intent)
        system = _SYNTHESIZE_SYSTEM + system_addendum
        return await self._llm.complete(prompt=prompt, system=system)

    async def synthesize_stream(
        self,
        question: str,
        sql_results: list[dict],
        context_data: dict | None,
        intent: str,
        system_addendum: str = "",
    ) -> AsyncGenerator[str, None]:
        prompt = self._build_prompt(question, sql_results, context_data, intent)
        system = _SYNTHESIZE_SYSTEM + system_addendum
        async for chunk in self._llm.stream(prompt=prompt, system=system):
            yield chunk

    async def conversational(
        self,
        question: str,
        system_addendum: str = "",
    ) -> str:
        system = _CONVERSATIONAL_SYSTEM + system_addendum
        return await self._llm.complete(prompt=question, system=system)

    async def conversational_stream(
        self,
        question: str,
        system_addendum: str = "",
    ) -> AsyncGenerator[str, None]:
        system = _CONVERSATIONAL_SYSTEM + system_addendum
        async for chunk in self._llm.stream(prompt=question, system=system):
            yield chunk
