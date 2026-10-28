import { edgeFetch } from "./edge-cache.mjs";
import { setStripAssets, stripSlugFor, stripPageFor } from "./strip-index.mjs";
import { withShareMeta } from "./seo.mjs";
import { handleShareCard } from "./share-card.mjs";
import { isFeedPath, loadLatestFeed, redirectPath } from "./feed.mjs";
import { itemReadBlock } from "./item-read.mjs";
import { applySetSpark } from "./set-spark.mjs";
import { bucketRow, bucketRows, bucketOf, longHistOf, loadJson, loadReadFacts, loadItemRead, loadSetIndexes, loadCatalogue, loadDive, loadDiveIndex, loadPokemonBundle, loadFeedNews, proxyPublic, fetchRepo, smallJson, idBucket, setRawKv, seedProdRowsFromBucket, warmBucket } from "./data.mjs";
import { editorDocument, patchedPaper, pocketDocument, pocketImageUrl, PAPER_PATH, POCKET_PATH, POCKET_IMG_PREFIX } from "./full-editor.mjs";
import { liveStamp } from "./build-stamp.mjs";
import { beginDiscord, finishDiscord, handleSession, handleSignIn, inviteOnlyDocument, logout, officeAllowed } from "./auth.mjs";
import { readUser } from "./quota.mjs";
import { handleAlert, handleFollow, handleVote } from "./feed-api.mjs";
import { handleMe, renderAccount, renderAlerts, renderCollection } from "./member.mjs";
import { handleReads, handleReadsClick, loadStoredPlan, renderReadsPage, readsPickerEnabled } from "./reads.mjs";
import { handleReadsPipe, isPipePath, readsPipeReady } from "./reads-pipe.mjs";
import { emailSendAllowed, emailView, handleBrief, handleEmailLink, handleLengthLink } from "./reads-email.mjs";
import { handleIdeas, handlePostText, handleVideoQuota, pocketRows } from "./ai.mjs";
import { officialSrc, imageForId, editorImageFallbacks } from "./catalogue-image.mjs";
import { ensureAffiliation } from "./affiliation.mjs";
import { HISTORY_CSS, HISTORY_JS } from "./history-chart.mjs";
import { homeFinderSource } from "./home-finder.mjs";
const withChartKit = (page) => {
  let html = String(page);
  if (!html.includes("function mount(fig)")) {
    html = html.replace("</body>", `<style>${HISTORY_CSS}</style><script>${HISTORY_JS}</script></body>`);
  }
  if (html.includes('class="hero-search"') && !html.includes("catchem-finder")) {
    html = html.replace("</body>", `<script>/* catchem-finder */\n${homeFinderSource()}</script></body>`);
  }
  return html;
};
import { practicePool, practiceSets, packArt } from "./practice.mjs";
import { listingsBlock, listingsEntry, notMovedBlock, rotationBadge, rotationRow, setValueBlock, SET_PAIRS } from "./features.mjs";
import { setAffiliateConfig, speciesPageToken, pokemonSlug, nightlyIdsForPage, nightlySpeciesStrip } from "./pokemon.mjs";
import { cardArtHtml, cardMarkBadge, setChipHtml, watchlistBody } from "./ir-cycle.mjs";
import { ratingPanel, shardOf } from "./card-rating.mjs";
import { indexListBody, indexPageBody } from "./indexes.mjs";
import { ripBody } from "./rip.mjs";
import { renderScanner, renderWeekly } from "./weekly.mjs";
import { sealedRatingPanel, sealedShard } from "./sealed-rating.mjs";
import { imageTag as picTag } from "./catalogue-image.mjs";
import { pageChrome, freshLabel, newestStamp } from "./ui.mjs";
import { attachSignals, chipLookup, signalRowHtml } from "./signal-chips.mjs";
import { patternSentence, priceBits } from "./read-sheet.mjs";
import { renderLegal, LEGAL_PATHS } from "./legal.mjs";
import { addError, topErrors } from "./client-log.mjs";
import {
  clockLabel, feedReads, readYearChart, priceBannerLine, readStaleAgainstCard, renderAll, renderArtist, renderArtists, renderAccuracy, renderCard, renderDive, renderFeed, renderMethod, renderMine, renderMovers,
  renderPokemon, renderPost, renderPostClosed, renderPremium, renderPremiumResult, renderReceipts, renderRetired, renderSearch, renderSetShell, renderSets, renderSetValue, renderSupply, renderToday, todayStrip, heroToday, renderTrackRecord, renderTrackRecordHidden, trackRecordIsOpen, setTrackRecordOpen, setPostOfficeOpen, renderCompare, renderStatus, renderRotation, renderReleases, renderSetValuePage, renderPractice, renderNotFound, setPriceBanner, quickView, cardPriceSeries,
} from "./ui.mjs";
import { postOfficeOn, paintHomePostOffice } from "./post-office-flag.mjs";
import { flagForItem } from "./premium-ratio.mjs";
import { gaugeHtml, renderMeterPage } from "./market-meter.mjs";
import { paintPublicHtml, premiumMode } from "./premium-mode.mjs";
import { handlePremiumRequest, noteConverted, renderWaitlistPage } from "./premium-waitlist.mjs";

async function withPremium(card, fetchImpl) {
  if (!card) return card;
  try {
    const doc = await loadJson("premium-ratio.json", fetchImpl);
    const flag = flagForItem({
      id: card.id,
      sku: card.id,
      set: card.set,
      kind: card.kind === "sealed" ? "sealed" : "single",
      href: card.kind === "sealed" ? "/p/" + card.id : "/c/" + card.id,
    }, doc);
    return flag ? { ...card, premiumFlag: flag } : card;
  } catch {
    return card;
  }
}


const PRODUCT_HTML_TTL = 3600;
const productHtmlKey = (id) => `product-html:v1:${id}`;

async function readProductHtml(kv, id) {
  if (!kv || !id) return null;
  try { return await kv.get(productHtmlKey(id)); } catch { return null; }
}

function writeProductHtml(opts, id, body) {
  if (!opts?.anon || !opts?.kv || !id || !body) return;
  const put = opts.kv.put(productHtmlKey(id), body, { expirationTtl: PRODUCT_HTML_TTL }).catch(() => {});
  if (typeof opts.waitUntil === "function") opts.waitUntil(put);
}

const html = (body, status = 200) => new Response(ensureAffiliation(body), {
  status,
  headers: {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "cdn-cache-control": "no-store",
  },
});

// Temporary image proxy until the id has a Post Office catalogue hit.
// No new host may be added. The allowlist is exactly these two hosts.
export const IMAGE_HOSTS = [
  "images.pokemontcg.io",
  "tcgplayer-cdn.tcgplayer.com",
];

let clientLog = { events: [] };
const CLIENT_LOG_KEY = "https://catchem.internal/client-errors";

export async function readClientLog() {
  try {
    if (typeof caches !== "undefined" && caches.default) {
      const hit = await caches.default.match(CLIENT_LOG_KEY);
      if (hit) return await hit.json();
    }
  } catch { /* the cache is optional */ }
  return clientLog;
}

async function writeClientLog(log) {
  clientLog = log;
  try {
    if (typeof caches !== "undefined" && caches.default) {
      await caches.default.put(CLIENT_LOG_KEY, new Response(JSON.stringify(log), { headers: { "content-type": "application/json" } }));
    }
  } catch { /* memory copy remains */ }
}

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
  if (path === "/promos") return "promos";
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
  if (path === "/rotation") return "rotation";
  if (path === "/ir-watchlist") return "ir-watchlist";
  if (path === "/indexes") return "indexes";
  if (path.startsWith("/indexes/")) return "index";
  if (path === "/rip") return "rip";
  if (path === "/weekly") return "weekly";
  if (path === "/reads") return "reads";
  if (path === "/scanner") return "scanner";
  if (path === "/releases") return "releases";
  if (path === "/practice") return "practice";
  if (path === "/accuracy") return "accuracy";
  if (path === "/faq") return "faq";
  if (path === "/build") return "build";
  if (path === "/creators") return "creators";
  if (path === "/post-office") return "post";
  if (path === "/premium") return "premium";
  if (path === "/meter") return "meter";
  if (path === "/collection") return "collection";
  if (path === "/alerts") return "alerts";
  if (path === "/me") return "account";
  if (path === "/supply") return "supply";
  if (path === "/set-value") return "set-value";
  if (path === "/track-record") return "track";
  if (path === "/compare") return "compare";
  if (path === "/today") return "today";
  if (path === "/status") return "status";
  if (path === "/terms" || path === "/privacy" || path === "/disclaimer") return "legal";
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

// Practice stays reachable but out of search until the pack overhaul ships.
export async function noindex(res) {
  const r = await res;
  const body = String(await r.text()).replace(/<title>/i, '<meta name="robots" content="noindex"><title>');
  const headers = new Headers(r.headers);
  headers.set("x-robots-tag", "noindex");
  return new Response(body, { status: r.status, headers });
}

export const FAVICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#12100e"/><rect x="7" y="8" width="12" height="17" rx="2" fill="none" stroke="#d9b779" stroke-width="1.6" transform="rotate(-12 13 16.5)"/><rect x="10" y="7" width="12" height="17" rx="2" fill="none" stroke="#e0675b" stroke-width="1.6"/><rect x="13" y="8" width="12" height="17" rx="2" fill="none" stroke="#6f9be8" stroke-width="1.6" transform="rotate(12 19 16.5)"/></svg>';

export function notFoundPage(feed = false) {
  const res = new Response(ensureAffiliation(renderNotFound("", { feed })), {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
  return res;
}

const wantsHtml = (request, pathname) => request.method === "GET" && !/\.[a-z0-9]{2,5}$/i.test(pathname) && !pathname.startsWith("/api/") && !pathname.startsWith("/data/");

const go = (loc) => new Response(null, { status: 301, headers: { location: loc, "cache-control": "no-store" } });

export function addFeedEntry(html) {
  let out = String(html || "");
  out = out.replace(
    '<nav id="site-nav">\n    <a href="/sets">Sets</a>',
    '<nav id="site-nav">\n    <a href="/feed">Feed</a>\n    <a href="/sets">Sets</a>',
  );
  out = out.replace(
    '<nav class="dock" aria-label="Primary">\n  <a href="/" aria-current="page"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z"/></svg><span>Home</span></a>',
    '<nav class="dock" aria-label="Primary">\n  <a href="/feed"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="5" rx="2"/><rect x="4" y="13" width="16" height="6" rx="2"/></svg><span>Feed</span></a>',
  );
  out = out.replace(
    '<div class="actions">\n      <a class="btn btn-primary" href="/sets">Browse sets</a>',
    '<div class="actions">\n      <a class="btn btn-primary" href="/feed">Open the Feed</a>',
  );
  return out;
}

async function withMeter(html, fetchImpl) {
  try {
    const doc = await loadJson("market-meter.json", fetchImpl);
    const block = gaugeHtml(doc?.market, { href: "/meter", asOf: doc?.asOf, published: doc?.published !== false });
    if (!block || String(html).includes('id="market-meter"')) return html;
    let out = String(html);
    const anchor = '<p class="beta" id="fresh">';
    if (out.includes(anchor)) {
      const at = out.indexOf("</p>", out.indexOf(anchor));
      if (at > 0) return out.slice(0, at + 4) + block + out.slice(at + 4);
    }
    if (out.includes("<footer>")) return out.replace("<footer>", block + "<footer>");
    return out;
  } catch {
    return html;
  }
}

async function withToday(html, fetchImpl) {
  try {
    const doc = await loadJson("today.json", fetchImpl);
    const block = todayStrip(doc);
    let out = String(html);
    const hero = heroToday(doc);
    const anchor = '<p class="beta" id="fresh">';
    if (hero && !out.includes('id="hero-today"') && out.includes(anchor)) {
      const at = out.indexOf("</p>", out.indexOf(anchor));
      if (at > 0) out = out.slice(0, at + 4) + hero + out.slice(at + 4);
    }
    if (!block || out.includes('class="today-strip"') || !out.includes("<footer>")) return out;
    return out.replace("<footer>", block + "<footer>");
  } catch {
    return html;
  }
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
    return { ...row, catalogueSrc: hit.src, catalogueCrop: hit.crop, alts: hit.alts || [] };
  });
}

// Price stale ids come prebuilt in reads.json (priceStaleIds, Catchem-data
// build-feed). The old per-request bucket scan fetched ~70 buckets on a cold
// isolate and tripped Cloudflare error 1102, so it is gone. Without the list,
// only the build-time stale flag applies.
const DATED_FACT_KINDS = new Set(["pokemon", "listings", "newsline", "news", "season", "release", "release-cycle", "rip", "rotation", "deep", "pattern-forming", "pattern-ending", "breadth", "set", "sealedchase"]);
async function omitStalePriceReads(reads, fetchImpl, opts = {}) {
  // The build-time stale flag is about prices. Dated facts (Pokemon, listings
  // counted, news, releases, rotation, deep reads) stay true on their own date.
  const list = (Array.isArray(reads) ? reads : []).filter((read) => !read?.stale || DATED_FACT_KINDS.has(String(read?.readKind || read?.kind || "")));
  const drop = new Set((Array.isArray(opts.staleIds) ? opts.staleIds : []).map(String));
  let held = opts.holdIds;
  if (!held && fetchImpl) {
    try {
      const doc = await loadJson("price-hold.json", fetchImpl);
      held = doc && doc.ids && typeof doc.ids === "object" ? doc.ids : {};
    } catch {
      held = {};
    }
  }
  const heldIds = held && typeof held === "object" ? held : {};
  return list.filter((read) => {
    if (drop.has(String(read?.id || ""))) return false;
    const sku = String(read?.sku || read?.cardId || "");
    if (!sku || !heldIds[sku]) return true;
    const blob = `${read?.headline || ""} ${read?.path || ""} ${(read?.lines || []).join(" ")} ${read?.price || ""}`;
    return !/\$\d/.test(blob);
  });
}

// Every read about one item, full rows, from the small per-item lookup
// (feed/item-reads). Only a failed fetch (not a 404) falls back to reads.json.
async function itemReadRows(cardId, fetchImpl) {
  if (!/^tcgcsv-\d+$/.test(String(cardId || ""))) return [];
  try {
    const doc = await smallJson(`feed/item-reads/${idBucket(cardId)}.json`, fetchImpl);
    return Array.isArray(doc?.items?.[cardId]) ? doc.items[cardId] : [];
  } catch {
    try {
      const bundle = await loadJson("reads.json", fetchImpl);
      return (bundle?.reads || []).filter((r) => r && (r.sku === cardId || r.href === `/c/${cardId}` || r.href === `/p/${cardId}`));
    } catch { return []; }
  }
}

export async function allReadsFor(cardId, fetchImpl) {
  return mapAllReads(await itemReadRows(cardId, fetchImpl));
}

function mapAllReads(rows) {
  return (rows || [])
    .filter((r) => r && r.id && (r.headline || r.path))
    .map((r) => ({ id: r.id, kind: String(r.readKind || r.kind || ""), headline: String(r.headline || r.path || ""), lines: Array.isArray(r.lines) ? r.lines.slice(0, 6) : [], asOf: String(r.asOf || "").slice(0, 10), source: String(r.source || "") }))
    .sort((x, y) => y.asOf.localeCompare(x.asOf));
}

async function itemReadsTop(cardId, fetchImpl) {
  const rows = (await itemReadRows(cardId, fetchImpl)).slice();
  rows.sort((a, b) => String(b.asOf || "").localeCompare(String(a.asOf || "")));
  return rows.slice(0, 3);
}

async function itemReadsBundle(cardId, fetchImpl) {
  const rows = (await itemReadRows(cardId, fetchImpl)).slice();
  rows.sort((a, b) => String(b.asOf || "").localeCompare(String(a.asOf || "")));
  return { productReads: rows.slice(0, 3), allReads: mapAllReads(rows) };
}


async function cardImagesSealed(cardId, fetchImpl) {
  try {
    const doc = await smallJson(`feed/card/img/${idBucket(cardId)}.json`, fetchImpl);
    if (doc && doc.images && typeof doc.images === "object") return doc.images;
  } catch { /* empty */ }
  return {};
}

// Card pages: images for this id bucket plus set logos (feed/card/img).
async function cardImages(cardId, fetchImpl) {
  try {
    const doc = await smallJson(`feed/card/img/${idBucket(cardId)}.json`, fetchImpl);
    if (doc && doc.images && typeof doc.images === "object") return doc.images;
  } catch { /* fall back */ }
  return catalogueMap(fetchImpl);
}

async function cardIr(cardId, fetchImpl) {
  try {
    const doc = await smallJson(`feed/card/ir/${idBucket(cardId)}.json`, fetchImpl);
    if (doc && Array.isArray(doc.rows)) return doc;
  } catch { /* fall back */ }
  return loadJson("feed/ir-cycle.json", fetchImpl).catch(() => null);
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

function collectReadRows(doc) {
  if (!doc || typeof doc !== "object") return [];
  const out = [];
  const take = (list) => {
    if (!Array.isArray(list)) return;
    for (const row of list) if (row && typeof row === "object") out.push(row);
  };
  take(doc.reads);
  for (const key of ["lag", "group", "shape", "flagged", "dives", "volume", "supplyNotes"]) take(doc[key]);
  return out;
}

async function conditionNoteFor() {
  // An older file said every price was Near Mint unless labeled. That is not true.
  return null;
}

async function cardReadSplit(cardId, fetchImpl) {
  const rows = [];
  rows.push(...await itemReadRows(cardId, fetchImpl));
  try { rows.push(...collectReadRows(await loadJson("feed/extra-reads.json", fetchImpl))); } catch { /* no extra file */ }
  const sit = [];
  const board = [];
  const seen = new Set();
  let patternRead = null;
  let priceRead = null;
  for (const read of rows) {
    const href = String(read.href || "");
    if (href.startsWith("/p/") || href.startsWith("/dive/") || href.startsWith("/sets/")) continue;
    const sku = String(read.sku || "");
    const lead = String(read.cardId || read.leadId || "");
    if (sku !== cardId && lead !== cardId && href !== `/c/${cardId}`) continue;
    if (!patternRead && patternSentence(read)) patternRead = read;
    if (!priceRead && priceBits(read).gap) priceRead = read;
    const text = String(read.headline || read.path || "").trim();
    if (!text) continue;
    const key = String(read.id || text);
    if (seen.has(key)) continue;
    seen.add(key);
    const kind = String(read.readKind || read.kind || read.type || "");
    if (kind === "year-range" || kind === "year-ago" || kind === "season") sit.push(read);
    else board.push(read);
  }
  const byDate = (a, b) => String(b.asOf || "").localeCompare(String(a.asOf || "")) || String(a.id || "").localeCompare(String(b.id || ""));
  sit.sort(byDate);
  board.sort(byDate);
  return { sitReads: sit, boardReads: board.slice(0, 5), patternRead, priceRead };
}

async function nightlyQuotes(ids, fetchImpl) {
  const wanted = [...new Set(ids.filter((id) => /^tcgcsv-\d+$/.test(id)))];
  const byBucket = new Map();
  for (const id of wanted) {
    const n = Number(id.slice("tcgcsv-".length));
    const bucket = String(n % 100).padStart(2, "0");
    if (!byBucket.has(bucket)) byBucket.set(bucket, []);
    byBucket.get(bucket).push(id);
  }
  const facts = await loadJson("feed/facts.json", fetchImpl).catch(() => null);
  const quotes = {};
  const sealed = new Set();
  const entries = [...byBucket.entries()];
  for (let i = 0; i < entries.length; i += 4) {
    await Promise.all(entries.slice(i, i + 4).map(async ([bucket, list]) => {
      const rows = await loadJson(`buckets/${bucket}.json`, fetchImpl).catch(() => []);
      const need = new Set(list);
      for (const row of Array.isArray(rows) ? rows : []) {
        if (!row || !need.has(row.id)) continue;
        if (row.kind === "sealed") { sealed.add(row.id); continue; }
        const price = Number(row.price);
        const date = String(row.asOf || "").slice(0, 10);
        if (!(price > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        quotes[row.id] = { price, date };
      }
    }));
  }
  for (const id of wanted) {
    if (sealed.has(id)) { delete quotes[id]; continue; }
    const fact = facts && facts[id];
    const price = Number(fact?.price);
    const date = String(fact?.asOf || "").slice(0, 10);
    if (price > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date)) quotes[id] = { price, date };
  }
  return quotes;
}

async function pokemonStripFor(card, fetchImpl) {
  if (!card || card.kind === "sealed" || !card.name) return null;
  try {
    // Build-time shards (src/strip-index.mjs); no multi-MB catalogue parse per request.
    const direct = await stripSlugFor(card.id);
    const token = direct ? "" : speciesPageToken(card.name);
    const slug = direct || (token ? pokemonSlug(token) : "");
    const page = await stripPageFor(slug);
    if (!page) return null;
    if (!direct && token && page.name !== token) return null;
    if (!page.ids.length) return null;
    // Built at build time (scripts/build-strip-index.mjs). No per-request
    // bucket fetches: that path parsed dozens of 900 KB files (error 1102).
    return page.strip || null;
  } catch {
    return null;
  }
}

async function signalCardFor(id, fetchImpl) {
  try {
    const doc = await loadJson("signal-chips.json", fetchImpl);
    return chipLookup(doc, id);
  } catch {
    return null;
  }
}

export async function quickFor(cardId, fetchImpl, opts = {}) {
  const id = String(cardId || "").trim();
  if (!id || id.length > 80 || /[^A-Za-z0-9._-]/.test(id)) return null;
  let card = null;
  if (/^tcgcsv-\d+$/.test(id)) {
    const bucket = String((Number((id.match(/(\d+)/) || [])[1]) || 0) % 100).padStart(2, "0");
    void bucket;
    // One row out of the bucket text; never parse the whole 900 KB file.
    card = await bucketRow(id, fetchImpl).catch(() => null);
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
        if (hit.tcgPlayerId) card.tcgPlayerId = hit.tcgPlayerId;
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
  const view = quickView(card, {
    fact,
    listingSeries,
    productReads,
    photo: pic.src,
    photoAlts: pic.alts || [],
    crop: pic.crop,
    feed: opts.feed === true,
  });
  if (view) {
    try {
      const chips = await loadJson("signal-chips.json", fetchImpl);
      const hit = chipLookup(chips, id);
      if (hit) view.signalsHtml = signalRowHtml(hit, { href: "" });
    } catch { /* chips stay off this popup */ }
  }
  return view;
}

async function compareItem(id, fetchImpl) {
  const card = await bucketRow(id, fetchImpl).catch(() => null);
  if (!card) return { id, missing: true };
  if (card.kind !== "sealed") {
    const packed = await longHistOf(id, fetchImpl).catch(() => "");
    if (packed) card.longHist = packed;
  }
  const series = cardPriceSeries(card, Array.isArray(card.hist) ? card.hist : [], card.kind === "sealed");
  const points = [];
  for (const point of series) {
    if (!Array.isArray(point) || !(Number(point[1]) > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(String(point[0]))) continue;
    points.push([String(point[0]), Number(point[1])]);
  }
  const day = String(card.asOf || "").slice(0, 10);
  const low = Number(card.low);
  return {
    id,
    name: card.name || "",
    kind: card.kind === "sealed" ? "sealed" : "single",
    market: Number(card.price) > 0 ? Number(card.price) : null,
    low: low > 0 ? low : null,
    date: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "",
    source: typeof card.source === "string" ? card.source : "",
    points,
  };
}

export async function renderPath(pathname, fetchImpl = fetch, opts = {}) {
  const path = norm(pathname);
  if (!feedEnabled(opts) && gatedFeedPath(path)) return home302();
  const kind = pageKind(path);
  let stamp = "";
  let asOf = "";
  let countsDoc = null;
  try {
    countsDoc = await loadJson("counts.json", fetchImpl);
    stamp = freshLabel(countsDoc.updatedAt, countsDoc.asOf);
    asOf = countsDoc.asOf || "";
    const newest = newestStamp(countsDoc.updatedAt, countsDoc.asOf);
    setPriceBanner(priceBannerLine(newest ? new Date(newest.t).toISOString() : ""));
  } catch {
    stamp = "";
    setPriceBanner("");
  }
  try {
    const health = await loadJson("feed/status.json", fetchImpl);
    globalThis.CATCHEM_TCG_IMAGES = !(health?.images && health.images.tcgplayer === false);
  } catch {
    globalThis.CATCHEM_TCG_IMAGES = true;
  }
  let trackDoc = null;
  // Product/card cold path: skip track-record.json (~extra GitHub hit).
  if (kind !== "product" && kind !== "card") {
    try {
      trackDoc = await loadJson("track-record.json", fetchImpl);
    } catch {
      trackDoc = null;
    }
  }
  const trackOpen = trackRecordIsOpen(trackDoc);
  setTrackRecordOpen(trackOpen);
  const pageOpts = { ...opts, asOf, postOffice: opts.postOffice === true || postOfficeOn(opts) };
  setPostOfficeOpen(pageOpts.postOffice);
  if (kind === "data") {
    const rel = path.slice("/data/".length);
    if (!rel || rel.includes("..")) return new Response("Bad path", { status: 400 });
    if (rel.includes("calls.jsonl") || rel.includes("shelf.jsonl") || rel.startsWith("learning/")) return new Response("Not found", { status: 404 });
    return proxyPublic(rel, fetchImpl);
  }
  if (kind === "sitemap") {
    const first = path === "/sitemap-00.xml";
    let map = await proxyPublic(path.slice(1), fetchImpl);
    if (first) map = await withReleasesInSitemap(map);
    map = await withTrackInSitemap(map, trackOpen, first);
    return withoutPostOfficeInSitemap(map, pageOpts.postOffice === true);
  }
  if (kind === "feed") {
    const readId = path.startsWith("/feed/r/") ? decodeURIComponent(path.slice("/feed/r/".length)) : "";
    const readYearEarly = readId ? await readYearFor(readId, fetchImpl) : null;
    const bundle = await loadJson("reads.json", fetchImpl);
    const reads = await omitStalePriceReads(bundle?.reads, fetchImpl, { staleIds: bundle?.priceStaleIds });
    let chipDoc = null;
    try { chipDoc = await loadJson("signal-chips.json", fetchImpl); } catch { chipDoc = null; }
    const freshBundle = attachSignals(bundle && typeof bundle === "object" ? { ...bundle, reads } : { reads }, chipDoc);
    const diveMap = await loadDiveIndex(fetchImpl).catch(() => ({ ids: [], byTcgcsv: {} }));
    if (path === "/feed/lead.json") {
      return new Response(JSON.stringify(feedReads(freshBundle)), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" } });
    }
    const soldOn = await soldFileExists(fetchImpl);
    const liveNews = await loadFeedNews(fetchImpl);
    let leadIds = [];
    try {
      const order = await loadJson("feed/lead-order.json", fetchImpl);
      if (Array.isArray(order?.ids)) leadIds = order.ids.filter((id) => typeof id === "string");
    } catch { leadIds = []; }
    const withDive = { ...pageOpts, diveMap, soldOn, news: liveNews, leadIds };
    if (path === "/feed/all") return html(renderAll(freshBundle, stamp, withDive));
    if (path === "/feed/mine") return html(renderMine(stamp, withDive));
    if (path.startsWith("/feed/s/")) {
      const section = decodeURIComponent(path.slice("/feed/s/".length));
      return html(renderFeed(freshBundle, "", stamp, { ...withDive, section }));
    }
    const id = path.startsWith("/feed/r/") ? decodeURIComponent(path.slice("/feed/r/".length)) : "";
    if (id) {
      const readYear = readYearEarly;
      const slug = String(readYear?.meta?.setSlug || "");
      let logo = "";
      let rotation = null;
      if (slug) {
        const logos = await loadJson("set-logos.json", fetchImpl).catch(() => null);
        const hit = logos?.logos && logos.logos[slug];
        if (hit && typeof hit.logo === "string") logo = hit.logo;
        const rot = await loadJson("rotation-status.json", fetchImpl).catch(() => null);
        const row = (rot?.sets || []).find((set) => set && set.slug === slug);
        if (row && (row.mark || row.status)) {
          const until = String(row.until || "").slice(0, 10);
          const asOf = String(rot?.asOf || "").slice(0, 10);
          let daysLeft = null;
          if (/^\d{4}-\d{2}-\d{2}$/.test(until) && /^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
            daysLeft = Math.round((Date.parse(until + "T00:00:00Z") - Date.parse(asOf + "T00:00:00Z")) / 86400000);
          }
          rotation = { mark: row.mark || "", status: row.status || "", asOf, until: daysLeft != null && daysLeft >= 0 ? until : "", daysLeft: daysLeft != null && daysLeft >= 0 ? daysLeft : null };
        }
      }
      const factsP = loadReadFacts(id, fetchImpl);
      const sparkP = /^[a-z0-9-]+$/.test(slug) ? loadSetIndexes(slug, fetchImpl).catch(() => null) : null;
      let facts = await factsP;
      if (facts && facts.setMomentum) facts = applySetSpark(facts, slug, sparkP ? await sparkP : null);
      if (!rotation && facts?.rotation && (facts.rotation.mark || facts.rotation.status)) rotation = { mark: facts.rotation.mark || "", status: facts.rotation.status || "", asOf: facts.rotation.asOf || "", until: "", daysLeft: null };
      return html(renderFeed(freshBundle, id, stamp, { ...withDive, page: "read", readYear, logo, rotation, facts }));
    }
    return html(renderFeed(freshBundle, "", stamp, withDive));
  }
  if (kind === "collection") return html(renderCollection(stamp, pageOpts));
  if (kind === "alerts") return html(renderAlerts(stamp, pageOpts));
  if (kind === "account") return html(renderAccount(stamp, pageOpts));
  if (kind === "sets") {
    const sets = await loadJson("sets.json", fetchImpl);
    const indexes = await loadJson("indexes.json", fetchImpl).catch(() => null);
    const counts = await loadJson("counts.json", fetchImpl).catch(() => null);
    if (indexes) sets.singlesIndex = indexes.singles;
    if (counts?.sealedNote) sets.sealedNote = counts.sealedNote;
    if (counts?.soldNote) sets.soldNote = counts.soldNote;
    return html(renderSets(sets, stamp, pageOpts));
  }
  if (kind === "promos") return html(pageChrome("Promos", renderPromos(), "Promos", stamp, "", pageOpts.feed));
  if (kind === "meter") {
    const doc = await loadJson("market-meter.json", fetchImpl).catch(() => null);
    const range = opts.range === "all" ? "all" : "1m";
    const set = String(opts.set || "");
    return html(pageChrome("", renderMeterPage(doc, { range, set }), "Market meter", stamp, "", pageOpts.feed));
  }
  if (kind === "set") {
    const slug = decodeURIComponent(path.slice("/sets/".length));
    try {
      const setDoc = await loadJson(`sets/${slug}.json`, fetchImpl);
      const extra = await setFeatureHtml(slug, fetchImpl);
      const meterDoc = await loadJson("market-meter.json", fetchImpl).catch(() => null);
      const meterHtml = gaugeHtml(meterDoc?.sets?.[slug], { href: `/meter?set=${encodeURIComponent(slug)}`, asOf: meterDoc?.asOf, published: meterDoc?.published !== false, kicker: setDoc?.name || "Set" });
      return html(renderSetShell(slug, stamp, { ...pageOpts, title: setDoc?.name, meterHtml, ...extra }));
    } catch {
      if (SET_PAIRS[slug]) {
        const valueDoc = await loadJson(`set-value/${slug}.json`, fetchImpl).catch(() => null);
        if (valueDoc) {
          const extra = await setFeatureHtml(slug, fetchImpl, valueDoc);
          return html(renderSetValuePage(slug, valueDoc.name || slug, extra.setValueHtml, stamp, pageOpts));
        }
      }
      const map = await loadJson("redirects.json", fetchImpl).catch(() => null);
      const dest = map?.sets?.[slug];
      if (dest) return go(dest);
      return html(renderNotFound(stamp, pageOpts), 404);
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
      return html(renderNotFound(stamp, pageOpts), 404);
    }
    try {
      const bundle = await loadPokemonBundle(fetchImpl);
      const page = bundle.bySlug[slug];
      if (!page) {
        return html(renderNotFound(stamp, pageOpts), 404);
      }
      const images = await catalogueMap(fetchImpl);
      const cards = page.cards.map((card) => { const pic = officialSrc({ id: card.id, kind: "single", tcgPlayerId: card.tcgPlayerId || "" }, images); return { ...card, image: pic.src, imageAlts: pic.alts }; });
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
            release: hit.release || "",
            printing: hit.finish || "",
            kind: "single",
          };
          const pic = officialSrc({ id: hit.id, kind: "single" }, images);
          const [reads, conditionNote, premiumRow, signalCard, productReads, pokemon] = await Promise.all([
            cardReadSplit(hit.id, fetchImpl),
            conditionNoteFor(fetchImpl),
            withPremium(row, fetchImpl),
            signalCardFor(hit.id, fetchImpl),
            readsFor(hit.id, fetchImpl),
            pokemonStripFor(row, fetchImpl),
          ]);
          return html(renderCard(premiumRow, stamp, { ...pageOpts, signalCard, catalogueSrc: pic.src, catalogueCrop: pic.crop, catalogueAlts: pic.alts, productReads, ...reads, conditionNote, pokemon }));
        }
      } catch { /* the catalogue file did not load */ }
      return html(renderNotFound(stamp, pageOpts), 404);
    }
    const bucket = String((Number((cardId.match(/(\d+)/) || [])[1]) || 0) % 100).padStart(2, "0");
    void bucket;
    if (opts.anon) {
      const cachedHtml = await readProductHtml(opts.kv, cardId);
      if (cachedHtml) return html(cachedHtml);
    }
    const found = await bucketRow(cardId, fetchImpl).catch(() => null);
    const card = found ? { ...found } : null;
    // Wave 1: every fetch that does not need sealedId, in parallel. Cold /p/
    // was ~20s sequential and tripped Worker resource limits (503).
    const sealedLikely = !!(card && card.kind === "sealed");
    const singleLikely = !!(card && card.kind !== "sealed");
    const setSlugOk = !!(card && card.setSlug && /^[a-z0-9-]+$/.test(String(card.setSlug || "")));
    // One item-reads fetch feeds both the top-3 chips and the all-reads list.
    // Skip the 500KB+ rip-roi catalogue on the critical path (optional below).
    const [
      packed,
      facts,
      diveMap,
      images,
      readsBundle,
      counted,
      nm,
      rot,
      ir,
      cm,
      ratingShard,
      sealedRatingShard,
      splitEarly,
      conditionNoteEarly,
      pokemonEarly,
      itemRaw,
      setIndexLoaded,
      promoFile,
      hold,
      ladder,
      cardRatingMeta,
      sealedRatingMeta,
      premiumCard,
      signalCard,
    ] = await Promise.all([
      singleLikely ? longHistOf(cardId, fetchImpl) : Promise.resolve(""),
      // facts.json is ~85KB and rarely fills a sealed chip; skip on sealed critical path.
      singleLikely ? loadJson("feed/facts.json", fetchImpl).catch(() => null) : Promise.resolve(null),
      loadDiveIndex(fetchImpl).catch(() => ({ ids: [], byTcgcsv: {} })),
      sealedLikely ? cardImagesSealed(cardId, fetchImpl) : cardImages(cardId, fetchImpl),
      // Sealed: skip item-reads shard on cold critical path (p95).
      singleLikely && card ? itemReadsBundle(cardId, fetchImpl) : Promise.resolve({ productReads: [], allReads: [] }),
      sealedLikely ? loadJson("listings-counted.json", fetchImpl).catch(() => null) : Promise.resolve(null),
      // Sealed critical path: skip not-moved / IR / marks. Keep rotation (badge + tests).
      singleLikely ? loadJson("feed/not-moved.json", fetchImpl).catch(() => null) : Promise.resolve(null),
      card && card.setSlug ? loadJson("rotation-status.json", fetchImpl).catch(() => null) : Promise.resolve(null),
      singleLikely && card.setSlug ? cardIr(cardId, fetchImpl) : Promise.resolve(null),
      singleLikely && card.setSlug ? loadJson("feed/card-marks.json", fetchImpl).catch(() => null) : Promise.resolve(null),
      singleLikely ? loadJson(`feed/rating/${shardOf(cardId)}.json`, fetchImpl).catch(() => null) : Promise.resolve(null),
      // Sealed rating shard deferred off cold critical path (was an extra GitHub hit).
      Promise.resolve(null),
      singleLikely ? cardReadSplit(card.id, fetchImpl) : Promise.resolve(null),
      singleLikely ? conditionNoteFor(fetchImpl) : Promise.resolve(null),
      singleLikely ? pokemonStripFor(card, fetchImpl) : Promise.resolve(null),
      singleLikely && card.setSlug ? loadItemRead(card.setSlug, card.id, fetchImpl) : Promise.resolve(null),
      singleLikely && setSlugOk ? loadSetIndexes(card.setSlug, fetchImpl).catch(() => null) : Promise.resolve(null),
      // promos.json is ~660KB and was on every cold /p/+/c/ critical path.
      // Skip here; promosInside/comesFrom stay empty until a per-product shard exists.
      Promise.resolve(null),
      singleLikely ? loadJson("price-hold.json", fetchImpl).catch(() => null) : Promise.resolve(null),
      singleLikely ? loadJson("condition-prices.json", fetchImpl).catch(() => null) : Promise.resolve(null),
      singleLikely ? loadJson("feed/card-rating.json", fetchImpl).catch(() => null) : Promise.resolve(null),
      // Full sealed-rating.json is redundant with the shard row; skip the extra fetch.
      sealedLikely ? Promise.resolve(null) : Promise.resolve(null),
      withPremium(card, fetchImpl),
      // signal-chips.json is ~400KB; skip on sealed critical path (p95).
      singleLikely && card ? signalCardFor(cardId, fetchImpl) : Promise.resolve(null),
    ]);
    const productReads = readsBundle.productReads || [];
    const allReads = readsBundle.allReads || [];
    // rip-roi.json is ~500KB and was blowing cold /p/ past Worker limits.
    // Skip on the server render; rip block stays empty until a lighter shard exists.
    const ripDoc = null;
    if (card && packed) card.longHist = packed;
    const fact = facts && cardId ? facts[cardId] : null;
    const sealedId = (diveMap.byTcgcsv && diveMap.byTcgcsv[cardId]) || (diveMap.ids || []).includes(cardId) && cardId || "";
    const sealedPage = !!(card && card.kind === "sealed");
    const diveHref = sealedPage && sealedId ? `/dive/${sealedId}` : "";
    const hit = card ? officialSrc(card, images) : { src: "", crop: false };
    let listingSeries = [];
    let ebayAsk = null;
    if (sealedPage && sealedId) {
      try {
        const dive = await loadDive(sealedId, fetchImpl);
        listingSeries = Array.isArray(dive?.series) ? dive.series : [];
        const latest = dive?.latest && typeof dive.latest === "object" ? dive.latest : null;
        // eBay asks are listings counted, not a sealed price (2026-10-27).
        // Never fall back to priceMedian: that is TCGplayer market.
        const amount = Number(latest?.ebayMedianAsk || latest?.askMedian);
        const count = Number(latest?.ebayMedianCount || latest?.askRobustCount || latest?.listingCount);
        const asOf = String(latest?.lastSeen || "").slice(0, 10);
        const source = String(latest?.source || "").trim();
        const cheap = latest?.cheapestReal;
        if (amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(asOf)) ebayAsk = {
          amount,
          count: Number.isInteger(count) && count >= 1 ? count : null,
          asOf,
          source,
          cheapest: cheap && Number(cheap.price) > 0 && cheap.url ? cheap : null,
          tcgListed: Number(latest?.tcgListedMedian) > 0 ? Number(latest.tcgListedMedian) : null,
          tcgMarket: Number(card?.price) > 0 ? Number(card.price) : null,
        };
      } catch { listingSeries = []; }
    }
    let listingsHtml = "";
    if (card && card.kind === "sealed" && sealedId) {
      listingsHtml = listingsBlock(listingsEntry(counted, sealedId));
    }
    let notMovedHtml = "";
    if (card && nm && nm.on !== false) {
      if (card.kind === "sealed") {
        const entry = sealedId ? nm.sealed?.[sealedId] : null;
        notMovedHtml = notMovedBlock(entry, { images, sealed: true, pidFor: (id) => Number(entry?.lagging?.find((row) => row.id === id)?.pid) || 0 });
      } else {
        notMovedHtml = notMovedBlock(nm.cards?.[cardId], { images });
      }
    }
    let rotationHtml = "";
    let rotationFact = "";
    let cycleHtml = "";
    let ratingHtml = "";
    if (card && card.setSlug) {
      rotationFact = rotationBadge(rotationRow(rot, card.setSlug), rot);
      const art = cardArtHtml(card, rot, ir, opts.today || vancouverDay(), cm).replace(/<div class="rchips"><\/div>/g, "");
      rotationHtml = art + (cm?.cards?.[card.id] ? cardMarkBadge(cm.cards[card.id], cm) : rotationFact);
      if (card.kind !== "sealed" && (/Release cycle/.test(art) || /class="rchip(?:\s|")/.test(art))) cycleHtml = art;
    }
    let priceCheck = false;
    if (card && card.kind !== "sealed" && cardId && ratingShard) {
      const rows = (ratingShard?.rows || []).filter((r) => r.id === cardId);
      if (rows.length) {
        const meta = cardRatingMeta;
        const imgs = images;
        const pic = (r, pool) => { const hit = officialSrc({ id: r.id, kind: "single" }, { [r.id]: pool?.imgs?.[r.id] || imgs?.[r.id] }); return picTag(hit.src, "thumb", r.name, { id: r.id, alts: hit.alts || [] }); };
        const panels = [];
        for (const r of rows) {
          const pool = r.peers?.pool ? await loadJson(`feed/rating/peers/${r.peers.pool}.json`, fetchImpl).catch(() => null) : null;
          panels.push(ratingPanel(r, { ...meta, asOf: ratingShard.asOf }, { premium: opts.premium === true, pool, pic: (x) => pic(x, pool) }));
        }
        ratingHtml = panels.join("");
        if (rows.some((r) => r.check)) priceCheck = true;
        rotationHtml = ratingHtml + rotationHtml;
      }
    }
    if (card && card.kind === "sealed" && cardId) {
      const row = sealedRatingShard?.rows?.[cardId];
      if (row) {
        rotationHtml = sealedRatingPanel(row, { ...sealedRatingMeta, asOf: sealedRatingShard.asOf }, { premium: opts.premium === true }) + rotationHtml;
      }
    }
    let rip = null;
    if (card && card.kind === "sealed" && cardId) {
      const row = (ripDoc?.rows || []).find((item) => item && item.id === card.id);
      const asOf = String(row?.priceAsOf || ripDoc?.asOf || "").slice(0, 10);
      if (row && /^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
        rip = {
          contentsEV: row.contentsEV,
          roiPct: row.roiPct,
          beatChance: row.beatChance,
          median: row.median,
          priceSource: row.priceSource || "",
          asOf,
        };
      }
    }
    let sitReads;
    let boardReads;
    let patternRead = null;
    let priceRead = null;
    let conditionNote = null;
    let pokemon = null;
    if (card && card.kind !== "sealed" && splitEarly) {
      sitReads = splitEarly.sitReads;
      boardReads = splitEarly.boardReads;
      patternRead = splitEarly.patternRead;
      priceRead = splitEarly.priceRead;
      conditionNote = conditionNoteEarly;
      pokemon = pokemonEarly;
      const plainPanel = (html) => String(html || "").replace(/\u2014/g, ": ").replace(/\u2013/g, ": ");
      ratingHtml = plainPanel(ratingHtml);
      cycleHtml = plainPanel(cycleHtml);
    }
    let itemReadHtml = "";
    if (card && card.setSlug) {
      const itemRead = itemRaw && itemRaw.setMomentum ? applySetSpark(itemRaw, card.setSlug, setIndexLoaded) : itemRaw;
      const block = itemReadBlock(itemRead, { skipRip: !!rip, skipRotation: !!rotationFact, skipWindows: true, kind: card.kind });
      if (block) itemReadHtml = block;
      const l = itemRead?.listings;
      if (l && Number.isInteger(l.n) && /^\d{4}-\d{2}-\d{2}$/.test(String(l.date || ""))) pageOpts.itemListings = { n: l.n, day: l.date, pct: Number.isFinite(l.pct) ? l.pct : null, prevDay: l.prevDate || "" };
    }
    const setLogo = card && card.setSlug && /^\/img\/[a-z0-9]+\/logo\.png$/i.test(String(images[card.setSlug] || "")) ? images[card.setSlug] : "";
    let comesFrom = null;
    let promosInside = null;
    if (card && cardId) {
      const rows = Array.isArray(promoFile?.cards) ? promoFile.cards : [];
      if (card.kind === "sealed") {
        promosInside = rows.filter((row) => row && row.productId === cardId && row.id && row.name).map((row) => ({ id: row.id, name: row.name, num: row.num || "" }));
      } else {
        const hitPromo = rows.find((row) => row && row.id === cardId && row.productId && row.productName);
        if (hitPromo) comesFrom = { id: hitPromo.productId, name: hitPromo.productName };
      }
    }
    let priceHeld = false;
    let conditionLadder = null;
    if (card && card.kind !== "sealed" && cardId) {
      if (hold && hold.ids && hold.ids[cardId]) priceHeld = true;
      if (priceCheck) priceHeld = true;
      const day = String(ladder && ladder.asOf || "").slice(0, 10);
      const row = ladder && ladder.cards && ladder.cards[cardId];
      conditionLadder = {
        asOf: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "",
        source: "TCGplayer market",
        printings: row && typeof row === "object" ? row : {},
      };
    } else if (card && card.kind !== "sealed") {
      conditionLadder = { asOf: "", source: "TCGplayer market", printings: {} };
    }
    if (priceHeld && card) {
      card.price = null;
      card.priceStatus = "checking";
      if (/\$\d/.test(ratingHtml)) ratingHtml = "";
      if (/\$\d/.test(cycleHtml)) cycleHtml = "";
      itemReadHtml = "";
      priceRead = null;
    }
    const pageBody = renderCard(premiumCard, stamp, { ...pageOpts, signalCard, priceCheck, priceHeld, conditionLadder, listingsHtml, notMovedHtml, rotationHtml, rotationFact, ratingHtml, cycleHtml, fact, diveHref, catalogueSrc: hit.src, catalogueCrop: hit.crop, catalogueAlts: hit.alts || [], listingSeries, productReads, sitReads, boardReads, patternRead, priceRead, conditionNote, pokemon, setLogo, ebayAsk, rip, itemReadHtml, comesFrom, promosInside, allReads });
    if (card) writeProductHtml(opts, cardId, pageBody);
    // Ops-only: ?prewarm=1 seeds every prodrow in this bucket after the response.
    if (card && opts.prewarm) {
      const job = warmBucket(bucketOf(cardId), fetchImpl).catch(() => {});
      if (typeof opts.waitUntil === "function") opts.waitUntil(job); else void job;
    }
    return html(pageBody, card ? 200 : 404);
  }
  if (kind === "movers") {
    const doc = await loadJson("movers.json", fetchImpl);
    const hold = await loadJson("price-hold.json", fetchImpl).catch(() => null);
    const held = hold && hold.ids && typeof hold.ids === "object" ? hold.ids : {};
    const images = await catalogueMap(fetchImpl);
    const painted = { ...doc };
    for (const key of ["singles", "sealed", "singlesRising", "singlesFalling", "sealedRising", "sealedFalling"]) {
      if (Array.isArray(doc[key])) {
        const rows = key.startsWith("sealed") ? doc[key] : doc[key].filter((row) => row && !held[row.id]);
        painted[key] = withCatalogue(rows, images);
      }
    }
    return html(renderMovers(painted, stamp, pageOpts));
  }
  if (kind === "search") return html(renderSearch(pageOpts));
  if (kind === "receipts") return html(renderReceipts(await loadJson("receipts.json", fetchImpl), stamp, pageOpts));
  if (kind === "method") return html(renderMethod(await loadJson("counts.json", fetchImpl).catch(() => null), stamp, pageOpts));
  if (kind === "rotation") return html(renderRotation(stamp, pageOpts));
  if (kind === "legal") return html(renderLegal(LEGAL_PATHS[path], stamp, pageOpts));
  if (kind === "practice") {
    const setsDoc = await loadJson("sets.json", fetchImpl);
    const list = practiceSets(setsDoc, opts.today || vancouverDay());
    const want = String(opts.set || "");
    const pick = list.find((x) => x.slug === want) || list[0];
    if (!pick) return noindex(html(renderPractice([], "", null, [], stamp, pageOpts)));
    const setDoc = await loadJson(`sets/${pick.slug}.json`, fetchImpl);
    const images = await catalogueMap(fetchImpl);
    return noindex(html(renderPractice(list, pick.slug, setDoc, practicePool(setDoc, images), stamp, { ...pageOpts, art: packArt(setDoc, images) })));
  }
  if (kind === "releases") {
    const doc = await loadJson("releases.json", fetchImpl).catch(() => null);
    const setsDoc = await loadJson("sets.json", fetchImpl).catch(() => null);
    return html(renderReleases(doc, stamp, { ...pageOpts, today: opts.today || vancouverDay(), sets: setsDoc?.sets || [] }));
  }
  if (kind === "accuracy") return html(renderAccuracy(await loadJson("accuracy.json", fetchImpl).catch(() => ({ scored: 0, hits: 0, misses: 0, rows: [] })), stamp, pageOpts));
  if (kind === "faq" || kind === "creators") return html(renderRetired(kind, pageOpts));
  if (kind === "post" || kind === "build") {
    if (!pageOpts.postOffice) return noindex(html(renderPostClosed(pageOpts)));
    return html(renderPost(stamp, await liveStamp(fetchImpl), pageOpts));
  }
  if (kind === "premium") {
    if (premiumMode({ PREMIUM_MODE: opts.premiumMode }) !== "live") {
      return html(renderWaitlistPage({ feed: pageOpts.feed === true }));
    }
    const proof = await loadJson("premium-proof.json", fetchImpl).catch(() => null);
    return html(renderPremium(stamp, { ...pageOpts, proof }));
  }
  if (kind === "indexes") {
    const list = await loadJson("feed/rating/index-list.json", fetchImpl).catch(() => null);
    const market = await loadJson("indexes.json", fetchImpl).catch(() => null);
    return html(pageChrome("Indexes", indexListBody(list, market), "Indexes", stamp, "", pageOpts.feed === true));
  }
  if (kind === "reads") {
    return html(pageChrome("Reads", renderReadsPage(opts.reads || {}), "Your reads", stamp, "", pageOpts.feed === true));
  }
  if (kind === "weekly" || kind === "scanner") {
    const doc = await loadCatalogue("derived/weekly.json", fetchImpl).catch(() => null);
    if (kind === "scanner") return html(renderScanner(doc, stamp, pageOpts));
    const images = await catalogueMap(fetchImpl);
    return html(renderWeekly(doc, stamp, pageOpts, images));
  }
  if (kind === "rip") {
    const doc = await loadCatalogue("derived/rip-roi.json", fetchImpl).catch(() => null);
    const setsDoc = await loadJson("sets.json", fetchImpl).catch(() => null);
    const eras = {};
    const logos = {};
    for (const set of setsDoc?.sets || []) {
      if (!set || !set.slug) continue;
      if (set.era) eras[set.slug] = set.era;
      if (set.logo) logos[set.slug] = set.logo;
    }
    return html(pageChrome("Rip value", ripBody(doc, { eras, logos }), "Rip value", stamp, "", pageOpts.feed === true));
  }
  if (kind === "index") {
    const key = decodeURIComponent(path.slice("/indexes/".length));
    const doc = /^[a-z0-9-]+$/.test(key) ? await loadJson(`feed/rating/index/${key}.json`, fetchImpl).catch(() => null) : null;
    if (!doc) return html(pageChrome("", `<main id="main" tabindex="-1" class="wrap"><h1>Index not found</h1><p class="muted">That index is not in tonight's list. Indexes with fewer than 5 cards are not shown.</p><p><a href="/indexes">All indexes</a></p></main>`, "Index not found", stamp, "", pageOpts.feed === true), 404);
    const images = await catalogueMap(fetchImpl);
    const pic = (r) => { const hit = officialSrc({ id: r.id, kind: "single" }, images); return picTag(hit.src, "thumb", r.name, { id: r.id, alts: hit.alts || [] }); };
    return html(pageChrome("", indexPageBody(doc, { pic }), doc.name.replace(/, similar pull rates.*$/, ""), stamp, "", pageOpts.feed === true));
  }
  if (kind === "ir-watchlist") {
    const doc = await loadJson("feed/ir-cycle.json", fetchImpl).catch(() => null);
    const images = await catalogueMap(fetchImpl);
    const pic = (r) => { const hit = officialSrc({ id: r.id, kind: "single" }, images); return picTag(hit.src, "thumb", r.name, { id: r.id, alts: hit.alts || [] }); };
    const body = watchlistBody(doc, { premium: opts.premium === true, set: opts.set || "", page: opts.page || "", pic });
    return html(pageChrome("", body, "Illustration Rares to watch", stamp, "", pageOpts.feed === true));
  }
  if (kind === "supply") {
    const doc = await loadJson("feed/supply-lead.json", fetchImpl).catch(() => ({ enabled: false, reads: [], wouldQualify: 0 }));
    return html(renderSupply(doc, stamp, pageOpts));
  }
  if (kind === "set-value") {
    const doc = await loadJson("feed/set-value.json", fetchImpl).catch(() => ({ enabled: false, reads: [], wouldQualify: 0, sets: 0 }));
    return html(renderSetValue(doc, stamp, pageOpts));
  }
  if (kind === "track") {
    if (!trackOpen) return noindex(html(renderTrackRecordHidden(stamp, pageOpts)));
    const doc = trackDoc;
    const pageDoc = doc?.public === true ? doc : {
      public: true,
      thin: true,
      asOf: "",
      disclaimer: "Past moves don't predict future prices.",
      summary: "",
      windows: {},
      rows: [],
    };
    return html(renderTrackRecord(pageDoc, stamp, pageOpts));
  }
  if (kind === "compare") {
    const raw = ["a", "b", "c", "d"].map((key) => String(opts[key] || "").trim());
    const seen = new Set();
    const ids = raw.map((id) => {
      if (!id.startsWith("tcgcsv-") || seen.has(id)) return "";
      seen.add(id);
      return id;
    });
    const loaded = await Promise.all(ids.filter(Boolean).map((id) => compareItem(id, fetchImpl)));
    const byId = new Map(loaded.map((row) => [row.id, row]));
    const images = loaded.some((row) => row && !row.missing && row.name) ? await catalogueMap(fetchImpl) : {};
    const take = (id) => {
      if (!id) return null;
      const row = byId.get(id);
      return row && !row.missing && row.name ? row : null;
    };
    const charts = ids.filter(Boolean).map((id) => take(id)).filter((row) => row && row.points.length >= 2).map((row) => {
      const hit = officialSrc({ id: row.id, kind: row.kind }, images);
      return { id: row.id, name: row.name, kind: row.kind, thumb: hit.src || "", points: row.points };
    });
    return html(renderCompare(take(ids[0]), take(ids[1]), stamp, {
      ...pageOpts,
      a: opts.a || "",
      b: opts.b || "",
      c: opts.c || "",
      d: opts.d || "",
      ids,
      third: take(ids[2]),
      fourth: take(ids[3]),
      charts,
    }));
  }
  if (kind === "today") {
    const doc = await loadJson("today.json", fetchImpl).catch(() => ({ asOf: "", supply: "off", lines: [] }));
    return html(renderToday(doc, stamp, pageOpts));
  }
  if (kind === "status") {
    const status = await loadJson("feed/status.json", fetchImpl).catch(() => null);
    const sources = await loadJson("feed/sources.json", fetchImpl).catch(() => null);
    const gap = await loadJson("feed/image-gap.json", fetchImpl).catch(() => null);
    return html(renderStatus({ status, sources, gap, errors: topErrors(await readClientLog()) }, stamp, pageOpts));
  }
  return null;
}


async function prewarmBuckets(env, ctx, fetchImpl) {
  setRawKv(env?.FEED_KV, ctx?.waitUntil ? (job) => ctx.waitUntil(job) : undefined);
  const out = [];
  for (let b = 0; b < 100; b += 1) {
    const pad = String(b).padStart(2, "0");
    const t0 = Date.now();
    try {
      const info = await warmBucket(pad, fetchImpl);
      out.push({ b, ms: Date.now() - t0, ok: true, ...info });
    } catch (err) {
      out.push({ b, ms: Date.now() - t0, ok: false, err: String(err && err.message || err) });
    }
  }
  return out;
}

const worker = {
  async fetch(request, env, ctx) {
    return edgeFetch(worker.render, request, env, ctx);
  },
  async render(request, env, ctx) {
    setStripAssets(env?.ASSETS);
    setAffiliateConfig(env);
    setRawKv(env?.FEED_KV, ctx?.waitUntil ? (job) => ctx.waitUntil(job) : undefined);
    const url = new URL(request.url);
    const fetchImpl = env?.PUBLIC_FETCH || fetch;
    const premiumHit = await handlePremiumRequest(request, env, fetchImpl);
    if (premiumHit) return premiumHit;
    if (url.pathname === "/reads/brief") return handleBrief(request, env, { fetchImpl });
    if (url.pathname === "/reads/email/length") return handleLengthLink(request, env);
    if (url.pathname === "/reads/email/confirm" || url.pathname === "/reads/email/stop") {
      return handleEmailLink(request, env);
    }
    if ((request.method === "GET" || request.method === "HEAD") && (url.pathname === "/favicon.ico" || url.pathname === "/favicon.svg")) {
      return new Response(request.method === "HEAD" ? null : FAVICON_SVG, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" } });
    }
    if (url.pathname === "/api/client-log" && request.method === "POST") {
      let body = {};
      try { body = await request.json(); } catch { body = {}; }
      await writeClientLog(addError(await readClientLog(), body));
      return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
    }
    if (url.pathname === "/api/client-errors" && request.method === "GET") {
      return new Response(JSON.stringify({ errors: topErrors(await readClientLog()) }), {
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      });
    }
    const urlVideo = url.searchParams.get("video");
    if (urlVideo != null) {
      // ?video=1 is not a gate. The flag is env.VIDEO_ENABLED, checked below.
    }
    const video = env?.VIDEO_ENABLED === "true";
    const feed = env?.FEED_ENABLED === "true";
    const readPage = request.method === "GET" || request.method === "HEAD";
    const officeKind = pageKind(url.pathname);
    // Closed (POST_OFFICE not on) shows the coming soon page to everyone. Open checks the allowlist.
    if (postOfficeOn(env) && (url.pathname === "/post-office/app" || url.pathname.startsWith("/post-office/") || officeKind === "post" || officeKind === "build")) {
      const officeUser = await readUser(request, env);
      if (!officeAllowed(officeUser, env)) {
        return new Response(request.method === "HEAD" ? null : inviteOnlyDocument(env, !!officeUser), { status: 403, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      }
    }
    if (readPage && url.pathname === "/post-office/app") {
      if (!postOfficeOn(env)) {
        setPostOfficeOpen(false);
        return noindex(html(renderPostClosed({})));
      }
      try {
        const counts = await loadJson("counts.json", fetchImpl);
        const mark = await liveStamp(fetchImpl);
        const body = await editorDocument(counts.asOf || "", fetchImpl, mark);
        return new Response(body, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      } catch {
        return new Response("The editor did not load.", { status: 503, headers: { "cache-control": "no-store" } });
      }
    }
    if (request.method === "GET" && url.pathname.startsWith("/live/")) return handleLive(request, url.pathname, fetchImpl);
    if (request.method === "GET" && url.pathname === "/api/session") return handleSession(request, env);
    if (request.method === "GET" && url.pathname === "/signin") return handleSignIn(request, env);
    if (request.method === "GET" && url.pathname === "/auth/discord") return beginDiscord(request, env);
    if (request.method === "GET" && url.pathname === "/auth/discord/callback") return finishDiscord(request, env, fetchImpl);
    if ((request.method === "POST" || request.method === "GET") && url.pathname === "/auth/logout") return logout(request, env);
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
        return new Response(body, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=120" } });
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
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/og/card.svg") {
      return handleShareCard(request, url);
    }
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname.startsWith("/img/")) {
      return handleSetLogo(request, url.pathname, fetchImpl);
    }
    if (request.method === "GET" && url.pathname.startsWith("/data/editor/tcg/")) {
      const rest = decodeURIComponent(url.pathname.slice("/data/editor/tcg/".length));
      if (!/^[a-z0-9]+\/[A-Za-z0-9._-]+$/.test(rest)) {
        return new Response("Bad", { status: 400, headers: { "cache-control": "no-store" } });
      }
      // Temporary proxy until the id has a Post Office catalogue hit. No new host may be added.
      if (!IMAGE_HOSTS.includes("images.pokemontcg.io")) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
      // Card pictures never change for a given path: serve from the edge cache so a
      // repeat view never waits on the upstream host (it was the card page LCP).
      let edge = null;
      try { edge = typeof caches !== "undefined" ? caches.default : null; } catch { edge = null; }
      const edgeKey = new Request(url.origin + url.pathname, { method: "GET" });
      if (edge) { try { const hit = await edge.match(edgeKey); if (hit) return hit; } catch {} }
      let img = null;
      for (const path of editorImageFallbacks(rest)) {
        const hit = await fetchImpl("https://images.pokemontcg.io/" + path);
        if (hit && hit.ok) { img = hit; break; }
      }
      if (!img) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
      const out = new Response(img.body, {
        status: 200,
        headers: {
          "content-type": img.headers.get("content-type") || "image/png",
          "cache-control": "public, max-age=2592000, immutable",
          "access-control-allow-origin": "*",
        },
      });
      if (edge) { try { const put = edge.put(edgeKey, out.clone()); if (typeof ctx !== "undefined" && ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(put); else await put; } catch {} }
      return out;
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
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/api/card-img") {
      // Temporary proxy until the id has a Post Office catalogue hit. No new host may be added.
      // Response is image bytes only. No eBay payload, no public JSON.
      const pid = Math.trunc(Number(url.searchParams.get("pid")));
      if (!(pid > 0)) return new Response(request.method === "HEAD" ? null : "Bad", { status: 400, headers: { "cache-control": "no-store" } });
      if (!IMAGE_HOSTS.includes("tcgplayer-cdn.tcgplayer.com")) return new Response(request.method === "HEAD" ? null : "Not found", { status: 404, headers: { "cache-control": "no-store" } });
      const img = await fetch("https://tcgplayer-cdn.tcgplayer.com/product/" + pid + "_in_400x400.jpg");
      if (!img.ok) return new Response(request.method === "HEAD" ? null : "Not found", { status: 404, headers: { "cache-control": "no-store" } });
      const bytes = new Uint8Array(await img.arrayBuffer());
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
      if (hex.startsWith("23c8d781")) return new Response(request.method === "HEAD" ? null : "Not found", { status: 404, headers: { "cache-control": "no-store" } });
      const headers = { "content-type": img.headers.get("content-type") || "image/jpeg", "cache-control": "public, max-age=86400" };
      if (request.method === "HEAD") return new Response(null, { status: 200, headers });
      return new Response(bytes, { status: 200, headers });
    }
    if (request.method === "GET" && url.pathname === "/api/card-hero") {
      // Right-sized card hero (about 430px wide JPEG, ~70 KB) for phones and 1x screens.
      // Any miss redirects to the page's own hi-res picture, so the hero never breaks.
      const pid = Math.trunc(Number(url.searchParams.get("pid")));
      const fb = String(url.searchParams.get("fb") || "");
      const back = /^\/data\/editor\/tcg\/[a-z0-9]+\/[A-Za-z0-9._-]+$/.test(fb) ? fb : "";
      const miss = () => back ? new Response(null, { status: 302, headers: { location: back, "cache-control": "public, max-age=3600" } }) : new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
      if (!(pid > 0) || !IMAGE_HOSTS.includes("tcgplayer-cdn.tcgplayer.com")) return miss();
      let edge = null;
      try { edge = typeof caches !== "undefined" ? caches.default : null; } catch { edge = null; }
      const key = new Request(url.origin + "/api/card-hero?pid=" + pid, { method: "GET" });
      if (edge) { try { const hit = await edge.match(key); if (hit) return hit; } catch {} }
      try {
        const probe = await fetch("https://tcgplayer-cdn.tcgplayer.com/product/" + pid + "_in_400x400.jpg");
        if (!probe.ok) return miss();
        const pb = new Uint8Array(await probe.arrayBuffer());
        const d = [...new Uint8Array(await crypto.subtle.digest("SHA-256", pb))].map((x) => x.toString(16).padStart(2, "0")).join("");
        if (d.startsWith("23c8d781")) return miss();
        const img = await fetch("https://tcgplayer-cdn.tcgplayer.com/product/" + pid + "_in_600x600.jpg");
        if (!img.ok) return miss();
        const out = new Response(await img.arrayBuffer(), { status: 200, headers: { "content-type": img.headers.get("content-type") || "image/jpeg", "cache-control": "public, max-age=2592000, immutable" } });
        if (edge) { try { const put = edge.put(key, out.clone()); if (typeof ctx !== "undefined" && ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(put); else await put; } catch {} }
        return out;
      } catch { return miss(); }
    }
    if (request.method === "POST" && url.pathname === "/api/prewarm-buckets") {
      const token = String(env?.PREWARM_TOKEN || env?.CUSTOM_READS_TOKEN || "");
      const got = String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      if (!token || got !== token) return new Response("Forbidden", { status: 403, headers: { "cache-control": "no-store" } });
      const rows = await prewarmBuckets(env, ctx, fetchImpl);
      return new Response(JSON.stringify({ ok: true, n: rows.length, rows }), {
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
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
    if (isPipePath(url.pathname)) return handleReadsPipe(request, env);
    if (request.method === "GET" || request.method === "POST") {
      if (url.pathname === "/api/vote") return handleVote(request, env);
      if (url.pathname === "/api/alerts") return handleAlert(request, env);
      if (url.pathname === "/api/me" || url.pathname === "/api/me/export") return handleMe(request, env);
      if (url.pathname === "/api/follow") return handleFollow(request, env);
      if (url.pathname === "/api/reads") return handleReads(request, env);
      if (url.pathname === "/api/reads/click") return handleReadsClick(request, env);
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
        if (premiumMode(env) === "live") {
          if (back === "success") {
            const sid = String(url.searchParams.get("session_id") || "");
            if (sid) {
              try { await noteConverted(env, sid, fetchImpl); } catch { /* a return page still renders */ }
            }
          }
          return html(renderPremiumResult(back));
        }
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
      let reads = null;
      if (kind === "reads") {
        let viewer = null;
        try { viewer = await readUser(request, env); } catch { viewer = null; }
        const stored = await loadStoredPlan(env?.FEED_KV, viewer?.sub);
        const mail = await emailView(env?.FEED_KV, viewer?.sub);
        let preview = null;
        try { preview = await loadJson("reads-preview.json", fetchImpl); } catch { preview = null; }
        let chipDoc = null;
        try { chipDoc = await loadJson("signal-chips.json", fetchImpl); } catch { chipDoc = null; }
        reads = {
          plan: stored,
          signedIn: !!viewer?.sub,
          premium: viewer?.premium === true,
          saved: url.searchParams.get("saved") === "1",
          email: url.searchParams.get("email") || "",
          emailValue: mail.email || "",
          emailArmed: emailSendAllowed(env),
          note: url.searchParams.get("note") || "",
          pipe: readsPipeReady(env),
          line: url.searchParams.get("line") || "",
          card: url.searchParams.get("card") || "",
          sealed: url.searchParams.get("sealed") || "",
          picker: readsPickerEnabled(env),
          preview: preview && preview.lines ? { lines: preview.lines, chip: chipDoc?.preview || null, chips: chipDoc || null } : null,
        };
      }
      let premium = false;
      if (feed && (kind === "feed" || kind === "card" || kind === "ir-watchlist")) {
        try {
          const viewer = await readUser(request, env);
          premium = viewer?.premium === true;
        } catch {
          premium = false;
        }
      }
      if (kind && kind !== "data") {
        try {
          const anon = !/(?:^|;\s*)ce_(session|oauth)=/.test(request.headers.get("cookie") || "");
          const prewarm = url.searchParams.get("prewarm") === "1";
          const page = await renderPath(url.pathname, fetchImpl, { waitUntil: ctx?.waitUntil ? (p) => ctx.waitUntil(p) : undefined, kv: env?.FEED_KV, anon, prewarm, video, feed, premium, reads, collectionCheck: env?.COLLECTION_CHECK === "on", sort: url.searchParams.get("sort") || "", range: url.searchParams.get("range") || "", a: url.searchParams.get("a") || "", b: url.searchParams.get("b") || "", c: url.searchParams.get("c") || "", d: url.searchParams.get("d") || "", set: url.searchParams.get("set") || "", page: url.searchParams.get("page") || "", premiumMode: premiumMode(env), postOffice: postOfficeOn(env) });
          if (page) return await withShareMeta(page, url.pathname, kind);
        } catch {
          // Fall through to the baked asset if the catalog did not load.
        }
      }
      if (kind === "data") {
        try { return await renderPath(url.pathname, fetchImpl, { feed, premiumMode: premiumMode(env), waitUntil: ctx?.waitUntil ? (p) => ctx.waitUntil(p) : undefined }); }
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
        return new Response(ensureAffiliation(withChartKit(await withToday(await withMeter(paintHomePostOffice(addFeedEntry(paintPublicHtml(await asset.text(), url.pathname, env)), postOfficeOn(env)), fetchImpl), fetchImpl))), { status: asset.status, headers });
      }
      return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
    }
    if ((request.method === "GET" || request.method === "HEAD") && norm(url.pathname) === "/robots.txt" && !postOfficeOn(env) && env?.ASSETS?.fetch) {
      const robot = await env.ASSETS.fetch(request);
      if (robot.ok) {
        let text = await robot.text();
        if (!/Disallow:\s*\/post-office/i.test(text)) {
          text = text.replace(/\s*$/, "\n") + "Disallow: /post-office\nDisallow: /build\n";
        }
        const headers = new Headers(robot.headers);
        headers.set("content-type", "text/plain; charset=utf-8");
        headers.set("cache-control", "no-store");
        return new Response(request.method === "HEAD" ? null : text, { status: robot.status, headers });
      }
    }
    const asset = await env.ASSETS.fetch(request);
    if (asset.status === 404 && wantsHtml(request, url.pathname)) return notFoundPage(feedEnabled(env));
    const headers = new Headers(asset.headers);
    const type = headers.get("content-type") || "";
    if (type.includes("text/html")) {
      headers.set("cache-control", "no-store");
      headers.set("cdn-cache-control", "no-store");
      const raw = paintPublicHtml(await asset.text(), url.pathname, env);
      const homed = norm(url.pathname) === "/" ? paintHomePostOffice(raw, postOfficeOn(env)) : raw;
      const body = norm(url.pathname) === "/" ? withChartKit(await withToday(await withMeter(homed, fetchImpl), fetchImpl)) : homed;
      return new Response(ensureAffiliation(body), { status: asset.status, statusText: asset.statusText, headers });
    }
    return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
  },
};
export default worker;


// /img/{setId}/logo.png: Post Office catalogue file in Catchem-data first,
// then the same id on images.pokemontcg.io (already in IMAGE_HOSTS). Else 404.
export async function handleSetLogo(request, pathname, fetchImpl = fetch) {
  const m = pathname.match(/^\/img\/([a-z0-9]+)\/logo\.png$/);
  const miss = () => new Response(null, { status: 404, headers: { "cache-control": "no-store" } });
  if (!m) return miss();
  const headers = { "content-type": "image/png", "cache-control": "public, max-age=86400" };
  try {
    const hit = await fetchRepo(`research/assets/img/${m[1]}/logo.png`, fetchImpl, { cf: { cacheTtl: 3600 } });
    if (hit.ok) return new Response(request.method === "HEAD" ? null : hit.body, { status: 200, headers });
  } catch { /* official logo next */ }
  const res = await fetchImpl("https://images.pokemontcg.io/" + m[1] + "/logo.png", { cf: { cacheTtl: 3600 } });
  if (!res.ok) return miss();
  return new Response(request.method === "HEAD" ? null : res.body, { status: 200, headers });
}

// The sold-volume file is optional. The feed asks for it only when it exists.
let soldCheck = { at: 0, ok: false };
export async function soldFileExists(fetchImpl = fetch, now = Date.now()) {
  if (now - soldCheck.at < 10 * 60 * 1000) return soldCheck.ok;
  let ok = false;
  try { ok = !!(await loadJson("derived/tcgplayer-volume.json", fetchImpl)); } catch { ok = false; }
  soldCheck = { at: now, ok };
  return ok;
}
export function resetSoldCheck() { soldCheck = { at: 0, ok: false }; }

// Post Office editor asks /live/series/{id} and /live/sets/{id}. These are the
// public TCGdex series and set files. Only short ids pass.
export async function handleLive(request, pathname, fetchImpl = fetch) {
  const m = pathname.match(/^\/live\/(series|sets)\/([a-z0-9.-]{1,24})$/i);
  const miss = () => new Response("{}", { status: 404, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  if (!m) return miss();
  try {
    const res = await fetchImpl(`https://api.tcgdex.net/v2/en/${m[1]}/${encodeURIComponent(m[2])}`, { cf: { cacheTtl: 3600 } });
    if (!res.ok) return miss();
    return new Response(await res.text(), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=3600" } });
  } catch { return miss(); }
}

// Read page: the card's year chart (fill, archive, own days) for the opened read.
// One bucket row and one hist-long entry, pulled from text; no whole-file parse.
export async function readYearFor(id, fetchImpl = fetch) {
  const m = String(id || "").match(/(?:^|-)(tcgcsv-\d+)(?:-|$)/);
  if (!m) return null;
  try {
    const found = await bucketRow(m[1], fetchImpl);
    if (!found) return null;
    const card = { ...found };
    if (card.kind !== "sealed") {
      const packed = await longHistOf(m[1], fetchImpl);
      if (packed) card.longHist = packed;
    }
    const chart = readYearChart(card, card.asOf || "");
    const meta = {
      name: card.name || "",
      num: String(card.num || card.number || ""),
      rarity: card.rarity || "",
      artist: card.artist || "",
      set: card.set || "",
      setSlug: card.setSlug || "",
      kind: card.kind || "",
    };
    if (!chart && !meta.rarity && !meta.artist && !meta.num && !meta.setSlug) return null;
    return { id: String(id), html: chart || "", meta };
  } catch {
    return null;
  }
}

export function vancouverDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Vancouver", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

async function setFeatureHtml(slug, fetchImpl, valueDoc) {
  let doc = valueDoc || await loadJson(`set-value/${slug}.json`, fetchImpl).catch(() => null);
  const hold = await loadJson("price-hold.json", fetchImpl).catch(() => null);
  const held = hold && hold.ids && typeof hold.ids === "object" ? hold.ids : {};
  if (doc && Array.isArray(doc.top)) {
    const top = doc.top.filter((row) => row && !held[row.id]);
    const dropped = top.length !== doc.top.length;
    doc = { ...doc, top };
    if (dropped && doc.master) doc = { ...doc, master: { ...doc.master, total: null } };
  }
  const images = doc ? await catalogueMap(fetchImpl) : {};
  const rot = await loadJson("rotation-status.json", fetchImpl).catch(() => null);
  let rotationHtml = rot ? rotationBadge(rotationRow(rot, slug), rot) : undefined;
  if (rot) {
    const ir = await loadJson("feed/ir-cycle.json", fetchImpl).catch(() => null);
    const n = (ir?.rows || []).filter((r) => r.setSlug === slug).length;
    rotationHtml = setChipHtml(slug, rot, vancouverDay(), n, { noRotation: !!rotationHtml }) + (rotationHtml || "");
  }
  return { setValueHtml: setValueBlock(doc, images, slug), rotationHtml };
}

// /track-record is left out of every sitemap until it opens, then listed in sitemap-00.
export async function withTrackInSitemap(res, open, first) {
  if (!res || !res.ok) return res;
  let text = await res.text();
  const loc = "<url><loc>https://catchemtcg.com/track-record</loc></url>";
  text = text.replace(/<url>\s*<loc>https:\/\/catchemtcg\.com\/track-record\/?<\/loc>[\s\S]*?<\/url>\s*/g, "");
  if (open && first && text.includes("</urlset>")) text = text.replace("</urlset>", loc + "\n</urlset>");
  return new Response(text, { status: res.status, headers: res.headers });
}

export async function withoutPostOfficeInSitemap(res, open) {
  if (!res || !res.ok || open) return res;
  let text = await res.text();
  text = text.replace(/<url>\s*<loc>https:\/\/catchemtcg\.com\/post-office\/?<\/loc>[\s\S]*?<\/url>\s*/g, "");
  text = text.replace(/<url>\s*<loc>https:\/\/catchemtcg\.com\/build\/?<\/loc>[\s\S]*?<\/url>\s*/g, "");
  return new Response(text, { status: res.status, headers: res.headers });
}

export async function withReleasesInSitemap(res) {
  if (!res || !res.ok) return res;
  let text = await res.text();
  const loc = "<url><loc>https://catchemtcg.com/releases</loc></url>";
  if (!text.includes("https://catchemtcg.com/releases<")) text = text.replace("</urlset>", loc + "\n</urlset>");
  return new Response(text, { status: 200, headers: res.headers });
}
