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
uvicorn app.main:app --reload
```

## Frontend

```bash
cd frontend
pnpm install           # or npm install
cp .env.example .env.local
pnpm dev
```

## Docs layout

| Path | Purpose |
|------|---------|
| `docs/operations/` | Deploy, runbooks, Razorpay, onboarding |
| `docs/architecture/` | System design and plan catalog |
| `docs/development/` | Contributor guides |
| `docs/adr/` | Architecture Decision Records |
| `.archive/` | Historical sprint plans and UI specs |
