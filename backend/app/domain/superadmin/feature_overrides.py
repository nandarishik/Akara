"""Feature override validation against PLAN_LIMITS."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import Request

from app.core.errors import AkaraHTTPException
from app.core.plan_limits import PLAN_LIMITS
from app.core.superadmin import SudoUser, request_actor_meta
from app.core.tenant import get_supabase_service_client
from app.domain.superadmin.audit import record_operation
from app.domain.superadmin.mutations import dry_run_response


def _allowed_override_keys() -> dict[str, Any]:
    sample = PLAN_LIMITS["free"]
    keys: dict[str, Any] = {}
    for key, value in sample.items():
        if key == "features" and isinstance(value, dict):
            for fkey, fval in value.items():
                keys[fkey] = fval
        else:
            keys[key] = value
    return keys


def validate_overrides(overrides: dict[str, Any]) -> None:
    allowed = _allowed_override_keys()
    if not overrides:
        raise AkaraHTTPException(
            status_code=400,
            code="VALIDATION_ERROR",
            message="At least one override required",
        )
    for key, value in overrides.items():
        if key not in allowed:
            raise AkaraHTTPException(
                status_code=400,
                code="VALIDATION_ERROR",
                message=f"Unknown override key: {key}",
            )
        expected = allowed[key]
        if isinstance(expected, bool) and not isinstance(value, bool):
            raise AkaraHTTPException(
                status_code=400,
                code="VALIDATION_ERROR",
                message=f"Type mismatch for {key}",
            )
        if isinstance(expected, int) and not isinstance(value, int | bool):
            raise AkaraHTTPException(
                status_code=400,
                code="VALIDATION_ERROR",
                message=f"Type mismatch for {key}",
            )
        if isinstance(expected, list) and not isinstance(value, list):
            raise AkaraHTTPException(
                status_code=400,
                code="VALIDATION_ERROR",
                message=f"Type mismatch for {key}",
            )


def apply_feature_overrides(
    *,
    request: Request,
    tenant_id: UUID,
    overrides: dict[str, Any],
    admin: SudoUser,
    reason: str,
    dry_run: bool,
    operation_id: Any = None,
) -> dict[str, Any]:
    validate_overrides(overrides)
    supa = get_supabase_service_client()
    before = (
        supa.table("tenants")
        .select("*")
        .eq("id", str(tenant_id))
        .maybe_single()
        .execute()
    )
    if not before.data:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Tenant not found")
    before_overrides = dict(before.data.get("feature_overrides") or {})
    after_overrides = {**before_overrides, **overrides}
    if dry_run:
        return dry_run_response(
            action="superadmin.features.patch",
            before={"feature_overrides": before_overrides},
            impact={"feature_overrides": after_overrides},
        )
    result = (
        supa.table("tenants")
        .update({"feature_overrides": after_overrides})
        .eq("id", str(tenant_id))
        .execute()
    )
    after = result.data[0]
    audit = record_operation(
        action="superadmin.features.patch",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=reason,
        tenant_id=tenant_id,
        before_state={"feature_overrides": before_overrides},
        after_state={"feature_overrides": after_overrides},
        operation_id=operation_id,
        resource_type="tenant",
        resource_id=str(tenant_id),
        **request_actor_meta(request),
    )
    return {"ok": True, "feature_overrides": after.get("feature_overrides"), "audit": audit}
