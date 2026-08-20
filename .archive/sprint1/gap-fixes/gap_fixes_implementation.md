# Gap Fixes + Per-Tenant Language Support — Implementation Handoff

Applied **after Day 7**. This session fixed two categories of issues found in the audit:

1. A **critical missing Postgres RPC function** (`execute_tenant_query`) that caused every copilot request to return HTTP 500.
2. A **language model redesign** — the original code hardcoded Hindi in the FMCG synthesizer addendum. The correct model is: language is per-tenant, set via `tenants.config.language`, independent of industry, and the copilot mirrors the user's input language rather than forcing a fixed language pair.

---

## File: `akara/migrations/005_execute_tenant_query.sql`

**Status:** Created

**Purpose:**
`backend/app/sql/executor.py` calls `execute_tenant_query(TEXT, JSONB)` via Supabase RPC on **every single copilot question**. This function was never created in migrations 001–004. Without it, every `POST /copilot/chat` returns a 500 error from Supabase.

**Dependencies:**
- Called exclusively by `backend/app/sql/executor.py` → `SQLExecutor.run()`
- Must run AFTER migrations 001–004

**Implementation:**

```sql
-- ============================================================
-- AKARA: execute_tenant_query RPC
-- Migration 005 — run AFTER 001, 002, 003, 004
--
-- Called by backend/app/sql/executor.py on every copilot question.
-- Without this function every POST /copilot/chat returns a 500.
--
-- Security:
--   SECURITY DEFINER — runs as the function owner (superuser), not the caller.
--   Restricted to service_role only via REVOKE/GRANT.
--   SQLGuard in executor.py enforces SELECT-only before this is ever called.
-- ============================================================

CREATE OR REPLACE FUNCTION public.execute_tenant_query(
    p_query  TEXT,
    p_params JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
BEGIN
    EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', p_query)
    INTO v_result;
    RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;

REVOKE ALL ON FUNCTION public.execute_tenant_query(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_tenant_query(TEXT, JSONB) TO service_role;
```

**Placement:** New file. Run in Supabase SQL editor after migrations 001–004.

**Explanation:**
- Uses `SECURITY DEFINER` so it executes with elevated privileges (needed to read tenant tables).
- `SQLGuard` in `executor.py` already enforces SELECT-only queries before this is called — this function does not add its own SQL validation.
- `REVOKE/GRANT` ensures only the backend's `service_role` key can invoke this function; no anon access.
- Returns `'[]'::JSONB` on empty result instead of NULL, keeping downstream code consistent.

**Related Changes:**
- `backend/app/sql/executor.py` → the caller of this RPC (unchanged, was already written correctly)

---

## File: `akara/migrations/006_update_tenant_config_rpc.sql`

**Status:** Created

**Purpose:**
`PATCH /admin/tenants/{tenant_id}/config` needs to merge-update the JSONB config column (e.g. set `language: "te"` without overwriting `industry: "fmcg_distribution"`). This requires a Postgres function because the JS `||` merge operator is not directly expressible via the Supabase Python SDK's `.update()` method.

**Dependencies:**
- Called by `backend/app/api/routes/admin/tenants.py` → `update_tenant_config()`
- Must run AFTER migration 005

**Implementation:**

```sql
-- ============================================================
-- AKARA: update_tenant_config RPC
-- Migration 006 — run AFTER 005
--
-- Called by PATCH /admin/tenants/{tenant_id}/config.
-- Merges the patch JSON into the existing config column using ||
-- so existing keys (industry, currency, etc.) are NOT overwritten
-- unless explicitly included in the patch.
--
-- Example call:
--   PATCH /admin/tenants/<id>/config   body: {"language": "te"}
--   Result: config = old_config || {"language": "te"}
--
-- Security:
--   SECURITY DEFINER — runs as function owner (superuser).
--   Restricted to service_role only.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_tenant_config(
    p_tenant_id UUID,
    p_patch     JSONB
)
RETURNS SETOF public.tenants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    UPDATE public.tenants
    SET    config = config || p_patch,
           updated_at = NOW()
    WHERE  id = p_tenant_id
    RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.update_tenant_config(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_tenant_config(UUID, JSONB) TO service_role;
```

**Placement:** New file. Run in Supabase SQL editor after migration 005.

**Explanation:**
- `config || p_patch` merges at the top level. If the patch is `{"language": "te"}` and config is `{"industry": "fmcg_distribution"}`, the result is `{"industry": "fmcg_distribution", "language": "te"}`.
- `RETURNS SETOF public.tenants` + `RETURNING *` gives the FastAPI route the full updated tenant row to return to the caller.
- Returns empty set if `p_tenant_id` is not found — the FastAPI route converts that to a 404.

**Related Changes:**
- `backend/app/api/routes/admin/tenants.py` → adds the endpoint that calls this RPC

---

## File: `backend/app/api/routes/admin/tenants.py`

**Status:** Modified

**Purpose:**
Added `TenantConfigUpdate` Pydantic model and `PATCH /admin/tenants/{tenant_id}/config` endpoint so tenants' `language`, `industry`, `currency`, or any other config key can be updated after creation (e.g. from the Day 9 Settings page).

**Dependencies:**
- Migration 006 (`update_tenant_config` RPC must exist)
- `app.core.tenant.get_supabase_service_client`
- `app.core.tenant.TenantCtx`, `TenantContext`
- `app.core.auth.CurrentUser`

**Original Code (before change):**

```python
class TenantCreate(BaseModel):
    name: str
    slug: str
    config: dict = {}


@router.patch("/{tenant_id}/deactivate", response_model=TenantOut)
```

**Replacement Code:**

```python
class TenantCreate(BaseModel):
    name: str
    slug: str
    config: dict = {}


class TenantConfigUpdate(BaseModel):
    config: dict


@router.patch("/{tenant_id}/config", response_model=TenantOut)
def update_tenant_config(
    tenant_id: UUID,
    body: TenantConfigUpdate,
    user: CurrentUser,
    tenant: TenantContext = Depends(_require_superadmin),
) -> TenantOut:
    """Merge-update a tenant's config JSONB.
    Existing keys not in the request body are preserved (concat operator ||).
    Use this endpoint to set language, industry, currency, or any config field
    after tenant creation — e.g. from the Settings page.
    """
    supabase = get_supabase_service_client()
    result = (
        supabase.rpc(
            "update_tenant_config",
            {"p_tenant_id": str(tenant_id), "p_patch": body.config},
        ).execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return TenantOut(**result.data[0])


@router.patch("/{tenant_id}/deactivate", response_model=TenantOut)
```

**Placement:** Insert `TenantConfigUpdate` class directly after `TenantCreate`. Insert the new route handler directly before the existing `/{tenant_id}/deactivate` route.

**Explanation:**
- `PATCH /admin/tenants/{id}/config` is guarded by `_require_superadmin` — only superadmins can update tenant config.
- The body `config: dict` is the patch — only the keys you send are updated. Other keys are preserved by the `||` operator in the Postgres function.
- Returns the full updated `TenantOut` on success.

**Related Changes:**
- Migration 006 must be applied first
- Day 9 Settings page will call this endpoint to save the user's language selection

---

## File: `backend/app/services/prompts/generator.py`

**Status:** Modified

**Purpose:**
1. Removed the hardcoded Hindi language block from `_FMCG_DISTRIBUTION_SYNTHESIZER` — language is now fully decoupled from industry.
2. Added `_LANGUAGE_NAMES` registry mapping ISO-639-1 language codes to (name, script) pairs for 7 Indian languages.
3. Added `build_language_addendum()` method to `PromptGenerator` — generates a mirror-language instruction based on `tenant_config.language`.

**Dependencies:**
- `app.services.schema.discovery.SchemaDiscovery`
- Called from `backend/app/api/routes/copilot.py`

**Original `_FMCG_DISTRIBUTION_SYNTHESIZER` (before change):**

```python
_FMCG_DISTRIBUTION_SYNTHESIZER = """
Currency and number formatting:
- Always express monetary values in Indian format using the ₹ symbol with lakh/crore notation.
  Examples: ₹4.2 lakh, ₹1.3 crore, ₹85,000. Never write raw numbers like 420000 or 1300000.
  Threshold: < ₹1 lakh → ₹X,XXX; ≥ ₹1 lakh → ₹X.X lakh; ≥ ₹1 crore → ₹X.XX crore.
- Where the data supports it, estimate the business impact in ₹ lakh or ₹ crore.
  Example: "This represents an estimated ₹6.8 lakh in recoverable revenue if corrected."

Language:
- If the user's question is in Hindi (Devanagari script) or Hinglish, respond entirely in Hindi.
  SQL generation always stays in English internally.
- If the question is in English, respond in English.

Domain knowledge:
- Parties = distributors or retailers. Zones = geographic sales territories. Routes = distributor beats.
- Primary sales = ERP dispatch (sales_data). Secondary sales = DMS offtake (secondary_sales_data).
- Scheme leakage = claimed_amount > actual secondary offtake for the same party + product + date window.
"""
```

**Complete replacement file (exact current state):**

```python
from datetime import date
from uuid import UUID

from app.services.schema.discovery import SchemaDiscovery

# ── Industry-specific addendum registry ──────────────────────────────────────
#
# Each entry maps an industry slug (from tenants.config.industry) to a pair of
# addendum strings appended to the generic _PLAN_SYSTEM and _SYNTHESIZE_SYSTEM
# constants. Language rules are NOT stored here — see _LANGUAGE_NAMES below.
# Adding a new vertical = one new entry in _INDUSTRY_ADDENDUMS.

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
    # Future verticals:
    # "pharma_distribution": { "synthesizer": ..., "planner": ... },
    # "retail": { "synthesizer": ..., "planner": ... },
}


# ── Language registry ─────────────────────────────────────────────────────────
#
# Maps ISO-639-1 code → (language name, script description).
# Used by build_language_addendum() to produce a mirror-language instruction
# that is completely independent of industry.
# Adding a new language = one new entry here.

_LANGUAGE_NAMES: dict[str, tuple[str, str]] = {
    "hi": ("Hindi", "Devanagari script"),
    "te": ("Telugu", "Telugu script"),
    "ta": ("Tamil", "Tamil script"),
    "mr": ("Marathi", "Devanagari script"),
    "kn": ("Kannada", "Kannada script"),
    "bn": ("Bengali", "Bengali script"),
    "gu": ("Gujarati", "Gujarati script"),
}


class PromptGenerator:
    """Builds context-aware system prompts for the copilot.

    Injects tenant-specific schema context, industry-specific addendums, and
    a mirror-language instruction derived from the tenant's configured language.
    Language and industry concerns are fully decoupled:
      - build_synthesizer_addendum() → industry rules only (currency, domain)
      - build_language_addendum()    → language mirror rules only
    The copilot route concatenates both before passing to the synthesizer.
    """

    def __init__(self, schema_discovery: SchemaDiscovery) -> None:
        self._schema = schema_discovery

    def build_schema_context(self, tenant_id: UUID) -> str:
        return self._schema.get_schema_context(tenant_id)

    def build_synthesizer_addendum(self, tenant_config: dict) -> str:
        """Returns the industry-specific addendum for the synthesizer system prompt
        (currency formatting, domain knowledge). Language rules are NOT included here.
        Returns empty string for unknown or unconfigured industries."""
        industry = tenant_config.get("industry", "")
        return _INDUSTRY_ADDENDUMS.get(industry, {}).get("synthesizer", "")

    def build_planner_addendum(self, tenant_config: dict) -> str:
        """Returns the industry-specific addendum for the planner system prompt."""
        industry = tenant_config.get("industry", "")
        return _INDUSTRY_ADDENDUMS.get(industry, {}).get("planner", "")

    def build_language_addendum(self, tenant_config: dict) -> str:
        """Returns a universal mirror-language instruction for the synthesizer.
        Completely independent of industry — any tenant type gets this behavior.
        Returns empty string for English-only tenants (language = 'en' or not set)."""
        language = tenant_config.get("language", "en")
        if language == "en" or language not in _LANGUAGE_NAMES:
            return ""
        name, script = _LANGUAGE_NAMES[language]
        return f"""
Language rules:
This user has selected English and {name} as their languages.
Mirror the language of the user's question exactly:
- If the question is in English, respond in English.
- If the question is in {name} ({script}), respond in {name}. English technical or business terms are acceptable where there is no natural {name} equivalent.
- If the question mixes English and {name}, mirror that same mix in your response.
SQL is always generated in English internally regardless of response language.
"""

    def build_system_prompt(
        self,
        tenant_id: UUID,
        tenant_name: str,
        start_date: str,
        end_date: str,
    ) -> str:
        """Legacy method — kept for backward compatibility. Returns a planner-style
        context prompt embedding schema + date range."""
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

**Explanation:**
- Language block removed from `_FMCG_DISTRIBUTION_SYNTHESIZER`. FMCG tenants can now be Hindi, Telugu, Tamil, or any language — their language setting is separate from being FMCG.
- `_LANGUAGE_NAMES` is a module-level dict. Adding a new language = one new entry here, no other file changes.
- `build_language_addendum()` returns an empty string for English tenants — no overhead, no prompt injection.
- Mirror-language behavior: user writes in Telugu → copilot responds in Telugu (English technical terms allowed). User writes in English → English response. User mixes → copilot mirrors the mix.

**Related Changes:**
- `backend/app/api/routes/copilot.py` — calls `build_language_addendum()`
- `backend/app/services/copilot/synthesizer.py` — reads language rules from `system_addendum`

---

## File: `backend/app/services/copilot/synthesizer.py`

**Status:** Modified

**Purpose:**
The `_SYNTHESIZE_SYSTEM` base prompt previously contained no guidance on language. It needed a neutral instruction that defers to whatever the `system_addendum` provides, so the per-tenant language rules injected by `PromptGenerator` take effect cleanly.

**Original line:**
```
- Match the language of the user's question when responding.
```

**Replacement line (line 20 in the current file):**
```
- Respond in English by default. Follow any language rules provided in the system addendum.
```

**Full current `_SYNTHESIZE_SYSTEM` constant (lines 8–21):**

```python
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
- Respond in English by default. Follow any language rules provided in the system addendum.
"""
```

**Explanation:**
- The old line "Match the language of the user's question" was too generic and could conflict with the precise mirror-language rules injected by `build_language_addendum()`. The replacement defers to the addendum cleanly.
- English-only tenants get English responses (default). Tenants with `language: "te"` get the full mirror-language rule injected via addendum.

**Related Changes:**
- `backend/app/services/prompts/generator.py` — provides the `system_addendum` content

---

## File: `backend/app/api/routes/copilot.py`

**Status:** Modified

**Purpose:**
The `synthesizer_addendum` was previously built from only `build_synthesizer_addendum()` (industry). It now also appends `build_language_addendum()` (language). Language is appended **last** so it has highest priority in the synthesizer system prompt.

**Original code (before change):**
```python
planner_addendum = prompt_gen.build_planner_addendum(tenant.tenant_config)
synthesizer_addendum = prompt_gen.build_synthesizer_addendum(tenant.tenant_config)
```

**Replacement code (lines 73–77 in the current file):**

```python
# Industry-specific addendums — empty string for unknown industries.
# Language addendum is industry-agnostic and always appended last so it
# takes highest priority in the synthesizer system prompt.
planner_addendum = prompt_gen.build_planner_addendum(tenant.tenant_config)
synthesizer_addendum = (
    prompt_gen.build_synthesizer_addendum(tenant.tenant_config)
    + prompt_gen.build_language_addendum(tenant.tenant_config)
)
```

**Explanation:**
- No changes to any other part of `copilot.py` — only the addendum construction lines changed.
- The concatenated string is passed to `CopilotAgent.answer()` and `answer_stream()` unchanged.
- For an English FMCG tenant: `synthesizer_addendum = _FMCG_DISTRIBUTION_SYNTHESIZER + ""` → same as before.
- For a Telugu FMCG tenant: `synthesizer_addendum = _FMCG_DISTRIBUTION_SYNTHESIZER + language_rules` → both apply.
- For a Telugu non-FMCG tenant: `synthesizer_addendum = "" + language_rules` → only language applies.

**Related Changes:**
- `backend/app/services/prompts/generator.py` — the two methods called here

---

## How Language Storage Works (End-to-End)

```
Tenant creation:
  POST /admin/tenants
  body: {"name": "...", "slug": "...", "config": {"industry": "fmcg_distribution", "language": "te"}}
  → stored in tenants.config JSONB column

Tenant updates language later (e.g. Day 9 Settings page):
  PATCH /admin/tenants/{id}/config
  body: {"config": {"language": "hi"}}
  → calls update_tenant_config(UUID, JSONB) RPC → config = config || {"language": "hi"}
  → industry and other keys are preserved

Every copilot request:
  GET /copilot/chat
  → get_tenant_context() fetches tenants row → TenantContext.tenant_config = {"language": "te", ...}
  → PromptGenerator.build_language_addendum(tenant_config) reads language = "te"
  → returns mirror-language instruction for Telugu
  → appended to synthesizer_addendum
  → Synthesizer._build_prompt gets: _SYNTHESIZE_SYSTEM + industry_rules + language_rules
```

**Column**: `tenants.config JSONB NOT NULL DEFAULT '{}'` (created in migration 001)
**Language key**: `config.language` — ISO 639-1 code string (`"en"`, `"te"`, `"hi"`, etc.)
**Default**: `"en"` (English) — if absent, `TenantContext.language` returns `"en"`, `build_language_addendum()` returns `""`
**Supported languages**: `hi` (Hindi), `te` (Telugu), `ta` (Tamil), `mr` (Marathi), `kn` (Kannada), `bn` (Bengali), `gu` (Gujarati)

---

## Quality Gate

Both quality gates passed after all changes:

```bash
cd akara/backend
uv run ruff check .   # All checks passed
uv run pytest -q      # 2 passed in 1.67s
```

---

## Migrations to Apply in Supabase (in order)

| Migration | File | Status |
|---|---|---|
| 001 | `001_initial_schema.sql` | Applied (Day 1) |
| 002 | `002_rls_policies.sql` | Applied (Day 1) |
| 003 | `003_functions.sql` | Applied (Day 1) |
| 004 | `004_competitive_additions.sql` | Applied (Day 1) |
| **005** | **`005_execute_tenant_query.sql`** | **Apply now — copilot is broken without this** |
| **006** | **`006_update_tenant_config_rpc.sql`** | **Apply now — needed for config updates** |
