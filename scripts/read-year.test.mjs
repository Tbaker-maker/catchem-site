// Read pages chart the card's year (fill, archive, own days) with the card-page component.
import { readYearChart, cardPriceSeries, renderFeed } from "../src/ui.mjs";
import { readYearFor } from "../src/index.mjs";
import { resetJsonCache } from "../src/data.mjs";

let fail = 0;
const t = (name, cond) => { console.log(`${cond ? "  ok " : "  FAIL"} ${name}`); if (!cond) fail++; };
const own = [["2026-09-26", 68.79], ["2026-10-06", 93.39], ["2026-10-13", 116.21]];
const fill = [["2025-10-20", 40], ["2026-03-01", 55], ["2026-09-26", 1], ["2026-10-01", 2]];
const card = { id: "tcgcsv-89318", kind: "single", hist: own, fillHist: fill, fillTo: "2026-09-26" };
const series = cardPriceSeries(card, card.hist);
t("fill only before the first own night", series.filter((p) => p[2] === "f").every((p) => p[0] < "2026-09-26") && !series.some((p) => p[1] === 1 || p[1] === 2));
t("own days win", series.filter((p) => p[0] >= "2026-09-26").every((p) => p[2] !== "f") && series.at(-1)[1] === 116.21);
const html = readYearChart(card, "2026-10-13");
t("year chart uses the card component with snap to real points", html.includes('class="hc"') && html.includes('data-snap="real"'));
t("range pills match card pages", ["1M", "3M", "6M", "1Y", "All"].every((l) => html.includes(`>${l}</button>`)) && !html.includes(">7D<"));
t("no chart without history", readYearChart({ id: "x", hist: [] }) === "");

const read = { id: "move-tcgcsv-89318-7", href: "/c/tcgcsv-89318", headline: "Slowking (Prime) is up 24.4% this week.", price: 116.21, asOf: "2026-10-13", source: "TCGplayer market", kind: "single", receipt: { from: "2026-10-06", to: "2026-10-13", marketFrom: 93.39, marketTo: 116.21 } };
const fetchImpl = async (u) => {
  const url = String(u);
  if (url.endsWith("buckets/18.json")) return new Response(JSON.stringify([card]));
  if (url.endsWith("hist-long/18.json")) return new Response(JSON.stringify({ rows: {} }));
  return new Response("{}", { status: 404 });
};
resetJsonCache();
const readYear = await readYearFor(read.id, fetchImpl);
t("read page gets the card year chart from one bucket row", readYear && readYear.id === read.id && readYear.html.includes('class="hc"'));
const page = renderFeed({ reads: [read] }, read.id, "", { feed: true, page: "read", readYear });
const lead = JSON.parse(page.match(/id="feed-lead">([\s\S]*?)<\/script>/)[1]);
t("the read keeps its own numbers", lead[0].price === 116.21 && lead[0].receipt.marketFrom === 93.39 && !("yearChart" in lead[0]));
t("read page loads the chart script and mounts on paint", page.includes("catchemHistoryMount") && page.includes('id="read-year"') && page.includes("READ_YEAR.html"));
const big = await (async () => { let calls = 0; const f = async (u) => { calls++; return fetchImpl(u); }; resetJsonCache(); await readYearFor(read.id, f); return calls; })();
t("year chart costs at most two small fetches", big <= 2);
t("no em dashes in the chart", !/[\u2014\u2013]/.test(html.replace(/<[^>]+>/g, " ")));

// A feed with many price reads must not starve the read chart of subrequests.
{
  const { renderPath } = await import("../src/index.mjs");
  const many = Array.from({ length: 160 }, (_, i) => ({ id: `move-tcgcsv-${1000 + i}-7`, sku: `tcgcsv-${1000 + i}`, kind: "single", readKind: "price", headline: "x", price: 5, asOf: "2026-10-13", source: "TCGplayer market" }));
  let calls = 0;
  const capped = async (u) => {
    calls++;
    if (calls > 50) throw new Error("Too many subrequests");
    const url = String(u);
    if (url.endsWith("reads.json")) return new Response(JSON.stringify({ reads: [read, ...many] }));
    return fetchImpl(u);
  };
  resetJsonCache();
  const res = await renderPath(`/feed/r/${read.id}`, capped, { feed: true });
  const body = await res.text();
  const cfg = JSON.parse(body.match(/id="read-year">([\s\S]*?)<\/script>/)[1]);
  t("read chart is built before the stale pass uses up subrequests", cfg && cfg.html.includes('class="hc"'));
  let n = 0;
  const counter = async (u) => { n++; const url = String(u); if (url.endsWith("reads.json")) return new Response(JSON.stringify({ reads: many })); return new Response("[]"); };
  resetJsonCache();
  await renderPath("/feed", counter, { feed: true });
  t("stale pass fetches each bucket once (100 buckets, not 160 rows)", n <= 110);
}

if (fail) { console.log(`${fail} failed`); process.exit(1); }
console.log("read year chart: all passed");
