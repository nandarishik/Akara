import logging
from decimal import Decimal
from uuid import UUID

from supabase import Client

from app.services.kpi.models import (
    KPIResponse,
    KPISummary,
    RevenueByDate,
    TopProduct,
    ZoneBreakdown,
)

logger = logging.getLogger(__name__)

_TOP_N = 10
_ZONE_LIMIT = 20


class KPIService:
    """Computes all KPI metrics for a given tenant and date range.

    Uses direct Supabase queries (RLS enforced by service role + tenant filter).
    """

    def __init__(self, supabase: Client) -> None:
        self._supabase = supabase

    def get_summary(
        self, tenant_id: UUID, start_date: str, end_date: str
    ) -> KPISummary:
        result = self._supabase.rpc(
            "get_kpi_summary",
            {
                "p_tenant_id": str(tenant_id),
                "p_start_date": start_date,
                "p_end_date": end_date,
            },
        ).execute()
        data = result.data or {}
        return KPISummary(
            total_revenue=Decimal(str(data.get("total_revenue", 0))),
            total_orders=int(data.get("total_orders", 0)),
            unique_parties=int(data.get("unique_parties", 0)),
            avg_order_value=Decimal(str(data.get("avg_order_value", 0))),
            total_quantity=Decimal(str(data.get("total_quantity", 0))),
            total_discount=Decimal(str(data.get("total_discount", 0))),
        )

    def get_top_products(
        self, tenant_id: UUID, start_date: str, end_date: str
    ) -> list[TopProduct]:
        result = (
            self._supabase.table("sales_data")
            .select(
                "product_name, total_amount.sum(), quantity.sum(), invoice_number.count()"
            )
            .eq("tenant_id", str(tenant_id))
            .gte("invoice_date", start_date)
            .lte("invoice_date", end_date)
            .order("total_amount", desc=True)
            .limit(_TOP_N)
            .execute()
        )
        return [
            TopProduct(
                product_name=row.get("product_name", ""),
                total_revenue=Decimal(str(row.get("total_amount", 0))),
                quantity=Decimal(str(row.get("quantity", 0))),
                order_count=int(row.get("invoice_number", 0)),
            )
            for row in (result.data or [])
        ]

    def get_zone_breakdown(
        self, tenant_id: UUID, start_date: str, end_date: str
    ) -> list[ZoneBreakdown]:
        result = (
            self._supabase.table("sales_data")
            .select("party_zone, total_amount.sum(), invoice_number.count()")
            .eq("tenant_id", str(tenant_id))
            .gte("invoice_date", start_date)
            .lte("invoice_date", end_date)
            .not_.is_("party_zone", "null")
            .order("total_amount", desc=True)
            .limit(_ZONE_LIMIT)
            .execute()
        )
        rows = result.data or []
        total_rev = sum(Decimal(str(r.get("total_amount", 0))) for r in rows)
        zones = []
        for row in rows:
            rev = Decimal(str(row.get("total_amount", 0)))
            pct = float(rev / total_rev * 100) if total_rev else 0.0
            zones.append(
                ZoneBreakdown(
                    zone=row.get("party_zone", ""),
                    revenue=rev,
                    order_count=int(row.get("invoice_number", 0)),
                    revenue_pct=round(pct, 2),
                )
            )
        return zones

    def get_revenue_trend(
        self, tenant_id: UUID, start_date: str, end_date: str
    ) -> list[RevenueByDate]:
        result = (
            self._supabase.table("sales_data")
            .select("invoice_date, total_amount.sum(), invoice_number.count()")
            .eq("tenant_id", str(tenant_id))
            .gte("invoice_date", start_date)
            .lte("invoice_date", end_date)
            .order("invoice_date")
            .execute()
        )
        return [
            RevenueByDate(
                invoice_date=row["invoice_date"],
                revenue=Decimal(str(row.get("total_amount", 0))),
                orders=int(row.get("invoice_number", 0)),
            )
            for row in (result.data or [])
        ]

    def get_all(
        self, tenant_id: UUID, start_date: str, end_date: str
    ) -> KPIResponse:
        return KPIResponse(
            summary=self.get_summary(tenant_id, start_date, end_date),
            top_products=self.get_top_products(tenant_id, start_date, end_date),
            zone_breakdown=self.get_zone_breakdown(tenant_id, start_date, end_date),
            revenue_trend=self.get_revenue_trend(tenant_id, start_date, end_date),
            date_range_start=start_date,
            date_range_end=end_date,
        )
