import logging
from collections.abc import AsyncGenerator

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.5-flash"


class GeminiClient:
    def __init__(self, api_key: str) -> None:
        self._client = genai.Client(api_key=api_key)

    async def complete(self, prompt: str, system: str = "") -> str:
        config = types.GenerateContentConfig(system_instruction=system) if system else None
        response = await self._client.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=config,
        )
        return response.text or ""

    async def stream(
        self, prompt: str, system: str = ""
    ) -> AsyncGenerator[str, None]:
        config = types.GenerateContentConfig(system_instruction=system) if system else None
        async for chunk in await self._client.aio.models.generate_content_stream(
            model=GEMINI_MODEL,
            contents=prompt,
            config=config,
        ):
            if chunk.text:
                yield chunk.text
