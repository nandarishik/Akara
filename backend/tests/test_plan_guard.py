"""Tests for plan_guard.py — FastAPI dependency quota enforcement.

Covers:
  - require_copilot_quota: blocks at limit, allows under limit, passes unlimited
  - require_import_quota: daily cap, monthly cap (free), row storage cap
  - require_undo_quota: 2/day hard cap
  - require_feature: 403 when not in plan, 200 when enabled, override bypass
  - missing usage row treated as 0 (safe default)
  - cancelled plan status has no effect on guards (plan not plan_status drives quota)
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest

from app.core.plan_guard import (
    FeatureBlocked,
    UsageExceeded,
    require_copilot_quota,
    require_feature,
    require_import_quota,
    require_undo_quota,
)

# ── Helpers ──────────────────────────────────────────────────────────────────


def make_tenant(
    plan: str = "free",
    plan_status: str = "active",
    feature_overrides: dict | None = None,
    tenant_id: UUID | None = None,
):
    """Build a minimal TenantContext-like mock."""
    m = MagicMock()
    m.plan = plan
    m.plan_status = plan_status
    m.feature_overrides = feature_overrides or {}
    m.tenant_id = tenant_id or UUID("11111111-0000-0000-0000-000000000001")
    return m


def make_usage(**kwargs):
    """Return a usage dict with all counters zeroed unless overridden."""
    base = {
        "copilot_calls": 0,
        "rows_imported": 0,
        "uploads_count": 0,
        "debrief_count": 0,
        "uploads_today": 0,
        "undos_today": 0,
    }
    base.update(kwargs)
    return base


# ── require_copilot_quota ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_copilot_quota_passes_when_under_limit():
    tenant = make_tenant(plan="free")
    with patch("app.core.plan_guard._get_current_usage", return_value=make_usage(copilot_calls=5)):
        check = require_copilot_quota()
        await check(tenant)  # should not raise


@pytest.mark.asyncio
async def test_copilot_quota_blocks_at_limit():
    tenant = make_tenant(plan="free")
    with patch("app.core.plan_guard._get_current_usage", return_value=make_usage(copilot_calls=10)):
        check = require_copilot_quota()
        with pytest.raises(UsageExceeded) as exc_info:
            await check(tenant)
        assert exc_info.value.status_code == 402
        assert exc_info.value.detail["feature"] == "copilot_calls"


@pytest.mark.asyncio
async def test_copilot_quota_blocks_over_limit():
    tenant = make_tenant(plan="free")
    # Edge case: usage could exceed limit if increment happens in race condition
    with patch("app.core.plan_guard._get_current_usage", return_value=make_usage(copilot_calls=15)):
        check = require_copilot_quota()
        with pytest.raises(UsageExceeded):
            await check(tenant)


@pytest.mark.asyncio
async def test_copilot_quota_passes_under_pro_limit():
    """Pro at 399/400 calls should pass."""
    tenant = make_tenant(plan="pro")
    with patch("app.core.plan_guard._get_current_usage", return_value=make_usage(copilot_calls=399)):
        check = require_copilot_quota()
        await check(tenant)  # 399 < 400 → should not raise


@pytest.mark.asyncio
async def test_copilot_quota_blocks_at_pro_limit():
    """Pro at 400/400 calls should be blocked."""
    tenant = make_tenant(plan="pro")
    with patch("app.core.plan_guard._get_current_usage", return_value=make_usage(copilot_calls=400)):
        check = require_copilot_quota()
        with pytest.raises(UsageExceeded):
            await check(tenant)


@pytest.mark.asyncio
async def test_copilot_quota_zero_usage_row_treated_as_zero():
    """Missing usage row (empty JSONB from DB) should be treated as 0 calls."""
    tenant = make_tenant(plan="free")
    with patch("app.core.plan_guard._get_current_usage", return_value={}):
        check = require_copilot_quota()
        await check(tenant)  # 0 < 10 → should not raise


# ── require_import_quota ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_import_daily_cap_blocks_at_3():
    tenant = make_tenant(plan="free")
    with patch("app.core.plan_guard._get_current_usage", return_value=make_usage(uploads_today=3)):
        check = require_import_quota(row_count=100)
        with pytest.raises(UsageExceeded) as exc_info:
            await check(tenant)
        assert exc_info.value.detail["feature"] == "uploads_daily"


@pytest.mark.asyncio
async def test_import_daily_cap_applies_to_pro_too():
    """Daily cap is plan-agnostic — Pro at 3 uploads today should be blocked."""
    tenant = make_tenant(plan="pro")
    with patch("app.core.plan_guard._get_current_usage", return_value=make_usage(uploads_today=3)):
        check = require_import_quota(row_count=100)
        with pytest.raises(UsageExceeded) as exc_info:
            await check(tenant)
        assert exc_info.value.detail["feature"] == "uploads_daily"


@pytest.mark.asyncio
async def test_import_monthly_cap_blocks_free_at_5():
    tenant = make_tenant(plan="free")
    with patch("app.core.plan_guard._get_current_usage", return_value=make_usage(uploads_count=5)):
        check = require_import_quota(row_count=100)
        with pytest.raises(UsageExceeded) as exc_info:
            await check(tenant)
        assert exc_info.value.detail["feature"] == "uploads_monthly"


@pytest.mark.asyncio
async def test_import_monthly_cap_skipped_for_pro():
    """Pro has -1 (unlimited) monthly uploads — only daily cap applies."""
    tenant = make_tenant(plan="pro")
    with (
        patch("app.core.plan_guard._get_current_usage", return_value=make_usage(uploads_count=999)),
        patch("app.core.plan_guard._get_total_rows", return_value=0),
    ):
        check = require_import_quota(row_count=100)
        await check(tenant)  # should not raise (monthly cap is -1)


@pytest.mark.asyncio
async def test_import_row_storage_cap():
    """Should block when current rows + new rows would exceed rows_total."""
    tenant = make_tenant(plan="free")
    with (
        patch("app.core.plan_guard._get_current_usage", return_value=make_usage()),
        patch("app.core.plan_guard._get_total_rows", return_value=9_999),
    ):
        check = require_import_quota(row_count=2)  # 9999 + 2 > 10000
        with pytest.raises(UsageExceeded) as exc_info:
            await check(tenant)
        assert exc_info.value.detail["feature"] == "rows_total"


@pytest.mark.asyncio
async def test_import_passes_when_under_all_limits():
    tenant = make_tenant(plan="free")
    with (
        patch("app.core.plan_guard._get_current_usage", return_value=make_usage(uploads_today=1, uploads_count=2)),
        patch("app.core.plan_guard._get_total_rows", return_value=5_000),
    ):
        check = require_import_quota(row_count=100)
        await check(tenant)  # should not raise


# ── require_undo_quota ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_undo_blocks_at_2_per_day():
    tenant = make_tenant(plan="free")
    with patch("app.core.plan_guard._get_current_usage", return_value=make_usage(undos_today=2)):
        check = require_undo_quota()
        with pytest.raises(UsageExceeded) as exc_info:
            await check(tenant)
        assert exc_info.value.detail["feature"] == "undos_daily"


@pytest.mark.asyncio
async def test_undo_blocks_for_pro_too():
    """Undo cap applies to all plans."""
    tenant = make_tenant(plan="pro")
    with patch("app.core.plan_guard._get_current_usage", return_value=make_usage(undos_today=2)):
        check = require_undo_quota()
        with pytest.raises(UsageExceeded):
            await check(tenant)


@pytest.mark.asyncio
async def test_undo_passes_under_limit():
    tenant = make_tenant(plan="free")
    with patch("app.core.plan_guard._get_current_usage", return_value=make_usage(undos_today=1)):
        check = require_undo_quota()
        await check(tenant)  # should not raise


# ── require_feature ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_feature_blocks_free_plan_scheme_leakage():
    tenant = make_tenant(plan="free")
    check = require_feature("scheme_leakage")
    with pytest.raises(FeatureBlocked) as exc_info:
        await check(tenant)
    assert exc_info.value.status_code == 403
    assert exc_info.value.detail["feature"] == "scheme_leakage"


@pytest.mark.asyncio
async def test_feature_blocks_pro_plan_scheme_leakage():
    """scheme_leakage is Business-only; Pro should also be blocked."""
    tenant = make_tenant(plan="pro")
    check = require_feature("scheme_leakage")
    with pytest.raises(FeatureBlocked):
        await check(tenant)


@pytest.mark.asyncio
async def test_feature_passes_business_scheme_leakage():
    tenant = make_tenant(plan="business")
    check = require_feature("scheme_leakage")
    await check(tenant)  # should not raise


@pytest.mark.asyncio
async def test_feature_override_bypasses_plan():
    """Superadmin override enables scheme_leakage on free plan."""
    tenant = make_tenant(plan="free", feature_overrides={"scheme_leakage": True})
    check = require_feature("scheme_leakage")
    await check(tenant)  # should not raise


@pytest.mark.asyncio
async def test_feature_simulator_blocked_on_free():
    tenant = make_tenant(plan="free")
    check = require_feature("simulator")
    with pytest.raises(FeatureBlocked):
        await check(tenant)


@pytest.mark.asyncio
async def test_feature_simulator_passes_on_pro():
    tenant = make_tenant(plan="pro")
    check = require_feature("simulator")
    await check(tenant)  # should not raise


# ── UsageExceeded / FeatureBlocked response shape ────────────────────────────


def test_usage_exceeded_has_upgrade_url():
    exc = UsageExceeded(message="test", feature="copilot_calls")
    assert exc.detail["upgrade_url"] == "/upgrade"
    assert exc.detail["error"] == "usage_limit_exceeded"


def test_feature_blocked_has_upgrade_url():
    exc = FeatureBlocked(message="test", feature="scheme_leakage")
    assert exc.detail["upgrade_url"] == "/upgrade"
    assert exc.detail["error"] == "feature_not_available"
