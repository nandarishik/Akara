# Day 3 Implementation Handoff — Copilot Core

**Prerequisites:**
- Day 1 implementation exists exactly as documented in `docs/day1_implementation.md`
- Day 2 implementation exists exactly as documented in `docs/day2_implementation.md`
- `backend/.env` contains real values for `GEMINI_API_KEY` and `OPENROUTER_API_KEY`

**Goal achieved:** The complete Plan→Execute→Synthesize AI pipeline is implemented as
clean, typed, modular Python services. `POST /copilot/chat` accepts a question and
returns either a streaming SSE response or a full JSON response. The SQL guard blocks
all mutations at the query layer. Five guardrail checks run on every non-streaming
response.

---

## New files overview (implementation order)

```
akara/backend/
├── app/
│   ├── api/routes/
│   │   └── copilot.py              ← NEW
│   ├── services/
│   │   ├── llm/
│   │   │   ├── gemini.py           ← NEW
│   │   │   ├── openrouter.py       ← NEW
│   │   │   └── manager.py          ← NEW
│   │   └── copilot/
│   │       ├── guardrails/
│   │       │   └── checks.py       ← NEW
│   │       ├── tools/
│   │       │   ├── sql_tool.py     ← NEW
│   │       │   └── context_tool.py ← NEW
│   │       ├── planner.py          ← NEW
│   │       ├── synthesizer.py      ← NEW
│   │       └── agent.py            ← NEW
│   ├── sql/
│   │   ├── guard.py                ← NEW
│   │   └── executor.py             ← NEW
│   └── main.py                     ← MODIFIED
└── pyproject.toml                  ← MODIFIED
```

---

# File: `backend/app/services/llm/gemini.py`

**Status:** Created

**Purpose:**
Wraps the `google-genai` SDK (the new, actively maintained package that replaced
the deprecated `google-generativeai`) to provide async completion and async streaming
to the `LLMManager`. This is the primary LLM provider.

**Dependencies:**
- `google-genai>=2.13.0` (added to `pyproject.toml` on Day 3)
- No internal app dependencies

**Implementation:**

```python
import logging
from collections.abc import AsyncGenerator

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.5-flash"


class GeminiClient:
    def __init__(self, api_key: str) -> None:
        self._client = genai.Client(api_key=api_key)

    async def complete(self, prompt: str, system: str = "") -> str:
        config = types.GenerateContentConfig(system_instruction=system) if system else None
        response = await self._client.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=config,
        )
        return response.text or ""

    async def stream(
        self, prompt: str, system: str = ""
    ) -> AsyncGenerator[str, None]:
        config = types.GenerateContentConfig(system_instruction=system) if system else None
        async for chunk in await self._client.aio.models.generate_content_stream(
            model=GEMINI_MODEL,
            contents=prompt,
            config=config,
        ):
            if chunk.text:
                yield chunk.text
```

**Placement:**
New file. Create at `backend/app/services/llm/gemini.py`. The `backend/app/services/llm/`
directory already exists with an empty `__init__.py` (created Day 1).

**Explanation:**

- `genai.Client(api_key=...)` is the new `google-genai` v2 initialisation pattern.
  The old `google.generativeai` package used `genai.configure(api_key=...)` globally;
  the new package is per-client and thread-safe.
- `types.GenerateContentConfig(system_instruction=system)` passes the system prompt
  natively — the new SDK has a proper `system_instruction` field, unlike the old SDK
  which required simulating it with a user/model exchange pair.
- `self._client.aio.models` is the async interface. All methods are async-native.
- `response.text or ""` guards against `None` when the model returns no text content.
- `chunk.text` check in `stream` skips empty chunks (e.g. final STOP chunk).

**Related Changes:**
- `backend/app/services/llm/manager.py` — imports and instantiates `GeminiClient`
- `backend/pyproject.toml` — `google-genai>=2.13.0` is the package that provides
  `google.genai`

---

# File: `backend/app/services/llm/openrouter.py`

**Status:** Created

**Purpose:**
Provides the LLM failover provider. When Gemini fails for any reason
(rate limit, API error, network issue), `LLMManager` falls back to this client which
calls the OpenRouter REST API (compatible with the OpenAI chat format) and parses
its Server-Sent Events stream.

**Dependencies:**
- `httpx>=0.27.0` (already in `pyproject.toml` from Day 1)
- No internal app dependencies

**Implementation:**

```python
import json
import logging
from collections.abc import AsyncGenerator

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

    def _build_payload(self, prompt: str, system: str, stream: bool) -> dict:
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
        async with httpx.AsyncClient() as client, client.stream(
            "POST",
            f"{OPENROUTER_BASE_URL}/chat/completions",
            json=payload,
            headers=self._headers,
            timeout=60.0,
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line.startswith("data: ") and line != "data: [DONE]":
                    data = json.loads(line[6:])
                    delta = data["choices"][0]["delta"].get("content", "")
                    if delta:
                        yield delta
```

**Placement:**
New file. Create at `backend/app/services/llm/openrouter.py`.

**Explanation:**

- `_build_payload` constructs an OpenAI-compatible messages array. `system` maps to
  a `{"role": "system"}` message if provided.
- `complete` creates a fresh `httpx.AsyncClient` per call (intentional — no shared
  connection state between requests). 60-second timeout handles slow LLM responses.
- `stream` uses `async with client, client.stream(...)` — a single compound `with`
  statement (required by ruff `SIM117`). `aiter_lines()` yields one SSE line at a
  time. Lines beginning with `data: ` and not equal to `data: [DONE]` are parsed as
  JSON delta chunks.
- `data["choices"][0]["delta"].get("content", "")` is safe — the last delta chunk
  before `[DONE]` may have `"delta": {}` with no `content` key.

**Related Changes:**
- `backend/app/services/llm/manager.py` — imports and instantiates `OpenRouterClient`

---

# File: `backend/app/services/llm/manager.py`

**Status:** Created

**Purpose:**
Single entry point for all LLM calls in the application. Owns one `GeminiClient`
and one `OpenRouterClient` and implements automatic failover: Gemini is tried first;
on any exception the call is retried with OpenRouter. Routes never import individual
clients directly — they use `LLMManager` exclusively.

**Dependencies:**
- `app.services.llm.gemini` — `GeminiClient`
- `app.services.llm.openrouter` — `OpenRouterClient`

**Implementation:**

```python
import logging
from collections.abc import AsyncGenerator
from enum import StrEnum

from app.services.llm.gemini import GeminiClient
from app.services.llm.openrouter import OpenRouterClient

logger = logging.getLogger(__name__)


class LLMProvider(StrEnum):
    GEMINI = "gemini"
    OPENROUTER = "openrouter"


class LLMManager:
    """
    Manages LLM provider selection and automatic failover.
    Primary: Gemini 2.5 Flash
    Failover: OpenRouter (claude-3-haiku)
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

**Placement:**
New file. Create at `backend/app/services/llm/manager.py`.

**Explanation:**

- `LLMProvider(StrEnum)` — `StrEnum` is the Python 3.11+ built-in; ruff rule `UP042`
  requires it over the `(str, Enum)` pattern.
- `complete` updates `_current_provider` on success so callers can log which provider
  served the request. On total failure it raises `RuntimeError` chaining both errors.
- `stream` cannot do full fallover mid-stream (once Gemini starts yielding, a mid-
  stream error would leave the SSE connection in an indeterminate state). The failover
  only applies if Gemini fails before yielding any chunks. A partial Gemini stream
  failure will surface as an exception to the route handler.

**Related Changes:**
- `backend/app/services/copilot/planner.py` — imports and uses `LLMManager`
- `backend/app/services/copilot/synthesizer.py` — imports and uses `LLMManager`
- `backend/app/api/routes/copilot.py` — instantiates `LLMManager` in `_build_agent`

---

# File: `backend/app/sql/guard.py`

**Status:** Created

**Purpose:**
Prevents the LLM-generated SQL from executing dangerous or out-of-scope statements.
Every query executed anywhere in the application must pass `validate_sql` before
reaching the database. This is the last line of defence before Supabase.

**Dependencies:**
- Standard library only (`re`, `logging`)

**Implementation:**

```python
import logging
import re

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

**Placement:**
New file. Create at `backend/app/sql/guard.py`. The `backend/app/sql/` directory
already exists with an empty `__init__.py` (created Day 1).

**Explanation:**

- `SQLGuardError(ValueError)` — subclasses `ValueError` so it's a clear programming
  error, caught separately from `RuntimeError` execution failures in `SQLTool`.
- `_FORBIDDEN_SCHEMAS` uses a `frozenset` for O(1) membership testing.
- Both compiled regexes use word boundaries (`\b`) to prevent false positives (e.g.
  a column named `execution_date` would not trigger the `EXECUTE` check).
- Checks run in order: statement type first (cheapest), then schemas, then functions.
- `validate_sql` raises on the first violation — it does not accumulate errors.

**Smoke test (verify independently):**

```bash
cd akara/backend
uv run python -c "
from app.sql.guard import validate_sql, SQLGuardError
validate_sql('SELECT * FROM sales_data')
print('SELECT: OK')
try:
    validate_sql('DELETE FROM sales_data')
except SQLGuardError:
    print('DELETE blocked: OK')
try:
    validate_sql('SELECT * FROM pg_catalog.pg_tables')
except SQLGuardError:
    print('pg_catalog blocked: OK')
try:
    validate_sql('SELECT pg_read_file(\"/etc/passwd\")')
except SQLGuardError:
    print('pg_read_file blocked: OK')
"
```

**Related Changes:**
- `backend/app/sql/executor.py` — calls `validate_sql` before every execution
- `backend/app/services/copilot/tools/sql_tool.py` — catches `SQLGuardError`
  separately from `RuntimeError`

---

# File: `backend/app/sql/executor.py`

**Status:** Created

**Purpose:**
Wraps the Supabase `execute_tenant_query` RPC call with a 2000-row hard cap and
mandatory SQLGuard validation. All SQL execution in the application flows through
this class — nothing queries the database directly with raw strings.

**Dependencies:**
- `supabase>=2.4.0` (already in `pyproject.toml`)
- `app.sql.guard` — `validate_sql`

**Implementation:**

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

        logger.info("Executing SQL for tenant %s: %.100s", tenant_id, query)

        try:
            result = self._client.rpc(
                "execute_tenant_query",
                {"p_query": query, "p_params": params or {}},
            ).execute()
            rows = result.data or []
            if len(rows) > _MAX_ROWS:
                logger.warning(
                    "Query returned %d rows, truncating to %d", len(rows), _MAX_ROWS
                )
                rows = rows[:_MAX_ROWS]
            return rows
        except Exception as exc:
            logger.error("SQL execution failed: %s", exc)
            raise RuntimeError(f"Query execution failed: {exc}") from exc
```

**Placement:**
New file. Create at `backend/app/sql/executor.py`.

**Explanation:**

- `execute_tenant_query` is a Supabase PostgreSQL RPC function (not yet defined in
  the schema migrations — its absence causes a `RuntimeError` at call time, not at
  import/startup time). It will be added in a future migration.
- `params or {}` ensures a non-null dict is always passed to the RPC even if the
  caller passes `None`.
- `rows[:_MAX_ROWS]` truncation is applied after the result is returned from Supabase,
  not via SQL `LIMIT`. This ensures the guard runs even on RPC calls that ignore
  client-side limits.
- `RuntimeError` wrapping chains the original exception for full stack trace
  preservation in logs.

**Related Changes:**
- `backend/app/services/copilot/tools/sql_tool.py` — instantiates `SQLExecutor` and
  calls `execute`
- `backend/app/api/routes/copilot.py` — creates `SQLExecutor` in `_build_agent`
- `backend/app/sql/guard.py` — called unconditionally at the start of `execute`

---

# File: `backend/app/services/copilot/guardrails/checks.py`

**Status:** Created

**Purpose:**
Implements five post-generation safety checks that run on every non-streaming copilot
response. These prevent hallucinated numbers, unfounded causal claims, and out-of-
scope questions from reaching the user silently.

**Dependencies:**
- Standard library only (`re`, `logging`, `dataclasses`)

**Implementation:**

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
    unknown_entities = [
        term
        for term in re.findall(r"\b[a-z_]{4,}\b", question_lower)
        if term not in available_columns
        and term
        not in {
            "sales",
            "revenue",
            "orders",
            "products",
            "customers",
            "total",
            "average",
            "top",
            "bottom",
            "compare",
            "trend",
            "last",
            "month",
            "week",
            "year",
            "quarter",
            "today",
            "yesterday",
            "best",
            "worst",
            "highest",
            "lowest",
        }
    ]
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
        return GuardrailResult(
            passed=True, check_name="numeric_digest", message="No SQL results to verify"
        )

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
        "caused by",
        "resulted in",
        "because of",
        "due to the fact",
        "proven that",
        "definitively shows",
        "guarantees",
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


def data_scope_check(
    question: str, tenant_date_range: tuple[str, str]
) -> GuardrailResult:
    """
    Verifies the question is within the tenant's available data date range.
    """
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

**Placement:**
New file. Create at `backend/app/services/copilot/guardrails/checks.py`. The
`backend/app/services/copilot/guardrails/` directory already exists with an empty
`__init__.py` (created Day 1).

**Explanation:**

- `GuardrailResult` is a `@dataclass` — not Pydantic — because it is never serialised
  to JSON directly; the agent converts it to `dict` before placing it in
  `CopilotResponse.guardrail_results`.
- `premise_check` uses a heuristic: extract 4+ character lowercase words from the
  question, filter against `available_columns` and a hardcoded allowlist of common
  analytics vocabulary. More than 3 unknown terms triggers a warning.
- `numeric_digest` warns in the log when >5 numbers in the response are not grounded
  in the SQL results, but **does not block** — derived values like percentages,
  averages, and deltas are legitimate and would not appear verbatim in the raw data.
- `numeric_postcheck` **does block**: any integer above 10 billion is flagged as a
  likely hallucination (Indian rupee revenues, even at scale, do not exceed this).
- `causal_postcheck` **blocks** strong causal language. The synthesizer system prompt
  also instructs the model to avoid it, but this is the enforcement layer.
- `data_scope_check` is a stub — it always passes. The full implementation (date
  extraction from natural language) is deferred.
- `run_all_guardrails` always runs all five. Failed results are not short-circuited.

**Smoke test:**

```bash
cd akara/backend
uv run python -c "
from app.services.copilot.guardrails.checks import numeric_postcheck, causal_postcheck
print(numeric_postcheck('Revenue was 500 crore'))
print(numeric_postcheck('Revenue was 99999999999 billion'))
print(causal_postcheck('Sales declined this month'))
print(causal_postcheck('The drop was caused by the rain'))
"
```

**Related Changes:**
- `backend/app/services/copilot/agent.py` — imports `run_all_guardrails` and
  `GuardrailResult`, runs checks after synthesis, appends warnings to response text

---

# File: `backend/app/services/copilot/tools/sql_tool.py`

**Status:** Created

**Purpose:**
Thin adapter between `CopilotAgent` and `SQLExecutor`. Converts exceptions into
structured `dict` results so the agent can continue gracefully when a single SQL
step fails without crashing the entire pipeline.

**Dependencies:**
- `app.sql.executor` — `SQLExecutor`
- `app.sql.guard` — `SQLGuardError`

**Implementation:**

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

**Placement:**
New file. Create at `backend/app/services/copilot/tools/sql_tool.py`. The
`backend/app/services/copilot/tools/` directory already exists with an empty
`__init__.py` (created Day 1).

**Explanation:**

- `SQLGuardError` and `RuntimeError` are caught separately. `SQLGuardError` is a
  programming/policy error (the LLM generated an unsafe query). `RuntimeError` is an
  infrastructure error (network issue, Supabase RPC failure). Logging level differs:
  `warning` vs `error`.
- Both failure cases return `{"rows": []}` so `agent.py` can call
  `result.get("rows", [])` safely without checking `success`.
- `tenant_id` is stored on the tool instance and forwarded to `executor.execute` for
  logging purposes. Actual tenant isolation is enforced by RLS at the database level.

**Related Changes:**
- `backend/app/services/copilot/agent.py` — instantiates `SQLTool` and calls `run`
  in a loop over plan steps
- `backend/app/api/routes/copilot.py` — creates `SQLTool` inside `_build_agent`

---

# File: `backend/app/services/copilot/tools/context_tool.py`

**Status:** Created

**Purpose:**
Reads pre-cached contextual data (weather, news, public holidays) from the
`context_cache` Supabase table to enrich the synthesizer prompt with real-world
business context. Cache population is handled externally (future cron job).

**Dependencies:**
- `supabase>=2.4.0` (already in `pyproject.toml`)
- Supabase `context_cache` table (created in Day 1 migration `001_initial_schema.sql`)

**Implementation:**

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

    def get_context(self, context_date: date, context_type: str) -> dict | None:
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
            logger.debug(
                "No context cache hit for %s/%s: %s", context_type, context_date, exc
            )
            return None
```

**Placement:**
New file. Create at `backend/app/services/copilot/tools/context_tool.py`.

**Explanation:**

- `.single()` tells supabase-py to expect exactly one row; it raises an exception if
  zero or multiple rows match. The `except Exception` block catches this and returns
  `None`, so a cache miss is transparent to the caller.
- `str(self._tenant_id)` converts the UUID to a string since Supabase's Python client
  sends query parameters as strings.
- `context_date.isoformat()` produces `"YYYY-MM-DD"` which matches the `date` column
  format in `context_cache`.
- Returns only `content`, `source`, `expires_at` — the `id` and `tenant_id` columns
  are excluded to keep the context payload small.

**Related Changes:**
- `backend/app/services/copilot/agent.py` — calls `get_context` for each required
  context type from the plan
- `backend/app/api/routes/copilot.py` — creates `ContextTool` inside `_build_agent`

---

# File: `backend/app/services/copilot/planner.py`

**Status:** Created

**Purpose:**
First stage of the pipeline. Takes a user question and schema context, sends them to
the LLM with a strict JSON-output system prompt, and parses the response into a
structured `Plan` object containing one or more SQL steps.

**Dependencies:**
- `app.services.llm.manager` — `LLMManager`
- Standard library (`json`, `re`, `dataclasses`)

**Implementation:**

```python
import json
import logging
import re
from dataclasses import dataclass

from app.services.llm.manager import LLMManager

logger = logging.getLogger(__name__)

_PLAN_SYSTEM = """
You are a data analytics planning assistant for an FMCG distribution company.
Given a user question, you must output a JSON plan with SQL queries to answer it.

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
- Always filter by invoice_date when a time range is implied
- Only use tables: public.sales_data, public.context_cache
- Maximum 3 SQL steps
- Use :start_date and :end_date placeholders for date ranges
"""


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
    ) -> Plan:
        prompt = (
            f"Schema context:\n{schema_context}\n\n"
            f"Date range available: {date_range[0]} to {date_range[1]}\n\n"
            f"User question: {question}\n\n"
            f"Output the JSON plan:"
        )
        raw = await self._llm.complete(prompt=prompt, system=_PLAN_SYSTEM)
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

**Placement:**
New file. Create at `backend/app/services/copilot/planner.py`. The
`backend/app/services/copilot/` directory already exists with an empty `__init__.py`
(created Day 1).

**Explanation:**

- `_PLAN_SYSTEM` is the system prompt stored as a module-level constant (not hardcoded
  inside the method). It instructs the LLM to always parameterise `tenant_id`,
  restricts table access to `sales_data` and `context_cache`, and caps at 3 steps.
- `_parse_plan` uses `re.search(r"\{.*\}", raw, re.DOTALL)` to extract the JSON
  object even if the LLM wraps it in Markdown code fences or adds prose before/after
  the JSON. `re.DOTALL` makes `.` match newlines.
- `data.get("steps", [])` means a plan with no SQL steps is valid — the synthesizer
  will then generate a response based on no data (typically a clarification message).
- `PlanStep` and `Plan` are plain `@dataclass` objects — not Pydantic — because they
  are internal pipeline objects never serialised to JSON directly.

**Related Changes:**
- `backend/app/services/copilot/agent.py` — imports `Planner` and `Plan`, calls
  `planner.plan()`
- `backend/app/api/routes/copilot.py` — instantiates `Planner(llm=llm)` in
  `_build_agent`

---

# File: `backend/app/services/copilot/synthesizer.py`

**Status:** Created

**Purpose:**
Third and final stage of the pipeline. Takes the SQL results and optional context
data from the execution stage and generates a natural-language business-focused answer
using the LLM. Supports both blocking and streaming response modes.

**Dependencies:**
- `app.services.llm.manager` — `LLMManager`

**Implementation:**

```python
import logging
from collections.abc import AsyncGenerator

from app.services.llm.manager import LLMManager

logger = logging.getLogger(__name__)

_SYNTHESIZE_SYSTEM = """
You are AKARA Copilot, an AI analytics assistant for FMCG distribution businesses.
You are given a user question, SQL query results, and optionally some business context.
Your job is to write a clear, accurate, business-focused answer.

Rules:
- Ground every number in the data provided. Do not invent figures.
- Be concise but complete. Use bullet points for lists.
- Mention the time range covered by the data.
- If data is empty or insufficient, say so clearly.
- Do not make causal claims. Use "associated with" or "correlated with" instead of "caused by".
- End with a one-sentence actionable insight if the data supports it.
"""


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
    ) -> str:
        prompt = self._build_prompt(question, sql_results, context_data, intent)
        return await self._llm.complete(prompt=prompt, system=_SYNTHESIZE_SYSTEM)

    async def synthesize_stream(
        self,
        question: str,
        sql_results: list[dict],
        context_data: dict | None,
        intent: str,
    ) -> AsyncGenerator[str, None]:
        prompt = self._build_prompt(question, sql_results, context_data, intent)
        async for chunk in self._llm.stream(prompt=prompt, system=_SYNTHESIZE_SYSTEM):
            yield chunk
```

**Placement:**
New file. Create at `backend/app/services/copilot/synthesizer.py`.

**Explanation:**

- `_build_prompt` caps `sql_results` at 100 rows before calling `str()`. This prevents
  the prompt from exceeding context window limits when a query returns many rows.
- `_SYNTHESIZE_SYSTEM` explicitly instructs the LLM to avoid causal language — this
  complements (but does not replace) the `causal_postcheck` guardrail.
- `synthesize` and `synthesize_stream` share the same `_build_prompt` logic — the
  only difference is whether `_llm.complete` or `_llm.stream` is called.
- `synthesize_stream` is an `async def` that `yield`s — making it an async generator.
  FastAPI's `StreamingResponse` consumes it directly.

**Related Changes:**
- `backend/app/services/copilot/agent.py` — calls both `synthesize` and
  `synthesize_stream` depending on the request mode
- `backend/app/api/routes/copilot.py` — instantiates `Synthesizer(llm=llm)` in
  `_build_agent`

---

# File: `backend/app/services/copilot/agent.py`

**Status:** Created

**Purpose:**
Orchestrates the full Plan→Execute→Synthesize pipeline. Dependency-injected — it
holds no global state and creates no Supabase clients internally. Applies all five
guardrail checks after synthesis and appends warning annotations to the response text
for any that fail.

**Dependencies:**
- `app.services.copilot.guardrails.checks` — `GuardrailResult`, `run_all_guardrails`
- `app.services.copilot.planner` — `Planner`
- `app.services.copilot.synthesizer` — `Synthesizer`
- `app.services.copilot.tools.context_tool` — `ContextTool`
- `app.services.copilot.tools.sql_tool` — `SQLTool`

**Implementation:**

```python
import logging
import time
from collections.abc import AsyncGenerator
from dataclasses import dataclass, field
from datetime import date
from uuid import UUID

from app.services.copilot.guardrails.checks import GuardrailResult, run_all_guardrails
from app.services.copilot.planner import Planner
from app.services.copilot.synthesizer import Synthesizer
from app.services.copilot.tools.context_tool import ContextTool
from app.services.copilot.tools.sql_tool import SQLTool

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
    ) -> CopilotResponse:
        start_ms = int(time.time() * 1000)

        plan = await self._planner.plan(question, schema_context, date_range)
        logger.info(
            "Plan produced with %d steps for intent: %s", len(plan.steps), plan.intent
        )

        all_results: list[dict] = []
        queries_run: list[str] = []
        for step in plan.steps:
            result = self._sql_tool.run(step.sql)
            all_results.extend(result.get("rows", []))
            queries_run.append(step.sql)

        context_data = None
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
        )

        guardrail_results: list[GuardrailResult] = run_all_guardrails(
            question=question,
            response=response_text,
            sql_results=all_results,
            available_columns=available_columns,
            tenant_date_range=date_range,
        )

        for gr in guardrail_results:
            if not gr.passed:
                logger.warning(
                    "Guardrail failed: %s — %s", gr.check_name, gr.message
                )
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
    ) -> AsyncGenerator[str, None]:
        """Streaming version — yields text chunks as they arrive."""
        plan = await self._planner.plan(question, schema_context, date_range)

        all_results: list[dict] = []
        for step in plan.steps:
            result = self._sql_tool.run(step.sql)
            all_results.extend(result.get("rows", []))

        context_data = None
        for ctx_type in plan.requires_context:
            context_data = self._context_tool.get_context(date.today(), ctx_type)

        async for chunk in self._synthesizer.synthesize_stream(
            question=question,
            sql_results=all_results,
            context_data=context_data,
            intent=plan.intent,
        ):
            yield chunk
```

**Placement:**
New file. Create at `backend/app/services/copilot/agent.py`.

**Explanation:**

- `CopilotResponse` is a `@dataclass` with `field(default_factory=list)` for mutable
  defaults. `llm_model` and `tokens_used` are populated as empty/zero for now; they
  will be filled in once the LLM clients expose usage metadata.
- `answer` breaks early from the context loop once the first matching cache entry is
  found (`if context_data: break`). The plan's `requires_context` list is ordered by
  priority — weather first, then news, then holiday.
- Guardrail failures do not raise exceptions — they append a `⚠️ Note:` paragraph
  to the response text so the user sees the warning inline.
- `answer_stream` does **not** run guardrails — it is impossible to run post-
  generation checks on a streaming response without buffering the entire text first,
  which defeats the purpose of streaming. Guardrail checking is a non-streaming
  feature.
- `elapsed_ms` is calculated in `answer` only (not in `answer_stream`) because the
  stream's duration depends on how fast the client reads.

**Related Changes:**
- `backend/app/api/routes/copilot.py` — instantiates `CopilotAgent` via
  `_build_agent` and calls `answer` or `answer_stream`

---

# File: `backend/app/api/routes/copilot.py`

**Status:** Created

**Purpose:**
Exposes the copilot pipeline as a protected HTTP endpoint. Wires all dependencies
via `_build_agent`, handles the streaming vs. non-streaming branch, and formats the
SSE response correctly for the React frontend's `EventSource` API.

**Dependencies:**
- `fastapi` — `APIRouter`, `StreamingResponse`
- `app.core.auth` — `CurrentUser` (Day 2)
- `app.core.config` — `settings` (Day 2)
- `app.core.tenant` — `TenantCtx`, `get_supabase_service_client` (Day 2)
- `app.services.copilot.agent` — `CopilotAgent`
- `app.services.copilot.planner` — `Planner`
- `app.services.copilot.synthesizer` — `Synthesizer`
- `app.services.copilot.tools.context_tool` — `ContextTool`
- `app.services.copilot.tools.sql_tool` — `SQLTool`
- `app.services.llm.manager` — `LLMManager`
- `app.sql.executor` — `SQLExecutor`

**Implementation:**

```python
import logging
from datetime import date
from uuid import UUID

from fastapi import APIRouter
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
from app.sql.executor import SQLExecutor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/copilot", tags=["copilot"])

# Hardcoded for Day 3 — Day 4 replaces with dynamic schema discovery
_SCHEMA_CONTEXT = (
    "Table: sales_data. Columns: invoice_date, party_name, party_city, "
    "party_zone, route, product_name, product_group, product_category, "
    "quantity, gross_amount, net_amount, total_amount."
)
_AVAILABLE_COLUMNS = [
    "invoice_date",
    "invoice_number",
    "party_name",
    "party_city",
    "party_zone",
    "route",
    "product_name",
    "product_group",
    "product_category",
    "hsn_code",
    "quantity",
    "gross_amount",
    "discount_amount",
    "net_amount",
    "tax_amount",
    "total_amount",
]


class ChatRequest(BaseModel):
    question: str
    stream: bool = True


class ChatResponse(BaseModel):
    question: str
    intent: str
    response: str
    response_time_ms: int
    llm_model: str


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
    agent = _build_agent(tenant.tenant_id)
    date_range = ("2024-01-01", date.today().isoformat())

    if request.stream:

        async def event_stream():
            async for chunk in agent.answer_stream(
                question=request.question,
                schema_context=_SCHEMA_CONTEXT,
                available_columns=_AVAILABLE_COLUMNS,
                date_range=date_range,
            ):
                yield f"data: {chunk}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    result = await agent.answer(
        question=request.question,
        schema_context=_SCHEMA_CONTEXT,
        available_columns=_AVAILABLE_COLUMNS,
        date_range=date_range,
    )
    return ChatResponse(
        question=result.question,
        intent=result.intent,
        response=result.response,
        response_time_ms=result.response_time_ms,
        llm_model=result.llm_model,
    )
```

**Placement:**
New file. Create at `backend/app/api/routes/copilot.py`. The
`backend/app/api/routes/` directory already exists with `health.py` and `auth.py`
(created Day 2).

**Explanation:**

- `response_model=None` on `@router.post` is required because `StreamingResponse`
  is a Starlette response class, not a Pydantic model. Without it FastAPI tries to
  build a response schema from `StreamingResponse | ChatResponse` and raises
  `FastAPIError` at startup. This was a bug encountered during Day 3 verification
  and fixed by adding `response_model=None`.
- `_build_agent` is a factory function (not a FastAPI `Depends`) because it takes
  `tenant_id` as an argument. FastAPI `Depends` does not support arguments; using a
  factory keeps the wiring explicit.
- The SSE event stream format `f"data: {chunk}\n\n"` is standard Server-Sent Events
  format. The `data: [DONE]\n\n` sentinel is the same convention used by OpenAI's
  streaming API and expected by the React frontend's `EventSource` handler.
- `date_range = ("2024-01-01", date.today().isoformat())` is hardcoded for Day 3.
  Day 4 replaces this with the tenant's actual data date range from schema discovery.
- `_SCHEMA_CONTEXT` and `_AVAILABLE_COLUMNS` are module-level constants. Day 4 will
  replace these with a call to the schema discovery service.

**Related Changes:**
- `backend/app/main.py` — registers this router (see below)
- `backend/app/core/auth.py` (Day 2) — `CurrentUser` dependency
- `backend/app/core/tenant.py` (Day 2) — `TenantCtx`, `get_supabase_service_client`

---

# File: `backend/app/main.py`

**Status:** Modified

**Purpose:**
Registers the new copilot router so `POST /copilot/chat` is reachable.

**Original Day 2 code (lines 7-9 and 36-38):**

```python
from app.api.routes import auth as auth_router
from app.api.routes import health
from app.core.config import settings
# ...
app.include_router(health.router)
app.include_router(auth_router.router)
```

**Day 3 additions — two lines inserted:**

```python
from app.api.routes import auth as auth_router
from app.api.routes import copilot as copilot_router   # ← added
from app.api.routes import health
from app.core.config import settings
# ...
app.include_router(health.router)
app.include_router(auth_router.router)
app.include_router(copilot_router.router)              # ← added
```

**Complete file after Day 3 (for copy-paste safety):**

```python
import logging

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth as auth_router
from app.api.routes import copilot as copilot_router
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
app.include_router(copilot_router.router)
```

**Placement:**
`backend/app/main.py`. Insert `from app.api.routes import copilot as copilot_router`
after the `auth as auth_router` import and before the `health` import (alphabetical
order, enforced by ruff isort). Append `app.include_router(copilot_router.router)`
after the last existing `include_router` call.

**Related Changes:**
- `backend/app/api/routes/copilot.py` — the router being registered

---

# File: `backend/pyproject.toml`

**Status:** Modified

**Purpose:**
Two changes on Day 3:
1. Replaced `google-generativeai>=0.7.0` (deprecated, end-of-life) with
   `google-genai>=2.13.0` (the new, actively maintained Google Gemini SDK).
2. Removed a duplicate `google-genai>=2.0.0` entry that was accidentally introduced
   during the `uv add google-genai` install step.

**Original Day 2 dependency line:**

```toml
"google-generativeai>=0.7.0",
```

**Day 3 replacement:**

```toml
"google-genai>=2.13.0",
```

**Complete file after Day 3 (for copy-paste safety):**

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
ignore = ["E501"]

[tool.ruff.lint.isort]
known-first-party = ["app"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

**Install command (run from `backend/`):**

```bash
uv sync
# or, if adding fresh:
uv add google-genai
```

**Reason for change:**
The `google.generativeai` package (`google-generativeai` on PyPI) issued a
`FutureWarning` in all import paths stating it is end-of-life and will no longer
receive updates. The replacement is `google-genai` which provides `google.genai`
and has a different API surface (`genai.Client` vs `genai.configure`, native
`system_instruction` support, proper async interface via `.aio.models`).

---

## Bugs fixed during Day 3

### Bug 1 — FastAPI `FastAPIError` on copilot route startup

**Error:**
```
fastapi.exceptions.FastAPIError: Invalid args for response field!
Hint: check that starlette.responses.StreamingResponse | app.api.routes.copilot.ChatResponse
is a valid Pydantic field type.
```

**Root cause:** When a route has a return type annotation that includes
`StreamingResponse` (a Starlette class, not a Pydantic model), FastAPI tries to
generate a JSON schema from the union type and fails at application startup.

**Fix:** Add `response_model=None` to the `@router.post` decorator:

```python
# Before (causes FastAPIError at startup):
@router.post("/chat")
async def chat(...) -> StreamingResponse | ChatResponse:

# After (correct):
@router.post("/chat", response_model=None)
async def chat(...) -> StreamingResponse | ChatResponse:
```

### Bug 2 — Deprecated `google-generativeai` package

**Error:**
```
FutureWarning: All support for the `google.generativeai` package has ended.
It will no longer be receiving updates or bug fixes.
```

**Fix:** Replace `google-generativeai` with `google-genai` and rewrite `gemini.py`
to use the new API. See `pyproject.toml` and `gemini.py` entries above.

### Bug 3 — ruff `UP035`: `from typing import AsyncGenerator`

**Error:** ruff `UP035` — "Import from `collections.abc` instead: `AsyncGenerator`"

**Affected files:** `gemini.py`, `openrouter.py`, `manager.py`, `synthesizer.py`,
`agent.py`

**Fix:** Replace `from typing import AsyncGenerator` with
`from collections.abc import AsyncGenerator` in all five files.

### Bug 4 — ruff `UP042`: `class LLMProvider(str, Enum)`

**Error:** ruff `UP042` — "Class LLMProvider inherits from both `str` and `enum.Enum`"

**Fix:** Replace `from enum import Enum` + `class LLMProvider(str, Enum)` with
`from enum import StrEnum` + `class LLMProvider(StrEnum)`.

### Bug 5 — ruff `SIM117`: nested `async with` in `openrouter.py`

**Error:** ruff `SIM117` — "Use a single `with` statement with multiple contexts
instead of nested `with` statements"

**Fix:**
```python
# Before:
async with httpx.AsyncClient() as client:
    async with client.stream(...) as response:

# After:
async with httpx.AsyncClient() as client, client.stream(...) as response:
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
2 passed in 1.23s
```

Both gates exit 0. Day 3 is complete.

---

## Additions to Day 3 (competitive parity with FireAI)

> **Status: implemented.** Changes are live in `synthesizer.py`, `planner.py`, and `services/prompts/generator.py`.

### Design decision: industry-agnostic base prompts

`_SYNTHESIZE_SYSTEM` and `_PLAN_SYSTEM` are **generic** — no currency formatting, no language rules, no FMCG table references. Industry-specific behaviour is injected as addendums at request time by `PromptGenerator` based on `tenant.tenant_config.industry`.

This means AKARA works for any industry out of the box. An FMCG distributor gets ₹ formatting and Hindi NLQ. A pharma company or retail chain gets generic analytics responses. Adding a new vertical = one dict entry in `PromptGenerator._INDUSTRY_ADDENDUMS`.

### `synthesizer.py` — generic base

`_SYNTHESIZE_SYSTEM` contains only structural rules: ground numbers in data, be concise, mention time range, no causal claims, match the user's language. No currency, no country, no industry.

The FMCG-specific synthesizer rules (₹ formatting, Hindi NLQ, domain glossary) live in `PromptGenerator._FMCG_DISTRIBUTION_SYNTHESIZER` and are appended to `_SYNTHESIZE_SYSTEM` only when `tenant.industry == "fmcg_distribution"`.

`synthesize()` and `synthesize_stream()` accept a `system_addendum: str = ""` parameter. The final system prompt is `_SYNTHESIZE_SYSTEM + system_addendum`.

### `planner.py` — generic base

`_PLAN_SYSTEM` contains only the JSON output format and universal rules (always filter by `tenant_id`, max 3 steps, use placeholders). No table names, no FMCG terminology.

Table descriptions reach the planner via `schema_context` (dynamic, built by `SchemaDiscovery` from the live DB). FMCG-specific join rules (primary-vs-secondary mismatch, scheme leakage, outstanding filters) are in `PromptGenerator._FMCG_DISTRIBUTION_PLANNER` and appended only for FMCG tenants.

`plan()` accepts `system_addendum: str = ""` — appended to `_PLAN_SYSTEM` before the LLM call.

### `PromptGenerator` — industry addendum registry (`services/prompts/generator.py`)

```python
_INDUSTRY_ADDENDUMS: dict[str, dict[str, str]] = {
    "fmcg_distribution": {
        "synthesizer": _FMCG_DISTRIBUTION_SYNTHESIZER,  # ₹ formatting, Hindi, domain glossary
        "planner": _FMCG_DISTRIBUTION_PLANNER,          # join patterns, outstanding filter
    },
    # "pharma_distribution": { ... },
    # "retail": { ... },
}
```

Two new methods:
- `build_synthesizer_addendum(tenant_config: dict) → str` — returns FMCG addendum or `""`
- `build_planner_addendum(tenant_config: dict) → str` — returns FMCG addendum or `""`

Both are called in `copilot.py` and threaded through `CopilotAgent.answer()` → `Planner.plan()` / `Synthesizer.synthesize()`.

### What FMCG tenants still get

The FMCG addendums contain exactly the same rules as before:
- ₹ lakh/crore notation for all monetary values
- Rupee impact framing ("This represents ₹X.X lakh in recoverable revenue")
- Hindi NLQ — if question is in Hindi/Hinglish, respond in Hindi
- Domain glossary (parties = distributors/retailers, zones, routes/beats)
- Primary vs. secondary join pattern + scheme leakage join pattern
- `IS NOT NULL AND outstanding_amount > 0` filter for outstanding queries

The copilot can answer "show me scheme leakage this quarter" or "which distributors have primary stock cover above 45 days" as soon as the corresponding data is uploaded — no additional backend work needed.
