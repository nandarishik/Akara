"""AKARA Phase 2 middleware — X-Request-ID injection and structured logging."""

from __future__ import annotations

import logging
import time
import uuid

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

logger = logging.getLogger("akara.requests")


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Attaches a unique `X-Request-ID` to every request and response.

    If the client already sends an `X-Request-ID` header it is honoured;
    otherwise a new UUID is generated.  The ID is stored on `request.state`
    so route handlers and exception handlers can include it in error envelopes.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id

        start = time.perf_counter()
        status_code: int | str = "ERR"
        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception:
            elapsed_ms = round((time.perf_counter() - start) * 1000)
            logger.info(
                "%s %s %s %dms rid=%s",
                request.method,
                request.url.path,
                status_code,
                elapsed_ms,
                request_id,
            )
            raise
        else:
            elapsed_ms = round((time.perf_counter() - start) * 1000)
            logger.info(
                "%s %s %s %dms rid=%s",
                request.method,
                request.url.path,
                status_code,
                elapsed_ms,
                request_id,
            )
            response.headers["X-Request-ID"] = request_id
            return response
