---
name: Day 5 Railway Deploy
overview: Create Railway deployment config files (Track 1), then build the admin tenants API routes (Track 2). Deployment to Railway requires manual CLI steps and dashboard env var configuration.
todos:
  - id: d5-procfile
    content: Create backend/Procfile — uvicorn start command for Railway
    status: completed
  - id: d5-runtime
    content: Create backend/runtime.txt and backend/.python-version — Python 3.12 pin
    status: completed
  - id: d5-railway-json
    content: Create backend/railway.json — build + deploy + healthcheck config
    status: completed
  - id: d5-pyproject-comment
    content: Add Railway build comment to top of backend/pyproject.toml
    status: completed
  - id: d5-admin-init
    content: Create backend/app/api/routes/admin/__init__.py — empty package marker
    status: completed
  - id: d5-admin-tenants
    content: Create backend/app/api/routes/admin/tenants.py — TenantOut, TenantCreate, GET/POST/PATCH endpoints
    status: completed
  - id: d5-main
    content: Modify backend/app/main.py — import and register admin_tenants_router
    status: completed
  - id: d5-quality
    content: Run ruff check . && pytest — both must exit 0
    status: completed
  - id: d5-deploy
    content: "Railway deploy: railway login → init → link → set env vars → railway up"
    status: completed
  - id: d5-smoke
    content: Smoke test all 4 endpoints from public Railway URL
    status: completed
isProject: false
---

# Day 5 — Deploy Backend to Railway + Admin Routes

**Goal:** FastAPI backend live at a public Railway HTTPS URL with all 4 smoke tests passing. Admin tenant management routes working locally.

**Current state:** Days 1–4 complete. `main.py` already registers `health`, `auth`, `copilot`, `kpi`, `data` routers. No `Procfile`, `railway.json`, or `admin/` routes exist yet.

---

## Track 1 — Railway Deployment Config (4 new files + 1 modified)

### Files to create

**[`backend/Procfile`](akara/backend/Procfile)**
```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

**[`backend/runtime.txt`](akara/backend/runtime.txt)**
```
python-3.12
```

**[`backend/.python-version`](akara/backend/.python-version)**
```
3.12
```

**[`backend/railway.json`](akara/backend/railway.json)**
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

### File to modify

**[`backend/pyproject.toml`](akara/backend/pyproject.toml)** — add one comment line at the very top:
```toml
# Railway uses: pip install uv && uv sync && uvicorn app.main:app --host 0.0.0.0 --port $PORT
[project]
...
```

---

## Track 1 — Railway Deploy Steps (manual, requires CLI)

These steps require the Railway CLI and cannot be automated. Run them from `akara/backend/`:

```bash
railway login
railway init        # "Empty Project" → name: akara-backend
railway link
railway up
railway status      # note the public URL
```

### Railway Dashboard env vars

Set these in Railway → Project → Variables. Note: the field is `ALLOWED_ORIGINS_RAW` (not `ALLOWED_ORIGINS` — renamed in Day 2):

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
| `ALLOWED_ORIGINS_RAW` | `https://your-app.vercel.app` (update Day 6) |
| `GMAIL_USER` | Gmail address |
| `GMAIL_APP_PASSWORD` | Gmail app password |

### Smoke tests (run after deploy)

```bash
RAILWAY_URL="https://akara-backend-production.up.railway.app"
curl -s "$RAILWAY_URL/health" | python3 -m json.tool
# Expected: {"status":"ok","environment":"production","timestamp":"..."}
curl -s -o /dev/null -w "%{http_code}" "$RAILWAY_URL/docs"
# Expected: 404 (hidden in production)
curl -s -o /dev/null -w "%{http_code}" "$RAILWAY_URL/auth/me"
# Expected: 403
curl -s -o /dev/null -w "%{http_code}" "$RAILWAY_URL/kpi/"
# Expected: 403
```

---

## Track 2 — Admin Tenant Routes (2 new files + 1 modified)

### Files to create

**[`backend/app/api/routes/admin/__init__.py`](akara/backend/app/api/routes/admin/__init__.py)** — empty

**[`backend/app/api/routes/admin/tenants.py`](akara/backend/app/api/routes/admin/tenants.py)**

Three endpoints on `prefix="/admin/tenants"`:
- `GET /` — list all tenants, ordered by `created_at desc`
- `POST /` — create a new tenant, returns 201
- `PATCH /{tenant_id}/deactivate` — set `is_active = False`

All three require the caller to be `is_admin`. `_require_superadmin` is a FastAPI `Depends` guard that checks `tenant.is_admin` and raises 403 if false.

Pydantic models: `TenantOut` (id, name, slug, is_active, config), `TenantCreate` (name, slug, config).

### File to modify

**[`backend/app/main.py`](akara/backend/app/main.py)** — add two lines:
```python
from app.api.routes.admin import tenants as admin_tenants_router
# ...
app.include_router(admin_tenants_router.router)
```

---

## Quality gate

```bash
cd akara/backend
uv run ruff check .
uv run pytest
```

---

## End-of-day checklist

- `backend/Procfile`, `backend/runtime.txt`, `backend/.python-version`, `backend/railway.json` all exist
- `backend/pyproject.toml` has the Railway build comment at the top
- Backend deployed to Railway — public HTTPS URL is live
- All 4 smoke tests pass from the public URL
- `app/api/routes/admin/tenants.py` exists with GET/POST/PATCH routes
- `main.py` registers `admin_tenants_router`
- `ruff check .` and `pytest` both exit 0
