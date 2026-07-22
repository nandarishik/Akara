# Additional Changes

> **Purpose:** Permanent record of every modification made **after** the original 14-day implementation documented in `akara/docs/`.  
> **Audience:** The Cursor instance that authored the original implementation plans — it has no memory of post-launch work.  
> **Baseline code commit:** `838d0f7` — *"Implement Days 2-13: full AKARA app, migrations, tests, CI, and deployment prep."*  
> **Current HEAD at time of writing:** `d687f54`  
> **Production URLs deployed during this period:**
> - Backend (Railway): `https://akara-production.up.railway.app`
> - Frontend (Vercel): `https://akara2.vercel.app`
> - Supabase: `https://tkkewnogqdjjkkikseaa.supabase.co`

After reading this document, future implementation plans must assume the **current codebase** — not the original day-wise docs alone — as source of truth.

---

## How to Use This Document

| Section | What it covers |
|---|---|
| [Commit Timeline](#commit-timeline) | Ordered list of every post-implementation git commit |
| [Architecture](#architecture) | Structural / pipeline changes |
| [Database](#database) | Schema / migration changes (none post-baseline) |
| [Backend](#backend) | Python services, core modules, scripts |
| [API Layer](#api-layer) | Route behavior changes |
| [Frontend](#frontend) | React pages, hooks, components, layout |
| [Authentication](#authentication) | JWT, roles, session handling |
| [Validation](#validation) | Data import parsing & sanitization |
| [Configuration](#configuration) | Env vars, Railway/Vercel/Supabase settings |
| [Dependencies](#dependencies) | Package / test additions |
| [Deployment & Operations](#deployment--operations) | Real-world deploy issues discovered |
| [Known Gaps Still Open](#known-gaps-still-open) | Problems identified but **not yet fixed** |
| [Invalidated Assumptions](#invalidated-assumptions) | Original docs assumptions that are no longer true |

Each change entry follows this format:
- **Original expected** — what the day-wise docs / baseline code assumed
- **Actually implemented** — what exists now
- **Why** — reason for the change
- **Files affected**
- **Downstream implications** — what future work must account for

---

## Commit Timeline

All commits after baseline `838d0f7`:

| Commit | Date | Summary |
|---|---|---|
| `ea4df94` | 2026-07-22 | Fix frontend TypeScript errors blocking Vercel production build |
| `b453bc8` | 2026-07-22 | Fix Railway Nixpacks build — pin uv version |
| `97df6a0` | 2026-07-22 | Fix Railway runtime — sync uv deps into `/opt/venv` |
| `0c8735f` | 2026-07-22 | Fix production login flow; add admin bootstrap script |
| `a432eea` | 2026-07-22 | Support Supabase ES256 JWTs via JWKS |
| `613af28` | 2026-07-22 | Fix admin role detection; harden KPI fallbacks |
| `c1fabfa` | 2026-07-22 | Fix dashboard crash on decimal strings from API |
| `4e15024` | 2026-07-22 | Fix Copilot empty responses; align Copilot header layout |
| `f330abf` | 2026-07-22 | Conversational mode for Copilot greetings |
| `40bcb48` | 2026-07-22 | Multi-sheet POS Excel import (restaurant sales reports) |
| `9af3b69` | 2026-07-22 | Sanitize NaN before sales data JSON insert |
| `7e1ef35` | 2026-07-22 | Empty commit — trigger Railway redeploy |
| `4769a65` | 2026-07-22 | Empty commit — trigger Railway redeploy |
| `d687f54` | 2026-07-22 | Fix date serialization in import `raw_data` payloads |

Empty redeploy commits contain **no code changes** — they exist only to re-trigger Railway builds during GitHub integration outages.

**Files changed across all post-baseline commits (31 files, +823 / −189 lines):**
```
backend/Procfile
backend/nixpacks.toml                          [NEW]
backend/railway.json
backend/app/core/auth.py
backend/app/api/routes/copilot.py
backend/app/api/routes/admin/reports.py
backend/app/services/copilot/agent.py
backend/app/services/copilot/planner.py
backend/app/services/copilot/synthesizer.py
backend/app/services/llm/manager.py
backend/app/services/kpi/service.py
backend/app/services/data_import/parser.py
backend/app/services/data_import/service.py
backend/scripts/bootstrap_admin.py             [NEW]
backend/tests/test_data_import_service.py      [NEW]
frontend/src/App.tsx
frontend/src/contexts/AuthContext.tsx
frontend/src/lib/auth-utils.ts                 [NEW]
frontend/src/lib/format.ts                     [NEW]
frontend/src/hooks/useCopilot.ts
frontend/src/components/ErrorBoundary.tsx
frontend/src/components/ui/slider.tsx
frontend/src/components/layout/AppShell.tsx
frontend/src/components/copilot/ConversationSidebar.tsx
frontend/src/components/dashboard/RevenueTrendChart.tsx
frontend/src/components/dashboard/ZoneChart.tsx
frontend/src/pages/CopilotPage.tsx
frontend/src/pages/DashboardPage.tsx
frontend/src/pages/DataPage.tsx
frontend/src/pages/SettingsPage.tsx
frontend/src/pages/admin/UsersPage.tsx
```

**No changes** were made post-baseline to:
- `supabase/migrations/*` (001–009 unchanged)
- `backend/pyproject.toml` / `frontend/package.json` (no new dependencies)
- Edge function `supabase/functions/daily-morning-brief/index.ts`
- Any frontend route additions/removals

---

## Architecture

### A1. LLM provider selection strategy changed

**Original expected (`day3_implementation`, `LLMManager`):**
- Primary: Gemini 2.5 Flash
- Failover: OpenRouter Claude Haiku on Gemini failure
- `_current_provider` starts as Gemini

**Actually implemented:**
- `LLMManager.__init__` sets `_current_provider = LLMProvider.OPENROUTER` immediately
- Gemini client is **skipped entirely** when `gemini_api_key` is empty/whitespace
- On any Gemini exception, `_gemini_disabled = True` for the lifetime of that manager instance (no retry until new request creates new manager)
- OpenRouter is the **de facto primary** in production because Gemini 2.5 Flash returned HTTP 404 for the project's API key

**Why:** Production Copilot returned empty streams when Gemini failed silently; OpenRouter with a valid key was the only working provider.

**Files affected:** `backend/app/services/llm/manager.py`

**Downstream implications:**
- Future plans must treat **OpenRouter as required**, not optional failover
- Do not assume Gemini works without verifying the key against Google's current model list
- Copilot error messages now surface `"All LLM providers unavailable. OpenRouter: ..."` when both fail

---

### A2. Copilot agent split: analytics vs conversational paths

**Original expected:**
- All questions go through Plan → Execute (SQL) → Synthesize
- Greetings would get an empty SQL plan and synthesizer would answer from empty results

**Actually implemented:**
- `CopilotAgent.answer()` and `answer_stream()` branch on `if not plan.steps:`
- Zero-step plans route to `Synthesizer.conversational()` / `conversational_stream()` with a separate system prompt (`_CONVERSATIONAL_SYSTEM`)
- Non-zero-step plans still use the analytics synthesizer

**Why:** Greetings produced meta-commentary ("Here is a response to the user's greeting…") instead of natural replies when synthesizer received empty SQL results.

**Files affected:**
- `backend/app/services/copilot/agent.py`
- `backend/app/services/copilot/synthesizer.py`

**Downstream implications:**
- Planner fallback plans with `steps=[]` intentionally trigger conversational mode
- Do not remove `_fallback_plan()` — it is the greeting/chitchat path
- Analytics prompts must not be used for zero-SQL plans

---

### A3. Copilot stream error surfacing

**Original expected:**
- Stream failures would propagate as HTTP 500 or silent empty body

**Actually implemented:**
- `copilot.py` `event_stream()` wraps `agent.answer_stream()` in try/except
- On exception: yields SSE chunk `data: Sorry, I couldn't process that request. ({exc})\n\n` then `data: [DONE]\n\n`
- HTTP status remains 200 (stream already started)

**Why:** Planner JSON parse crashes and LLM 401 errors produced HTTP 200 with zero-byte body; frontend showed empty AI bubbles.

**Files affected:** `backend/app/api/routes/copilot.py`

**Downstream implications:**
- Frontend must parse error text from SSE chunks, not rely on HTTP status alone
- `useCopilot.ts` also adds client-side fallback for empty content after stream completes

---

### A4. Data import architecture extended for non-FMCG POS exports

**Original expected (`day4_implementation`, `runbook.md`):**
- CSV/XLSX with flat header row on row 0
- FMCG column names: `invoice_date`, `party_name`, `total_amount` (or aliases `date`, `customer`, `total`)
- `pd.read_excel()` reads first sheet only

**Actually implemented:**
- Multi-sheet Excel scanner: iterates all sheets, tries header rows 0–14
- Scores candidates by valid date count × 1000 + row count
- Extended alias map for restaurant/POS columns (`bill_amt`, `location`, `brand_name`, etc.)
- Column coalescing with priority order when multiple sources map to one field
- JSON sanitization layer before Supabase insert (`_safe_float`, `_safe_str`, `_sanitize_for_json`)

**Why:** Real customer file (`Sales Report.xlsx`) was a 50+ sheet BrainPower/Qaffeine POS export with headers on row 6+, not FMCG format.

**Files affected:**
- `backend/app/services/data_import/parser.py`
- `backend/app/services/data_import/service.py`

**Downstream implications:**
- Import now supports restaurant/QSR POS reports in addition to FMCG ERP exports
- `raw_data` JSONB column stores all extra columns from source file (sanitized)
- Future import UI may need sheet selector if auto-detection picks wrong sheet

---

## Database

### D1. No schema migrations post-baseline

**Original expected:** Migrations 001–009 applied manually via Supabase SQL Editor.

**Actually implemented:** **No new migration files** after `838d0f7`. Schema unchanged.

**Why:** All post-implementation fixes were application-layer only.

**Files affected:** None

**Downstream implications:**
- `profiles.role` CHECK constraint still only allows `admin` / `user` — **not** `superadmin` (see [Known Gaps](#known-gaps-still-open))
- Conversation persistence for **streaming** chat still relies on existing `conversations` + `chat_history` tables but streaming path doesn't write to them yet

---

## Backend

### B1. JWT validation — HS256 + ES256/RS256 JWKS support

**Original expected (`day2_implementation`, `auth.py`):**
```python
jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm], audience="authenticated")
```
- Single HS256 algorithm using `JWT_SECRET` from Supabase dashboard

**Actually implemented:**
- Reads JWT header algorithm via `jwt.get_unverified_header()`
- **HS256:** legacy path using `settings.jwt_secret`
- **ES256 / RS256:** fetches JWKS from `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`
- JWKS cached in module-level `_JWKS_CACHE` with 3600s TTL
- Uses `jose.jwk.construct()` for asymmetric key verification

**Why:** Newer Supabase projects sign access tokens with ES256. All authenticated API calls returned `401 Invalid token: The specified alg value is not allowed`.

**Files affected:** `backend/app/core/auth.py`

**Downstream implications:**
- `SUPABASE_URL` must be correct on Railway — wrong URL causes JWKS fetch failure (`Name or service not known`)
- `JWT_SECRET` still required for HS256 fallback but ES256 projects may never use it
- `admin/reports.py` morning-brief JWT path now imports `decode_supabase_jwt` from core auth (supports both algorithms)

---

### B2. Admin morning-brief auth uses shared JWT decoder

**Original expected:**
- `_authorize()` in admin reports had inline JWT decode logic

**Actually implemented:**
- Refactored to `from app.core.auth import decode_supabase_jwt`
- Removed duplicate decode implementation

**Why:** ES256 support needed in morning-brief JWT path; DRY after auth.py JWKS update.

**Files affected:** `backend/app/api/routes/admin/reports.py`

**Downstream implications:** Morning brief JWT auth inherits JWKS behavior automatically.

---

### B3. KPI service graceful degradation

**Original expected:**
- PostgREST aggregate queries (`total_amount.sum()`) assumed to succeed
- Failures would bubble up as HTTP 500 on `/kpi/`

**Actually implemented:**
- `get_top_products()`, `get_zone_breakdown()`, `get_revenue_trend()` wrap PostgREST calls in `try/except APIError`
- On failure: log warning, return empty list (not exception)
- `get_summary()` RPC call unchanged (still raises on failure)

**Why:** Empty `sales_data` or PostgREST aggregate syntax issues crashed dashboard with 500 instead of showing zeros.

**Files affected:** `backend/app/services/kpi/service.py`

**Downstream implications:**
- Dashboard shows empty charts when no data or aggregate fails — intentional
- Do not revert to raising — production tenants start with zero rows

---

### B4. Planner JSON parsing hardening

**Original expected:**
- `json.loads()` on LLM output; failure = unhandled exception

**Actually implemented:**
- Regex extract first `{...}` block from raw LLM output
- Strip control characters `[\x00-\x08\x0b\x0c\x0e-\x1f]` from JSON string (LLM SQL often contains raw newlines)
- On parse failure: `_fallback_plan("general inquiry")` returning `Plan(steps=[], ...)`

**Why:** LLM returned JSON with embedded newlines in SQL strings → `json.loads()` crash → empty Copilot stream.

**Files affected:** `backend/app/services/copilot/planner.py`

**Downstream implications:**
- Fallback plan triggers conversational mode (see A2)
- Log line: `"Invalid planner JSON, using fallback. Raw: ..."` for debugging

---

### B5. Synthesizer anti-meta-commentary rules

**Original expected:**
- Standard analytics system prompt only

**Actually implemented:**
- Added to `_SYNTHESIZE_SYSTEM`:
  - "Write the answer directly to the user. Never describe, explain, or comment on your response."
  - "Never use phrases like 'here is a response' or 'I have greeted the user'."
- New `_CONVERSATIONAL_SYSTEM` prompt for greeting path (see A2)

**Why:** Even with SQL data, LLM sometimes narrated its own response instead of answering.

**Files affected:** `backend/app/services/copilot/synthesizer.py`

---

### B6. Data import parser — full rewrite of Excel handling

**Original expected (`parser.py` baseline):**
```python
df = pd.read_excel(io.BytesIO(file_content))  # first sheet, row 0 headers
df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
df = df.rename(columns=COLUMN_ALIASES)  # 13 aliases only
```

**Actually implemented (209 lines added/changed):**

| Feature | Detail |
|---|---|
| Multi-sheet scan | `_parse_excel()` iterates `xl.sheet_names` |
| Header row detection | Tries rows 0–14 via `_frame_from_header_row()` |
| Candidate scoring | `_score_candidate()` = valid_dates × 1000 + row_count |
| Column normalization | `_normalize_col_name()` strips non-word chars, collapses whitespace |
| Unnamed column drop | Removes `unnamed:*` columns from Excel exports |
| Alias coalescing | Multiple source columns → one target with priority (`COALESCE_ORDER`) |
| Party name fallbacks | `location_name` > `location` > `restaurant_name` > `brand_name` > … |
| Total amount fallbacks | `bill_amt` > `amount` > `total` > `net_amt` > … |
| Post-coercion cleanup | Numeric cols → `fillna(0.0)`; string cols → `fillna("")`; filter `total_amount > 0` |

**New column aliases (beyond baseline):**
`brand_name`, `brand`, `restaurant_name`, `location_name`, `location`, `customer_name`, `store`, `bill_amt`, `amount`, `net_amt`, `total_settlment`, `total_settlement`, `basic_amt`, `pax`, `state`, `region`, `bill_no`, `web_billno`, `order_no`, `brainpower_order_no`, `channel_type`, `aggregator_name`, `order_from`

**Why:** Customer POS export had columns `DATE`, `LOCATION`, `BRAND NAME`, `BILL AMT` on row 6 of sheet "Bill Register from 0 to 1552".

**Files affected:** `backend/app/services/data_import/parser.py`

**Downstream implications:**
- Test file with real POS xlsx: 4010 rows parsed, Dec 1–7 2025, ₹830K total
- Scheme/secondary import panels use same parser — POS aliases apply there too
- Improved error message when no sheet matches: mentions Bill Register / Aggregator Details

---

### B7. Data import service — JSON-safe row building

**Original expected:**
```python
"quantity": float(row.get("quantity", 0)),
"raw_data": row,  # direct dict from pandas
```

**Actually implemented:**
- `_safe_float()` — NaN/Inf/None → `0.0`
- `_safe_str()` — NaN/None/`"nan"` string → `""`
- `_sanitize_for_json()` — recursive dict/list walk; dates → ISO string; NaN → None; numpy scalars → `.item()`
- `json.dumps(enriched[-1])` validation before batch insert
- All typed columns use safe helpers; `raw_data` uses sanitized copy

**Why:**
1. `float('nan')` is not JSON compliant → Supabase insert failed: `"Out of range float values are not JSON compliant: nan"`
2. Python `date` objects in `raw_data` → `"Object of type date is not JSON serializable"`

**Files affected:**
- `backend/app/services/data_import/service.py`
- `backend/app/services/data_import/parser.py` (preventive fillna)
- `backend/tests/test_data_import_service.py` [NEW]

**Downstream implications:**
- Every new column added to import must go through safe helpers
- `raw_data` may contain `null` for former NaN values (not omitted keys)

---

### B8. Bootstrap admin script (new)

**Original expected (`onboarding-checklist.md`):**
- Manual SQL: INSERT tenant → Supabase Auth invite → INSERT profile
- No automated script in repo

**Actually implemented:**
- `backend/scripts/bootstrap_admin.py` — CLI script:
  - Creates tenant (or reuses by slug)
  - Creates Supabase auth user via Admin API with `user_metadata: {tenant_id, role: admin, display_name}`
  - Relies on `handle_new_user` trigger for profile creation
  - Args: `--email`, `--password`, `--name`, `--slug`

**Why:** Production had no users; manual SQL was error-prone; auth trigger requires `tenant_id` in metadata.

**Files affected:** `backend/scripts/bootstrap_admin.py` [NEW]

**Downstream implications:**
- First admin **must** have `tenant_id` and `role` in `user_metadata` for trigger + frontend fallback
- Script uses `SUPABASE_SERVICE_ROLE_KEY` from `backend/.env`
- Demo tenant created: slug `demo`, industry `fmcg_distribution`

---

## API Layer

### API1. Copilot streaming error response format

**Original expected:** SSE chunks are LLM text only; errors are HTTP exceptions.

**Actually implemented:** Error text delivered as SSE `data:` lines within 200 response (see A3).

**Files affected:** `backend/app/api/routes/copilot.py`

---

### API2. Copilot non-stream vs stream conversation persistence (unchanged bug)

**Original expected (`plan_chatgpt_ui_conversations.md`, `copilot.py`):**
- Both stream and non-stream save to `conversations` + `chat_history`

**Actually implemented (baseline, NOT fixed post-impl):**
- **Non-stream path only** creates conversation + saves chat_history
- **Stream path** (`stream=True`, used by frontend) does **NOT** persist conversations or messages

**Why not fixed:** Identified during testing; deferred.

**Files affected:** `backend/app/api/routes/copilot.py` (no change)

**Downstream implications:** Sidebar shows "No conversations yet" even after chatting — **known open gap**

---

### API3. `/auth/me` behavior unchanged but failure handling moved to frontend

**Original expected:** Frontend relies on `/auth/me` for role/tenant.

**Actually implemented:** Backend route unchanged; frontend now falls back to session metadata when `/auth/me` fails (see Authentication section).

**Why:** Wrong `SUPABASE_SERVICE_ROLE_KEY` on Railway caused 403 on `/auth/me`.

---

## Frontend

### F1. Root route redirect

**Original expected:** `/` may redirect to dashboard or show landing.

**Actually implemented:** `<Route path="/" element={<Navigate to="/login" replace />} />`

**Why:** Unauthenticated users hitting Vercel root saw blank/broken state.

**Files affected:** `frontend/src/App.tsx`

---

### F2. AuthContext — immediate session on sign-in + metadata fallback

**Original expected:**
- `signIn()` calls Supabase, relies on `onAuthStateChange` to update session/user
- `/auth/me` failure → user stays null

**Actually implemented:**
- `signIn()` explicitly calls `setSession(data.session)` then `await fetchProfile()` — no race waiting for listener
- `fetchProfile()` catch block: `setUser(userFromSession(supabaseUser))` reading `user_metadata.role`, `user_metadata.tenant_id`
- `userFromSession()` helper maps metadata to `User` type

**Why:**
1. Login appeared broken — user redirected but profile null until page refresh
2. `/auth/me` 403 when Railway service role key wrong — admin features blocked

**Files affected:** `frontend/src/contexts/AuthContext.tsx`

**Downstream implications:**
- Bootstrap script **must** set `user_metadata.role = admin` and `user_metadata.tenant_id`
- Frontend admin detection works even when backend profile lookup fails temporarily

---

### F3. Auth utils module (new)

**Original expected:** Admin check via `user?.role === "admin"` inline.

**Actually implemented:**
- `frontend/src/lib/auth-utils.ts`:
  - `isAdmin(user, session)` — checks API profile OR `session.user.user_metadata.role`
  - `roleLabel(user, session)` — returns `"Admin"` | `"Viewer"`

**Why:** Centralize dual-source role resolution after metadata fallback added.

**Files affected:**
- `frontend/src/lib/auth-utils.ts` [NEW]
- `frontend/src/components/layout/AppShell.tsx`
- `frontend/src/pages/DataPage.tsx`
- `frontend/src/pages/SettingsPage.tsx`

---

### F4. Format utils module (new)

**Original expected:** Inline `.toFixed()` on KPI/chart values assuming numbers.

**Actually implemented:**
- `frontend/src/lib/format.ts`:
  - `toNum(value)` — coerces string/null to finite number
  - `formatINR(value)` — ₹ with L/Cr/K suffixes
  - `formatINRCompact(value)` — shorter variant for charts

**Why:** FastAPI serializes Pydantic `Decimal` as JSON **strings**; `value.toFixed is not a function` crashed Dashboard.

**Files affected:**
- `frontend/src/lib/format.ts` [NEW]
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/components/dashboard/RevenueTrendChart.tsx`
- `frontend/src/components/dashboard/ZoneChart.tsx`

**Downstream implications:**
- **Always** use `toNum()` before `.toFixed()` on API numeric fields
- Backend still returns Decimal strings — do not change frontend to assume numbers without coercion

---

### F5. Copilot page layout — unified header

**Original expected (`plan_chatgpt_ui_conversations.md`):**
- ConversationSidebar had its own top bar with "+ New Chat" button
- Main chat area had separate "AKARA Copilot" header
- Two misaligned top bars visible (sidebar column vs chat column)

**Actually implemented:**
- Single full-width header at top of `CopilotPage` containing title, subtitle, and "+ New Chat" button
- `ConversationSidebar` stripped of header/New Chat — list only
- Page structure: `flex flex-col h-full min-h-0` → header → `flex flex-1` (sidebar + chat)

**Why:** User-reported misaligned top bar in production screenshot.

**Files affected:**
- `frontend/src/pages/CopilotPage.tsx`
- `frontend/src/components/copilot/ConversationSidebar.tsx`
- `frontend/src/components/layout/AppShell.tsx` — `isCopilot` path uses `overflow-hidden` on main

---

### F6. Copilot SSE parsing improvements

**Original expected:**
- Split buffer by `\n` only
- No empty-stream handling

**Actually implemented:**
- Line split: `/\r?\n/` (handles `\r\n` from some proxies)
- After stream completes: if assistant message content is empty → show `"Sorry, something went wrong. Please try again."` with `error: true`

**Why:** Empty streams from backend LLM failures showed blank AI bubbles.

**Files affected:** `frontend/src/hooks/useCopilot.ts`

---

### F7. DataPage admin gate uses isAdmin helper

**Original expected:** `user?.role === "admin"`

**Actually implemented:** `const admin = isAdmin(user, session)` — passes to upload panels

**Why:** Consistent with metadata fallback; bootstrapped admins could upload when `/auth/me` failed.

**Files affected:** `frontend/src/pages/DataPage.tsx`

---

### F8. TypeScript build fixes for Vercel

**Original expected:** Clean `tsc` + `pnpm build`.

**Actually implemented:**
| File | Fix |
|---|---|
| `ErrorBoundary.tsx` | Type fix for React error boundary (minor) |
| `slider.tsx` | Radix slider type compatibility |
| `CopilotPage.tsx` | Removed unused import |
| `UsersPage.tsx` | Removed unused import |

**Why:** Vercel production build failed on TypeScript errors.

**Files affected:** See table above (`ea4df94`)

---

## Authentication

### AUTH1. Dual JWT algorithm support (see B1)

Cross-reference: Backend B1.

---

### AUTH2. Frontend admin role dual-source resolution

**Original expected:** Single source of truth — `profiles.role` via `/auth/me`.

**Actually implemented:** Dual source — API profile primary, Supabase `user_metadata.role` fallback.

**Why:** Production 403 on `/auth/me` when service role key misconfigured on Railway.

**Files affected:** `AuthContext.tsx`, `auth-utils.ts`, consumers in AppShell/DataPage/SettingsPage

**Downstream implications:**
- Changing role requires updating **both** `profiles.role` AND `user_metadata.role` for consistent behavior
- Or ensure `/auth/me` always works (correct `SUPABASE_SERVICE_ROLE_KEY`)

---

### AUTH3. Bootstrap user metadata contract

**Original expected (`003_functions.sql`):** `handle_new_user` trigger reads metadata.

**Actually implemented:** Explicit metadata contract enforced by bootstrap script:
```json
{
  "tenant_id": "<uuid>",
  "role": "admin",
  "display_name": "<string>"
}
```

**Why:** Without `tenant_id` in metadata, trigger fails or creates orphan profile.

**Files affected:** `backend/scripts/bootstrap_admin.py`

---

## Validation

### V1. Import required columns — unchanged set, expanded alias paths

**Required columns (unchanged):** `invoice_date`, `party_name`, `total_amount`

**What changed:** Many more alias paths and multi-sheet detection to **reach** required columns — validation rules same, discovery logic different.

---

### V2. JSON payload validation before insert

**Original expected:** Pandas → dict → Supabase insert directly.

**Actually implemented:** Per-row `json.dumps()` pre-check; safe type coercion on all fields.

**Files affected:** `backend/app/services/data_import/service.py`

---

### V3. Post-parse row filtering

**Original expected:** Drop rows missing required fields only.

**Actually implemented:** Additionally filters `total_amount > 0` after coercion.

**Why:** POS exports include zero-amount void/cancel rows.

**Files affected:** `backend/app/services/data_import/parser.py`

---

## Configuration

### C1. Railway Nixpacks configuration (new file)

**Original expected (`deployment-guide.md`, `railway.json`):**
- Nixpacks auto-detects Python
- Build: `pip install uv && uv sync`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

**Actually implemented:** `backend/nixpacks.toml`:
```toml
[variables]
NIXPACKS_UV_VERSION = "0.4.30"
NIXPACKS_PYTHON_VERSION = "3.12"

[phases.install]
cmds = [
  "python -m venv --copies /opt/venv",
  ". /opt/venv/bin/activate && pip install uv==0.4.30",
  "UV_PROJECT_ENVIRONMENT=/opt/venv /opt/venv/bin/uv sync --no-dev --frozen",
]
paths = ["/opt/venv/bin"]

[start]
cmd = "/opt/venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT"
```

**Why:**
1. Railway set `NIXPACKS_UV_VERSION=""` → `pip install uv==` failed
2. Default uv sync installed to `.venv` but start command used `/opt/venv` → `No module named uvicorn`

**Files affected:**
- `backend/nixpacks.toml` [NEW]
- `backend/railway.json` — start command updated to `/opt/venv/bin/python -m uvicorn ...`
- `backend/Procfile` — aligned start command

**Downstream implications:**
- Do not remove `UV_PROJECT_ENVIRONMENT=/opt/venv` from install phase
- Pin uv version explicitly — auto-detection is unreliable on Railway

---

### C2. Production environment variables — discovered requirements

**Original expected:** Copy from `.env.example` to Railway/Vercel.

**Actually implemented / discovered during deployment:**

| Variable | Issue found | Resolution |
|---|---|---|
| `SUPABASE_URL` | Wrong URL caused JWKS DNS failure | Must be exact project URL |
| `JWT_SECRET` | Random value inserted — HS256 fallback broken | Must match Supabase dashboard JWT secret |
| `SUPABASE_SERVICE_ROLE_KEY` | Wrong key → `/auth/me` 403 "User profile not found" | Must match Supabase service_role key exactly |
| `OPENROUTER_API_KEY` | Missing/wrong → Copilot 401 | **Required** in practice (Gemini unavailable) |
| `ALLOWED_ORIGINS_RAW` | Must include Vercel URL | Set to `https://akara2.vercel.app` |
| `ENVIRONMENT` | Still `development` in `/health` on production | Not yet changed — docs say `production` |
| `VITE_*` on Vercel | Missing initially → auth broken on frontend | All 3 required; redeploy after setting |

**Files affected:** Railway/Vercel dashboards (not in repo)

**Downstream implications:**
- `/health` returning `environment: development` is a known cosmetic issue
- Always redeploy Vercel after changing `VITE_*` vars (baked at build time)

---

### C3. Supabase Auth URL configuration

**Original expected:** Site URL = Vercel URL.

**Actually implemented in production:**
- Site URL: `https://akara2.vercel.app` (not `/login` path)
- Redirect URLs: `https://akara2.vercel.app/**`

**Why:** Auth redirects failed when Site URL pointed to `/login`.

---

## Dependencies

### DEP1. No package.json or pyproject.toml changes

**Original expected:** Dependencies locked at Day 13.

**Actually implemented:** No new runtime dependencies added post-baseline.

---

### DEP2. New test file

**Original expected:** 6 test files, ~28 tests (Day 12).

**Actually implemented:** Added `backend/tests/test_data_import_service.py` with 3 tests:
- `test_safe_float_handles_nan`
- `test_sanitize_for_json_removes_nan`
- `test_sanitize_for_json_handles_date`
- `test_import_records_are_json_serializable`

**Files affected:** `backend/tests/test_data_import_service.py` [NEW]

**Total tests post-baseline:** 7 test files, ~31 tests (7 in new file includes 4 test functions; parser tests unchanged at 4).

---

## Deployment & Operations

### OPS1. Railway GitHub integration outages

**Discovered during deployment (not a code change):**
- Multiple pushes queued with message: *"Deployment queued due to upstream GitHub issues"*
- Empty commits (`7e1ef35`, `4769a65`) used to re-trigger builds
- Workaround documented: `npx @railway/cli up` from `backend/` directory
- Cancel stale queued deploys; keep only latest commit

---

### OPS2. Production verification commands

**Health check:**
```
GET https://akara-production.up.railway.app/health
→ {"status":"ok","environment":"development","timestamp":"..."}
```

**Import fix verification (after deploy):**
- Upload `Sales Report.xlsx` → expect ~4010 rows inserted, 0 batch errors
- Pre-fix errors: `"Out of range float values are not JSON compliant: nan"` (9 batches)

**Copilot verification:**
- "hello" → natural greeting (post `f330abf`), not meta-commentary
- Requires valid `OPENROUTER_API_KEY` on Railway

---

### OPS3. CI workflow path mismatch (pre-existing, not fixed)

**Original expected (`.github/workflows/ci.yml`):**
```yaml
working-directory: akara/backend
working-directory: akara/frontend
```

**Actual repo structure:** Git root **is** `akara/` — correct paths should be `backend/` and `frontend/`.

**Status:** **Not fixed** post-implementation. CI likely fails if triggered.

**Files affected:** `.github/workflows/ci.yml`

---

## Known Gaps Still Open

These were identified during post-implementation work but **not yet implemented**. Future plans must not assume these work.

| Gap | Original docs say | Current reality |
|---|---|---|
| **Streaming conversation persistence** | Stream + non-stream both save history | Only `stream=False` path saves to `conversations` / `chat_history` |
| **`POST /data/sync`** | JSON endpoint for Tally agent (`akara_agent.py`) | **Not implemented** — only `/data/import` exists |
| **`superadmin` role** | Morning brief JWT auth checks `role == "superadmin"` | DB CHECK only allows `admin`/`user` — JWT admin path for morning brief is **broken** |
| **CI working directories** | `akara/backend`, `akara/frontend` | Should be `backend/`, `frontend/` |
| **`ENVIRONMENT=production`** | Set on Railway | Still `development` in production `/health` |
| **Gemini as primary LLM** | Gemini 2.5 Flash primary | OpenRouter is de facto primary; Gemini 404 for project key |
| **Frontend creates conversation before stream** | Conversations appear in sidebar | Frontend never calls `POST /copilot/conversations` before streaming chat |
| **Zustand state** | Listed in package.json | Declared but never imported — React Query + useState used instead |

---

## Invalidated Assumptions

Future implementation plans must **not** assume the following from original docs:

1. **JWT is always HS256 with JWT_SECRET** → Now ES256/RS256 via JWKS for newer Supabase projects
2. **Gemini 2.5 Flash works out of the box** → Verify model availability; OpenRouter required in practice
3. **Excel imports are single-sheet FMCG with row-0 headers** → Must handle multi-sheet POS exports with metadata rows
4. **Pandas NaN survives JSON serialization** → Must sanitize before Supabase insert
5. **Python `date` objects survive JSON serialization in raw_data** → Must convert to ISO strings
6. **Frontend receives numbers from FastAPI** → Decimal fields arrive as strings
7. **`/auth/me` always succeeds when user is logged in** → Frontend must handle failure with metadata fallback
8. **`user.role` from API is the only admin check** → Must use `isAdmin(user, session)` helper
9. **Railway Nixpacks auto-configures uv correctly** → Requires explicit `nixpacks.toml`
10. **Copilot greetings go through analytics synthesizer** → Zero-step plans use conversational mode
11. **Streaming errors return HTTP 4xx/5xx** → Errors may arrive as SSE text chunks with HTTP 200
12. **First user can be created via Supabase dashboard alone** → Use `bootstrap_admin.py` with metadata contract
13. **Copilot conversations persist during normal chat** → Stream path doesn't save — sidebar stays empty
14. **CI paths `akara/backend` are correct** → Repo root is already `akara/`

---

## Miscellaneous Fixes

### M1. AppShell copilot overflow

**Change:** Main content area uses `overflow-hidden` when path starts with `/copilot` (instead of `overflow-auto`).

**Why:** Copilot page manages its own internal scroll; double scrollbars and layout breaks otherwise.

**Files affected:** `frontend/src/components/layout/AppShell.tsx`

---

### M2. ConversationSidebar simplified

**Removed:** Header section with "+ New Chat" button (moved to CopilotPage header).

**Files affected:** `frontend/src/components/copilot/ConversationSidebar.tsx`

---

### M3. SettingsPage admin check

**Change:** Uses `isAdmin(user, session)` instead of inline role check.

**Files affected:** `frontend/src/pages/SettingsPage.tsx`

---

## Summary for Future Plan Generation

When generating new implementation plans for AKARA:

1. **Start from commit `d687f54`**, not day-wise docs alone
2. **Treat OpenRouter as required** for Copilot; Gemini is best-effort
3. **Use JWKS-aware auth** — never HS256-only
4. **Use `isAdmin(user, session)`** on frontend for any admin gate
5. **Use `toNum()` / `formatINR()`** for all API numeric display
6. **Sanitize all import payloads** through `_safe_float`, `_safe_str`, `_sanitize_for_json`
7. **Support multi-sheet Excel** with header row detection for data import
8. **Railway requires `nixpacks.toml`** — do not rely on default Nixpacks uv behavior
9. **Fix open gaps** (streaming persistence, `/data/sync`, CI paths, superadmin role) before assuming those features work
10. **Bootstrap first admin** with `backend/scripts/bootstrap_admin.py`, not manual SQL alone

---

*Document generated: 2026-07-22*  
*Baseline: `838d0f7` | HEAD: `d687f54`*  
*Maintainer: update this file whenever post-implementation changes are made.*
