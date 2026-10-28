import assert from "node:assert/strict";
import { edgeFetch, cacheableRequest, errorPage, EDGE_TTL } from "../src/edge-cache.mjs";

const store = new Map();
globalThis.caches = { default: {
  async match(req) { const r = store.get(req.url); return r ? r.clone() : undefined; },
  async put(req, res) { store.set(req.url, res); },
} };
let renders = 0;
const render = async () => { renders++; return new Response("<p>hi</p>", { headers: { "content-type": "text/html", "cache-control": "no-store" } }); };
const req = (path, cookie) => new Request("https://catchemtcg.com" + path, { headers: cookie ? { cookie } : {} });

assert.equal(cacheableRequest(req("/c/abc")), true);
assert.equal(cacheableRequest(req("/post-office")), false);
assert.equal(cacheableRequest(req("/c/abc", "ce_session=x")), false);
assert.equal(cacheableRequest(new Request("https://catchemtcg.com/c/a", { method: "POST" })), false);
assert.equal(cacheableRequest(req("/p/tcgcsv-1?prewarm=1")), false);
assert.equal(cacheableRequest(req("/p/tcgcsv-1?prewarm=html")), true);

let r = await edgeFetch(render, req("/sets"), {}, {});
assert.equal(await r.text(), "<p>hi</p>");
r = await edgeFetch(render, req("/sets"), {}, {});
assert.equal(r.headers.get("x-edge-cache"), "hit");
assert.equal(r.headers.get("cache-control"), "no-store");
assert.equal(renders, 1);
await edgeFetch(render, req("/sets", "ce_session=abc"), {}, {});
assert.equal(renders, 2);

const boom = async () => { throw new Error("x"); };
r = await edgeFetch(boom, new Request("https://catchemtcg.com/c/z", { headers: { accept: "text/html" } }), {}, {});
assert.equal(r.status, 200);
assert.equal(r.headers.get("x-catchem-soft"), "1");
assert.match(await r.text(), /Retry/);
assert.doesNotMatch(await errorPage().text(), /\u2014/);

assert.equal(EDGE_TTL, 86400);
assert.equal(errorPage().status, 200);

const five = async () => new Response("<p>down</p>", { status: 503, headers: { "content-type": "text/html" } });
store.clear(); renders = 0;
// Seed a good copy, then a 5xx render must return stale 200.
await edgeFetch(render, req("/p/tcgcsv-1"), {}, {});
assert.equal(renders, 1);
r = await edgeFetch(five, req("/p/tcgcsv-1"), {}, {});
assert.equal(r.status, 200);
assert.equal(r.headers.get("x-edge-cache"), "hit");
// Miss + 5xx → graceful soft 200
store.clear();
r = await edgeFetch(five, req("/p/tcgcsv-2"), {}, {});
assert.equal(r.status, 200);
assert.equal(r.headers.get("x-catchem-soft"), "1");

console.log("edge-cache ok");
