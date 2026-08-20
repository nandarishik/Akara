"""HTTPS sync client scaffold — not implemented."""

from __future__ import annotations

from agent.config import AgentConfig


class SyncClient:
    def __init__(self, config: AgentConfig) -> None:
        self._config = config

    def push_rows(self, _rows: list[dict]) -> None:
        raise NotImplementedError("Cloud sync push not implemented yet")
