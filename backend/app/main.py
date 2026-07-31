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

from app.api.routes import account as account_router
from app.api.routes import alerts as alerts_router
from app.api.routes import auth as auth_router
from app.api.routes import billing as billing_router
from app.api.routes import conversations as conversations_router
from app.api.routes import copilot as copilot_router
from app.api.routes import data as data_router
from app.api.routes import debrief as debrief_router
from app.api.routes import health
from app.api.routes import kpi as kpi_router
from app.api.routes import marketing as marketing_router
from app.api.routes import public_routes as public_router
from app.api.routes import onboarding as onboarding_router
from app.api.routes import reports as reports_router
from app.api.routes import simulator as simulator_router
from app.api.routes import team as team_router
from app.api.routes import system as system_router
from app.api.routes.superadmin import router as superadmin_router
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
app.include_router(health.router)
app.include_router(auth_router.router)
app.include_router(billing_router.router)
app.include_router(onboarding_router.router)
app.include_router(marketing_router.router)
app.include_router(public_router.router)
app.include_router(alerts_router.router)
app.include_router(copilot_router.router)
app.include_router(conversations_router.router)
app.include_router(kpi_router.router)
app.include_router(data_router.router)
app.include_router(reports_router.router)
app.include_router(debrief_router.router)
app.include_router(team_router.router)
app.include_router(account_router.router)
app.include_router(simulator_router.router)
app.include_router(system_router.router)
app.include_router(superadmin_router)
