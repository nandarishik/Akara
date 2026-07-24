"""HTTP rate limiting via slowapi — per-IP limits on sensitive endpoints."""

from __future__ import annotations

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.errors import ErrorEnvelope

# Shared limit strings for sensitive endpoints
ADMIN_WRITE_LIMIT = "10/minute"
ADMIN_READ_LIMIT = "30/minute"
EXPORT_LIMIT = "10/minute"
BROADCAST_LIMIT = "5/minute"

limiter = Limiter(key_func=get_remote_address)


async def rate_limit_exceeded_handler(
    request: Request, exc: RateLimitExceeded
) -> JSONResponse:
    request_id: str | None = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=429,
        content=ErrorEnvelope(
            code="RATE_LIMITED",
            message="Too many requests. Please wait a minute and try again.",
            request_id=request_id,
            detail={"retry_after_seconds": 60},
        ).model_dump(exclude_none=True),
    )
