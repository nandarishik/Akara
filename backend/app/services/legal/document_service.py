"""Legal documents, consent, and changelog services."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from app.core.errors import AkaraHTTPException
from app.core.tenant import get_supabase_service_client

logger = logging.getLogger(__name__)


def list_documents(document_key: str | None = None) -> list[dict[str, Any]]:
    supa = get_supabase_service_client()
    query = supa.table("document_versions").select("*").order("effective_at", desc=True)
    if document_key:
        query = query.eq("document_key", document_key)
    result = query.execute()
    return result.data or []


def get_published_document(document_key: str) -> dict[str, Any] | None:
    supa = get_supabase_service_client()
    now = datetime.now(UTC).isoformat()
    try:
        result = (
            supa.table("document_versions")
            .select("*")
            .eq("document_key", document_key)
            .eq("is_published", True)
            .lte("effective_at", now)
            .order("effective_at", desc=True)
            .limit(1)
            .execute()
        )
        if result.data and isinstance(result.data, list) and result.data:
            return result.data[0]
    except Exception as exc:
        logger.warning("document_versions lookup failed: %s", exc)
    return None


def publish_document(
    *,
    document_key: str,
    version: str,
    title: str,
    body_markdown: str,
    effective_at: datetime,
    requires_reacceptance: bool,
    published_by: UUID | None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    supa = get_supabase_service_client()
    existing = (
        supa.table("document_versions")
        .select("id")
        .eq("document_key", document_key)
        .eq("version", version)
        .maybe_single()
        .execute()
    )
    if existing.data:
        raise AkaraHTTPException(
            status_code=409,
            code="CONFLICT",
            message="Document version already exists and is immutable",
        )

    payload = {
        "document_key": document_key,
        "version": version,
        "title": title,
        "body_markdown": body_markdown,
        "effective_at": effective_at.isoformat(),
        "requires_reacceptance": requires_reacceptance,
        "published_by": str(published_by) if published_by else None,
        "is_published": True,
        "published_at": datetime.now(UTC).isoformat(),
        "metadata": metadata or {},
    }
    result = supa.table("document_versions").insert(payload).execute()
    return (result.data or [{}])[0]


def consent_acceptance_rate(document_key: str, version: str) -> dict[str, Any]:
    supa = get_supabase_service_client()
    try:
        total_users = supa.table("profiles").select("id", count="exact").execute()
        accepted = (
            supa.table("user_consents")
            .select("user_id", count="exact")
            .eq("document_key", document_key)
            .eq("version", version)
            .execute()
        )
        total = int(total_users.count or 0)
        acc = int(accepted.count or 0)
        rate = (acc / total * 100) if total else 0.0
        return {"document_key": document_key, "version": version, "accepted": acc, "total_users": total, "rate_pct": round(rate, 1)}
    except Exception as exc:
        logger.warning("acceptance rate query failed: %s", exc)
        return {"document_key": document_key, "version": version, "accepted": 0, "total_users": 0, "rate_pct": 0.0}


def record_user_consent(
    *,
    user_id: UUID,
    document_key: str,
    version: str,
    ip_hash: str | None = None,
    user_agent: str | None = None,
) -> None:
    supa = get_supabase_service_client()
    supa.table("user_consents").upsert(
        {
            "user_id": str(user_id),
            "document_key": document_key,
            "version": version,
            "ip_hash": ip_hash,
            "user_agent": user_agent,
        },
        on_conflict="user_id,document_key,version",
    ).execute()


def user_consent_status(user_id: UUID) -> dict[str, Any]:
    """Return whether user must re-accept terms/privacy/changelog."""
    terms = get_published_document("terms")
    privacy = get_published_document("privacy")
    supa = get_supabase_service_client()

    def _accepted(key: str, ver: str | None) -> bool:
        if not ver:
            return True
        row = (
            supa.table("user_consents")
            .select("user_id")
            .eq("user_id", str(user_id))
            .eq("document_key", key)
            .eq("version", ver)
            .maybe_single()
            .execute()
        )
        return bool(row.data and isinstance(row.data, dict))

    terms_ver = terms.get("version") if terms else "1.0"
    privacy_ver = privacy.get("version") if privacy else "1.0"
    reaccept = False
    if terms and terms.get("requires_reacceptance") and not _accepted("terms", terms_ver):
        reaccept = True
    if privacy and privacy.get("requires_reacceptance") and not _accepted("privacy", privacy_ver):
        reaccept = True

    return {
        "terms_version": terms_ver,
        "privacy_version": privacy_ver,
        "reaccept_required": reaccept,
        "terms_requires_reacceptance": bool(terms and terms.get("requires_reacceptance")),
        "privacy_requires_reacceptance": bool(privacy and privacy.get("requires_reacceptance")),
    }
