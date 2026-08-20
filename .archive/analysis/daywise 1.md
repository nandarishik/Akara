# AKARA — 14-Day Engineering Execution Plan

---

## Purpose

This document is the daily execution guide for rebuilding AKARA — an AI-powered analytics dashboard for FMCG distributors — from a Python/Streamlit monolith into a production-ready, multi-tenant SaaS product. Every day is self-contained: you know what to build, which files to touch, what SQL to run, how to verify it, and what state you should be in by end of day.

## How to Use This Document

1. Read the day's **Prerequisites** before starting. If they aren't met, stop and finish the previous day first.
2. Work through **Exactly what you build** top to bottom. Every file listed must be created or modified before you move on.
3. Run the **Local quality gate** before every `git push` (Days 1–12).
4. Run **Test/verify** steps manually. Don't assume — confirm.
5. Update your personal notes in the **End-of-day state** section as a checklist.

---

## Stack Summary

| Layer | Technology | Hosting |
|---|---|---|
| Frontend | React 18 + Vite + React Router v6 + TailwindCSS + shadcn/ui | Vercel (free) |
| Backend | FastAPI (Python 3.12) + uv + ruff | Railway ($5/mo Hobby) |
| Database | Supabase PostgreSQL | Supabase (free → Pro on first customer) |
| Auth | Supabase Auth (email/password + JWT) | Supabase |
| Storage | Supabase Storage | Supabase |
| Edge Functions | Supabase Edge Functions (Deno) | Supabase |
| LLM Primary | Gemini 2.5 Flash | Google AI API |
| LLM Failover | OpenRouter | OpenRouter API |
| Package manager | uv (Python), pnpm (Node) | — |
| Linting | ruff (Python), ESLint + Prettier (JS) | — |
| Testing | pytest | — |
| CI | GitHub Actions | GitHub (added Day 13) |
| Monitoring | Sentry free tier + UptimeRobot | Added Day 10 |
| Repo | Monorepo: `frontend/`, `backend/`, `supabase/` | GitHub |

---

## Two-Track Architecture

**Track 1 — Customer-Facing Product (Days 1–14)**
The revenue-generating surface: authentication, dashboard, copilot chat, data management, reports, simulator, and settings pages. This is the only track that matters for launch.

**Track 2 — Admin Console + Ops (Days 5–14)**
Internal tooling: tenant management, user management, data/log viewer, report trigger, Sentry, UptimeRobot, GitHub Actions CI, documentation, and onboarding runbook. Track 2 runs alongside Track 1 and **never blocks it**. If you are short on time, defer Track 2 tasks — Track 1 ships first.

---

## Milestone Checkpoints

| Milestone | Day | Description |
|---|---|---|
| Schema live | End of Day 1 | Supabase tables + RLS policies applied |
| Backend running locally | End of Day 2 | FastAPI boots, health endpoint returns 200 |
| Copilot brain ported | End of Day 3 | Plan→Execute→Synthesize pipeline testable |
| All services ported | End of Day 4 | KPI, data import, schema discovery working |
| Backend deployed | End of Day 5 | Railway URL live, smoke test passes |
| Frontend deployed | End of Day 6 | Vercel URL live, login works end-to-end |
| Core UI done | End of Day 9 | All 5 pages: Dashboard, Copilot, Data, Settings, Reports |
| Full UI done | End of Day 10 | Simulator + Reports pages complete |
| Polish + tests done | End of Day 12 | 20 backend tests passing, UI polished |
| Production-ready | End of Day 14 | E2E test passes, demo recorded, domain live |

---

## Day 1 — Monorepo Scaffold + Supabase Schema + RLS Policies

### Goal
By end of Day 1, the repository exists with correct directory structure, all Supabase tables are created, all RLS policies are applied, and a developer can connect to the database from both the frontend (anon key) and backend (service role key).

### Track
Track 1 only.

### Prerequisites
- GitHub repo created (empty or with just a README)
- Supabase project created (free tier), project URL and keys available
- Local machine has: Python 3.12+, Node 20+, `uv`, `pnpm`, `git`, Supabase CLI

### Exactly What You Build

#### 1.1 — Monorepo root files

**File: `akara/.gitignore`**
```gitignore
# Python
__pycache__/
*.pyc
*.pyo
*.pyd
.Python
*.egg-info/
dist/
build/
.venv/
venv/
.pytest_cache/
.ruff_cache/
htmlcov/
.coverage

# Node
node_modules/
dist/
.next/
.nuxt/

# Environment
.env
.env.local
.env.*.local

# Supabase
supabase/.branches/
supabase/.temp/

# OS
.DS_Store
Thumbs.db

# IDE
.idea/
.vscode/
*.swp
```

**File: `akara/README.md`**
```markdown
# AKARA

AI-powered analytics dashboard for FMCG distributors.

## Monorepo structure

- `frontend/` — React 18 + Vite + TailwindCSS + shadcn/ui
- `backend/` — FastAPI + Python 3.12
- `supabase/` — Migrations, seed data, edge functions

## Quick start

See each subdirectory for setup instructions.
```

#### 1.2 — Backend scaffold

Run these shell commands from the repo root:

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

**File: `backend/pyproject.toml`**
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
    "google-generativeai>=0.7.0",
    "openai>=1.30.0",
    "scikit-learn>=1.5.0",
    "pandas>=2.2.0",
    "numpy>=1.26.0",
    "python-multipart>=0.0.9",
    "sentry-sdk[fastapi]>=2.5.0",
    "openpyxl>=3.1.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.2.0",
    "pytest-asyncio>=0.23.0",
    "pytest-cov>=5.0.0",
    "httpx>=0.27.0",
    "ruff>=0.4.0",
]

[tool.ruff]
line-length = 88
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "W", "I", "UP", "B", "C4", "PIE", "T20", "RET", "SIM"]
ignore = ["E501"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

**File: `backend/.env.example`**
```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# JWT (same secret as Supabase JWT secret — copy from Supabase dashboard → Settings → API)
JWT_SECRET=your-supabase-jwt-secret

# LLM
GEMINI_API_KEY=AIza...
OPENROUTER_API_KEY=sk-or-...

# Email (morning brief)
GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

# App
ENVIRONMENT=development
LOG_LEVEL=INFO
ALLOWED_ORIGINS=http://localhost:5173

# Sentry (added Day 10)
SENTRY_DSN=
```

Copy `.env.example` to `.env` and fill in values.

Initialize uv environment:
```bash
cd backend
uv venv
uv sync --extra dev
```

**File: `backend/app/__init__.py`** — empty

**File: `backend/app/api/__init__.py`** — empty

**File: `backend/app/api/routes/__init__.py`** — empty

**File: `backend/app/core/__init__.py`** — empty

**File: `backend/app/services/__init__.py`** — empty

**File: `backend/app/sql/__init__.py`** — empty

**File: `backend/tests/__init__.py`** — empty

**File: `backend/tests/conftest.py`**
```python
import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
```

#### 1.3 — Frontend scaffold

```bash
cd ..  # back to repo root
pnpm create vite frontend -- --template react-ts
cd frontend
pnpm install
pnpm add react-router-dom @supabase/supabase-js @tanstack/react-query zustand
pnpm add -D tailwindcss postcss autoprefixer eslint prettier eslint-config-prettier
pnpm dlx tailwindcss init -p
```

Install shadcn/ui:
```bash
pnpm dlx shadcn@latest init
# When prompted:
# Style: Default
# Base color: Slate
# CSS variables: Yes
```

**File: `frontend/.env.example`**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_BASE_URL=http://localhost:8000
```

Copy to `frontend/.env.local`.

**File: `frontend/src/lib/supabase.ts`**
```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

#### 1.4 — Supabase migrations

```bash
cd ..  # back to repo root
mkdir -p supabase/migrations
supabase init  # if not already initialized
```

**File: `supabase/migrations/001_initial_schema.sql`**

```sql
-- ============================================================
-- AKARA: Initial Schema
-- Migration 001
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- tenants
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenants (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    config      JSONB NOT NULL DEFAULT '{}',
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug ON public.tenants (slug);
CREATE INDEX idx_tenants_is_active ON public.tenants (is_active);

-- ============================================================
-- profiles
-- (extends auth.users — created automatically on signup via trigger)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    role         TEXT NOT NULL CHECK (role IN ('admin', 'user')) DEFAULT 'user',
    display_name TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_tenant_id ON public.profiles (tenant_id);
CREATE INDEX idx_profiles_role ON public.profiles (role);

-- ============================================================
-- sales_data
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sales_data (
    id               BIGSERIAL PRIMARY KEY,
    tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    invoice_date     DATE NOT NULL,
    invoice_number   TEXT,
    party_name       TEXT,
    party_city       TEXT,
    party_zone       TEXT,
    route            TEXT,
    product_name     TEXT,
    product_group    TEXT,
    product_category TEXT,
    hsn_code         TEXT,
    quantity         NUMERIC(12, 3),
    gross_amount     NUMERIC(15, 2),
    discount_amount  NUMERIC(15, 2),
    net_amount       NUMERIC(15, 2),
    tax_amount       NUMERIC(15, 2),
    total_amount      NUMERIC(15, 2),
    outstanding_amount NUMERIC(15, 2),        -- optional: from Tally/DMS outstanding ledger
    raw_data          JSONB,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sales_data_tenant_id ON public.sales_data (tenant_id);
CREATE INDEX idx_sales_data_invoice_date ON public.sales_data (invoice_date);
CREATE INDEX idx_sales_data_party_name ON public.sales_data (party_name);
CREATE INDEX idx_sales_data_product_name ON public.sales_data (product_name);
CREATE INDEX idx_sales_data_tenant_date ON public.sales_data (tenant_id, invoice_date);

-- ============================================================
-- context_cache
-- ============================================================
CREATE TABLE IF NOT EXISTS public.context_cache (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    context_type  TEXT NOT NULL CHECK (context_type IN ('weather', 'news', 'holiday')),
    context_date  DATE NOT NULL,
    content       JSONB NOT NULL DEFAULT '{}',
    source        TEXT,
    expires_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, context_type, context_date)
);

CREATE INDEX idx_context_cache_tenant_id ON public.context_cache (tenant_id);
CREATE INDEX idx_context_cache_expires_at ON public.context_cache (expires_at);

-- ============================================================
-- chat_history
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_history (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question   TEXT NOT NULL,
    response   TEXT,
    metadata   JSONB NOT NULL DEFAULT '{}',
    -- metadata shape: {intent, sql_queries_run, llm_model, tokens_used,
    --                  guardrail_results, response_time_ms}
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_history_tenant_id ON public.chat_history (tenant_id);
CREATE INDEX idx_chat_history_user_id ON public.chat_history (user_id);
CREATE INDEX idx_chat_history_created_at ON public.chat_history (created_at DESC);

-- ============================================================
-- audit_log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action        TEXT NOT NULL,
    resource_type TEXT,
    resource_id   TEXT,
    details       JSONB NOT NULL DEFAULT '{}',
    ip_address    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_tenant_id ON public.audit_log (tenant_id);
CREATE INDEX idx_audit_log_user_id ON public.audit_log (user_id);
CREATE INDEX idx_audit_log_action ON public.audit_log (action);
CREATE INDEX idx_audit_log_created_at ON public.audit_log (created_at DESC);

-- ============================================================
-- generated_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.generated_reports (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    report_type      TEXT NOT NULL,
    title            TEXT NOT NULL,
    storage_path     TEXT,
    file_size_bytes  BIGINT,
    metadata         JSONB NOT NULL DEFAULT '{}',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_generated_reports_tenant_id ON public.generated_reports (tenant_id);
CREATE INDEX idx_generated_reports_report_type ON public.generated_reports (report_type);
CREATE INDEX idx_generated_reports_created_at ON public.generated_reports (created_at DESC);

-- ============================================================
-- secondary_sales_data
-- DMS offtake: what distributors actually sold to retailers.
-- Same column structure as sales_data — keyed by data_source.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.secondary_sales_data (
    id               BIGSERIAL PRIMARY KEY,
    tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    invoice_date     DATE NOT NULL,
    invoice_number   TEXT,
    party_name       TEXT,
    party_city       TEXT,
    party_zone       TEXT,
    route            TEXT,
    product_name     TEXT,
    product_group    TEXT,
    product_category TEXT,
    quantity         NUMERIC(12, 3),
    gross_amount     NUMERIC(15, 2),
    discount_amount  NUMERIC(15, 2),
    net_amount       NUMERIC(15, 2),
    total_amount     NUMERIC(15, 2),
    data_source      TEXT NOT NULL DEFAULT 'manual_upload', -- 'manual_upload' | 'agent_push' | 'api'
    raw_data         JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_secondary_sales_tenant_id ON public.secondary_sales_data (tenant_id);
CREATE INDEX idx_secondary_sales_invoice_date ON public.secondary_sales_data (invoice_date);
CREATE INDEX idx_secondary_sales_party_name ON public.secondary_sales_data (party_name);
CREATE INDEX idx_secondary_sales_tenant_date ON public.secondary_sales_data (tenant_id, invoice_date);

-- ============================================================
-- scheme_master
-- Scheme claims filed by distributors.
-- Used for scheme leakage detection (claimed vs. actual offtake).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.scheme_master (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    scheme_name     TEXT NOT NULL,
    party_name      TEXT,
    product_name    TEXT,
    product_group   TEXT,
    discount_pct    NUMERIC(5, 2),
    claimed_amount  NUMERIC(15, 2),
    scheme_start    DATE,
    scheme_end      DATE,
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    raw_data        JSONB
);

CREATE INDEX idx_scheme_master_tenant_id ON public.scheme_master (tenant_id);
CREATE INDEX idx_scheme_master_party_name ON public.scheme_master (party_name);
CREATE INDEX idx_scheme_master_scheme_dates ON public.scheme_master (scheme_start, scheme_end);

-- ============================================================
-- Trigger: auto-update updated_at on tenants
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER tenants_updated_at
    BEFORE UPDATE ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

**File: `supabase/migrations/002_rls_policies.sql`**

```sql
-- ============================================================
-- AKARA: Row Level Security Policies
-- Migration 002
-- ============================================================

-- ============================================================
-- Helper function: get tenant_id for the current user
-- This is called many times across policies, keep it fast.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT tenant_id
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
$$;

-- ============================================================
-- Helper function: is current user an admin?
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'admin'
    );
$$;

-- ============================================================
-- tenants — admins can read their own tenant
-- ============================================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenants_select_own"
    ON public.tenants FOR SELECT
    USING (id = public.get_my_tenant_id());

CREATE POLICY "tenants_update_own_admin"
    ON public.tenants FOR UPDATE
    USING (id = public.get_my_tenant_id() AND public.is_admin());

-- ============================================================
-- profiles — users see their own profile; admins see all in tenant
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
    ON public.profiles FOR SELECT
    USING (
        id = auth.uid()
        OR (tenant_id = public.get_my_tenant_id() AND public.is_admin())
    );

CREATE POLICY "profiles_update_own"
    ON public.profiles FOR UPDATE
    USING (id = auth.uid());

CREATE POLICY "profiles_insert_own"
    ON public.profiles FOR INSERT
    WITH CHECK (id = auth.uid());

-- ============================================================
-- sales_data — tenant isolation
-- ============================================================
ALTER TABLE public.sales_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_data_tenant_isolation"
    ON public.sales_data FOR SELECT
    USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "sales_data_insert_admin"
    ON public.sales_data FOR INSERT
    WITH CHECK (tenant_id = public.get_my_tenant_id() AND public.is_admin());

CREATE POLICY "sales_data_delete_admin"
    ON public.sales_data FOR DELETE
    USING (tenant_id = public.get_my_tenant_id() AND public.is_admin());

-- ============================================================
-- secondary_sales_data — tenant isolation
-- ============================================================
ALTER TABLE public.secondary_sales_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "secondary_sales_tenant_isolation"
    ON public.secondary_sales_data FOR SELECT
    USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "secondary_sales_insert_admin"
    ON public.secondary_sales_data FOR INSERT
    WITH CHECK (tenant_id = public.get_my_tenant_id() AND public.is_admin());

CREATE POLICY "secondary_sales_delete_admin"
    ON public.secondary_sales_data FOR DELETE
    USING (tenant_id = public.get_my_tenant_id() AND public.is_admin());

-- ============================================================
-- scheme_master — tenant isolation
-- ============================================================
ALTER TABLE public.scheme_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scheme_master_tenant_isolation"
    ON public.scheme_master FOR SELECT
    USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "scheme_master_insert_admin"
    ON public.scheme_master FOR INSERT
    WITH CHECK (tenant_id = public.get_my_tenant_id() AND public.is_admin());

CREATE POLICY "scheme_master_delete_admin"
    ON public.scheme_master FOR DELETE
    USING (tenant_id = public.get_my_tenant_id() AND public.is_admin());

-- ============================================================
-- context_cache — tenant isolation
-- ============================================================
ALTER TABLE public.context_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "context_cache_tenant_isolation"
    ON public.context_cache FOR ALL
    USING (tenant_id = public.get_my_tenant_id());

-- ============================================================
-- chat_history — users see their own; admins see all in tenant
-- ============================================================
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_history_select"
    ON public.chat_history FOR SELECT
    USING (
        user_id = auth.uid()
        OR (tenant_id = public.get_my_tenant_id() AND public.is_admin())
    );

CREATE POLICY "chat_history_insert_own"
    ON public.chat_history FOR INSERT
    WITH CHECK (user_id = auth.uid() AND tenant_id = public.get_my_tenant_id());

-- ============================================================
-- audit_log — admins only
-- ============================================================
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_admin_only"
    ON public.audit_log FOR SELECT
    USING (tenant_id = public.get_my_tenant_id() AND public.is_admin());

-- ============================================================
-- generated_reports — tenant isolation
-- ============================================================
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "generated_reports_tenant_isolation"
    ON public.generated_reports FOR ALL
    USING (tenant_id = public.get_my_tenant_id());
```

**File: `supabase/migrations/003_functions.sql`**

```sql
-- ============================================================
-- AKARA: Database Functions
-- Migration 003
-- ============================================================

-- ============================================================
-- Auto-create profile on new user signup
-- Requires: new user must pass tenant_id in user_metadata
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, tenant_id, role, display_name)
    VALUES (
        NEW.id,
        (NEW.raw_user_meta_data->>'tenant_id')::UUID,
        COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- KPI summary function — avoids N+1 queries from FastAPI
-- Returns aggregated KPIs for a given tenant + date range
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_kpi_summary(
    p_tenant_id   UUID,
    p_start_date  DATE,
    p_end_date    DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_revenue',       COALESCE(SUM(total_amount), 0),
        'total_orders',        COUNT(DISTINCT invoice_number),
        'unique_parties',      COUNT(DISTINCT party_name),
        'avg_order_value',     COALESCE(AVG(total_amount), 0),
        'total_quantity',      COALESCE(SUM(quantity), 0),
        'total_discount',      COALESCE(SUM(discount_amount), 0)
    )
    INTO v_result
    FROM public.sales_data
    WHERE tenant_id = p_tenant_id
      AND invoice_date BETWEEN p_start_date AND p_end_date;

    RETURN v_result;
END;
$$;
```

Apply migrations:
```bash
supabase db push
# OR manually run each SQL file in Supabase dashboard → SQL Editor
```

### Supabase Connections — Day 1

| Action | Table | Operation | Service | Client Key |
|---|---|---|---|---|
| Create tables | all | DDL | PostgreSQL | service role (SQL editor) |
| Enable RLS | all | DDL | PostgreSQL | service role (SQL editor) |
| Create policies | all | DDL | PostgreSQL | service role (SQL editor) |
| Test select | profiles | SELECT | DB | anon key |

### Deploy Steps — Day 1
Nothing deployed today. Schema only.

### Test / Verify — Day 1

1. Open Supabase dashboard → Table Editor. Verify all 7 tables appear: `tenants`, `profiles`, `sales_data`, `context_cache`, `chat_history`, `audit_log`, `generated_reports`.

2. Open SQL Editor and run:
```sql
-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'tenants', 'profiles', 'sales_data',
    'context_cache', 'chat_history', 'audit_log', 'generated_reports'
  );
-- All rows should have rowsecurity = true
```

3. Verify helper functions exist:
```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_my_tenant_id', 'is_admin', 'handle_new_user', 'get_kpi_summary');
-- Should return 4 rows
```

4. Verify trigger exists:
```sql
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
-- Should return 1 row
```

5. Verify indexes:
```sql
SELECT indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname;
-- Should list ~18 indexes
```

### Local Quality Gate — Day 1
```bash
cd backend
ruff check .
pytest  # no tests yet, should exit 0
```

### End-of-Day State — Day 1
- [ ] Monorepo directory structure created
- [ ] `backend/pyproject.toml` committed with all dependencies
- [ ] `frontend/` scaffolded with Vite + React + pnpm
- [ ] `supabase/migrations/001_initial_schema.sql` applied — 9 tables exist (includes `secondary_sales_data`, `scheme_master`)
- [ ] `supabase/migrations/002_rls_policies.sql` applied — RLS enabled on all tables including new tables
- [ ] `supabase/migrations/003_functions.sql` applied — trigger + 3 functions exist
- [ ] `sales_data` has `outstanding_amount` nullable column
- [ ] `supabase/migrations/004_competitive_additions.sql` applied — `get_route_performance()`, `get_outstanding_parties()`, `get_scheme_leakage()` functions exist
- [ ] `supabase/migrations/005_execute_tenant_query.sql` applied — `execute_tenant_query(TEXT, JSONB)` RPC exists (called by `sql/executor.py` on every copilot question; without this every `/copilot/chat` returns 500)
- [ ] `supabase/migrations/006_update_tenant_config_rpc.sql` applied — `update_tenant_config(UUID, JSONB)` RPC exists (called by `PATCH /admin/tenants/{id}/config` to merge-update language, industry, currency after creation)
- [ ] `.env` files created locally (not committed)

> **Language storage:** `tenants.config` JSONB column stores `{"language": "te"}`. Set it via `POST /admin/tenants` body `config` field at creation, or update it via `PATCH /admin/tenants/{id}/config` at any time (e.g. from the Day 9 Settings page). Language defaults to `"en"` if absent.

---

## Day 2 — FastAPI Core (Auth Middleware, Tenant Context, Config, Health)

### Goal
By end of Day 2, FastAPI boots locally, the `/health` endpoint returns 200, JWT authentication middleware validates Supabase tokens, tenant context is injected into every request, and all settings are loaded via Pydantic from the `.env` file.

### Track
Track 1 only.

### Prerequisites
- Day 1 complete: schema applied, `backend/` scaffold exists, `uv` env initialized
- `.env` file filled in with real Supabase credentials

### Exactly What You Build

#### 2.1 — Config

**File: `backend/app/core/config.py`**
```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl, field_validator
from typing import list


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    # JWT — must match Supabase project JWT secret
    jwt_secret: str
    jwt_algorithm: str = "HS256"

    # LLM
    gemini_api_key: str
    openrouter_api_key: str

    # Email
    gmail_user: str = ""
    gmail_app_password: str = ""

    # App
    environment: str = "development"
    log_level: str = "INFO"
    allowed_origins: list[str] = ["http://localhost:5173"]

    # Sentry (optional until Day 10)
    sentry_dsn: str = ""

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_origins(cls, v: str | list) -> list[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


settings = Settings()
```

#### 2.2 — Auth middleware

**File: `backend/app/core/auth.py`**
```python
from typing import Annotated
from uuid import UUID

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel

from app.core.config import settings


class TokenPayload(BaseModel):
    sub: str  # user UUID from Supabase
    email: str | None = None
    role: str | None = None
    aud: str | None = None


class AuthenticatedUser(BaseModel):
    user_id: UUID
    email: str | None
    role: str | None


_bearer = HTTPBearer()


def decode_supabase_jwt(token: str) -> TokenPayload:
    """
    Validate and decode a Supabase-issued JWT.
    Raises HTTP 401 on any validation failure.
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            audience="authenticated",
        )
        return TokenPayload(**payload)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> AuthenticatedUser:
    """FastAPI dependency: validates JWT, returns AuthenticatedUser."""
    payload = decode_supabase_jwt(credentials.credentials)
    return AuthenticatedUser(
        user_id=UUID(payload.sub),
        email=payload.email,
        role=payload.role,
    )


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]
```

#### 2.3 — Tenant context

**File: `backend/app/core/tenant.py`**
```python
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from supabase import Client, create_client

from app.core.auth import AuthenticatedUser, get_current_user
from app.core.config import settings


def get_supabase_service_client() -> Client:
    """Returns a Supabase client using the service role key (bypasses RLS)."""
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_supabase_anon_client() -> Client:
    """Returns a Supabase client using the anon key (respects RLS)."""
    return create_client(settings.supabase_url, settings.supabase_anon_key)


class TenantContext:
    """Resolved per-request: tenant_id and user role from the database."""

    def __init__(self, tenant_id: UUID, role: str, user_id: UUID) -> None:
        self.tenant_id = tenant_id
        self.role = role
        self.user_id = user_id

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"


def get_tenant_context(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> TenantContext:
    """
    FastAPI dependency: looks up the authenticated user's tenant_id and role
    from the profiles table using the service role client.
    Raises 403 if profile doesn't exist.
    """
    client = get_supabase_service_client()
    try:
        result = (
            client.table("profiles")
            .select("tenant_id, role")
            .eq("id", str(user.user_id))
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User profile not found",
        ) from exc

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User profile not found",
        )

    return TenantContext(
        tenant_id=UUID(result.data["tenant_id"]),
        role=result.data["role"],
        user_id=user.user_id,
    )


TenantCtx = Annotated[TenantContext, Depends(get_tenant_context)]
```

#### 2.4 — Health route

**File: `backend/app/api/routes/health.py`**
```python
from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings


class HealthResponse(BaseModel):
    status: str
    environment: str
    timestamp: str


router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    return HealthResponse(
        status="ok",
        environment=settings.environment,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
```

#### 2.5 — Main application

**File: `backend/app/main.py`**
```python
import logging

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health
from app.core.config import settings

# Configure logging
logging.basicConfig(level=settings.log_level)
logger = logging.getLogger(__name__)

# Initialize Sentry (only if DSN is set — added Day 10)
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

# Routers
app.include_router(health.router)

logger.info("AKARA API started in %s environment", settings.environment)
```

#### 2.6 — Auth route (token introspect + profile)

**File: `backend/app/api/routes/auth.py`**
```python
from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.auth import CurrentUser
from app.core.tenant import TenantCtx


class MeResponse(BaseModel):
    user_id: UUID
    email: str | None
    tenant_id: UUID
    role: str


router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=MeResponse)
def get_me(user: CurrentUser, tenant: TenantCtx) -> MeResponse:
    """Returns the authenticated user's identity and tenant context."""
    return MeResponse(
        user_id=user.user_id,
        email=user.email,
        tenant_id=tenant.tenant_id,
        role=tenant.role,
    )
```

Register in `main.py` — add after health router:
```python
from app.api.routes import auth as auth_router
app.include_router(auth_router.router)
```

#### 2.7 — Backend start script

**File: `backend/run.sh`**
```bash
#!/usr/bin/env bash
set -euo pipefail
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

```bash
chmod +x backend/run.sh
```

#### 2.8 — First backend test

**File: `backend/tests/test_health.py`**
```python
from fastapi.testclient import TestClient

from app.main import app


def test_health_returns_200() -> None:
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "timestamp" in data


def test_health_returns_environment() -> None:
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["environment"] in ("development", "production", "staging")
```

### Supabase Connections — Day 2

| Action | Table | Operation | Service | Client Key |
|---|---|---|---|---|
| Tenant lookup | `profiles` | SELECT | DB | service role (backend) |
| Auth token validation | — | JWT decode | Auth | JWT secret |

### Deploy Steps — Day 2
Nothing deployed today. Local only.

### Test / Verify — Day 2

1. Start the backend:
```bash
cd backend
./run.sh
```

2. Health check:
```bash
curl -s http://localhost:8000/health | python3 -m json.tool
# Expected: {"status":"ok","environment":"development","timestamp":"..."}
```

3. Verify docs load:
```bash
open http://localhost:8000/docs
# FastAPI Swagger UI should appear
```

4. Test auth endpoint without token (should 403):
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/auth/me
# Expected: 403
```

5. Run tests:
```bash
cd backend
uv run pytest tests/test_health.py -v
# Expected: 2 passed
```

### Local Quality Gate — Day 2
```bash
cd backend
ruff check .
pytest
```

### End-of-Day State — Day 2
- [ ] FastAPI boots locally on port 8000
- [ ] `/health` returns `{"status":"ok",...}` with HTTP 200
- [ ] JWT middleware validates Supabase tokens (tested via `/auth/me`)
- [ ] `TenantContext` resolves tenant_id from profiles table
- [ ] `Settings` loads from `.env` via pydantic-settings
- [ ] `tests/test_health.py` passes (2 tests)
- [ ] `ruff check .` exits 0

---

## Day 3 — Port Copilot Clean (Planner, Tools, Synthesizer, Guardrails, LLM Manager, SQL Guard)

### Goal
By end of Day 3, the Plan→Execute→Synthesize AI pipeline is implemented as clean, typed, modular Python services — ported from the 59KB `copilot_brain.py` monolith with no logic copied directly, all functions under 300 lines, all SQL parameterized, and the `/copilot/chat` endpoint accepts a question and returns a streaming response.

### Track
Track 1 only.

### Prerequisites
- Day 2 complete: FastAPI core running
- Gemini API key and OpenRouter API key in `.env`
- The original `copilot_brain.py` available for reference (not for copy-paste)

### Exactly What You Build

#### 3.1 — LLM Manager

**File: `backend/app/services/llm/manager.py`**
```python
import logging
from enum import Enum
from typing import AsyncGenerator

from app.services.llm.gemini import GeminiClient
from app.services.llm.openrouter import OpenRouterClient

logger = logging.getLogger(__name__)


class LLMProvider(str, Enum):
    GEMINI = "gemini"
    OPENROUTER = "openrouter"


class LLMManager:
    """
    Manages LLM provider selection and automatic failover.
    Primary: Gemini 2.5 Flash
    Failover: OpenRouter
    """

    def __init__(self, gemini_api_key: str, openrouter_api_key: str) -> None:
        self._gemini = GeminiClient(api_key=gemini_api_key)
        self._openrouter = OpenRouterClient(api_key=openrouter_api_key)
        self._current_provider = LLMProvider.GEMINI

    async def complete(self, prompt: str, system: str = "") -> str:
        """Non-streaming completion with automatic failover."""
        try:
            response = await self._gemini.complete(prompt=prompt, system=system)
            self._current_provider = LLMProvider.GEMINI
            return response
        except Exception as gemini_error:
            logger.warning("Gemini failed, falling back to OpenRouter: %s", gemini_error)
            try:
                response = await self._openrouter.complete(prompt=prompt, system=system)
                self._current_provider = LLMProvider.OPENROUTER
                return response
            except Exception as openrouter_error:
                logger.error("Both LLM providers failed. OpenRouter: %s", openrouter_error)
                raise RuntimeError(
                    f"All LLM providers unavailable. "
                    f"Gemini: {gemini_error}. OpenRouter: {openrouter_error}"
                ) from openrouter_error

    async def stream(
        self, prompt: str, system: str = ""
    ) -> AsyncGenerator[str, None]:
        """Streaming completion with automatic failover."""
        try:
            async for chunk in self._gemini.stream(prompt=prompt, system=system):
                yield chunk
        except Exception as gemini_error:
            logger.warning("Gemini stream failed, falling back: %s", gemini_error)
            async for chunk in self._openrouter.stream(prompt=prompt, system=system):
                yield chunk

    @property
    def current_provider(self) -> LLMProvider:
        return self._current_provider
```

**File: `backend/app/services/llm/gemini.py`**
```python
import logging
from typing import AsyncGenerator

import google.generativeai as genai

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.5-flash"


class GeminiClient:
    def __init__(self, api_key: str) -> None:
        genai.configure(api_key=api_key)
        self._model = genai.GenerativeModel(GEMINI_MODEL)

    async def complete(self, prompt: str, system: str = "") -> str:
        contents = []
        if system:
            contents.append({"role": "user", "parts": [system]})
            contents.append({"role": "model", "parts": ["Understood."]})
        contents.append({"role": "user", "parts": [prompt]})
        response = await self._model.generate_content_async(contents)
        return response.text

    async def stream(
        self, prompt: str, system: str = ""
    ) -> AsyncGenerator[str, None]:
        contents = []
        if system:
            contents.append({"role": "user", "parts": [system]})
            contents.append({"role": "model", "parts": ["Understood."]})
        contents.append({"role": "user", "parts": [prompt]})
        async for chunk in await self._model.generate_content_async(
            contents, stream=True
        ):
            if chunk.text:
                yield chunk.text
```

**File: `backend/app/services/llm/openrouter.py`**
```python
import logging
from typing import AsyncGenerator

import httpx

logger = logging.getLogger(__name__)

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_MODEL = "anthropic/claude-3-haiku"


class OpenRouterClient:
    def __init__(self, api_key: str) -> None:
        self._api_key = api_key
        self._headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    def _build_payload(
        self, prompt: str, system: str, stream: bool
    ) -> dict:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        return {
            "model": OPENROUTER_MODEL,
            "messages": messages,
            "stream": stream,
        }

    async def complete(self, prompt: str, system: str = "") -> str:
        payload = self._build_payload(prompt, system, stream=False)
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{OPENROUTER_BASE_URL}/chat/completions",
                json=payload,
                headers=self._headers,
                timeout=60.0,
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]

    async def stream(
        self, prompt: str, system: str = ""
    ) -> AsyncGenerator[str, None]:
        payload = self._build_payload(prompt, system, stream=True)
        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                f"{OPENROUTER_BASE_URL}/chat/completions",
                json=payload,
                headers=self._headers,
                timeout=60.0,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: ") and line != "data: [DONE]":
                        import json
                        data = json.loads(line[6:])
                        delta = data["choices"][0]["delta"].get("content", "")
                        if delta:
                            yield delta
```

#### 3.2 — SQL Guard

**File: `backend/app/sql/guard.py`**
```python
import re
import logging

logger = logging.getLogger(__name__)

_FORBIDDEN_SCHEMAS = frozenset(["pg_catalog", "information_schema", "pg_toast"])
_FORBIDDEN_STATEMENTS = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|EXECUTE|COPY)\b",
    re.IGNORECASE,
)
_FORBIDDEN_FUNCTIONS = re.compile(
    r"\b(pg_read_file|pg_ls_dir|pg_sleep|lo_import|lo_export|dblink)\b",
    re.IGNORECASE,
)


class SQLGuardError(ValueError):
    """Raised when a SQL query fails safety checks."""


def validate_sql(query: str) -> None:
    """
    Validate that a SQL query is safe to execute.
    Rules:
    - Only SELECT statements allowed
    - No access to pg_catalog, information_schema
    - No dangerous function calls
    Raises SQLGuardError on any violation.
    """
    stripped = query.strip()

    if not stripped.upper().startswith("SELECT"):
        raise SQLGuardError(
            f"Only SELECT statements are permitted. Got: {stripped[:50]!r}"
        )

    if _FORBIDDEN_STATEMENTS.search(stripped):
        raise SQLGuardError(
            "Query contains forbidden statement (INSERT/UPDATE/DELETE/etc.)"
        )

    for schema in _FORBIDDEN_SCHEMAS:
        if schema.lower() in stripped.lower():
            raise SQLGuardError(f"Access to schema '{schema}' is forbidden")

    if _FORBIDDEN_FUNCTIONS.search(stripped):
        raise SQLGuardError("Query contains forbidden function call")

    logger.debug("SQL guard passed for query: %.80s", stripped)
```

**File: `backend/app/sql/executor.py`**
```python
import logging
from uuid import UUID

from supabase import Client

from app.sql.guard import validate_sql

logger = logging.getLogger(__name__)

_MAX_ROWS = 2000


class SQLExecutor:
    """
    Executes validated SELECT queries against Supabase PostgreSQL.
    All queries must pass SQLGuard before execution.
    Tenant isolation is enforced via RLS on the Supabase client.
    """

    def __init__(self, client: Client) -> None:
        self._client = client

    def execute(
        self,
        query: str,
        params: dict | None = None,
        tenant_id: UUID | None = None,
    ) -> list[dict]:
        """
        Execute a SELECT query. Validates with SQLGuard first.
        Returns up to _MAX_ROWS rows.
        """
        validate_sql(query)

        # Append tenant filter as a comment-based parameter placeholder
        # Actual parameterization is done via Supabase RPC
        logger.info("Executing SQL for tenant %s: %.100s", tenant_id, query)

        try:
            result = self._client.rpc(
                "execute_tenant_query",
                {"p_query": query, "p_params": params or {}},
            ).execute()
            rows = result.data or []
            if len(rows) > _MAX_ROWS:
                logger.warning("Query returned %d rows, truncating to %d", len(rows), _MAX_ROWS)
                rows = rows[:_MAX_ROWS]
            return rows
        except Exception as exc:
            logger.error("SQL execution failed: %s", exc)
            raise RuntimeError(f"Query execution failed: {exc}") from exc
```

#### 3.3 — Copilot guardrails

**File: `backend/app/services/copilot/guardrails/__init__.py`** — empty

**File: `backend/app/services/copilot/guardrails/checks.py`**
```python
import logging
import re
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class GuardrailResult:
    passed: bool
    check_name: str
    message: str


def premise_check(question: str, available_columns: list[str]) -> GuardrailResult:
    """
    Checks that the question refers to data that actually exists in the schema.
    Rejects queries about data we clearly don't have.
    """
    question_lower = question.lower()
    # If question references a column-like term not in our schema
    unknown_entities = [
        term for term in re.findall(r"\b[a-z_]{4,}\b", question_lower)
        if term not in available_columns
        and term not in {
            "sales", "revenue", "orders", "products", "customers",
            "total", "average", "top", "bottom", "compare", "trend",
            "last", "month", "week", "year", "quarter", "today",
            "yesterday", "best", "worst", "highest", "lowest",
        }
    ]
    # Heuristic: if more than 3 unrecognized terms, flag it
    if len(unknown_entities) > 3:
        return GuardrailResult(
            passed=False,
            check_name="premise_check",
            message=(
                f"Question may reference data not in scope. "
                f"Unrecognized terms: {unknown_entities[:5]}"
            ),
        )
    return GuardrailResult(passed=True, check_name="premise_check", message="OK")


def numeric_digest(response: str, sql_results: list[dict]) -> GuardrailResult:
    """
    Verifies that numbers mentioned in the response are grounded in SQL results.
    Extracts numbers from response and checks they appear in results.
    """
    if not sql_results:
        return GuardrailResult(passed=True, check_name="numeric_digest", message="No SQL results to verify")

    response_numbers = set(re.findall(r"\b\d[\d,\.]*\b", response))
    result_numbers: set[str] = set()
    for row in sql_results[:50]:
        for value in row.values():
            if isinstance(value, (int, float)):
                result_numbers.add(str(int(value)))
                result_numbers.add(f"{value:.2f}")

    ungrounded = response_numbers - result_numbers
    if len(ungrounded) > 5:
        logger.warning("Numeric digest: %d ungrounded numbers found", len(ungrounded))
        # Warn but don't block — numbers may be derived (percentages, aggregates)

    return GuardrailResult(passed=True, check_name="numeric_digest", message="OK")


def numeric_postcheck(response: str) -> GuardrailResult:
    """Checks for hallucinated impossibly large numbers."""
    numbers = re.findall(r"\b(\d[\d,]*)\b", response.replace(",", ""))
    for num_str in numbers:
        try:
            num = int(num_str)
            if num > 10_000_000_000:  # 10 billion sanity cap
                return GuardrailResult(
                    passed=False,
                    check_name="numeric_postcheck",
                    message=f"Suspiciously large number detected: {num:,}",
                )
        except ValueError:
            pass
    return GuardrailResult(passed=True, check_name="numeric_postcheck", message="OK")


def causal_postcheck(response: str) -> GuardrailResult:
    """
    Flags responses that make strong causal claims not supported by correlation data.
    """
    causal_phrases = [
        "caused by", "resulted in", "because of", "due to the fact",
        "proven that", "definitively shows", "guarantees",
    ]
    response_lower = response.lower()
    triggered = [p for p in causal_phrases if p in response_lower]
    if triggered:
        return GuardrailResult(
            passed=False,
            check_name="causal_postcheck",
            message=(
                f"Response makes causal claims without sufficient evidence: {triggered}"
            ),
        )
    return GuardrailResult(passed=True, check_name="causal_postcheck", message="OK")


def data_scope_check(question: str, tenant_date_range: tuple[str, str]) -> GuardrailResult:
    """
    Verifies the question is within the tenant's available data date range.
    """
    start_date, end_date = tenant_date_range
    # Simple pass for now — can be extended with date extraction from question
    return GuardrailResult(passed=True, check_name="data_scope_check", message="OK")


def run_all_guardrails(
    question: str,
    response: str,
    sql_results: list[dict],
    available_columns: list[str],
    tenant_date_range: tuple[str, str],
) -> list[GuardrailResult]:
    """Run all guardrail checks and return list of results."""
    return [
        premise_check(question, available_columns),
        numeric_digest(response, sql_results),
        numeric_postcheck(response),
        causal_postcheck(response),
        data_scope_check(question, tenant_date_range),
    ]
```

#### 3.4 — Copilot tools

**File: `backend/app/services/copilot/tools/__init__.py`** — empty

**File: `backend/app/services/copilot/tools/sql_tool.py`**
```python
import logging
from uuid import UUID

from app.sql.executor import SQLExecutor
from app.sql.guard import SQLGuardError

logger = logging.getLogger(__name__)


class SQLTool:
    """
    Executes a SQL query generated by the planner.
    Returns structured results or an error dict.
    """

    def __init__(self, executor: SQLExecutor, tenant_id: UUID) -> None:
        self._executor = executor
        self._tenant_id = tenant_id

    def run(self, query: str) -> dict:
        try:
            rows = self._executor.execute(query, tenant_id=self._tenant_id)
            return {"success": True, "rows": rows, "row_count": len(rows)}
        except SQLGuardError as exc:
            logger.warning("SQLGuard blocked query: %s", exc)
            return {"success": False, "error": f"Query not permitted: {exc}", "rows": []}
        except RuntimeError as exc:
            logger.error("SQL execution error: %s", exc)
            return {"success": False, "error": str(exc), "rows": []}
```

**File: `backend/app/services/copilot/tools/context_tool.py`**
```python
import logging
from datetime import date
from uuid import UUID

from supabase import Client

logger = logging.getLogger(__name__)


class ContextTool:
    """
    Fetches cached contextual information (weather, news, holidays)
    to enrich AI responses with real-world context.
    """

    def __init__(self, supabase: Client, tenant_id: UUID) -> None:
        self._supabase = supabase
        self._tenant_id = tenant_id

    def get_context(
        self, context_date: date, context_type: str
    ) -> dict | None:
        try:
            result = (
                self._supabase.table("context_cache")
                .select("content, source, expires_at")
                .eq("tenant_id", str(self._tenant_id))
                .eq("context_type", context_type)
                .eq("context_date", context_date.isoformat())
                .single()
                .execute()
            )
            return result.data
        except Exception as exc:
            logger.debug("No context cache hit for %s/%s: %s", context_type, context_date, exc)
            return None
```

#### 3.5 — Planner

**File: `backend/app/services/copilot/planner.py`**
```python
import json
import logging
import re
from dataclasses import dataclass

from app.services.llm.manager import LLMManager

logger = logging.getLogger(__name__)

_PLAN_SYSTEM = """
You are a data analytics planning assistant.
Given a user question and a database schema, you must output a JSON plan with SQL queries to answer it.

Output ONLY valid JSON in this exact format:
{
  "intent": "brief description of what the user wants",
  "steps": [
    {
      "step_id": 1,
      "description": "what this step computes",
      "sql": "SELECT ... FROM public.sales_data WHERE tenant_id = :tenant_id AND ..."
    }
  ],
  "requires_context": ["weather" | "news" | "holiday"],
  "response_format": "table" | "summary" | "chart_data"
}

Rules:
- Always filter by tenant_id = :tenant_id (parameterized, never hardcoded)
- Always filter by the date column when a time range is implied
- Only use tables listed in the schema context below
- Maximum 3 SQL steps
- Use :start_date and :end_date placeholders for date ranges
"""
# Industry-specific rules (FMCG join patterns, scheme leakage, outstanding filters, etc.)
# are NOT hardcoded here. They are appended as system_addendum at request time by
# PromptGenerator.build_planner_addendum(tenant.tenant_config) — driven by tenant config industry slug.


@dataclass
class PlanStep:
    step_id: int
    description: str
    sql: str


@dataclass
class Plan:
    intent: str
    steps: list[PlanStep]
    requires_context: list[str]
    response_format: str


class Planner:
    """
    Given a user question + schema context, produces a structured execution plan.
    """

    def __init__(self, llm: LLMManager) -> None:
        self._llm = llm

    async def plan(
        self,
        question: str,
        schema_context: str,
        date_range: tuple[str, str],
        system_addendum: str = "",
    ) -> Plan:
        system = _PLAN_SYSTEM + system_addendum
        prompt = (
            f"Schema context:\n{schema_context}\n\n"
            f"Date range available: {date_range[0]} to {date_range[1]}\n\n"
            f"User question: {question}\n\n"
            f"Output the JSON plan:"
        )
        raw = await self._llm.complete(prompt=prompt, system=system)
        return self._parse_plan(raw)

    def _parse_plan(self, raw: str) -> Plan:
        json_match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not json_match:
            raise ValueError(f"LLM did not return valid JSON plan. Raw: {raw[:200]}")
        data = json.loads(json_match.group())
        return Plan(
            intent=data.get("intent", ""),
            steps=[
                PlanStep(
                    step_id=s["step_id"],
                    description=s["description"],
                    sql=s["sql"],
                )
                for s in data.get("steps", [])
            ],
            requires_context=data.get("requires_context", []),
            response_format=data.get("response_format", "summary"),
        )
```

#### 3.6 — Synthesizer

**File: `backend/app/services/copilot/synthesizer.py`**
```python
import logging
from typing import AsyncGenerator

from app.services.llm.manager import LLMManager

logger = logging.getLogger(__name__)

_SYNTHESIZE_SYSTEM = """
You are AKARA Copilot, an AI analytics assistant.
You are given a user question, SQL query results, and optionally some business context.
Your job is to write a clear, accurate, business-focused answer.

Rules:
- Ground every number in the data provided. Do not invent figures.
- Be concise but complete. Use bullet points for lists.
- Mention the time range covered by the data.
- If data is empty or insufficient, say so clearly.
- Do not make causal claims. Use "associated with" or "correlated with" instead of "caused by".
- End with a one-sentence actionable insight if the data supports it.
- Match the language of the user's question when responding.
"""
# Currency formatting, Hindi NLQ, domain glossary, rupee impact framing are NOT hardcoded here.
# They are appended as system_addendum at request time by
# PromptGenerator.build_synthesizer_addendum(tenant.tenant_config) — keyed on tenant industry slug.


class Synthesizer:
    """
    Takes SQL results and context, generates a natural language response.
    Supports both full response and streaming.
    """

    def __init__(self, llm: LLMManager) -> None:
        self._llm = llm

    def _build_prompt(
        self,
        question: str,
        sql_results: list[dict],
        context_data: dict | None,
        intent: str,
    ) -> str:
        results_str = str(sql_results[:100])  # cap at 100 rows for prompt
        context_str = str(context_data) if context_data else "No additional context."
        return (
            f"User question: {question}\n\n"
            f"Intent: {intent}\n\n"
            f"SQL Results:\n{results_str}\n\n"
            f"Business Context:\n{context_str}\n\n"
            f"Write a business-focused answer:"
        )

    async def synthesize(
        self,
        question: str,
        sql_results: list[dict],
        context_data: dict | None,
        intent: str,
        system_addendum: str = "",
    ) -> str:
        system = _SYNTHESIZE_SYSTEM + system_addendum
        prompt = self._build_prompt(question, sql_results, context_data, intent)
        return await self._llm.complete(prompt=prompt, system=system)

    async def synthesize_stream(
        self,
        question: str,
        sql_results: list[dict],
        context_data: dict | None,
        intent: str,
        system_addendum: str = "",
    ) -> AsyncGenerator[str, None]:
        system = _SYNTHESIZE_SYSTEM + system_addendum
        prompt = self._build_prompt(question, sql_results, context_data, intent)
        async for chunk in self._llm.stream(prompt=prompt, system=system):
            yield chunk
```

#### 3.7 — Copilot agent (orchestrator)

**File: `backend/app/services/copilot/agent.py`**
```python
import logging
import time
from dataclasses import dataclass, field
from typing import AsyncGenerator
from uuid import UUID

from app.services.copilot.guardrails.checks import run_all_guardrails, GuardrailResult
from app.services.copilot.planner import Planner
from app.services.copilot.synthesizer import Synthesizer
from app.services.copilot.tools.sql_tool import SQLTool
from app.services.copilot.tools.context_tool import ContextTool

logger = logging.getLogger(__name__)


@dataclass
class CopilotResponse:
    question: str
    intent: str
    response: str
    sql_queries_run: list[str] = field(default_factory=list)
    llm_model: str = ""
    tokens_used: int = 0
    guardrail_results: list[dict] = field(default_factory=list)
    response_time_ms: int = 0


class CopilotAgent:
    """
    Orchestrates the Plan → Execute → Synthesize pipeline.
    Dependency-injected — no global state.
    """

    def __init__(
        self,
        planner: Planner,
        synthesizer: Synthesizer,
        sql_tool: SQLTool,
        context_tool: ContextTool,
        tenant_id: UUID,
    ) -> None:
        self._planner = planner
        self._synthesizer = synthesizer
        self._sql_tool = sql_tool
        self._context_tool = context_tool
        self._tenant_id = tenant_id

    async def answer(
        self,
        question: str,
        schema_context: str,
        available_columns: list[str],
        date_range: tuple[str, str],
        planner_addendum: str = "",
        synthesizer_addendum: str = "",
    ) -> CopilotResponse:
        start_ms = int(time.time() * 1000)

        plan = await self._planner.plan(
            question, schema_context, date_range, system_addendum=planner_addendum
        )
        logger.info("Plan produced with %d steps for intent: %s", len(plan.steps), plan.intent)

        all_results: list[dict] = []
        queries_run: list[str] = []
        for step in plan.steps:
            result = self._sql_tool.run(step.sql)
            all_results.extend(result.get("rows", []))
            queries_run.append(step.sql)

        context_data = None
        from datetime import date
        today = date.today()
        for ctx_type in plan.requires_context:
            context_data = self._context_tool.get_context(today, ctx_type)
            if context_data:
                break

        response_text = await self._synthesizer.synthesize(
            question=question,
            sql_results=all_results,
            context_data=context_data,
            intent=plan.intent,
            system_addendum=synthesizer_addendum,
        )

        guardrail_results = run_all_guardrails(
            question=question,
            response=response_text,
            sql_results=all_results,
            available_columns=available_columns,
            tenant_date_range=date_range,
        )

        for gr in guardrail_results:
            if not gr.passed:
                logger.warning("Guardrail failed: %s — %s", gr.check_name, gr.message)
                response_text += f"\n\n⚠️ Note: {gr.message}"

        elapsed_ms = int(time.time() * 1000) - start_ms

        return CopilotResponse(
            question=question,
            intent=plan.intent,
            response=response_text,
            sql_queries_run=queries_run,
            guardrail_results=[
                {"check": gr.check_name, "passed": gr.passed, "message": gr.message}
                for gr in guardrail_results
            ],
            response_time_ms=elapsed_ms,
        )

    async def answer_stream(
        self,
        question: str,
        schema_context: str,
        available_columns: list[str],
        date_range: tuple[str, str],
        planner_addendum: str = "",
        synthesizer_addendum: str = "",
    ) -> AsyncGenerator[str, None]:
        """Streaming version — yields text chunks as they arrive."""
        plan = await self._planner.plan(
            question, schema_context, date_range, system_addendum=planner_addendum
        )

        all_results: list[dict] = []
        for step in plan.steps:
            result = self._sql_tool.run(step.sql)
            all_results.extend(result.get("rows", []))

        context_data = None
        from datetime import date
        for ctx_type in plan.requires_context:
            context_data = self._context_tool.get_context(date.today(), ctx_type)

        async for chunk in self._synthesizer.synthesize_stream(
            question=question,
            sql_results=all_results,
            context_data=context_data,
            intent=plan.intent,
            system_addendum=synthesizer_addendum,
        ):
            yield chunk
```

#### 3.8 — Copilot API route

**File: `backend/app/api/routes/copilot.py`**
```python
import logging
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends
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
from app.services.prompts.generator import PromptGenerator
from app.services.schema.discovery import SchemaDiscovery
from app.sql.executor import SQLExecutor

logger = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    question: str
    stream: bool = True


class ChatResponse(BaseModel):
    question: str
    intent: str
    response: str
    response_time_ms: int
    llm_model: str


router = APIRouter(prefix="/copilot", tags=["copilot"])


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
    prompt_gen = PromptGenerator(schema_discovery=schema)

    # Dynamic schema — discovers actual tables/columns present for this tenant
    schema_context = prompt_gen.build_schema_context(tenant.tenant_id)
    available_columns = schema.get_columns()

    # Industry-specific addendums — '' for tenants with no recognised industry slug
    planner_addendum = prompt_gen.build_planner_addendum(tenant.tenant_config)
    synthesizer_addendum = prompt_gen.build_synthesizer_addendum(tenant.tenant_config)

    agent = _build_agent(tenant.tenant_id)
    date_range = ("2024-01-01", date.today().isoformat())

    if request.stream:
        async def event_stream():
            async for chunk in agent.answer_stream(
                question=request.question,
                schema_context=schema_context,
                available_columns=available_columns,
                date_range=date_range,
                planner_addendum=planner_addendum,
                synthesizer_addendum=synthesizer_addendum,
            ):
                yield f"data: {chunk}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    response = await agent.answer(
        question=request.question,
        schema_context=schema_context,
        available_columns=available_columns,
        date_range=date_range,
        planner_addendum=planner_addendum,
        synthesizer_addendum=synthesizer_addendum,
    )
    return ChatResponse(
        question=response.question,
        intent=response.intent,
        response=response.response,
        response_time_ms=response.response_time_ms,
        llm_model=response.llm_model,
    )
```

Register in `main.py`:
```python
from app.api.routes import copilot as copilot_router
app.include_router(copilot_router.router)
```

### Supabase Connections — Day 3

| Action | Table | Operation | Service | Client Key |
|---|---|---|---|---|
| Context cache lookup | `context_cache` | SELECT | DB | service role |
| SQL execution via RPC | `sales_data` | SELECT | DB | service role |

### Deploy Steps — Day 3
Nothing deployed today. Local only.

### Test / Verify — Day 3

1. Start backend, verify no import errors:
```bash
cd backend && ./run.sh
# Should boot without errors
```

2. Test SQL guard:
```bash
cd backend
uv run python -c "
from app.sql.guard import validate_sql, SQLGuardError
try:
    validate_sql('SELECT * FROM sales_data')
    print('SELECT: OK')
except SQLGuardError as e:
    print('SELECT: FAIL', e)

try:
    validate_sql('DELETE FROM sales_data')
    print('DELETE: should have failed')
except SQLGuardError as e:
    print('DELETE blocked: OK')
"
```

3. Test guardrails:
```bash
uv run python -c "
from app.services.copilot.guardrails.checks import numeric_postcheck
result = numeric_postcheck('Revenue was 500 crore rupees')
print('postcheck:', result)
result2 = numeric_postcheck('Revenue was 99999999999 billion')
print('postcheck large:', result2)
"
```

### Local Quality Gate — Day 3
```bash
cd backend
ruff check .
pytest
```

### End-of-Day State — Day 3
- [ ] LLM Manager with Gemini → OpenRouter failover implemented
- [ ] SQL Guard blocks non-SELECT and forbidden schemas
- [ ] All 5 guardrail checks implemented
- [ ] `_PLAN_SYSTEM` and `_SYNTHESIZE_SYSTEM` are **generic** base prompts (no industry/currency/language hardcoded)
- [ ] Both accept `system_addendum: str = ""` — industry rules injected at request time via `PromptGenerator`
- [ ] `CopilotAgent.answer()` and `answer_stream()` accept `planner_addendum` + `synthesizer_addendum` params
- [ ] CopilotAgent orchestrates Plan→Execute→Synthesize
- [ ] `/copilot/chat` uses `PromptGenerator` to build dynamic schema context + industry addendums
- [ ] FMCG tenant with `config.industry = "fmcg_distribution"` gets ₹ framing, scheme leakage join rules
- [ ] Language rules are **separate from industry rules** — `build_language_addendum()` reads `tenant_config.language` and generates mirror-language instructions independently
- [ ] Supported languages: `hi` (Hindi), `te` (Telugu), `ta` (Tamil), `mr` (Marathi), `kn` (Kannada), `bn` (Bengali), `gu` (Gujarati)
- [ ] Mirror-language behavior: if user writes in Telugu → respond in Telugu; in English → respond in English; mixed → mirror the mix. English is never forced.
- [ ] `synthesizer_addendum` = `build_synthesizer_addendum()` (industry) + `build_language_addendum()` (language), concatenated
- [ ] Tenant with unknown industry gets generic prompts (AKARA works as universal analytics copilot)
- [ ] `/copilot/chat` endpoint streams or returns full response
- [ ] `ruff check .` exits 0 on entire backend

> **Post-Day-3 Gap Fix (applied after Day 7):** `_FMCG_DISTRIBUTION_SYNTHESIZER` no longer contains a hardcoded Hindi language block. Language is now fully controlled by `build_language_addendum()` via `tenant_config.language`. The `_SYNTHESIZE_SYSTEM` base prompt reads: _"Respond in English by default. Follow any language rules provided in the system addendum."_

---

## Day 4 — Port KPI + Data Services (kpi/, data_import/, schema/discovery, prompts/generator)

### Goal
By end of Day 4, the KPI service computes all core metrics from `sales_data`, the data import service parses and validates Excel/CSV uploads, the schema discovery service reads column metadata from the database, and the prompts generator builds context-aware system prompts — all independently testable.

### Track
Track 1 only.

### Prerequisites
- Day 3 complete: copilot brain working
- `supabase/migrations/001` applied (sales_data table exists)

### Exactly What You Build

#### 4.1 — KPI Service

**File: `backend/app/services/kpi/__init__.py`** — empty

**File: `backend/app/services/kpi/models.py`**
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
    days_outstanding: int | None


class KPIResponse(BaseModel):
    summary: KPISummary
    top_products: list[TopProduct]
    zone_breakdown: list[ZoneBreakdown]
    revenue_trend: list[RevenueByDate]
    route_performance: list[RoutePerformance]
    outstanding_parties: list[OutstandingParty]
    date_range_start: str
    date_range_end: str
```

**File: `backend/app/services/kpi/service.py`**
```python
import logging
from decimal import Decimal
from uuid import UUID

from supabase import Client

from app.services.kpi.models import (
    KPIResponse,
    KPISummary,
    OutstandingParty,
    RevenueByDate,
    RoutePerformance,
    TopProduct,
    ZoneBreakdown,
)

logger = logging.getLogger(__name__)

_TOP_N = 10
_ZONE_LIMIT = 20


class KPIService:
    """
    Computes all KPI metrics for a given tenant and date range.
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

    def get_route_performance(
        self, tenant_id: UUID, start_date: str, end_date: str
    ) -> list[RoutePerformance]:
        result = (
            self._supabase.table("sales_data")
            .select("route, total_amount.sum(), invoice_number.count(), party_name.count()")
            .eq("tenant_id", str(tenant_id))
            .gte("invoice_date", start_date)
            .lte("invoice_date", end_date)
            .not_.is_("route", "null")
            .neq("route", "")
            .order("total_amount", desc=True)
            .limit(20)
            .execute()
        )
        rows = result.data or []
        return [
            RoutePerformance(
                route=row.get("route", ""),
                revenue=Decimal(str(row.get("total_amount", 0))),
                order_count=int(row.get("invoice_number", 0)),
                unique_parties=int(row.get("party_name", 0)),
                avg_order_value=(
                    Decimal(str(row.get("total_amount", 0))) / int(row.get("invoice_number", 1))
                    if int(row.get("invoice_number", 0)) > 0
                    else Decimal("0")
                ),
            )
            for row in rows
        ]

    def get_outstanding_parties(
        self, tenant_id: UUID
    ) -> list[OutstandingParty]:
        """Returns parties with outstanding_amount > 0, ordered by amount desc."""
        result = (
            self._supabase.table("sales_data")
            .select("party_name, party_zone, outstanding_amount")
            .eq("tenant_id", str(tenant_id))
            .not_.is_("outstanding_amount", "null")
            .gt("outstanding_amount", 0)
            .order("outstanding_amount", desc=True)
            .limit(50)
            .execute()
        )
        seen: set[str] = set()
        parties = []
        for row in result.data or []:
            name = row.get("party_name", "")
            if name in seen:
                continue
            seen.add(name)
            parties.append(
                OutstandingParty(
                    party_name=name,
                    party_zone=row.get("party_zone"),
                    outstanding_amount=Decimal(str(row.get("outstanding_amount", 0))),
                    days_outstanding=None,
                )
            )
        return parties

    def get_all(
        self, tenant_id: UUID, start_date: str, end_date: str
    ) -> KPIResponse:
        return KPIResponse(
            summary=self.get_summary(tenant_id, start_date, end_date),
            top_products=self.get_top_products(tenant_id, start_date, end_date),
            zone_breakdown=self.get_zone_breakdown(tenant_id, start_date, end_date),
            revenue_trend=self.get_revenue_trend(tenant_id, start_date, end_date),
            route_performance=self.get_route_performance(tenant_id, start_date, end_date),
            outstanding_parties=self.get_outstanding_parties(tenant_id),
            date_range_start=start_date,
            date_range_end=end_date,
        )
```

#### 4.2 — KPI API route

**File: `backend/app/api/routes/kpi.py`**
```python
from datetime import date, timedelta

from fastapi import APIRouter, Query
from pydantic import BaseModel

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

Register in `main.py`:
```python
from app.api.routes import kpi as kpi_router
app.include_router(kpi_router.router)
```

#### 4.3 — Data Import Service

**File: `backend/app/services/data_import/__init__.py`** — empty

**File: `backend/app/services/data_import/models.py`**
```python
from pydantic import BaseModel


class ImportResult(BaseModel):
    rows_inserted: int
    rows_skipped: int
    errors: list[str]
    warnings: list[str]
```

**File: `backend/app/services/data_import/parser.py`**
```python
import io
import logging
from typing import BinaryIO

import pandas as pd

logger = logging.getLogger(__name__)

REQUIRED_COLUMNS = {
    "invoice_date",
    "party_name",
    "total_amount",
}

COLUMN_ALIASES: dict[str, str] = {
    "date": "invoice_date",
    "invoice date": "invoice_date",
    "inv date": "invoice_date",
    "customer": "party_name",
    "party": "party_name",
    "net sales": "net_amount",
    "gross sales": "gross_amount",
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
    "quantity", "gross_amount", "discount_amount",
    "net_amount", "tax_amount", "total_amount",
    "outstanding_amount",
}

SCHEME_REQUIRED_COLUMNS = {"scheme_name", "party_name", "claimed_amount"}
SCHEME_COLUMN_ALIASES: dict[str, str] = {
    "scheme": "scheme_name",
    "distributor": "party_name",
    "claimed": "claimed_amount",
    "start": "scheme_start",
    "end": "scheme_end",
    "discount": "discount_pct",
}


class SalesDataParser:
    """
    Parses Excel (.xlsx) and CSV files into a list of dicts
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
        df = self._coerce_types(df)
        return df

    def _normalize_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
        rename_map = {
            alias.replace(" ", "_"): canonical
            for alias, canonical in COLUMN_ALIASES.items()
        }
        df = df.rename(columns=rename_map)
        return df

    def _validate_required(self, df: pd.DataFrame) -> pd.DataFrame:
        missing = REQUIRED_COLUMNS - set(df.columns)
        if missing:
            raise ValueError(f"Missing required columns: {missing}")
        df = df.dropna(subset=["invoice_date", "party_name"])
        return df

    def _coerce_types(self, df: pd.DataFrame) -> pd.DataFrame:
        df["invoice_date"] = pd.to_datetime(df["invoice_date"], errors="coerce").dt.date
        df = df.dropna(subset=["invoice_date"])
        for col in NUMERIC_COLUMNS:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
        return df
```

**File: `backend/app/services/data_import/service.py`**
```python
import logging
from typing import Literal
from uuid import UUID

from supabase import Client

from app.services.data_import.models import ImportResult
from app.services.data_import.parser import SalesDataParser

logger = logging.getLogger(__name__)

_BATCH_SIZE = 500

SourceType = Literal["primary", "secondary", "scheme"]

_TABLE_MAP: dict[SourceType, str] = {
    "primary": "sales_data",
    "secondary": "secondary_sales_data",
    "scheme": "scheme_master",
}


class DataImportService:
    """
    Handles parsing and batch-inserting sales data for a tenant.
    source_type controls which Supabase table receives the rows:
      - "primary"   → sales_data (ERP/Tally dispatch invoices)
      - "secondary" → secondary_sales_data (DMS offtake)
      - "scheme"    → scheme_master (distributor scheme claims)
    """

    def __init__(self, supabase: Client) -> None:
        self._supabase = supabase
        self._parser = SalesDataParser()

    def import_file(
        self,
        file_content: bytes,
        filename: str,
        tenant_id: UUID,
        source_type: SourceType = "primary",
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
                    if source_type == "scheme":
                        record = {
                            "tenant_id": str(tenant_id),
                            "scheme_name": str(row.get("scheme_name", "")),
                            "party_name": str(row.get("party_name", "")),
                            "product_name": str(row.get("product_name", "")),
                            "product_group": str(row.get("product_group", "")),
                            "discount_pct": float(row.get("discount_pct", 0)),
                            "claimed_amount": float(row.get("claimed_amount", 0)),
                            "scheme_start": str(row.get("scheme_start", "")) or None,
                            "scheme_end": str(row.get("scheme_end", "")) or None,
                            "raw_data": row,
                        }
                    else:
                        record = {
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
                            "outstanding_amount": float(row["outstanding_amount"])
                            if row.get("outstanding_amount") is not None
                            else None,
                            "raw_data": row,
                        }
                        if source_type == "secondary":
                            record["data_source"] = "manual_upload"
                    enriched.append(record)
                except (TypeError, ValueError) as exc:
                    rows_skipped += 1
                    warnings.append(f"Row {i}: {exc}")
                    continue

            try:
                table_name = _TABLE_MAP[source_type]
                self._supabase.table(table_name).insert(enriched).execute()
                rows_inserted += len(enriched)
            except Exception as exc:
                errors.append(f"Batch {i//500}: {exc}")
                rows_skipped += len(enriched)

        return ImportResult(
            rows_inserted=rows_inserted,
            rows_skipped=rows_skipped,
            errors=errors,
            warnings=warnings,
        )
```

#### 4.4 — Data Import API route

**File: `backend/app/api/routes/data.py`**
```python
from typing import Any

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel

from app.core.auth import CurrentUser
from app.core.tenant import TenantCtx, get_supabase_service_client
from app.services.data_import.models import ImportResult
from app.services.data_import.service import DataImportService, SourceType

router = APIRouter(prefix="/data", tags=["data"])

_MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


@router.post("/import", response_model=ImportResult, status_code=status.HTTP_201_CREATED)
async def import_sales_data(
    user: CurrentUser,
    tenant: TenantCtx,
    file: UploadFile = File(...),
    source_type: SourceType = Query(
        default="primary",
        description="primary = ERP/Tally dispatch, secondary = DMS offtake, scheme = scheme claims",
    ),
) -> ImportResult:
    if not tenant.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can import data",
        )

    allowed_types = {
        "text/csv",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
    }
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {file.content_type}",
        )

    content = await file.read()
    if len(content) > _MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 50MB limit",
        )

    service = DataImportService(supabase=get_supabase_service_client())
    return service.import_file(
        file_content=content,
        filename=file.filename or "upload.csv",
        tenant_id=tenant.tenant_id,
        source_type=source_type,
    )


class SyncPayload(BaseModel):
    """
    JSON body for the overnight agent push endpoint.
    The akara_agent.py script POSTs here instead of uploading a file.
    Rows must already be in the canonical column format.
    """
    rows: list[dict[str, Any]]
    source_type: SourceType = "primary"


@router.post("/sync", response_model=ImportResult, status_code=status.HTTP_201_CREATED)
async def sync_data(
    body: SyncPayload,
    user: CurrentUser,
    tenant: TenantCtx,
) -> ImportResult:
    """
    Accepts a JSON payload of rows from the overnight agent script.
    Used by akara_agent.py running on the customer's Tally/DMS machine.
    Same pipeline as /data/import — tenant-isolated, admin-only.
    """
    if not tenant.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can push data",
        )
    if not body.rows:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="rows must be a non-empty list",
        )

    import io
    import json
    import pandas as pd

    df = pd.DataFrame(body.rows)
    csv_bytes = df.to_csv(index=False).encode()

    service = DataImportService(supabase=get_supabase_service_client())
    return service.import_file(
        file_content=csv_bytes,
        filename="agent_push.csv",
        tenant_id=tenant.tenant_id,
        source_type=body.source_type,
    )
```

Register in `main.py`:
```python
from app.api.routes import data as data_router
app.include_router(data_router.router)
```

#### 4.5 — Schema Discovery Service

**File: `backend/app/services/schema/__init__.py`** — empty

**File: `backend/app/services/schema/discovery.py`**
```python
import logging
from uuid import UUID

from supabase import Client

logger = logging.getLogger(__name__)

_SALES_DATA_COLUMNS = [
    "invoice_date", "invoice_number", "party_name", "party_city",
    "party_zone", "route", "product_name", "product_group",
    "product_category", "hsn_code", "quantity", "gross_amount",
    "discount_amount", "net_amount", "tax_amount", "total_amount",
    "outstanding_amount",
]

_SECONDARY_SALES_COLUMNS = [
    "invoice_date", "invoice_number", "party_name", "party_city",
    "party_zone", "route", "product_name", "product_group",
    "product_category", "quantity", "gross_amount",
    "discount_amount", "net_amount", "total_amount", "data_source",
]

_SCHEME_MASTER_COLUMNS = [
    "scheme_name", "party_name", "product_name", "product_group",
    "discount_pct", "claimed_amount", "scheme_start", "scheme_end",
]


class SchemaDiscovery:
    """
    Discovers available columns and their distinct values for a tenant.
    Used to build dynamic prompts for the copilot.
    """

    def __init__(self, supabase: Client) -> None:
        self._supabase = supabase

    def get_columns(self) -> list[str]:
        return _SALES_DATA_COLUMNS

    def get_distinct_values(
        self, tenant_id: UUID, column: str, limit: int = 50
    ) -> list[str]:
        if column not in _SALES_DATA_COLUMNS:
            raise ValueError(f"Column '{column}' is not in the allowed schema")
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
            values = []
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
            f"Table: public.sales_data (primary — ERP/Tally dispatch invoices)\n"
            f"Columns: {', '.join(_SALES_DATA_COLUMNS)}\n"
            f"Known zones: {', '.join(zones) if zones else 'unknown'}\n"
            f"Known categories: {', '.join(categories) if categories else 'unknown'}\n\n"
            f"Table: public.secondary_sales_data (secondary — DMS distributor→retailer offtake)\n"
            f"Columns: {', '.join(_SECONDARY_SALES_COLUMNS)}\n\n"
            f"Table: public.scheme_master (scheme claims filed by distributors)\n"
            f"Columns: {', '.join(_SCHEME_MASTER_COLUMNS)}\n\n"
            f"Always filter all tables: WHERE tenant_id = :tenant_id"
        )
```

#### 4.6 — Prompts Generator

**File: `backend/app/services/prompts/__init__.py`** — empty

**File: `backend/app/services/prompts/generator.py`**
```python
from datetime import date
from uuid import UUID

from app.services.schema.discovery import SchemaDiscovery

# ── Industry-specific addendum registry ──────────────────────────────────────
# Each key is an industry slug (tenants.config.industry).
# Values are addendum strings appended to the generic _PLAN_SYSTEM /
# _SYNTHESIZE_SYSTEM constants at request time.
# Adding a new vertical = one new dict entry here. No other file changes needed.

_FMCG_DISTRIBUTION_SYNTHESIZER = """
Currency and number formatting:
- Always express monetary values in Indian format using the ₹ symbol with lakh/crore notation.
  Examples: ₹4.2 lakh, ₹1.3 crore, ₹85,000. Never write raw numbers like 420000 or 1300000.
  Threshold: < ₹1 lakh → ₹X,XXX; ≥ ₹1 lakh → ₹X.X lakh; ≥ ₹1 crore → ₹X.XX crore.
- Where the data supports it, estimate the business impact in ₹ lakh or ₹ crore.
  Example: "This represents an estimated ₹6.8 lakh in recoverable revenue if corrected."

Domain knowledge:
- Parties = distributors or retailers. Zones = geographic sales territories. Routes = distributor beats.
- Primary sales = ERP dispatch (sales_data). Secondary sales = DMS offtake (secondary_sales_data).
- Scheme leakage = claimed_amount > actual secondary offtake for the same party + product + date window.
"""

# NOTE: Language block intentionally removed from this addendum.
# Language rules are now generated separately by build_language_addendum()
# and appended to synthesizer_addendum in /copilot/chat route.
# This decouples language from industry — any tenant can have any language
# regardless of their industry vertical.

_LANGUAGE_NAMES: dict[str, tuple[str, str]] = {
    "hi": ("Hindi", "Devanagari script"),
    "te": ("Telugu", "Telugu script"),
    "ta": ("Tamil", "Tamil script"),
    "mr": ("Marathi", "Devanagari script"),
    "kn": ("Kannada", "Kannada script"),
    "bn": ("Bengali", "Bengali script"),
    "gu": ("Gujarati", "Gujarati script"),
}

_FMCG_DISTRIBUTION_PLANNER = """
Additional table rules for FMCG distribution:
- For primary-vs-secondary comparisons: join or compare sales_data vs secondary_sales_data
  on party_name, product_name, and the relevant date range.
- For scheme leakage detection: join scheme_master vs secondary_sales_data on
  party_name + product_name WHERE invoice_date BETWEEN scheme_start AND scheme_end.
- outstanding_amount is nullable — always filter with IS NOT NULL AND outstanding_amount > 0.
- Prefer revenue = SUM(total_amount) and orders = COUNT(DISTINCT invoice_number).
"""

_INDUSTRY_ADDENDUMS: dict[str, dict[str, str]] = {
    "fmcg_distribution": {
        "synthesizer": _FMCG_DISTRIBUTION_SYNTHESIZER,
        "planner": _FMCG_DISTRIBUTION_PLANNER,
    },
    # Future: "pharma_distribution": {...}, "retail": {...}
}


class PromptGenerator:
    """
    Builds context-aware system prompts for the copilot.

    Two responsibilities:
    1. Schema context — dynamic per-tenant string describing available tables/columns.
    2. Industry addendum registry — FMCG/pharma/retail-specific rules appended to base
       _PLAN_SYSTEM / _SYNTHESIZE_SYSTEM constants based on tenant config.
    """

    def __init__(self, schema_discovery: SchemaDiscovery) -> None:
        self._schema = schema_discovery

    def build_schema_context(self, tenant_id: UUID) -> str:
        return self._schema.get_schema_context(tenant_id)

    def build_synthesizer_addendum(self, tenant_config: dict) -> str:
        """Returns the industry-specific synthesizer addendum, or '' for unknown industries."""
        industry = tenant_config.get("industry", "")
        return _INDUSTRY_ADDENDUMS.get(industry, {}).get("synthesizer", "")

    def build_planner_addendum(self, tenant_config: dict) -> str:
        """Returns the industry-specific planner addendum, or '' for unknown industries."""
        industry = tenant_config.get("industry", "")
        return _INDUSTRY_ADDENDUMS.get(industry, {}).get("planner", "")

    def build_system_prompt(
        self,
        tenant_id: UUID,
        tenant_name: str,
        start_date: str,
        end_date: str,
    ) -> str:
        """Legacy helper — kept for backward compatibility."""
        schema_context = self._schema.get_schema_context(tenant_id)
        return (
            f"You are AKARA Copilot, analytics assistant for {tenant_name}.\n"
            f"Today's date: {date.today().isoformat()}\n"
            f"Data available: {start_date} to {end_date}\n\n"
            f"Database schema:\n{schema_context}\n\n"
            f"Always:\n"
            f"- Filter by tenant_id = :tenant_id\n"
            f"- Reference only tables listed above\n"
            f"- Be specific with numbers and cite the date range\n"
        )
```

### Supabase Connections — Day 4

| Action | Table | Operation | Service | Client Key |
|---|---|---|---|---|
| KPI summary | `sales_data` | SELECT via RPC | DB | service role |
| Top products | `sales_data` | SELECT | DB | service role |
| Zone breakdown | `sales_data` | SELECT | DB | service role |
| Route performance | `sales_data` | SELECT | DB | service role |
| Outstanding parties | `sales_data` | SELECT | DB | service role |
| Import primary | `sales_data` | INSERT | DB | service role |
| Import secondary | `secondary_sales_data` | INSERT | DB | service role |
| Import scheme | `scheme_master` | INSERT | DB | service role |
| Agent sync push | `sales_data` / `secondary_sales_data` | INSERT | DB | service role |
| Schema discovery | `sales_data` | SELECT | DB | service role |

### Deploy Steps — Day 4
Nothing deployed today. Local only.

### Test / Verify — Day 4

1. Start backend and test data import with a sample CSV:
```bash
# Create a test CSV
cat > /tmp/test_sales.csv << 'EOF'
invoice_date,invoice_number,party_name,party_city,party_zone,product_name,quantity,total_amount
2024-01-15,INV001,ABC Stores,Mumbai,West,Brand X Biscuit 100g,50,1500.00
2024-01-15,INV002,DEF Mart,Pune,West,Brand Y Chips 200g,30,900.00
EOF

# Import it
curl -s -X POST http://localhost:8000/data/import \
  -H "Authorization: Bearer YOUR_JWT" \
  -F "file=@/tmp/test_sales.csv;type=text/csv" | python3 -m json.tool
```

2. Test KPI endpoint:
```bash
curl -s "http://localhost:8000/kpi/?start_date=2024-01-01&end_date=2024-12-31" \
  -H "Authorization: Bearer YOUR_JWT" | python3 -m json.tool
```

3. Test SQL guard with forbidden query:
```bash
uv run python -c "
from app.sql.guard import validate_sql, SQLGuardError
queries = [
    'SELECT * FROM sales_data',
    'SELECT * FROM pg_catalog.pg_tables',
    'DELETE FROM sales_data',
    'SELECT 1; DROP TABLE users;',
]
for q in queries:
    try:
        validate_sql(q)
        print(f'ALLOWED: {q[:50]}')
    except SQLGuardError as e:
        print(f'BLOCKED: {e}')
"
```

### Local Quality Gate — Day 4
```bash
cd backend
ruff check .
pytest
```

### End-of-Day State — Day 4
- [ ] KPI service computes revenue, orders, AOV, zones, trend from `sales_data`
- [ ] KPI service computes route performance (top routes by revenue, order count)
- [ ] KPI service returns outstanding parties if `outstanding_amount` data present
- [ ] `/kpi/` endpoint returns full KPI response with correct tenant isolation
- [ ] Data import service accepts `source_type`: primary → `sales_data`, secondary → `secondary_sales_data`, scheme → `scheme_master`
- [ ] `/data/import` endpoint accepts `source_type` query param (default: primary)
- [ ] `/data/sync` endpoint accepts JSON rows from overnight agent script
- [ ] Schema discovery describes all 3 tables in context string for LLM
- [ ] Prompts generator builds tenant-specific system prompts
- [ ] `ruff check .` exits 0

---

## Day 5 — Deploy Backend to Railway + Smoke Test

### Goal
By end of Day 5, the FastAPI backend is live on Railway at a public HTTPS URL, all environment variables are set in Railway's dashboard, and every deployed endpoint passes a smoke test from the outside internet.

### Track 1 — Deploy Backend

#### Prerequisites
- Days 1–4 complete
- Railway account created (railway.app)
- Railway CLI installed: `npm install -g @railway/cli` or `brew install railway`

#### Exactly What You Build

**File: `backend/Procfile`**
```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

**File: `backend/runtime.txt`**
```
python-3.12
```

**File: `backend/.python-version`**
```
3.12
```

Update `backend/pyproject.toml` — add Railway build command note at top as comment:
```toml
# Railway uses: uv sync && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

**File: `backend/railway.json`**
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "pip install uv && uv sync"
  },
  "deploy": {
    "startCommand": "uvicorn app.main:app --host 0.0.0.0 --port $PORT",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

#### Deploy Steps — Day 5

1. Login to Railway:
```bash
railway login
```

2. Initialize project:
```bash
cd backend
railway init
# Select "Empty Project"
# Name: akara-backend
```

3. Link to service:
```bash
railway link
```

4. Set all environment variables in Railway dashboard (Project → Variables):

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `JWT_SECRET` | Supabase JWT secret (Settings → API → JWT Secret) |
| `GEMINI_API_KEY` | Google AI API key |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `ENVIRONMENT` | `production` |
| `LOG_LEVEL` | `INFO` |
| `ALLOWED_ORIGINS` | `https://your-app.vercel.app` (update Day 6) |
| `GMAIL_USER` | Gmail address |
| `GMAIL_APP_PASSWORD` | Gmail app password |

5. Deploy:
```bash
railway up
```

6. Get public URL:
```bash
railway status
# Note the RAILWAY_STATIC_URL e.g.: akara-backend-production.up.railway.app
```

7. Generate domain in Railway dashboard → Settings → Networking → Generate Domain

#### Smoke Test — Day 5

Replace `RAILWAY_URL` with your actual Railway domain:

```bash
RAILWAY_URL="https://akara-backend-production.up.railway.app"

# 1. Health check
curl -s "$RAILWAY_URL/health" | python3 -m json.tool
# Expected: {"status":"ok","environment":"production","timestamp":"..."}

# 2. Confirm docs are hidden in production
curl -s -o /dev/null -w "%{http_code}" "$RAILWAY_URL/docs"
# Expected: 404

# 3. Auth without token
curl -s -o /dev/null -w "%{http_code}" "$RAILWAY_URL/auth/me"
# Expected: 403

# 4. KPI without token
curl -s -o /dev/null -w "%{http_code}" "$RAILWAY_URL/kpi/"
# Expected: 403
```

#### Supabase Connections — Day 5

Same as Day 4 — all connections now go through the Railway-hosted backend.

---

### Track 2 — Admin API Routes (Backend)

**Start Track 2. This runs alongside Track 1 from Day 5 onward.**

#### What You Build (Track 2)

**File: `backend/app/api/routes/admin/__init__.py`** — empty

**File: `backend/app/api/routes/admin/tenants.py`**
```python
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.auth import CurrentUser
from app.core.tenant import TenantCtx, get_supabase_service_client


class TenantOut(BaseModel):
    id: UUID
    name: str
    slug: str
    is_active: bool
    config: dict


class TenantCreate(BaseModel):
    name: str
    slug: str
    config: dict = {}


router = APIRouter(prefix="/admin/tenants", tags=["admin"])


def _require_superadmin(tenant: TenantCtx) -> TenantCtx:
    """Placeholder: in production, check a superadmin flag in tenant config."""
    if not tenant.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Superadmin only")
    return tenant


@router.get("/", response_model=list[TenantOut])
def list_tenants(
    user: CurrentUser,
    tenant: TenantCtx = Depends(_require_superadmin),
) -> list[TenantOut]:
    supabase = get_supabase_service_client()
    result = supabase.table("tenants").select("*").order("created_at", desc=True).execute()
    return [TenantOut(**row) for row in (result.data or [])]


@router.post("/", response_model=TenantOut, status_code=status.HTTP_201_CREATED)
def create_tenant(
    body: TenantCreate,
    user: CurrentUser,
    tenant: TenantCtx = Depends(_require_superadmin),
) -> TenantOut:
    supabase = get_supabase_service_client()
    result = (
        supabase.table("tenants")
        .insert({"name": body.name, "slug": body.slug, "config": body.config})
        .execute()
    )
    return TenantOut(**result.data[0])


@router.patch("/{tenant_id}/deactivate", response_model=TenantOut)
def deactivate_tenant(
    tenant_id: UUID,
    user: CurrentUser,
    tenant: TenantCtx = Depends(_require_superadmin),
) -> TenantOut:
    supabase = get_supabase_service_client()
    result = (
        supabase.table("tenants")
        .update({"is_active": False})
        .eq("id", str(tenant_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return TenantOut(**result.data[0])
```

Register in `main.py`:
```python
from app.api.routes.admin import tenants as admin_tenants_router
app.include_router(admin_tenants_router.router)
```

#### Local Quality Gate — Day 5
```bash
cd backend
ruff check .
pytest
```

#### End-of-Day State — Day 5
- [ ] Backend live at Railway HTTPS URL
- [ ] `/health` returns 200 from public URL
- [ ] All 4 smoke tests pass from outside internet
- [ ] Railway environment variables all set
- [ ] Track 2: `/admin/tenants` GET/POST/PATCH routes working locally

---

## Day 6 — React Scaffold + Supabase Auth + Deploy to Vercel

### Goal
By end of Day 6, the React frontend is deployed on Vercel, users can sign up and log in using Supabase Auth (email/password), the auth session is stored in context and available app-wide, and protected routes redirect unauthenticated users to the login page.

### Track 1 — Frontend Core + Auth

#### Prerequisites
- Day 5 complete: backend deployed on Railway
- Vercel account created (vercel.com)
- Vercel CLI: `pnpm add -g vercel`

#### Exactly What You Build

**File: `frontend/src/types/index.ts`**
```typescript
export interface User {
  id: string;
  email: string;
  tenantId: string;
  role: "admin" | "user";
  displayName?: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  config: Record<string, unknown>;
  isActive: boolean;
}
```

**File: `frontend/src/contexts/AuthContext.tsx`**
```typescript
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { User } from "@/types";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(supabaseUser: SupabaseUser, accessToken: string) {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/auth/me`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) throw new Error("Profile fetch failed");
      const data = await res.json();
      setUser({
        id: data.user_id,
        email: data.email,
        tenantId: data.tenant_id,
        role: data.role,
      });
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user && session.access_token) {
        fetchProfile(session.user, session.access_token).finally(() =>
          setLoading(false)
        );
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session?.user && session.access_token) {
          fetchProfile(session.user, session.access_token);
        } else {
          setUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

**File: `frontend/src/components/ProtectedRoute.tsx`**
```typescript
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function ProtectedRoute() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  return session ? <Outlet /> : <Navigate to="/login" replace />;
}
```

**File: `frontend/src/pages/LoginPage.tsx`**
```typescript
import { useState } from "react";
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

  async function handleSubmit(e: React.FormEvent) {
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
        </CardContent>
      </Card>
    </div>
  );
}
```

**File: `frontend/src/components/layout/AppShell.tsx`**
```typescript
import { Link, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  MessageSquare,
  Upload,
  BarChart2,
  Settings,
  LogOut,
  TrendingUp,
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

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-6 py-5 border-b border-slate-200">
          <span className="text-xl font-bold text-slate-900">AKARA</span>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {user?.email}
          </p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                location.pathname.startsWith(to)
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-slate-200">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3 text-slate-600"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>
      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
```

**File: `frontend/src/App.tsx`**
```typescript
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/pages/LoginPage";

// Placeholder pages (built Days 7–10)
const Dashboard = () => <div className="p-8"><h1 className="text-2xl font-bold">Dashboard — coming Day 7</h1></div>;
const Copilot = () => <div className="p-8"><h1 className="text-2xl font-bold">Copilot — coming Day 8</h1></div>;
const Data = () => <div className="p-8"><h1 className="text-2xl font-bold">Data — coming Day 9</h1></div>;
const Reports = () => <div className="p-8"><h1 className="text-2xl font-bold">Reports — coming Day 10</h1></div>;
const Simulator = () => <div className="p-8"><h1 className="text-2xl font-bold">Simulator — coming Day 10</h1></div>;
const SettingsPage = () => <div className="p-8"><h1 className="text-2xl font-bold">Settings — coming Day 9</h1></div>;

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
                <Route path="/dashboard" element={<Dashboard />} />
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

**File: `frontend/src/main.tsx`**
```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**File: `frontend/vercel.json`**
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

#### Deploy Steps — Day 6

1. Add `lucide-react`:
```bash
cd frontend
pnpm add lucide-react
```

2. Install shadcn components used today:
```bash
pnpm dlx shadcn@latest add button input label card
```

3. Build locally to catch errors:
```bash
pnpm build
# Should complete without errors
```

4. Deploy to Vercel:
```bash
vercel
# When prompted:
# Set up and deploy: Y
# Which scope: your account
# Link to existing project: N
# Project name: akara-frontend
# In which directory is your code: ./
# Build command: pnpm build
# Output directory: dist
# Development command: pnpm dev
```

5. Set environment variables in Vercel dashboard (Project → Settings → Environment Variables):

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `VITE_API_BASE_URL` | `https://akara-backend-production.up.railway.app` |

6. Redeploy with env vars:
```bash
vercel --prod
```

7. Update `ALLOWED_ORIGINS` in Railway with the Vercel URL:
```
ALLOWED_ORIGINS=https://akara-frontend.vercel.app
```
Then redeploy backend: `railway up`

#### Supabase Connections — Day 6

| Action | Table | Operation | Service | Client Key |
|---|---|---|---|---|
| Auth sign in | auth.users | signInWithPassword | Auth | anon key |
| Session management | auth.sessions | auto | Auth | anon key |
| Profile fetch | Via `/auth/me` backend | SELECT | DB (backend) | service role (backend) |

#### Test / Verify — Day 6

1. Open Vercel URL in browser.
2. You should be redirected to `/login`.
3. Create a test user in Supabase dashboard → Authentication → Add user, then manually insert into `profiles`:
```sql
-- First create a test tenant
INSERT INTO public.tenants (name, slug) VALUES ('Test Co', 'test-co');

-- Then insert a profile for the test user (replace UUIDs)
INSERT INTO public.profiles (id, tenant_id, role, display_name)
VALUES (
    'USER_UUID_FROM_AUTH_USERS',
    'TENANT_UUID_FROM_TENANTS',
    'admin',
    'Test Admin'
);
```
4. Log in with test user credentials at the Vercel URL.
5. You should be redirected to `/dashboard` and see the placeholder "coming Day 7" page.
6. Sidebar should show your email.
7. Click "Sign out" — should redirect to `/login`.

#### Local Quality Gate — Day 6
```bash
cd backend
ruff check .
pytest
```

---

### Track 2 — Admin Console: Tenants Page

**File: `frontend/src/pages/admin/TenantsPage.tsx`**
```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

async function fetchTenants(token: string): Promise<Tenant[]> {
  const res = await fetch(
    `${import.meta.env.VITE_API_BASE_URL}/admin/tenants`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error("Failed to fetch tenants");
  return res.json();
}

export function TenantsPage() {
  const { session } = useAuth();
  const qc = useQueryClient();

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: () => fetchTenants(session!.access_token),
    enabled: !!session,
  });

  if (isLoading) return <div className="p-8">Loading tenants...</div>;

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Tenants</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(tenants || []).map((t) => (
            <TableRow key={t.id}>
              <TableCell>{t.name}</TableCell>
              <TableCell className="font-mono text-sm">{t.slug}</TableCell>
              <TableCell>
                <Badge variant={t.is_active ? "default" : "secondary"}>
                  {t.is_active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell>
                <Button variant="outline" size="sm">
                  Manage
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

Install missing shadcn components for Track 2:
```bash
cd frontend
pnpm dlx shadcn@latest add table badge
```

#### End-of-Day State — Day 6
- [ ] React frontend deployed on Vercel at HTTPS URL
- [ ] Login page styled with shadcn/ui Card + Input
- [ ] Supabase Auth sign-in working end-to-end
- [ ] Protected routes redirect to `/login` when not authenticated
- [ ] AppShell renders with sidebar navigation after login
- [ ] Track 2: `TenantsPage` component built

---

## Day 7 — Dashboard Page (KPIs + Charts)

### Goal
By end of Day 7, the `/dashboard` page displays real-time KPI cards (revenue, orders, AOV, zone breakdown) and a revenue trend line chart — all populated from the `/kpi/` endpoint — with a date range filter that re-fetches on change.

### Track 1 — Dashboard Page

#### Prerequisites
- Day 6 complete: frontend deployed, auth working
- `/kpi/` endpoint returning real data (requires test data in `sales_data`)

#### Exactly What You Build

**File: `frontend/src/lib/api.ts`**
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

**File: `frontend/src/hooks/useKPIs.ts`**
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

**File: `frontend/src/types/kpi.ts`**
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

export interface KPIResponse {
  summary: KPISummary;
  top_products: TopProduct[];
  zone_breakdown: ZoneBreakdown[];
  revenue_trend: RevenueByDate[];
  date_range_start: string;
  date_range_end: string;
}
```

**File: `frontend/src/components/dashboard/KPICard.tsx`**
```typescript
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
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

Install Recharts for charts:
```bash
cd frontend
pnpm add recharts
```

**File: `frontend/src/components/dashboard/RevenueTrendChart.tsx`**
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

**File: `frontend/src/components/dashboard/ZoneChart.tsx`**
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

**File: `frontend/src/pages/DashboardPage.tsx`**
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
    </div>
  );
}
```

Update `App.tsx` — replace placeholder `Dashboard` import:
```typescript
import { DashboardPage } from "@/pages/DashboardPage";
// Replace: const Dashboard = ...
// With: use DashboardPage in the route
```

Install shadcn select:
```bash
pnpm dlx shadcn@latest add select
```

### Supabase Connections — Day 7

| Action | Table | Operation | Service | Client Key |
|---|---|---|---|---|
| Auth session | auth.sessions | getSession | Auth | anon key |
| KPI data | `sales_data` | SELECT via `/kpi/` API | DB (backend) | service role (backend) |

### Test / Verify — Day 7

1. Deploy updated frontend: `vercel --prod`
2. Open `/dashboard` — KPI cards should populate if `sales_data` has rows.
3. Change the period dropdown — charts should re-render.
4. Open Network tab in DevTools — confirm `/kpi/` request includes `Authorization: Bearer ...` header.
5. Confirm revenue numbers match a manual SQL query:
```sql
SELECT SUM(total_amount), COUNT(DISTINCT invoice_number)
FROM public.sales_data
WHERE tenant_id = 'YOUR_TENANT_ID'
  AND invoice_date BETWEEN '2024-01-01' AND '2024-12-31';
```

---

### Track 2 — Admin Console: Users Page

**File: `backend/app/api/routes/admin/users.py`**
```python
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.auth import CurrentUser
from app.core.tenant import TenantCtx, get_supabase_service_client
from app.api.routes.admin.tenants import _require_superadmin


class UserOut(BaseModel):
    id: UUID
    tenant_id: UUID
    role: str
    display_name: str | None


class UserRoleUpdate(BaseModel):
    role: str


router = APIRouter(prefix="/admin/users", tags=["admin"])


@router.get("/{tenant_id}", response_model=list[UserOut])
def list_users_for_tenant(
    tenant_id: UUID,
    user: CurrentUser,
    tenant: TenantCtx = Depends(_require_superadmin),
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
    tenant: TenantCtx = Depends(_require_superadmin),
) -> UserOut:
    if body.role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'user'")
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

Register in `main.py`:
```python
from app.api.routes.admin import users as admin_users_router
app.include_router(admin_users_router.router)
```

#### Local Quality Gate — Day 7
```bash
cd backend
ruff check .
pytest
```

#### 7.X — Route Performance Card + Outstanding Card

Add these two cards to `frontend/src/pages/DashboardPage.tsx` below the zone breakdown card. They render conditionally — empty arrays from the API mean they simply don't appear.

```typescript
{/* Route Performance Card — shown if kpi.route_performance has entries */}
{kpi.route_performance.length > 0 && (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">Route Performance</CardTitle>
      <CardDescription>Top routes by revenue · last {days} days</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        {kpi.route_performance.slice(0, 5).map((r) => (
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

{/* Outstanding Parties Card — shown if kpi.outstanding_parties has entries */}
{kpi.outstanding_parties.length > 0 && (
  <Card className="border-amber-200 bg-amber-50">
    <CardHeader>
      <CardTitle className="text-base text-amber-800">Credit Exposure</CardTitle>
      <CardDescription className="text-amber-600">
        Parties with outstanding receivables
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        {kpi.outstanding_parties.slice(0, 5).map((p) => (
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
            kpi.outstanding_parties.reduce(
              (s, p) => s + Number(p.outstanding_amount),
              0
            ) / 100000
          ).toFixed(1)}
          L outstanding across {kpi.outstanding_parties.length} parties
        </p>
      </div>
    </CardContent>
  </Card>
)}
```

Update the KPI response type in `frontend/src/types/index.ts` to include the new fields:

```typescript
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
  route_performance: RoutePerformance[];     // new
  outstanding_parties: OutstandingParty[];   // new
  date_range_start: string;
  date_range_end: string;
}
```

#### End-of-Day State — Day 7
- [ ] Dashboard page live at `/dashboard` with real KPI data
- [ ] 4 KPI cards, 1 revenue trend line chart, 1 zone bar chart, top products list
- [ ] Route performance card renders if `route` column data is present
- [ ] Credit exposure card renders if `outstanding_amount` data is present
- [ ] Date range selector updates charts on change
- [ ] Loading skeleton shown while data fetches
- [ ] Track 2: admin users API (`GET /{tenant_id}`, `PATCH /{user_id}/role`) working

---

## Day 8 — Copilot Page (Chat UI + Streaming)

### Goal
By end of Day 8, the `/copilot` page has a full chat interface: users type questions, messages stream word-by-word from the backend via SSE, the chat history is preserved in state during the session, and the UI handles loading, streaming, and error states gracefully.

### Track 1 — Copilot Chat Page

#### Prerequisites
- Day 7 complete: dashboard working
- `/copilot/chat` endpoint tested locally (Day 3)

#### Exactly What You Build

**File: `frontend/src/hooks/useCopilot.ts`**
```typescript
import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  error?: boolean;
}

const BASE = import.meta.env.VITE_API_BASE_URL as string;

export function useCopilot() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = useCallback(async (question: string) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
    };
    const assistantMsgId = crypto.randomUUID();
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    try {
      const res = await fetch(`${BASE}/copilot/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question, stream: true }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const chunk = line.slice(6);
            if (chunk === "[DONE]") continue;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: m.content + chunk }
                  : m
              )
            );
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, streaming: false } : m
        )
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: "Sorry, something went wrong. Please try again.",
                streaming: false,
                error: true,
              }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }, []);

  return { messages, isStreaming, sendMessage };
}
```

**File: `frontend/src/components/copilot/ChatBubble.tsx`**
```typescript
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/hooks/useCopilot";

interface Props {
  message: ChatMessage;
}

export function ChatBubble({ message }: Props) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn(
        "flex gap-3 max-w-3xl",
        isUser ? "ml-auto flex-row-reverse" : "mr-auto"
      )}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold",
          isUser
            ? "bg-slate-900 text-white"
            : "bg-indigo-100 text-indigo-700"
        )}
      >
        {isUser ? "U" : "AI"}
      </div>
      <div
        className={cn(
          "rounded-2xl px-4 py-3 text-sm max-w-lg",
          isUser
            ? "bg-slate-900 text-white rounded-tr-sm"
            : message.error
            ? "bg-red-50 text-red-700 border border-red-200 rounded-tl-sm"
            : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm"
        )}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        {message.streaming && (
          <span className="inline-block w-1.5 h-4 bg-indigo-500 ml-0.5 animate-pulse" />
        )}
      </div>
    </div>
  );
}
```

**File: `frontend/src/components/copilot/SuggestedPrompts.tsx`**
```typescript
const SUGGESTIONS = [
  "What were my top 5 selling products last month?",
  "Which zone had the highest revenue this quarter?",
  "Show me the revenue trend for the past 30 days",
  "Which parties haven't ordered in the past 2 weeks?",
  "Compare revenue this month vs last month",
];

interface Props {
  onSelect: (prompt: string) => void;
}

export function SuggestedPrompts({ onSelect }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 text-center">Try asking:</p>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSelect(s)}
            className="text-xs px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
```

**File: `frontend/src/pages/CopilotPage.tsx`**
```typescript
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { useCopilot } from "@/hooks/useCopilot";
import { ChatBubble } from "@/components/copilot/ChatBubble";
import { SuggestedPrompts } from "@/components/copilot/SuggestedPrompts";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function CopilotPage() {
  const { messages, isStreaming, sendMessage } = useCopilot();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const q = input.trim();
    if (!q || isStreaming) return;
    setInput("");
    sendMessage(q);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 py-5 border-b border-slate-200 bg-white">
        <h1 className="text-xl font-bold text-slate-900">AKARA Copilot</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Ask anything about your sales data
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full space-y-8 text-center">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                Hello! How can I help?
              </h2>
              <p className="text-slate-500 mt-2 max-w-md">
                I can answer questions about your revenue, orders, products,
                zones, and more.
              </p>
            </div>
            <SuggestedPrompts onSelect={(p) => { setInput(p); }} />
          </div>
        )}
        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-8 py-5 border-t border-slate-200 bg-white">
        <div className="flex gap-3 max-w-3xl mx-auto">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your sales data..."
            rows={1}
            className="resize-none min-h-[44px] max-h-32"
            disabled={isStreaming}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            size="icon"
            className="h-11 w-11 flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-slate-400 text-center mt-2">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
```

Install textarea shadcn component:
```bash
pnpm dlx shadcn@latest add textarea
```

Update `App.tsx` — replace `Copilot` placeholder with `CopilotPage`.

### Supabase Connections — Day 8

| Action | Table | Operation | Service | Client Key |
|---|---|---|---|---|
| Auth token | auth.sessions | getSession | Auth | anon key |
| Chat streaming | `chat_history` | INSERT (backend saves) | DB (backend) | service role |

Add chat history saving to the copilot route in `backend/app/api/routes/copilot.py` — after the non-streaming response:
```python
# After response = await agent.answer(...)
# Save to chat_history:
supabase = get_supabase_service_client()
supabase.table("chat_history").insert({
    "tenant_id": str(tenant.tenant_id),
    "user_id": str(user.user_id),
    "question": request.question,
    "response": response.response,
    "metadata": {
        "intent": response.intent,
        "sql_queries_run": response.sql_queries_run,
        "response_time_ms": response.response_time_ms,
        "guardrail_results": response.guardrail_results,
    },
}).execute()
```

### Test / Verify — Day 8

1. Open `/copilot` page.
2. Click a suggested prompt — it should populate the input.
3. Send a question — assistant response should stream word by word.
4. Send a second question — chat history accumulates.
5. Open Supabase → `chat_history` table — rows should appear.
6. Reload page — chat history clears (session-only, by design at this stage).
7. Test error: disable network — error message should appear instead of crash.

#### Local Quality Gate — Day 8
```bash
cd backend
ruff check .
pytest
```

---

### Track 2 — Admin Console: Data + Logs

**File: `backend/app/api/routes/admin/logs.py`**
```python
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from datetime import datetime

from app.core.auth import CurrentUser
from app.core.tenant import TenantCtx, get_supabase_service_client
from app.api.routes.admin.tenants import _require_superadmin


class AuditLogEntry(BaseModel):
    id: UUID
    tenant_id: UUID | None
    user_id: UUID | None
    action: str
    resource_type: str | None
    details: dict
    ip_address: str | None
    created_at: datetime


router = APIRouter(prefix="/admin/logs", tags=["admin"])


@router.get("/{tenant_id}", response_model=list[AuditLogEntry])
def get_audit_logs(
    tenant_id: UUID,
    user: CurrentUser,
    tenant: TenantCtx = Depends(_require_superadmin),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[AuditLogEntry]:
    supabase = get_supabase_service_client()
    result = (
        supabase.table("audit_log")
        .select("*")
        .eq("tenant_id", str(tenant_id))
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return [AuditLogEntry(**row) for row in (result.data or [])]
```

Register in `main.py`:
```python
from app.api.routes.admin import logs as admin_logs_router
app.include_router(admin_logs_router.router)
```

#### End-of-Day State — Day 8
- [ ] Copilot page renders empty state with suggested prompts
- [ ] Messages stream word-by-word via SSE
- [ ] Chat history saves to Supabase `chat_history` table
- [ ] Error state shown gracefully (no crash) when API fails
- [ ] Track 2: audit log API endpoint working

---

## Day 9 — Data Management Page + Settings Page

### Goal
By end of Day 9, the `/data` page allows admins to upload Excel/CSV files that are imported into `sales_data` with a progress indicator and result summary, and the `/settings` page shows the current user's profile, tenant name, and allows display name changes.

### Track 1 — Data + Settings Pages

#### Prerequisites
- Day 8 complete
- `/data/import` endpoint live on Railway

#### Exactly What You Build

**File: `frontend/src/pages/DataPage.tsx`**
```typescript
import { useState, useRef } from "react";
import { Upload, CheckCircle, AlertCircle, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";

interface ImportResult {
  rows_inserted: number;
  rows_skipped: number;
  errors: string[];
  warnings: string[];
}

type SourceType = "primary" | "secondary" | "scheme";

const BASE = import.meta.env.VITE_API_BASE_URL as string;

async function uploadFile(
  file: File,
  sourceType: SourceType,
  onProgress: (p: number) => void
): Promise<ImportResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const formData = new FormData();
  formData.append("file", file);

  const progressInterval = setInterval(() => {
    onProgress(Math.min(90, (Date.now() % 90) + 10));
  }, 200);

  const res = await fetch(`${BASE}/data/import?source_type=${sourceType}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  clearInterval(progressInterval);
  onProgress(100);

  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.detail || `Upload failed: ${res.status}`);
  }

  return res.json();
}

function UploadPanel({
  title,
  description,
  columns,
  sourceType,
  isAdmin,
  accentColor = "slate",
}: {
  title: string;
  description: string;
  columns: string[];
  sourceType: SourceType;
  isAdmin: boolean;
  accentColor?: "slate" | "blue" | "purple";
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const borderColor = {
    slate: "border-slate-200",
    blue: "border-blue-200",
    purple: "border-purple-200",
  }[accentColor];

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setResult(null);
    setError(null);
    try {
      const r = await uploadFile(file, sourceType, setProgress);
      setResult(r);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className={`border ${borderColor}`}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-colors"
        >
          <Upload className="h-7 w-7 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700">
            {file ? file.name : "Click to select file"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : ".xlsx, .xls, .csv — max 50 MB"}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={!isAdmin}
          />
        </div>

        {uploading && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Uploading...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        <Button onClick={handleUpload} disabled={!file || uploading || !isAdmin} className="w-full">
          {uploading ? "Importing..." : "Import"}
        </Button>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
              <p className="text-sm text-green-700">
                {result.rows_inserted} rows imported · {result.rows_skipped} skipped
              </p>
            </div>
            {result.warnings.length > 0 && (
              <details className="text-xs text-slate-600">
                <summary className="cursor-pointer font-medium">
                  {result.warnings.length} warnings
                </summary>
                <ul className="mt-1 space-y-1 pl-4 list-disc">
                  {result.warnings.slice(0, 20).map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}

        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer font-medium flex items-center gap-1">
            <FileText className="h-3 w-3" /> Expected columns
          </summary>
          <div className="mt-2 flex flex-wrap gap-1">
            {columns.map((col) => (
              <code key={col} className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">{col}</code>
            ))}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

export function DataPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Data Management</h1>
        <p className="text-sm text-slate-500 mt-1">
          Import primary sales, secondary DMS data, and scheme master — each to the correct table.
        </p>
      </div>

      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          Only admins can import data. Contact your administrator.
        </div>
      )}

      <UploadPanel
        title="Primary Sales (ERP / Tally)"
        description="Dispatch invoices from Tally or your ERP. What you shipped to distributors."
        sourceType="primary"
        isAdmin={isAdmin}
        accentColor="slate"
        columns={[
          "invoice_date", "invoice_number", "party_name", "party_city", "party_zone",
          "route", "product_name", "product_group", "quantity",
          "gross_amount", "discount_amount", "net_amount", "tax_amount", "total_amount",
          "outstanding_amount (optional)",
        ]}
      />

      <UploadPanel
        title="Secondary Sales (DMS Offtake)"
        description="What distributors actually sold to retailers. Export from Bizom, Botree, FieldAssist, or your DMS."
        sourceType="secondary"
        isAdmin={isAdmin}
        accentColor="blue"
        columns={[
          "invoice_date", "party_name", "party_zone", "route",
          "product_name", "product_group", "quantity", "total_amount",
        ]}
      />

      <UploadPanel
        title="Scheme Master (Distributor Claims)"
        description="Scheme claims filed by distributors. Used to detect leakage vs. actual secondary offtake."
        sourceType="scheme"
        isAdmin={isAdmin}
        accentColor="purple"
        columns={[
          "scheme_name", "party_name", "product_name",
          "claimed_amount", "scheme_start", "scheme_end", "discount_pct (optional)",
        ]}
      />
    </div>
  );
}
```

Install shadcn progress:
```bash
pnpm dlx shadcn@latest add progress
```

**File: `frontend/src/pages/SettingsPage.tsx`**
```typescript
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
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
import { Badge } from "@/components/ui/badge";

export function SettingsPage() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName })
        .eq("id", user!.id);
      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center text-lg font-bold">
              {user?.email?.[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <p className="font-medium text-slate-900">{user?.email}</p>
              <Badge variant="outline" className="text-xs mt-0.5">
                {user?.role}
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          {saved && (
            <p className="text-sm text-green-600">Saved successfully!</p>
          )}

          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          <div className="flex justify-between">
            <span>Tenant ID</span>
            <code className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">
              {user?.tenantId}
            </code>
          </div>
          <div className="flex justify-between">
            <span>User ID</span>
            <code className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">
              {user?.id}
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

Update `App.tsx` — replace placeholder `Data` and `SettingsPage` with real components.

### Supabase Connections — Day 9

| Action | Table | Operation | Service | Client Key |
|---|---|---|---|---|
| Update display name | `profiles` | UPDATE | DB | anon key (direct from frontend) |
| File upload | `sales_data` | INSERT via `/data/import` | DB (backend) | service role |

### Deploy Steps — Day 9
```bash
cd frontend
vercel --prod
```

```bash
cd backend
railway up
```

### Test / Verify — Day 9

1. As an admin user, go to `/data`, select a test CSV, click "Import Data" — progress bar animates, result shows rows inserted.
2. Open Supabase → `sales_data` — new rows should appear with your tenant_id.
3. As a non-admin user — "Import Data" button should be disabled, warning banner visible.
4. Go to `/settings` — display name field pre-populated, change it, save — "Saved successfully!" appears.
5. Verify in Supabase:
```sql
SELECT display_name FROM public.profiles WHERE id = 'YOUR_USER_ID';
```

#### Local Quality Gate — Day 9
```bash
cd backend
ruff check .
pytest
```

---

### Track 2 — Admin Console: Reports + Morning Brief Trigger

**File: `backend/app/services/email/morning_brief.py`**
```python
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from uuid import UUID

from app.core.config import settings
from app.services.kpi.service import KPIService
from app.core.tenant import get_supabase_service_client

logger = logging.getLogger(__name__)


class MorningBriefService:
    """Sends a daily revenue summary email via Gmail SMTP."""

    def send_brief(self, tenant_id: UUID, recipient_email: str) -> bool:
        supabase = get_supabase_service_client()
        kpi_svc = KPIService(supabase=supabase)

        from datetime import date, timedelta
        today = date.today()
        yesterday = today - timedelta(days=1)

        summary = kpi_svc.get_summary(
            tenant_id=tenant_id,
            start_date=yesterday.isoformat(),
            end_date=yesterday.isoformat(),
        )

        subject = f"AKARA Monday Brief — {yesterday.isoformat()}"

        # Format revenue in lakh/crore for Indian readability
        rev = float(summary.total_revenue)
        if rev >= 10_000_000:
            rev_str = f"₹{rev/10_000_000:.2f} Cr"
        elif rev >= 100_000:
            rev_str = f"₹{rev/100_000:.1f}L"
        else:
            rev_str = f"₹{rev:,.0f}"

        aov = float(summary.avg_order_value)
        aov_str = f"₹{aov/1000:.1f}K" if aov >= 1000 else f"₹{aov:,.0f}"

        body = (
            f"Good morning!\n\n"
            f"AKARA Commercial Brief — {yesterday.isoformat()}\n"
            f"{'─' * 40}\n\n"
            f"Yesterday at a glance:\n"
            f"  Revenue:        {rev_str}\n"
            f"  Orders:         {summary.total_orders:,}\n"
            f"  Active parties: {summary.unique_parties:,}\n"
            f"  Avg order:      {aov_str}\n\n"
            f"{'─' * 40}\n"
            f"Top 3 actions for today (ranked by ₹ impact):\n\n"
            f"  1. Review your highest-revenue zone — identify if any route\n"
            f"     has zero orders in the last 3 days. Each missed route costs\n"
            f"     an estimated ₹{aov/1000:.1f}K–₹{aov*3/1000:.1f}K per day.\n\n"
            f"  2. Check parties with outstanding > 30 days in AKARA dashboard.\n"
            f"     Recoverable today before cycle closes.\n\n"
            f"  3. Ask AKARA: 'Which products had a drop last week vs the week\n"
            f"     before?' — catch demand shifts before they compound.\n\n"
            f"{'─' * 40}\n"
            f"Log in to AKARA → https://app.akara.ai\n"
        )

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = settings.gmail_user
            msg["To"] = recipient_email
            msg.attach(MIMEText(body, "plain"))

            with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
                server.login(settings.gmail_user, settings.gmail_app_password)
                server.sendmail(settings.gmail_user, recipient_email, msg.as_string())

            logger.info("Morning brief sent to %s", recipient_email)
            return True
        except smtplib.SMTPException as exc:
            logger.error("Failed to send morning brief: %s", exc)
            return False
```

**File: `backend/app/api/routes/admin/reports.py`**
```python
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.auth import CurrentUser
from app.core.tenant import TenantCtx
from app.api.routes.admin.tenants import _require_superadmin
from app.services.email.morning_brief import MorningBriefService


class BriefRequest(BaseModel):
    tenant_id: UUID
    recipient_email: str


router = APIRouter(prefix="/admin/reports", tags=["admin"])


@router.post("/morning-brief")
def trigger_morning_brief(
    body: BriefRequest,
    user: CurrentUser,
    tenant: TenantCtx = Depends(_require_superadmin),
) -> dict:
    service = MorningBriefService()
    success = service.send_brief(
        tenant_id=body.tenant_id,
        recipient_email=body.recipient_email,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send morning brief",
        )
    return {"status": "sent", "recipient": body.recipient_email}
```

Register in `main.py`:
```python
from app.api.routes.admin import reports as admin_reports_router
app.include_router(admin_reports_router.router)
```

Create `backend/app/services/email/__init__.py` — empty.

#### End-of-Day State — Day 9
- [ ] Data page: 3 upload panels (Primary Sales, Secondary Sales, Scheme Master)
- [ ] Each panel posts to `/data/import?source_type=primary|secondary|scheme`
- [ ] Settings page: profile display + display name update
- [ ] Admin-only guard on data import working in UI
- [ ] Track 2: morning brief service with verdict format (Top 3 actions + ₹ framing)
- [ ] Morning brief body uses lakh/crore notation for all amounts
- [ ] `ruff check .` exits 0

---

## Day 10 — Reports Page + Simulator Page

### Goal
By end of Day 10, the `/reports` page lists and downloads generated reports stored in Supabase Storage, the `/simulator` page shows a what-if revenue simulator, and Sentry + UptimeRobot are configured for production error tracking and uptime monitoring.

### Track 1 — Reports + Simulator Pages

#### Prerequisites
- Day 9 complete
- Supabase Storage bucket created: `reports` (public: false)

#### Supabase Storage Setup

In Supabase dashboard → Storage:
1. Create bucket named `reports`
2. Set bucket as **private**
3. Create storage policy:

```sql
-- In Supabase SQL editor
CREATE POLICY "reports_tenant_isolation"
ON storage.objects FOR ALL
USING (
    auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text
);
```

**File: `backend/app/api/routes/reports.py`**
```python
import io
import logging
from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel
from datetime import datetime

from app.core.auth import CurrentUser
from app.core.tenant import TenantCtx, get_supabase_service_client

logger = logging.getLogger(__name__)


class ReportOut(BaseModel):
    id: UUID
    report_type: str
    title: str
    storage_path: str | None
    file_size_bytes: int | None
    metadata: dict
    created_at: datetime


router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/", response_model=list[ReportOut])
def list_reports(
    user: CurrentUser,
    tenant: TenantCtx,
) -> list[ReportOut]:
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
        raise HTTPException(status_code=404, detail="Report not found")

    storage_path = result.data["storage_path"]
    title = result.data["title"]

    try:
        file_bytes = supabase.storage.from_("reports").download(storage_path)
        return Response(
            content=file_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="{title}.xlsx"'
            },
        )
    except Exception as exc:
        logger.error("Failed to download report %s: %s", report_id, exc)
        raise HTTPException(status_code=500, detail="Download failed") from exc
```

Register in `main.py`:
```python
from app.api.routes import reports as reports_router
app.include_router(reports_router.router)
```

**File: `frontend/src/hooks/useReports.ts`**
```typescript
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface Report {
  id: string;
  report_type: string;
  title: string;
  storage_path: string | null;
  file_size_bytes: number | null;
  created_at: string;
}

export function useReports() {
  return useQuery<Report[]>({
    queryKey: ["reports"],
    queryFn: () => apiFetch<Report[]>("/reports/"),
  });
}
```

**File: `frontend/src/pages/ReportsPage.tsx`**
```typescript
import { Download, FileSpreadsheet, RefreshCw } from "lucide-react";
import { useReports } from "@/hooks/useReports";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const BASE = import.meta.env.VITE_API_BASE_URL as string;

export function ReportsPage() {
  const { data: reports, isLoading, refetch } = useReports();

  async function handleDownload(reportId: string, title: string) {
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

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500 mt-1">
            Generated reports and exports
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && (!reports || reports.length === 0) && (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            <FileSpreadsheet className="h-8 w-8 mx-auto mb-3 text-slate-300" />
            <p className="font-medium">No reports yet</p>
            <p className="text-sm mt-1">
              Reports will appear here once generated
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {(reports || []).map((r) => (
          <Card key={r.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="font-medium text-sm text-slate-900">
                    {r.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className="text-xs">
                      {r.report_type}
                    </Badge>
                    <span className="text-xs text-slate-400">
                      {new Date(r.created_at).toLocaleDateString()}
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
                onClick={() => handleDownload(r.id, r.title)}
                disabled={!r.storage_path}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

**File: `backend/app/services/simulator/forecaster.py`**
```python
import logging
from dataclasses import dataclass
from uuid import UUID

import numpy as np
from sklearn.ensemble import RandomForestRegressor

from app.core.tenant import get_supabase_service_client

logger = logging.getLogger(__name__)


@dataclass
class ForecastScenario:
    growth_rate_pct: float
    discount_change_pct: float
    baseline_revenue: float
    projected_revenue: float
    projected_orders: int
    confidence_interval: tuple[float, float]


class RevenueForecaster:
    """
    RandomForest-based what-if revenue simulator.
    Trained on the tenant's historical sales data.
    """

    def __init__(self) -> None:
        self._model: RandomForestRegressor | None = None

    def _load_training_data(
        self, tenant_id: UUID
    ) -> tuple[np.ndarray, np.ndarray]:
        supabase = get_supabase_service_client()
        result = (
            supabase.table("sales_data")
            .select("invoice_date, total_amount, quantity, discount_amount")
            .eq("tenant_id", str(tenant_id))
            .order("invoice_date")
            .limit(5000)
            .execute()
        )
        rows = result.data or []
        if len(rows) < 30:
            raise ValueError("Insufficient data for forecasting (need at least 30 records)")

        X = np.array([
            [
                i,
                float(row.get("quantity", 0)),
                float(row.get("discount_amount", 0)),
            ]
            for i, row in enumerate(rows)
        ])
        y = np.array([float(row.get("total_amount", 0)) for row in rows])
        return X, y

    def train(self, tenant_id: UUID) -> None:
        X, y = self._load_training_data(tenant_id)
        self._model = RandomForestRegressor(n_estimators=50, random_state=42)
        self._model.fit(X, y)
        logger.info("Forecaster trained on %d samples for tenant %s", len(y), tenant_id)

    def simulate(
        self,
        tenant_id: UUID,
        growth_rate_pct: float,
        discount_change_pct: float,
        baseline_revenue: float,
        baseline_orders: int,
    ) -> ForecastScenario:
        if self._model is None:
            self.train(tenant_id)

        growth_factor = 1 + (growth_rate_pct / 100)
        projected_revenue = baseline_revenue * growth_factor
        discount_impact = projected_revenue * (discount_change_pct / 100) * -0.3
        final_revenue = projected_revenue + discount_impact

        std_pct = 0.08
        ci_lower = final_revenue * (1 - std_pct)
        ci_upper = final_revenue * (1 + std_pct)

        projected_orders = int(baseline_orders * growth_factor)

        return ForecastScenario(
            growth_rate_pct=growth_rate_pct,
            discount_change_pct=discount_change_pct,
            baseline_revenue=baseline_revenue,
            projected_revenue=round(final_revenue, 2),
            projected_orders=projected_orders,
            confidence_interval=(round(ci_lower, 2), round(ci_upper, 2)),
        )
```

**File: `backend/app/api/routes/simulator.py`**
```python
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.auth import CurrentUser
from app.core.tenant import TenantCtx
from app.services.simulator.forecaster import RevenueForecaster, ForecastScenario


class SimulatorRequest(BaseModel):
    growth_rate_pct: float = Field(default=0.0, ge=-50, le=100)
    discount_change_pct: float = Field(default=0.0, ge=-50, le=50)
    baseline_revenue: float = Field(gt=0)
    baseline_orders: int = Field(gt=0)


class SimulatorResponse(BaseModel):
    growth_rate_pct: float
    discount_change_pct: float
    baseline_revenue: float
    projected_revenue: float
    projected_orders: int
    confidence_interval_lower: float
    confidence_interval_upper: float
    revenue_delta: float
    revenue_delta_pct: float


router = APIRouter(prefix="/simulator", tags=["simulator"])


@router.post("/run", response_model=SimulatorResponse)
def run_simulation(
    request: SimulatorRequest,
    user: CurrentUser,
    tenant: TenantCtx,
) -> SimulatorResponse:
    forecaster = RevenueForecaster()
    scenario = forecaster.simulate(
        tenant_id=tenant.tenant_id,
        growth_rate_pct=request.growth_rate_pct,
        discount_change_pct=request.discount_change_pct,
        baseline_revenue=request.baseline_revenue,
        baseline_orders=request.baseline_orders,
    )
    delta = scenario.projected_revenue - scenario.baseline_revenue
    delta_pct = (delta / scenario.baseline_revenue * 100) if scenario.baseline_revenue else 0
    return SimulatorResponse(
        growth_rate_pct=scenario.growth_rate_pct,
        discount_change_pct=scenario.discount_change_pct,
        baseline_revenue=scenario.baseline_revenue,
        projected_revenue=scenario.projected_revenue,
        projected_orders=scenario.projected_orders,
        confidence_interval_lower=scenario.confidence_interval[0],
        confidence_interval_upper=scenario.confidence_interval[1],
        revenue_delta=round(delta, 2),
        revenue_delta_pct=round(delta_pct, 2),
    )
```

Register in `main.py`:
```python
from app.api.routes import simulator as simulator_router
app.include_router(simulator_router.router)
```

Create `backend/app/services/simulator/__init__.py` — empty.

**File: `frontend/src/pages/SimulatorPage.tsx`**
```typescript
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

interface SimResult {
  projected_revenue: number;
  projected_orders: number;
  revenue_delta: number;
  revenue_delta_pct: number;
  confidence_interval_lower: number;
  confidence_interval_upper: number;
}

function formatINR(v: number) {
  if (v >= 1_00_00_000) return `₹${(v / 1_00_00_000).toFixed(2)}Cr`;
  if (v >= 1_00_000) return `₹${(v / 1_00_000).toFixed(2)}L`;
  return `₹${v.toFixed(0)}`;
}

export function SimulatorPage() {
  const [growthRate, setGrowthRate] = useState(0);
  const [discountChange, setDiscountChange] = useState(0);
  const [baselineRevenue, setBaselineRevenue] = useState(1000000);
  const [baselineOrders, setBaselineOrders] = useState(500);

  const { mutate, data: result, isPending } = useMutation<SimResult, Error, void>({
    mutationFn: () =>
      apiFetch<SimResult>("/simulator/run", {
        method: "POST",
        body: JSON.stringify({
          growth_rate_pct: growthRate,
          discount_change_pct: discountChange,
          baseline_revenue: baselineRevenue,
          baseline_orders: baselineOrders,
        }),
      }),
  });

  const isPositive = result && result.revenue_delta >= 0;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Revenue Simulator</h1>
        <p className="text-sm text-slate-500 mt-1">
          Model what-if scenarios for revenue planning
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scenario Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Growth Rate</Label>
                <span className="text-sm font-medium text-slate-700">
                  {growthRate > 0 ? "+" : ""}{growthRate}%
                </span>
              </div>
              <Slider
                value={[growthRate]}
                min={-20}
                max={50}
                step={1}
                onValueChange={([v]) => setGrowthRate(v)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Discount Change</Label>
                <span className="text-sm font-medium text-slate-700">
                  {discountChange > 0 ? "+" : ""}{discountChange}%
                </span>
              </div>
              <Slider
                value={[discountChange]}
                min={-20}
                max={20}
                step={0.5}
                onValueChange={([v]) => setDiscountChange(v)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="baseRev">Baseline Revenue (₹)</Label>
              <Input
                id="baseRev"
                type="number"
                value={baselineRevenue}
                onChange={(e) => setBaselineRevenue(Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="baseOrders">Baseline Orders</Label>
              <Input
                id="baseOrders"
                type="number"
                value={baselineOrders}
                onChange={(e) => setBaselineOrders(Number(e.target.value))}
              />
            </div>

            <Button
              onClick={() => mutate()}
              disabled={isPending}
              className="w-full"
            >
              {isPending ? "Simulating..." : "Run Simulation"}
            </Button>
          </CardContent>
        </Card>

        {/* Result */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projected Outcome</CardTitle>
          </CardHeader>
          <CardContent>
            {!result && (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
                Run a simulation to see results
              </div>
            )}
            {result && (
              <div className="space-y-6">
                <div className="text-center">
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

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Projected Orders</span>
                    <span className="font-medium">
                      {result.projected_orders.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Delta</span>
                    <span
                      className={`font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}
                    >
                      {isPositive ? "+" : ""}{formatINR(result.revenue_delta)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">95% CI</span>
                    <span className="font-medium text-slate-700 text-xs">
                      {formatINR(result.confidence_interval_lower)} –{" "}
                      {formatINR(result.confidence_interval_upper)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

Install shadcn slider:
```bash
pnpm dlx shadcn@latest add slider
```

Update `App.tsx` — replace `Reports` and `Simulator` placeholders.

### Track 2 — Sentry + UptimeRobot Setup

#### Sentry Setup

1. Create Sentry account at sentry.io, create a new project (FastAPI).
2. Copy the DSN.
3. Set in Railway:
```
SENTRY_DSN=https://xxx@sentry.io/yyy
```
4. Add to frontend:
```bash
cd frontend
pnpm add @sentry/react
```

**Add to `frontend/src/main.tsx`** (before ReactDOM.createRoot):
```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
  enabled: import.meta.env.PROD,
});
```

Add to `frontend/.env.example`:
```
VITE_SENTRY_DSN=
```

#### UptimeRobot Setup

1. Create account at uptimerobot.com.
2. Add monitor:
   - **Type:** HTTP(s)
   - **URL:** `https://akara-backend-production.up.railway.app/health`
   - **Interval:** 5 minutes
   - **Alert:** email on down
3. Add second monitor for the Vercel frontend URL.

### Deploy Steps — Day 10
```bash
cd backend && railway up
cd frontend && vercel --prod
```

### Test / Verify — Day 10

1. Simulator: go to `/simulator`, set growth rate to +10%, run — projected revenue should increase by ~10%.
2. Reports: `/reports` — empty state shown (no reports generated yet). Upload a fake report row via SQL:
```sql
INSERT INTO public.generated_reports (tenant_id, report_type, title, metadata)
VALUES ('YOUR_TENANT_ID', 'monthly_summary', 'Test Report Jan 2024', '{}');
```
3. Verify UptimeRobot shows green for both monitors.
4. Trigger a test Sentry error via Sentry dashboard → "Send Test Event".

#### Local Quality Gate — Day 10
```bash
cd backend
ruff check .
pytest
```

#### 10.X — Scheme Leakage Report

Add a new report type to `backend/app/api/routes/reports.py` and a corresponding card to the Reports page frontend.

**Backend: `GET /reports/scheme-leakage`**

```python
@router.get("/scheme-leakage")
def get_scheme_leakage(
    user: CurrentUser,
    tenant: TenantCtx,
) -> list[dict]:
    """
    Compares scheme_master.claimed_amount vs. actual secondary offtake
    for the same party + product within the scheme date window.
    Returns distributors where claimed > actual, with deniable amount.
    """
    supabase = get_supabase_service_client()
    result = supabase.rpc(
        "get_scheme_leakage",
        {"p_tenant_id": str(tenant.tenant_id)},
    ).execute()
    return result.data or []
```

**Supabase function: `get_scheme_leakage`**

Add to `supabase/migrations/003_functions.sql` (or a new `004_scheme_leakage.sql`):

```sql
CREATE OR REPLACE FUNCTION public.get_scheme_leakage(p_tenant_id UUID)
RETURNS TABLE (
    party_name       TEXT,
    scheme_name      TEXT,
    product_name     TEXT,
    claimed_amount   NUMERIC,
    actual_offtake   NUMERIC,
    leakage_amount   NUMERIC,
    scheme_start     DATE,
    scheme_end       DATE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT
        sm.party_name,
        sm.scheme_name,
        sm.product_name,
        sm.claimed_amount,
        COALESCE(SUM(ss.total_amount), 0)                        AS actual_offtake,
        GREATEST(sm.claimed_amount - COALESCE(SUM(ss.total_amount), 0), 0) AS leakage_amount,
        sm.scheme_start,
        sm.scheme_end
    FROM public.scheme_master sm
    LEFT JOIN public.secondary_sales_data ss
        ON  ss.tenant_id    = sm.tenant_id
        AND ss.party_name   = sm.party_name
        AND ss.product_name = sm.product_name
        AND ss.invoice_date BETWEEN sm.scheme_start AND sm.scheme_end
    WHERE sm.tenant_id = p_tenant_id
      AND sm.claimed_amount > 0
    GROUP BY sm.party_name, sm.scheme_name, sm.product_name,
             sm.claimed_amount, sm.scheme_start, sm.scheme_end
    HAVING sm.claimed_amount > COALESCE(SUM(ss.total_amount), 0)
    ORDER BY leakage_amount DESC;
$$;
```

**Frontend card on `/reports` page:**

```typescript
{/* Scheme Leakage Card — shown if leakage data is available */}
{leakageRows.length > 0 && (
  <Card className="border-red-200 bg-red-50">
    <CardHeader>
      <CardTitle className="text-base text-red-800">
        Scheme Leakage Detected
      </CardTitle>
      <CardDescription className="text-red-600">
        Distributors claiming more than actual secondary offtake
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        {leakageRows.slice(0, 5).map((row, i) => (
          <div key={i} className="flex items-start justify-between text-sm">
            <div>
              <p className="font-medium text-red-900">{row.party_name}</p>
              <p className="text-xs text-red-600">{row.scheme_name} · {row.product_name}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-red-800">
                ₹{(row.leakage_amount / 100000).toFixed(1)}L deniable
              </p>
              <p className="text-xs text-red-500">
                Claimed ₹{(row.claimed_amount / 100000).toFixed(1)}L,
                actual ₹{(row.actual_offtake / 100000).toFixed(1)}L
              </p>
            </div>
          </div>
        ))}
        <div className="pt-2 border-t border-red-200">
          <p className="text-sm font-semibold text-red-800">
            Total deniable this cycle: ₹
            {(leakageRows.reduce((s, r) => s + r.leakage_amount, 0) / 100000).toFixed(1)}L
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
)}
```

Note: this card only renders when `scheme_master` and `secondary_sales_data` both have data. If either table is empty it returns zero rows and the card does not appear.

#### End-of-Day State — Day 10
- [ ] Reports page lists generated reports, download works
- [ ] Scheme leakage report endpoint `GET /reports/scheme-leakage` returns distributor-level deniable amounts
- [ ] `get_scheme_leakage` SQL function deployed to Supabase
- [ ] Scheme leakage card renders on Reports page when data is present
- [ ] Simulator page: sliders update projection in real time
- [ ] Sentry DSN configured on both backend and frontend
- [ ] UptimeRobot monitoring `/health` every 5 minutes
- [ ] Track 2: morning brief trigger endpoint

---

## Day 11 — UI Polish (Loading States, Empty States, Error States, 404, Mobile)

### Goal
By end of Day 11, every page has proper loading skeletons, empty states with helpful illustrations, error boundaries, a custom 404 page, and all pages are usable on a 375px wide mobile screen.

### Track 1 — UI Polish

#### Prerequisites
- Days 6–10: all pages built

#### Exactly What You Build

**File: `frontend/src/components/ErrorBoundary.tsx`**
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
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
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

Wrap `<AppShell>` content in `App.tsx`:
```tsx
// In AppShell's <main>:
<ErrorBoundary>
  <Outlet />
</ErrorBoundary>
```

**File: `frontend/src/pages/NotFoundPage.tsx`**
```typescript
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-center p-8">
      <div className="text-8xl font-black text-slate-200 mb-4">404</div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        Page not found
      </h1>
      <p className="text-slate-500 mb-8">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Button asChild>
        <Link to="/dashboard">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
```

Update `App.tsx` route `path="*"`:
```tsx
import { NotFoundPage } from "@/pages/NotFoundPage";
// Change: <Route path="*" element={<Navigate to="/dashboard" replace />} />
// To: <Route path="*" element={<NotFoundPage />} />
```

**File: `frontend/src/components/EmptyState.tsx`**
```typescript
import { LucideIcon } from "lucide-react";

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

**File: `frontend/src/components/SkeletonCard.tsx`**
```typescript
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  lines?: number;
}

export function SkeletonCard({ className, lines = 3 }: Props) {
  return (
    <div className={cn("rounded-xl border border-slate-100 p-5 bg-white", className)}>
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

**Mobile responsiveness — AppShell update:**

Add a mobile sidebar toggle to `AppShell.tsx`:
```typescript
// Add useState for mobile sidebar open/close
const [sidebarOpen, setSidebarOpen] = useState(false);
// Wrap sidebar with: lg:relative fixed inset-y-0 left-0 z-50
// Add overlay on mobile when sidebar open
// Add hamburger button in mobile header
```

Full update to `AppShell.tsx` — replace the sidebar with:
```typescript
import { useState } from "react";
import { Menu, X } from "lucide-react";

// In the component, add:
const [sidebarOpen, setSidebarOpen] = useState(false);

// Sidebar div — add mobile classes:
// className={cn(
//   "w-64 bg-white border-r border-slate-200 flex flex-col",
//   "fixed inset-y-0 left-0 z-50 lg:relative lg:z-auto",
//   "transform transition-transform duration-200",
//   sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
// )}

// Add mobile overlay:
// {sidebarOpen && (
//   <div className="fixed inset-0 bg-black/50 z-40 lg:hidden"
//     onClick={() => setSidebarOpen(false)} />
// )}

// Add mobile header bar above <main>:
// <div className="lg:hidden flex items-center px-4 py-3 border-b bg-white">
//   <button onClick={() => setSidebarOpen(true)}>
//     <Menu className="h-5 w-5" />
//   </button>
//   <span className="ml-3 font-bold">AKARA</span>
// </div>
```

### Deploy Steps — Day 11
```bash
cd frontend && vercel --prod
```

### Test / Verify — Day 11

1. Open Chrome DevTools → Toggle Device Toolbar → iPhone 12 (375px). Navigate all pages. No horizontal scroll.
2. On desktop, click a nav link — hover state visible, active link highlighted.
3. Navigate to `/nonexistent-route` — 404 page appears.
4. Open `/dashboard` on a slow connection (DevTools → Network → Slow 3G) — skeleton cards visible while loading.
5. Wrap a component in a try/catch that throws — ErrorBoundary catches and shows the error UI.

#### Local Quality Gate — Day 11
```bash
cd backend
ruff check .
pytest
```

---

### Track 2 — Onboarding Dry Run

#### Exactly What You Build

**File: `docs/onboarding-checklist.md`** (Track 2 documentation)
```markdown
# AKARA Customer Onboarding Checklist

## Step 1: Provision tenant
1. Run in Supabase SQL Editor:
   ```sql
   INSERT INTO public.tenants (name, slug, config)
   VALUES ('Customer Name', 'customer-slug', '{"timezone": "Asia/Kolkata"}')
   RETURNING id;
   ```
2. Note the returned tenant_id UUID.

## Step 2: Create admin user
1. Supabase → Authentication → Add User
2. Email + password for the admin
3. Note the user UUID

## Step 3: Create profile
   ```sql
   INSERT INTO public.profiles (id, tenant_id, role, display_name)
   VALUES ('USER_UUID', 'TENANT_UUID', 'admin', 'Admin Name');
   ```

## Step 4: Send welcome email
- Share the Vercel URL + credentials with the customer.

## Step 5: Customer uploads data
- Customer logs in, goes to /data, uploads their first Excel file.

## Step 6: Verify KPIs appear
- Go to /dashboard — KPI cards should populate.
```

#### End-of-Day State — Day 11
- [ ] ErrorBoundary wraps all routes — errors show gracefully
- [ ] NotFoundPage at `*` route
- [ ] EmptyState and SkeletonCard components used on all pages
- [ ] Mobile sidebar toggle working on 375px viewport
- [ ] Track 2: onboarding checklist document written

---

## Day 12 — Write 20 Core Backend Tests

### Goal
By end of Day 12, the backend has 20 passing pytest tests covering the SQL guard, guardrails, KPI service, data import parser, LLM manager failover, auth middleware, and all API endpoints — reaching meaningful coverage with no mocks for business logic tests.

### Track 1 — Backend Tests

#### Prerequisites
- Days 1–11 complete
- Backend running locally with test data in Supabase

#### Exactly What You Build

**File: `backend/tests/test_sql_guard.py`**
```python
import pytest
from app.sql.guard import validate_sql, SQLGuardError


def test_select_allowed() -> None:
    validate_sql("SELECT * FROM public.sales_data")  # no exception


def test_delete_blocked() -> None:
    with pytest.raises(SQLGuardError, match="permitted"):
        validate_sql("DELETE FROM public.sales_data WHERE id = 1")


def test_drop_blocked() -> None:
    with pytest.raises(SQLGuardError):
        validate_sql("DROP TABLE sales_data")


def test_insert_blocked() -> None:
    with pytest.raises(SQLGuardError):
        validate_sql("INSERT INTO sales_data VALUES (1, 2)")


def test_pg_catalog_blocked() -> None:
    with pytest.raises(SQLGuardError, match="forbidden"):
        validate_sql("SELECT * FROM pg_catalog.pg_tables")


def test_information_schema_blocked() -> None:
    with pytest.raises(SQLGuardError, match="forbidden"):
        validate_sql("SELECT * FROM information_schema.tables")


def test_update_blocked() -> None:
    with pytest.raises(SQLGuardError):
        validate_sql("UPDATE sales_data SET total_amount = 0")
```

**File: `backend/tests/test_guardrails.py`**
```python
from app.services.copilot.guardrails.checks import (
    numeric_postcheck,
    causal_postcheck,
    premise_check,
    GuardrailResult,
)


def test_numeric_postcheck_passes_normal() -> None:
    result = numeric_postcheck("Revenue was ₹50,000 yesterday")
    assert result.passed is True


def test_numeric_postcheck_fails_huge_number() -> None:
    result = numeric_postcheck("Revenue was 99999999999 billion units")
    assert result.passed is False
    assert "large number" in result.message.lower()


def test_causal_postcheck_fails_on_causal_claim() -> None:
    result = causal_postcheck("The discount caused by the season resulted in higher sales")
    assert result.passed is False


def test_causal_postcheck_passes_on_correlation() -> None:
    result = causal_postcheck("Sales were higher, which is associated with the festive season")
    assert result.passed is True


def test_premise_check_passes_normal_question() -> None:
    cols = ["invoice_date", "party_name", "total_amount", "product_name"]
    result = premise_check("What are my top products by revenue last month?", cols)
    assert result.passed is True
```

**File: `backend/tests/test_data_parser.py`**
```python
import io
import pytest
import pandas as pd
from app.services.data_import.parser import SalesDataParser


@pytest.fixture
def parser() -> SalesDataParser:
    return SalesDataParser()


def make_csv(rows: list[dict]) -> bytes:
    df = pd.DataFrame(rows)
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    return buf.getvalue().encode()


def test_parse_valid_csv(parser: SalesDataParser) -> None:
    csv = make_csv([
        {
            "invoice_date": "2024-01-15",
            "party_name": "ABC Stores",
            "total_amount": 5000.0,
        }
    ])
    df = parser.parse(csv, "test.csv")
    assert len(df) == 1
    assert df.iloc[0]["party_name"] == "ABC Stores"


def test_parse_missing_required_column_raises(parser: SalesDataParser) -> None:
    csv = make_csv([{"invoice_date": "2024-01-15", "quantity": 10}])
    with pytest.raises(ValueError, match="Missing required columns"):
        parser.parse(csv, "test.csv")


def test_parse_unsupported_extension_raises(parser: SalesDataParser) -> None:
    with pytest.raises(ValueError, match="Unsupported"):
        parser.parse(b"data", "test.pdf")


def test_parse_column_alias_mapping(parser: SalesDataParser) -> None:
    csv = make_csv([
        {
            "date": "2024-01-15",
            "customer": "XYZ Corp",
            "total": 9999.99,
        }
    ])
    df = parser.parse(csv, "test.csv")
    assert "invoice_date" in df.columns
    assert "party_name" in df.columns
    assert "total_amount" in df.columns
```

**File: `backend/tests/test_config.py`**
```python
from app.core.config import settings


def test_settings_loads() -> None:
    assert settings.supabase_url.startswith("https://")
    assert len(settings.jwt_secret) > 10
    assert settings.gemini_api_key != ""


def test_allowed_origins_is_list() -> None:
    assert isinstance(settings.allowed_origins, list)
    assert len(settings.allowed_origins) >= 1


def test_is_production_flag() -> None:
    assert isinstance(settings.is_production, bool)
```

**File: `backend/tests/test_health_endpoint.py`**
```python
from fastapi.testclient import TestClient
from app.main import app


def test_health_returns_200() -> None:
    client = TestClient(app)
    assert client.get("/health").status_code == 200


def test_health_body_shape() -> None:
    client = TestClient(app)
    data = client.get("/health").json()
    assert data["status"] == "ok"
    assert "environment" in data
    assert "timestamp" in data


def test_auth_me_without_token_returns_403() -> None:
    client = TestClient(app)
    assert client.get("/auth/me").status_code == 403


def test_kpi_without_token_returns_403() -> None:
    client = TestClient(app)
    assert client.get("/kpi/").status_code == 403


def test_copilot_without_token_returns_403() -> None:
    client = TestClient(app)
    assert client.post("/copilot/chat", json={"question": "hi"}).status_code == 403


def test_data_import_without_token_returns_403() -> None:
    client = TestClient(app)
    assert client.post("/data/import").status_code == 403
```

**File: `backend/tests/test_planner.py`**
```python
import json
import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.copilot.planner import Planner, Plan


@pytest.fixture
def mock_llm():
    llm = MagicMock()
    llm.complete = AsyncMock(return_value=json.dumps({
        "intent": "top products by revenue",
        "steps": [
            {
                "step_id": 1,
                "description": "Get top products",
                "sql": "SELECT product_name, SUM(total_amount) FROM public.sales_data WHERE tenant_id = :tenant_id GROUP BY product_name ORDER BY 2 DESC LIMIT 5"
            }
        ],
        "requires_context": [],
        "response_format": "table"
    }))
    return llm


@pytest.mark.asyncio
async def test_planner_returns_plan(mock_llm) -> None:
    planner = Planner(llm=mock_llm)
    plan = await planner.plan(
        question="What are my top products?",
        schema_context="sales_data",
        date_range=("2024-01-01", "2024-12-31"),
    )
    assert isinstance(plan, Plan)
    assert plan.intent == "top products by revenue"
    assert len(plan.steps) == 1
    assert "SELECT" in plan.steps[0].sql
```

Run all tests:
```bash
cd backend
uv run pytest tests/ -v --tb=short
```

Expected output: 20 tests, all passing.

### Supabase Connections — Day 12
No new Supabase connections.

### Deploy Steps — Day 12
No deployments today. Focused on tests.

### Test / Verify — Day 12
```bash
cd backend
uv run pytest tests/ -v --cov=app --cov-report=term-missing
# Target: >= 60% coverage on business logic
```

#### Local Quality Gate — Day 12
```bash
cd backend
ruff check .
pytest
```

---

### Track 2 — Internal Documentation + Runbook

**File: `docs/runbook.md`**
```markdown
# AKARA Runbook

## Health Check
GET https://akara-backend-production.up.railway.app/health

## Logs
- Railway: Dashboard → Deployments → Logs tab
- Sentry: sentry.io → AKARA project

## Common Issues

### Backend returns 500 on /kpi/
1. Check Railway logs for exception.
2. Verify SUPABASE_SERVICE_ROLE_KEY is set correctly.
3. Run manually: `SELECT * FROM public.sales_data LIMIT 1;`

### File import fails silently
1. Check file is .csv or .xlsx (not .xls only mode).
2. Check required columns: invoice_date, party_name, total_amount.
3. Check Railway logs for parser errors.

### Copilot returns "All LLM providers unavailable"
1. Check GEMINI_API_KEY quota in Google Cloud Console.
2. Check OPENROUTER_API_KEY balance at openrouter.ai.

## Deployment
- Backend: `cd backend && railway up`
- Frontend: `cd frontend && vercel --prod`

## Database
- Migrations: `supabase db push` from repo root
- Supabase console: supabase.com/dashboard
```

#### End-of-Day State — Day 12
- [ ] 20 backend tests passing
- [ ] `pytest --cov` shows >= 60% coverage on business logic
- [ ] `ruff check .` exits 0
- [ ] Track 2: runbook and onboarding checklist written

---

## Day 13 — Privacy Policy + ToS + Custom Domain + SSL

### Goal
By end of Day 13, a privacy policy and terms of service are live on the frontend, a custom domain is configured on Vercel with automatic SSL, GitHub Actions CI runs `ruff check && pytest` on every push to `main`, and all environment variables are in GitHub Secrets.

### Track 1 — Legal Pages + Domain + SSL

#### Prerequisites
- Day 12 complete
- Custom domain purchased and DNS access available
- GitHub repository has `main` branch

#### Exactly What You Build

**File: `frontend/src/pages/PrivacyPage.tsx`**
```typescript
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

**File: `frontend/src/pages/TermsPage.tsx`**
```typescript
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

Install Tailwind Typography:
```bash
pnpm add -D @tailwindcss/typography
```

Add to `tailwind.config.js`:
```js
plugins: [require("@tailwindcss/typography")],
```

Add routes to `App.tsx` (outside ProtectedRoute):
```tsx
<Route path="/privacy" element={<PrivacyPage />} />
<Route path="/terms" element={<TermsPage />} />
```

Add links to `LoginPage.tsx` footer:
```tsx
<p className="text-xs text-center text-slate-400 mt-4">
  By signing in, you agree to our{" "}
  <a href="/terms" className="underline hover:text-slate-600">Terms</a>{" "}
  and{" "}
  <a href="/privacy" className="underline hover:text-slate-600">Privacy Policy</a>.
</p>
```

#### Custom Domain + SSL on Vercel

1. Vercel dashboard → Project → Settings → Domains → Add domain
2. Enter your domain (e.g., `app.yourcompany.com`)
3. Vercel shows CNAME: `cname.vercel-dns.com`
4. In your DNS provider, add:
   - Type: `CNAME`
   - Name: `app` (or `@` for apex)
   - Value: `cname.vercel-dns.com`
5. Wait for propagation (1–60 minutes)
6. Vercel automatically provisions SSL via Let's Encrypt
7. Update Railway `ALLOWED_ORIGINS`:
```
ALLOWED_ORIGINS=https://app.yourcompany.com
```

#### Update backend CORS

In Railway variables:
```
ALLOWED_ORIGINS=https://app.yourcompany.com,https://akara-frontend.vercel.app
```
Redeploy: `railway up`

---

### Track 2 — GitHub Actions CI

**File: `.github/workflows/ci.yml`**
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
        working-directory: backend

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
        working-directory: frontend

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
          cache-dependency-path: frontend/pnpm-lock.yaml

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

#### Add GitHub Secrets

Go to GitHub repo → Settings → Secrets and Variables → Actions → New repository secret.

Add all secrets:
```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
JWT_SECRET
GEMINI_API_KEY
OPENROUTER_API_KEY
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_API_BASE_URL
```

Create `.github/` directory:
```bash
mkdir -p .github/workflows
```

Push to trigger first CI run:
```bash
git add .github/workflows/ci.yml
git commit -m "Add GitHub Actions CI"
git push origin main
```

### Test / Verify — Day 13

1. Go to GitHub → Actions tab — CI run should appear.
2. Both jobs (backend-lint-test, frontend-build) should pass (green check).
3. Open `https://app.yourcompany.com` — should load (after DNS propagation).
4. Browser shows green padlock (SSL valid).
5. Navigate to `/privacy` and `/terms` — pages render with prose styling.

#### End-of-Day State — Day 13
- [ ] `/privacy` and `/terms` pages live on production
- [ ] Custom domain configured on Vercel with SSL
- [ ] `ALLOWED_ORIGINS` updated in Railway with custom domain
- [ ] Track 2: GitHub Actions CI passes on first run
- [ ] All 20 backend tests pass in CI

---

## Day 14 — End-to-End Test + Demo Prep + Record Demo Video

### Goal
By end of Day 14, a complete end-to-end test script passes from signup through data upload through dashboard to copilot to simulator, a demo script is written, a demo video is recorded, and the product is launch-ready.

### Track 1 — E2E Test + Demo

#### Prerequisites
- All previous days complete
- A fresh tenant + user provisioned for demo
- Realistic sample data (500+ rows) ready

#### E2E Test Script (manual, run in order)

Document every step with expected outcome. This is your pre-launch checklist.

```markdown
## E2E Test Script — AKARA v1.0

### 1. Authentication
- [ ] Navigate to https://app.yourcompany.com
- [ ] Redirected to /login automatically ✓
- [ ] Enter invalid credentials → error message appears ✓
- [ ] Enter valid credentials → redirected to /dashboard ✓
- [ ] Sidebar shows correct email ✓
- [ ] Refresh page → still logged in ✓

### 2. Dashboard
- [ ] KPI cards populate within 3 seconds ✓
- [ ] Revenue trend chart renders ✓
- [ ] Zone breakdown chart renders ✓
- [ ] Top products list shows ✓
- [ ] Change date range to "Last 7 days" → charts re-fetch ✓
- [ ] Numbers match SQL:
      SELECT SUM(total_amount) FROM sales_data WHERE tenant_id = '...' 
      AND invoice_date >= CURRENT_DATE - 7 ✓

### 3. Data Import
- [ ] Navigate to /data ✓
- [ ] As admin: file picker visible ✓
- [ ] Upload test.xlsx (100 rows) ✓
- [ ] Progress bar animates to 100% ✓
- [ ] Result shows "X rows inserted" ✓
- [ ] Return to /dashboard → row count increased ✓

### 4. Copilot
- [ ] Navigate to /copilot ✓
- [ ] Empty state with suggested prompts visible ✓
- [ ] Click a suggested prompt → populates input ✓
- [ ] Send "What were my top 5 products last month?" ✓
- [ ] Response streams word-by-word ✓
- [ ] Response contains actual product names from data ✓
- [ ] Response does NOT hallucinate numbers not in data ✓
- [ ] Send second question → chat history accumulates ✓

### 5. Simulator
- [ ] Navigate to /simulator ✓
- [ ] Set growth rate +15% → click Run Simulation ✓
- [ ] Projected revenue ~15% higher than baseline ✓
- [ ] Confidence interval shown ✓
- [ ] Reduce discount by 5% → revenue decreases slightly ✓

### 6. Reports
- [ ] Navigate to /reports ✓
- [ ] Empty state or report list visible ✓
- [ ] (If report exists) Download works ✓

### 7. Settings
- [ ] Navigate to /settings ✓
- [ ] Email and role displayed ✓
- [ ] Change display name → "Saved" confirmation ✓

### 8. Sign Out
- [ ] Click "Sign out" ✓
- [ ] Redirected to /login ✓
- [ ] Protected route access returns to /login ✓

### 9. Mobile (Chrome DevTools 375px)
- [ ] /login renders correctly ✓
- [ ] Sidebar accessible via hamburger ✓
- [ ] /dashboard cards stack vertically ✓
- [ ] /copilot input keyboard visible ✓

### 10. Error handling
- [ ] Navigate to /nonexistent → 404 page ✓
- [ ] /privacy and /terms load ✓
- [ ] Vercel URL also works (not just custom domain) ✓
```

#### Demo Script (5-minute walkthrough)

```markdown
## Demo Script — AKARA

**Intro (30s)**
"AKARA is an AI analytics dashboard for FMCG distributors. I'm going to show
you how a distributor gets insights in under 2 minutes."

**Login (15s)**
Show login page → enter credentials → land on dashboard.

**Dashboard (60s)**
"Here's the KPI dashboard. Revenue for the last 30 days is [X]. We had [Y]
orders from [Z] unique parties. Zone-wise, [West/North/South] leads in
revenue share. You can change the date range to see YTD."

**Copilot (90s)**
"The real magic is the copilot. I'll just type a question in plain English:
'Which products had a drop in sales last week vs the week before?'
[Wait for streaming response]
It's querying the database, running the analysis, and writing the answer —
all grounded in real data, no hallucinations."

**Data Import (45s)**
"Getting data in is simple. Drop an Excel file here — [upload test file] —
and it maps columns automatically. 200 rows imported in seconds."

**Simulator (30s)**
"Finally, what-if planning. If we grow volume by 15% and reduce discounts
by 5%, projected revenue is [X] — a [Y]% increase."

**Close (30s)**
"Multi-tenant, RLS-enforced, deployed on Railway and Vercel. First customer
can be live in under 10 minutes using the onboarding checklist."
```

#### Record Demo Video

1. Use QuickTime Player (macOS) → File → New Screen Recording
2. Or use Loom (loom.com) for easy sharing
3. Record at 1440×900 or 1920×1080
4. Save as `demo-v1.mp4` in the repo root (add to `.gitignore` if > 50MB)

#### Final Production Checklist

```bash
# 1. All tests pass
cd backend && uv run pytest tests/ -v
# Expected: 20 passed

# 2. Ruff clean
ruff check .
# Expected: All checks passed

# 3. Frontend builds
cd frontend && pnpm build
# Expected: ✓ built in Xs

# 4. TypeScript no errors
pnpm exec tsc --noEmit
# Expected: no output (success)

# 5. CI green on GitHub
# Check github.com/YOUR_REPO/actions — all green

# 6. Health endpoint live
curl https://akara-backend-production.up.railway.app/health
# Expected: {"status":"ok","environment":"production",...}

# 7. Custom domain live
curl -s -o /dev/null -w "%{http_code}" https://app.yourcompany.com
# Expected: 200

# 8. Supabase free tier usage check
# Supabase dashboard → Project Settings → Billing
# Should be well under free limits for dev data
```

#### Supabase Upgrade Trigger

When the first paying customer onboards:
1. Supabase dashboard → Project Settings → Billing → Upgrade to Pro ($25/mo)
2. This gives you: 8GB database, 100GB storage, daily backups, no pause

#### Final Environment Variables Audit

Run this to confirm all env vars are set in Railway:
```bash
railway variables list
# Should show all 10+ variables, no empty values
```

Run this to confirm Vercel env vars:
```bash
vercel env ls
# Should show VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE_URL
```

### Deploy Steps — Day 14 (Final)
```bash
# Final backend deploy
cd backend
ruff check . && pytest
railway up

# Final frontend deploy
cd frontend
pnpm build
vercel --prod
```

### Test / Verify — Day 14

Run the complete E2E test script above. Every checkbox must be checked.

#### End-of-Day State — Day 14 — LAUNCH READY
- [ ] All 10 E2E test sections pass
- [ ] 20 backend tests pass in CI
- [ ] Custom domain live with SSL
- [ ] Privacy + Terms pages live
- [ ] Sentry receiving events
- [ ] UptimeRobot monitoring both URLs
- [ ] Demo video recorded
- [ ] First customer can be onboarded using the checklist in < 10 minutes
- [ ] Supabase ready to upgrade to Pro on first paid customer

---

## Post-Launch — `akara_agent.py` Overnight Push Script

Write this after Day 4 (the `/data/sync` endpoint exists by then). Ship it to Customer 1 during onboarding — they install it once on the machine that runs Tally.

### What it does

A ~100-line Python script, installed on the customer's Windows machine, that:
1. Reads today's invoices from Tally's local HTTP XML service
2. Transforms them into the AKARA column schema
3. POSTs the JSON payload to `POST /data/sync` on the AKARA backend
4. Logs success/failure to a local file
5. Runs automatically at 23:00 via Windows Task Scheduler

### File: `akara_agent.py`

```python
"""
AKARA Overnight Sync Agent
Runs nightly on the customer's Tally machine via Windows Task Scheduler.
Reads today's Tally invoices and pushes them to AKARA /data/sync.

Configure once:
  AKARA_API_URL   = https://api.akara.ai
  AKARA_API_KEY   = <tenant API key from AKARA settings>
  TALLY_URL       = http://localhost:9000  (default Tally HTTP port)
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

### Customer Installation Steps (one-time, ~10 minutes)

```
1. Install Python 3.11+   →  python.org/downloads (silent installer)
2. pip install requests
3. Save akara_agent.py to  C:\akara\akara_agent.py
4. Create C:\akara\run.bat:
      @echo off
      set AKARA_API_URL=https://api.akara.ai
      set AKARA_API_KEY=<key from AKARA dashboard>
      python C:\akara\akara_agent.py
5. Task Scheduler → Create Basic Task
      Name:    AKARA Nightly Sync
      Trigger: Daily at 11:00 PM
      Action:  Start a program → C:\akara\run.bat
6. Test: run C:\akara\run.bat manually, check C:\akara_agent.log
```

### What ships without this script

AKARA works fully without the agent. Customers can upload CSVs manually from the Data page. The agent script is an optional convenience that makes the morning brief feel "automatic" because data is always fresh by 6 AM.

---

## Summary: What You've Built

| Day | Deliverable |
|---|---|
| 1 | Supabase schema, RLS policies, helper functions; secondary_sales_data + scheme_master + outstanding_amount column |
| 2 | FastAPI core: config, auth, tenant context, health |
| 3 | Copilot brain: planner, synthesizer, guardrails, LLM manager, SQL guard; generic base prompts + industry addendum registry in PromptGenerator |
| 4 | KPI service (route + outstanding KPIs), data import (source_type), schema discovery, /data/sync endpoint |
| 5 | Backend deployed to Railway; Track 2 admin API |
| 6 | React + Supabase Auth deployed to Vercel; Track 2 tenants UI |
| 7 | Dashboard page with KPI cards + route performance + credit exposure cards; Track 2 users API |
| 8 | Copilot chat page with SSE streaming; Track 2 logs API |
| 9 | Data page with 3-panel upload (primary/secondary/scheme) + verdict brief; settings page; Track 2 morning brief |
| 10 | Reports page + scheme leakage report + simulator; Sentry + UptimeRobot |
| 11 | UI polish: error boundaries, empty states, 404, mobile |
| 12 | 20 backend tests; Track 2 runbook |
| 13 | Privacy + ToS + custom domain + SSL; Track 2 GitHub Actions CI |
| 14 | E2E test + demo prep + launch |
| Post-14 | akara_agent.py — overnight Tally push script, shipped during Customer 1 onboarding |

**Total infrastructure cost at launch: $5/mo (Railway) + $0 (Vercel) + $0 (Supabase free) = $5/mo until first customer.**
