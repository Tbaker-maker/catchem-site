import { isFeedPath, loadLatestFeed, redirectPath } from "./feed.mjs";
import { loadJson, proxyPublic } from "./data.mjs";
import { editorDocument, patchedPaper, pocketDocument, PAPER_PATH, POCKET_PATH } from "./full-editor.mjs";
import { liveStamp } from "./build-stamp.mjs";
import { beginDiscord, finishDiscord, handleSession, handleSignIn, logout } from "./auth.mjs";
import { handleAlert, handleFollow, handleVote } from "./feed-api.mjs";
import { handleIdeas, handlePostText, handleVideoQuota, pocketRows } from "./ai.mjs";
import {
  clockLabel, renderAll, renderArtist, renderArtists, renderAccuracy, renderCard, renderFeed, renderMethod, renderMine, renderMovers,
  renderPost, renderPremium, renderReceipts, renderRetired, renderSearch, renderSetShell, renderSets,
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
  if (path.startsWith("/p/")) return "product";
  if (path === "/board" || path === "/movers") return "movers";
  if (path === "/search") return "search";
  if (path === "/receipts") return "receipts";
  if (path === "/methodology") return "method";
  if (path === "/accuracy") return "accuracy";
  if (path === "/faq") return "faq";
  if (path === "/build") return "build";
  if (path === "/creators") return "creators";
  if (path === "/post-office") return "post";
  if (path === "/premium") return "premium";
  if (path === "/sitemap.xml" || /^\/sitemap-\d+\.xml$/.test(path)) return "sitemap";
  if (path.startsWith("/data/")) return "data";
  return null;
}

export function feedEnabled(opts) {
  return opts?.feed === true || opts?.FEED_ENABLED === "true";
}

export function gatedFeedPath(pathname) {
  const path = norm(pathname);
  if (path === "/feed" || path.startsWith("/feed/")) return true;
  if (path === "/board" || path === "/movers") return true;
  if (path === "/receipts" || path === "/accuracy") return true;
  if (path === "/pulse") return true;
  return false;
}

const home302 = () => new Response(null, {
  status: 302,
  headers: { location: "/", "cache-control": "no-store" },
});

const go = (loc) => new Response(null, { status: 301, headers: { location: loc, "cache-control": "no-store" } });

export function addFeedEntry(html) {
  let out = String(html || "");
  if (out.includes('href="/feed"')) return out;
  out = out.replace(
    '<nav id="site-nav">\n    <a href="/sets">Sets</a>',
    '<nav id="site-nav">\n    <a href="/feed">Feed</a>\n    <a href="/sets">Sets</a>',
  );
  out = out.replace(
    '<nav class="dock" aria-label="Primary">\n  <a href="/sets">Sets</a>',
    '<nav class="dock" aria-label="Primary">\n  <a href="/feed">Feed</a>\n  <a href="/sets">Sets</a>',
  );
  out = out.replace(
    '<div class="actions">\n      <a class="btn btn-primary" href="/sets">Browse sets</a>',
    '<div class="actions">\n      <a class="btn btn-primary" href="/feed">Feed</a>\n      <a class="btn btn-primary" href="/sets">Browse sets</a>',
  );
  return out;
}

export async function renderPath(pathname, fetchImpl = fetch, opts = {}) {
  const path = norm(pathname);
  if (!feedEnabled(opts) && gatedFeedPath(path)) return home302();
  const kind = pageKind(path);
  let stamp = "";
  let asOf = "";
  try {
    const counts = await loadJson("counts.json", fetchImpl);
    stamp = clockLabel(counts.updatedAt);
    asOf = counts.asOf || "";
  } catch { stamp = ""; }
  const pageOpts = { ...opts, asOf };
  if (kind === "data") {
    const rel = path.slice("/data/".length);
    if (!rel || rel.includes("..")) return new Response("Bad path", { status: 400 });
    if (rel.includes("calls.jsonl") || rel.includes("shelf.jsonl") || rel.startsWith("learning/")) return new Response("Not found", { status: 404 });
    return proxyPublic(rel, fetchImpl);
  }
  if (kind === "sitemap") return proxyPublic(path.slice(1), fetchImpl);
  if (kind === "feed") {
    const bundle = await loadJson("reads.json", fetchImpl);
    if (path === "/feed/all") return html(renderAll(bundle, stamp, pageOpts));
    if (path === "/feed/mine") return html(renderMine(stamp, pageOpts));
    if (path.startsWith("/feed/s/")) {
      const section = decodeURIComponent(path.slice("/feed/s/".length));
      return html(renderFeed(bundle, "", stamp, { ...pageOpts, section }));
    }
    const id = path.startsWith("/feed/r/") ? decodeURIComponent(path.slice("/feed/r/".length)) : "";
    if (id) return html(renderFeed(bundle, id, stamp, { ...pageOpts, page: "read" }));
    return html(renderFeed(bundle, "", stamp, pageOpts));
  }
  if (kind === "sets") {
    const sets = await loadJson("sets.json", fetchImpl);
    const indexes = await loadJson("indexes.json", fetchImpl).catch(() => null);
    const counts = await loadJson("counts.json", fetchImpl).catch(() => null);
    if (indexes) sets.singlesIndex = indexes.singles;
    if (counts?.sealedNote) sets.sealedNote = counts.sealedNote;
    if (counts?.soldNote) sets.soldNote = counts.soldNote;
    return html(renderSets(sets, stamp, pageOpts));
  }
  if (kind === "set") {
    const slug = decodeURIComponent(path.slice("/sets/".length));
    try {
      await loadJson(`sets/${slug}.json`, fetchImpl);
      return html(renderSetShell(slug, stamp, pageOpts));
    } catch {
      const map = await loadJson("redirects.json", fetchImpl).catch(() => null);
      const dest = map?.sets?.[slug];
      if (dest) return go(dest);
      return html(`<main class="wrap"><h1>Set not found</h1><p class="muted">That set slug is not in the catalog.</p><p><a href="/sets">All sets</a></p></main>`, 404);
    }
  }
  if (kind === "artists") return html(renderArtists(await loadJson("artists.json", fetchImpl), stamp, pageOpts));
  if (kind === "artist") {
    const slug = decodeURIComponent(path.slice("/artists/".length));
    try { return html(renderArtist(await loadJson(`artists/${slug}.json`, fetchImpl), stamp, pageOpts)); }
    catch { return html(renderArtist(null, stamp, pageOpts), 404); }
  }
  if (kind === "card" || kind === "product") {
    const raw = path.startsWith("/p/") ? path.slice("/p/".length) : path.slice("/c/".length);
    const cardId = decodeURIComponent(raw);
    if (!cardId.startsWith("tcgcsv-")) {
      const map = await loadJson("redirects.json", fetchImpl).catch(() => null);
      const dest = map?.products?.[cardId];
      if (dest) return go(dest);
      return html(`<main class="wrap"><h1>Not in the catalog</h1><p class="muted">That product id is not in the TCGplayer catalog we publish.</p><p><a href="/search">Search</a></p></main>`, 404);
    }
    const bucket = String((Number((cardId.match(/(\d+)/) || [])[1]) || 0) % 100).padStart(2, "0");
    const rows = await loadJson(`buckets/${bucket}.json`, fetchImpl);
    const card = (rows || []).find((row) => row.id === cardId);
    return html(renderCard(card, stamp, pageOpts), card ? 200 : 404);
  }
  if (kind === "movers") return html(renderMovers(await loadJson("movers.json", fetchImpl), stamp, pageOpts));
  if (kind === "search") return html(renderSearch(pageOpts));
  if (kind === "receipts") return html(renderReceipts(await loadJson("receipts.json", fetchImpl), stamp, pageOpts));
  if (kind === "method") return html(renderMethod(await loadJson("counts.json", fetchImpl).catch(() => null), stamp, pageOpts));
  if (kind === "accuracy") return html(renderAccuracy(await loadJson("accuracy.json", fetchImpl).catch(() => ({ scored: 0, hits: 0, misses: 0, rows: [] })), stamp, pageOpts));
  if (kind === "faq" || kind === "build" || kind === "creators") return html(renderRetired(kind, pageOpts));
  if (kind === "post") return html(renderPost(stamp, await liveStamp(fetchImpl), pageOpts));
  if (kind === "premium") return html(renderPremium(stamp, pageOpts));
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const fetchImpl = env?.PUBLIC_FETCH || fetch;
    const urlVideo = url.searchParams.get("video");
    if (urlVideo != null) {
      // ?video=1 is not a gate. The flag is env.VIDEO_ENABLED, checked below.
    }
    const video = env?.VIDEO_ENABLED === "true";
    const feed = env?.FEED_ENABLED === "true";
    if (request.method === "GET" && url.pathname === "/post-office/app") {
      try {
        const counts = await loadJson("counts.json", fetchImpl);
        const mark = await liveStamp(fetchImpl);
        const body = await editorDocument(counts.asOf || "", fetchImpl, mark);
        return new Response(body, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      } catch {
        return new Response("The editor did not load.", { status: 503, headers: { "cache-control": "no-store" } });
      }
    }
    if (request.method === "GET" && url.pathname === "/api/session") return handleSession(request, env);
    if (request.method === "GET" && url.pathname === "/signin") return handleSignIn(request, env);
    if (request.method === "GET" && url.pathname === "/auth/discord") return beginDiscord(request, env);
    if (request.method === "GET" && url.pathname === "/auth/discord/callback") return finishDiscord(request, env, fetchImpl);
    if ((request.method === "POST" || request.method === "GET") && url.pathname === "/auth/logout") return logout();
    if (request.method === "GET" && url.pathname === POCKET_PATH) {
      try {
        const body = await pocketDocument(fetchImpl);
        return new Response(body, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" } });
      } catch {
        return new Response("[]", { status: 503, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
      }
    }
    if (request.method === "GET" && url.pathname === PAPER_PATH) {
      try {
        const body = await patchedPaper(fetchImpl);
        return new Response(body, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" } });
      } catch {
        return new Response("[]", { status: 503, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
      }
    }
    if (request.method === "GET" && url.pathname === "/api/card-img") {
      const pid = Number(url.searchParams.get("pid"));
      if (!Number.isFinite(pid) || pid <= 0) return new Response("Bad", { status: 400 });
      const img = await fetch("https://tcgplayer-cdn.tcgplayer.com/product/" + pid + "_in_400x400.jpg");
      if (!img.ok) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
      return new Response(img.body, {
        status: 200,
        headers: { "content-type": img.headers.get("content-type") || "image/jpeg", "cache-control": "public, max-age=86400" },
      });
    }
    if (request.method === "POST" && url.pathname === "/api/ideas") return handleIdeas(request, env, fetchImpl);
    if (request.method === "POST" && url.pathname === "/api/post-text") return handlePostText(request, env, fetchImpl);
    if (request.method === "POST" && url.pathname === "/api/video/quota") return handleVideoQuota(request, env);
    if (request.method === "GET" && url.pathname === "/api/pocket-lite") {
      try {
        const rows = await pocketRows(fetchImpl);
        return new Response(JSON.stringify(rows), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" } });
      } catch {
        return new Response("[]", { headers: { "content-type": "application/json; charset=utf-8" } });
      }
    }
    if (request.method === "GET" && (url.pathname === "/video" || url.pathname.startsWith("/video/"))) {
      if (!video) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
    }
    if (request.method === "GET" || request.method === "POST") {
      if (url.pathname === "/api/vote") return handleVote(request, env);
      if (url.pathname === "/api/alerts") return handleAlert(request, env);
      if (url.pathname === "/api/follow") return handleFollow(request, env);
      if (url.pathname === "/api/report") {
        return new Response(JSON.stringify({
          ok: false,
          error: "Price reports are not counted yet.",
        }), { status: 503, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
      }
    }
    if ((request.method === "GET" || request.method === "HEAD") && norm(url.pathname) === "/build") {
      return Response.redirect(new URL("/post-office", url), 301);
    }
    if (request.method === "GET" || request.method === "HEAD") {
      if (!feed && gatedFeedPath(url.pathname)) return home302();
      const dest = redirectPath(url.pathname);
      if (dest) {
        const loc = !feed && (dest === "/feed" || dest.startsWith("/feed/")) ? "/" : dest;
        return Response.redirect(new URL(loc, url), 301);
      }
      if (feed && norm(url.pathname) === "/movers") return Response.redirect(new URL("/board", url), 301);
      if (feed && norm(url.pathname) === "/pulse") return Response.redirect(new URL("/feed", url), 301);
      const kind = pageKind(url.pathname);
      if (kind && kind !== "data" && request.method === "GET") {
        try {
          const page = await renderPath(url.pathname, fetchImpl, { video, feed });
          if (page) return page;
        } catch {
          // Fall through to the baked asset if the catalog did not load.
        }
      }
      if (kind === "data" && request.method === "GET") {
        try { return await renderPath(url.pathname, fetchImpl, { feed }); }
        catch { return new Response("Not found", { status: 404 }); }
      }
    }
    if (feed && request.method === "GET" && isFeedPath(url.pathname)) {
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
    if (feed && request.method === "GET" && norm(url.pathname) === "/") {
      const asset = await env.ASSETS.fetch(request);
      const headers = new Headers(asset.headers);
      const type = headers.get("content-type") || "";
      if (type.includes("text/html")) {
        headers.set("cache-control", "no-store");
        headers.set("cdn-cache-control", "no-store");
        return new Response(addFeedEntry(await asset.text()), { status: asset.status, headers });
      }
      return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
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
