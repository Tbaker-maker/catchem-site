import assert from "node:assert/strict";
import { officialSrc } from "../src/catalogue-image.mjs";
import { chartBox, priceBannerLine, renderFacts, renderPokemon, renderSearch, renderStatus } from "../src/ui.mjs";
import { queryShardIds } from "../src/search-shards.mjs";
import { addError, topErrors } from "../src/client-log.mjs";

const both = officialSrc({ id: "bw6-120", tcgPlayerId: "9" }, { "bw6-120": "/cards/seed/bw6-120.png" });
assert.ok(String(both.src).includes("bw6-120"));
assert.equal(both.alts[0], "/data/editor/tcg/bw6/120_hires.png");
assert.ok(both.alts.includes("/api/card-img?pid=9"));

globalThis.CATCHEM_TCG_IMAGES = false;
assert.equal(officialSrc({ id: "tcgcsv-42" }, {}).src, "");
globalThis.CATCHEM_TCG_IMAGES = true;
assert.equal(officialSrc({ id: "tcgcsv-42" }, {}).src, "/api/card-img?pid=42");

const stamp = "2026-10-10T10:32:00.413Z";
const at = Date.parse(stamp);
assert.equal(priceBannerLine(stamp, at + 36 * 3600 * 1000), "");
assert.equal(priceBannerLine(stamp, at + 36 * 3600 * 1000 + 1), "Prices last updated 2026-10-10.");
assert.equal(priceBannerLine("", at), "");

assert.ok(renderFacts({}).includes("No market line in the price file."));
assert.ok(renderFacts({ market: 2.64, date: "2026-10-10", source: "TCGplayer market" }).includes("Market"));
assert.ok(!renderFacts({ market: 2.64, date: "2026-10-10", source: "TCGplayer market" }).includes("No market line"));
assert.ok(chartBox([], "TCGplayer market").includes("No daily points in this file."));
assert.ok(!chartBox([], "TCGplayer market").includes("chart-box"));
assert.ok(chartBox([["2026-10-10", 2.64]], "TCGplayer market").includes("chart-box"));
assert.ok(renderStatus({}, "").includes("The status file is not in the public feed."));

const search = renderSearch();
assert.ok(search.includes("Type at least 2 letters."));
assert.ok(search.includes("/data/feed/search/manifest.json"));
assert.ok(search.includes('loading="lazy"'));
assert.ok(!search.includes("Loading the index."));
assert.deepEqual(queryShardIds("Mo"), ["sealed-mo", "single-mo", "slab-mo"]);
assert.equal(queryShardIds("m").length, 0);

const page = renderPokemon({
  name: "Abra",
  slug: "abra",
  cards: [{ id: "x", name: "Abra", set: "Base Set", number: "1", price: 1, link: "https://www.tcgplayer.com/product/5" }],
}, "");
assert.ok(page.includes("https://www.tcgplayer.com/product/5"));
assert.ok(page.includes("Paid link"));

const log = addError({ events: [] }, { message: "boom", at: "2026-10-10T00:00:00Z" });
assert.equal(topErrors(log)[0].count, 1);
assert.equal(topErrors(addError(log, { message: "" })).length, 1);
const twice = addError(log, { message: "boom", at: "2026-10-11T00:00:00Z" });
assert.equal(topErrors(twice)[0].count, 2);

console.log("trust ok");
