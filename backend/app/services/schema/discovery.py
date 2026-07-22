import logging
from uuid import UUID

from supabase import Client

logger = logging.getLogger(__name__)

_SALES_DATA_COLUMNS = [
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
]


class SchemaDiscovery:
    """Discovers available columns and their distinct values for a tenant.

    Used to build dynamic prompts for the copilot.
    """

    def __init__(self, supabase: Client | None) -> None:
        self._supabase = supabase

    def get_columns(self) -> list[str]:
        return list(_SALES_DATA_COLUMNS)

    def get_distinct_values(
        self, tenant_id: UUID, column: str, limit: int = 50
    ) -> list[str]:
        if column not in _SALES_DATA_COLUMNS:
            raise ValueError(f"Column '{column}' is not in the allowed schema")
        if self._supabase is None:
            return []
        try:
            result = (
                self._supabase.table("sales_data")
                .select(column)
                .eq("tenant_id", str(tenant_id))
                .not_.is_(column, "null")
                .limit(limit)
                .execute()
            )
            seen: set[str] = set()
            values: list[str] = []
            for row in result.data or []:
                v = str(row.get(column, ""))
                if v and v not in seen:
                    seen.add(v)
                    values.append(v)
            return values
        except Exception as exc:
            logger.warning("Could not get distinct values for %s: %s", column, exc)
            return []

    def get_schema_context(self, tenant_id: UUID) -> str:
        """Builds a schema context string for LLM prompts."""
        zones = self.get_distinct_values(tenant_id, "party_zone", limit=20)
        categories = self.get_distinct_values(tenant_id, "product_category", limit=20)
        return (
            f"Table: public.sales_data\n"
            f"Columns: {', '.join(_SALES_DATA_COLUMNS)}\n"
            f"Known zones: {', '.join(zones) if zones else 'unknown'}\n"
            f"Known categories: {', '.join(categories) if categories else 'unknown'}\n"
            f"Always filter: WHERE tenant_id = :tenant_id"
        )
