"""Extract React Bits components from implementation markdown specs."""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def extract(spec_rel: str, out_tsx: str, out_css: str | None = None) -> None:
    text = (ROOT / spec_rel).read_text(encoding="utf-8")
    m = re.search(r"### Full Component Source\s*\r?\n```(?:jsx|tsx)?\r?\n(.*?)```", text, re.S)
    if not m:
        raise SystemExit(f"No component source in {spec_rel}")
    code = m.group(1)
    tsx_path = ROOT / "frontend" / "src" / "components" / "effects" / out_tsx
    tsx_path.write_text("// @ts-nocheck\n" + code, encoding="utf-8")
    print("wrote", tsx_path)

    css_m = re.search(r"### Component CSS\s*\r?\n```css\r?\n(.*?)```", text, re.S)
    if css_m and out_css:
        css_path = ROOT / "frontend" / "src" / "components" / "effects" / out_css
        css_path.write_text(css_m.group(1), encoding="utf-8")
        print("wrote", css_path)


if __name__ == "__main__":
    extract("implentation/akara copilot.md", "Strands.tsx", "Strands.css")
    extract("implentation/folder.md", "Folder.tsx", "Folder.css")
