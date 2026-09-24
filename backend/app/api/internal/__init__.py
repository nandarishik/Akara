"""Internal / service-to-service API routers."""

from fastapi import APIRouter

from app.api.internal import connectors, engine, reports

router = APIRouter()
router.include_router(reports.router)
router.include_router(connectors.router)
router.include_router(engine.router)
