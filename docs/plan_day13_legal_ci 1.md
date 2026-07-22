---
name: Day 13 Legal, CI
overview: Build and wire the Privacy Policy and Terms of Service pages, integrate the Tailwind Typography plugin, add login footer links, and create a GitHub Actions CI workflow that lint-tests the backend and build-checks the frontend on every push to main.
todos:
  - id: tailwind-typography
    content: Install @tailwindcss/typography and add @plugin directive to index.css
    status: completed
  - id: privacy-page
    content: Create akara/frontend/src/pages/PrivacyPage.tsx
    status: completed
  - id: terms-page
    content: Create akara/frontend/src/pages/TermsPage.tsx
    status: completed
  - id: app-routes
    content: Add /privacy and /terms routes to App.tsx (outside ProtectedRoute)
    status: completed
  - id: login-footer
    content: Add Terms/Privacy footer links to LoginPage.tsx
    status: completed
  - id: ci-workflow
    content: Create .github/workflows/ci.yml with backend-lint-test and frontend-build jobs
    status: completed
isProject: false
---

# Day 13 — Privacy Policy + ToS + CI

## Scope

Two tracks, fully implementable in code:

- **Track 1**: Legal pages (`/privacy`, `/terms`) + Tailwind Typography + login footer
- **Track 2**: GitHub Actions CI workflow

Custom domain/SSL and GitHub Secrets are manual external steps (documented as instructions, not code).

---

## Key Deviation from `daywise.md`

The project uses **Tailwind CSS v4** (`tailwindcss@4.3.3` + `@tailwindcss/vite`) — there is no `tailwind.config.js`. The `daywise.md` instruction to add `plugins: [require("@tailwindcss/typography")]` to a config file does **not apply**. Instead:
- Install `@tailwindcss/typography` as a dev dependency
- Add `@plugin "@tailwindcss/typography";` to [`akara/frontend/src/index.css`](akara/frontend/src/index.css)

CI working directories are `akara/backend` and `akara/frontend` (not `backend`/`frontend`) because the git root is `Functional-test2/`.

---

## Track 1 — Legal Pages

### 1. Install Tailwind Typography

```bash
cd akara/frontend
npm add -D @tailwindcss/typography
```

### 2. [`akara/frontend/src/index.css`](akara/frontend/src/index.css) — Modified

Add the plugin import **after** the existing `@import "tailwindcss";` line:

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

### 3. [`akara/frontend/src/pages/PrivacyPage.tsx`](akara/frontend/src/pages/PrivacyPage.tsx) — Created

New public page (no auth required) rendering privacy policy content with Tailwind prose classes.

### 4. [`akara/frontend/src/pages/TermsPage.tsx`](akara/frontend/src/pages/TermsPage.tsx) — Created

New public page rendering terms of service content with Tailwind prose classes.

### 5. [`akara/frontend/src/App.tsx`](akara/frontend/src/App.tsx) — Modified

Add two public routes **outside** `<ProtectedRoute>`, after the `/login` route:

```tsx
<Route path="/privacy" element={<PrivacyPage />} />
<Route path="/terms" element={<TermsPage />} />
```

Also add the two new imports at the top of the file.

### 6. [`akara/frontend/src/pages/LoginPage.tsx`](akara/frontend/src/pages/LoginPage.tsx) — Modified

Add a small footer `<p>` tag inside the `<CardContent>` block, after the submit button, linking to `/terms` and `/privacy`.

---

## Track 2 — GitHub Actions CI

### 7. [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — Created

Two jobs:

**`backend-lint-test`** (`working-directory: akara/backend`):
- Python 3.12, installs `uv`, runs `uv sync --extra dev`
- `uv run ruff check .`
- `uv run pytest tests/ -v --tb=short` (secrets injected from GitHub Actions secrets)

**`frontend-build`** (`working-directory: akara/frontend`):
- Node 20 + pnpm 9
- `pnpm install --frozen-lockfile`
- `pnpm build` (Vite build)
- `pnpm exec tsc --noEmit` (type check)

Cache path: `akara/frontend/pnpm-lock.yaml`

---

## Manual Steps (documented, not in code)

These require external dashboard access — documented as comments in the CI file or in `docs/runbook.md`:

- **Vercel**: Add custom domain → copy CNAME → add DNS record → SSL auto-provisions
- **Railway**: Update `ALLOWED_ORIGINS_RAW` to include custom domain, redeploy
- **GitHub**: Add secrets (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`) under repo → Settings → Secrets and Variables → Actions

---

## Files Changed Summary

| File | Status |
|---|---|
| `akara/frontend/src/index.css` | Modified |
| `akara/frontend/src/pages/PrivacyPage.tsx` | Created |
| `akara/frontend/src/pages/TermsPage.tsx` | Created |
| `akara/frontend/src/App.tsx` | Modified |
| `akara/frontend/src/pages/LoginPage.tsx` | Modified |
| `.github/workflows/ci.yml` | Created |
