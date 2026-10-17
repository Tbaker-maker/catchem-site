import { banGuard } from "../src/advice-rules.mjs";
// Whole pages carry code comments, so dashes are checked by their own assertion here.
const PAGE = { skipKinds: ["house"] };
import vm from "node:vm";
import { renderCompare, compareRows } from "../src/ui.mjs";
import { renderPath } from "../src/index.mjs";
import { resetJsonCache } from "../src/data.mjs";

let fail = 0;
const t = (name, cond) => {
  console.log(`${cond ? "  ok " : "  FAIL"} ${name}`);
  if (!cond) fail++;
};
const BANNED = banGuard("compare", null, PAGE);
const day = (n) => new Date(Date.parse("2025-09-01T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const line = (price) => Array.from({ length: 400 }, (_, i) => [day(i), price + i * 0.01]);

const empty = renderCompare(null, null, "stamp");
t("empty compare keeps the heading and hides the chart", empty.includes("<h1>Compare two products</h1>") && empty.includes("A missing number is left off.") && empty.includes("Add two product ids.") && empty.includes('name="c"') && empty.includes('name="d"') && !empty.includes('id="cmp-plot"'));

const compared = compareRows({ market: 10, date: "2026-10-09", source: "TCGplayer market" }, { market: 12, low: 8, source: "TCGplayer market" });
t("compare leaves a missing row off", compared.map((row) => row.label).join() === "Market,Source" && !/winner|score|better|higher|lower/i.test(JSON.stringify(compared)));

const left = { id: "tcgcsv-1", name: "Abra", kind: "single", market: 3, low: 2, date: "2026-10-13", source: "TCGplayer market" };
const right = { id: "tcgcsv-2", name: "Kadabra", kind: "single", market: 8, date: "2026-10-13", source: "TCGplayer market" };
const third = { id: "tcgcsv-3", name: "Alakazam", kind: "sealed", market: 40, date: "2026-10-13", source: "TCGplayer market" };
const page = renderCompare(left, right, "stamp", {
  a: "tcgcsv-1",
  b: "tcgcsv-2",
  c: "tcgcsv-3",
  d: "tcgcsv-9",
  ids: ["tcgcsv-1", "tcgcsv-2", "tcgcsv-3", "tcgcsv-9"],
  third,
  fourth: null,
  charts: [
    { id: "tcgcsv-1", name: "Abra", kind: "single", thumb: "/data/editor/tcg/base1/1_hires.png", points: line(1) },
    { id: "tcgcsv-2", name: "Kadabra", kind: "single", thumb: "", points: line(2) },
    { id: "tcgcsv-3", name: "Alakazam", kind: "sealed", thumb: "javascript:nope", points: line(4) },
    { id: "tcgcsv-9", name: "Missing", points: [[day(10), 1]] },
  ],
});
const legs = page.split('class="cmp-legs"')[1].split("</div>")[0];
const series = JSON.parse(page.match(/id="cmp-series">([\s\S]*?)<\/script>/)[1]);
t("one chart holds 2 to 4 lines and drops a short series", page.includes('id="cmp-plot"') && (page.match(/id="cmp-plot"/g) || []).length === 1 && series.length === 3 && series[0].length === 400);
t("ranges are 1M, 3M, 6M, 1Y, and All", ["1M", "3M", "6M", "1Y", "All"].every((label) => page.includes(`>${label}</button>`)));
t("legend chips stack on a narrow screen and sit in a row when wide", page.includes(".cmp-legs{display:flex;flex-direction:column") && page.includes("@media(min-width:800px)") && page.includes(".cmp-legs{flex-direction:row;flex-wrap:wrap}"));
t("legend chips keep a real thumbnail and drop a bad one", legs.includes('src="/data/editor/tcg/base1/1_hires.png"') && !legs.includes("javascript") && (legs.match(/<img /g) || []).length === 1);
t("legend links the product and a sealed row uses the product path", legs.includes('href="/c/tcgcsv-1"') && legs.includes('href="/c/tcgcsv-2"') && legs.includes('href="/p/tcgcsv-3"'));
t("a missing catalog row stays a column and a one-sided low stays off", page.includes("Not in the catalog") && page.includes("$3.00") && page.includes("$40.00") && !page.includes(">Low<"));
t("compare copy stays clean", !/[\u2014\u2013]/.test(page) && !/No data/i.test(page) && !BANNED.test(page) && !/winner|score|better|higher|lower/i.test(page.split("<footer")[0]));

{
  const broken = [];
  for (const m of page.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/application\/(ld\+)?json/.test(m[1])) continue;
    try { new vm.Script(m[2]); } catch (e) { broken.push(e.message); }
  }
  t("the compare script parses", broken.length === 0);
}

resetJsonCache();
const files = {
  "counts.json": { asOf: "2026-10-13", updatedAt: "2026-10-13T18:00:00Z" },
  "feed/status.json": { images: { tcgplayer: true } },
  "catalogue-images.json": { images: { "tcgcsv-10": "/img/base1/1.png" } },
};
const rows = {
  10: { id: "tcgcsv-10", name: "Abra", kind: "single", price: 3, low: 2, asOf: "2026-10-13", source: "TCGplayer market", hist: [["2026-08-01", 2], ["2026-09-01", 2.4], ["2026-10-01", 2.8], ["2026-10-13", 3]] },
  11: { id: "tcgcsv-11", name: "Kadabra", kind: "single", price: 8, asOf: "2026-10-13", source: "TCGplayer market", hist: [["2026-08-01", 7], ["2026-09-01", 7.5], ["2026-10-13", 8]] },
};
const fetchImpl = async (url) => {
  const rel = String(url).split("/public/")[1] || "";
  if (files[rel]) return { ok: true, status: 200, json: async () => files[rel], text: async () => JSON.stringify(files[rel]) };
  const bucket = rel.match(/^buckets\/(\d+)\.json$/);
  if (bucket && rows[bucket[1]]) return { ok: true, status: 200, json: async () => [rows[bucket[1]]], text: async () => JSON.stringify([rows[bucket[1]]]) };
  return { ok: false, status: 404, json: async () => null, text: async () => "" };
};
const live = await (await renderPath("/compare", fetchImpl, { a: "tcgcsv-10", b: "tcgcsv-11", c: "tcgcsv-10" })).text();
t("the route draws both products once and uses the catalogue thumbnail", live.includes("Abra") && live.includes("Kadabra") && live.includes('href="/c/tcgcsv-10"') && live.includes('src="/data/editor/tcg/base1/1.png"') && (live.match(/id="cmp-plot"/g) || []).length === 1 && !live.includes(">Low<"));
resetJsonCache();

if (fail) {
  console.log(`compare: ${fail} failed`);
  process.exit(1);
}
console.log("compare ok");
