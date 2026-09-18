.PHONY: dev-api dev-web test test-unit test-integration lint format migrate

dev-api:
	cd backend && uvicorn app.main:app --reload

dev-web:
	cd frontend && pnpm dev

test:
	cd backend && uv run pytest tests/ -q
	cd frontend && pnpm test --run

test-unit:
	cd backend && uv run pytest tests/unit/ -q

test-integration:
	cd backend && uv run pytest tests/smoke/ tests/test_phase05_contracts.py tests/test_phase06_cafe.py tests/test_phase07_12_contracts.py -q

lint:
	cd backend && uv run ruff check .
	cd frontend && pnpm lint

format:
	cd backend && uv run ruff format .
	cd frontend && pnpm exec prettier --write src/

migrate:
	@echo "Apply migrations via Supabase dashboard or: supabase db push"
