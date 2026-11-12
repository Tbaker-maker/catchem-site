// UX audit Nov 11 (4): one sealed page showed three listings answers.
// Summary chip "137 listings counted, Oct 30 ▲0.7%" (a one-night step),
// the line "eBay listings 7D +7% (128 → 137)", and the tile "Steady" beside ▲7%.
// Now the chip and the line read one window and name it; the tile says Steady
// only on a flat count.
import { renderCard, listingChange, listingTrend } from "../src/ui.mjs";
import { signalRowHtml } from "../src/signal-chips.mjs";

let fail = 0;
const t = (name, cond) => { console.log(`${cond ? "  ok " : "  FAIL"} ${name}`); if (!cond) fail++; };

// Oct 23 128, nightly counts to Oct 29 136, Oct 30 137.
const listingSeries = [
  ["2026-10-20", 125], ["2026-10-23", 128], ["2026-10-24", 129], ["2026-10-25", 131], ["2026-10-26", 132],
  ["2026-10-27", 134], ["2026-10-28", 135], ["2026-10-29", 136], ["2026-10-30", 137],
].map(([date, listingCount]) => ({ date, listingCount }));

const ch = listingChange(listingSeries, "2026-10-30");
t("the change is a week back, not the last night", ch && ch.days === 7 && ch.from === 128 && ch.n === 137 && ch.pct === 7 && ch.fromDay === "2026-10-23");
t("the 7D window math is unchanged", listingTrend(listingSeries, "2026-10-30").includes("7D +7% (128 → 137)"));

const card = { id: "tcgcsv-390", name: "Test Booster Box", kind: "sealed", set: "Test", price: 100, asOf: "2026-10-30", source: "TCGplayer market", low: 89, hist: [["2026-10-01", 90], ["2026-10-30", 100]] };
const html = renderCard(card, "stamp", { listingSeries, listingsHtml: "<section class=\"lc\" aria-labelledby=\"lc-h\"><h2 id=\"lc-h\">Listings counted</h2><p>eBay listings counted: 137 on Oct 30, from 136 on Oct 29.</p></section>" });
const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
const strip = (main.match(/<p class="sum-strip">[\s\S]*?<\/p>/) || [""])[0];
t("summary chip shows the 7D change with its window", strip.includes("137 listings counted") && strip.includes("7% 7D") && strip.includes("over 7 days, since Oct 23") && strip.includes("from 128 on Oct 23"));
t("the page shows that window once: no 7D line and no Listings counted block", !main.includes("eBay listings 7D") && !main.includes("id=\"lc-h\"") && !main.includes("from 136 on Oct 29") && (main.split("137 listings counted").length - 1) === 1);
t("Listings jump lands on a section with no second count", main.includes('id="supply"') && main.includes('href="#supply"') && !(main.split('id="supply"')[1] || "").includes("137 listings"));
t("A listing is not a sale sits on the listings figure, not under Buy", /<p class="list-note muted">A listing is not a sale\.<\/p>/.test(main) && !/<div class="shop-block">[\s\S]*?A listing is not a sale\./.test(main) && main.indexOf("list-note") > main.indexOf("sum-strip") && main.indexOf("list-note") < main.indexOf('<div class="shop-block">'));
t("Key stats Low is the TCGplayer lowest listing with its date", main.includes("<dt>TCGplayer lowest listing</dt>") && main.includes("<dd>$89.00, Oct 30</dd>"));
t("no one-night 0.7% anywhere on the page", !/0\.7%/.test(html));

// A gap: no count exactly 7 days back. The nearest earlier count is used and its real day count named.
const gap = listingSeries.filter((p) => p.date !== "2026-10-23");
const g = listingChange(gap, "2026-10-30");
t("a gap uses the nearest earlier count and names 10 days", g && g.days === 10 && g.from === 125);
const gapStrip = (renderCard(card, "stamp", { listingSeries: gap }).match(/<p class="sum-strip">[\s\S]*?<\/p>/) || [""])[0];
t("the chip names 10D on a gap", gapStrip.includes("10D") && gapStrip.includes("over 10 days, since Oct 20"));
// Only the last two nights on file: no named window, so no arrow at all.
const short = listingSeries.slice(-2);
t("two nights only: no change claimed", listingChange(short, "2026-10-30") === null);
const shortStrip = (renderCard(card, "stamp", { listingSeries: short }).match(/<p class="sum-strip">[\s\S]*?<\/p>/) || [""])[0];
t("two nights only: the chip has the count and no arrow", shortStrip.includes("137 listings counted") && !shortStrip.includes("sum-arrow"));

// Tile: "Steady" with ▲7% was two answers.
const tile = (word, dir, pct) => signalRowHtml({ tiles: { listings: { word, dir, pct, days: 11, spark: [128, 130, 137], band: [128, 131], from: "2026-10-23", to: "2026-11-10" } } });
const up = tile("Steady", "up", 7);
t("a 7% move is not called Steady", !up.includes("Steady") && up.includes("▲ 7%") && up.includes("11D") && up.includes("Listings counted: up 7 percent over 11 days."));
t("a flat count keeps Steady", tile("Steady", "flat", 0).includes("Steady"));
t("a pace word stays", tile("Stacking", "up", 33).includes("Stacking"));

process.exit(fail ? 1 : 0);
