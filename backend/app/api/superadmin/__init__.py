"""Superadmin API — mounts all Day 8 sub-routers at /superadmin."""

from fastapi import APIRouter

router = APIRouter(prefix="/superadmin", tags=["superadmin"])

_mounted = False


def include_superadmin_routers() -> None:
    """Mount child routers after the package is importable.

    Child imports are deferred so infra modules can import
    ``app.api.superadmin.control_plane`` without loading every superadmin
    submodule (which re-enters domain services mid-import).
    """
    global _mounted
    if _mounted:
        return

    from app.api.superadmin import (
        ai_control,
        audit,
        billing,
        catalog,
        content,
        conversations,
        copilot,
        data,
        day11,
        impersonate,
        legal,
        overview,
        plan,
        quota,
        reports,
        security,
        sudo,
        system,
        templates_control,
        tenants,
        usage,
        users,
    )

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
    router.include_router(copilot.router)
    router.include_router(day11.router)
    router.include_router(ai_control.router)
    router.include_router(templates_control.router)
    _mounted = True
