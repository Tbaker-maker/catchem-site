// Product share card: 1200x630 PNG, real page fields, no condition label.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { drawProductShare, renderProductSharePng, decodePng, handleProductShare, productShareUrl, sparkPoints } from "../src/product-share.mjs";
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

const url = productShareUrl({ name: "Lost Origin Elite Trainer Box", price: "$194.33", date: "Oct 30, 2026", source: "TCGplayer market", points: pts, image: "/data/cutouts/x.png" });
assert.equal(url.startsWith("https://catchemtcg.com/og/product.png?"), true);
assert.equal(url.includes("194.33"), true);
assert.equal(url.includes("TCGplayer"), true);
assert.equal(url.includes("40%2C42") || url.includes("40,42") || url.includes("pts=40"), true);

const res = await handleProductShare(new Request(url), new URL(url), async () => new Response("", { status: 404 }));
assert.equal(res.headers.get("content-type"), "image/png");
assert.equal(res.status, 200);
const body = new Uint8Array(await res.arrayBuffer());
assert.equal(body[0], 137);

const page = addShareMeta(`<html><head><title>Lost Origin Elite Trainer Box · Catch'em</title></head><body><div data-rv-price="194.33" data-rv-date="2026-10-30"></div><img loading="eager" src="/data/cutouts/x.webp">${html}</body></html>`, "/p/tcgcsv-277335", "product");
assert.match(page, /property="og:image" content="https:\/\/catchemtcg\.com\/og\/product\.png\?/);
assert.match(page, /name="twitter:image" content="https:\/\/catchemtcg\.com\/og\/product\.png\?/);
assert.equal(page.includes("twitter:image\" content=\"https://catchemtcg.com/data/cutouts/x.webp"), false);
assert.doesNotMatch(page, /og:image" content="[^"]*sold/i);
const src = readFileSync(new URL("../src/product-share.mjs", import.meta.url), "utf8");
assert.doesNotMatch(src, /[\u2014\u2013]/);
assert.doesNotMatch(src, /\b(NM|Near Mint|buy now|sell now)\b/);

console.log("product-share ok");
