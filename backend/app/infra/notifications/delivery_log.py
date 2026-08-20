"""Record outbound notification delivery attempts."""

from __future__ import annotations

import logging
from uuid import UUID

from app.core.tenant import get_supabase_service_client

logger = logging.getLogger(__name__)


def log_delivery(
    *,
    channel: str,
    template: str,
    status: str,
    tenant_id: UUID | None = None,
    user_id: UUID | None = None,
    provider_id: str | None = None,
    error_message: str | None = None,
    metadata: dict | None = None,
) -> None:
    try:
        get_supabase_service_client().table("delivery_logs").insert({
            "tenant_id": str(tenant_id) if tenant_id else None,
            "user_id": str(user_id) if user_id else None,
            "channel": channel,
            "template": template,
            "status": status,
            "provider_id": provider_id,
            "error_message": error_message,
            "metadata": metadata or {},
        }).execute()
    except Exception as exc:
        logger.warning("Could not write delivery_log: %s", exc)
