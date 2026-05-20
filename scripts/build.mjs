import { access, mkdir, readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

const requiredFiles = [
  "public/index.html",
  "public/styles.css",
  "public/app.mjs",
  "src/lib/analysis.mjs",
  "src/lib/repertoire.mjs",
  "src/lib/wav.mjs",
];

for (const file of requiredFiles) {
  await access(file);
}

const html = await readFile("public/index.html", "utf8");
const css = await readFile("public/styles.css", "utf8");
const app = await readFile("public/app.mjs", "utf8");

const checks = [
  [html.includes('id="recordButton"'), "record button exists"],
  [html.includes('id="fileInput"'), "file input exists"],
  [html.includes('id="pitchCanvas"'), "pitch canvas exists"],
  [css.includes("--amber") && css.includes("--paper") && css.includes("--ink"), "design tokens exist"],
  [app.includes("analyzePerformance"), "analysis pipeline is wired"],
  [app.includes("MediaRecorder"), "browser recording is wired"],
  [app.includes("loadDemoTake"), "demo take is wired"],
  [app.includes("clearHistory"), "history reset is wired"],
];

const failed = checks.filter(([passes]) => !passes);
if (failed.length) {
  throw new Error(`Build checks failed: ${failed.map(([, label]) => label).join(", ")}`);
}

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

const fingerprint = createHash("sha256").update(html + css + app).digest("hex").slice(0, 10);
await mkdir(join("dist", fingerprint), { recursive: true });

console.log(`Build checks passed (${fingerprint}). Static app entry: public/index.html`);
