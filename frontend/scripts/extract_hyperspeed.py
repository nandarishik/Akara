import re
import pathlib

md = pathlib.Path(r"c:\Users\Admin\Desktop\BrainPowerInternship\akara\implentation\new ui.md").read_text(
    encoding="utf-8"
)
m = re.search(r"### Full Component Source\s*\n```jsx\n(.*?)```", md, re.DOTALL)
if not m:
    raise SystemExit("block not found")

code = m.group(1)
code = code.replace(
    "const Hyperspeed = ({ effectOptions = DEFAULT_EFFECT_OPTIONS }) => {",
    "type HyperspeedProps = { effectOptions?: typeof DEFAULT_EFFECT_OPTIONS }\n\n"
    "const Hyperspeed = ({ effectOptions = DEFAULT_EFFECT_OPTIONS }: HyperspeedProps) => {",
)
code = code.replace(
    "export default Hyperspeed;",
    "export default Hyperspeed;\nexport { DEFAULT_EFFECT_OPTIONS };",
)

out = pathlib.Path(__file__).resolve().parent.parent / "src" / "components" / "effects" / "Hyperspeed.tsx"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(code, encoding="utf-8")
print(f"wrote {out} ({len(code)} chars)")
