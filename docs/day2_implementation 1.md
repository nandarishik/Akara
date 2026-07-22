# Day 2 Implementation Handoff — FastAPI Core

**Prerequisite:** Day 1 implementation is already in place exactly as documented in
`docs/day1_implementation.md`. This document covers only work introduced or modified
on Day 2.

**Goal achieved:** FastAPI application boots locally with typed configuration, JWT
middleware that validates Supabase-issued tokens, a per-request tenant context
dependency that resolves `tenant_id` from the `profiles` table, a `/health` endpoint,
a protected `/auth/me` endpoint, and a passing test suite.

---

## Request flow after Day 2

```
React / curl
  │  Authorization: Bearer <jwt>
  ▼
HTTPBearer (FastAPI security)
  │  raw token string
  ▼
decode_supabase_jwt()          ← python-jose, validates against JWT_SECRET
  │  TokenPayload
  ▼
get_current_user()             ← FastAPI dependency
  │  AuthenticatedUser(user_id, email, role)
  ▼
get_tenant_context()           ← FastAPI dependency, chains off get_current_user
  │  SELECT tenant_id, role FROM profiles WHERE id = user_id
  │  SELECT config FROM tenants WHERE id = tenant_id
  │  (uses service role client — bypasses RLS)
  ▼
TenantContext(tenant_id, role, user_id, tenant_config)
  │
  ▼
Route handler
```

---

# File: `backend/app/core/config.py`

**Status:** Created

**Purpose:**
Centralises all environment variable access behind a typed Pydantic `Settings` class.
Before Day 2, ad-hoc `os.environ` calls were scattered across the codebase. This file
creates a singleton `settings` object that is imported everywhere instead, so a
missing variable is caught at process startup rather than at the moment a route is
first hit.

**Dependencies:**
- `pydantic-settings>=2.2.0` (already in `pyproject.toml`)
- `backend/.env` — must exist and contain the required variables

**Implementation:**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


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

    # Email (optional during development)
    gmail_user: str = ""
    gmail_app_password: str = ""

    # External context APIs (optional during development)
    weather_api_key: str = ""
    news_api_key: str = ""

    # App
    environment: str = "development"
    log_level: str = "INFO"

    # Stored as a comma-separated string so Railway env vars (no array support) work.
    # Use the `allowed_origins` property to get the parsed list.
    allowed_origins_raw: str = "http://localhost:5173"

    # Sentry (optional until Day 10)
    sentry_dsn: str = ""

    @property
    def allowed_origins(self) -> list[str]:
        """Splits ALLOWED_ORIGINS_RAW into a list for CORSMiddleware."""
        return [origin.strip() for origin in self.allowed_origins_raw.split(",")]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


settings = Settings()
```

**Placement:**
New file. Create at `backend/app/core/config.py`. The `backend/app/core/` directory
was created on Day 1 with only an empty `__init__.py`. This file is placed alongside
that `__init__.py`.

**Explanation:**

- `BaseSettings` reads values from `.env` (relative to the working directory where the
  process is started, i.e. `backend/`) and from actual environment variables.
- All fields without a default (`supabase_url`, `supabase_anon_key`,
  `supabase_service_role_key`, `jwt_secret`, `gemini_api_key`, `openrouter_api_key`)
  will raise a `ValidationError` at import time if missing — fail-fast behaviour.
- `allowed_origins_raw` is stored as a plain `str` (not `list[str]`) intentionally.
  `pydantic-settings` v2 treats `list[str]` fields as JSON-complex and attempts
  `json.loads()` on the raw env value before any validator runs. A plain URL like
  `http://localhost:5173` is not valid JSON, causing a `SettingsError` at startup.
  Storing as `str` and exposing the list via a `@property` is the correct workaround.
- `is_production` is used by `main.py` to hide `/docs` and `/redoc` in production.
- Module-level singleton `settings = Settings()` is imported everywhere as
  `from app.core.config import settings`.

**Related Changes:**
- `backend/app/core/auth.py` — imports `settings` for `jwt_secret` and `jwt_algorithm`
- `backend/app/core/tenant.py` — imports `settings` for Supabase URL and keys
- `backend/app/api/routes/health.py` — imports `settings` for `environment`
- `backend/app/main.py` — imports `settings` for `log_level`, `sentry_dsn`,
  `is_production`, `allowed_origins`
- `backend/.env.example` — updated to rename `ALLOWED_ORIGINS` → `ALLOWED_ORIGINS_RAW`
- `backend/.env` — updated to rename `ALLOWED_ORIGINS` → `ALLOWED_ORIGINS_RAW`

---

# File: `backend/app/core/auth.py`

**Status:** Created

**Purpose:**
Provides JWT verification and the FastAPI dependency used by all protected routes to
identify the caller. Without this file every route would need to duplicate token
validation logic.

**Dependencies:**
- `python-jose[cryptography]>=3.3.0` (already in `pyproject.toml`)
- `fastapi` — `Depends`, `HTTPException`, `HTTPBearer`
- `pydantic` — `BaseModel`
- `app.core.config` — `settings` (for `jwt_secret`, `jwt_algorithm`)

**Implementation:**

```python
from typing import Annotated
from uuid import UUID

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
    """Validate and decode a Supabase-issued JWT.
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

**Placement:**
New file. Create at `backend/app/core/auth.py`.

**Explanation:**

- `TokenPayload` models the raw JWT claims. Supabase puts the user UUID in `sub`,
  email in `email`, and the Postgres role in `role`. `aud` is `"authenticated"` for
  normal users.
- `AuthenticatedUser` is the cleaned-up object returned to route handlers — it
  surfaces `user_id` as a proper `UUID` type rather than the raw string `sub`.
- `_bearer = HTTPBearer()` is a module-level singleton. FastAPI's `HTTPBearer`
  automatically extracts the `Authorization: Bearer <token>` header and raises
  `HTTP 403` if the header is absent.
- `decode_supabase_jwt` calls `jose.jwt.decode` with `audience="authenticated"` — this
  is mandatory; Supabase embeds `"aud": "authenticated"` in every user token and
  python-jose will reject it if the audience isn't specified.
- `CurrentUser` is a `typing.Annotated` type alias. Route handlers declare
  `user: CurrentUser` in their signature and FastAPI injects the resolved
  `AuthenticatedUser` automatically.

**Related Changes:**
- `backend/app/core/tenant.py` — imports `AuthenticatedUser` and `get_current_user`
- `backend/app/api/routes/auth.py` — imports `CurrentUser`
- `backend/app/core/config.py` — provides `settings.jwt_secret` and
  `settings.jwt_algorithm` consumed here

---

# File: `backend/app/core/tenant.py`

**Status:** Created

**Purpose:**
Resolves the authenticated user's `tenant_id` and `role` from the `profiles` table
on every request. Provides the two Supabase client factories used throughout the
backend: one that bypasses RLS (service role) for admin/lookup operations, and one
that respects RLS (anon key) for user-scoped queries.

**Dependencies:**
- `supabase>=2.4.0` (already in `pyproject.toml`)
- `fastapi` — `Depends`, `HTTPException`
- `app.core.auth` — `AuthenticatedUser`, `get_current_user`
- `app.core.config` — `settings`
- Supabase `profiles` table — must exist (created in Day 1 migration
  `001_initial_schema.sql`)

**Implementation:**

```python
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from supabase import Client, create_client

from app.core.auth import AuthenticatedUser, get_current_user
from app.core.config import settings


def get_supabase_service_client() -> Client:
    """Returns a Supabase client using the service role key (bypasses RLS).
    Use for admin operations and tenant lookups.
    """
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_supabase_anon_client() -> Client:
    """Returns a Supabase client using the anon key (respects RLS).
    Use for user-scoped queries.
    """
    return create_client(settings.supabase_url, settings.supabase_anon_key)


class TenantContext:
    """Resolved per-request: tenant_id, user role, and tenant config from the database."""

    def __init__(
        self,
        tenant_id: UUID,
        role: str,
        user_id: UUID,
        tenant_config: dict | None = None,
    ) -> None:
        self.tenant_id = tenant_id
        self.role = role
        self.user_id = user_id
        self.tenant_config: dict = tenant_config or {}

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    @property
    def industry(self) -> str:
        """The tenant's industry slug, e.g. 'fmcg_distribution', 'retail', 'pharma'."""
        return self.tenant_config.get("industry", "")

    @property
    def currency(self) -> str:
        """ISO currency code from tenant config, defaults to 'INR'."""
        return self.tenant_config.get("currency", "INR")

    @property
    def language(self) -> str:
        """Primary language for copilot responses, defaults to 'en'."""
        return self.tenant_config.get("language", "en")


def get_tenant_context(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> TenantContext:
    """FastAPI dependency: looks up the authenticated user's tenant_id, role,
    and tenant config from profiles + tenants tables using the service role client.
    Raises 403 if profile doesn't exist.
    """
    client = get_supabase_service_client()
    try:
        profile_result = (
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

    if not profile_result.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User profile not found",
        )

    tenant_id = UUID(profile_result.data["tenant_id"])

    tenant_config: dict = {}
    try:
        tenant_result = (
            client.table("tenants")
            .select("config")
            .eq("id", str(tenant_id))
            .single()
            .execute()
        )
        if tenant_result.data:
            tenant_config = tenant_result.data.get("config") or {}
    except Exception:
        pass  # config is optional — degrade gracefully

    return TenantContext(
        tenant_id=tenant_id,
        role=profile_result.data["role"],
        user_id=user.user_id,
        tenant_config=tenant_config,
    )


TenantCtx = Annotated[TenantContext, Depends(get_tenant_context)]
```

**Placement:**
New file. Create at `backend/app/core/tenant.py`.

**Explanation:**

- `get_supabase_service_client()` uses `supabase_service_role_key` — this key bypasses
  all Row Level Security policies. It is the correct key to use for the tenant lookup
  because the `profiles` RLS policy restricts users to reading their own row, but
  here the backend needs to read any user's row.
- `get_supabase_anon_client()` uses `supabase_anon_key` — respects RLS. Used by future
  service modules that query on behalf of the authenticated user.
- Both factories create a new `Client` per call. Supabase's Python client is not
  thread-safe for shared state across requests, so per-request creation is the safe
  default.
- `TenantContext` is a plain Python class (not Pydantic) because it is resolved at
  request time and never serialised. `is_admin` is a convenience property used by
  admin-only routes. `industry`, `currency`, and `language` are convenience properties
  derived from `tenant_config` — used by `PromptGenerator` to select industry-specific
  LLM addendums without any route handler needing to know the config structure.
- `get_tenant_context` makes **two** Supabase queries per request: one to `profiles`
  (for `tenant_id` + `role`) and one to `tenants` (for `config`). The second query is
  wrapped in a bare `except` — if the tenants table is unreachable or the row is missing,
  the request still succeeds with an empty `tenant_config` (generic prompts apply).
- `get_tenant_context` chains off `get_current_user` via `Depends`. The `try/except`
  wraps the `.single()` call because `supabase-py` raises an exception when
  `.single()` finds zero rows. The explicit `if not profile_result.data` check handles
  any edge case where the exception is not raised.
- `TenantCtx` alias lets route handlers write `tenant: TenantCtx` in their signature.

**Related Changes:**
- `backend/app/api/routes/auth.py` — imports `TenantCtx`
- `backend/app/core/auth.py` — provides `get_current_user` and `AuthenticatedUser`
  consumed here
- Supabase `profiles` table (Day 1) — queried on every authenticated request
- Supabase `tenants` table (Day 1) — queried for `config` JSONB on every authenticated request
- `app/services/prompts/generator.py` (Day 4) — consumes `tenant.tenant_config`

---

# File: `backend/app/api/routes/health.py`

**Status:** Created

**Purpose:**
Provides the `/health` endpoint used by Railway's health check and UptimeRobot. Moves
the inline `@app.get("/health")` stub from the Day 1 `main.py` into a proper router
module with a typed response model that includes `environment` and `timestamp` in
addition to `status`.

**Dependencies:**
- `fastapi` — `APIRouter`
- `pydantic` — `BaseModel`
- `app.core.config` — `settings` (for `environment`)

**Implementation:**

```python
from datetime import UTC, datetime

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    environment: str
    timestamp: str


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Health check endpoint — no auth required.
    Used by UptimeRobot and Railway health checks.
    """
    return HealthResponse(
        status="ok",
        environment=settings.environment,
        timestamp=datetime.now(UTC).isoformat(),
    )
```

**Placement:**
New file. Create at `backend/app/api/routes/health.py`. The `backend/app/api/routes/`
directory was created on Day 1 with only an empty `__init__.py`.

**Explanation:**

- `router = APIRouter(tags=["health"])` — no `prefix` because the route is at the
  root path `/health`. Including a prefix would produce `/health/health`.
- `HealthResponse` has three required `str` fields. FastAPI validates the return value
  against this model before serialising.
- `datetime.now(UTC)` produces a timezone-aware UTC timestamp; `.isoformat()` converts
  it to an RFC 3339 string. This makes the timestamp unambiguous for monitoring tools.
- No authentication required — this endpoint must be reachable before a user token
  exists (Railway startup check, UptimeRobot pings).

**Related Changes:**
- `backend/app/main.py` — imports this router and registers it with
  `app.include_router(health.router)`
- Day 1 `backend/app/main.py` stub's inline `@app.get("/health")` is replaced by this
  router (see `main.py` entry below)

---

# File: `backend/app/api/routes/auth.py`

**Status:** Created

**Purpose:**
Provides `GET /auth/me` — the first protected endpoint. The React frontend calls this
on every page load to confirm the JWT is still valid and to retrieve the user's
`tenant_id` and `role` without a separate database call.

**Dependencies:**
- `fastapi` — `APIRouter`
- `pydantic` — `BaseModel`
- `app.core.auth` — `CurrentUser`
- `app.core.tenant` — `TenantCtx`

**Implementation:**

```python
from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.auth import CurrentUser
from app.core.tenant import TenantCtx

router = APIRouter(prefix="/auth", tags=["auth"])


class MeResponse(BaseModel):
    user_id: UUID
    email: str | None
    tenant_id: UUID
    role: str


@router.get("/me", response_model=MeResponse)
async def me(user: CurrentUser, tenant: TenantCtx) -> MeResponse:
    """Returns the authenticated user's identity and tenant context.
    Called by the React frontend on every page load to validate the session.
    """
    return MeResponse(
        user_id=user.user_id,
        email=user.email,
        tenant_id=tenant.tenant_id,
        role=tenant.role,
    )
```

**Placement:**
New file. Create at `backend/app/api/routes/auth.py`.

> **Naming note:** This file is `auth.py` inside the `routes/` package. In `main.py`
> it is imported as `from app.api.routes import auth as auth_router` to avoid a name
> clash with the `app.core.auth` module.

**Explanation:**

- `router = APIRouter(prefix="/auth", ...)` — the full path of the endpoint is
  `/auth/me` (prefix + route).
- `me(user: CurrentUser, tenant: TenantCtx)` — FastAPI resolves both dependencies
  automatically. `CurrentUser` validates the JWT and produces an `AuthenticatedUser`.
  `TenantCtx` chains off it, queries `profiles`, and produces a `TenantContext`.
- If the JWT is missing or invalid, `HTTPBearer` / `decode_supabase_jwt` raises
  `HTTP 401` or `HTTP 403` before the route handler is reached.
- If the user has no profile row in the database, `get_tenant_context` raises
  `HTTP 403`.
- `MeResponse.email` is `str | None` because Supabase does not guarantee `email` is
  present in the JWT claims for all auth providers (e.g. magic link vs. OAuth).

**Related Changes:**
- `backend/app/main.py` — imports this router and registers it with
  `app.include_router(auth_router.router)`
- `backend/app/core/auth.py` — provides `CurrentUser`
- `backend/app/core/tenant.py` — provides `TenantCtx`

---

# File: `backend/app/main.py`

**Status:** Modified (full replacement of Day 1 stub)

**Purpose:**
Replaces the minimal 8-line Day 1 stub with the full application: stdlib logging,
optional Sentry initialisation, CORS middleware, and router registration. The Day 1
stub had an inline `/health` handler and no middleware.

**Dependencies:**
- `sentry-sdk[fastapi]>=2.5.0` (already in `pyproject.toml`)
- `fastapi` — `FastAPI`, `CORSMiddleware`
- `app.core.config` — `settings`
- `app.api.routes.health` — `router`
- `app.api.routes.auth` — `router`

**Original Day 1 code (replaced):**

```python
from fastapi import FastAPI

app = FastAPI(title="AKARA API", version="0.1.0")

@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

**Replacement code:**

```python
import logging

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth as auth_router
from app.api.routes import health
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
```

**Placement:**
This is a full-file replacement of `backend/app/main.py`. Delete all existing content
and write the replacement code above.

**Explanation:**

- `logging.basicConfig(level=settings.log_level)` — configures the root logger at
  startup. `LOG_LEVEL=INFO` in `.env` gives clean request logs; `DEBUG` in local
  development shows more detail.
- `sentry_sdk.init(...)` is guarded by `if settings.sentry_dsn:` — during development
  the `SENTRY_DSN` env var is empty, so this is a no-op. On Day 10, the DSN is added
  to Railway env vars and Sentry activates automatically with no code change.
- `docs_url="/docs" if not settings.is_production else None` — hides the Swagger UI
  in production to reduce the attack surface. In development and staging it remains
  accessible.
- `CORSMiddleware` with `allow_origins=settings.allowed_origins` — the value comes
  from the `allowed_origins` property on `Settings`, which splits the
  `ALLOWED_ORIGINS_RAW` comma-separated string. In development this is
  `["http://localhost:5173"]` (the Vite dev server). On Railway this env var will
  include the Vercel production URL.
- `auth as auth_router` alias — avoids a name collision with `app.core.auth`.
- Both routers are included with no global prefix. The health router exposes `/health`
  and the auth router (which has its own `/auth` prefix) exposes `/auth/me`.

**Reason for change:**
The Day 1 stub was intentionally minimal — just enough to confirm FastAPI boots.
Day 2 introduces real middleware and routes, so the stub must be replaced in full.

**Related Changes:**
- `backend/app/api/routes/health.py` — registered here
- `backend/app/api/routes/auth.py` — registered here
- `backend/app/core/config.py` — `settings` imported at module level

---

# File: `backend/run.sh`

**Status:** Created

**Purpose:**
Provides a single command to boot the development server so contributors don't need to
remember the full `uvicorn` invocation.

**Dependencies:**
- `uv` — must be installed and the virtual environment must be initialised
  (`uv sync --extra dev` from `backend/`)
- `backend/app/main.py` — entry point

**Implementation:**

```bash
#!/usr/bin/env bash
set -euo pipefail
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Placement:**
New file. Create at `backend/run.sh`. After creating it, mark it executable:

```bash
chmod +x backend/run.sh
```

**Explanation:**

- `set -euo pipefail` — exits immediately on error, treats unset variables as errors,
  and propagates pipe failures.
- `uv run` — runs the command inside the `uv`-managed virtual environment without
  requiring an explicit `source .venv/bin/activate`.
- `--host 0.0.0.0` — binds to all interfaces, which is required inside Docker/Railway.
- `--port 8000` — standard port used throughout the project.
- `--reload` — watches for file changes and hot-reloads. Development only; the
  Railway `Procfile` / Railway start command will not use `--reload`.

**Usage:**

```bash
cd akara/backend
./run.sh
```

**Related Changes:**
- `backend/app/main.py` — the `app` object that uvicorn loads

---

# File: `backend/tests/test_health.py`

**Status:** Created

**Purpose:**
Provides two automated tests for the `/health` endpoint. These are the first
meaningful backend tests and serve as the baseline for the quality gate
(`ruff check . && pytest`).

**Dependencies:**
- `pytest>=8.2.0` (already in `pyproject.toml` dev extras)
- `fastapi.testclient.TestClient` — provided by FastAPI
- `client` fixture — defined in `backend/tests/conftest.py` (Day 1)
- `backend/app/api/routes/health.py` — the code under test

**Implementation:**

```python
from fastapi.testclient import TestClient


def test_health_returns_200(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "timestamp" in data


def test_health_returns_environment(client: TestClient) -> None:
    response = client.get("/health")
    data = response.json()
    assert data["environment"] in {"development", "production", "staging"}
```

**Placement:**
New file. Create at `backend/tests/test_health.py`. The `backend/tests/` directory
and `conftest.py` were created on Day 1.

**Explanation:**

- Both tests use the `client` fixture from `conftest.py`, which creates a
  `TestClient(app)` pointing at the full FastAPI application in-process. No network
  call is made.
- `test_health_returns_200` — asserts the HTTP status, the mandatory `status: "ok"`
  field, and the presence of a `timestamp` key.
- `test_health_returns_environment` — asserts that `environment` is one of the three
  known values. This guards against a typo in the `ENVIRONMENT` env var being silently
  accepted.
- `import TestClient` at the top is all that is needed — the `client` parameter is
  injected by pytest via the fixture in `conftest.py`.

**Related Changes:**
- `backend/tests/conftest.py` (Day 1, unchanged) — provides the `client` fixture
- `backend/app/api/routes/health.py` — the endpoint being tested
- `backend/app/core/config.py` — `settings.environment` is what the second test
  checks

---

# File: `backend/.env.example`

**Status:** Modified

**Purpose:**
Reflects the rename of `ALLOWED_ORIGINS` → `ALLOWED_ORIGINS_RAW` introduced by the
`config.py` bug fix (see below under "Bug Fix").

**Original line (Day 1):**

```
ALLOWED_ORIGINS=http://localhost:5173
```

**Replacement line:**

```
ALLOWED_ORIGINS_RAW=http://localhost:5173
```

**Placement:**
In the `# App` section of `backend/.env.example`, replace the single line shown above.
All other lines remain unchanged.

**Related Changes:**
- `backend/app/core/config.py` — field is `allowed_origins_raw: str`, which
  `pydantic-settings` maps to the env var `ALLOWED_ORIGINS_RAW`
- `backend/.env` — same rename applied

---

# File: `backend/.env`

**Status:** Modified

**Purpose:**
Same rename as `.env.example` — keeps the local development environment in sync with
the updated `Settings` field name.

**Original line (Day 1):**

```
ALLOWED_ORIGINS=http://localhost:5173
```

**Replacement line:**

```
ALLOWED_ORIGINS_RAW=http://localhost:5173
```

**Placement:**
In the `# App` section of `backend/.env`, replace the single line shown above.

> **Note:** `.env` is git-ignored and contains real credentials. Only this one line
> changed; all other lines remain as set during Day 1.

**Related Changes:**
- `backend/app/core/config.py` — reads `ALLOWED_ORIGINS_RAW`
- `backend/.env.example` — same rename applied

---

## Bug Fix: `pydantic-settings` v2 list field parsing

**Encountered during:** Day 2 verification (`uv run pytest` after initial
implementation).

**Root cause:**
`pydantic-settings` v2 classifies `list[str]` fields as "complex types" and calls
`json.loads()` on the raw env var string before any `@field_validator` runs. The value
`http://localhost:5173` is not valid JSON, so `json.loads()` raises `JSONDecodeError`,
which `pydantic-settings` wraps as `SettingsError: error parsing value for field
"allowed_origins"`. The `Settings()` singleton fails to instantiate, making the entire
application unimportable.

**Failed approach:**

```python
# This does NOT work with pydantic-settings v2:
allowed_origins: list[str] = ["http://localhost:5173"]

@field_validator("allowed_origins", mode="before")
@classmethod
def parse_origins(cls, v: str | list) -> list[str]:
    if isinstance(v, str):
        return [origin.strip() for origin in v.split(",")]
    return v
```

pydantic-settings intercepts the value before the validator, so the validator never
runs.

**Fix applied:**
Declare the field as `str`, store the comma-separated raw value, and expose a
`@property` that returns the parsed `list[str]`. FastAPI's `CORSMiddleware` calls
`settings.allowed_origins` which resolves the property at runtime.

```python
# In Settings class:
allowed_origins_raw: str = "http://localhost:5173"

@property
def allowed_origins(self) -> list[str]:
    return [origin.strip() for origin in self.allowed_origins_raw.split(",")]
```

```python
# In main.py — unchanged usage, property is transparent:
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,  # calls the property
    ...
)
```

**Files changed by this fix:**
- `backend/app/core/config.py` — field renamed, validator removed, property added
- `backend/.env.example` — `ALLOWED_ORIGINS` → `ALLOWED_ORIGINS_RAW`
- `backend/.env` — `ALLOWED_ORIGINS` → `ALLOWED_ORIGINS_RAW`

---

## End-of-Day 2 directory tree (new and modified files only)

```
akara/backend/
├── app/
│   ├── api/
│   │   └── routes/
│   │       ├── auth.py          ← NEW
│   │       └── health.py        ← NEW
│   ├── core/
│   │   ├── auth.py              ← NEW
│   │   ├── config.py            ← NEW
│   │   └── tenant.py            ← NEW
│   └── main.py                  ← MODIFIED (full replacement)
├── tests/
│   └── test_health.py           ← NEW
├── .env                         ← MODIFIED (one line)
├── .env.example                 ← MODIFIED (one line)
└── run.sh                       ← NEW (chmod +x)
```

---

## Quality gate results

```
$ cd akara/backend
$ uv run ruff check .
All checks passed!

$ uv run pytest -v
collected 2 items
tests/test_health.py::test_health_returns_200 PASSED
tests/test_health.py::test_health_returns_environment PASSED
2 passed in 0.41s
```

Both gates exit 0. Day 2 is complete.
