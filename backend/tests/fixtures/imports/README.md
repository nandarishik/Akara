# Import parser fixtures (subset of universal-smb benchmark)

These files are copied from `akara/benchmark/universal-smb/datasets/` for fast backend unit tests.

Regenerate:

```bash
cd akara/benchmark/universal-smb
uv run python scripts/sync_backend_fixtures.py
```

| File | Source | Tests |
|------|--------|-------|
| `cafe_primary_sample.csv` | Café primary sheet (first 500 rows) | Column alias + metadata skip |
| `garage_invoices_sample.csv` | Garage parts/labour register sample | Tally/Busy column names |
| `pharmacy_retail_sample.csv` | Pharmacy retail register sample | Marg/pharma columns |

Full-scale datasets remain in `benchmark/universal-smb/datasets/`.
