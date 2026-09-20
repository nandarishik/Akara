"""Curated analytics refresh stub — no daily_kpi_cache in Phase 6."""

from __future__ import annotations

import logging
from uuid import UUID

logger = logging.getLogger(__name__)


def refresh_after_import(tenant_id: UUID, import_id: UUID) -> dict[str, str]:
    logger.info("analytics_refresh skipped tenant=%s import=%s", tenant_id, import_id)
    return {"status": "skipped", "reason": "no daily_kpi_cache in phase 6"}
