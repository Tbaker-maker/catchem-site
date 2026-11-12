import assert from "node:assert/strict";
import { edgeFetch, cacheableRequest, errorPage, EDGE_TTL, EDGE_SWR, cacheKeyUrl, edgeCacheKey, edgeBuildId } from "../src/edge-cache.mjs";

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
assert.equal(r.headers.get("cdn-cache-control"), "no-store");
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
assert.equal(EDGE_SWR, 3600);
assert.equal(edgeBuildId("abcdef1234567890"), "abcdef123456");
assert.equal(edgeBuildId(""), "dev");
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


// Versioned edge key: different dv must miss
store.clear(); renders = 0;
await edgeFetch(render, req("/p/tcgcsv-9"), {}, {}, { dataVersion: "2026-10-27" });
assert.equal(renders, 1);
r = await edgeFetch(render, req("/p/tcgcsv-9"), {}, {}, { dataVersion: "2026-10-27" });
assert.equal(r.headers.get("x-edge-cache"), "hit");
assert.equal(r.headers.get("x-data-version"), "2026-10-27");
r = await edgeFetch(render, req("/p/tcgcsv-9"), {}, {}, { dataVersion: "2026-10-28" });
assert.equal(renders, 2);
assert.equal(r.headers.get("x-data-version"), "2026-10-28");


// Feed ?f= / ?set= are client filters: same HTML, one edge key (stops cold 1102 per chip).
assert.equal(cacheKeyUrl("https://catchemtcg.com/feed?f=sealed"), "https://catchemtcg.com/feed");
assert.equal(cacheKeyUrl("https://catchemtcg.com/feed?f=signals&set=mew"), "https://catchemtcg.com/feed");
assert.equal(cacheKeyUrl("https://catchemtcg.com/feed?f=news"), cacheKeyUrl("https://catchemtcg.com/feed?f=prices"));
assert.equal(cacheKeyUrl("https://catchemtcg.com/sets?set=mew"), "https://catchemtcg.com/sets?set=mew");


// Cold filter URLs must reuse the bare /feed edge entry (one render, not one per chip).
store.clear(); renders = 0;
await edgeFetch(render, req("/feed?f=signals"), {}, {}, { dataVersion: "2026-10-28" });
assert.equal(renders, 1);
r = await edgeFetch(render, req("/feed?f=sealed"), {}, {}, { dataVersion: "2026-10-28" });
assert.equal(renders, 1);
assert.equal(r.headers.get("x-edge-cache"), "hit");
r = await edgeFetch(render, req("/feed"), {}, {}, { dataVersion: "2026-10-28" });
assert.equal(renders, 1);
assert.equal(r.headers.get("x-edge-cache"), "hit");

// A deploy changes the build stamp. Same data day must miss on the three paths
// that stayed stale for hours after the ungate deploy.
store.clear(); renders = 0;
const stampA = async () => new Response("<p>stamp-a</p>", { headers: { "content-type": "text/html" } });
const stampB = async () => { renders++; return new Response("<p>stamp-b</p>", { headers: { "content-type": "text/html" } }); };
const day = "2026-11-12";
for (const path of ["/p/tcgcsv-242436", "/indexes", "/feed"]) {
  await edgeFetch(stampA, req(path), {}, {}, { dataVersion: day, buildId: "aaaa11111111" });
}
renders = 0;
for (const path of ["/p/tcgcsv-242436", "/indexes", "/feed"]) {
  r = await edgeFetch(stampB, req(path), {}, {}, { dataVersion: day, buildId: "bbbb22222222" });
  assert.equal(r.headers.get("x-edge-cache"), null);
  assert.equal(await r.text(), "<p>stamp-b</p>");
}
assert.equal(renders, 3);
r = await edgeFetch(stampB, req("/p/tcgcsv-242436"), {}, {}, { dataVersion: day, buildId: "bbbb22222222" });
assert.equal(r.headers.get("x-edge-cache"), "hit");
assert.equal(renders, 3);
r = await edgeFetch(stampB, req("/indexes"), {}, {}, { dataVersion: day, buildId: "aaaa11111111" });
assert.equal(await r.text(), "<p>stamp-a</p>");
assert.equal(r.headers.get("x-edge-cache"), "hit");
const key = edgeCacheKey(req("/feed"), day, "bbbb22222222");
assert.equal(new URL(key.url).searchParams.get("bv"), "bbbb22222222");
assert.equal(new URL(key.url).searchParams.get("dv"), day);

// Past the fresh window, the same stamp is served stale and refreshed in the background.
const staleKey = edgeCacheKey(req("/feed?f=news"), day, "bbbb22222222");
const stored = store.get(staleKey.url);
assert.ok(stored);
assert.match(stored.headers.get("cache-control"), new RegExp(`max-age=${EDGE_TTL + EDGE_SWR}`));
const aged = new Headers(stored.headers);
aged.set("x-cached-at", String(Date.now() - (EDGE_TTL + 5) * 1000));
store.set(staleKey.url, new Response("<p>old</p>", { status: 200, headers: aged }));
renders = 0;
let bg = null;
r = await edgeFetch(stampB, req("/feed?f=prices"), {}, { waitUntil(p) { bg = p; } }, { dataVersion: day, buildId: "bbbb22222222" });
assert.equal(r.headers.get("x-edge-cache"), "stale");
assert.equal(await r.text(), "<p>old</p>");
assert.ok(bg);
await bg;
r = await edgeFetch(stampB, req("/feed"), {}, {}, { dataVersion: day, buildId: "bbbb22222222" });
assert.equal(r.headers.get("x-edge-cache"), "hit");
assert.equal(await r.text(), "<p>stamp-b</p>");

console.log("edge-cache ok");
