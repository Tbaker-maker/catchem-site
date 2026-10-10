import { isFeedPath, loadLatestFeed, redirectPath } from "./feed.mjs";
import { loadJson, loadDive, loadDiveIndex, loadPokemonBundle, proxyPublic } from "./data.mjs";
import { editorDocument, patchedPaper, pocketDocument, pocketImageUrl, PAPER_PATH, POCKET_PATH, POCKET_IMG_PREFIX } from "./full-editor.mjs";
import { liveStamp } from "./build-stamp.mjs";
import { beginDiscord, finishDiscord, handleSession, handleSignIn, logout } from "./auth.mjs";
import { handleAlert, handleFollow, handleVote } from "./feed-api.mjs";
import { handleIdeas, handlePostText, handleVideoQuota, pocketRows } from "./ai.mjs";
import { officialSrc, imageForId } from "./catalogue-image.mjs";
import { ensureAffiliation } from "./affiliation.mjs";
import {
  clockLabel, readStaleAgainstCard, renderAll, renderArtist, renderArtists, renderAccuracy, renderCard, renderDive, renderFeed, renderMethod, renderMine, renderMovers,
  renderPokemon, renderPost, renderPremium, renderPremiumResult, renderReceipts, renderRetired, renderSearch, renderSetShell, renderSets, renderSetValue, renderSupply, renderToday, renderTrackRecord, quickView,
} from "./ui.mjs";

const html = (body, status = 200) => new Response(ensureAffiliation(body), {
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
  if (path.startsWith("/pokemon/")) return "pokemon";
  if (path.startsWith("/dive/")) return "dive";
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
  if (path === "/supply") return "supply";
  if (path === "/set-value") return "set-value";
  if (path === "/track-record") return "track";
  if (path === "/today") return "today";
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


async function catalogueMap(fetchImpl) {
  try {
    const doc = await loadJson("catalogue-images.json", fetchImpl);
    const images = doc && doc.images && typeof doc.images === "object" ? doc.images : null;
    return images && !Array.isArray(images) ? images : {};
  } catch {
    return {};
  }
}

function withCatalogue(list, images) {
  return (list || []).map((row) => {
    if (!row || typeof row !== "object") return row;
    const hit = officialSrc(row, images);
    return { ...row, catalogueSrc: hit.src, catalogueCrop: hit.crop };
  });
}

async function omitStalePriceReads(reads, fetchImpl) {
  const list = Array.isArray(reads) ? reads : [];
  const buckets = new Map();
  const out = [];
  for (const read of list) {
    const sku = String(read?.sku || "");
    if (!/^tcgcsv-\d+$/.test(sku)) {
      out.push(read);
      continue;
    }
    const n = Number(sku.slice("tcgcsv-".length));
    const bucket = String(n % 100).padStart(2, "0");
    if (!buckets.has(bucket)) buckets.set(bucket, loadJson(`buckets/${bucket}.json`, fetchImpl).catch(() => []));
    const rows = await buckets.get(bucket);
    const card = Array.isArray(rows) ? rows.find((row) => row && row.id === sku) : null;
    if (readStaleAgainstCard(read, card)) continue;
    out.push(read);
  }
  return out;
}

async function readsFor(cardId, fetchImpl) {
  try {
    const bundle = await loadJson("reads.json", fetchImpl);
    const rows = (bundle?.reads || []).filter((read) => {
      if (!read) return false;
      const sku = String(read.sku || "");
      const href = String(read.href || "");
      return sku === cardId || href === `/c/${cardId}` || href === `/p/${cardId}`;
    });
    rows.sort((a, b) => String(b.asOf || "").localeCompare(String(a.asOf || "")));
    return rows.slice(0, 3);
  } catch {
    return [];
  }
}

export async function quickFor(cardId, fetchImpl, opts = {}) {
  const id = String(cardId || "").trim();
  if (!id || id.length > 80 || /[^A-Za-z0-9._-]/.test(id)) return null;
  let card = null;
  if (/^tcgcsv-\d+$/.test(id)) {
    const bucket = String((Number((id.match(/(\d+)/) || [])[1]) || 0) % 100).padStart(2, "0");
    const rows = await loadJson(`buckets/${bucket}.json`, fetchImpl);
    card = (Array.isArray(rows) ? rows : []).find((row) => row && row.id === id) || null;
  }
  if (!card) {
    try {
      const bundle = await loadPokemonBundle(fetchImpl);
      const hit = bundle.byId[id];
      if (hit) {
        card = {
          id: hit.id,
          name: hit.name,
          set: hit.set,
          num: hit.number,
          artist: hit.artist,
          price: hit.price,
          asOf: hit.priceDate,
          source: hit.source,
          printing: hit.finish || "",
          kind: "single",
          hist: [],
        };
        if (hit.link) card.tcgplayer = hit.link;
      }
    } catch { /* the catalogue file did not load */ }
  }
  if (!card) return null;
  const images = await catalogueMap(fetchImpl);
  const pic = officialSrc(card, images);
  const facts = await loadJson("feed/facts.json", fetchImpl).catch(() => null);
  const fact = facts && facts[id] ? facts[id] : null;
  let listingSeries = [];
  if (card.kind === "sealed") {
    const diveMap = await loadDiveIndex(fetchImpl).catch(() => ({ ids: [], byTcgcsv: {} }));
    const sealedId = (diveMap.byTcgcsv && diveMap.byTcgcsv[id]) || ((diveMap.ids || []).includes(id) ? id : "");
    if (sealedId) {
      try {
        const dive = await loadDive(sealedId, fetchImpl);
        listingSeries = Array.isArray(dive?.series) ? dive.series : [];
      } catch { listingSeries = []; }
    }
  }
  const productReads = await readsFor(id, fetchImpl);
  return quickView(card, {
    fact,
    listingSeries,
    productReads,
    photo: pic.src,
    crop: pic.crop,
    feed: opts.feed === true,
  });
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
    const reads = await omitStalePriceReads(bundle?.reads, fetchImpl);
    const freshBundle = bundle && typeof bundle === "object" ? { ...bundle, reads } : { reads };
    const diveMap = await loadDiveIndex(fetchImpl).catch(() => ({ ids: [], byTcgcsv: {} }));
    const withDive = { ...pageOpts, diveMap };
    if (path === "/feed/all") return html(renderAll(freshBundle, stamp, withDive));
    if (path === "/feed/mine") return html(renderMine(stamp, withDive));
    if (path.startsWith("/feed/s/")) {
      const section = decodeURIComponent(path.slice("/feed/s/".length));
      return html(renderFeed(freshBundle, "", stamp, { ...withDive, section }));
    }
    const id = path.startsWith("/feed/r/") ? decodeURIComponent(path.slice("/feed/r/".length)) : "";
    if (id) return html(renderFeed(freshBundle, id, stamp, { ...withDive, page: "read" }));
    return html(renderFeed(freshBundle, "", stamp, withDive));
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
    try {
      const doc = await loadJson(`artists/${slug}.json`, fetchImpl);
      const images = await catalogueMap(fetchImpl);
      const sort = String(opts.sort || "");
      let releaseBySlug = {};
      if (sort.startsWith("release")) {
        const setsDoc = await loadJson("sets.json", fetchImpl).catch(() => null);
        // A date stamped on 10+ sets at once is a catalogue placeholder, not a
        // release (19 promo and POP sets read 2026-09-27). Those sort as undated.
        const seen = {};
        for (const set of setsDoc?.sets || []) if (set.release) seen[set.release] = (seen[set.release] || 0) + 1;
        for (const set of setsDoc?.sets || []) if (set.slug && set.release && seen[set.release] < 10) releaseBySlug[set.slug] = set.release;
        releaseBySlug.__strict = true;
      }
      return html(renderArtist({ ...doc, cards: withCatalogue(doc.cards, images) }, stamp, { ...pageOpts, sort, releaseBySlug }));
    }
    catch { return html(renderArtist(null, stamp, pageOpts), 404); }
  }
  if (kind === "dive") {
    const diveId = decodeURIComponent(path.slice("/dive/".length));
    try {
      const doc = await loadDive(diveId, fetchImpl);
      return html(renderDive(doc, stamp, pageOpts));
    } catch {
      return html(renderDive(null, stamp, pageOpts), 404);
    }
  }
  if (kind === "pokemon") {
    const slug = decodeURIComponent(path.slice("/pokemon/".length)).toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return html(`<main class="wrap"><h1>Not in the catalog</h1><p class="muted">That Pokémon is not in the catalog.</p><p><a href="/search">Search</a></p></main>`, 404);
    }
    try {
      const bundle = await loadPokemonBundle(fetchImpl);
      const page = bundle.bySlug[slug];
      if (!page) {
        return html(`<main class="wrap"><h1>Not in the catalog</h1><p class="muted">That Pokémon is not in the catalog.</p><p><a href="/search">Search</a></p></main>`, 404);
      }
      const images = await catalogueMap(fetchImpl);
      const cards = page.cards.map((card) => ({ ...card, image: imageForId(images, card.id) }));
      return html(renderPokemon({ ...page, cards }, stamp, pageOpts));
    } catch {
      return html(`<main class="wrap"><h1>Not in the catalog</h1><p class="muted">The catalog did not load.</p><p><a href="/search">Search</a></p></main>`, 503);
    }
  }
  if (kind === "card" || kind === "product") {
    const raw = path.startsWith("/p/") ? path.slice("/p/".length) : path.slice("/c/".length);
    const cardId = decodeURIComponent(raw);
    if (!cardId.startsWith("tcgcsv-")) {
      const map = await loadJson("redirects.json", fetchImpl).catch(() => null);
      const dest = map?.products?.[cardId];
      if (dest) return go(dest);
      try {
        const bundle = await loadPokemonBundle(fetchImpl);
        const hit = bundle.byId[cardId];
        if (hit) {
          const images = await catalogueMap(fetchImpl);
          const row = {
            id: hit.id,
            name: hit.name,
            set: hit.set,
            num: hit.number,
            artist: hit.artist,
            price: hit.price,
            asOf: hit.priceDate,
            source: hit.source,
            kind: "single",
          };
          return html(renderCard(row, stamp, { ...pageOpts, catalogueSrc: imageForId(images, hit.id), catalogueCrop: !!imageForId(images, hit.id), productReads: await readsFor(hit.id, fetchImpl) }));
        }
      } catch { /* the catalogue file did not load */ }
      return html(`<main class="wrap"><h1>Not in the catalog</h1><p class="muted">That product id is not in the TCGplayer catalog we publish.</p><p><a href="/search">Search</a></p></main>`, 404);
    }
    const bucket = String((Number((cardId.match(/(\d+)/) || [])[1]) || 0) % 100).padStart(2, "0");
    const rows = await loadJson(`buckets/${bucket}.json`, fetchImpl);
    const card = (rows || []).find((row) => row.id === cardId);
    const facts = await loadJson("feed/facts.json", fetchImpl).catch(() => null);
    const fact = facts && cardId ? facts[cardId] : null;
    const diveMap = await loadDiveIndex(fetchImpl).catch(() => ({ ids: [], byTcgcsv: {} }));
    const sealedId = (diveMap.byTcgcsv && diveMap.byTcgcsv[cardId]) || (diveMap.ids || []).includes(cardId) && cardId || "";
    const diveHref = sealedId ? `/dive/${sealedId}` : "";
    const images = await catalogueMap(fetchImpl);
    const hit = card ? officialSrc(card, images) : { src: "", crop: false };
    let listingSeries = [];
    if (sealedId) {
      try {
        const dive = await loadDive(sealedId, fetchImpl);
        listingSeries = Array.isArray(dive?.series) ? dive.series : [];
      } catch { listingSeries = []; }
    }
    const productReads = card ? await readsFor(cardId, fetchImpl) : [];
    return html(renderCard(card, stamp, { ...pageOpts, fact, diveHref, catalogueSrc: hit.src, catalogueCrop: hit.crop, listingSeries, productReads }), card ? 200 : 404);
  }
  if (kind === "movers") {
    const doc = await loadJson("movers.json", fetchImpl);
    const images = await catalogueMap(fetchImpl);
    const painted = { ...doc };
    for (const key of ["singles", "sealed", "singlesRising", "singlesFalling", "sealedRising", "sealedFalling"]) {
      if (Array.isArray(doc[key])) painted[key] = withCatalogue(doc[key], images);
    }
    return html(renderMovers(painted, stamp, pageOpts));
  }
  if (kind === "search") return html(renderSearch(pageOpts));
  if (kind === "receipts") return html(renderReceipts(await loadJson("receipts.json", fetchImpl), stamp, pageOpts));
  if (kind === "method") return html(renderMethod(await loadJson("counts.json", fetchImpl).catch(() => null), stamp, pageOpts));
  if (kind === "accuracy") return html(renderAccuracy(await loadJson("accuracy.json", fetchImpl).catch(() => ({ scored: 0, hits: 0, misses: 0, rows: [] })), stamp, pageOpts));
  if (kind === "faq" || kind === "creators") return html(renderRetired(kind, pageOpts));
  if (kind === "post" || kind === "build") {
    return html(renderPost(stamp, await liveStamp(fetchImpl), pageOpts));
  }
  if (kind === "premium") return html(renderPremium(stamp, pageOpts));
  if (kind === "supply") {
    const doc = await loadJson("feed/supply-lead.json", fetchImpl).catch(() => ({ enabled: false, reads: [], wouldQualify: 0 }));
    return html(renderSupply(doc, stamp, pageOpts));
  }
  if (kind === "set-value") {
    const doc = await loadJson("feed/set-value.json", fetchImpl).catch(() => ({ enabled: false, reads: [], wouldQualify: 0, sets: 0 }));
    return html(renderSetValue(doc, stamp, pageOpts));
  }
  if (kind === "track") {
    const doc = await loadJson("track-record.json", fetchImpl).catch(() => ({ count: 0, rows: [], types: [], tooEarly: 0, scored7: 0, scored30: 0 }));
    return html(renderTrackRecord(doc, stamp, pageOpts));
  }
  if (kind === "today") {
    const doc = await loadJson("today.json", fetchImpl).catch(() => ({ asOf: "", supply: "off", lines: [] }));
    return html(renderToday(doc, stamp, pageOpts));
  }
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
    const readPage = request.method === "GET" || request.method === "HEAD";
    if (readPage && url.pathname === "/post-office/app") {
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
    if (request.method === "GET" && url.pathname.startsWith(POCKET_IMG_PREFIX)) {
      const id = decodeURIComponent(url.pathname.slice(POCKET_IMG_PREFIX.length));
      if (!/^tcgp-[A-Za-z0-9-]+$/.test(id)) return new Response("Bad", { status: 400, headers: { "cache-control": "no-store" } });
      let src = "";
      try { src = await pocketImageUrl(id, fetchImpl); } catch {}
      if (!src) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
      const img = await fetch(src, { headers: { "User-Agent": "CatchEm-post-office/1.0" } });
      if (!img.ok) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
      return new Response(img.body, {
        status: 200,
        headers: {
          "content-type": img.headers.get("content-type") || "image/webp",
          "cache-control": "public, max-age=86400",
          "access-control-allow-origin": "*",
        },
      });
    }
    if (request.method === "GET" && url.pathname.startsWith("/data/editor/tcg/")) {
      const rest = decodeURIComponent(url.pathname.slice("/data/editor/tcg/".length));
      if (!/^[a-z0-9]+\/[A-Za-z0-9._-]+$/.test(rest)) {
        return new Response("Bad", { status: 400, headers: { "cache-control": "no-store" } });
      }
      const img = await fetch("https://images.pokemontcg.io/" + rest);
      if (!img.ok) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
      return new Response(img.body, {
        status: 200,
        headers: {
          "content-type": img.headers.get("content-type") || "image/png",
          "cache-control": "public, max-age=86400",
          "access-control-allow-origin": "*",
        },
      });
    }
    if (request.method === "GET" && url.pathname === "/api/quick") {
      const id = url.searchParams.get("id") || "";
      const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
      try {
        const doc = await quickFor(id, fetchImpl, { feed });
        if (!doc) return new Response(JSON.stringify({ error: "Not in the catalog" }), { status: 404, headers });
        headers["cache-control"] = "public, max-age=300";
        return new Response(JSON.stringify(doc), { status: 200, headers });
      } catch {
        return new Response(JSON.stringify({ error: "Not in the catalog" }), { status: 404, headers });
      }
    }
    if (request.method === "GET" && url.pathname === "/api/card-img") {
      const pid = Math.trunc(Number(url.searchParams.get("pid")));
      if (!(pid > 0)) return new Response("Bad", { status: 400, headers: { "cache-control": "no-store" } });
      const img = await fetch("https://tcgplayer-cdn.tcgplayer.com/product/" + pid + "_in_400x400.jpg");
      if (!img.ok) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
      const bytes = new Uint8Array(await img.arrayBuffer());
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
      if (hex.startsWith("23c8d781")) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
      return new Response(bytes, {
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
    if (readPage) {
      const back = url.searchParams.get("premium");
      const here = norm(url.pathname);
      if ((here === "/" || here === "/premium") && (back === "success" || back === "cancel")) {
        return html(renderPremiumResult(back));
      }
      if (!feed && gatedFeedPath(url.pathname)) return home302();
      const dest = redirectPath(url.pathname);
      if (dest) {
        const loc = !feed && (dest === "/feed" || dest.startsWith("/feed/")) ? "/" : dest;
        return Response.redirect(new URL(loc, url), 301);
      }
      if (feed && norm(url.pathname) === "/movers") return Response.redirect(new URL("/board", url), 301);
      if (feed && norm(url.pathname) === "/pulse") return Response.redirect(new URL("/feed", url), 301);
      const kind = pageKind(url.pathname);
      let premium = false;
      if (feed && kind === "feed") {
        try {
          const viewer = await readUser(request, env);
          premium = viewer?.premium === true;
        } catch {
          premium = false;
        }
      }
      if (kind && kind !== "data") {
        try {
          const page = await renderPath(url.pathname, fetchImpl, { video, feed, premium, sort: url.searchParams.get("sort") || "" });
          if (page) return page;
        } catch {
          // Fall through to the baked asset if the catalog did not load.
        }
      }
      if (kind === "data") {
        try { return await renderPath(url.pathname, fetchImpl, { feed }); }
        catch { return new Response("Not found", { status: 404 }); }
      }
    }
    if (feed && request.method === "GET" && isFeedPath(url.pathname)) {
      try {
        const body = await loadLatestFeed(fetchImpl);
        return new Response(ensureAffiliation(body), {
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
        return new Response(ensureAffiliation(addFeedEntry(await asset.text())), { status: asset.status, headers });
      }
      return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
    }
    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    const type = headers.get("content-type") || "";
    if (type.includes("text/html")) {
      headers.set("cache-control", "no-store");
      headers.set("cdn-cache-control", "no-store");
      return new Response(ensureAffiliation(await asset.text()), { status: asset.status, statusText: asset.statusText, headers });
    }
    return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
  },
};
