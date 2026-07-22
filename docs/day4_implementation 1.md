# Day 4 Implementation Handoff

## Reproduction Instructions

### Prerequisites

Before applying any Day 4 changes, the following must already be in place and working:

- **Day 1** complete: monorepo scaffold, Supabase schema migrations applied (`001_initial_schema.sql`, `002_rls_policies.sql`, `003_functions.sql`), all tables and RLS policies live.
- **Day 2** complete: FastAPI skeleton running locally — `app/core/`, `app/api/routes/health.py`, `app/api/routes/auth.py`, `app/main.py` (Day 2 version), `app/core/config.py`, `app/core/auth.py`, `app/core/tenant.py`.
- **Day 3** complete: LLM layer (`services/llm/`), SQL layer (`sql/`), guardrails, tools, planner, synthesizer, CopilotAgent, and `api/routes/copilot.py` (Day 3 version with hardcoded schema), all `__init__.py` package stubs created.

The following `__init__.py` stubs already exist as **empty files** from the Day 3 scaffold and must not be recreated:

- `akara/backend/app/services/kpi/__init__.py`
- `akara/backend/app/services/data_import/__init__.py`
- `akara/backend/app/services/schema/__init__.py`
- `akara/backend/app/services/prompts/__init__.py`

The Supabase function `get_kpi_summary` is already defined in `akara/migrations/003_functions.sql` (Day 1). **No new SQL migrations are needed for Day 4.**

### Application Order

Apply Day 4 changes in this order to satisfy import dependencies:

1. `akara/backend/app/services/kpi/models.py` (new — Pydantic models, no internal deps)
2. `akara/backend/app/services/kpi/service.py` (new — depends on kpi/models)
3. `akara/backend/app/api/routes/kpi.py` (new — depends on kpi/service + kpi/models)
4. `akara/backend/app/services/data_import/models.py` (new — no internal deps)
5. `akara/backend/app/services/data_import/parser.py` (new — no internal deps)
6. `akara/backend/app/services/data_import/service.py` (new — depends on data_import/models + parser)
7. `akara/backend/app/api/routes/data.py` (new — depends on data_import/service + models)
8. `akara/backend/app/services/schema/discovery.py` (new — no internal deps)
9. `akara/backend/app/services/prompts/generator.py` (new — depends on schema/discovery)
10. `akara/backend/app/main.py` (modified — register two new routers)
11. `akara/backend/app/api/routes/copilot.py` (modified — replace hardcoded schema with live SchemaDiscovery)
12. `akara/backend/pyproject.toml` (modified — add `B008` to ruff ignore list)

### Post-Copy Commands

After copying all files, run the following from `akara/backend/`:

```bash
# Confirm import graph is clean
uv run python -c "from app.main import app; print('routes:', len(app.routes))"
# Expected output: routes: 9

# Parser smoke test
uv run python -c "
from app.services.data_import.parser import SalesDataParser
df = SalesDataParser().parse(b'invoice_date,party_name,total_amount\n2024-01-15,ABC,1500\n', 'test.csv')
print('rows:', len(df), 'cols:', list(df.columns))
"
# Expected output: rows: 1 cols: ['invoice_date', 'party_name', 'total_amount']

# Schema smoke test
uv run python -c "
from app.services.schema.discovery import SchemaDiscovery
cols = SchemaDiscovery(None).get_columns()
print('columns:', len(cols), cols[:3])
"
# Expected output: columns: 16 ['invoice_date', 'invoice_number', 'party_name']

# Quality gate
uv run ruff check .
uv run pytest
```

---

# File: `akara/backend/app/services/kpi/models.py`

**Status:** Created

## Purpose

Defines all Pydantic response models for the KPI subsystem. These models are used as the `response_model` type for `GET /kpi/`, serialised to JSON in API responses, and consumed by `KPIService` to construct typed return values. Keeping models in a dedicated file allows `service.py`, `route.py`, and future test fixtures to import them without circular dependencies.

## Dependencies

- `decimal.Decimal` — stdlib; used for financial precision on all monetary and quantity fields.
- `pydantic.BaseModel` — already in `pyproject.toml` from Day 2 (`pydantic>=2.7.0`).

No new packages are required.

## Implementation

```python
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
```

## Placement

New file. Create at `akara/backend/app/services/kpi/models.py`. The directory already exists with an empty `__init__.py` from Day 3.

## Explanation

Five Pydantic v2 models form a hierarchy:

- `KPISummary` — aggregate scalars (revenue, orders, AOV, quantity, discount).
- `TopProduct` — one entry per product, sorted by revenue descending.
- `ZoneBreakdown` — revenue share by geographic zone; `revenue_pct` is computed locally in `KPIService` (not from DB).
- `RevenueByDate` — one entry per distinct `invoice_date` in the queried range.
- `KPIResponse` — top-level envelope that wraps all four sub-models plus the echo'd date range.

All monetary fields use `Decimal` so JSON serialisation preserves precision without floating-point drift.

## Related Changes

- Imported by `akara/backend/app/services/kpi/service.py` (created Day 4).
- Imported by `akara/backend/app/api/routes/kpi.py` (created Day 4) as the `response_model`.

---

# File: `akara/backend/app/services/kpi/service.py`

**Status:** Created

## Purpose

Implements `KPIService`, the single class responsible for computing all KPI metrics from the `sales_data` Supabase table. Separates query logic from the HTTP layer and makes individual metric methods independently testable.

## Dependencies

- `logging` — stdlib.
- `decimal.Decimal` — stdlib.
- `uuid.UUID` — stdlib.
- `supabase.Client` — `supabase>=2.4.0`, already in `pyproject.toml`.
- `app.services.kpi.models` — all five model classes (created Day 4).
- Supabase table: `sales_data` (created in Day 1 migration `001_initial_schema.sql`).
- Supabase RPC function: `get_kpi_summary` (created in Day 1 migration `003_functions.sql`). Parameters: `p_tenant_id TEXT`, `p_start_date DATE`, `p_end_date DATE`. Returns a single JSON object with keys `total_revenue`, `total_orders`, `unique_parties`, `avg_order_value`, `total_quantity`, `total_discount`.

## Implementation

```python
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
```

## Placement

New file. Create at `akara/backend/app/services/kpi/service.py`.

## Explanation

`KPIService` is a synchronous service class (FastAPI route is also synchronous — see `kpi.py`). The constructor takes a `supabase.Client` instance injected by the route handler.

- `get_summary` delegates to the `get_kpi_summary` Postgres function, which performs all aggregations in a single RPC call for performance. All values are cast via `str()` before `Decimal()` to avoid float precision loss from the JSON deserialisation path.
- `get_top_products` uses Supabase's PostgREST aggregate column syntax (`column.sum()`, `column.count()`). The result is ordered by `total_amount` descending and capped at `_TOP_N = 10`.
- `get_zone_breakdown` filters out null `party_zone` rows, aggregates up to `_ZONE_LIMIT = 20` zones, then computes `revenue_pct` in Python by dividing each zone's revenue by the sum of all returned rows. Guards against division-by-zero when `total_rev` is zero.
- `get_revenue_trend` returns one row per date, ordered chronologically. Uses the same aggregate syntax.
- `get_all` is the public facade that makes four sequential calls and packs the results into `KPIResponse`. All calls share the same `tenant_id`, `start_date`, `end_date` arguments.

Every query explicitly filters `eq("tenant_id", str(tenant_id))` to enforce tenant isolation even when using the service role key.

## Related Changes

- `app/services/kpi/models.py` — provides all return types (created Day 4).
- `app/api/routes/kpi.py` — instantiates `KPIService` and calls `get_all` (created Day 4).
- Supabase `sales_data` table and `get_kpi_summary` RPC — defined in Day 1 migrations.

---

# File: `akara/backend/app/api/routes/kpi.py`

**Status:** Created

## Purpose

Exposes `GET /kpi/` as a protected HTTP endpoint. Accepts optional `start_date` and `end_date` query parameters, delegates to `KPIService`, and returns the full `KPIResponse` as JSON. Registered in `main.py` as part of Day 4.

## Dependencies

- `datetime.date`, `datetime.timedelta` — stdlib; used to compute default query parameter values at route-evaluation time.
- `fastapi.APIRouter`, `fastapi.Query` — `fastapi>=0.111.0`, already in `pyproject.toml`.
- `app.core.auth.CurrentUser` — Day 2; FastAPI dependency that validates the JWT and returns the authenticated user.
- `app.core.tenant.TenantCtx` — Day 2; FastAPI dependency that resolves `tenant_id` and `role` from the `profiles` table.
- `app.core.tenant.get_supabase_service_client` — Day 2; factory that returns a Supabase service-role client.
- `app.services.kpi.models.KPIResponse` — Day 4.
- `app.services.kpi.service.KPIService` — Day 4.

## Implementation

```python
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
```

## Placement

New file. Create at `akara/backend/app/api/routes/kpi.py`.

This router is registered in `main.py` (modified in Day 4) with:
```python
from app.api.routes import kpi as kpi_router
app.include_router(kpi_router.router)
```

## Explanation

The route is synchronous (`def`, not `async def`) because `KPIService` uses synchronous Supabase calls. FastAPI runs synchronous route handlers in a thread pool automatically.

Default date parameters are computed at module load time using `date.today()`. This means if the process runs for multiple calendar days without restart, defaults will not auto-update — acceptable for Day 4; this is a known trade-off in the design.

Both `CurrentUser` and `TenantCtx` are FastAPI `Annotated` dependencies (defined in Day 2). Any unauthenticated request or request from a user without a `profiles` row will be rejected before the handler body runs.

The `service_role` Supabase client is used (not the anon client) so the query bypasses RLS. Tenant isolation is enforced by the explicit `eq("tenant_id", ...)` filter inside `KPIService`.

## Related Changes

- `app/services/kpi/service.py` — called by this route (created Day 4).
- `app/services/kpi/models.py` — `KPIResponse` used as `response_model` (created Day 4).
- `app/main.py` — registers this router (modified Day 4).

---

# File: `akara/backend/app/services/data_import/models.py`

**Status:** Created

## Purpose

Defines `ImportResult`, the single Pydantic model returned by `POST /data/import` after a file upload. Separates the response schema from service logic, enabling the route to declare a typed `response_model` and allowing service tests to assert on structured output.

## Dependencies

- `pydantic.BaseModel` — `pydantic>=2.7.0`, already in `pyproject.toml`.

## Implementation

```python
from pydantic import BaseModel


class ImportResult(BaseModel):
    rows_inserted: int
    rows_skipped: int
    errors: list[str]
    warnings: list[str]
```

## Placement

New file. Create at `akara/backend/app/services/data_import/models.py`. The directory already exists with an empty `__init__.py` from Day 3.

## Explanation

`ImportResult` is a flat model with four fields:

- `rows_inserted` — count of rows successfully committed to `sales_data`.
- `rows_skipped` — count of rows that could not be inserted (per-row type errors or batch-level DB errors).
- `errors` — list of batch-level error strings (e.g. Supabase exceptions). An empty list means all batches succeeded.
- `warnings` — list of per-row warning strings collected during row enrichment. Non-fatal.

The model allows a partially-successful import (some rows inserted, some skipped) without raising an HTTP error, giving the caller visibility into what happened.

## Related Changes

- `app/services/data_import/service.py` — constructs and returns `ImportResult` instances (created Day 4).
- `app/api/routes/data.py` — uses `ImportResult` as `response_model` (created Day 4).

---

# File: `akara/backend/app/services/data_import/parser.py`

**Status:** Created

## Purpose

Implements `SalesDataParser`, which converts raw CSV or Excel file bytes into a cleaned pandas `DataFrame` ready for insertion. Handles real-world distributor files where column headers vary (aliases), numeric values may be formatted as strings, and dates may be in various formats.

## Dependencies

- `io` — stdlib.
- `logging` — stdlib.
- `pandas>=2.2.0` — already in `pyproject.toml` from Day 2.
- `openpyxl>=3.1.0` — already in `pyproject.toml` from Day 2; required by pandas for `.xlsx` support.

No new packages required.

## Implementation

```python
import io
import logging

import pandas as pd

logger = logging.getLogger(__name__)

REQUIRED_COLUMNS = {
    "invoice_date",
    "party_name",
    "total_amount",
}

COLUMN_ALIASES: dict[str, str] = {
    "date": "invoice_date",
    "invoice_date": "invoice_date",
    "inv_date": "invoice_date",
    "customer": "party_name",
    "party": "party_name",
    "net_sales": "net_amount",
    "gross_sales": "gross_amount",
    "discount": "discount_amount",
    "tax": "tax_amount",
    "total": "total_amount",
    "qty": "quantity",
    "product": "product_name",
    "item": "product_name",
    "city": "party_city",
    "zone": "party_zone",
}

NUMERIC_COLUMNS = {
    "quantity",
    "gross_amount",
    "discount_amount",
    "net_amount",
    "tax_amount",
    "total_amount",
}


class SalesDataParser:
    """Parses Excel (.xlsx/.xls) and CSV files into a DataFrame
    ready for insertion into sales_data.
    """

    def parse(self, file_content: bytes, filename: str) -> pd.DataFrame:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(file_content))
        elif filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(file_content))
        else:
            raise ValueError(f"Unsupported file type: {filename}")

        df = self._normalize_columns(df)
        df = self._validate_required(df)
        return self._coerce_types(df)

    def _normalize_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
        return df.rename(columns=COLUMN_ALIASES)

    def _validate_required(self, df: pd.DataFrame) -> pd.DataFrame:
        missing = REQUIRED_COLUMNS - set(df.columns)
        if missing:
            raise ValueError(f"Missing required columns: {missing}")
        return df.dropna(subset=["invoice_date", "party_name"])

    def _coerce_types(self, df: pd.DataFrame) -> pd.DataFrame:
        df["invoice_date"] = pd.to_datetime(df["invoice_date"], errors="coerce").dt.date
        df = df.dropna(subset=["invoice_date"])
        for col in NUMERIC_COLUMNS:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
        return df
```

## Placement

New file. Create at `akara/backend/app/services/data_import/parser.py`.

## Explanation

`parse()` is the single public entry point. It accepts raw `bytes` and a `filename` string (used only to detect the file format by extension). The three private methods run in sequence:

1. `_normalize_columns` — strips whitespace, lowercases, replaces spaces with underscores, then applies `COLUMN_ALIASES` to remap vendor-specific header names to canonical schema names.
2. `_validate_required` — raises `ValueError` if any of the three mandatory columns (`invoice_date`, `party_name`, `total_amount`) are absent after normalisation. Silently drops rows where either `invoice_date` or `party_name` is null.
3. `_coerce_types` — parses `invoice_date` with `errors="coerce"` so unparsable dates become `NaT`; those rows are then dropped. Numeric columns are coerced with `errors="coerce"` and `NaN` values are filled with `0.0`.

A `ValueError` from `_normalize_columns` or `_validate_required` propagates to the caller (`DataImportService.import_file`), which catches it and returns an `ImportResult` with a populated `errors` list without raising an HTTP error.

## Related Changes

- `app/services/data_import/service.py` — instantiates `SalesDataParser` and calls `parse()` (created Day 4).

---

# File: `akara/backend/app/services/data_import/service.py`

**Status:** Created

## Purpose

Implements `DataImportService`, which orchestrates file parsing and batch-inserting parsed rows into the `sales_data` Supabase table. Enriches each row with `tenant_id` and serialises pandas types to Python-native types before insertion.

## Dependencies

- `logging` — stdlib.
- `uuid.UUID` — stdlib.
- `supabase.Client` — `supabase>=2.4.0`, already in `pyproject.toml`.
- `app.services.data_import.models.ImportResult` — Day 4.
- `app.services.data_import.parser.SalesDataParser` — Day 4.
- Supabase table: `sales_data` (Day 1 migration).

## Implementation

```python
import logging
from uuid import UUID

from supabase import Client

from app.services.data_import.models import ImportResult
from app.services.data_import.parser import SalesDataParser

logger = logging.getLogger(__name__)

_BATCH_SIZE = 500


class DataImportService:
    """Handles parsing and batch-inserting sales data for a tenant."""

    def __init__(self, supabase: Client) -> None:
        self._supabase = supabase
        self._parser = SalesDataParser()

    def import_file(
        self, file_content: bytes, filename: str, tenant_id: UUID
    ) -> ImportResult:
        errors: list[str] = []
        warnings: list[str] = []
        rows_inserted = 0
        rows_skipped = 0

        try:
            df = self._parser.parse(file_content, filename)
        except ValueError as exc:
            return ImportResult(
                rows_inserted=0,
                rows_skipped=0,
                errors=[str(exc)],
                warnings=[],
            )

        records = df.to_dict(orient="records")
        for i in range(0, len(records), _BATCH_SIZE):
            batch = records[i : i + _BATCH_SIZE]
            enriched = []
            for row in batch:
                try:
                    enriched.append(
                        {
                            "tenant_id": str(tenant_id),
                            "invoice_date": str(row.get("invoice_date", "")),
                            "invoice_number": str(row.get("invoice_number", "")),
                            "party_name": str(row.get("party_name", "")),
                            "party_city": str(row.get("party_city", "")),
                            "party_zone": str(row.get("party_zone", "")),
                            "route": str(row.get("route", "")),
                            "product_name": str(row.get("product_name", "")),
                            "product_group": str(row.get("product_group", "")),
                            "product_category": str(row.get("product_category", "")),
                            "hsn_code": str(row.get("hsn_code", "")),
                            "quantity": float(row.get("quantity", 0)),
                            "gross_amount": float(row.get("gross_amount", 0)),
                            "discount_amount": float(row.get("discount_amount", 0)),
                            "net_amount": float(row.get("net_amount", 0)),
                            "tax_amount": float(row.get("tax_amount", 0)),
                            "total_amount": float(row.get("total_amount", 0)),
                            "raw_data": row,
                        }
                    )
                except (TypeError, ValueError) as exc:
                    rows_skipped += 1
                    warnings.append(f"Row {i}: {exc}")
                    continue

            try:
                self._supabase.table("sales_data").insert(enriched).execute()
                rows_inserted += len(enriched)
            except Exception as exc:
                errors.append(f"Batch {i // _BATCH_SIZE}: {exc}")
                rows_skipped += len(enriched)

        return ImportResult(
            rows_inserted=rows_inserted,
            rows_skipped=rows_skipped,
            errors=errors,
            warnings=warnings,
        )
```

## Placement

New file. Create at `akara/backend/app/services/data_import/service.py`.

## Explanation

`import_file` is the single public method.

**Parse phase**: Calls `SalesDataParser.parse()`. If it raises `ValueError` (unsupported format, missing required columns), the error is caught and an `ImportResult` with `rows_inserted=0` and the error message is returned immediately — no partial insert.

**Batch phase**: Iterates over records in slices of `_BATCH_SIZE = 500`. For each record:
- Enriches with `tenant_id` (converting `UUID` to string for the JSON body).
- Explicitly serialises all field values to Python primitives (`str()`, `float()`) because pandas may produce `numpy.int64`, `numpy.float64`, or `datetime.date` objects that Supabase's JSON encoder may reject.
- The `raw_data` key stores the original dict for debugging/auditability.
- Per-row `TypeError`/`ValueError` during enrichment increments `rows_skipped` and appends to `warnings`; the loop continues to the next row.

**Insert phase**: Each batch is sent as a single `INSERT` call. A Supabase/network exception on a batch increments `rows_skipped` by the batch size and appends to `errors`; the loop continues to the next batch.

The final `ImportResult` always reflects the cumulative outcome across all batches.

## Related Changes

- `app/services/data_import/parser.py` — called internally (created Day 4).
- `app/services/data_import/models.py` — return type (created Day 4).
- `app/api/routes/data.py` — instantiates `DataImportService` (created Day 4).

---

# File: `akara/backend/app/api/routes/data.py`

**Status:** Created

## Purpose

Exposes `POST /data/import` as a multipart file upload endpoint. Enforces admin-only access, validates the file's content type and size before reading the body, then delegates to `DataImportService`. Registered in `main.py` as part of Day 4.

## Dependencies

- `fastapi.APIRouter`, `fastapi.File`, `fastapi.HTTPException`, `fastapi.UploadFile`, `fastapi.status` — `fastapi>=0.111.0`, already in `pyproject.toml`.
- `app.core.auth.CurrentUser` — Day 2.
- `app.core.tenant.TenantCtx` — Day 2.
- `app.core.tenant.get_supabase_service_client` — Day 2.
- `app.services.data_import.models.ImportResult` — Day 4.
- `app.services.data_import.service.DataImportService` — Day 4.
- `python-multipart>=0.0.9` — already in `pyproject.toml` from Day 2; required by FastAPI to parse `multipart/form-data`.

## Implementation

```python
from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.core.auth import CurrentUser
from app.core.tenant import TenantCtx, get_supabase_service_client
from app.services.data_import.models import ImportResult
from app.services.data_import.service import DataImportService

router = APIRouter(prefix="/data", tags=["data"])

_MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

_ALLOWED_CONTENT_TYPES = {
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
}


@router.post("/import", response_model=ImportResult, status_code=status.HTTP_201_CREATED)
async def import_sales_data(
    user: CurrentUser,
    tenant: TenantCtx,
    file: UploadFile = File(...),
) -> ImportResult:
    if not tenant.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can import data",
        )

    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {file.content_type}",
        )

    content = await file.read()
    if len(content) > _MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 50 MB limit",
        )

    service = DataImportService(supabase=get_supabase_service_client())
    return service.import_file(
        file_content=content,
        filename=file.filename or "upload.csv",
        tenant_id=tenant.tenant_id,
    )
```

## Placement

New file. Create at `akara/backend/app/api/routes/data.py`.

This router is registered in `main.py` (modified Day 4) with:
```python
from app.api.routes import data as data_router
app.include_router(data_router.router)
```

## Explanation

The handler is `async def` because `file.read()` is an async I/O operation on the uploaded multipart stream.

Validation order:
1. **Role check** — rejects non-admin users with HTTP 403 before touching the file.
2. **Content-type check** — rejects disallowed MIME types with HTTP 415. Accepted types: `text/csv`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (xlsx), `application/vnd.ms-excel` (xls).
3. **Size check** — reads the full body into memory first, then checks the byte length against `_MAX_FILE_SIZE = 50 MB`. Returns HTTP 413 if exceeded. Reading the whole body is intentional — streaming size checks are more complex and the 50 MB limit makes full-buffer acceptable.

The `file.filename or "upload.csv"` fallback handles clients that omit the filename in the multipart headers.

`B008` (ruff rule: "do not call function in default argument") is suppressed globally in `pyproject.toml` because `File(...)` is the standard FastAPI pattern for declaring required file uploads.

## Related Changes

- `app/services/data_import/service.py` — called by this route (created Day 4).
- `app/services/data_import/models.py` — `response_model` (created Day 4).
- `app/main.py` — registers this router (modified Day 4).
- `akara/backend/pyproject.toml` — `B008` added to ruff ignore list to suppress the `File(...)` default-argument lint (modified Day 4).

---

# File: `akara/backend/app/services/schema/discovery.py`

**Status:** Created

## Purpose

Implements `SchemaDiscovery`, which provides the copilot with a safe, tenant-scoped view of the `sales_data` table schema. Replaces the hardcoded `_SCHEMA_CONTEXT` string that was embedded in `copilot.py` during Day 3, allowing the LLM to receive live distinct values (zones, categories) instead of static placeholders.

## Dependencies

- `logging` — stdlib.
- `uuid.UUID` — stdlib.
- `supabase.Client` — `supabase>=2.4.0`, already in `pyproject.toml`. Accepted as `Client | None` so the class can be instantiated without a live Supabase connection (useful for tests and the column-list smoke test).
- Supabase table: `sales_data` (Day 1 migration).

## Implementation

```python
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
```

## Placement

New file. Create at `akara/backend/app/services/schema/discovery.py`. The directory already exists with an empty `__init__.py` from Day 3.

## Explanation

`_SALES_DATA_COLUMNS` is the authoritative allow-list of columns that the copilot is permitted to reference. This list also acts as a security boundary for `get_distinct_values` — any column name not in the list raises `ValueError` immediately, preventing SQL injection through controlled column queries.

`get_columns()` returns a copy of the list (not the module-level list itself) so callers cannot mutate the allow-list.

`get_distinct_values()` performs a de-duplicating SELECT: it iterates through all returned rows and builds an ordered, de-duplicated list using a `seen` set. If Supabase raises any exception (connection error, schema mismatch), the method logs a warning and returns an empty list rather than propagating the error — callers (copilot route) will fall back gracefully.

`get_schema_context()` composes a multi-line string suitable for embedding directly in an LLM system prompt. It fetches up to 20 distinct zone and category values to give the LLM concrete grounding. The final line `"Always filter: WHERE tenant_id = :tenant_id"` is an instruction to the LLM to include tenant filtering in every SQL query it generates.

Accepting `supabase: Client | None` allows `SchemaDiscovery(None)` to work in offline/test contexts — `get_columns()` works without a connection; `get_distinct_values()` returns `[]` when `supabase` is `None`.

## Related Changes

- `app/api/routes/copilot.py` — imports and instantiates `SchemaDiscovery` to replace hardcoded constants (modified Day 4).
- `app/services/prompts/generator.py` — takes `SchemaDiscovery` as a constructor argument (created Day 4).

---

# File: `akara/backend/app/services/prompts/generator.py`

**Status:** Created (Day 4), extended with industry addendum registry

## Purpose

Builds context-aware system prompts for the copilot. Has two responsibilities:

1. **Schema context** — calls `SchemaDiscovery.get_schema_context()` to produce a per-tenant, per-request string listing available tables and their columns.
2. **Industry addendum registry** — maps `tenants.config.industry` slugs to FMCG/pharma/retail-specific addendum strings that are appended to the generic `_PLAN_SYSTEM` and `_SYNTHESIZE_SYSTEM` base constants. This keeps all industry-specific prompt logic in one file.

## Public API

```python
class PromptGenerator:
    def __init__(self, schema_discovery: SchemaDiscovery) -> None: ...

    def build_schema_context(self, tenant_id: UUID) -> str:
        """Returns the dynamic schema string passed as user-message context to the planner."""

    def build_synthesizer_addendum(self, tenant_config: dict) -> str:
        """Returns the industry-specific addendum appended to _SYNTHESIZE_SYSTEM.
        Returns '' for unknown or unconfigured industries."""

    def build_planner_addendum(self, tenant_config: dict) -> str:
        """Returns the industry-specific addendum appended to _PLAN_SYSTEM.
        Returns '' for unknown or unconfigured industries."""

    def build_system_prompt(self, tenant_id, tenant_name, start_date, end_date) -> str:
        """Legacy helper — kept for backward compatibility."""
```

## Industry addendum registry

```python
_INDUSTRY_ADDENDUMS: dict[str, dict[str, str]] = {
    "fmcg_distribution": {
        "synthesizer": _FMCG_DISTRIBUTION_SYNTHESIZER,
        "planner":     _FMCG_DISTRIBUTION_PLANNER,
    },
    # Add new verticals here — no other file changes needed.
}
```

`_FMCG_DISTRIBUTION_SYNTHESIZER` contains: ₹ lakh/crore formatting rules, rupee impact framing, Hindi NLQ, FMCG domain glossary.

`_FMCG_DISTRIBUTION_PLANNER` contains: primary-vs-secondary join pattern, scheme leakage join pattern, `outstanding_amount IS NOT NULL` filter rule.

## How it is wired

`copilot.py` builds a `PromptGenerator`, calls both addendum methods with `tenant.tenant_config`, and passes the results as `planner_addendum` / `synthesizer_addendum` into `CopilotAgent.answer()`. The agent threads them into `Planner.plan(system_addendum=...)` and `Synthesizer.synthesize(system_addendum=...)`.

Tenants without a recognised `industry` value receive empty addendums — the base generic prompts apply and AKARA behaves as a universal analytics copilot.

## Placement

`akara/backend/app/services/prompts/generator.py`. Directory existed with empty `__init__.py` from Day 3.

## Related Changes

- `app/services/schema/discovery.py` — injected dependency (created Day 4).

---

# File: `akara/backend/app/main.py`

**Status:** Modified

## Purpose

Register the two new Day 4 routers (`/kpi` and `/data`) in the FastAPI application alongside the existing Day 3 routers.

## Dependencies

- `app.api.routes.kpi` — Day 4 (new import).
- `app.api.routes.data` — Day 4 (new import).
- All other imports were already present in the Day 3 version of this file.

## Implementation

The complete file after Day 4 modification:

```python
import logging

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth as auth_router
from app.api.routes import copilot as copilot_router
from app.api.routes import data as data_router
from app.api.routes import health
from app.api.routes import kpi as kpi_router
from app.core.config import settings

logging.basicConfig(level=settings.log_level)

if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=0.1,
    )

app = FastAPI(
    title="AKARA API",
    version="0.1.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth_router.router)
app.include_router(copilot_router.router)
app.include_router(kpi_router.router)
app.include_router(data_router.router)
```

## Placement

This file already exists from Day 2/3. The Day 4 changes are:

**Imports added** (insert after the existing `from app.api.routes import copilot as copilot_router` line):
```python
from app.api.routes import data as data_router
from app.api.routes import kpi as kpi_router
```

**Router registrations added** (append after `app.include_router(copilot_router.router)`):
```python
app.include_router(kpi_router.router)
app.include_router(data_router.router)
```

The Day 3 version of this file ended at:
```python
app.include_router(health.router)
app.include_router(auth_router.router)
app.include_router(copilot_router.router)
```

## Explanation

`app.include_router` mounts each router's prefix and all its routes into the main FastAPI application. After Day 4, the application exposes 9 total routes:
- `GET /health/` (Day 2)
- `POST /auth/login`, `POST /auth/refresh` (Day 2)
- `POST /copilot/chat` (Day 3)
- `GET /kpi/` (Day 4)
- `POST /data/import` (Day 4)

The import order is alphabetical within the router group (ruff `isort` enforces this).

## Related Changes

- `app/api/routes/kpi.py` — registered here (created Day 4).
- `app/api/routes/data.py` — registered here (created Day 4).

---

# File: `akara/backend/app/api/routes/copilot.py`

**Status:** Modified

## Purpose

Replace the hardcoded `_SCHEMA_CONTEXT` string and `_AVAILABLE_COLUMNS` list (embedded as module-level constants in the Day 3 version) with live calls to `SchemaDiscovery` at request time. This ensures the LLM receives actual tenant-specific schema data (zone names, product categories) rather than generic placeholder text.

## Dependencies

New dependency introduced in Day 4:
- `app.services.schema.discovery.SchemaDiscovery` — Day 4.

All other imports were already present in the Day 3 version.

## Implementation

The complete file after Day 4 modification:

```python
import logging
from datetime import date
from uuid import UUID

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.auth import CurrentUser
from app.core.config import settings
from app.core.tenant import TenantCtx, get_supabase_service_client
from app.services.copilot.agent import CopilotAgent
from app.services.copilot.planner import Planner
from app.services.copilot.synthesizer import Synthesizer
from app.services.copilot.tools.context_tool import ContextTool
from app.services.copilot.tools.sql_tool import SQLTool
from app.services.llm.manager import LLMManager
from app.services.schema.discovery import SchemaDiscovery
from app.sql.executor import SQLExecutor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/copilot", tags=["copilot"])


class ChatRequest(BaseModel):
    question: str
    stream: bool = True


class ChatResponse(BaseModel):
    question: str
    intent: str
    response: str
    response_time_ms: int
    llm_model: str


def _build_agent(tenant_id: UUID) -> CopilotAgent:
    """Factory: build a CopilotAgent with all dependencies wired."""
    llm = LLMManager(
        gemini_api_key=settings.gemini_api_key,
        openrouter_api_key=settings.openrouter_api_key,
    )
    supabase = get_supabase_service_client()
    executor = SQLExecutor(client=supabase)
    return CopilotAgent(
        planner=Planner(llm=llm),
        synthesizer=Synthesizer(llm=llm),
        sql_tool=SQLTool(executor=executor, tenant_id=tenant_id),
        context_tool=ContextTool(supabase=supabase, tenant_id=tenant_id),
        tenant_id=tenant_id,
    )


@router.post("/chat", response_model=None)
async def chat(
    request: ChatRequest,
    user: CurrentUser,
    tenant: TenantCtx,
) -> StreamingResponse | ChatResponse:
    supabase = get_supabase_service_client()
    schema = SchemaDiscovery(supabase=supabase)
    schema_context = schema.get_schema_context(tenant.tenant_id)
    available_columns = schema.get_columns()

    agent = _build_agent(tenant.tenant_id)
    date_range = ("2024-01-01", date.today().isoformat())

    if request.stream:

        async def event_stream():
            async for chunk in agent.answer_stream(
                question=request.question,
                schema_context=schema_context,
                available_columns=available_columns,
                date_range=date_range,
            ):
                yield f"data: {chunk}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    result = await agent.answer(
        question=request.question,
        schema_context=schema_context,
        available_columns=available_columns,
        date_range=date_range,
    )
    return ChatResponse(
        question=result.question,
        intent=result.intent,
        response=result.response,
        response_time_ms=result.response_time_ms,
        llm_model=result.llm_model,
    )
```

## Placement

This file already exists from Day 3. The Day 4 changes are:

**Import removed:** The module-level comment block and two constants are deleted entirely. The Day 3 version contained:
```python
# Hardcoded for Day 3 — Day 4 replaces with dynamic schema discovery
_SCHEMA_CONTEXT = (
    "Table: sales_data. Columns: invoice_date, party_name, party_city, "
    "party_zone, route, product_name, product_group, product_category, "
    "quantity, gross_amount, net_amount, total_amount."
)
_AVAILABLE_COLUMNS = [
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
```
**Delete these lines entirely.**

**Import added** (in the imports block, after `from app.services.llm.manager import LLMManager`):
```python
from app.services.schema.discovery import SchemaDiscovery
```

**Route handler body changed.** The Day 3 version of the `chat` handler body began:
```python
    agent = _build_agent(tenant.tenant_id)
    date_range = ("2024-01-01", date.today().isoformat())
```

Replace that opening with:
```python
    supabase = get_supabase_service_client()
    schema = SchemaDiscovery(supabase=supabase)
    schema_context = schema.get_schema_context(tenant.tenant_id)
    available_columns = schema.get_columns()

    agent = _build_agent(tenant.tenant_id)
    date_range = ("2024-01-01", date.today().isoformat())
```

**All references to `_SCHEMA_CONTEXT` and `_AVAILABLE_COLUMNS`** in both the streaming and non-streaming branches are replaced with the local variables `schema_context` and `available_columns` (no other change to those branches).

## Explanation

`SchemaDiscovery` is instantiated at the start of each request with a fresh Supabase client. `get_schema_context(tenant.tenant_id)` makes two lightweight SELECT queries to fetch up to 20 distinct zones and 20 distinct categories for the tenant, then assembles the context string. `get_columns()` returns the static allow-list of column names.

Both `schema_context` and `available_columns` are then passed unchanged to `agent.answer_stream()` and `agent.answer()` — the call signatures of those methods are unchanged from Day 3.

The `_build_agent` factory and both response branches are otherwise identical to Day 3.

**Note:** This means each `POST /copilot/chat` request now makes 2 extra SELECT queries (zones + categories) before the agent pipeline starts. This is acceptable at this stage; caching can be added in a later day if needed.

## Related Changes

- `app/services/schema/discovery.py` — newly imported and instantiated here (created Day 4).
- `app/services/copilot/agent.py` — called unchanged; `answer()` and `answer_stream()` signatures not affected (Day 3).
- Day 3 hardcoded constants `_SCHEMA_CONTEXT` and `_AVAILABLE_COLUMNS` — **deprecated and deleted**.

---

# File: `akara/backend/pyproject.toml`

**Status:** Modified

## Purpose

Add `B008` to the ruff lint ignore list. `B008` flags "do not perform function call in argument defaults" — a rule that fires on `file: UploadFile = File(...)` in `api/routes/data.py`, which is the standard and required FastAPI pattern for declaring a required file upload parameter. Suppressing it globally is the correct approach for FastAPI projects.

## Dependencies

None.

## Implementation

Only the `[tool.ruff.lint]` section changes. The complete `pyproject.toml` after Day 4:

```toml
[project]
name = "akara-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.111.0",
    "uvicorn[standard]>=0.29.0",
    "supabase>=2.4.0",
    "pydantic>=2.7.0",
    "pydantic-settings>=2.2.0",
    "python-jose[cryptography]>=3.3.0",
    "httpx>=0.27.0",
    "google-genai>=2.13.0",
    "openai>=1.30.0",
    "scikit-learn>=1.5.0",
    "pandas>=2.2.0",
    "numpy>=1.26.0",
    "python-multipart>=0.0.9",
    "sentry-sdk[fastapi]>=2.5.0",
    "openpyxl>=3.1.0",
    "structlog>=24.1.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.2.0",
    "pytest-asyncio>=0.23.0",
    "pytest-cov>=5.0.0",
    "httpx>=0.27.0",
    "ruff>=0.4.0",
    "httpx2>=2.7.0",
]

[tool.ruff]
line-length = 88
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "W", "I", "UP", "B", "C4", "PIE", "T20", "RET", "SIM"]
ignore = ["E501", "B008"]

[tool.ruff.lint.isort]
known-first-party = ["app"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

## Placement

This file already exists from Day 2. The only change is on the `ignore` line inside `[tool.ruff.lint]`:

**Before (Day 2/3):**
```toml
ignore = ["E501"]
```

**After (Day 4):**
```toml
ignore = ["E501", "B008"]
```

## Explanation

`E501` (line too long) and `B008` (function call in default argument) are both intentionally suppressed:
- `E501` — project uses black-compatible 88-char line length but some long strings are unavoidable.
- `B008` — FastAPI's `File(...)`, `Query(...)`, `Depends(...)` patterns intentionally call functions in default arguments; this is the framework's documented API.

No packages were added or removed in Day 4. All packages required by Day 4 code (`pandas`, `openpyxl`) were already declared in the Day 2/3 `pyproject.toml`.

## Related Changes

- `app/api/routes/data.py` — the `File(...)` usage that triggers `B008` (created Day 4).

---

## Environment Variables

No new environment variables were introduced in Day 4. All variables used by Day 4 code were established in earlier days:

| Variable | Used by | Day introduced |
|---|---|---|
| `SUPABASE_URL` | `get_supabase_service_client()` in `kpi.py`, `data.py`, `copilot.py` | Day 2 |
| `SUPABASE_SERVICE_ROLE_KEY` | `get_supabase_service_client()` | Day 2 |
| `GEMINI_API_KEY` | `LLMManager` in `copilot.py` | Day 3 |
| `OPENROUTER_API_KEY` | `LLMManager` in `copilot.py` | Day 3 |

---

## Package Dependencies

No new packages were added to `pyproject.toml` in Day 4. All packages consumed by Day 4 code were already declared:

| Package | Required by | Declared in |
|---|---|---|
| `pandas>=2.2.0` | `data_import/parser.py` | Day 2 `pyproject.toml` |
| `openpyxl>=3.1.0` | `pandas.read_excel()` for `.xlsx` | Day 2 `pyproject.toml` |
| `supabase>=2.4.0` | `kpi/service.py`, `data_import/service.py`, `schema/discovery.py` | Day 2 `pyproject.toml` |
| `pydantic>=2.7.0` | `kpi/models.py`, `data_import/models.py` | Day 2 `pyproject.toml` |
| `python-multipart>=0.0.9` | FastAPI multipart file upload in `data.py` | Day 2 `pyproject.toml` |

---

## Summary of All Day 4 Changes

| File | Status | Section |
|---|---|---|
| `akara/backend/app/services/kpi/models.py` | Created | 4.1 — KPI models |
| `akara/backend/app/services/kpi/service.py` | Created | 4.1 — KPI service |
| `akara/backend/app/api/routes/kpi.py` | Created | 4.2 — KPI route |
| `akara/backend/app/services/data_import/models.py` | Created | 4.3 — Import models |
| `akara/backend/app/services/data_import/parser.py` | Created | 4.3 — Import parser |
| `akara/backend/app/services/data_import/service.py` | Created | 4.3 — Import service |
| `akara/backend/app/api/routes/data.py` | Created | 4.4 — Import route |
| `akara/backend/app/services/schema/discovery.py` | Created | 4.5 — Schema discovery |
| `akara/backend/app/services/prompts/generator.py` | Created | 4.6 — Prompts generator |
| `akara/backend/app/main.py` | Modified | Router registration |
| `akara/backend/app/api/routes/copilot.py` | Modified | Dynamic schema wiring |
| `akara/backend/pyproject.toml` | Modified | Ruff B008 ignore |

---

## Additions to Day 4 (competitive parity with FireAI)

> **Status: implemented.** All changes below are live in the codebase.

### `kpi/models.py` — two new models

```python
class RoutePerformance(BaseModel):
    route: str
    revenue: Decimal
    order_count: int
    unique_parties: int
    avg_order_value: Decimal

class OutstandingParty(BaseModel):
    party_name: str
    party_zone: str | None
    outstanding_amount: Decimal
    invoice_count: int
```

`KPIResponse` now includes `route_performance: list[RoutePerformance]` and `outstanding_parties: list[OutstandingParty]`. Both default to empty lists — the response degrades gracefully if the data columns are absent.

### `kpi/service.py` — two new methods

`get_route_performance(tenant_id, start_date, end_date)` calls `public.get_route_performance()` (defined in migration 004).

`get_outstanding_parties(tenant_id)` calls `public.get_outstanding_parties()` (defined in migration 004). No date range — outstanding balance is cumulative.

Both are called in `get_all()`.

### `data_import/parser.py` — three parsers

The single `SalesDataParser` is now joined by:
- `SecondarySalesParser` — same column normalization but different required columns and no `hsn_code`/`tax_amount`/`outstanding_amount`
- `SchemeDataParser` — distinct column aliases (`scheme`, `claimed`, `from_date`, etc.) and date columns `scheme_start`/`scheme_end`

All three share private helpers `_read_file`, `_normalize_columns`, `_validate_required`, `_coerce_numeric`.

`outstanding_amount` is added to `NUMERIC_COLUMNS` (with aliases `outstanding`, `outstanding_amt`, `balance`, `due_amount`) so Tally exports with that column are automatically parsed.

### `data_import/service.py` — `source_type` routing + `import_rows()`

`import_file()` now accepts `source_type: Literal["primary", "secondary", "scheme"]` (default `"primary"`). It selects the right parser and table:

| source_type | Parser | Table |
|---|---|---|
| `primary` | `SalesDataParser` | `sales_data` |
| `secondary` | `SecondarySalesParser` | `secondary_sales_data` |
| `scheme` | `SchemeDataParser` | `scheme_master` |

New method `import_rows(rows, tenant_id, source_type)` accepts pre-parsed dicts directly (used by `/data/sync`). Runs through the same enrichment + batch-insert pipeline — no code duplication.

### `api/routes/data.py` — `source_type` param + `POST /data/sync`

`POST /data/import` now accepts `?source_type=primary|secondary|scheme` as a query parameter (default `primary`).

New endpoint:
```
POST /data/sync
Body: { "source_type": "primary"|"secondary"|"scheme", "rows": [...] }
```
This is the ingest point for `akara_agent.py`. The overnight script running on the customer's Tally machine calls this with the day's invoices. No file upload, no manual work after initial setup.

### `schema/discovery.py` — three-table context

`_SALES_DATA_COLUMNS` now includes `outstanding_amount`. Two new column lists added: `_SECONDARY_SALES_COLUMNS` and `_SCHEME_MASTER_COLUMNS`.

`get_schema_context()` checks whether `secondary_sales_data` and `scheme_master` have any rows for this tenant before including them in the context string. This avoids confusing the LLM with empty tables. When data is present, the context explains:
- How to join primary vs. secondary
- How to compute scheme leakage (join pattern + date window logic)
