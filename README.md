# AKARA

AI-powered analytics dashboard for FMCG distributors and any business with transactional sales data.

## Monorepo structure

- `frontend/` — React 18 + Vite + TailwindCSS + shadcn/ui (hosted on Vercel)
- `backend/` — FastAPI + Python 3.12 (hosted on Railway)
- `supabase/` — Migrations, seed data, edge functions

## Quick start

### Backend
```bash
cd backend
uv venv
uv sync --extra dev
cp .env.example .env  # fill in your values
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local  # fill in your values
npm run dev
```

### Database
Migrations live in `supabase/migrations/`. Apply via:
```bash
supabase db push
```
or paste each file into Supabase Dashboard → SQL Editor.
