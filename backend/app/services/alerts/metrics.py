"""Compute alert metric values for tenant alerts."""

from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal
from uuid import UUID

from app.core.tenant import get_supabase_service_client

logger = logging.getLogger(__name__)

VALID_METRICS = frozenset({
    "secondary_sales_total",
    "primary_sales_total",
    "outstanding_amount",
    "beat_adherence_pct",
})


def _parse_dimension(dimension: str | None) -> tuple[str | None, str | None]:
    if not dimension:
        return None, None
    if ":" not in dimension:
        return None, None
    kind, value = dimension.split(":", 1)
    return kind.strip().lower(), value.strip()


def _sum_column(
    tenant_id: UUID,
    table: str,
    amount_col: str,
    date_col: str | None = None,
    dimension: str | None = None,
) -> Decimal:
    supa = get_supabase_service_client()
    query = supa.table(table).select(amount_col).eq("tenant_id", str(tenant_id))
    dim_kind, dim_value = _parse_dimension(dimension)
    if dim_kind == "zone" and dim_value:
        query = query.eq("party_zone", dim_value)
    elif dim_kind == "route" and dim_value:
        query = query.eq("route", dim_value)
    elif dim_kind == "party" and dim_value:
        query = query.eq("party_name", dim_value)

    if date_col:
        month_start = date.today().replace(day=1).isoformat()
        query = query.gte(date_col, month_start)

    result = query.execute()
    rows = result.data or []
    total = Decimal("0")
    for row in rows:
        val = row.get(amount_col)
        if val is not None:
            total += Decimal(str(val))
    return total


def get_metric_value(tenant_id: UUID, metric: str, dimension: str | None = None) -> Decimal:
    if metric == "secondary_sales_total":
        return _sum_column(
            tenant_id, "secondary_sales_data", "total_amount", "invoice_date", dimension
        )
    if metric == "primary_sales_total":
        return _sum_column(
            tenant_id, "sales_data", "total_amount", "invoice_date", dimension
        )
    if metric == "outstanding_amount":
        return _sum_column(
            tenant_id, "sales_data", "outstanding_amount", None, dimension
        )
    if metric == "beat_adherence_pct":
        supa = get_supabase_service_client()
        try:
            rpc = supa.rpc(
                "get_route_performance",
                {"p_tenant_id": str(tenant_id)},
            ).execute()
            rows = rpc.data or []
            if not rows:
                return Decimal("0")
            adherent = sum(1 for r in rows if r.get("is_adherent"))
            return Decimal(str(round(100 * adherent / len(rows), 2)))
        except Exception as exc:
            logger.warning("beat_adherence_pct unavailable: %s", exc)
            return Decimal("0")
    raise ValueError(f"Unknown metric: {metric}")


def check_condition(current: Decimal, condition: str, threshold: Decimal) -> bool:
    if condition == "below":
        return current < threshold
    if condition == "above":
        return current > threshold
    return current == threshold
