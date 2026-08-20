# Contributing

1. Branch from `main` (or use the agreed feature branch).
2. Keep changes focused — one concern per PR when possible.
3. Run backend tests: `cd backend && uv run pytest tests/ -q`
4. Run frontend checks: `cd frontend && pnpm lint && pnpm test --run && pnpm build`
5. Do not commit `.env`, `.env.local`, or secrets.
6. Update ops docs under `docs/operations/` when deploy/cron behavior changes.

Historical sprint logs live in `.archive/` — prefer updating active docs, not archived day plans.
