from __future__ import annotations
import logging
from uuid import UUID
from app.domain.intelligence.forecast import run_forecast_for_tenant
logger = logging.getLogger(__name__)

def run_forecast_cycle() -> dict:
    logger.info("forecast cycle stub")
    return {"ok": True}
