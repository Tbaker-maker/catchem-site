// Edge cache for public HTML pages (fix for Cloudflare 1102 "Worker exceeded resource limits").
//
// Card, sealed, set and feed pages were rendered on every hit with no-store, so a cold
// isolate parsed several large JSON files (search-lite, reads, ir-cycle) per request and
// ran past the CPU/memory limit. Anonymous GETs of render pages are now kept in the
// Cloudflare cache for EDGE_TTL seconds, so most hits never run the render at all.
// Signed-in visitors (ce_session cookie) always get a fresh render.
// The browser still sees no-store; only the edge copy is reused.

export const EDGE_TTL = 1800;
const CACHEABLE = /^\/(c|p|sets|feed|artists|pokemon|indexes|board|releases|rotation|weekly|receipts|methodology|accuracy|dive)(\/|$)/;

function edgeCache() {
  try { return typeof caches !== "undefined" && caches.default ? caches.default : null; } catch { return null; }
}

export function cacheablePath(pathname) {
  return CACHEABLE.test(pathname);
}

export function cacheableRequest(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (!cacheablePath(url.pathname)) return false;
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
  url.searchParams.sort();
  return url.toString();
}
function cacheKey(request) {
  const url = new URL(cacheKeyUrl(request.url));
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
  return new Response(body, { status: 503, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "retry-after": "2" } });
}

async function safeRender(render, request, env, ctx) {
  try { return await render(request, env, ctx); }
  catch (err) {
    if (request.method === "GET" && (request.headers.get("accept") || "").includes("text/html")) return errorPage();
    throw err;
  }
}

export async function edgeFetch(render0, request, env, ctx) {
  const render = (r, e, c) => safeRender(render0, r, e, c);
  const cache = edgeCache();
  if (!cache || !cacheableRequest(request)) return render(request, env, ctx);
  const key = cacheKey(request);
  try {
    const hit = await cache.match(key);
    if (hit) {
      const h = new Headers(hit.headers);
      h.set("cache-control", "no-store");
      h.set("x-edge-cache", "hit");
      return new Response(hit.body, { status: hit.status, headers: h });
    }
  } catch { /* cache miss path */ }
  const res = await render(request, env, ctx);
  const type = res.headers.get("content-type") || "";
  if (res.status === 200 && type.includes("text/html") && !res.headers.has("set-cookie")) {
    try {
      const stored = res.clone();
      const h = new Headers(stored.headers);
      h.set("cache-control", `public, max-age=${EDGE_TTL}`);
      h.delete("cdn-cache-control");
      const put = cache.put(key, new Response(stored.body, { status: 200, headers: h })).catch(() => {});
      if (ctx?.waitUntil) ctx.waitUntil(put); else await put;
    } catch { /* never block the page on the cache */ }
  }
  return res;
}
