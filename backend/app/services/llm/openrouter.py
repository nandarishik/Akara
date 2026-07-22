import json
import logging
from collections.abc import AsyncGenerator

import httpx

logger = logging.getLogger(__name__)

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_MODEL = "anthropic/claude-3-haiku"


class OpenRouterClient:
    def __init__(self, api_key: str) -> None:
        self._api_key = api_key
        self._headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    def _build_payload(self, prompt: str, system: str, stream: bool) -> dict:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        return {
            "model": OPENROUTER_MODEL,
            "messages": messages,
            "stream": stream,
        }

    async def complete(self, prompt: str, system: str = "") -> str:
        payload = self._build_payload(prompt, system, stream=False)
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{OPENROUTER_BASE_URL}/chat/completions",
                json=payload,
                headers=self._headers,
                timeout=60.0,
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]

    async def stream(
        self, prompt: str, system: str = ""
    ) -> AsyncGenerator[str, None]:
        payload = self._build_payload(prompt, system, stream=True)
        async with httpx.AsyncClient() as client, client.stream(
            "POST",
            f"{OPENROUTER_BASE_URL}/chat/completions",
            json=payload,
            headers=self._headers,
            timeout=60.0,
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line.startswith("data: ") and line != "data: [DONE]":
                    data = json.loads(line[6:])
                    delta = data["choices"][0]["delta"].get("content", "")
                    if delta:
                        yield delta
