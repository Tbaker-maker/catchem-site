// Product page chart: switchable views from published series only. No sales, sold,
// demand, or MSRP view (none is published). Listings are bars on real nights only.
import vm from "node:vm";
import { productChart, chartViews, defaultView, listingPoints, yDomain, MIN_SPAN, PRODUCT_CHART_CSS, PRODUCT_CHART_JS } from "../src/product-chart.mjs";
import { renderCard } from "../src/ui.mjs";
import { hasAdvice } from "../src/advice-rules.mjs";
let fail = 0;
const t = (name, ok) => { console.log(`${ok ? "  ok " : "  FAIL"} ${name}`); if (!ok) fail++; };
const unq = (s) => JSON.parse(s.replace(/&quot;/g, '"'));
const visible = (html) => html.replace(/<style>[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

t("views: price only", chartViews(5, 0).map((v) => v[0]).join() === "price,change");
t("views: price and listings", chartViews(5, 3).map((v) => v[0]).join() === "price,listings,both,change");
t("views: listings only", chartViews(1, 3).map((v) => v[0]).join() === "listings");
t("views: nothing to chart", chartViews(1, 1).length === 0 && productChart({ price: [["2026-10-01", 5, "n"]], listings: [] }) === "");
t("no demand, sales, or MSRP tab exists", !chartViews(9, 9).some(([k, l]) => /demand|sale|sold|msrp/i.test(k + l)));

const lp = listingPoints([
  { date: "2026-10-03", listingCount: 7 }, { date: "2026-10-01", listingCount: 0 }, { date: "bad", listingCount: 4 },
  { date: "2026-10-02", listingCount: -1 }, { date: "2026-10-03", listingCount: 9 }, ["2026-10-05", 12],
]);
t("listing points: real nights, 0 kept, bad rows dropped, last row per night wins", JSON.stringify(lp) === JSON.stringify([["2026-10-01", 0], ["2026-10-03", 9], ["2026-10-05", 12]]));

const day = (n) => new Date(Date.UTC(2025, 9, 1) + n * 86400000).toISOString().slice(0, 10);
const price = [[day(0), 100, "f"], [day(200), 120, "f"], [day(390), 150, "n"], [day(392), 0, "n"], [day(395), 160, "n"]];
const html = productChart({ price, listings: [{ date: day(390), listingCount: 40 }, { date: day(395), listingCount: 31 }], asOf: day(395) });
const p = unq(html.match(/data-p="([^"]*)"/)[1]);
const l = unq(html.match(/data-l="([^"]*)"/)[1]);
t("default view is Price + listings when both series exist", defaultView(chartViews(5, 3)) === "both" && defaultView(chartViews(5, 0)) === "price");
t("four tabs, Price + listings selected when listings exist", (html.match(/class="pc-tab"/g) || []).length === 4 && /data-view="both" aria-pressed="true"/.test(html) && /<figure class="hc pc" id="chart" data-view="both"/.test(html));
t("ranges 1M to All on a year of data", ["31", "92", "183", "366", "0"].every((d) => html.includes(`data-days="${d}"`)));
t("price 0 is not a point; carried days name the last real day", !p.some((x) => x[0] === day(392) && !x[3]) && p.filter((x) => x[3]).every((x) => x[1] > 0 && /^\d{4}-\d{2}-\d{2}$/.test(x[3])));
t("listings are the real nights only", JSON.stringify(l) === JSON.stringify([[day(390), 40], [day(395), 31]]));
t("fan-site days keep their tag for the soft line and source", p.some((x) => x[2] === "f") && html.includes("PokeVizInvestor"));
const words = visible(html);
t("no sales, sold, demand, supply, or MSRP words", !/\b(sales?|sold|demand|supply|msrp)\b/i.test(words));
t("no em or en dashes", !/[\u2014\u2013]/.test(html));
t("no advice phrases", !hasAdvice(words));
t("camera mode button and watermark with source and date", html.includes('class="pc-cam-btn"') && /class="pc-mark"[^>]*><b>Catch'em<span>\.<\/span><\/b> <span class="pc-mark-t">TCGplayer market, /.test(html));
t("camera mode hides nav, banner, dock, footer, and buy buttons", ["site-bar", "stale-banner", "dock", "site-foot", "shop-block", "shop-btns", "item-jump"].every((c) => PRODUCT_CHART_CSS.includes(`html.pc-cam .${c}`)) && /html\.pc-cam \.pc-mark\{display:block/.test(PRODUCT_CHART_CSS));
t("tabs fit a 390px screen (2 by 2 grid under 420px)", /@media\(max-width:420px\)\{\.pc \.pc-tabs\{display:grid;grid-template-columns:1fr 1fr\}/.test(PRODUCT_CHART_CSS) && /\.pc-tab\{[^}]*min-height:44px/.test(PRODUCT_CHART_CSS));
let parsed = true; try { new vm.Script(PRODUCT_CHART_JS); } catch { parsed = false; }
t("client script parses", parsed);
t("price line stays solid", !/stroke-dasharray/.test(PRODUCT_CHART_JS));
t("tooltip snaps to real price days and names carried days", /return !p\[3\]/.test(PRODUCT_CHART_JS) && PRODUCT_CHART_JS.includes("last price on file"));

// A small move must not fill the plot: price and combined views span at least MIN_SPAN of the price.
for (const view of ["price", "both"]) {
  const [lo, hi] = yDomain([194.33, 195.83, 194.76], view);
  t(`${view}: a 0.8% move gets at least a 10% y range`, hi - lo >= 195 * MIN_SPAN && lo < 194.33 && hi > 195.83);
}
{ const [lo, hi] = yDomain([100, 200], "price"); t("a wide move keeps its own range", lo < 100 && hi > 200 && hi - lo < 140); }
{ const [lo, hi] = yDomain([-2, 3], "change"); t("% change keeps zero and is not widened", lo < -2 && lo > -3 && hi > 3 && hi < 4); }
t("client chart uses the same y range function", PRODUCT_CHART_JS.includes("var yDomain=function yDomain(") && /yDomain\(p\.map\(val\),view\)/.test(PRODUCT_CHART_JS));
t("camera mode hides the source paragraph, legend, and button row, and shows a corner close", ["pc-src", "pc-key", "pc-foot"].every((c) => PRODUCT_CHART_CSS.includes(`html.pc-cam .${c}`)) && /html\.pc-cam \.pc-cam-x\{display:block/.test(PRODUCT_CHART_CSS) && html.includes('class="pc-cam-x" aria-label="Exit camera mode"') && /key==="Escape"/.test(PRODUCT_CHART_JS));
t("watermark is one line with the date and names the view's source", /\.pc-mark\{[^}]*white-space:nowrap/.test(PRODUCT_CHART_CSS) && html.includes('data-src-both="TCGplayer market, eBay listings counted"') && PRODUCT_CHART_JS.includes('"data-src-"+') && /data-day="[A-Z][a-z]{2} \d+, \d{4}"/.test(html));


t("watermark includes the product slug when given a path", productChart({ price, listings: [{ date: day(390), listingCount: 40 }, { date: day(395), listingCount: 31 }], asOf: day(395), path: "/p/swsh11-etb" }).includes('class="pc-mark-path">/p/swsh11-etb</span>'));
t("a tcgcsv id is not used as a watermark slug", !productChart({ price, listings: [], asOf: day(395), path: "/p/tcgcsv-277335" }).includes('class="pc-mark-path">/p/tcgcsv-277335'));
t("camera mode hides Watch and Add this to your read, and keeps the product photo", ["rv-actions", "add-read"].every((c) => PRODUCT_CHART_CSS.includes(`html.pc-cam .${c}`)) && /html\.pc-cam \.glance-photo,html\.pc-cam \.cp-photo\{display:flex!important\}/.test(PRODUCT_CHART_CSS) && !/glance-photo,html\.pc-cam \.cp-photo\{display:none/.test(PRODUCT_CHART_CSS));
t("camera mode opens on the price block so the 7D strip, chart, and 12-month bar share the first frame", PRODUCT_CHART_JS.includes('getElementById("price")') && PRODUCT_CHART_JS.includes('scrollIntoView({block:"start"})'));
t("camera type is large enough to read on a 1080p frame", /html\.pc-cam \.pc-mark\{[^}]*font:500 22px/.test(PRODUCT_CHART_CSS) && PRODUCT_CHART_CSS.includes("html.pc-cam h1{font:600 64px") && PRODUCT_CHART_CSS.includes("html.pc-cam .px span{font:600 72px") && PRODUCT_CHART_CSS.includes("html.pc-cam .sum-chip{font:600 28px") && PRODUCT_CHART_CSS.includes("min-height:1500px") && PRODUCT_CHART_CSS.includes("min-width:1600px"));

// Pages: sealed gets all views, a card without counts gets price and % change.
const sealed = renderCard({ id: "tcgcsv-9", name: "Test Elite Trainer Box", kind: "sealed", set: "Test", price: 60, asOf: "2026-10-12", hist: [["2026-10-01", 55], ["2026-10-12", 60]] }, "stamp", {
  listingSeries: [{ date: "2026-10-01", listingCount: 20 }, { date: "2026-10-12", listingCount: 24 }],
});
const sMain = sealed.slice(sealed.indexOf("<main"), sealed.indexOf("</main>"));
t("sealed page has one switchable chart with listings", (sMain.match(/<figure class="hc pc"/g) || []).length === 1 && sMain.includes('data-view="both"') && !sMain.includes('data-unit="count"'));
t("sealed chart has no condition labels", !/\b(NM|Near Mint|Condition)\b/.test(visible(sMain.match(/<figure class="hc pc"[\s\S]*?<\/figure>/)[0])));

const sealedSlug = renderCard({ id: "tcgcsv-9", name: "Test Elite Trainer Box", kind: "sealed", set: "Test", slug: "swsh11-etb", price: 60, asOf: "2026-10-12", hist: [["2026-10-01", 55], ["2026-10-12", 60]] }, "stamp", {
  listingSeries: [{ date: "2026-10-01", listingCount: 20 }, { date: "2026-10-12", listingCount: 24 }],
});
t("sealed camera watermark uses the product slug", sealedSlug.includes('class="pc-mark-path">/p/swsh11-etb</span>') && sealedSlug.includes("add-read"));

const card = renderCard({ id: "tcgcsv-8", name: "Test Card", kind: "single", set: "Test", price: 5, asOf: "2026-10-12", hist: [["2026-10-01", 4], ["2026-10-12", 5]] }, "stamp", {});
t("card page has price and % change only, opening on Price", card.includes('<figure class="hc pc"') && /<figure class="hc pc" id="chart" data-view="price"/.test(card) && card.includes('data-view="change"') && !card.includes('data-view="listings"'));
t("chart script waits until the figure is near the viewport", html.includes("IntersectionObserver") && html.includes('rootMargin:"240px"') && html.includes("getElementById(\"chart\")") && html.includes(PRODUCT_CHART_JS));
if (fail) process.exit(1); else console.log("product chart ok");
