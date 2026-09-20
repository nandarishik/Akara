"""Internal / service-to-service API routers."""

from fastapi import APIRouter

from app.api.internal import connectors, reports

router = APIRouter()
router.include_router(reports.router)
router.include_router(connectors.router)
