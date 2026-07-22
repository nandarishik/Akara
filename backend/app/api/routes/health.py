from datetime import UTC, datetime

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    environment: str
    timestamp: str


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Health check endpoint — no auth required.
    Used by UptimeRobot and Railway health checks.
    """
    return HealthResponse(
        status="ok",
        environment=settings.environment,
        timestamp=datetime.now(UTC).isoformat(),
    )
