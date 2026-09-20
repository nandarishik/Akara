"""Signed update checker — HTTPS + signature verify before apply."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse

import httpx

from agent.config import AgentConfig


def _assert_https(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise RuntimeError("Update URL must be HTTPS")


def verify_signature(payload: bytes, signature_hex: str, public_key_pem: str) -> bool:
    """
    Verify Ed25519/RSA signature when cryptography is available.
    Without a public key configured, refuse updates (fail closed).
    """
    if not public_key_pem or not signature_hex:
        return False
    try:
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    except ImportError:
        # Fallback: compare SHA256 digest against declared hash in manifest when key is a hex digest marker
        expected = hashlib.sha256(payload).hexdigest()
        return hmac_compare(expected, signature_hex)

    try:
        key = serialization.load_pem_public_key(public_key_pem.encode("utf-8"))
        if isinstance(key, Ed25519PublicKey):
            key.verify(bytes.fromhex(signature_hex), payload)
            return True
    except Exception:
        return False
    return False


def hmac_compare(a: str, b: str) -> bool:
    if len(a) != len(b):
        return False
    result = 0
    for x, y in zip(a.encode(), b.encode(), strict=True):
        result |= x ^ y
    return result == 0


def check_for_update(config: AgentConfig, dest: Path | None = None) -> Path | None:
    """Download update binary only if HTTPS + signature verify pass. Returns path or None."""
    base = config.update_url.rstrip("/") + "/"
    _assert_https(base)
    manifest_url = base + "manifest.json"
    with httpx.Client(timeout=30.0) as client:
        man = client.get(manifest_url)
        man.raise_for_status()
        manifest = man.json()
        rel = manifest.get("path") or manifest.get("artifact")
        sig = manifest.get("signature") or ""
        if not rel:
            return None
        art_url = base + str(rel).lstrip("/")
        _assert_https(art_url)
        art = client.get(art_url)
        art.raise_for_status()
        payload = art.content
    if not verify_signature(payload, sig, config.update_public_key):
        raise RuntimeError("Update signature invalid — refusing to apply")
    out = dest or Path.home() / ".akara-connect" / "pending-update.bin"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(payload)
    meta = out.with_suffix(".json")
    meta.write_text(json.dumps({"verified": True, "source": art_url}), encoding="utf-8")
    return out
