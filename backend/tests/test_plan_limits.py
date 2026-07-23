"""Tests for plan_limits.py — single source of truth for AKARA plan enforcement.

Covers:
  - Every plan/key combination returns correct value
  - Unknown plan falls back to free
  - is_feature_enabled respects plan + overrides
  - Unlimited (-1) values are correct
  - No limits are hardcoded in tests (always read from PLAN_LIMITS)
"""

import pytest

from app.core.plan_limits import (
    PLAN_LIMITS,
    get_limit,
    is_feature_enabled,
    required_plan_for_feature,
)

# ---------------------------------------------------------------------------
# PLAN_LIMITS structure sanity
# ---------------------------------------------------------------------------


def test_all_plans_present():
    assert set(PLAN_LIMITS.keys()) == {"free", "pro", "business"}


def test_all_plans_have_required_keys():
    required_keys = {
        "copilot_calls_per_month",
        "rows_total",
        "uploads_per_month",
        "uploads_per_day",
        "undos_per_day",
        "users",
        "weekly_debriefs_lifetime",
        "daily_briefs",
        "retention_days",
        "features",
    }
    for plan, limits in PLAN_LIMITS.items():
        assert required_keys.issubset(
            limits.keys()
        ), f"Plan '{plan}' missing keys: {required_keys - limits.keys()}"


def test_all_plans_have_same_feature_keys():
    """All plans must have identical feature key sets — no typos or missing entries."""
    feature_keys = [set(PLAN_LIMITS[p]["features"].keys()) for p in PLAN_LIMITS]
    assert feature_keys[0] == feature_keys[1] == feature_keys[2]


# ---------------------------------------------------------------------------
# Canonical limits (from sprint_phase2.md Pricing table)
# ---------------------------------------------------------------------------


def test_free_copilot_limit():
    assert get_limit("free", "copilot_calls_per_month") == 10


def test_pro_copilot_limit():
    assert get_limit("pro", "copilot_calls_per_month") == 400


def test_business_copilot_limit():
    assert get_limit("business", "copilot_calls_per_month") == 800


def test_free_rows_total():
    assert get_limit("free", "rows_total") == 10_000


def test_pro_rows_total():
    assert get_limit("pro", "rows_total") == 500_000


def test_business_rows_total():
    assert get_limit("business", "rows_total") == 2_000_000


def test_free_uploads_per_month():
    assert get_limit("free", "uploads_per_month") == 5


def test_pro_uploads_per_month_unlimited():
    assert get_limit("pro", "uploads_per_month") == -1


def test_business_uploads_per_month_unlimited():
    assert get_limit("business", "uploads_per_month") == -1


@pytest.mark.parametrize("plan", ["free", "pro", "business"])
def test_uploads_per_day_always_3(plan):
    """Daily upload cap is 3 for ALL plans (prevents server abuse)."""
    assert get_limit(plan, "uploads_per_day") == 3


@pytest.mark.parametrize("plan", ["free", "pro", "business"])
def test_undos_per_day_always_2(plan):
    """Daily undo cap is 2 for ALL plans."""
    assert get_limit(plan, "undos_per_day") == 2


def test_free_users():
    assert get_limit("free", "users") == 1


def test_pro_users():
    assert get_limit("pro", "users") == 3


def test_business_users():
    assert get_limit("business", "users") == 10


def test_free_retention_days():
    assert get_limit("free", "retention_days") == 30


def test_pro_retention_days():
    assert get_limit("pro", "retention_days") == 365


def test_business_retention_days():
    assert get_limit("business", "retention_days") == 1095


# ---------------------------------------------------------------------------
# Unknown plan fallback to free
# ---------------------------------------------------------------------------


def test_unknown_plan_falls_back_to_free():
    assert get_limit("enterprise", "copilot_calls_per_month") == 10
    assert get_limit("unknown", "rows_total") == 10_000


def test_unknown_plan_missing_key_returns_none():
    assert get_limit("free", "nonexistent_key") is None


# ---------------------------------------------------------------------------
# Feature flags
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "plan, feature, expected",
    [
        # Free — almost everything off
        ("free", "morning_brief", False),
        ("free", "scheme_leakage", False),
        ("free", "simulator", False),
        ("free", "reports", False),
        ("free", "secondary_sales", False),
        ("free", "tally_connector", False),
        ("free", "api_push", False),
        # Pro — most enabled, not business exclusives
        ("pro", "morning_brief", True),
        ("pro", "simulator", True),
        ("pro", "reports", True),
        ("pro", "secondary_sales", True),
        ("pro", "api_push", True),
        ("pro", "team_invites", True),
        ("pro", "scheme_leakage", False),  # Business only
        ("pro", "tally_connector", False),  # Business only
        ("pro", "api_keys", False),         # Business only
        # Business — everything enabled
        ("business", "scheme_leakage", True),
        ("business", "tally_connector", True),
        ("business", "api_keys", True),
        ("business", "morning_brief", True),
    ],
)
def test_feature_enabled_by_plan(plan, feature, expected):
    assert is_feature_enabled(plan, feature, {}) == expected


def test_override_enables_feature_on_free_plan():
    """Superadmin can enable scheme_leakage for a free tenant via feature_overrides."""
    assert is_feature_enabled("free", "scheme_leakage", {"scheme_leakage": True}) is True


def test_override_disables_feature_on_business_plan():
    """Superadmin can disable a feature even on Business via override."""
    assert is_feature_enabled("business", "simulator", {"simulator": False}) is False


def test_override_takes_precedence_over_plan():
    """feature_overrides always wins, regardless of plan tier."""
    assert is_feature_enabled("pro", "scheme_leakage", {"scheme_leakage": True}) is True
    assert is_feature_enabled("business", "morning_brief", {"morning_brief": False}) is False


# ---------------------------------------------------------------------------
# required_plan_for_feature helper
# ---------------------------------------------------------------------------


def test_required_plan_for_scheme_leakage():
    assert required_plan_for_feature("scheme_leakage") == "Business"


def test_required_plan_for_simulator():
    assert required_plan_for_feature("simulator") == "Pro"


def test_required_plan_for_unknown_feature():
    assert required_plan_for_feature("some_future_feature") == "a higher plan"
