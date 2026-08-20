"""Dynamic plan catalog — DB-backed with static fallback."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from app.core.errors import AkaraHTTPException
from app.core.plan_limits import PLAN_LIMITS
from app.core.tenant import get_supabase_service_client

logger = logging.getLogger(__name__)


def _static_plan(code: str) -> dict[str, Any] | None:
    limits = PLAN_LIMITS.get(code)
    if not limits:
        return None
    prices = {"free": (0, 0), "pro": (799900, 7679000), "business": (1399900, 13439000)}
    monthly, annual = prices.get(code, (0, 0))
    return {
        "code": code,
        "display_name": code.capitalize(),
        "description": "",
        "currency": "INR",
        "monthly_price_minor": monthly,
        "annual_price_minor": annual,
        "entitlements": {"features": limits.get("features", {})},
        "limits": {k: v for k, v in limits.items() if k != "features"},
        "is_public": code != "free" or True,
        "is_active": True,
        "sort_order": {"free": 0, "pro": 1, "business": 2}.get(code, 99),
        "version": 1,
    }


def list_catalog(*, include_inactive: bool = False) -> list[dict[str, Any]]:
    try:
        supa = get_supabase_service_client()
        query = supa.table("plan_catalog").select("*").order("sort_order")
        if not include_inactive:
            query = query.eq("is_active", True)
        result = query.execute()
        if result.data:
            return result.data
    except Exception as exc:
        logger.warning("plan_catalog table unavailable, using static fallback: %s", exc)
    return [_static_plan(c) for c in ("free", "pro", "business") if _static_plan(c)]


def get_plan(code: str) -> dict[str, Any] | None:
    supa = get_supabase_service_client()
    try:
        row = (
            supa.table("plan_catalog")
            .select("*")
            .eq("code", code)
            .maybe_single()
            .execute()
        )
        if row.data:
            return row.data
    except Exception as exc:
        logger.warning("plan_catalog lookup failed for %s: %s", code, exc)
    return _static_plan(code)


def list_public_plans() -> list[dict[str, Any]]:
    try:
        supa = get_supabase_service_client()
        result = (
            supa.table("plan_catalog")
            .select(
                "code, display_name, description, currency, monthly_price_minor, "
                "annual_price_minor, entitlements, limits, cta_label, sort_order"
            )
            .eq("is_public", True)
            .eq("is_active", True)
            .order("sort_order")
            .execute()
        )
        if result.data:
            return result.data
    except Exception as exc:
        logger.warning("public plans query failed: %s", exc)
    return [p for p in [_static_plan(c) for c in ("free", "pro", "business")] if p.get("is_public", True)]


def resolve_tenant_limits(tenant_id: UUID, plan_slug: str) -> dict[str, Any]:
    """Resolve effective limits: plan_assignments → plan_catalog → static."""
    supa = get_supabase_service_client()
    base = get_plan(plan_slug) or _static_plan("free") or {}
    limits = dict(base.get("limits") or {})
    features = dict((base.get("entitlements") or {}).get("features") or {})

    try:
        assignment = (
            supa.table("plan_assignments")
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .maybe_single()
            .execute()
        )
        if assignment.data:
            custom = assignment.data.get("custom_limits") or {}
            limits.update(custom)
            if assignment.data.get("plan_code"):
                assigned = get_plan(assignment.data["plan_code"])
                if assigned:
                    limits.update(assigned.get("limits") or {})
                    features.update((assigned.get("entitlements") or {}).get("features") or {})
    except Exception as exc:
        logger.debug("plan_assignments lookup skipped: %s", exc)

    static = PLAN_LIMITS.get(plan_slug, PLAN_LIMITS["free"])
    for key, val in static.items():
        if key == "features":
            for fk, fv in (val or {}).items():
                features.setdefault(fk, fv)
        else:
            limits.setdefault(key, val)

    return {"limits": limits, "features": features}


def count_affected_tenants(plan_code: str) -> int:
    supa = get_supabase_service_client()
    try:
        direct = (
            supa.table("tenants")
            .select("id", count="exact")
            .eq("plan", plan_code)
            .eq("is_active", True)
            .execute()
        )
        return int(direct.count or 0)
    except Exception:
        return 0


def publish_plan(
    code: str,
    *,
    actor_id: UUID | None = None,
    schedule_price_migration: bool = False,
    expected_version: int | None = None,
) -> dict[str, Any]:
    supa = get_supabase_service_client()
    row = get_plan(code)
    if not row:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Plan not found")

    current_version = int(row.get("version") or 1)
    if expected_version is not None and current_version != expected_version:
        raise AkaraHTTPException(
            status_code=409,
            code="CONFLICT",
            message="Plan was modified by another operation",
            detail={"current_version": current_version, "expected_version": expected_version},
        )

    price_changed = row.get("draft_monthly_price_minor") is not None or row.get("draft_annual_price_minor") is not None

    update: dict[str, Any] = {
        "updated_at": datetime.now(UTC).isoformat(),
        "version": current_version + 1,
    }
    if row.get("draft_limits") is not None:
        update["limits"] = row["draft_limits"]
        update["draft_limits"] = None
    if row.get("draft_entitlements") is not None:
        update["entitlements"] = row["draft_entitlements"]
        update["draft_entitlements"] = None
    if row.get("draft_monthly_price_minor") is not None:
        update["monthly_price_minor"] = row["draft_monthly_price_minor"]
        update["draft_monthly_price_minor"] = None
    if row.get("draft_annual_price_minor") is not None:
        update["annual_price_minor"] = row["draft_annual_price_minor"]
        update["draft_annual_price_minor"] = None

    supa.table("plan_catalog").update(update).eq("code", code).eq("version", current_version).execute()

    migration_id = None
    if schedule_price_migration and price_changed:
        mig = supa.table("plan_price_migrations").insert({
            "plan_code": code,
            "effective_at": datetime.now(UTC).isoformat(),
            "status": "scheduled",
            "monthly_price_minor": update.get("monthly_price_minor", row.get("monthly_price_minor")),
            "annual_price_minor": update.get("annual_price_minor", row.get("annual_price_minor")),
            "created_by": str(actor_id) if actor_id else None,
        }).execute()
        migration_id = (mig.data or [{}])[0].get("id")

    return {
        "code": code,
        "affected_tenants": count_affected_tenants(code),
        "published": update,
        "price_migration_id": migration_id,
    }


def create_plan(
    *,
    code: str,
    display_name: str,
    description: str = "",
    monthly_price_minor: int = 0,
    annual_price_minor: int | None = None,
    limits: dict[str, Any] | None = None,
    entitlements: dict[str, Any] | None = None,
    is_public: bool = False,
    sort_order: int = 99,
) -> dict[str, Any]:
    supa = get_supabase_service_client()
    existing = get_plan(code)
    if existing and existing.get("code") == code and supa:
        try:
            check = supa.table("plan_catalog").select("code").eq("code", code).maybe_single().execute()
            if check.data:
                raise AkaraHTTPException(status_code=409, code="CONFLICT", message="Plan code already exists")
        except AkaraHTTPException:
            raise
        except Exception:
            pass

    payload = {
        "code": code,
        "display_name": display_name,
        "description": description,
        "monthly_price_minor": monthly_price_minor,
        "annual_price_minor": annual_price_minor,
        "limits": limits or {},
        "entitlements": entitlements or {"features": {}},
        "is_public": is_public,
        "is_active": True,
        "sort_order": sort_order,
    }
    result = supa.table("plan_catalog").insert(payload).execute()
    return (result.data or [payload])[0]


def sync_plan_to_razorpay(code: str) -> dict[str, Any]:
    """Create or update Razorpay Plans from catalog prices; store plan IDs."""
    row = get_plan(code)
    if not row:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Plan not found")
    if code == "free":
        return {"code": code, "synced": True, "message": "Free plan — no Razorpay IDs needed"}

    from app.domain.billing.checkout import _client

    client = _client()
    update: dict[str, Any] = {}
    display = row.get("display_name") or code.capitalize()

    monthly = int(row.get("monthly_price_minor") or 0)
    if monthly > 0:
        rz_plan = client.plan.create({
            "period": "monthly",
            "interval": 1,
            "item": {
                "name": f"AKARA {display} Monthly",
                "amount": monthly,
                "currency": "INR",
                "description": f"AKARA {display} monthly subscription",
            },
            "notes": {"plan_code": code, "interval": "month"},
        })
        update["razorpay_monthly_plan_id"] = rz_plan["id"]

    annual = row.get("annual_price_minor")
    if annual and int(annual) > 0:
        rz_plan = client.plan.create({
            "period": "yearly",
            "interval": 1,
            "item": {
                "name": f"AKARA {display} Annual",
                "amount": int(annual),
                "currency": "INR",
                "description": f"AKARA {display} annual subscription",
            },
            "notes": {"plan_code": code, "interval": "year"},
        })
        update["razorpay_annual_plan_id"] = rz_plan["id"]

    if update:
        get_supabase_service_client().table("plan_catalog").update(update).eq("code", code).execute()

    return {"code": code, "synced": True, "razorpay_ids": update}


def apply_due_price_migrations() -> dict[str, int]:
    """Apply scheduled price migrations whose effective_at has passed."""
    supa = get_supabase_service_client()
    now = datetime.now(UTC).isoformat()
    due = (
        supa.table("plan_price_migrations")
        .select("*")
        .eq("status", "scheduled")
        .lte("effective_at", now)
        .execute()
    )
    applied = 0
    for mig in due.data or []:
        code = mig["plan_code"]
        try:
            sync_plan_to_razorpay(code)
            supa.table("plan_price_migrations").update({
                "status": "applied",
                "applied_at": now,
            }).eq("id", mig["id"]).execute()
            applied += 1
        except Exception as exc:
            logger.warning("Price migration failed for %s: %s", code, exc)
    return {"applied": applied, "due_count": len(due.data or [])}


def plan_diff(before: dict[str, Any]) -> dict[str, Any]:
    """Return side-by-side current vs draft for publish preview."""
    fields = ("limits", "entitlements", "monthly_price_minor", "annual_price_minor")
    diff: dict[str, Any] = {}
    for f in fields:
        draft_key = f"draft_{f}"
        draft_val = before.get(draft_key)
        if draft_val is not None:
            diff[f] = {"current": before.get(f), "draft": draft_val}
    return diff
