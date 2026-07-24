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

**Design system:** Dev-only component gallery at [`/gallery`](http://localhost:5173/gallery) — FireAI-inspired light tokens, `SurfaceCard`, pill `AkaraButton`. See `implentation/uirehaulday4.md` v2 addendum.

### Database
Migrations live in `supabase/migrations/`. Apply via Supabase SQL Editor or `supabase db push`.

After billing migrations **015** + **016**, verify:

```bash
cd backend && python scripts/verify_supabase.py
```

## Day 5 — Billing, Razorpay, GST, Dunning

Full Razorpay setup: [`docs/razorpay_setup.md`](docs/razorpay_setup.md)

### Migrations
- **015** — GST invoices, dunning, billing details (applied)
- **016** — Razorpay columns + rename `payment_webhook_events`, `provider_payment_id`

### Railway env (API service)
| Variable | Purpose |
|----------|---------|
| `RAZORPAY_KEY_ID` | Razorpay API key |
| `RAZORPAY_KEY_SECRET` | API secret |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook HMAC |
| `RAZORPAY_*_PLAN_ID` (×4) | Subscription plan IDs |
| `COMPANY_GSTIN`, `SENDGRID_*`, `CUSTOMER_FRONTEND_URL` | Unchanged |

### Background jobs
```bash
# Import worker (every 60s)
python -m app.tasks.import_worker

# Dunning (daily)
python -m app.tasks.dunning
```

### E2E checklist
[`docs/day5_e2e_checklist.md`](docs/day5_e2e_checklist.md)
