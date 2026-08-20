"""Build fallback SELECT queries from schema column roles — no inline hardcoding."""

from app.infra.schema.columns import (
    COL_CITY,
    COL_DATE,
    COL_INVOICE,
    COL_PARTY,
    COL_PRODUCT,
    COL_QUANTITY,
    COL_REVENUE,
    SALES_DATA_TABLE,
)


def top_products_sql(limit: int) -> str:
    return (
        f"SELECT {COL_PRODUCT}, "
        f"SUM({COL_REVENUE}) AS revenue, "
        f"SUM({COL_QUANTITY}) AS quantity "
        f"FROM {SALES_DATA_TABLE} "
        f"WHERE tenant_id = :tenant_id "
        f"AND {COL_DATE} BETWEEN :start_date AND :end_date "
        f"AND {COL_PRODUCT} IS NOT NULL AND {COL_PRODUCT} != '' "
        f"GROUP BY {COL_PRODUCT} "
        f"ORDER BY revenue DESC "
        f"LIMIT {limit}"
    )


def total_revenue_sql() -> str:
    return (
        f"SELECT SUM({COL_REVENUE}) AS total_revenue, "
        f"COUNT(DISTINCT {COL_INVOICE}) AS order_count, "
        f"COUNT(DISTINCT {COL_PARTY}) AS unique_parties "
        f"FROM {SALES_DATA_TABLE} "
        f"WHERE tenant_id = :tenant_id "
        f"AND {COL_DATE} BETWEEN :start_date AND :end_date"
    )


def sales_by_location_sql(limit: int) -> str:
    return (
        f"SELECT {COL_PARTY}, {COL_CITY}, "
        f"SUM({COL_REVENUE}) AS revenue, "
        f"SUM({COL_QUANTITY}) AS quantity "
        f"FROM {SALES_DATA_TABLE} "
        f"WHERE tenant_id = :tenant_id "
        f"AND {COL_DATE} BETWEEN :start_date AND :end_date "
        f"GROUP BY {COL_PARTY}, {COL_CITY} "
        f"ORDER BY revenue DESC "
        f"LIMIT {limit}"
    )
