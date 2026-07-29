/**
 * Install Bklit chart components from the shadcn registry without scanning parent dirs.
 * Usage: node scripts/install-bklit.mjs [@bklit/area-chart ...]
 */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");
const REGISTRY_BASE = "https://ui.bklit.com/r";

const DEFAULT_COMPONENTS = [
  "area-chart",
  "bar-chart",
  "funnel-chart",
  "gauge-chart",
  "heatmap-chart",
  "radar-chart",
  "ring-chart",
  "line-chart",
  "projection-line",
  "profit-loss-line",
];

const installed = new Set();
const npmDeps = new Set();
const filesToWrite = [];

async function fetchRegistry(name) {
  const slug = name.replace(/^@bklit\//, "");
  const url = `${REGISTRY_BASE}/${slug}.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  return res.json();
}

function resolveTargetPath(target) {
  // registry targets like "components/charts/foo.tsx" -> src/components/charts/foo.tsx
  const normalized = target.replace(/^components\//, "");
  return join(SRC, normalized);
}

async function installComponent(slug) {
  const key = slug.replace(/^@bklit\//, "");
  if (installed.has(key)) return;
  installed.add(key);

  console.log(`Fetching @bklit/${key}...`);
  const item = await fetchRegistry(key);

  if (item.registryDependencies) {
    for (const dep of item.registryDependencies) {
      await installComponent(dep);
    }
  }

  if (item.dependencies) {
    for (const dep of item.dependencies) {
      npmDeps.add(dep);
    }
  }

  if (item.files) {
    for (const file of item.files) {
      const outPath = resolveTargetPath(file.target || file.path);
      filesToWrite.push({ path: outPath, content: file.content });
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const components =
    args.length > 0
      ? args.map((a) => a.replace(/^@bklit\//, ""))
      : DEFAULT_COMPONENTS;

  for (const c of components) {
    await installComponent(c);
  }

  // Dedupe files by path (later installs win)
  const byPath = new Map();
  for (const f of filesToWrite) {
    byPath.set(f.path, f.content);
  }

  for (const [path, content] of byPath) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf8");
    console.log(`Wrote ${path.replace(ROOT, "")}`);
  }

  // Write index re-export for @bklitui/ui/charts compatibility
  const chartsDir = join(SRC, "components", "charts");
  const indexPath = join(chartsDir, "index.ts");
  const exports = [];
  for (const f of [...byPath.keys()].sort()) {
    if (!f.endsWith(".tsx") && !f.endsWith(".ts")) continue;
    if (f.endsWith("index.ts")) continue;
    const rel = f.replace(chartsDir + "\\", "").replace(chartsDir + "/", "");
    const base = rel.replace(/\.tsx?$/, "");
    if (base.includes("-loading")) continue;
    exports.push(`export * from "./${base.replace(/\\/g, "/")}";`);
  }
  const uniqueExports = [...new Set(exports)].sort().join("\n");
  await writeFile(
    indexPath,
    `/** Auto-generated Bklit chart re-exports */\n${uniqueExports}\n`,
    "utf8"
  );
  console.log(`Wrote ${indexPath.replace(ROOT, "")}`);

  // Merge deps into package.json
  const pkgPath = join(ROOT, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  pkg.dependencies = pkg.dependencies || {};
  for (const dep of npmDeps) {
    const at = dep.lastIndexOf("@");
    const name = at > 0 ? dep.slice(0, at) : dep;
    const version = at > 0 ? dep.slice(at + 1) : "latest";
    if (!pkg.dependencies[name]) {
      pkg.dependencies[name] = version;
    }
  }
  // Ensure common peers
  const peers = {
    "@visx/curve": "4.0.1-alpha.0",
    "@visx/gradient": "4.0.1-alpha.0",
    "@visx/shape": "4.0.1-alpha.0",
    "@visx/scale": "4.0.1-alpha.0",
    "@visx/responsive": "4.0.1-alpha.0",
    "@visx/pattern": "4.0.1-alpha.0",
    "@number-flow/react": "^0.5.9",
    "d3-array": "^3.2.4",
    "d3-shape": "^3.2.0",
  };
  for (const [name, version] of Object.entries(peers)) {
    if (!pkg.dependencies[name]) pkg.dependencies[name] = version;
  }
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  console.log(`Updated package.json with ${npmDeps.size} registry deps`);
  console.log("Run: pnpm install");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
