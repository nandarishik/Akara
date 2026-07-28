from decimal import Decimal

from pydantic import BaseModel


class KPISummary(BaseModel):
    total_revenue: Decimal
    total_orders: int
    unique_parties: int
    avg_order_value: Decimal
    total_quantity: Decimal
    total_discount: Decimal


class TopProduct(BaseModel):
    product_name: str
    total_revenue: Decimal
    quantity: Decimal
    order_count: int


class ZoneBreakdown(BaseModel):
    zone: str
    revenue: Decimal
    order_count: int
    revenue_pct: float


class RevenueByDate(BaseModel):
    invoice_date: str
    revenue: Decimal
    orders: int


class KPIResponse(BaseModel):
    summary: KPISummary
    top_products: list[TopProduct]
    zone_breakdown: list[ZoneBreakdown]
    revenue_trend: list[RevenueByDate]
    date_range_start: str
    date_range_end: str
    last_import: str | None = None


class DataBoundsResponse(BaseModel):
    start: str | None = None
    end: str | None = None
