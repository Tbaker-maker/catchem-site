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
  usesFallbackGlyph,
  sparkPoints,
} from "../src/product-share.mjs";
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
  depth: { sold: { n: 14, median: 2550, first: "2026-08-28", last: "2026-11-06" }, pop: { total: 2972 }, eur: { market: 10, asOf: "2026-11-11" } },
}), ["4 listings counted", "Sold median $2,550.00", "2,972 graded"]);
assert.deepEqual(shareFactLines({
  kind: "sealed",
  listings: { n: 96, day: "2026-10-30" },
  depth: { sold: { n: 2, median: 10, first: "2026-01-01", last: "2026-01-02" }, pop: { total: 9 } },
}), ["96 listings counted"]);
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
const opts = { loadProduct, dataVersion: "2026-10-30", buildId: "abcdef1234567890", shareExtras: false };
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

const page = addShareMeta(`<html><head><title>Lost Origin Elite Trainer Box · Catch'em</title></head><body><div data-rv-price="194.33" data-rv-date="2026-10-30"></div><img loading="eager" src="/data/cutouts/x.webp">${html}</body></html>`, "/p/tcgcsv-277335", "product");
assert.match(page, /property="og:image" content="https:\/\/catchemtcg\.com\/og\/product\/tcgcsv-277335\.png"/);
assert.match(page, /name="twitter:image" content="https:\/\/catchemtcg\.com\/og\/product\/tcgcsv-277335\.png"/);
assert.equal(page.includes("/og/product.png?"), false);
assert.equal(page.includes("twitter:image\" content=\"https://catchemtcg.com/data/cutouts/x.webp"), false);
assert.doesNotMatch(page, /og:image" content="[^"]*sold/i);
const src = readFileSync(new URL("../src/product-share.mjs", import.meta.url), "utf8");
assert.doesNotMatch(src, /[\u2014\u2013]/);
assert.doesNotMatch(src, /\b(NM|Near Mint|buy now|sell now)\b/);

console.log("product-share ok");
