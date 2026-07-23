# AKARA Phase 2 — Requirement Ledger

**Source of truth:** `docs2/sprint_phase2.md`  
**Schedule:** `docs2/daywise2.md` (14-day team execution plan)  
**Last updated:** Sprint Phase 2, Day 1

Columns: `source_ref` | `implementation_day` | `owner_lane` | `status` | `verification_method` | `evidence_link`

**Status legend:** `done` | `in_progress` | `pending` | `deferred` | `operator`

---

## Day 1 — Foundation (sprint §14 foundation + UI Bible 1.1–1.6 + shared contracts)

| source_ref | implementation_day | owner_lane | status | verification_method | evidence_link |
|------------|-------------------|------------|--------|---------------------|---------------|
| Day 1 — startup config validation | Day 1 | Backend/API | done | `pytest tests/test_config.py`; `/ready` probe | `backend/app/core/config.py`, `backend/app/main.py` |
| Day 1 — structured errors (APIError) | Day 1 | Backend/API | done | ruff + import smoke | `backend/app/core/errors.py` |
| Day 1 — pagination models | Day 1 | Backend/API | done | ruff + import smoke | `backend/app/core/pagination.py` |
| Day 1 — idempotency header validation | Day 1 | Backend/API | done | ruff; DB storage Day 2 | `backend/app/core/idempotency.py` |
| Day 1 — UTC/IST time utilities | Day 1 | Backend/API | done | ruff + unit tests Day 2 | `backend/app/core/time_utils.py` |
| Day 1 — X-Request-ID middleware | Day 1 | Backend/API | done | `test_health_response_has_x_request_id` | `backend/app/core/middleware.py` |
| Day 1 — OpenRouter-only LLM, date-pinned model | Day 1 | Backend/API | done | `test_version_endpoint`; manager unit tests | `backend/app/services/llm/manager.py` |
| Day 1 — `/health`, `/ready`, `/version` | Day 1 | Backend/API | done | `pytest tests/test_health.py` | `backend/app/api/routes/health.py` |
| Day 1 — migration manifest + conventions | Day 1 | Database/security | done | CI migrations job | `supabase/migrations/MIGRATION_MANIFEST.md` |
| Day 1 — 011_billing.sql scaffold | Day 1 | Database/security | done | CI migrations job; staging apply | `supabase/migrations/011_billing.sql` |
| UI Bible 1.1 — palette rationale | Day 1 | Customer frontend | done | visual review; gallery route | `frontend/src/index.css` |
| UI Bible 1.2 — color system tokens | Day 1 | Customer frontend | done | `@theme` in index.css | `frontend/src/index.css` |
| UI Bible 1.3 — typography (Plus Jakarta, Inter, JetBrains) | Day 1 | Customer frontend | done | index.html fonts | `frontend/index.html` |
| UI Bible 1.4 — component spec (button, card, badge) | Day 1 | Customer frontend | done | Vitest button tests; gallery | `frontend/src/components/ui/` |
| UI Bible 1.5 — toast / Sonner stack | Day 1 | Customer frontend | done | App.tsx Toaster mount | `frontend/src/components/ui/toast.tsx` |
| UI Bible 1.6 — loading skeletons | Day 1 | Customer frontend | done | ComponentGallery | `frontend/src/components/ui/skeleton.tsx` |
| Day 1 — SuperadminShell + admin primitives | Day 1 | Superadmin frontend | done | lazy route `/superadmin/*` | `frontend/src/components/admin/` |
| Day 1 — ComponentGallery (dev) | Day 1 | Superadmin frontend | done | `/gallery` in dev | `frontend/src/pages/gallery/ComponentGallery.tsx` |
| Day 1 — CI 5 jobs | Day 1 | QA/reliability | done | GitHub Actions on PR | `.github/workflows/ci.yml` |
| Day 1 — deterministic test fixtures | Day 1 | QA/reliability | done | conftest + fixtures.ts parity | `backend/tests/conftest.py`, `frontend/src/test/fixtures.ts` |
| Day 1 — Vitest + Playwright smoke | Day 1 | QA/reliability | done | `pnpm test --run`; playwright smoke | `frontend/e2e/smoke.spec.ts` |
| Day 1 — backend .env.example | Day 1 | Product/ops | done | file review | `backend/.env.example` |
| Day 1 — frontend .env.example | Day 1 | Product/ops | done | file review | `frontend/.env.example` |
| Day 1 — plan_catalog.md | Day 1 | Product/ops | done | file exists | `docs2/plan_catalog.md` |
| Day 1 — external_workstreams.md | Day 1 | Product/ops | done | file exists | `docs2/external_workstreams.md` |
| GAP-7 — Supabase connection pooling config | Day 1 | Database/security | in_progress | `/ready` + pooler URL in staging | `backend/app/core/config.py` |
| Bucket 3 — backend .env.example | Day 1 | Product/ops | done | file review | `backend/.env.example` |
| Bucket 3 — OpenAI model version pinned | Day 1 | Backend/API | done | `test_openrouter_model_is_date_pinned` | `backend/app/core/config.py` |

---

## Sprint §14 — Billing Infrastructure + Plan Enforcement

| source_ref | implementation_day | owner_lane | status | verification_method | evidence_link |
|------------|-------------------|------------|--------|---------------------|---------------|
| 14.1 — Migration billing schema | Day 2 | Database/security | pending | migration apply + RLS tests | `011_billing.sql` (scaffold Day 1) |
| 14.2 — plan_limits.py | Day 2 | Backend/API | pending | unit tests | — |
| 14.3 — plan_guard.py | Day 2 | Backend/API | pending | integration tests | — |
| 14.4 — Wire PlanGuard into routes | Day 2 | Backend/API | pending | route tests | — |
| 14.5 — TenantContext plan + overrides | Day 2 | Backend/API | pending | auth tests | — |
| 14.6 — GET /billing/usage | Day 2 | Backend/API | pending | API test | — |
| 14.7 — Data retention enforcement | Day 2 | Backend/API | pending | cron + tests | — |
| 14.8 — Token cost tracking (llm_cost_log) | Day 2 | Backend/API | pending | cost log insert test | `011_billing.sql` table |
| Day 14 Quality Gate | Day 2 | QA/reliability | pending | pytest + staging | — |

---

## Sprint §15 — Landing + Sign-up + Auth

| source_ref | implementation_day | owner_lane | status | verification_method | evidence_link |
|------------|-------------------|------------|--------|---------------------|---------------|
| 15.1 — tenant auto-provision on signup | Day 3 | Backend/API | pending | signup integration test | — |
| 15.2 — LandingPage.tsx full spec | Day 3 | Customer frontend | pending | E2E + axe | — |
| Day 15 Quality Gate | Day 3 | QA/reliability | pending | E2E signup flow | — |

---

## Sprint §16 — Usage UI + Plan Gates + Upgrade

| source_ref | implementation_day | owner_lane | status | verification_method | evidence_link |
|------------|-------------------|------------|--------|---------------------|---------------|
| 16.1 — useBilling.ts | Day 4 | Customer frontend | pending | hook tests | — |
| 16.2 — UsageBanner.tsx | Day 4 | Customer frontend | pending | component test | — |
| 16.3 — PlanGate.tsx | Day 4 | Customer frontend | pending | component test | — |
| 16.4 — Apply PlanGate to pages | Day 4 | Customer frontend | pending | E2E locked states | — |
| 16.5 — UpgradePage.tsx | Day 4 | Customer frontend | pending | E2E | — |
| 16.6 — BillingPage.tsx | Day 4 | Customer frontend | pending | E2E | — |
| 16.7 — /billing in Settings nav | Day 4 | Customer frontend | pending | nav test | — |
| Day 16 Quality Gate | Day 4 | QA/reliability | pending | quota E2E | — |

---

## Sprint §17 — Superadmin Panel

| source_ref | implementation_day | owner_lane | status | verification_method | evidence_link |
|------------|-------------------|------------|--------|---------------------|---------------|
| 17.1 — Superadmin role architecture | Day 8 | Backend/API | pending | auth tests | — |
| 17.2 — Complete Superadmin API | Day 8 | Backend/API | pending | API contract tests | — |
| 17.3 — cron_runs table | Day 8 | Database/security | pending | migration apply | — |
| 17.4 — global_settings table | Day 8 | Database/security | pending | migration apply | — |
| 17.5 — SuperAdminPage.tsx UI | Day 8 | Superadmin frontend | pending | E2E all tabs | — |
| 17.6 — Superadmin AI Briefing | Day 9 | Superadmin frontend | pending | cron + copilot test | — |
| 17.7 — Founder Omnipotence 15 gaps | Day 9–10 | Superadmin frontend | pending | sudo + audit tests | — |
| 17.8 — Superadmin IA | Day 8 | Superadmin frontend | in_progress | shell placeholder Day 1 | `SuperadminShell.tsx` |
| Day 17 Quality Gate | Day 10 | QA/reliability | pending | full superadmin E2E | — |

### OMNIPOTENCE GAP 1–15

| source_ref | implementation_day | owner_lane | status | verification_method | evidence_link |
|------------|-------------------|------------|--------|---------------------|---------------|
| OMNIPOTENCE GAP 1/15 — Dynamic plans/prices | Day 9 | Superadmin frontend | pending | API + UI test | — |
| OMNIPOTENCE GAP 2/15 — Billing operations | Day 9 | Superadmin frontend | pending | Stripe test mode | — |
| OMNIPOTENCE GAP 3/15 — Landing CMS + ad slots | Day 9 | Superadmin frontend | pending | CMS CRUD test | — |
| OMNIPOTENCE GAP 4/15 — Legal docs + consent | Day 9 | Product/ops | pending | version audit | — |
| OMNIPOTENCE GAP 5/15 — Safe universal data studio | Day 10 | Superadmin frontend | pending | allowlist test | — |
| OMNIPOTENCE GAP 6/15 — Query console + runbooks | Day 10 | Superadmin frontend | pending | guarded SQL test | — |
| OMNIPOTENCE GAP 7/15 — LLM control room | Day 10 | Superadmin frontend | pending | model switch test | — |
| OMNIPOTENCE GAP 8/15 — Template control | Day 10 | Superadmin frontend | pending | template preview | — |
| OMNIPOTENCE GAP 9/15 — Integration kill switches | Day 10 | Superadmin frontend | pending | kill switch test | — |
| OMNIPOTENCE GAP 10/15 — Feature flags + experiments | Day 10 | Superadmin frontend | pending | flag rollout test | — |
| OMNIPOTENCE GAP 11/15 — Auth/signup policy | Day 10 | Backend/API | pending | abuse test | — |
| OMNIPOTENCE GAP 12/15 — Support desk + recovery | Day 10 | Superadmin frontend | pending | impersonate audit | — |
| OMNIPOTENCE GAP 13/15 — Backup/restore/portability | Day 10 | Database/security | pending | restore drill | — |
| OMNIPOTENCE GAP 14/15 — Jobs/queues/webhooks | Day 10 | Backend/API | pending | queue monitor | — |
| OMNIPOTENCE GAP 15/15 — Governance + rollback | Day 10 | Superadmin frontend | pending | approval workflow | — |

---

## Sprint §18–§22 — Stripe, Security, WhatsApp, Revenue, Launch

| source_ref | implementation_day | owner_lane | status | verification_method | evidence_link |
|------------|-------------------|------------|--------|---------------------|---------------|
| 18.1–18.4 — Stripe integration | Day 5 | Backend/API | pending | webhook test | — |
| Day 18 Quality Gate | Day 5 | QA/reliability | pending | checkout E2E | — |
| 19.1 — Rate limiting (slowapi) | Day 6 | Backend/API | pending | load test | — |
| 19.2 — HTTP security headers | Day 6 | Backend/API | pending | header scan | — |
| 19.3 — PII redaction before LLM | Day 6 | Backend/API | pending | redaction unit test | — |
| Day 19 Quality Gate | Day 6 | QA/reliability | pending | security audit | — |
| 20.1–20.5 — WhatsApp + team invites | Day 7 | Backend/API | pending | Zaptilo sandbox | — |
| 20.6 — Weekly Debrief engine | Day 7 | Backend/API | pending | cron + email test | — |
| Day 20 Quality Gate | Day 7 | QA/reliability | pending | debrief E2E | — |
| 21.1 — Revenue dashboard | Day 11 | Superadmin frontend | pending | MRR chart test | — |
| 21.2 — Impersonate | Day 11 | Superadmin frontend | pending | audit log test | — |
| Day 21 Quality Gate | Day 11 | QA/reliability | pending | impersonate E2E | — |
| 22.1–22.4 — API keys + PostHog + 500 page | Day 12–13 | Backend/API | pending | integration tests | — |
| Day 22 Quality Gate | Day 14 | QA/reliability | pending | production checklist | — |
| Day 22 Production Readiness Checklist | Day 14 | Product/ops | pending | manual sign-off | `sprint_phase2.md` §5163 |

---

## GAP 1–13 (launch blockers / high priority)

| source_ref | implementation_day | owner_lane | status | verification_method | evidence_link |
|------------|-------------------|------------|--------|---------------------|---------------|
| GAP 1 — GST invoicing | Day 5 | Backend/API | pending | invoice PDF test | — |
| GAP 2 — Async large file imports | Day 6 | Backend/API | pending | job queue test | — |
| GAP 3 — Empty state components | Day 4 | Customer frontend | pending | empty state E2E | — |
| GAP 4 — Activation email sequence | Day 7 | Backend/API | pending | email trigger test | — |
| GAP 5 — Bot prevention (Turnstile) | Day 3 | Backend/API | pending | signup CAPTCHA test | — |
| GAP 6 — LLM downtime degradation | Day 6 | Backend/API | pending | fault injection | — |
| GAP 7 — Supabase connection pooling | Day 1 | Database/security | in_progress | pooler + `/ready` | `config.py`, EXT-1 |
| GAP 8 — Cron job health monitoring | Day 7 | Backend/API | pending | healthchecks ping | — |
| GAP 9 — Copilot feedback loop | Day 11 | Customer frontend | pending | thumbs up/down test | — |
| GAP 10 — Data provenance on answers | Day 11 | Customer frontend | pending | citation UI test | — |
| GAP 11 — Superadmin re-authentication | Day 8 | Backend/API | pending | sudo cookie test | — |
| GAP 12 — Payment dunning sequence | Day 5 | Backend/API | pending | webhook sequence | — |
| GAP 13 — robots.txt + sitemap.xml | Day 3 | Customer frontend | pending | crawler test | — |

---

## Bucket 3 — Polish (10 rows)

| source_ref | implementation_day | owner_lane | status | verification_method | evidence_link |
|------------|-------------------|------------|--------|---------------------|---------------|
| Backup strategy documented | Day 14 | Product/ops | pending | restore drill | MIGRATION_MANIFEST |
| Staging environment | Day 1 | Product/ops | operator | EXT-13/14 | `external_workstreams.md` |
| backend .env.example | Day 1 | Product/ops | done | file review | `backend/.env.example` |
| UptimeRobot setup | Day 14 | Product/ops | operator | EXT-12 | — |
| PDF export debrief/reports | post-launch | Backend/API | deferred | PDF generation | — |
| 404 page | Day 3 | Customer frontend | pending | E2E 404 | smoke.spec.ts partial |
| OpenAI model pinned | Day 1 | Backend/API | done | test_config | `config.py` |
| Favicon + OG tags | Day 3 | Customer frontend | pending | meta tag audit | — |
| Content-Security-Policy header | Day 6 | Backend/API | pending | header scan | — |
| Import job failure notification | Day 6 | Backend/API | pending | email on fail | — |

---

## Pages P1–P20

| source_ref | implementation_day | owner_lane | status | verification_method | evidence_link |
|------------|-------------------|------------|--------|---------------------|---------------|
| P1 — Landing Page | Day 3 | Customer frontend | pending | E2E + Lighthouse | — |
| P2 — Sign Up | Day 3 | Customer frontend | pending | E2E signup | — |
| P3 — Email Verification Pending | Day 3 | Customer frontend | pending | E2E | — |
| P4 — Forgot Password | Day 3 | Customer frontend | pending | E2E | — |
| P5 — Reset Password | Day 3 | Customer frontend | pending | E2E | — |
| P6 — Login Page | Day 1 (Phase 1) | Customer frontend | done | smoke.spec.ts | existing LoginPage |
| P7 — Onboarding | Day 4 | Customer frontend | pending | E2E wizard | — |
| P8 — Dashboard | Phase 1 | Customer frontend | done | existing tests | — |
| P9 — Copilot | Phase 1 | Customer frontend | done | existing tests | — |
| P10 — Data Page | Phase 1 + data plan | Customer frontend | done | import tests | — |
| P11 — Copilot mobile | Day 4 | Customer frontend | pending | responsive E2E | — |
| P12 — Reports | Phase 1 | Customer frontend | done | existing | — |
| P13 — Simulator | Phase 1 | Customer frontend | done | existing | — |
| P14 — Settings | Day 4 | Customer frontend | pending | billing nav | — |
| P15 — Billing Page | Day 4 | Customer frontend | pending | E2E | — |
| P16 — Upgrade Page | Day 4 | Customer frontend | pending | E2E | — |
| P17 — 404 Not Found | Day 3 | Customer frontend | pending | smoke.spec.ts | — |
| P18 — 500 Server Error | Day 13 | Customer frontend | pending | error boundary test | — |
| P19 — Password Reset Landing | Day 3 | Customer frontend | pending | E2E | — |
| P20 — Privacy + Terms | Day 3 | Product/ops | pending | legal review | — |

---

## Email templates E1–E11

| source_ref | implementation_day | owner_lane | status | verification_method | evidence_link |
|------------|-------------------|------------|--------|---------------------|---------------|
| E1 — Welcome / Verification | Day 3 | Product/ops | pending | SendGrid preview | — |
| E2 — Password reset | Day 3 | Backend/API | pending | email trigger | — |
| E3 — Weekly debrief | Day 7 | Backend/API | pending | cron email | — |
| E4 — Daily morning brief | Day 7 | Backend/API | pending | cron email | — |
| E5 — Payment failed | Day 5 | Backend/API | pending | webhook trigger | — |
| E6 — Payment successful / Invoice | Day 5 | Backend/API | pending | Stripe test | — |
| E7 — Plan downgrade | Day 5 | Backend/API | pending | dunning test | — |
| E8 — Activation Day 1 | Day 7 | Backend/API | pending | cron trigger | — |
| E9 — Activation Day 3 | Day 7 | Backend/API | pending | cron trigger | — |
| E10 — Quota warning 80% | Day 4 | Backend/API | pending | usage threshold | — |
| E11 — Team invite | Day 7 | Backend/API | pending | invite flow | — |

---

## WhatsApp templates W1–W4

| source_ref | implementation_day | owner_lane | status | verification_method | evidence_link |
|------------|-------------------|------------|--------|---------------------|---------------|
| W1 — Weekly brief | Day 7 | Product/ops | operator | EXT-3 template approval | — |
| W2 — Morning brief | Day 7 | Product/ops | operator | EXT-3 | — |
| W3 — Alert notification | Day 7 | Product/ops | operator | EXT-3 | — |
| W4 — Plan upgrade confirmation | Day 5 | Product/ops | operator | EXT-3 | — |

---

## Promotional Slots A–O

| source_ref | implementation_day | owner_lane | status | verification_method | evidence_link |
|------------|-------------------|------------|--------|---------------------|---------------|
| SLOT A — Landing banner | Day 3 | Customer frontend | pending | dismiss tracking | — |
| SLOT B — Landing feature spotlight | Day 3 | Customer frontend | pending | dismiss tracking | — |
| SLOT C — Landing email capture | Day 3 | Customer frontend | pending | form submit | — |
| SLOT D — Dashboard welcome card | Day 4 | Customer frontend | pending | first-visit test | — |
| SLOT E — WhatsApp nudge | Day 7 | Customer frontend | pending | settings test | — |
| SLOT F — Copilot demo video | Day 4 | Customer frontend | pending | visit count | — |
| SLOT G — Data Pro upsell | Day 4 | Customer frontend | pending | free user test | — |
| SLOT H — Billing upgrade nudge | Day 4 | Customer frontend | pending | quota test | — |
| SLOT I — Onboarding team invite | Day 4 | Customer frontend | pending | onboarding E2E | — |
| SLOT J — Reports scheme teaser | Day 8 | Customer frontend | pending | pro user test | — |
| SLOT K — Settings WhatsApp nudge | Day 7 | Customer frontend | pending | free user test | — |
| SLOT L — Copilot quota exhausted | Day 4 | Customer frontend | pending | quota E2E | — |
| SLOT M — Sidebar plan badge link | Day 4 | Customer frontend | pending | nav click | — |
| SLOT N — Email quota warning (E10) | Day 4 | Backend/API | pending | email trigger | — |
| SLOT O — Activation emails (E8/E9) | Day 7 | Backend/API | pending | cron | — |

---

## UI Bible §1.7–§11 (remaining design system)

| source_ref | implementation_day | owner_lane | status | verification_method | evidence_link |
|------------|-------------------|------------|--------|---------------------|---------------|
| UI Bible §2 — Every Page spec | Day 3–13 | Customer frontend | pending | page-by-page E2E | — |
| UI Bible §3 — Email visual spec | Day 3–7 | Product/ops | pending | template review | — |
| UI Bible §4 — WhatsApp visual spec | Day 7 | Product/ops | pending | template review | — |
| UI Bible §5 — AppShell navigation | Day 4 | Customer frontend | pending | nav E2E | — |
| UI Bible §6 — Superadmin panel UI | Day 8–10 | Superadmin frontend | in_progress | shell Day 1 | `SuperadminShell.tsx` |
| UI Bible §7 — Demo video spec | Day 3 | Product/ops | pending | asset review | — |
| UI Bible §8 — Promotional slots map | Day 3–7 | Customer frontend | pending | slot tests | — |
| UI Bible §9 — Accessibility checklist | Day 1+ | QA/reliability | in_progress | axe in E2E | `e2e/smoke.spec.ts` |
| UI Bible §10 — Performance checklist | Day 14 | QA/reliability | pending | Lighthouse CI | — |
| UI Bible §11 — Pitchability checklist | Day 14 | Product/ops | pending | demo script | — |

---

## Weekly Debrief specification

| source_ref | implementation_day | owner_lane | status | verification_method | evidence_link |
|------------|-------------------|------------|--------|---------------------|---------------|
| Weekly Debrief — engine + cron | Day 7 | Backend/API | pending | cron + DB row | — |
| Weekly Debrief — email delivery | Day 7 | Backend/API | pending | SendGrid test | — |
| Weekly Debrief — WhatsApp delivery | Day 7 | Backend/API | pending | Zaptilo test | — |
| Weekly Debrief — in-app archive | Day 7 | Customer frontend | pending | /debrief route | — |
| Weekly Debrief — Settings toggles | Day 7 | Customer frontend | pending | settings E2E | — |

---

## External workstreams (operator — not code)

| source_ref | implementation_day | owner_lane | status | verification_method | evidence_link |
|------------|-------------------|------------|--------|---------------------|---------------|
| EXT-1 — India Supabase staging + pooler | Day 1 | operator | pending | `/ready` green | `external_workstreams.md` |
| EXT-2 — Stripe test products | Day 4 | operator | pending | checkout test | — |
| EXT-3 — Zaptilo WhatsApp (start Day 1) | Day 1 | operator | pending | template approval | — |
| EXT-4 — Turnstile keys | Day 2 | operator | pending | signup CAPTCHA | — |
| EXT-5–15 — PostHog, GST, legal, DNS, etc. | Day 1–14 | operator | pending | per EXT doc | `external_workstreams.md` |

---

## Coverage assertion

This ledger maps every major source section in `sprint_phase2.md` §14.1–22.5, all quality gates, GAP 1–13, 10 Bucket 3 polish rows, OMNIPOTENCE GAP 1–15, P1–P20, E1–E11, W1–W4, Slots A–O, Weekly Debrief, and UI Bible 1–11. Day 1 deliverables are marked `done` or `in_progress`; all future sprint days are `pending`.
