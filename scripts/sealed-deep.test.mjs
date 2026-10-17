import { withoutShopButtons } from "../src/pokemon.mjs";
// Sealed page: eBay ask and Rip value only when the file has them.
import { renderCard } from "../src/ui.mjs";

let fail = 0;
const t = (name, cond) => { console.log(`${cond ? "  ok " : "  FAIL"} ${name}`); if (!cond) fail++; };
const BANNED = /\b(buy|sell|hold|support|resistance|bottom|printed|play|target|invest|stack|load up|crypto|supply)\b/i;

const card = {
  id: "tcgcsv-2",
  name: "Phantasmal Flames Elite Trainer Box",
  kind: "sealed",
  set: "Phantasmal Flames",
  price: 80,
  asOf: "2026-10-13",
  source: "TCGplayer market",
  hist: [["2026-10-01", 70], ["2026-10-13", 80]],
};
const html = renderCard(card, "stamp", {
  ebayAsk: { amount: 159.99, asOf: "2026-10-13", source: "ebay-browse-api" },
  rip: { contentsEV: 20.03, roiPct: 36.3, beatChance: 100, median: 17.05, priceSource: "TCGplayer market", asOf: "2026-10-13" },
  listingSeries: [
    { date: "2026-10-12", listingCount: 40 },
    { date: "2026-10-13", listingCount: 30 },
  ],
});
t("eBay ask keeps the median and the date", html.includes("<dt>Ask</dt><dd>$159.99</dd>") && html.includes("Oct 13, 2026") && !html.includes("ebay-browse-api"));
t("rip value uses the file fields", html.includes("Rip value") && html.includes("Average pull value") && html.includes("$20.03") && html.includes("ROI") && html.includes("36.3%") && html.includes("Chance an opening beats the price") && html.includes("100%") && html.includes("Typical opening") && html.includes("$17.05") && html.includes("TCGplayer market, Oct 13, 2026"));
t("listings counted chart stays", html.includes("eBay listings counted") && html.includes("30 listings counted"));
const bare = renderCard(card, "stamp", {});
t("missing ask and rip stay off", !bare.includes("eBay ask $") && !bare.includes("<h2>Rip value</h2>"));
const single = renderCard({ ...card, kind: "single", hist: [["2026-10-01", 70], ["2026-10-13", 80]] }, "stamp", {
  ebayAsk: { amount: 10, asOf: "2026-10-13", source: "ebay-browse-api" },
  rip: { contentsEV: 5, roiPct: 1, beatChance: 2, median: 4, asOf: "2026-10-13" },
});
t("a single does not take the sealed rip block", !single.includes("<h2>Rip value</h2>") && !single.includes("eBay ask $"));
const main = withoutShopButtons(html.slice(html.indexOf("<main"), html.lastIndexOf("</main>"))).replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");
t("sealed deep copy stays clean", !/[\u2014\u2013]/.test(html) && !BANNED.test(main) && !/No data/i.test(main));

if (fail) { console.log(`${fail} failed`); process.exit(1); }
console.log("sealed deep ok");
