# AKARA Migration Manifest — Phase 2

> **Last updated:** Sprint Phase 2, Days 1–9 completion (023 applied)  
> **Location:** `supabase/migrations/`

## Applied migrations (001–023)

| # | File | Day | Purpose |
|---|------|-----|---------|
| 001 | `001_initial_schema.sql` | 1 | Core tables: tenants, profiles, sales_data |
| 002 | `002_rls_policies.sql` | 1 | RLS helpers: `get_my_tenant_id()`, `is_admin()` |
| 003 | `003_functions.sql` | 1 | Utility functions |
| 004 | `004_competitive_additions.sql` | 1 | secondary_sales_data, scheme_master |
| 005 | `005_execute_tenant_query.sql` | 1 | Tenant-scoped SQL RPC |
| 006 | `006_update_tenant_config_rpc.sql` | 1 | Tenant config update RPC |
| 007 | `007_conversations.sql` | 1 | Copilot conversation persistence |
| 008 | `008_user_preferences.sql` | 1 | User notification preferences |
| 009 | `009_scheme_leakage_fn.sql` | 1 | Scheme leakage detection |
| 010 | `010_import_tracking.sql` | 1 | `import_id` on sales/import tables |
| 011 | `011_billing.sql` | 2 | Billing fields, import_jobs, usage_tracking, llm_cost_log, RPCs |
| 012 | `012_onboarding.sql` | 3 | Onboarding, marketing_emails, consent_log |
| 013 | `013_self_signup_profiles.sql` | 3 | Self-signup profile handling |
| 014 | `014_day4_copilot_feedback_conversations_import_jobs.sql` | 4 | copilot_feedback, async import_jobs columns |
| 015 | `015_billing_stripe_gst.sql` | 5 | billing_details, invoices, dunning_events |
| 016 | `016_billing_razorpay_provider.sql` | 5 | Razorpay provider columns |
| 017 | `017_alerts.sql` | 6 | Alerts tables and RLS |
| 018 | `018_day7_comms_teams_debrief.sql` | 7 | Team invites, debrief, WhatsApp prefs |
| 019 | `019_day7_gap_fixes.sql` | 7 | Day 7 gap fixes |
| 020 | `020_day8_superadmin_foundation.sql` | 8 | cron_runs, global_settings, superadmin audit |
| 021 | `021_sales_heatmap_fn.sql` | — | Sales heatmap KPI RPC |
| 022 | `022_tenant_companion_data.sql` | — | tenant_companion_data for auxiliary imports |
| 023 | `023_day9_founder_ai.sql` | 9 | broadcast_history, revenue_snapshots, founder_brief_runs |
| 024 | `024_broadcast_schedule.sql` | 9 | broadcast schedule columns, body persistence |
| 025 | `025_day10_omnipotence_1_4.sql` | 10 | plan_catalog, billing ledger, CMS, legal/consent |
| 026 | `026_day10_gap_closure.sql` | 10 | placement_events, plan_price_migrations, ledger evidence |
| 027 | `027_day10_finish.sql` | 10 | placement seeds, hero CMS normalize, legal metadata, contract fields |
| 028 | `028_connect_infrastructure.sql` | — | connections, mapping_memory, sync_log for Akara Connect |
| 029 | `029_import_preview_mapping.sql` | — | import_jobs 'preview'/'cancelled' status, import_mapping JSONB |

## Archived (superseded — not in CI sequence)

| File | Notes |
|------|-------|
| `_archive/011_billing_day2_delta.sql` | Legacy delta; superseded by full `011_billing.sql` |

## Roadmap (028+)

_No pending migrations._

1. **Immutable numbering** — never renumber applied migrations; add forward-only corrections.
2. **Transaction boundaries** — wrap DDL in `BEGIN; ... COMMIT;` when safe.
3. **RLS** — every new tenant-scoped table must enable RLS before deploy.
4. **SECURITY DEFINER** — always `SET search_path = public`.
5. **Grants** — service_role for backend writes; authenticated users via RLS only.
6. **Audit fields** — prefer `created_at` / `updated_at` on new tables.
7. **Soft delete** — use `deleted_at` where specified in later days.

## Pre-migration checklist

- [ ] Backup staging database (Supabase Dashboard → Database → Backups)
- [ ] Record backup timestamp in operator log
- [ ] Apply on **staging** first
- [ ] Run RLS verification queries below
- [ ] Apply on production only after staging gate passes

## Rollback policy

Migrations are **forward-only**. To undo a bad migration, create `NNN_fix_description.sql` — never edit applied files in place.
