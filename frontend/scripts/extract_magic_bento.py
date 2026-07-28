import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
IMPL = ROOT.parent / "implentation"
EFFECTS = ROOT / "src" / "components" / "effects"


def extract_block(md_path: str, heading: str, lang: str) -> str:
    md = (IMPL / md_path).read_text(encoding="utf-8")
    pattern = rf"### {re.escape(heading)}\s*\n```{lang}\n(.*?)```"
    m = re.search(pattern, md, re.DOTALL)
    if not m:
        raise SystemExit(f"block not found: {heading} in {md_path}")
    return m.group(1)


if __name__ == "__main__":
    jsx = extract_block("dahsboard preview.md", "Full Component Source", "jsx")
    css = extract_block("dahsboard preview.md", "Component CSS", "css")
    jsx = "// @ts-nocheck\n" + jsx.replace(
        "const cardData = [",
        "export const DEFAULT_BENTO_ITEMS = [",
    ).replace(
        "const MagicBento = ({",
        "const MagicBento = ({\n  items = DEFAULT_BENTO_ITEMS,",
    ).replace(
        "{cardData.map((card, index) => {",
        "{items.map((card, index) => {",
    )
    (EFFECTS / "MagicBento.tsx").write_text(jsx, encoding="utf-8")
    (EFFECTS / "MagicBento.css").write_text(css, encoding="utf-8")
    print("extracted MagicBento")
