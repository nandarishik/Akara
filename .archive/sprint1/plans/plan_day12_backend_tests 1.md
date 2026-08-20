---
name: Day 12 Backend Tests
overview: Write 26 backend pytest tests across 6 new test files, covering SQL guard, guardrails, data parser, config, health endpoints, and the copilot planner. Track 2 (runbook.md) is already complete from the gap fixes session.
todos:
  - id: test-sql-guard
    content: Create akara/backend/tests/test_sql_guard.py — 7 SQL guard tests
    status: completed
  - id: test-guardrails
    content: Create akara/backend/tests/test_guardrails.py — 5 guardrail tests
    status: completed
  - id: test-data-parser
    content: Create akara/backend/tests/test_data_parser.py — 4 data parser tests
    status: completed
  - id: test-config
    content: Create akara/backend/tests/test_config.py — 3 config settings tests
    status: completed
  - id: test-health-endpoint
    content: Create akara/backend/tests/test_health_endpoint.py — 6 endpoint tests
    status: completed
  - id: test-planner
    content: Create akara/backend/tests/test_planner.py — 1 async planner test
    status: completed
  - id: day12-quality-gate
    content: Run ruff check + pytest — all tests pass
    status: completed
isProject: false
---

# Day 12 — Write Core Backend Tests

## Current State

- `akara/backend/tests/` has 2 passing tests in [`test_health.py`](akara/backend/tests/test_health.py) using the `client` fixture from [`conftest.py`](akara/backend/tests/conftest.py)
- `pytest-asyncio` is installed with `asyncio_mode = "auto"` in `pyproject.toml` (async tests work with no decorator config needed)
- Track 2 (`docs/runbook.md`) is already done

## 6 New Test Files

All files go in `akara/backend/tests/`. Content is taken directly from `daywise.md` with adjustments verified against the actual source code.

---

### 1. `test_sql_guard.py` — 7 tests

Tests [`app/sql/guard.py`](akara/backend/app/sql/guard.py) `validate_sql()` and `SQLGuardError`. Pure Python, no I/O, no fixtures needed.

Key verifications against real code:
- `"permitted"` match string — confirmed: `"Only SELECT statements are permitted."`
- `"forbidden"` match string — confirmed: `"Access to schema '...' is forbidden"`

---

### 2. `test_guardrails.py` — 5 tests

Tests [`app/services/copilot/guardrails/checks.py`](akara/backend/app/services/copilot/guardrails/checks.py): `numeric_postcheck`, `causal_postcheck`, `premise_check`. Pure Python, no fixtures needed.

Key verifications:
- `"large number"` match — confirmed: message is `"Suspiciously large number detected: ..."` which contains "large number"
- `causal_postcheck` on `"The discount caused by the season..."` — confirmed `causal_phrases` list includes `"caused by"` and similar phrases

---

### 3. `test_data_parser.py` — 4 tests

Tests [`app/services/data_import/parser.py`](akara/backend/app/services/data_import/parser.py) `SalesDataParser.parse()`. No I/O or Supabase — works on in-memory CSV bytes.

Uses a `make_csv()` helper function to build CSV bytes from a list of dicts via pandas. Uses a `parser` fixture returning `SalesDataParser()`.

Tests cover: valid parse, missing required column error, unsupported file extension error, and column alias mapping (`date`→`invoice_date`, `customer`→`party_name`, `total`→`total_amount`).

---

### 4. `test_config.py` — 3 tests

Tests [`app/core/config.py`](akara/backend/app/core/config.py) `settings` object.

**Requires a real `.env` file** with valid values (per `daywise.md` prerequisite). Tests that `supabase_url` starts with `https://`, `jwt_secret` length > 10, `gemini_api_key` is non-empty, `allowed_origins` is a non-empty list, and `is_production` is a bool.

---

### 5. `test_health_endpoint.py` — 6 tests

Tests the FastAPI app via `TestClient(app)` (inline, not using conftest fixture — both patterns are valid in pytest). Covers:
- Health returns 200 with correct shape
- `GET /auth/me` without token → 403
- `GET /kpi/` without token → 403
- `POST /copilot/chat` without token → 403
- `POST /data/import` without token → 403

Note: 2 of these tests overlap with `test_health.py` by test name, but pytest identifies them by `file::name` so there is no conflict.

---

### 6. `test_planner.py` — 1 async test

Tests [`app/services/copilot/planner.py`](akara/backend/app/services/copilot/planner.py) `Planner.plan()` with a mocked `LLMManager`.

`Planner.__init__` takes `llm: LLMManager`. The mock replaces `llm.complete` with `AsyncMock` returning a valid JSON plan string. Since `asyncio_mode = "auto"` is set, `async def test_...` functions run automatically.

---

## Test Count Summary

| File | New tests | Running total |
|---|---|---|
| `test_health.py` (existing) | — | 2 |
| `test_sql_guard.py` | 7 | 9 |
| `test_guardrails.py` | 5 | 14 |
| `test_data_parser.py` | 4 | 18 |
| `test_config.py` | 3 | 21 |
| `test_health_endpoint.py` | 6 | 27 |
| `test_planner.py` | 1 | 28 |

Target from `daywise.md`: 20 tests. We get 28.

## Quality Gate

```bash
cd akara/backend
uv run ruff check .
uv run pytest tests/ -v --tb=short
# Expected: 28 passed (or 26 if test_config skipped without .env)
```
