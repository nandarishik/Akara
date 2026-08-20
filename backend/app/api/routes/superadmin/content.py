"""Superadmin CMS, media, and placement endpoints (GAP 3)."""

from __future__ import annotations

import uuid
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.errors import AkaraHTTPException
from app.core.rate_limit import ADMIN_READ_LIMIT, ADMIN_WRITE_LIMIT, limiter
from app.core.superadmin import SuperAdmin, SudoCtx, request_actor_meta, require_csrf
from app.core.tenant import get_supabase_service_client
from app.infra.content.cms_service import (
    create_media_asset,
    delete_media_asset,
    list_content_entries,
    list_media,
    list_placements,
    placement_stats,
    preview_content,
    publish_content,
    publish_placement,
    rollback_content,
    schedule_content,
    upsert_content_draft,
    upsert_placement,
)
from app.domain.superadmin.audit import record_operation
from app.domain.superadmin.mutations import SuperadminMutation, dry_run_response

router = APIRouter(tags=["superadmin-content"])

_ALLOWED_MEDIA = frozenset({"image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"})
_MAX_MEDIA_BYTES = 5 * 1024 * 1024


class ContentUpsertBody(BaseModel):
    value: dict[str, Any]
    locale: str = "en-IN"


class ContentScheduleBody(BaseModel):
    scheduled_at: str
    locale: str = "en-IN"


class PlacementUpsertBody(BaseModel):
    content: dict[str, Any]
    kind: str = Field(default="promotion", pattern="^(demo|promotion|partner|announcement)$")
    starts_at: str | None = None
    ends_at: str | None = None
    audience_rules: dict[str, Any] | None = None


class MediaCreateBody(BaseModel):
    storage_path: str
    public_url: str
    kind: str = Field(..., pattern="^(image|video|document|logo|og_image)$")
    alt_text: str = Field(..., min_length=1)
    width: int | None = None
    height: int | None = None
    bytes: int | None = None
    mime_type: str | None = None


@router.get("/content/entries")
@limiter.limit(ADMIN_READ_LIMIT)
def get_content_entries(request: Request, _admin: SuperAdmin) -> dict[str, Any]:
    return {"items": list_content_entries()}


@router.get("/content/entries/{key}/preview")
@limiter.limit(ADMIN_READ_LIMIT)
def preview_content_entry(
    request: Request,
    key: str,
    _admin: SuperAdmin,
    locale: str = "en-IN",
) -> dict[str, Any]:
    return preview_content(key, locale)


@router.put("/content/entries/{key}")
@limiter.limit(ADMIN_WRITE_LIMIT)
def put_content_entry(
    request: Request,
    key: str,
    body: ContentUpsertBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    result = upsert_content_draft(key, body.value, locale=body.locale, updated_by=admin.user_id)
    return {"ok": True, **result}


@router.post("/content/entries/{key}/schedule")
@limiter.limit(ADMIN_WRITE_LIMIT)
def schedule_content_entry(
    request: Request,
    key: str,
    body: ContentScheduleBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    result = schedule_content(key, body.scheduled_at, body.locale)
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.content.schedule",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason="Schedule content publish",
        after_state=result,
        resource_type="content_entry",
        resource_id=key,
        **meta,
    )
    return {"ok": True, **result, "audit": audit}


@router.post("/content/entries/{key}/publish")
@limiter.limit(ADMIN_WRITE_LIMIT)
def publish_content_entry(
    request: Request,
    key: str,
    body: SuperadminMutation,
    admin: SudoCtx,
    locale: str = "en-IN",
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    if body.dry_run:
        entry = preview_content(key, locale)
        return dry_run_response(
            action="superadmin.content.publish",
            impact={"key": key, "locale": locale, "preview": entry.get("value")},
            warnings=entry.get("warnings") or [],
        )
    result = publish_content(key, locale, force=True)
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.content.publish",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        after_state=result,
        operation_id=body.operation_id,
        resource_type="content_entry",
        resource_id=key,
        **meta,
    )
    return {"ok": True, **result, "audit": audit}


@router.post("/content/entries/{key}/rollback")
@limiter.limit(ADMIN_WRITE_LIMIT)
def rollback_content_entry(
    request: Request,
    key: str,
    admin: SudoCtx,
    locale: str = "en-IN",
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    result = rollback_content(key, locale)
    return {"ok": True, **result}


@router.get("/content/placements")
@limiter.limit(ADMIN_READ_LIMIT)
def get_placements(request: Request, _admin: SuperAdmin) -> dict[str, Any]:
    return {"items": list_placements()}


@router.get("/content/placements/stats")
@limiter.limit(ADMIN_READ_LIMIT)
def get_placement_stats(request: Request, _admin: SuperAdmin, days: int = 30) -> dict[str, Any]:
    return {"items": placement_stats(days=days)}


@router.put("/content/placements/{slot_key}")
@limiter.limit(ADMIN_WRITE_LIMIT)
def put_placement(
    request: Request,
    slot_key: str,
    body: PlacementUpsertBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    result = upsert_placement(
        slot_key,
        body.content,
        kind=body.kind,
        starts_at=body.starts_at,
        ends_at=body.ends_at,
        audience_rules=body.audience_rules,
    )
    return {"ok": True, **result}


@router.post("/content/placements/{slot_key}/publish")
@limiter.limit(ADMIN_WRITE_LIMIT)
def publish_placement_slot(
    request: Request,
    slot_key: str,
    body: SuperadminMutation,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    if body.dry_run:
        return dry_run_response(action="superadmin.content.publish_placement", impact={"key": slot_key})
    result = publish_placement(slot_key)
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.content.publish_placement",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        after_state=result,
        operation_id=body.operation_id,
        resource_type="placement_slot",
        resource_id=slot_key,
        **meta,
    )
    return {"ok": True, **result, "audit": audit}


@router.get("/content/media")
@limiter.limit(ADMIN_READ_LIMIT)
def get_media(request: Request, _admin: SuperAdmin) -> dict[str, Any]:
    return {"items": list_media()}


@router.post("/content/media")
@limiter.limit(ADMIN_WRITE_LIMIT)
def post_media(
    request: Request,
    body: MediaCreateBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    asset = create_media_asset(
        storage_path=body.storage_path,
        public_url=body.public_url,
        kind=body.kind,
        alt_text=body.alt_text,
        created_by=admin.user_id,
        width=body.width,
        height=body.height,
        bytes=body.bytes,
        mime_type=body.mime_type,
    )
    return {"ok": True, "asset": asset}


@router.post("/content/media/upload")
@limiter.limit(ADMIN_WRITE_LIMIT)
async def upload_media(
    request: Request,
    admin: SudoCtx,
    file: UploadFile = File(...),
    alt_text: Annotated[str, Form()] = "",
    kind: Annotated[str, Form()] = "image",
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    if not alt_text.strip():
        raise AkaraHTTPException(status_code=400, code="VALIDATION_ERROR", message="alt_text is required")
    content_type = file.content_type or ""
    if content_type not in _ALLOWED_MEDIA:
        raise AkaraHTTPException(status_code=415, code="UNSUPPORTED_MEDIA", message="Unsupported file type")
    data = await file.read()
    if len(data) > _MAX_MEDIA_BYTES:
        raise AkaraHTTPException(status_code=413, code="FILE_TOO_LARGE", message="File exceeds 5 MB limit")

    ext = (file.filename or "upload").rsplit(".", 1)[-1].lower()
    asset_id = str(uuid.uuid4())
    storage_path = f"media/{asset_id}.{ext}"
    supa = get_supabase_service_client()
    bucket = settings.supabase_imports_bucket
    supa.storage.from_(bucket).upload(
        storage_path,
        data,
        {"content-type": content_type, "x-upsert": "true"},
    )
    public_url = supa.storage.from_(bucket).get_public_url(storage_path)
    asset = create_media_asset(
        storage_path=storage_path,
        public_url=public_url,
        kind=kind if kind in ("image", "video", "document", "logo", "og_image") else "image",
        alt_text=alt_text.strip(),
        created_by=admin.user_id,
        bytes=len(data),
        mime_type=content_type,
    )
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.content.media_upload",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason="Media upload from Content & Media",
        after_state={"storage_path": storage_path},
        resource_type="media_asset",
        resource_id=str(asset.get("id", asset_id)),
        **meta,
    )
    return {"ok": True, "asset": asset, "audit": audit}


@router.delete("/content/media/{asset_id}")
@limiter.limit(ADMIN_WRITE_LIMIT)
def delete_media(
    request: Request,
    asset_id: UUID,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    result = delete_media_asset(str(asset_id))
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.content.media_delete",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason="Delete media asset from Content & Media",
        after_state=result,
        resource_type="media_asset",
        resource_id=str(asset_id),
        **meta,
    )
    return {"ok": True, **result, "audit": audit}
