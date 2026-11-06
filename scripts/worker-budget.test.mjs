// Measures KV puts and route time. The before column is the pre-change run
// on this same fixture shape (one put per row, HTML uncached).
import assert from "node:assert/strict";
import worker from "../src/index.mjs";
import { warmBucket, seedProdRowsFromBucket, setRawKv, setDataVersion, resetDataBase } from "../src/data.mjs";
import { resetKvOnce } from "../src/kv-once.mjs";
import { PUBLIC_CACHE, cacheablePath } from "../src/edge-cache.mjs";

function kv(failKeys = null) {
  const m = new Map();
  let puts = 0;
  return {
    puts: () => puts,
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async put(k, v) {
      if (failKeys && failKeys.has(k)) throw new Error("kv put failed");
      puts++;
      m.set(k, v);
    },
  };
}

function bucketText(n) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    rows.push(JSON.stringify({ id: "tcgcsv-" + (1000 + i), name: "Card " + i, kind: i % 17 === 0 ? "sealed" : "single", price: 1.25, set: "Demo" }));
  }
  return "[" + rows.join(",") + "]";
}

// Before, measured on origin/main with this fixture:
// seedProdRowsFromBucket(400 rows) = 400 puts, 7.86ms
// warmBucket one 400-row file = 402 puts
// 100 buckets x 200 rows = 20200 puts, 109ms
// Real bucket 00.json (984351 bytes, 323 priced rows) extractAllRows = 30.66ms
// A 100-bucket prewarm at that size is about 32300 puts and about 3.1s of parse.
const BEFORE = {
  "seed-400": { puts: 400, peakMs: 7.86 },
  "warm-400": { puts: 402 },
  "prewarm-100": { puts: 20200, peakMs: 109 },
  "/": { avgMs: 11.1, peakMs: 30.91, puts: 0 },
  "/sets": { avgMs: 9.66, peakMs: 21.86, puts: 0 },
  "/feed": { avgMs: 1.53, peakMs: 1.83, puts: 0 },
  "/p/tcgcsv-100": { avgMs: 9.93, peakMs: 22.04, puts: 3 },
  "/c/tcgcsv-100": { avgMs: 6.13, peakMs: 7.3, puts: 0 },
  "/search": { avgMs: 9.94, peakMs: 10.96, puts: 0 },
  "/promos": { avgMs: 0.88, peakMs: 1.08, puts: 0 },
  "/methodology": { avgMs: 3.81, peakMs: 7.64, puts: 0 },
  "/faq": { avgMs: 1.63, peakMs: 1.71, puts: 0 },
  "/api/quick?id=tcgcsv-100": { avgMs: 1.36, peakMs: 2.98, puts: 0 },
};

resetKvOnce();
setDataVersion("2026-11-06");
const text = bucketText(400);
const store = kv();
const t0 = performance.now();
const seeded = await seedProdRowsFromBucket(text, store);
const seedMs = performance.now() - t0;
assert.equal(seeded, 0);
assert.equal(store.puts(), 0);
assert.ok(seedMs < BEFORE["seed-400"].peakMs + 5);

resetDataBase();
setRawKv(store);
let fetches = 0;
const fetchImpl = async () => { fetches++; return new Response(text, { status: 200, headers: { "content-type": "application/json" } }); };
const w0 = performance.now();
const first = await warmBucket("07", fetchImpl);
const warmMs = performance.now() - w0;
const putsFirst = store.puts();
assert.equal(first.rows, 0);
assert.ok(putsFirst <= 3, "one body, one hash, one version key, got " + putsFirst);
assert.ok(putsFirst < BEFORE["warm-400"].puts);
const second = await warmBucket("07", fetchImpl);
assert.equal(second.skipped, true);
assert.equal(store.puts(), putsFirst);
assert.equal(fetches, 1);

// Same bytes, new publish day: no second body write.
setDataVersion("2026-11-07");
const third = await warmBucket("07", fetchImpl);
assert.equal(third.skipped, false);
const afterDay = store.puts();
assert.ok(afterDay - putsFirst <= 1, "new day rewrites only the version key, got " + (afterDay - putsFirst));

// A failed body put keeps the previous value and does not throw.
const fail = kv(new Set(["rawpub:v3:research/assets/public/buckets/08.json"]));
setRawKv(fail);
setDataVersion("2026-11-06");
const kept = await warmBucket("08", async () => new Response(text, { status: 200 }));
assert.equal(kept.bytes, text.length);
assert.equal(fail.puts() <= 1, true);
const last = await fail.get("rawpub:v3:research/assets/public/buckets/08.json");
assert.equal(last, null);

// Origin miss serves the last stored body.
const keep = kv();
setRawKv(keep);
setDataVersion("2026-11-06");
await warmBucket("09", async () => new Response("{\"id\":\"tcgcsv-9\",\"name\":\"Box\",\"kind\":\"sealed\",\"price\":2}", { status: 200 }));
const storedPuts = keep.puts();
setDataVersion("2026-11-08");
const again = await warmBucket("09", async () => { throw new Error("origin down"); });
assert.ok(again.bytes > 0);
assert.equal(keep.puts(), storedPuts);

const routes = ["/", "/sets", "/feed", "/p/tcgcsv-100", "/c/tcgcsv-100", "/search", "/promos", "/methodology", "/faq", "/api/quick?id=tcgcsv-100"];
for (const path of routes) {
  if (path.startsWith("/api/")) assert.equal(cacheablePath(path.split("?")[0]), false);
  else assert.equal(cacheablePath(path), true, path);
}

const edge = new Map();
globalThis.caches = { default: {
  async match(req) { const r = edge.get(req.url); return r ? r.clone() : undefined; },
  async put(req, res) { edge.set(req.url, res); },
} };
const files = {
  "counts.json": JSON.stringify({ asOf: "2026-11-06", items: 1 }),
  "market-meter.json": JSON.stringify({ asOf: "2026-11-06", published: true, market: { score: 1 } }),
  "today.json": JSON.stringify({ asOf: "2026-11-06", lines: [] }),
  "buckets/00.json": JSON.stringify([{ id: "tcgcsv-100", name: "Demo Box", kind: "sealed", price: 10, set: "Demo", setSlug: "demo" }]),
};
const pageKv = kv();
setRawKv(pageKv);
resetKvOnce();
setDataVersion("2026-11-06");
const pub = async (url) => {
  const rel = String(url).split("research/assets/public/")[1] || "";
  if (files[rel]) return new Response(files[rel], { status: 200, headers: { "content-type": "application/json" } });
  if (String(url).includes("counts.json")) return new Response(files["counts.json"], { status: 200 });
  return new Response("no", { status: 404 });
};
const env = {
  FEED_KV: pageKv,
  FEED_ENABLED: "true",
  PUBLIC_FETCH: pub,
  ASSETS: { async fetch() { return new Response("<!doctype html><html><body><p class=\"beta\" id=\"fresh\">x</p><footer></footer></body></html>", { status: 200, headers: { "content-type": "text/html" } }); } },
};
const after = {};
for (const path of routes) {
  const times = [];
  const putAt = [];
  const p0 = pageKv.puts();
  let cc = "";
  for (let i = 0; i < 3; i++) {
    const t = performance.now();
    const res = await worker.fetch(new Request("https://catchemtcg.com" + path), env, { waitUntil(p) { return p; } });
    cc = res.headers.get("cache-control") || "";
    await res.text();
    times.push(performance.now() - t);
    putAt.push(pageKv.puts() - p0);
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const peak = Math.max(...times);
  after[path] = { avg: Math.round(avg * 100) / 100, peak: Math.round(peak * 100) / 100, puts: putAt[2], cc, putAt };
  if (path.startsWith("/p/")) assert.equal(putAt[2], putAt[0], "repeat product views must not write KV again");
  if (cacheablePath(path.split("?")[0])) assert.match(cc, /stale-while-revalidate=86400/);
}
assert.equal(PUBLIC_CACHE.includes("stale-while-revalidate=86400"), true);
console.log("before", JSON.stringify(BEFORE));
console.log("after-warm", JSON.stringify({ seedMs: Math.round(seedMs * 100) / 100, warmMs: Math.round(warmMs * 100) / 100, putsFirst, afterDay }));
console.log("after-routes", JSON.stringify(after));
console.log("worker-budget ok");
