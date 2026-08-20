# Day 12 Implementation Handoff

## Reproduction Instructions

### Expected repository state before applying Day 12 changes

Day 1 through Day 11 must already be implemented exactly as documented in:

- `docs/day1_implementation.md`
- `docs/day2_implementation.md`
- `docs/day3_implementation.md`
- `docs/day4_implementation.md`
- `docs/day5_implementation.md`
- `docs/day6_implementation.md`
- `docs/day7_implementation.md`
- `docs/day8_implementation.md`
- `docs/day9_implementation.md`
- `docs/day10_implementation.md`
- `docs/day11_implementation.md`

The following must already exist before Day 12 is applied:

| Path | Origin |
|---|---|
| `akara/backend/tests/conftest.py` | Day 1 |
| `akara/backend/tests/test_health.py` | Day 1 (2 passing tests) |
| `akara/backend/app/sql/guard.py` | Day 3 |
| `akara/backend/app/services/copilot/guardrails/checks.py` | Day 4 |
| `akara/backend/app/services/data_import/parser.py` | Day 5 |
| `akara/backend/app/core/config.py` | Day 2 |
| `akara/backend/app/services/copilot/planner.py` | Day 4 |
| `akara/backend/app/main.py` | Day 1 |
| `akara/backend/pyproject.toml` | Day 1 (includes `pytest-asyncio>=0.23.0`, `asyncio_mode = "auto"`) |
| `akara/backend/.env` | Must exist locally with valid values (not committed) |

The `akara/backend/tests/` directory should contain only `conftest.py` and `test_health.py` (2 tests total) before Day 12.

### Order in which to apply Day 12 changes

Day 12 consists exclusively of new test files. There are no inter-dependencies between the six new test files — they can be created in any order. The recommended order matches the dependency order of the source code being tested:

1. `akara/backend/tests/test_sql_guard.py`
2. `akara/backend/tests/test_guardrails.py`
3. `akara/backend/tests/test_data_parser.py`
4. `akara/backend/tests/test_config.py`
5. `akara/backend/tests/test_health_endpoint.py`
6. `akara/backend/tests/test_planner.py`

### Commands required after copying the code

```bash
cd akara/backend
uv run ruff check .
uv run pytest tests/ -v --tb=short
# Expected: 28 passed
```

### No new dependencies or environment variables were introduced on Day 12

All packages required by the new test files (`pytest`, `pytest-asyncio`, `pandas`, `fastapi[testclient]`, `httpx`) were already present in `pyproject.toml` before Day 12.

---

## Environment Variables

No new environment variables were introduced on Day 12.

`test_config.py` reads from the existing `akara/backend/.env` file (which must already exist from Day 2 onwards). The variables it validates — `supabase_url`, `jwt_secret`, `gemini_api_key`, `allowed_origins`, `is_production` — were all introduced in earlier days.

---

## Package / Dependency Changes

No packages were added, removed, or updated on Day 12. All test dependencies were already declared in `akara/backend/pyproject.toml`:

| Package | Used by | Pre-existing |
|---|---|---|
| `pytest` | All test files | Yes (Day 1) |
| `pytest-asyncio>=0.23.0` | `test_planner.py` | Yes (Day 1) |
| `pandas` | `test_data_parser.py` | Yes (Day 5) |
| `httpx` | `test_health_endpoint.py` (via Starlette TestClient) | Yes (Day 1) |
| `unittest.mock` | `test_planner.py` | Standard library |

The `asyncio_mode = "auto"` setting in `pyproject.toml` `[tool.pytest.ini_options]` was already configured before Day 12. It makes all `async def test_*` functions run automatically without any decorator.

---

# File: `akara/backend/tests/test_sql_guard.py`

**Status:** Created

## Purpose

Provides 7 unit tests for `app/sql/guard.py`. The SQL guard is a critical security layer that prevents the LLM-generated SQL from mutating or exfiltrating data. Without these tests, regressions to the guard logic would go undetected. Day 12 introduced these tests to reach the 20+ test target from `daywise.md`.

## Dependencies

| Dependency | Type | Pre-existing |
|---|---|---|
| `pytest` | Package | Yes |
| `app.sql.guard.SQLGuardError` | Internal class | Yes (Day 3) |
| `app.sql.guard.validate_sql` | Internal function | Yes (Day 3) |

**`validate_sql` error message contracts verified against source:**
- Non-SELECT statements → `SQLGuardError` with message containing `"permitted"` (full text: `"Only SELECT statements are permitted."`)
- Forbidden schema access → `SQLGuardError` with message containing `"forbidden"` (full text: `"Access to schema '...' is forbidden"`)

## Implementation

```python
import pytest

from app.sql.guard import SQLGuardError, validate_sql


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

## Placement

New file. Place at `akara/backend/tests/test_sql_guard.py`. No existing file is modified.

## Explanation

- **`test_select_allowed`**: Calls `validate_sql` with a plain `SELECT` — asserts no exception is raised. This is the happy path.
- **`test_delete_blocked`**: Passes a `DELETE` statement. The guard's `_FORBIDDEN_STATEMENTS` regex matches `DELETE`. The `match="permitted"` assertion verifies the error message text.
- **`test_drop_blocked`**: Passes a `DROP TABLE` statement — blocked by the same regex.
- **`test_insert_blocked`**: Passes an `INSERT` statement — blocked by the same regex.
- **`test_pg_catalog_blocked`**: Passes a `SELECT` on `pg_catalog.pg_tables`. The guard checks `_FORBIDDEN_SCHEMAS = frozenset(["pg_catalog", ...])`. The `match="forbidden"` assertion verifies the schema-specific error message.
- **`test_information_schema_blocked`**: Same as above for `information_schema`.
- **`test_update_blocked`**: Passes an `UPDATE` statement — blocked by the forbidden statements regex.

All 7 tests are pure Python. No I/O, no network, no fixtures required.

## Related Changes

- Tests `akara/backend/app/sql/guard.py` (Day 3, unmodified on Day 12).
- No other files import or depend on this test file.

---

# File: `akara/backend/tests/test_guardrails.py`

**Status:** Created

## Purpose

Provides 5 unit tests for the three guardrail check functions in `app/services/copilot/guardrails/checks.py`. The guardrails prevent the copilot from returning hallucinated numbers or unsupported causal claims to users. These tests verify the pass/fail behaviour of each check function.

## Dependencies

| Dependency | Type | Pre-existing |
|---|---|---|
| `pytest` | Package | Yes |
| `app.services.copilot.guardrails.checks.numeric_postcheck` | Internal function | Yes (Day 4) |
| `app.services.copilot.guardrails.checks.causal_postcheck` | Internal function | Yes (Day 4) |
| `app.services.copilot.guardrails.checks.premise_check` | Internal function | Yes (Day 4) |

**Contracts verified against source:**
- `numeric_postcheck` returns `GuardrailResult(passed=False, ...)` with `message` containing `"Suspiciously large number detected: ..."` when a number > 10,000,000,000 is found. The substring `"large number"` is present in the message.
- `causal_postcheck` returns `passed=False` when the response contains any phrase from `causal_phrases = ["caused by", "resulted in", "because of", "due to the fact", "proven that", "definitively shows", "guarantees"]`.
- `premise_check` accepts `(question: str, available_columns: list[str])` and returns `GuardrailResult`.

## Implementation

```python
from app.services.copilot.guardrails.checks import (
    causal_postcheck,
    numeric_postcheck,
    premise_check,
)


def test_numeric_postcheck_passes_normal() -> None:
    result = numeric_postcheck("Revenue was ₹50,000 yesterday")
    assert result.passed is True


def test_numeric_postcheck_fails_huge_number() -> None:
    result = numeric_postcheck("Revenue was 99999999999 billion units")
    assert result.passed is False
    assert "large number" in result.message.lower()


def test_causal_postcheck_fails_on_causal_claim() -> None:
    result = causal_postcheck(
        "The discount caused by the season resulted in higher sales"
    )
    assert result.passed is False


def test_causal_postcheck_passes_on_correlation() -> None:
    result = causal_postcheck(
        "Sales were higher, which is associated with the festive season"
    )
    assert result.passed is True


def test_premise_check_passes_normal_question() -> None:
    cols = ["invoice_date", "party_name", "total_amount", "product_name"]
    result = premise_check("What are my top products by revenue last month?", cols)
    assert result.passed is True
```

## Placement

New file. Place at `akara/backend/tests/test_guardrails.py`. No existing file is modified.

## Explanation

- **`test_numeric_postcheck_passes_normal`**: Input `"Revenue was ₹50,000 yesterday"` — the only number after comma-stripping is `50000`, which is below the 10 billion cap. Returns `passed=True`.
- **`test_numeric_postcheck_fails_huge_number`**: Input `"Revenue was 99999999999 billion units"` — `99999999999` > `10_000_000_000`. Returns `passed=False` with message `"Suspiciously large number detected: 99,999,999,999"`. The assertion uses `.lower()` for case safety.
- **`test_causal_postcheck_fails_on_causal_claim`**: Input contains both `"caused by"` and `"resulted in"`, which are in the `causal_phrases` list. Returns `passed=False`.
- **`test_causal_postcheck_passes_on_correlation`**: Input uses `"associated with"` — not in `causal_phrases`. Returns `passed=True`.
- **`test_premise_check_passes_normal_question`**: Passes a normal sales question with a full column list. Expected to return `passed=True`.

**Important note on import**: `GuardrailResult` is intentionally NOT imported in this file. Ruff (`F401`) will flag unused imports and fail the quality gate. The return type is validated via duck typing on `.passed` and `.message` attributes, not by type checking the class directly.

## Related Changes

- Tests `akara/backend/app/services/copilot/guardrails/checks.py` (Day 4, unmodified on Day 12).
- No other files import or depend on this test file.

---

# File: `akara/backend/tests/test_data_parser.py`

**Status:** Created

## Purpose

Provides 4 unit tests for `SalesDataParser.parse()` in `app/services/data_import/parser.py`. The data parser is the entry point for all customer data ingestion. These tests verify that valid CSVs parse correctly, that missing required columns raise the expected error, that unsupported file extensions are rejected, and that column alias mapping (e.g. `date` → `invoice_date`) works.

## Dependencies

| Dependency | Type | Pre-existing |
|---|---|---|
| `pytest` | Package | Yes |
| `pandas` | Package | Yes (Day 5) |
| `io` | Standard library | — |
| `app.services.data_import.parser.SalesDataParser` | Internal class | Yes (Day 5) |

**Contracts verified against source (`parser.py`):**
- Missing required columns → `ValueError(f"Missing required columns: {missing}")`
- Unsupported file type → `ValueError(f"Unsupported file type: {filename}")`
- Column aliases mapped in `COLUMN_ALIASES` dict: `"date"` → `"invoice_date"`, `"customer"` → `"party_name"`, `"total"` → `"total_amount"`
- Required columns: `{"invoice_date", "party_name", "total_amount"}`

## Implementation

```python
import io

import pandas as pd
import pytest

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
    csv = make_csv(
        [
            {
                "invoice_date": "2024-01-15",
                "party_name": "ABC Stores",
                "total_amount": 5000.0,
            }
        ]
    )
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
    csv = make_csv(
        [
            {
                "date": "2024-01-15",
                "customer": "XYZ Corp",
                "total": 9999.99,
            }
        ]
    )
    df = parser.parse(csv, "test.csv")
    assert "invoice_date" in df.columns
    assert "party_name" in df.columns
    assert "total_amount" in df.columns
```

## Placement

New file. Place at `akara/backend/tests/test_data_parser.py`. No existing file is modified.

## Explanation

- **`parser` fixture**: Returns a fresh `SalesDataParser()` instance per test. Avoids repeated instantiation.
- **`make_csv()` helper**: Builds in-memory CSV bytes from a list of dicts using `pandas.DataFrame.to_csv()`. This avoids filesystem I/O and keeps tests self-contained.
- **`test_parse_valid_csv`**: Passes a single-row CSV with all required columns. Asserts the result DataFrame has 1 row and the correct `party_name` value.
- **`test_parse_missing_required_column_raises`**: Passes a CSV with `invoice_date` and `quantity` but no `party_name` or `total_amount`. Asserts `ValueError` is raised with message matching `"Missing required columns"`.
- **`test_parse_unsupported_extension_raises`**: Passes `b"data"` with filename `"test.pdf"`. The parser checks the file extension before attempting to read. Asserts `ValueError` is raised with message matching `"Unsupported"`.
- **`test_parse_column_alias_mapping`**: Passes a CSV with aliased column names (`date`, `customer`, `total`). After parsing, asserts the resulting DataFrame has the canonical column names (`invoice_date`, `party_name`, `total_amount`).

No Supabase, no network, no filesystem access required.

## Related Changes

- Tests `akara/backend/app/services/data_import/parser.py` (Day 5, unmodified on Day 12).
- No other files import or depend on this test file.

---

# File: `akara/backend/tests/test_config.py`

**Status:** Created

## Purpose

Provides 3 tests that verify the `Settings` object loaded from `app/core/config.py` is correctly populated from the `.env` file. These tests catch environment misconfiguration early — if a required variable is missing or malformed, these tests fail before the app is deployed.

## Dependencies

| Dependency | Type | Pre-existing |
|---|---|---|
| `app.core.config.settings` | Internal singleton | Yes (Day 2) |
| `akara/backend/.env` | Local file (not committed) | Yes (Day 2) |

**Prerequisite**: A valid `akara/backend/.env` file must exist with at minimum:
```
SUPABASE_URL=https://...
JWT_SECRET=<secret longer than 10 chars>
GEMINI_API_KEY=<non-empty value>
ALLOWED_ORIGINS_RAW=http://localhost:5173
ENVIRONMENT=development
```

**Fields tested (all pre-existing from Day 2):**
- `settings.supabase_url` — validated to start with `"https://"`
- `settings.jwt_secret` — validated to have length > 10
- `settings.gemini_api_key` — validated to be non-empty
- `settings.allowed_origins` — validated to be a non-empty `list`
- `settings.is_production` — validated to be a `bool`

## Implementation

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

## Placement

New file. Place at `akara/backend/tests/test_config.py`. No existing file is modified.

## Explanation

- **`test_settings_loads`**: Validates that the three most critical secrets (`supabase_url`, `jwt_secret`, `gemini_api_key`) are present and have expected shapes.
- **`test_allowed_origins_is_list`**: The `allowed_origins` property on `Settings` parses the raw `ALLOWED_ORIGINS_RAW` env var (a comma-separated string) into a Python `list`. This test confirms the parsing works.
- **`test_is_production_flag`**: `is_production` is a `@property` or computed field on `Settings` that derives a `bool` from the `ENVIRONMENT` variable. This test asserts the type is correct.

These tests will be **skipped or fail** if no `.env` file is present. This is expected and acceptable in CI environments without secrets — the plan explicitly notes this as a prerequisite.

## Related Changes

- Tests `akara/backend/app/core/config.py` (Day 2, unmodified on Day 12).
- No other files import or depend on this test file.

---

# File: `akara/backend/tests/test_health_endpoint.py`

**Status:** Created

## Purpose

Provides 6 integration-style tests that drive the full FastAPI application through `TestClient`. These tests verify:
1. The `/health` endpoint returns the correct status code and body shape.
2. All protected endpoints (`/auth/me`, `/kpi/`, `/copilot/chat`, `/data/import`) return `401 Unauthorized` when called without an Authorization header.

These tests complement the existing `test_health.py` (which uses the shared `client` fixture from `conftest.py`). This file instantiates `TestClient` inline to demonstrate both patterns are valid.

**Note on HTTP status code**: The `daywise.md` plan specified `403 Forbidden` for unauthenticated requests. The actual FastAPI auth middleware returns `401 Unauthorized` (missing credentials), which is the correct HTTP semantic. All assertions use `401`.

## Dependencies

| Dependency | Type | Pre-existing |
|---|---|---|
| `fastapi.testclient.TestClient` | Package (FastAPI) | Yes (Day 1) |
| `app.main.app` | Internal FastAPI instance | Yes (Day 1) |
| `/health` endpoint | Route in `app/api/routes/health.py` | Yes (Day 1) |
| `/auth/me` endpoint | Route in `app/api/routes/auth.py` | Yes (Day 2) |
| `/kpi/` endpoint | Route in `app/api/routes/kpi.py` | Yes (Day 3) |
| `/copilot/chat` endpoint | Route in `app/api/routes/copilot.py` | Yes (Day 4) |
| `/data/import` endpoint | Route in `app/api/routes/data.py` | Yes (Day 5) |

## Implementation

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


def test_auth_me_without_token_returns_401() -> None:
    client = TestClient(app)
    assert client.get("/auth/me").status_code == 401


def test_kpi_without_token_returns_401() -> None:
    client = TestClient(app)
    assert client.get("/kpi/").status_code == 401


def test_copilot_without_token_returns_401() -> None:
    client = TestClient(app)
    assert client.post("/copilot/chat", json={"question": "hi"}).status_code == 401


def test_data_import_without_token_returns_401() -> None:
    client = TestClient(app)
    assert client.post("/data/import").status_code == 401
```

## Placement

New file. Place at `akara/backend/tests/test_health_endpoint.py`. No existing file is modified.

Note: `test_health_returns_200` has the same function name as a test in `test_health.py`. This is intentional and not a conflict — pytest identifies tests by `file::function_name`, so both can coexist.

## Explanation

- **`test_health_returns_200`** and **`test_health_body_shape`**: Hit `GET /health` and verify the `200` status and JSON body keys `status`, `environment`, `timestamp`.
- **`test_auth_me_without_token_returns_401`**: `GET /auth/me` with no `Authorization` header. The auth middleware raises `HTTPException(status_code=401)`.
- **`test_kpi_without_token_returns_401`**: `GET /kpi/` with no token.
- **`test_copilot_without_token_returns_401`**: `POST /copilot/chat` with a minimal JSON body but no auth header. The auth middleware runs before request body parsing.
- **`test_data_import_without_token_returns_401`**: `POST /data/import` with no token and no body.

Each test creates a new `TestClient(app)` inline. This avoids sharing state between tests but incurs a small overhead. The pattern is fine for 6 tests.

## Related Changes

- Tests `akara/backend/app/main.py` (Day 1, unmodified on Day 12).
- Indirectly tests all route files mounted in `app/main.py`.
- Extends `akara/backend/tests/test_health.py` (Day 1) with 4 additional security coverage tests.

---

# File: `akara/backend/tests/test_planner.py`

**Status:** Created

## Purpose

Provides 1 async unit test for `Planner.plan()` in `app/services/copilot/planner.py`. The planner is the first stage of the copilot pipeline (Plan → Execute → Synthesize). This test verifies that when given a question and schema context, the planner calls the LLM and parses the JSON response into a typed `Plan` object. The LLM is mocked to remove network dependency.

## Dependencies

| Dependency | Type | Pre-existing |
|---|---|---|
| `pytest` | Package | Yes |
| `pytest-asyncio` with `asyncio_mode = "auto"` | Package + config | Yes (Day 1) |
| `json` | Standard library | — |
| `unittest.mock.AsyncMock` | Standard library | — |
| `unittest.mock.MagicMock` | Standard library | — |
| `app.services.copilot.planner.Planner` | Internal class | Yes (Day 4) |
| `app.services.copilot.planner.Plan` | Internal dataclass | Yes (Day 4) |

**`Planner` constructor signature (verified against source):**
```python
class Planner:
    def __init__(self, llm: LLMManager) -> None: ...
    async def plan(
        self,
        question: str,
        schema_context: str,
        date_range: tuple[str, str],
    ) -> Plan: ...
```

**`Plan` dataclass fields (verified against source):**
- `intent: str`
- `steps: list[PlanStep]`
- `requires_context: list`
- `response_format: str`

**`PlanStep` dataclass fields (verified against source):**
- `step_id: int`
- `description: str`
- `sql: str`

## Implementation

```python
import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.copilot.planner import Plan, Planner


@pytest.fixture
def mock_llm() -> MagicMock:
    llm = MagicMock()
    llm.complete = AsyncMock(
        return_value=json.dumps(
            {
                "intent": "top products by revenue",
                "steps": [
                    {
                        "step_id": 1,
                        "description": "Get top products",
                        "sql": (
                            "SELECT product_name, SUM(total_amount) "
                            "FROM public.sales_data "
                            "WHERE tenant_id = :tenant_id "
                            "GROUP BY product_name "
                            "ORDER BY 2 DESC LIMIT 5"
                        ),
                    }
                ],
                "requires_context": [],
                "response_format": "table",
            }
        )
    )
    return llm


async def test_planner_returns_plan(mock_llm: MagicMock) -> None:
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

## Placement

New file. Place at `akara/backend/tests/test_planner.py`. No existing file is modified.

## Explanation

- **`mock_llm` fixture**: Creates a `MagicMock` whose `.complete` attribute is replaced with an `AsyncMock`. The `AsyncMock` returns a pre-serialised JSON string that represents a valid `Plan` structure. This ensures the planner's JSON parsing logic is exercised without making real LLM API calls.
- **`test_planner_returns_plan`**: This is an `async def` function. Because `asyncio_mode = "auto"` is set in `pyproject.toml`, `pytest-asyncio` automatically runs it in an event loop without any additional decorator.
  - Creates a `Planner` with the `mock_llm` fixture.
  - Calls `planner.plan(...)` — the planner calls `llm.complete(...)` internally, which returns the mocked JSON.
  - The planner parses the JSON and returns a `Plan` dataclass instance.
  - Asserts: the return type is `Plan`, `intent` matches, there is exactly 1 step, and the step's SQL contains `"SELECT"`.

**Edge cases**: The test does not cover LLM failure / JSON parse errors. Those are intentionally deferred to future days.

## Related Changes

- Tests `akara/backend/app/services/copilot/planner.py` (Day 4, unmodified on Day 12).
- Depends on `akara/backend/pyproject.toml` `[tool.pytest.ini_options]` `asyncio_mode = "auto"` (Day 1, unmodified on Day 12).
- No other files import or depend on this test file.

---

## Final Verification

| Checklist item | Status |
|---|---|
| Every Day 12 file change documented | ✓ (6 new test files) |
| No Day 1–11 unchanged code duplicated | ✓ |
| Every new import has a corresponding dependency | ✓ |
| Every environment variable change documented | ✓ (none introduced) |
| Every package change documented | ✓ (none introduced) |
| Every test added during Day 12 is included | ✓ (28 total, 26 new) |
| All file paths are valid | ✓ |
| All code blocks are complete and correctly formatted | ✓ |
| `ruff check .` passes with zero errors | ✓ (verified) |
| `pytest tests/ -v` passes 28/28 | ✓ (verified) |

## Day 12 Test Count Summary

| File | New tests | Running total |
|---|---|---|
| `test_health.py` (existing, Day 1) | — | 2 |
| `test_sql_guard.py` | 7 | 9 |
| `test_guardrails.py` | 5 | 14 |
| `test_data_parser.py` | 4 | 18 |
| `test_config.py` | 3 | 21 |
| `test_health_endpoint.py` | 6 | 27 |
| `test_planner.py` | 1 | 28 |

Target from `daywise.md`: 20 tests. Actual: **28 passed**.
