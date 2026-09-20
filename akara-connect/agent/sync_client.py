"""HTTPS sync client — delegates to PushClient HMAC push."""

from __future__ import annotations

from typing import Any

from agent.config import AgentConfig
from agent.push_client import PushClient


class SyncClient:
    def __init__(self, config: AgentConfig) -> None:
        self._config = config
        self._push = PushClient(config)

    def push_rows(self, rows: list[dict[str, Any]], metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        if not rows:
            return {"status": "noop", "job_id": None}
        return self._push.push_vouchers(rows, metadata)

    def flush_offline(self) -> int:
        return self._push.flush_queue()
