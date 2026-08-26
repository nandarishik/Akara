"""Day 11 server-side registries and safe content resolution helpers.

The browser may select an item from these registries, but it can never extend
them. This module is deliberately dependency-light so unit tests can exercise
the authorization and masking rules without a live database.
"""

from __future__ import annotations

import hashlib
import re
from typing import Any

from app.core.tenant import get_supabase_service_client

DATA_STUDIO_POLICY: dict[str, dict[str, Any]] = {
    "tenants": {
        "description": "Tenant accounts and billing status",
        "columns": ["id", "name", "slug", "plan", "plan_status", "is_active", "config", "internal_notes", "created_at", "updated_at"],
        "masked_columns": [],
        "filterable": ["id", "slug", "plan", "plan_status", "is_active"],
        "sortable": ["created_at", "updated_at", "name", "plan"],
        "editable": {"name": "string", "internal_notes": "string", "is_active": "boolean"},
        "actions": ["soft_delete", "restore"],
    },
    "profiles": {
        "description": "Workspace memberships and roles",
        "columns": ["id", "tenant_id", "display_name", "role", "is_suspended", "created_at", "updated_at"],
        "masked_columns": ["id"],
        "filterable": ["id", "tenant_id", "role", "is_suspended"],
        "sortable": ["created_at", "display_name", "role"],
        "editable": {"display_name": "string", "role": "enum:admin,user", "is_suspended": "boolean"},
        "actions": ["suspend", "restore"],
    },
    "import_jobs": {
        "description": "Asynchronous import lifecycle and failures",
        "columns": ["id", "tenant_id", "status", "filename", "rows_inserted", "rows_skipped", "error_message", "created_at", "updated_at"],
        "masked_columns": ["error_message"],
        "filterable": ["id", "tenant_id", "status"],
        "sortable": ["created_at", "updated_at", "rows_processed"],
        "editable": {},
        "actions": ["retry", "cancel"],
    },
    "usage_tracking": {
        "description": "Monthly and daily product usage counters",
        "columns": ["tenant_id", "month", "copilot_calls", "rows_imported", "uploads_count", "updated_at"],
        "masked_columns": [],
        "filterable": ["tenant_id", "month"],
        "sortable": ["month", "updated_at"],
        "editable": {"copilot_calls": "integer", "rows_imported": "integer", "uploads_count": "integer"},
        "actions": ["adjust"],
    },
    "audit_log": {
        "description": "Immutable superadmin audit trail",
        "columns": ["id", "action", "actor_id", "actor_email", "tenant_id", "reason", "operation_id", "details", "created_at"],
        "masked_columns": ["actor_email"],
        "filterable": ["action", "tenant_id", "operation_id"],
        "sortable": ["created_at"],
        "editable": {},
        "actions": [],
    },
    "user_consents": {
        "description": "Immutable consent evidence",
        "columns": ["user_id", "document_key", "version", "accepted_at", "ip_hash", "user_agent"],
        "masked_columns": ["ip_hash", "user_agent"],
        "filterable": ["user_id", "document_key", "version"],
        "sortable": ["accepted_at"],
        "editable": {},
        "actions": [],
    },
    "delivery_logs": {
        "description": "Email, WhatsApp, and in-app delivery events",
        "columns": ["id", "tenant_id", "channel", "template", "status", "provider_id", "error_message", "created_at"],
        "masked_columns": ["error_message"],
        "filterable": ["tenant_id", "channel", "status", "template"],
        "sortable": ["created_at"],
        "editable": {},
        "actions": ["retry"],
    },
}

RUNBOOKS: dict[str, dict[str, Any]] = {
    "rebuild_tenant_metrics": {"purpose": "Rebuild derived metrics for one tenant", "parameters": {"tenant_id": "uuid"}, "max_rows": 1_000_000, "rollback": "rebuild from source tables", "reversible": True, "permission": "runbooks:metrics"},
    "requeue_failed_import": {"purpose": "Put one failed import back on the worker queue", "parameters": {"import_job_id": "uuid"}, "max_rows": 1, "rollback": "cancel the queued job", "reversible": True, "permission": "runbooks:imports"},
    "reconcile_stripe_subscription": {"purpose": "Reconcile a subscription with the billing provider", "parameters": {"tenant_id": "uuid"}, "max_rows": 1, "rollback": "not_reversible: provider state is external", "reversible": False, "permission": "runbooks:billing"},
    "recalculate_usage_month": {"purpose": "Recalculate one tenant's usage counters", "parameters": {"tenant_id": "uuid", "month": "YYYY-MM"}, "max_rows": 1, "rollback": "restore prior counter snapshot", "reversible": True, "permission": "runbooks:usage"},
    "revoke_all_tenant_sessions": {"purpose": "Revoke every active session for a tenant", "parameters": {"tenant_id": "uuid"}, "max_rows": 100_000, "rollback": "not_reversible: sessions cannot be restored", "reversible": False, "permission": "runbooks:sessions"},
    "repair_missing_profile": {"purpose": "Create or repair a missing tenant profile", "parameters": {"user_id": "uuid", "tenant_id": "uuid", "role": "owner|admin|member"}, "max_rows": 1, "rollback": "delete only the newly-created profile", "reversible": True, "permission": "runbooks:profiles"},
    "regenerate_invoice": {"purpose": "Regenerate an invoice PDF and ledger link", "parameters": {"invoice_id": "uuid"}, "max_rows": 1, "rollback": "not_reversible: financial document evidence is retained", "reversible": False, "permission": "runbooks:billing"},
    "purge_expired_exports": {"purpose": "Permanently remove expired account exports", "parameters": {"before": "datetime"}, "max_rows": 100_000, "rollback": "not_reversible: expired exports are deleted", "reversible": False, "permission": "runbooks:exports"},
}

TEMPLATE_KEYS: dict[str, dict[str, Any]] = {
    **{f"E{i}": {"channel": "email", "locale": "en-IN"} for i in range(1, 12)},
    **{f"W{i}": {"channel": "whatsapp", "locale": "en-IN", "provider_approval_required": True} for i in range(1, 5)},
    "in_app.weekly_debrief": {"channel": "in_app", "locale": "en-IN"},
}

VARIABLES: dict[str, set[str]] = {
    "E1": {"verify_url"}, "E2": {"reset_url"}, "E3": {"company_name", "revenue", "dashboard_url"},
    "E4": {"date", "company_name", "dashboard_url"}, "E5": {"plan", "amount", "billing_url"},
    "E6": {"amount", "invoice_number", "invoice_url"}, "E7": {"plan", "upgrade_url"},
    "E8": {"data_url"}, "E9": {"support_email"}, "E10": {"used", "limit", "upgrade_url"},
    "E11": {"inviter_name", "company_name", "invite_url"}, "W1": {"company_name", "week_of", "revenue", "revenue_change", "top_zone", "alert_count", "outstanding", "party_count", "action_1", "action_2", "action_3"},
    "W2": {"date", "yesterday_revenue", "order_count", "trend_arrow", "trend_pct", "focus_metric"},
    "W3": {"alert_name", "alert_message", "triggered_at"}, "W4": {"plan_name", "copilot_calls", "users"},
    "in_app.weekly_debrief": {"headline", "body", "deep_link"},
}


def mask_value(column: str, value: Any) -> Any:
    if value is None:
        return None
    text = str(value)
    if "email" in column:
        local, _, domain = text.partition("@")
        return f"{(local[:1] + '***') if local else '***'}@{domain or '***'}"
    if "phone" in column or "mobile" in column:
        return f"***{text[-4:]}"
    if column in {"ip_address", "error_message"}:
        return "[masked]"
    if column in {"id", "user_id", "tenant_id"}:
        return f"{text[:8]}..."
    return "[masked]"


def mask_row(row: dict[str, Any], policy: dict[str, Any]) -> dict[str, Any]:
    masked = set(policy.get("masked_columns", []))
    return {key: mask_value(key, value) if key in masked else value for key, value in row.items()}


def sql_hash(sql: str) -> str:
    return hashlib.sha256(sql.encode("utf-8")).hexdigest()


_PLACEHOLDER = re.compile(r"\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}")


def validate_template_payload(key: str, payload: Any) -> list[str]:
    allowed = VARIABLES.get(key, set())
    text = str(payload)
    found = set(_PLACEHOLDER.findall(text))
    errors: list[str] = []
    unknown = sorted(found - allowed)
    if unknown:
        errors.append(f"Unknown placeholders: {', '.join(unknown)}")
    if "<script" in text.lower() or "javascript:" in text.lower():
        errors.append("Unsafe HTML or script content")
    return errors


def resolve_published_content(table: str, key: str, fallback: Any) -> tuple[Any, bool]:
    """Resolve published DB content first, returning (content, used_fallback)."""
    try:
        columns = "published,status" if table == "message_templates" else "published_value,is_active"
        row = get_supabase_service_client().table(table).select(columns).eq("key", key).maybe_single().execute()
        data = row.data or {}
        value = data.get("published") or data.get("published_value")
        active = data.get("is_active", True) and data.get("status", "published") != "suppressed"
        if active and value:
            return value, False
    except Exception:
        pass
    return fallback, True


def resolve_published_prompt(prompt_key: str, fallback: str) -> tuple[str, bool]:
    """Resolve an immutable published prompt version, never a draft."""
    try:
        supa = get_supabase_service_client()
        definition = supa.table("prompt_definitions").select("published_version_id").eq("prompt_key", prompt_key).maybe_single().execute()
        version_id = (definition.data or {}).get("published_version_id")
        if version_id:
            version = supa.table("prompt_versions").select("content,status").eq("id", version_id).eq("status", "published").maybe_single().execute()
            content = (version.data or {}).get("content")
            if isinstance(content, str) and content.strip():
                return content, False
    except Exception:
        pass
    return fallback, True
