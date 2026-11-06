// Edge and CDN cache for public HTML.
//
// Card, sealed, set, feed and home pages were rendered on every hit with
// no-store, so a cold isolate parsed large JSON on the request and hit the
// Worker CPU limit. Anonymous GETs of those pages are cached here and sent
// with a long Cache-Control plus stale-while-revalidate, so repeat views do
// not run the Worker. Signed-in visitors (ce_session cookie) always render.
// A soft error page stays uncached.

export const EDGE_TTL = 86400; // 24h inside this colo. counts.asOf is part of the key.
export const PUBLIC_CACHE = "public, max-age=120, stale-while-revalidate=86400";
const CACHEABLE = /^\/(c|p|sets|feed|artists|pokemon|indexes|board|releases|rotation|weekly|receipts|methodology|accuracy|dive)(\/|$)/;
const EXACT = new Set(["/", "/search", "/promos", "/today", "/compare", "/faq", "/supply", "/set-value"]);

function edgeCache() {
  try { return typeof caches !== "undefined" && caches.default ? caches.default : null; } catch { return null; }
}

export function cacheablePath(pathname) {
  if (EXACT.has(pathname)) return true;
  return CACHEABLE.test(pathname);
}

export function cacheableRequest(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (!cacheablePath(url.pathname)) return false;
  // ?prewarm=1 must always hit render so the bucket key can be checked.
  // Seed-only must always render. prewarm=html should populate this cache
  // so the first visitor does not pay for the render when KV writes are limited.
  if (url.searchParams.get("prewarm") === "1") return false;
  const cookie = request.headers.get("cookie") || "";
  if (/(?:^|;\s*)ce_(session|oauth)=/.test(cookie)) return false;
  return true;
}

// Tracking params never change the page, so they never split the cache.
const TRACKING = /^(utm_[a-z_]+|fbclid|gclid|gbraid|wbraid|dclid|msclkid|twclid|ttclid|li_fat_id|mc_cid|mc_eid|igshid|yclid|_ga|_gl|ref|ref_src|ref_url|s|t|si|source|cb|nocache|cold|seq|retry|prewarm)$/i;
export function cacheKeyUrl(href) {
  const url = new URL(href);
  url.hash = "";
  for (const k of [...url.searchParams.keys()]) if (TRACKING.test(k)) url.searchParams.delete(k);
  // Feed filters (?f=, ?set=) are applied in the browser on the same HTML.
  // Keeping them in the edge key forced a cold Worker render per chip.
  if (url.pathname === "/feed" || url.pathname.startsWith("/feed/")) {
    url.searchParams.delete("f");
    url.searchParams.delete("set");
  }
  url.searchParams.sort();
  return url.toString();
}
// Panel generation: bump when mid-day fact/copy changes must drop same-day edge HTML.
export const PANEL_CACHE_GEN = "4";
function cacheKey(request, dataVersion = "") {
  const url = new URL(cacheKeyUrl(request.url));
  const day = String(dataVersion || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) url.searchParams.set("dv", day);
  url.searchParams.set("pv", PANEL_CACHE_GEN);
  url.searchParams.sort();
  return new Request(url.toString(), { method: "GET" });
}

export function errorPage() {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Catch'em · One moment</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0d12;color:#e9ecf2;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.card{max-width:380px;margin:24px;padding:32px 28px;border-radius:24px;background:#151922;border:1px solid #232937;text-align:center}
h1{font-size:22px;margin:0 0 8px}p{color:#9aa3b5;margin:0 0 24px}
a,button{display:inline-block;border:0;border-radius:999px;padding:12px 26px;font:600 15px/1 inherit;cursor:pointer;text-decoration:none}
button{background:#f2c14e;color:#14110a}a{color:#9aa3b5;margin-top:12px}</style></head>
<body><main class="card"><h1>This page is taking a breather</h1><p>Catch'em is busy for a second. Try again and it should load.</p>
<button onclick="location.reload()">Retry</button><br><a href="/">Go home</a></main></body></html>`;
  return new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-catchem-soft": "1" } });
}

async function safeRender(render, request, env, ctx) {
  try { return await render(request, env, ctx); }
  catch (err) {
    if (request.method === "GET" && (request.headers.get("accept") || "").includes("text/html")) return errorPage();
    throw err;
  }
}

function cacheableBody(res) {
  if (!res || res.status !== 200) return false;
  if (res.headers.get("x-catchem-soft")) return false;
  if (res.headers.has("set-cookie")) return false;
  return (res.headers.get("content-type") || "").includes("text/html");
}

function withPublicCache(res, extra) {
  const h = new Headers(res.headers);
  h.set("cache-control", PUBLIC_CACHE);
  h.delete("cdn-cache-control");
  if (extra) for (const [k, v] of Object.entries(extra)) h.set(k, v);
  return new Response(res.body, { status: res.status, headers: h });
}

function asEdgeHit(hit, soft = false, dataVersion = "") {
  const extra = { "x-edge-cache": soft ? "stale" : "hit" };
  if (soft) extra["x-catchem-soft"] = "stale";
  if (dataVersion) extra["x-data-version"] = dataVersion;
  return withPublicCache(hit, extra);
}

export async function edgeFetch(render0, request, env, ctx, opts = {}) {
  const dataVersion = String(opts.dataVersion || "").slice(0, 10);
  const render = (r, e, c) => safeRender(render0, r, e, c);
  const cache = edgeCache();
  if (!cache || !cacheableRequest(request)) {
    const res = await render(request, env, ctx);
    if (dataVersion && res && res.headers) {
      const h = new Headers(res.headers);
      h.set("x-data-version", dataVersion);
      return new Response(res.body, { status: res.status, headers: h });
    }
    return res;
  }
  const key = cacheKey(request, dataVersion);
  let hit = null;
  try { hit = await cache.match(key); } catch { hit = null; }
  if (hit) return asEdgeHit(hit, false, dataVersion);

  let res;
  try {
    res = await render(request, env, ctx);
  } catch {
    try {
      hit = await cache.match(key);
      if (hit) return asEdgeHit(hit, true, dataVersion);
    } catch { /* fall through */ }
    return errorPage();
  }

  const type = res.headers.get("content-type") || "";
  if (res.status >= 500 && type.includes("text/html")) {
    try {
      hit = await cache.match(key);
      if (hit) return asEdgeHit(hit, true, dataVersion);
    } catch { /* fall through */ }
    return errorPage();
  }
  if (cacheableBody(res)) {
    try {
      const stored = withPublicCache(res.clone(), dataVersion ? { "x-data-version": dataVersion } : null);
      const put = cache.put(key, stored).catch(() => {});
      if (ctx?.waitUntil) ctx.waitUntil(put); else await put;
    } catch { /* never block the page on the cache */ }
    return withPublicCache(res, dataVersion ? { "x-data-version": dataVersion } : null);
  }
  if (dataVersion && res.status === 200) {
    const h = new Headers(res.headers);
    h.set("x-data-version", dataVersion);
    return new Response(res.body, { status: res.status, headers: h });
  }
  return res;
}
