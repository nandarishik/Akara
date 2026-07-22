from datetime import date, timedelta

from fastapi import APIRouter, Query

from app.core.auth import CurrentUser
from app.core.tenant import TenantCtx, get_supabase_service_client
from app.services.kpi.models import KPIResponse
from app.services.kpi.service import KPIService

router = APIRouter(prefix="/kpi", tags=["kpi"])


@router.get("/", response_model=KPIResponse)
def get_kpis(
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
