---
name: Day 10 Reports + Simulator
overview: Build the Reports page (stored report listing + download + scheme leakage view) and a production-grade Revenue Projection Calculator (auto-fetch real baseline from DB, real CI from historical variance, no fake ML), then wire up Sentry on the frontend and set up UptimeRobot monitors.
todos:
  - id: reports-backend
    content: Create backend/app/api/routes/reports.py (list, download, scheme-leakage endpoints)
    status: completed
  - id: simulator-service
    content: Create backend/app/services/simulator/__init__.py and projector.py (RevenueProjector — no ML, real DB baseline + real CI)
    status: completed
  - id: simulator-route
    content: Create backend/app/api/routes/simulator.py (GET /simulator/baseline + POST /simulator/run)
    status: completed
  - id: register-routers
    content: Modify backend/app/main.py — register reports_router and simulator_router
    status: completed
  - id: scheme-leakage-sql
    content: Create migrations/009_scheme_leakage_fn.sql and run in Supabase SQL editor
    status: completed
  - id: use-reports-hook
    content: Create frontend/src/hooks/useReports.ts
    status: completed
  - id: reports-page
    content: Create frontend/src/pages/ReportsPage.tsx (list + download + scheme leakage card)
    status: completed
  - id: slider-install
    content: Install shadcn Slider component (pnpm dlx shadcn@latest add slider or manual)
    status: completed
  - id: simulator-page
    content: Create frontend/src/pages/SimulatorPage.tsx (auto-loads real baseline, shows actual CI)
    status: completed
  - id: app-routing
    content: Update frontend/src/App.tsx — replace Reports and Simulator placeholders
    status: completed
  - id: sentry-frontend
    content: Install @sentry/react, update main.tsx with Sentry.init, update .env.example
    status: completed
  - id: quality-gate
    content: Run ruff check, pytest, tsc --noEmit — all must pass
    status: completed
isProject: false
---

# Day 10 — Reports Page + Simulator Page + Sentry + UptimeRobot

## Starting State

After Day 9 the following are in place and must NOT be changed:
- `frontend/src/App.tsx` has two inline placeholder components: `const Reports` and `const Simulator` ("coming Day 10")
- `scikit-learn`, `numpy`, `pandas` already in `backend/pyproject.toml` (installed Day 1)
- `sentry-sdk[fastapi]` already installed; backend DSN already wired in `main.py` — only needs the Railway env var
- Frontend Sentry is NOT wired yet (`main.tsx` has no import)

---

## Track 1A — Reports Page (5 files)

### 1. `backend/app/api/routes/reports.py` — Created

Two endpoints:

- `GET /reports/` — list last 50 `generated_reports` rows for tenant
- `GET /reports/{report_id}/download` — fetch file bytes from Supabase Storage bucket `reports` and stream as `.xlsx`
- `GET /reports/scheme-leakage` — call `get_scheme_leakage` RPC; returns distributor-level deniable amounts

Key imports: `app.core.auth.CurrentUser`, `app.core.tenant.TenantCtx`, `get_supabase_service_client`

`TenantCtx` in `daywise.md` is spelled as `TenantCtx` in the route signatures — verify against the actual alias in `app/core/tenant.py` (`TenantContext`) and use the correct one.

### 2. `backend/app/main.py` — Modified

Add two import + register lines:
```python
from app.api.routes import reports as reports_router
from app.api.routes import simulator as simulator_router
# ...
app.include_router(reports_router.router)
app.include_router(simulator_router.router)
```

### 3. `frontend/src/hooks/useReports.ts` — Created

React Query hook wrapping `GET /reports/` via `apiFetch`. Returns `Report[]` list with `queryKey: ["reports"]`.

### 4. `frontend/src/pages/ReportsPage.tsx` — Created

- Uses `useReports()` hook for the stored report list
- Loading: 3 skeleton pulse rows
- Empty state: `FileSpreadsheet` icon with "No reports yet" message
- Each report row: title, `report_type` badge, date, file size, Download button
- Download handler: fetches `/reports/{id}/download` with JWT, triggers browser file download via object URL
- Scheme leakage section: separate fetch to `/reports/scheme-leakage`; renders a red-border `Card` only when rows are returned, showing top 5 leakage entries and a total deniable amount footer

### 5. Supabase SQL — `get_scheme_leakage` function

Add to `supabase/migrations/` as a new file (e.g. `009_scheme_leakage_fn.sql`):

```sql
CREATE OR REPLACE FUNCTION public.get_scheme_leakage(p_tenant_id UUID)
RETURNS TABLE (
    party_name TEXT, scheme_name TEXT, product_name TEXT,
    claimed_amount NUMERIC, actual_offtake NUMERIC,
    leakage_amount NUMERIC, scheme_start DATE, scheme_end DATE
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT sm.party_name, sm.scheme_name, sm.product_name,
           sm.claimed_amount,
           COALESCE(SUM(ss.total_amount), 0),
           GREATEST(sm.claimed_amount - COALESCE(SUM(ss.total_amount), 0), 0),
           sm.scheme_start, sm.scheme_end
    FROM public.scheme_master sm
    LEFT JOIN public.secondary_sales_data ss
        ON ss.tenant_id = sm.tenant_id
        AND ss.party_name = sm.party_name
        AND ss.product_name = sm.product_name
        AND ss.invoice_date BETWEEN sm.scheme_start AND sm.scheme_end
    WHERE sm.tenant_id = p_tenant_id AND sm.claimed_amount > 0
    GROUP BY sm.party_name, sm.scheme_name, sm.product_name,
             sm.claimed_amount, sm.scheme_start, sm.scheme_end
    HAVING sm.claimed_amount > COALESCE(SUM(ss.total_amount), 0)
    ORDER BY leakage_amount DESC;
$$;
```

Run manually in Supabase SQL editor.

---

## Track 1B — Revenue Projection Calculator (4 files)

**Decision: No ML.** The `daywise.md` RandomForest trains a model but never calls `model.predict()` — it's dead code. The confidence interval was hardcoded at ±8% and the discount elasticity at 0.3 regardless of tenant. This is replaced with an honest, data-driven projection calculator.

### What changes and why

| Old (daywise.md) | New (honest) |
|---|---|
| User enters baseline manually | `GET /simulator/baseline` auto-fetches tenant's last-30-day totals from DB |
| RandomForest trained, never used | No ML — transparent arithmetic |
| CI = hardcoded ±8% | CI = ±1.96 × actual daily revenue stddev from last 30 days |
| 0.3 discount elasticity hardcoded | Same (but clearly labelled as an estimate, not ML output) |

### 6. `backend/app/services/simulator/__init__.py` — Created (empty)

### 7. `backend/app/services/simulator/projector.py` — Created

`RevenueProjector` class (no scikit-learn):

```python
@dataclass
class BaselineMetrics:
    total_revenue_30d: float
    total_orders_30d: int
    daily_avg_revenue: float
    daily_stddev_revenue: float   # computed from actual daily aggregates

@dataclass
class ProjectionScenario:
    baseline_revenue: float
    projected_revenue: float
    projected_orders: int
    confidence_interval: tuple[float, float]   # ±1.96 × stddev × sqrt(30)
    revenue_delta: float
    revenue_delta_pct: float
```

`get_baseline(tenant_id)` — queries last 30 days of `sales_data`, aggregates to daily totals, computes mean and population stddev.

`project(baseline, growth_rate_pct, discount_change_pct)` — applies growth factor and discount elasticity, computes real CI using stddev from the baseline data.

### 8. `backend/app/api/routes/simulator.py` — Created

```
GET  /simulator/baseline
  Returns: BaselineMetrics (real last-30-day numbers from sales_data)

POST /simulator/run
  Body: growth_rate_pct [-50, 100], discount_change_pct [-50, 50]
  Returns: ProjectionScenario
```

The `POST /simulator/run` fetches the baseline internally — the frontend doesn't need to pass revenue/orders numbers.

### 9. `frontend/src/pages/SimulatorPage.tsx` — Created

- On mount: calls `GET /simulator/baseline` via `useQuery` — displays last-30-day revenue + orders as read-only "Your baseline" summary
- If < 7 days of data: shows amber notice "Not enough data for a reliable projection — import at least 7 days of sales first"
- Sliders: Growth Rate (-20 to +50%) and Discount Change (-20 to +20%)
- "Run Projection" button → `POST /simulator/run`
- Result card: projected revenue headline, ±% vs baseline, projected orders, delta, **real CI** labeled "95% confidence range"
- Footer label: "Based on your last 30 days of sales data" — no fake "AI forecast" language
- `formatINR()` utility (same as before)

### 10. Shadcn Slider install

```bash
cd akara/frontend
pnpm dlx shadcn@latest add slider
```

If this fails (as with past shadcn installs), create `frontend/src/components/ui/slider.tsx` manually using `@radix-ui/react-slider` — which is already a transitive dep.

---

## App.tsx wiring (1 file modified)

### 11. `frontend/src/App.tsx` — Modified

Replace both placeholder inline components:
```typescript
// Remove: const Reports = () => ... and const Simulator = () => ...
// Add:
import { ReportsPage } from "@/pages/ReportsPage";
import { SimulatorPage } from "@/pages/SimulatorPage";
// Change routes:
<Route path="/reports" element={<ReportsPage />} />
<Route path="/simulator" element={<SimulatorPage />} />
```

---

## Track 2 — Sentry Frontend + UptimeRobot (2 files + external setup)

### 12. Install `@sentry/react` in frontend

```bash
cd akara/frontend
pnpm add @sentry/react
```

### 13. `frontend/src/main.tsx` — Modified

Add Sentry init before `ReactDOM.createRoot`:
```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
  enabled: import.meta.env.PROD,
});
```

### 14. `frontend/.env.example` — Modified

Add: `VITE_SENTRY_DSN=`

### Manual steps (no code)

- **Sentry backend DSN:** Set `SENTRY_DSN=<your-dsn>` in Railway environment variables (already wired in `main.py` — just needs the value)
- **UptimeRobot:** Create free account → add two HTTP monitors:
  - `https://<railway-url>/health` — 5-minute interval
  - `https://<vercel-url>` — 5-minute interval
- **Supabase Storage:** Create private bucket named `reports` and apply the RLS policy from `daywise.md`

---

## Quality Gates

```bash
cd akara/backend
uv run ruff check .
uv run pytest
# Expected: 2 passed

cd akara/frontend
npx tsc --noEmit
# Expected: 0 errors
```

---

## End-of-Day Verification

1. `/reports` — empty state renders; insert test row via SQL, row appears with disabled Download (no storage path)
2. `/simulator` — baseline card auto-loads with last 30 days of data; set growth +10%, run → projected revenue ≈ baseline × 1.10; CI is non-trivial (computed from daily variance, not ±8%)
3. Sentry test event: in Sentry dashboard → "Send Test Event" — event appears
4. UptimeRobot: both monitors show green
