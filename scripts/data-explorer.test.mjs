import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { flagLine } from "../src/advice-rules.mjs";
import {
  cleanText,
  dataExplorerResponse,
  explorerLog,
  money,
  moveText,
  renderExplorer,
  resetExplorerCache,
} from "../src/data-explorer.mjs";

const docs = {
  sets: {
    asOf: "2026-10-27",
    source: "TCGplayer market",
    sets: [
      { slug: "sv3pt5", name: "Scarlet and Violet 151", era: "Scarlet & Violet", release: "2023-09-22", single: 207, sealed: 12, priced: 200, value: 100 },
      { slug: "base", name: "Base", era: "Original", release: "1999-01-09", single: 102, sealed: 4, priced: 90, value: null },
    ],
  },
  listings: {
    asOf: "2026-10-27",
    source: "data/sealed-prices.json",
    products: [
      { id: "tcgcsv-503313", name: "151 Elite Trainer Box", listingsCounted: { n: 119, date: "2026-10-23", prev: { n: 100, date: "2026-10-22" } } },
      { id: "x", name: "NM Empty Box", listingsCounted: null },
    ],
  },
  movers: {
    asOf: "2026-10-27",
    singles: [{ id: "tcgcsv-1", name: "Heat Rotom", set: "Example", price: 12.5, changePct: 4.2, href: "/c/tcgcsv-1", hist: [["2026-09-01", 10], ["2026-10-27", 12.5]] }],
    singlesRising: [{ id: "tcgcsv-1", name: "Heat Rotom", set: "Example", price: 12.5, changePct: 4.2, href: "/c/tcgcsv-1", hist: [] }],
    singlesFalling: [],
    sealed: [{ id: "tcgcsv-503313", name: "151 Elite Trainer Box", set: "Scarlet and Violet 151", price: 495.14, changePct: 22.2, href: "/p/tcgcsv-503313", hist: [["2025-09-30", 405.23], ["2026-10-23", 495.14]] }],
    sealedRising: [],
    sealedFalling: [{ id: "tcgcsv-9", name: "NM Falling Tin", set: "Example", price: 20, changePct: -10, href: "/p/tcgcsv-9", hist: [["2026-09-01", 22], ["2026-10-27", 20]] }],
  },
  meter: {
    asOf: "2026-10-27",
    source: "TCGplayer market indexes.",
    market: { history: [{ d: "2026-09-29", mood: 0, heat: 45 }, { d: "2026-10-27", mood: 80, heat: 44 }] },
    singles: { history: [] },
    sealed: { history: [] },
    vintage: { history: [] },
    modern: { history: [] },
  },
  today: {
    asOf: "2026-10-27",
    lines: [{ slot: "news", text: "Delta Reign news line.", source: "Example News", date: "2026-11-06" }],
  },
  releases: {
    checked: "2026-10-26",
    source: "data/release-radar.json",
    releases: [{ name: "30th Celebration \u2014 Espeon", date: "2026-10-30", type: "decks", source: "pokemon.com/news", checked: "2026-10-26" }],
  },
  track: {
    asOf: "2026-10-27",
    summary: "Of 1 read in 90 days, 1 moved the way the read described.",
    rows: [
      { date: "2026-10-27", name: "151 Elite Trainer Box", said: "Recorded at $495.14.", priceThen: 495.14, priceNow: null, source: "TCGplayer market", priceDate: "2026-10-27", kind: "sealed", moved: null },
      { date: "2026-10-01", name: "Heat Rotom", said: "Recorded at $10. Not a sold price.", priceThen: 10, priceNow: 12, source: "TCGplayer market", kind: "single", moved: true },
    ],
  },
};

function textOf(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'");
}

function assertClean(html, label) {
  assert.equal(html.includes("\u2014") || html.includes("\u2013"), false, label + " has a dash");
  assert.equal(/\bsold\b/i.test(html), false, label + " says sold");
  assert.equal(/collectr/i.test(html), false, label + " names Collectr");
  const flags = flagLine(textOf(html), { skipKinds: ["house"] });
  assert.deepEqual(flags.map((f) => f.phrase), [], label + " advice");
}

assert.equal(money(null), "No price");
assert.equal(money(0), "No price");
assert.equal(money(495.14), "$495.14");
assert.equal(moveText(22.2), "Up \u25B2 +22.2%");
assert.equal(moveText(-10), "Down \u25BC -10.0%");
assert.equal(cleanText("A \u2014 B sold via Collectr"), "A - B listings counted via a price file");

const hub = renderExplorer("", docs, {});
assert.ok(hub.includes("Catch'em"));
assert.ok(hub.includes("/data-explorer/sets"));
assert.ok(hub.includes("/data-explorer/reads"));
assert.ok(hub.includes("2 sets."));
assert.ok(hub.includes("Pick a log."));
assertClean(hub, "hub");

const sets = renderExplorer("sets", docs, { q: "151" });
assert.ok(sets.includes("Scarlet and Violet 151"));
assert.equal(textOf(sets).includes("Base"), false);
assert.ok(sets.includes("Source: TCGplayer market. Date: 2026-10-27."));
assert.ok(sets.includes("Value on file $100.00."));
assert.ok(renderExplorer("sets", docs, {}).includes("No price"));
assertClean(sets, "sets");

const sealed = renderExplorer("sealed", docs, {});
assert.ok(sealed.includes("Sealed."));
assert.ok(sealed.includes("Up \u25B2 +22.2%"));
assert.equal(/\bNM\b/.test(textOf(sealed)), false);
assert.equal(/condition/i.test(textOf(sealed)), false);
assertClean(sealed, "sealed");

const falling = renderExplorer("sealed", docs, { filter: "falling" });
assert.ok(textOf(falling).includes("Falling Tin"));
assert.equal(/\bNM\b/.test(textOf(falling)), false);
assert.ok(!textOf(falling).includes("Elite Trainer Box"));

const listings = renderExplorer("listings", docs, {});
assert.ok(listings.includes("119 listings counted."));
assert.ok(listings.includes("Earlier count on file: 100 on 2026-10-22."));
assert.ok(listings.includes("Date: 2026-10-23."));
assert.ok(listings.includes("No listings counted."));
assert.equal(/\bNM\b/.test(textOf(listings)), false);
assert.equal(/condition/i.test(listings), false);
assertClean(listings, "listings");

const history = renderExplorer("history", docs, { filter: "sealed" });
assert.ok(history.includes("From $405.23 on 2025-09-30 to $495.14 on 2026-10-23."));
assert.ok(history.includes("Up \u25B2 +22.2%"));
assert.ok(history.includes("Sealed."));
assert.equal(/condition/i.test(textOf(history)), false);
assertClean(history, "history");

const pulse = renderExplorer("pulse", docs, {});
assert.ok(pulse.includes("Mood 0. 0 is a score on file, not a missing price."));
assert.ok(pulse.includes("Mood 80."));
assert.ok(pulse.includes("Source: TCGplayer market indexes. Date: 2026-09-29."));
assertClean(pulse, "pulse");

const news = renderExplorer("news", docs, {});
assert.ok(news.includes("30th Celebration - Espeon"));
assert.ok(news.includes("Source: Example News. Date: 2026-11-06."));
assert.equal(news.includes("\u2014"), false);
assertClean(news, "news");

const reads = renderExplorer("reads", docs, {});
assert.ok(reads.includes("Not scored yet."));
assert.ok(reads.includes("Moved the way the read described."));
assert.ok(reads.includes("No price"));
assert.ok(reads.includes("listings counted"));
assert.ok(!/\bsold\b/i.test(reads));
assert.equal(/condition/i.test(textOf(reads)), false);
assertClean(reads, "reads");

const named = renderExplorer("sets", docs, { sort: "name" });
const text = textOf(named);
assert.ok(text.indexOf("Base") < text.indexOf("Scarlet and Violet 151"));

assert.equal(explorerLog("/data-explorer"), "");
assert.equal(explorerLog("/data-explorer/sets"), "sets");
assert.equal(explorerLog("/data-explorer/nope"), "missing");
assert.equal(explorerLog("/sets"), null);

resetExplorerCache();
const fetchImpl = async (url) => {
  const hit = Object.entries({
    "sets.json": docs.sets,
    "listings-counted.json": docs.listings,
    "movers.json": docs.movers,
    "market-meter.json": docs.meter,
    "today.json": docs.today,
    "releases.json": docs.releases,
    "track-record.json": docs.track,
  }).find(([name]) => String(url).endsWith(name));
  if (!hit) return { ok: false, status: 404 };
  return { ok: true, json: async () => hit[1] };
};
const res = await dataExplorerResponse(new Request("https://catchemtcg.com/data-explorer/listings"), { PUBLIC_FETCH: fetchImpl });
assert.equal(res.status, 200);
assert.ok((await res.text()).includes("119 listings counted."));
const head = await dataExplorerResponse(new Request("https://catchemtcg.com/data-explorer", { method: "HEAD" }), { PUBLIC_FETCH: fetchImpl });
assert.equal(head.status, 200);
assert.equal(await head.text(), "");
const missing = await dataExplorerResponse(new Request("https://catchemtcg.com/data-explorer/nope"), { PUBLIC_FETCH: fetchImpl });
assert.equal(missing.status, 404);
assert.equal(await dataExplorerResponse(new Request("https://catchemtcg.com/sets"), { PUBLIC_FETCH: fetchImpl }), null);

const indexSrc = readFileSync(new URL("../src/index.mjs", import.meta.url), "utf8");
const entrySrc = readFileSync(new URL("../src/site-entry.mjs", import.meta.url), "utf8");
const wrangler = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
assert.equal(indexSrc.includes("data-explorer"), false);
assert.ok(entrySrc.includes("dataExplorerResponse"));
assert.ok(wrangler.includes("src/site-entry.mjs"));
assert.equal(indexSrc.includes("return-visit"), false);

console.log("data-explorer tests passed");
