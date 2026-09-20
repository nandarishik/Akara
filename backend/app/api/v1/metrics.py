"""Metric definition catalog at /metrics (café dashboard tooltips)."""

from __future__ import annotations

from fastapi import APIRouter, Request

from app.core.auth import CurrentUser
from app.core.config import settings
from app.core.errors import AkaraHTTPException
from app.core.rate_limit import limiter
from app.core.tenant import TenantCtx, get_supabase_service_client
from app.domain.kpi.cafe_models import MetricDef, MetricsListResponse
from app.domain.kpi.cafe_service import CafeKPIService

router = APIRouter(prefix="/metrics", tags=["metrics"])


def _gate() -> None:
    if not getattr(settings, "cafe_metrics_v2", False):
        raise AkaraHTTPException(
            status_code=404,
            code="CAFE_METRICS_DISABLED",
            message="Café metrics v2 is not enabled.",
        )


@router.get("", response_model=MetricsListResponse)
@limiter.limit("30/minute")
def list_metrics(
    request: Request,
    user: CurrentUser,
    tenant: TenantCtx,
) -> MetricsListResponse:
    _gate()
    service = CafeKPIService(supabase=get_supabase_service_client())
    return service.list_metrics(tenant.tenant_id)


@router.get("/{metric_id}", response_model=MetricDef)
@limiter.limit("30/minute")
def get_metric(
    request: Request,
    metric_id: str,
    user: CurrentUser,
    tenant: TenantCtx,
) -> MetricDef:
    _gate()
    service = CafeKPIService(supabase=get_supabase_service_client())
    found = service.get_metric(tenant.tenant_id, metric_id)
    if found is None:
        raise AkaraHTTPException(
            status_code=404,
            code="NOT_FOUND",
            message=f"Metric '{metric_id}' not found.",
        )
    return found
