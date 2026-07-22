"""Canonical sales_data column and table names — single source of truth."""

SALES_DATA_TABLE = "public.sales_data"

SALES_DATA_COLUMNS: tuple[str, ...] = (
    "invoice_date",
    "invoice_number",
    "party_name",
    "party_city",
    "party_zone",
    "route",
    "product_name",
    "product_group",
    "product_category",
    "hsn_code",
    "quantity",
    "gross_amount",
    "discount_amount",
    "net_amount",
    "tax_amount",
    "total_amount",
)

# Semantic roles mapped to physical columns (used by fallback query builder).
COL_DATE = "invoice_date"
COL_INVOICE = "invoice_number"
COL_PARTY = "party_name"
COL_CITY = "party_city"
COL_ZONE = "party_zone"
COL_PRODUCT = "product_name"
COL_QUANTITY = "quantity"
COL_REVENUE = "total_amount"

DEFAULT_RESULT_LIMIT = 10
MAX_RESULT_LIMIT = 50
