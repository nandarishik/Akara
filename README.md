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

**Design system:** Dev-only component gallery at [`/gallery`](http://localhost:5173/gallery) — FireAI-inspired light tokens, `SurfaceCard`, pill `AkaraButton`. Historical UI rehaul notes: `.archive/sprint2/uirehaulday4.md`.

**Docs:** Active guides in [`docs/`](docs/) (`operations/`, `architecture/`, `development/`). Sprint history lives in [`.archive/`](.archive/).

### Database
Migrations live in `supabase/migrations/`. Apply via Supabase SQL Editor or `supabase db push`.

After billing migrations **015** + **016**, verify:

```bash
cd backend && python scripts/verify_supabase.py
```

## Day 5 — Billing, Razorpay, GST, Dunning

Full Razorpay setup: [`docs/operations/razorpay-setup.md`](docs/operations/razorpay-setup.md)

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

# Dunning (daily) — Railway cron service (see backend/deploy/railway.dunning.json)
python -m app.tasks.dunning
```

**Railway dunning cron:** Add a second service in the same project, root directory `backend`, paste config from `backend/deploy/railway.dunning.json` or set:
- **Cron schedule:** `0 4 * * *` (daily 4:00 UTC ≈ 9:30 AM IST)
- **Start command:** `/opt/venv/bin/python -m app.tasks.dunning`
- Copy the same env vars as the API service (Supabase, SendGrid)
- Optional: `HEALTHCHECKS_PING_URL` base URL; task pings `/dunning` on success

### E2E checklist
[`.archive/sprint1/checklists/day5_e2e_checklist.md`](.archive/sprint1/checklists/day5_e2e_checklist.md)

## Day 6 — Security, DPDP, Alerts

Apply migration **017** (`017_alerts.sql`) on Supabase.

### Railway cron / worker services
| Service | Config | Schedule / command |
|---------|--------|-------------------|
| Dunning | `backend/deploy/railway.dunning.json` | Daily `python -m app.tasks.dunning` |
| Alerts | `backend/deploy/railway.alerts.json` | Daily `python -m app.tasks.alert_evaluator` |
| Import worker | `backend/deploy/railway.import_worker.json` | Every minute `python -m app.tasks.import_worker` |

### E2E checklist
[`.archive/sprint1/checklists/day6_e2e_checklist.md`](.archive/sprint1/checklists/day6_e2e_checklist.md)

## Day 7 — Comms, Teams, Debrief, Account Rights

Apply migration **018** (`018_day7_comms_teams_debrief.sql`) on Supabase.

### Railway cron / worker services

**Free-tier limit (4 services):** If you already run API + dunning + alerts + import worker, **defer** the two Day 7 crons until you upgrade Railway (planned Day 14 / first customer). Code and JSON configs are ready; nothing breaks without them.

| Service | Config | Schedule / command | When to add |
|---------|--------|-------------------|---------------|
| Weekly debrief | `backend/deploy/railway.weekly_debrief.json` | `30 1 * * 1` → `python -m app.tasks.weekly_debrief` | Day 14+ or after Railway upgrade |
| Activation emails | `backend/deploy/railway.activation_emails.json` | `0 8 * * *` → `python -m app.tasks.activation_emails` | Day 14+ or after Railway upgrade |

**Until crons are live**, use manual triggers:

```bash
# Weekly debrief — one tenant (superadmin JWT or X-Service-Key)
curl -X POST "$BACKEND_URL/admin/reports/weekly-debrief" \
  -H "X-Service-Key: $BACKEND_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "<uuid>"}'

# Activation emails — full batch (run locally or one-off Railway job)
cd backend && python -m app.tasks.activation_emails

# Weekly debrief — all active tenants (Monday job substitute)
cd backend && python -m app.tasks.weekly_debrief

# Account deletion queue — process pending DPDP deletions
cd backend && python -m app.tasks.account_deletion_worker
```

When you add each cron service: **Root Directory = `backend`**, **Restart = Never**, copy env from API (Supabase, SendGrid, OpenRouter, `BACKEND_SERVICE_KEY`), optional `HEALTHCHECKS_PING_URL` (pings `/weekly_debrief` and `/activation_emails`).

WhatsApp stays gated until Meta templates approved: `WHATSAPP_SENDS_ENABLED=false` (default).

### E2E checklist
[`.archive/sprint1/checklists/day7_e2e_checklist.md`](.archive/sprint1/checklists/day7_e2e_checklist.md)
