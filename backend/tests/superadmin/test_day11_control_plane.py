"""Pure Day 11 safety-contract tests; no Supabase connection required."""

import pytest

from app.api.superadmin.control_plane import (
    DATA_STUDIO_POLICY,
    RUNBOOKS,
    mask_row,
    validate_template_payload,
)
from app.infra.db.guard import SQLGuardError, validate_sql
from app.api.superadmin.day11 import _validate_query_tables


def test_data_studio_policy_rejects_unlisted_shape() -> None:
    assert "tenants" in DATA_STUDIO_POLICY
    assert "password" not in DATA_STUDIO_POLICY["profiles"]["columns"]
    assert "audit_log" not in DATA_STUDIO_POLICY["audit_log"]["editable"]


def test_pii_is_masked_by_default() -> None:
    row = mask_row({"id": "123456789", "actor_email": "founder@example.com"}, {"masked_columns": ["id", "actor_email"]})
    assert row["id"] == "12345678..."
    assert row["actor_email"] == "f***@example.com"


@pytest.mark.parametrize("sql", [
    "SELECT 1; SELECT 2",
    "SELECT 1 -- hidden statement",
    "SELECT * FROM auth.users",
    "SELECT pg_sleep(20)",
    "UPDATE tenants SET name = 'x'",
])
def test_query_console_rejects_unsafe_sql(sql: str) -> None:
    with pytest.raises(SQLGuardError):
        validate_sql(sql)


def test_query_console_allows_operational_select() -> None:
    validate_sql("SELECT id, plan FROM public.tenants WHERE plan = 'pro'")
    _validate_query_tables("SELECT id, plan FROM public.tenants WHERE plan = 'pro'")


def test_query_console_rejects_non_allowlisted_public_table() -> None:
    with pytest.raises(Exception):
        _validate_query_tables("SELECT * FROM public.global_settings")


def test_all_named_runbooks_have_impact_metadata() -> None:
    expected = {
        "rebuild_tenant_metrics", "requeue_failed_import", "reconcile_stripe_subscription",
        "recalculate_usage_month", "revoke_all_tenant_sessions", "repair_missing_profile",
        "regenerate_invoice", "purge_expired_exports",
    }
    assert expected == set(RUNBOOKS)
    assert all("parameters" in item and "max_rows" in item and "rollback" in item for item in RUNBOOKS.values())


def test_template_unknown_placeholder_is_rejected() -> None:
    errors = validate_template_payload("E1", "Verify {{verify_url}} and {{secret_key}}")
    assert any("Unknown placeholders" in error for error in errors)
