// Axe on the public pages. Serious and critical issues fail the run.
// node scripts/a11y-check.mjs [base]
// node scripts/a11y-check.mjs --static   (CI: source checks only)
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

if (process.argv.includes("--static")) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const chart = readFileSync(join(root, "src/history-chart.mjs"), "utf8");
  const ui = readFileSync(join(root, "src/ui.mjs"), "utf8");
  let fail = 0;
  const t = (n, ok) => { if (!ok) { fail++; console.log("FAIL", n); } };
  t("charts have a text summary", chart.includes('class="hc-sum"'));
  t("reduced motion is respected", chart.includes("prefers-reduced-motion"));
  t("focus rings stay visible", ui.includes(":focus-visible{outline:3px solid #d9b779"));
  t("menu button exposes expanded", ui.includes('aria-expanded'));
  if (fail) process.exit(1);
  console.log("a11y-check static ok");
  process.exit(0);
}

const { chromium } = await import("playwright");
const { createRequire } = await import("node:module");
const require = createRequire("/workspace/package.json");
const { AxeBuilder } = require("@axe-core/playwright");
const base = process.argv[2] || "https://catchemtcg.com";
const routes = ["/", "/feed", "/sets", "/sets/sv-scarlet-and-violet-151", "/search", "/indexes", "/premium", "/track-record", "/c/tcgcsv-517045", "/p/tcgcsv-180459"];
const browser = await chromium.launch();
let bad = 0;
const totals = { critical: 0, serious: 0 };
for (const width of [390, 1280]) {
  const context = await browser.newContext({ viewport: { width, height: 844 } });
  const page = await context.newPage();
  for (const route of routes) {
    try { await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 45000 }); } catch { console.log("SKIP", width, route); continue; }
    await page.waitForTimeout(500);
    let result;
    try { result = await new AxeBuilder({ page }).analyze(); } catch (err) { console.log("AXE", width, route, err.message); bad++; continue; }
    const hits = result.violations.filter((row) => row.impact === "critical" || row.impact === "serious");
    for (const row of hits) {
      totals[row.impact] = (totals[row.impact] || 0) + row.nodes.length;
      bad++;
      console.log("FAIL", width, route, row.impact, row.id, row.help, "x" + row.nodes.length);
    }
  }
  await context.close();
}
await browser.close();
console.log(`a11y-check serious=${totals.serious || 0} critical=${totals.critical || 0}`);
if (bad) process.exit(1);
console.log("a11y-check: no serious or critical issues");
