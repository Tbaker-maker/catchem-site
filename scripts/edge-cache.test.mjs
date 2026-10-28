import assert from "node:assert/strict";
import { edgeFetch, cacheableRequest, errorPage } from "../src/edge-cache.mjs";

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
assert.equal(cacheableRequest(req("/p/tcgcsv-1?prewarm=html")), false);

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
assert.equal(r.status, 503);
assert.match(await r.text(), /Retry/);
assert.doesNotMatch(await errorPage().text(), /\u2014/);
console.log("edge-cache ok");
