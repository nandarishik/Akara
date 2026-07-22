import logging

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth as auth_router
from app.api.routes import conversations as conversations_router
from app.api.routes import copilot as copilot_router
from app.api.routes import data as data_router
from app.api.routes import health
from app.api.routes import kpi as kpi_router
from app.api.routes import reports as reports_router
from app.api.routes import simulator as simulator_router
from app.api.routes.admin import logs as admin_logs_router
from app.api.routes.admin import reports as admin_reports_router
from app.api.routes.admin import tenants as admin_tenants_router
from app.api.routes.admin import users as admin_users_router
from app.core.config import settings

logging.basicConfig(level=settings.log_level)

if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=0.1,
    )

app = FastAPI(
    title="AKARA API",
    version="0.1.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth_router.router)
app.include_router(copilot_router.router)
app.include_router(conversations_router.router)
app.include_router(kpi_router.router)
app.include_router(data_router.router)
app.include_router(reports_router.router)
app.include_router(simulator_router.router)
app.include_router(admin_tenants_router.router)
app.include_router(admin_users_router.router)
app.include_router(admin_logs_router.router)
app.include_router(admin_reports_router.router)
