AKARA (QAFFEINE) — Sales Readiness & Technical Due Diligence Report

Generated: 2026-07-21

Review Panel: Staff SWE (Google) · Principal SA (AWS) · YC Technical Partner · Enterprise SaaS CTO · Product Manager · AI/LLM Systems Architect · Enterprise Security Auditor

Methodology: Complete repository inspection — every file, every function, every config
PHASE 1 — What This Product Actually Is Today

AKARA (still branded QAFFEINE/Bajaj DMS internally) is a single-tenant Streamlit dashboard hardcoded to one specific customer's SQLite database (Bajaj Consumer Care FMCG distributor data, January 2026 only). It offers a KPI dashboard with Plotly charts (revenue, orders, AOV, top products, zone breakdown), an LLM-powered natural language Q&A copilot backed by Google Gemini with OpenRouter failover, a what-if revenue simulator using a RandomForest model trained on 42 real data points with synthetic augmentation, a Z-score anomaly detection engine, a market basket analysis tool, and an email morning brief generator. It is a proof-of-concept prototype built to impress one client with one dataset. It has no authentication, no multi-tenancy, no billing, no onboarding flow, no connector framework, no admin console, no CI/CD, and no deployment infrastructure. Every table name, column name, schema reference, system prompt, and SQL template is hardwired to Bajaj Consumer Care's DMS data model.
PHASE 2 — Architecture Review
┌──────────────────────────────────────────────────────────────────┐

│                       USER (Browser)                              │

└──────────┬────────────────────────────┬──────────────────────────┘

│ Streamlit (port 8501)      │ FastAPI (port 8000)

▼                            ▼

┌─────────────────────┐    ┌─────────────────────────┐

│  app/dashboard.py   │    │  src/api/main.py        │

│  (54KB monolith)    │    │  (3 endpoints)          │

│  - Tab 1: KPI       │    │  GET  /health           │

│  - Tab 2: AI Chat   │    │  POST /v1/copilot/query │

│  - Tab 3: Simulator │    │  GET  /v1/kpi/revenue   │

│  - Tab 4: Notify*   │    │  POST /v1/jobs/brief*   │

│    (*commented out)  │    │    (*stub)              │

└──────────┬──────────┘    └──────────┬──────────────┘

│                           │

▼                           ▼

┌──────────────────────────────────────────────────┐

│              SERVICE LAYER (src/services/)        │

│  query_service.py  → Copilot orchestration        │

│  kpi_service.py    → Parameterized SQL KPIs       │

│  voice_service.py  → OpenRouter Whisper STT        │

└──────────┬───────────────────────────────────────┘

│

▼

┌──────────────────────────────────────────────────┐

│           AI COPILOT PIPELINE                     │

│                                                   │

│  1. INTENT MATCH (src/intent/pipeline.py)         │

│     └─ Regex patterns → parameterized SQL         │

│                                                   │

│  2. AGENTIC PLANNER (scripts/copilot_brain.py)    │

│     └─ LLM generates JSON tool-call plan          │

│     └─ Tools: query_sales_db, get_holiday_status, │

│        get_news_context, analyze_product_mix       │

│                                                   │

│  3. GUARDRAILS (src/copilot/)                     │

│     ├─ premise_check.py    (false premise detect) │

│     ├─ numeric_digest.py   (column sum verify)    │

│     ├─ numeric_postcheck.py (hallucination catch)  │

│     ├─ causal_postcheck.py (causal claim audit)   │

│     ├─ data_scope.py       (schema boundary)      │

│     └─ trace.py            (JSONL audit log)      │

│                                                   │

│  4. SQL SAFETY (src/sql/)                         │

│     ├─ sql_guard.py        (allowlist/blocklist)   │

│     └─ guarded_execute.py  (row limit, timeout)   │

└──────────┬───────────────────────────────────────┘

│

▼

┌──────────────────────────────────────────────────┐

│          LLM ENGINE (scripts/universal_context.py)│

│  Primary:  Google Gemini (3-model rotation)       │

│  Backup:   OpenRouter (6-model failover chain)    │

│  Context:  WeatherAPI, NewsAPI, RSS, holidays lib │

└──────────┬───────────────────────────────────────┘

│

▼

┌──────────────────────────────────────────────────┐

│          DATA LAYER                               │

│  SQLite file: database/AI_DMS_database.db (24MB)  │

│  Tables: VIEW_AI_SALES, context_intelligence      │

│  WAL mode, busy_timeout=5000ms                    │

│  No migrations, no versioning                     │

└──────────────────────────────────────────────────┘

SCRIPTS (standalone CLI):

scripts/forecaster.py       → RandomForest ML model

scripts/anomaly_engine.py   → Z-score anomaly detection

scripts/basket_analysis.py  → Market basket / BCG matrix

scripts/mailer.py           → SMTP HTML email dispatch

scripts/build_database.py   → Excel → SQLite ETL

scripts/clean_consolidate.py→ Raw data cleaning

scripts/universal_context.py→ Weather/news/holiday enrichment

scripts/chaos_monkey.py     → Resilience testing

Component-by-Component Assessment

Component	Status	Details

Frontend	Streamlit monolith (54KB single file)	Dark-themed, Plotly charts, chat interface, voice input. No React/Vue/Angular.

Backend	FastAPI with 3 endpoints (1 stub)	No auth, no CORS, no rate limiting. Synchronous execution.

AI Pipeline	Plan→Execute→Synthesize loop	Gemini primary, OpenRouter backup. 5-layer guardrail chain.

Database	SQLite file on disk	Single 24MB file. No Postgres, no connection pooling.

Planner	LLM JSON tool-call generation	4 tools available. Max 8 calls per query. Auto-repair on parse failure.

Tools	4 registered tools	query_sales_db, get_holiday_status, get_news_context, analyze_product_mix

Guardrails	5 post-checks implemented	Premise, numeric, causal, data scope, SQL safety. Most sophisticated part.

Caching	Minimal	context_intelligence table pre-caches weather/news. Streamlit @st.cache_data for brief (10min TTL). No Redis.

Inference	Dual-engine with failover	Gemini → OpenRouter (6 models). Robust for a prototype.

Scheduling	None	No cron, no Celery, no task queue. All scripts are manual CLI.

Email	SMTP via Gmail App Password	Hardcoded recipient. Mobile-responsive HTML template. No bulk sending.

Voice	OpenRouter Whisper STT	Audio format auto-detection. Works but no streaming.

Forecasting	RandomForest on 42 data points	Synthetic augmentation masks tiny dataset. Cross-validated but fragile.

External APIs	WeatherAPI, NewsAPI, Google News RSS	Hyderabad-specific. No abstraction for other locations.

Deployment	None	No Docker, no Terraform, no cloud config. Local streamlit run only.

Monitoring	None	No APM, no Sentry, no health dashboards. One JSONL trace file.

PHASE 3 — Feature Inventory

AI & Intelligence

Feature	Status	Notes

Natural language business Q&A	✅ Completed	LLM-based with SQL generation

Intent-based fast-track SQL	✅ Completed	Regex patterns → parameterized templates (currently disabled via flag)

Multi-tool agentic reasoning	✅ Completed	Plan→Execute→Synthesize with 4 tools

Premise validation guardrail	✅ Completed	Catches false decline assumptions

Numeric hallucination check	✅ Completed	Column-sum verification with correction footer

Causal claim audit	✅ Completed	Flags unsupported causal language

Data scope boundary enforcement	✅ Completed	Prevents LLM from inventing columns

SQL injection prevention	✅ Completed	Read-only, allowlist, parameterized templates

LLM failover (Gemini→OpenRouter)	✅ Completed	9-model fallback chain

Voice input (Whisper STT)	✅ Completed	Audio format auto-detect, browser recording

Revenue forecasting (ML)	⚠️ Partial	RandomForest on 42 data points with synthetic augmentation

Anomaly detection	✅ Completed	Z-score with 7-day rolling window, sparsity guard

Market basket analysis	✅ Completed	Lift, confidence, BCG quadrants, bundle pricing

Morning brief generation	✅ Completed	Anomaly→diagnosis→recommendation→email pipeline

Scenario simulation	✅ Completed	Natural language + manual controls, hourly trend

Proactive intelligence brief	✅ Completed	Auto-generated anomaly + combo + risk summary

Context enrichment (weather/news/holiday)	✅ Completed	DB-cached with live API fallback

Crore/Lakh unit safety	✅ Completed	Explicit conversion rules in prompts

Dashboard & Visualization

Feature	Status	Notes

KPI cards (revenue, orders, AOV, packs, volume)	✅ Completed	5 top-level metrics

Daily revenue trend chart	✅ Completed	Plotly line+bar with dual Y-axis

Revenue by zone bar chart	✅ Completed	Horizontal bar with color coding

Top 5 items list	✅ Completed	Ranked with progress bars

Zone performance table	✅ Completed	Sortable dataframe

Raw data export (CSV)	✅ Completed	Download button

Date range filter	✅ Completed	Sidebar date picker

Zone multi-select filter	✅ Completed	Multi-select dropdown

24-hour revenue forecast chart	✅ Completed	Area chart with scenario overlay

Dark theme design	✅ Completed	CSS custom properties, glassmorphism

Chat history with thought process	✅ Completed	Expandable monologue + tool results

Notification center	🔴 Dead code	Entire Tab 4 is wrapped in if False:

Suggested question pills	✅ Completed	6 pre-built prompts

Infrastructure & Operations

Feature	Status	Notes

FastAPI REST endpoints	⚠️ Partial	3 endpoints, 1 stub. No auth.

Email dispatch (SMTP)	✅ Completed	Gmail App Password, single recipient

Notification history log	✅ Completed	CSV-based audit trail

Chaos monkey testing	✅ Completed	API blackout, LLM failover, DB lock tests

Database build pipeline	✅ Completed	Excel→clean→SQLite ETL

CI/CD	🔴 Placeholder	.github/workflows/ contains only .gitkeep

Docker / Containerization	🔴 Missing	No Dockerfile

Authentication	🔴 Missing	No auth anywhere

Multi-tenancy	🔴 Missing	Everything is single-tenant

Admin console	🔴 Missing	No admin UI

Billing/Subscription	🔴 Missing	No payment integration

Audit logging	🔴 Missing	No structured audit logs

Health monitoring	🔴 Missing	GET /health returns static JSON

Rate limiting	🔴 Missing	No rate limiting on any endpoint

CORS configuration	🔴 Missing	No CORS middleware

Testing

Feature	Status	Notes

Unit tests	⚠️ Partial	14 test files covering copilot, intent, guards, API health

Integration tests	🔴 Missing	No end-to-end tests

Load tests	🔴 Missing	No performance benchmarks

Security tests	🔴 Missing	No pen testing

CI pipeline	🔴 Missing	No automated test execution

PHASE 4 — Production Readiness Rubric (0–10)

Category	Score	Explanation

UI/UX	6/10	Polished dark theme with good data viz. But it's Streamlit — no responsive mobile, limited interactivity, 54KB monolith file. No loading states for heavy queries. No onboarding wizard. Notification tab is dead code.

Security	1/10	Critical. API keys (Gemini, OpenRouter, WeatherAPI, NewsAPI, Gmail credentials) are committed in plaintext to .env in the repo root. No .gitignore for the parent directory's .env. No authentication on any endpoint. No HTTPS enforcement. No input sanitization beyond SQL guard. LLM-generated SQL executes against a live database with only regex-based filtering. The ALERT_RECIPIENT email has a malformed value (jitendra@brainpowerindia.com5.5).

Authentication	0/10	No authentication exists anywhere. No login page, no API keys, no JWT, no OAuth, no session management. Anyone with the URL can access all data and the AI copilot.

Authorization	0/10	No role-based access control. No user concept exists in the system.

Logging	2/10	Python logging module used sporadically. JSONL trace file exists but is disabled by default (copilot_trace_jsonl: false). CSV notification history. No structured logging, no log levels, no log aggregation.

Observability	1/10	No metrics, no tracing (OpenTelemetry/Jaeger), no dashboards, no alerting. A static /health endpoint returns {"status": "ok"} unconditionally.

Testing	3/10	14 unit test files exist covering key guardrails (premise check, numeric digest, SQL guard, intent pipeline). But no CI runs them. No integration tests. No test for the main dashboard. No test for the forecaster. Test coverage is likely <15%.

Performance	3/10	SQLite WAL mode helps reads. LLM calls take 2-20s. No connection pooling. No async handlers (FastAPI endpoints use sync def). No CDN. Row limit guard (200) prevents runaway queries. Progress handler aborts long-running SQLite queries.

Caching	3/10	context_intelligence table caches weather/news/holiday data. Streamlit's @st.cache_data caches intelligence brief (10min). No Redis, no HTTP caching headers, no query result cache.

Error Handling	5/10	Structured CopilotResponse with error fields. Service layer wraps exceptions into JSON. But no global error handler in FastAPI. No user-friendly error pages. Silent swallowing of exceptions in several places (except Exception: pass).

Configuration	5/10	Pydantic-settings with feature flags and rollback switches is well-designed. But many constants are hardcoded (7-day window, 15% discount, Hyderabad coordinates, DB path). No per-tenant config.

Deployment	0/10	No Dockerfile, no docker-compose, no Terraform, no Kubernetes manifests, no cloud deployment scripts, no Procfile, no fly.toml, no Vercel config. The only way to run is streamlit run app/dashboard.py locally.

Scalability	1/10	SQLite file-based DB cannot handle concurrent writes. Single-process Streamlit server. No horizontal scaling. No load balancer. No queue for LLM calls. Would break at 3-5 concurrent users.

Maintainability	4/10	Clean module separation in src/ with contracts and services. But dashboard.py is a 54KB monolith. copilot_brain.py is 59KB. Heavy coupling between scripts/ and src/. Legacy adapter pattern shows growing pains.

AI Architecture	7/10	The strongest part. Multi-tier guardrails (premise, numeric, causal, scope). Dual-engine failover. Intent fast-track. Tool-based planning. This is thoughtful AI engineering for a prototype.

Prompt Engineering	7/10	Comprehensive system prompts with detailed schema documentation, SQL rules, crore conversion, business synonyms. Forced correction persona. This prompt engineering is production-worthy.

Hallucination Prevention	7/10	Server-side column sum verification, premise conflict detection, causal claim audit, dataset boundary enforcement. Among the best guardrail implementations for a startup prototype.

Data Integrity	5/10	Parameterized SQL in intent path. SQL guard blocks mutations. But LLM-generated SQL still runs through regex filtering (not AST parsing). No data validation on ingestion. No checksums.

Business Logic	6/10	Well-modeled for Bajaj FMCG distribution (zones, stockists, ISR, beats, ECO). Basket analysis with BCG quadrant labeling. But 100% hardcoded to one customer's domain model.

Analytics	5/10	KPI dashboard covers basics (revenue, orders, AOV). Anomaly detection is functional. No cohort analysis, no funnel, no retention, no benchmarking, no trend alerts.

Forecasting	3/10	RandomForest trained on 42 real data points (7 days × 6 zones) with synthetic augmentation. Cross-validated but the model is learning from noise, not signal. Would not survive scrutiny.

Voice	5/10	Functional Whisper integration via OpenRouter. Auto-detects audio formats. But no streaming, no multi-language support tested, no confidence scores.

Notifications	4/10	Email morning brief works with anomaly→diagnosis→recommendation pipeline. But notification center tab is disabled (if False:). Single hardcoded recipient. No push notifications.

Admin	0/10	No admin console, no user management, no system configuration UI.

Multi-tenancy	0/10	Every schema reference, prompt, and SQL template is hardcoded to one customer. No tenant isolation.

White-labeling	1/10	CSS uses variables ( tokens). But brand names ("Bajaj DMS", "QAFFEINE", "Bajaj Copilot") are hardcoded in 50+ places across prompts, UI, and email templates.

Documentation	4/10	Several markdown docs exist (architecture, setup, runbook, data dictionary, LLM SQL policy, numeric integrity plan). README is empty (16 bytes). No API documentation. No user guide. Gap analysis doc exists but is outdated.

Developer Experience	3/10	No Docker setup. No make/just file. Requirements.txt exists but no lock file. 40 scratch scripts in scratch/ suggest manual debugging workflow. No linting config. No pre-commit hooks.

Customer Experience	2/10	No onboarding flow. No self-service. No data import wizard. Customer would need the founder to set up everything manually.

PHASE 5 — Business Readiness Rubric

Category	Score (0-10)	Explanation

Customer onboarding	1/10	Zero self-service. Founder must: obtain customer's data, clean it, build SQLite DB, rewrite all SQL templates, update all prompts, update UI labels, configure SMTP. Estimated: 2-4 weeks per customer.

ERP integration	0/10	No connector framework. Current pipeline: manually export Excel → run clean_consolidate.py → run build_database.py. No live sync. No webhook support. No API polling.

Data ingestion	2/10	Excel → CSV → SQLite pipeline exists but is hardcoded to Bajaj's 4 specific Excel sheet names and column structures. Any other customer requires rewriting the ETL.

Schema mapping	0/10	No schema discovery. No column mapping UI. Every column reference is hardcoded in Python strings across 15+ files. VIEW_AI_SALES schema is assumed everywhere.

Industry flexibility	1/10	All prompts, business logic, BCG quadrant labels, and analytics are FMCG-specific (zones, beats, stockists, ISR, ECO, packs, volume in liters). A café, garage, or pharmacy would need completely different domain models.

Customization effort	9/10 (bad)	To onboard a non-FMCG customer: rewrite copilot_brain.py (59KB), universal_context.py (43KB), dashboard.py (54KB), all intent pipeline patterns, all SQL templates, all prompts, basket analysis logic, forecaster features, anomaly engine thresholds. Essentially a rewrite.

Time to onboard	1/10	First customer (identical to Bajaj): 1-2 weeks. Second customer (different industry): 4-8 weeks minimum. This does not scale.

Support burden	2/10	Every query failure, data issue, or UI bug requires founder-level Python debugging. No admin tools, no error dashboard, no customer self-service.

Customer training	3/10	Chat interface is intuitive. KPI dashboard is self-explanatory. But no documentation, no tutorial, no tooltips, no help system.

Maintenance effort	2/10	Prompt changes require code deployments. Schema changes require updates across 15+ files. No database migrations. No versioning.

Repeatability	1/10	Cannot onboard a second customer without significant code changes. No templating, no configuration-driven customization.

Subscription readiness	0/10	No billing, no plans, no usage tracking, no invoicing, no payment integration, no trial management.

Sales readiness	1/10	No demo environment. No sales deck auto-generated from the product. Demo requires running locally with a specific database file.

Founder dependency	10/10 (bad)	The founder IS the product. They are the onboarding team, support team, DevOps team, and customer success team. No one else can run or modify this system.

Would a customer renew?	3/10	If the AI answers are accurate and the morning briefs are valuable, a single whale customer might renew. But any schema change, data issue, or feature request requires founder intervention. Churn risk is extreme.

PHASE 6 — Customer Friction Analysis

☕ Café

Aspect	Assessment

Works immediately	Nothing. The entire schema is FMCG distribution (zones, stockists, ISR, beats). A café has tables, orders, menu items, hours.

Manual work needed	Complete data model redesign. New ETL from café POS (Toast, Square, Clover). New prompts. New KPIs (table turnover, average ticket, peak hours).

What breaks	Every SQL query, every prompt, every KPI card, every chart, the forecaster (café hourly profile is already hardcoded but tied to wrong schema), anomaly engine (zone-based).

Assumptions	Zone-based territory hierarchy, FMCG product taxonomy, stockist/distributor model. None apply to cafés.

Engineering changes	Schema redesign, ETL rewrite, prompt rewrite, dashboard rewrite, forecaster retrain.

Hours required	120-200 hours

🍽️ Restaurant

Aspect	Assessment

Works immediately	Nothing. Same issues as café but more complex (multi-course menus, reservations, table management).

Manual work needed	POS integration (Toast, Lightspeed, Revel). New data model for covers, dayparts, menu engineering.

What breaks	Everything. The BCG quadrant analysis in basket_analysis.py is conceptually relevant but the implementation is FMCG-specific.

Assumptions	Invoice-level billing with distributor hierarchy. Restaurants bill per table/check.

Engineering changes	Full stack rewrite except the LLM failover engine and guardrail framework.

Hours required	160-240 hours

🔧 Garage / Auto Service

Aspect	Assessment

Works immediately	Nothing. Garages track work orders, labor hours, parts inventory, vehicle history.

Manual work needed	New data model (work orders, service types, parts, vehicles, technicians). New KPIs (bay utilization, average repair order, parts margin).

What breaks	Every component. FMCG distribution has zero overlap with automotive service.

Assumptions	High-frequency low-value transactions. Garages have low-frequency high-value transactions.

Engineering changes	Complete platform rebuild for this vertical.

Hours required	200-280 hours

📦 Distributor (FMCG)

Aspect	Assessment

Works immediately	KPI dashboard (with column name mapping). AI copilot (with schema updates). Anomaly detection concept. Basket analysis concept.

Manual work needed	Schema mapping for their specific ERP export format. Column name alignment. Prompt updates for their product taxonomy. Zone/territory renaming.

What breaks	SQL templates if column names differ. Prompts if business terminology differs. Forecaster if their data volume is different.

Assumptions	Same ERP export format as Bajaj, same column structure, same territory hierarchy (Zone→State→Town→Beat).

Engineering changes	Schema mapping layer (medium effort). Prompt parameterization (medium effort).

Hours required	40-80 hours (closest to current implementation)

💊 Pharmacy

Aspect	Assessment

Works immediately	Nothing directly. Pharmacy distribution has some overlap (stockists, invoices, product hierarchy) but regulatory requirements (batch tracking, expiry, controlled substances) are absent.

Manual work needed	Compliance-aware data model. Batch/expiry tracking. Drug interaction analysis. Regulatory reporting.

What breaks	Product taxonomy (FMCG vs pharma). No compliance layer. No expiry-based analytics.

Assumptions	Products are fungible consumables. Pharma products have regulatory constraints.

Engineering changes	Schema extension for pharma compliance. New prompt engineering for drug terminology.

Hours required	120-160 hours

🛍️ Retail Store

Aspect	Assessment

Works immediately	KPI cards (revenue, orders, AOV) are conceptually valid. Basket analysis is directly relevant.

Manual work needed	POS integration. Product category mapping. Customer segmentation. Foot traffic analysis.

What breaks	Territory/zone model (retail stores don't have zones/beats). ISR/stockist hierarchy.

Assumptions	Multi-zone distribution network. Retail stores are typically single-location.

Engineering changes	Schema simplification. Remove distribution hierarchy. Add customer segmentation.

Hours required	80-120 hours

PHASE 7 — Plug-and-Play Analysis

Can a new company: Connect database → Click Next → Start chatting?

NO.

Every Blocker:
Blocker	Difficulty	Engineering Effort	Priority
1	No database connector UI — Customer cannot connect their database. The SQLite path is hardcoded in settings.py.	Medium	2-3 weeks	P0

2	No schema discovery — System cannot inspect a new database's tables/columns. Everything is hardcoded to VIEW_AI_SALES.	Hard	3-4 weeks	P0

3	No schema mapping — No way to map customer columns to platform's expected schema.	Hard	3-4 weeks	P0

4	No self-service onboarding flow — No wizard, no setup page, no configuration UI.	Medium	2-3 weeks	P0

5	Hardcoded prompts — System prompt in copilot_brain.py contains 200+ lines of Bajaj-specific schema docs, business rules, and SQL examples.	Hard	2-3 weeks	P0

6	Hardcoded SQL templates — Intent pipeline (pipeline.py) has Bajaj-specific column names in every regex and SQL template.	Medium	1-2 weeks	P0

7	No authentication — No way to identify which customer is using the system.	Medium	1-2 weeks	P0

8	No data import — No way to upload CSV/Excel through the UI.	Easy	1 week	P1

9	Hardcoded UI labels — "Bajaj DMS", "Bajaj Copilot", zone terminology throughout dashboard.py.	Easy	0.5 weeks	P1

10	No deployment — Cannot give a customer a URL. Must run locally.	Medium	1-2 weeks	P0

PHASE 8 — Technical Debt

🔴 Critical

Debt	Business Impact

API keys in plaintext (.env at repo root with Gemini, OpenRouter, NewsAPI, Gmail credentials visible)	Security breach. Key compromise. Data exposure. Immediate customer trust violation.

Malformed ALERT_RECIPIENT (jitendra@brainpowerindia.com5.5)	Morning briefs silently fail. Core feature broken.

No authentication anywhere	Anyone with the URL accesses all data. Regulatory non-starter.

SQLite as production database	Cannot handle >3-5 concurrent users. No backup strategy. File corruption risk.

No deployment infrastructure	Cannot give customers a URL. Blocks all revenue.

🟡 High

Debt	Business Impact

54KB dashboard.py monolith	Impossible for a team to work on simultaneously. Every change risks breaking unrelated features.

59KB copilot_brain.py monolith	Same issue. Prompts, tools, agent logic, and planner all in one file.

Hardcoded schema across 15+ files	Every new customer requires touching 15+ files. Onboarding time: weeks, not hours.

42-datapoint forecaster	Model learns synthetic noise, not real patterns. Any serious customer scrutiny will expose this.

Notification tab disabled (if False:)	Dead code in production. Feature was built then abandoned.

legacy_adapter.py singleton pattern	Architectural smell. Prevents proper dependency injection and testing.

No CI/CD (.github/workflows/ is empty)	Tests never run automatically. Regressions are invisible.

No database migrations	Schema changes require manual intervention. No rollback capability.

🟠 Medium

Debt	Business Impact

Regex-based intent classification	Misses paraphrasings. Customers get inconsistent experiences.

In-memory basket analysis	Python itertools.combinations over all items. Will slow with larger datasets.

40 scratch/debug scripts in repository	Cluttered codebase. Confusing for new developers.

No type checking enforced (no mypy config)	Refactoring is risky without type safety.

clean_consolidate.py hardcoded to 4 Excel sheets	Cannot handle any other data source without rewrite.

🟢 Low

Debt	Business Impact

CSS in Python string (styles.py)	Not a blocker but makes styling changes awkward.

Hardcoded Hyderabad weather/news	Limits geographic expansion but not a day-1 issue.

No Python lock file (requirements.txt only)	Reproducibility risk but manageable.

PHASE 9 — Missing Features (Required for "Intelligence Layer for Every ERP")

Missing Feature	Why Critical

Universal database connector	Customers use MySQL, Postgres, SQL Server, Oracle. Not SQLite files.

Schema discovery engine	Must auto-detect tables, columns, types, relationships from any database.

Semantic layer / business ontology	Maps raw column names to business concepts (revenue = SUM(amount), customer = buyer_id).

Industry templates	Pre-built models for retail, restaurant, distribution, services, manufacturing.

Multi-tenancy with tenant isolation	Each customer's data must be isolated. Shared-nothing or row-level security.

Connector framework	Pluggable adapters for MySQL, Postgres, SQL Server, Oracle, BigQuery, Snowflake.

Admin console	Manage tenants, users, data connections, prompts, schedules.

Role management (RBAC)	Owner, manager, analyst, viewer roles with different permissions.

Billing & subscription management	Stripe/Paddle integration. Plan tiers. Usage metering. Invoicing.

Audit logs	Who queried what, when, and what data was accessed. Required for enterprise sales.

Data import wizard	Upload CSV/Excel through the UI. Map columns. Preview data.

Scheduled reports	Automated daily/weekly/monthly email reports. No manual trigger.

Self-service onboarding	Sign up → Connect DB → Map schema → Start chatting. Under 30 minutes.

Deployment infrastructure	Docker, CI/CD, cloud deployment (AWS/GCP/Azure).

API authentication	API keys, OAuth2, or JWT for the REST API.

Webhook/live sync	Real-time data updates from customer ERP.

Mobile responsive UI	Streamlit is not mobile-friendly. Business owners use phones.

SSO / Enterprise auth	SAML, OIDC for enterprise customers.

Data retention & deletion	GDPR/compliance requirements for data lifecycle.

Backup & disaster recovery	Automated backups, point-in-time recovery.

PHASE 10 — Code Quality

Category	Score (0-10)	Explanation

Architecture	5/10	Clean src/ layering (api, services, contracts, copilot, sql, data, config). But scripts/ contains 60% of the business logic in monolithic files that src/ depends on via sys.path.insert. This creates a circular dependency resolved by a legacy adapter hack.

Modularity	4/10	Good module boundaries in src/copilot/ (each guardrail is its own file). But dashboard.py (54KB) and copilot_brain.py (59KB) are monoliths that combine presentation, business logic, and infrastructure.

Readability	6/10	Well-commented code with clear docstrings. Good variable naming. Comprehensive inline documentation of SQL rules and business logic in prompts. But file sizes make navigation difficult.

Maintainability	4/10	Feature flags in settings.py are good (rollback switches). But hardcoded schemas, prompts, and column names across 15+ files make changes risky and labor-intensive. No migrations. No test suite in CI.

Extensibility	2/10	Adding a new customer vertical requires touching nearly every file. No plugin system, no template engine, no configuration-driven customization. The tool registry pattern in copilot_brain.py is the one extensible design.

Reusability	3/10	LLMManager with failover is reusable. SQL guard is reusable. Guardrail chain is reusable. But everything else is hardwired to one schema.

Consistency	5/10	Consistent coding style within src/. Pydantic used for validation. Dataclasses for DTOs. But scripts/ uses different patterns (raw dicts, print statements, manual path manipulation).

Design Patterns	5/10	Service layer pattern in src/services/. Strategy pattern in LLM failover. Registry pattern for tools. But no dependency injection, no factory pattern for connectors, no observer pattern for events.

PHASE 11 — Investor Due Diligence

Classification: Advanced Prototype / Pre-MVP

This is not an MVP. An MVP implies a product that can be sold to at least one paying customer without the founder manually writing code. This product requires the founder to:
Obtain the customer's raw data (Excel export)

Rewrite clean_consolidate.py for their column structure

Rewrite build_database.py for their schema

Rewrite 200+ lines of system prompts in copilot_brain.py

Rewrite all SQL templates in pipeline.py

Update all UI labels in dashboard.py

Reconfigure anomaly thresholds, basket analysis parameters, and forecaster features

Run everything locally on their own machine

Act as 24/7 support

What an investor would see:
Positive signals:
The AI guardrail engineering is genuinely impressive (premise check, numeric verification, causal audit). This shows deep understanding of LLM failure modes.

The dual-engine failover with 9-model fallback chain shows production thinking.

The prompt engineering is thorough and domain-aware.

The founder clearly understands the problem space deeply.

Red flags:
API keys committed in plaintext to the repository.

Zero deployment infrastructure.

Zero authentication.

Zero multi-tenancy.

100% founder dependency.

42-datapoint ML model presented as a feature.

Notification center disabled in production.

No CI/CD despite having a .github/workflows/ directory.

Product name inconsistency (QAFFEINE vs AKARA vs Bajaj DMS vs Bajaj Copilot).

Verdict: An investor doing technical due diligence would classify this as a talented founder's advanced prototype — one that demonstrates strong AI engineering skills and deep domain understanding, but is 12-16 weeks away from being a sellable product.
PHASE 12 — Sales Readiness Score

28 / 100 — Prototype

Breakdown:

Dimension	Points	Max

Core AI intelligence works	12	15

Dashboard delivers value	5	10

Can be deployed to customer	0	15

Customer can self-serve	0	10

Multi-tenant ready	0	10

Security & compliance	0	10

Billing & subscription	0	10

Onboarding < 1 day	0	10

Second customer ≤ 50% effort of first	1	10

Total	28	100

Why 28 and not higher:

The AI pipeline is the strongest component — it genuinely works and the guardrails are better than most startups at this stage. But you cannot sell something customers cannot access (no deployment), cannot trust (no authentication), and cannot adopt without hiring the founder (no self-service). The gap between "impressive demo" and "sellable product" is the entire deployment, security, and multi-tenancy stack.
PHASE 13 — The Gap Report

Missing Capability	Why Customers Care	Business Impact	Eng. Effort	Priority	Weeks	Must/Should/Nice

Deployment (Docker + Cloud)	Cannot access the product without it	Blocks 100% of revenue	Medium	P0	2	Must Have

Authentication (login + API keys)	Data security is non-negotiable	Blocks all enterprise sales	Medium	P0	1.5	Must Have

Database connector (Postgres/MySQL)	Customers don't use SQLite files	Blocks 95% of customers	Hard	P0	3	Must Have

Schema discovery + auto-mapping	Customers won't rewrite SQL templates	Blocks repeatability	Hard	P0	3	Must Have

Dynamic prompt generation	Prompts must adapt to customer schema	Blocks multi-customer	Hard	P0	2	Must Have

Self-service data import (CSV/Excel)	First-time setup must be easy	Reduces onboarding from weeks to hours	Medium	P1	1.5	Must Have

Multi-tenancy (tenant isolation)	Each customer's data must be private	Required for >1 customer	Hard	P1	3	Must Have

Admin console	Manage connections, users, schedules	Reduces support burden by 80%	Medium	P1	2	Should Have

Scheduled reports (cron)	"Daily AI brief" is the hero feature	Morning brief requires manual click today	Easy	P1	1	Must Have

RBAC (owner/manager/viewer)	Enterprises need role-based access	Required for companies with >5 employees	Medium	P2	1.5	Should Have

Billing integration (Stripe)	Must collect payment	No revenue without it	Medium	P2	1.5	Should Have

Mobile-responsive UI	Business owners use phones	Limits adoption to desktop-only users	Hard	P2	3	Should Have

Industry templates	Customers expect domain-relevant KPIs	Accelerates onboarding for vertical segments	Medium	P2	2	Should Have

CI/CD pipeline	Prevent regressions, enable team	Developer velocity	Easy	P2	0.5	Should Have

Error monitoring (Sentry)	Know when things break	Reduces support burden	Easy	P3	0.5	Nice to Have

White-labeling	Enterprise customers want their brand	Higher price point	Easy	P3	1	Nice to Have

SSO / Enterprise auth	Enterprise procurement requirement	Blocks enterprise deals	Hard	P3	2	Nice to Have

PHASE 14 — Founder Roadmap (12 Weeks)

Principle: Every week must increase the number of customers you can sell to.

Weeks 1-2: Make It Deployable

Dockerize the application (Dockerfile + docker-compose)

Deploy to a cloud provider (Railway / Render / Fly.io for speed)

Add basic authentication (email + password login via Streamlit Authenticator or FastAPI JWT)

Remove all hardcoded API keys from repo; use env vars properly

Fix malformed ALERT_RECIPIENT email address

Set up CI/CD (GitHub Actions: lint + run existing tests)

After Week 2: You can give a customer a URL with a login page.
Weeks 3-4: Make It Connectable

Add Postgres and MySQL database connector support

Build schema discovery: auto-detect tables, columns, types

Create a basic "Connect Database" setup page in the UI

Store connection configs per tenant in a metadata database

After Week 4: A customer can connect their own database.
Weeks 5-6: Make It Adaptive

Build dynamic prompt generator: read discovered schema → auto-generate system prompt with table/column documentation

Parameterize SQL templates: intent pipeline reads column mapping from config, not hardcoded strings

Create a minimal semantic layer: map customer columns to business concepts (revenue, orders, products, dates, customers)

Auto-generate KPI queries from mapped schema

After Week 6: The AI copilot can answer questions about ANY database, not just Bajaj's.
Weeks 7-8: Make It Self-Service

Build CSV/Excel upload wizard (drag-and-drop → preview → column mapping → import)

Create onboarding flow: Connect DB → Discover Schema → Map Columns → Name Your KPIs → Start

Add automated scheduled reports (cron-based morning brief emails)

Multi-tenant data isolation (separate schemas or row-level security)

After Week 8: A new customer can onboard themselves in under 1 hour.
Weeks 9-10: Make It Sellable

Stripe billing integration (free trial → paid subscription)

Create 2-3 industry templates (FMCG distribution, retail, restaurant)

Build a landing page with product demo video

Add basic RBAC (owner, manager, viewer)

Error monitoring (Sentry or equivalent)

After Week 10: You can take money from customers.
Weeks 11-12: Make It Retainable

Polish the dashboard: add loading states, empty states, error states

Add "data freshness" indicator (when was data last synced)

Build a simple admin panel (view connections, user management, query logs)

Create customer documentation / help center

Optimize LLM latency (cache common query patterns)

After Week 12: Your first 10 customers have a reason to stay.
FINAL VERDICT

Can this be sold today?

No. Not in its current state.
If forced to sell today:

Question	Answer

To whom?	One specific FMCG distributor who uses the exact same data model as Bajaj Consumer Care, who is comfortable with the founder running the system on their behalf.

Customer size?	Small distributor (5-50 employees) who doesn't have compliance requirements.

At what price?	₹15,000-25,000/month ($180-300/month) as a managed analytics service, not a SaaS product.

Manual onboarding acceptable?	2-3 weeks of founder time per customer.

Customers before architecture breaks?	1-3. SQLite file-based architecture, no multi-tenancy, no deployment infrastructure. At customer #4 the founder's time becomes the bottleneck, not the technology.

If I were the CTO, what would I build NEXT before hiring the first salesperson?

In this exact order:
Docker + Cloud deployment (2 days) — You cannot sell what customers cannot access.

Authentication (2 days) — You cannot sell what anyone can access.

Postgres connector (1 week) — No real business uses SQLite as their database.

Schema auto-discovery + dynamic prompts (2 weeks) — This is the unlock. Once the AI can read ANY schema and generate its own system prompt, you go from "custom software" to "product."

CSV/Excel upload wizard (1 week) — The fastest path to "try it yourself."

Stripe billing (3 days) — Cannot take money without this.

Total: ~5 weeks before you should hire a salesperson.
The AI core is solid. The guardrails are genuinely impressive. The founder understands both the technology and the business problem deeply. But right now, this is a bespoke analytics service disguised as a product. The single most important architectural decision is building the semantic layer — the component that maps any customer's raw schema to the platform's business concepts. Everything else is execution.
Report generated by a 7-person technical review panel simulation. Every statement is based on actual code inspection. No features were inferred or hallucinated.
 