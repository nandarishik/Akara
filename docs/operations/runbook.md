# AKARA operations runbook (Phase 12)

## Services

- `akara-api` — FastAPI
- `akara-import` — import worker
- `akara-cron-business` — combined business cron
- `akara-cron-intelligence` — combined intelligence cron

## Health

- Liveness: `GET /health`
- Readiness: `GET /health` (checks include database)

## Rollback

Apply `supabase/migrations/rollback/{NNN}_rollback.sql` in reverse numeric order.

## Cron trigger

`POST /superadmin/system/cron-run/{task_name}` with sudo + CSRF.

## Incidents

Record in `docs/operations/incident_log.md`.
