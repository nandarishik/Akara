"""Aggregate customer-facing v1 routers with unversioned compatibility aliases."""

from fastapi import APIRouter

from app.api.v1 import (
    account,
    alerts,
    auth,
    billing,
    cafe_data,
    conversations,
    copilot,
    data,
    debrief,
    health,
    kpi,
    marketing,
    metrics,
    onboarding,
    public_routes,
    reports,
    simulator,
    system,
    team,
)


def _mount_customer_routers(target: APIRouter) -> None:
    target.include_router(health.router)
    target.include_router(auth.router)
    target.include_router(billing.router)
    target.include_router(onboarding.router)
    target.include_router(marketing.router)
    target.include_router(public_routes.router)
    target.include_router(alerts.router)
    target.include_router(copilot.router)
    target.include_router(conversations.router)
    target.include_router(kpi.router)
    target.include_router(metrics.router)
    target.include_router(data.router)
    target.include_router(cafe_data.router)
    target.include_router(reports.router)
    target.include_router(debrief.router)
    target.include_router(team.router)
    target.include_router(account.router)
    target.include_router(simulator.router)
    target.include_router(system.router)


router = APIRouter(prefix="/v1")
_mount_customer_routers(router)

compat_router = APIRouter()
_mount_customer_routers(compat_router)
