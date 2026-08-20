"""Poll loop scaffold — not implemented."""

from __future__ import annotations

import time

from agent.config import AgentConfig
from agent.sync_client import SyncClient
from agent.tally_reader import fetch_vouchers


def run_forever(config: AgentConfig) -> None:
    client = SyncClient(config)
    while True:
        try:
            rows = fetch_vouchers(config.tally_host, config.tally_port)
            client.push_rows(rows)
        except NotImplementedError:
            # Scaffold: sleep until real implementation lands
            pass
        time.sleep(config.poll_seconds)
