# Getting started

## Prerequisites

- Python 3.12+, [uv](https://github.com/astral-sh/uv)
- Node.js 20+, pnpm or npm
- Supabase project credentials

## Backend

```bash
cd backend
uv venv
uv sync --extra dev
cp .env.example .env   # fill values
# or from repo root:
make dev-api
```

Local `.env` should keep `ENVIRONMENT=development` and `GIT_SHA=dev`. Never set live `RAZORPAY_KEY_ID` or `SENDGRID_API_KEY` on a laptop.

Combined cron workers (optional locally):

```bash
cd backend
python -m app.workers.combined.cron_business_worker
python -m app.workers.combined.cron_intelligence_worker
```

New numbered migrations `supabase/migrations/NNN_*.sql` with NNN ≥ 029 also need `supabase/migrations/rollback/NNN_rollback.sql`.

## Frontend

```bash
cd frontend
pnpm install           # or npm install
cp .env.example .env.local
# VITE_ENVIRONMENT=development shows the orange DEVELOPMENT banner (DEV2)
# VITE_GIT_SHA is shown on Settings
make dev-web           # from repo root, or: pnpm dev
```

### Phase 4 migrations (030–032)

Phase 4 adds `030_p04_roles_consent.sql`, `031_p04_team_invites.sql`, and `032_p04_active_sessions.sql` under `supabase/migrations/` (with matching files in `supabase/migrations/rollback/`). Apply them on your Supabase project when you are ready to exercise team invites, consent logging, and session management locally or on staging — they are **not** applied automatically by `make migrate` (that target only prints a hint). Team invite links use `/invite/accept?token=…` on the customer frontend.

## Docs layout

| Path | Purpose |
|------|---------|
| `docs/operations/` | Deploy, runbooks, Razorpay, onboarding |
| `docs/architecture/` | System design and plan catalog |
| `docs/development/` | Contributor guides |
| `docs/adr/` | Architecture Decision Records |
| `.archive/` | Historical sprint plans and UI specs |
