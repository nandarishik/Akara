"""OpenRouter LLM client — the sole LLM provider for AKARA Phase 2.

Model is configured via OPENROUTER_MODEL in settings (date-pinned).
Default: openai/gpt-4o-mini-2024-07-18
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


class OpenRouterClient:
    def __init__(self, api_key: str, model: str | None = None) -> None:
        self._api_key = api_key
        # Model is injected from settings so it is always date-pinned
        # and never an alias that can silently change behaviour.
        self._model = model or settings.openrouter_model
        self._headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            # OpenRouter best-practice: identify the application
            "HTTP-Referer": "https://akara.ai",
            "X-Title": "AKARA Analytics",
        }

    def _build_payload(self, prompt: str, system: str, stream: bool) -> dict:
        messages: list[dict] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        return {
            "model": self._model,
            "messages": messages,
            "stream": stream,
        }

    async def complete(self, prompt: str, system: str = "") -> str:
        payload = self._build_payload(prompt, system, stream=False)
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{OPENROUTER_BASE_URL}/chat/completions",
                json=payload,
                headers=self._headers,
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]

    async def stream(
        self, prompt: str, system: str = ""
    ) -> AsyncGenerator[str, None]:
        payload = self._build_payload(prompt, system, stream=True)
        async with httpx.AsyncClient(timeout=120.0) as client, client.stream(
            "POST",
            f"{OPENROUTER_BASE_URL}/chat/completions",
            json=payload,
            headers=self._headers,
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line.startswith("data: ") and line != "data: [DONE]":
                    try:
                        data = json.loads(line[6:])
                        delta = data["choices"][0]["delta"].get("content", "")
                        if delta:
                            yield delta
                    except (json.JSONDecodeError, KeyError):
                        continue

    @property
    def model(self) -> str:
        return self._model
