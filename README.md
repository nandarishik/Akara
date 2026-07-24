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
# Import worker (every 60s) — separate Railway service or cron
python -m app.tasks.import_worker

# Dunning (daily) — Railway cron service (see backend/railway.dunning.json)
python -m app.tasks.dunning
```

**Railway dunning cron:** Add a second service in the same project, root directory `backend`, paste config from `railway.dunning.json` or set:
- **Cron schedule:** `0 4 * * *` (daily 4:00 UTC ≈ 9:30 AM IST)
- **Start command:** `/opt/venv/bin/python -m app.tasks.dunning`
- Copy the same env vars as the API service (Supabase, SendGrid)
- Optional: `HEALTHCHECKS_PING_URL` base URL; task pings `/dunning` on success

### E2E checklist
[`docs/day5_e2e_checklist.md`](docs/day5_e2e_checklist.md)

## Day 6 — Security, DPDP, Alerts

Apply migration **017** (`017_alerts.sql`) on Supabase.

### Railway cron / worker services
| Service | Config | Schedule / command |
|---------|--------|-------------------|
| Dunning | `railway.dunning.json` | Daily `python -m app.tasks.dunning` |
| Alerts | `railway.alerts.json` | Daily `python -m app.tasks.alert_evaluator` |
| Import worker | `railway.import_worker.json` | Every minute `python -m app.tasks.import_worker` |

### E2E checklist
[`docs/day6_e2e_checklist.md`](docs/day6_e2e_checklist.md)
