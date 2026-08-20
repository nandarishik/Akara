"""Entry point for Akara Connect tray agent (scaffold)."""

from __future__ import annotations

from agent.config import AgentConfig
from agent.scheduler import run_forever


def main() -> None:
    config = AgentConfig.from_env()
    print("Akara Connect scaffold — starting poll loop (stubs only)")
    run_forever(config)


if __name__ == "__main__":
    main()
