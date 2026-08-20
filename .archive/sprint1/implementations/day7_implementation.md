# Day 7 Implementation Handoff

## Reproduction Instructions

### Expected state before applying Day 7 changes

Days 1–6 must already be fully implemented as documented in:

- `docs/day1_implementation.md` — monorepo scaffold, Supabase schema, RLS, frontend scaffold
- `docs/day2_implementation.md` — FastAPI core, Pydantic settings, auth middleware, tenant context, health and auth routes
- `docs/day3_implementation.md` — LLM manager, SQL guard + executor, Copilot pipeline, copilot route
- `docs/day4_implementation.md` — KPI service + route, data export route
- `docs/day5_implementation.md` — Railway deploy config, admin tenants route
- `docs/day6_implementation.md` — Vite/React frontend deployed to Vercel, auth context, login page, app shell, protected route

The repository state before Day 7:
- `frontend/src/App.tsx` has a placeholder `Dashboard` inline component pointing to `"/dashboard"`
- `frontend/package.json` does NOT have `recharts` or `@radix-ui/react-select`
- `frontend/src/components/ui/select.tsx` does NOT exist
- `frontend/src/lib/api.ts` does NOT exist
- `frontend/src/types/kpi.ts` does NOT exist
- `frontend/src/hooks/` directory does NOT exist
- `frontend/src/components/dashboard/` directory does NOT exist
- `frontend/src/pages/DashboardPage.tsx` does NOT exist
- `backend/app/api/routes/admin/users.py` does NOT exist
- `backend/app/main.py` does NOT import or register `admin_users_router`

### Application order

Apply changes in this exact order:

1. Install npm packages (`recharts`, `@radix-ui/react-select`) in `frontend/`
2. `frontend/src/components/ui/select.tsx` (create — UI primitive required by DashboardPage)
3. `frontend/src/lib/api.ts` (create — required by useKPIs hook)
4. `frontend/src/types/kpi.ts` (create — required by useKPIs and all dashboard components)
5. `frontend/src/hooks/useKPIs.ts` (create — required by DashboardPage)
6. `frontend/src/components/dashboard/KPICard.tsx` (create — required by DashboardPage)
7. `frontend/src/components/dashboard/RevenueTrendChart.tsx` (create — required by DashboardPage)
8. `frontend/src/components/dashboard/ZoneChart.tsx` (create — required by DashboardPage)
9. `frontend/src/pages/DashboardPage.tsx` (create — requires all of the above)
10. `frontend/src/App.tsx` (modify — wire DashboardPage into router)
11. `backend/app/api/routes/admin/users.py` (create)
12. `backend/app/main.py` (modify — register admin_users_router)

### Commands after copying the code

**Frontend — install packages:**
```bash
cd akara/frontend
npm install recharts @radix-ui/react-select
```

Note: `pnpm` is NOT available in this environment. Use `npm install` instead of `pnpm add`.

**Backend quality gate:**
```bash
cd akara/backend
uv run ruff check .
uv run pytest
# Expected: All checks passed! / 2 passed
```

**Frontend type check:**
```bash
cd akara/frontend
npx tsc --noEmit
# Expected: no output (zero errors)
```

### Verification steps

1. Run `npm run dev` in `frontend/` and open `http://localhost:5173/dashboard` — the page should render with KPI card skeletons while loading.
2. Change the period selector — the URL query should update and data should re-fetch.
3. Backend: confirm `GET /admin/users/{tenant_id}` and `PATCH /admin/users/{user_id}/role` return 403 without a valid JWT.

---

## Package Changes

### `frontend/package.json`

**Status:** Modified (packages added by `npm install`)

Two packages were added to `dependencies` on Day 7:

| Package | Version added | Why |
|---|---|---|
| `recharts` | `^2.x` (latest at install time) | Charting library — `LineChart`, `BarChart`, `ResponsiveContainer`, `Cell`, etc. used by `RevenueTrendChart` and `ZoneChart` |
| `@radix-ui/react-select` | `^2.x` (latest at install time) | Headless select primitive used by `select.tsx` (the shadcn select component) |

Both are runtime dependencies. No devDependencies were changed.

The `npm install recharts @radix-ui/react-select` command modifies `package.json` and `package-lock.json` automatically. The exact versions will be resolved at install time. The code in this document is compatible with `recharts ^2.x` and `@radix-ui/react-select ^2.x`.

---

## Environment Variables

No new environment variables were introduced on Day 7.

`VITE_API_BASE_URL` — used by `frontend/src/lib/api.ts` — was introduced in Day 6 and must already be set in `frontend/.env.local` to the Railway backend URL (e.g. `https://akara-backend-production.up.railway.app`). It is consumed as `import.meta.env.VITE_API_BASE_URL` at runtime.

---

# File: `frontend/src/components/ui/select.tsx`

**Status:** Created

## Purpose

Provides the `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectValue`, and related components used by `DashboardPage.tsx` for the date-range picker. This is the standard shadcn/ui `select` component built on `@radix-ui/react-select`.

The `shadcn` CLI could not install this automatically because it requires `pnpm` (which is unavailable in this environment). The component was created manually with identical code to what `shadcn@latest add select` would generate.

## Dependencies

- `@radix-ui/react-select` — introduced on Day 7 (via `npm install @radix-ui/react-select`)
- `lucide-react` — `Check`, `ChevronDown`, `ChevronUp` icons; already in `package.json` from Day 6
- `@/lib/utils` — `cn` helper; already exists from Day 1/6

## Implementation

```typescript
"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"

function Select({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectGroup({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="size-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronUp className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronDown className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  )
}

function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border shadow-md",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className
        )}
        position={position}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default select-none items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("bg-border pointer-events-none -mx-1 my-1 h-px", className)}
      {...props}
    />
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
```

## Placement

New file. Create at:

```
akara/frontend/src/components/ui/select.tsx
```

alongside the existing shadcn UI components (`button.tsx`, `card.tsx`, `input.tsx`, etc.) that were created in Day 6.

## Explanation

Wraps every `@radix-ui/react-select` primitive in a thin styled layer using Tailwind classes via `cn`. Exported components:

- `Select` — root context provider (wraps `SelectPrimitive.Root`)
- `SelectTrigger` — the visible button that opens the dropdown; renders a `ChevronDown` icon automatically
- `SelectValue` — placeholder and selected-value display
- `SelectContent` — the dropdown panel (portalled via `SelectPrimitive.Portal`)
- `SelectItem` — a single option; shows a `Check` icon when selected
- `SelectGroup` — optional grouping wrapper
- `SelectLabel` — group label
- `SelectSeparator` — horizontal divider between groups
- `SelectScrollUpButton` / `SelectScrollDownButton` — scroll affordances for long lists

The `"use client"` directive is included for compatibility with Next.js projects even though AKARA uses Vite; it is a no-op in Vite.

## Related Changes

- `frontend/src/pages/DashboardPage.tsx` — imports `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` from this file (Day 7)

---

# File: `frontend/src/lib/api.ts`

**Status:** Created

## Purpose

Provides a single authenticated `fetch` wrapper (`apiFetch`) used by all hooks that call the FastAPI backend. Centralises JWT retrieval from the Supabase session and adds the `Authorization: Bearer` header to every request, so individual hooks do not need to handle auth manually.

## Dependencies

- `@/lib/supabase` — `supabase` client instance; created in Day 6
- `VITE_API_BASE_URL` — environment variable; set in `frontend/.env.local` (introduced Day 6)
- `@supabase/supabase-js` — `supabase.auth.getSession()` method; already in `package.json` from Day 6

## Implementation

```typescript
import { supabase } from "@/lib/supabase";

const BASE = import.meta.env.VITE_API_BASE_URL as string;

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return token;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API ${res.status}: ${errorText}`);
  }
  return res.json() as Promise<T>;
}
```

## Placement

New file at:

```
akara/frontend/src/lib/api.ts
```

alongside `supabase.ts` and `utils.ts` which already exist in `frontend/src/lib/`.

## Explanation

- `BASE` — reads `VITE_API_BASE_URL` once at module load time (e.g. `https://akara-backend-production.up.railway.app`).
- `getToken()` — private async helper; calls `supabase.auth.getSession()` on every request to always use the current (potentially refreshed) session token. Throws `"Not authenticated"` if no session exists — this propagates as a React Query error to the calling component.
- `apiFetch<T>()` — generic typed wrapper. Spreads caller-provided `options` and `headers` so callers can pass `method: "POST"`, custom headers, or a body. The caller's headers are merged *after* the defaults so they take precedence. Throws `Error("API {status}: {errorText}")` on any non-2xx response; this is caught and surfaced by React Query's `error` state.

## Related Changes

- `frontend/src/hooks/useKPIs.ts` — imports `apiFetch` (Day 7)
- All future hooks calling the backend (Days 8–10) will import `apiFetch` from this file

---

# File: `frontend/src/types/kpi.ts`

**Status:** Created

## Purpose

Defines all TypeScript interfaces that match the JSON shape of the `GET /kpi/` backend response. Kept as a separate file from `frontend/src/types/index.ts` because it is a domain-specific type group imported by multiple dashboard files.

## Dependencies

No runtime dependencies. Pure TypeScript type declarations.

The shapes mirror the Pydantic models in `backend/app/api/routes/kpi.py` (Day 4).

## Implementation

```typescript
export interface KPISummary {
  total_revenue: number;
  total_orders: number;
  unique_parties: number;
  avg_order_value: number;
  total_quantity: number;
  total_discount: number;
}

export interface TopProduct {
  product_name: string;
  total_revenue: number;
  quantity: number;
  order_count: number;
}

export interface ZoneBreakdown {
  zone: string;
  revenue: number;
  order_count: number;
  revenue_pct: number;
}

export interface RevenueByDate {
  invoice_date: string;
  revenue: number;
  orders: number;
}

export interface RoutePerformance {
  route: string;
  revenue: string;
  order_count: number;
  unique_parties: number;
  avg_order_value: string;
}

export interface OutstandingParty {
  party_name: string;
  party_zone: string | null;
  outstanding_amount: string;
  days_outstanding: number | null;
}

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

## Placement

New file at:

```
akara/frontend/src/types/kpi.ts
```

The existing `frontend/src/types/index.ts` (containing `User` and `Tenant`) is NOT modified.

## Explanation

Seven interfaces that map directly to the `/kpi/` endpoint response fields:

- `KPISummary` — aggregate metrics for the period (revenue, orders, parties, AOV, quantity, discount)
- `TopProduct` — one entry in the top-products list
- `ZoneBreakdown` — one zone's revenue share (note `revenue_pct` is a float 0–100)
- `RevenueByDate` — one day's revenue for the trend chart; `invoice_date` is `"YYYY-MM-DD"` string
- `RoutePerformance` — one delivery route's metrics; `revenue` and `avg_order_value` are `string` (decimal from Postgres)
- `OutstandingParty` — one party with credit exposure; `outstanding_amount` is `string`, `party_zone` and `days_outstanding` are nullable
- `KPIResponse` — the top-level response shape; `route_performance` and `outstanding_parties` are always present but may be empty arrays

## Related Changes

- `frontend/src/hooks/useKPIs.ts` — imports `KPIResponse` (Day 7)
- `frontend/src/components/dashboard/RevenueTrendChart.tsx` — imports `RevenueByDate` (Day 7)
- `frontend/src/components/dashboard/ZoneChart.tsx` — imports `ZoneBreakdown` (Day 7)
- `frontend/src/pages/DashboardPage.tsx` — consumes all interfaces indirectly via `useKPIs` (Day 7)

---

# File: `frontend/src/hooks/useKPIs.ts`

**Status:** Created

## Purpose

React Query hook that fetches KPI data from `GET /kpi/?start_date=...&end_date=...`. Wraps `apiFetch` so that `DashboardPage` gets automatic caching, background refetch, loading states, and error states without manual `useEffect` + `useState` management.

## Dependencies

- `@tanstack/react-query` — `useQuery`; already in `package.json` from Day 6
- `@/lib/api` — `apiFetch`; created Day 7
- `@/types/kpi` — `KPIResponse`; created Day 7

## Implementation

```typescript
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { KPIResponse } from "@/types/kpi";

export function useKPIs(startDate: string, endDate: string) {
  return useQuery<KPIResponse>({
    queryKey: ["kpi", startDate, endDate],
    queryFn: () =>
      apiFetch<KPIResponse>(
        `/kpi/?start_date=${startDate}&end_date=${endDate}`
      ),
    staleTime: 1000 * 60 * 2,
  });
}
```

## Placement

New file at:

```
akara/frontend/src/hooks/useKPIs.ts
```

The `frontend/src/hooks/` directory is created on Day 7 (it did not exist before).

## Explanation

- `queryKey: ["kpi", startDate, endDate]` — React Query caches the result keyed by the three-element tuple. When `startDate` or `endDate` changes (e.g. user switches the period dropdown), React Query automatically refetches because the key changes.
- `queryFn` — calls `apiFetch<KPIResponse>` with the date parameters as query string arguments. `apiFetch` adds the JWT and throws on non-2xx, which React Query surfaces as `error`.
- `staleTime: 1000 * 60 * 2` — data is considered fresh for 2 minutes. Background refetches are suppressed within that window even if the component re-mounts.
- Return type is inferred as `UseQueryResult<KPIResponse>`, giving the caller `data`, `isLoading`, `error`, `isFetching`, etc.

## Related Changes

- `frontend/src/pages/DashboardPage.tsx` — calls `useKPIs(start, end)` (Day 7)

---

# File: `frontend/src/components/dashboard/KPICard.tsx`

**Status:** Created

## Purpose

Reusable metric card component. Displays a labelled number with an icon, optional subtitle, optional trend colouring, and a pulse skeleton while data is loading. Used four times in `DashboardPage` (Revenue, Orders, Parties, AOV).

## Dependencies

- `@/components/ui/card` — `Card`, `CardContent`, `CardHeader`, `CardTitle`; created Day 6
- `lucide-react` — `LucideIcon` type; already in `package.json` from Day 6
- `@/lib/utils` — `cn`; already exists from Day 1/6

## Implementation

```typescript
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  loading?: boolean;
}

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  loading,
}: KPICardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-slate-400" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 bg-slate-100 rounded animate-pulse" />
        ) : (
          <>
            <div
              className={cn(
                "text-2xl font-bold",
                trend === "up" && "text-green-600",
                trend === "down" && "text-red-600"
              )}
            >
              {value}
            </div>
            {subtitle && (
              <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

## Placement

New file at:

```
akara/frontend/src/components/dashboard/KPICard.tsx
```

The `frontend/src/components/dashboard/` directory is created on Day 7.

## Explanation

- `loading=true` renders a `h-8` grey div with `animate-pulse` (Tailwind skeleton) instead of the value.
- `trend` conditionally adds `text-green-600` (up) or `text-red-600` (down) to the value `div`. No class is added for `"neutral"` or when `trend` is `undefined`.
- `icon` is typed as `LucideIcon` (a React component type) and destructured as `Icon` so it can be used as JSX.
- `subtitle` renders below the value in small grey text; optional.

## Related Changes

- `frontend/src/pages/DashboardPage.tsx` — renders four `KPICard` instances (Day 7)

---

# File: `frontend/src/components/dashboard/RevenueTrendChart.tsx`

**Status:** Created

## Purpose

Recharts line chart showing daily revenue over the selected period. Rendered inside the "Revenue Trend" card in `DashboardPage`.

## Dependencies

- `recharts` — `LineChart`, `Line`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ResponsiveContainer`; installed Day 7
- `@/types/kpi` — `RevenueByDate`; created Day 7

## Implementation

```typescript
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { RevenueByDate } from "@/types/kpi";

interface Props {
  data: RevenueByDate[];
}

function formatINR(value: number): string {
  if (value >= 10_00_000) return `₹${(value / 10_00_000).toFixed(1)}L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(0)}K`;
  return `₹${value.toFixed(0)}`;
}

export function RevenueTrendChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="invoice_date"
          tick={{ fontSize: 12, fill: "#94a3b8" }}
          tickFormatter={(v) => v.slice(5)}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#94a3b8" }}
          tickFormatter={formatINR}
          width={60}
        />
        <Tooltip
          formatter={(v: number) => [formatINR(v), "Revenue"]}
          labelStyle={{ color: "#1e293b" }}
        />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="#0f172a"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#0f172a" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

## Placement

New file at:

```
akara/frontend/src/components/dashboard/RevenueTrendChart.tsx
```

## Explanation

- `ResponsiveContainer width="100%" height={260}` — fills the card's available width and fixes a 260 px height.
- `XAxis tickFormatter={(v) => v.slice(5)}` — strips the year prefix from `"YYYY-MM-DD"`, showing only `"MM-DD"` to save horizontal space.
- `YAxis tickFormatter={formatINR}` — formats axis labels in INR shorthand: values ≥ 10L (1,000,000) show as `₹{n}L`; values ≥ 1K show as `₹{n}K`; smaller values show the raw rupee amount.
- `dot={false}` — suppresses individual data-point dots for a cleaner line.
- `activeDot={{ r: 4, fill: "#0f172a" }}` — shows a small dark dot only on hover.
- `Tooltip formatter` — same INR formatter applied to the tooltip value label.

## Related Changes

- `frontend/src/pages/DashboardPage.tsx` — renders `<RevenueTrendChart data={data?.revenue_trend || []} />` (Day 7)

---

# File: `frontend/src/components/dashboard/ZoneChart.tsx`

**Status:** Created

## Purpose

Recharts horizontal bar chart showing top-5 zones by revenue percentage share. Rendered inside the "Revenue by Zone" card in `DashboardPage`.

## Dependencies

- `recharts` — `BarChart`, `Bar`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ResponsiveContainer`, `Cell`; installed Day 7
- `@/types/kpi` — `ZoneBreakdown`; created Day 7

## Implementation

```typescript
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { ZoneBreakdown } from "@/types/kpi";

const COLORS = ["#0f172a", "#334155", "#64748b", "#94a3b8", "#cbd5e1"];

interface Props {
  data: ZoneBreakdown[];
}

export function ZoneChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={data.slice(0, 5)}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} />
        <YAxis
          dataKey="zone"
          type="category"
          tick={{ fontSize: 11, fill: "#64748b" }}
          width={60}
        />
        <Tooltip
          formatter={(v: number) => [`${v.toFixed(1)}%`, "Revenue share"]}
        />
        <Bar dataKey="revenue_pct" radius={[0, 4, 4, 0]}>
          {data.slice(0, 5).map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
```

## Placement

New file at:

```
akara/frontend/src/components/dashboard/ZoneChart.tsx
```

## Explanation

- `layout="vertical"` — makes the bars horizontal (zone names on the Y axis, percentages on the X axis).
- `data.slice(0, 5)` — caps at 5 zones in both the chart data and the `Cell` loop.
- `COLORS` — five slate shades from darkest to lightest; wraps with `% COLORS.length` if there are more than 5 zones.
- `CartesianGrid horizontal={false}` — shows only vertical grid lines, which look cleaner on a horizontal bar chart.
- `radius={[0, 4, 4, 0]}` — rounds the right end of each bar.
- `Tooltip formatter` — shows `"{n.1}%"` as the value with label `"Revenue share"`.

## Related Changes

- `frontend/src/pages/DashboardPage.tsx` — renders `<ZoneChart data={data?.zone_breakdown || []} />` (Day 7)

---

# File: `frontend/src/pages/DashboardPage.tsx`

**Status:** Created

## Purpose

The main `/dashboard` page. Renders a header with a date-range selector, four KPI cards, a revenue trend line chart, a zone bar chart, a top-products ranked list, and two optional cards (route performance and credit exposure) that only render when the API returns non-empty arrays.

## Dependencies

**Internal (all created Day 7 unless noted):**
- `@/hooks/useKPIs` — `useKPIs` (Day 7)
- `@/components/dashboard/KPICard` — `KPICard` (Day 7)
- `@/components/dashboard/RevenueTrendChart` — `RevenueTrendChart` (Day 7)
- `@/components/dashboard/ZoneChart` — `ZoneChart` (Day 7)
- `@/components/ui/card` — `Card`, `CardContent`, `CardHeader`, `CardTitle` (Day 6)
- `@/components/ui/select` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` (Day 7)

**Packages:**
- `react` — `useState` (already in `package.json` from Day 6)
- `lucide-react` — `IndianRupee`, `ShoppingCart`, `Users`, `TrendingUp`, `Package` (Day 6)

## Implementation

```typescript
import { useState } from "react";
import {
  IndianRupee,
  ShoppingCart,
  Users,
  TrendingUp,
  Package,
} from "lucide-react";
import { useKPIs } from "@/hooks/useKPIs";
import { KPICard } from "@/components/dashboard/KPICard";
import { RevenueTrendChart } from "@/components/dashboard/RevenueTrendChart";
import { ZoneChart } from "@/components/dashboard/ZoneChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function getDateRange(period: string): [string, string] {
  const end = new Date();
  const start = new Date();
  switch (period) {
    case "7d": start.setDate(end.getDate() - 7); break;
    case "30d": start.setDate(end.getDate() - 30); break;
    case "90d": start.setDate(end.getDate() - 90); break;
    case "ytd": start.setMonth(0, 1); break;
    default: start.setDate(end.getDate() - 30);
  }
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}

function formatINR(value: number): string {
  if (value >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(2)}Cr`;
  if (value >= 1_00_000) return `₹${(value / 1_00_000).toFixed(1)}L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(0)}K`;
  return `₹${value.toFixed(0)}`;
}

export function DashboardPage() {
  const [period, setPeriod] = useState("30d");
  const [start, end] = getDateRange(period);
  const { data, isLoading, error } = useKPIs(start, end);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            {start} → {end}
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="ytd">Year to date</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="text-red-600 bg-red-50 p-4 rounded-lg text-sm">
          Failed to load KPIs: {error.message}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard
          title="Total Revenue"
          value={data ? formatINR(data.summary.total_revenue) : "—"}
          icon={IndianRupee}
          loading={isLoading}
        />
        <KPICard
          title="Total Orders"
          value={data ? data.summary.total_orders.toLocaleString() : "—"}
          icon={ShoppingCart}
          loading={isLoading}
        />
        <KPICard
          title="Unique Parties"
          value={data ? data.summary.unique_parties.toLocaleString() : "—"}
          icon={Users}
          loading={isLoading}
        />
        <KPICard
          title="Avg Order Value"
          value={data ? formatINR(data.summary.avg_order_value) : "—"}
          icon={TrendingUp}
          loading={isLoading}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-64 bg-slate-50 rounded animate-pulse" />
            ) : (
              <RevenueTrendChart data={data?.revenue_trend || []} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue by Zone</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 bg-slate-50 rounded animate-pulse" />
            ) : (
              <ZoneChart data={data?.zone_breakdown || []} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Products</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-8 bg-slate-50 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {(data?.top_products || []).map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-4">{i + 1}</span>
                    <div className="flex items-center gap-2">
                      <Package className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-sm font-medium">{p.product_name}</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold">
                    {formatINR(p.total_revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Route Performance Card — shown if route_performance has entries */}
      {(data?.route_performance?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Route Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data!.route_performance.slice(0, 5).map((r) => (
                <div key={r.route} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700 truncate max-w-[180px]">{r.route}</span>
                  <div className="flex items-center gap-4 text-slate-500">
                    <span>{r.order_count} orders</span>
                    <span className="font-semibold text-slate-800">
                      ₹{(Number(r.revenue) / 100000).toFixed(1)}L
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Outstanding Parties Card — shown if outstanding_parties has entries */}
      {(data?.outstanding_parties?.length ?? 0) > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-base text-amber-800">Credit Exposure</CardTitle>
            <p className="text-sm text-amber-600">Parties with outstanding receivables</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data!.outstanding_parties.slice(0, 5).map((p) => (
                <div key={p.party_name} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-amber-900 truncate max-w-[200px]">
                    {p.party_name}
                  </span>
                  <span className="font-semibold text-amber-800">
                    ₹{(Number(p.outstanding_amount) / 100000).toFixed(1)}L
                  </span>
                </div>
              ))}
              <p className="text-xs text-amber-600 pt-1">
                Total: ₹
                {(
                  data!.outstanding_parties.reduce(
                    (s, p) => s + Number(p.outstanding_amount),
                    0
                  ) / 100000
                ).toFixed(1)}
                L outstanding across {data!.outstanding_parties.length} parties
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

## Placement

New file at:

```
akara/frontend/src/pages/DashboardPage.tsx
```

alongside `LoginPage.tsx` which already exists in `frontend/src/pages/`.

## Explanation

**`getDateRange(period)`** — converts a period string to a `[startISO, endISO]` tuple. `end` is always today. `start` is calculated relative to `end`:
- `"7d"` → 7 days ago
- `"30d"` → 30 days ago (default)
- `"90d"` → 90 days ago
- `"ytd"` → January 1st of the current year

Both dates are formatted as `"YYYY-MM-DD"` via `.toISOString().slice(0, 10)`.

**`formatINR(value)`** — formats large numbers in Indian numbering system:
- ≥ 1 Crore (10,000,000) → `₹{n}Cr`
- ≥ 1 Lakh (100,000) → `₹{n}L`
- ≥ 1 Thousand → `₹{n}K`
- Otherwise → `₹{n}`

This format is used for KPI card values (revenue, AOV) and the top-products list. A separate `formatINR` in `RevenueTrendChart.tsx` has slightly different thresholds for chart axes.

**`DashboardPage` component:**
- `period` state (default `"30d"`) drives the date range; `setPeriod` is passed to the `Select`'s `onValueChange`.
- `[start, end]` are recalculated on every render when `period` changes (not memoized — acceptable because `getDateRange` is O(1)).
- `useKPIs(start, end)` returns `{ data, isLoading, error }`.
- All four KPI cards receive `loading={isLoading}` and render skeletons while the query is in-flight.
- Charts receive `data?.revenue_trend || []` and `data?.zone_breakdown || []` — safe empty arrays while loading.
- Top-products list renders `data?.top_products || []` — empty while loading (no skeleton, intentional).
- Route Performance and Credit Exposure cards are fully conditional: `(data?.route_performance?.length ?? 0) > 0`. They do not render while loading or when the arrays are empty.

## Related Changes

- `frontend/src/App.tsx` — imports and uses `DashboardPage` (Day 7)
- `frontend/src/hooks/useKPIs.ts` — called by this component (Day 7)
- `frontend/src/components/dashboard/KPICard.tsx` — rendered 4× (Day 7)
- `frontend/src/components/dashboard/RevenueTrendChart.tsx` — rendered 1× (Day 7)
- `frontend/src/components/dashboard/ZoneChart.tsx` — rendered 1× (Day 7)
- `frontend/src/components/ui/card.tsx` — used for all card wrappers (Day 6)
- `frontend/src/components/ui/select.tsx` — used for the period picker (Day 7)
- `backend/app/api/routes/kpi.py` — the backend endpoint being called (Day 4)

---

# File: `frontend/src/App.tsx`

**Status:** Modified

## Purpose

Two changes: remove the inline `Dashboard` placeholder component and replace it with the real `DashboardPage` import and route. Also updates the placeholder comment from "built Days 7–10" to "built Days 8–10".

## Dependencies

- `frontend/src/pages/DashboardPage.tsx` — `DashboardPage` export; created Day 7

## Implementation

### Original file (Day 6 state — before Day 7 changes)

```typescript
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/pages/LoginPage";

// Placeholder pages (built Days 7–10)
const Dashboard = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Dashboard — coming Day 7</h1>
  </div>
);
const Copilot = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Copilot — coming Day 8</h1>
  </div>
);
// ... (Data, Reports, Simulator, SettingsPage placeholders unchanged)

// ...

<Route path="/dashboard" element={<Dashboard />} />
```

### File after Day 7 modifications (complete file)

```typescript
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";

// Placeholder pages (built Days 8–10)
const Copilot = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Copilot — coming Day 8</h1>
  </div>
);
const Data = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Data — coming Day 9</h1>
  </div>
);
const Reports = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Reports — coming Day 10</h1>
  </div>
);
const Simulator = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Simulator — coming Day 10</h1>
  </div>
);
const SettingsPage = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Settings — coming Day 9</h1>
  </div>
);

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
                <Route path="/copilot" element={<Copilot />} />
                <Route path="/data" element={<Data />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/simulator" element={<Simulator />} />
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

Existing file at `akara/frontend/src/App.tsx`.

**Change 1 — New import line** (insert after `import { LoginPage } from "@/pages/LoginPage";`):
```typescript
import { DashboardPage } from "@/pages/DashboardPage";
```

**Change 2 — Remove the inline `Dashboard` placeholder** (the 6-line const starting with `const Dashboard = () => (`).

**Change 3 — Update the comment** from `// Placeholder pages (built Days 7–10)` to `// Placeholder pages (built Days 8–10)`.

**Change 4 — Replace route element** (line 51 in the new file):
```typescript
// Before:
<Route path="/dashboard" element={<Dashboard />} />
// After:
<Route path="/dashboard" element={<DashboardPage />} />
```

## Explanation

The `Dashboard` inline arrow function was a placeholder added on Day 6. It is now fully replaced by the real `DashboardPage` component from `@/pages/DashboardPage`. All other routes (`/copilot`, `/data`, etc.) remain as placeholders until their respective days.

## Related Changes

- `frontend/src/pages/DashboardPage.tsx` — imported here (Day 7)
- All other routes remain unchanged from Day 6

---

# File: `backend/app/api/routes/admin/users.py`

**Status:** Created

## Purpose

Provides two protected admin endpoints for user management:

- `GET /admin/users/{tenant_id}` — list all profiles belonging to a tenant
- `PATCH /admin/users/{user_id}/role` — update a user's role (admin or user)

Both endpoints require the caller to be an admin (via `_require_superadmin` guard imported from `tenants.py`).

## Dependencies

**Internal (all pre-existing from Day 5):**
- `app.api.routes.admin.tenants._require_superadmin` — the admin guard function (Day 5)
- `app.core.auth.CurrentUser` — `Annotated[AuthenticatedUser, Depends(get_current_user)]` type alias (Day 2)
- `app.core.tenant.TenantContext` — plain class (Day 2)
- `app.core.tenant.get_supabase_service_client` — service-role Supabase client factory (Day 2)

**Supabase table:**
- `profiles` — columns: `id` (UUID), `tenant_id` (UUID), `role` (text), `display_name` (text, nullable). Created during Day 1 schema setup.

**Python standard library / packages:**
- `uuid.UUID` — standard library
- `fastapi` — `APIRouter`, `Depends`, `HTTPException`, `status`; already in `pyproject.toml`
- `pydantic.BaseModel` — already in `pyproject.toml`

**No new packages introduced on Day 7.**

## Implementation

```python
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.routes.admin.tenants import _require_superadmin
from app.core.auth import CurrentUser
from app.core.tenant import TenantContext, get_supabase_service_client

router = APIRouter(prefix="/admin/users", tags=["admin"])


class UserOut(BaseModel):
    id: UUID
    tenant_id: UUID
    role: str
    display_name: str | None = None


class UserRoleUpdate(BaseModel):
    role: str


@router.get("/{tenant_id}", response_model=list[UserOut])
def list_users_for_tenant(
    tenant_id: UUID,
    user: CurrentUser,
    tenant: TenantContext = Depends(_require_superadmin),
) -> list[UserOut]:
    supabase = get_supabase_service_client()
    result = (
        supabase.table("profiles")
        .select("*")
        .eq("tenant_id", str(tenant_id))
        .execute()
    )
    return [UserOut(**row) for row in (result.data or [])]


@router.patch("/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: UUID,
    body: UserRoleUpdate,
    user: CurrentUser,
    tenant: TenantContext = Depends(_require_superadmin),
) -> UserOut:
    if body.role not in ("admin", "user"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be 'admin' or 'user'",
        )
    supabase = get_supabase_service_client()
    result = (
        supabase.table("profiles")
        .update({"role": body.role})
        .eq("id", str(user_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut(**result.data[0])
```

## Placement

New file at:

```
akara/backend/app/api/routes/admin/users.py
```

alongside the existing `akara/backend/app/api/routes/admin/tenants.py` (Day 5) and `akara/backend/app/api/routes/admin/__init__.py` (Day 5).

## Explanation

**`UserOut`** — Pydantic response model. Maps `profiles` table columns. `display_name` has `= None` default so rows where the column is `NULL` deserialise correctly.

**`UserRoleUpdate`** — request body for the PATCH endpoint. Only accepts `role`.

**`_require_superadmin` import** — imported directly from `tenants.py` to avoid duplicating the guard logic. This creates an intra-package dependency within `admin/`.

**Known bug avoided — double `Depends`:** `daywise.md` specified `tenant: TenantCtx = Depends(_require_superadmin)` in route handlers. `TenantCtx` is `Annotated[TenantContext, Depends(get_tenant_context)]`, so combining it with a `= Depends(...)` default creates two `Depends` on the same parameter, causing `AssertionError: Cannot specify Depends in Annotated and default value together`. The fix (same as Day 5) is to use the plain `TenantContext` class (not the `Annotated` alias) as the type annotation for the `tenant` parameter in route handlers.

**`GET /admin/users/{tenant_id}`** — queries `profiles` filtered by `tenant_id`. Uses the service-role client to bypass RLS. Returns `[]` if no profiles match.

**`PATCH /admin/users/{user_id}/role`** — validates `body.role` is `"admin"` or `"user"` (returns 400 otherwise). Updates the `role` column in `profiles` filtered by `id`. Returns 404 if Supabase returns no rows (user not found).

## Related Changes

- `backend/app/main.py` — imports and registers this router (Day 7)
- `backend/app/api/routes/admin/tenants.py` — `_require_superadmin` is imported from here (Day 5)
- `backend/app/core/tenant.py` — `TenantContext` and `get_supabase_service_client` (Day 2, unchanged)
- `backend/app/core/auth.py` — `CurrentUser` (Day 2, unchanged)

---

# File: `backend/app/main.py`

**Status:** Modified

## Purpose

Two lines were added to `main.py` on Day 7 to import and register the `admin_users_router`, making the `GET/PATCH /admin/users/...` endpoints part of the running application.

## Dependencies

- `backend/app/api/routes/admin/users.py` — `router` object (Day 7)

## Implementation

### Original file (Day 5 state — before Day 7 changes)

```python
from app.api.routes.admin import tenants as admin_tenants_router
# ...
app.include_router(admin_tenants_router.router)
```

### File after Day 7 modifications (complete file)

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
app.include_router(kpi_router.router)
app.include_router(data_router.router)
app.include_router(admin_tenants_router.router)
app.include_router(admin_users_router.router)
```

## Placement

Existing file at `akara/backend/app/main.py`.

**Change 1 — New import** (insert after `from app.api.routes.admin import tenants as admin_tenants_router` on line 12):
```python
from app.api.routes.admin import users as admin_users_router
```

**Change 2 — New `include_router` call** (append after `app.include_router(admin_tenants_router.router)` at the bottom):
```python
app.include_router(admin_users_router.router)
```

## Explanation

`admin_users_router.router` is an `APIRouter` with `prefix="/admin/users"`. Calling `app.include_router(...)` mounts `GET /admin/users/{tenant_id}` and `PATCH /admin/users/{user_id}/role` in the FastAPI application.

## Related Changes

- `backend/app/api/routes/admin/users.py` — the router being registered (Day 7)
- All other `include_router` calls (Days 2–5) — unchanged

---

## Tests

No new tests were added on Day 7. The existing test suite continues to pass:

```bash
cd akara/backend
uv run pytest
# 2 passed in ~2.1s
```

The frontend TypeScript compilation passes with zero errors:

```bash
cd akara/frontend
npx tsc --noEmit
# (no output)
```

---

## End-of-Day Checklist Verification

| Item | Status |
|---|---|
| `npm install recharts @radix-ui/react-select` completed | ✅ |
| `frontend/src/components/ui/select.tsx` created | ✅ |
| `frontend/src/lib/api.ts` created | ✅ |
| `frontend/src/types/kpi.ts` created with all 7 interfaces | ✅ |
| `frontend/src/hooks/useKPIs.ts` created | ✅ |
| `frontend/src/components/dashboard/KPICard.tsx` created | ✅ |
| `frontend/src/components/dashboard/RevenueTrendChart.tsx` created | ✅ |
| `frontend/src/components/dashboard/ZoneChart.tsx` created | ✅ |
| `frontend/src/pages/DashboardPage.tsx` created | ✅ |
| `frontend/src/App.tsx` updated — `DashboardPage` replaces placeholder | ✅ |
| `backend/app/api/routes/admin/users.py` created | ✅ |
| `backend/app/main.py` registers `admin_users_router` | ✅ |
| `ruff check .` exits 0 | ✅ |
| `pytest` exits 0 (2 tests pass) | ✅ |
| `tsc --noEmit` exits 0 (zero TypeScript errors) | ✅ |
