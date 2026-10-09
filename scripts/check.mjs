// Release checks: syntax, manifest references, and the catalog against fixtures.
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import vm from "node:vm";

const root = new URL("..", import.meta.url).pathname;
const failures = [];
const fail = (message) => failures.push(message);

const manifest = JSON.parse(readFileSync(`${root}manifest.json`, "utf8"));
const referenced = new Set([
  ...Object.values(manifest.icons),
  ...Object.values(manifest.action.default_icon),
  manifest.action.default_popup,
  ...manifest.content_scripts.flatMap((entry) => [...(entry.js || []), ...(entry.css || [])])
]);
for (const file of referenced) if (!existsSync(`${root}${file}`)) fail(`manifest references missing ${file}`);

const popupPath = `${root}${manifest.action.default_popup}`;
const popup = existsSync(popupPath) ? readFileSync(popupPath, "utf8") : "";
for (const [, src] of popup.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const path = new URL(src, `file://${root}${manifest.action.default_popup}`).pathname;
  if (!src.startsWith("http") && !existsSync(path)) fail(`popup references missing ${src}`);
}

for (const file of [...referenced].filter((name) => name.endsWith(".js")).concat(["src/popup/popup.js"])) {
  if (!existsSync(`${root}${file}`)) continue;
  try {
    execFileSync(process.execPath, ["--check", `${root}${file}`]);
  } catch (error) {
    fail(`syntax error in ${file}: ${error.stderr}`);
  }
}

const context = vm.createContext({ console });
context.globalThis = context;
vm.runInContext(readFileSync(`${root}src/content/namespace.js`, "utf8"), context);
vm.runInContext(readFileSync(`${root}src/content/catalog.js`, "utf8"), context);
vm.runInContext(readFileSync(`${root}dev/fixtures.js`, "utf8").replace("window.MODELCADE_FIXTURES", "globalThis.FIXTURES"), context);
const { catalog } = context.Modelcade;
for (const [name, snapshot] of Object.entries(context.FIXTURES)) {
  const model = catalog.toViewModel(snapshot);
  if (!catalog.isUseful(model)) fail(`${name}: not useful`);
  if (model.stops[model.stopIndex]?.id !== snapshot.selectedStopId) fail(`${name}: selected stop mismatch`);
  if (!model.models[model.modelIndex]?.selected) fail(`${name}: selected model mismatch`);
  console.log(`${name.padEnd(14)} ${model.surface} models=${model.models.map((m) => `${m.family}:${m.name}${m.version ? "@" + m.version : ""}`).join(",")}`);
  console.log(`${"".padEnd(14)} stops=${model.stops.map((s) => `${s.short}/${s.family}${s.special ? "!" + s.special : ""}${s.modelChanges ? "^" : ""}`).join(" ")} tiers=${model.tiers.map((t) => t.label).join("/")}`);
}

if (failures.length) {
  console.error(`\n${failures.length} problem(s):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("\nAll checks passed.");
