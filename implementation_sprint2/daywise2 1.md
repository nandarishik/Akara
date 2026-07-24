# AKARA Sprint Phase 2 — Complete 14-Day Team Execution Plan

## Final schedule

The complete scope of `sprint_phase2.md` is divided into **14 equal team work splits**.

This is not a one-person estimate. Each “day” is a coordinated execution block completed by parallel specialists. At the end of Day 14, every launch requirement in `sprint_phase2.md` must be implemented, tested, deployed, and documented.

## Team model required

Run these lanes in parallel every day:

1. **Backend/API lane** — FastAPI, services, jobs, provider integrations.
2. **Database/security lane** — migrations, RLS, tenancy, audit, retention, recovery.
3. **Customer frontend lane** — public site, authenticated product, responsive UX.
4. **Superadmin frontend lane** — founder control plane and operational tooling.
5. **QA/reliability lane** — automated tests, E2E, accessibility, performance, fault injection.
6. **Product/content/operations lane** — copy, templates, demo assets, legal/DPDP, provider setup, runbooks.

Work may move between lanes, but no requirement may be dropped. If a lane finishes early, it helps the day’s critical path or test backlog.

## Meaning of “equal split”

Each day contains:

- one database/backend deliverable;
- one customer-facing deliverable;
- one founder/operations deliverable;
- one test/security deliverable;
- one content/provider/manual deliverable;
- a deployable end-of-day integration gate.

The exact line count differs, but each day is intended to consume approximately the same total team capacity.

## Non-negotiable implementation rule

`sprint_phase2.md` remains the canonical specification for exact:

- code and schemas;
- prices, quotas, retention periods, and plan behavior;
- routes, fields, buttons, links, copy, and validation;
- loading, empty, success, failure, locked, and responsive states;
- email and WhatsApp templates;
- security, DPDP, audit, reauthentication, and tenant isolation;
- superadmin APIs, tabs, controls, confirmations, and rollback behavior;
- accessibility, performance, demo, promotional-slot, and pitchability requirements.

When this plan assigns a source section to a day, **every paragraph, bullet, table row, code block, endpoint, field, UI state, breakpoint, test, and quality-gate item in that source section is included**.

Later and safer requirements override earlier simplified examples. In particular:

- superadmin sudo must be server-validated, not trusted from `localStorage`;
- secrets are write-only and never returned to the browser;
- arbitrary database writes are replaced by allowlisted forms and guarded runbooks;
- financial/external actions are never falsely marked reversible;
- backend authorization is mandatory even when frontend controls are hidden or disabled.

## End-of-day gate applied every day

Before a day is complete:

- backend lint, type checks, unit tests, and relevant integration tests pass;
- frontend lint, type checks, component tests, and relevant E2E tests pass;
- new migrations apply cleanly to a populated staging database;
- happy, empty, loading, validation, network, provider-failure, unauthorized, and retry states are tested;
- tenant isolation and role/plan enforcement are tested for touched resources;
- mutations are idempotent and audited where applicable;
- mobile, keyboard, focus, screen-reader, and reduced-motion behavior are checked for touched UI;
- `.env.example`, API schemas, fixtures, runbooks, and provider instructions are updated;
- the integrated staging deployment is green.

---

# Day 1 — Foundation, environments, design system, and shared contracts

## Backend/API lane

- Inventory all existing Days 1–13 APIs, services, tests, and integration contracts.
- Add startup configuration validation for Supabase, pooler, OpenAI, Stripe, SendGrid, Zaptilo, Sentry, PostHog, Turnstile, health checks, GST/company information, and frontend URLs.
- Pin the OpenAI model version.
- Establish shared structured errors, pagination, idempotency keys, request IDs, and UTC/IST time utilities.

## Database/security lane

- Verify migrations 001–009 and produce the complete Phase 2 migration manifest.
- Create a separate India-region Supabase staging project.
- Configure Supabase transaction-mode pooler and test compatibility.
- Establish migration conventions, RLS test helpers, audit conventions, soft-delete conventions, and backup-before-migration procedure.
- Begin `010_billing.sql` foundation needed by Day 2.

## Customer frontend lane

Implement UI Bible 1.1–1.6:

- full violet/orange/amber brand, surfaces, text, semantics, and chart palette;
- Tailwind colors, shadows, fonts, and animations;
- Plus Jakarta Sans, Inter, and JetBrains Mono typography;
- all button variants;
- base, KPI, plan, and locked cards;
- plan, status, and change badges;
- accessible inputs, selects, textareas, checkboxes, helper/error text;
- press, hover, number, page, skeleton, and streaming animations;
- toast stack;
- reusable page/table/chart/message/upload skeletons.

## Superadmin frontend lane

- Create separate dark-theme token system for superadmin.
- Establish route-level lazy loading and a protected superadmin shell placeholder.
- Implement shared admin table, filter, pagination, drawer, confirmation, impact-preview, operation-result, and audit-link components.

## QA/reliability lane

- Build requirement ledger covering 14.1–22.5, every quality gate, GAP 1–13, all 10 polish rows, OMNIPOTENCE GAP 1–15, P1–P20, E1–E11, W1–W4, Slots A–O, and UI Bible 1–11.
- Configure backend, frontend, E2E, accessibility, visual snapshot, Lighthouse, and tenant-isolation CI jobs.
- Seed deterministic Free, Pro, Business, past-due, empty, populated, and superadmin staging accounts.

## Product/content/operations lane

- Create staging Railway and Vercel environments with separate provider test credentials.
- Create complete `.env.example`.
- Confirm canonical pricing/limits table and factual competitor positioning.
- Start GST/accountant, legal/DPDP, WhatsApp BSP/template, DNS, and subprocessor/DPA workstreams.

## Day 1 completion gate

- Clean staging setup works from documentation.
- Shared UI component gallery passes accessibility checks.
- Requirement ledger has no unowned source section.
- Source coverage: prerequisites, Competitive Intelligence, Pricing, Production AI SaaS Standards, DPDP overview, UI Bible 1.1–1.6, Bucket 3 staging/env/model items.

---

# Day 2 — Billing infrastructure, plans, quotas, retention, and LLM cost

## Backend/API lane

Implement source 14.2–14.6:

- `plan_limits.py`;
- `plan_guard.py`;
- guards for copilot, imports, undo, reports, simulator, alerts, briefs, API push, Tally, team, and API keys;
- TenantContext plan/status/overrides;
- atomic monthly and daily counters;
- `GET /billing/usage`;
- structured HTTP 402 responses;
- correct month/day reset in IST;
- dashboard/allowed features remain usable at copilot hard limit.

## Database/security lane

Implement source 14.1, 14.7, and 14.8:

- complete `010_billing.sql`;
- tenant billing fields and indexes;
- `usage_tracking`;
- import batch/undo fields;
- LLM cost log;
- all constraints, RPCs, indexes, grants, and RLS;
- Free 30-day, Pro 12-month, and Business 36-month retention;
- idempotent retention cron with dry-run, legal-hold awareness, row counts, and audit;
- token/cost records by tenant, user, request, model, and feature.

## Customer frontend lane

- Implement typed billing/usage client and React Query hook.
- Build shared usage progress bars, daily counters, plan badge, quota warning, trial warning, and past-due banner.
- Add 80%, 90%, and 100% states with exact reset/upgrade messaging.
- Ensure all commercial UI consumes authoritative backend/catalog data, not duplicated constants.

## Superadmin frontend lane

- Build temporary read-only cost/usage diagnostic views for implementation validation.
- Show tenant plan, effective limits, overrides, monthly counters, token cost, and retention cutoff.

## QA/reliability lane

- Test every plan/feature/quota combination.
- Test unlimited, missing usage row, date rollover, override, cancellation, past-due grace, concurrency, undo, and rejected-action non-increment.
- Test retention boundaries and LLM cost calculations.
- Execute all Day 14 Quality Gate checks.

## Product/content/operations lane

- Document plan promises, retention, margin assumptions, and quota support scenarios.
- Configure pooler URL in every environment.
- Prepare healthchecks.io entries for retention and cost aggregation jobs.

## Day 2 completion gate

- Every resource-consuming action is guarded server-side.
- Every LLM call is attributable.
- Billing migration and Day 14 Quality Gate are green.
- Source coverage: Day 14 sections 14.1–14.8, Production AI Standards, GAP 7, relevant Pricing rows.

---

# Day 3 — Landing page, public conversion, authentication, and onboarding

## Backend/API lane

- Implement source 15.1 tenant auto-provisioning.
- Make signup provisioning transactional/idempotent with unique slug, admin profile, defaults, sample-data option, and onboarding events.
- Add verification resend, forgot/reset password support, Turnstile verification, disposable-domain checks, email-capture endpoint with honeypot, and onboarding-complete endpoint.
- Prevent client-selected elevated role, paid plan, or foreign tenant.

## Database/security lane

- Store independent Terms/Privacy and AI-processing consent versions/evidence.
- Add marketing email table with minimal data and suppression.
- Add signup abuse policies and indexes required by the day.
- Ensure auth callbacks, invite/reset tokens, and provisioning obey tenant and replay protections.

## Customer frontend lane

Implement Day 15 and UI Bible P1–P7/P19:

- complete Landing Page sections, exact hero, social proof, pain story, demonstrations, pricing, FAQ, final CTA, contact/footer;
- SEO title/description/canonical/Open Graph/Twitter/JSON-LD;
- responsive public nav and mobile landing behavior;
- Demo Slots 1–2 and landing Slots A–C;
- Sign Up with all fields, password strength, WhatsApp, two separate consents, Turnstile, social proof, and every error state;
- Email Verification with resend timer and cross-device callback;
- Forgot Password;
- Reset Password valid/expired/success states;
- Login desktop/mobile split and every authentication error;
- three-step Onboarding wizard with business details, import/sample data, progress, completion, and Slot I.

## Superadmin frontend lane

- Add read-only signup funnel and provisioning failure diagnostics.
- Add ability to inspect a newly provisioned tenant without exposing secrets.

## QA/reliability lane

- E2E landing → signup → verify → onboarding → dashboard for real import and sample-data paths.
- Test duplicate signup, provider/network failure, bot, disposable email, invalid/reused/expired token, cross-device callback, lockout, unverified login, and open redirects.
- Validate all public mobile/tablet/desktop breakpoints.
- Run Day 15 Quality Gate.

## Product/content/operations lane

- Finalize accurate landing copy, FireAI factual comparison, Ocheto complementary pitch, FAQs, legal links, contact details, and social proof.
- Add favicon, Apple icon, OG asset, `robots.txt`, and `sitemap.xml`.
- Prepare Cookie/analytics notice wording.

## Day 3 completion gate

- A new customer can discover, understand, register, verify, onboard, and enter the product without support.
- Source coverage: Day 15 15.1–15.2, P1–P7, P19, GAP 5, GAP 13, competitor positioning, landing demo/ad/mobile specs.

---

# Day 4 — Customer application + 🔵 AKARA Blue UI Rehaul: AppShell, Dashboard, Copilot, Data, Reports, and Simulator

> **UI REHAUL DAY.** Every frontend component built today uses the navy-to-electric-blue design system.
> Reference: `akara/implentation/uirehaulday4.md` for exact specifications.
> The visual target is the FireAI compliance section: deep navy canvas, blue glass cards, electric blue accents.

## Backend/API lane

- Complete Dashboard data/range APIs and sample-data reseed.
- Complete conversation list/rename/delete and streaming copilot contracts.
- Implement copilot graceful degradation for 429, provider 5xx, timeout, malformed response, and interrupted stream without charging quota.
- Add feedback endpoint and provenance fields: safe SQL/fingerprint, row count, date range, freshness.
- Implement async import API, private source storage, job status, retry/cancel, and pending-job lookup.
- Complete report/simulator APIs and plan enforcement.

## Database/security lane

- Add `import_jobs`, feedback records, conversation metadata, provenance metadata, and required indexes/RLS.
- Build idempotent import worker with claim lock, heartbeat, progress, timeout, retry, dead-letter, cleanup, and no duplicate rows.
- Verify data undo, job, conversation, feedback, and report isolation.

## Customer frontend lane — 🔵 UI REHAUL

### Foundation (do first — everything else builds on this)

- Set up Tailwind blue scale tokens (950→50): NO grays, NO pure blacks, ALL navy-blue tinted;
- Install `framer-motion`, `@fontsource/plus-jakarta-sans`, `@fontsource/inter`, `@fontsource/jetbrains-mono`;
- Create CSS custom properties: `--gradient-brand`, `--surface-*`, `--glass-*`, `--accent-*`, `--text-*`;
- Create `GradientMesh.tsx`: animated background (`#020B18` base + drifting royal-blue/cyan orbs + noise);
- Create `LiquidGlassCard.tsx`: navy glass container (`rgba(15,52,96,0.4)` + blue border + backdrop-blur + hover glow);
- Create `GlowKPICard.tsx` + `AnimatedNumber.tsx`: navy glass with blue left-bar, count-up animation, DeltaBadge;
- Create `GradientButton.tsx` + `SecondaryButton`: blue gradient CTA (`#1565C0` → `#42A5F5`);
- Create `ShimmerSkeleton.tsx`: blue shimmer on navy glass (KPI/Chart/Table variants);
- Create `EmptyState.tsx`: blue gradient glow behind icon, gradient heading, GradientButton;
- Create `springs.ts`: Framer Motion spring configs (snappy/gentle/bouncy/smooth), stagger delays.

### Pages (use the foundation components)

- AppShell: navy glass sidebar (`bg-[#051B37]/90`), mobile drawer, 5-tab bottom bar with blue glow active state, role/plan navigation;
- Dashboard "Mission Control": GlowKPICards with AnimatedNumber, blue gradient AreaCharts in LiquidGlassCards, loading/empty/stale states, outstanding table, Slots D/E;
- Copilot "AI Studio": navy glass AI bubbles with electric blue left-border, user messages in blue gradient, streaming with blinking cursor, feedback buttons, provenance in monospace, error states, conversation sidebar, Slots F/L;
- Data "Import Command Center": blue gradient border upload zones with 6 states (idle/drag/uploading/processing/success/error), async job polling, import history in navy glass table, daily counters, Slot G;
- Reports "Intelligence Station": route performance with blue gradient charts, scheme leakage stunning navy glass gate (blur + lock + blue glow + gradient text + GradientButton), Slot J;
- Simulator "What-If Machine": navy glass gate for free plan, Pro/Business 3-panel with blue gradient sliders and animated projections.

## Superadmin frontend lane

- Add import-job and copilot-quality staging diagnostics needed by QA.
- Add failed-job retry and answer/feedback inspection placeholders.

## QA/reliability lane

- Test 50,000-row import, worker interruption, duplicate tab, browser refresh, retry, failure notification, and idempotency.
- Test copilot provider faults and quota non-increment.
- Test provenance correspondence to executed queries and safe SQL display.
- Test every P8–P13 loading/empty/error/data/gated/mobile state.
- **🔵 Visual check:** verify ALL surfaces are navy-blue-tinted (no gray backgrounds, no pure black, no violet accents).
- Verify WCAG AA contrast for all blue text on navy surfaces.

## Product/content/operations lane

- Finalize six suggested prompts, empty-state copy, import guidance, plan-gate copy, slot content, and sample dataset.
- Configure import-job failure email/WhatsApp content.

## Day 4 completion gate

- **🔵 Every customer-facing surface uses the navy-blue design system. Zero gray leaks.**
- Core product works end-to-end with large data, empty data, provider failure, and every plan.
- GradientMesh background renders without jank, LiquidGlassCards have correct backdrop-blur.
- Plan gates use navy glass blur + lock with blue glow + gradient text pattern.
- Source coverage: P8–P13, AppShell, GAP 2, GAP 3, GAP 6, GAP 9, GAP 10, Slots D–G/J/L/M, Bucket 3 import-failure item, UI Rehaul spec (`uirehaulday4.md`).

---

# Day 5 — Usage UI, upgrade, Stripe, GST, invoices, and dunning

## Backend/API lane

Implement Days 16 and 18:

- final billing hook contract and all PlanGate variants;
- Stripe checkout and customer portal;
- trusted server-side Price IDs;
- raw-body signed webhooks;
- checkout completion, subscription update/delete, invoice success/failure;
- idempotent out-of-order event handling;
- failed-payment grace and recovery;
- Day 0/3/7/14 dunning with email/WhatsApp and safe downgrade;
- manual NEFT contact/reconciliation path.

## Database/security lane

- Add billing details, GSTIN/address/state, invoice sequence, payment/dunning ledger, webhook inbox, idempotency records, and RLS.
- Preserve required financial/legal evidence during account/tenant changes.
- Ensure no client controls amount, tax, plan, invoice status, or entitlement.

## Customer frontend lane

Implement source 16.1–16.7 and P15–P16:

- `useBilling`, UsageBanner, PlanGate, and every page gate;
- Upgrade cards, current plan, monthly/annual toggle, factual comparison, contact/NEFT, trust line, and FAQs;
- Billing plan/status/renewal, portal/upgrade, past-due banner, usage bars, daily pills, retention, invoice history, GST details, and Slot H;
- checkout success/cancel/provider-down/already-subscribed states;
- Settings Billing navigation.

## Superadmin frontend lane

- Add live Stripe status, webhook status, payment timeline, invoice download/resend, manual payment, trial extension, and dunning visibility.
- Add repair/reconcile action behind sudo-ready placeholder.

## QA/reliability lane

- Stripe test-mode E2E for Pro/Business monthly/annual, duplicate clicks, repeated/out-of-order webhooks, failure, recovery, cancellation, and manual entitlement.
- Test same-state CGST+SGST and interstate IGST invoice calculations.
- Test invoice sequence, PDF, email, GST fields, and dunning test clock.
- Run Day 16 and Day 18 Quality Gates.

## Product/content/operations lane

- Configure Stripe products/prices, Stripe Tax, SaaS tax code, tax-inclusive/exclusive policy, portal, and webhook secret.
- Provide legal company/GST details and accountant-reviewed invoice/credit-note policy.
- Finalize E5–E7 payment templates.

## Day 5 completion gate

- Customer can upgrade, pay, receive GST invoice, recover failed payment, and manage subscription without founder intervention.
- Source coverage: Day 16 16.1–16.7, Day 18 18.1–18.4, GAP 1, GAP 12, P15–P16, E5–E7, Billing/Upgrade slot rules.

---

# Day 6 — Security, DPDP, alerts, limits, legal pages, and resilience

## Backend/API lane

Implement Day 19:

- rate limits for auth, onboarding, copilot, imports, alerts, exports, broadcasts, and admin actions;
- complete security-header middleware and CSP;
- PII redaction before every customer-data AI request;
- zero-code alert CRUD/evaluator/cooldown/dedup/channel delivery;
- layered 80%/90%/100% limit events;
- friendly 429/402/503/504 responses.

## Database/security lane

- Complete tenant isolation test matrix for every Phase 2 table, storage object, endpoint, export, job, conversation, billing record, alert, report, and real-time channel.
- Complete India-region data migration/verification and update all service endpoints.
- Store legal versions and consent evidence.
- Add alert tables, limits, RLS, and evaluator audit.
- Review auth/session/password/lockout policies.

## Customer frontend lane

- Build alert list/create/edit/delete/toggle and every empty/loading/triggered/gated/failure state.
- Complete Privacy and Terms pages with all P20 topics.
- Add quota, rate-limit, AI outage, stale session, consent reacceptance, and security feedback UI.
- Build accessible 404 and 500/ErrorBoundary pages with Sentry reporting.

## Superadmin frontend lane

- Build security/abuse health summary placeholder.
- Show rate-limit events, alert evaluator state, isolation-sensitive export controls, and residency/config status.

## QA/reliability lane

- Run tenant A/tenant B adversarial suite and role matrix.
- Test proxy/IP handling, shared-office traffic, brute force, CAPTCHA bypass, XSS/CSP, unsafe iframe/script, PII fixtures, Unicode/Hindi, alert boundaries, duplicate cron, and monthly reset.
- Run Day 19 Quality Gate and security-header scan.

## Product/content/operations lane

- Finalize DPDP notices, Privacy, Terms, subprocessors, retention, rights, contact, cookie disclosure, SLA, payments/refunds, liability, ownership, termination, and governing law with legal review.
- Document breach notification within required timeline and incident contacts.

## Day 6 completion gate

- Security, privacy, residency, consent, alerts, and layered limits are production-enforced.
- Source coverage: Day 19 19.1–19.7 including duplicate 19.4 isolation section, P17–P20, GAP 6 overlap, Bucket 3 CSP.

---

# Day 7 — WhatsApp, email, activation, teams, settings, export, and deletion

## Backend/API lane

Implement Day 20:

- Zaptilo client, normalization, consent, preferences, templates, provider IDs, retry, delivery state, and unsubscribe;
- weekly and morning briefs plus alert delivery;
- team invites, tokens, expiry, resend/cancel/acceptance, roles, and seat limits;
- atomic seat reservation RPC/transaction that locks allocation, resolves plan/custom limit, expires stale reservations, counts active + suspended + unexpired pending invitations, and reserves exactly one seat;
- acceptance-time seat/email/expiry/tenant/role recheck using the invitation record as source of truth;
- Business→Pro, Pro→Free, and custom-limit downgrade reconciliation with owner preservation, admin selection, deterministic fallback selection, `seat_locked` excess memberships, session revocation, and safe reactivation after upgrade;
- profile/password/session settings;
- complete account export and account deletion;
- notification preferences and test sends;
- activation event capture and Day 0/1/3/7/14 scheduler;
- complete `WeeklyDebriefEngine` with all nine deterministic computations;
- typed debrief models, synthesis through the existing OpenRouter client and pinned model, strict number/name validation, one retry, and deterministic fallback;
- `WeeklyDebriefService` for entitlement → compute → synthesize → validate → store → email/WhatsApp delivery;
- `GET /debrief/latest`, `GET /debrief`, `GET /debrief/{report_id}`, and internal/superadmin generation routes;
- Monday `30 1 * * 1` UTC scheduler with per-tenant continuation, idempotency, partial status, audit, and health heartbeat.

## Database/security lane

- Add phone/preferences, team invites, user events, activation send ledger, delivery logs, suppression, export jobs, and deletion queue.
- Add tenant owner identity, profile membership status (`active`, `suspended`, `seat_locked`), pending invitation seat reservations, partial uniqueness, expiry/release fields, and complete RLS/audit.
- Store versioned weekly-debrief metadata in existing `generated_reports` with one successful tenant/week report.
- Add debrief indexes/RLS, Free lifetime-count integrity, generation idempotency, delivery idempotency, and report ownership.
- Protect last admin, self-removal, cross-tenant invite, duplicate invite, and expired token cases.
- Preserve legal/financial evidence while deleting customer data and revoking sessions.

## Customer frontend lane

Complete P14 Settings:

- Profile;
- Notifications with day/time/timezone/channel and Pro gates;
- Billing link/embedded choice;
- Security/change password/sessions;
- Team members, invites, pending actions, role, seat meter;
- seat meter counts pending reservations; locked members have a separate state; invite disables at zero remaining;
- downgrade seat-selection UI and post-upgrade member reactivation;
- API Keys placeholder for Day 13;
- Danger Zone export/delete exact-email confirmation.

Add WhatsApp setup/test/recovery UI and all notification states.

Build the complete native Weekly Debrief experience:

- `/debrief` route and AppShell navigation item;
- latest report plus selector/archive for 12 past reports;
- five ordered sections: Headline, exactly three Went Right items, exactly three Went Wrong items with hypotheses, 30/60/90-day Momentum, and exactly three Actions;
- ₹ impact badges, named parties/products/zones, urgency, freshness, projection, and limited-mode disclosure;
- loading skeleton, no-report, under-seven-day waiting, 7–13-day limited, 14+-day normal, stale, error/retry, plan/lifetime-gated, and unavailable-report states;
- PDF download;
- “Ask Copilot about this week” using authorized report context rather than sensitive query-string content;
- independent Weekly Debrief Email and Weekly Debrief WhatsApp preferences.

## Superadmin frontend lane

- Add user/team/contact/preferences timeline to tenant/user drawers.
- Add delivery log and activation-status diagnostics.
- Add one-click test brief and channel/provider error visibility.
- Add weekly-debrief generation/delivery status, last report, lifetime count, channel outcomes, cost, manual generation, regeneration warning, and operation/audit links.

## QA/reliability lane

- Test W1–W4, E1–E11 rendering variables, channel matrix, timezone, duplicate scheduler, unsubscribe, provider failure, and fallback.
- Test all nine weekly computations, Mon–Sun/year boundaries, under-7 skip, 7–13 limited, 14+ complete, malformed/hallucinated LLM output, deterministic fallback, one report/count per week, Free lifetime allowance, Pro/Business recurrence, archive ownership/limit, and independent partial channel failure.
- Verify the HTML email in Gmail/Outlook/mobile, approved WhatsApp summary, PDF, `/debrief` responsive states, Copilot context authorization, superadmin trigger, cron partial status, and exact `07:00 IST` delivery from `01:30 UTC`.
- Test invite/member lifecycle across all plans and role edges.
- Test final-seat concurrency, idempotent repeated invite, pending-seat occupancy, cancel/expiry/provider-failure release, resend without double reservation, acceptance-time recheck, Free 1/Pro 3/Business 10/custom 5, 10→3 and 3→1 downgrade locking, session revocation, reactivation bounds, and cross-tenant denial.
- Test export completeness, expiring link, subscription cancellation, data deletion inventory, and session revocation.
- Run Day 20 Quality Gate.

## Product/content/operations lane

- Implement shared email frame and E1–E11 exact templates.
- Implement W1–W4 exact templates and submit for BSP approval.
- Implement the dedicated weekly-debrief HTML template, plain-text fallback, five-section in-app copy rules, and concise W1 summary/deep link.
- Finalize all five activation stages and replyable help email.
- Configure SendGrid sender and Zaptilo test destination.

## Day 7 completion gate

- Customer communications, complete weekly debrief, team management, account rights, and activation work without manual database intervention.
- Source coverage: Day 20 20.0–20.6 including 20.1a atomic seat-control gap, complete `weekly_debrief.md`, P14, Email Templates E1–E11, WhatsApp W1–W4, GAP 4, DPDP access/erasure rights, Slots I/K/N/O.

---

# Day 8 — Superadmin secure foundation and complete core APIs

## Backend/API lane

Implement 17.1–17.4 and all 17.2 API groups:

- hidden superadmin guard;
- server-validated 15-minute sudo;
- tenant CRUD/wipe/data delete;
- quota/history/reset/bonus;
- plan/status/trial/feature overrides;
- user list/role/move/suspend/reset/magic link/delete;
- data summary/preview/export/delete;
- conversations/messages/feedback;
- live billing/revenue/cost;
- report/brief/broadcast/banner;
- impersonation;
- audit;
- cron and system health/manual run.

## Database/security lane

- Add `is_superadmin`, `cron_runs`, `global_settings`, internal notes, operation IDs, before/after, reason, actor, IP, user agent, timestamps, and immutable audit baseline.
- Enforce recent sudo, CSRF protection, reason, idempotency, optimistic locking, and dry-run/impact preview.
- Protect destructive and financial actions with exact confirmation.

## Customer frontend lane

- Add global system banner and maintenance behavior.
- Add secure impersonation banner and exit.
- Ensure authenticated pages never expose superadmin controls by role spoofing.

## Superadmin frontend lane

- Build complete dark shell and final navigation skeleton.
- Build shared command palette framework.
- Wire API clients and permissions for all core groups.

## QA/reliability lane

- Test normal user → 404, stale sudo, forged role, CSRF, duplicate mutation, conflict, destructive confirmation, bulk bounds, impersonation expiry, noindex, and audit completeness.
- Test every endpoint against role and tenant matrices.

## Product/content/operations lane

- Define founder/support/billing/operations workflows and exact confirmation language.
- Document first-superadmin creation and emergency lockout recovery.

## Day 8 completion gate

- All foundational superadmin APIs exist securely before omnipotence write controls are enabled.
- Source coverage: 17.1, every 17.2 endpoint block, 17.3, 17.4, GAP 11 secure implementation foundation.

---

# Day 9 — Superadmin core UI, revenue, communications, system health, and founder AI

## Backend/API lane

- Complete founder daily 7 AM operational brief and interactive superadmin copilot.
- Build structured ops context covering MRR, ARR, plans, signups, churn, usage, activation, LLM costs, margin, feedback, failures, jobs, upsell, and churn risk.
- Add provenance and non-hallucination constraints.
- Complete Day 21 revenue, impersonation, broadcast, and basic feature-override contracts.

## Database/security lane

- Add founder AI cost classification and retention.
- Add broadcast schedule/history, system alert records, revenue snapshots if needed, and safe impersonation attribution.
- Verify operational aggregation accuracy.

## Customer frontend lane

- Finalize impersonation banner behavior in every customer route.
- Finalize system banner and maintenance/error experience.

## Superadmin frontend lane

Implement 17.5 Tabs 1–11 and UI Bible 6.1–6.4:

- Overview/live feed/attention;
- Tenants and complete tenant drawer;
- Users;
- Usage/upsell/churn queues;
- Revenue;
- Billing;
- Communications;
- Audit Logs;
- Cron Health;
- System;
- AI Briefing with all specified question chips and streaming.

Implement Day 21 actions and responsive monitoring.

## QA/reliability lane

- Reconcile MRR/cost/margin fixtures.
- Test every table filter/sort/search/pagination/action/drawer state.
- Test founder brief and operational questions for exact numbers.
- Test broadcast recipient preview, scheduling, duplicate prevention, and failures.
- Run core Day 17 and Day 21 Quality Gate checks that do not depend on Days 10–13.

## Product/content/operations lane

- Finalize founder brief format, action priorities, operational alert thresholds, and internal support note conventions.
- Configure founder email/WhatsApp destinations.

## Day 9 completion gate

- Founder can see and perform all core tenant, user, usage, billing, communication, health, and AI operations from one browser shell.
- Source coverage: 17.5, 17.6, Day 21 21.1–21.4, UI Bible Superadmin 6.1–6.4.

---

# Day 10 — Omnipotence 1–4: plans, billing operations, CMS/media, legal/changelog

## Backend/API lane

Implement OMNIPOTENCE GAP 1–4 APIs:

- dynamic plan catalog/assignment, clone/publish/archive/public plans/Stripe sync;
- refunds, credits, coupons, promotion codes, invoice retry/mark-paid/write-off, pause/resume/cancel/date change, manual payment, ledger;
- content/media/placement draft/preview/publish/schedule/rollback;
- legal versions, consent status/reacceptance, and changelog publishing.

## Database/security lane

- Add `plan_catalog`, `plan_assignments`, ledger/reconciliation records, `content_entries`, `media_assets`, `placement_slots`, `document_versions`, and `user_consents`.
- Add validation, versioning, optimistic locks, publish audit, and immutable legal versions.
- Prevent retroactive Stripe price migration unless explicitly scheduled.

## Customer frontend lane

- Switch pricing, entitlements, public content, media, SEO, placements, legal pages, and changelog/modal to published control-plane data with resilient fallback.
- Preserve layout and performance while content is dynamic.

## Superadmin frontend lane

- Build Plans & Limits UI with diff/affected tenants and tenant custom assignment.
- Build complete Billing Operations UI and reconciliation.
- Build CMS/media/demo/promotion editor with asset/link/accessibility validation.
- Build Legal/Changelog editor with schedule, reacceptance targeting, acceptance rate, and immutable archive.

## QA/reliability lane

- Test plan publish/rollback, Stripe sync, existing subscription preservation, refund idempotency, ledger reconciliation, invalid tax/amount, unsafe content/file, missing alt text, broken link, schedule, legal immutability, and reacceptance.
- Execute Day 17 Quality Gate checks for gaps 1–4.

## Product/content/operations lane

- Load final public content/media and verify all claims.
- Define coupon/refund/manual-payment approval policy.
- Complete legal version review before publish.

## Day 10 completion gate

- Founder controls commercial model, money lifecycle, public content/media/slots, and legal releases without deploy.
- Source coverage: OMNIPOTENCE GAP 1/15 through 4/15 and associated final IA sections.

---

# Day 11 — Omnipotence 5–8: Data Studio, query/runbooks, LLM control, templates

## Backend/API lane

Implement OMNIPOTENCE GAP 5–8:

- Data Studio allowlist, typed filters/forms/actions/export;
- read-only query console and all named parameterized runbooks;
- AI request/prompt/version/test/publish/rollback/routing/budget/replay;
- channel/locale/version message templates, preview/test/publish/rollback/suppress/retry.

## Database/security lane

- Create dedicated read-only query role with one-statement, timeout, row cap, and protected schema restrictions.
- Implement table/column/action allowlist server-side.
- Store prompt versions, regression sets, model routing, budgets, template versions, delivery events, and PII reveal audit.
- Exclude auth internals, secrets, encryption keys, and credentials.

## Customer frontend lane

- Ensure newly controlled templates/prompts preserve all existing customer behavior.
- Add safe fallback when a draft/unpublished/broken version exists.

## Superadmin frontend lane

- Build Data Studio, Query Console, Runbooks, AI Control Room, and Template editor.
- Include saved views/queries, schema help, dry-run, impact, version diff, regression comparison, model cost comparison, staged rollout, variable docs, previews, approval state, quiet hours, and delivery logs.

## QA/reliability lane

- Reject manipulated table/column, DDL/DML/COPY/network/protected queries, overlong queries, excessive rows, invalid runbook parameters, replay quota charging, missing/unknown variables, and masked-PII bypass.
- Test prompt percentage rollout, rollback, provider test sends, and delivery states.
- Execute Day 17 Quality Gate checks for gaps 5–8.

## Product/content/operations lane

- Curate safe saved queries and regression questions.
- Document each runbook’s purpose, maximum impact, idempotency, and rollback.
- Review every E1–E11/W1–W4 variable in template control.

## Day 11 completion gate

- Founder can inspect safe data, answer ad-hoc questions, execute controlled repairs, manage AI, and manage communications without SQL/code deploys.
- Source coverage: OMNIPOTENCE GAP 5/15 through 8/15.

---

# Day 12 — Omnipotence 9–12: integrations, flags, abuse policies, and support desk

## Backend/API lane

Implement OMNIPOTENCE GAP 9–12:

- integration health/test/state/fallback/rotation;
- deterministic feature-flag resolver and experiments;
- domain/signup/CAPTCHA/rate/password/session/reacceptance policies;
- support cases, messages, attachments, timeline, recovery actions, and specific-user impersonation.

## Database/security lane

- Store integration metadata/fingerprints without secret values.
- Add `feature_flags` and rule/version/experiment records.
- Add auth policy configuration with blast-radius preview.
- Add `support_cases` and secure attachment storage/RLS.
- Implement global session-revoke break-glass protection.

## Customer frontend lane

- Consume deterministic feature flags with safe defaults.
- Add waitlist/invite-only/frozen-signup customer states.
- Add in-app support entry and case status if included by product decision.
- Ensure integration degraded mode communicates only affected features.

## Superadmin frontend lane

- Build Integration Command Center, Feature Flags/Experiments, Auth & Abuse Policy, and Support Desk.
- Include reason/impact, secret write-only flow, tenant explanation, staged rollout, automatic expiry, unified customer timeline, view-only impersonation, and recovery controls.

## QA/reliability lane

- Test secret non-return, kill switches, fallback, deterministic buckets, precedence, expiry, forbidden experiment areas, session revoke scope, signup modes, domain rules, CAPTCHA risk, case/attachment isolation, and view-only impersonation.
- Execute Day 17 Quality Gate checks for gaps 9–12.

## Product/content/operations lane

- Configure provider accounts/health endpoints and escalation links.
- Define rollout/experiment governance, support priority/status/SLA, abuse response, and session-revoke procedure.

## Day 12 completion gate

- Founder controls providers, releases, authentication/abuse, and customer support safely from the app.
- Source coverage: OMNIPOTENCE GAP 9/15 through 12/15.

---

# Day 13 — Omnipotence 13–15, jobs/webhooks, governance, API keys, analytics, and operations

## Backend/API lane

Implement OMNIPOTENCE GAP 13–15 and Day 22:

- tenant export, legal hold, restore preview/execute workflow, restore drill;
- job queue explorer/actions and webhook inbox/replay;
- alert rules/routes/snoozes/windows;
- superadmin role permissions/approval/config rollback;
- Business API key generate-once/hash/scopes/revoke/auth;
- PostHog server/client event contracts;
- final health, readiness, and operational endpoints.

## Database/security lane

- Surface PITR/backup state and isolated restore workflow; never direct browser overwrite of production.
- Add legal holds, encrypted expiring exports, restore records, job/dead-letter/idempotency/webhook/alert-rule records.
- Implement founder-owner/operations/support/billing/read-only roles, MFA requirement, optional two-person approval, short sessions, tamper-evident audit chain, append-only grants, signed digest, config history, and conflict-checked rollback.
- Add API-key hashes and scopes.

## Customer frontend lane

- Complete Business API Keys tab with masked table and one-time secret modal.
- Integrate consent-aware PostHog identify/reset and allowed events only.
- Ensure no sales data, questions, secrets, or raw PII enter analytics.
- Finalize maintenance/server error handling.

## Superadmin frontend lane

- Build Backup & Recovery, Jobs & Webhooks, Alert Rules, Superadmins & Roles, Configuration History, and final Audit governance screens.
- Complete final 17.8 navigation and permission-aware global command palette.
- Show environment, sudo expiry, impersonation, alerts, and deploy version in top bar.

## QA/reliability lane

- Execute encrypted export/expiry, isolated restore preview, restore drill, legal hold, duplicate webhook replay, job retry/cancel/quarantine, alert threshold, role/MFA/approval, audit hash, rollback conflict, API key, and analytics privacy tests.
- Run all remaining Day 17 and Day 22 automated/manual quality checks.

## Product/content/operations lane

- Configure PostHog, Sentry release, healthchecks.io for every cron, UptimeRobot, backup/PITR plan, and production access policy.
- Complete SPF, DKIM, DMARC, sender domain, bounce/complaint/unsubscribe webhooks.
- Complete weekly superadmin checklist and common support scenarios.

## Day 13 completion gate

- Founder’s final recovery, operations, governance, API, analytics, and monitoring control surfaces work.
- Source coverage: OMNIPOTENCE GAP 13/15 through 15/15, 17.8, Day 22 22.1–22.5, GAP 8, all operations checklists.

---

# Day 14 — Full conformance, accessibility, performance, demos, resilience, and production release

Day 14 is not a “leave everything until testing” day. Every preceding day already passed tests. This is the integrated final pass across the complete product.

## Backend/API lane

- Resolve all integration defects found by complete E2E and fault-injection runs.
- Verify all migrations from 001 through every Phase 2 migration on a production-like clone.
- Verify background jobs, retention, activation, dunning, alerts, briefs, imports, exports, cleanup, audit digest, and recovery scheduling.
- Freeze API schemas and publish operational documentation.

## Database/security lane

- Run complete cross-tenant, role, RLS, storage, export, impersonation, query-console, webhook, billing, and admin mutation adversarial suites.
- Verify backup freshness, PITR, restore drill evidence, legal holds, deletion, financial/legal retention, and audit integrity.
- Verify production secrets, least privilege, MFA, sudo, CSRF, CSP, rate limiting, session policy, and no secret/PII leakage.

## Customer frontend lane

Perform exact UI Bible conformance for:

- P1 Landing;
- P2 Signup;
- P3 Verification;
- P4 Forgot Password;
- P5/P19 Reset Password;
- P6 Login;
- P7 Onboarding;
- P8 Dashboard;
- P9/P11 Copilot desktop/mobile;
- P10 Data;
- P12 Reports;
- P13 Simulator;
- P14 Settings;
- P15 Billing;
- P16 Upgrade;
- P17 404;
- P18 500;
- P20 Privacy/Terms;
- AppShell;
- all loading, empty, data, error, success, locked, stale, past-due, quota, provider-failure, and responsive states;
- every button, icon, link, menu, modal, drawer, tooltip, table action, form, timer, upload, progress, toast, animation, and confirmation.

## Superadmin frontend lane

- Verify every tab and every OMNIPOTENCE action from one browser.
- Verify mobile monitoring and desktop-only destructive restrictions.
- Verify global command search, permission filtering, environment banner, sudo expiry, impersonation, alerts, operation IDs, audit links, previews, confirmations, and rollback labels.
- Verify all Day 17 Quality Gate manual items, including each of the 15 gaps.

## QA/reliability lane

Complete UI Bible 9–11:

- logical keyboard order and visible focus;
- labels, descriptions, required state, icon labels, live regions, busy state, image alt text;
- 4.5:1 text contrast, 200% zoom, screen reader, reduced motion, touch targets;
- landing LCP under 2.5 seconds, CLS under 0.1, Lighthouse 90+;
- lazy images/video/charts/routes, WebP/srcset, font subset, vendor/app/admin bundles;
- React Query freshness rules;
- browser/device matrix;
- provider failure and recovery;
- load/concurrency/pool exhaustion;
- complete customer journey and founder journey;
- all Day 14–22 Quality Gates and Production Readiness checklists.

## Product/content/operations lane

- Produce and install all three launch videos exactly as specified:
  - 60-second landing explainer;
  - three-minute outreach walkthrough;
  - 15-second square social hook.
- Verify Slots A–O:
  - correct page/context/plan;
  - maximum one visible per page;
  - maximum three views;
  - dismissal persistence;
  - never during copilot streaming;
  - never on billing/upgrade where prohibited.
- Verify all E1–E11 and W1–W4 content/provider approvals.
- Verify favicon, OG images, public metadata, sitemap, robots, DNS, SPF, DKIM, DMARC, GST/company/legal/support details.
- Complete the Final Pitchability Checklist.

## Day 14 production rehearsal

Run these complete journeys:

### Customer journey

Landing → demo → signup → Turnstile → consent → verification → onboarding → real/sample import → dashboard → Hindi/English copilot → feedback/provenance → reports/simulator → alert → weekly debrief generation → `/debrief` five-section report/archive/PDF → Copilot debrief context → WhatsApp/email delivery → quota warnings → upgrade → Stripe payment → GST invoice → team invite → settings → export/delete.

### Failure journey

Invalid file → async worker failure/retry → OpenAI 429/5xx/timeout → Stripe payment failure → dunning recovery → missed cron → provider degraded mode → quota hard stop/reset → expired token → stale data → maintenance → React crash → 404.

### Founder journey

Sudo → overview → tenant/user → quota/plan/feature → billing/refund/manual payment → impersonation → data/conversations/feedback → report/broadcast → founder AI → plan catalog → CMS/legal → Data Studio/query/runbook → AI/templates → integration/flags/auth/support → backup/jobs/webhooks → roles/audit/rollback.

## Day 14 completion gate

Phase 2 is complete only when:

- every requirement-ledger row is `done` or explicitly `deferred by the source`;
- no launch requirement is `partial`, `unknown`, `blocked without owner`, or silently omitted;
- every quality gate passes;
- production deployment and rollback rehearsal succeed;
- all monitors are green;
- the complete customer and founder journeys work without terminal, SQL, or manual database intervention;
- every answer in the source Final Pitchability Checklist is **YES**.

---

# Complete source traceability

## Original Day sections

- Day 14, sections 14.1–14.8 and Quality Gate → Day 2.
- Day 15, sections 15.1–15.2 and Quality Gate → Day 3.
- Day 16, sections 16.1–16.7 and Quality Gate → Day 5.
- Day 17, sections 17.1–17.4 → Day 8.
- Day 17, sections 17.5–17.6 → Day 9.
- Day 17, OMNIPOTENCE 1–4 → Day 10.
- Day 17, OMNIPOTENCE 5–8 → Day 11.
- Day 17, OMNIPOTENCE 9–12 → Day 12.
- Day 17, OMNIPOTENCE 13–15 and 17.8 → Day 13.
- Full Day 17 Quality Gate → Days 8–14, final confirmation Day 14.
- Day 18, sections 18.1–18.4 and Quality Gate → Day 5.
- Day 19, sections 19.1–19.7 and Quality Gate → Day 6.
- Day 20, sections 20.0–20.6 and Quality Gate → Day 7.
- Day 21, sections 21.1–21.4 and Quality Gate → Day 9.
- Day 22, sections 22.1–22.5, Quality Gate, Production Readiness, and completion lists → Days 13–14.

## Gaps Audit

- GAP 1 GST invoicing → Day 5.
- GAP 2 async large imports → Day 4.
- GAP 3 empty states → Days 3–4 and final Day 14.
- GAP 4 activation sequence → Day 7.
- GAP 5 bot prevention → Days 3 and 6.
- GAP 6 LLM graceful degradation → Days 4 and 6.
- GAP 7 Supabase pooling → Day 1.
- GAP 8 cron monitoring → Days 2, 7, and 13.
- GAP 9 copilot feedback → Day 4.
- GAP 10 provenance → Day 4.
- GAP 11 superadmin reauthentication → Day 8.
- GAP 12 payment dunning → Day 5.
- GAP 13 robots/sitemap → Day 3.
- Team seat-control gap (atomic reservations, pending seats, acceptance recheck, release, downgrade locking/reactivation) → Day 7.

## Bucket 3 polish

- Backup/PITR documentation and restore test → Days 1, 13, 14.
- Staging environment → Day 1.
- Complete `.env.example` → Day 1 and updated daily.
- UptimeRobot → Day 13.
- Report/debrief PDF → Days 7 and 14.
- 404 → Day 6.
- Pinned OpenAI model → Day 1.
- Favicon/OG → Days 3 and 14.
- CSP → Day 6.
- Import failure email/WhatsApp → Days 4 and 7.

## UI/UX Bible

- Brand/design/components/toasts/loading → Day 1, enforced Days 2–14.
- P1–P7 and P19 → Day 3.
- P8–P13 → Day 4.
- P14 → Day 7.
- P15–P16 → Day 5.
- P17–P18/P20 → Day 6.
- Email E1–E11 and WhatsApp W1–W4 → Day 7.
- Complete Weekly Debrief engine, service, routes, scheduler, email/WhatsApp, `/debrief` page, archive, PDF, Copilot CTA, preferences, quota/cost, monitoring, and tests → Day 7; integrated confirmation Day 14.
- AppShell → Day 4.
- Superadmin complete UI → Days 8–13.
- Three demo videos → Days 3 and 14.
- Promotional Slots A–O → Days 3–7 and final Day 14.
- Accessibility → enforced daily, full gate Day 14.
- Performance → enforced daily, full gate Day 14.
- Pitchability → Day 14.

## Explicitly deferred by `sprint_phase2.md`

The following are recorded but are not Day 14 launch requirements:

- voice queries after 10 paying customers;
- causal-chain visualization after validation;
- two-way WhatsApp questions after 10 customers;
- Tally Live Sync after first Business customer;
- broader DMS connectors after 25+ customers;
- demand forecasting after 25+ customers;
- distributor scorecard in Phase 3;
- SOC 2, ISO 27001, enterprise SSO, private customer-VPC LLM, white-labeling, referral program, PWA, NPS, and other Phase 4/scale-triggered work.

They must remain in the product backlog with their source-defined trigger and must not be advertised as live.

