# Gap Fixes v2 — Implementation Handoff

Applied **after Day 11**. This session fixed six gaps identified in a post-Day-11 audit of the entire codebase against `daywise.md` and `solutions-revised.md`.

### Gaps fixed

1. `akara/backend/.env.example` — stale Gmail vars replaced with correct SendGrid vars; `BACKEND_SERVICE_KEY` added (was undocumented)
2. `akara/frontend/src/pages/admin/UsersPage.tsx` — never created (Day 7 Track 2 deliverable)
3. `akara/frontend/src/App.tsx` — `/admin/tenants` and `/admin/users` routes never wired (both pages existed/were created but were unreachable)
4. `akara/frontend/src/components/layout/AppShell.tsx` — no admin nav section; admin users could not navigate to admin pages
5. `akara/docs/runbook.md` — Day 12 Track 2 deliverable, created early (no code dependency)
6. `akara_agent.py` — post-launch Tally overnight sync script, created at repo root

### Prerequisites

Days 1–11 plus `gap_fixes_implementation.md` must already be applied. In particular:
- `akara/frontend/src/components/layout/AppShell.tsx` must be at the Day 11 state (mobile sidebar + ErrorBoundary)
- `akara/frontend/src/App.tsx` must be at the Day 11 state (NotFoundPage catch-all)
- `akara/backend/app/api/routes/admin/users.py` must exist (Day 7)
- `akara/frontend/src/pages/admin/TenantsPage.tsx` must exist (Day 6)

### Application order

1. `akara/backend/.env.example` — no code dependencies, apply first
2. `akara/frontend/src/pages/admin/UsersPage.tsx` — create before wiring routes
3. `akara/frontend/src/App.tsx` — add imports + routes (depends on UsersPage existing)
4. `akara/frontend/src/components/layout/AppShell.tsx` — add admin nav section (no new dependencies)
5. `akara/docs/runbook.md` — documentation, no code dependencies
6. `akara_agent.py` — standalone script, no code dependencies

### Commands after applying

```bash
cd akara/frontend
npx tsc --noEmit
# Expected: 0 errors
```

---

# File: `akara/backend/.env.example`

**Status:** Modified

## Purpose

The file documented `GMAIL_USER` and `GMAIL_APP_PASSWORD` which have not been used since Day 9 replaced the email delivery system with SendGrid. `config.py` uses `sendgrid_api_key`, `sendgrid_from_email`, and `backend_service_key` — none of which were documented. A new developer copying `.env.example` to `.env` would configure the wrong variables and wonder why morning brief emails never arrive.

## Dependencies

Matches exactly the field names in `akara/backend/app/core/config.py`:
- `sendgrid_api_key`
- `sendgrid_from_email`
- `backend_service_key`

## Implementation

```
# =============================================================
# AKARA Backend — Environment Variables
# Copy this file to .env and fill in your values.
# NEVER commit .env to git.
# =============================================================

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# JWT — copy from Supabase Dashboard → Settings → API → JWT Secret
JWT_SECRET=your-supabase-jwt-secret

# LLM
GEMINI_API_KEY=AIza...
OPENROUTER_API_KEY=sk-or-...

# Email — SendGrid (production morning brief delivery)
SENDGRID_API_KEY=SG....
SENDGRID_FROM_EMAIL=insights@akara.ai

# Service key for Supabase Edge Function → backend auth bypass
# Generate any long random string: python -c "import secrets; print(secrets.token_hex(32))"
BACKEND_SERVICE_KEY=your-random-secret-key

# External context APIs (optional during development — leave empty to disable)
WEATHER_API_KEY=your-weatherapi-key
NEWS_API_KEY=your-newsapi-key

# App
ENVIRONMENT=development
LOG_LEVEL=INFO
ALLOWED_ORIGINS_RAW=http://localhost:5173

# Sentry (leave empty during development, fill in on Railway for production)
SENTRY_DSN=
```

## Placement

Replace the full contents of `akara/backend/.env.example`.

### Changes from previous version

| Removed | Replaced with |
|---|---|
| `GMAIL_USER=your@gmail.com` | `SENDGRID_API_KEY=SG....` |
| `GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx` | `SENDGRID_FROM_EMAIL=insights@akara.ai` |
| *(missing)* | `BACKEND_SERVICE_KEY=your-random-secret-key` |

## Explanation

- `SENDGRID_API_KEY` — required for `POST /morning-brief/send` and the Supabase Edge Function `daily-morning-brief`. Without it, morning brief emails silently fail.
- `SENDGRID_FROM_EMAIL` — the "From" address in morning brief emails. Defaults to `insights@akara.ai` in `config.py` but must be a verified sender in SendGrid.
- `BACKEND_SERVICE_KEY` — a shared secret between the Supabase Edge Function and the FastAPI backend. The Edge Function includes it in the `X-Service-Key` header; the backend validates it in the `/morning-brief/send` endpoint to allow auth bypass (the Edge Function runs server-side with no user session).

## Related Changes

- `akara/backend/app/core/config.py` — defines `sendgrid_api_key`, `sendgrid_from_email`, `backend_service_key` as Pydantic settings fields (Day 9)
- `akara/backend/app/services/email/sendgrid_client.py` — uses `settings.sendgrid_api_key` and `settings.sendgrid_from_email` (Day 9)
- `akara/supabase/functions/daily-morning-brief/index.ts` — uses `BACKEND_SERVICE_KEY` Supabase secret (Day 9)

---

# File: `akara/frontend/src/pages/admin/UsersPage.tsx`

**Status:** Created

## Purpose

The backend `GET /admin/users/{tenant_id}` and `PATCH /admin/users/{user_id}/role` endpoints (built Day 7) had no frontend UI. Admins had no way to view or change user roles through the app. This page fills that gap.

## Dependencies

- `@tanstack/react-query` — `useQuery`, `useMutation`, `useQueryClient` (pre-existing)
- `@/contexts/AuthContext` — `useAuth()` providing `session.access_token`, `user.tenantId`, `session.user.id` (pre-existing, Day 6)
- `@/components/ui/button` — `Button` (pre-existing)
- `@/components/ui/badge` — `Badge` (pre-existing)
- `@/components/ui/table` — `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` (pre-existing)
- `@/components/ui/select` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` (pre-existing, Day 7)
- Backend: `GET /admin/users/{tenant_id}` — requires `is_admin` on the caller's tenant context (Day 7)
- Backend: `PATCH /admin/users/{user_id}/role` — requires `is_admin` (Day 7)
- `VITE_API_BASE_URL` environment variable (pre-existing)

## Implementation

```typescript
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TenantUser {
  id: string;
  tenant_id: string;
  role: "admin" | "user";
  display_name: string | null;
}

async function fetchUsers(
  token: string,
  tenantId: string
): Promise<TenantUser[]> {
  const res = await fetch(
    `${import.meta.env.VITE_API_BASE_URL}/admin/users/${tenantId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

async function updateUserRole(
  token: string,
  userId: string,
  role: string
): Promise<TenantUser> {
  const res = await fetch(
    `${import.meta.env.VITE_API_BASE_URL}/admin/users/${userId}/role`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role }),
    }
  );
  if (!res.ok) throw new Error("Failed to update role");
  return res.json();
}

export function UsersPage() {
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin", "users", user?.tenantId],
    queryFn: () => fetchUsers(session!.access_token, user!.tenantId),
    enabled: !!session && !!user?.tenantId,
  });

  const roleMutation = useMutation({
    mutationFn: ({
      userId,
      role,
    }: {
      userId: string;
      role: string;
    }) => updateUserRole(session!.access_token, userId, role),
    onMutate: ({ userId }) => setSavingId(userId),
    onSettled: () => {
      setSavingId(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage roles for users in your tenant
        </p>
      </div>

      {(!users || users.length === 0) ? (
        <div className="text-center py-16 text-slate-400">
          <p className="font-medium">No users found</p>
          <p className="text-sm mt-1">
            Invite users via Supabase Auth → Users → Invite User
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>User ID</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="w-40">Change Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">
                  {u.display_name || (
                    <span className="text-slate-400 italic">No name set</span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs text-slate-500">
                  {u.id.slice(0, 8)}…
                </TableCell>
                <TableCell>
                  <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                    {u.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Select
                      defaultValue={u.role}
                      onValueChange={(role) =>
                        roleMutation.mutate({ userId: u.id, role })
                      }
                      disabled={
                        savingId === u.id ||
                        // Prevent the current user from removing their own admin
                        u.id === session?.user?.id
                      }
                    >
                      <SelectTrigger className="w-28 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">admin</SelectItem>
                        <SelectItem value="user">user</SelectItem>
                      </SelectContent>
                    </Select>
                    {savingId === u.id && (
                      <span className="text-xs text-slate-400">Saving…</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
```

## Placement

New file. Place at: `akara/frontend/src/pages/admin/UsersPage.tsx`

The `akara/frontend/src/pages/admin/` directory already exists (contains `TenantsPage.tsx` from Day 6).

## Explanation

- `TenantUser` — mirrors the `UserOut` Pydantic model from `admin/users.py`: `id`, `tenant_id`, `role`, `display_name`.
- `fetchUsers(token, tenantId)` — calls `GET /admin/users/{tenantId}`. Uses `user.tenantId` from `AuthContext` so the admin always sees users from their own tenant.
- `updateUserRole(token, userId, role)` — calls `PATCH /admin/users/{userId}/role` with `{"role": "admin"|"user"}`.
- `roleMutation` — TanStack Query mutation. `onMutate` sets `savingId` to show an inline "Saving…" label on the affected row. `onSettled` clears `savingId` and invalidates the `["admin", "users"]` query key to refresh the list.
- Self-demotion guard: the `<Select>` is `disabled` when `u.id === session?.user?.id` — prevents the logged-in admin from accidentally changing their own role and locking themselves out.
- Loading state: 3 animated skeleton rows (consistent with other pages).
- Empty state: plain text instructing the admin to invite users via Supabase Auth.

## Related Changes

- `akara/frontend/src/App.tsx` — imports and mounts `UsersPage` at `/admin/users` (this session)
- `akara/frontend/src/components/layout/AppShell.tsx` — adds nav link to `/admin/users` for admins (this session)
- `akara/backend/app/api/routes/admin/users.py` — backend endpoints consumed by this page (Day 7)

---

# File: `akara/frontend/src/App.tsx`

**Status:** Modified

## Purpose

`TenantsPage` (built Day 6) and `UsersPage` (built this session) existed as files but were never imported or routed in `App.tsx`, making them permanently unreachable. This change wires both admin routes into the React Router tree.

## Dependencies

- `akara/frontend/src/pages/admin/TenantsPage.tsx` — pre-existing (Day 6)
- `akara/frontend/src/pages/admin/UsersPage.tsx` — created this session

## Implementation

Complete Day 11 + gap-fixes-v2 version of `App.tsx`:

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
import { TenantsPage } from "@/pages/admin/TenantsPage";
import { UsersPage } from "@/pages/admin/UsersPage";

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
                <Route path="/admin/tenants" element={<TenantsPage />} />
                <Route path="/admin/users" element={<UsersPage />} />
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

### Changes from Day 11 version

Two new import lines added after `NotFoundPage`:
```typescript
import { TenantsPage } from "@/pages/admin/TenantsPage";
import { UsersPage } from "@/pages/admin/UsersPage";
```

Two new routes added inside `<AppShell>` after `/settings`:
```typescript
<Route path="/admin/tenants" element={<TenantsPage />} />
<Route path="/admin/users" element={<UsersPage />} />
```

## Explanation

Both admin routes are nested inside `<ProtectedRoute>` and `<AppShell>`. This means:
- Authentication is required (unauthenticated users are redirected to `/login`)
- The sidebar and mobile header are rendered around the page
- The `ErrorBoundary` from AppShell wraps the page content

Route-level access control (admin-only) is enforced by the backend returning 403 if the caller is not an admin. The frontend `AppShell` also hides the nav links from non-admin users, but a non-admin who navigates directly to `/admin/tenants` will see an error state (the fetch returns 403, `useQuery` sets `isError: true`).

## Related Changes

- `akara/frontend/src/pages/admin/TenantsPage.tsx` — mounted at `/admin/tenants` (Day 6)
- `akara/frontend/src/pages/admin/UsersPage.tsx` — mounted at `/admin/users` (this session)
- `akara/frontend/src/components/layout/AppShell.tsx` — nav links for both routes added (this session)

---

# File: `akara/frontend/src/components/layout/AppShell.tsx`

**Status:** Modified

## Purpose

After Day 11's mobile sidebar rewrite, `AppShell.tsx` still showed the same nav items to every user regardless of role. Admins had no way to reach `/admin/tenants` or `/admin/users` from the sidebar — the routes were wired but invisible. This change adds a conditional "Admin" section at the bottom of the nav, visible only when `user?.role === "admin"`.

## Dependencies

- `@/contexts/AuthContext` — `useAuth()` now used for both `user` and `signOut` (pre-existing — `user` was already consumed for `user?.email`)
- `lucide-react` — `Building2`, `Users` (new imports added to the existing lucide block)
- `akara/frontend/src/components/ErrorBoundary.tsx` — already imported (Day 11)
- `@/types/index.ts` — `User.role` is `"admin" | "user"` (pre-existing, Day 6)

## Implementation

Complete file (replaces the Day 11 version in full):

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
  Building2,
  Users,
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

const ADMIN_NAV_ITEMS = [
  { to: "/admin/tenants", label: "Tenants", icon: Building2 },
  { to: "/admin/users", label: "Users", icon: Users },
];

export function AppShell() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function closeSidebar() {
    setSidebarOpen(false);
  }

  const isAdmin = user?.role === "admin";

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

          {/* Admin-only section */}
          {isAdmin && (
            <>
              <div className="pt-4 pb-1 px-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Admin
                </p>
              </div>
              {ADMIN_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
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
            </>
          )}
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

Replace the full contents of `akara/frontend/src/components/layout/AppShell.tsx`.

### Changes from Day 11 version

**New imports added to the lucide-react block:**
```typescript
Building2,
Users,
```

**New constant added after `NAV_ITEMS`:**
```typescript
const ADMIN_NAV_ITEMS = [
  { to: "/admin/tenants", label: "Tenants", icon: Building2 },
  { to: "/admin/users", label: "Users", icon: Users },
];
```

**New derived value inside `AppShell()`:**
```typescript
const isAdmin = user?.role === "admin";
```

**New JSX block inside `<nav>` after the `NAV_ITEMS.map(...)` block:**
```typescript
{/* Admin-only section */}
{isAdmin && (
  <>
    <div className="pt-4 pb-1 px-3">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        Admin
      </p>
    </div>
    {ADMIN_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
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
  </>
)}
```

Everything else (mobile sidebar logic, overlay, header, sign-out, ErrorBoundary) is unchanged from Day 11.

## Explanation

- `isAdmin = user?.role === "admin"` — derives the boolean from the `User` type's `role: "admin" | "user"` field, populated from `GET /auth/me` at login.
- When `isAdmin` is `false` (regular users), the `{isAdmin && (...)}` block renders nothing — zero DOM elements, no visual gap.
- When `isAdmin` is `true`, a labelled "Admin" section divider appears followed by the two admin nav links.
- Both admin links call `closeSidebar()` on click (same as regular nav links), keeping mobile behaviour consistent.
- Active state detection uses `location.pathname.startsWith(to)` — identical to the regular nav items.
- `ADMIN_NAV_ITEMS` is a module-level constant (not inside the component) so it is never re-created on render.

## Related Changes

- `akara/frontend/src/pages/admin/TenantsPage.tsx` — linked via `/admin/tenants` (Day 6)
- `akara/frontend/src/pages/admin/UsersPage.tsx` — linked via `/admin/users` (this session)
- `akara/frontend/src/App.tsx` — both routes wired (this session)

---

# File: `akara/docs/runbook.md`

**Status:** Created

## Purpose

Day 12 Track 2 deliverable created early (no code required). Provides the AKARA team with an operational reference for production incidents — health check URL, log locations, five common issue playbooks, deployment commands, environment variable reference, and Supabase free-tier limit table.

## Dependencies

None. Pure Markdown documentation.

## Implementation

```markdown
# AKARA Runbook

Operational reference for the AKARA team. Use this when something breaks in production.

---

## Health Check

```bash
GET https://akara-backend-production.up.railway.app/health
```

Expected response:
```json
{"status": "ok", "environment": "production", "timestamp": "2024-..."}
```

---

## Logs

- **Railway (backend):** Dashboard → Deployments → Logs tab
- **Sentry (errors):** sentry.io → AKARA project → Issues

---

## Common Issues

### Backend returns 500 on `/kpi/`

1. Check Railway logs for the exception traceback.
2. Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly in Railway variables.
3. Run manually in Supabase SQL Editor:
   ```sql
   SELECT * FROM public.sales_data LIMIT 1;
   ```
4. If the table is empty, the tenant has no data — ask them to upload from `/data`.

---

### File import fails silently

1. Confirm the file is `.csv` or `.xlsx` (`.xls` requires conversion first).
2. Confirm required columns are present:
   - Primary Sales: `invoice_date`, `party_name`, `total_amount`
   - Secondary Sales: same as above
   - Scheme Master: `scheme_name`, `party_name`, `claimed_amount`, `scheme_start`, `scheme_end`
3. Check Railway logs for parser errors (`SalesDataParser`).
4. Common fix: ask the customer to export from Tally as `.xlsx`, not `.xls`.

---

### Copilot returns "All LLM providers unavailable"

1. Check `GEMINI_API_KEY` quota in Google Cloud Console → APIs → Gemini.
2. Check `OPENROUTER_API_KEY` balance at openrouter.ai → Credits.
3. Both keys must be set in Railway. If either is empty the fallback won't work.

---

### Morning brief emails not sending

1. Confirm `SENDGRID_API_KEY` is set in Railway.
2. Confirm `BACKEND_SERVICE_KEY` matches in both Railway AND Supabase Edge Function secrets (`daily-morning-brief` → Secrets).
3. Check Supabase → Edge Functions → `daily-morning-brief` → Logs.
4. Verify the function schedule: `30 1 * * *` (1:30 AM UTC = 7:00 AM IST).
5. Confirm the customer's profile has `preferences.morning_brief_enabled = true`.

---

### Frontend shows blank screen / crash

1. Open browser DevTools → Console — look for JavaScript errors.
2. Check Sentry for the stack trace (if `VITE_SENTRY_DSN` is set on Vercel).
3. Check Vercel → Deployments — confirm latest deployment succeeded.

---

## Deployment

### Backend (Railway)

```bash
cd akara/backend
uv run ruff check .
uv run pytest
railway up
```

### Frontend (Vercel)

```bash
cd akara/frontend
npx tsc --noEmit
npx vite build
vercel --prod
```

---

## Database

- **Supabase console:** supabase.com/dashboard
- **Run migrations:** Open Supabase → SQL Editor → paste migration file contents → Run
- **Migration order:** 001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009

---

## Environment Variables

### Railway (backend)

| Variable | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | Yes | |
| `SUPABASE_ANON_KEY` | Yes | |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Never expose publicly |
| `JWT_SECRET` | Yes | Copy from Supabase → Settings → API |
| `GEMINI_API_KEY` | Yes | Primary LLM |
| `OPENROUTER_API_KEY` | Yes | LLM failover |
| `SENDGRID_API_KEY` | Yes | Morning brief |
| `SENDGRID_FROM_EMAIL` | No | Default: `insights@akara.ai` |
| `BACKEND_SERVICE_KEY` | Yes | Edge Function → backend auth |
| `ENVIRONMENT` | Yes | `production` |
| `ALLOWED_ORIGINS_RAW` | Yes | Your Vercel URL + custom domain |
| `SENTRY_DSN` | No | Error tracking |

### Vercel (frontend)

| Variable | Required |
|---|---|
| `VITE_SUPABASE_URL` | Yes |
| `VITE_SUPABASE_ANON_KEY` | Yes |
| `VITE_API_BASE_URL` | Yes |
| `VITE_SENTRY_DSN` | No |

---

## Supabase Free Tier Limits

Check usage: Supabase → Project Settings → Billing

| Limit | Free tier | Action when near |
|---|---|---|
| Database size | 500 MB | Upgrade to Pro ($25/mo) |
| Storage | 1 GB | Upgrade to Pro |
| Edge Function invocations | 500K/mo | Monitor morning brief frequency |
| Realtime connections | 200 | Not currently used |

Upgrade trigger: **first paying customer onboards** → upgrade to Pro immediately.
```

## Placement

New file. Place at: `akara/docs/runbook.md`

## Explanation

Five issue playbooks cover the most likely production failures:
1. KPI 500 → missing service role key or empty `sales_data`
2. Import failure → wrong file extension or missing required columns
3. LLM unavailable → quota exhausted or missing API keys
4. Morning brief not sending → SendGrid key or mismatched `BACKEND_SERVICE_KEY`
5. Frontend blank screen → JavaScript error or failed Vercel deployment

Deployment commands include the ruff + pytest gate before `railway up` to prevent broken deploys. Environment variable tables consolidate what `.env.example` documents into a scannable reference with Required/Notes columns.

## Related Changes

- `akara/docs/onboarding-checklist.md` — companion operations document (Day 11)
- `akara/backend/.env.example` — aligned with the variables listed in this runbook

---

# File: `akara_agent.py`

**Status:** Created

## Purpose

Post-launch deliverable specified in `daywise.md`. A standalone Python script shipped to Customer 1 during onboarding. It runs nightly on the customer's Windows machine via Windows Task Scheduler, reads yesterday's sales invoices from the local Tally ERP HTTP API, maps them to AKARA's column schema, and pushes them to `POST /data/sync`. This makes the morning brief feel automatic — data is always fresh by the time the brief fires at 7 AM IST.

AKARA works fully without this script (customers can upload CSVs manually from `/data`). The agent is optional convenience.

## Dependencies

- Python 3.11+ on the customer's Windows machine
- `requests` library (`pip install requests`)
- Tally ERP running with HTTP export enabled (`localhost:9000` by default)
- `AKARA_API_URL` — AKARA backend URL (e.g. `https://api.akara.ai`)
- `AKARA_API_KEY` — tenant API key from AKARA settings (not yet implemented as a separate key type; use the JWT token from Supabase for now)
- Backend endpoint: `POST /data/sync` — accepts `{"source_type": "primary", "rows": [...]}` (Day 4)

## Implementation

```python
"""
AKARA Overnight Sync Agent
Runs nightly on the customer's Tally machine via Windows Task Scheduler.
Reads today's Tally invoices and pushes them to AKARA /data/sync.

Configure once:
  AKARA_API_URL   = https://api.akara.ai
  AKARA_API_KEY   = <tenant API key from AKARA settings>
  TALLY_URL       = http://localhost:9000  (default Tally HTTP port)

Installation (one-time, ~10 minutes):
  1. Install Python 3.11+  →  python.org/downloads (silent installer)
  2. pip install requests
  3. Save this file to  C:\\akara\\akara_agent.py
  4. Create C:\\akara\\run.bat:
         @echo off
         set AKARA_API_URL=https://api.akara.ai
         set AKARA_API_KEY=<key from AKARA dashboard>
         python C:\\akara\\akara_agent.py
  5. Task Scheduler → Create Basic Task
         Name:    AKARA Nightly Sync
         Trigger: Daily at 11:00 PM
         Action:  Start a program → C:\\akara\\run.bat
  6. Test: run C:\\akara\\run.bat manually, check C:\\akara_agent.log
"""

import json
import logging
import os
import sys
import xml.etree.ElementTree as ET
from datetime import date, timedelta
from pathlib import Path

import requests

# ── Config ────────────────────────────────────────────────────────────────────
AKARA_API_URL = os.environ.get("AKARA_API_URL", "https://api.akara.ai")
AKARA_API_KEY = os.environ.get("AKARA_API_KEY", "")
TALLY_URL     = os.environ.get("TALLY_URL", "http://localhost:9000")
LOG_FILE      = Path(os.environ.get("AKARA_LOG", "C:/akara_agent.log"))
SYNC_DAYS     = int(os.environ.get("AKARA_SYNC_DAYS", "1"))  # 1 = yesterday only

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    filename=str(LOG_FILE),
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("akara_agent")


# ── Tally XML Request ──────────────────────────────────────────────────────────
TALLY_VOUCHER_XML = """
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Voucher Register</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <SVFROMDATE>{from_date}</SVFROMDATE>
          <SVTODATE>{to_date}</SVTODATE>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>
""".strip()


def fetch_tally_invoices(from_date: date, to_date: date) -> list[dict]:
    """Pull sales vouchers from local Tally HTTP API and return list of row dicts."""
    xml_body = TALLY_VOUCHER_XML.format(
        from_date=from_date.strftime("%Y%m%d"),
        to_date=to_date.strftime("%Y%m%d"),
    )
    try:
        resp = requests.post(TALLY_URL, data=xml_body, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.error("Tally HTTP error: %s", exc)
        return []

    root = ET.fromstring(resp.text)
    rows: list[dict] = []

    for voucher in root.iter("VOUCHER"):
        v_type = (voucher.findtext("VOUCHERTYPENAME") or "").upper()
        if v_type != "SALES":
            continue

        invoice_date   = voucher.findtext("DATE") or ""
        invoice_number = voucher.findtext("VOUCHERNUMBER") or ""
        party_name     = voucher.findtext("PARTYNAME") or ""

        for item in voucher.iter("ALLINVENTORYENTRIES.LIST"):
            product_name = item.findtext("STOCKITEMNAME") or ""
            quantity     = _safe_float(item.findtext("ACTUALQTY"))
            amount       = _safe_float(item.findtext("AMOUNT"))

            if not product_name:
                continue

            rows.append({
                "invoice_date":    _fmt_date(invoice_date),
                "invoice_number":  invoice_number,
                "party_name":      party_name,
                "party_city":      "",
                "party_zone":      "",
                "route":           "",
                "product_name":    product_name,
                "product_group":   "",
                "quantity":        abs(quantity),
                "gross_amount":    abs(amount),
                "discount_amount": 0,
                "net_amount":      abs(amount),
                "tax_amount":      0,
                "total_amount":    abs(amount),
            })

    logger.info("Tally returned %d line items for %s–%s", len(rows), from_date, to_date)
    return rows


def _safe_float(text: str | None) -> float:
    try:
        return float((text or "0").replace(",", "").strip())
    except ValueError:
        return 0.0


def _fmt_date(tally_date: str) -> str:
    """Convert Tally YYYYMMDD → ISO YYYY-MM-DD."""
    if len(tally_date) == 8:
        return f"{tally_date[:4]}-{tally_date[4:6]}-{tally_date[6:]}"
    return tally_date


# ── Push to AKARA ──────────────────────────────────────────────────────────────

def push_to_akara(rows: list[dict], source_type: str = "primary") -> bool:
    if not rows:
        logger.info("No rows to push, skipping.")
        return True

    payload = {"source_type": source_type, "rows": rows}
    try:
        resp = requests.post(
            f"{AKARA_API_URL}/data/sync",
            json=payload,
            headers={"X-API-Key": AKARA_API_KEY},
            timeout=60,
        )
        resp.raise_for_status()
        result = resp.json()
        logger.info(
            "AKARA sync OK: %d inserted, %d skipped",
            result.get("rows_inserted", 0),
            result.get("rows_skipped", 0),
        )
        return True
    except requests.RequestException as exc:
        logger.error("AKARA push failed: %s", exc)
        return False


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    if not AKARA_API_KEY:
        logger.error("AKARA_API_KEY not set. Aborting.")
        sys.exit(1)

    today     = date.today()
    from_date = today - timedelta(days=SYNC_DAYS)
    to_date   = today - timedelta(days=1)

    logger.info("Starting sync for %s–%s", from_date, to_date)
    rows = fetch_tally_invoices(from_date, to_date)
    ok   = push_to_akara(rows, source_type="primary")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
```

## Placement

New file. Place at the repository root: `akara_agent.py` (same level as the `akara/` directory, not inside it).

## Explanation

- All configuration comes from environment variables (`AKARA_API_URL`, `AKARA_API_KEY`, `TALLY_URL`, `AKARA_LOG`, `AKARA_SYNC_DAYS`) — no hardcoded credentials.
- `fetch_tally_invoices(from_date, to_date)` — POSTs a Tally XML "Voucher Register" export request to `localhost:9000`. Filters for `VOUCHERTYPENAME == "SALES"`. Iterates `ALLINVENTORYENTRIES.LIST` to get line-item detail. Returns a list of dicts using the exact column names that `POST /data/sync` expects.
- `_safe_float` — handles Tally's comma-formatted numbers (`"1,23,456.78"`).
- `_fmt_date` — converts Tally's `YYYYMMDD` format to ISO `YYYY-MM-DD`.
- `push_to_akara(rows, source_type)` — POSTs `{"source_type": "primary", "rows": [...]}` with `X-API-Key` header. Returns `True` on success.
- `main()` — validates `AKARA_API_KEY` is set, computes the date range (yesterday by default), fetches, pushes, exits 0/1. Exit code allows `run.bat` or Task Scheduler to detect failures.
- Logs to `C:/akara_agent.log` (configurable). The log file grows indefinitely — advise customers to check its size monthly.

## Related Changes

- `akara/backend/app/api/routes/data.py` — `POST /data/sync` endpoint that receives the payload (Day 4)
- `akara/docs/onboarding-checklist.md` — Step 5 references this script (Day 11)
- `akara/docs/runbook.md` — does not yet document this script; add a note when Customer 1 receives it

---

## Final Verification Checklist

- [x] `akara/backend/.env.example` — documented, stale Gmail vars removed, SendGrid + BACKEND_SERVICE_KEY added
- [x] `akara/frontend/src/pages/admin/UsersPage.tsx` — documented with full code
- [x] `akara/frontend/src/App.tsx` — documented with full file and precise diff from Day 11
- [x] `akara/frontend/src/components/layout/AppShell.tsx` — documented with full file and precise diff from Day 11
- [x] `akara/docs/runbook.md` — documented with full contents
- [x] `akara_agent.py` — documented with full code and placement note
- [x] No new packages added — confirmed
- [x] No backend source code changes — confirmed
- [x] `tsc --noEmit` passes 0 errors — confirmed
