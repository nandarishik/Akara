"""Idempotency replay for billing mutations."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app.core.tenant import get_supabase_service_client


def get_cached_response(
    key: str,
    tenant_id: UUID,
    endpoint: str,
) -> tuple[int, dict[str, Any]] | None:
    supa = get_supabase_service_client()
    result = (
        supa.table("idempotency_keys")
        .select("response_status, response_body")
        .eq("key", key)
        .eq("tenant_id", str(tenant_id))
        .eq("endpoint", endpoint)
        .maybe_single()
        .execute()
    )
    if result and result.data:
        return result.data["response_status"], result.data["response_body"]
    return None


def store_response(
    key: str,
    tenant_id: UUID,
    endpoint: str,
    status: int,
    body: dict[str, Any],
) -> None:
    supa = get_supabase_service_client()
    supa.table("idempotency_keys").insert({
        "key": key,
        "tenant_id": str(tenant_id),
        "endpoint": endpoint,
        "response_status": status,
        "response_body": body,
    }).execute()
