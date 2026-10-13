// Every plotted price series is daily with no gap over 1 day. Missing days carry the last real price.
import { readFileSync } from "node:fs";
import { fillDaily, historyChart, mergeHistory } from "../src/history-chart.mjs";
let fail = 0;
const DAY = 86400000;
function maxGap(dates) { let g = 0; for (let i = 1; i < dates.length; i++) g = Math.max(g, (Date.parse(dates[i]) - Date.parse(dates[i - 1])) / DAY); return g; }
const sample = mergeHistory([["2026-09-25", 378.72], ["2026-09-27", 381.71], ["2026-10-03", 384.58]], "20000:10,20007:11,20090:12");
const filled = fillDaily(sample);
if (maxGap(filled.map((p) => p[0])) > 1) { console.error("FAIL fillDaily left a gap"); fail++; }
const carried = filled.find((p) => p[0] === "2026-09-30");
if (!carried || carried[1] !== 381.71 || carried[3] !== "2026-09-27") { console.error("FAIL carried day should hold the last real price and date", carried); fail++; }
if (filled[0][0] !== sample[0][0]) { console.error("FAIL line must start at the first real price"); fail++; }
const html = historyChart(sample);
const pts = JSON.parse(html.match(/data-pts="([^"]*)"/)[1].replace(/&quot;/g, '"'));
if (maxGap(pts.map((p) => p[0])) > 1) { console.error("FAIL historyChart plotted a gap"); fail++; }
if (/stroke-opacity="\.22"|Missing days show as gaps|Faded stretches/.test(html + readFileSync(new URL("../src/history-chart.mjs", import.meta.url), "utf8"))) { console.error("FAIL gap styling still present"); fail++; }
// The client chart (set index charts, quick view) fills the same way.
const ui = readFileSync(new URL("../src/ui.mjs", import.meta.url), "utf8");
const src = ui.match(/function catchemPoints\(raw\)\{[\s\S]*?\n  return full;\n\}/);
if (!src) { console.error("FAIL catchemPoints does not fill days"); fail++; }
else {
  const catchemPoints = new Function(src[0] + "; return catchemPoints;")();
  const out = catchemPoints([["2026-09-25", 100], ["2026-10-12", 120]]);
  if (out.length !== 18 || maxGap(out.map((p) => p.d)) > 1 || out[5].f !== "2026-09-25") { console.error("FAIL client fill", out.length); fail++; }
}
if (fail) process.exit(1); else console.log("chart no-gaps ok");
