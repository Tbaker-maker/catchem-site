// Product share card: 1200x630 PNG from the product's own data, no query-text prices.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  drawProductShare,
  renderProductSharePng,
  decodePng,
  handleProductShare,
  productShareUrl,
  productShareId,
  productShareCacheKey,
  shareFieldsFromProduct,
  shareFactLines,
  shareHeld,
  shareListings,
  listingsCountedFromEntry,
  usesFallbackGlyph,
  sparkPoints,
} from "../src/product-share.mjs";
import { renderCard } from "../src/ui.mjs";
import { resolveListings } from "../src/listings-count.mjs";
import { addShareMeta } from "../src/seo.mjs";

const pts = [40, 42, 41, 48, 55, 53, 60];
const a = drawProductShare({ name: "Lost Origin Elite Trainer Box", price: "$194.33", date: "Oct 30, 2026", source: "TCGplayer market", points: pts });
const b = drawProductShare({ name: "Other Box", price: "$10.00", date: "Oct 30, 2026", source: "TCGplayer market", points: pts });
let differ = false;
for (let i = 0; i < a.length; i += 50) if (a[i] !== b[i]) { differ = true; break; }
assert.equal(differ, true);
assert.equal(a.length, 1200 * 630 * 3);
assert.equal(a[2 * 1200 * 3], 217);

const png = await renderProductSharePng({ name: "Lost Origin Elite Trainer Box", price: "$194.33", date: "Oct 30, 2026", source: "TCGplayer market", points: pts });
assert.equal(png[0], 137);
assert.equal(png[1], 80);
assert.equal(String.fromCharCode(...png.subarray(12, 16)), "IHDR");
const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
assert.equal(view.getUint32(16), 1200);
assert.equal(view.getUint32(20), 630);
const decoded = await decodePng(png);
assert.equal(decoded.w, 1200);
assert.equal(decoded.h, 630);
assert.equal(decoded.rgba[2 * 1200 * 4], 217);

const red = { w: 2, h: 2, rgba: new Uint8Array([255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255]) };
const withPhoto = drawProductShare({ name: "Lost Origin Elite Trainer Box", price: "$194.33", date: "Oct 30, 2026", source: "TCGplayer market", points: pts, image: red });
assert.equal(withPhoto[(100 * 1200 + 80) * 3], 255);

const q = "&" + "quot;";
const html = '<figure data-p="[[' + q + '2026-10-01' + q + ',40],[' + q + '2026-10-02' + q + ',0],[' + q + '2026-10-03' + q + ',60,' + q + q + ',' + q + '2026-10-01' + q + '],[' + q + '2026-10-04' + q + ',55]]"></figure>';
assert.deepEqual(sparkPoints(html), [40, 55]);

assert.equal(usesFallbackGlyph("Pokémon Day 2026"), false);
assert.equal(usesFallbackGlyph("Scarlet & Violet"), false);
assert.equal(usesFallbackGlyph("#107"), false);
assert.equal(usesFallbackGlyph("Hello!"), false);
assert.equal(usesFallbackGlyph("É"), false);
const accent = drawProductShare({ name: "Pokémon Day 2026", price: "$1.00", date: "Nov 12, 2026", source: "TCGplayer market" });
const fallbackName = drawProductShare({ name: "Pok?mon Day 2026", price: "$1.00", date: "Nov 12, 2026", source: "TCGplayer market" });
assert.notEqual(Buffer.from(accent).equals(Buffer.from(fallbackName)), true);
const amp = drawProductShare({ name: "Scarlet & Violet", price: "$1.00", date: "Nov 12, 2026", source: "TCGplayer market" });
const ampFallback = drawProductShare({ name: "Scarlet ? Violet", price: "$1.00", date: "Nov 12, 2026", source: "TCGplayer market" });
assert.notEqual(Buffer.from(amp).equals(Buffer.from(ampFallback)), true);
const hash = drawProductShare({ name: "#107", price: "$1.00", date: "Nov 12, 2026", source: "TCGplayer market" });
const hashFallback = drawProductShare({ name: "?107", price: "$1.00", date: "Nov 12, 2026", source: "TCGplayer market" });
assert.notEqual(Buffer.from(hash).equals(Buffer.from(hashFallback)), true);

assert.equal(productShareUrl("tcgcsv-277335"), "https://catchemtcg.com/og/product/tcgcsv-277335.png");
assert.equal(productShareUrl({ id: "sv8pt5-etb" }), "https://catchemtcg.com/og/product/sv8pt5-etb.png");
assert.equal(productShareUrl("../secret"), "");
assert.equal(productShareId("/og/product/tcgcsv-277335.png"), "tcgcsv-277335");
assert.equal(productShareId("/og/product.png"), "");

const card = {
  id: "tcgcsv-277335",
  name: "Lost Origin Elite Trainer Box",
  price: 194.33,
  asOf: "2026-10-30",
  source: "TCGplayer market",
  hist: [["2026-10-01", 40], ["2026-10-02", 0], ["2026-10-03", 60], ["2026-10-04", 55]],
};
const fields = shareFieldsFromProduct(card);
assert.equal(fields.name, "Lost Origin Elite Trainer Box");
assert.equal(fields.price, "$194.33");
assert.equal(fields.date, "Oct 30, 2026");
assert.equal(fields.source, "TCGplayer market");
assert.deepEqual(fields.points, [40, 60, 55]);
assert.deepEqual(shareFactLines({
  kind: "single",
  listings: { n: 4, day: "2026-11-11" },
  depth: { sold: { n: 14, median: 2550, first: "2026-08-28", last: "2026-11-06" }, pop: { total: 2972, asOf: "2026-11-01" }, eur: { market: 10, asOf: "2026-11-11" } },
}), ["4 listings counted, Nov 11, 2026", "2,972 graded, PSA, BGS, CGC and SGC, Nov 1, 2026"]);
assert.deepEqual(shareFactLines({
  kind: "sealed",
  listings: { n: 96, day: "2026-10-30" },
  depth: { sold: { n: 2, median: 10, first: "2026-01-01", last: "2026-01-02" }, pop: { total: 9 } },
}), ["96 listings counted, Oct 30, 2026"]);
assert.deepEqual(shareFactLines({ listings: { n: 4 } }), []);
const withFacts = drawProductShare({ name: "Lost Origin Elite Trainer Box", price: "$194.33", date: "Oct 30, 2026", source: "TCGplayer market", points: pts, facts: ["96 listings counted", "Sold median $1,400.00"] });
assert.equal(Buffer.from(a).equals(Buffer.from(withFacts)), false);

const store = new Map();
globalThis.caches = { default: {
  async match(req) { return store.get(req.url) ? store.get(req.url).clone() : undefined; },
  async put(req, res) { store.set(req.url, res.clone()); },
} };
const loadProduct = async (id) => (id === "tcgcsv-277335" ? { ...card } : null);
const shareUrl = new URL("https://catchemtcg.com/og/product/tcgcsv-277335.png");
const opts = { loadProduct, dataVersion: "2026-10-30", buildId: "abcdef1234567890", shareExtras: false, holdDoc: null };
const res = await handleProductShare(new Request(shareUrl), shareUrl, opts);
assert.equal(res.status, 200);
assert.equal(res.headers.get("content-type"), "image/png");
assert.equal(res.headers.get("cdn-cache-control"), "no-store");
assert.equal(res.headers.get("x-data-version"), "2026-10-30");
const body = new Uint8Array(await res.arrayBuffer());
assert.equal(body[0], 137);

const fakeUrl = new URL("https://catchemtcg.com/og/product/tcgcsv-277335.png?p=%24999.00&n=Fake%20Card&d=Jan%201,%201999&src=Made%20up");
const fake = await handleProductShare(new Request(fakeUrl), fakeUrl, opts);
assert.equal(fake.status, 200);
const fakeBody = new Uint8Array(await fake.arrayBuffer());
assert.equal(Buffer.from(body).equals(Buffer.from(fakeBody)), true);

const hit = await handleProductShare(new Request(shareUrl), shareUrl, opts);
assert.equal(hit.headers.get("x-edge-cache"), "hit");
const key = productShareCacheKey("tcgcsv-277335", "2026-10-30", "abcdef1234567890");
assert.equal(new URL(key.url).searchParams.get("dv"), "2026-10-30");
assert.equal(new URL(key.url).searchParams.get("bv"), "abcdef123456");
assert.equal(new URL(key.url).pathname, "/og/product/tcgcsv-277335.png");

const otherDay = await handleProductShare(new Request(shareUrl), shareUrl, { ...opts, dataVersion: "2026-11-12" });
assert.equal(otherDay.headers.get("x-edge-cache"), null);
const otherBuild = await handleProductShare(new Request(shareUrl), shareUrl, { ...opts, buildId: "bbbb22222222" });
assert.equal(otherBuild.headers.get("x-edge-cache"), null);

const missing = await handleProductShare(new Request("https://catchemtcg.com/og/product/no-such.png"), new URL("https://catchemtcg.com/og/product/no-such.png"), opts);
assert.equal(missing.status, 404);
const oldQuery = await handleProductShare(new Request("https://catchemtcg.com/og/product.png?n=Fake&p=%24999"), new URL("https://catchemtcg.com/og/product.png?n=Fake&p=%24999"), opts);
assert.equal(oldQuery.status, 404);

assert.equal(oldQuery.status, 404);

assert.equal(shareHeld(card, null), false);
assert.equal(shareHeld({ ...card, priceStatus: "checking" }, null), true);
assert.equal(shareHeld(card, { ids: { "tcgcsv-277335": true } }), true);
assert.deepEqual(listingsCountedFromEntry({ listingsCounted: { n: 42, date: "2026-10-30" } }), { n: 42, day: "2026-10-30" });
assert.equal(listingsCountedFromEntry({ listingsCounted: { n: 1 } }), null);

const depth = { sold: { n: 14, median: 2550, first: "2026-08-28", last: "2026-11-06" }, pop: { total: 2972, asOf: "2026-11-01" } };
const baseFields = shareFieldsFromProduct(card);
async function sharePng(extra) {
  const url = new URL("https://catchemtcg.com/og/product/tcgcsv-277335.png");
  const res = await handleProductShare(new Request(url), url, {
    loadProduct: async () => ({ ...card, kind: "single", ...(extra.card || {}) }),
    dataVersion: "2026-10-30",
    buildId: extra.buildId,
    holdDoc: extra.holdDoc === undefined ? null : extra.holdDoc,
    loadDepth: extra.loadDepth || (async () => depth),
    loadListings: extra.loadListings || (async () => ({ n: 4, day: "2026-11-11" })),
  });
  assert.equal(res.status, 200);
  return new Uint8Array(await res.arrayBuffer());
}
const normalFacts = ["4 listings counted, Nov 11, 2026", "2,972 graded, PSA, BGS, CGC and SGC, Nov 1, 2026"];
assert.deepEqual(shareFactLines({ kind: "single", listings: { n: 4, day: "2026-11-11" }, depth }), normalFacts);
const normalPng = await renderProductSharePng({ ...baseFields, facts: normalFacts });
assert.equal(Buffer.from(await sharePng({ buildId: "normalnormal01" })).equals(Buffer.from(normalPng)), true);

const noneFacts = ["2,972 graded, PSA, BGS, CGC and SGC, Nov 1, 2026"];
assert.deepEqual(shareFactLines({ kind: "single", listings: null, depth }), noneFacts);
const nonePng = await renderProductSharePng({ ...baseFields, facts: noneFacts });
assert.equal(Buffer.from(await sharePng({ buildId: "nolistings0001", loadListings: async () => null })).equals(Buffer.from(nonePng)), true);

const heldFields = shareFieldsFromProduct({ ...card, priceStatus: "checking" });
assert.equal(heldFields.price, "");
assert.deepEqual(heldFields.points, []);
const heldPng = await renderProductSharePng({ ...heldFields, facts: [] });
assert.equal(Buffer.from(await sharePng({
  buildId: "heldstatus0001",
  card: { priceStatus: "checking" },
  loadDepth: async () => depth,
  loadListings: async () => ({ n: 96, day: "2026-10-30" }),
})).equals(Buffer.from(heldPng)), true);
assert.equal(Buffer.from(await sharePng({
  buildId: "heldfile000001",
  holdDoc: { ids: { "tcgcsv-277335": true } },
  loadDepth: async () => depth,
  loadListings: async () => ({ n: 96, day: "2026-10-30" }),
})).equals(Buffer.from(heldPng)), true);

const diveFetch = async (url) => {
  const u = String(url);
  if (u.includes("listings-counted.json")) {
    return new Response(JSON.stringify({ products: [{ id: "swsh7-bb", listingsCounted: { n: 42, date: "2026-10-29" } }] }), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (u.includes("research/pulse/dive/index.json")) {
    return new Response(JSON.stringify({ ids: ["swsh7-bb", "sv8pt5-etb"], byTcgcsv: { "tcgcsv-1": "swsh7-bb", "tcgcsv-2": "sv8pt5-etb" } }), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (u.includes("/dive/swsh7-bb")) {
    return new Response(JSON.stringify({ series: [{ date: "2026-10-29", listingCount: 42 }, { date: "2026-11-14", listingCount: 132 }] }), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (u.includes("/dive/sv8pt5-etb")) {
    return new Response(JSON.stringify({ series: [{ date: "2026-11-14", listingCount: 87 }] }), { status: 200, headers: { "content-type": "application/json" } });
  }
  return new Response("no", { status: 404 });
};
const listed = await shareListings({ id: "tcgcsv-1", kind: "sealed", name: "Box" }, diveFetch);
assert.deepEqual(listed, { n: 132, day: "2026-11-14" });
const noFile = await shareListings({ id: "tcgcsv-2", kind: "sealed", name: "Missing file" }, diveFetch);
assert.deepEqual(noFile, { n: 87, day: "2026-11-14" });

const diveSeries = [{ date: "2026-10-29", listingCount: 42 }, { date: "2026-11-14", listingCount: 132 }];
const staleFile = { n: 42, day: "2026-10-29" };
const sealedCard = { id: "tcgcsv-1", name: "Enhanced Booster Box", kind: "sealed", set: "Mega", price: 200, asOf: "2026-11-14", source: "TCGplayer market", hist: [["2026-11-01", 190], ["2026-11-14", 200]] };
const stalePage = renderCard(sealedCard, "stamp", { listingSeries: diveSeries, itemListings: staleFile });
const barePage = renderCard(sealedCard, "stamp", { listingSeries: diveSeries });
const chipCount = resolveListings({ kind: "sealed", series: diveSeries, itemListings: staleFile });
assert.deepEqual(chipCount, { n: 132, day: "2026-11-14" });
assert.deepEqual(shareFactLines({ kind: "sealed", listings: chipCount }), ["132 listings counted, Nov 14, 2026"]);
assert.equal(stalePage.includes("132 listings counted"), true);
assert.equal(stalePage.includes("42 listings counted"), false);
assert.equal(barePage.includes("132 listings counted"), true);
assert.equal(barePage.includes("<dt>Listings counted</dt>") && barePage.includes("132 on Nov 14, 2026"), true);

const page = addShareMeta(`<html><head><title>Lost Origin Elite Trainer Box · Catch'em</title></head><body><div data-rv-price="194.33" data-rv-date="2026-10-30"></div><img loading="eager" src="/data/cutouts/x.webp">${html}</body></html>`, "/p/tcgcsv-277335", "product");
assert.match(page, /property="og:image" content="https:\/\/catchemtcg\.com\/og\/product\/tcgcsv-277335\.png"/);
assert.match(page, /name="twitter:image" content="https:\/\/catchemtcg\.com\/og\/product\/tcgcsv-277335\.png"/);
assert.equal(page.includes("/og/product.png?"), false);
assert.equal(page.includes("twitter:image\" content=\"https://catchemtcg.com/data/cutouts/x.webp"), false);
assert.doesNotMatch(page, /og:image" content="[^"]*sold/i);
const src = readFileSync(new URL("../src/product-share.mjs", import.meta.url), "utf8");
assert.equal(/\bloadDive\(/.test(src), false);
assert.equal(src.includes("image: opts.image"), false);
assert.doesNotMatch(src, /[\u2014\u2013]/);
assert.doesNotMatch(src, /\b(NM|Near Mint|buy now|sell now)\b/);

const blankPng = await renderProductSharePng({ name: card.name, price: "", date: "", source: "", points: [], facts: [] });
const holdUrl = new URL("https://catchemtcg.com/og/product/tcgcsv-277335.png");
const holdDown = await handleProductShare(new Request(holdUrl), holdUrl, {
  loadProduct: async () => ({ ...card, kind: "single" }),
  dataVersion: "2026-10-30",
  buildId: "holddown000001",
  loadHold: async () => { throw new Error("price-hold.json down"); },
  loadDepth: async () => depth,
  loadListings: async () => ({ n: 4, day: "2026-11-11" }),
});
assert.equal(holdDown.status, 200);
assert.equal(Buffer.from(new Uint8Array(await holdDown.arrayBuffer())).equals(Buffer.from(blankPng)), true);

console.log("product-share ok");
