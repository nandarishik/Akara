"""Plan limits — single source of truth for AKARA's Free / Pro / Business plans.

Every quota check, feature gate, and billing UI reads from this module.
Never hardcode limits elsewhere.

Canonical pricing (sprint_phase2.md §Pricing):
  Free:     ₹0
  Pro:      ₹7,999/month  (₹76,790/year, save 20%)
  Business: ₹13,999/month (₹1,34,390/year, save 20%)

Retention policy (also stored in tenants.plan column comment):
  Free = 30 days | Pro = 365 days | Business = 1,095 days
"""

from __future__ import annotations

from typing import Any

# -1 = unlimited
PLAN_LIMITS: dict[str, dict[str, Any]] = {
    "free": {
        "copilot_calls_per_month": 10,
        "rows_total": 10_000,
        "uploads_per_month": 5,
        "uploads_per_day": 3,       # hard daily cap — all plans (prevents server abuse)
        "undos_per_day": 2,         # max import deletes per day — all plans
        "users": 1,
        "weekly_debriefs_lifetime": 1,  # checked against SUM across all months
        "daily_briefs": False,
        "retention_days": 30,
        "data_sources": ["csv"],
        "features": {
            "morning_brief": False,
            "scheme_leakage": False,
            "simulator": False,
            "reports": False,
            "custom_language": False,
            "secondary_sales": False,
            "api_push": False,
            "tally_connector": False,
            "team_invites": False,
            "api_keys": False,
            "ask_copilot_debrief": False,
        },
    },
    "pro": {
        "copilot_calls_per_month": 400,
        "rows_total": 500_000,
        "uploads_per_month": -1,    # unlimited monthly, but daily cap still applies
        "uploads_per_day": 3,       # same daily cap as free — prevents batch abuse
        "undos_per_day": 2,
        "users": 3,
        "weekly_debriefs_lifetime": -1,
        "daily_briefs": True,
        "retention_days": 365,
        "data_sources": ["csv", "secondary_sales", "scheme_master", "api"],
        "features": {
            "morning_brief": True,
            "scheme_leakage": False,
            "simulator": True,
            "reports": True,
            "custom_language": True,
            "secondary_sales": True,
            "api_push": True,
            "tally_connector": False,
            "team_invites": True,
            "api_keys": False,
            "ask_copilot_debrief": True,
        },
    },
    "business": {
        "copilot_calls_per_month": 800,
        "rows_total": 2_000_000,
        "uploads_per_month": -1,
        "uploads_per_day": 3,       # same daily cap — contact support for bulk ingestion
        "undos_per_day": 2,
        "users": 10,
        "weekly_debriefs_lifetime": -1,
        "daily_briefs": True,
        "retention_days": 1095,
        "data_sources": ["csv", "secondary_sales", "scheme_master", "api", "tally"],
        "features": {
            "morning_brief": True,
            "scheme_leakage": True,
            "simulator": True,
            "reports": True,
            "custom_language": True,
            "secondary_sales": True,
            "api_push": True,
            "tally_connector": True,
            "team_invites": True,
            "api_keys": True,
            "ask_copilot_debrief": True,
        },
    },
}

# Upgrade messaging shown inside 403/402 responses
_FEATURE_REQUIRED_PLAN: dict[str, str] = {
    "scheme_leakage": "Business",
    "tally_connector": "Business",
    "api_keys": "Business",
    "simulator": "Pro",
    "reports": "Pro",
    "secondary_sales": "Pro",
    "api_push": "Pro",
    "morning_brief": "Pro",
    "team_invites": "Pro",
    "custom_language": "Pro",
    "ask_copilot_debrief": "Pro",
}


def get_limit(plan: str, key: str) -> Any:
    """Return the limit value for a plan + key.

    Falls back to 'free' for unknown plans so new tenants always have
    the most conservative limits rather than unlimited access.
    """
    return PLAN_LIMITS.get(plan, PLAN_LIMITS["free"]).get(key)


def is_feature_enabled(plan: str, feature: str, overrides: dict) -> bool:
    """Check if a feature is enabled for a plan.

    Args:
        plan: Tenant plan slug ('free' | 'pro' | 'business').
        feature: Feature key matching the 'features' sub-dict keys above.
        overrides: Tenant-level JSONB overrides from tenants.feature_overrides.
                   Superadmin can enable any feature per tenant via this dict.
    """
    # Superadmin override always wins
    if feature in overrides:
        return bool(overrides[feature])
    features = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"]).get("features", {})
    return bool(features.get(feature, False))


def required_plan_for_feature(feature: str) -> str:
    """Return the minimum plan name string for use in upgrade messages."""
    return _FEATURE_REQUIRED_PLAN.get(feature, "a higher plan")
