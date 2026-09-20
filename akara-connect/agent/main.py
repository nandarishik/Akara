"""Akara Connect — Windows tray agent (TallyBridge + HMAC push)."""

from __future__ import annotations

import threading
import time
from typing import Any

from agent.config import AgentConfig
from agent.scheduler import run_forever, run_once
from agent.sync_client import SyncClient

try:
    import pystray
    from PIL import Image, ImageDraw
except ImportError:  # pragma: no cover — tray optional in CI
    pystray = None  # type: ignore
    Image = None  # type: ignore
    ImageDraw = None  # type: ignore


def _tray_color(config: AgentConfig) -> tuple[int, int, int]:
    """green = ok <6h; yellow = delayed; red = error."""
    if config.last_error:
        return (220, 38, 38)
    if config.last_sync_ok_at and (time.time() - config.last_sync_ok_at) < 6 * 3600:
        return (22, 163, 74)
    return (234, 179, 8)


def _make_icon(rgb: tuple[int, int, int]) -> Any:
    assert Image is not None and ImageDraw is not None
    img = Image.new("RGB", (64, 64), rgb)
    draw = ImageDraw.Draw(img)
    draw.ellipse((8, 8, 56, 56), fill=rgb)
    return img


def run_tray(config: AgentConfig) -> None:
    if pystray is None:
        print("pystray not installed — running headless poll loop")
        run_forever(config)
        return

    stop = threading.Event()
    client = SyncClient(config)

    def worker() -> None:
        while not stop.is_set():
            run_once(config, client)
            stop.wait(config.poll_seconds)

    def on_sync(icon: Any, _item: Any) -> None:
        run_once(config, client)
        icon.icon = _make_icon(_tray_color(config))

    def on_status(_icon: Any, _item: Any) -> None:
        status = "error" if config.last_error else "ok"
        when = config.last_sync_ok_at
        print(f"Akara Connect status={status} last_ok={when} err={config.last_error}")

    def on_quit(icon: Any, _item: Any) -> None:
        stop.set()
        icon.stop()

    menu = pystray.Menu(
        pystray.MenuItem("Sync Now", on_sync),
        pystray.MenuItem("View Sync Status", on_status),
        pystray.MenuItem("Settings", lambda *_: print("Edit AKARA_* env / config")),
        pystray.MenuItem("Quit", on_quit),
    )
    icon = pystray.Icon("akara-connect", _make_icon(_tray_color(config)), "Akara Connect", menu)
    threading.Thread(target=worker, daemon=True).start()
    icon.run()


def main() -> None:
    config = AgentConfig.from_env()
    print("Akara Connect — TallyBridge tray agent starting")
    run_tray(config)


if __name__ == "__main__":
    main()
