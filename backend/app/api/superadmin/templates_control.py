"""Database-controlled transactional message templates."""

from __future__ import annotations

import hashlib
import re
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from app.api.superadmin.control_plane import TEMPLATE_KEYS, VARIABLES, resolve_published_content, validate_template_payload
from app.core.errors import AkaraHTTPException
from app.core.superadmin import SuperAdmin, SudoCtx, request_actor_meta, require_csrf
from app.core.tenant import get_supabase_service_client
from app.domain.superadmin.audit import record_operation
from app.domain.superadmin.mutations import SuperadminMutation

router = APIRouter(prefix="/templates", tags=["superadmin-templates"])
_PLACEHOLDER = re.compile(r"\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}")


class TemplateBody(SuperadminMutation):
    channel: str = Field(..., pattern="^(email|whatsapp|in_app)$")
    locale: str = Field("en-IN", min_length=2, max_length=20)
    payload: dict[str, Any]
    allowed_variables: list[str] = Field(default_factory=list)
    required_variables: list[str] = Field(default_factory=list)
    fallback_channel: str | None = Field(default=None, pattern="^(email|whatsapp|in_app)$")
    quiet_hours: dict[str, Any] = Field(default_factory=dict)
    unsubscribe_category: str | None = None
    provider_approval_status: str = "not_required"


class RenderBody(BaseModel):
    sample_data: dict[str, Any] = Field(default_factory=dict)
    version: int | None = None


class TestSendBody(SuperadminMutation):
    recipient: str = Field(..., min_length=3, max_length=320)
    sample_data: dict[str, Any] = Field(default_factory=dict)


class RetryBody(SuperadminMutation):
    delivery_id: UUID


class TemplateVersionAction(SuperadminMutation):
    version: int | None = None


def _template_key(key: str) -> dict[str, Any]:
    return TEMPLATE_KEYS.get(key) or {"channel": None}


def _validate(key: str, body: TemplateBody) -> None:
    definition = _template_key(key)
    if definition.get("channel") and definition["channel"] != body.channel:
        raise AkaraHTTPException(status_code=400, code="VALIDATION_ERROR", message="Channel does not match template registry")
    allowed = set(VARIABLES.get(key, set()))
    declared = set(body.allowed_variables or VARIABLES.get(key, set()))
    if not set(body.required_variables).issubset(declared):
        raise AkaraHTTPException(status_code=400, code="VALIDATION_ERROR", message="Required variables must be allowed")
    errors: list[str] = []
    for value in body.payload.values(): errors.extend(validate_template_payload(key, value))
    found = {item for value in body.payload.values() for item in _PLACEHOLDER.findall(str(value))}
    unknown = found - allowed
    if unknown: errors.append(f"Unknown placeholders: {', '.join(sorted(unknown))}")
    missing = set(body.required_variables) - found
    if missing: errors.append(f"Missing required variables: {', '.join(sorted(missing))}")
    if errors: raise AkaraHTTPException(status_code=400, code="TEMPLATE_INVALID", message="; ".join(dict.fromkeys(errors)))
    if body.channel == "whatsapp" and _template_key(key).get("provider_approval_required") and body.provider_approval_status != "approved":
        raise AkaraHTTPException(status_code=400, code="PROVIDER_APPROVAL_REQUIRED", message="WhatsApp templates require provider approval before publish")


def _render(payload: dict[str, Any], sample: dict[str, Any]) -> dict[str, Any]:
    def one(value: Any) -> Any:
        if not isinstance(value, str): return value
        return _PLACEHOLDER.sub(lambda match: str(sample.get(match.group(1), "")), value)
    return {key: one(value) for key, value in payload.items()}


@router.get("")
def list_templates(_admin: SuperAdmin, channel: str | None = Query(None, pattern="^(email|whatsapp|in_app)$"), locale: str | None = None) -> dict[str, Any]:
    query = get_supabase_service_client().table("message_templates").select("*").order("key")
    if channel: query = query.eq("channel", channel)
    if locale: query = query.eq("locale", locale)
    result = query.execute()
    items = result.data or []
    known = {row.get("key") for row in items}
    for key, definition in TEMPLATE_KEYS.items():
        if key not in known and (not channel or definition["channel"] == channel) and (not locale or locale == definition["locale"]):
            items.append({"key": key, **definition, "status": "fallback", "allowed_variables": sorted(VARIABLES.get(key, set())), "required_variables": sorted(VARIABLES.get(key, set()))})
    return {"items": items, "total": len(items), "variables": {key: sorted(value) for key, value in VARIABLES.items()}}


@router.get("/{key}")
def get_template(key: str, _admin: SuperAdmin) -> dict[str, Any]:
    if key not in TEMPLATE_KEYS: raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Template not found")
    result = get_supabase_service_client().table("message_templates").select("*").eq("key", key).maybe_single().execute()
    if result.data: return result.data
    return {"key": key, **TEMPLATE_KEYS[key], "status": "fallback", "allowed_variables": sorted(VARIABLES.get(key, set())), "required_variables": sorted(VARIABLES.get(key, set()))}


@router.put("/{key}")
@router.patch("/{key}")
def update_template(key: str, body: TemplateBody, request: Request, sudo: SudoCtx, _: None = Depends(require_csrf)) -> dict[str, Any]:
    if key not in TEMPLATE_KEYS: raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Template not found")
    _validate(key, body)
    row = {"key": key, "channel": body.channel, "locale": body.locale, "draft": body.payload, "allowed_variables": body.allowed_variables or sorted(VARIABLES.get(key, set())), "required_variables": body.required_variables or sorted(VARIABLES.get(key, set())), "fallback_channel": body.fallback_channel, "quiet_hours": body.quiet_hours, "unsubscribe_category": body.unsubscribe_category, "provider_approval_status": body.provider_approval_status, "updated_by": str(sudo.user_id)}
    result = get_supabase_service_client().table("message_templates").upsert(row).execute()
    current_version = int(((result.data or [row])[0]).get("version", 1))
    try:
        get_supabase_service_client().table("message_template_versions").insert({"key": key, "channel": body.channel, "locale": body.locale, "version": current_version, "payload": body.payload, "created_by": str(sudo.user_id)}).execute()
    except Exception:
        # A duplicate immutable version must never make a valid draft disappear.
        pass
    audit = record_operation(action="template.draft.update", actor_id=sudo.user_id, actor_email=sudo.email, reason=body.reason, resource_type="message_template", resource_id=key, details={"channel": body.channel, "locale": body.locale}, **request_actor_meta(request))
    return {"item": (result.data or [row])[0], "audit": audit}


@router.post("/{key}/preview")
def preview_template(key: str, body: RenderBody, _admin: SuperAdmin) -> dict[str, Any]:
    item = get_template(key, _admin)
    payload = item.get("draft") or item.get("published") or {}
    return {"key": key, "channel": item.get("channel"), "rendered": _render(payload, body.sample_data), "used_fallback": item.get("status") == "fallback"}


@router.get("/{key}/versions")
def template_versions(key: str, _admin: SuperAdmin) -> dict[str, Any]:
    if key not in TEMPLATE_KEYS: raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Template not found")
    result = get_supabase_service_client().table("message_template_versions").select("id,key,channel,locale,version,created_by,created_at").eq("key", key).order("version", desc=True).execute()
    return {"items": result.data or [], "total": len(result.data or [])}


@router.get("/{key}/diff")
def template_diff(key: str, _admin: SuperAdmin, from_version: int = Query(..., ge=1), to_version: int = Query(..., ge=1)) -> dict[str, Any]:
    if key not in TEMPLATE_KEYS: raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Template not found")
    result = get_supabase_service_client().table("message_template_versions").select("version,payload").eq("key", key).in_("version", [from_version, to_version]).execute()
    versions = {int(row["version"]): row.get("payload") for row in (result.data or [])}
    return {"key": key, "from_version": from_version, "to_version": to_version, "from": versions.get(from_version), "to": versions.get(to_version)}


@router.post("/{key}/publish")
def publish_template(key: str, body: SuperadminMutation, request: Request, sudo: SudoCtx, _: None = Depends(require_csrf)) -> dict[str, Any]:
    item = get_template(key, sudo)
    if item.get("status") == "fallback": raise AkaraHTTPException(status_code=400, code="DRAFT_REQUIRED", message="Create a database draft before publishing")
    payload = TemplateBody(channel=item["channel"], locale=item.get("locale", "en-IN"), payload=item.get("draft") or {}, allowed_variables=item.get("allowed_variables", []), required_variables=item.get("required_variables", []), provider_approval_status=item.get("provider_approval_status", "not_required"), reason=body.reason)
    _validate(key, payload)
    result = get_supabase_service_client().table("message_templates").update({"published": item.get("draft"), "published_at": "now()", "published_by": str(sudo.user_id), "status": "published"}).eq("key", key).execute()
    audit = record_operation(action="template.publish", actor_id=sudo.user_id, actor_email=sudo.email, reason=body.reason, resource_type="message_template", resource_id=key, details={"version": item.get("version")}, **request_actor_meta(request))
    return {"ok": True, "item": (result.data or [item])[0], "audit": audit}


@router.post("/{key}/rollback")
def rollback_template(key: str, body: TemplateVersionAction, request: Request, sudo: SudoCtx, _: None = Depends(require_csrf)) -> dict[str, Any]:
    target_version = body.version if body.version is not None else body.operation_id
    result = get_supabase_service_client().table("message_template_versions").select("payload, version").eq("key", key).eq("version", str(target_version)).maybe_single().execute() if target_version else None
    if not result or not result.data: raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Template version not found")
    updated = get_supabase_service_client().table("message_templates").update({"draft": result.data["payload"], "published": result.data["payload"], "version": result.data["version"], "published_by": str(sudo.user_id)}).eq("key", key).execute()
    audit = record_operation(action="template.rollback", actor_id=sudo.user_id, actor_email=sudo.email, reason=body.reason, resource_type="message_template", resource_id=key, details={"version": target_version}, **request_actor_meta(request))
    return {"ok": True, "item": (updated.data or [result.data])[0], "audit": audit}


@router.post("/{key}/test-send")
def template_test_send(key: str, body: TestSendBody, request: Request, sudo: SudoCtx, _: None = Depends(require_csrf)) -> dict[str, Any]:
    item = get_template(key, sudo)
    if item.get("status") == "fallback": raise AkaraHTTPException(status_code=400, code="DRAFT_REQUIRED", message="Create a database draft before sending")
    if not (body.recipient.endswith("@akara.test") or body.recipient.startswith("+1555") or body.recipient.startswith("test:")):
        raise AkaraHTTPException(status_code=400, code="SANDBOX_RECIPIENT_REQUIRED", message="Test sends are restricted to approved sandbox recipients")
    payload = _render(item.get("draft") or {}, body.sample_data)
    event = {"id": str(uuid4()), "template_key": key, "template_version": item.get("version", 1), "recipient_hash": hashlib.sha256(body.recipient.encode()).hexdigest(), "provider": item.get("channel"), "status": "accepted", "is_test": True, "provider_response_id": f"sandbox-{uuid4().hex[:12]}", "retry_count": 0}
    get_supabase_service_client().table("delivery_events").insert(event).execute()
    audit = record_operation(action="template.test_send", actor_id=sudo.user_id, actor_email=sudo.email, reason=body.reason, resource_type="message_template", resource_id=key, details={"recipient_hash": event["recipient_hash"], "is_test": True}, **request_actor_meta(request))
    return {"ok": True, "rendered": payload, "delivery": event, "audit": audit}


@router.post("/{key}/suppress")
def suppress_template(key: str, body: SuperadminMutation, request: Request, sudo: SudoCtx, _: None = Depends(require_csrf)) -> dict[str, Any]:
    if key not in TEMPLATE_KEYS: raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Template not found")
    result = get_supabase_service_client().table("message_templates").update({"status": "suppressed", "updated_by": str(sudo.user_id)}).eq("key", key).execute()
    audit = record_operation(action="template.suppress", actor_id=sudo.user_id, actor_email=sudo.email, reason=body.reason, resource_type="message_template", resource_id=key, details={"suppressed": True}, **request_actor_meta(request))
    return {"ok": True, "suppressed": True, "item": (result.data or [{"key": key, "status": "suppressed"}])[0], "audit": audit}


@router.post("/{key}/enable")
def enable_template(key: str, body: SuperadminMutation, request: Request, sudo: SudoCtx, _: None = Depends(require_csrf)) -> dict[str, Any]:
    if key not in TEMPLATE_KEYS: raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Template not found")
    result = get_supabase_service_client().table("message_templates").update({"status": "draft", "updated_by": str(sudo.user_id)}).eq("key", key).execute()
    audit = record_operation(action="template.enable", actor_id=sudo.user_id, actor_email=sudo.email, reason=body.reason, resource_type="message_template", resource_id=key, details={"suppressed": False}, **request_actor_meta(request))
    return {"ok": True, "suppressed": False, "item": (result.data or [{"key": key, "status": "draft"}])[0], "audit": audit}


@router.post("/delivery/{delivery_id}/retry")
def retry_delivery(delivery_id: UUID, body: RetryBody, request: Request, sudo: SudoCtx, _: None = Depends(require_csrf)) -> dict[str, Any]:
    result = get_supabase_service_client().table("delivery_events").update({"status": "retrying", "retry_count": 1}).eq("id", str(delivery_id)).execute()
    audit = record_operation(action="template.delivery.retry", actor_id=sudo.user_id, actor_email=sudo.email, reason=body.reason, resource_type="delivery_event", resource_id=str(delivery_id), **request_actor_meta(request))
    return {"ok": True, "delivery": (result.data or [{"id": str(delivery_id), "status": "retrying"}])[0], "audit": audit}


def resolve_template(key: str, fallback: dict[str, Any]) -> tuple[dict[str, Any], bool]:
    """Customer delivery adapter: DB published template first, checked-in fallback second."""
    canonical = {"weekly_debrief_brief": "W1", "morning_brief_summary": "W2", "alert_triggered": "W3", "plan_upgrade_confirmation": "W4"}.get(key, key)
    value, used_fallback = resolve_published_content("message_templates", canonical, fallback)
    if not isinstance(value, dict): return fallback, True
    return value, used_fallback
