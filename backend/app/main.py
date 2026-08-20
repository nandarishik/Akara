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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.internal import router as internal_router
from app.api.superadmin import router as superadmin_router
from app.api.v1.router import router as v1_router
from app.core.config import settings
from app.core.errors import AkaraHTTPException, akara_exception_handler
from app.core.middleware import RequestIDMiddleware
from app.core.rate_limit import limiter, rate_limit_exceeded_handler
from app.core.security_headers import SecurityHeadersMiddleware
from slowapi.errors import RateLimitExceeded

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
app.add_exception_handler(AkaraHTTPException, akara_exception_handler)  # type: ignore[arg-type]

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(v1_router)
app.include_router(superadmin_router)
app.include_router(internal_router)
