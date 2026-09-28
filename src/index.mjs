import { isFeedPath, loadLatestFeed, redirectPath } from "./feed.mjs";
import { loadJson, proxyPublic } from "./data.mjs";
import {
  esc, renderAll, renderArtist, renderArtists, renderCard, renderFeed, renderMethod, renderMovers,
  renderPost, renderReceipts, renderSearch, renderSetShell, renderSets,
} from "./ui.mjs";

const html = (body, status = 200) => new Response(body, {
  status,
  headers: {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "cdn-cache-control": "no-store",
  },
});

function norm(pathname) {
  let path = String(pathname || "").split("?")[0];
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (path.endsWith(".html")) path = path.slice(0, -5);
  return path || "/";
}

export function pageKind(pathname) {
  const path = norm(pathname);
  if (path === "/feed" || path.startsWith("/feed/")) return "feed";
  if (path === "/sets") return "sets";
  if (path.startsWith("/sets/")) return "set";
  if (path === "/artists") return "artists";
  if (path.startsWith("/artists/")) return "artist";
  if (path.startsWith("/c/")) return "card";
  if (path.startsWith("/p/tcgcsv-")) return "card";
  if (path === "/board" || path === "/movers") return "movers";
  if (path === "/search") return "search";
  if (path === "/receipts") return "receipts";
  if (path === "/methodology") return "method";
  if (path === "/post-office") return "post";
  if (path === "/sitemap.xml") return "sitemap";
  if (path.startsWith("/data/")) return "data";
  return null;
}

export async function renderPath(pathname, fetchImpl = fetch) {
  const path = norm(pathname);
  const kind = pageKind(path);
  if (kind === "data") {
    const rel = path.slice("/data/".length);
    if (!rel || rel.includes("..")) return new Response("Bad path", { status: 400 });
    return proxyPublic(rel, fetchImpl);
  }
  if (kind === "feed") {
    const bundle = await loadJson("reads.json", fetchImpl);
    if (path === "/feed/all") return html(renderAll(bundle));
    const id = path.startsWith("/feed/r/") ? decodeURIComponent(path.slice("/feed/r/".length)) : "";
    return html(renderFeed(bundle, id));
  }
  if (kind === "sets") return html(renderSets(await loadJson("sets.json", fetchImpl)));
  if (kind === "set") {
    const slug = decodeURIComponent(path.slice("/sets/".length));
    try { await loadJson(`sets/${slug}.json`, fetchImpl); }
    catch { return null; }
    return html(renderSetShell(slug));
  }
  if (kind === "artists") return html(renderArtists(await loadJson("artists.json", fetchImpl)));
  if (kind === "artist") {
    const slug = decodeURIComponent(path.slice("/artists/".length));
    try { return html(renderArtist(await loadJson(`artists/${slug}.json`, fetchImpl))); }
    catch { return html(renderArtist(null), 404); }
  }
  if (kind === "card") {
    const raw = path.startsWith("/p/") ? path.slice("/p/".length) : path.slice("/c/".length);
    const cardId = decodeURIComponent(raw);
    const bucket = String((Number((cardId.match(/(\d+)/) || [])[1]) || 0) % 100).padStart(2, "0");
    const rows = await loadJson(`buckets/${bucket}.json`, fetchImpl);
    const card = (rows || []).find((row) => row.id === cardId);
    return html(renderCard(card), card ? 200 : 404);
  }
  if (kind === "movers") return html(renderMovers(await loadJson("movers.json", fetchImpl)));
  if (kind === "search") return html(renderSearch());
  if (kind === "receipts") return html(renderReceipts(await loadJson("receipts.json", fetchImpl)));
  if (kind === "method") return html(renderMethod(await loadJson("counts.json", fetchImpl).catch(() => null)));
  if (kind === "post") return html(renderPost());
  if (kind === "sitemap") return sitemap(fetchImpl);
  return null;
}

async function sitemap(fetchImpl) {
  const sets = await loadJson("sets.json", fetchImpl);
  const artists = await loadJson("artists.json", fetchImpl);
  const urls = ["/", "/feed", "/feed/all", "/sets", "/board", "/artists", "/search", "/methodology", "/receipts", "/post-office", "/pulse"];
  for (const row of sets?.sets || []) urls.push(`/sets/${row.slug}`);
  for (const row of artists?.artists || []) urls.push(`/artists/${row.slug}`);
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>https://catchemtcg.com${esc(u)}</loc></url>`).join("\n")}\n</urlset>\n`;
  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const fetchImpl = env?.PUBLIC_FETCH || fetch;
    if (request.method === "GET") {
      const dest = redirectPath(url.pathname);
      if (dest) return Response.redirect(new URL(dest, url), 301);
      if (norm(url.pathname) === "/movers") return Response.redirect(new URL("/board", url), 301);
      const kind = pageKind(url.pathname);
      if (kind && kind !== "data") {
        try {
          const page = await renderPath(url.pathname, fetchImpl);
          if (page) return page;
        } catch {
          // Fall through to the baked asset if the catalog did not load.
        }
      }
      if (kind === "data") {
        try { return await renderPath(url.pathname, fetchImpl); }
        catch { return new Response("Not found", { status: 404 }); }
      }
    }
    if (request.method === "GET" && isFeedPath(url.pathname)) {
      try {
        const body = await loadLatestFeed(fetchImpl);
        return new Response(body, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            "cdn-cache-control": "no-store",
          },
        });
      } catch { /* baked pulse */ }
    }
    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    const type = headers.get("content-type") || "";
    if (type.includes("text/html")) {
      headers.set("cache-control", "no-store");
      headers.set("cdn-cache-control", "no-store");
    }
    return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
  },
};
