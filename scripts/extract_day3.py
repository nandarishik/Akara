"""Extract Day 3 implementation blocks from handoff doc."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOC = ROOT / "implementation_sprint2" / "day3_implementation 2.md"
text = DOC.read_text(encoding="utf-8")


def map_path(header: str) -> Path:
    p = header.strip().strip("`")
    if p.startswith("akara/"):
        p = p[6:]
    if p.startswith("migrations/"):
        p = "supabase/" + p
    return ROOT / p


def extract_block(section: str) -> str | None:
    for marker in [
        r"## Complete File \(Day 3 State\)\n\n```(?:python|typescript|tsx|sql|json|html|xml|txt|svg)?\n(.*?)```",
        r"## Exact Day 3 Implementation\n\n```(?:python|typescript|tsx|sql|json|html|xml|txt|svg)?\n(.*?)```",
    ]:
        m = re.search(marker, section, re.DOTALL)
        if m:
            return m.group(1)
    return None


sections = re.split(r"# §\d+ — File: `([^`]+)`", text)
written: list[str] = []
missing: list[str] = []

# sections[0] is preamble; then pairs of (path, content)
for i in range(1, len(sections), 2):
    header = sections[i]
    section = sections[i + 1]
    rel = map_path(header).relative_to(ROOT).as_posix()
    block = extract_block(section)
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
