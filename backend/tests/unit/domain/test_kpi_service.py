from collections import defaultdict
from decimal import Decimal
from uuid import uuid4

from app.domain.kpi.service import KPIService


class _FakeResult:
    def __init__(self, data):
        self.data = data


class _FakeTableQuery:
    def __init__(self, rows):
        self._rows = rows

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def gte(self, *_args, **_kwargs):
        return self

    def lte(self, *_args, **_kwargs):
        return self

    def execute(self):
        return _FakeResult(self._rows)


class _FakeRpcQuery:
    def __init__(self, data):
        self._data = data

    def execute(self):
        return _FakeResult(self._data)


class _FakeSupabase:
    def __init__(self, *, rpc_data=None, table_rows=None):
        self._rpc_data = rpc_data or {}
        self._table_rows = table_rows or []

    def rpc(self, name, _params):
        return _FakeRpcQuery(self._rpc_data.get(name))

    def table(self, name):
        assert name == "sales_data"
        return _FakeTableQuery(self._table_rows)


def test_get_top_products_maps_rpc_fields() -> None:
    supabase = _FakeSupabase(
        rpc_data={
            "get_top_products": [
                {
                    "product_name": "Paneer Tikka",
                    "revenue": 1200.5,
                    "quantity": 40,
                    "orders": 12,
                }
            ]
        }
    )
    service = KPIService(supabase=supabase)  # type: ignore[arg-type]
    products = service.get_top_products(uuid4(), "2025-12-01", "2025-12-07")
    assert len(products) == 1
    assert products[0].product_name == "Paneer Tikka"
    assert products[0].total_revenue == Decimal("1200.5")
    assert products[0].order_count == 12


def test_get_zone_breakdown_computes_revenue_pct() -> None:
    supabase = _FakeSupabase(
        rpc_data={
            "get_zone_breakdown": [
                {"zone": "North", "revenue": 75, "orders": 3},
                {"zone": "South", "revenue": 25, "orders": 1},
            ]
        }
    )
    service = KPIService(supabase=supabase)  # type: ignore[arg-type]
    zones = service.get_zone_breakdown(uuid4(), "2025-12-01", "2025-12-07")
    assert zones[0].zone == "North"
    assert zones[0].revenue_pct == 75.0
    assert zones[1].revenue_pct == 25.0


def test_get_revenue_trend_aggregates_by_date() -> None:
    supabase = _FakeSupabase(
        table_rows=[
            {
                "invoice_date": "2025-12-01",
                "total_amount": 100,
                "invoice_number": "A1",
            },
            {
                "invoice_date": "2025-12-01",
                "total_amount": 50,
                "invoice_number": "A2",
            },
            {
                "invoice_date": "2025-12-02",
                "total_amount": 200,
                "invoice_number": "B1",
            },
        ]
    )
    service = KPIService(supabase=supabase)  # type: ignore[arg-type]
    trend = service.get_revenue_trend(uuid4(), "2025-12-01", "2025-12-07")
    assert len(trend) == 2
    assert trend[0].invoice_date == "2025-12-01"
    assert trend[0].revenue == Decimal("150")
    assert trend[0].orders == 2
    assert trend[1].revenue == Decimal("200")
