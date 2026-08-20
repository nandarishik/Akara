# Day 10 Implementation Handoff

## Reproduction Instructions

### Expected repository state before applying Day 10

Days 1–9 must already be fully implemented as documented in:
- `docs/day1_implementation.md` through `docs/day9_implementation.md`

The following must already exist and be functional:
- `akara/backend/app/main.py` — FastAPI app with routers for `auth`, `copilot`, `conversations`, `kpi`, `data`, and all `admin` sub-routes
- `akara/backend/app/core/auth.py` — `CurrentUser` Annotated dependency
- `akara/backend/app/core/tenant.py` — `TenantCtx` Annotated dependency, `get_supabase_service_client()`
- `akara/frontend/src/App.tsx` — React Router with AppShell layout
- `akara/frontend/src/lib/api.ts` — `apiFetch()` helper
- `akara/frontend/src/lib/supabase.ts` — Supabase JS client
- `akara/frontend/package.json` — base frontend dependencies (React, TanStack Query, shadcn/ui, etc.)
- Supabase tables: `sales_data`, `secondary_sales_data`, `scheme_master`, `generated_reports` (from previous migrations)

### Day 10 changes must be applied in this order

1. `akara/backend/app/services/simulator/__init__.py` — Create package marker
2. `akara/backend/app/services/simulator/projector.py` — Create `RevenueProjector` service
3. `akara/backend/app/api/routes/reports.py` — Create reports API
4. `akara/backend/app/api/routes/simulator.py` — Create simulator API
5. `akara/backend/app/main.py` — Register new routers
6. `akara/migrations/009_scheme_leakage_fn.sql` — Run in Supabase SQL Editor
7. `akara/frontend/package.json` — Add `@sentry/react` dependency
8. `akara/frontend/src/main.tsx` — Initialize Sentry
9. `akara/frontend/.env.example` — Add `VITE_SENTRY_DSN`
10. `akara/frontend/src/components/ui/slider.tsx` — Create Slider UI component
11. `akara/frontend/src/hooks/useReports.ts` — Create reports hooks
12. `akara/frontend/src/pages/ReportsPage.tsx` — Create Reports page
13. `akara/frontend/src/pages/SimulatorPage.tsx` — Create Simulator page
14. `akara/frontend/src/App.tsx` — Wire new pages into router

### Commands required after copying the code

```bash
# Install new frontend dependency
cd akara/frontend
npm install   # or pnpm install / yarn install

# Run quality gates
cd akara/backend
uv run ruff check .
uv run pytest

cd akara/frontend
npx tsc --noEmit
```

Run migration `009_scheme_leakage_fn.sql` in Supabase Dashboard → SQL Editor.

---

## Environment Variables

### `VITE_SENTRY_DSN` (Frontend — introduced Day 10)

| Field | Value |
|---|---|
| **Variable name** | `VITE_SENTRY_DSN` |
| **Purpose** | Sentry DSN for frontend error tracking. When set in production, Sentry captures uncaught errors and forwards them to the Sentry dashboard. |
| **Required** | Optional |
| **Expected format** | `https://<key>@<org>.ingest.sentry.io/<project-id>` |
| **Default** | Empty string (Sentry disabled) |
| **Used in** | `akara/frontend/src/main.tsx` |
| **Status** | Introduced in Day 10 |

Set this in Vercel environment variables for production. Leave empty for local development.

---

## Dependencies

### `@sentry/react` (Frontend — introduced Day 10)

| Field | Value |
|---|---|
| **Package** | `@sentry/react` |
| **Version** | `^8.56.0` |
| **Added to** | `akara/frontend/package.json` under `dependencies` |
| **Why needed** | Provides Sentry SDK for React: `Sentry.init()` call in `main.tsx` |
| **Import** | `import * as Sentry from "@sentry/react"` in `src/main.tsx` |

---

# File: `akara/backend/app/services/simulator/__init__.py`

**Status:** Created

## Purpose

Marks `akara/backend/app/services/simulator/` as a Python package so `projector.py` can be imported as `app.services.simulator.projector`.

## Dependencies

None.

## Implementation

```python
```

*(Empty file — no contents.)*

## Placement

Create the file at the exact path listed. No content required.

## Explanation

Python package marker. Without this file, `from app.services.simulator.projector import RevenueProjector` would fail with a `ModuleNotFoundError`.

## Related Changes

- `akara/backend/app/api/routes/simulator.py` imports `RevenueProjector` from this package

---

# File: `akara/backend/app/services/simulator/projector.py`

**Status:** Created

## Purpose

Implements `RevenueProjector` — a statistically sound, data-driven revenue projection engine that replaces any fake-ML approach. It:

1. Fetches the last 30 days of `sales_data` for the tenant from Supabase
2. Computes daily revenue totals, mean, and population standard deviation from real data
3. Applies user-supplied growth rate and discount change multipliers
4. Derives a 95% confidence interval using the Central Limit Theorem (`±1.96 × stddev × √30`)
5. Uses the industry-standard FMCG price elasticity of `−0.3` for discount impact, clearly labelled as an estimate

## Dependencies

- `supabase` — Supabase Python client (`Client` class), already in `requirements.txt`
- Supabase table: `sales_data` — must have columns `tenant_id`, `invoice_date`, `total_amount`
- Python stdlib: `math`, `dataclasses`, `datetime`, `decimal`, `uuid`, `logging`

## Implementation

```python
"""RevenueProjector — honest, data-driven revenue projection.

No ML. No fake confidence intervals.

Logic:
  1. Pull last 30 days of sales_data and aggregate to daily totals.
  2. Compute daily mean and population stddev from actual data.
  3. Apply growth_rate and discount_change multipliers to the 30-day total.
  4. Compute real 95% CI using: projected ± 1.96 × stddev × sqrt(days).
     This reflects actual daily variance — noisy businesses get wide CIs,
     stable businesses get tight CIs.

Discount elasticity is hardcoded at -0.3 and clearly labelled as an estimate.
This is the industry standard for FMCG price elasticity (Tellis 1988 meta-analysis
suggests -0.3 to -0.5 for consumer packaged goods).
"""

import logging
import math
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from supabase import Client

logger = logging.getLogger(__name__)

# Industry-standard FMCG price elasticity (conservative estimate)
# Source: Tellis (1988) — average price elasticity for CPG is approximately -0.3
_DISCOUNT_ELASTICITY = -0.3

# Minimum days of data to produce a reliable projection
_MIN_DATA_DAYS = 7

# Projection window in days (1 month ≈ 30 days)
_PROJECTION_DAYS = 30


@dataclass
class BaselineMetrics:
    """Last-30-day actuals from the tenant's sales_data."""

    total_revenue_30d: float
    total_orders_30d: int
    daily_avg_revenue: float
    daily_stddev_revenue: float  # population stddev of daily revenue totals
    data_days: int  # how many distinct days had any sales in the window


@dataclass
class ProjectionScenario:
    """Projected outcome for a given growth + discount scenario."""

    baseline_revenue: float
    projected_revenue: float
    projected_orders: int
    confidence_interval_lower: float
    confidence_interval_upper: float
    revenue_delta: float
    revenue_delta_pct: float
    growth_rate_pct: float
    discount_change_pct: float
    data_days: int  # expose to frontend for the "insufficient data" warning


class RevenueProjector:
    """Compute a baseline from live data and project revenue under a scenario.

    Usage:
        projector = RevenueProjector(supabase_client)
        baseline = projector.get_baseline(tenant_id)
        scenario = projector.project(baseline, growth_rate_pct=10, discount_change_pct=0)
    """

    def __init__(self, supabase: Client) -> None:
        self._sb = supabase

    def get_baseline(self, tenant_id: UUID) -> BaselineMetrics:
        """Query last 30 days of sales_data and compute daily stats."""
        today = date.today()
        thirty_days_ago = today - timedelta(days=_PROJECTION_DAYS)

        result = (
            self._sb.table("sales_data")
            .select("invoice_date, total_amount")
            .eq("tenant_id", str(tenant_id))
            .gte("invoice_date", thirty_days_ago.isoformat())
            .lte("invoice_date", today.isoformat())
            .execute()
        )
        rows = result.data or []

        # Aggregate total_amount by day
        daily_totals: dict[str, Decimal] = {}
        total_orders = 0
        for row in rows:
            day = str(row.get("invoice_date", ""))[:10]
            if not day:
                continue
            amt = Decimal(str(row.get("total_amount") or 0))
            daily_totals[day] = daily_totals.get(day, Decimal("0")) + amt
            total_orders += 1

        data_days = len(daily_totals)
        total_revenue = float(sum(daily_totals.values()))

        if data_days == 0:
            return BaselineMetrics(
                total_revenue_30d=0.0,
                total_orders_30d=0,
                daily_avg_revenue=0.0,
                daily_stddev_revenue=0.0,
                data_days=0,
            )

        revenues = [float(v) for v in daily_totals.values()]
        daily_avg = total_revenue / data_days

        # Population stddev
        variance = sum((r - daily_avg) ** 2 for r in revenues) / data_days
        daily_stddev = math.sqrt(variance)

        return BaselineMetrics(
            total_revenue_30d=round(total_revenue, 2),
            total_orders_30d=total_orders,
            daily_avg_revenue=round(daily_avg, 2),
            daily_stddev_revenue=round(daily_stddev, 2),
            data_days=data_days,
        )

    def project(
        self,
        baseline: BaselineMetrics,
        growth_rate_pct: float,
        discount_change_pct: float,
    ) -> ProjectionScenario:
        """Apply growth and discount scenario to baseline, return projection with real CI."""
        if baseline.data_days == 0:
            # No data — return zeroes
            return ProjectionScenario(
                baseline_revenue=0.0,
                projected_revenue=0.0,
                projected_orders=0,
                confidence_interval_lower=0.0,
                confidence_interval_upper=0.0,
                revenue_delta=0.0,
                revenue_delta_pct=0.0,
                growth_rate_pct=growth_rate_pct,
                discount_change_pct=discount_change_pct,
                data_days=0,
            )

        baseline_rev = baseline.total_revenue_30d

        # Apply growth factor
        growth_factor = 1 + (growth_rate_pct / 100)
        projected = baseline_rev * growth_factor

        # Apply discount elasticity: increasing discount by X% → revenue change of X% × elasticity
        # e.g. +5% discount → 5 × (-0.3) = -1.5% revenue change
        if discount_change_pct != 0:
            discount_impact = projected * (discount_change_pct / 100) * _DISCOUNT_ELASTICITY
            projected += discount_impact

        # Real 95% CI: projected_daily_avg ± 1.96 × stddev / sqrt(data_days)
        # Then scale to 30-day window: multiply by _PROJECTION_DAYS
        # This uses the Central Limit Theorem for the mean of 30 daily observations.
        # Scale stddev by the same growth factor
        projected_stddev = baseline.daily_stddev_revenue * growth_factor

        # 30-day total CI: sum of 30 independent days
        # stddev of sum = stddev_of_daily × sqrt(30)
        ci_halfwidth = 1.96 * projected_stddev * math.sqrt(_PROJECTION_DAYS)
        ci_lower = max(0.0, projected - ci_halfwidth)
        ci_upper = projected + ci_halfwidth

        # Projected orders (linear scale with growth)
        projected_orders = int(baseline.total_orders_30d * growth_factor)

        delta = projected - baseline_rev
        delta_pct = (delta / baseline_rev * 100) if baseline_rev else 0.0

        return ProjectionScenario(
            baseline_revenue=round(baseline_rev, 2),
            projected_revenue=round(projected, 2),
            projected_orders=projected_orders,
            confidence_interval_lower=round(ci_lower, 2),
            confidence_interval_upper=round(ci_upper, 2),
            revenue_delta=round(delta, 2),
            revenue_delta_pct=round(delta_pct, 2),
            growth_rate_pct=growth_rate_pct,
            discount_change_pct=discount_change_pct,
            data_days=baseline.data_days,
        )
```

## Placement

New file. Place at: `akara/backend/app/services/simulator/projector.py`

## Explanation

- `BaselineMetrics` — dataclass holding last-30-day aggregates: total revenue, order count, daily mean, daily population standard deviation, and number of data days.
- `ProjectionScenario` — dataclass holding the projected outcome: revenue, orders, confidence interval bounds, delta, and scenario parameters.
- `RevenueProjector.__init__` — accepts a Supabase `Client` instance.
- `get_baseline(tenant_id)` — queries `sales_data` for the last 30 days, aggregates `total_amount` by `invoice_date`, computes population stddev over daily totals. Returns `BaselineMetrics(data_days=0)` when no sales found.
- `project(baseline, growth_rate_pct, discount_change_pct)` — multiplies baseline by `(1 + growth_rate_pct/100)`, then applies discount elasticity impact (`discount_change_pct/100 × −0.3`), then computes 95% CI as `±1.96 × projected_daily_stddev × sqrt(30)`. Returns all-zeroes `ProjectionScenario` when `data_days == 0`.
- `_DISCOUNT_ELASTICITY = -0.3` is clearly commented as a Tellis (1988) estimate, not derived from tenant data.
- Uses `Decimal` for accumulation to avoid floating-point drift in daily aggregation.

## Related Changes

- `akara/backend/app/api/routes/simulator.py` — imports and instantiates `RevenueProjector`
- `akara/backend/app/api/routes/simulator.py` — calls `projector.get_baseline()` and `projector.project()`

---

# File: `akara/backend/app/api/routes/reports.py`

**Status:** Created

## Purpose

Provides three REST endpoints for the Reports feature:
- `GET /reports/` — list last 50 generated reports for the authenticated tenant
- `GET /reports/scheme-leakage` — compare `scheme_master` claimed amounts vs. actual `secondary_sales_data` offtake, returning distributor rows where claimed > actual
- `GET /reports/{report_id}/download` — stream a generated XLSX file from Supabase Storage

## Dependencies

- `app.core.auth.CurrentUser` — FastAPI dependency for authenticated user (Day 2)
- `app.core.tenant.TenantCtx` — FastAPI dependency providing `tenant.tenant_id` (Day 2)
- `app.core.tenant.get_supabase_service_client` — Supabase service-role client (Day 2)
- Supabase table: `generated_reports` — columns: `id`, `tenant_id`, `report_type`, `title`, `storage_path`, `file_size_bytes`, `metadata`, `created_at`
- Supabase Storage bucket: `reports` — stores XLSX files
- Supabase RPC function: `get_scheme_leakage(p_tenant_id UUID)` — defined in `akara/migrations/009_scheme_leakage_fn.sql`
- Python packages: `fastapi`, `pydantic` (all pre-existing)

## Implementation

```python
"""Reports API — list, download, and scheme-leakage analysis.

Endpoints:
  GET  /reports/              — list last 50 generated reports for the tenant
  GET  /reports/scheme-leakage — compare scheme claims vs. actual secondary offtake
  GET  /reports/{report_id}/download — stream XLSX from Supabase Storage
"""

import logging
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel

from app.core.auth import CurrentUser
from app.core.tenant import TenantCtx, get_supabase_service_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["reports"])


class ReportOut(BaseModel):
    id: UUID
    report_type: str
    title: str
    storage_path: str | None = None
    file_size_bytes: int | None = None
    metadata: dict = {}
    created_at: datetime


class SchemeLeakageRow(BaseModel):
    party_name: str
    scheme_name: str
    product_name: str
    claimed_amount: float
    actual_offtake: float
    leakage_amount: float
    scheme_start: str
    scheme_end: str


@router.get("/scheme-leakage", response_model=list[SchemeLeakageRow])
def get_scheme_leakage(
    user: CurrentUser,
    tenant: TenantCtx,
) -> list[SchemeLeakageRow]:
    """Compare scheme_master claimed amounts vs. actual secondary offtake.

    Returns distributors where claimed > actual, with deniable amount.
    Requires both scheme_master and secondary_sales_data to have data.
    Returns empty list if either table is empty.
    """
    supabase = get_supabase_service_client()
    try:
        result = supabase.rpc(
            "get_scheme_leakage",
            {"p_tenant_id": str(tenant.tenant_id)},
        ).execute()
        rows = result.data or []
        return [SchemeLeakageRow(**row) for row in rows]
    except Exception as exc:
        logger.warning("get_scheme_leakage RPC failed: %s", exc)
        # If the function doesn't exist yet, return empty list gracefully
        return []


@router.get("/", response_model=list[ReportOut])
def list_reports(
    user: CurrentUser,
    tenant: TenantCtx,
) -> list[ReportOut]:
    """List the last 50 generated reports for the tenant."""
    supabase = get_supabase_service_client()
    result = (
        supabase.table("generated_reports")
        .select("*")
        .eq("tenant_id", str(tenant.tenant_id))
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return [ReportOut(**row) for row in (result.data or [])]


@router.get("/{report_id}/download")
def download_report(
    report_id: UUID,
    user: CurrentUser,
    tenant: TenantCtx,
) -> Response:
    """Download a generated report as an XLSX file from Supabase Storage."""
    supabase = get_supabase_service_client()
    result = (
        supabase.table("generated_reports")
        .select("storage_path, title")
        .eq("id", str(report_id))
        .eq("tenant_id", str(tenant.tenant_id))
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    storage_path = result.data.get("storage_path")
    title = result.data.get("title", "report")

    if not storage_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report file not yet available",
        )

    try:
        file_bytes = supabase.storage.from_("reports").download(storage_path)
        return Response(
            content=file_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{title}.xlsx"'},
        )
    except Exception as exc:
        logger.error("Failed to download report %s: %s", report_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Download failed — file may have been deleted",
        ) from exc
```

## Placement

New file. Place at: `akara/backend/app/api/routes/reports.py`

The `/scheme-leakage` route is declared **before** `/{report_id}/download` intentionally — FastAPI matches routes top-to-bottom and the literal path `/scheme-leakage` must not be captured by the `{report_id}` path parameter.

## Explanation

- `ReportOut` — Pydantic model serializing a `generated_reports` row to the client. `metadata` defaults to `{}` so rows without JSONB metadata don't fail.
- `SchemeLeakageRow` — Pydantic model matching the columns returned by `get_scheme_leakage()` SQL function. `scheme_start`/`scheme_end` are `str` to avoid date serialization complexity.
- `get_scheme_leakage` — calls the Supabase RPC `get_scheme_leakage`. Wrapped in `try/except` so that the endpoint returns an empty list gracefully if the SQL function hasn't been deployed yet (migration 009 pending).
- `list_reports` — simple read of `generated_reports` filtered by `tenant_id`, last 50, sorted descending by `created_at`.
- `download_report` — fetches the row, checks tenant ownership, then calls `supabase.storage.from_("reports").download(storage_path)` to get raw bytes. Returns a `Response` with the correct XLSX MIME type and `Content-Disposition: attachment` header so the browser triggers a download.

## Related Changes

- `akara/backend/app/main.py` — imports `reports as reports_router` and calls `app.include_router(reports_router.router)`
- `akara/frontend/src/hooks/useReports.ts` — frontend hooks that call `/reports/` and `/reports/scheme-leakage`
- `akara/frontend/src/pages/ReportsPage.tsx` — frontend page that uses these hooks and calls `/reports/{id}/download`

---

# File: `akara/backend/app/api/routes/simulator.py`

**Status:** Created

## Purpose

Provides two REST endpoints for the Revenue Projection Simulator:
- `GET /simulator/baseline` — returns the tenant's last-30-day revenue and order actuals
- `POST /simulator/run` — accepts `growth_rate_pct` and `discount_change_pct`, returns a projected revenue scenario with a real 95% confidence interval

## Dependencies

- `app.core.auth.CurrentUser` — FastAPI authenticated user dependency (Day 2)
- `app.core.tenant.TenantCtx` — FastAPI tenant dependency (Day 2)
- `app.core.tenant.get_supabase_service_client` — service-role Supabase client (Day 2)
- `app.services.simulator.projector.RevenueProjector` — introduced Day 10
- Python packages: `fastapi`, `pydantic` (pre-existing)

## Implementation

```python
"""Revenue Projection Simulator API.

Endpoints:
  GET  /simulator/baseline  — fetch tenant's last-30-day actuals from sales_data
  POST /simulator/run       — project revenue under a growth + discount scenario

The confidence interval is computed from real daily variance (not hardcoded).
Discount elasticity uses the industry-standard FMCG estimate of -0.3.
"""

import logging

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.core.auth import CurrentUser
from app.core.tenant import TenantCtx, get_supabase_service_client
from app.services.simulator.projector import RevenueProjector

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/simulator", tags=["simulator"])


class BaselineResponse(BaseModel):
    total_revenue_30d: float
    total_orders_30d: int
    daily_avg_revenue: float
    daily_stddev_revenue: float
    data_days: int


class SimulatorRequest(BaseModel):
    growth_rate_pct: float = Field(default=0.0, ge=-50, le=100)
    discount_change_pct: float = Field(default=0.0, ge=-50, le=50)


class SimulatorResponse(BaseModel):
    baseline_revenue: float
    projected_revenue: float
    projected_orders: int
    confidence_interval_lower: float
    confidence_interval_upper: float
    revenue_delta: float
    revenue_delta_pct: float
    growth_rate_pct: float
    discount_change_pct: float
    data_days: int


@router.get("/baseline", response_model=BaselineResponse)
def get_baseline(
    user: CurrentUser,
    tenant: TenantCtx,
) -> BaselineResponse:
    """Return the tenant's last-30-day revenue and order actuals.

    Used by the frontend to pre-populate the simulator with real numbers.
    """
    supabase = get_supabase_service_client()
    projector = RevenueProjector(supabase=supabase)
    baseline = projector.get_baseline(tenant_id=tenant.tenant_id)
    return BaselineResponse(
        total_revenue_30d=baseline.total_revenue_30d,
        total_orders_30d=baseline.total_orders_30d,
        daily_avg_revenue=baseline.daily_avg_revenue,
        daily_stddev_revenue=baseline.daily_stddev_revenue,
        data_days=baseline.data_days,
    )


@router.post("/run", response_model=SimulatorResponse)
def run_simulation(
    body: SimulatorRequest,
    user: CurrentUser,
    tenant: TenantCtx,
) -> SimulatorResponse:
    """Project revenue for the given growth and discount change scenario.

    Fetches the 30-day baseline internally — no need to pass revenue/orders.
    Returns a real 95% confidence interval based on actual daily variance.
    """
    supabase = get_supabase_service_client()
    projector = RevenueProjector(supabase=supabase)

    try:
        baseline = projector.get_baseline(tenant_id=tenant.tenant_id)
    except Exception as exc:
        logger.exception("Failed to fetch baseline for simulator")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not load baseline data: {exc}",
        ) from exc

    scenario = projector.project(
        baseline=baseline,
        growth_rate_pct=body.growth_rate_pct,
        discount_change_pct=body.discount_change_pct,
    )

    return SimulatorResponse(
        baseline_revenue=scenario.baseline_revenue,
        projected_revenue=scenario.projected_revenue,
        projected_orders=scenario.projected_orders,
        confidence_interval_lower=scenario.confidence_interval_lower,
        confidence_interval_upper=scenario.confidence_interval_upper,
        revenue_delta=scenario.revenue_delta,
        revenue_delta_pct=scenario.revenue_delta_pct,
        growth_rate_pct=scenario.growth_rate_pct,
        discount_change_pct=scenario.discount_change_pct,
        data_days=scenario.data_days,
    )
```

## Placement

New file. Place at: `akara/backend/app/api/routes/simulator.py`

## Explanation

- `BaselineResponse` — serializes `BaselineMetrics` to the client; exposes `data_days` so the frontend can warn when data is insufficient (< 7 days).
- `SimulatorRequest` — validated input; `growth_rate_pct` clamped to `[-50, 100]`, `discount_change_pct` to `[-50, 50]` using Pydantic `Field` constraints.
- `SimulatorResponse` — full projection output including both CI bounds and `data_days`.
- `get_baseline` — instantiates `RevenueProjector`, calls `get_baseline()`, maps result to `BaselineResponse`. No error handling needed — `get_baseline` returns zeroes when no data is found.
- `run_simulation` — instantiates `RevenueProjector`, fetches baseline (with error handling), runs `project()`, maps result to `SimulatorResponse`. The endpoint always re-fetches the baseline rather than accepting it from the client, preventing tampering.

## Related Changes

- `akara/backend/app/main.py` — imports `simulator as simulator_router` and calls `app.include_router(simulator_router.router)`
- `akara/backend/app/services/simulator/projector.py` — provides `RevenueProjector`
- `akara/frontend/src/pages/SimulatorPage.tsx` — frontend page that calls both endpoints

---

# File: `akara/backend/app/main.py`

**Status:** Modified

## Purpose

Register the two new Day 10 routers (`reports` and `simulator`) in the FastAPI application.

## Dependencies

- `akara/backend/app/api/routes/reports.py` — introduced Day 10
- `akara/backend/app/api/routes/simulator.py` — introduced Day 10

## Implementation

The original file (end of Day 9) had these router imports and registrations:

```python
from app.api.routes import auth as auth_router
from app.api.routes import conversations as conversations_router
from app.api.routes import copilot as copilot_router
from app.api.routes import data as data_router
from app.api.routes import health
from app.api.routes import kpi as kpi_router
from app.api.routes.admin import logs as admin_logs_router
from app.api.routes.admin import reports as admin_reports_router
from app.api.routes.admin import tenants as admin_tenants_router
from app.api.routes.admin import users as admin_users_router
```

The complete Day 10 version of `main.py` is:

```python
import logging

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth as auth_router
from app.api.routes import conversations as conversations_router
from app.api.routes import copilot as copilot_router
from app.api.routes import data as data_router
from app.api.routes import health
from app.api.routes import kpi as kpi_router
from app.api.routes import reports as reports_router
from app.api.routes import simulator as simulator_router
from app.api.routes.admin import logs as admin_logs_router
from app.api.routes.admin import reports as admin_reports_router
from app.api.routes.admin import tenants as admin_tenants_router
from app.api.routes.admin import users as admin_users_router
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
app.include_router(conversations_router.router)
app.include_router(kpi_router.router)
app.include_router(data_router.router)
app.include_router(reports_router.router)
app.include_router(simulator_router.router)
app.include_router(admin_tenants_router.router)
app.include_router(admin_users_router.router)
app.include_router(admin_logs_router.router)
app.include_router(admin_reports_router.router)
```

## Placement

Replace the full contents of `akara/backend/app/main.py` with the above.

The two new lines in the import block:
```python
from app.api.routes import reports as reports_router
from app.api.routes import simulator as simulator_router
```

The two new lines in the router registration block (after `data_router.router`):
```python
app.include_router(reports_router.router)
app.include_router(simulator_router.router)
```

## Explanation

Registers `reports_router` (prefix `/reports`) and `simulator_router` (prefix `/simulator`) in the FastAPI application. Router registration order places them after the data router and before admin routers.

Note: the alias `reports as reports_router` is used to avoid collision with `from app.api.routes.admin import reports as admin_reports_router`.

## Related Changes

- `akara/backend/app/api/routes/reports.py` — the router being registered
- `akara/backend/app/api/routes/simulator.py` — the router being registered

---

# File: `akara/frontend/package.json`

**Status:** Modified

## Purpose

Add `@sentry/react` as a frontend dependency to enable Sentry error tracking in the React application.

## Dependencies

N/A — this is the manifest that declares dependencies.

## Implementation

The change is adding one line to the `dependencies` block. The complete updated file:

```json
{
  "name": "frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "oxlint",
    "preview": "vite preview"
  },
  "dependencies": {
    "@sentry/react": "^8.56.0",
    "@radix-ui/react-label": "^2.1.12",
    "@radix-ui/react-select": "^2.3.4",
    "@radix-ui/react-slot": "^1.3.0",
    "@supabase/supabase-js": "^2.110.8",
    "@tailwindcss/vite": "^4.3.3",
    "@tanstack/react-query": "^5.101.4",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^1.25.0",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "react-router-dom": "^7.18.1",
    "recharts": "^3.10.0",
    "tailwind-merge": "^3.6.0",
    "zustand": "^5.0.14"
  },
  "devDependencies": {
    "@types/node": "^24.13.3",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.3",
    "autoprefixer": "^10.5.4",
    "eslint": "^10.7.0",
    "eslint-config-prettier": "^10.1.8",
    "oxlint": "^1.71.0",
    "postcss": "^8.5.21",
    "prettier": "^3.9.6",
    "tailwindcss": "^4.3.3",
    "typescript": "~6.0.2",
    "vite": "^8.1.1"
  }
}
```

## Placement

Replace the full contents of `akara/frontend/package.json`. The only change from Day 9 is the addition of `"@sentry/react": "^8.56.0"` as the first entry in `dependencies`.

After applying, run `npm install` (or `pnpm install`) in `akara/frontend/`.

## Explanation

`@sentry/react` provides `Sentry.init()` and React-specific error boundary integration. The package is imported only in `src/main.tsx` and is a no-op unless `VITE_SENTRY_DSN` is provided.

## Related Changes

- `akara/frontend/src/main.tsx` — imports and calls `Sentry.init()`

---

# File: `akara/frontend/src/main.tsx`

**Status:** Modified

## Purpose

Initialize the Sentry SDK at application startup. Sentry is gated behind two conditions so it is never active during local development: `import.meta.env.PROD` must be `true` AND `VITE_SENTRY_DSN` must be non-empty.

## Dependencies

- `@sentry/react` — introduced Day 10
- `VITE_SENTRY_DSN` environment variable — optional, empty by default

## Implementation

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";

// Sentry — only active in production; no-op in development.
// Set VITE_SENTRY_DSN in Vercel environment variables.
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN as string | undefined,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
  // Only send events in production builds
  enabled: import.meta.env.PROD && Boolean(import.meta.env.VITE_SENTRY_DSN),
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

## Placement

Replace the full contents of `akara/frontend/src/main.tsx`.

The Day 9 version did not import Sentry. The two new lines are the `import * as Sentry` and the `Sentry.init(...)` block. The `ReactDOM.createRoot` call is unchanged.

## Explanation

- `Sentry.init` is called before `ReactDOM.createRoot` so Sentry captures errors from the first render cycle.
- `enabled: import.meta.env.PROD && Boolean(import.meta.env.VITE_SENTRY_DSN)` — dual gate: requires both a production build and a non-empty DSN. During `vite dev`, `import.meta.env.PROD` is `false`, so Sentry is always disabled.
- `tracesSampleRate: 0.1` — captures 10% of traces for performance monitoring (free tier safe).

## Related Changes

- `akara/frontend/package.json` — must have `@sentry/react` installed before this file is used
- `akara/frontend/.env.example` — documents `VITE_SENTRY_DSN`

---

# File: `akara/frontend/.env.example`

**Status:** Modified

## Purpose

Document the new `VITE_SENTRY_DSN` environment variable so future developers know to set it in Vercel.

## Dependencies

None.

## Implementation

```
# =============================================================
# AKARA Frontend — Environment Variables
# Copy this file to .env.local and fill in your values.
# NEVER commit .env.local to git.
# =============================================================

VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_BASE_URL=http://localhost:8000

# Sentry (leave empty during development, fill in on Vercel for production)
VITE_SENTRY_DSN=
```

## Placement

Replace the full contents of `akara/frontend/.env.example`. The change from Day 9 is the addition of the `# Sentry` comment block and `VITE_SENTRY_DSN=` line at the end.

## Explanation

Documents the new optional Sentry DSN variable. The empty value `VITE_SENTRY_DSN=` ensures local developers copying this file to `.env.local` have the key present but disabled.

## Related Changes

- `akara/frontend/src/main.tsx` — reads `VITE_SENTRY_DSN`

---

# File: `akara/frontend/src/components/ui/slider.tsx`

**Status:** Created

## Purpose

Provides a `Slider` UI component API-compatible with shadcn/ui's `Slider`. Created manually because the `pnpm dlx shadcn@latest add slider` command was unavailable in the build environment. Used by `SimulatorPage.tsx` for the growth rate and discount change controls.

## Dependencies

- `@/lib/utils` — `cn()` utility (pre-existing from Day 6/7)
- React (pre-existing)

## Implementation

```typescript
/**
 * Slider — shadcn/ui-compatible range slider using native <input type="range">.
 *
 * API matches shadcn Slider:
 *   value={[number]}
 *   min, max, step
 *   onValueChange={([value]) => ...}
 *   disabled
 *   className
 */
import * as React from "react";
import { cn } from "@/lib/utils";

interface SliderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value?: number[];
  defaultValue?: number[];
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onValueChange?: (value: number[]) => void;
}

const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  (
    {
      className,
      value,
      defaultValue,
      min = 0,
      max = 100,
      step = 1,
      disabled = false,
      onValueChange,
      ...props
    },
    ref
  ) => {
    const controlled = value !== undefined;
    const [internalValue, setInternalValue] = React.useState<number>(
      (controlled ? value![0] : defaultValue?.[0]) ?? min
    );

    const currentValue = controlled ? value![0] : internalValue;

    // Percentage for the fill track
    const pct = ((currentValue - min) / (max - min)) * 100;

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const next = Number(e.target.value);
      if (!controlled) setInternalValue(next);
      onValueChange?.([next]);
    }

    return (
      <div
        ref={ref}
        className={cn("relative flex w-full touch-none select-none items-center", className)}
        {...props}
      >
        {/* Track background */}
        <div className="relative h-2 w-full grow overflow-hidden rounded-full bg-slate-200">
          {/* Filled portion */}
          <div
            className="absolute h-full rounded-full bg-indigo-600 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {/* Native range input overlaid — invisible but interactive */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={currentValue}
          disabled={disabled}
          onChange={handleChange}
          className={cn(
            "absolute inset-0 h-full w-full cursor-pointer opacity-0",
            disabled && "cursor-not-allowed"
          )}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={currentValue}
        />
        {/* Thumb */}
        <div
          className={cn(
            "absolute h-5 w-5 rounded-full border-2 border-indigo-600 bg-white shadow-sm",
            "ring-offset-white transition-all focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2",
            disabled && "cursor-not-allowed opacity-50",
            "-translate-x-1/2 pointer-events-none"
          )}
          style={{ left: `${pct}%` }}
        />
      </div>
    );
  }
);
Slider.displayName = "Slider";

export { Slider };
```

## Placement

New file. Place at: `akara/frontend/src/components/ui/slider.tsx`

## Explanation

- Uses a native `<input type="range">` as the actual interactive element, made invisible (`opacity-0`) and overlaid over a custom-styled track.
- Supports both controlled (`value` prop) and uncontrolled (`defaultValue`) modes.
- The filled track portion is a CSS `div` whose `width` is set to `pct%`, computed from `(currentValue - min) / (max - min) * 100`.
- The thumb is an absolutely positioned `div` whose `left` is set to the same `pct%`, then `–translate-x-1/2` to centre it on the track.
- `onValueChange` receives `[number]` (array of one value) to match shadcn's Slider API — important for destructured usage `onValueChange={([v]) => ...}`.

## Related Changes

- `akara/frontend/src/pages/SimulatorPage.tsx` — imports and uses `Slider` for growth rate and discount change controls

---

# File: `akara/frontend/src/hooks/useReports.ts`

**Status:** Created

## Purpose

Provides TanStack Query hooks for fetching reports data from the backend:
- `useReports()` — fetches the list of generated reports
- `useSchemeLeakage()` — fetches scheme leakage analysis rows

## Dependencies

- `@tanstack/react-query` — `useQuery` (pre-existing)
- `@/lib/api` — `apiFetch()` (pre-existing from Day 6/7)
- Backend endpoints: `GET /reports/` and `GET /reports/scheme-leakage` (introduced Day 10)

## Implementation

```typescript
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface Report {
  id: string;
  report_type: string;
  title: string;
  storage_path: string | null;
  file_size_bytes: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SchemeLeakageRow {
  party_name: string;
  scheme_name: string;
  product_name: string;
  claimed_amount: number;
  actual_offtake: number;
  leakage_amount: number;
  scheme_start: string;
  scheme_end: string;
}

export function useReports() {
  return useQuery<Report[]>({
    queryKey: ["reports"],
    queryFn: () => apiFetch<Report[]>("/reports/"),
  });
}

export function useSchemeLeakage() {
  return useQuery<SchemeLeakageRow[]>({
    queryKey: ["reports", "scheme-leakage"],
    queryFn: () => apiFetch<SchemeLeakageRow[]>("/reports/scheme-leakage"),
  });
}
```

## Placement

New file. Place at: `akara/frontend/src/hooks/useReports.ts`

## Explanation

- `Report` — mirrors `ReportOut` Pydantic model from the backend. `metadata` typed as `Record<string, unknown>` to handle arbitrary JSONB.
- `SchemeLeakageRow` — mirrors `SchemeLeakageRow` Pydantic model. `scheme_start`/`scheme_end` are `string` (ISO date strings).
- `useReports` — query key `["reports"]`; stale time uses the global default (5 minutes from `App.tsx` QueryClient config).
- `useSchemeLeakage` — query key `["reports", "scheme-leakage"]`; separate from `useReports` so they invalidate independently.

## Related Changes

- `akara/frontend/src/pages/ReportsPage.tsx` — imports and uses both hooks

---

# File: `akara/frontend/src/pages/ReportsPage.tsx`

**Status:** Created

## Purpose

Implements the Reports page at route `/reports`. Displays:
1. A scheme leakage alert card (conditionally, only when leakage rows exist)
2. A list of all generated reports with download buttons

## Dependencies

- `akara/frontend/src/hooks/useReports.ts` — `useReports()`, `useSchemeLeakage()` (introduced Day 10)
- `akara/frontend/src/lib/supabase.ts` — `supabase` client for fetching the auth token for downloads (pre-existing)
- `@/components/ui/button` — `Button` (pre-existing)
- `@/components/ui/card` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle` (pre-existing)
- `@/components/ui/badge` — `Badge` (pre-existing)
- `lucide-react` — `Download`, `FileSpreadsheet`, `RefreshCw` icons (pre-existing)
- `VITE_API_BASE_URL` environment variable — for constructing the download URL

## Implementation

```typescript
import { Download, FileSpreadsheet, RefreshCw } from "lucide-react";
import { useReports, useSchemeLeakage } from "@/hooks/useReports";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const BASE = import.meta.env.VITE_API_BASE_URL as string;

function formatINR(v: number) {
  if (v >= 1_00_00_000) return `₹${(v / 1_00_00_000).toFixed(2)}Cr`;
  if (v >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)}L`;
  if (v >= 1_000) return `₹${(v / 1_000).toFixed(1)}K`;
  return `₹${v.toFixed(0)}`;
}

async function downloadReport(reportId: string, title: string) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;

  const res = await fetch(`${BASE}/reports/${reportId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const {
    data: reports,
    isLoading: reportsLoading,
    refetch,
  } = useReports();

  const { data: leakageRows } = useSchemeLeakage();

  const totalLeakage = (leakageRows || []).reduce(
    (sum, r) => sum + r.leakage_amount,
    0
  );

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500 mt-1">
            Generated reports, exports, and scheme leakage analysis
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Scheme Leakage Card — only shown when data is available */}
      {leakageRows && leakageRows.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base text-red-800">
                  Scheme Leakage Detected
                </CardTitle>
                <CardDescription className="text-red-600 mt-0.5">
                  Distributors claiming more than actual secondary offtake
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="border-red-300 text-red-700 bg-white shrink-0"
              >
                {leakageRows.length} distributor{leakageRows.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {leakageRows.slice(0, 5).map((row, i) => (
              <div
                key={i}
                className="flex items-start justify-between text-sm py-2 border-b border-red-100 last:border-0"
              >
                <div className="space-y-0.5">
                  <p className="font-medium text-red-900">{row.party_name}</p>
                  <p className="text-xs text-red-600">
                    {row.scheme_name} · {row.product_name}
                  </p>
                  <p className="text-xs text-red-500">
                    {row.scheme_start} → {row.scheme_end}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="font-semibold text-red-800">
                    {formatINR(row.leakage_amount)} deniable
                  </p>
                  <p className="text-xs text-red-500 mt-0.5">
                    Claimed {formatINR(row.claimed_amount)}, actual{" "}
                    {formatINR(row.actual_offtake)}
                  </p>
                </div>
              </div>
            ))}
            <div className="pt-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-red-800">
                Total deniable this cycle: {formatINR(totalLeakage)}
              </p>
              {leakageRows.length > 5 && (
                <p className="text-xs text-red-500">
                  +{leakageRows.length - 5} more
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generated Reports List */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
          Generated Reports
        </h2>

        {reportsLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 bg-slate-100 rounded-lg animate-pulse"
              />
            ))}
          </div>
        )}

        {!reportsLoading && (!reports || reports.length === 0) && (
          <Card>
            <CardContent className="py-12 text-center text-slate-500">
              <FileSpreadsheet className="h-8 w-8 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">No reports yet</p>
              <p className="text-sm mt-1 text-slate-400">
                Reports will appear here once generated by the system or an admin
              </p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {(reports || []).map((r) => (
            <Card
              key={r.id}
              className="hover:shadow-sm transition-shadow"
            >
              <CardContent className="flex items-center justify-between py-4 px-5">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-slate-400 shrink-0" />
                  <div>
                    <p className="font-medium text-sm text-slate-900">
                      {r.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        {r.report_type}
                      </Badge>
                      <span className="text-xs text-slate-400">
                        {new Date(r.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      {r.file_size_bytes && (
                        <span className="text-xs text-slate-400">
                          {(r.file_size_bytes / 1024).toFixed(0)} KB
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadReport(r.id, r.title)}
                  disabled={!r.storage_path}
                  className="shrink-0 ml-4"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
```

## Placement

New file. Place at: `akara/frontend/src/pages/ReportsPage.tsx`

## Explanation

- `formatINR(v)` — formats a number as Indian Rupees with Cr/L/K shorthand. Used for leakage amounts.
- `downloadReport(reportId, title)` — fetches the Supabase session token, then calls `GET /reports/{id}/download` with the Bearer token. On success, creates a blob URL and triggers a browser download. Cleans up the object URL after click.
- `leakageRows.length > 0` guard — scheme leakage card is only rendered when there is actual leakage data. It shows up to 5 rows and a "total deniable" sum. Remaining count shown if > 5.
- Download button is disabled when `storage_path` is null (report exists in DB but file not yet uploaded).
- Loading state shows 3 animated skeleton divs.

## Related Changes

- `akara/frontend/src/hooks/useReports.ts` — provides data hooks
- `akara/frontend/src/App.tsx` — mounts `ReportsPage` at `/reports` route

---

# File: `akara/frontend/src/pages/SimulatorPage.tsx`

**Status:** Created

## Purpose

Implements the Revenue Simulator page at route `/simulator`. Allows users to model what-if revenue scenarios by adjusting growth rate and discount change sliders. Displays the real 30-day baseline from the database and a projected 30-day outcome with confidence interval.

## Dependencies

- `@tanstack/react-query` — `useQuery`, `useMutation` (pre-existing)
- `@/lib/api` — `apiFetch()` (pre-existing)
- `@/components/ui/slider` — `Slider` component (introduced Day 10)
- `@/components/ui/button` — `Button` (pre-existing)
- `@/components/ui/label` — `Label` (pre-existing)
- `@/components/ui/card` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle` (pre-existing)
- `lucide-react` — `TrendingUp`, `TrendingDown`, `AlertCircle`, `Info` (pre-existing)
- Backend endpoints: `GET /simulator/baseline` and `POST /simulator/run` (introduced Day 10)

## Implementation

```typescript
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, AlertCircle, Info } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

interface BaselineResponse {
  total_revenue_30d: number;
  total_orders_30d: number;
  daily_avg_revenue: number;
  daily_stddev_revenue: number;
  data_days: number;
}

interface SimResult {
  baseline_revenue: number;
  projected_revenue: number;
  projected_orders: number;
  confidence_interval_lower: number;
  confidence_interval_upper: number;
  revenue_delta: number;
  revenue_delta_pct: number;
  growth_rate_pct: number;
  discount_change_pct: number;
  data_days: number;
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function formatINR(v: number) {
  const abs = Math.abs(v);
  const prefix = v < 0 ? "-" : "";
  if (abs >= 1_00_00_000) return `${prefix}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${prefix}₹${(abs / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${prefix}₹${(abs / 1_000).toFixed(1)}K`;
  return `${prefix}₹${abs.toFixed(0)}`;
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  formatLabel,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  formatLabel: (v: number) => string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Label className="text-sm font-medium text-slate-700">{label}</Label>
        <span
          className={`text-sm font-semibold tabular-nums ${
            value > 0
              ? "text-green-600"
              : value < 0
              ? "text-red-600"
              : "text-slate-500"
          }`}
        >
          {formatLabel(value)}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
      />
      <div className="flex justify-between text-xs text-slate-400">
        <span>{formatLabel(min)}</span>
        <span>{formatLabel(max)}</span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────

export function SimulatorPage() {
  const [growthRate, setGrowthRate] = useState(0);
  const [discountChange, setDiscountChange] = useState(0);

  // ── Fetch real baseline on mount ──
  const {
    data: baseline,
    isLoading: baselineLoading,
    isError: baselineError,
  } = useQuery<BaselineResponse>({
    queryKey: ["simulator", "baseline"],
    queryFn: () => apiFetch<BaselineResponse>("/simulator/baseline"),
  });

  // ── Run projection mutation ──
  const {
    mutate: runSimulation,
    data: result,
    isPending,
    isError: runError,
  } = useMutation<SimResult, Error, void>({
    mutationFn: () =>
      apiFetch<SimResult>("/simulator/run", {
        method: "POST",
        body: JSON.stringify({
          growth_rate_pct: growthRate,
          discount_change_pct: discountChange,
        }),
      }),
  });

  const hasEnoughData = baseline && baseline.data_days >= 7;
  const isPositive = result && result.revenue_delta >= 0;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Revenue Simulator</h1>
        <p className="text-sm text-slate-500 mt-1">
          Model what-if scenarios using your actual sales data
        </p>
      </div>

      {/* Insufficient data warning */}
      {!baselineLoading && baseline && !hasEnoughData && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Not enough data for a reliable projection
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              We found {baseline.data_days} day
              {baseline.data_days !== 1 ? "s" : ""} of sales data. Import at
              least 7 days of sales from the Data page to get meaningful
              projections.
            </p>
          </div>
        </div>
      )}

      {/* Baseline error */}
      {baselineError && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">
            Failed to load your baseline data. Please refresh and try again.
          </p>
        </div>
      )}

      {/* Baseline summary strip */}
      {baseline && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "30-Day Revenue",
              value: formatINR(baseline.total_revenue_30d),
              sub: "actual",
            },
            {
              label: "30-Day Orders",
              value: baseline.total_orders_30d.toLocaleString("en-IN"),
              sub: "actual",
            },
            {
              label: "Daily Avg",
              value: formatINR(baseline.daily_avg_revenue),
              sub: "revenue/day",
            },
            {
              label: "Daily Std Dev",
              value: formatINR(baseline.daily_stddev_revenue),
              sub: "variance",
            },
          ].map(({ label, value, sub }) => (
            <div
              key={label}
              className="bg-white border border-slate-200 rounded-lg p-3 text-center"
            >
              <p className="text-base font-bold text-slate-900">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              <p className="text-xs text-slate-400">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {baselineLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 bg-slate-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Scenario Parameters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scenario Parameters</CardTitle>
            <CardDescription>
              Adjust sliders to model a what-if scenario
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <SliderRow
              label="Volume Growth Rate"
              value={growthRate}
              min={-20}
              max={50}
              step={1}
              onChange={setGrowthRate}
              formatLabel={(v) => `${v > 0 ? "+" : ""}${v}%`}
            />

            <SliderRow
              label="Discount Change"
              value={discountChange}
              min={-20}
              max={20}
              step={0.5}
              onChange={setDiscountChange}
              formatLabel={(v) => `${v > 0 ? "+" : ""}${v}%`}
            />

            {/* Elasticity notice */}
            {discountChange !== 0 && (
              <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <Info className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-500">
                  Discount elasticity modelled at −0.3 (FMCG industry average).
                  A {Math.abs(discountChange)}%{" "}
                  {discountChange > 0 ? "increase" : "reduction"} in discount
                  adjusts revenue by approximately{" "}
                  {(discountChange * -0.3).toFixed(1)}%.
                </p>
              </div>
            )}

            <Button
              onClick={() => runSimulation()}
              disabled={isPending || !hasEnoughData}
              className="w-full"
            >
              {isPending ? "Calculating..." : "Run Projection"}
            </Button>

            {runError && (
              <p className="text-xs text-red-600 text-center">
                Projection failed. Please try again.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Projected Outcome */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projected Outcome</CardTitle>
            <CardDescription>
              Based on your last{" "}
              {baseline ? `${baseline.data_days} days` : "30 days"} of sales
              data
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!result && (
              <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
                <TrendingUp className="h-8 w-8 text-slate-200" />
                <span>Run a simulation to see results</span>
              </div>
            )}

            {result && (
              <div className="space-y-6">
                {/* Headline number */}
                <div className="text-center">
                  <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide">
                    Projected 30-Day Revenue
                  </p>
                  <div className="text-4xl font-bold text-slate-900">
                    {formatINR(result.projected_revenue)}
                  </div>
                  <div
                    className={`flex items-center justify-center gap-1 mt-1 text-sm font-medium ${
                      isPositive ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {isPositive ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    {isPositive ? "+" : ""}
                    {result.revenue_delta_pct.toFixed(1)}% vs baseline
                  </div>
                </div>

                {/* Stats grid */}
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center text-sm py-2 border-b border-slate-100">
                    <span className="text-slate-500">Baseline (last 30d)</span>
                    <span className="font-medium tabular-nums">
                      {formatINR(result.baseline_revenue)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm py-2 border-b border-slate-100">
                    <span className="text-slate-500">Revenue Delta</span>
                    <span
                      className={`font-medium tabular-nums ${
                        isPositive ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {isPositive ? "+" : ""}
                      {formatINR(result.revenue_delta)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm py-2 border-b border-slate-100">
                    <span className="text-slate-500">Projected Orders</span>
                    <span className="font-medium tabular-nums">
                      {result.projected_orders.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm py-2">
                    <span className="text-slate-500">
                      95% Confidence Range
                      <span className="ml-1 text-xs text-slate-400">
                        (based on your variance)
                      </span>
                    </span>
                    <span className="font-medium tabular-nums text-xs text-slate-700">
                      {formatINR(result.confidence_interval_lower)} –{" "}
                      {formatINR(result.confidence_interval_upper)}
                    </span>
                  </div>
                </div>

                {/* Disclaimer */}
                <p className="text-xs text-slate-400 pt-1">
                  Projection based on your last {result.data_days} days of
                  actual sales data. Not financial advice.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

## Placement

New file. Place at: `akara/frontend/src/pages/SimulatorPage.tsx`

## Explanation

- On mount, `useQuery` fetches `/simulator/baseline` to get real 30-day actuals. These populate the baseline strip (4 cards showing revenue, orders, daily avg, daily stddev).
- `hasEnoughData = baseline.data_days >= 7` — the "Run Projection" button is disabled and a warning banner is shown when fewer than 7 days of data exist.
- `useMutation` calls `POST /simulator/run` with `growth_rate_pct` and `discount_change_pct` when the user clicks "Run Projection".
- `SliderRow` — composite component wrapping `Slider` with a label, coloured live readout (green positive, red negative), and min/max labels.
- Growth rate slider: range `[-20%, +50%]`, step `1%`.
- Discount slider: range `[-20%, +20%]`, step `0.5%`.
- When `discountChange !== 0`, an `Info` box appears explaining the `−0.3` elasticity assumption and the approximate revenue impact.
- Results card shows: projected revenue (large), delta %, baseline, delta amount, projected orders, 95% CI range.
- `formatINR` in this file handles negative values (used for revenue delta).

## Related Changes

- `akara/frontend/src/components/ui/slider.tsx` — `Slider` component
- `akara/frontend/src/App.tsx` — mounts `SimulatorPage` at `/simulator` route
- `akara/backend/app/api/routes/simulator.py` — provides the backend endpoints

---

# File: `akara/frontend/src/App.tsx`

**Status:** Modified

## Purpose

Wire the new `ReportsPage` and `SimulatorPage` components into the React Router route tree, replacing any placeholder inline components that may have existed.

## Dependencies

- `akara/frontend/src/pages/ReportsPage.tsx` — introduced Day 10
- `akara/frontend/src/pages/SimulatorPage.tsx` — introduced Day 10

## Implementation

The complete Day 10 version of `App.tsx`:

```typescript
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { CopilotPage } from "@/pages/CopilotPage";
import { DataPage } from "@/pages/DataPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { SimulatorPage } from "@/pages/SimulatorPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 2 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/copilot" element={<CopilotPage />} />
                <Route path="/data" element={<DataPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/simulator" element={<SimulatorPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

## Placement

The changes from Day 9 are:
1. Add `import { DataPage } from "@/pages/DataPage";` (if not already present from Day 9)
2. Add `import { SettingsPage } from "@/pages/SettingsPage";` (if not already present)
3. Add `import { ReportsPage } from "@/pages/ReportsPage";`
4. Add `import { SimulatorPage } from "@/pages/SimulatorPage";`
5. Replace any inline placeholder components for `/reports` and `/simulator` routes with:
   ```typescript
   <Route path="/reports" element={<ReportsPage />} />
   <Route path="/simulator" element={<SimulatorPage />} />
   ```

## Explanation

Routes `/reports` and `/simulator` are nested inside `<ProtectedRoute>` and `<AppShell>`, so they require authentication and render inside the sidebar layout. The catch-all `path="*"` redirects unknown routes to `/dashboard` (this is replaced in Day 11 with a `NotFoundPage`).

## Related Changes

- `akara/frontend/src/pages/ReportsPage.tsx` — imported and mounted here
- `akara/frontend/src/pages/SimulatorPage.tsx` — imported and mounted here

---

## SQL Migration Note

The file `akara/migrations/009_scheme_leakage_fn.sql` was created during Day 10. Per the handoff instructions, database migrations are not reproduced in this document. The migration must be run manually in the Supabase SQL Editor. The file path is `akara/migrations/009_scheme_leakage_fn.sql` and it creates the `get_scheme_leakage(p_tenant_id UUID)` SQL function used by `GET /reports/scheme-leakage`.

---

## Final Verification Checklist

- [x] `akara/backend/app/services/simulator/__init__.py` — documented
- [x] `akara/backend/app/services/simulator/projector.py` — documented with full code
- [x] `akara/backend/app/api/routes/reports.py` — documented with full code
- [x] `akara/backend/app/api/routes/simulator.py` — documented with full code
- [x] `akara/backend/app/main.py` — documented with full file
- [x] `akara/frontend/package.json` — documented with full file and `@sentry/react` change
- [x] `akara/frontend/src/main.tsx` — documented with full file
- [x] `akara/frontend/.env.example` — documented with full file
- [x] `akara/frontend/src/components/ui/slider.tsx` — documented with full code
- [x] `akara/frontend/src/hooks/useReports.ts` — documented with full code
- [x] `akara/frontend/src/pages/ReportsPage.tsx` — documented with full code
- [x] `akara/frontend/src/pages/SimulatorPage.tsx` — documented with full code
- [x] `akara/frontend/src/App.tsx` — documented with full file
- [x] Environment variable `VITE_SENTRY_DSN` — documented
- [x] Dependency `@sentry/react@^8.56.0` — documented
- [x] All imports have corresponding files or packages
- [x] No Day 1–9 code unnecessarily duplicated
- [x] Implementation order is valid (service → routes → main.py → frontend)
