import logging
from collections import defaultdict
from decimal import Decimal
from uuid import UUID

from postgrest.exceptions import APIError
from supabase import Client

from app.domain.kpi.models import (
    HeatmapCell,
    HeatmapResponse,
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
        try:
            result = self._supabase.rpc(
                "get_top_products",
                {
                    "p_tenant_id": str(tenant_id),
                    "p_start_date": start_date,
                    "p_end_date": end_date,
                    "p_limit": _TOP_N,
                },
            ).execute()
        except APIError as exc:
            logger.warning("get_top_products failed: %s", exc)
            return []
        rows = result.data or []
        if not isinstance(rows, list):
            return []
        return [
            TopProduct(
                product_name=row.get("product_name", ""),
                total_revenue=Decimal(str(row.get("revenue", 0))),
                quantity=Decimal(str(row.get("quantity", 0))),
                order_count=int(row.get("orders", 0)),
            )
            for row in rows
        ]

    def get_zone_breakdown(
        self, tenant_id: UUID, start_date: str, end_date: str
    ) -> list[ZoneBreakdown]:
        try:
            result = self._supabase.rpc(
                "get_zone_breakdown",
                {
                    "p_tenant_id": str(tenant_id),
                    "p_start_date": start_date,
                    "p_end_date": end_date,
                },
            ).execute()
        except APIError as exc:
            logger.warning("get_zone_breakdown failed: %s", exc)
            return []
        rows = result.data or []
        if not isinstance(rows, list):
            return []
        total_rev = sum(Decimal(str(r.get("revenue", 0))) for r in rows)
        zones = []
        for row in rows[:_ZONE_LIMIT]:
            rev = Decimal(str(row.get("revenue", 0)))
            pct = float(rev / total_rev * 100) if total_rev else 0.0
            zones.append(
                ZoneBreakdown(
                    zone=row.get("zone", ""),
                    revenue=rev,
                    order_count=int(row.get("orders", 0)),
                    revenue_pct=round(pct, 2),
                )
            )
        return zones

    def get_revenue_trend(
        self, tenant_id: UUID, start_date: str, end_date: str
    ) -> list[RevenueByDate]:
        try:
            result = (
                self._supabase.table("sales_data")
                .select("invoice_date, total_amount, invoice_number")
                .eq("tenant_id", str(tenant_id))
                .gte("invoice_date", start_date)
                .lte("invoice_date", end_date)
                .execute()
            )
        except APIError as exc:
            logger.warning("get_revenue_trend failed: %s", exc)
            return []

        by_date_rev: dict[str, Decimal] = defaultdict(lambda: Decimal(0))
        by_date_orders: dict[str, set[str]] = defaultdict(set)
        for row in result.data or []:
            day = str(row["invoice_date"])
            by_date_rev[day] += Decimal(str(row.get("total_amount") or 0))
            invoice = row.get("invoice_number")
            if invoice:
                by_date_orders[day].add(str(invoice))

        return [
            RevenueByDate(
                invoice_date=day,
                revenue=by_date_rev[day],
                orders=len(by_date_orders[day]),
            )
            for day in sorted(by_date_rev)
        ]

    def get_last_import_at(self, tenant_id: UUID) -> str | None:
        try:
            result = (
                self._supabase.table("import_jobs")
                .select("created_at")
                .eq("tenant_id", str(tenant_id))
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if result.data:
                return str(result.data[0]["created_at"])
        except APIError as exc:
            logger.warning("get_last_import_at failed: %s", exc)

        try:
            result = (
                self._supabase.table("sales_data")
                .select("invoice_date")
                .eq("tenant_id", str(tenant_id))
                .order("invoice_date", desc=True)
                .limit(1)
                .execute()
            )
            if result.data:
                return str(result.data[0]["invoice_date"])
        except APIError as exc:
            logger.warning("get_last_import_at sales_data fallback failed: %s", exc)
        return None

    def get_sales_heatmap(
        self, tenant_id: UUID, start_date: str, end_date: str
    ) -> list[HeatmapCell]:
        try:
            result = self._supabase.rpc(
                "get_sales_heatmap",
                {
                    "p_tenant_id": str(tenant_id),
                    "p_start_date": start_date,
                    "p_end_date": end_date,
                },
            ).execute()
        except APIError as exc:
            logger.warning("get_sales_heatmap failed: %s", exc)
            return []
        rows = result.data or []
        if not isinstance(rows, list):
            return []
        return [
            HeatmapCell(
                zone=row.get("zone", ""),
                product_name=row.get("product_name", ""),
                revenue=Decimal(str(row.get("revenue", 0))),
                order_count=int(row.get("order_count", 0)),
            )
            for row in rows
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
            last_import=self.get_last_import_at(tenant_id),
        )
