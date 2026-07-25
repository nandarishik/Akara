.PHONY: generate export test parser-only benchmark sync-fixtures

generate:
	uv run python -m generator

export:
	uv run python -m generator.export_messy

test:
	PYTHONPATH=../../backend:. uv run pytest tests/ -v

parser-only:
	PYTHONPATH=../../backend:. uv run python -m harness.run_benchmark --parser-only

benchmark:
	PYTHONPATH=../../backend:. uv run python -m harness.run_benchmark --base-url $(or $(BENCHMARK_BASE_URL),http://localhost:8000)

sync-fixtures:
	uv run python scripts/sync_backend_fixtures.py

ground-truth:
	uv run python -m ground_truth.compute
