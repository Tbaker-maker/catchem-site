// Every plotted price series is daily with no gap over 1 day. Missing days carry the last real price.
import { readFileSync } from "node:fs";
import { fillDaily, historyChart, mergeHistory, HISTORY_JS } from "../src/history-chart.mjs";
import { renderCard } from "../src/ui.mjs";
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
const priceZero = fillDaily([["2026-10-01", 0], ["2026-10-02", 5], ["2026-10-03", 6]]);
if (priceZero.some((p) => p[0] === "2026-10-01") || priceZero[0][1] !== 5) { console.error("FAIL a price of 0 is not a point", priceZero); fail++; }
if (/A missing night is a gap/.test(ui)) { console.error("FAIL product copy still says a missing night is a gap"); fail++; }
if (!/snap==="real"/.test(HISTORY_JS) || !/return !p\[3\]/.test(HISTORY_JS)) { console.error("FAIL hover does not snap to real dates only"); fail++; }
const page = renderCard({
  id: "tcgcsv-1",
  name: "Test Box",
  kind: "sealed",
  set: "Test",
  price: 10,
  asOf: "2026-10-12",
  hist: [["2026-10-01", 10], ["2026-10-12", 12]],
}, "stamp", {
  listingSeries: [
    { date: "2026-10-01", listingCount: 40 },
    { date: "2026-10-03", listingCount: 36 },
    { date: "2026-10-05", listingCount: 0 },
    { date: "2026-10-12", listingCount: 30 },
  ],
});
if (/A missing night is a gap|No data|Missing days show as gaps/i.test(page)) { console.error("FAIL listings chart still has gap or no-data copy"); fail++; }
const fig = page.match(/<figure class="hc" data-unit="count" data-snap="real" data-pts="([^"]*)"[\s\S]*?<\/figure>/);
if (!fig) { console.error("FAIL sealed page has no listings-counted chart"); fail++; }
else {
  const about = fig[0];
  if (!about.includes("eBay listings counted") || !about.includes("carry the last real count forward") || !about.includes("details class=\"hc-about\"") || !about.includes(">About this chart<")) { console.error("FAIL listings chart note is not in About"); fail++; }
  if (/\u2014/.test(about)) { console.error("FAIL em dash in listings chart"); fail++; }
  if (/\bsupply\b/i.test(about)) { console.error("FAIL listings chart says supply"); fail++; }
  const counted = JSON.parse(fig[1].replace(/&quot;/g, '"'));
  if (maxGap(counted.map((p) => p[0])) > 1) { console.error("FAIL listings chart left a gap"); fail++; }
  const held = counted.find((p) => p[0] === "2026-10-02");
  const zero = counted.find((p) => p[0] === "2026-10-05");
  if (!held || held[1] !== 40 || held[3] !== "2026-10-01") { console.error("FAIL carried night should hold the last real count", held); fail++; }
  if (!zero || zero[1] !== 0 || zero[3]) { console.error("FAIL a count of 0 is a real night", zero); fail++; }
  const hoverable = counted.filter((p) => !p[3]).map((p) => p[0]);
  if (hoverable.includes("2026-10-02") || !hoverable.includes("2026-10-05") || !hoverable.includes("2026-10-01")) { console.error("FAIL carried nights must not be real points", hoverable); fail++; }
}
if (fail) process.exit(1); else console.log("chart no-gaps ok");
