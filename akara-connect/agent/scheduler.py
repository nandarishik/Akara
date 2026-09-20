"""Poll loop — fetch Tally vouchers and HMAC-push to Akara."""

from __future__ import annotations

import time
from typing import Callable

from agent.config import AgentConfig
from agent.sync_client import SyncClient
from agent.tally_reader import fetch_vouchers


def run_once(config: AgentConfig, client: SyncClient | None = None) -> str:
    sync = client or SyncClient(config)
    try:
        sync.flush_offline()
        rows = fetch_vouchers(config.tally_host, config.tally_port)
        sync.push_rows(rows)
        config.last_sync_ok_at = time.time()
        config.last_error = None
        return "ok"
    except Exception as exc:  # noqa: BLE001 — tray surfaces last_error
        config.last_error = str(exc)
        return "error"


def run_forever(
    config: AgentConfig,
    *,
    sleep_fn: Callable[[float], None] = time.sleep,
    stop_after: int | None = None,
) -> None:
    client = SyncClient(config)
    runs = 0
    while True:
        run_once(config, client)
        runs += 1
        if stop_after is not None and runs >= stop_after:
            break
        sleep_fn(config.poll_seconds)
