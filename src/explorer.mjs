// Explore. Sets, sealed products, and singles from files the site already loads.
// A row is shown only when that row has a source and a date. The clock is not a date.
// Sealed names drop condition words. Listings counted is printed only when the field is present.

import { loadJson } from "./data.mjs";
import { queryShardIds } from "./search-shards.mjs";

export const PAGE_SIZE = 25;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = ["set", "sealed", "single"];

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => {
    if (c === "&") return "&" + "amp;";
    if (c === "<") return "&" + "lt;";
    if (c === ">") return "&" + "gt;";
    if (c === '"') return "&" + "quot;";
    return "&" + "#39;";
  });
}

function clean(s) {
  return String(s ?? "").replace(/\s*[\u2013\u2014]\s*/g, " - ").replace(/\s+/g, " ").trim();
}

export function sealedName(s) {
  return clean(s)
    .replace(/\bnear mint\b/gi, " ")
    .replace(/\blightly played\b/gi, " ")
    .replace(/\bmoderately played\b/gi, " ")
    .replace(/\bheavily played\b/gi, " ")
    .replace(/\bmint condition\b/gi, " ")
    .replace(/\bdamaged\b/gi, " ")
    .replace(/\b(NM|LP|MP|HP|DMG)\b/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.)])/g, "$1")
    .trim();
}

function nameKey(s) {
  return sealedName(s).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function countOf(raw) {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "object" ? Number(raw.n) : Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function countText(n) {
  if (Number.isInteger(n)) return String(n);
  return String(n);
}

function safeHref(href) {
  const h = String(href || "");
  if (h.startsWith("/sets/") || h.startsWith("/c/") || h.startsWith("/p/")) return h;
  return "";
}

export function prepareExploreRow(raw) {
  if (!raw || typeof raw !== "object") return null;
  const kind = KINDS.includes(raw.kind) ? raw.kind : "";
  if (!kind) return null;
  const source = clean(raw.source);
  const date = String(raw.date || raw.asOf || "").slice(0, 10);
  if (!source || !DAY.test(date)) return null;
  const name = kind === "sealed" ? sealedName(raw.name) : clean(raw.name);
  if (!name) return null;
  const detail = clean(raw.detail || raw.set || raw.era || "");
  const row = {
    kind,
    name,
    detail,
    source,
    date,
    href: safeHref(raw.href),
  };
  if (kind === "sealed") {
    const n = countOf(raw.listingsCounted);
    if (n != null) row.listingsCounted = n;
  }
  return row;
}

function listingIndex(doc) {
  const byId = new Map();
  const byName = new Map();
  for (const product of doc?.products || []) {
    const n = countOf(product?.listingsCounted);
    if (n == null || !product) continue;
    if (product.id) byId.set(String(product.id), n);
    const key = nameKey(product.name);
    if (!key) continue;
    if (byName.has(key) && byName.get(key) !== n) byName.set(key, null);
    else if (!byName.has(key)) byName.set(key, n);
  }
  return { byId, byName };
}

function lookupListing(row, index) {
  if (!index) return null;
  if (row.id && index.byId.has(String(row.id))) return index.byId.get(String(row.id));
  const key = nameKey(row.name);
  if (!key || !index.byName.has(key)) return null;
  const n = index.byName.get(key);
  return n == null ? null : n;
}

export function catalogRows({ sets = null, products = [], listings = null } = {}) {
  const out = [];
  const setSource = clean(sets?.source);
  for (const set of sets?.sets || []) {
    if (!set) continue;
    const slug = String(set.slug || "");
    out.push({
      kind: "set",
      name: set.name,
      detail: set.era || "",
      source: setSource,
      date: String(set.release || "").slice(0, 10),
      href: /^[a-z0-9-]+$/.test(slug) ? "/sets/" + slug : "",
    });
  }
  const index = listingIndex(listings);
  for (const product of products || []) {
    if (!product) continue;
    const kind = product.kind === "sealed" ? "sealed" : product.kind === "single" ? "single" : "";
    if (!kind) continue;
    const row = {
      kind,
      id: product.id || "",
      name: product.name,
      detail: product.detail || product.set || "",
      source: product.source,
      date: product.date || product.asOf || "",
      href: product.href || "",
    };
    if (kind === "sealed") {
      const own = countOf(product.listingsCounted);
      const n = own != null ? own : lookupListing(row, index);
      if (n != null) row.listingsCounted = n;
    }
    out.push(row);
  }
  return out.map(prepareExploreRow).filter(Boolean);
}

export function exploreView(rows, query = {}) {
  const q = clean(query.q).toLowerCase();
  const kind = KINDS.includes(query.kind) ? query.kind : "";
  const sort = query.sort === "date" ? "date" : "name";
  let page = Number(query.page);
  if (!Number.isFinite(page) || page < 1) page = 1;
  page = Math.floor(page);
  let list = (Array.isArray(rows) ? rows : []).map(prepareExploreRow).filter(Boolean);
  if (kind) list = list.filter((row) => row.kind === kind);
  if (q) list = list.filter((row) => row.name.toLowerCase().includes(q));
  list = list.slice().sort((a, b) => {
    if (sort === "date") {
      const byDate = b.date.localeCompare(a.date);
      if (byDate) return byDate;
    }
    return a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a.kind.localeCompare(b.kind);
  });
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE) || 1);
  if (page > pages) page = pages;
  const start = (page - 1) * PAGE_SIZE;
  return {
    rows: list.slice(start, start + PAGE_SIZE),
    total,
    page,
    pages,
    kind,
    sort,
    q: clean(query.q),
    start,
  };
}

function pageHref(view, page) {
  const params = new URLSearchParams();
  if (view.q) params.set("q", view.q);
  if (view.kind) params.set("kind", view.kind);
  if (view.sort === "date") params.set("sort", "date");
  if (page > 1) params.set("page", String(page));
  const text = params.toString();
  return text ? "/explore?" + text : "/explore";
}

const KIND_LABEL = { set: "Set", sealed: "Sealed", single: "Single" };

function rowHtml(row) {
  const title = row.href ? `<a href="${esc(row.href)}">${esc(row.name)}</a>` : esc(row.name);
  const detail = row.detail ? `<p class="ex-detail">${esc(row.detail)}</p>` : "";
  const counted = row.kind === "sealed" && row.listingsCounted != null
    ? `<p class="ex-count">${esc(countText(row.listingsCounted))} listings counted</p>`
    : "";
  return `<article class="ex-row" data-kind="${esc(row.kind)}" data-source="${esc(row.source)}" data-date="${esc(row.date)}"><p class="ex-k">${KIND_LABEL[row.kind]}</p><h2>${title}</h2>${detail}${counted}<p class="ex-src">Source: ${esc(row.source)}</p><p class="ex-date">Date: ${esc(row.date)}</p></article>`;
}

const CSS = `
.ex h1{font-family:Georgia,"Times New Roman",serif;font-weight:500;font-size:32px;line-height:1.05;margin:0 0 8px;letter-spacing:-0.02em}
.ex-lead{margin:0 0 12px;color:#c4baab}
.ex-form{display:grid;gap:10px;margin:0 0 14px}
.ex-form label{display:grid;gap:6px;font:600 13px/1.2 "IBM Plex Sans",system-ui,sans-serif;color:#c4baab}
.ex-form input,.ex-form select,.ex-form button{box-sizing:border-box;min-height:44px;min-width:44px;border-radius:14px;border:1px solid #2f2b26;background:#1a1815;color:#efe9de;font:16px/1.2 "IBM Plex Sans",system-ui,sans-serif;padding:0 12px;width:100%}
.ex-form button{background:#d9b779;color:#1a1407;font-weight:600}
.ex-count-line{color:#c4baab;margin:0 0 10px}
.ex-row{background:#1a1815;border:1px solid #2f2b26;border-radius:16px;padding:12px 14px;margin:0 0 10px}
.ex-k{margin:0 0 4px;color:#d9b779;font:600 12px/1 "IBM Plex Sans",system-ui,sans-serif;letter-spacing:.04em}
.ex-row h2{font-family:Georgia,"Times New Roman",serif;font-weight:500;font-size:22px;line-height:1.25;margin:0 0 4px}
.ex-row h2 a{color:#d9b779;text-decoration:none}
.ex-detail,.ex-count{margin:0 0 4px}
.ex-src,.ex-date{margin:0;color:#c4baab;font-size:14px}
.ex-pages{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0 0}
.ex-pages a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:44px;padding:0 16px;border-radius:999px;border:1px solid #2f2b26;background:#1a1815;color:#efe9de;text-decoration:none}
.ex-empty{margin:8px 0}
@media (min-width:900px){
  .ex h1{font-size:44px}
  .ex-form{grid-template-columns:minmax(0,1fr) 180px 160px auto;align-items:end}
  .ex-form button{width:auto;padding:0 22px}
}
`;

export function renderExplore(rows, query = {}) {
  const view = exploreView(rows, query);
  const kindOptions = [["", "All"], ["set", "Set"], ["sealed", "Sealed"], ["single", "Single"]]
    .map(([id, label]) => `<option value="${id}"${id === view.kind ? " selected" : ""}>${label}</option>`)
    .join("");
  const sortOptions = [["name", "Name"], ["date", "Date"]]
    .map(([id, label]) => `<option value="${id}"${id === view.sort ? " selected" : ""}>${label}</option>`)
    .join("");
  const from = view.total ? view.start + 1 : 0;
  const to = view.start + view.rows.length;
  const count = view.total
    ? `Showing ${from} to ${to} of ${view.total}.`
    : "";
  const empty = view.total
    ? ""
    : (view.kind === "sealed" || view.kind === "single") && view.q.length < 2
      ? `<p class="ex-empty">Type a name.</p>`
      : `<p class="ex-empty">No rows match.</p>`;
  const pages = view.pages > 1
    ? `<nav class="ex-pages" aria-label="Pages">${view.page > 1 ? `<a href="${esc(pageHref(view, view.page - 1))}">Previous</a>` : ""}<span>Page ${view.page} of ${view.pages}</span>${view.page < view.pages ? `<a href="${esc(pageHref(view, view.page + 1))}">Next</a>` : ""}</nav>`
    : "";
  const list = view.rows.map(rowHtml).join("");
  return `<style>${CSS}</style><main id="main" tabindex="-1" class="wrap ex">
<h1>Explore</h1>
<p class="ex-lead">Sets, sealed products, and singles. Each row lists its source and its date.</p>
<form class="ex-form" method="get" action="/explore" role="search">
<label for="ex-q">Search<input id="ex-q" name="q" type="search" value="${esc(view.q)}" placeholder="Name" autocomplete="off"></label>
<label for="ex-kind">Kind<select id="ex-kind" name="kind">${kindOptions}</select></label>
<label for="ex-sort">Sort<select id="ex-sort" name="sort">${sortOptions}</select></label>
<button type="submit">Show</button>
</form>
${count ? `<p class="ex-count-line">${esc(count)}</p>` : ""}
${list || empty}
${pages}
</main>`;
}

export function renderExploreDocument(rows, query = {}) {
  const body = renderExplore(rows, query);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Explore · Catch'em</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#12100e;color:#efe9de;font:16px/1.45 "IBM Plex Sans",system-ui,sans-serif}
a{color:#d9b779}.wrap{max-width:1040px;margin:0 auto;padding:22px 16px 48px}
.logo{font:600 28px/1 Georgia,serif;color:#efe9de;text-decoration:none;min-height:44px;display:inline-flex;align-items:center}.logo span{color:#d9b779}
</style></head><body>
<header style="max-width:1040px;margin:0 auto;padding:16px 16px 0"><a class="logo" href="/">Catch'em<span>.</span></a></header>
${body}
</body></html>`;
}

function shardIdsFor(q, kind) {
  const ids = queryShardIds(q);
  if (kind === "set") return [];
  return ids.filter((id) => {
    if (kind === "single" || kind === "sealed") return id.startsWith(kind + "-");
    return id.startsWith("single-") || id.startsWith("sealed-");
  });
}

async function loadShardProducts(fetchImpl, q, kind) {
  const wanted = shardIdsFor(q, kind);
  if (!wanted.length) return { products: [], listings: null };
  const [manifest, counts, listings] = await Promise.all([
    loadJson("feed/search/manifest.json", fetchImpl).catch(() => null),
    loadJson("counts.json", fetchImpl).catch(() => null),
    loadJson("listings-counted.json", fetchImpl).catch(() => null),
  ]);
  const known = manifest?.shards || {};
  const ids = wanted.filter((id) => known[id]);
  const source = clean(counts?.source);
  const date = String(counts?.asOf || "").slice(0, 10);
  if (!source || !DAY.test(date) || !ids.length) return { products: [], listings };
  const lists = await Promise.all(ids.map((id) => loadJson(`feed/search/shards/${id}.json`, fetchImpl).catch(() => [])));
  const seen = new Set();
  const products = [];
  const needle = clean(q).toLowerCase();
  for (const list of lists) {
    for (const row of Array.isArray(list) ? list : []) {
      if (!Array.isArray(row) || !row[0] || seen.has(row[0])) continue;
      const rowKind = row[5] === "sealed" ? "sealed" : row[5] === "single" ? "single" : "";
      if (!rowKind) continue;
      if ((kind === "single" || kind === "sealed") && rowKind !== kind) continue;
      const name = String(row[1] || "");
      if (needle && !name.toLowerCase().includes(needle)) continue;
      seen.add(row[0]);
      const id = String(row[0]);
      products.push({
        id,
        kind: rowKind,
        name,
        set: String(row[2] || ""),
        source,
        date,
        href: (rowKind === "sealed" ? "/p/" : "/c/") + encodeURIComponent(id),
      });
    }
  }
  return { products, listings };
}

export async function loadExploreRows(fetchImpl, query = {}) {
  const kind = KINDS.includes(query.kind) ? query.kind : "";
  const q = clean(query.q);
  const sets = kind === "single" || kind === "sealed"
    ? null
    : await loadJson("sets.json", fetchImpl).catch(() => null);
  let products = [];
  let listings = null;
  if (q.replace(/[^a-z0-9]+/gi, "").length >= 2 && kind !== "set") {
    const loaded = await loadShardProducts(fetchImpl, q, kind);
    products = loaded.products;
    listings = loaded.listings;
  }
  return catalogRows({ sets, products, listings });
}
