# Day 11 Implementation Handoff

## Reproduction Instructions

### Expected repository state before applying Day 11

Days 1–10 must already be fully implemented as documented in:
- `docs/day1_implementation.md` through `docs/day10_implementation.md`

The following must already exist and be functional:
- `akara/frontend/src/App.tsx` — React Router with AppShell layout; `path="*"` currently does `<Navigate to="/dashboard" replace />`
- `akara/frontend/src/components/layout/AppShell.tsx` — sidebar rendered as a static element, no mobile support, no ErrorBoundary wrapping `<Outlet />`
- `akara/frontend/src/pages/ReportsPage.tsx` and `SimulatorPage.tsx` — already wired from Day 10
- No `ErrorBoundary`, `NotFoundPage`, `EmptyState`, or `SkeletonCard` components exist yet
- `docs/onboarding-checklist.md` does not exist yet

### Day 11 changes must be applied in this order

1. `akara/frontend/src/components/ErrorBoundary.tsx` — Create ErrorBoundary class component
2. `akara/frontend/src/pages/NotFoundPage.tsx` — Create 404 page
3. `akara/frontend/src/components/EmptyState.tsx` — Create reusable empty state component
4. `akara/frontend/src/components/SkeletonCard.tsx` — Create reusable skeleton loader
5. `akara/frontend/src/components/layout/AppShell.tsx` — Full rewrite for mobile sidebar + ErrorBoundary
6. `akara/frontend/src/App.tsx` — Replace catch-all redirect with NotFoundPage; remove unused `Navigate` import
7. `akara/docs/onboarding-checklist.md` — Create customer onboarding runbook

### Commands required after copying the code

No new packages are installed in Day 11. No backend changes.

```bash
# Verify frontend TypeScript
cd akara/frontend
npx tsc --noEmit
# Expected: 0 errors

# Verify backend unchanged
cd akara/backend
uv run ruff check .
uv run pytest
# Expected: all checks pass, 2 tests pass
```

### Verification steps

1. Navigate to `/nonexistent-route` — renders 404 page (not redirect to `/dashboard`)
2. Open Chrome DevTools → 375px iPhone SE viewport → hamburger `☰` button visible in top bar → click → sidebar slides in with dark overlay → click a nav link → sidebar closes
3. On `lg:` (1024px+) desktop — sidebar always visible, no hamburger, no overlay
4. Temporarily add `throw new Error("test")` in any page component → ErrorBoundary renders "Something went wrong" with Reload button → remove the throw

---

## No Environment Variable or Dependency Changes

Day 11 introduces no new packages, no new environment variables, and no backend changes. All changes are frontend-only.

---

# File: `akara/frontend/src/components/ErrorBoundary.tsx`

**Status:** Created

## Purpose

Provides a React class-based error boundary that catches render-phase JavaScript errors in any descendant component. Without this, a runtime error in any page would crash the entire app and show a blank screen. Wrapping `<Outlet />` inside AppShell with this component ensures every page crash is contained and shows a user-friendly "Something went wrong" UI.

React error boundaries must be class components — React does not support function-component error boundaries as of React 19.

## Dependencies

- `react` — `Component`, `ReactNode` (pre-existing)
- `@/components/ui/button` — `Button` (pre-existing from Day 6/7)

## Implementation

```typescript
import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error("ErrorBoundary caught:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-slate-500 mb-6 max-w-md">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <Button onClick={() => window.location.reload()}>Reload page</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

## Placement

New file. Place at: `akara/frontend/src/components/ErrorBoundary.tsx`

## Explanation

- `Props` — accepts only `children: ReactNode`.
- `State` — `hasError: boolean` flag plus the caught `error: Error | null`.
- `getDerivedStateFromError(error)` — React lifecycle; called during render phase when a descendant throws. Sets `hasError: true` and stores the error. This is a static method returning new state — no side effects allowed here.
- `componentDidCatch(error)` — called after the render phase. Used for logging (`console.error`). In production, this is where a Sentry `captureException` call would go.
- `render()` — when `hasError` is true, renders the fallback UI: emoji, heading, error message, and a "Reload page" button that calls `window.location.reload()`. When `hasError` is false, renders `this.props.children` normally.
- `min-h-[400px]` ensures the error UI is visible even if the surrounding layout is small.

## Related Changes

- `akara/frontend/src/components/layout/AppShell.tsx` — imports and uses `ErrorBoundary` to wrap `<Outlet />`

---

# File: `akara/frontend/src/pages/NotFoundPage.tsx`

**Status:** Created

## Purpose

Provides a standalone 404 page shown for any URL that does not match a defined route. Replaces the previous behaviour of redirecting unmatched routes to `/dashboard`, which silently hid navigational errors from users and broke shareable URLs.

## Dependencies

- `react-router-dom` — `Link` (pre-existing)
- `@/components/ui/button` — `Button` (pre-existing)

## Implementation

```typescript
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-center p-8">
      <div className="text-8xl font-black text-slate-200 mb-4 select-none">
        404
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        Page not found
      </h1>
      <p className="text-slate-500 mb-8 max-w-sm">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Button asChild>
        <Link to="/dashboard">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
```

## Placement

New file. Place at: `akara/frontend/src/pages/NotFoundPage.tsx`

## Explanation

- Standalone page — it is NOT nested inside `<ProtectedRoute>` or `<AppShell>`, so it renders without authentication and without the sidebar. This is intentional: a 404 should be visible to anyone who lands on an invalid URL, regardless of login state.
- The "404" heading uses `text-8xl font-black text-slate-200` — large, grey, decorative.
- `Button asChild` — shadcn pattern that renders the Button's styles onto the inner `<Link>` element, so clicking navigates using React Router (no full-page reload).
- `min-h-screen` + `flex flex-col items-center justify-center` — centres the content vertically and horizontally on any screen size.

## Related Changes

- `akara/frontend/src/App.tsx` — imports `NotFoundPage` and uses it in the `path="*"` catch-all route

---

# File: `akara/frontend/src/components/EmptyState.tsx`

**Status:** Created

## Purpose

Provides a reusable empty-state component for use across all pages that may have no data to display (reports, simulator with no data, future list pages). Before Day 11, empty states were written inline in each page (e.g. `ReportsPage.tsx` has its own ad-hoc empty state). `EmptyState` standardises the pattern and makes it available for future pages.

## Dependencies

- `lucide-react` — `LucideIcon` type (pre-existing)
- `react` — `React.ReactNode` (pre-existing; used via global React types)

## Implementation

```typescript
import { type LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
```

## Placement

New file. Place at: `akara/frontend/src/components/EmptyState.tsx`

## Explanation

- `icon: LucideIcon` — accepts any Lucide icon component (e.g. `FileSpreadsheet`, `MessageSquare`). Rendered destructured as `Icon` to use as a JSX component.
- `title` — short heading displayed below the icon circle.
- `description` — secondary text, constrained to `max-w-sm` to keep it readable.
- `action?: React.ReactNode` — optional. When provided (e.g. a `<Button>` or `<Link>`), renders below the description inside a `mt-4` wrapper. Callers control the action content entirely.
- The icon is placed inside a `w-16 h-16` circular slate background to give it visual weight without being distracting.

## Related Changes

- No existing pages use `EmptyState` yet in Day 11 — existing inline empty states in `ReportsPage.tsx` are not migrated. `EmptyState` is available for future pages.

---

# File: `akara/frontend/src/components/SkeletonCard.tsx`

**Status:** Created

## Purpose

Provides a reusable animated skeleton loading card that standardises the loading state pattern across pages. Before Day 11, individual pages used ad-hoc inline `animate-pulse` divs with no consistent structure or reusability.

## Dependencies

- `@/lib/utils` — `cn()` (pre-existing)

## Implementation

```typescript
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  lines?: number;
}

export function SkeletonCard({ className, lines = 3 }: Props) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-100 p-5 bg-white",
        className
      )}
    >
      <div className="h-4 w-1/3 bg-slate-100 rounded animate-pulse mb-4" />
      {[...Array(lines)].map((_, i) => (
        <div
          key={i}
          className="h-3 bg-slate-100 rounded animate-pulse mb-2 last:mb-0"
          style={{ width: `${90 - i * 10}%` }}
        />
      ))}
    </div>
  );
}
```

## Placement

New file. Place at: `akara/frontend/src/components/SkeletonCard.tsx`

## Explanation

- `className` — forwarded to the outer container via `cn()` so callers can override size, margin, or other styles.
- `lines` — defaults to 3. Controls how many content skeleton lines are rendered below the header stub.
- Header stub: `h-4 w-1/3` — simulates a short heading.
- Content lines: `h-3`, width decreasing by `10%` per line (`90%`, `80%`, `70%`, …) — simulates text that gets shorter toward the bottom, which looks natural.
- `last:mb-0` — removes bottom margin on the final line to avoid extra whitespace.
- `animate-pulse` — Tailwind CSS utility that fades opacity in/out on a CSS animation, producing the shimmer effect.

## Related Changes

- No existing pages are updated to use `SkeletonCard` in Day 11. Existing inline skeleton patterns in `DashboardPage.tsx`, `SimulatorPage.tsx`, and `ReportsPage.tsx` are not migrated. `SkeletonCard` is available for future pages and future refactors.

---

# File: `akara/frontend/src/components/layout/AppShell.tsx`

**Status:** Modified (full rewrite)

## Purpose

The Day 10 version of `AppShell.tsx` had a completely static sidebar — it was always visible and had no mobile support. On screens narrower than 1024px the sidebar consumed the full width and broke all page layouts. This rewrite:

1. **Adds full mobile sidebar** with hamburger toggle, slide-in animation, dark overlay, and X close button
2. **Wraps `<Outlet />` in `<ErrorBoundary>`** so any page crash is contained without crashing the entire app
3. **Adds a mobile top bar** (hidden on desktop) with the hamburger button and AKARA brand name
4. **Nav links close the sidebar** on mobile when clicked (prevents the sidebar staying open after navigation)

## Dependencies

- `react` — `useState` (pre-existing)
- `react-router-dom` — `Link`, `useLocation`, `Outlet` (pre-existing)
- `@/contexts/AuthContext` — `useAuth()` hook providing `user` and `signOut` (pre-existing, Day 2)
- `@/components/ui/button` — `Button` (pre-existing)
- `@/components/ErrorBoundary` — `ErrorBoundary` class component (**introduced Day 11**)
- `lucide-react` — `LayoutDashboard`, `MessageSquare`, `Upload`, `BarChart2`, `Settings`, `LogOut`, `TrendingUp`, `Menu`, `X` (pre-existing + `Menu` and `X` are new imports)
- `@/lib/utils` — `cn()` (pre-existing)

## Implementation

```typescript
import { useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  LayoutDashboard,
  MessageSquare,
  Upload,
  BarChart2,
  Settings,
  LogOut,
  TrendingUp,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/copilot", label: "Copilot", icon: MessageSquare },
  { to: "/data", label: "Data", icon: Upload },
  { to: "/reports", label: "Reports", icon: BarChart2 },
  { to: "/simulator", label: "Simulator", icon: TrendingUp },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function closeSidebar() {
    setSidebarOpen(false);
  }

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Mobile overlay — shown behind sidebar when open on small screens */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "w-64 bg-white border-r border-slate-200 flex flex-col",
          // Mobile: fixed positioned, slides in/out
          "fixed inset-y-0 left-0 z-50",
          // Desktop: part of normal flow
          "lg:relative lg:z-auto",
          "transform transition-transform duration-200 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Sidebar header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-xl font-bold text-slate-900">AKARA</span>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {user?.email}
            </p>
          </div>
          {/* Close button — mobile only */}
          <button
            className="lg:hidden ml-2 p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            onClick={closeSidebar}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={closeSidebar}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                location.pathname.startsWith(to)
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Sign out */}
        <div className="px-3 py-4 border-t border-slate-200">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3 text-slate-600"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar — hamburger + brand */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-lg font-bold text-slate-900">AKARA</span>
        </header>

        {/* Page content — wrapped in ErrorBoundary */}
        <main className="flex-1 overflow-auto">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
```

## Placement

Replace the **entire contents** of `akara/frontend/src/components/layout/AppShell.tsx` with the code above.

### Key differences from the Day 10 version

| Area | Day 10 (before) | Day 11 (after) |
|---|---|---|
| Sidebar positioning | `position: static` (always in flow) | `fixed inset-y-0 left-0 z-50` on mobile, `lg:relative lg:z-auto` on desktop |
| Mobile visibility | Always visible (breaks layout) | Hidden via `-translate-x-full`, revealed by `translate-x-0` when `sidebarOpen` |
| Mobile overlay | None | `fixed inset-0 bg-black/50 z-40 lg:hidden` div, conditionally rendered |
| Mobile top bar | None | `<header className="lg:hidden ...">` with hamburger `<Menu>` button |
| X close button | None | Inside sidebar header, `lg:hidden` |
| Nav link click | No side effect | Calls `closeSidebar()` |
| `<Outlet />` wrapping | No error boundary | Wrapped in `<ErrorBoundary>` |
| `ErrorBoundary` import | Not present | `import { ErrorBoundary } from "@/components/ErrorBoundary"` |
| Lucide imports | No `Menu`, no `X` | Added `Menu`, `X` |
| `useState` | Not used | `const [sidebarOpen, setSidebarOpen] = useState(false)` |

## Explanation

**Mobile sidebar mechanism:**
- The `<aside>` element is always in the DOM but uses CSS transforms to show/hide on mobile:
  - `sidebarOpen === false`: `-translate-x-full` pushes it 100% to the left (off-screen)
  - `sidebarOpen === true`: `translate-x-0` brings it into view
  - `lg:translate-x-0` overrides on desktop — sidebar is always visible regardless of `sidebarOpen` state
- `duration-200 ease-in-out` provides the slide animation
- On desktop (`lg:`), sidebar is `lg:relative lg:z-auto` — part of the flex row, not fixed-positioned

**Overlay mechanism:**
- `{sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={closeSidebar} />}` — conditionally rendered only when sidebar is open. The `lg:hidden` class means it never renders on desktop. `z-40` is below the sidebar's `z-50` so clicking the overlay closes the sidebar rather than clicking through to the page.

**Mobile top bar:**
- `<header className="lg:hidden ...">` — only visible below 1024px. Contains the hamburger button and AKARA brand name. `shrink-0` prevents it from being squashed by flex layout.

**ErrorBoundary integration:**
- `<ErrorBoundary>` wraps `<Outlet />` inside `<main>`. Any render-time throw in any page component is caught here and replaced with the "Something went wrong" fallback UI, without crashing the sidebar or header.

**Nav link click closure:**
- `<Link onClick={closeSidebar}>` — each nav link calls `closeSidebar()` on click. On desktop this is a no-op (sidebar is never "open" in the mobile sense). On mobile, this ensures the sidebar closes immediately after the user taps a nav item, making navigation feel responsive.

## Related Changes

- `akara/frontend/src/components/ErrorBoundary.tsx` — imported and used here (**Day 11**)
- All page components (`DashboardPage`, `CopilotPage`, `DataPage`, `ReportsPage`, `SimulatorPage`, `SettingsPage`) — rendered via `<Outlet />` inside the ErrorBoundary

---

# File: `akara/frontend/src/App.tsx`

**Status:** Modified

## Purpose

Two changes:
1. Replace the catch-all `path="*"` redirect (`<Navigate to="/dashboard" replace />`) with `<NotFoundPage />` so users see a proper 404 page instead of being silently redirected.
2. Remove the now-unused `Navigate` import from `react-router-dom`.

## Dependencies

- `akara/frontend/src/pages/NotFoundPage.tsx` — `NotFoundPage` (**introduced Day 11**)
- All other imports are unchanged from Day 10

## Implementation

Complete Day 11 version of `App.tsx`:

```typescript
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import { NotFoundPage } from "@/pages/NotFoundPage";

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
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

## Placement

Replace the full contents of `akara/frontend/src/App.tsx`.

### Diff from Day 10

**Line 1 — import change:**
```typescript
// Day 10 (before):
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Day 11 (after):
import { BrowserRouter, Routes, Route } from "react-router-dom";
```

**New import added (after `SimulatorPage` import):**
```typescript
import { NotFoundPage } from "@/pages/NotFoundPage";
```

**Catch-all route change:**
```typescript
// Day 10 (before):
<Route path="*" element={<Navigate to="/dashboard" replace />} />

// Day 11 (after):
<Route path="*" element={<NotFoundPage />} />
```

## Explanation

- `Navigate` is removed from the `react-router-dom` import because it is no longer used anywhere in this file. Keeping an unused import would cause a lint warning.
- `NotFoundPage` is imported from `@/pages/NotFoundPage` (the file created in Day 11).
- The `path="*"` route is the React Router catch-all — it matches any URL that didn't match a preceding `<Route>`. Previously it redirected silently; now it renders a 404 page.
- `NotFoundPage` is intentionally placed **outside** `<ProtectedRoute>` and `<AppShell>` — it renders without authentication and without the sidebar. This means unauthenticated users who land on a bad URL also see the 404 page (not a redirect loop to `/login` → unknown route → redirect).

## Related Changes

- `akara/frontend/src/pages/NotFoundPage.tsx` — imported and rendered here (**Day 11**)
- `akara/frontend/src/components/layout/AppShell.tsx` — unchanged in App.tsx wiring; changes are internal to AppShell

---

# File: `akara/docs/onboarding-checklist.md`

**Status:** Created

## Purpose

Provides the AKARA team with a step-by-step, copy-paste-ready runbook for onboarding new customers. Before Day 11, the onboarding procedure was undocumented — this was a Track 2 (operations) deliverable specified in `daywise.md`. The document covers provisioning the tenant row, creating the Supabase Auth user, inserting the profile row, sending the welcome email, guiding the customer to upload their first data, and verifying KPIs appear. It also includes offboarding/data deletion SQL.

## Dependencies

None. Pure Markdown documentation.

## Implementation

```markdown
# AKARA Customer Onboarding Checklist

Use this checklist every time you onboard a new customer. The entire process takes under 10 minutes.

---

## Step 1: Provision Tenant

Run in the Supabase SQL Editor (Dashboard → SQL Editor → New Query):

```sql
INSERT INTO public.tenants (name, slug, config)
VALUES (
    'Customer Company Name',
    'customer-slug',          -- lowercase, hyphens only (used in URLs)
    '{"timezone": "Asia/Kolkata", "industry": "fmcg_distribution", "language": "en"}'
)
RETURNING id;
```

**Copy the returned `id` UUID** — you need it for the next steps.

---

## Step 2: Create Admin User in Supabase Auth

1. Go to Supabase Dashboard → Authentication → Users → Invite User
2. Enter the customer's admin email address
3. The customer receives a magic-link / invite email to set their password
4. Note the User UUID shown in the Users table after the account is created

---

## Step 3: Create Profile Row

Run in the SQL Editor (replace both UUIDs):

```sql
INSERT INTO public.profiles (id, tenant_id, role, display_name, preferences)
VALUES (
    'USER_UUID_FROM_STEP_2',
    'TENANT_UUID_FROM_STEP_1',
    'admin',
    'Admin Name',
    '{"morning_brief_enabled": true}'
);
```

Verify the profile was created:
```sql
SELECT id, tenant_id, role, display_name
FROM public.profiles
WHERE tenant_id = 'TENANT_UUID_FROM_STEP_1';
```

---

## Step 4: Send Welcome Email to Customer

Send them:
- **URL:** your Vercel/custom domain (e.g. `https://app.akara.ai`)
- **Email:** the email used in Step 2
- **Temporary password:** if you used "Invite User", they set their own password via the link. If you created a user manually, include the password securely.
- **First task:** Go to `/data` and upload your first Excel/CSV file

Template:

> Hi [Name],
>
> Your AKARA account is ready. Log in at [URL] with [email].
>
> Your first step: go to the **Data** page and upload your sales data (Excel or CSV). Once uploaded, your dashboard KPIs will populate automatically.
>
> Let us know if you need help!

---

## Step 5: Customer Uploads Data

The customer logs in and navigates to `/data`. They can upload:

| Panel | Source | Required columns |
|---|---|---|
| **Primary Sales** | Tally / ERP | `invoice_date`, `party_name`, `total_amount` |
| **Secondary Sales** | Bizom / DMS | `invoice_date`, `party_name`, `total_amount` |
| **Scheme Master** | Manual | `scheme_name`, `party_name`, `claimed_amount`, `scheme_start`, `scheme_end` |

At minimum, the customer needs to upload **Primary Sales** for the dashboard to populate.

---

## Step 6: Verify KPIs Appear

1. Have the customer navigate to `/dashboard`
2. KPI cards (Revenue, Orders, Parties, Avg Order) should populate within 3 seconds
3. If cards show 0 or an error, run:
   ```sql
   SELECT COUNT(*), MIN(invoice_date), MAX(invoice_date)
   FROM public.sales_data
   WHERE tenant_id = 'TENANT_UUID_FROM_STEP_1';
   ```
4. If count > 0 but dashboard shows nothing, check the date range picker — it defaults to last 30 days

---

## Optional: Enable Morning Brief

The morning brief is **opt-in and already enabled by default** for admin users (see `preferences` in Step 3). It fires at 7:00 AM IST via Supabase Edge Function.

To verify it's configured:
- `SENDGRID_API_KEY` must be set in Railway
- `BACKEND_SERVICE_KEY` must match in both Railway and Supabase Edge Function secrets
- Supabase → Edge Functions → `daily-morning-brief` → Schedule: `30 1 * * *`

---

## Offboarding / Data Deletion

To fully remove a customer's data:

```sql
-- Deletes all tenant data (RLS-scoped tables cascade from tenant_id)
DELETE FROM public.sales_data WHERE tenant_id = 'TENANT_UUID';
DELETE FROM public.secondary_sales_data WHERE tenant_id = 'TENANT_UUID';
DELETE FROM public.scheme_master WHERE tenant_id = 'TENANT_UUID';
DELETE FROM public.profiles WHERE tenant_id = 'TENANT_UUID';
DELETE FROM public.tenants WHERE id = 'TENANT_UUID';
```

Then delete the user from Supabase Auth → Users → Delete.

---

## Checklist Summary

- [ ] Tenant row created in `public.tenants`
- [ ] Auth user created in Supabase Auth
- [ ] Profile row created in `public.profiles` with `role = 'admin'`
- [ ] Welcome email sent with URL + credentials
- [ ] Customer uploaded at least Primary Sales data
- [ ] Dashboard KPI cards populate correctly
- [ ] Morning brief scheduled (if SendGrid configured)
```

## Placement

New file. Place at: `akara/docs/onboarding-checklist.md`

Note: The `akara/docs/` directory already exists from previous implementation days (it contains `day1_implementation.md` through `day10_implementation.md`).

## Explanation

The checklist walks through 6 steps in the exact order they must be completed:

1. **Provision Tenant** — `INSERT` into `public.tenants` with slug and config JSONB. The `config` field controls timezone, industry, and language used throughout the app (language drives Copilot response language per the Day 7 per-tenant language implementation).
2. **Create Auth User** — Uses Supabase's "Invite User" flow, which sends a magic-link email so the customer sets their own password.
3. **Create Profile Row** — Links the Auth UUID to the tenant UUID in `public.profiles`, sets `role = 'admin'`, and enables morning brief by default.
4. **Welcome Email** — Manual step with a template; no automation yet.
5. **Customer Uploads Data** — Documents the three data panels in `/data` and their required columns.
6. **Verify KPIs** — SQL query to check `sales_data` count; troubleshooting note about the date range picker default.

The document also covers the Optional Morning Brief setup (Railway + Supabase Edge Function secrets) and includes Offboarding SQL for GDPR/data deletion requests.

## Related Changes

- Relates to `akara/frontend/src/pages/DataPage.tsx` (Day 9) — the upload flows referenced in Step 5
- Relates to `akara/frontend/src/pages/DashboardPage.tsx` (Day 7) — the KPIs verified in Step 6
- Relates to `akara/backend/app/services/morning_brief/` (Day 9) — the Morning Brief setup described in the Optional section

---

## Final Verification Checklist

- [x] `akara/frontend/src/components/ErrorBoundary.tsx` — documented with full code
- [x] `akara/frontend/src/pages/NotFoundPage.tsx` — documented with full code
- [x] `akara/frontend/src/components/EmptyState.tsx` — documented with full code
- [x] `akara/frontend/src/components/SkeletonCard.tsx` — documented with full code
- [x] `akara/frontend/src/components/layout/AppShell.tsx` — documented with full code and diff table
- [x] `akara/frontend/src/App.tsx` — documented with full code and precise diff
- [x] `akara/docs/onboarding-checklist.md` — documented with full contents
- [x] No new environment variables introduced in Day 11 — confirmed
- [x] No new packages introduced in Day 11 — confirmed
- [x] No backend changes in Day 11 — confirmed
- [x] Every new import in `AppShell.tsx` (`ErrorBoundary`, `Menu`, `X`) has a corresponding file/package
- [x] `NotFoundPage` import in `App.tsx` corresponds to the new file
- [x] Implementation order is valid (ErrorBoundary → NotFoundPage → EmptyState → SkeletonCard → AppShell → App.tsx → docs)
- [x] No Day 1–10 code unnecessarily duplicated
- [x] All file paths are valid
