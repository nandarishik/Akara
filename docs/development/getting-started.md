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

## Docs layout

| Path | Purpose |
|------|---------|
| `docs/operations/` | Deploy, runbooks, Razorpay, onboarding |
| `docs/architecture/` | System design and plan catalog |
| `docs/development/` | Contributor guides |
| `docs/adr/` | Architecture Decision Records |
| `.archive/` | Historical sprint plans and UI specs |
