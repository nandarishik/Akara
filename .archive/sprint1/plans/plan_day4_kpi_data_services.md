---
name: Day 4 KPI & Data Services
overview: Port KPI computation, data import, schema discovery, and prompt generation services. All four sub-systems are independently testable, exposed via new API routes, and `main.py` is updated to register them. As a Day 3 cleanup, `copilot.py` is updated to use dynamic schema instead of hardcoded values.
todos:
  - id: d4-kpi-models
    content: Create services/kpi/models.py — KPISummary, TopProduct, ZoneBreakdown, RevenueByDate, KPIResponse
    status: completed
  - id: d4-kpi-service
    content: Create services/kpi/service.py — KPIService with get_summary (RPC), get_top_products, get_zone_breakdown, get_revenue_trend, get_all
    status: completed
  - id: d4-kpi-route
    content: Create api/routes/kpi.py — GET /kpi/ with date range query params
    status: completed
  - id: d4-import-models
    content: Create services/data_import/models.py — ImportResult
    status: completed
  - id: d4-import-parser
    content: Create services/data_import/parser.py — SalesDataParser (CSV/XLSX, alias normalisation, type coercion)
    status: completed
  - id: d4-import-service
    content: Create services/data_import/service.py — DataImportService with 500-row batch insert
    status: completed
  - id: d4-import-route
    content: Create api/routes/data.py — POST /data/import (admin-only, 50 MB cap)
    status: completed
  - id: d4-schema
    content: Create services/schema/discovery.py — SchemaDiscovery (get_columns, get_distinct_values, get_schema_context)
    status: completed
  - id: d4-prompts
    content: Create services/prompts/generator.py — PromptGenerator.build_system_prompt
    status: completed
  - id: d4-main
    content: Modify main.py — register kpi_router and data_router
    status: completed
  - id: d4-copilot-update
    content: Modify api/routes/copilot.py — replace hardcoded schema with live SchemaDiscovery calls
    status: completed
  - id: d4-verify
    content: "Verify: server boots, parser smoke test, schema columns test, ruff + pytest exit 0"
    status: completed
isProject: false
---

# Day 4 — Port KPI + Data Services

**Goal:** `GET /kpi/` returns computed metrics from `sales_data`, `POST /data/import` accepts CSV/XLSX uploads and batch-inserts rows, schema discovery builds dynamic LLM context, and the prompts generator wires them together. `ruff check .` and `pytest` both exit 0.

---

## Current State

Day 3 is complete. The following `__init__.py` stubs already exist (created during scaffold):
- `services/kpi/__init__.py`
- `services/data_import/__init__.py`
- `services/schema/__init__.py`
- `services/prompts/__init__.py`

The `get_kpi_summary` Supabase RPC is already defined in [`akara/migrations/003_functions.sql`](akara/migrations/003_functions.sql).

No new SQL migrations are needed.

---

## Architecture after Day 4

```mermaid
flowchart TD
    kpiRoute["GET /kpi/\napi/routes/kpi.py"]
    dataRoute["POST /data/import\napi/routes/data.py"]
    copilotRoute["POST /copilot/chat\napi/routes/copilot.py"]
    kpiSvc["KPIService\nservices/kpi/service.py"]
    importSvc["DataImportService\nservices/data_import/service.py"]
    parser["SalesDataParser\nservices/data_import/parser.py"]
    schema["SchemaDiscovery\nservices/schema/discovery.py"]
    prompts["PromptGenerator\nservices/prompts/generator.py"]
    supabase[(Supabase)]

    kpiRoute --> kpiSvc --> supabase
    dataRoute --> importSvc --> parser
    importSvc --> supabase
    copilotRoute --> schema --> supabase
    copilotRoute --> prompts --> schema
```

---

## Files to Create (9 new) + 2 Modified

### 4.1 — KPI Service (`backend/app/services/kpi/`)

- **[`services/kpi/models.py`](akara/backend/app/services/kpi/models.py)** — Pydantic models: `KPISummary`, `TopProduct`, `ZoneBreakdown`, `RevenueByDate`, `KPIResponse`
- **[`services/kpi/service.py`](akara/backend/app/services/kpi/service.py)** — `KPIService(supabase)` with four methods:
  - `get_summary` — calls `get_kpi_summary` Supabase RPC
  - `get_top_products` — SELECT aggregation on `sales_data`
  - `get_zone_breakdown` — SELECT with revenue_pct computed locally
  - `get_revenue_trend` — SELECT grouped by `invoice_date`
  - `get_all` — composes all four into `KPIResponse`

### 4.2 — KPI API Route

- **[`api/routes/kpi.py`](akara/backend/app/api/routes/kpi.py)** — `GET /kpi/` with `start_date`/`end_date` query params, protected by `CurrentUser` + `TenantCtx`, defaults to last 30 days

### 4.3 — Data Import Service (`backend/app/services/data_import/`)

- **[`services/data_import/models.py`](akara/backend/app/services/data_import/models.py)** — `ImportResult(rows_inserted, rows_skipped, errors, warnings)`
- **[`services/data_import/parser.py`](akara/backend/app/services/data_import/parser.py)** — `SalesDataParser` with column alias normalisation, required-column validation, date/numeric coercion; supports `.csv`, `.xlsx`, `.xls`
- **[`services/data_import/service.py`](akara/backend/app/services/data_import/service.py)** — `DataImportService(supabase)` batches 500 rows per insert, enriches each row with `tenant_id`

### 4.4 — Data Import API Route

- **[`api/routes/data.py`](akara/backend/app/api/routes/data.py)** — `POST /data/import` (admin-only, 50 MB cap, CSV/XLSX content-type guard)

### 4.5 — Schema Discovery (`backend/app/services/schema/`)

- **[`services/schema/discovery.py`](akara/backend/app/services/schema/discovery.py)** — `SchemaDiscovery(supabase)`:
  - `get_columns()` — returns the 16 allowed `sales_data` column names
  - `get_distinct_values(tenant_id, column, limit=50)` — safe SELECT with allow-list guard
  - `get_schema_context(tenant_id)` — builds LLM-ready string with zones + categories

### 4.6 — Prompts Generator (`backend/app/services/prompts/`)

- **[`services/prompts/generator.py`](akara/backend/app/services/prompts/generator.py)** — `PromptGenerator(schema_discovery)`:
  - `build_system_prompt(tenant_id, tenant_name, start_date, end_date)` — injects today's date, available date range, and full schema context

### Modified: [`backend/app/main.py`](akara/backend/app/main.py)

Register two new routers after the existing includes:
```python
from app.api.routes import kpi as kpi_router
from app.api.routes import data as data_router
app.include_router(kpi_router.router)
app.include_router(data_router.router)
```

### Modified: [`backend/app/api/routes/copilot.py`](akara/backend/app/api/routes/copilot.py)

Replace hardcoded `schema_context` and `available_columns` strings in `_build_agent()` with a live call to `SchemaDiscovery.get_schema_context(tenant_id)` and `SchemaDiscovery.get_columns()`.

---

## Supabase Connections — Day 4

- `get_kpi_summary` RPC — already defined in `003_functions.sql`, no new migration needed
- `sales_data` SELECT (top products, zone breakdown, revenue trend, schema discovery)
- `sales_data` INSERT (data import, batched 500 rows)

---

## Verification Steps

```bash
cd akara/backend

# 1. Server boots clean
uv run uvicorn app.main:app --reload &

# 2. Parser smoke test (no Supabase needed)
uv run python -c "
from app.services.data_import.parser import SalesDataParser
import io, csv
rows = [['invoice_date','party_name','total_amount'],['2024-01-15','ABC',1500]]
buf = io.BytesIO()
buf.write(b'invoice_date,party_name,total_amount\n2024-01-15,ABC,1500\n')
df = SalesDataParser().parse(buf.getvalue(), 'test.csv')
print('rows:', len(df), 'cols:', list(df.columns))
"

# 3. Schema discovery (no Supabase needed for column list)
uv run python -c "
from app.services.schema.discovery import SchemaDiscovery
cols = SchemaDiscovery(None).get_columns()
print('columns:', len(cols), cols[:3])
"

# 4. Quality gate
ruff check .
pytest
```
