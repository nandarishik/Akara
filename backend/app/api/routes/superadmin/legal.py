"""Superadmin legal and changelog endpoints (GAP 4)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.core.rate_limit import ADMIN_READ_LIMIT, ADMIN_WRITE_LIMIT, limiter
from app.core.superadmin import SuperAdmin, SudoCtx, request_actor_meta, require_csrf
from app.services.legal.document_service import (
    consent_acceptance_rate,
    list_documents,
    publish_document,
)
from app.services.superadmin.audit import record_operation
from app.services.superadmin.mutations import SuperadminMutation, dry_run_response

router = APIRouter(tags=["superadmin-legal"])


class PublishDocumentBody(SuperadminMutation):
    document_key: str = Field(..., pattern="^(terms|privacy|changelog|dpdp)$")
    version: str = Field(..., min_length=1, max_length=32)
    title: str
    body_markdown: str = Field(..., min_length=10)
    effective_at: datetime
    requires_reacceptance: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)


@router.get("/legal/documents")
@limiter.limit(ADMIN_READ_LIMIT)
def get_documents(
    request: Request,
    _admin: SuperAdmin,
    document_key: str | None = None,
) -> dict:
    return {"items": list_documents(document_key)}


@router.get("/legal/documents/{document_key}/acceptance-rate")
@limiter.limit(ADMIN_READ_LIMIT)
def get_acceptance_rate(
    request: Request,
    document_key: str,
    version: str,
    _admin: SuperAdmin,
) -> dict:
    return consent_acceptance_rate(document_key, version)


@router.post("/legal/documents/publish")
@limiter.limit(ADMIN_WRITE_LIMIT)
def publish_legal_document(
    request: Request,
    body: PublishDocumentBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict:
    if body.dry_run:
        return dry_run_response(
            action="superadmin.legal.publish",
            impact={
                "document_key": body.document_key,
                "version": body.version,
                "requires_reacceptance": body.requires_reacceptance,
                "effective_at": body.effective_at.isoformat(),
            },
        )
    doc = publish_document(
        document_key=body.document_key,
        version=body.version,
        title=body.title,
        body_markdown=body.body_markdown,
        effective_at=body.effective_at,
        requires_reacceptance=body.requires_reacceptance,
        published_by=admin.user_id,
        metadata=body.metadata,
    )
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.legal.publish",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        after_state={"document_key": body.document_key, "version": body.version},
        operation_id=body.operation_id,
        resource_type="document_version",
        resource_id=f"{body.document_key}:{body.version}",
        **meta,
    )
    return {"ok": True, "document": doc, "audit": audit}
