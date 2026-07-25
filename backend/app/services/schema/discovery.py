import logging
from datetime import date
from uuid import UUID

from supabase import Client

from app.services.schema.columns import (
    COMPANION_DATA_COLUMNS,
    COMPANION_DATA_TABLE,
    SALES_DATA_COLUMNS,
)

logger = logging.getLogger(__name__)


class SchemaDiscovery:
    """Discovers available columns and their distinct values for a tenant.

    Used to build dynamic prompts for the copilot.
    """

    def __init__(self, supabase: Client | None) -> None:
        self._supabase = supabase

    def get_columns(self) -> list[str]:
        return list(SALES_DATA_COLUMNS)

    def get_distinct_values(
        self, tenant_id: UUID, column: str, limit: int = 50
    ) -> list[str]:
        if column not in SALES_DATA_COLUMNS:
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

    def get_companion_dataset_types(self, tenant_id: UUID, limit: int = 20) -> list[str]:
        if self._supabase is None:
            return []
        try:
            result = (
                self._supabase.table("tenant_companion_data")
                .select("dataset_type")
                .eq("tenant_id", str(tenant_id))
                .limit(limit * 5)
                .execute()
            )
            seen: set[str] = set()
            types: list[str] = []
            for row in result.data or []:
                dt = str(row.get("dataset_type", ""))
                if dt and dt not in seen:
                    seen.add(dt)
                    types.append(dt)
            return types[:limit]
        except Exception as exc:
            logger.warning("Could not get companion dataset types: %s", exc)
            return []

    def get_raw_data_keys(self, tenant_id: UUID, limit: int = 15) -> list[str]:
        if self._supabase is None:
            return []
        try:
            result = (
                self._supabase.table("sales_data")
                .select("raw_data")
                .eq("tenant_id", str(tenant_id))
                .not_.is_("raw_data", "null")
                .limit(50)
                .execute()
            )
            seen: set[str] = set()
            keys: list[str] = []
            for row in result.data or []:
                rd = row.get("raw_data") or {}
                if isinstance(rd, dict):
                    for k in rd:
                        if k and k not in seen:
                            seen.add(k)
                            keys.append(k)
            return keys[:limit]
        except Exception as exc:
            logger.warning("Could not sample raw_data keys: %s", exc)
            return []

    def get_data_date_range(self, tenant_id: UUID) -> tuple[str, str] | None:
        """Return min/max invoice_date for tenant data, if any rows exist."""
        if self._supabase is None:
            return None
        try:
            min_result = (
                self._supabase.table("sales_data")
                .select("invoice_date")
                .eq("tenant_id", str(tenant_id))
                .order("invoice_date")
                .limit(1)
                .execute()
            )
            max_result = (
                self._supabase.table("sales_data")
                .select("invoice_date")
                .eq("tenant_id", str(tenant_id))
                .order("invoice_date", desc=True)
                .limit(1)
                .execute()
            )
            min_rows = min_result.data or []
            max_rows = max_result.data or []
            if not min_rows or not max_rows:
                return None
            return str(min_rows[0]["invoice_date"]), str(max_rows[0]["invoice_date"])
        except Exception as exc:
            logger.warning("Could not get data date range: %s", exc)
            return None

    def get_allowed_vocabulary(self, tenant_id: UUID) -> list[str]:
        """Distinct column values usable by premise_check (channels, products, etc.)."""
        terms: list[str] = []
        seen: set[str] = set()
        for column in ("route", "product_category", "product_group", "party_name", "product_name"):
            for value in self.get_distinct_values(tenant_id, column, limit=30):
                key = value.lower()
                if key and key not in seen:
                    seen.add(key)
                    terms.append(key)
        for dt in self.get_companion_dataset_types(tenant_id):
            key = dt.lower()
            if key not in seen:
                seen.add(key)
                terms.append(key)
        return terms

    def get_schema_context(self, tenant_id: UUID) -> str:
        """Builds a schema context string for LLM prompts."""
        zones = self.get_distinct_values(tenant_id, "party_zone", limit=20)
        categories = self.get_distinct_values(tenant_id, "product_category", limit=20)
        routes = self.get_distinct_values(tenant_id, "route", limit=20)
        groups = self.get_distinct_values(tenant_id, "product_group", limit=15)
        products = self.get_distinct_values(tenant_id, "product_name", limit=10)
        parties = self.get_distinct_values(tenant_id, "party_name", limit=10)
        raw_keys = self.get_raw_data_keys(tenant_id)
        companion_types = self.get_companion_dataset_types(tenant_id)
        data_range = self.get_data_date_range(tenant_id)
        range_line = (
            f"Actual data in database: {data_range[0]} to {data_range[1]}\n"
            if data_range
            else "Actual data in database: none yet\n"
        )
        channel_line = (
            f"Known sales channels (route column): {', '.join(routes)}\n"
            if routes
            else ""
        )
        group_line = (
            f"Known product groups (imports map Category/Line Type here): {', '.join(groups)}\n"
            if groups
            else "Note: product_category is often empty — use product_group for parts/labour/category filters.\n"
        )
        raw_line = (
            f"Extra fields in raw_data JSONB: {', '.join(raw_keys)}\n"
            if raw_keys
            else ""
        )
        companion_line = ""
        if companion_types:
            companion_line = (
                f"Table: {COMPANION_DATA_TABLE}\n"
                f"Columns: {', '.join(COMPANION_DATA_COLUMNS)}\n"
                f"Available dataset_type values: {', '.join(companion_types)}\n"
                f"Use for cross-file metrics (wastage, shifts, referrals, vendor, estimates, insurance).\n"
            )
        return (
            f"Table: public.sales_data\n"
            f"Columns: {', '.join(SALES_DATA_COLUMNS)}\n"
            f"{range_line}"
            f"Semantic aliases (user terms → columns):\n"
            f"  - order channel / dine-in / delivery / aggregator / OTC / insurance → route\n"
            f"  - parts / labour / spare / line type → product_group (NOT product_category)\n"
            f"  - menu item / medicine / spare part / service line → product_name\n"
            f"  - bill / order / invoice / job → invoice_number (use COUNT DISTINCT for order counts)\n"
            f"  - customer / patient / vehicle owner → party_name\n"
            f"  - cashier / pharmacist / mechanic → raw_data->>'key' if listed below\n"
            f"{channel_line}"
            f"{group_line}"
            f"{raw_line}"
            f"{companion_line}"
            f"Sample products: {', '.join(products) if products else 'none'}\n"
            f"Sample parties/locations: {', '.join(parties) if parties else 'none'}\n"
            f"Known zones: {', '.join(zones) if zones else 'none'}\n"
            f"Known categories: {', '.join(categories) if categories else 'none'}\n"
            f"Revenue: prefer COALESCE(net_amount, total_amount). Always filter: WHERE tenant_id = :tenant_id AND use :start_date / :end_date"
        )
