# Day 6 — Security, DPDP, alerts E2E checklist

Run against deployed Railway API + Vercel frontend.

## Prerequisites
- Migration **017** applied (`tenant_alerts`, `alert_trigger_events`)
- SendGrid configured for alert + import failure emails
- Optional: `HEALTHCHECKS_PING_URL` for alert/dunning cron

## Security (P0)

| # | Action | Expected |
|---|--------|----------|
| 1 | Hit `/copilot/chat` 31× in 1 minute (test mode) | 429 JSON with `RATE_LIMITED` |
| 2 | `GET /health` response headers | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` |
| 3 | `pytest tests/test_pii_redactor.py` | GST/phone/email redacted; party names kept |

## Alerts (P0/P1)

| # | Action | Expected |
|---|--------|----------|
| 4 | Pro user → `/alerts` → create alert | Row in `tenant_alerts` |
| 5 | Free user → `/alerts` | PlanGate / upgrade CTA |
| 6 | Run `python -m app.tasks.alert_evaluator` with triggered threshold | Email + `alert_trigger_events` row |

## DPDP & legal (P1)

| # | Action | Expected |
|---|--------|----------|
| 7 | `/privacy#ai-processing` | AI disclosure + sub-processors (Razorpay) |
| 8 | Sign up without AI consent checkbox | Blocked client-side |
| 9 | `/superadmin/security` | Alert trigger stats + residency note |

## GAP close (P1)

| # | Action | Expected |
|---|--------|----------|
| 10 | Import job dead letter after max retries | Email to uploader with link to `/data` |
| 11 | Copilot during LLM outage | Amber banner; dashboard still works |

## Automated gate

```bash
cd akara/backend && pytest tests/test_rate_limits.py tests/test_security_headers.py tests/test_pii_redactor.py tests/test_alerts.py tests/test_import_worker.py tests/test_copilot.py -q
cd akara/frontend && npm run build
```

## Operator
- Verify Supabase region is `ap-south-1` or `ap-south-2`
- Add Railway services for alerts cron + import worker per `README.md`
