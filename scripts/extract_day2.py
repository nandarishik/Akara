"""Extract Day 2 implementation blocks from handoff doc."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOC = ROOT / "implementation_sprint2" / "day2_implementation.md"
text = DOC.read_text(encoding="utf-8")

# Only extract files that were missing or need full replacement from updated handoff
EXTRACT_ONLY = {
    "frontend/src/components/billing/UsageBanner.tsx",
    "frontend/src/components/billing/TrialWarning.tsx",
    "frontend/src/components/billing/PastDueBanner.tsx",
    "frontend/src/pages/admin/CostDiagnostics.tsx",
    "frontend/src/App.tsx",
    "frontend/src/components/billing/__tests__/UsageBanner.test.tsx",
    "backend/tests/test_billing_endpoint.py",
}


def map_path(header: str) -> Path:
    p = header.strip().strip("`")
    if p.startswith("akara/"):
        p = p[6:]
    if p.startswith("migrations/"):
        p = "supabase/" + p
    return ROOT / p


def extract_block(section: str, rel: str) -> str | None:
    markers = [
        r"Complete file \(replace entire Day 1 version\):\n\n```(?:python|typescript|tsx)?\n(.*?)```",
        r"The complete file \(replace the entire Day 1 version\):\n\n```(?:python|typescript|tsx)?\n(.*?)```",
        r"The complete file state after Day 2:\n\n```(?:python|typescript|tsx)?\n(.*?)```",
    ]
    for marker in markers:
        m = re.search(marker, section, re.DOTALL)
        if m:
            return m.group(1)

    m = re.search(
        r"## Implementation\n\n```(?:python|typescript|tsx|sql|yaml|markdown|ts|html|css|json)?\n(.*?)```",
        section,
        re.DOTALL,
    )
    return m.group(1) if m else None


sections = text.split("# File:")
written: list[str] = []
missing: list[str] = []

for s in sections[1:]:
    header = s.split("\n", 1)[0].strip().strip("`")
    rel = map_path(header).relative_to(ROOT).as_posix()
    if rel not in EXTRACT_ONLY:
        continue
    block = extract_block(s, rel)
    if not block:
        missing.append(rel)
        continue
    out = ROOT / rel
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(block.rstrip() + "\n", encoding="utf-8")
    written.append(rel)

print(f"Written {len(written)} files")
for r in written:
    print(f"  {r}")
if missing:
    print("MISSING:", ", ".join(missing))
