"""Extract Day 1 implementation blocks from handoff doc."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOC = ROOT / "docs2" / "day1_implementation (1).md"
text = DOC.read_text(encoding="utf-8")


def map_path(header: str) -> Path:
    p = header.strip().strip("`")
    if p.startswith("akara/"):
        p = p[6:]
    if p.startswith("migrations/"):
        p = "supabase/" + p
    return ROOT / p


EXTRACT = {
    "backend/app/core/config.py",
    "backend/app/core/errors.py",
    "backend/app/core/pagination.py",
    "backend/app/core/idempotency.py",
    "backend/app/core/time_utils.py",
    "backend/app/core/middleware.py",
    "backend/app/services/llm/openrouter.py",
    "backend/app/services/llm/manager.py",
    "backend/app/api/routes/health.py",
    "backend/app/main.py",
    "backend/.env.example",
    "supabase/migrations/011_billing.sql",
    "frontend/index.html",
    "frontend/src/index.css",
    "frontend/src/components/ui/button.tsx",
    "frontend/src/components/ui/card.tsx",
    "frontend/src/components/ui/badge.tsx",
    "frontend/src/components/ui/toast.tsx",
    "frontend/src/components/ui/skeleton.tsx",
    "frontend/src/components/admin/AdminTable.tsx",
    "frontend/src/components/admin/AdminDrawer.tsx",
    "frontend/src/components/admin/ConfirmDialog.tsx",
    "frontend/src/components/admin/SuperadminShell.tsx",
    "frontend/src/pages/gallery/ComponentGallery.tsx",
    "frontend/src/App.tsx",
    "frontend/.env.example",
    "frontend/src/test/setup.ts",
    "frontend/src/test/fixtures.ts",
    "frontend/src/components/ui/__tests__/button.test.tsx",
    "frontend/playwright.config.ts",
    "frontend/e2e/smoke.spec.ts",
    "backend/tests/conftest.py",
    "backend/tests/test_config.py",
    "backend/tests/test_health.py",
    ".github/workflows/ci.yml",
}


def extract_block(section: str, rel: str) -> str | None:
    if rel == "frontend/vite.config.ts":
        m = re.search(
            r"## Replacement content.*?\n```typescript\n(.*?)```", section, re.DOTALL
        )
        return m.group(1) if m else None
    if rel == "supabase/migrations/MIGRATION_MANIFEST.md":
        m = re.search(r"```markdown\n(.*?)```", section, re.DOTALL)
        return m.group(1) if m else None
    for pattern in (
        r"## Implementation\n\n```(?:python|typescript|tsx|sql|yaml|markdown|ts|html|css|json)?\n(.*?)```",
        r"## Full implementation\n\n```(?:python|typescript|tsx|sql|yaml|markdown|ts|html|css|json)?\n(.*?)```",
        r"## Replacement content \(Phase 2 Day 1\)\n\n```(?:python|typescript|tsx|sql|yaml|markdown|ts|html|css|json)?\n(.*?)```",
    ):
        m = re.search(pattern, section, re.DOTALL)
        if m:
            return m.group(1)
    return None


sections = text.split("# File:")
written: list[tuple[str, int]] = []
missing: list[str] = []

for s in sections[1:]:
    header = s.split("\n", 1)[0].strip().strip("`")
    rel = map_path(header).relative_to(ROOT).as_posix()
    if rel not in EXTRACT and rel != "supabase/migrations/MIGRATION_MANIFEST.md":
        continue
    block = extract_block(s, rel)
    if not block:
        missing.append(rel)
        continue
    out = ROOT / rel
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(block.rstrip() + "\n", encoding="utf-8")
    written.append((rel, len(block.splitlines())))

print(f"Written {len(written)} files")
for r, n in written:
    print(f"  {r}: {n} lines")
if missing:
    print("MISSING:", ", ".join(missing))
