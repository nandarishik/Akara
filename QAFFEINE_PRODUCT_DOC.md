# QAFFEINE: Bajaj DMS Intelligence Platform
## Product Documentation

QAFFEINE is an AI-powered business analytics platform designed for the Bajaj Consumer Care distribution network. It acts as an autonomous data analyst, processing natural language queries into accurate, hardened business intelligence.

---

## 1. Product Overview

QAFFEINE serves as a single pane of glass for sales and performance metrics. Instead of relying on static dashboards or writing complex SQL queries, executives and managers can chat with an intelligent Copilot. The platform connects directly to the DMS (Distributor Management System) warehouse and enriches sales data with real-world context (weather, holidays, and news).

### Core Features:
- **Conversational Analytics**: Ask questions in plain English (or via Voice) and receive data-backed answers.
- **Automated Root-Cause Analysis**: When sales drop, the system automatically checks external factors like weather anomalies or market news to explain *why*.
- **Predictive Scenarios**: An integrated "What-If" simulator models how changes in temperature or holidays might impact future revenue.
- **Automated Alerting**: A daily morning brief email summarizes anomalies, highlights power SKU combos, and provides AI-driven diagnoses.

---

## 2. Platform Capabilities

### 2.1 The Agentic Copilot
The AI operates on a rigorous **Plan → Execute → Synthesise** loop:
1. **Plan**: The LLM reads the user query and generates a JSON array of required tool calls (e.g., query database, check weather, read news).
2. **Execute**: The backend runs the planned tools securely.
3. **Synthesise**: A "Senior Analyst" LLM persona digests the raw tool outputs and writes a clear, business-focused narrative, completely free of technical jargon.

### 2.2 Intelligence Hardening
To prevent LLM hallucinations, QAFFEINE employs a strict verification layer (`src/copilot/`):
- **Numeric Verification**: All currency figures mentioned by the AI are checked against the actual `SUM(NET_AMT)` returned by the SQL tool. If the AI invents a number, the system injects a correction footer.
- **Premise Correction**: If a user asks "Why did sales drop on Jan 15th?" but Jan 15th was actually a peak sales day, the system intercepts the query and corrects the user's premise before analyzing.
- **Causal Validation**: If the AI blames a sales drop on weather or holidays, the system checks if those tools actually found relevant disruptions. If not, it adds a disclaimer.

### 2.3 Context & External Signals
- **Weather Engine**: Tracks daily temperature and precipitation for specific zones.
- **Holiday Engine**: Localized tracking of public holidays and festivals.
- **News Engine**: Fetches and digests market headlines, categorizing them as positive, negative, or neutral disruptors.
- *Performance*: External signals are cached in a local `context_intelligence` table to minimize API latency.

### 2.4 Advanced Analytics Engines
- **ML Forecaster**: A Random Forest Regressor trained on historical sales, weather, and calendar features to predict revenue impacts.
- **Market Basket Analysis**: Identifies SKU affinity (Support, Confidence, Lift) and classifies products using a Menu Engineering Matrix (Stars, Plowhorses, Puzzles, Dogs).
- **Anomaly Detection**: A statistical engine that uses rolling-window Z-scores to identify abnormal sales drops, featuring a "sparsity guard" to ignore legitimate store closure days.

### 2.5 Voice Integration
QAFFEINE features a low-latency Voice-to-Text service that utilizes OpenRouter's proxy to the OpenAI Whisper-large-v3 model. This allows users to speak their queries directly into the dashboard for a seamless conversational experience.

---

## 3. System Architecture

### 3.1 Dual-Engine LLM Infrastructure
The platform features an enterprise-grade `LLMManager` that provides automatic failover capabilities.
- **Primary Engine**: Google Gemini (via `google-genai`).
- **Fallback Engine**: OpenRouter (routing to Llama-3 or other large models).
- If the primary engine experiences rate limits (HTTP 429) or timeouts, the system automatically redirects the query to the fallback engine within milliseconds.

### 3.2 Guarded SQL Execution
To ensure database integrity and safety:
- All LLM-generated SQL passes through `src/sql/sql_guard.py`.
- The system enforces read-only `SELECT` queries, blocks unauthorized tables (only allowing `VIEW_AI_SALES` and `context_intelligence`), and injects hard `LIMIT` clauses.
- **Intent Pipeline**: High-confidence, common queries (e.g., "sales trend for last 7 days") bypass the LLM Planner entirely and use ultra-fast, pre-verified SQL templates (`src/intent/pipeline.py`).

### 3.3 Database Schema (`AI_DMS_database.db`)
The core fact table is `VIEW_AI_SALES`, a flattened view designed for fast analytics.
- **Revenue Metric**: Always uses `SUM(NET_AMT)`.
- **Temporal Anchor**: Date queries rely on `SUBSTR(INVOICE_DATE, 1, 10)`. The system operates with a temporal anchor of January 2026.
- **Dimensions**: ZONE, STATE, TOWN, STOCKIEST, BEAT, CUSTOMER, PRODUCT_CLASS, CODE, PRODUCT.

---

## 4. Resilience & Chaos Engineering
QAFFEINE is built for high availability. The project includes a dedicated `Chaos Monkey` test suite (`scripts/chaos_monkey.py`) that intentionally injects systemic failures to verify the platform's self-healing capabilities:
- **API Blackouts**: Simulates 401 Unauthorized or Timeouts on Weather/News APIs to ensure the Copilot degrades gracefully and answers with available data.
- **LLM Failover**: Forces HTTP 429 on Gemini to verify the OpenRouter fallback.
- **Database Locks**: Injects 5-second SQLite write-locks to ensure read queries retry and succeed rather than crashing the UI.

---

## 5. Developer Guide & Onboarding

### Environment Configuration
The platform requires specific API keys to be set in either a local `.env` file or Streamlit secrets:
- `GEMINI_API_KEY`: Primary LLM Engine.
- `OPENROUTER_API_KEY`: Fallback LLM Engine & Voice Transcription.
- `WEATHERAPI_KEY`: Environmental context.
- `NEWS_API_KEY`: Market disruptor context.

### Key Directories
- `app/`: Streamlit dashboard and UI components.
- `scripts/`: Core engines (Copilot, Forecaster, Basket Analysis, Anomaly, Mailer).
- `src/copilot/`: The Intelligence Hardening layer (Premise, Numeric, Causal checks).
- `src/sql/`: Guarded execution and validation.
- `src/intent/`: High-speed template matching pipeline.
- `src/services/`: The integration bridge between the UI and the backend agents.
