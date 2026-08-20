# AKARA Backend

## Railway cron services

Scheduled tasks run as separate Railway services with **Root Directory = `backend`**, **Restart Policy = Never**, and env copied from the API service (Supabase, SendGrid, `BACKEND_SERVICE_KEY`, etc.).

### activation_emails

| Setting | Value |
|---------|-------|
| Config file | `backend/deploy/railway.activation_emails.json` |
| Schedule | `0 8 * * *` (daily at 08:00 UTC) |
| Start command | `/opt/venv/bin/python -m app.tasks.activation_emails` |
| Module | `app.tasks.activation_emails` |

Sends Day 7 phone nudges and Day 14 quota-warning emails to eligible tenants.

### retention_cleanup

| Setting | Value |
|---------|-------|
| Config file | `backend/deploy/railway.retention_cleanup.json` |
| Schedule | `30 20 * * *` (daily at 20:30 UTC) |
| Start command | `/opt/venv/bin/python -m app.tasks.retention_cleanup` |
| Module | `app.tasks.retention_cleanup` |

Enforces plan-based data retention by deleting expired sales rows per tenant.

### broadcast_scheduler

| Setting | Value |
|---------|-------|
| Schedule | `*/5 * * * *` (every 5 minutes) |
| Start command | `/opt/venv/bin/python -m app.tasks.broadcast_scheduler` |
| Module | `app.tasks.broadcast_scheduler` |

Delivers scheduled superadmin broadcasts from `broadcast_history` when `scheduled_at` is due.

### Local / one-off runs

```bash
cd backend
python -m app.tasks.activation_emails
python -m app.tasks.retention_cleanup
python -m app.tasks.retention_cleanup --dry-run
python -m app.tasks.broadcast_scheduler
```

## Verify via superadmin Cron UI

1. Sign in as a superadmin and open **Superadmin → Cron**.
2. Confirm `activation_emails` and `retention_cleanup` appear in the task table with last-run timestamps and status.
3. Enter a mutation reason (≥ 10 characters), then click **Run now** on the task.
4. Wait ~30 seconds and refresh — status should update to `ok` (or `partial` / `failed` with details).
5. Click **View logs** on the task to inspect recent `cron_runs` entries (emails sent, rows deleted, errors).

Manual runs write to the same `cron_runs` table as the Railway schedulers, so the Cron page reflects both scheduled and on-demand executions.
