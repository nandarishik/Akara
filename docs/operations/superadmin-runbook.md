# Superadmin Runbook (Day 8)

Operational guide for AKARA superadmin panel at `/superadmin/*`.

## Access model

- **Role:** `profiles.role = 'superadmin'` (404 for everyone else — not 403).
- **Sudo:** Destructive mutations require a 15-minute sudo session via `POST /superadmin/sudo` with superadmin password.
- **CSRF:** Mutations send `X-CSRF-Token` header matching the `akara_csrf` cookie set at sudo start.
- **Cookies:** `akara_sudo` (HttpOnly) + `akara_csrf` (readable by JS for double-submit).

## First-time setup

1. Apply migration [`supabase/migrations/020_day8_superadmin_foundation.sql`](../supabase/migrations/020_day8_superadmin_foundation.sql) (see [`APPLY_INSTRUCTIONS.md`](../supabase/migrations/APPLY_INSTRUCTIONS.md)).
2. Promote operator account:
   ```sql
   UPDATE public.profiles SET role = 'superadmin' WHERE id = '<auth-user-uuid>';
   ```
3. Ensure superadmin can re-authenticate via Supabase Auth (same email/password used at sudo gate).
4. Log in → `/superadmin` → complete sudo gate.

## Global settings

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /system/settings` | Public | `maintenance_mode`, `signup_open`, banner message |
| `GET /superadmin/system/settings` | Superadmin | Full settings incl. banner object |
| `PATCH /superadmin/system/settings` | Sudo + CSRF + reason | Toggle maintenance / signup |
| `POST /superadmin/notifications/system-banner` | Sudo + CSRF + reason | Set environment banner |
| `DELETE /superadmin/notifications/system-banner` | Sudo + CSRF + reason | Clear banner |

Customer effects:
- `maintenance_mode=true` → full-screen overlay in AppShell
- `signup_open=false` → `/signup` redirects to `/signup-closed`
- Banner message → top bar via `SystemBanner`

## Impersonation

1. `POST /superadmin/impersonate/{tenant_id}` with sudo + CSRF + reason → returns magic link
2. Open link in new tab — session runs as tenant admin
3. `GET /auth/me` returns `impersonating_tenant_id`, `impersonating_tenant_name`, `impersonation_session_id`
4. Customer UI shows amber `ImpersonationBanner`
5. Exit: `POST /superadmin/impersonate/stop` then sign out → return to `/superadmin/tenants`

## Emergency sudo lockout

If sudo sessions are compromised:

```sql
DELETE FROM public.sudo_sessions WHERE user_id = '<superadmin-uuid>';
```

All active sudo cookies become invalid; superadmin must re-authenticate.

## Common workflows

### Tenant / user lookup

- `GET /superadmin/tenants` — paginated list
- `GET /superadmin/tenants/{id}/debrief-status` — debrief delivery status
- `GET /superadmin/users?tenant_id=` — cross-tenant user search

### Billing ops (Razorpay)

- `GET /superadmin/billing/razorpay-status/{tenant_id}`
- `POST /superadmin/billing/manual-upgrade/{tenant_id}` — sudo + reason (≥10 chars)
- `POST /superadmin/billing/reconcile/{tenant_id}` — sudo + reason

Legacy `/admin/*` backend routes are **removed**; frontend redirects `/admin/*` → `/superadmin/*`.

### Cron health

- `GET /superadmin/system/cron-health` — reads `cron_runs` (includes `retention_cleanup`)
- `POST /superadmin/system/cron-run/{task_name}` — manual trigger (sudo + reason)

## Security checklist

- Non-superadmin → 404 on `/superadmin/*`
- `/superadmin/*` → `X-Robots-Tag: noindex, nofollow`
- Sudo TTL 15 minutes
- Mutations require `reason` (min 10 chars), CSRF, and audit via `record_operation`
- Destructive ops require exact `confirm` string match
- `operation_id` enables idempotent replays

## Verification

```bash
cd akara/backend
pytest tests/test_superadmin_auth.py tests/test_superadmin_sudo.py tests/test_superadmin_csrf.py tests/test_superadmin_mutations.py tests/test_superadmin_impersonate.py tests/test_system_settings.py tests/test_admin_billing.py -q

cd akara/frontend
npm run build
```

## Manual smoke (staging)

1. Non-superadmin → `/superadmin` shows NotFound shell
2. Superadmin → sudo gate → tenant list loads
3. PATCH maintenance → customer overlay appears
4. PATCH signup closed → `/signup` → `/signup-closed`
5. Impersonate → banner shows → exit works

## Incident response

1. **Maintenance:** PATCH `/superadmin/system/settings` `{ maintenance_mode: true }`
2. **Signup abuse:** PATCH `{ signup_open: false }`
3. **Billing mismatch:** Reconcile + Razorpay dashboard; document reason in audit
