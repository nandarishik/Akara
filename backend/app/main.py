from __future__ import annotations

import logging
import sys
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

try:
    import sentry_sdk as _sentry_sdk  # optional; not installed in all envs

    _SENTRY_AVAILABLE = True
except ImportError:
    _sentry_sdk = None  # type: ignore[assignment]
    _SENTRY_AVAILABLE = False

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.api.internal import router as internal_router
from app.api.superadmin import include_superadmin_routers
from app.api.superadmin import router as superadmin_router
from app.api.v1.router import compat_router as v1_compat_router
from app.api.v1.router import router as v1_router
from app.core.config import settings
from app.core.errors import (
    ERROR_CODES,
    AkaraHTTPException,
    ErrorEnvelope,
    akara_exception_handler,
)
from app.core.middleware import RequestIDMiddleware
from app.core.rate_limit import limiter, rate_limit_exceeded_handler
from app.core.security_headers import SecurityHeadersMiddleware

logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("akara.startup")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup validation -- fail fast on critical misconfiguration."""
    errors = settings.validate_for_environment()
    if errors:
        fatal = [e for e in errors if e.startswith("MISSING_REQUIRED:")]
        if fatal and (settings.is_production or settings.is_staging):
            logger.critical(
                "STARTUP FAILED -- missing required configuration:\n%s",
                "\n".join(f"  * {e}" for e in fatal),
            )
            sys.exit(1)
        logger.warning(
            "Configuration warnings (service will start; /ready may report degraded):\n%s",
            "\n".join(f"  * {e}" for e in errors),
        )
    else:
        logger.info(
            "Startup OK -- environment=%s model=%s",
            settings.environment,
            settings.openrouter_model,
        )

    yield  # --- application running ---

    logger.info("Shutdown complete.")


# ---------------------------------------------------------------------------
# Sentry (optional)
# ---------------------------------------------------------------------------
if _SENTRY_AVAILABLE and settings.sentry_dsn:
    _sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=0.1,
        profiles_sample_rate=0.05,
    )

# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------
app = FastAPI(
    title="AKARA API",
    version="2.0.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "X-Request-ID",
        "X-Quota-Used",
        "X-Quota-Limit",
        "X-Quota-Warn",
        "X-Quota-Urgent",
    ],
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestIDMiddleware)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)  # type: ignore[arg-type]

# ---------------------------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------------------------
_HTTP_STATUS_TO_CODE = {
    400: "VALIDATION_ERROR",
    401: "UNAUTHENTICATED",
    402: "QUOTA_EXCEEDED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMITED",
}


def _code_for_http_exception(status_code: int) -> str:
    return _HTTP_STATUS_TO_CODE.get(status_code, "INTERNAL_ERROR")


async def request_validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    request_id: str | None = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=422,
        content=ErrorEnvelope(
            code="VALIDATION_ERROR",
            message="Request validation failed",
            request_id=request_id,
            detail={"errors": exc.errors()},
        ).model_dump(exclude_none=True),
    )


async def fastapi_http_exception_handler(
    request: Request, exc: HTTPException
) -> JSONResponse:
    request_id: str | None = getattr(request.state, "request_id", None)
    code = _code_for_http_exception(exc.status_code)
    detail = exc.detail
    envelope_detail = None
    if isinstance(detail, str):
        message = detail
    elif isinstance(detail, dict) and detail.get("message"):
        message = str(detail["message"])
        envelope_detail = detail
    elif detail is None:
        message = ERROR_CODES.get(code, code)
    else:
        message = str(detail)
        envelope_detail = detail

    headers: dict[str, str] = {}
    if exc.status_code == 401 and exc.headers:
        www = exc.headers.get("WWW-Authenticate")
        if www:
            headers["WWW-Authenticate"] = www

    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorEnvelope(
            code=code,
            message=message,
            request_id=request_id,
            detail=envelope_detail,
        ).model_dump(exclude_none=True),
        headers=headers,
    )


app.add_exception_handler(AkaraHTTPException, akara_exception_handler)  # type: ignore[arg-type]
app.add_exception_handler(RequestValidationError, request_validation_exception_handler)  # type: ignore[arg-type]
app.add_exception_handler(HTTPException, fastapi_http_exception_handler)  # type: ignore[arg-type]

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
include_superadmin_routers()
app.include_router(v1_router)
app.include_router(v1_compat_router)
app.include_router(superadmin_router)
app.include_router(internal_router)
