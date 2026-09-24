# Café BrewLab golden dataset (Phase 9)

## Purpose

50 café Q&A prompts for Promptfoo + `make run-cafe-benchmark` (≥75% gate).

## Files

| File | Owner | Notes |
|---|---|---|
| `questions.yaml` | DEV2 | `cafe_q01`–`cafe_q50` only; no expected numbers |
| `expected_outputs.yaml` | DEV1 | join by `id`; `expected_fact` for asserts |
| `promptfooconfig.yaml` | DEV2 | live `POST /copilot/chat` + body `question` |
| `results/` | CI artifact | do not commit live JWT or secrets |

## Category counts (Partial vs constitution over-count)

8 revenue + 6 food_cost + 6 channel + 5 daypart + 6 item + 6 trend + 4 discount_refund + 5 labour + **2** edge_null + **2** ambiguous = **50**.

## How to add a question

1. Pick next free id (do not exceed cafe_q50 without contract amendment).
2. Set `category` from the enum in the Shared Integration Contract.
3. Ask DEV1 to add matching `expected_outputs.yaml` row.
4. Never put API keys, JWTs, or tenant PII in YAML.

## Run locally

```powershell
cd benchmark
# requires promptfoo + running API + TEST_TENANT_JWT
make run-cafe-benchmark
```

Gate: `check_gate.py` exits 1 if accuracy < 75%.
