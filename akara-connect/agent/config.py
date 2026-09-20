"""Agent configuration — env overrides."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass
class AgentConfig:
    api_base_url: str = "http://localhost:8000"
    connector_api_key: str = ""
    tally_push_secret: str = ""
    tally_host: str = "127.0.0.1"
    tally_port: int = 9000
    poll_seconds: int = 1800
    update_url: str = "https://connect.akara.app/updates/"
    update_public_key: str = ""
    last_sync_ok_at: float | None = None
    last_error: str | None = None

    @classmethod
    def from_env(cls) -> AgentConfig:
        host = os.getenv("TALLY_HOST", "127.0.0.1")
        if host not in ("127.0.0.1", "localhost"):
            host = "127.0.0.1"
        return cls(
            api_base_url=os.getenv("AKARA_API_BASE_URL", "http://localhost:8000"),
            connector_api_key=os.getenv("AKARA_CONNECTOR_API_KEY", os.getenv("AKARA_AGENT_TOKEN", "")),
            tally_push_secret=os.getenv("CONNECTOR_TALLY_PUSH_SECRET", ""),
            tally_host=host,
            tally_port=int(os.getenv("TALLY_PORT", "9000")),
            poll_seconds=int(os.getenv("AKARA_POLL_SECONDS", "1800")),
            update_url=os.getenv("AKARA_CONNECT_UPDATE_URL", "https://connect.akara.app/updates/"),
            update_public_key=os.getenv("AKARA_CONNECT_UPDATE_SIGNING_KEY", ""),
        )
