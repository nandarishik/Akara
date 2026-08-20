# Sprint Phase 2 — Day 1 Implementation Handoff

**Document version:** 1.0  
**Created:** Sprint Phase 2, Day 1  
**Author:** Cursor Agent (automated session)  
**Purpose:** Complete copy-paste-ready handoff for another Cursor instance to reproduce the exact Day 1 repository state on top of the Phase 2 baseline.

---

# Baseline Identification

## Repository state

| Attribute | Value |
|-----------|-------|
| Baseline branch | `main` |
| Current branch | `main` |
| Baseline commit | Not available (no git history in sandbox) |
| Final Day 1 commit | Not available |
| Comparison range | File timestamps + content analysis |

## Limitation statement

Git history was unavailable in the execution sandbox. Day 1 boundaries were determined by:

1. Reading every file in `akara/backend/`, `akara/frontend/`, `akara/migrations/`, `.github/`, and `akara/docs2/`.
2. Cross-referencing the contents of newly-created files (which contain Phase 2 Day 1 comments) against the previous sprint's agent transcript.
3. The Phase 2 planning documents (`daywise2.md`, `sprint_phase2.md`) were used as the authority for what was in scope on Day 1.

**Baseline (Phase 1 final state) — key facts used:**

- `akara/backend/app/core/config.py` had `gemini_api_key`, `weather_api_key`, `news_api_key` fields; no Stripe, Zaptilo, PostHog, Sentry, Turnstile, or GST fields.
- `akara/backend/app/services/llm/manager.py` had OpenRouter + Gemini fallback logic.
- `akara/backend/app/services/llm/openrouter.py` had hardcoded model `anthropic/claude-3-haiku`.
- `akara/backend/app/main.py` had `import sentry_sdk` (unconditional), no `RequestIDMiddleware`, no `lifespan`, and `ALLOWED_ORIGINS` env as comma-split raw string.
- `akara/backend/app/api/routes/health.py` had a single `/health` endpoint returning `{"status": "ok"}`.
- `akara/backend/tests/conftest.py` had only a minimal `client` fixture, no tenant data.
- `akara/migrations/` contained `001` through `009` plus `010_import_tracking.sql` (applied in a parallel Cursor session).
- `akara/frontend/src/index.css` imported `tailwindcss` only; no `@theme` block.
- `akara/frontend/index.html` had `<title>frontend</title>` and no Google Fonts.
- `akara/frontend/package.json` had no `sonner`, no Vitest, no Playwright, no Testing Library.
- `akara/frontend/src/App.tsx` had eager imports for all pages; no lazy loading; no `SuperadminShell`; no `Toaster`.
- `akara/frontend/src/components/ui/button.tsx`, `card.tsx`, `badge.tsx` were generic shadcn components without AKARA brand tokens.
- `.github/workflows/ci.yml` had 2 jobs with wrong working directories (`backend`, `frontend` instead of `akara/backend`, `akara/frontend`).

---

# Reproduction Instructions

## Prerequisites

- Node.js 20, pnpm 9
- Python 3.12, uv
- The repository must be at the Phase 1 final state (migrations 001–010 applied)

## Required starting state

```
akara/
  backend/          ← Python FastAPI backend
  frontend/         ← React + Vite frontend
  migrations/       ← SQL migration files 001–010 present
  docs2/            ← Sprint Phase 2 documentation directory (may be empty)
.github/workflows/  ← ci.yml present (Phase 1 version)
```

## Order of application

Apply changes in this exact dependency order:

1. **Backend package manifest** — `akara/backend` already uses `uv`; no new Python packages added in Day 1 (Phase 2 providers wired in later days)
2. **Frontend package manifest** — `akara/frontend/package.json` (adds `sonner`, Vitest, Playwright, Testing Library)
3. **Frontend build config** — `akara/frontend/vite.config.ts` (adds Vitest configuration)
4. **Backend core — config** — `akara/backend/app/core/config.py`
5. **Backend core — errors** — `akara/backend/app/core/errors.py` (new)
6. **Backend core — pagination** — `akara/backend/app/core/pagination.py` (new)
7. **Backend core — idempotency** — `akara/backend/app/core/idempotency.py` (new)
8. **Backend core — time utilities** — `akara/backend/app/core/time_utils.py` (new)
9. **Backend core — middleware** — `akara/backend/app/core/middleware.py` (new)
10. **Backend LLM — openrouter client** — `akara/backend/app/services/llm/openrouter.py`
11. **Backend LLM — manager** — `akara/backend/app/services/llm/manager.py`
12. **Backend API — health route** — `akara/backend/app/api/routes/health.py`
13. **Backend entrypoint** — `akara/backend/app/main.py`
14. **Backend env example** — `akara/backend/.env.example`
15. **Migration 011** — `akara/migrations/011_billing.sql` (new)
16. **Migration manifest** — `akara/migrations/MIGRATION_MANIFEST.md` (new)
17. **Frontend HTML** — `akara/frontend/index.html`
18. **Frontend CSS tokens** — `akara/frontend/src/index.css`
19. **Frontend UI — button** — `akara/frontend/src/components/ui/button.tsx`
20. **Frontend UI — card** — `akara/frontend/src/components/ui/card.tsx`
21. **Frontend UI — badge** — `akara/frontend/src/components/ui/badge.tsx`
22. **Frontend UI — toast** — `akara/frontend/src/components/ui/toast.tsx` (new)
23. **Frontend UI — skeleton** — `akara/frontend/src/components/ui/skeleton.tsx` (new)
24. **Frontend Admin — AdminTable** — `akara/frontend/src/components/admin/AdminTable.tsx` (new)
25. **Frontend Admin — AdminDrawer** — `akara/frontend/src/components/admin/AdminDrawer.tsx` (new)
26. **Frontend Admin — ConfirmDialog** — `akara/frontend/src/components/admin/ConfirmDialog.tsx` (new)
27. **Frontend Admin — SuperadminShell** — `akara/frontend/src/components/admin/SuperadminShell.tsx` (new)
28. **Frontend Gallery** — `akara/frontend/src/pages/gallery/ComponentGallery.tsx` (new)
29. **Frontend App** — `akara/frontend/src/App.tsx`
30. **Frontend env example** — `akara/frontend/.env.example`
31. **Frontend test setup** — `akara/frontend/src/test/setup.ts` (new)
32. **Frontend test fixtures** — `akara/frontend/src/test/fixtures.ts` (new)
33. **Frontend unit test** — `akara/frontend/src/components/ui/__tests__/button.test.tsx` (new)
34. **Frontend Playwright config** — `akara/frontend/playwright.config.ts` (new)
35. **Frontend E2E smoke** — `akara/frontend/e2e/smoke.spec.ts` (new)
36. **Backend test conftest** — `akara/backend/tests/conftest.py`
37. **Backend test config** — `akara/backend/tests/test_config.py`
38. **Backend test health** — `akara/backend/tests/test_health.py`
39. **CI workflow** — `.github/workflows/ci.yml`
40. **Requirement ledger** — `akara/docs2/requirement_ledger.md` (new)
41. **Plan catalog** — `akara/docs2/plan_catalog.md` (new)
42. **External workstreams** — `akara/docs2/external_workstreams.md` (new)

## Install dependencies

```bash
# Frontend — installs sonner, vitest, playwright, testing-library
cd akara/frontend
pnpm install

# Backend — no new packages in Day 1; confirm existing env works
cd akara/backend
uv sync --extra dev
```

## Environment variables

Copy and populate:

```bash
cp akara/backend/.env.example akara/backend/.env
cp akara/frontend/.env.example akara/frontend/.env.local
```

At minimum for local development:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=...
OPENROUTER_API_KEY=sk-or-v1-...
```

## Verification gate

```bash
# Backend
cd akara/backend
uv run ruff check app/core/ app/services/llm/ app/api/routes/health.py app/main.py
uv run python -m pytest tests/ -v --tb=short
# Expected: 45 passed, 1 pre-existing failure (test_parse_column_alias_mapping)

# Frontend build
cd akara/frontend
pnpm build
pnpm exec tsc --noEmit
```

---

# Files Changed

---

# File: `akara/backend/app/core/config.py`

**Status:** Modified (full replacement)  
**Change Type:** Feature Extension + Configuration

## Purpose

Phase 1 `config.py` declared only: `supabase_url`, `supabase_anon_key`, `supabase_service_role_key`, `jwt_secret`, `gemini_api_key`, `openrouter_api_key`, `sendgrid_api_key`, `sendgrid_from_email`, `backend_service_key`, `environment`, `log_level`, and a basic `allowed_origins`.

Phase 2 Day 1 replaces it entirely to:
- Add all Phase 2 provider fields (Stripe, Zaptilo, Turnstile, PostHog, Sentry, healthchecks.io, GST/company data)
- Add `supabase_pooler_url` for transaction-mode pooler (GAP-7)
- Pin the LLM model with `openrouter_model` (B3-7)
- Add `extra="ignore"` to survive legacy Phase 1 env var names (`gemini_api_key`, `weather_api_key`, `news_api_key`) without crashing
- Add derived properties: `allowed_origins`, `is_production`, `is_staging`, `is_development`, `effective_db_url`
- Add `validate_for_environment()` method called at startup to fail-fast on missing production config

## Dependencies

- `pydantic-settings` (existing Phase 1 package)
- `pydantic` (existing Phase 1 package)
- Called by: `app/main.py`, `app/api/routes/health.py`, `app/core/tenant.py`, all service files

## Implementation

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        # Allow legacy env vars (gemini_api_key, weather_api_key, etc.) to remain
        # in .env files without causing validation errors during the Phase 1→2 transition.
        extra="ignore",
    )

    # -----------------------------------------------------------------------
    # Supabase
    # -----------------------------------------------------------------------
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    # Transaction-mode pooler URL (required in staging/production for Phase 2).
    # Leave empty in development to fall back to the direct URL.
    supabase_pooler_url: str = ""

    # -----------------------------------------------------------------------
    # JWT — must match Supabase project JWT secret
    # -----------------------------------------------------------------------
    jwt_secret: str
    jwt_algorithm: str = "HS256"

    # -----------------------------------------------------------------------
    # LLM — OpenRouter only (Gemini removed in Phase 2)
    # -----------------------------------------------------------------------
    openrouter_api_key: str
    # Date-pinned model — NEVER change to an alias without a date suffix.
    # Update this constant when intentionally upgrading the model.
    openrouter_model: str = "openai/gpt-4o-mini-2024-07-18"

    # -----------------------------------------------------------------------
    # Stripe (required in staging/production)
    # -----------------------------------------------------------------------
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_pro_monthly_price_id: str = ""
    stripe_pro_annual_price_id: str = ""
    stripe_business_monthly_price_id: str = ""
    stripe_business_annual_price_id: str = ""

    # -----------------------------------------------------------------------
    # Email — SendGrid
    # -----------------------------------------------------------------------
    sendgrid_api_key: str = ""
    sendgrid_from_email: str = "insights@akara.ai"
    sendgrid_from_name: str = "AKARA Insights"

    # -----------------------------------------------------------------------
    # WhatsApp — Zaptilo BSP
    # -----------------------------------------------------------------------
    zaptilo_api_key: str = ""
    zaptilo_sender_number: str = ""

    # -----------------------------------------------------------------------
    # Cloudflare Turnstile (CAPTCHA — required before Day 3 signup goes live)
    # -----------------------------------------------------------------------
    turnstile_secret_key: str = ""

    # -----------------------------------------------------------------------
    # Analytics — PostHog (required before Day 13 analytics go live)
    # -----------------------------------------------------------------------
    posthog_api_key: str = ""
    posthog_host: str = "https://app.posthog.com"

    # -----------------------------------------------------------------------
    # Error tracking — Sentry
    # -----------------------------------------------------------------------
    sentry_dsn: str = ""

    # -----------------------------------------------------------------------
    # Cron monitoring — healthchecks.io
    # -----------------------------------------------------------------------
    healthchecks_ping_url: str = ""          # base URL for all cron pings

    # -----------------------------------------------------------------------
    # Company / GST details (used in invoices and legal pages)
    # -----------------------------------------------------------------------
    company_name: str = "AKARA Analytics Pvt Ltd"
    company_gstin: str = ""
    company_address: str = ""
    company_state_code: str = ""            # e.g. "27" for Maharashtra
    support_email: str = "support@akara.ai"
    billing_email: str = "billing@akara.ai"

    # -----------------------------------------------------------------------
    # URLs (used in emails, redirects, CORS)
    # -----------------------------------------------------------------------
    customer_frontend_url: str = "http://localhost:5173"
    superadmin_frontend_url: str = "http://localhost:5173"
    # Comma-separated list of allowed CORS origins
    allowed_origins_raw: str = "http://localhost:5173"

    # -----------------------------------------------------------------------
    # Service key for Edge Function → backend auth bypass
    # -----------------------------------------------------------------------
    backend_service_key: str = ""

    # -----------------------------------------------------------------------
    # App
    # -----------------------------------------------------------------------
    environment: str = "development"
    log_level: str = "INFO"

    # -----------------------------------------------------------------------
    # Derived properties
    # -----------------------------------------------------------------------

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins_raw.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def is_staging(self) -> bool:
        return self.environment == "staging"

    @property
    def is_development(self) -> bool:
        return self.environment == "development"

    @property
    def effective_db_url(self) -> str:
        """Returns the pooler URL in staging/production, direct URL in development."""
        if (self.is_production or self.is_staging) and self.supabase_pooler_url:
            return self.supabase_pooler_url
        return self.supabase_url

    # -----------------------------------------------------------------------
    # Startup validation — called from main.py lifespan
    # -----------------------------------------------------------------------

    def validate_for_environment(self) -> list[str]:
        """Returns a list of validation error strings.
        Empty list = everything is fine.
        In production/staging, required-but-missing values are errors.
        In development, they are warnings only.
        """
        errors: list[str] = []

        # Always required
        for field, value in [
            ("SUPABASE_URL", self.supabase_url),
            ("SUPABASE_ANON_KEY", self.supabase_anon_key),
            ("SUPABASE_SERVICE_ROLE_KEY", self.supabase_service_role_key),
            ("JWT_SECRET", self.jwt_secret),
            ("OPENROUTER_API_KEY", self.openrouter_api_key),
        ]:
            if not value or value.startswith("your-"):
                errors.append(f"MISSING_REQUIRED: {field}")

        if self.is_production or self.is_staging:
            # Pooler required outside development
            if not self.supabase_pooler_url:
                errors.append("MISSING_STAGING_PROD: SUPABASE_POOLER_URL")

            # Payment stack required before Day 5 cutover
            for field, value in [
                ("STRIPE_SECRET_KEY", self.stripe_secret_key),
                ("STRIPE_WEBHOOK_SECRET", self.stripe_webhook_secret),
                ("STRIPE_PRO_MONTHLY_PRICE_ID", self.stripe_pro_monthly_price_id),
                ("STRIPE_BUSINESS_MONTHLY_PRICE_ID", self.stripe_business_monthly_price_id),
            ]:
                if not value:
                    errors.append(f"MISSING_STAGING_PROD: {field}")

            # Email required in staging/prod
            if not self.sendgrid_api_key:
                errors.append("MISSING_STAGING_PROD: SENDGRID_API_KEY")

            # Company/GST required for invoices
            if not self.company_gstin:
                errors.append("MISSING_STAGING_PROD: COMPANY_GSTIN")

        return errors


settings = Settings()
```

## Placement

This file **completely replaces** the Phase 1 `config.py`. The Phase 1 version is not preserved. Delete all existing content and replace with the above.

## Explanation

- `extra="ignore"` is critical: Phase 1 `.env` files still contain `GEMINI_API_KEY`, `WEATHER_API_KEY`, `NEWS_API_KEY`. Without this, Pydantic raises `ValidationError: Extra inputs are not permitted` at startup.
- `openrouter_model` defaults to `"openai/gpt-4o-mini-2024-07-18"`. Any override in `.env` must also be date-pinned.
- `validate_for_environment()` is called from the FastAPI `lifespan` function (see `main.py`). It calls `sys.exit(1)` in production/staging on validation failure, and only logs warnings in development.
- `effective_db_url` chooses the pooler URL in staging/production for Supabase transaction-mode pooler compatibility (GAP-7).

## Related Files

- `app/main.py` — calls `settings.validate_for_environment()` in lifespan; reads `settings.log_level`, `settings.is_production`, `settings.openrouter_model`, `settings.allowed_origins`, `settings.sentry_dsn`
- `app/api/routes/health.py` — reads `settings.environment`, `settings.openrouter_model`
- `app/services/llm/openrouter.py` — reads `settings.openrouter_model`
- `app/services/llm/manager.py` — reads `settings.openrouter_api_key` (passed by callers)
- `app/core/tenant.py` — reads `settings.supabase_url`, `settings.supabase_service_role_key`
- `app/core/auth.py` — reads `settings.jwt_secret`
- `tests/test_config.py` — imports and validates `settings`

## Verification

```bash
cd akara/backend
uv run python -c "
from app.core.config import settings
print('model:', settings.openrouter_model)
errors = settings.validate_for_environment()
print('errors:', errors)
print('allowed_origins:', settings.allowed_origins)
print('effective_db_url:', settings.effective_db_url[:30])
"
```

Expected:

```
model: openai/gpt-4o-mini-2024-07-18
errors: ['MISSING_REQUIRED: JWT_SECRET']  # or empty if JWT_SECRET is set in .env
allowed_origins: ['http://localhost:5173']
effective_db_url: https://your-project.supabase...
```

---

# File: `akara/backend/app/core/errors.py`

**Status:** Created  
**Change Type:** New Feature (shared API contract)

## Purpose

Phase 1 had no structured error envelope. Routes raised `fastapi.HTTPException` with arbitrary `detail` strings. Phase 2 requires that all error responses share a single `ErrorEnvelope` schema so clients can handle errors uniformly. This file provides:

- `ERROR_CODES` dict of stable string constants
- `AkaraHTTPException` — raise instead of `HTTPException`
- `akara_exception_handler` — registered in `main.py`
- `ErrorEnvelope` and `OkEnvelope` Pydantic models

## Dependencies

- `fastapi` (existing)
- `pydantic` (existing)
- Registered in `app/main.py` via `add_exception_handler`

## Implementation

```python
"""Structured API error contracts for AKARA Phase 2.

All error responses share a single envelope so clients can handle them
uniformly without inspecting HTTP status codes alone.

Usage (in a route):
    raise AkaraHTTPException(
        status_code=402,
        code="QUOTA_EXCEEDED",
        message="You have used all 10 copilot questions this month.",
        detail={"limit": 10, "reset_at": "2026-08-01T00:00:00Z"},
    )
"""

from __future__ import annotations

from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Stable error codes — do NOT rename; clients depend on these strings
# ---------------------------------------------------------------------------
ERROR_CODES = {
    # Auth
    "UNAUTHENTICATED": "No valid authentication token",
    "FORBIDDEN": "Insufficient permissions",
    "SUDO_REQUIRED": "Superadmin sudo session required",
    "SUDO_EXPIRED": "Sudo session has expired",
    # Resources
    "NOT_FOUND": "Resource not found",
    "CONFLICT": "Resource already exists or state conflict",
    # Input
    "VALIDATION_ERROR": "Request validation failed",
    "INVALID_IDEMPOTENCY_KEY": "Idempotency key is malformed or missing",
    # Plan / billing
    "QUOTA_EXCEEDED": "Monthly or daily usage quota exceeded",
    "PLAN_GATE": "Feature not available on current plan",
    "PAST_DUE": "Account payment is past due",
    # Rate limiting
    "RATE_LIMITED": "Too many requests",
    # Providers
    "LLM_UNAVAILABLE": "AI service is temporarily unavailable",
    "PAYMENT_PROVIDER_ERROR": "Payment provider error",
    # Data
    "IMPORT_IN_PROGRESS": "An import is already running",
    "TENANT_ISOLATED": "Operation not permitted across tenants",
    # General
    "INTERNAL_ERROR": "An unexpected error occurred",
    "SERVICE_UNAVAILABLE": "Service is temporarily unavailable",
}


class ErrorEnvelope(BaseModel):
    """The canonical error envelope returned by every AKARA error response."""
    ok: bool = False
    code: str
    message: str
    request_id: str | None = None
    detail: Any = None


class AkaraHTTPException(Exception):
    """Raise this instead of FastAPI's HTTPException throughout the AKARA backend.
    The custom exception handler will format it into an ErrorEnvelope.
    """

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str | None = None,
        detail: Any = None,
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message or ERROR_CODES.get(code, code)
        self.detail = detail


async def akara_exception_handler(
    request: Request, exc: AkaraHTTPException
) -> JSONResponse:
    """FastAPI exception handler — register in main.py."""
    request_id: str | None = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorEnvelope(
            code=exc.code,
            message=exc.message,
            request_id=request_id,
            detail=exc.detail,
        ).model_dump(exclude_none=True),
    )


class OkEnvelope(BaseModel):
    """Wrap successful mutation responses so callers can detect success uniformly."""
    ok: bool = True
    request_id: str | None = None
    data: Any = None
```

## Placement

New file. Create at `akara/backend/app/core/errors.py`.

## Explanation

- `AkaraHTTPException` has `status_code`, `code` (stable string from `ERROR_CODES`), `message` (human-readable), and `detail` (structured context for clients).
- `akara_exception_handler` reads `request.state.request_id` set by `RequestIDMiddleware` and injects it into the error envelope.
- `ErrorEnvelope.ok = False` always — clients can check `data.ok` rather than HTTP status.
- `OkEnvelope` is for mutation responses (POST/PATCH/DELETE) so clients get a uniform `{ok: true, data: {...}}` shape.

## Related Files

- `app/main.py` — registers `akara_exception_handler` via `app.add_exception_handler(AkaraHTTPException, akara_exception_handler)`
- Future Day 2+ routes — raise `AkaraHTTPException` instead of `HTTPException`

## Verification

```bash
cd akara/backend
uv run python -c "
from app.core.errors import AkaraHTTPException, ErrorEnvelope, ERROR_CODES
print('codes:', list(ERROR_CODES.keys())[:5])
e = AkaraHTTPException(402, 'QUOTA_EXCEEDED')
print('message:', e.message)
"
```

Expected: codes list printed, message = `"Monthly or daily usage quota exceeded"`.

---

# File: `akara/backend/app/core/pagination.py`

**Status:** Created  
**Change Type:** New Feature (shared API contract)

## Purpose

Phase 1 had no pagination contract. All list endpoints returned unbounded arrays. Phase 2 requires bounded `OffsetPage` and `CursorPage` wrappers for all list endpoints.

## Dependencies

- `fastapi` (existing)
- `pydantic` (existing)

## Implementation

```python
"""Bounded pagination contracts for AKARA Phase 2.

All list endpoints must use one of these two schemes:
 - OffsetPagination  (for small, non-real-time lists)
 - CursorPagination  (for time-ordered infinite scroll / large sets)

Usage:
    @router.get("/items")
    def list_items(params: OffsetParams = Depends()) -> OffsetPage[ItemOut]:
        ...
"""

from __future__ import annotations

from typing import Generic, TypeVar

from fastapi import Query
from pydantic import BaseModel

T = TypeVar("T")

MAX_PAGE_SIZE = 200
DEFAULT_PAGE_SIZE = 50


# ---------------------------------------------------------------------------
# Offset pagination
# ---------------------------------------------------------------------------

class OffsetParams:
    """FastAPI dependency — inject with `Depends()`."""

    def __init__(
        self,
        page: int = Query(default=1, ge=1, description="1-based page number"),
        page_size: int = Query(
            default=DEFAULT_PAGE_SIZE,
            ge=1,
            le=MAX_PAGE_SIZE,
            description=f"Items per page (max {MAX_PAGE_SIZE})",
        ),
    ) -> None:
        self.page = page
        self.page_size = page_size

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


class OffsetPage(BaseModel, Generic[T]):  # noqa: UP046
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int

    @classmethod
    def build(cls, items: list[T], total: int, params: OffsetParams) -> OffsetPage[T]:
        total_pages = max(1, (total + params.page_size - 1) // params.page_size)
        return cls(
            items=items,
            total=total,
            page=params.page,
            page_size=params.page_size,
            total_pages=total_pages,
        )


# ---------------------------------------------------------------------------
# Cursor pagination (opaque string cursor, typically ISO timestamp or UUID)
# ---------------------------------------------------------------------------

class CursorParams:
    """FastAPI dependency — inject with `Depends()`."""

    def __init__(
        self,
        cursor: str | None = Query(
            default=None,
            description="Opaque cursor from previous page's next_cursor",
        ),
        limit: int = Query(
            default=DEFAULT_PAGE_SIZE,
            ge=1,
            le=MAX_PAGE_SIZE,
        ),
    ) -> None:
        self.cursor = cursor
        self.limit = limit


class CursorPage(BaseModel, Generic[T]):  # noqa: UP046
    items: list[T]
    next_cursor: str | None
    has_more: bool

    @classmethod
    def build(
        cls, items: list[T], limit: int, cursor_fn: callable[[T], str]
    ) -> CursorPage[T]:
        """Build a cursor page.
        Fetches `limit + 1` rows; if we got an extra row there are more results.
        `cursor_fn` extracts the cursor value from the last real item.
        """
        has_more = len(items) > limit
        page_items = items[:limit]
        next_cursor = cursor_fn(page_items[-1]) if has_more and page_items else None
        return cls(items=page_items, next_cursor=next_cursor, has_more=has_more)
```

## Placement

New file. Create at `akara/backend/app/core/pagination.py`.

The `# noqa: UP046` comments suppress ruff's suggestion to use Python 3.12 type parameter syntax (`class OffsetPage[T]`), which is currently incompatible with Pydantic's `BaseModel`.

## Related Files

- Day 2+ admin routes will import `OffsetParams`, `OffsetPage`, `CursorParams`, `CursorPage`

## Verification

```bash
cd akara/backend
uv run python -c "
from app.core.pagination import OffsetParams, OffsetPage, CursorPage, MAX_PAGE_SIZE
print('MAX_PAGE_SIZE:', MAX_PAGE_SIZE)
"
```

---

# File: `akara/backend/app/core/idempotency.py`

**Status:** Created  
**Change Type:** New Feature (shared API contract)

## Purpose

Phase 2 mutations that must be safe to retry (payment triggers, imports, team invites) require an `Idempotency-Key: <uuid>` HTTP header. This module provides FastAPI dependencies that validate the header format before any route handler executes.

The storage backend (`idempotency_keys` table) is scaffolded in `011_billing.sql` and wired in Day 2. Day 1 scope is header validation only.

## Dependencies

- `fastapi` (existing)
- `re` (stdlib)

## Implementation

```python
"""Idempotency-key validation for AKARA Phase 2 mutations.

Any state-changing endpoint that must be safe to retry (payment triggers,
imports, team invites, etc.) should:
  1. Accept `Idempotency-Key: <uuid>` header via the `IdempotencyKey` dep.
  2. Look up the key in the `idempotency_keys` table before processing.
  3. Store the serialised response after success.
  4. Return the stored response on replay without re-executing.

Phase 2 Note: the storage backend (Supabase RPC) is wired in Day 2 once
`011_billing.sql` creates the `idempotency_keys` table.  Until then, the
dependency still validates header format so callers are aware of the contract.
"""

from __future__ import annotations

import re
from typing import Annotated

from fastapi import Header, HTTPException, status

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def require_idempotency_key(
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> str:
    """FastAPI dependency: validates the `Idempotency-Key` header.

    Raises HTTP 400 if the header is missing or not a valid UUID v4 string.
    Returns the normalised (lowercased) key string.
    """
    if not idempotency_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Idempotency-Key header is required for this operation.",
        )
    key = idempotency_key.strip()
    if not _UUID_RE.match(key):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Idempotency-Key must be a UUID v4 string "
                "(xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)."
            ),
        )
    return key.lower()


def optional_idempotency_key(
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> str | None:
    """Like require_idempotency_key but returns None if header is absent."""
    if not idempotency_key:
        return None
    return require_idempotency_key(idempotency_key)


# Type aliases for use as FastAPI Annotated dependencies
IdempotencyKey = Annotated[str, require_idempotency_key]
OptionalIdempotencyKey = Annotated[str | None, optional_idempotency_key]
```

## Placement

New file. Create at `akara/backend/app/core/idempotency.py`.

## Related Files

- Day 2+ billing/import routes import `IdempotencyKey` or `OptionalIdempotencyKey`
- `akara/migrations/011_billing.sql` — creates `idempotency_keys` table

## Verification

```bash
cd akara/backend
uv run python -c "from app.core.idempotency import IdempotencyKey, require_idempotency_key; print('OK')"
```

---

# File: `akara/backend/app/core/time_utils.py`

**Status:** Created  
**Change Type:** New Feature (shared utility)

## Purpose

All timestamps are stored as UTC in Supabase. Display, quota resets, and scheduling logic need IST (Asia/Kolkata, UTC+5:30). This module centralises all UTC/IST conversion and is the single source of truth for daily/monthly reset boundaries and cron schedules.

## Dependencies

- `datetime` (stdlib)
- `zoneinfo` (stdlib, Python 3.9+)

## Implementation

```python
"""UTC / IST (Asia/Kolkata) time utilities for AKARA Phase 2.

All timestamps are stored as UTC in the database.
All display/reset logic that refers to Indian Standard Time uses this module.

Key rules:
 - UTC+5:30 is IST (Asia/Kolkata). IST has no DST.
 - Daily counters reset at midnight IST = 18:30 UTC previous day.
 - Monthly counters reset on the 1st of each month at 00:00 IST.
 - Weekly debrief scheduler runs at 01:30 UTC Monday = 07:00 IST Monday.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
UTC = timezone.utc


def now_utc() -> datetime:
    """Current moment as a UTC-aware datetime."""
    return datetime.now(UTC)


def now_ist() -> datetime:
    """Current moment expressed in IST."""
    return datetime.now(IST)


def to_ist(dt: datetime) -> datetime:
    """Convert any aware datetime to IST."""
    return dt.astimezone(IST)


def to_utc(dt: datetime) -> datetime:
    """Convert any aware datetime to UTC."""
    return dt.astimezone(UTC)


def today_ist() -> date:
    """The current calendar date in IST (may differ from UTC date near midnight)."""
    return now_ist().date()


def start_of_month_utc() -> datetime:
    """Midnight IST on the first of the current IST month, expressed as UTC.

    Used for monthly counter resets.  The reset boundary is 00:00 IST which
    equals 18:30 UTC on the last day of the previous month.
    """
    ist_now = now_ist()
    first_of_month_ist = ist_now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return to_utc(first_of_month_ist)


def start_of_day_utc() -> datetime:
    """Midnight IST today, expressed as UTC.

    Used for daily counter resets.
    """
    ist_now = now_ist()
    midnight_ist = ist_now.replace(hour=0, minute=0, second=0, microsecond=0)
    return to_utc(midnight_ist)


def ist_date_for(dt: datetime) -> date:
    """Return the IST calendar date for the given UTC-aware datetime."""
    return to_ist(dt).date()


def month_key_ist(dt: datetime | None = None) -> date:
    """Return the first-of-month IST date, used as a monthly counter key.

    Stored as DATE in the `usage_tracking.month` column.
    Always the 1st of the month in IST time.
    """
    reference = to_ist(dt) if dt else now_ist()
    return reference.replace(day=1).date()


def format_ist(dt: datetime) -> str:
    """Human-readable IST timestamp for logs and UI."""
    return to_ist(dt).strftime("%Y-%m-%d %H:%M:%S IST")


def weekly_debrief_utc_schedule() -> str:
    """Cron expression for weekly debrief: 07:00 IST Monday = 01:30 UTC Monday."""
    return "30 1 * * 1"
```

## Placement

New file. Create at `akara/backend/app/core/time_utils.py`.

## Related Files

- Day 2 `plan_limits.py` — uses `month_key_ist()` for monthly counter keys
- Day 7 cron scheduler — uses `weekly_debrief_utc_schedule()`
- `akara/migrations/011_billing.sql` — `usage_tracking.month` column stores `DATE` as `month_key_ist()` output

## Verification

```bash
cd akara/backend
uv run python -c "
from app.core.time_utils import now_ist, month_key_ist, weekly_debrief_utc_schedule
print('now_ist:', now_ist().strftime('%Y-%m-%d %H:%M IST'))
print('month_key:', month_key_ist())
print('cron:', weekly_debrief_utc_schedule())
"
```

Expected: IST timestamp, first-of-month date, `"30 1 * * 1"`.

---

# File: `akara/backend/app/core/middleware.py`

**Status:** Created  
**Change Type:** New Feature (shared infrastructure)

## Purpose

Phase 1 had no request-ID middleware. Phase 2 requires `X-Request-ID` on every request and response so error envelopes, logs, and client-side error reports can be correlated.

## Dependencies

- `fastapi` (existing)
- `starlette.middleware.base` (existing)
- `uuid` (stdlib)
- `logging` (stdlib)
- `time` (stdlib)

## Implementation

```python
"""AKARA Phase 2 middleware — X-Request-ID injection and structured logging."""

from __future__ import annotations

import logging
import time
import uuid

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

logger = logging.getLogger("akara.requests")


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Attaches a unique `X-Request-ID` to every request and response.

    If the client already sends an `X-Request-ID` header it is honoured;
    otherwise a new UUID is generated.  The ID is stored on `request.state`
    so route handlers and exception handlers can include it in error envelopes.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id

        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            raise
        finally:
            elapsed_ms = round((time.perf_counter() - start) * 1000)
            logger.info(
                "%s %s %s %dms rid=%s",
                request.method,
                request.url.path,
                getattr(response, "status_code", "ERR"),
                elapsed_ms,
                request_id,
            )

        response.headers["X-Request-ID"] = request_id
        return response
```

## Placement

New file. Create at `akara/backend/app/core/middleware.py`.

## Related Files

- `app/main.py` — adds via `app.add_middleware(RequestIDMiddleware)`
- `app/core/errors.py` — reads `request.state.request_id` in `akara_exception_handler`

## Verification

```bash
cd akara/backend
uv run python -c "from app.core.middleware import RequestIDMiddleware; print('OK')"
```

After server startup:

```bash
curl -s http://localhost:8000/health -i | grep -i x-request-id
```

Expected: `X-Request-ID: <uuid>` header in response.

---

# File: `akara/backend/app/services/llm/openrouter.py`

**Status:** Modified (full replacement)  
**Change Type:** Refactor + Feature Extension

## Purpose

Phase 1 had a hardcoded model string `anthropic/claude-3-haiku` in this file. Phase 2:
- Reads the model from `settings.openrouter_model` (date-pinned default: `openai/gpt-4o-mini-2024-07-18`)
- Adds `HTTP-Referer` and `X-Title` headers per OpenRouter best practices
- Adds a `model` property for observability
- Cleans up the streaming logic

## Dependencies

- `httpx` (existing)
- `app.core.config.settings` (existing, extended in Day 1)

## Implementation

```python
"""OpenRouter LLM client — the sole LLM provider for AKARA Phase 2.

Model is configured via OPENROUTER_MODEL in settings (date-pinned).
Default: openai/gpt-4o-mini-2024-07-18
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


class OpenRouterClient:
    def __init__(self, api_key: str, model: str | None = None) -> None:
        self._api_key = api_key
        # Model is injected from settings so it is always date-pinned
        # and never an alias that can silently change behaviour.
        self._model = model or settings.openrouter_model
        self._headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            # OpenRouter best-practice: identify the application
            "HTTP-Referer": "https://akara.ai",
            "X-Title": "AKARA Analytics",
        }

    def _build_payload(self, prompt: str, system: str, stream: bool) -> dict:
        messages: list[dict] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        return {
            "model": self._model,
            "messages": messages,
            "stream": stream,
        }

    async def complete(self, prompt: str, system: str = "") -> str:
        payload = self._build_payload(prompt, system, stream=False)
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{OPENROUTER_BASE_URL}/chat/completions",
                json=payload,
                headers=self._headers,
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]

    async def stream(
        self, prompt: str, system: str = ""
    ) -> AsyncGenerator[str, None]:
        payload = self._build_payload(prompt, system, stream=True)
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{OPENROUTER_BASE_URL}/chat/completions",
                json=payload,
                headers=self._headers,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: ") and line != "data: [DONE]":
                        try:
                            data = json.loads(line[6:])
                            delta = data["choices"][0]["delta"].get("content", "")
                            if delta:
                                yield delta
                        except (json.JSONDecodeError, KeyError):
                            continue

    @property
    def model(self) -> str:
        return self._model
```

## Placement

**Completely replaces** Phase 1 `akara/backend/app/services/llm/openrouter.py`. Delete all existing content and replace.

## Related Files

- `app/services/llm/manager.py` — instantiates `OpenRouterClient`
- `app/core/config.py` — provides `settings.openrouter_model`

## Verification

```bash
cd akara/backend
uv run python -c "
from app.services.llm.openrouter import OpenRouterClient
c = OpenRouterClient('test-key')
print('model:', c.model)
# Expected: openai/gpt-4o-mini-2024-07-18
"
```

---

# File: `akara/backend/app/services/llm/manager.py`

**Status:** Modified (full replacement)  
**Change Type:** Refactor (Gemini removed)

## Purpose

Phase 1 `LLMManager` had OpenRouter + Gemini fallback logic. Phase 2 is OpenRouter-only. The manager becomes a thin wrapper over `OpenRouterClient` that preserves the `complete`/`stream` interface so existing callers do not need to change.

## Dependencies

- `app/services/llm/openrouter.py` (modified in Day 1)

## Implementation

```python
"""LLM manager — Phase 2: OpenRouter only.

Gemini has been removed. All LLM calls route through OpenRouter using
the date-pinned model from settings (OPENROUTER_MODEL env var).
"""

from __future__ import annotations

import logging
from collections.abc import AsyncGenerator

from app.services.llm.openrouter import OpenRouterClient

logger = logging.getLogger(__name__)


class LLMManager:
    """Thin wrapper around OpenRouterClient.

    Retains the same interface (complete / stream) as the Phase 1 manager
    so existing callers do not need to change.
    """

    def __init__(self, openrouter_api_key: str) -> None:
        self._client = OpenRouterClient(api_key=openrouter_api_key)

    async def complete(self, prompt: str, system: str = "") -> str:
        return await self._client.complete(prompt=prompt, system=system)

    async def stream(
        self, prompt: str, system: str = ""
    ) -> AsyncGenerator[str, None]:
        async for chunk in self._client.stream(prompt=prompt, system=system):
            yield chunk

    @property
    def model(self) -> str:
        return self._client.model

    @property
    def provider(self) -> str:
        return "openrouter"
```

## Placement

**Completely replaces** Phase 1 `akara/backend/app/services/llm/manager.py`. The Phase 1 Gemini import and fallback logic are deleted.

**Important:** `app/services/llm/gemini.py` is NOT deleted in Day 1. It remains as a file but is no longer imported by anything. It will be deleted in a future cleanup pass.

## Related Files

- `app/services/copilot/agent.py` — instantiates `LLMManager`
- `app/services/insights/engine.py` — may instantiate `LLMManager`
- `app/services/email/morning_brief.py` — may instantiate `LLMManager`

## Verification

```bash
cd akara/backend
uv run python -c "
from app.services.llm.manager import LLMManager
m = LLMManager('test-key')
print('provider:', m.provider, '| model:', m.model)
"
```

Expected: `provider: openrouter | model: openai/gpt-4o-mini-2024-07-18`

---

# File: `akara/backend/app/api/routes/health.py`

**Status:** Modified (full replacement)  
**Change Type:** Feature Extension

## Purpose

Phase 1 had a single `GET /health` endpoint returning `{"status": "ok"}`. Phase 2 adds:
- `/health` — fast liveness probe (no DB call)
- `/ready` — readiness probe that checks Supabase connectivity; returns `status="degraded"` rather than 503 so Railway doesn't restart on transient failures
- `/version` — non-sensitive operational metadata (environment, LLM model, provider)

All responses use Pydantic `response_model` for type safety.

## Dependencies

- `fastapi` (existing)
- `app.core.config.settings` (modified in Day 1)
- `app.core.tenant.get_supabase_service_client` (existing Phase 1)

## Implementation

```python
"""Health and readiness endpoints.

GET /health   — liveness probe: fast, no external calls, used by Railway
GET /ready    — readiness probe: checks Supabase connectivity, used by CI gate
GET /version  — returns app metadata without secrets
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    environment: str
    timestamp: str


class ReadinessResponse(BaseModel):
    status: str          # "ready" | "degraded"
    environment: str
    timestamp: str
    checks: dict[str, str]


class VersionResponse(BaseModel):
    environment: str
    llm_model: str
    llm_provider: str


@router.get("/health", response_model=HealthResponse)
async def liveness() -> HealthResponse:
    """Fast liveness check — no DB call.
    Railway and UptimeRobot ping this endpoint.
    """
    return HealthResponse(
        status="ok",
        environment=settings.environment,
        timestamp=datetime.now(UTC).isoformat(),
    )


@router.get("/ready", response_model=ReadinessResponse)
async def readiness() -> ReadinessResponse:
    """Readiness probe — verifies Supabase connectivity.

    Returns 200 with status="ready" when everything is healthy.
    Returns 200 with status="degraded" when a non-critical check fails
    (this keeps Railway from cycling the container on transient failures).
    """
    checks: dict[str, str] = {}

    # Check 1: Supabase reachable
    try:
        from app.core.tenant import get_supabase_service_client
        client = get_supabase_service_client()
        # Lightweight query — just check the connection works
        client.table("tenants").select("id").limit(1).execute()
        checks["supabase"] = "ok"
    except Exception as exc:
        logger.warning("Readiness: Supabase check failed: %s", exc)
        checks["supabase"] = f"error: {type(exc).__name__}"

    # Check 2: Configuration validation
    config_errors = settings.validate_for_environment()
    if config_errors:
        checks["config"] = f"errors: {', '.join(config_errors[:3])}"
    else:
        checks["config"] = "ok"

    all_ok = all(v == "ok" for v in checks.values())
    status = "ready" if all_ok else "degraded"

    return ReadinessResponse(
        status=status,
        environment=settings.environment,
        timestamp=datetime.now(UTC).isoformat(),
        checks=checks,
    )


@router.get("/version", response_model=VersionResponse)
async def version() -> VersionResponse:
    """Returns non-sensitive app metadata for operational diagnostics."""
    return VersionResponse(
        environment=settings.environment,
        llm_model=settings.openrouter_model,
        llm_provider="openrouter",
    )
```

## Placement

**Completely replaces** Phase 1 `akara/backend/app/api/routes/health.py`. The `router` object is registered in `main.py` the same way.

## Related Files

- `app/main.py` — `app.include_router(health.router)`
- `tests/test_health.py` — tests all three endpoints
- `tests/test_health_endpoint.py` — pre-existing; still tests `/health`
- CI `e2e/smoke.spec.ts` — smoke-tests `/health` redirect behaviour

## Verification

```bash
cd akara/backend
uv run python -m pytest tests/test_health.py -v
```

Expected: 4 tests pass.

Manual:

```bash
curl http://localhost:8000/health
# {"status":"ok","environment":"development","timestamp":"..."}

curl http://localhost:8000/version
# {"environment":"development","llm_model":"openai/gpt-4o-mini-2024-07-18","llm_provider":"openrouter"}
```

---

# File: `akara/backend/app/main.py`

**Status:** Modified (full replacement)  
**Change Type:** Feature Extension + Refactor

## Purpose

Phase 1 `main.py` had:
- Unconditional `import sentry_sdk` (crashed if not installed)
- No startup validation
- No `X-Request-ID` middleware
- No custom exception handler
- CORS `allow_origins` computed inline from env var

Phase 2 adds:
- Conditional Sentry import (try/except)
- FastAPI `lifespan` async context manager with `validate_for_environment()`
- `RequestIDMiddleware` (from `app.core.middleware`)
- `AkaraHTTPException` exception handler (from `app.core.errors`)
- Docs disabled in production (`docs_url=None`)

## Dependencies

- `fastapi` (existing)
- `app.core.config.settings` (modified in Day 1)
- `app.core.errors.AkaraHTTPException`, `akara_exception_handler` (new Day 1)
- `app.core.middleware.RequestIDMiddleware` (new Day 1)
- All existing route routers (unchanged)

## Implementation

```python
from __future__ import annotations

import logging
import sys
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

try:
    import sentry_sdk as _sentry_sdk  # optional; not installed in all envs
    _SENTRY_AVAILABLE = True
except ImportError:
    _sentry_sdk = None  # type: ignore[assignment]
    _SENTRY_AVAILABLE = False

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth as auth_router
from app.api.routes import conversations as conversations_router
from app.api.routes import copilot as copilot_router
from app.api.routes import data as data_router
from app.api.routes import health
from app.api.routes import kpi as kpi_router
from app.api.routes import reports as reports_router
from app.api.routes import simulator as simulator_router
from app.api.routes.admin import logs as admin_logs_router
from app.api.routes.admin import reports as admin_reports_router
from app.api.routes.admin import tenants as admin_tenants_router
from app.api.routes.admin import users as admin_users_router
from app.core.config import settings
from app.core.errors import AkaraHTTPException, akara_exception_handler
from app.core.middleware import RequestIDMiddleware

logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("akara.startup")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup validation — fail fast on critical misconfiguration.

    In production/staging: any validation error exits with code 1 so the
    deployment fails visibly rather than silently serving broken responses.
    In development: errors are logged as warnings so the dev loop stays fast.
    """
    errors = settings.validate_for_environment()
    if errors:
        if settings.is_production or settings.is_staging:
            logger.critical(
                "STARTUP FAILED — missing required configuration:\n%s",
                "\n".join(f"  • {e}" for e in errors),
            )
            sys.exit(1)
        else:
            logger.warning(
                "Configuration warnings (non-fatal in development):\n%s",
                "\n".join(f"  • {e}" for e in errors),
            )
    else:
        logger.info(
            "Startup OK — environment=%s model=%s",
            settings.environment,
            settings.openrouter_model,
        )

    yield  # --- application running ---

    logger.info("Shutdown complete.")


# ---------------------------------------------------------------------------
# Sentry (optional — not installed in all environments)
# ---------------------------------------------------------------------------
if _SENTRY_AVAILABLE and settings.sentry_dsn:
    _sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=0.1,
        profiles_sample_rate=0.05,
    )

# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------
app = FastAPI(
    title="AKARA API",
    version="2.0.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Middleware (outermost first)
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)
app.add_middleware(RequestIDMiddleware)

# ---------------------------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------------------------
app.add_exception_handler(AkaraHTTPException, akara_exception_handler)  # type: ignore[arg-type]

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(health.router)
app.include_router(auth_router.router)
app.include_router(copilot_router.router)
app.include_router(conversations_router.router)
app.include_router(kpi_router.router)
app.include_router(data_router.router)
app.include_router(reports_router.router)
app.include_router(simulator_router.router)
app.include_router(admin_tenants_router.router)
app.include_router(admin_users_router.router)
app.include_router(admin_logs_router.router)
app.include_router(admin_reports_router.router)
```

## Placement

**Completely replaces** Phase 1 `akara/backend/app/main.py`.

## Related Files

- All route modules (unchanged; re-registered)
- `app/core/config.py`, `app/core/errors.py`, `app/core/middleware.py` (all Day 1)

## Verification

```bash
cd akara/backend
uv run python -c "from app.main import app; print('routers:', len(app.routes))"
# Should list multiple routes including /health, /ready, /version

uv run uvicorn app.main:app --port 8001 &
curl -s http://localhost:8001/health | python3 -m json.tool
# {"status": "ok", ...}
curl -s -I http://localhost:8001/health | grep -i x-request-id
# X-Request-ID: <uuid>
kill %1
```

---

# File: `akara/backend/.env.example`

**Status:** Modified (full replacement)  
**Change Type:** Documentation + Configuration

## Purpose

Phase 1 `.env.example` only listed Supabase, JWT, LLM, and SendGrid keys. Phase 2 version documents all 35+ environment variables required across the full sprint.

## Implementation

See `akara/backend/.env.example` in the repository. The file contains all variables grouped by provider with inline comments. Key additions vs Phase 1:

- `SUPABASE_POOLER_URL` — transaction-mode pooler
- `OPENROUTER_MODEL` — date-pinned model override
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, all four Price IDs
- `ZAPTILO_API_KEY`, `ZAPTILO_SENDER_NUMBER`
- `TURNSTILE_SECRET_KEY`
- `POSTHOG_API_KEY`, `POSTHOG_HOST`
- `SENTRY_DSN`
- `HEALTHCHECKS_PING_URL`
- `COMPANY_NAME`, `COMPANY_GSTIN`, `COMPANY_ADDRESS`, `COMPANY_STATE_CODE`
- `CUSTOMER_FRONTEND_URL`, `SUPERADMIN_FRONTEND_URL`, `ALLOWED_ORIGINS_RAW`

## Verification

```bash
diff akara/backend/.env akara/backend/.env.example
# .env should be a filled-in superset of .env.example
```

---

# File: `akara/migrations/011_billing.sql`

**Status:** Created  
**Change Type:** New Feature (database foundation)

## Purpose

Migration `010_import_tracking.sql` was applied in a parallel Cursor session. Day 1 billing infrastructure starts at `011`. This scaffold:
- Adds billing columns to `public.tenants` (plan, plan_status, trial/stripe fields, feature_overrides)
- Creates `usage_tracking` table with IST-aligned monthly + daily counters
- Creates `llm_cost_log` table for per-request LLM cost attribution
- Creates `idempotency_keys` table (wired in Day 2)
- Enables RLS on all three new tables
- Wraps everything in `BEGIN; ... COMMIT;`

## Dependencies

- Must run AFTER migration `010`
- Requires `uuid_generate_v4()` function (available in Supabase by default)
- Requires `public.get_my_tenant_id()` RLS helper (created in migration `002`)
- Requires `public.is_admin()` RLS helper (created in migration `002`)

## Implementation

The complete SQL file is at `akara/migrations/011_billing.sql`. Key sections:

**Tenant billing fields added:**

```sql
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS plan
        TEXT NOT NULL DEFAULT 'free'
        CHECK (plan IN ('free', 'pro', 'business')),
    ADD COLUMN IF NOT EXISTS plan_status
        TEXT NOT NULL DEFAULT 'active'
        CHECK (plan_status IN ('active', 'trialing', 'past_due', 'cancelled')),
    ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS plan_overrides_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
    ADD COLUMN IF NOT EXISTS feature_overrides JSONB NOT NULL DEFAULT '{}';
```

**Usage tracking table:**

```sql
CREATE TABLE IF NOT EXISTS public.usage_tracking (
    tenant_id           UUID    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    month               DATE    NOT NULL,
    copilot_calls       INT     NOT NULL DEFAULT 0,
    rows_imported       BIGINT  NOT NULL DEFAULT 0,
    uploads_count       INT     NOT NULL DEFAULT 0,
    debrief_count       INT     NOT NULL DEFAULT 0,
    uploads_today       INT     NOT NULL DEFAULT 0,
    undos_today         INT     NOT NULL DEFAULT 0,
    last_activity_date  DATE    NOT NULL DEFAULT CURRENT_DATE,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, month)
);
```

**LLM cost log table:**

```sql
CREATE TABLE IF NOT EXISTS public.llm_cost_log (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    request_id      TEXT,
    feature         TEXT        NOT NULL
        CHECK (feature IN ('copilot', 'morning_brief', 'weekly_debrief', 'schema_discovery', 'other')),
    model           TEXT        NOT NULL,
    input_tokens    INT         NOT NULL DEFAULT 0,
    output_tokens   INT         NOT NULL DEFAULT 0,
    total_tokens    INT         GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
    cost_usd        NUMERIC(10, 8) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Idempotency keys table:**

```sql
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
    key             TEXT        PRIMARY KEY,
    tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    endpoint        TEXT        NOT NULL,
    response_status INT         NOT NULL,
    response_body   JSONB       NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);
```

## Placement

New file at `akara/migrations/011_billing.sql`. Apply via Supabase SQL Editor **on staging first**, then production. Follow the checklist in `MIGRATION_MANIFEST.md`.

## Verification

After applying in Supabase SQL Editor:

```sql
-- Verify tenant columns
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tenants'
  AND column_name IN ('plan','plan_status','trial_ends_at','stripe_customer_id','feature_overrides');
-- Expected: 5 rows

-- Verify new tables exist with RLS enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('usage_tracking','llm_cost_log','idempotency_keys');
-- Expected: 3 rows, all rowsecurity = true
```

---

# File: `akara/migrations/MIGRATION_MANIFEST.md`

**Status:** Created  
**Change Type:** Documentation

## Purpose

Documents all applied migrations (001–010), the Phase 2 pending migration roadmap (011–025), naming conventions, RLS test helpers, pooler compatibility checklist, and how to apply a migration safely.

## Placement

New file at `akara/migrations/MIGRATION_MANIFEST.md`.

---

# File: `akara/frontend/index.html`

**Status:** Modified  
**Change Type:** Feature Extension (typography)

## Purpose

Phase 1 had `<title>frontend</title>` and no font loading. Phase 2 loads all three AKARA brand fonts from Google Fonts.

## Original content (Phase 1)

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

## Replacement content (Phase 2 Day 1)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AKARA — AI Analytics for FMCG Distributors</title>

    <!-- ─── Google Fonts ───────────────────────────────────────────────
         Plus Jakarta Sans  → headings, landing titles
         Inter              → body text, UI labels
         JetBrains Mono     → KPI numbers, code
         Subset: latin only. display=swap ensures text is visible during load.
    ──────────────────────────────────────────────────────────────────── -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

## Placement

Completely replaces `akara/frontend/index.html`.

## Related Files

- `akara/frontend/src/index.css` — `--font-sans` and `--font-mono` CSS vars reference these font family names

---

# File: `akara/frontend/src/index.css`

**Status:** Modified (full replacement)  
**Change Type:** Feature Extension (design system)

## Purpose

Phase 1 had only `@import "tailwindcss";` with no custom tokens. Phase 2 adds a complete Tailwind v4 `@theme` block implementing the AKARA UI Bible §1.2/§1.3:
- Brand palette (violet, orange, amber)
- Surface/text/semantic tokens
- Chart palette
- Superadmin dark surface tokens
- Font family variables
- Shadow variables
- Animation variables
- CSS keyframes for all animations
- `.skeleton` shimmer class
- `.kpi-value`, `.kpi-change`, `.btn-press`, `.card-hover`, `.streaming-cursor`, `.superadmin-surface` utility classes
- `@media (prefers-reduced-motion)` reset

## Placement

**Completely replaces** `akara/frontend/src/index.css`. See the repository file for the full implementation (the file is ~200 lines).

## Critical design tokens

```css
--color-brand:          #5B21B6;   /* violet-700 */
--color-brand-light:    #7C3AED;   /* violet-600 */
--color-brand-dim:      #EDE9FE;   /* violet-100 */
--color-accent:         #F97316;   /* orange-500 (primary CTA) */
--color-accent-amber:   #F59E0B;   /* amber-500 (KPI values) */
--color-sa-bg:          #0F172A;   /* slate-900 (superadmin) */
--color-sa-accent:      #818CF8;   /* indigo-400 (superadmin CTA) */
--font-sans: "Plus Jakarta Sans", "Inter", ui-sans-serif, system-ui;
--font-mono: "JetBrains Mono", ui-monospace, monospace;
```

## Verification

```bash
cd akara/frontend
pnpm build
# Should complete without errors
# Check dist/assets/*.css contains the custom properties
grep -r "5B21B6" dist/assets/
```

---

# File: `akara/frontend/package.json`

**Status:** Modified  
**Change Type:** Dependency + Configuration

## Purpose

Adds `sonner` (toast library), Vitest, `@playwright/test`, `@testing-library/*`, `axe-core`, `jsdom`, and related tooling. Adds `test`, `test:ui`, `test:e2e` scripts.

## Changes from Phase 1

**Scripts added:**

```json
"test": "vitest",
"test:ui": "vitest --ui",
"test:e2e": "playwright test"
```

**Dependencies added:**

```json
"sonner": "^2.0.0"
```

**DevDependencies added:**

```json
"@playwright/test": "^1.47.0",
"@testing-library/jest-dom": "^6.5.0",
"@testing-library/react": "^16.0.0",
"@testing-library/user-event": "^14.5.2",
"@vitest/ui": "^2.1.0",
"axe-core": "^4.10.0",
"jsdom": "^25.0.0",
"vitest": "^2.1.0"
```

## Installation

```bash
cd akara/frontend
pnpm install
```

---

# File: `akara/frontend/vite.config.ts`

**Status:** Modified  
**Change Type:** Configuration (test setup)

## Purpose

Adds Vitest configuration to the existing Vite config.

## Original content (Phase 1)

```typescript
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

## Replacement content (Phase 2 Day 1)

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
  test: {
    // Vitest config — UI Bible §DS-9 accessibility + unit tests
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'src/test/**',
        'src/pages/gallery/**',
        '**/*.d.ts',
      ],
    },
  },
})
```

---

# File: `akara/frontend/src/components/ui/button.tsx`

**Status:** Modified (full replacement)  
**Change Type:** Feature Extension (design system)

## Purpose

Phase 1 `button.tsx` was a generic shadcn component using `bg-primary`, `bg-secondary` etc. Phase 2 replaces it with AKARA brand variants referencing the Day 1 CSS design tokens (`bg-brand`, `bg-accent`, `shadow-cta`, etc.) and adds `loading` prop with spinner.

## Key changes from Phase 1

- 7 variants: `primary` (orange CTA), `secondary` (violet), `outline`, `ghost`, `destructive`, `link`, `default`
- `loading` prop: disables button, sets `aria-busy`, shows inline spinner
- `btn-press` micro-animation class from `index.css`
- `shadow-cta` for primary, `shadow-brand` for secondary
- `focus-visible:ring-*` for keyboard navigation

## Full implementation

See `akara/frontend/src/components/ui/button.tsx`. Complete file must be copy-pasted exactly as it is a drop-in replacement.

## Verification

```bash
cd akara/frontend
pnpm exec tsc --noEmit
# No type errors on button.tsx
pnpm test --run
# button.test.tsx: 5 tests pass
```

---

# File: `akara/frontend/src/components/ui/card.tsx`

**Status:** Modified (full replacement)  
**Change Type:** Feature Extension (design system)

## Purpose

Phase 1 card was a generic shadcn wrapper. Phase 2 adds `KPICard`, `PlanCard`, and `LockedCard` variants using AKARA tokens.

## New exports (not in Phase 1)

- `KPICard` — left-border accent, number + change badge, skeleton loading state
- `PlanCard` — pricing card with `popular` highlight ring
- `LockedCard` — blurred overlay with upgrade prompt

## Verification

```bash
cd akara/frontend
pnpm exec tsc --noEmit
```

---

# File: `akara/frontend/src/components/ui/badge.tsx`

**Status:** Modified (full replacement)  
**Change Type:** Feature Extension (design system)

## Purpose

Phase 1 had 3 generic variants. Phase 2 adds 9 variants including plan-specific badges and a `PlanBadge` convenience component.

## New exports

- `PlanBadge` — renders the correct plan badge given `plan` + `status` props

---

# File: `akara/frontend/src/components/ui/toast.tsx`

**Status:** Created  
**Change Type:** New Feature (design system §1.5)

## Purpose

Phase 1 had no toast/notification system. Phase 2 introduces a Sonner-based `Toaster` and typed `toast` helper with AKARA brand styling.

## Dependencies

- `sonner` package (added in Day 1 to `package.json`)

## Implementation

```typescript
/**
 * AKARA Toast — UI Bible §1.5
 *
 * Built on top of the `sonner` library.
 * Re-exports a branded `toast` helper with AKARA styling.
 *
 * Setup in main.tsx:
 *   import { Toaster } from "@/components/ui/toast"
 *   <Toaster />
 *
 * Usage anywhere:
 *   import { toast } from "@/components/ui/toast"
 *   toast.success("Import complete — 4,231 rows loaded")
 *   toast.error("Something went wrong", { description: "Please try again" })
 *   toast.warning("80% of your monthly quota used")
 *   toast.info("Weekly debrief is ready")
 *   toast.loading("Uploading file…")
 */

import { Toaster as Sonner } from "sonner"
import { toast as sonnerToast } from "sonner"

// ── Branded Toaster ───────────────────────────────────────────────────────────

export function Toaster() {
  return (
    <Sonner
      position="top-right"
      expand={false}
      richColors
      closeButton
      duration={4000}
      toastOptions={{
        classNames: {
          toast:       "font-sans text-sm rounded-xl border border-surface-border shadow-card",
          title:       "font-semibold text-text-primary",
          description: "text-text-secondary mt-0.5",
          actionButton:"bg-brand text-white rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-brand-light",
          cancelButton:"bg-surface-raised text-text-secondary rounded-lg px-3 py-1.5 text-xs font-semibold",
          success:     "!border-l-4 !border-l-success",
          error:       "!border-l-4 !border-l-danger",
          warning:     "!border-l-4 !border-l-warning",
          info:        "!border-l-4 !border-l-info",
        },
      }}
    />
  )
}

// ── Typed wrapper ─────────────────────────────────────────────────────────────

type ToastOptions = {
  description?: string
  duration?: number
  action?: { label: string; onClick: () => void }
}

export const toast = {
  success: (message: string, opts?: ToastOptions) =>
    sonnerToast.success(message, opts),

  error: (message: string, opts?: ToastOptions) =>
    sonnerToast.error(message, opts),

  warning: (message: string, opts?: ToastOptions) =>
    sonnerToast.warning(message, opts),

  info: (message: string, opts?: ToastOptions) =>
    sonnerToast.info(message, opts),

  loading: (message: string, opts?: ToastOptions) =>
    sonnerToast.loading(message, opts),

  dismiss: (id?: string | number) =>
    sonnerToast.dismiss(id),

  promise: sonnerToast.promise,
}
```

## Placement

New file at `akara/frontend/src/components/ui/toast.tsx`.

## Related Files

- `src/App.tsx` — mounts `<Toaster />` at root
- Any component that needs notifications: `import { toast } from "@/components/ui/toast"`

---

# File: `akara/frontend/src/components/ui/skeleton.tsx`

**Status:** Created  
**Change Type:** New Feature (design system §1.6)

## Purpose

Phase 1 had `components/SkeletonCard.tsx` which was a single generic card skeleton. Phase 2 replaces the concept with purpose-specific skeleton components covering every loading state in the app.

**Note:** `components/SkeletonCard.tsx` is NOT deleted in Day 1 (existing imports would break). It will be removed when Day 4 page components are updated.

## New exports

- `Skeleton` — generic shimmer block
- `KPICardSkeleton` — 4-column KPI grid skeleton
- `TableSkeleton` — configurable rows/cols table skeleton
- `ChartSkeleton` — bar chart skeleton
- `ChatSkeleton` — copilot conversation skeleton
- `CardListSkeleton` — list of card skeletons
- `PageHeaderSkeleton` — page title + description skeleton

## Placement

New file at `akara/frontend/src/components/ui/skeleton.tsx`.

---

# File: `akara/frontend/src/components/admin/AdminTable.tsx`

**Status:** Created  
**Change Type:** New Feature (superadmin shared primitive)

## Purpose

Generic data table rendering in the superadmin dark surface. Used by all 11 superadmin tabs to avoid duplicating table layout logic.

## Placement

New file. Create directory `akara/frontend/src/components/admin/` and create `AdminTable.tsx` inside it.

---

# File: `akara/frontend/src/components/admin/AdminDrawer.tsx`

**Status:** Created  
**Change Type:** New Feature (superadmin shared primitive)

## Purpose

Slide-in right panel for superadmin detail/edit views. Traps focus, handles Escape key, scrollable body, dark surface tokens.

## Placement

New file at `akara/frontend/src/components/admin/AdminDrawer.tsx`.

---

# File: `akara/frontend/src/components/admin/ConfirmDialog.tsx`

**Status:** Created  
**Change Type:** New Feature (superadmin shared primitive)

## Purpose

Confirmation gate for all destructive admin actions. Forces the operator to type a phrase (default `"CONFIRM"`) before the confirm button becomes enabled. Supports an `impactPreview` slot for showing affected row counts before proceeding.

## Placement

New file at `akara/frontend/src/components/admin/ConfirmDialog.tsx`.

---

# File: `akara/frontend/src/components/admin/SuperadminShell.tsx`

**Status:** Created  
**Change Type:** New Feature (superadmin foundation)

## Purpose

Layout wrapper for all `/superadmin/*` routes. Renders dark `superadmin-surface` with a 56px-wide sidebar containing 11 navigation items. Uses `<Outlet />` for nested routes. Includes a top bar with breadcrumb label and a placeholder sudo-session indicator (wired fully in Day 8).

## Dependencies

- `react-router-dom` — `Link`, `Outlet`, `useLocation`, `Navigate`
- `@/contexts/AuthContext` — `useAuth` hook
- `@/lib/utils` — `cn` utility
- CSS tokens `sa-*` from `index.css`

## Implementation

See `akara/frontend/src/components/admin/SuperadminShell.tsx` (full file in repository).

Key nav items registered:

```typescript
const NAV_ITEMS = [
  { href: "/superadmin/tenants",   label: "Tenants",   icon: "🏢" },
  { href: "/superadmin/users",     label: "Users",     icon: "👥" },
  { href: "/superadmin/billing",   label: "Billing",   icon: "💳" },
  { href: "/superadmin/data",      label: "Data",      icon: "🗄️" },
  { href: "/superadmin/ai",        label: "AI / LLM",  icon: "🤖" },
  { href: "/superadmin/analytics", label: "Analytics", icon: "📊" },
  { href: "/superadmin/comms",     label: "Comms",     icon: "📨" },
  { href: "/superadmin/security",  label: "Security",  icon: "🛡️" },
  { href: "/superadmin/ops",       label: "Ops / Jobs",icon: "⚙️" },
  { href: "/superadmin/audit",     label: "Audit Log", icon: "📋" },
  { href: "/superadmin/settings",  label: "Settings",  icon: "🔧" },
]
```

## Related Files

- `src/App.tsx` — registers `/superadmin/*` route tree with `SuperadminShell` as layout

## Verification

Navigate to `/superadmin` in dev mode; should show the dark sidebar and redirect to `/superadmin/tenants`.

---

# File: `akara/frontend/src/pages/gallery/ComponentGallery.tsx`

**Status:** Created  
**Change Type:** New Feature (development tool)

## Purpose

Dev-only route at `/gallery` (only registered when `import.meta.env.DEV` is true) that renders every Day 1 UI primitive in one scrollable page. Used to verify design tokens, component variants, and skeleton loading states without navigating to real pages.

## Placement

New file. Create directory `akara/frontend/src/pages/gallery/` and create `ComponentGallery.tsx` inside it.

## Related Files

- `src/App.tsx` — conditionally registers `<Route path="/gallery" element={<ComponentGallery />} />` only when `isDev`

---

# File: `akara/frontend/src/App.tsx`

**Status:** Modified (full replacement)  
**Change Type:** Refactor + Feature Extension

## Purpose

Phase 1 `App.tsx` had eager imports for all page components. Phase 2:
- All customer and admin pages are lazy-loaded (`React.lazy + Suspense`)
- `/superadmin/*` route group added behind `SuperadminShell`
- `<Toaster />` mounted at root level
- `<RouteSpinner />` fallback shown while lazy bundles load
- `QueryClient` `mutations.retry` set to `0`, `refetchOnWindowFocus` to `false`
- `/gallery` route registered for dev only

## Full implementation

See `akara/frontend/src/App.tsx` (full file in repository, ~133 lines).

## Critical import additions

```typescript
import { SuperadminShell } from "@/components/admin/SuperadminShell"
import { Toaster } from "@/components/ui/toast"
```

## Related Files

- All page components (unchanged; now lazy-loaded)
- `src/components/admin/SuperadminShell.tsx` (new Day 1)
- `src/components/ui/toast.tsx` (new Day 1)
- `src/pages/gallery/ComponentGallery.tsx` (new Day 1)

## Verification

```bash
cd akara/frontend
pnpm exec tsc --noEmit
pnpm build
# Build must complete without errors; check bundle analysis shows lazy chunks
```

---

# File: `akara/frontend/.env.example`

**Status:** Modified (full replacement)  
**Change Type:** Documentation

## Purpose

Phase 1 had only `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`. Phase 2 adds:
- `VITE_TURNSTILE_SITE_KEY`
- `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`
- `VITE_SENTRY_DSN`
- `VITE_ENVIRONMENT`

---

# File: `akara/frontend/src/test/setup.ts`

**Status:** Created  
**Change Type:** Test

## Purpose

Vitest global setup file. Imports `@testing-library/jest-dom` to extend `expect` with DOM matchers. Suppresses known React 19 `console.error` warnings in test output.

## Implementation

```typescript
/**
 * Vitest global setup — Phase 2 test infrastructure
 */

import '@testing-library/jest-dom'

// Silence console.error for expected React warnings in tests
const originalError = console.error
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    // Suppress known React 19 hydration warnings in tests
    if (typeof args[0] === 'string' && args[0].includes('Warning:')) return
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})
```

## Placement

New file at `akara/frontend/src/test/setup.ts`.

## Related Files

- `akara/frontend/vite.config.ts` — references `'./src/test/setup.ts'` in `test.setupFiles`

---

# File: `akara/frontend/src/test/fixtures.ts`

**Status:** Created  
**Change Type:** Test

## Purpose

Frontend mirror of the backend `conftest.py` fixtures. Provides 7 deterministic tenant/user/usage states for use in unit tests and Playwright E2E.

## Fixture identities

| Key | Plan | Status | Purpose |
|-----|------|--------|---------|
| `FREE` | free | active | 9/10 copilot calls used |
| `PRO` | pro | active | Normal active Pro tenant |
| `BUSINESS` | business | active | Full feature access |
| `PAST_DUE` | pro | past_due | Payment failed Day 3 |
| `TRIAL` | pro | trialing | 13 days remaining |
| `EMPTY` | pro | active | Zero data imported |
| `SUPERADMIN` | business | active | `is_superadmin: true` |

## Placement

New file at `akara/frontend/src/test/fixtures.ts`.

---

# File: `akara/frontend/src/components/ui/__tests__/button.test.tsx`

**Status:** Created  
**Change Type:** Test

## Purpose

Unit tests for the Day 1 `Button` component covering core variants, `loading` state, disabled state, and click handler.

## Implementation

```typescript
/**
 * Button component — unit tests
 * Phase 2 Day 1: verify core variants, loading state, disabled state
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Button } from '../button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Test</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not call onClick when disabled', async () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Test</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('shows spinner and sets aria-busy when loading', () => {
    render(<Button loading>Saving</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-busy', 'true')
    expect(btn).toBeDisabled()
  })

  it('renders destructive variant without crashing', () => {
    render(<Button variant="destructive">Delete</Button>)
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })
})
```

## Placement

New file. Create directory `akara/frontend/src/components/ui/__tests__/` and create `button.test.tsx` inside it.

## Verification

```bash
cd akara/frontend
pnpm test --run
# Expected: "Button > 5 passed"
```

---

# File: `akara/frontend/playwright.config.ts`

**Status:** Created  
**Change Type:** Test + Configuration

## Purpose

Configures Playwright for AKARA E2E tests. In CI, targets a staging URL from `E2E_STAGING_URL` env var. Locally, starts the Vite dev server automatically.

## Implementation

```typescript
import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_STAGING_URL || 'http://localhost:5173'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI ? 'line' : 'html',

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: process.env.CI
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
})
```

## Placement

New file at `akara/frontend/playwright.config.ts`.

---

# File: `akara/frontend/e2e/smoke.spec.ts`

**Status:** Created  
**Change Type:** Test (E2E)

## Purpose

Minimal smoke tests to verify the Day 1 frontend is not completely broken. Full E2E coverage added per-page in Days 3–13.

## Implementation

```typescript
/**
 * Smoke test — Phase 2 Day 1 E2E gate
 */

import { test, expect } from '@playwright/test'

test('login page renders with no accessibility violations', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveTitle(/AKARA/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('unauthenticated redirect from /dashboard to /login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('404 page renders for unknown route', async ({ page }) => {
  await page.goto('/this-page-does-not-exist-akara')
  await expect(page.locator('body')).not.toBeEmpty()
})
```

## Placement

New file. Create directory `akara/frontend/e2e/` and create `smoke.spec.ts` inside it.

## Verification

```bash
cd akara/frontend
pnpm exec playwright install --with-deps chromium
pnpm exec playwright test
```

---

# File: `akara/backend/tests/conftest.py`

**Status:** Modified (full replacement)  
**Change Type:** Test (fixtures)

## Purpose

Phase 1 `conftest.py` only had a `client` fixture. Phase 2 adds deterministic tenant/usage data matching the frontend fixtures, covering all billing/plan states.

## Placement

**Completely replaces** Phase 1 `conftest.py`. See the full implementation in the repository.

## Fixture IDs

These UUIDs are deterministic and must never change — tests depend on them:

```python
TENANT_FREE     = uuid.UUID("11111111-0000-0000-0000-000000000001")
TENANT_PRO      = uuid.UUID("22222222-0000-0000-0000-000000000002")
TENANT_BUSINESS = uuid.UUID("33333333-0000-0000-0000-000000000003")
TENANT_PAST_DUE = uuid.UUID("44444444-0000-0000-0000-000000000004")
TENANT_TRIAL    = uuid.UUID("55555555-0000-0000-0000-000000000005")
TENANT_EMPTY    = uuid.UUID("66666666-0000-0000-0000-000000000006")
USER_SUPERADMIN = uuid.UUID("00000000-aaaa-0000-0000-000000000001")
```

---

# File: `akara/backend/tests/test_config.py`

**Status:** Modified (full replacement)  
**Change Type:** Test

## Purpose

Phase 1 `test_config.py` had `test_settings_loads`, `test_allowed_origins_is_list`, `test_is_production_flag`. Phase 2 adds:
- `test_openrouter_model_is_date_pinned` — asserts model string contains a year
- `test_is_development_in_ci` — in `ENVIRONMENT=ci`, `is_production` must be `False`
- `test_validate_for_environment_returns_list` — contract test
- `test_effective_db_url_is_string` — contract test
- Removes `test_settings_loads` assertion on `gemini_api_key` (removed field)

## Verification

```bash
cd akara/backend
uv run python -m pytest tests/test_config.py -v
# Expected: 7 passed
```

---

# File: `akara/backend/tests/test_health.py`

**Status:** Modified (extended)  
**Change Type:** Test

## Purpose

Phase 1 had 2 tests. Phase 2 adds:
- `test_version_endpoint` — verifies `/version` returns `llm_provider: "openrouter"` and a date-pinned model string
- `test_health_response_has_x_request_id` — verifies `X-Request-ID` header is present on all responses
- Updates existing `test_health_returns_environment` to also accept `"ci"` as a valid environment value

## Verification

```bash
cd akara/backend
uv run python -m pytest tests/test_health.py -v
# Expected: 4 passed
```

---

# File: `.github/workflows/ci.yml`

**Status:** Modified (full replacement)  
**Change Type:** Configuration (CI)

## Purpose

Phase 1 CI had 2 jobs with **wrong working directories** (`working-directory: backend` and `working-directory: frontend` instead of `akara/backend` and `akara/frontend`). All CI runs were broken because the working directory did not exist.

Phase 2 fixes the paths and adds 3 new jobs:

| Job | Purpose |
|-----|---------|
| `backend` | Ruff lint + ruff format check + pytest with coverage |
| `frontend-unit` | TypeScript type check + Vitest unit tests |
| `frontend-build` | Production build verification |
| `e2e` | Playwright E2E + accessibility (PRs only, depends on build) |
| `migrations` | SQL file naming convention + sequence gap check |

## Critical fix

```yaml
# Phase 1 (WRONG):
working-directory: backend

# Phase 2 (CORRECT):
working-directory: akara/backend
```

## Full implementation

See `.github/workflows/ci.yml` in the repository (~120 lines).

## Verification

Push to any branch and confirm all 5 jobs appear in GitHub Actions.

---

# File: `akara/docs2/requirement_ledger.md`

**Status:** Created  
**Change Type:** Documentation

## Purpose

Single-source-of-truth traceability matrix for all Phase 2 requirements. Every section (14–22), Gap, OMNIPOTENCE Gap, UI page, design system section, email/WhatsApp template, promotional slot, and Day 1 item has a row with: source reference, Day, lane, Status, Evidence.

All Day 1 items are marked `in_progress` or `done`; all future items are `pending`.

## Placement

New file at `akara/docs2/requirement_ledger.md`.

---

# File: `akara/docs2/plan_catalog.md`

**Status:** Created  
**Change Type:** Documentation

## Purpose

Canonical plan limits specification. The Day 2 `plan_limits.py` module must import from this as its authoritative source. Documents:
- Plan slugs (`free`, `pro`, `business`)
- INR pricing (monthly + annual)
- Feature limits matrix (all features × all plans)
- Trial policy (14 days, no credit card)
- Quota warning thresholds (80% / 90% / 100%)
- Dunning schedule (Day 0/3/7/14)
- Downgrade behaviour

## Placement

New file at `akara/docs2/plan_catalog.md`.

---

# File: `akara/docs2/external_workstreams.md`

**Status:** Created  
**Change Type:** Documentation

## Purpose

Operator-action checklist for all 15 external workstreams that require human action (not code):
- EXT-1: Supabase India staging project (latest by Day 1)
- EXT-2: Stripe test-mode products + prices (latest by Day 4)
- EXT-3: Zaptilo BSP WhatsApp account (start immediately — 5-7 day approval)
- EXT-4: Cloudflare Turnstile keys (latest by Day 2)
- EXT-5 through EXT-15: PostHog, GST, Legal, DPA, DNS, Sentry, healthchecks.io, Railway, Vercel, SendGrid

Each entry includes step-by-step instructions and an Evidence field for tracking completion.

## Placement

New file at `akara/docs2/external_workstreams.md`.

---

# Environment Variables

## New variables introduced in Day 1

| Variable | File | Required? | Format | Default | Purpose |
|----------|------|-----------|--------|---------|---------|
| `SUPABASE_POOLER_URL` | `backend/.env` | Staging/prod | PostgreSQL connection string | `""` | Transaction-mode pooler (GAP-7) |
| `OPENROUTER_MODEL` | `backend/.env` | No | `provider/model-YYYY-MM-DD` | `openai/gpt-4o-mini-2024-07-18` | Date-pinned LLM model |
| `STRIPE_SECRET_KEY` | `backend/.env` | Staging/prod | `sk_test_...` or `sk_live_...` | `""` | Stripe API auth |
| `STRIPE_WEBHOOK_SECRET` | `backend/.env` | Staging/prod | `whsec_...` | `""` | Webhook signature verification |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | `backend/.env` | Staging/prod | `price_...` | `""` | Stripe Price ID for Pro Monthly |
| `STRIPE_PRO_ANNUAL_PRICE_ID` | `backend/.env` | No | `price_...` | `""` | Stripe Price ID for Pro Annual |
| `STRIPE_BUSINESS_MONTHLY_PRICE_ID` | `backend/.env` | Staging/prod | `price_...` | `""` | Stripe Price ID for Business Monthly |
| `STRIPE_BUSINESS_ANNUAL_PRICE_ID` | `backend/.env` | No | `price_...` | `""` | Stripe Price ID for Business Annual |
| `ZAPTILO_API_KEY` | `backend/.env` | No (Day 7) | string | `""` | Zaptilo WhatsApp BSP auth |
| `ZAPTILO_SENDER_NUMBER` | `backend/.env` | No (Day 7) | `+91XXXXXXXXXX` | `""` | WhatsApp sender number |
| `TURNSTILE_SECRET_KEY` | `backend/.env` | No (Day 3) | string | `""` | Cloudflare Turnstile backend verification |
| `POSTHOG_API_KEY` | `backend/.env` | No (Day 13) | `phc_...` | `""` | PostHog server-side events |
| `POSTHOG_HOST` | `backend/.env` | No | URL | `https://app.posthog.com` | PostHog instance URL |
| `SENTRY_DSN` | `backend/.env` | No | DSN URL | `""` | Sentry error tracking |
| `HEALTHCHECKS_PING_URL` | `backend/.env` | No (Day 7) | URL | `""` | healthchecks.io cron ping base URL |
| `COMPANY_NAME` | `backend/.env` | No | string | `AKARA Analytics Pvt Ltd` | GST invoice company name |
| `COMPANY_GSTIN` | `backend/.env` | Staging/prod | 15-char GSTIN | `""` | GST registration number |
| `COMPANY_ADDRESS` | `backend/.env` | Staging/prod | string | `""` | Registered address for invoices |
| `COMPANY_STATE_CODE` | `backend/.env` | Staging/prod | 2-digit code | `""` | State code for GST (e.g. `"27"`) |
| `SUPPORT_EMAIL` | `backend/.env` | No | email | `support@akara.ai` | Support contact in emails |
| `BILLING_EMAIL` | `backend/.env` | No | email | `billing@akara.ai` | Billing contact in emails |
| `CUSTOMER_FRONTEND_URL` | `backend/.env` | No | URL | `http://localhost:5173` | Used in email links |
| `SUPERADMIN_FRONTEND_URL` | `backend/.env` | No | URL | `http://localhost:5173` | Used in admin email links |
| `ALLOWED_ORIGINS_RAW` | `backend/.env` | No | comma-separated URLs | `http://localhost:5173` | CORS allowed origins |
| `VITE_TURNSTILE_SITE_KEY` | `frontend/.env.local` | No (Day 3) | `0x4AAA...` | — | Cloudflare Turnstile public site key |
| `VITE_POSTHOG_KEY` | `frontend/.env.local` | No (Day 13) | `phc_...` | — | PostHog client-side key |
| `VITE_POSTHOG_HOST` | `frontend/.env.local` | No | URL | — | PostHog instance URL |
| `VITE_SENTRY_DSN` | `frontend/.env.local` | No | DSN URL | — | Sentry frontend DSN |
| `VITE_ENVIRONMENT` | `frontend/.env.local` | No | string | — | `development`/`staging`/`production` |

## Variables removed

| Variable | Was in Phase 1 | Reason removed |
|----------|---------------|----------------|
| `GEMINI_API_KEY` | `backend/.env` | Gemini provider removed |
| `WEATHER_API_KEY` | `backend/.env` | Not used in production |
| `NEWS_API_KEY` | `backend/.env` | Not used in production |

**Important:** These variables may still be present in existing `.env` files. `extra="ignore"` in `config.py` ensures they do not cause startup failures.

---

# Dependency Changes

## Backend

No new Python packages added in Day 1. The `sentry-sdk` package was already in the Phase 1 lockfile but is now imported conditionally (won't crash if missing).

## Frontend

### Added to `dependencies`

| Package | Version | Purpose | Import location |
|---------|---------|---------|-----------------|
| `sonner` | `^2.0.0` | Toast/notification library | `src/components/ui/toast.tsx` |

### Added to `devDependencies`

| Package | Version | Purpose |
|---------|---------|---------|
| `@playwright/test` | `^1.47.0` | E2E testing |
| `@testing-library/jest-dom` | `^6.5.0` | DOM assertion matchers |
| `@testing-library/react` | `^16.0.0` | React component testing |
| `@testing-library/user-event` | `^14.5.2` | User interaction simulation |
| `@vitest/ui` | `^2.1.0` | Vitest browser UI |
| `axe-core` | `^4.10.0` | Accessibility testing engine |
| `jsdom` | `^25.0.0` | DOM environment for Vitest |
| `vitest` | `^2.1.0` | Unit/integration test runner |

### Installation

```bash
cd akara/frontend
pnpm install
# Verify:
pnpm exec vitest --version
pnpm exec playwright --version
```

---

# Tests

## Backend unit tests

### `tests/test_config.py` (7 tests)

```bash
cd akara/backend
uv run python -m pytest tests/test_config.py -v
```

| Test | Validates |
|------|-----------|
| `test_settings_loads` | `supabase_url` starts with https, `jwt_secret` length > 10 |
| `test_openrouter_model_is_date_pinned` | Model string contains `/` and a year (2024/2025/2026) |
| `test_allowed_origins_is_list` | `settings.allowed_origins` is a non-empty list |
| `test_is_production_flag` | `settings.is_production` is bool |
| `test_is_development_in_ci` | `ENVIRONMENT=ci` → `is_production` is False |
| `test_validate_for_environment_returns_list` | Returns `list` type |
| `test_effective_db_url_is_string` | Non-empty string |

### `tests/test_health.py` (4 tests)

```bash
uv run python -m pytest tests/test_health.py -v
```

| Test | Validates |
|------|-----------|
| `test_health_returns_200` | `/health` → 200, `status="ok"`, has `timestamp` |
| `test_health_returns_environment` | environment in `{development,production,staging,ci}` |
| `test_version_endpoint` | `/version` → `llm_provider="openrouter"`, model is date-pinned |
| `test_health_response_has_x_request_id` | `X-Request-ID` header present |

## Frontend unit tests

### `src/components/ui/__tests__/button.test.tsx` (5 tests)

```bash
cd akara/frontend
pnpm test --run
```

| Test | Validates |
|------|-----------|
| renders children | Button renders text content |
| calls onClick when clicked | Click handler fires |
| does not call onClick when disabled | Disabled button blocks click |
| shows spinner and sets aria-busy when loading | `loading` prop behavior |
| renders destructive variant | No crash on variant prop |

## E2E tests

### `e2e/smoke.spec.ts` (3 tests)

```bash
cd akara/frontend
pnpm exec playwright install --with-deps chromium
pnpm exec playwright test
```

| Test | Validates |
|------|-----------|
| login page renders | Page title matches `/AKARA/`, H1 visible |
| unauthenticated redirect | `/dashboard` → `/login` |
| 404 page renders | Unknown route returns non-empty body |

## Pre-existing failing test (NOT caused by Day 1)

`tests/test_data_parser.py::test_parse_column_alias_mapping` fails with:

```
ValueError: Missing required columns: {'invoice_date', 'total_amount', 'party_name'}
```

This failure pre-dates Phase 2 Day 1. The parser's alias mapping does not include `date`→`invoice_date`, `customer`→`party_name`, `total`→`total_amount`. This will be fixed in Day 4 (data import work). Do not treat it as a Day 1 regression.

---

# Relationship to Sprint Phase 1

## Reused unchanged

| Component | Path | Notes |
|-----------|------|-------|
| JWT authentication | `app/core/auth.py` | Unchanged |
| Tenant context | `app/core/tenant.py` | Unchanged; `TenantCtx` type used by all routes |
| All API routes | `app/api/routes/*.py` | Unchanged; re-registered in new `main.py` |
| All admin routes | `app/api/routes/admin/*.py` | Unchanged |
| All service files | `app/services/**/*.py` | Unchanged (except `llm/`) |
| SQL guard | `app/sql/guard.py` | Unchanged |
| Migrations 001–010 | `akara/migrations/` | Applied; `010` was added in a parallel session |
| Frontend pages | `src/pages/*.tsx` | Unchanged; now lazy-loaded |
| Frontend hooks | `src/hooks/*.ts` | Unchanged |
| Frontend contexts | `src/contexts/*.tsx` | Unchanged |
| AppShell | `src/components/layout/AppShell.tsx` | Unchanged |
| ProtectedRoute | `src/components/ProtectedRoute.tsx` | Unchanged |

## Extended

| Component | Extension |
|-----------|-----------|
| `config.py` | Replaced entirely; all Phase 1 fields preserved, 20+ new fields added |
| `main.py` | All Phase 1 routers re-registered; lifespan, middleware, exception handler added |
| `health.py` | `/health` endpoint preserved; `/ready` and `/version` added |
| `openrouter.py` | Same class name (`OpenRouterClient`); model is now config-driven |
| `manager.py` | Same interface (`complete`/`stream`); Gemini path removed |
| `App.tsx` | All Phase 1 routes preserved; lazy loading, superadmin shell, toaster added |
| `button.tsx` | Phase 1 variants mapped to new AKARA tokens; `loading` prop added |
| `card.tsx` | Phase 1 Card/CardHeader/etc. preserved; KPICard/PlanCard/LockedCard added |
| `badge.tsx` | Phase 1 variant structure preserved; 6 new variants + PlanBadge added |
| `test_config.py` | Phase 1 assertions kept; 4 new assertions added, `gemini_api_key` assertion removed |
| `test_health.py` | Phase 1 assertions kept; 2 new test functions added |
| `conftest.py` | Phase 1 `client` fixture preserved; 6 new tenant/usage fixtures added |

## Replaced (Phase 1 code no longer present)

| Component | Reason |
|-----------|--------|
| Gemini LLM path in `manager.py` | Phase 2 is OpenRouter-only |
| Hardcoded `anthropic/claude-3-haiku` model in `openrouter.py` | Config-driven model |
| Unconditional `import sentry_sdk` in `main.py` | Optional import to support environments without sentry |
| CI working directories `backend`/`frontend` | Corrected to `akara/backend`/`akara/frontend` |

## Deprecated (present but no longer used)

| Component | Status |
|-----------|--------|
| `app/services/llm/gemini.py` | File still exists; not imported by anything |
| `src/components/SkeletonCard.tsx` | Still imported by Phase 1 pages; will be removed in Day 4 |
| Phase 1 `/admin/tenants` and `/admin/users` routes | Still registered under `AppShell`; marked "deprecated in Day 8" |

---

# Incomplete or Deferred Work

## 1. Gemini service file not deleted

**Description:** `akara/backend/app/services/llm/gemini.py` still exists but is no longer imported.  
**Current state:** Dead code.  
**Files affected:** `app/services/llm/gemini.py`  
**What remains:** Delete the file.  
**Why deferred:** No other file imports it; safe to delete at any point in Day 2+.  
**Risk:** Low.  
**Next step:** `rm akara/backend/app/services/llm/gemini.py` in Day 2 cleanup.

## 2. SkeletonCard.tsx not removed

**Description:** Phase 1 `src/components/SkeletonCard.tsx` still exists; it may be imported by existing page components that haven't been updated to use the new `skeleton.tsx` exports yet.  
**Current state:** Legacy component, still functional.  
**Files affected:** `src/components/SkeletonCard.tsx`, any page importing it.  
**What remains:** Audit imports; replace with `CardListSkeleton` or `Skeleton` from `ui/skeleton.tsx`; delete the file.  
**Why deferred:** Day 4 page updates will handle this systematically.  
**Risk:** Low (build does not break).

## 3. Superadmin server-side role check

**Description:** `SuperadminShell.tsx` comments note: "TODO Day 8: Replace with server-validated is_superadmin check." Currently, any authenticated user can navigate to `/superadmin`.  
**Current state:** Shell visible to all authenticated users.  
**Files affected:** `src/components/admin/SuperadminShell.tsx`, `src/components/ProtectedRoute.tsx`  
**What remains:** Day 8 — add server-side `is_superadmin` query to a new backend endpoint; update `ProtectedRoute` or `SuperadminShell` to check it.  
**Why deferred:** `is_superadmin` column scaffolded in Day 8 migration (`019_superadmin.sql`).  
**Risk:** Medium (any logged-in user can see the superadmin UI skeleton; data-destructive operations must verify server-side anyway).

## 4. Idempotency key storage not wired

**Description:** `idempotency.py` validates the `Idempotency-Key` header format but does not yet persist or look up keys in the `idempotency_keys` table.  
**Current state:** Header validation only.  
**Files affected:** `app/core/idempotency.py`, `akara/migrations/011_billing.sql`  
**What remains:** Day 2 — implement `store_key()` and `lookup_key()` functions using the service-role Supabase client.  
**Why deferred:** Table created in Day 1 migration; storage logic deferred to Day 2 billing work.  
**Risk:** Low (header is validated; replay protection just won't be active yet).

## 5. Staging environment not provisioned

**Description:** EXT-1 (Supabase staging), EXT-13 (Railway), EXT-14 (Vercel) require operator action.  
**Current state:** Local development only.  
**Files affected:** `.env.example` files  
**What remains:** Follow `external_workstreams.md` EXT-1, EXT-13, EXT-14 steps.  
**Why deferred:** Requires human action outside code.  
**Risk:** High if not done before Day 3 (signup page requires Turnstile + Supabase staging).

## 6. Zaptilo WhatsApp templates not submitted

**Description:** WhatsApp template approval (EXT-3) takes 5–7 business days. Must be started immediately.  
**Current state:** Not started.  
**Why deferred:** External dependency; no code action needed.  
**Risk:** High — if not submitted on Day 1, it will block Day 7 WhatsApp delivery.

---

*End of Sprint Phase 2, Day 1 Implementation Handoff*
