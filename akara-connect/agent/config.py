"""Agent configuration — INI + env overrides (scaffold)."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass
class AgentConfig:
    api_base_url: str = "http://localhost:8000"
    agent_token: str = ""
    tally_host: str = "127.0.0.1"
    tally_port: int = 9000
    poll_seconds: int = 1800

    @classmethod
    def from_env(cls) -> AgentConfig:
        return cls(
            api_base_url=os.getenv("AKARA_API_BASE_URL", "http://localhost:8000"),
            agent_token=os.getenv("AKARA_AGENT_TOKEN", ""),
            tally_host=os.getenv("TALLY_HOST", "127.0.0.1"),
            tally_port=int(os.getenv("TALLY_PORT", "9000")),
            poll_seconds=int(os.getenv("AKARA_POLL_SECONDS", "1800")),
        )
