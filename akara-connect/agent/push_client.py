"""HMAC push client for POST /api/v1/connectors/tally/push."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx

from agent.config import AgentConfig


def build_hmac_headers(
    body: bytes,
    *,
    connector_key: str,
    push_secret: str,
    timestamp: int | None = None,
) -> dict[str, str]:
    """
    Signature = hex(HMAC-SHA256(CONNECTOR_TALLY_PUSH_SECRET, "{timestamp}." + hex(SHA256(raw_body)))).
    Headers: X-Connector-Key, X-Akara-Timestamp, X-Akara-Signature. No Bearer JWT.
    """
    ts = int(time.time()) if timestamp is None else int(timestamp)
    body_hash = hashlib.sha256(body).hexdigest()
    message = f"{ts}.{body_hash}".encode("utf-8")
    signature = hmac.new(push_secret.encode("utf-8"), message, hashlib.sha256).hexdigest()
    return {
        "X-Connector-Key": connector_key,
        "X-Akara-Timestamp": str(ts),
        "X-Akara-Signature": signature,
        "Content-Type": "application/json",
    }


class PushClient:
    def __init__(self, config: AgentConfig, queue_path: Path | None = None) -> None:
        self._config = config
        self._queue_path = queue_path or Path(
            os.getenv("AKARA_OFFLINE_QUEUE", str(Path.home() / ".akara-connect" / "queue.jsonl"))
        )
        self._queue_path.parent.mkdir(parents=True, exist_ok=True)

    def _assert_outbound_host(self, url: str) -> None:
        host = urlparse(url).hostname or ""
        allowed = urlparse(self._config.api_base_url).hostname or ""
        if not host or host != allowed:
            raise RuntimeError(f"Outbound host not allowed: {host}")

    def push_vouchers(
        self,
        vouchers: list[dict[str, Any]],
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        payload = {"vouchers": vouchers, "metadata": metadata or {}}
        body = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
        url = f"{self._config.api_base_url.rstrip('/')}/api/v1/connectors/tally/push"
        self._assert_outbound_host(url)
        headers = build_hmac_headers(
            body,
            connector_key=self._config.connector_api_key,
            push_secret=self._config.tally_push_secret,
        )
        try:
            with httpx.Client(timeout=60.0) as client:
                res = client.post(url, content=body, headers=headers)
            if res.status_code >= 400:
                self._enqueue(body)
                res.raise_for_status()
            return res.json()
        except Exception:
            self._enqueue(body)
            raise

    def _enqueue(self, body: bytes) -> None:
        with self._queue_path.open("a", encoding="utf-8") as fh:
            fh.write(body.decode("utf-8") + "\n")

    def flush_queue(self) -> int:
        if not self._queue_path.exists():
            return 0
        lines = self._queue_path.read_text(encoding="utf-8").splitlines()
        if not lines:
            return 0
        remaining: list[str] = []
        sent = 0
        for line in lines:
            if not line.strip():
                continue
            body = line.encode("utf-8")
            url = f"{self._config.api_base_url.rstrip('/')}/api/v1/connectors/tally/push"
            try:
                self._assert_outbound_host(url)
                headers = build_hmac_headers(
                    body,
                    connector_key=self._config.connector_api_key,
                    push_secret=self._config.tally_push_secret,
                )
                with httpx.Client(timeout=60.0) as client:
                    res = client.post(url, content=body, headers=headers)
                if res.status_code >= 400:
                    remaining.append(line)
                else:
                    sent += 1
            except Exception:
                remaining.append(line)
        self._queue_path.write_text("\n".join(remaining) + ("\n" if remaining else ""), encoding="utf-8")
        return sent
