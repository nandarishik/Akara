---
name: Fix Gaps + Language Support
overview: Fix the one critical gap (missing `execute_tenant_query` Postgres function) and add industry-agnostic mirror-language support — user selects one additional language at onboarding, bot mirrors whatever language the user writes in.
todos:
  - id: fix-migration-005
    content: Create akara/migrations/005_execute_tenant_query.sql — execute_tenant_query Postgres RPC function
    status: completed
  - id: fix-generator
    content: Update backend/app/services/prompts/generator.py — strip language block from _FMCG_DISTRIBUTION_SYNTHESIZER, add _LANGUAGE_NAMES map, add build_language_addendum() method
    status: completed
  - id: fix-copilot-route
    content: Update backend/app/api/routes/copilot.py — append build_language_addendum() to synthesizer_addendum
    status: completed
  - id: fix-synthesizer
    content: Update backend/app/services/copilot/synthesizer.py — replace hardcoded language line in _SYNTHESIZE_SYSTEM base prompt
    status: completed
  - id: fix-quality
    content: Run uv run ruff check . && uv run pytest — both must exit 0
    status: completed
isProject: false
---

# Fix All Gaps + Per-Tenant Language Support

**Scope:** 1 new migration file, 3 backend files modified. No new packages. No frontend changes.

---

## The language behavior model

At onboarding a tenant picks one additional language alongside English (e.g. Telugu). The bot then mirrors whatever the user writes in:

| User writes in | Bot responds in |
|---|---|
| English | English |
| Telugu | Telugu (English technical terms OK) |
| Mix of both | Same mix |

This is **industry-agnostic** — a pharma tenant, a cafe, or an FMCG distributor all get the same language behavior. Industry addendums (currency format, domain rules) stay separate.

---

## Gap 1 — Critical: `execute_tenant_query` Postgres RPC (new migration)

### New file: [`akara/migrations/005_execute_tenant_query.sql`](akara/migrations/005_execute_tenant_query.sql)

`backend/app/sql/executor.py` calls this RPC on every copilot question. Without it every `POST /copilot/chat` returns a 500.

```sql
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

Run in Supabase SQL Editor after migrations 001–004. The function is `SECURITY DEFINER`, restricted to `service_role` only. `SQLGuard` enforces SELECT-only, so the backend controls what gets executed.

---

## Gap 2 — Language support (3 file changes)

### How it works after this change

```
tenant.tenant_config = {"industry": "fmcg_distribution", "language": "te"}
                                  |                               |
         build_synthesizer_addendum()              build_language_addendum()
                  |                                              |
        FMCG currency + domain rules          Mirror-language instruction for Telugu
                  |                                              |
                  └──────────── concatenated in copilot.py ─────┘
                                          |
                          appended to _SYNTHESIZE_SYSTEM
```

Language and industry are **fully decoupled**. A tenant with no industry but `language: "te"` still gets the language behavior. An FMCG tenant with no language just gets the currency/domain rules.

---

### Change 1: [`backend/app/services/prompts/generator.py`](akara/backend/app/services/prompts/generator.py)

Three precise changes:

**A) Strip the Language block from `_FMCG_DISTRIBUTION_SYNTHESIZER`.**

Remove lines 21–24 from the current constant (the hardcoded Hindi-only block):

```python
# REMOVE these lines from _FMCG_DISTRIBUTION_SYNTHESIZER:
Language:
- If the user's question is in Hindi (Devanagari script) or Hinglish, respond entirely in Hindi.
  SQL generation always stays in English internally.
- If the question is in English, respond in English.
```

The constant becomes currency/formatting + domain knowledge only.

**B) Add `_LANGUAGE_NAMES` map** (new module-level constant, after `_INDUSTRY_ADDENDUMS`):

```python
# Maps ISO-639-1 code → (language name, script description)
_LANGUAGE_NAMES: dict[str, tuple[str, str]] = {
    "hi": ("Hindi", "Devanagari script"),
    "te": ("Telugu", "Telugu script"),
    "ta": ("Tamil", "Tamil script"),
    "mr": ("Marathi", "Devanagari script"),
    "kn": ("Kannada", "Kannada script"),
    "bn": ("Bengali", "Bengali script"),
    "gu": ("Gujarati", "Gujarati script"),
}
```

**C) Add `build_language_addendum()` method** to `PromptGenerator`:

```python
def build_language_addendum(self, tenant_config: dict) -> str:
    """Returns a universal mirror-language instruction for the synthesizer.
    Completely independent of industry. Returns empty string for English-only tenants."""
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
```

---

### Change 2: [`backend/app/api/routes/copilot.py`](akara/backend/app/api/routes/copilot.py)

Add one line to the `chat` route handler — append the language addendum to `synthesizer_addendum`:

```python
# Before (current lines 71-72):
planner_addendum = prompt_gen.build_planner_addendum(tenant.tenant_config)
synthesizer_addendum = prompt_gen.build_synthesizer_addendum(tenant.tenant_config)

# After:
planner_addendum = prompt_gen.build_planner_addendum(tenant.tenant_config)
synthesizer_addendum = (
    prompt_gen.build_synthesizer_addendum(tenant.tenant_config)
    + prompt_gen.build_language_addendum(tenant.tenant_config)
)
```

Nothing else in the route changes. The language block is always appended last so it has highest priority.

---

### Change 3: [`backend/app/services/copilot/synthesizer.py`](akara/backend/app/services/copilot/synthesizer.py)

Replace one line in `_SYNTHESIZE_SYSTEM`. Current line 20:

```python
"- Match the language of the user's question when responding.\n"
```

Replace with:

```python
"- Respond in English by default. Follow any language rules provided in the system addendum.\n"
```

This prevents the generic base prompt from conflicting with the tenant-specific language instruction.

---

## How the tenant language is set

No schema change needed — `tenants.config` already stores JSONB. Set at onboarding via `POST /admin/tenants`:

```json
{
  "name": "Ramesh Distributors",
  "slug": "ramesh-dist",
  "config": {
    "industry": "fmcg_distribution",
    "language": "te"
  }
}
```

For a tenant with no industry (e.g. a generic ERP customer):

```json
{ "config": { "language": "hi" } }
```

They still get Hindi mirror-language behavior — no industry-specific rules apply.

Supported `language` values: `"hi"` `"te"` `"ta"` `"mr"` `"kn"` `"bn"` `"gu"`. Omitting `language` or setting `"en"` → English only.

---

## Quality gate

```bash
cd akara/backend
uv run ruff check .
uv run pytest
```

No new tests needed — language logic is pure string construction; existing 2 tests continue to pass.

---

## Summary of all changes

| File | Status | What changes |
|---|---|---|
| `akara/migrations/005_execute_tenant_query.sql` | New | Missing Postgres RPC — copilot is broken without it |
| `backend/app/services/prompts/generator.py` | Modified | Remove language block from FMCG addendum, add `_LANGUAGE_NAMES`, add `build_language_addendum()` |
| `backend/app/api/routes/copilot.py` | Modified | Append `build_language_addendum()` to `synthesizer_addendum` |
| `backend/app/services/copilot/synthesizer.py` | Modified | Replace generic language line in `_SYNTHESIZE_SYSTEM` |
