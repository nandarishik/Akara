"""HMAC vector tests for push_client (S8 agent-side)."""

from __future__ import annotations

import hashlib
import hmac

from agent.push_client import build_hmac_headers


def test_build_hmac_headers_frozen_formula():
    body = b'{"vouchers":[],"metadata":{}}'
    secret = "test-push-secret-32chars-minimum!!"
    key = "akc_live_testkey"
    ts = 1_725_000_000
    headers = build_hmac_headers(body, connector_key=key, push_secret=secret, timestamp=ts)
    assert headers["X-Connector-Key"] == key
    assert headers["X-Akara-Timestamp"] == str(ts)
    body_hash = hashlib.sha256(body).hexdigest()
    expected = hmac.new(
        secret.encode("utf-8"),
        f"{ts}.{body_hash}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    assert headers["X-Akara-Signature"] == expected
    assert "Authorization" not in headers


def test_signature_changes_with_body():
    secret = "s" * 32
    h1 = build_hmac_headers(b"a", connector_key="k", push_secret=secret, timestamp=100)
    h2 = build_hmac_headers(b"b", connector_key="k", push_secret=secret, timestamp=100)
    assert h1["X-Akara-Signature"] != h2["X-Akara-Signature"]
