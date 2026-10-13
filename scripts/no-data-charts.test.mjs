// Site-wide: "No data" never appears on any chart or page we render.
import { readdirSync, readFileSync } from "node:fs";
let fail = 0;
for (const f of readdirSync(new URL("../src/", import.meta.url))) {
  if (!f.endsWith(".mjs")) continue;
  const s = readFileSync(new URL(`../src/${f}`, import.meta.url), "utf-8");
  if (/no\s+data|no\s+daily\s+points/i.test(s)) { console.error(`FAIL ${f} contains "No data" or "No daily points"`); fail++; }
}
const { historyChart, HISTORY_JS } = await import("../src/history-chart.mjs");
const h = historyChart([["2026-09-01", 10], ["2026-09-02", 11], ["2026-09-20", 12], ["2026-09-21", 13]]);
if (/no\s+data|no\s+daily\s+points/i.test(h + HISTORY_JS)) { console.error("FAIL gapped chart says No data"); fail++; }
if (/stroke-dasharray/.test(HISTORY_JS)) { console.error("FAIL price line should be solid"); fail++; }
if (fail) process.exit(1); else console.log("no-data charts ok");
