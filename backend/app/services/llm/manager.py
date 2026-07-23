"""LLM manager — Phase 2: OpenRouter only.

Gemini has been removed. All LLM calls route through OpenRouter using
the date-pinned model from settings (OPENROUTER_MODEL env var).
"""

from __future__ import annotations

import logging
from collections.abc import AsyncGenerator

from app.services.llm.openrouter import OpenRouterClient

logger = logging.getLogger(__name__)


class LLMManager:
    """Thin wrapper around OpenRouterClient.

    Retains the same interface (complete / stream) as the Phase 1 manager
    so existing callers do not need to change.
    """

    def __init__(self, openrouter_api_key: str) -> None:
        self._client = OpenRouterClient(api_key=openrouter_api_key)

    async def complete(self, prompt: str, system: str = "") -> str:
        return await self._client.complete(prompt=prompt, system=system)

    async def stream(
        self, prompt: str, system: str = ""
    ) -> AsyncGenerator[str, None]:
        async for chunk in self._client.stream(prompt=prompt, system=system):
            yield chunk

    @property
    def model(self) -> str:
        return self._client.model

    @property
    def provider(self) -> str:
        return "openrouter"
