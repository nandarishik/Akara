"""Shared superadmin mutation contracts and dry-run helpers."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.errors import AkaraHTTPException


class SuperadminMutation(BaseModel):
    """Base fields required on every superadmin write operation."""

    reason: str = Field(..., min_length=10, max_length=2000)
    dry_run: bool = False
    operation_id: UUID | None = None
    expected_version: int | None = None


def dry_run_response(
    *,
    action: str,
    impact: dict[str, Any],
    before: dict[str, Any] | None = None,
    warnings: list[str] | None = None,
) -> dict[str, Any]:
    """Standard dry-run envelope — no side effects applied."""
    return {
        "ok": True,
        "dry_run": True,
        "action": action,
        "before": before or {},
        "impact": impact,
        "warnings": warnings or [],
    }


def require_confirmation(confirm: str | None, expected: str) -> None:
    """Raise when destructive confirmation string does not match exactly."""
    if confirm != expected:
        raise AkaraHTTPException(
            status_code=400,
            code="VALIDATION_ERROR",
            message=f'Confirmation must be exactly: "{expected}"',
            detail={"expected": expected, "received": confirm},
        )


def check_expected_version(
    current_version: int | None,
    expected_version: int | None,
) -> None:
    if expected_version is None:
        return
    if current_version != expected_version:
        raise AkaraHTTPException(
            status_code=409,
            code="CONFLICT",
            message="Resource was modified by another operation",
            detail={"current_version": current_version, "expected_version": expected_version},
        )
