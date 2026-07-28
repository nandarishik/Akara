"""Superadmin audit logging with operation IDs and idempotency."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID, uuid4

from app.core.tenant import get_supabase_service_client

logger = logging.getLogger(__name__)


def record_operation(
    *,
    action: str,
    actor_id: UUID,
    actor_email: str | None,
    reason: str,
    tenant_id: UUID | None = None,
    before_state: dict[str, Any] | None = None,
    after_state: dict[str, Any] | None = None,
    operation_id: UUID | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    details: dict[str, Any] | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> dict[str, Any]:
    """Append an immutable audit_log row. Returns idempotent replay metadata."""
    supa = get_supabase_service_client()
    op_id = operation_id or uuid4()

    if operation_id:
        existing = (
            supa.table("audit_log")
            .select("id, action, created_at")
            .eq("operation_id", str(operation_id))
            .maybe_single()
            .execute()
        )
        if existing.data:
            return {
                "idempotent_replay": True,
                "operation_id": str(op_id),
                "audit_id": existing.data["id"],
                "action": existing.data.get("action"),
                "created_at": existing.data.get("created_at"),
            }

    payload: dict[str, Any] = {
        "action": action,
        "operation_id": str(op_id),
        "reason": reason,
        "actor_id": str(actor_id),
        "actor_email": actor_email,
        "before_state": before_state or {},
        "after_state": after_state or {},
        "details": details or {},
        "user_agent": user_agent,
    }
    if tenant_id:
        payload["tenant_id"] = str(tenant_id)
        payload["user_id"] = str(actor_id)
    if resource_type:
        payload["resource_type"] = resource_type
    if resource_id:
        payload["resource_id"] = resource_id
    if ip_address:
        payload["ip_address"] = ip_address

    try:
        result = supa.table("audit_log").insert(payload).execute()
        audit_id = result.data[0]["id"] if result.data else None
    except Exception as exc:
        logger.warning("Failed to write audit_log for %s: %s", action, exc)
        audit_id = None

    return {
        "idempotent_replay": False,
        "operation_id": str(op_id),
        "audit_id": audit_id,
        "action": action,
    }
