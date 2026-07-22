import logging
from collections.abc import AsyncGenerator
from enum import StrEnum

from app.services.llm.gemini import GeminiClient
from app.services.llm.openrouter import OpenRouterClient

logger = logging.getLogger(__name__)


class LLMProvider(StrEnum):
    GEMINI = "gemini"
    OPENROUTER = "openrouter"


class LLMManager:
    """
    Manages LLM provider selection and automatic failover.
    Primary: Gemini 2.5 Flash (skipped when key empty/unavailable)
    Failover: OpenRouter (claude-3-haiku)
    """

    def __init__(self, gemini_api_key: str, openrouter_api_key: str) -> None:
        self._gemini = (
            GeminiClient(api_key=gemini_api_key) if gemini_api_key.strip() else None
        )
        self._openrouter = OpenRouterClient(api_key=openrouter_api_key)
        self._current_provider = LLMProvider.OPENROUTER
        self._gemini_disabled = self._gemini is None

    async def complete(self, prompt: str, system: str = "") -> str:
        """Non-streaming completion with automatic failover."""
        if self._gemini and not self._gemini_disabled:
            try:
                response = await self._gemini.complete(prompt=prompt, system=system)
                self._current_provider = LLMProvider.GEMINI
                return response
            except Exception as gemini_error:
                logger.warning("Gemini failed, falling back to OpenRouter: %s", gemini_error)
                self._gemini_disabled = True

        try:
            response = await self._openrouter.complete(prompt=prompt, system=system)
            self._current_provider = LLMProvider.OPENROUTER
            return response
        except Exception as openrouter_error:
            logger.error("OpenRouter failed: %s", openrouter_error)
            raise RuntimeError(
                f"All LLM providers unavailable. OpenRouter: {openrouter_error}"
            ) from openrouter_error

    async def stream(
        self, prompt: str, system: str = ""
    ) -> AsyncGenerator[str, None]:
        """Streaming completion with automatic failover."""
        if self._gemini and not self._gemini_disabled:
            try:
                async for chunk in self._gemini.stream(prompt=prompt, system=system):
                    yield chunk
                return
            except Exception as gemini_error:
                logger.warning("Gemini stream failed, falling back: %s", gemini_error)
                self._gemini_disabled = True

        async for chunk in self._openrouter.stream(prompt=prompt, system=system):
            yield chunk

    @property
    def current_provider(self) -> LLMProvider:
        return self._current_provider
