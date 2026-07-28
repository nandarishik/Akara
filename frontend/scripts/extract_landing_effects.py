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


def write_component(name: str, md_path: str, ts_header: str = "", ts_footer: str = ""):
    jsx = extract_block(md_path, "Full Component Source", "jsx")
    css = extract_block(md_path, "Component CSS", "css")
    (EFFECTS / f"{name}.tsx").write_text(ts_header + jsx + ts_footer, encoding="utf-8")
    (EFFECTS / f"{name}.css").write_text(css, encoding="utf-8")
    print(f"extracted {name}")


if __name__ == "__main__":
    EFFECTS.mkdir(parents=True, exist_ok=True)

    write_component(
        "SpecularButton",
        "new button.md",
        "// @ts-nocheck\nimport { useRef, useEffect } from 'react';\n",
    )

    write_component(
        "Prism",
        "prism.md",
        "// @ts-nocheck\n",
    )

    dec = extract_block("hero text decrypt.md", "Full Component Source", "jsx")
    dec = dec.replace(
        "export default function DecryptedText({",
        "export type DecryptedTextProps = {\n"
        "  text: string;\n"
        "  speed?: number;\n"
        "  maxIterations?: number;\n"
        "  sequential?: boolean;\n"
        "  revealDirection?: 'start' | 'end' | 'center';\n"
        "  useOriginalCharsOnly?: boolean;\n"
        "  characters?: string;\n"
        "  className?: string;\n"
        "  parentClassName?: string;\n"
        "  encryptedClassName?: string;\n"
        "  animateOn?: 'view' | 'hover' | 'inViewHover' | 'click';\n"
        "  clickMode?: 'once' | 'toggle';\n"
        "  delayMs?: number;\n"
        "};\n\n"
        "export default function DecryptedText({",
    )
    dec = dec.replace(
        "  clickMode = 'once',\n  ...props\n}) {",
        "  clickMode = 'once',\n  delayMs = 0,\n  ...props\n}: DecryptedTextProps) {",
    )
    (EFFECTS / "DecryptedText.tsx").write_text(dec, encoding="utf-8")

    pay = extract_block("payment cards.md", "Full Component Source", "jsx")
    pay_css = extract_block("payment cards.md", "Component CSS", "css")
    (EFFECTS / "ReflectiveCard.css").write_text(pay_css, encoding="utf-8")
    (EFFECTS / "ReflectiveCard.tsx").write_text(pay, encoding="utf-8")

    print("done")
