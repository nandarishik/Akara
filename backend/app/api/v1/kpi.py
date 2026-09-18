from datetime import date, timedelta

from fastapi import APIRouter, Query, Request

from app.core.auth import CurrentUser
from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.tenant import TenantCtx, get_supabase_service_client
from app.domain.kpi.models import (
    DataBoundsResponse,
    HeatmapResponse,
    KPIResponse,
)
from app.domain.kpi.service import KPIService
from app.infra.schema.discovery import SchemaDiscovery

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


def _cafe_metrics_enabled(tenant: TenantCtx) -> bool:
    from app.core.plan_limits import is_feature_enabled

    return bool(is_feature_enabled(tenant.plan, "cafe_metrics_v2", tenant.feature_overrides or {})) or settings.cafe_metrics_v2


def _empty_evidence() -> dict:
    return {
        "order_count": 0,
        "data_range": None,
        "last_import_at": None,
        "last_updated_minutes_ago": None,
        "metric_versions": {"revenue": 1, "food_cost_pct": 1, "aov": 1, "orders": 1},
        "partial": False,
        "partial_message": None,
    }


@router.get("/summary")
@limiter.limit("30/minute")
def cafe_summary(
    request: Request,
    user: CurrentUser,
    tenant: TenantCtx,
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
) -> dict:
    if not _cafe_metrics_enabled(tenant):
        from app.core.errors import AkaraHTTPException
        from fastapi import status as st

        raise AkaraHTTPException(status_code=st.HTTP_403_FORBIDDEN, code="FORBIDDEN", message="Cafe metrics v2 is not enabled")
    day = from_ or date.today().isoformat()
    return {
        "period": {"from": day, "to": to or day, "timezone": "Asia/Kolkata"},
        "evidence": _empty_evidence(),
        "metrics": {
            "revenue": {"value": 0, "currency": "INR", "vs_yesterday": {"value": 0, "change_pct": 0}, "vs_same_day_last_week": {"value": 0, "change_pct": 0}},
            "food_cost_pct": {"value": None, "unit": "percent", "alert": False, "alert_message": None, "threshold": 35.0, "data_quality": "no_expense_data", "setup_cta": "expense_tracking"},
            "orders": {"value": 0},
            "aov": {"value": 0, "currency": "INR"},
        },
    }


@router.get("/food-cost-alert")
@limiter.limit("30/minute")
def food_cost_alert(request: Request, user: CurrentUser, tenant: TenantCtx) -> dict:
    if not _cafe_metrics_enabled(tenant):
        from app.core.errors import AkaraHTTPException
        from fastapi import status as st

        raise AkaraHTTPException(status_code=st.HTTP_403_FORBIDDEN, code="FORBIDDEN", message="Cafe metrics v2 is not enabled")
    return {
        "food_cost_pct": None,
        "threshold": 35.0,
        "alert": False,
        "alert_message": None,
        "evidence": _empty_evidence(),
        "setup_cta": "expense_tracking",
    }


@router.get("/trends")
@limiter.limit("30/minute")
def cafe_trends(
    request: Request,
    user: CurrentUser,
    tenant: TenantCtx,
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
) -> dict:
    if not _cafe_metrics_enabled(tenant):
        from app.core.errors import AkaraHTTPException
        from fastapi import status as st

        raise AkaraHTTPException(status_code=st.HTTP_403_FORBIDDEN, code="FORBIDDEN", message="Cafe metrics v2 is not enabled")
    return {
        "period": {"from": from_ or date.today().isoformat(), "to": to or date.today().isoformat(), "timezone": "Asia/Kolkata"},
        "evidence": _empty_evidence(),
        "series": [],
    }
