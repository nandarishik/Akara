"""Internal / service-to-service API routers."""

from fastapi import APIRouter

from app.api.internal import reports

router = APIRouter()
router.include_router(reports.router)
