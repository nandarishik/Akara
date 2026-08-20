# Coding standards

## Backend

- Python 3.12, FastAPI, Pydantic v2
- Lint/format with Ruff (`uv run ruff check .` / `uv run ruff format .`)
- Prefer domain logic in services; keep route handlers thin
- Never log secrets or full PII payloads

## Frontend

- React 18 + TypeScript + Vite
- Prefer feature-local components; shared primitives under design-system UI
- Lint with the project ESLint/oxlint config; run Vitest for unit tests

## Migrations

- Add numbered SQL under `supabase/migrations/`
- Document breaking ops steps in `docs/operations/`
