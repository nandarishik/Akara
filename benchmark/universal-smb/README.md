# Akara Universal SMB Ingestion & Reasoning Benchmark

Production-grade synthetic datasets simulating six months of messy Indian SMB exports for three businesses:

- **Café** (`cafe_brewlab`) — Petpooja-style cloud POS
- **Garage** (`garage_autocare`) — Workshop / Tally hybrid
- **Pharmacy** (`pharmacy_medplus`) — Marg ERP-style retail

Date window: **2026-01-01 → 2026-06-30** (INR, GST, Indian locale).

This benchmark tests **two layers**:

1. **Parser / ingestion** — column-agnostic CSV/XLSX parsing, header detection, alias mapping, normalization across industry-specific exports (café POS, garage job cards, pharmacy registers).
2. **Copilot reasoning** — 30 analytical questions with canonical ground truth.

## Quick start

```bash
cd akara/benchmark/universal-smb

uv sync --extra dev

# Generate canonical DBs + messy datasets + ground truth
uv run python -m generator

# Parser regression (no API, no LLM) — primary evaluation for import pipeline
$env:PYTHONPATH="..\..\backend;."
uv run pytest tests/test_parser_regression.py tests/test_messiness.py tests/test_ground_truth.py -v

# Parser-only harness scorecard
uv run python -m harness.run_benchmark --parser-only

# Sync 500-row samples to backend/tests/fixtures/imports/
uv run python scripts/sync_backend_fixtures.py

# Full harness (parser + API import + copilot)
$env:BENCHMARK_JWT="<admin-jwt>"
uv run python -m harness.run_benchmark --base-url http://localhost:8000
```

## Directory layout

| Path | Purpose |
|------|---------|
| `generator/` | Reproducible generators (seed=42) |
| `canonical/` | SQLite ground-truth DBs (gitignored, regenerated) |
| `datasets/` | Messy CSV/XLSX exports |
| `questions/` | 30 analytical questions (10 per business) |
| `ground_truth/` | `compute.py` + `answers.json` |
| `harness/` | Import + copilot evaluation runner |
| `manifest.yaml` | File inventory, import flags, stress-test tags |

## Ground truth

Answers are computed **only** from canonical SQLite — never by re-parsing messy files. Regenerate:

```bash
uv run python -m ground_truth.compute
```

## Evaluation layers

| Layer | Weight | Measured by |
|-------|--------|-------------|
| **Parser / ingestion** | 30% | `harness/parser_metrics.py` — parse success, required column recovery, row counts |
| **Normalization** | 20% | Required + optional canonical field recovery per file |
| Copilot answers | 40% | Numeric tolerance vs ground truth |
| Cross-file (Q7–Q10) | 10% | Questions requiring non-imported files |

### Parser stress cases included

- Petpooja metadata rows (3-line header skip)
- Synonym columns: `Buyer`, `WEB_BILLNO`, `NET SALES`, `Voucher No`, `Consumer`, `Drug Name`
- Section headers inside CSV (`--- INSURANCE JOBS ---`)
- Duplicate / partial-duplicate rows
- Deprecated overflow columns (`OLD_SKU`, `legacy_flag`)
- Multi-sheet Excel (28 café sheets; garage 4 sheets)

### Known parser edge case

Using `Customer Name` as a header triggers a false metadata match in `detector.py` (phrase `"to"` matches inside `"customer"`). Primary café import sheet uses `Buyer` instead; other sheets retain varied synonyms for stress testing.

## Known expected failures

- Inventory/wastage/shift sheets are **not** auto-recommended by Akara's sheet scorer
- Garage/pharmacy-specific fields often land in `raw_data` JSONB
- Cross-file questions (Q7–Q10) require data not in `sales_data` unless manually imported

## CI

- **PR:** parser-only tests on fixture subset (`tests/test_parser_regression.py`)
- **Nightly:** full harness with `BENCHMARK_*` secrets (manual workflow)

See [`.github/workflows/benchmark-parser.yml`](../../.github/workflows/benchmark-parser.yml) (PR) and [`benchmark-nightly.yml`](../../.github/workflows/benchmark-nightly.yml) (scheduled full harness).

### Makefile targets

```bash
make generate      # canonical DBs + datasets + ground truth
make test          # all benchmark tests (parser + ground truth)
make parser-only   # harness scorecard, no API
make benchmark     # full harness (requires BENCHMARK_JWT)
make sync-fixtures # copy 500-row samples to backend/tests/fixtures/imports/
```
