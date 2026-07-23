"""Health and readiness endpoints.

GET /health   — liveness probe: fast, no external calls, used by Railway
GET /ready    — readiness probe: checks Supabase connectivity, used by CI gate
GET /version  — returns app metadata without secrets
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    environment: str
    timestamp: str


class ReadinessResponse(BaseModel):
    status: str          # "ready" | "degraded"
    environment: str
    timestamp: str
    checks: dict[str, str]


class VersionResponse(BaseModel):
    environment: str
    llm_model: str
    llm_provider: str


@router.get("/health", response_model=HealthResponse)
async def liveness() -> HealthResponse:
    """Fast liveness check — no DB call.
    Railway and UptimeRobot ping this endpoint.
    """
    return HealthResponse(
        status="ok",
        environment=settings.environment,
        timestamp=datetime.now(UTC).isoformat(),
    )


@router.get("/ready", response_model=ReadinessResponse)
async def readiness() -> ReadinessResponse:
    """Readiness probe — verifies Supabase connectivity.

    Returns 200 with status="ready" when everything is healthy.
    Returns 200 with status="degraded" when a non-critical check fails
    (this keeps Railway from cycling the container on transient failures).
    """
    checks: dict[str, str] = {}

    # Check 1: Supabase reachable
    try:
        from app.core.tenant import get_supabase_service_client
        client = get_supabase_service_client()
        # Lightweight query — just check the connection works
        client.table("tenants").select("id").limit(1).execute()
        checks["supabase"] = "ok"
    except Exception as exc:
        logger.warning("Readiness: Supabase check failed: %s", exc)
        checks["supabase"] = f"error: {type(exc).__name__}"

    # Check 2: Configuration validation
    config_errors = settings.validate_for_environment()
    if config_errors:
        checks["config"] = f"errors: {', '.join(config_errors[:3])}"
    else:
        checks["config"] = "ok"

    all_ok = all(v == "ok" for v in checks.values())
    status = "ready" if all_ok else "degraded"

    return ReadinessResponse(
        status=status,
        environment=settings.environment,
        timestamp=datetime.now(UTC).isoformat(),
        checks=checks,
    )


@router.get("/version", response_model=VersionResponse)
async def version() -> VersionResponse:
    """Returns non-sensitive app metadata for operational diagnostics."""
    return VersionResponse(
        environment=settings.environment,
        llm_model=settings.openrouter_model,
        llm_provider="openrouter",
    )
