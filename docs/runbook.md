# AKARA Runbook

Operational reference for the AKARA team. Use this when something breaks in production.

---

## Health Check

```bash
GET https://akara-backend-production.up.railway.app/health
```

Expected response:
```json
{"status": "ok", "environment": "production", "timestamp": "2024-..."}
```

---

## Logs

- **Railway (backend):** Dashboard → Deployments → Logs tab
- **Sentry (errors):** sentry.io → AKARA project → Issues

---

## Common Issues

### Backend returns 500 on `/kpi/`

1. Check Railway logs for the exception traceback.
2. Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly in Railway variables.
3. Run manually in Supabase SQL Editor:
   ```sql
   SELECT * FROM public.sales_data LIMIT 1;
   ```
4. If the table is empty, the tenant has no data — ask them to upload from `/data`.

---

### File import fails silently

1. Confirm the file is `.csv` or `.xlsx` (`.xls` requires conversion first).
2. Confirm required columns are present:
   - Primary Sales: `invoice_date`, `party_name`, `total_amount`
   - Secondary Sales: same as above
   - Scheme Master: `scheme_name`, `party_name`, `claimed_amount`, `scheme_start`, `scheme_end`
3. Check Railway logs for parser errors (`SalesDataParser`).
4. Common fix: ask the customer to export from Tally as `.xlsx`, not `.xls`.

---

### Copilot returns "All LLM providers unavailable"

1. Check `GEMINI_API_KEY` quota in Google Cloud Console → APIs → Gemini.
2. Check `OPENROUTER_API_KEY` balance at openrouter.ai → Credits.
3. Both keys must be set in Railway. If either is empty the fallback won't work.

---

### Morning brief emails not sending

1. Confirm `SENDGRID_API_KEY` is set in Railway.
2. Confirm `BACKEND_SERVICE_KEY` matches in both Railway AND Supabase Edge Function secrets (`daily-morning-brief` → Secrets).
3. Check Supabase → Edge Functions → `daily-morning-brief` → Logs.
4. Verify the function schedule: `30 1 * * *` (1:30 AM UTC = 7:00 AM IST).
5. Confirm the customer's profile has `preferences.morning_brief_enabled = true`.

---

### Frontend shows blank screen / crash

1. Open browser DevTools → Console — look for JavaScript errors.
2. Check Sentry for the stack trace (if `VITE_SENTRY_DSN` is set on Vercel).
3. Check Vercel → Deployments — confirm latest deployment succeeded.

---

## Deployment

### Backend (Railway)

```bash
cd akara/backend
uv run ruff check .
uv run pytest
railway up
```

### Frontend (Vercel)

```bash
cd akara/frontend
npx tsc --noEmit
npx vite build
vercel --prod
```

---

## Database

- **Supabase console:** supabase.com/dashboard
- **Run migrations:** Open Supabase → SQL Editor → paste migration file contents → Run
- **Migration order:** 001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009

---

## Environment Variables

### Railway (backend)

| Variable | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | Yes | |
| `SUPABASE_ANON_KEY` | Yes | |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Never expose publicly |
| `JWT_SECRET` | Yes | Copy from Supabase → Settings → API |
| `GEMINI_API_KEY` | Yes | Primary LLM |
| `OPENROUTER_API_KEY` | Yes | LLM failover |
| `SENDGRID_API_KEY` | Yes | Morning brief |
| `SENDGRID_FROM_EMAIL` | No | Default: `insights@akara.ai` |
| `BACKEND_SERVICE_KEY` | Yes | Edge Function → backend auth |
| `ENVIRONMENT` | Yes | `production` |
| `ALLOWED_ORIGINS_RAW` | Yes | Your Vercel URL + custom domain |
| `SENTRY_DSN` | No | Error tracking |

### Vercel (frontend)

| Variable | Required |
|---|---|
| `VITE_SUPABASE_URL` | Yes |
| `VITE_SUPABASE_ANON_KEY` | Yes |
| `VITE_API_BASE_URL` | Yes |
| `VITE_SENTRY_DSN` | No |

---

## Supabase Free Tier Limits

Check usage: Supabase → Project Settings → Billing

| Limit | Free tier | Action when near |
|---|---|---|
| Database size | 500 MB | Upgrade to Pro ($25/mo) |
| Storage | 1 GB | Upgrade to Pro |
| Edge Function invocations | 500K/mo | Monitor morning brief frequency |
| Realtime connections | 200 | Not currently used |

Upgrade trigger: **first paying customer onboards** → upgrade to Pro immediately.
