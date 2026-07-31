"""Superadmin API — mounts all Day 8 sub-routers at /superadmin."""

from fastapi import APIRouter

from app.api.routes.superadmin import (
    audit,
    billing,
    catalog,
    content,
    conversations,
    data,
    impersonate,
    legal,
    overview,
    plan,
    quota,
    reports,
    security,
    sudo,
    system,
    tenants,
    usage,
    users,
)
from app.api.routes import superadmin_copilot

router = APIRouter(prefix="/superadmin", tags=["superadmin"])

router.include_router(sudo.router)
router.include_router(tenants.router)
router.include_router(quota.router)
router.include_router(plan.router)
router.include_router(users.router)
router.include_router(data.router)
router.include_router(conversations.router)
router.include_router(billing.router)
router.include_router(catalog.router)
router.include_router(content.router)
router.include_router(legal.router)
router.include_router(reports.router)
router.include_router(security.router)
router.include_router(impersonate.router)
router.include_router(audit.router)
router.include_router(overview.router)
router.include_router(usage.router)
router.include_router(system.router)
router.include_router(superadmin_copilot.router)
