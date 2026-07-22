---
name: Day 7 Dashboard + Admin Users
overview: Build the Dashboard page (KPI cards, charts, date filter) from the `/kpi/` backend endpoint, and add the admin users API routes. All frontend state comes from `@tanstack/react-query`; charts use Recharts.
todos:
  - id: d7-install
    content: Install recharts (pnpm add recharts) and shadcn select (pnpm dlx shadcn@latest add select)
    status: completed
  - id: d7-api-ts
    content: Create frontend/src/lib/api.ts — authenticated apiFetch wrapper
    status: completed
  - id: d7-types-kpi
    content: Create frontend/src/types/kpi.ts — KPISummary, TopProduct, ZoneBreakdown, RevenueByDate, RoutePerformance, OutstandingParty, KPIResponse
    status: completed
  - id: d7-use-kpis
    content: Create frontend/src/hooks/useKPIs.ts — React Query hook for /kpi/ endpoint
    status: completed
  - id: d7-kpi-card
    content: Create frontend/src/components/dashboard/KPICard.tsx — reusable KPI card with skeleton loader
    status: completed
  - id: d7-revenue-chart
    content: Create frontend/src/components/dashboard/RevenueTrendChart.tsx — Recharts line chart
    status: completed
  - id: d7-zone-chart
    content: Create frontend/src/components/dashboard/ZoneChart.tsx — Recharts horizontal bar chart
    status: completed
  - id: d7-dashboard-page
    content: Create frontend/src/pages/DashboardPage.tsx — full dashboard with KPI cards, charts, top products, optional route/credit cards
    status: completed
  - id: d7-app-tsx
    content: Modify frontend/src/App.tsx — replace Dashboard placeholder with DashboardPage import and route
    status: completed
  - id: d7-admin-users
    content: Create backend/app/api/routes/admin/users.py — UserOut, UserRoleUpdate, GET /{tenant_id}, PATCH /{user_id}/role (use TenantContext not TenantCtx in route handlers)
    status: completed
  - id: d7-main
    content: Modify backend/app/main.py — import and register admin_users_router
    status: completed
  - id: d7-quality
    content: Run uv run ruff check . && uv run pytest — both must exit 0
    status: completed
isProject: false
---

# Day 7 — Dashboard Page (KPIs + Charts) + Admin Users API

**Goal:** `/dashboard` displays live KPI cards, a revenue trend line chart, a zone bar chart, and a top-products list — all driven by the `/kpi/` endpoint — with a date-range selector that re-fetches on change. Admin users routes added on the backend.

**Current state:** Day 6 complete. `App.tsx` has a placeholder `Dashboard` component. `package.json` has `@tanstack/react-query` but not `recharts`. No `shadcn select` component exists. `frontend/src/types/index.ts` only has `User` and `Tenant` types.

---

## Track 1 — Frontend Dashboard (8 files + 1 install)

### Step 1 — Install packages

```bash
cd akara/frontend
pnpm add recharts
pnpm dlx shadcn@latest add select
```

`recharts` is not currently in `package.json`. `shadcn select` creates `src/components/ui/select.tsx`.

---

### Step 2 — New file: [`frontend/src/lib/api.ts`](akara/frontend/src/lib/api.ts)

Generic authenticated `fetch` wrapper. Reads the Supabase session to get the JWT, then calls `VITE_API_BASE_URL + path`.

```typescript
import { supabase } from "@/lib/supabase";
const BASE = import.meta.env.VITE_API_BASE_URL as string;
async function getToken(): Promise<string> { ... }
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T>
```

Throws `Error("API {status}: {text}")` on non-2xx responses.

---

### Step 3 — New file: [`frontend/src/types/kpi.ts`](akara/frontend/src/types/kpi.ts)

All KPI TypeScript interfaces. Kept separate from `index.ts` because `DashboardPage` and `useKPIs` import from here.

Interfaces: `KPISummary`, `TopProduct`, `ZoneBreakdown`, `RevenueByDate`, `RoutePerformance`, `OutstandingParty`, `KPIResponse`.

The full `KPIResponse` shape (including `route_performance` and `outstanding_parties` for the optional cards from section 7.X):

```typescript
export interface KPIResponse {
  summary: KPISummary;
  top_products: TopProduct[];
  zone_breakdown: ZoneBreakdown[];
  revenue_trend: RevenueByDate[];
  route_performance: RoutePerformance[];
  outstanding_parties: OutstandingParty[];
  date_range_start: string;
  date_range_end: string;
}
```

---

### Step 4 — New file: [`frontend/src/hooks/useKPIs.ts`](akara/frontend/src/hooks/useKPIs.ts)

React Query hook. `queryKey: ["kpi", startDate, endDate]` — changes to the date automatically re-fetch.

```typescript
export function useKPIs(startDate: string, endDate: string): UseQueryResult<KPIResponse>
```

`staleTime: 1000 * 60 * 2` (2 min cache).

---

### Step 5 — New file: [`frontend/src/components/dashboard/KPICard.tsx`](akara/frontend/src/components/dashboard/KPICard.tsx)

Reusable card with animated pulse skeleton while `loading=true`. Accepts `icon: LucideIcon`, `trend?: "up"|"down"|"neutral"`, colors the value green/red accordingly.

---

### Step 6 — New file: [`frontend/src/components/dashboard/RevenueTrendChart.tsx`](akara/frontend/src/components/dashboard/RevenueTrendChart.tsx)

Recharts `LineChart` inside `ResponsiveContainer`. INR formatter (`₹{n}L` / `₹{n}K`). `height={260}`, no dots on the line.

---

### Step 7 — New file: [`frontend/src/components/dashboard/ZoneChart.tsx`](akara/frontend/src/components/dashboard/ZoneChart.tsx)

Recharts horizontal `BarChart` (`layout="vertical"`). Shows top 5 zones by `revenue_pct`. Each bar gets a distinct slate color from `COLORS = ["#0f172a", "#334155", ...]`.

---

### Step 8 — New file: [`frontend/src/pages/DashboardPage.tsx`](akara/frontend/src/pages/DashboardPage.tsx)

The full page component. Layout:

```
Header row: "Dashboard" title | date-range Select
KPI cards: 2-col mobile / 4-col desktop grid
Charts: Revenue Trend (2/3 width) + Zone Chart (1/3 width)
Top Products table
Route Performance card (conditional — renders only if array non-empty)
Credit Exposure card (conditional — amber theme, renders only if array non-empty)
```

`getDateRange(period)` helper converts `"7d"` / `"30d"` / `"90d"` / `"ytd"` to ISO date strings.

---

### Step 9 — Modify [`frontend/src/App.tsx`](akara/frontend/src/App.tsx)

Replace the inline `Dashboard` placeholder component with a real import:

**Remove:**
```typescript
const Dashboard = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Dashboard — coming Day 7</h1>
  </div>
);
```

**Add import at top:**
```typescript
import { DashboardPage } from "@/pages/DashboardPage";
```

**Change route:**
```typescript
// Before:
<Route path="/dashboard" element={<Dashboard />} />
// After:
<Route path="/dashboard" element={<DashboardPage />} />
```

---

## Track 2 — Backend Admin Users API (1 new file + 1 modified)

### New file: [`backend/app/api/routes/admin/users.py`](akara/backend/app/api/routes/admin/users.py)

Two endpoints on `prefix="/admin/users"`:

- `GET /{tenant_id}` — list all profiles for a tenant from `profiles` table
- `PATCH /{user_id}/role` — update a user's role (accepts `"admin"` or `"user"` only, 400 otherwise)

Both require `_require_superadmin` guard (imported from `tenants.py`).

**Known bug to avoid:** `daywise.md` shows `tenant: TenantCtx = Depends(_require_superadmin)` in the route handlers — this causes the same double-`Depends` `AssertionError` fixed on Day 5. Use `tenant: TenantContext = Depends(_require_superadmin)` instead (plain class, not the `Annotated` alias).

Pydantic models: `UserOut` (id, tenant_id, role, display_name), `UserRoleUpdate` (role).

---

### Modify [`backend/app/main.py`](akara/backend/app/main.py)

Add two lines (after the existing `admin_tenants_router` lines):

```python
from app.api.routes.admin import users as admin_users_router
# ...
app.include_router(admin_users_router.router)
```

---

## Quality Gate

```bash
cd akara/backend
uv run ruff check .
uv run pytest          # 2 tests, both pass
```

---

## New environment variable

`VITE_API_BASE_URL` — required in `frontend/.env.local`. Should already be set from Day 6 (Railway URL). No new backend env vars.

---

## End-of-day checklist

- `frontend/src/lib/api.ts` created
- `frontend/src/types/kpi.ts` created with all 7 interfaces
- `frontend/src/hooks/useKPIs.ts` created
- `frontend/src/components/dashboard/KPICard.tsx` created
- `frontend/src/components/dashboard/RevenueTrendChart.tsx` created
- `frontend/src/components/dashboard/ZoneChart.tsx` created
- `frontend/src/pages/DashboardPage.tsx` created
- `App.tsx` updated — `DashboardPage` replaces placeholder
- `recharts` in `package.json`
- `src/components/ui/select.tsx` exists (from shadcn add)
- `backend/app/api/routes/admin/users.py` created
- `backend/app/main.py` registers `admin_users_router`
- `ruff check .` and `pytest` both exit 0
