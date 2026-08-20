"""Aggregate customer-facing v1 routers (URL paths unchanged — no /v1 prefix yet)."""

from fastapi import APIRouter

from app.api.v1 import (
    account,
    alerts,
    auth,
    billing,
    conversations,
    copilot,
    data,
    debrief,
    health,
    kpi,
    marketing,
    onboarding,
    public_routes,
    reports,
    simulator,
    system,
    team,
)

router = APIRouter()

router.include_router(health.router)
router.include_router(auth.router)
router.include_router(billing.router)
router.include_router(onboarding.router)
router.include_router(marketing.router)
router.include_router(public_routes.router)
router.include_router(alerts.router)
router.include_router(copilot.router)
router.include_router(conversations.router)
router.include_router(kpi.router)
router.include_router(data.router)
router.include_router(reports.router)
router.include_router(debrief.router)
router.include_router(team.router)
router.include_router(account.router)
router.include_router(simulator.router)
router.include_router(system.router)
