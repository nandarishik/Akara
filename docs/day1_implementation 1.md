# AKARA — Day 1 Implementation Handoff

**Purpose:** Complete implementation reference for Day 1. Another Cursor instance can recreate the exact state of the repository solely by following this document.

**Scope:** Every file created or modified on Day 1. Database migrations are included for completeness — they must be applied manually in Supabase Dashboard → SQL Editor.

**Execution order:** Follow the files in the order they appear in this document.

---

## Repository Root Structure Created

```
akara/
├── .gitignore                             ← created
├── README.md                              ← created
├── backend/
│   ├── pyproject.toml                     ← created
│   ├── .env.example                       ← created
│   ├── .env                               ← created (copy of .env.example, not committed)
│   ├── app/
│   │   ├── __init__.py                    ← created (empty)
│   │   ├── main.py                        ← created
│   │   ├── api/
│   │   │   ├── __init__.py                ← created (empty)
│   │   │   └── routes/
│   │   │       └── __init__.py            ← created (empty)
│   │   ├── core/
│   │   │   └── __init__.py                ← created (empty)
│   │   ├── services/
│   │   │   ├── __init__.py                ← created (empty)
│   │   │   ├── copilot/
│   │   │   │   ├── __init__.py            ← created (empty)
│   │   │   │   ├── tools/
│   │   │   │   │   └── __init__.py        ← created (empty)
│   │   │   │   └── guardrails/
│   │   │   │       └── __init__.py        ← created (empty)
│   │   │   ├── llm/
│   │   │   │   └── __init__.py            ← created (empty)
│   │   │   ├── kpi/
│   │   │   │   └── __init__.py            ← created (empty)
│   │   │   ├── data_import/
│   │   │   │   └── __init__.py            ← created (empty)
│   │   │   ├── schema/
│   │   │   │   └── __init__.py            ← created (empty)
│   │   │   └── prompts/
│   │   │       └── __init__.py            ← created (empty)
│   │   └── sql/
│   │       └── __init__.py                ← created (empty)
│   └── tests/
│       ├── __init__.py                    ← created (empty)
│       └── conftest.py                    ← created
├── frontend/                              ← scaffolded via: npm create vite@latest frontend -- --template react-ts
│   ├── package.json                       ← modified (deps added)
│   ├── vite.config.ts                     ← modified (tailwind + path alias)
│   ├── tsconfig.app.json                  ← modified (path alias added)
│   ├── tsconfig.json                      ← unchanged (Vite default)
│   ├── tsconfig.node.json                 ← unchanged (Vite default)
│   ├── index.html                         ← unchanged (Vite default, title needs updating Day 2)
│   ├── components.json                    ← created (shadcn/ui config)
│   ├── .env.example                       ← created
│   ├── .env.local                         ← created (copy of .env.example, not committed)
│   └── src/
│       ├── index.css                      ← modified (Tailwind v4 import)
│       ├── main.tsx                       ← unchanged (Vite default)
│       ├── App.tsx                        ← unchanged (Vite default, will be replaced Day 6)
│       ├── App.css                        ← unchanged (Vite default, will be removed Day 6)
│       └── lib/
│           ├── supabase.ts                ← created
│           └── utils.ts                   ← created
└── supabase/
    └── migrations/
        ├── 001_initial_schema.sql         ← created (6 tables: tenants, profiles, sales_data, context_cache, chat_history, audit_log, generated_reports)
        ├── 002_rls_policies.sql           ← created (RLS on all tables)
        ├── 003_functions.sql              ← created (triggers + KPI functions)
        ├── 004_competitive_additions.sql  ← created (secondary_sales_data, scheme_master, outstanding_amount, new SQL functions)
        └── APPLY_INSTRUCTIONS.md          ← created
```

## Schema additions — `004_competitive_additions.sql`

These additions are **not** in `001_initial_schema.sql`. They live in `migrations/004_competitive_additions.sql` and must be applied after migrations 001–003 are already in the database.

**If you are running from scratch:** Apply all four migrations (001 → 002 → 003 → 004) in order.

**If Day 1–6 are already deployed:** Run only `004_competitive_additions.sql` in Supabase Dashboard → SQL Editor.

### 1. `outstanding_amount` column on `sales_data`

```sql
ALTER TABLE public.sales_data
    ADD COLUMN IF NOT EXISTS outstanding_amount NUMERIC(15, 2);
```

Nullable — zero cost if not present in the uploaded CSV. Populated when the Tally export includes outstanding receivables. Powers the credit exposure KPI card (`GET /kpi/`) and enables copilot queries like "which parties have overdue outstanding > 30 days".

### 2. `secondary_sales_data` table

Mirrors `sales_data` without `hsn_code`, `tax_amount`, and `outstanding_amount` (DMS exports don't include these). Has an extra `data_source TEXT` column that records how data arrived (`manual_csv`, `overnight_agent`, `api`). RLS pattern is identical to `sales_data`.

### 3. `scheme_master` table

Stores distributor scheme claims: `scheme_name`, `party_name`, `product_name`, `claimed_amount`, `scheme_start`, `scheme_end`, `discount_pct`. The `get_scheme_leakage()` SQL function joins this table against `secondary_sales_data` to compute deniable amounts.

### 4. New SQL functions

| Function | Purpose |
|---|---|
| `get_route_performance(tenant_id, start, end)` | Route-level revenue + order count for dashboard card |
| `get_outstanding_parties(tenant_id)` | Top parties by outstanding_amount for credit exposure card |
| `get_scheme_leakage(tenant_id)` | Joins scheme_master vs secondary_sales_data → deniable amounts per distributor |

---

# File: akara/.gitignore

**Status:** Created

**Purpose:**
Prevents Python bytecode, virtual environments, Node modules, secrets (`.env`), Supabase temp files, OS artifacts, and IDE files from being committed to git.

**Dependencies:** None

**Implementation:**

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

**Placement:** Root of the monorepo at `akara/.gitignore`.

**Explanation:**
Standard multi-language monorepo gitignore. The `.env` pattern ensures no secrets are ever committed. `supabase/.branches/` and `supabase/.temp/` are Supabase CLI artifacts.

**Related changes:** None

---

# File: akara/README.md

**Status:** Created

**Purpose:**
Top-level documentation for the monorepo. Explains the three directories (`frontend/`, `backend/`, `supabase/`) and provides quickstart commands for each.

**Dependencies:** None

**Implementation:**

```markdown
# AKARA

AI-powered analytics dashboard for FMCG distributors and any business with transactional sales data.

## Monorepo structure

- `frontend/` — React 18 + Vite + TailwindCSS + shadcn/ui (hosted on Vercel)
- `backend/` — FastAPI + Python 3.12 (hosted on Railway)
- `supabase/` — Migrations, seed data, edge functions

## Quick start

### Backend
```bash
cd backend
uv venv
uv sync --extra dev
cp .env.example .env  # fill in your values
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local  # fill in your values
npm run dev
```

### Database
Migrations live in `supabase/migrations/`. Apply via:
```bash
supabase db push
```
or paste each file into Supabase Dashboard → SQL Editor.
```

**Placement:** Root of the monorepo at `akara/README.md`.

**Explanation:**
Developer-facing quickstart. References `uv` for Python (fast package manager) and `npm` for Node. Explains that database is managed via SQL migration files.

**Related changes:** `backend/pyproject.toml`, `frontend/package.json`, `supabase/migrations/`

---

# File: akara/backend/pyproject.toml

**Status:** Created

**Purpose:**
Defines all Python dependencies, development dependencies, ruff linting/formatting configuration, and pytest configuration. Uses `uv` as the package manager. Replaces a traditional `requirements.txt`.

**Dependencies:** Requires Python 3.12+, `uv` installed on the machine.

**Implementation:**

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
    "structlog>=24.1.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.2.0",
    "pytest-asyncio>=0.23.0",
    "pytest-cov>=5.0.0",
    "httpx>=0.27.0",
    "httpx2>=2.7.0",
    "ruff>=0.4.0",
]

[tool.ruff]
line-length = 88
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "W", "I", "UP", "B", "C4", "PIE", "T20", "RET", "SIM"]
ignore = ["E501"]

[tool.ruff.lint.isort]
known-first-party = ["app"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

**Placement:** `akara/backend/pyproject.toml` — root of the `backend/` directory.

**Explanation:**
- `fastapi` + `uvicorn[standard]` — web framework and ASGI server
- `supabase` — official Supabase Python client (database + auth + storage)
- `pydantic` + `pydantic-settings` — data validation and environment variable parsing
- `python-jose[cryptography]` — JWT verification for Supabase auth tokens
- `httpx` — async HTTP client (used by FastAPI test client and external API calls)
- `google-generativeai` — Gemini LLM client
- `openai` — OpenRouter uses OpenAI-compatible API
- `scikit-learn` + `pandas` + `numpy` — RandomForest simulator and data processing
- `python-multipart` — required for FastAPI file uploads (CSV import)
- `sentry-sdk[fastapi]` — error tracking (wired up Day 10)
- `openpyxl` — Excel file parsing for data import
- `structlog` — structured JSON logging
- `httpx2` — fixes a deprecation warning from FastAPI's TestClient
- `ruff` — single tool replacing flake8 + black + isort
- `asyncio_mode = "auto"` — pytest-asyncio runs all async tests automatically
- `known-first-party = ["app"]` — ruff isort treats `app.*` as first-party imports

**Installation command:**
```bash
cd backend
uv venv
uv sync --extra dev
```

**Related changes:** `backend/app/main.py`, `backend/tests/conftest.py`

---

# File: akara/backend/.env.example

**Status:** Created

**Purpose:**
Documents every environment variable the backend requires. Developers copy this to `.env` and fill in real values. The `.env` file is never committed (protected by `.gitignore`).

**Dependencies:** None

**Implementation:**

```env
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

# Email (morning brief)
GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

# External context APIs
WEATHER_API_KEY=your-weatherapi-key
NEWS_API_KEY=your-newsapi-key

# App
ENVIRONMENT=development
LOG_LEVEL=INFO
ALLOWED_ORIGINS=http://localhost:5173

# Sentry (leave empty during development, fill in on Day 10)
SENTRY_DSN=
```

**Placement:** `akara/backend/.env.example`

**Explanation:**
- `SUPABASE_URL` + `SUPABASE_ANON_KEY` — used by API routes that execute as the logged-in user (RLS enforced)
- `SUPABASE_SERVICE_ROLE_KEY` — used by admin routes that bypass RLS (stored server-side only)
- `JWT_SECRET` — Supabase JWT signing secret; used by auth middleware to verify tokens without a network call
- `GEMINI_API_KEY` — primary LLM (Gemini 2.5 Flash)
- `OPENROUTER_API_KEY` — LLM failover (OpenRouter)
- `GMAIL_USER` + `GMAIL_APP_PASSWORD` — Gmail SMTP for morning brief emails
- `WEATHER_API_KEY` + `NEWS_API_KEY` — external context enrichment for the copilot
- `ENVIRONMENT` — controls debug mode, logging verbosity
- `ALLOWED_ORIGINS` — FastAPI CORS whitelist (add Vercel URL on Day 6)
- `SENTRY_DSN` — left empty until Day 10 when Sentry is wired up

**Related changes:** `backend/app/core/config.py` (created Day 2)

---

# File: akara/backend/app/__init__.py

**Status:** Created (empty)

**Purpose:**
Makes `backend/app/` a Python package so that `from app.main import app` works with absolute imports.

**Dependencies:** None

**Implementation:**

```python

```

*(Empty file — no content)*

**Placement:** `akara/backend/app/__init__.py`

**Related changes:** All files under `backend/app/`

---

# File: akara/backend/app/api/__init__.py

**Status:** Created (empty)

**Purpose:** Makes `backend/app/api/` a Python package.

**Dependencies:** None

**Implementation:** *(Empty file)*

**Placement:** `akara/backend/app/api/__init__.py`

---

# File: akara/backend/app/api/routes/__init__.py

**Status:** Created (empty)

**Purpose:** Makes `backend/app/api/routes/` a Python package. Route modules added Days 2–5 will live here.

**Dependencies:** None

**Implementation:** *(Empty file)*

**Placement:** `akara/backend/app/api/routes/__init__.py`

---

# File: akara/backend/app/core/__init__.py

**Status:** Created (empty)

**Purpose:** Makes `backend/app/core/` a Python package. `config.py` and `auth.py` added Day 2 will live here.

**Dependencies:** None

**Implementation:** *(Empty file)*

**Placement:** `akara/backend/app/core/__init__.py`

---

# File: akara/backend/app/services/__init__.py

**Status:** Created (empty)

**Purpose:** Makes `backend/app/services/` a Python package.

**Dependencies:** None

**Implementation:** *(Empty file)*

**Placement:** `akara/backend/app/services/__init__.py`

---

# File: akara/backend/app/services/copilot/__init__.py

**Status:** Created (empty)

**Purpose:** Makes the copilot service directory a Python package. `agent.py`, `planner.py`, `synthesizer.py` added Day 3.

**Dependencies:** None

**Implementation:** *(Empty file)*

**Placement:** `akara/backend/app/services/copilot/__init__.py`

---

# File: akara/backend/app/services/copilot/tools/__init__.py

**Status:** Created (empty)

**Purpose:** Makes the copilot tools directory a Python package. Individual tool files added Day 3.

**Dependencies:** None

**Implementation:** *(Empty file)*

**Placement:** `akara/backend/app/services/copilot/tools/__init__.py`

---

# File: akara/backend/app/services/copilot/guardrails/__init__.py

**Status:** Created (empty)

**Purpose:** Makes the copilot guardrails directory a Python package. Guardrail files ported from `copilot_brain.py` on Day 3.

**Dependencies:** None

**Implementation:** *(Empty file)*

**Placement:** `akara/backend/app/services/copilot/guardrails/__init__.py`

---

# File: akara/backend/app/services/llm/__init__.py

**Status:** Created (empty)

**Purpose:** Makes the LLM service directory a Python package. `manager.py`, `gemini.py`, `openrouter.py` added Day 3.

**Dependencies:** None

**Implementation:** *(Empty file)*

**Placement:** `akara/backend/app/services/llm/__init__.py`

---

# File: akara/backend/app/services/kpi/__init__.py

**Status:** Created (empty)

**Purpose:** Makes the KPI service directory a Python package. KPI query functions added Day 4.

**Dependencies:** None

**Implementation:** *(Empty file)*

**Placement:** `akara/backend/app/services/kpi/__init__.py`

---

# File: akara/backend/app/services/data_import/__init__.py

**Status:** Created (empty)

**Purpose:** Makes the data import service directory a Python package. CSV/Excel parser added Day 4.

**Dependencies:** None

**Implementation:** *(Empty file)*

**Placement:** `akara/backend/app/services/data_import/__init__.py`

---

# File: akara/backend/app/services/schema/__init__.py

**Status:** Created (empty)

**Purpose:** Makes the schema discovery service directory a Python package. `discovery.py` added Day 4.

**Dependencies:** None

**Implementation:** *(Empty file)*

**Placement:** `akara/backend/app/services/schema/__init__.py`

---

# File: akara/backend/app/services/prompts/__init__.py

**Status:** Created (empty)

**Purpose:** Makes the prompts service directory a Python package. `generator.py` added Day 4.

**Dependencies:** None

**Implementation:** *(Empty file)*

**Placement:** `akara/backend/app/services/prompts/__init__.py`

---

# File: akara/backend/app/sql/__init__.py

**Status:** Created (empty)

**Purpose:** Makes the SQL utilities directory a Python package. `guard.py` and `executor.py` added Day 3.

**Dependencies:** None

**Implementation:** *(Empty file)*

**Placement:** `akara/backend/app/sql/__init__.py`

---

# File: akara/backend/tests/__init__.py

**Status:** Created (empty)

**Purpose:** Makes the tests directory a Python package so pytest can discover test files using absolute imports.

**Dependencies:** None

**Implementation:** *(Empty file)*

**Placement:** `akara/backend/tests/__init__.py`

---

# File: akara/backend/app/main.py

**Status:** Created

**Purpose:**
Minimal FastAPI application stub. Provides the `app` object that `conftest.py` imports for testing. Also serves as the entry point for `uvicorn`. A single `/health` endpoint is included so the server can be verified as running. Full middleware, routers, and startup hooks are added Day 2.

**Dependencies:**
- `fastapi` (installed via `pyproject.toml`)

**Implementation:**

```python
from fastapi import FastAPI

app = FastAPI(title="AKARA API", version="0.1.0")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

**Placement:** `akara/backend/app/main.py`

**Explanation:**
- `FastAPI(title=..., version=...)` — creates the application; these values appear in the auto-generated `/docs` UI
- `@app.get("/health")` — simplest possible liveness probe; returns `{"status": "ok"}`
- Return type `dict[str, str]` is a type hint only — FastAPI uses it for OpenAPI schema generation
- This file is intentionally minimal for Day 1. Day 2 adds: CORS middleware, Supabase auth middleware, tenant context middleware, Sentry initialization, and all route includes.

**Related changes:** `backend/tests/conftest.py` imports `app` from this file.

---

# File: akara/backend/tests/conftest.py

**Status:** Created

**Purpose:**
Pytest configuration file. Provides a `client` fixture that wraps the FastAPI app in a `TestClient` for use in all test files. This fixture is available to every test in the `tests/` directory without importing.

**Dependencies:**
- `fastapi` — `TestClient` is from `starlette.testclient` (re-exported by FastAPI)
- `backend/app/main.py` — imports `app`
- `httpx2` — installed to suppress the `StarletteDeprecationWarning` about `httpx` vs `httpx2`

**Implementation:**

```python
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client() -> TestClient:
    from app.main import app

    return TestClient(app)
```

**Placement:** `akara/backend/tests/conftest.py`

**Explanation:**
- The `client` fixture is function-scoped (default) — a fresh `TestClient` is created for each test
- The import of `app` is inside the fixture function body (lazy import) so that if `app.main` fails to import in a specific test environment, only tests using this fixture fail — not the entire test session
- Tests call it as: `def test_health(client): response = client.get("/health")`

**Related changes:** All test files added Days 12–13 use this fixture.

---

# File: akara/frontend/package.json

**Status:** Modified (base generated by Vite, dependencies added)

**Purpose:**
Defines all frontend dependencies and scripts. Base file was generated by `npm create vite@latest frontend -- --template react-ts`. Additional packages were installed with `npm install`.

**Dependencies:** Node 20+, npm

**Implementation:**

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
    "@supabase/supabase-js": "^2.110.8",
    "@tailwindcss/vite": "^4.3.3",
    "@tanstack/react-query": "^5.101.4",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^1.25.0",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "react-router-dom": "^7.18.1",
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

**Placement:** `akara/frontend/package.json` — root of the `frontend/` directory.

**Explanation of added packages:**

Runtime dependencies:
- `@supabase/supabase-js` — Supabase client for Auth, database queries, and storage from the browser
- `@tailwindcss/vite` — Tailwind CSS v4 Vite plugin (v4 no longer uses a config file; this replaces the old PostCSS approach)
- `@tanstack/react-query` — server state management (data fetching, caching, background refresh)
- `class-variance-authority` — shadcn/ui component variant management
- `clsx` — conditional className construction (used in `cn()` utility)
- `lucide-react` — icon library used by shadcn/ui components
- `react-router-dom` — client-side routing (v7)
- `tailwind-merge` — merges Tailwind classes without conflicts (used in `cn()` utility)
- `zustand` — lightweight client state management (auth state, UI state)

Dev dependencies:
- `@types/node` — TypeScript types for Node.js (required for `path.resolve` in `vite.config.ts`)
- `eslint-config-prettier` — disables ESLint rules that conflict with Prettier
- `prettier` — code formatter
- `tailwindcss` — Tailwind CSS v4 (used via the `@tailwindcss/vite` plugin)

**Installation commands used:**
```bash
npm install react-router-dom @supabase/supabase-js @tanstack/react-query zustand
npm install -D tailwindcss postcss autoprefixer eslint prettier eslint-config-prettier
npm install tailwindcss @tailwindcss/vite
npm install lucide-react class-variance-authority clsx tailwind-merge
npm install -D @types/node
```

**Related changes:** `frontend/vite.config.ts`, `frontend/src/index.css`, `frontend/src/lib/supabase.ts`, `frontend/src/lib/utils.ts`

---

# File: akara/frontend/vite.config.ts

**Status:** Modified (base generated by Vite, tailwind plugin and path alias added)

**Purpose:**
Vite build configuration. Two additions from the Vite default:
1. Tailwind CSS v4 plugin registered
2. `@` path alias added so `import Foo from '@/components/Foo'` resolves to `src/components/Foo`

**Dependencies:**
- `vite` — build tool
- `@vitejs/plugin-react` — React Fast Refresh and JSX transform
- `@tailwindcss/vite` — Tailwind v4 Vite integration
- `@types/node` — TypeScript types for `path` module

**Implementation:**

```typescript
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**Placement:** `akara/frontend/vite.config.ts` — root of the `frontend/` directory.

**Explanation:**
- `tailwindcss()` plugin replaces the old PostCSS-based Tailwind setup. With Tailwind v4, no `tailwind.config.js` is needed — configuration is done in CSS via `@import "tailwindcss"`.
- `path.resolve(__dirname, './src')` maps `@` to the `src/` directory. This means `import { supabase } from '@/lib/supabase'` works from any depth in the component tree.
- `__dirname` requires `@types/node` to be available in the TypeScript compilation for `tsconfig.node.json` (which includes `vite.config.ts`).

**Related changes:** `frontend/tsconfig.app.json` (path alias must match), `frontend/src/index.css`

---

# File: akara/frontend/tsconfig.app.json

**Status:** Modified (path alias `baseUrl` and `paths` added)

**Purpose:**
TypeScript configuration for the application source code. Modified to add path alias support so that `@/` prefix resolves correctly during TypeScript type checking.

**Dependencies:** None (pure TypeScript config)

**Implementation:**

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "DOM"],
    "module": "esnext",
    "types": ["vite/client"],
    "allowArbitraryExtensions": true,
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,

    /* Path aliases */
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

**Placement:** `akara/frontend/tsconfig.app.json` — root of the `frontend/` directory.

**Explanation:**
- `"baseUrl": "."` — required for `paths` to work correctly; sets the base for path resolution to the `frontend/` directory
- `"@/*": ["./src/*"]` — maps `@/anything` to `src/anything`. Must match the `resolve.alias` in `vite.config.ts`.
- The diff from the Vite default is only the addition of `"baseUrl"` and `"paths"` at the end of `compilerOptions`.

**Related changes:** `frontend/vite.config.ts` (alias must match)

---

# File: akara/frontend/tsconfig.json

**Status:** Unchanged (Vite default — included for completeness)

**Purpose:** Root TypeScript project references file.

**Implementation:**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

**Placement:** `akara/frontend/tsconfig.json`

---

# File: akara/frontend/tsconfig.node.json

**Status:** Unchanged (Vite default — included for completeness)

**Purpose:** TypeScript config for Vite config files (not application source).

**Implementation:**

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023"],
    "types": ["node"],
    "skipLibCheck": true,

    /* Bundler mode */
    "module": "nodenext",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,

    /* Linting */
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts"]
}
```

**Placement:** `akara/frontend/tsconfig.node.json`

---

# File: akara/frontend/index.html

**Status:** Unchanged (Vite default — included for completeness)

**Purpose:** HTML entry point. Title will be updated to "AKARA" on Day 6 when the React app shell is built.

**Implementation:**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>frontend</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Placement:** `akara/frontend/index.html`

**Note:** The `<title>frontend</title>` tag will be changed to `<title>AKARA</title>` on Day 6.

---

# File: akara/frontend/src/main.tsx

**Status:** Unchanged (Vite default — included for completeness)

**Purpose:** React app entry point. Mounts the `App` component into the `#root` div. Will remain unchanged throughout the project.

**Implementation:**

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

**Placement:** `akara/frontend/src/main.tsx`

---

# File: akara/frontend/src/index.css

**Status:** Modified (replaced Vite default with Tailwind v4 import)

**Purpose:**
Global stylesheet. Tailwind v4 requires a single `@import "tailwindcss"` directive instead of the three v3 directives (`@tailwind base/components/utilities`). This single import activates all Tailwind utilities, components, and base styles.

**Dependencies:**
- `tailwindcss` v4 (in `package.json`)
- `@tailwindcss/vite` plugin (in `vite.config.ts`)

**Implementation:**

```css
@import "tailwindcss";
```

**Placement:** `akara/frontend/src/index.css` — replaces the entire file content.

**Explanation:**
Tailwind v4 changed the configuration model. There is no `tailwind.config.js` or `postcss.config.js` needed. The Vite plugin handles all processing. The `@import "tailwindcss"` directive is the only line needed to activate the full Tailwind utility set. Custom theme tokens will be added later using `@theme {}` blocks in this same file.

**Related changes:** `frontend/vite.config.ts` (plugin must be registered), `frontend/package.json` (tailwindcss must be installed)

---

# File: akara/frontend/src/App.tsx

**Status:** Unchanged (Vite default — will be replaced on Day 6)

**Purpose:** Placeholder app component from Vite scaffold. Will be completely replaced on Day 6 with the React Router setup and app shell.

**Implementation:** *(Vite default boilerplate — see file in repository)*

**Note:** Do not modify this file. It will be fully replaced on Day 6.

---

# File: akara/frontend/src/App.css

**Status:** Unchanged (Vite default — will be removed on Day 6)

**Purpose:** Styles for the Vite placeholder `App.tsx`. Will be deleted on Day 6.

**Note:** Do not modify this file. It will be deleted on Day 6.

---

# File: akara/frontend/src/lib/supabase.ts

**Status:** Created

**Purpose:**
Creates and exports the Supabase browser client. Used by all frontend components that need to interact with Supabase Auth, database queries (via RLS), or storage. Throws at module load time if environment variables are missing — this catches misconfiguration early during development.

**Dependencies:**
- `@supabase/supabase-js` (in `package.json`)
- `VITE_SUPABASE_URL` — must be set in `frontend/.env.local`
- `VITE_SUPABASE_ANON_KEY` — must be set in `frontend/.env.local`

**Implementation:**

```typescript
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env.local"
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

**Placement:** `akara/frontend/src/lib/supabase.ts` — new file, new directory `src/lib/`

**Explanation:**
- `import.meta.env.VITE_*` — Vite exposes env vars prefixed with `VITE_` to the browser bundle. Non-prefixed vars are server-only (not exposed).
- The `as string` cast is safe here because the guard below it will throw if the value is falsy.
- The runtime guard ensures a clear error message instead of a cryptic `null` error deep in the app.
- `createClient(url, anonKey)` — creates a Supabase client using the public anon key. This client respects RLS policies — queries are scoped to the authenticated user's tenant automatically.
- This is the **only** Supabase client instance in the frontend. Import `supabase` from this file everywhere.

**Usage pattern:**
```typescript
import { supabase } from '@/lib/supabase'

// Auth
const { data, error } = await supabase.auth.signInWithPassword({ email, password })

// Database (RLS applies automatically)
const { data } = await supabase.from('chat_history').select('*')
```

**Related changes:**
- `frontend/.env.example` — documents the env vars
- `frontend/src/lib/utils.ts` — sibling utility file
- Day 6: `AuthContext.tsx` will use `supabase.auth.onAuthStateChange()`

---

# File: akara/frontend/src/lib/utils.ts

**Status:** Created

**Purpose:**
Provides the `cn()` utility function required by all shadcn/ui components. Combines `clsx` (conditional class construction) and `tailwind-merge` (conflict resolution) into a single callable.

**Dependencies:**
- `clsx` (in `package.json`)
- `tailwind-merge` (in `package.json`)

**Implementation:**

```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Placement:** `akara/frontend/src/lib/utils.ts` — new file in `src/lib/`

**Explanation:**
- `clsx(inputs)` — accepts any mix of strings, arrays, and objects; returns a single class string. Example: `clsx(['text-red-500', condition && 'font-bold'])` → `"text-red-500 font-bold"` (when condition is true)
- `twMerge(...)` — resolves Tailwind class conflicts. Example: `twMerge('px-4 px-6')` → `"px-6"` (last value wins)
- Together, `cn('text-red-500', isActive && 'text-blue-500')` correctly produces `"text-blue-500"` when `isActive` is true, rather than the broken `"text-red-500 text-blue-500"`.
- This exact `cn()` pattern is the shadcn/ui standard — every shadcn component uses it.

**Usage pattern:**
```typescript
import { cn } from '@/lib/utils'

<div className={cn('base-classes', condition && 'conditional-classes', className)} />
```

**Related changes:** Every shadcn/ui component added in Days 6–11 imports from this file.

---

# File: akara/frontend/components.json

**Status:** Created

**Purpose:**
Configuration file for shadcn/ui. Tells the shadcn CLI where to place components, which style to use, where the CSS file is, what path aliases exist, and which icon library to use. This file is read when running `npx shadcn@latest add <component>`.

**Dependencies:** None (pure JSON config)

**Implementation:**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

**Placement:** `akara/frontend/components.json` — root of the `frontend/` directory.

**Explanation:**
- `"style": "default"` — uses shadcn's default visual style
- `"rsc": false` — not a React Server Components project
- `"tsx": true` — generate `.tsx` files, not `.jsx`
- `"tailwind.config": ""` — empty because Tailwind v4 has no config file
- `"tailwind.css": "src/index.css"` — where Tailwind is imported; shadcn writes CSS variables here
- `"tailwind.baseColor": "slate"` — default color palette
- `"tailwind.cssVariables": true` — use CSS custom properties for theming (enables dark mode)
- `"aliases"` — must match the `paths` in `tsconfig.app.json` and `resolve.alias` in `vite.config.ts`
- `"iconLibrary": "lucide"` — use `lucide-react` icons in generated components

**How to add shadcn components:**
```bash
cd frontend
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add input
```
Components are placed in `src/components/ui/`.

**Related changes:** `frontend/tsconfig.app.json`, `frontend/vite.config.ts`, `frontend/src/lib/utils.ts`

---

# File: akara/frontend/.env.example

**Status:** Created

**Purpose:**
Documents all frontend environment variables. Developers copy to `.env.local`.

**Dependencies:** None

**Implementation:**

```env
# =============================================================
# AKARA Frontend — Environment Variables
# Copy this file to .env.local and fill in your values.
# NEVER commit .env.local to git.
# =============================================================

VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_BASE_URL=http://localhost:8000
```

**Placement:** `akara/frontend/.env.example`

**Explanation:**
- `VITE_SUPABASE_URL` — Supabase project URL (find in Dashboard → Settings → API)
- `VITE_SUPABASE_ANON_KEY` — Public anon key (safe to expose in browser bundle; RLS enforces security)
- `VITE_API_BASE_URL` — FastAPI backend URL. `http://localhost:8000` during development; Railway URL in production (added Day 5)

**Related changes:** `frontend/src/lib/supabase.ts` reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

---

# File: akara/frontend/.gitignore

**Status:** Unchanged (Vite default — included for completeness)

**Purpose:** Frontend-specific gitignore. Ignores `node_modules/`, `dist/`, `dist-ssr/`, `*.local` (including `.env.local`).

**Implementation:**

```gitignore
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
```

**Placement:** `akara/frontend/.gitignore`

---

# File: akara/frontend/.oxlintrc.json

**Status:** Unchanged (Vite default — included for completeness)

**Purpose:** OXLint configuration (Vite's default linter in v8+). Enforces React hooks rules.

**Implementation:**

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

**Placement:** `akara/frontend/.oxlintrc.json`

---

# File: akara/supabase/migrations/001_initial_schema.sql

**Status:** Created

**Purpose:**
Creates all 7 database tables, their indexes, and the `updated_at` auto-trigger. This is the foundational schema that all application features depend on.

**Must be applied first.** Run in Supabase Dashboard → SQL Editor before running migration 002 or 003.

**Dependencies:** Supabase PostgreSQL, `uuid-ossp` extension

**Implementation:**

```sql
-- ============================================================
-- AKARA: Initial Schema
-- Migration 001
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- tenants
-- One row per customer organisation (e.g. one FMCG distributor)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenants (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT        NOT NULL,
    slug        TEXT        NOT NULL UNIQUE,
    config      JSONB       NOT NULL DEFAULT '{}',
    -- config shape:
    -- {
    --   "company_name": "Bajaj Consumer Care",
    --   "industry": "fmcg_distribution",
    --   "primary_table": "sales_data",
    --   "column_mappings": {
    --     "revenue": "total_amount",
    --     "date": "invoice_date",
    --     "customer": "party_name",
    --     "product": "product_name",
    --     "region": "party_zone"
    --   },
    --   "business_terms": { "customer": "distributor party", "region": "zone" }
    -- }
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug      ON public.tenants (slug);
CREATE INDEX IF NOT EXISTS idx_tenants_is_active ON public.tenants (is_active);

-- ============================================================
-- profiles
-- Extends auth.users — created automatically via trigger (migration 003)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id    UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    role         TEXT        NOT NULL CHECK (role IN ('admin', 'user')) DEFAULT 'user',
    display_name TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON public.profiles (tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role      ON public.profiles (role);

-- ============================================================
-- sales_data
-- Core transactional data — one row per invoice line item
-- Migrated from SQLite VIEW_AI_SALES (40,236 rows for Bajaj)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sales_data (
    id               BIGSERIAL   PRIMARY KEY,
    tenant_id        UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    invoice_date     DATE        NOT NULL,
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
    total_amount     NUMERIC(15, 2),
    raw_data         JSONB,
    -- raw_data stores any extra columns not explicitly mapped above
    -- used for non-FMCG tenants with different schemas
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_data_tenant_id    ON public.sales_data (tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_data_invoice_date ON public.sales_data (invoice_date);
CREATE INDEX IF NOT EXISTS idx_sales_data_party_name   ON public.sales_data (party_name);
CREATE INDEX IF NOT EXISTS idx_sales_data_party_zone   ON public.sales_data (party_zone);
CREATE INDEX IF NOT EXISTS idx_sales_data_product_name ON public.sales_data (product_name);
CREATE INDEX IF NOT EXISTS idx_sales_data_tenant_date  ON public.sales_data (tenant_id, invoice_date);
CREATE INDEX IF NOT EXISTS idx_sales_data_tenant_zone  ON public.sales_data (tenant_id, party_zone);

-- ============================================================
-- context_cache
-- Weather, news, holiday data fetched by the copilot
-- ============================================================
CREATE TABLE IF NOT EXISTS public.context_cache (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    context_type  TEXT        NOT NULL CHECK (context_type IN ('weather', 'news', 'holiday')),
    context_date  DATE        NOT NULL,
    content       JSONB       NOT NULL DEFAULT '{}',
    source        TEXT,
    expires_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, context_type, context_date)
);

CREATE INDEX IF NOT EXISTS idx_context_cache_tenant_id  ON public.context_cache (tenant_id);
CREATE INDEX IF NOT EXISTS idx_context_cache_expires_at ON public.context_cache (expires_at);

-- ============================================================
-- chat_history
-- Persisted copilot Q&A — previously only in session state
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_history (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id  UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question   TEXT        NOT NULL,
    response   TEXT,
    metadata   JSONB       NOT NULL DEFAULT '{}',
    -- metadata shape:
    -- {
    --   "intent": "revenue_query",
    --   "sql_queries_run": ["SELECT ..."],
    --   "llm_model": "gemini-2.5-flash",
    --   "tokens_used": {"input": 1200, "output": 340},
    --   "guardrail_results": {"premise": "pass", "numeric": "pass"},
    --   "response_time_ms": 3421
    -- }
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_history_tenant_id  ON public.chat_history (tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id    ON public.chat_history (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON public.chat_history (created_at DESC);

-- ============================================================
-- audit_log
-- All significant user and system actions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID        REFERENCES public.tenants(id) ON DELETE SET NULL,
    user_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    action        TEXT        NOT NULL,
    resource_type TEXT,
    resource_id   TEXT,
    details       JSONB       NOT NULL DEFAULT '{}',
    ip_address    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_id  ON public.audit_log (tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id    ON public.audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action     ON public.audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log (created_at DESC);

-- ============================================================
-- generated_reports
-- Metadata for reports stored in Supabase Storage
-- ============================================================
CREATE TABLE IF NOT EXISTS public.generated_reports (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id        UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    report_type      TEXT        NOT NULL,
    -- report_type: 'morning_brief' | 'export_csv' | 'anomaly_report'
    title            TEXT        NOT NULL,
    storage_path     TEXT,
    file_size_bytes  BIGINT,
    metadata         JSONB       NOT NULL DEFAULT '{}',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_reports_tenant_id   ON public.generated_reports (tenant_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_report_type ON public.generated_reports (report_type);
CREATE INDEX IF NOT EXISTS idx_generated_reports_created_at  ON public.generated_reports (created_at DESC);

-- ============================================================
-- Trigger helper: auto-update updated_at on tenants
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenants_updated_at ON public.tenants;
CREATE TRIGGER tenants_updated_at
    BEFORE UPDATE ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

**Placement:** `akara/supabase/migrations/001_initial_schema.sql`

**Explanation:**
- `tenants.config JSONB` — industry-agnostic configuration. Each tenant stores their column mappings, business terminology, and display settings here. This is what makes the copilot work for any industry, not just FMCG.
- `profiles` references `auth.users(id)` — Supabase creates `auth.users` automatically. Our `profiles` table extends it with `tenant_id` and `role`.
- `sales_data.raw_data JSONB` — overflow column for tenants whose CSVs have columns not in the explicit schema. Any extra column from a CSV import is stored here.
- `chat_history.metadata JSONB` — stores copilot execution metadata for debugging and analytics without requiring schema changes.
- Indexes on `(tenant_id, invoice_date)` — the most common query pattern is filtering by tenant AND date range. Compound index covers both filters.
- `set_updated_at()` trigger — automatically updates `tenants.updated_at` on every UPDATE without application code needing to set it.

**Related changes:** `002_rls_policies.sql`, `003_functions.sql` — must run after this.

---

# File: akara/supabase/migrations/002_rls_policies.sql

**Status:** Created

**Purpose:**
Enables Row Level Security on all 7 tables and creates all access policies. This is the security foundation — without these policies, any authenticated user could read any tenant's data.

**Must be applied second.** Run after `001_initial_schema.sql`.

**Dependencies:** `001_initial_schema.sql` must be applied first

**Implementation:**

```sql
-- ============================================================
-- AKARA: Row Level Security Policies
-- Migration 002
-- Run AFTER migration 001
-- ============================================================

-- ============================================================
-- Helper: get tenant_id for the current authenticated user
-- SECURITY DEFINER runs as the function owner (postgres),
-- bypassing RLS on profiles so it can always resolve tenant_id.
-- STABLE = result is constant within a single query execution.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT tenant_id
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
$$;

-- ============================================================
-- Helper: is the current user an admin of their tenant?
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'admin'
    );
$$;

-- ============================================================
-- tenants
-- Users can only see/update their own tenant.
-- No INSERT via client — tenants are created by platform admin only.
-- ============================================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenants_select_own"        ON public.tenants;
DROP POLICY IF EXISTS "tenants_update_own_admin"  ON public.tenants;

CREATE POLICY "tenants_select_own"
    ON public.tenants FOR SELECT
    USING (id = public.get_my_tenant_id());

CREATE POLICY "tenants_update_own_admin"
    ON public.tenants FOR UPDATE
    USING (id = public.get_my_tenant_id() AND public.is_admin());

-- ============================================================
-- profiles
-- Users see their own profile.
-- Admins see all profiles within their tenant.
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own"    ON public.profiles;

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
-- sales_data
-- All users within a tenant can SELECT their tenant's data.
-- Only admins can INSERT or DELETE (data import is admin-only).
-- No UPDATE — imported data is immutable; re-import if needed.
-- ============================================================
ALTER TABLE public.sales_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_data_select"       ON public.sales_data;
DROP POLICY IF EXISTS "sales_data_insert_admin" ON public.sales_data;
DROP POLICY IF EXISTS "sales_data_delete_admin" ON public.sales_data;

CREATE POLICY "sales_data_select"
    ON public.sales_data FOR SELECT
    USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "sales_data_insert_admin"
    ON public.sales_data FOR INSERT
    WITH CHECK (tenant_id = public.get_my_tenant_id() AND public.is_admin());

CREATE POLICY "sales_data_delete_admin"
    ON public.sales_data FOR DELETE
    USING (tenant_id = public.get_my_tenant_id() AND public.is_admin());

-- ============================================================
-- context_cache
-- All authenticated users in the tenant can read/write context cache.
-- ============================================================
ALTER TABLE public.context_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "context_cache_tenant_isolation" ON public.context_cache;

CREATE POLICY "context_cache_tenant_isolation"
    ON public.context_cache FOR ALL
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

-- ============================================================
-- chat_history
-- Users see their own chat history.
-- Admins see all chat history within their tenant.
-- Users can insert their own messages only.
-- ============================================================
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_history_select"     ON public.chat_history;
DROP POLICY IF EXISTS "chat_history_insert_own" ON public.chat_history;

CREATE POLICY "chat_history_select"
    ON public.chat_history FOR SELECT
    USING (
        user_id = auth.uid()
        OR (tenant_id = public.get_my_tenant_id() AND public.is_admin())
    );

CREATE POLICY "chat_history_insert_own"
    ON public.chat_history FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND tenant_id = public.get_my_tenant_id()
    );

-- ============================================================
-- audit_log
-- Admins can read their tenant's audit log.
-- Inserts are done server-side with service_role key only.
-- ============================================================
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_admin_select" ON public.audit_log;

CREATE POLICY "audit_log_admin_select"
    ON public.audit_log FOR SELECT
    USING (tenant_id = public.get_my_tenant_id() AND public.is_admin());

-- ============================================================
-- generated_reports
-- All users in the tenant can view reports.
-- Insert/delete done server-side with service_role key.
-- ============================================================
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "generated_reports_tenant_isolation" ON public.generated_reports;

CREATE POLICY "generated_reports_tenant_isolation"
    ON public.generated_reports FOR ALL
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());
```

**Placement:** `akara/supabase/migrations/002_rls_policies.sql`

**Explanation:**
- `get_my_tenant_id()` — called by every policy. Uses `SECURITY DEFINER` so it runs as postgres and can read `profiles` even though `profiles` itself has RLS. `STABLE` tells Postgres the result is constant within one query — this allows Postgres to cache it and avoid re-executing the subquery for every row.
- `is_admin()` — same pattern. Checks `role = 'admin'` in profiles.
- `DROP POLICY IF EXISTS` before each `CREATE POLICY` — makes the migration re-runnable (idempotent). Safe to apply multiple times.
- `sales_data` has no UPDATE policy — data is immutable after import. If a tenant needs to correct data, they delete and re-import.
- `audit_log` has no INSERT policy via client — inserts are done exclusively by FastAPI using the `service_role` key, ensuring tamper-proof audit records.

**Related changes:** `003_functions.sql` — the `handle_new_user` trigger must run after RLS is set up.

---

# File: akara/supabase/migrations/003_functions.sql

**Status:** Created

**Purpose:**
Creates the auto-signup trigger (creates a `profiles` row when a new user is added to `auth.users`) and three database functions for KPI aggregation. The KPI functions move heavy aggregation logic to the database layer, reducing FastAPI query count.

**Must be applied third.** Run after `001_initial_schema.sql` and `002_rls_policies.sql`.

**Dependencies:** `001_initial_schema.sql` and `002_rls_policies.sql` must be applied first

**Implementation:**

```sql
-- ============================================================
-- AKARA: Database Functions & Triggers
-- Migration 003
-- Run AFTER migrations 001 and 002
-- ============================================================

-- ============================================================
-- Auto-create profile on new user signup
--
-- When a user signs up via Supabase Auth, this trigger fires
-- and creates a corresponding row in public.profiles.
--
-- The caller (FastAPI /auth/invite or Supabase Admin SDK) MUST
-- pass tenant_id and role in user_metadata when creating the user:
--
--   supabase.auth.admin.create_user({
--     email: "user@example.com",
--     user_metadata: {
--       tenant_id: "uuid-of-tenant",
--       role: "admin",               -- or "user"
--       display_name: "Alice"
--     }
--   })
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
-- get_kpi_summary
-- Returns aggregated KPIs for a given tenant + date range.
-- Called by FastAPI GET /v1/kpi/summary
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
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_revenue',    COALESCE(SUM(total_amount), 0),
        'total_orders',     COUNT(DISTINCT invoice_number),
        'unique_parties',   COUNT(DISTINCT party_name),
        'avg_order_value',  CASE
                                WHEN COUNT(DISTINCT invoice_number) > 0
                                THEN ROUND(SUM(total_amount) / COUNT(DISTINCT invoice_number), 2)
                                ELSE 0
                            END,
        'total_quantity',   COALESCE(SUM(quantity), 0),
        'total_discount',   COALESCE(SUM(discount_amount), 0),
        'date_range_start', p_start_date,
        'date_range_end',   p_end_date
    )
    INTO v_result
    FROM public.sales_data
    WHERE tenant_id = p_tenant_id
      AND invoice_date BETWEEN p_start_date AND p_end_date;

    RETURN COALESCE(v_result, '{}'::JSONB);
END;
$$;

-- ============================================================
-- get_top_products
-- Returns top N products by revenue for a tenant + date range.
-- Called by FastAPI GET /v1/kpi/top-products
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_top_products(
    p_tenant_id  UUID,
    p_start_date DATE,
    p_end_date   DATE,
    p_limit      INT DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_agg(row_data ORDER BY revenue DESC)
    INTO v_result
    FROM (
        SELECT jsonb_build_object(
            'product_name', product_name,
            'revenue',      ROUND(SUM(total_amount), 2),
            'quantity',     SUM(quantity),
            'orders',       COUNT(DISTINCT invoice_number)
        ) AS row_data,
        SUM(total_amount) AS revenue
        FROM public.sales_data
        WHERE tenant_id = p_tenant_id
          AND invoice_date BETWEEN p_start_date AND p_end_date
          AND product_name IS NOT NULL
        GROUP BY product_name
        ORDER BY revenue DESC
        LIMIT p_limit
    ) sub;

    RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;

-- ============================================================
-- get_zone_breakdown
-- Returns revenue and party count per zone for a tenant + date range.
-- Called by FastAPI GET /v1/kpi/zones
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_zone_breakdown(
    p_tenant_id  UUID,
    p_start_date DATE,
    p_end_date   DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_agg(row_data ORDER BY revenue DESC)
    INTO v_result
    FROM (
        SELECT jsonb_build_object(
            'zone',           COALESCE(party_zone, 'Unknown'),
            'revenue',        ROUND(SUM(total_amount), 2),
            'unique_parties', COUNT(DISTINCT party_name),
            'orders',         COUNT(DISTINCT invoice_number)
        ) AS row_data,
        SUM(total_amount) AS revenue
        FROM public.sales_data
        WHERE tenant_id = p_tenant_id
          AND invoice_date BETWEEN p_start_date AND p_end_date
        GROUP BY party_zone
        ORDER BY revenue DESC
    ) sub;

    RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;
```

**Placement:** `akara/supabase/migrations/003_functions.sql`

**Explanation:**
- `handle_new_user()` — fires on every INSERT to `auth.users`. Reads `raw_user_meta_data` (set by the caller when creating the user) to get `tenant_id`, `role`, and `display_name`. `ON CONFLICT (id) DO NOTHING` makes it safe to re-fire without duplicating the profile.
- `get_kpi_summary()` — called with an explicit `p_tenant_id` parameter. `SECURITY DEFINER` allows it to bypass RLS. FastAPI passes the tenant_id extracted from the verified JWT. Returns a single JSONB object with all dashboard KPIs in one query.
- `get_top_products()` and `get_zone_breakdown()` — same pattern. Aggregation at the database layer is significantly faster than fetching rows into Python and aggregating there.
- `COALESCE(..., '[]'::JSONB)` — returns an empty array (not null) when no data exists. Prevents null-handling bugs in the API layer.

**Related changes:**
- Day 4: `backend/app/services/kpi/` — Python functions call these via Supabase RPC: `supabase.rpc("get_kpi_summary", {...})`
- Day 7: React dashboard uses the API routes that call these functions

---

# File: akara/supabase/migrations/APPLY_INSTRUCTIONS.md

**Status:** Created

**Purpose:**
Instructions for applying migrations and verification queries. This file exists because the Supabase CLI was not available during Day 1, so migrations must be applied manually.

**Dependencies:** None

**Implementation:**

```markdown
# How to Apply Migrations

The Supabase CLI is not required. Apply each migration manually:

1. Go to [supabase.com](https://supabase.com) → your project → **SQL Editor**
2. Paste and run each file in order:
   - `001_initial_schema.sql` — creates all 7 tables + indexes
   - `002_rls_policies.sql` — enables RLS + creates all policies
   - `003_functions.sql` — creates trigger + database functions

Run them **one at a time**, in order. Each should complete with no errors.

## Verification queries (run after all 3 migrations)

```sql
-- 1. Verify all 7 tables exist with RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'tenants', 'profiles', 'sales_data',
    'context_cache', 'chat_history', 'audit_log', 'generated_reports'
  );
-- Expected: 7 rows, all with rowsecurity = true

-- 2. Verify all helper functions + trigger function exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_my_tenant_id', 'is_admin',
    'handle_new_user', 'set_updated_at',
    'get_kpi_summary', 'get_top_products', 'get_zone_breakdown'
  );
-- Expected: 7 rows

-- 3. Verify the auth trigger exists
SELECT trigger_name
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
-- Expected: 1 row

-- 4. Verify indexes
SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';
-- Expected: >= 18
```
```

**Placement:** `akara/supabase/migrations/APPLY_INSTRUCTIONS.md`

---

## Environment Variables Summary

### Backend (`akara/backend/.env`)

| Variable | Source | Used By |
|---|---|---|
| `SUPABASE_URL` | Supabase Dashboard → Settings → API | Day 2: Supabase client init |
| `SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API | Day 2: User-scoped queries (RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API | Day 2: Admin routes (bypasses RLS) |
| `JWT_SECRET` | Supabase Dashboard → Settings → API → JWT Secret | Day 2: Auth middleware JWT verification |
| `GEMINI_API_KEY` | Google AI Studio | Day 3: LLM manager |
| `OPENROUTER_API_KEY` | openrouter.ai | Day 3: LLM failover |
| `GMAIL_USER` | Gmail account | Day 5: Morning brief emails |
| `GMAIL_APP_PASSWORD` | Gmail → Security → App passwords | Day 5: Morning brief emails |
| `WEATHER_API_KEY` | weatherapi.com | Day 3: Context enrichment tool |
| `NEWS_API_KEY` | newsapi.org | Day 3: Context enrichment tool |
| `ENVIRONMENT` | Manual | Day 2: Debug/logging control |
| `LOG_LEVEL` | Manual | Day 2: structlog configuration |
| `ALLOWED_ORIGINS` | Manual | Day 2: FastAPI CORS |
| `SENTRY_DSN` | sentry.io | Day 10: Error tracking |

### Frontend (`akara/frontend/.env.local`)

| Variable | Source | Used By |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase Dashboard → Settings → API | `src/lib/supabase.ts` |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API | `src/lib/supabase.ts` |
| `VITE_API_BASE_URL` | Manual (Railway URL in production) | Day 6: API client |

---

## Package Versions Installed

### Backend (Python 3.12 via uv)

Key packages resolved:
- `fastapi==0.139.2`
- `uvicorn==0.51.0`
- `supabase==2.31.0`
- `pydantic==2.13.4`
- `pydantic-settings==2.14.2`
- `python-jose==3.5.0`
- `google-generativeai==0.8.6`
- `openai==2.46.0`
- `scikit-learn==1.9.0`
- `pandas==3.0.3`
- `numpy==2.5.1`
- `sentry-sdk==2.66.0`
- `structlog==26.1.0`
- `httpx2==2.7.0`
- `ruff==0.15.22`
- `pytest==9.1.1`
- `pytest-asyncio==1.4.0`

### Frontend (Node 22 via npm)

Key packages resolved:
- `react==19.2.7`
- `react-dom==19.2.7`
- `react-router-dom==7.18.1`
- `@supabase/supabase-js==2.110.8`
- `@tanstack/react-query==5.101.4`
- `zustand==5.0.14`
- `tailwindcss==4.3.3`
- `@tailwindcss/vite==4.3.3`
- `lucide-react==1.25.0`
- `clsx==2.1.1`
- `tailwind-merge==3.6.0`
- `class-variance-authority==0.7.1`
- `vite==8.1.1`
- `typescript==6.0.2`

---

## Commands to Reproduce Day 1 From Scratch

```bash
# 1. Create directory
mkdir akara && cd akara

# 2. Create root files
# (copy .gitignore and README.md as shown above)

# 3. Create backend structure
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

# Copy all backend files as shown in this document, then:
cd backend
uv venv
uv sync --extra dev
cp .env.example .env
# Fill in .env with real values

# 4. Scaffold frontend
cd ..
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install react-router-dom @supabase/supabase-js @tanstack/react-query zustand
npm install -D tailwindcss postcss autoprefixer eslint prettier eslint-config-prettier
npm install tailwindcss @tailwindcss/vite
npm install lucide-react class-variance-authority clsx tailwind-merge
npm install -D @types/node
cp .env.example .env.local
# Fill in .env.local with real values

# 5. Apply migrations
# Paste 001, 002, 003 into Supabase Dashboard → SQL Editor in order

# 6. Verify
cd ../backend
source .venv/bin/activate
ruff check .     # should pass
pytest           # should exit with no tests collected
```

---

## What Day 2 Adds to Each File

| File | Day 2 Change |
|---|---|
| `backend/app/main.py` | Add CORS middleware, Sentry init, import routers, lifespan handler |
| `backend/app/core/config.py` | **New** — Pydantic Settings class reading all env vars |
| `backend/app/core/auth.py` | **New** — JWT verification middleware, `get_current_user` dependency |
| `backend/app/core/tenant.py` | **New** — tenant context extraction, `get_tenant_id` dependency |
| `backend/app/api/routes/auth.py` | **New** — `GET /auth/me` endpoint |
| `backend/app/api/routes/health.py` | **New** — Enhanced `GET /health` with DB connectivity check |
| `backend/.env` | Add real values for Supabase URL, keys, JWT secret |
| `frontend/.env.local` | Add real values for Supabase URL and anon key |
