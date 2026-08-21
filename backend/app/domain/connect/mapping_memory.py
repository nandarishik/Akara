"""Persist confirmed CSV header mappings per tenant."""

from __future__ import annotations

import hashlib
import logging
from uuid import UUID

from supabase import Client

logger = logging.getLogger(__name__)


def fingerprint_headers(headers: list[str]) -> str:
    """Stable SHA-256 of sorted, normalised header names."""
    normalised = sorted(
        str(name).strip().lower()
        for name in headers
        if name is not None and str(name).strip()
    )
    blob = "\x1f".join(normalised)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


class MappingMemory:
    def __init__(self, supabase: Client) -> None:
        self._supabase = supabase

    def lookup(self, tenant_id: UUID, fingerprint_hash: str) -> dict[str, str] | None:
        try:
            result = (
                self._supabase.table("mapping_memory")
                .select("column_mapping")
                .eq("tenant_id", str(tenant_id))
                .eq("fingerprint_hash", fingerprint_hash)
                .limit(1)
                .execute()
            )
        except Exception as exc:
            logger.warning("mapping_memory lookup failed: %s", exc)
            return None
        rows = result.data or []
        if not rows:
            return None
        mapping = rows[0].get("column_mapping") or {}
        if not isinstance(mapping, dict):
            return None
        return {str(k): str(v) for k, v in mapping.items()}

    def save(
        self,
        tenant_id: UUID,
        fingerprint_hash: str,
        column_mapping: dict[str, str],
        source_hint: str = "",
        profile_id: str | None = None,
    ) -> None:
        try:
            self._supabase.rpc(
                "upsert_mapping_memory",
                {
                    "p_tenant_id": str(tenant_id),
                    "p_fingerprint": fingerprint_hash,
                    "p_column_mapping": column_mapping,
                    "p_source_hint": source_hint,
                    "p_profile_id": profile_id,
                },
            ).execute()
        except Exception as exc:
            logger.warning("mapping_memory save failed: %s", exc)
