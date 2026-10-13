// 12-month low and high under the price chart. Numbers come from the series passed in.
import { mergeHistory } from "../src/history-chart.mjs";
import { renderCard, yearRange, yearRangeHtml } from "../src/ui.mjs";

let fail = 0;
function iso(off, from = "2026-10-12") {
  return new Date(Date.parse(`${from}T00:00:00Z`) + off * 86400000).toISOString().slice(0, 10);
}
function epoch(day) {
  return Math.round(Date.parse(`${day}T00:00:00Z`) / 86400000);
}
function check(name, ok) {
  if (!ok) { console.error("FAIL", name); fail++; }
}
function yrBlock(html) {
  const m = html.match(/<div class="yr">[\s\S]*?<span class="yr-knob"[^>]*><\/span><\/div><\/div>/);
  return m ? m[0] : "";
}

const short = yearRange([["2026-09-01", 8], ["2026-09-20", 4], ["2026-10-12", 6]], "2026-10-12");
check("under 60 days names the first day", short && short.label === "Since Sep 1" && short.text === "Since Sep 1 low $4.00 (Sep 20) · high $8.00 (Sep 1)");
check("short slider sits halfway", short && short.price === 6 && Math.abs(short.at - 50) < 0.001);
const shortHtml = yearRangeHtml([["2026-09-01", 8], ["2026-09-20", 4], ["2026-10-12", 6]], "2026-10-12");
check("short html is one line with a knob", shortHtml.includes('class="yr-line"') && shortHtml.includes("Since Sep 1 low $4.00 (Sep 20) · high $8.00 (Sep 1)") && shortHtml.includes('class="yr-knob" style="left:50.0%"') && !shortHtml.includes("<br"));
check("short html has no gap copy", !/12-month|No data|\u2014|\u2013/.test(shortHtml));

const mid = yearRange([[iso(-80), 3], [iso(-2), 9], [iso(0), 6]], "2026-10-12");
check("under a year still names the first day", mid && mid.label.startsWith("Since ") && !mid.label.includes("12-month") && mid.low === 3 && mid.high === 9);

const yearPts = [[iso(-400), 1], [iso(-300), 5], [iso(-10), 20], [iso(0), 10]];
const year = yearRange(yearPts, "2026-10-12");
check("12-month ignores a price older than the window", year && year.label === "12-month" && year.low === 5 && year.lowDate === iso(-300) && year.high === 20 && year.highDate === iso(-10) && year.price === 10);
check("12-month slider", year && Math.abs(year.at - ((10 - 5) / (20 - 5)) * 100) < 0.001);
const yearHtml = yearRangeHtml(yearPts, "2026-10-12");
check("12-month line", yearHtml.startsWith('<div class="yr"><p class="yr-line">12-month low $5.00') && yearHtml.includes(" · high $20.00 (") && !/\u2014|No data/i.test(yearHtml));

const tied = yearRange([["2026-10-01", 5], ["2026-10-05", 5], ["2026-10-12", 9]], "2026-10-12");
check("a tied low keeps the later date", tied && tied.lowDate === "2026-10-05" && tied.highDate === "2026-10-12" && tied.at === 100);
const flat = yearRange([["2026-10-01", 5], ["2026-10-12", 5]], "2026-10-12");
check("a flat series sits in the middle", flat && flat.at === 50 && flat.text.includes("low $5.00") && flat.text.includes("high $5.00"));
check("one price is not a range", yearRangeHtml([["2026-10-12", 5]], "2026-10-12") === "");
check("a price of 0 is not a point", yearRange([["2026-10-01", 0], ["2026-10-02", 5], ["2026-10-12", 6]], "2026-10-12").low === 5);
check("one point inside a long file is not a 12-month range", yearRange([[iso(-400), 1], [iso(0), 10]], "2026-10-12") === null);

const card = renderCard({
  id: "tcgcsv-1",
  name: "Range Card",
  kind: "single",
  set: "Base Set",
  price: 10,
  asOf: "2026-10-12",
  hist: [[iso(-10), 20], [iso(0), 10]],
  longHist: `${epoch(iso(-400))}:1,${epoch(iso(-300))}:5`,
  fillHist: [[iso(-20), 3]],
}, "stamp", { listingSeries: [{ date: "2026-10-12", listingCount: 999 }, { date: "2026-10-11", listingCount: 998 }] });
const cardYr = yrBlock(card);
check("card row uses the archive price", cardYr.includes("12-month low $5.00") && cardYr.includes("high $20.00"));
check("card row leaves sealed counts off", !cardYr.includes("999") && !cardYr.includes("998") && !/listing|eBay|sealed/i.test(cardYr));
check("card page keeps the line on one row", card.includes(".yr-line{") && card.includes("white-space:nowrap") && card.includes("border-radius:999px") && card.includes("border-radius:50%"));

const merged = mergeHistory([[iso(-20), 3], [iso(0), 9]], "", iso(-5));
check("helper still sees a fan-site day", merged.some((point) => point[0] === iso(-20) && point[1] === 3));
const sealed = renderCard({
  id: "tcgcsv-2",
  name: "Range Box",
  kind: "sealed",
  set: "Test",
  price: 10,
  asOf: "2026-10-12",
  hist: [[iso(-5), 12], [iso(0), 10]],
  fillHist: [[iso(-400), 1], [iso(-200), 7]],
  fillTo: iso(-5),
}, "stamp", {
  listingSeries: [
    { date: "2026-10-11", listingCount: 40 },
    { date: "2026-10-12", listingCount: 30 },
  ],
});
const sealedYr = yrBlock(sealed);
check("sealed row uses the fan-site fill", sealedYr.includes("12-month") && sealedYr.includes("$7.00") && !sealedYr.includes("$1.00"));
check("sealed row is the price, not the listing count", !sealedYr.includes("40") && !sealedYr.includes("30") && !/listing/i.test(sealedYr));
const singleSkip = renderCard({
  id: "tcgcsv-3",
  name: "No Fill",
  kind: "single",
  price: 9,
  asOf: "2026-10-12",
  hist: [[iso(-10), 8], [iso(0), 9]],
  fillHist: [[iso(-20), 3]],
}, "stamp");
const skipYr = yrBlock(singleSkip);
check("a card does not take the sealed fill", skipYr.includes("low $8.00") && !skipYr.includes("$3.00"));

if (fail) process.exit(1);
console.log("year range ok");
