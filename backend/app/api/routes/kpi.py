from datetime import date, timedelta

from fastapi import APIRouter, Query, Request

from app.core.auth import CurrentUser
from app.core.rate_limit import limiter
from app.core.tenant import TenantCtx, get_supabase_service_client
from app.services.kpi.models import (
    DataBoundsResponse,
    HeatmapResponse,
    KPIResponse,
)
from app.services.kpi.service import KPIService
from app.services.schema.discovery import SchemaDiscovery

router = APIRouter(prefix="/kpi", tags=["kpi"])


@router.get("/", response_model=KPIResponse)
@limiter.limit("30/minute")
def get_kpis(
    request: Request,
    user: CurrentUser,
    tenant: TenantCtx,
    start_date: str = Query(
        default=(date.today() - timedelta(days=30)).isoformat(),
        description="Start date (YYYY-MM-DD)",
    ),
    end_date: str = Query(
        default=date.today().isoformat(),
        description="End date (YYYY-MM-DD)",
    ),
) -> KPIResponse:
    service = KPIService(supabase=get_supabase_service_client())
    return service.get_all(
        tenant_id=tenant.tenant_id,
        start_date=start_date,
        end_date=end_date,
    )


@router.get("/data-bounds", response_model=DataBoundsResponse)
@limiter.limit("30/minute")
def get_data_bounds(request: Request, user: CurrentUser, tenant: TenantCtx) -> DataBoundsResponse:
    """Return min/max invoice_date for the tenant's imported sales data."""
    schema = SchemaDiscovery(supabase=get_supabase_service_client())
    bounds = schema.get_data_date_range(tenant.tenant_id)
    if bounds:
        return DataBoundsResponse(start=bounds[0], end=bounds[1])
    return DataBoundsResponse()


@router.get("/heatmap", response_model=HeatmapResponse)
@limiter.limit("30/minute")
def get_heatmap(
    request: Request,
    user: CurrentUser,
    tenant: TenantCtx,
    start_date: str = Query(
        default=(date.today() - timedelta(days=30)).isoformat(),
        description="Start date (YYYY-MM-DD)",
    ),
    end_date: str = Query(
        default=date.today().isoformat(),
        description="End date (YYYY-MM-DD)",
    ),
) -> HeatmapResponse:
    service = KPIService(supabase=get_supabase_service_client())
    cells = service.get_sales_heatmap(
        tenant_id=tenant.tenant_id,
        start_date=start_date,
        end_date=end_date,
    )
    return HeatmapResponse(
        cells=cells,
        date_range_start=start_date,
        date_range_end=end_date,
    )
