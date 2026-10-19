// Home and /indexes: the long index history from indexes.json "history".
import { readFileSync } from "node:fs";
import { indexHistoryPoints, indexHistoryChart, HISTORY_JS } from "../src/history-chart.mjs";
import { singlesIndexChart } from "../src/indexes.mjs";
import { renderPath } from "../src/index.mjs";
import { resetJsonCache } from "../src/data.mjs";

let fail = 0;
const t = (name, cond, detail = "") => { if (cond) console.log("  ok ", name); else { fail++; console.log("  FAIL", name, detail); } };
const DAY = 86400000;
const maxGap = (pts) => pts.reduce((g, p, i) => (i ? Math.max(g, (Date.parse(p[0]) - Date.parse(pts[i - 1][0])) / DAY) : 0), 0);

const raw = [
  ["2024-02-08", 33.3, "a"], ["2024-02-15", 33.9, "a"], ["2026-03-05", 72, "a"], ["2026-03-12", 73, "a"], ["2026-03-13", 73.1, "a"],
  ["2026-09-25", 100, "f"], ["2026-09-26", 100, "n"], ["2026-09-27", 100.1, "n"], ["2026-09-29", 99.4, "n"],
];
const pts = indexHistoryPoints(raw, "2026-03-12");
t("daily with no gap over 1 day", maxGap(pts) === 1 && pts[0][0] === "2024-02-08");
const at = (d) => pts.find((p) => p[0] === d);
t("weekly archive steps hold the level and stay solid", at("2024-02-10")[2] === "a" && at("2024-02-10")[3] === "2024-02-08" && at("2024-02-10")[1] === 33.3);
t("a long hole is a gap, the soft line", at("2025-01-01")[2] === "g" && at("2025-01-01")[3] === "2024-02-15");
t("a missing night is a gap, the soft line", at("2026-09-28")[2] === "g" && at("2026-09-28")[3] === "2026-09-27");
t("real points keep their source", at("2026-09-25")[2] === "f" && !at("2026-09-25")[3] && at("2026-09-26")[2] === "n");
t("the client fades gap days and snaps hover to real days", /p\[2\]==="f"\|\|p\[2\]==="g"/.test(HISTORY_JS) && /snap==="real"/.test(HISTORY_JS));
const fig = indexHistoryChart(pts, { label: "Singles index" });
t("range pills 1M through All", ["1M", "3M", "6M", "1Y", "All"].every((r) => fig.includes(`>${r}</button>`)) && fig.includes('data-snap="real"') && fig.includes('data-unit="index"'));

const doc = {
  asOf: "2026-09-29", source: "TCGplayer market, daily",
  singles: [{ d: "2026-09-26", v: 100, n: 0 }, { d: "2026-09-27", v: 100.1, n: 9 }, { d: "2026-09-28", v: null, n: 0 }, { d: "2026-09-29", v: 99.4, n: 9 }],
  history: { method: "Chain-linked value-weighted, the same as the daily line.", weeklyUntil: "2026-03-12", singles: raw, singlesAbout: ["TCGplayer market price via the tcgcsv daily archive: weekly from Feb 8, 2024 to Mar 5, 2026, then daily to Sep 15, 2026.", "1 day with no price file holds the last level and shows as the soft line."] },
};
const ch = singlesIndexChart(doc);
t("/indexes shows the long chart with About this chart", ch.includes('id="singles-index"') && ch.includes("About this chart") && ch.includes("tcgcsv daily archive") && ch.includes("hc-pill"));
t("no sealed history, no sealed chart", !ch.includes('id="sealed-index"'));
t("no history keeps the old own-days chart", singlesIndexChart({ ...doc, history: undefined }).includes("our own days"));
t("copy rules", !/[\u2013\u2014]|\bsold\b|\bsales?\b|\bbuy\b/i.test(ch.replace(/<script[\s\S]*?<\/script>/g, "")));

const home = readFileSync(new URL("../index.html", import.meta.url), "utf8");
t("home reads history from indexes.json", home.includes("idx.history") && home.includes("longPts(hist.singles, hist.weeklyUntil)") && home.includes("About this chart"));
// The home copy of the filler gives the same points as the server one.
const src = home.match(/function longPts\(raw, weeklyUntil\)\{[\s\S]*?\n      return out;\n    \}/);
t("home filler found", !!src);
if (src) {
  const longPts = new Function(src[0] + "; return longPts;")();
  t("home and server fill the same way", JSON.stringify(longPts(raw, "2026-03-12")) === JSON.stringify(pts));
}

const files = {
  "counts.json": { asOf: "2026-09-29", updatedAt: "2026-09-29T12:00:00Z" },
  "feed/status.json": { images: { tcgplayer: true } },
  "feed/rating/index-list.json": { asOf: "2026-09-29", indexes: [] },
  "indexes.json": doc,
};
const fetchImpl = async (url) => {
  const rel = String(url).split("/research/assets/public/")[1];
  if (rel && files[rel]) return new Response(JSON.stringify(files[rel]));
  return new Response("no", { status: 404 });
};
resetJsonCache();
const res = await renderPath("/indexes", fetchImpl);
const html = await res.text();
t("/indexes page carries the chart script", res.status === 200 && html.includes('id="singles-index"') && html.includes("function mount(fig)"));

if (fail) { console.log(`index-history: ${fail} failed`); process.exit(1); }
console.log("index-history ok");
