# Day 5 Implementation Handoff

## Reproduction Instructions

### Expected state before applying Day 5 changes

Days 1–4 must already be fully implemented as documented in:

- `docs/day1_implementation.md` — monorepo scaffold, Supabase schema, RLS, frontend scaffold
- `docs/day2_implementation.md` — FastAPI core, Pydantic settings, auth middleware, tenant context, health and auth routes, `main.py`, tests
- `docs/day3_implementation.md` — LLM manager (Gemini + OpenRouter), SQL guard + executor, Copilot pipeline (planner, synthesizer, agent), guardrails, copilot route
- `docs/day4_implementation.md` — KPI service + route, data export route

The repository must be in the state where `main.py` already registers `health`, `auth`, `copilot`, `kpi`, and `data` routers. No `Procfile`, `railway.json`, or `app/api/routes/admin/` directory exists yet at the start of Day 5.

### What Day 5 adds

1. **Track 1 — Railway deployment config:** `Procfile`, `runtime.txt`, `.python-version`, `railway.json`, and one comment added to `pyproject.toml`.
2. **Track 2 — Admin tenant routes:** `app/api/routes/admin/__init__.py`, `app/api/routes/admin/tenants.py`, and two lines added to `main.py`.

### Application order

Apply changes in this order:

1. `backend/Procfile` (create)
2. `backend/runtime.txt` (create)
3. `backend/.python-version` (create)
4. `backend/railway.json` (create)
5. `backend/pyproject.toml` (modify — add comment at top)
6. `backend/app/api/routes/admin/__init__.py` (create)
7. `backend/app/api/routes/admin/tenants.py` (create)
8. `backend/app/main.py` (modify — add import + `include_router`)

### Commands after copying code

```bash
cd akara/backend
uv run ruff check .
uv run pytest
```

Both must exit 0 before proceeding with the Railway deploy.

### Railway deploy (manual — requires CLI)

```bash
cd akara/backend
railway login
railway init        # choose "Empty Project", name: akara-backend
railway link
railway up
railway status      # note the public HTTPS URL
```

Set the following environment variables in Railway → Project → Variables:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `JWT_SECRET` | Supabase Dashboard → Settings → API → JWT Secret |
| `GEMINI_API_KEY` | Google AI API key |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `ENVIRONMENT` | `production` |
| `LOG_LEVEL` | `INFO` |
| `ALLOWED_ORIGINS_RAW` | `https://your-app.vercel.app` (update on Day 6) |
| `GMAIL_USER` | Gmail address |
| `GMAIL_APP_PASSWORD` | Gmail app password |

> **Note:** The variable name is `ALLOWED_ORIGINS_RAW`, not `ALLOWED_ORIGINS`. This was renamed in Day 2 to work around a `pydantic-settings` parsing limitation.

### Smoke tests (run after `railway up`)

```bash
RAILWAY_URL="https://akara-backend-production.up.railway.app"
curl -s "$RAILWAY_URL/health" | python3 -m json.tool
# Expected: {"status":"ok","environment":"production","timestamp":"..."}
curl -s -o /dev/null -w "%{http_code}" "$RAILWAY_URL/docs"
# Expected: 404  (docs hidden in production)
curl -s -o /dev/null -w "%{http_code}" "$RAILWAY_URL/auth/me"
# Expected: 403
curl -s -o /dev/null -w "%{http_code}" "$RAILWAY_URL/kpi/"
# Expected: 403
```

---

## Bug Fixes Encountered During Day 5

### Bug: FastAPI `AssertionError` — double `Depends` on a single parameter

**Error:**
```
AssertionError: Cannot specify `Depends` in `Annotated` and default value together for 'tenant'
```

**Root cause:**  
`TenantCtx` is defined in `app/core/tenant.py` as:
```python
TenantCtx = Annotated[TenantContext, Depends(get_tenant_context)]
```
Using `tenant: TenantCtx = Depends(_require_superadmin)` in a route handler placed a `Depends` inside `Annotated` (from `TenantCtx`) *and* another `Depends` as the default value simultaneously. FastAPI forbids this.

**Fix:**  
- `_require_superadmin` keeps `TenantCtx` in its own parameter annotation (FastAPI injects `TenantContext` via `get_tenant_context` for this dependency function).
- Route handler parameters use the plain `TenantContext` class (not the `Annotated` alias) with `= Depends(_require_superadmin)` as the default, so only one `Depends` is present.

---

# File: `backend/Procfile`

**Status:** Created

## Purpose

Tells Railway (and any Heroku-compatible platform) how to start the web process. Railway reads `Procfile` during deploy and uses the `web:` entry as the server start command.

## Dependencies

- `uvicorn` — already in `pyproject.toml` as `uvicorn[standard]>=0.29.0` (introduced Day 2)
- `$PORT` — environment variable injected by Railway at runtime; Railway dynamically assigns the port

## Implementation

```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

## Placement

New file at the root of the `backend/` directory:

```
akara/
└── backend/
    ├── Procfile          ← new file
    ├── pyproject.toml
    ├── app/
    └── ...
```

## Explanation

The `Procfile` contains a single `web:` process declaration. `--host 0.0.0.0` makes the server bind to all network interfaces (required for containerized environments). `--port $PORT` uses the port Railway injects rather than a hardcoded value. `app.main:app` is the ASGI entry point — the `app` object created in `app/main.py`.

## Related Changes

- `backend/railway.json` — the `deploy.startCommand` mirrors this command for explicit Railway config
- `backend/app/main.py` — defines the `app` ASGI object that uvicorn serves

---

# File: `backend/runtime.txt`

**Status:** Created

## Purpose

Pins the Python runtime to 3.12 for Nixpacks (Railway's default builder). Without this file, Railway may select a different Python version. This ensures reproducible builds matching the development environment.

## Dependencies

None — this is a static declaration read by Nixpacks during the build phase.

## Implementation

```
python-3.12
```

## Placement

New file at the root of the `backend/` directory:

```
akara/
└── backend/
    ├── runtime.txt       ← new file
    ├── Procfile
    └── ...
```

## Explanation

A one-line file. Nixpacks reads it and selects the Python 3.12 toolchain. The `pyproject.toml` already declares `requires-python = ">=3.12"` (Day 2); `runtime.txt` reinforces this at the build level.

## Related Changes

- `backend/.python-version` — mirrors this pin for local `uv` / `pyenv` tooling
- `backend/pyproject.toml` — `requires-python = ">=3.12"` (unchanged from Day 2)

---

# File: `backend/.python-version`

**Status:** Created

## Purpose

Pins the Python version for local development tooling (`uv`, `pyenv`, `asdf`). Tools that read `.python-version` will automatically use Python 3.12 when working inside the `backend/` directory, keeping local and production environments in sync.

## Dependencies

None — static declaration read by `uv` and `pyenv` locally.

## Implementation

```
3.12
```

## Placement

New file at the root of the `backend/` directory (hidden file, begins with `.`):

```
akara/
└── backend/
    ├── .python-version   ← new file
    ├── runtime.txt
    └── ...
```

## Explanation

A one-line file. Unlike `runtime.txt` (which targets Railway's Nixpacks), `.python-version` targets local version managers. Both files must agree; both say `3.12`.

## Related Changes

- `backend/runtime.txt` — Railway equivalent of this pin

---

# File: `backend/railway.json`

**Status:** Created

## Purpose

Provides explicit build and deploy configuration for Railway. Although Railway can infer most settings from `Procfile` and `runtime.txt`, `railway.json` adds the healthcheck path, restart policy, and an explicit build command so that Railway uses `uv` for dependency installation rather than `pip` alone.

## Dependencies

- `$PORT` — Railway injects at runtime
- `backend/Procfile` — the `startCommand` here duplicates the `Procfile` entry; both are kept for clarity
- `/health` endpoint — defined in `app/api/routes/health.py` (Day 2)
- `railway.schema.json` — the `$schema` URL is official Railway JSON Schema for IDE validation

## Implementation

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

## Placement

New file at the root of the `backend/` directory:

```
akara/
└── backend/
    ├── railway.json      ← new file
    ├── Procfile
    ├── runtime.txt
    └── ...
```

## Explanation

- `build.builder: "NIXPACKS"` — uses Railway's Nixpacks builder (default, made explicit).
- `build.buildCommand: "pip install uv && uv sync"` — installs `uv` first (not available in the Nixpacks base image), then uses `uv sync` to install all dependencies from `pyproject.toml` including the lock file.
- `deploy.startCommand` — mirrors `Procfile`; Railway uses whichever takes precedence.
- `deploy.healthcheckPath: "/health"` — Railway polls `GET /health` after deploy. The endpoint was created on Day 2 and returns `{"status":"ok","environment":"...","timestamp":"..."}`.
- `deploy.healthcheckTimeout: 30` — Railway waits up to 30 seconds for the first healthy response.
- `deploy.restartPolicyType: "ON_FAILURE"` — restarts the container on crash, up to 3 times.
- `deploy.restartPolicyMaxRetries: 3` — hard ceiling to avoid infinite restart loops.

## Related Changes

- `backend/Procfile` — `startCommand` duplicates this
- `backend/app/api/routes/health.py` — the `healthcheckPath` target (Day 2, unchanged)

---

# File: `backend/pyproject.toml`

**Status:** Modified

## Purpose

A single comment line was added at the very top of `pyproject.toml` to document the Railway build and start commands inline with the project manifest, making it easy for contributors to understand how the project is deployed without reading `railway.json`.

## Dependencies

None — comment only, no behavioral change.

## Implementation

### Original first line (Day 4 state)

```toml
[project]
```

### Replacement (Day 5)

```toml
# Railway uses: pip install uv && uv sync && uvicorn app.main:app --host 0.0.0.0 --port $PORT
[project]
```

### Full file after Day 5 modification

```toml
# Railway uses: pip install uv && uv sync && uvicorn app.main:app --host 0.0.0.0 --port $PORT
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
    "google-genai>=2.13.0",
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
    "ruff>=0.4.0",
    "httpx2>=2.7.0",
]

[tool.ruff]
line-length = 88
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "W", "I", "UP", "B", "C4", "PIE", "T20", "RET", "SIM"]
ignore = ["E501", "B008"]

[tool.ruff.lint.isort]
known-first-party = ["app"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

## Placement

The comment is inserted as the very first line of the file, before the `[project]` table header. No other content is moved or changed.

## Explanation

Comment-only change. Serves as a quick reference for any developer (or AI agent) reading `pyproject.toml` to understand the Railway build and start commands without having to inspect `railway.json` or `Procfile`.

## Related Changes

- `backend/railway.json` — `buildCommand` and `startCommand` match this comment exactly

---

# File: `backend/app/api/routes/admin/__init__.py`

**Status:** Created

## Purpose

Marks the `admin/` directory as a Python package so that `from app.api.routes.admin import tenants` works correctly as an absolute import in `main.py`.

## Dependencies

None.

## Implementation

```python

```

*(Empty file — zero bytes.)*

## Placement

New file at:

```
akara/
└── backend/
    └── app/
        └── api/
            └── routes/
                └── admin/
                    ├── __init__.py   ← new file (empty)
                    └── tenants.py
```

The `admin/` directory itself is also new as of Day 5.

## Explanation

Standard Python package marker. Without this file, the import `from app.api.routes.admin import tenants` in `main.py` raises `ModuleNotFoundError`.

## Related Changes

- `backend/app/api/routes/admin/tenants.py` — the module this package exposes
- `backend/app/main.py` — imports from this package

---

# File: `backend/app/api/routes/admin/tenants.py`

**Status:** Created

## Purpose

Provides three protected HTTP endpoints for superadmin tenant management:

- `GET  /admin/tenants/` — list all tenants
- `POST /admin/tenants/` — provision a new tenant
- `PATCH /admin/tenants/{tenant_id}/deactivate` — soft-delete a tenant

All three require the calling user to have `role = "admin"` in the `profiles` table. Non-admin callers receive `403 Forbidden`.

## Dependencies

**Internal (all pre-existing from earlier days):**

- `app.core.auth.CurrentUser` — `Annotated[AuthenticatedUser, Depends(get_current_user)]` type alias (Day 2)
- `app.core.tenant.TenantContext` — plain class, resolved from the `profiles` table (Day 2)
- `app.core.tenant.TenantCtx` — `Annotated[TenantContext, Depends(get_tenant_context)]` type alias (Day 2)
- `app.core.tenant.get_supabase_service_client` — returns a Supabase service-role client that bypasses RLS (Day 2)

**Supabase tables:**

- `tenants` — columns: `id` (UUID), `name` (text), `slug` (text), `is_active` (boolean), `config` (JSONB), `created_at` (timestamptz). Created during Day 1 schema setup.

**Python standard library / packages:**

- `uuid.UUID` — standard library
- `fastapi` — `APIRouter`, `Depends`, `HTTPException`, `status`
- `pydantic.BaseModel` — already in `pyproject.toml` (Day 2)

**No new packages introduced on Day 5.**

## Implementation

```python
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.auth import CurrentUser
from app.core.tenant import TenantContext, TenantCtx, get_supabase_service_client

router = APIRouter(prefix="/admin/tenants", tags=["admin"])


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


def _require_superadmin(tenant: TenantCtx) -> TenantContext:
    """Guard: raises 403 if the caller is not a tenant admin."""
    if not tenant.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Superadmin only"
        )
    return tenant


@router.get("/", response_model=list[TenantOut])
def list_tenants(
    user: CurrentUser,
    tenant: TenantContext = Depends(_require_superadmin),
) -> list[TenantOut]:
    supabase = get_supabase_service_client()
    result = (
        supabase.table("tenants").select("*").order("created_at", desc=True).execute()
    )
    return [TenantOut(**row) for row in (result.data or [])]


@router.post("/", response_model=TenantOut, status_code=status.HTTP_201_CREATED)
def create_tenant(
    body: TenantCreate,
    user: CurrentUser,
    tenant: TenantContext = Depends(_require_superadmin),
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
    tenant: TenantContext = Depends(_require_superadmin),
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

## Placement

New file. Full contents listed above. No existing file is modified.

Directory structure after creation:

```
akara/backend/app/api/routes/
├── __init__.py          (Day 1)
├── auth.py              (Day 2)
├── copilot.py           (Day 3)
├── data.py              (Day 4)
├── health.py            (Day 2)
├── kpi.py               (Day 4)
└── admin/
    ├── __init__.py      (Day 5 — empty)
    └── tenants.py       (Day 5 — this file)
```

## Explanation

### Pydantic models

- **`TenantOut`** — serializes a `tenants` table row for API responses. Fields: `id` (UUID), `name`, `slug`, `is_active`, `config` (dict/JSONB).
- **`TenantCreate`** — request body for `POST /`. Fields: `name`, `slug`, `config` (defaults to empty dict).

### `_require_superadmin` dependency guard

A plain FastAPI dependency function. Its parameter `tenant: TenantCtx` causes FastAPI to:

1. Call `get_current_user` (from `CurrentUser` / `TenantCtx` chain) to verify the JWT.
2. Call `get_tenant_context` to look up the user's `tenant_id` and `role` in `profiles`.
3. Pass the resolved `TenantContext` into `_require_superadmin`.

`_require_superadmin` then checks `tenant.is_admin` (which is `True` when `role == "admin"`). If false, it raises `HTTP 403`. Otherwise it returns the `TenantContext` unchanged.

**Critical design note — why `TenantContext` (not `TenantCtx`) in route handlers:**

Route handlers declare `tenant: TenantContext = Depends(_require_superadmin)`. This uses the plain class `TenantContext` as the type annotation plus a `Depends` default — FastAPI handles this pattern correctly.

If `TenantCtx` (which is `Annotated[TenantContext, Depends(get_tenant_context)]`) were used instead, FastAPI would detect *two* `Depends` for the same parameter — one inside the `Annotated` metadata and one as the default value — and raise `AssertionError: Cannot specify Depends in Annotated and default value together`. This was the bug encountered and fixed during Day 5 implementation.

### `GET /admin/tenants/`

Lists all rows from the `tenants` table ordered by `created_at DESC` (newest first). Uses the service-role Supabase client to bypass RLS. Returns `[]` if no tenants exist.

### `POST /admin/tenants/`

Inserts a new row into `tenants` with the provided `name`, `slug`, and `config`. Returns the created row as `TenantOut` with HTTP 201. The `id` and `created_at` are generated by Supabase defaults (UUID and `now()`). `is_active` defaults to `true` in the database schema.

### `PATCH /admin/tenants/{tenant_id}/deactivate`

Sets `is_active = False` for the given `tenant_id`. This is a soft delete — the tenant row remains in the database but the application treats inactive tenants as disabled. Returns 404 if the Supabase update returns no rows (tenant not found).

## Related Changes

- `backend/app/main.py` — imports and registers this router (modified Day 5)
- `backend/app/api/routes/admin/__init__.py` — package marker required for the import
- `backend/app/core/tenant.py` — source of `TenantContext`, `TenantCtx`, `get_supabase_service_client` (Day 2, unchanged)
- `backend/app/core/auth.py` — source of `CurrentUser` (Day 2, unchanged)

---

# File: `backend/app/main.py`

**Status:** Modified

## Purpose

Two changes were made to `main.py` on Day 5:

1. Added the import for `admin_tenants_router`.
2. Registered the admin tenants router with the FastAPI application.

This makes the three `GET/POST/PATCH /admin/tenants/…` endpoints part of the running application.

## Dependencies

- `backend/app/api/routes/admin/__init__.py` — package marker (Day 5)
- `backend/app/api/routes/admin/tenants.py` — the router module (Day 5)

## Implementation

### Original file (Day 4 state)

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
```

### File after Day 5 modifications

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
```

## Placement

### Change 1 — New import line

Insert after the existing `from app.api.routes import kpi as kpi_router` line (line 11 in Day 4 state), before `from app.core.config import settings`:

```python
from app.api.routes.admin import tenants as admin_tenants_router
```

### Change 2 — New `include_router` call

Append after `app.include_router(data_router.router)` at the bottom of the file:

```python
app.include_router(admin_tenants_router.router)
```

## Explanation

`admin_tenants_router.router` is an `APIRouter` with `prefix="/admin/tenants"`. Calling `app.include_router(...)` mounts all three endpoints (`GET /`, `POST /`, `PATCH /{tenant_id}/deactivate`) under `/admin/tenants/` in the FastAPI application.

The import uses the sub-package pattern `from app.api.routes.admin import tenants as admin_tenants_router` — the `as admin_tenants_router` alias is used for consistency with the existing naming convention in this file (e.g., `auth as auth_router`, `kpi as kpi_router`).

## Related Changes

- `backend/app/api/routes/admin/__init__.py` — must exist for the import to succeed (Day 5)
- `backend/app/api/routes/admin/tenants.py` — defines `router` (Day 5)
- All other `include_router` calls (Days 2–4) — unchanged

---

## Environment Variables

No new environment variables were introduced on Day 5. All variables used by the application are unchanged from Days 2–4.

The Railway deploy (manual step) requires the following variables to be set in the Railway dashboard. These are the same variables already present in `backend/.env.example` from Day 2:

| Variable | Purpose | Required | Format | Where used |
|---|---|---|---|---|
| `SUPABASE_URL` | Supabase project REST URL | Required | `https://<project>.supabase.co` | `app/core/config.py`, `app/core/tenant.py` |
| `SUPABASE_ANON_KEY` | Supabase anon/public key | Required | JWT string | `app/core/tenant.py` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) | Required | JWT string | `app/core/tenant.py`, `app/api/routes/admin/tenants.py` |
| `JWT_SECRET` | Secret used to verify Supabase JWTs | Required | String (from Supabase dashboard) | `app/core/auth.py` |
| `GEMINI_API_KEY` | Google Gemini API key | Required | String | `app/services/llm/gemini.py` |
| `OPENROUTER_API_KEY` | OpenRouter failover API key | Required | String | `app/services/llm/openrouter.py` |
| `ENVIRONMENT` | Runtime environment label | Optional | `production` or `development` | `app/core/config.py` |
| `LOG_LEVEL` | Python logging level | Optional | `INFO`, `DEBUG`, etc. | `app/main.py` |
| `ALLOWED_ORIGINS_RAW` | Comma-separated CORS origins | Required | `https://your-app.vercel.app` | `app/core/config.py` |
| `GMAIL_USER` | Gmail address for email sending | Optional | Email address | future email service |
| `GMAIL_APP_PASSWORD` | Gmail app password | Optional | String | future email service |

All variables were introduced in Day 2. None are new in Day 5.

---

## Package Dependencies

No new packages were added, removed, or updated in `pyproject.toml` on Day 5. The only change to `pyproject.toml` was the comment line at the top (see above).

---

## Tests

No new tests were added on Day 5. The existing test suite (`tests/test_health.py` — 2 tests, created Day 2) continues to pass:

```bash
cd akara/backend
uv run pytest
# Expected output:
# 2 passed in ~1.4s
```

The admin tenant routes (`GET/POST/PATCH /admin/tenants/`) are not unit-tested on Day 5. Integration testing requires a live Supabase instance and a valid JWT from an admin user, which is deferred to a later day.

---

## End-of-Day Checklist Verification

| Item | Status |
|---|---|
| `backend/Procfile` exists | ✅ |
| `backend/runtime.txt` exists | ✅ |
| `backend/.python-version` exists | ✅ |
| `backend/railway.json` exists | ✅ |
| `backend/pyproject.toml` has Railway comment at top | ✅ |
| `backend/app/api/routes/admin/__init__.py` exists (empty) | ✅ |
| `backend/app/api/routes/admin/tenants.py` exists with GET/POST/PATCH | ✅ |
| `backend/app/main.py` imports and registers `admin_tenants_router` | ✅ |
| `ruff check .` exits 0 | ✅ |
| `pytest` exits 0 (2 tests pass) | ✅ |
| Railway deploy (manual CLI step) | Manual — requires Railway CLI and credentials |
| 4 smoke tests pass from live Railway URL | Manual — requires deployed Railway service |
