"""Billing ledger service."""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

from app.core.tenant import get_supabase_service_client

logger = logging.getLogger(__name__)


def list_ledger(
    *,
    tenant_id: UUID | None = None,
    entry_type: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> dict[str, Any]:
    supa = get_supabase_service_client()
    query = supa.table("billing_ledger_entries").select("*", count="exact").order("created_at", desc=True)
    if tenant_id:
        query = query.eq("tenant_id", str(tenant_id))
    if entry_type:
        query = query.eq("entry_type", entry_type)
    result = query.range(offset, offset + limit - 1).execute()
    return {"items": result.data or [], "total": result.count or 0}


def record_ledger_entry(
    *,
    tenant_id: UUID | None,
    entry_type: str,
    amount_minor: int,
    status: str = "pending",
    provider_ref: str | None = None,
    invoice_id: UUID | None = None,
    idempotency_key: str | None = None,
    evidence_path: str | None = None,
    metadata: dict[str, Any] | None = None,
    created_by: UUID | None = None,
) -> dict[str, Any]:
    supa = get_supabase_service_client()
    if idempotency_key:
        existing = (
            supa.table("billing_ledger_entries")
            .select("*")
            .eq("idempotency_key", idempotency_key)
            .maybe_single()
            .execute()
        )
        if existing.data:
            return existing.data

    payload = {
        "tenant_id": str(tenant_id) if tenant_id else None,
        "entry_type": entry_type,
        "amount_minor": amount_minor,
        "status": status,
        "provider_ref": provider_ref,
        "invoice_id": str(invoice_id) if invoice_id else None,
        "idempotency_key": idempotency_key,
        "evidence_path": evidence_path,
        "metadata": metadata or {},
        "created_by": str(created_by) if created_by else None,
    }
    result = supa.table("billing_ledger_entries").insert(payload).execute()
    return (result.data or [{}])[0]


def check_idempotency_replay(idempotency_key: str) -> dict[str, Any] | None:
    supa = get_supabase_service_client()
    try:
        stored = (
            supa.table("idempotency_keys")
            .select("response_body")
            .eq("key", idempotency_key)
            .maybe_single()
            .execute()
        )
        if stored.data and stored.data.get("response_body"):
            body = stored.data["response_body"]
            if isinstance(body, str):
                return json.loads(body)
            return body
    except Exception as exc:
        logger.debug("idempotency replay lookup: %s", exc)
    return None


def store_idempotency_response(idempotency_key: str, response: dict[str, Any]) -> None:
    supa = get_supabase_service_client()
    try:
        supa.table("idempotency_keys").upsert(
            {"key": idempotency_key, "response_body": json.dumps(response)},
            on_conflict="key",
        ).execute()
    except Exception as exc:
        logger.warning("idempotency store failed: %s", exc)


def preview_refund(*, payment_id: str, amount_paise: int | None, partial: bool) -> dict[str, Any]:
    gst_rate = 0.18
    amount = amount_paise or 0
    gst_component = int(amount * gst_rate / (1 + gst_rate)) if amount else 0
    return {
        "payment_id": payment_id,
        "amount_paise": amount,
        "partial": partial,
        "gst_credit_note_required": amount > 0,
        "estimated_gst_component_paise": gst_component,
        "ledger_entry_type": "refund",
        "provider": "razorpay",
        "warnings": [] if amount else ["Full refund amount will be determined by provider"],
    }
