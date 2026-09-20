from datetime import date, timedelta

from fastapi import APIRouter, Query, Request

from app.core.auth import CurrentUser
from app.core.config import settings
from app.core.errors import AkaraHTTPException
from app.core.rate_limit import limiter
from app.core.tenant import TenantCtx, get_supabase_service_client
from app.domain.kpi.cafe_models import (
    CafeChannelResponse,
    CafeDaypartResponse,
    CafeItemsResponse,
    CafeSummaryResponse,
    CafeTrendsResponse,
    DashboardFlags,
    FoodCostAlertResponse,
)
from app.domain.kpi.cafe_service import CafeKPIService
from app.domain.kpi.models import (
    DataBoundsResponse,
    HeatmapResponse,
    KPIResponse,
)
from app.domain.kpi.service import KPIService
from app.infra.schema.discovery import SchemaDiscovery

router = APIRouter(prefix="/kpi", tags=["kpi"])


def _cafe_gate() -> None:
    if not getattr(settings, "cafe_metrics_v2", False):
        raise AkaraHTTPException(
            status_code=404,
            code="CAFE_METRICS_DISABLED",
            message="Café metrics v2 is not enabled.",
        )


def _default_from() -> str:
    return (date.today() - timedelta(days=7)).isoformat()


def _default_to() -> str:
    return date.today().isoformat()


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


@router.get("/flags", response_model=DashboardFlags)
@limiter.limit("60/minute")
def get_dashboard_flags(
    request: Request,
    user: CurrentUser,
    tenant: TenantCtx,
) -> DashboardFlags:
    _ = (user, tenant)
    return DashboardFlags(
        cafe_metrics_v2=bool(getattr(settings, "cafe_metrics_v2", False)),
        new_dashboard=bool(getattr(settings, "new_dashboard", False)),
    )


@router.get("/summary", response_model=CafeSummaryResponse)
@limiter.limit("30/minute")
def get_cafe_summary(
    request: Request,
    user: CurrentUser,
    tenant: TenantCtx,
    from_: str = Query(default=None, alias="from"),
    to: str = Query(default=None),
    location_id: str | None = Query(default=None),
    channel: str | None = Query(default=None),
    category: str | None = Query(default=None),
) -> CafeSummaryResponse:
    _cafe_gate()
    from_date = from_ or _default_from()
    to_date = to or _default_to()
    service = CafeKPIService(supabase=get_supabase_service_client())
    return service.summary(
        tenant.tenant_id,
        from_date,
        to_date,
        location_id=location_id,
        channel=channel,
        category=category,
    )


@router.get("/trends", response_model=CafeTrendsResponse)
@limiter.limit("30/minute")
def get_cafe_trends(
    request: Request,
    user: CurrentUser,
    tenant: TenantCtx,
    from_: str = Query(default=None, alias="from"),
    to: str = Query(default=None),
    location_id: str | None = Query(default=None),
    channel: str | None = Query(default=None),
    category: str | None = Query(default=None),
) -> CafeTrendsResponse:
    _cafe_gate()
    service = CafeKPIService(supabase=get_supabase_service_client())
    return service.trends(
        tenant.tenant_id,
        from_ or _default_from(),
        to or _default_to(),
        location_id=location_id,
        channel=channel,
        category=category,
    )


@router.get("/channel", response_model=CafeChannelResponse)
@limiter.limit("30/minute")
def get_cafe_channel(
    request: Request,
    user: CurrentUser,
    tenant: TenantCtx,
    from_: str = Query(default=None, alias="from"),
    to: str = Query(default=None),
    location_id: str | None = Query(default=None),
    channel: str | None = Query(default=None),
    category: str | None = Query(default=None),
) -> CafeChannelResponse:
    _cafe_gate()
    service = CafeKPIService(supabase=get_supabase_service_client())
    return service.channel(
        tenant.tenant_id,
        from_ or _default_from(),
        to or _default_to(),
        location_id=location_id,
        channel=channel,
        category=category,
    )


@router.get("/daypart", response_model=CafeDaypartResponse)
@limiter.limit("30/minute")
def get_cafe_daypart(
    request: Request,
    user: CurrentUser,
    tenant: TenantCtx,
    from_: str = Query(default=None, alias="from"),
    to: str = Query(default=None),
    location_id: str | None = Query(default=None),
    channel: str | None = Query(default=None),
    category: str | None = Query(default=None),
) -> CafeDaypartResponse:
    _cafe_gate()
    service = CafeKPIService(supabase=get_supabase_service_client())
    return service.daypart(
        tenant.tenant_id,
        from_ or _default_from(),
        to or _default_to(),
        location_id=location_id,
        channel=channel,
        category=category,
    )


@router.get("/items", response_model=CafeItemsResponse)
@limiter.limit("30/minute")
def get_cafe_items(
    request: Request,
    user: CurrentUser,
    tenant: TenantCtx,
    from_: str = Query(default=None, alias="from"),
    to: str = Query(default=None),
    location_id: str | None = Query(default=None),
    channel: str | None = Query(default=None),
    category: str | None = Query(default=None),
) -> CafeItemsResponse:
    _cafe_gate()
    service = CafeKPIService(supabase=get_supabase_service_client())
    return service.items(
        tenant.tenant_id,
        from_ or _default_from(),
        to or _default_to(),
        location_id=location_id,
        channel=channel,
        category=category,
    )


@router.get("/food-cost-alert", response_model=FoodCostAlertResponse)
@limiter.limit("30/minute")
def get_food_cost_alert(
    request: Request,
    user: CurrentUser,
    tenant: TenantCtx,
    from_: str = Query(default=None, alias="from"),
    to: str = Query(default=None),
    location_id: str | None = Query(default=None),
    channel: str | None = Query(default=None),
    category: str | None = Query(default=None),
) -> FoodCostAlertResponse:
    _cafe_gate()
    service = CafeKPIService(supabase=get_supabase_service_client())
    return service.food_cost_alert(
        tenant.tenant_id,
        from_ or _default_from(),
        to or _default_to(),
        location_id=location_id,
        channel=channel,
        category=category,
    )
