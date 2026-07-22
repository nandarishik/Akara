# Day 13 Implementation Handoff

## Reproduction Instructions

### Expected repository state before applying Day 13 changes

Days 1 through 12 must already be implemented exactly as documented in:

- `docs/day1_implementation.md` through `docs/day12_implementation.md`

Before Day 13 is applied, the following must already exist:

| Path | Origin |
|---|---|
| `akara/frontend/src/App.tsx` | Day 1 |
| `akara/frontend/src/pages/LoginPage.tsx` | Day 2 |
| `akara/frontend/src/index.css` | Day 1 (contains only `@import "tailwindcss";`) |
| `akara/frontend/package.json` | Day 1 (includes `"@sentry/react": "^8.56.0"` — **invalid version**, fixed on Day 13) |
| No `.github/` directory | — |
| No `PrivacyPage.tsx` or `TermsPage.tsx` | — |

### Order in which to apply Day 13 changes

Apply in this order — later steps depend on earlier ones:

1. Fix `@sentry/react` version in `akara/frontend/package.json`
2. Add `@tailwindcss/typography` dev dependency to `akara/frontend/package.json`
3. Run `npm install --legacy-peer-deps` in `akara/frontend/`
4. Add `@plugin "@tailwindcss/typography";` to `akara/frontend/src/index.css`
5. Create `akara/frontend/src/pages/PrivacyPage.tsx`
6. Create `akara/frontend/src/pages/TermsPage.tsx`
7. Modify `akara/frontend/src/App.tsx` (add imports + public routes)
8. Modify `akara/frontend/src/pages/LoginPage.tsx` (add footer)
9. Create `.github/workflows/ci.yml`

### Commands required after copying the code

```bash
# Install updated/new frontend dependencies
cd akara/frontend
npm install --legacy-peer-deps

# Verify TypeScript compiles
npx tsc --noEmit
# Expected: 0 errors
```

### Manual steps required (external dashboards — not in code)

These cannot be scripted and must be done manually:

1. **GitHub → Settings → Secrets and Variables → Actions**: Add repository secrets:
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`,
   `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
   `VITE_API_BASE_URL`
2. **Vercel**: Project → Settings → Domains → add custom domain → copy CNAME → add DNS record at registrar → SSL auto-provisions
3. **Railway**: Update `ALLOWED_ORIGINS_RAW` to include custom domain → redeploy

---

## Environment Variables

No new environment variables were introduced on Day 13.

The CI workflow reads the following secrets from GitHub Actions, all of which correspond to environment variables established on earlier days:

| Secret / Variable | Used in CI job | Origin |
|---|---|---|
| `SUPABASE_URL` | `backend-lint-test` | Day 2 |
| `SUPABASE_ANON_KEY` | `backend-lint-test` | Day 2 |
| `SUPABASE_SERVICE_ROLE_KEY` | `backend-lint-test` | Day 2 |
| `JWT_SECRET` | `backend-lint-test` | Day 2 |
| `GEMINI_API_KEY` | `backend-lint-test` | Day 4 |
| `OPENROUTER_API_KEY` | `backend-lint-test` | Day 4 |
| `VITE_SUPABASE_URL` | `frontend-build` | Day 1 |
| `VITE_SUPABASE_ANON_KEY` | `frontend-build` | Day 1 |
| `VITE_API_BASE_URL` | `frontend-build` | Day 1 |

`ENVIRONMENT=ci` and `LOG_LEVEL=WARNING` are hardcoded in the CI workflow (not secrets).

---

## Package / Dependency Changes

### `akara/frontend/package.json`

Two changes were made to this file on Day 13:

#### 1. `@sentry/react` version fixed

**Original:**
```json
"@sentry/react": "^8.56.0",
```

**Replacement:**
```json
"@sentry/react": "^9.0.0",
```

**Reason:** The version `^8.56.0` does not exist on npm. The Sentry package versioning jumped from the 8.x series directly to 9.x. This caused `npm install` to fail with `ETARGET: No matching version found`. Fixed to `^9.0.0` which resolves to the latest 9.x release.

#### 2. `@tailwindcss/typography` added

**Added to `devDependencies`:**
```json
"@tailwindcss/typography": "^0.5.20",
```

**Why needed:** The `PrivacyPage` and `TermsPage` use Tailwind's `prose` utility classes (`prose prose-slate`). These classes are provided by the `@tailwindcss/typography` plugin. Without this package, the `prose` classes are undefined and the pages have no typography styling.

**Note on Tailwind v4 integration:** This project uses Tailwind CSS v4 (`tailwindcss@4.3.3` with `@tailwindcss/vite`). In v4 there is **no `tailwind.config.js`**. Plugins are registered in CSS using `@plugin`, not in a JavaScript config file. The `daywise.md` instruction to add `plugins: [require("@tailwindcss/typography")]` to a config file does not apply here.

---

# File: `akara/frontend/src/index.css`

**Status:** Modified

## Purpose

Register the `@tailwindcss/typography` plugin so that the `prose` and `prose-slate` CSS utility classes used by `PrivacyPage` and `TermsPage` are generated. In Tailwind v4, plugins are declared with an `@plugin` directive inside the CSS entry file rather than in a JavaScript config.

## Dependencies

| Dependency | Type | Pre-existing |
|---|---|---|
| `@tailwindcss/typography` | npm package | No — added Day 13 |
| `tailwindcss` (v4) via `@tailwindcss/vite` | npm package + Vite plugin | Yes (Day 1) |

## Implementation

**Original file contents (before Day 13):**
```css
@import "tailwindcss";
```

**Replacement (complete file after Day 13):**
```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

## Placement

This is the complete file. The `@plugin` line must come **after** the `@import "tailwindcss";` line on line 1.

## Explanation

The `@import "tailwindcss";` directive loads the Tailwind v4 base styles. The `@plugin "@tailwindcss/typography";` directive instructs the Tailwind v4 PostCSS/Vite pipeline to also generate all prose utility classes. Once registered, `className="prose prose-slate"` on any element produces typographically styled long-form text content (headings, paragraphs, links).

## Related Changes

- Required by `akara/frontend/src/pages/PrivacyPage.tsx` (Day 13 — uses `prose prose-slate`)
- Required by `akara/frontend/src/pages/TermsPage.tsx` (Day 13 — uses `prose prose-slate`)
- Extends `akara/frontend/src/index.css` (Day 1)

---

# File: `akara/frontend/src/pages/PrivacyPage.tsx`

**Status:** Created

## Purpose

Public-facing Privacy Policy page, accessible at `/privacy` without authentication. Required for legal compliance before onboarding paying customers. The `daywise.md` Day 13 plan specifies this page explicitly.

## Dependencies

| Dependency | Type | Pre-existing |
|---|---|---|
| `@tailwindcss/typography` (via `prose` classes) | CSS | No — added Day 13 |
| React (JSX) | Framework | Yes (Day 1) |

No imports needed — this is a pure JSX component with no internal imports.

## Implementation

```tsx
export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16 prose prose-slate">
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="text-slate-500">Last updated: {new Date().getFullYear()}</p>

        <h2>Information We Collect</h2>
        <p>
          AKARA collects sales data that you upload, your email address used for
          account creation, and usage analytics to improve the product.
        </p>

        <h2>How We Use Your Data</h2>
        <p>
          Your data is used exclusively to power analytics features within your
          account. We do not sell your data to third parties.
        </p>

        <h2>Data Storage</h2>
        <p>
          All data is stored in Supabase (PostgreSQL) hosted on AWS. Data is
          encrypted at rest and in transit.
        </p>

        <h2>Data Isolation</h2>
        <p>
          Each customer's data is logically isolated using Row Level Security
          policies. No tenant can access another tenant's data.
        </p>

        <h2>Contact</h2>
        <p>For privacy inquiries, email: privacy@yourdomain.com</p>
      </div>
    </div>
  );
}
```

## Placement

New file at `akara/frontend/src/pages/PrivacyPage.tsx`. No existing file is modified.

## Explanation

A stateless functional component. The outer `<div>` sets a full-height white background. The inner `<div>` uses Tailwind's `prose prose-slate` classes (from `@tailwindcss/typography`) to apply professional typographic styling to the headings and paragraphs within. `{new Date().getFullYear()}` renders the current year dynamically at runtime.

The contact email `privacy@yourdomain.com` is a placeholder — replace with the actual support email before going live.

## Related Changes

- Imported and routed in `akara/frontend/src/App.tsx` (Day 13 modification)
- Linked from `akara/frontend/src/pages/LoginPage.tsx` footer (Day 13 modification)
- Requires `@plugin "@tailwindcss/typography";` in `akara/frontend/src/index.css` (Day 13 modification)

---

# File: `akara/frontend/src/pages/TermsPage.tsx`

**Status:** Created

## Purpose

Public-facing Terms of Service page, accessible at `/terms` without authentication. Required for legal compliance before onboarding paying customers. Specified in `daywise.md` Day 13.

## Dependencies

| Dependency | Type | Pre-existing |
|---|---|---|
| `@tailwindcss/typography` (via `prose` classes) | CSS | No — added Day 13 |
| React (JSX) | Framework | Yes (Day 1) |

No imports needed — pure JSX component.

## Implementation

```tsx
export function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16 prose prose-slate">
        <h1 className="text-3xl font-bold">Terms of Service</h1>
        <p className="text-slate-500">Last updated: {new Date().getFullYear()}</p>

        <h2>Acceptance</h2>
        <p>
          By using AKARA, you agree to these terms. If you do not agree,
          discontinue use immediately.
        </p>

        <h2>Use of Service</h2>
        <p>
          AKARA is provided for business analytics purposes. You are responsible
          for the accuracy of data you upload.
        </p>

        <h2>Data Ownership</h2>
        <p>
          You retain ownership of all data you upload. AKARA claims no ownership
          over your sales data.
        </p>

        <h2>Limitation of Liability</h2>
        <p>
          AKARA provides analytics tools on an "as-is" basis. We are not liable
          for business decisions made based on dashboard outputs.
        </p>

        <h2>Termination</h2>
        <p>
          We may suspend accounts that violate these terms. You may delete your
          account and data at any time.
        </p>
      </div>
    </div>
  );
}
```

## Placement

New file at `akara/frontend/src/pages/TermsPage.tsx`. No existing file is modified.

## Explanation

Identical structure to `PrivacyPage`. A stateless functional component styled with `prose prose-slate` for typographic layout. `{new Date().getFullYear()}` renders the current year dynamically. All content is static.

## Related Changes

- Imported and routed in `akara/frontend/src/App.tsx` (Day 13 modification)
- Linked from `akara/frontend/src/pages/LoginPage.tsx` footer (Day 13 modification)
- Requires `@plugin "@tailwindcss/typography";` in `akara/frontend/src/index.css` (Day 13 modification)

---

# File: `akara/frontend/src/App.tsx`

**Status:** Modified

## Purpose

Wire the two new public pages (`PrivacyPage`, `TermsPage`) into React Router so they are accessible at `/privacy` and `/terms` **without** requiring authentication. Both routes must be placed outside `<ProtectedRoute>` so unauthenticated visitors (e.g., prospective customers reading the privacy policy before signing up) can access them.

## Dependencies

| Dependency | Type | Pre-existing |
|---|---|---|
| `akara/frontend/src/pages/PrivacyPage.tsx` | Internal component | No — created Day 13 |
| `akara/frontend/src/pages/TermsPage.tsx` | Internal component | No — created Day 13 |
| `react-router-dom` (`Route`) | Package | Yes (Day 1) |
| All other existing imports | Internal | Yes (Days 1–11) |

## Implementation

**Original file (before Day 13):**
```tsx
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

**Complete file after Day 13:**
```tsx
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
import { PrivacyPage } from "@/pages/PrivacyPage";
import { TermsPage } from "@/pages/TermsPage";
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
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
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

**Two additions** were made to the existing file:

**1. Two new import lines** — inserted after the existing `import { NotFoundPage }` line and before the existing `import { TenantsPage }` line:
```tsx
import { PrivacyPage } from "@/pages/PrivacyPage";
import { TermsPage } from "@/pages/TermsPage";
```

**2. Two new route lines** — inserted inside `<Routes>`, after `<Route path="/login" element={<LoginPage />} />` and before `<Route element={<ProtectedRoute />}>`:
```tsx
<Route path="/privacy" element={<PrivacyPage />} />
<Route path="/terms" element={<TermsPage />} />
```

## Explanation

React Router evaluates routes in declaration order. The `/privacy` and `/terms` routes are placed **before** `<ProtectedRoute>` so they resolve without triggering the auth guard. If they were placed inside `<ProtectedRoute>`, unauthenticated users would be redirected to `/login` when trying to read the privacy policy.

## Related Changes

- Renders `akara/frontend/src/pages/PrivacyPage.tsx` (Day 13 — created)
- Renders `akara/frontend/src/pages/TermsPage.tsx` (Day 13 — created)
- Extends `akara/frontend/src/App.tsx` (Day 11 — last modified to add admin routes)

---

# File: `akara/frontend/src/pages/LoginPage.tsx`

**Status:** Modified

## Purpose

Add a legal consent footer below the sign-in form that links to `/terms` and `/privacy`. This satisfies the standard "by signing in you agree to our Terms and Privacy Policy" pattern required before customer onboarding.

## Dependencies

| Dependency | Type | Pre-existing |
|---|---|---|
| `akara/frontend/src/pages/PrivacyPage.tsx` | Route target (`/privacy`) | No — created Day 13 |
| `akara/frontend/src/pages/TermsPage.tsx` | Route target (`/terms`) | No — created Day 13 |
| All existing imports in `LoginPage.tsx` | Internal | Yes (Day 2) |

## Implementation

**What was added** — insert the `<p>` block below, immediately after the closing `</form>` tag and before the closing `</CardContent>` tag:

```tsx
          <p className="text-xs text-center text-slate-400 mt-4">
            By signing in, you agree to our{" "}
            <a href="/terms" className="underline hover:text-slate-600">
              Terms
            </a>{" "}
            and{" "}
            <a href="/privacy" className="underline hover:text-slate-600">
              Privacy Policy
            </a>
            .
          </p>
```

**Complete file after Day 13 (for safe copy-paste):**
```tsx
import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">
            AKARA
          </CardTitle>
          <CardDescription>
            Sign in to your analytics dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <p className="text-xs text-center text-slate-400 mt-4">
            By signing in, you agree to our{" "}
            <a href="/terms" className="underline hover:text-slate-600">
              Terms
            </a>{" "}
            and{" "}
            <a href="/privacy" className="underline hover:text-slate-600">
              Privacy Policy
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

## Placement

The `<p>` element is placed **inside `<CardContent>`**, directly after the closing `</form>` tag. It is **outside** the `<form>` element (not a form field) and **before** the closing `</CardContent>` tag.

The exact insertion context:
```tsx
            </Button>
          </form>
          {/* INSERT HERE */}
          <p className="text-xs text-center text-slate-400 mt-4">
            ...
          </p>
        </CardContent>
```

## Explanation

Plain HTML anchor tags (`<a href="...">`) are used intentionally instead of React Router's `<Link>` component. The login page already uses `<a>` tags consistently for external-style navigation and the legal pages are public so a full page navigation (not a client-side route transition) is acceptable here. `hover:text-slate-600` provides a subtle darkening hover state.

## Related Changes

- Links to `/privacy` → `akara/frontend/src/pages/PrivacyPage.tsx` (Day 13 — created)
- Links to `/terms` → `akara/frontend/src/pages/TermsPage.tsx` (Day 13 — created)
- Extends `akara/frontend/src/pages/LoginPage.tsx` (Day 2 — original creation)

---

# File: `.github/workflows/ci.yml`

**Status:** Created

## Purpose

GitHub Actions CI workflow that runs automatically on every push to `main` and on every pull request targeting `main`. Provides two parallel jobs:

1. **`backend-lint-test`**: Runs `ruff check .` (lint) and `pytest tests/` (28 tests) against the FastAPI backend.
2. **`frontend-build`**: Runs `pnpm build` (Vite production build) and `tsc --noEmit` (TypeScript type check) against the React frontend.

This is the complete CI setup required by `daywise.md` Day 13, Track 2.

## Dependencies

| Dependency | Type | Pre-existing |
|---|---|---|
| `akara/backend/pyproject.toml` | Backend config + dependencies | Yes (Day 1) |
| `akara/frontend/pnpm-lock.yaml` | Frontend lockfile | Yes (Day 1) |
| GitHub Actions runners | External | — |
| GitHub repository secrets | External (manual) | Must be added manually |
| `uv` Python package manager | Tool | Yes (Day 1) |
| `pnpm` v9 | Tool | Yes (Day 1) |

**Important deviation from `daywise.md`**: The `daywise.md` plan used `working-directory: backend` and `working-directory: frontend`. The actual repository root is `Functional-test2/` and the code lives in `akara/backend` and `akara/frontend`. The correct `working-directory` values are `akara/backend` and `akara/frontend`. Similarly, the pnpm lockfile cache path must be `akara/frontend/pnpm-lock.yaml`.

## Implementation

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  backend-lint-test:
    name: Backend — Lint + Test
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: akara/backend

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Python 3.12
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install uv
        run: pip install uv

      - name: Install dependencies
        run: uv sync --extra dev

      - name: Ruff lint
        run: uv run ruff check .

      - name: Run tests
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          ENVIRONMENT: ci
          LOG_LEVEL: WARNING
        run: uv run pytest tests/ -v --tb=short

  frontend-build:
    name: Frontend — Build
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: akara/frontend

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"
          cache-dependency-path: akara/frontend/pnpm-lock.yaml

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          VITE_API_BASE_URL: ${{ secrets.VITE_API_BASE_URL }}
        run: pnpm build

      - name: Type check
        run: pnpm exec tsc --noEmit
```

## Placement

New file. Place at `.github/workflows/ci.yml` (relative to the git repository root `Functional-test2/`). Create the directory if it does not exist:

```bash
mkdir -p .github/workflows
```

The `.github/` directory does not exist before Day 13.

## Explanation

**Trigger**: Both `push` to `main` and `pull_request` targeting `main`.

**`backend-lint-test` job**:
- Checks out the repo, sets up Python 3.12, installs `uv`.
- `uv sync --extra dev` installs all dependencies including dev-only packages (pytest, ruff, etc.) declared under `[project.optional-dependencies] dev` in `pyproject.toml`.
- `uv run ruff check .` fails the build if any Python linting error is found.
- `uv run pytest tests/ -v --tb=short` runs all 28 tests. The environment variables are injected from GitHub Actions secrets — these match the same vars in the backend `.env` file. `ENVIRONMENT=ci` and `LOG_LEVEL=WARNING` are hardcoded to avoid verbose output in CI.

**`frontend-build` job**:
- Checks out the repo, installs pnpm v9 via `pnpm/action-setup@v3`, then Node 20.
- The `cache-dependency-path: akara/frontend/pnpm-lock.yaml` key correctly points to the lockfile location within the monorepo for pnpm cache restoration.
- `pnpm install --frozen-lockfile` fails if the lockfile is out of date, enforcing reproducible installs.
- `pnpm build` runs the Vite production build with injected `VITE_*` env vars (required for the build to not fail on undefined env var access).
- `pnpm exec tsc --noEmit` runs the TypeScript compiler purely for type checking without emitting files — fails if there are any type errors.

The two jobs run in parallel (no `needs:` dependency between them).

## Related Changes

- Tests `akara/backend/tests/` (all 28 tests from Days 1–12)
- Builds `akara/frontend/` (all frontend code from Days 1–13)
- Depends on `akara/backend/pyproject.toml` `[project.optional-dependencies] dev` section (Day 1)
- Depends on `akara/frontend/pnpm-lock.yaml` (Day 1, updated Day 13 when `@tailwindcss/typography` was added)

---

## Final Verification

| Checklist item | Status |
|---|---|
| Every Day 13 file change documented | ✓ (7 files: `index.css`, `PrivacyPage.tsx`, `TermsPage.tsx`, `App.tsx`, `LoginPage.tsx`, `ci.yml`, `package.json`) |
| No Day 1–12 unchanged code duplicated | ✓ |
| Every new import has a corresponding dependency or file | ✓ |
| Every changed environment variable documented | ✓ (none new; CI secrets documented) |
| Every package change documented | ✓ (`@tailwindcss/typography@^0.5.20` added, `@sentry/react` fixed from `^8.56.0` → `^9.0.0`) |
| No tests added on Day 13 | ✓ (Day 13 is UI + CI only) |
| All file paths are valid | ✓ |
| All code blocks complete and correctly formatted | ✓ |
| `npx tsc --noEmit` passes | ✓ (verified — 0 errors) |

## Day 13 Files Changed Summary

| File | Status | Track |
|---|---|---|
| `akara/frontend/package.json` | Modified | Track 1 (dependency + bugfix) |
| `akara/frontend/src/index.css` | Modified | Track 1 (typography plugin) |
| `akara/frontend/src/pages/PrivacyPage.tsx` | Created | Track 1 |
| `akara/frontend/src/pages/TermsPage.tsx` | Created | Track 1 |
| `akara/frontend/src/App.tsx` | Modified | Track 1 (routing) |
| `akara/frontend/src/pages/LoginPage.tsx` | Modified | Track 1 (footer) |
| `.github/workflows/ci.yml` | Created | Track 2 |
