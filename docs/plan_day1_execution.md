---
name: Day 1 Execution
overview: Create the monorepo scaffold, backend Python project, frontend React project, and apply all Supabase database migrations with RLS policies. Nothing is deployed today — the output is a working local repo with a live remote database schema.
todos:
  - id: d1-root
    content: Create monorepo root files (.gitignore, README.md)
    status: completed
  - id: d1-backend-dirs
    content: Create all backend directory structure with mkdir -p
    status: completed
  - id: d1-backend-files
    content: Create pyproject.toml, .env.example, all __init__.py files, conftest.py
    status: completed
  - id: d1-backend-env
    content: Copy .env.example to .env, fill in Supabase + API keys, run uv venv && uv sync --extra dev
    status: completed
  - id: d1-frontend
    content: Scaffold frontend with Vite, install deps, init TailwindCSS, init shadcn/ui, create supabase.ts client
    status: completed
  - id: d1-migrations
    content: Write 001_initial_schema.sql (7 tables + indexes + updated_at trigger)
    status: completed
  - id: d1-rls
    content: Write 002_rls_policies.sql (RLS enable + all policies + helper functions)
    status: completed
  - id: d1-functions
    content: Write 003_functions.sql (handle_new_user trigger + get_kpi_summary)
    status: completed
  - id: d1-apply
    content: Apply all 3 migrations via supabase db push or Supabase SQL Editor
    status: completed
  - id: d1-verify
    content: Run all 4 SQL verification queries in Supabase Dashboard
    status: completed
  - id: d1-quality
    content: Run ruff check . && pytest locally
    status: completed
isProject: false
---

# Day 1 — Monorepo Scaffold + Supabase Schema + RLS

**Goal:** By end of day, the repo structure exists, all 7 Supabase tables are created, all RLS policies are applied, and both frontend and backend can connect to Supabase.

---

## Prerequisites to confirm before starting

- Supabase project created on free tier — project URL + anon key + service role key + JWT secret available from Dashboard → Settings → API
- Local machine has: Python 3.12+, Node 20+, `uv`, `pnpm`, Supabase CLI

---

## Step 1 — Monorepo root

Create these two files at the repo root:

- `akara/.gitignore` — ignores `__pycache__/`, `.venv/`, `node_modules/`, `.env`, `.env.local`, `supabase/.branches/`, `supabase/.temp/`, `.DS_Store`
- `akara/README.md` — brief description and monorepo structure overview

---

## Step 2 — Backend scaffold

Run from repo root:

```bash
mkdir -p backend/app/api/routes
mkdir -p backend/app/core
mkdir -p backend/app/services/copilot/tools
mkdir -p backend/app/services/copilot/guardrails
mkdir -p backend/app/services/llm
mkdir -p backend/app/services/kpi
mkdir -p backend/app/services/data_import
mkdir -p backend/app/services/schema
mkdir -p backend/app/services/prompts
mkdir -p backend/app/sql
mkdir -p backend/tests
```

Create these files:

- `backend/pyproject.toml` — all dependencies (fastapi, uvicorn, supabase, pydantic-settings, python-jose, google-generativeai, openai, scikit-learn, pandas, sentry-sdk, openpyxl) + ruff config + pytest config with `asyncio_mode = "auto"`
- `backend/.env.example` — all env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `ENVIRONMENT`, `LOG_LEVEL`, `ALLOWED_ORIGINS`, `SENTRY_DSN` (empty for now)
- `backend/app/__init__.py`, `backend/app/api/__init__.py`, `backend/app/api/routes/__init__.py`, `backend/app/core/__init__.py`, `backend/app/services/__init__.py`, `backend/app/sql/__init__.py`, `backend/tests/__init__.py` — all empty
- `backend/tests/conftest.py` — pytest fixture returning a `TestClient(app)`

Copy `.env.example` to `.env` and fill in real values. Then:

```bash
cd backend && uv venv && uv sync --extra dev
```

---

## Step 3 — Frontend scaffold

```bash
pnpm create vite frontend -- --template react-ts
cd frontend
pnpm install
pnpm add react-router-dom @supabase/supabase-js @tanstack/react-query zustand
pnpm add -D tailwindcss postcss autoprefixer eslint prettier eslint-config-prettier
pnpm dlx tailwindcss init -p
pnpm dlx shadcn@latest init   # Style: Default, Color: Slate, CSS vars: Yes
```

Create:
- `frontend/.env.example` — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL=http://localhost:8000`
- `frontend/.env.local` — copy of above with real values
- `frontend/src/lib/supabase.ts` — creates and exports `supabase` client using `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`, throws at module load if either is missing

---

## Step 4 — Supabase migrations

```bash
cd ..  # repo root
mkdir -p supabase/migrations
supabase init
```

Create and apply 3 migration files:

**`supabase/migrations/001_initial_schema.sql`** — 7 tables:
- `tenants` (id UUID PK, name, slug UNIQUE, config JSONB, is_active, created_at, updated_at) + `updated_at` trigger
- `profiles` (id UUID FK→auth.users, tenant_id FK→tenants, role CHECK IN ('admin','user'), display_name, created_at)
- `sales_data` (BIGSERIAL PK, tenant_id, invoice_date, invoice_number, party_name, party_city, party_zone, route, product_name, product_group, product_category, hsn_code, quantity, gross/discount/net/tax/total_amount, raw_data JSONB, created_at)
- `context_cache` (tenant_id, context_type CHECK IN ('weather','news','holiday'), context_date, content JSONB, expires_at, UNIQUE(tenant_id, context_type, context_date))
- `chat_history` (tenant_id, user_id FK→auth.users, question, response, metadata JSONB, created_at)
- `audit_log` (tenant_id nullable, user_id nullable, action, resource_type, resource_id, details JSONB, ip_address)
- `generated_reports` (tenant_id, report_type, title, storage_path, file_size_bytes, metadata JSONB)
- Indexes: `~18 total` — compound `(tenant_id, invoice_date)` on sales_data, plus single-column indexes on all foreign keys and query-hot columns

**`supabase/migrations/002_rls_policies.sql`** — RLS on all 7 tables:
- Helper function `get_my_tenant_id()` — `SELECT tenant_id FROM profiles WHERE id = auth.uid()`, SECURITY DEFINER
- Helper function `is_admin()` — checks role = 'admin' in profiles, SECURITY DEFINER
- `tenants`: SELECT own, UPDATE own + admin
- `profiles`: SELECT own or tenant admin; UPDATE own; INSERT own
- `sales_data`: SELECT tenant-scoped; INSERT/DELETE admin only
- `context_cache`, `generated_reports`: ALL for tenant
- `chat_history`: SELECT own or tenant admin; INSERT own + tenant check
- `audit_log`: SELECT admin only

**`supabase/migrations/003_functions.sql`** — 3 functions + 1 trigger:
- `handle_new_user()` trigger — on INSERT to `auth.users`, creates `profiles` row using `raw_user_meta_data->>'tenant_id'` and `role`
- `get_kpi_summary(tenant_id, start_date, end_date)` — returns JSONB with total_revenue, total_orders, unique_parties, avg_order_value, total_quantity, total_discount

Apply:
```bash
supabase db push
# OR paste each file manually into Supabase Dashboard → SQL Editor
```

---

## Step 5 — Verify

In Supabase Dashboard → SQL Editor, run these 4 checks:

```sql
-- 1. All 7 tables with RLS enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('tenants','profiles','sales_data','context_cache','chat_history','audit_log','generated_reports');
-- All rows: rowsecurity = true

-- 2. All 4 functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_my_tenant_id','is_admin','handle_new_user','get_kpi_summary');
-- Returns 4 rows

-- 3. Trigger exists
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
-- Returns 1 row

-- 4. ~18 indexes
SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';
-- Should be >= 18
```

---

## Step 6 — Local quality gate

```bash
cd backend
ruff check .      # should pass — no source files yet
pytest            # should exit 0 — no tests yet
```

No git commits today.

---

## End-of-day checklist

- [ ] Monorepo directory structure created locally
- [ ] `backend/pyproject.toml` with all dependencies, `uv sync` succeeds
- [ ] `frontend/` scaffolded, `pnpm install` succeeds, shadcn/ui initialized
- [ ] `frontend/src/lib/supabase.ts` created
- [ ] `.env` files present locally, NOT committed
- [ ] 7 tables visible in Supabase Table Editor
- [ ] All 7 tables have `rowsecurity = true`
- [ ] `get_my_tenant_id`, `is_admin`, `handle_new_user`, `get_kpi_summary` functions exist
- [ ] `on_auth_user_created` trigger exists
- [ ] `ruff check .` passes, `pytest` exits 0
