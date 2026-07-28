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


def write_glass_icons():
    jsx = extract_block("glass icons.md", "Full Component Source", "jsx")
    jsx = jsx.replace(
        "const GlassIcons = ({ items, className }) => {",
        "export type GlassIconColor = keyof typeof GRADIENT_MAPPING;\n\n"
        "export type GlassIconsItem = {\n"
        "  icon: React.ReactElement;\n"
        "  color: GlassIconColor | string;\n"
        "  label: string;\n"
        "  customClass?: string;\n"
        "};\n\n"
        "type GlassIconsProps = {\n"
        "  items: GlassIconsItem[];\n"
        "  className?: string;\n"
        "  columns?: 2 | 3 | 4 | 6;\n"
        "};\n\n"
        "const GlassIcons = ({ items, className, columns = 3 }: GlassIconsProps) => {",
    )
    jsx = jsx.replace("const gradientMapping = {", "export const GRADIENT_MAPPING = {")
    jsx = jsx.replace("gradientMapping[color]", "GRADIENT_MAPPING[color as GlassIconColor]")
    jsx = jsx.replace(
        '<div className={`icon-btns ${className || ''}`}>',
        '<div className={`icon-btns icon-btns--cols-${columns} ${className || ""}`}>',
    )
    jsx = "import type React from 'react';\nimport './GlassIcons.css';\n\n" + jsx.split("import './GlassIcons.css';")[-1]
    (EFFECTS / "GlassIcons.tsx").write_text(jsx, encoding="utf-8")

    css = extract_block("glass icons.md", "Component CSS", "css")
    css += "\n.icon-btns--cols-2 { grid-template-columns: repeat(2, 1fr); }\n"
    css += ".icon-btns--cols-3 { grid-template-columns: repeat(2, 1fr); }\n"
    css += ".icon-btns--cols-4 { grid-template-columns: repeat(2, 1fr); }\n"
    css += ".icon-btns--cols-6 { grid-template-columns: repeat(2, 1fr); }\n"
    css += "@media (min-width: 768px) {\n"
    css += "  .icon-btns--cols-3 { grid-template-columns: repeat(3, 1fr); }\n"
    css += "  .icon-btns--cols-4 { grid-template-columns: repeat(4, 1fr); }\n"
    css += "  .icon-btns--cols-6 { grid-template-columns: repeat(3, 1fr); }\n"
    css += "}\n@media (min-width: 1024px) {\n"
    css += "  .icon-btns--cols-6 { grid-template-columns: repeat(6, 1fr); }\n"
    css += "}\n"
    (EFFECTS / "GlassIcons.css").write_text(css, encoding="utf-8")


def write_border_glow():
    jsx = extract_block("borderglow.md", "Full Component Source", "jsx")
    jsx = "import type { CSSProperties, ReactNode } from 'react';\n" + jsx.split("import { useRef", 1)[-1]
    jsx = jsx.replace("import { useRef, useCallback, useEffect } from 'react';", "import { useRef, useCallback, useEffect } from 'react';\n")
    jsx = jsx.replace(
        "const BorderGlow = ({",
        "export type BorderGlowProps = {\n"
        "  children: ReactNode;\n"
        "  className?: string;\n"
        "  edgeSensitivity?: number;\n"
        "  glowColor?: string;\n"
        "  backgroundColor?: string;\n"
        "  borderRadius?: number;\n"
        "  glowRadius?: number;\n"
        "  glowIntensity?: number;\n"
        "  coneSpread?: number;\n"
        "  animated?: boolean;\n"
        "  colors?: string[];\n"
        "  fillOpacity?: number;\n"
        "  style?: CSSProperties;\n"
        "};\n\n"
        "const BorderGlow = ({",
    )
    jsx = jsx.replace("  fillOpacity = 0.5,\n}) => {", "  fillOpacity = 0.5,\n  style: styleProp,\n}: BorderGlowProps) => {")
    jsx = jsx.replace(
        "      style={{\n        '--card-bg': backgroundColor,",
        "      style={{\n        ...styleProp,\n        '--card-bg': backgroundColor,",
    )
    jsx = jsx.replace("function parseHSL", "export function parseHSL")
    (EFFECTS / "BorderGlow.tsx").write_text(jsx, encoding="utf-8")
    css = extract_block("borderglow.md", "Component CSS", "css")
    (EFFECTS / "BorderGlow.css").write_text(css, encoding="utf-8")


if __name__ == "__main__":
    EFFECTS.mkdir(parents=True, exist_ok=True)
    write_glass_icons()
    write_border_glow()
    print("extracted GlassIcons + BorderGlow")
