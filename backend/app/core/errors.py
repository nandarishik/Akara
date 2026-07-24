"""Structured API error contracts for AKARA Phase 2.

All error responses share a single envelope so clients can handle them
uniformly without inspecting HTTP status codes alone.

Usage (in a route):
    raise AkaraHTTPException(
        status_code=402,
        code="QUOTA_EXCEEDED",
        message="You have used all 10 copilot questions this month.",
        detail={"limit": 10, "reset_at": "2026-08-01T00:00:00Z"},
    )
"""

from __future__ import annotations

from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Stable error codes — do NOT rename; clients depend on these strings
# ---------------------------------------------------------------------------
ERROR_CODES = {
    # Auth
    "UNAUTHENTICATED": "No valid authentication token",
    "FORBIDDEN": "Insufficient permissions",
    "SUDO_REQUIRED": "Superadmin sudo session required",
    "SUDO_EXPIRED": "Sudo session has expired",
    # Resources
    "NOT_FOUND": "Resource not found",
    "CONFLICT": "Resource already exists or state conflict",
    # Input
    "VALIDATION_ERROR": "Request validation failed",
    "INVALID_IDEMPOTENCY_KEY": "Idempotency key is malformed or missing",
    # Plan / billing
    "QUOTA_EXCEEDED": "Monthly or daily usage quota exceeded",
    "PLAN_GATE": "Feature not available on current plan",
    "PAST_DUE": "Account payment is past due",
    # Rate limiting
    "RATE_LIMITED": "Too many requests",
    # Providers
    "LLM_UNAVAILABLE": "AI service is temporarily unavailable",
    "PAYMENT_PROVIDER_ERROR": "Payment provider error",
    # Data
    "IMPORT_IN_PROGRESS": "An import is already running",
    "TENANT_ISOLATED": "Operation not permitted across tenants",
    # General
    "INTERNAL_ERROR": "An unexpected error occurred",
    "SERVICE_UNAVAILABLE": "Service is temporarily unavailable",
}


class ErrorEnvelope(BaseModel):
    """The canonical error envelope returned by every AKARA error response."""
    ok: bool = False
    code: str
    message: str
    request_id: str | None = None
    detail: Any = None


class DataImportError(Exception):
    """Raised when file download, parse, or import fails in the data pipeline."""


class AkaraHTTPException(Exception):
    """Raise this instead of FastAPI's HTTPException throughout the AKARA backend.
    The custom exception handler will format it into an ErrorEnvelope.
    """

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str | None = None,
        detail: Any = None,
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message or ERROR_CODES.get(code, code)
        self.detail = detail


async def akara_exception_handler(
    request: Request, exc: AkaraHTTPException
) -> JSONResponse:
    """FastAPI exception handler — register in main.py."""
    request_id: str | None = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorEnvelope(
            code=exc.code,
            message=exc.message,
            request_id=request_id,
            detail=exc.detail,
        ).model_dump(exclude_none=True),
    )


class OkEnvelope(BaseModel):
    """Wrap successful mutation responses so callers can detect success uniformly."""
    ok: bool = True
    request_id: str | None = None
    data: Any = None
