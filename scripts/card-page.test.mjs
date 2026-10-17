// Single-card page: sections show only when the passed data has them.
import { renderCard } from "../src/ui.mjs";
import { speciesPageToken, nightlyIdsForPage, nightlySpeciesStrip } from "../src/pokemon.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.log("  FAIL", name); }
};

const end = "2026-10-13";
const day = (off) => new Date(Date.parse(`${end}T00:00:00Z`) + off * 86400000).toISOString().slice(0, 10);

const card = {
  id: "tcgcsv-99",
  name: "Pikachu",
  kind: "single",
  set: "Base Set",
  setSlug: "base",
  num: "58/102",
  rarity: "Common",
  artist: "Mitsuhiro Arita",
  printing: "Normal",
  tags: ["Normal", "Reverse Holo"],
  price: 15,
  asOf: end,
  source: "TCGplayer market",
  release: "1999-01-09",
  hist: [[day(-40), 8], [day(-30), 10], [day(-7), 12], [day(0), 15]],
  fillHist: [[day(-20), 3]],
};

const full = renderCard(card, "stamp", {
  listingSeries: [
    { date: day(-2), listingCount: 4 },
    { date: day(0), listingCount: 6 },
  ],
  sitReads: [
    { id: "season", readKind: "season", asOf: "2026-10-01", sku: "tcgcsv-99", href: "/c/tcgcsv-99", headline: "Same 30 days last year, $4.00 on Sep 13, 2025 to $9.00 on Oct 13, 2025." },
    { id: "year-ago", readKind: "year-ago", asOf: end, sku: "tcgcsv-99", href: "/c/tcgcsv-99", headline: "A year ago it was $8.00 on Oct 13, 2025, now $15.00 on Oct 13, 2026." },
    { id: "sealed-range", readKind: "year-range", asOf: end, sku: "tcgcsv-1", href: "/p/tcgcsv-1", headline: "Sealed range should not show." },
  ],
  boardReads: [
    { id: "n1", asOf: "2026-10-13", board: "v3", sku: "tcgcsv-99", headline: "Newest board read." },
    { id: "n2", asOf: "2026-10-12", board: "hist", sku: "tcgcsv-99", headline: "Second board read." },
    { id: "n3", asOf: "2026-10-11", board: "v3", sku: "tcgcsv-99", headline: "Third board read." },
    { id: "n4", asOf: "2026-10-10", board: "v3", sku: "tcgcsv-99", headline: "Fourth board read." },
    { id: "n5", asOf: "2026-10-09", board: "v3", sku: "tcgcsv-99", headline: "Peak \u2014 then a return." },
    { id: "old", asOf: "2026-10-08", board: "v3", sku: "tcgcsv-99", headline: "Sixth read should stay off." },
  ],
  pokemon: { name: "Pikachu", slug: "pikachu", count: 12, low: 1.25, lowDate: "2026-10-02", high: 15, highDate: end },
  rotationFact: '<p class="rot-badge"><a href="/rotation"><span class="rm">G</span> Regulation mark G</a></p>',
});

const wins = (full.match(/<dl class="chg"[\s\S]*?<\/dl>/) || [""])[0];
t("header price, date, and windows", full.includes("$15.00") && full.includes("Oct 13, 2026") && wins.includes("<dt>7D</dt><dd class=\"up\">+25%</dd>") && wins.includes("<dt>30D</dt><dd class=\"up\">+50%</dd>") && !full.includes("7D —") && !full.includes("30D —"));
t("price stays on one line", full.includes(".cp-price{") && /white-space:nowrap/.test(full.slice(full.indexOf(".cp-price{"), full.indexOf(".cp-price{") + 220)));
t("normal printing stays off and the special one shows", full.includes(">Reverse Holo<") && !full.includes(">Normal<") && full.includes('class="vchips"'));
t("chart and since range ignore the sealed fill", full.includes("class=\"hc\"") && full.includes("Since Sep 3") && full.includes("$8.00") && !full.includes("$3.00"));
t("listings chart is counted, not a sealed dive", full.includes("eBay listings counted") && full.includes('data-unit="count"') && full.includes('data-snap="real"') && full.includes("has-counts"));
t("a trainer name does not become a pokemon strip", speciesPageToken("Gengar Spirit Link") === "" && speciesPageToken("Charizard") === "Charizard" && speciesPageToken("Solosis - 118/086") === "Solosis" && speciesPageToken("Charizard ex") === "Charizard");
const nightly = nightlySpeciesStrip({
  name: "Pikachu",
  slug: "pikachu",
  cards: [
    { id: "base-1", tcgPlayerId: 10, price: 1, priceDate: "2026-08-22" },
    { id: "base-2", tcgPlayerId: 11, price: 99, priceDate: "2026-08-22" },
    { id: "base-3", tcgPlayerId: 12, price: 50, priceDate: "2026-08-22" },
  ],
}, {
  "tcgcsv-10": { price: 12.5, date: "2026-10-13" },
  "tcgcsv-11": { price: 4, date: "2026-10-13" },
});
t("the strip uses tonight's quotes and drops a card with no nightly price", nightly && nightly.count === 2 && nightly.low === 4 && nightly.high === 12.5 && nightly.lowDate === "2026-10-13" && nightly.highDate === "2026-10-13" && !JSON.stringify(nightly).includes("2026-08-22"));
const joinedIds = nightlyIdsForPage({
  cards: [
    { id: "base-1", name: "Pikachu", set: "Base", number: "58", price: 1, priceDate: "2026-08-22" },
    { id: "base-2", name: "Pikachu", tcgPlayerId: 11, set: "Base", number: "58", price: 99, priceDate: "2026-08-22" },
    { id: "base-3", name: "Charizard-GX", set: "Burning Shadows", number: "20", price: 50, priceDate: "2026-08-22" },
    { id: "base-4", name: "Charizard", set: "Base", number: "4", price: 80, priceDate: "2026-08-22" },
  ],
}, {
  "base-1": "/img/base/1",
  "tcgcsv-10": "/img/base/1",
  "tcgcsv-99": "/img/other",
}, [
  ["tcgcsv-138496", "Charizard GX", "SM - Burning Shadows", "20/147", "", "single", 26.4],
  ["tcgcsv-1", "Charizard", "Base Set", "4/102", "", "single", 900],
  ["tcgcsv-2", "Charizard", "Base Set", "4/102", "", "single", 2000],
  ["tcgcsv-3", "Charizard GX", "SM - Burning Shadows", "20/147", "", "sealed", 1],
]);
const joined = nightlySpeciesStrip({
  name: "Pikachu",
  slug: "pikachu",
  cards: [{ id: "base-1", price: 1, priceDate: "2026-08-22" }],
}, { "tcgcsv-10": { price: 12.5, date: "2026-10-13" } }, joinedIds.filter((id) => id === "tcgcsv-10"));
t("a shared picture path joins a catalogue card to tonight's quote", joinedIds.includes("tcgcsv-10") && joinedIds.includes("tcgcsv-11") && joinedIds.includes("tcgcsv-138496") && !joinedIds.includes("tcgcsv-99") && !joinedIds.includes("tcgcsv-1") && !joinedIds.includes("tcgcsv-2") && !joinedIds.includes("tcgcsv-3") && joined && joined.count === 1 && joined.low === 12.5 && joined.lowDate === "2026-10-13" && !JSON.stringify(joined).includes("2026-08-22"));
t("where it sits is the card sentences only", full.includes("Where it sits") && full.includes("A year ago it was $8.00") && full.includes("Same 30 days last year") && full.indexOf("A year ago") < full.indexOf("Same 30 days") && !full.includes("Sealed range should not show"));
t("facts, release, rotation, and the priced strip", full.includes("Key stats") && full.includes("Common") && !full.includes("Mitsuhiro Arita") && full.includes("Jan 9, 1999") && full.includes("Regulation mark G") && full.includes('href="/pokemon/pikachu"') && full.includes("Every Pikachu card we price: 12 cards, $1.25 on Oct 2, 2026 to $15.00 on Oct 13, 2026."));
const main = full.slice(full.indexOf("<main"), full.indexOf("</main>"));
t("board reads are newest five", main.includes("Reads about this card") && main.includes("Newest board read.") && main.indexOf("Newest board read.") < main.indexOf("Second board read.") && main.indexOf("Fourth board read.") < main.indexOf("Peak: then a return.") && !main.includes("Sixth read should stay off") && !main.includes("\u2014") && !main.includes("\u2013"));

const quiet = renderCard({ ...card, hist: [[end, 15]], tags: ["Normal"], printing: "Normal", release: "" }, "stamp", { sitReads: [], boardReads: [] });
const shown = renderCard(card, "stamp", {
  ratingHtml: '<section class="crt" aria-label="Rating"><h2>Rating</h2><p class="verdict">Near the middle of similar cards.</p><p class="peer">Price vs similar cards: $15.00 vs a typical $14.00 (12 cards). TCGplayer market, Oct 13, 2026.</p></section>',
  cycleHtml: '<section class="ircy" aria-label="Release cycle"><h2>Release cycle</h2><dl><dt>Price</dt><dd>$15.00 on Oct 13, 2026, TCGplayer market</dd></dl></section>',
});
const shownMain = shown.slice(shown.indexOf("<main"), shown.indexOf("</main>"));
t("rating and release cycle sit after card facts", shownMain.includes("Key stats") && shownMain.indexOf("Key stats") < shownMain.indexOf(">Rating<") && shownMain.indexOf(">Rating<") < shownMain.indexOf("Release cycle") && shownMain.indexOf("Release cycle") < shownMain.indexOf("See the math") && shownMain.includes("Oct 13, 2026") && shown.includes("border-radius:22px") && !/No data/i.test(shownMain));
t("no listings, no reads, and no empty copy", !quiet.includes("eBay listings counted") && !quiet.includes("Where it sits") && !quiet.includes("Reads about this card") && !quiet.includes(">Rating<") && !quiet.includes("Release cycle") && !quiet.includes("No reads on file") && !/No data/i.test(quiet) && !quiet.includes("7d") && !quiet.includes(">Normal<") && quiet.includes("$15.00"));

const noList = renderCard(card, "stamp", { sitReads: [], boardReads: [] });
t("a price chart without counts hides the listings chart", noList.includes("class=\"hc\"") && !noList.includes("eBay listings counted"));

const sealed = renderCard({
  id: "tcgcsv-2",
  name: "Range Box",
  kind: "sealed",
  set: "Test",
  price: 10,
  asOf: end,
  hist: [[day(-5), 12], [day(0), 10]],
}, "stamp", {
  listingSeries: [
    { date: day(-1), listingCount: 40 },
    { date: day(0), listingCount: 30 },
  ],
});
t("sealed page keeps its chart and skips the single sections", sealed.includes("eBay listings counted") && sealed.includes('data-unit="count"') && !sealed.includes("Where it sits") && !sealed.includes("Reads about this card") && !sealed.includes('class="card-page"') && sealed.includes("30 listings counted") && !sealed.includes("NM "));

const yearCard = renderCard({ ...card, hist: [[day(-365), 10], [end, 15]] }, "stamp", {
  fact: { listings: 18, listingsAsOf: end, price: 15, asOf: end },
  rotationFact: '<p class="rot-badge"><a href="/rotation" aria-label="Rotation: regulation mark G, Standard"><span class="rm">G</span> Regulation mark G · Standard</a></p>',
});
t("summary chips use the exact year, the listing count, and the rotation mark", yearCard.includes("NM $15.00") && yearCard.includes("<dt>1Y</dt><dd class=\"up\">+50%</dd>") && yearCard.includes("18 listings counted, Oct 13") && yearCard.includes("G · Standard"));
const bare = renderCard({ id: "tcgcsv-3", name: "No Price", kind: "single", set: "S" }, "stamp", {});
t("empty summary chips stay off", !bare.includes('<p class="sum-strip">') && !/sum-chip[^>]*>1Y /.test(bare) && !bare.includes("listings counted"));

if (fail) process.exit(1);
console.log("card page ok");
{
  const { pokemonStripHtml } = await import("../src/ui.mjs");
  const strip = pokemonStripHtml({ name: "Charizard", slug: "charizard", count: 53, low: 4.8, lowDate: "2026-10-10", high: 2999.99, highDate: "2026-10-15" });
  console.log((strip.includes("$2,999.99") ? "  ok  " : "  FAIL ") + "the Pokemon range can carry the page card's price");
}
