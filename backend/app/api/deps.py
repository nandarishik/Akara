"""Shared FastAPI dependency re-exports for the API layer."""

from app.core.auth import AuthenticatedUser, CurrentUser, get_current_user
from app.core.tenant import TenantContext, TenantCtx, get_tenant_context

__all__ = [
    "AuthenticatedUser",
    "CurrentUser",
    "TenantContext",
    "TenantCtx",
    "get_current_user",
    "get_tenant_context",
]
