# Backup and restore runbook (Phase 3)

## Retention

| Environment | Backup | Notes |
|---|---|---|
| `akara-production` | PITR, **7 days** | Enable PITR in Supabase dashboard (OQ-P03-004 if billing blocks) |
| `akara-staging` | Daily backups ~**5 days** | Use for restore drills |
| `akara-dev` | No PITR required | Recover by re-running `backend/scripts/seed_dev_data.py` |

Never load production dumps into lower environments. Never commit dump files or production PII to git.

## Restore drill procedure (staging)

SLA: complete in **&lt; 30 minutes**.

1. Create a temporary Supabase project `akara-restore-test` (same region as staging if possible).
2. From staging: either PITR/restore into the scratch project, or schema-only restore + confirm migrations 001–029 apply cleanly.
3. Verify `deployment_events` exists and RLS is not tenant-scoped on that table (service role only).
4. Insert a staging audit row (service role REST or SQL):

```sql
INSERT INTO deployment_events (
  environment, event_type, git_sha, actor, service_name, status, metadata
) VALUES (
  'staging',
  'restore_drill',
  '<git_sha>',
  '<operator>',
  'akara-api',
  'succeeded',  -- or 'failed'
  '{"sla_minutes": <n>, "scratch_project": "akara-restore-test"}'::jsonb
);
```

5. Delete the scratch project `akara-restore-test`.
6. Record result in `docs/Dev-plans/session-handoff-p03-dev2.md`: `RESTORE_DRILL=succeeded|failed` and elapsed minutes.

## This phase’s drill result

| Field | Value |
|---|---|
| `RESTORE_DRILL` | **failed** — BLOCKED: no staging Supabase / disposable DB on this host (2026-09-19) |
| Elapsed minutes | N/A |
| Scratch project | Not created |
| Follow-up | Re-run when `akara-staging` exists; update this section + handoff |

## Operators

- Production PITR and live restore: only with dual approval; never copy prod data into `akara-dev`.
- Deliver project refs and service roles to DEV1 **out of band** — never commit them.
