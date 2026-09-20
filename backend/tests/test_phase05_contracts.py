"""Phase 5 contract tests — roles, TOTP, resolve_limit, GSTIN, jobs, query console."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

import pyotp
import pytest

from app.core.errors import AkaraHTTPException
from app.core.plan_limits import PLAN_LIMITS, resolve_limit
from app.domain.billing.gst_invoice import validate_gstin_checksum


def test_resolve_limit_override_wins():
    ctx = SimpleNamespace(plan="free", feature_overrides={"copilot_calls_per_month": 99})
    assert resolve_limit(ctx, "copilot_calls_per_month") == 99


def test_resolve_limit_falls_back_to_plan():
    ctx = SimpleNamespace(plan="pro", feature_overrides={})
    assert resolve_limit(ctx, "copilot_calls_per_month") == PLAN_LIMITS["pro"]["copilot_calls_per_month"]


def test_gstin_checksum_self_consistent():
    body = "27AAPFU0939F1Z"
    chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    factor = 2
    total = 0
    for char in reversed(body):
        code = chars.index(char)
        digit = factor * code
        factor = 1 if factor == 2 else 2
        digit = (digit // 36) + (digit % 36)
        total += digit
    check = chars[(36 - (total % 36)) % 36]
    assert validate_gstin_checksum(body + check)
    assert not validate_gstin_checksum(body + ("0" if check != "0" else "1"))


def test_totp_roundtrip():
    secret = pyotp.random_base32()
    code = pyotp.TOTP(secret).now()
    assert pyotp.TOTP(secret).verify(code)


def test_jobs_listed_in_openapi(client):
    paths = client.get("/openapi.json").json()["paths"]
    assert "/superadmin/jobs" in paths
    assert "/superadmin/jobs/{job_name}/trigger" in paths
    assert "/superadmin/jobs/{job_name}/pause" in paths
    assert "/superadmin/impersonate/active" in paths
    assert "/account/impersonation-session" in paths
    assert "/superadmin/sudo/totp/setup" in paths


@pytest.mark.asyncio
async def test_query_console_unconfigured_503():
    from app.api.superadmin import day11

    with patch.object(day11.settings, "query_readonly_db_url", ""):
        with pytest.raises(AkaraHTTPException) as exc:
            await day11._readonly_execute("SELECT 1", {})
    assert exc.value.status_code == 503
    assert exc.value.code == "QUERY_READONLY_UNCONFIGURED"
