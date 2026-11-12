// PkmnPrices market depth on product pages: sold comps, graded pop, Cardmarket EUR,
// and the chart's Sold view. "Sold" appears only for actual eBay sold comps.
import vm from "node:vm";
import { marketDepthHtml, soldSeries, depthKey, marketDepthFor } from "../src/market-depth.mjs";
import { productChart, chartViews, soldPoints, PRODUCT_CHART_JS } from "../src/product-chart.mjs";
import { renderCard } from "../src/ui.mjs";
import { hasAdvice } from "../src/advice-rules.mjs";
let fail = 0;
const t = (name, ok) => { console.log(`${ok ? "  ok " : "  FAIL"} ${name}`); if (!ok) fail++; };
const visible = (html) => html.replace(/<style>[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

const depth = {
  asOf: "2026-11-12", source: "eBay sold comps via PkmnPrices", popSource: "PSA, BGS, CGC and SGC population reports via PkmnPrices (GemRate)", eurSource: "Cardmarket via PkmnPrices",
  sold: { n: 18, read: 20, median: 88.5, p25: 80, p75: 95.25, first: "2026-10-20", last: "2026-11-11", dropped: 2, days: 90, currency: "USD", truncated: true },
  graded: [{ label: "PSA 10", n: 7, median: 420, last: "2026-11-10" }, { label: "https://x", n: 9, median: 1, last: "2026-11-10" }],
  daily: [["2026-11-07", 7], ["2026-11-10", 1], ["2026-11-11", 8]],
  pop: { variant: "Holofoil", variants: 1, total: 66316, gems: 14846, gemRate: 22.39, graders: { PSA: { total: 50000, gems: 12000, top: { "10": 12000, "9": 25000 } }, BGS: { total: 1835, gems: 378, top: { "9.5": 374 }, pristine: 4 } }, asOf: "2026-11-01", changed: "2026-10-30" },
  eur: { market: 247.5, asOf: "2026-11-11" },
};
const single = marketDepthHtml(depth, { kind: "single" });
const sealed = marketDepthHtml({ ...depth, pop: null }, { kind: "sealed" });
t("sold block shows median, count, middle half and dates", single.includes("$88.50") && single.includes("18 of the latest 20") && single.includes("$80.00 to $95.25") && single.includes("Oct 20, 2026 to Nov 11, 2026"));
t("sold block names source and as-of date", single.includes("Source: eBay sold comps via PkmnPrices, as of Nov 12, 2026"));
t("graded medians shown, a malformed label is not", single.includes("PSA 10") && single.includes("$420.00") && !single.includes("https://x"));
t("pop shows counts by grader with date and source", single.includes("66,316") && single.includes("PSA") && single.includes("10: 12,000") && single.includes("Pristine 10: 4") && single.includes("Counts from Nov 1, 2026") && single.includes("GemRate"));
t("EUR shows with date", single.includes("€247.50 · Nov 11, 2026"));
t("sealed: no condition label, no pop", !/Near Mint|\bNM\b|raw copies/.test(visible(sealed)) && !sealed.includes('id="pop"'));
t("thin sold data is hidden", marketDepthHtml({ ...depth, sold: { ...depth.sold, n: 4 }, graded: [], pop: null, eur: null }) === "");
t("nothing to show is empty", marketDepthHtml(null) === "" && marketDepthHtml({}) === "");
t("no advice, no dashes", !hasAdvice(visible(single + sealed)) && !/[\u2013\u2014]/.test(single + sealed));
t("depth key is the tcgcsv id", depthKey({ id: "tcgcsv-509980" }) === "tcgcsv-509980" && depthKey({ id: "sv3-223", pid: 509980 }) === "tcgcsv-509980" && depthKey({ id: "x" }) === "");

// chart
t("Sold view only with 2+ sold days", !chartViews(5, 0, 1).some((v) => v[0] === "sold") && chartViews(5, 0, 2).some((v) => v[0] === "sold"));
t("sold points drop bad rows", JSON.stringify(soldPoints([["2026-11-01", 2], ["bad", 3], ["2026-11-02", 0], ["2026-11-03", 1.5], ["2026-10-30", 4]])) === JSON.stringify([["2026-10-30", 4], ["2026-11-01", 2]]));
const price = [["2026-10-01", 80, "n"], ["2026-11-11", 90, "n"]];
const chart = productChart({ price, sold: soldSeries(depth), soldSource: depth.source, asOf: "2026-11-12" });
t("chart carries sold series and a Sold tab", chart.includes('data-s="') && chart.includes('data-view="sold"') && chart.includes("Sold (eBay)"));
t("chart source names eBay sold comps and the no-bar rule", chart.includes("eBay sold comps via PkmnPrices recorded per day") && chart.includes("a day with no bar had no comp recorded"));
t("no sold series means no Sold tab and no data-s", !productChart({ price, asOf: "2026-11-12" }).includes("data-s="));
let parsed = true; try { new vm.Script(PRODUCT_CHART_JS); } catch { parsed = false; }
t("client script parses", parsed && PRODUCT_CHART_JS.includes('view==="sold"?S:L0') && PRODUCT_CHART_JS.includes("eBay sold comps per day"));

// page
const page = renderCard({ id: "tcgcsv-8", name: "Test Card", kind: "single", set: "Test", price: 90, asOf: "2026-11-12", hist: price }, "stamp", { marketDepth: depth });
t("single page renders sold, pop and EUR blocks", page.includes('id="sold"') && page.includes('id="pop"') && page.includes('id="eur"'));
const sealedPage = renderCard({ id: "tcgcsv-9", name: "Test Elite Trainer Box", kind: "sealed", set: "Test", price: 60, asOf: "2026-11-12", hist: [["2026-10-01", 55], ["2026-11-12", 60]] }, "stamp", { marketDepth: { ...depth, pop: null, graded: [] } });
t("sealed page renders sold and EUR, no pop", sealedPage.includes('id="sold"') && sealedPage.includes('id="eur"') && !sealedPage.includes('id="pop"'));
const held = renderCard({ id: "tcgcsv-8", name: "Test Card", kind: "single", set: "Test", price: 90, asOf: "2026-11-12", hist: price, priceStatus: "checking" }, "stamp", { marketDepth: depth, priceHeld: true });
t("a held price page shows no depth numbers", !held.includes('id="sold"'));
const noDepth = renderCard({ id: "tcgcsv-8", name: "Test Card", kind: "single", set: "Test", price: 90, asOf: "2026-11-12", hist: price }, "stamp", {});
t("without depth the page says no sold", !/\bsold\b/i.test(visible(noDepth)));

// loader: a missing bucket or id is null, never a throw
const fake = (body, status = 200) => async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
t("loader returns the item with doc dates", (await marketDepthFor({ id: "tcgcsv-1234" }, fake({ asOf: "2026-11-12", source: "s", items: { "tcgcsv-1234": { sold: depth.sold } } })))?.sold?.n === 18);
t("loader: missing id is null", (await marketDepthFor({ id: "tcgcsv-1235" }, fake({ asOf: "2026-11-12", items: {} }))) === null);
process.exit(fail ? 1 : 0);
