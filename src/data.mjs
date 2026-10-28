import { buildPokemonPages } from "./pokemon.mjs";

// One place for Catchem-data raw URLs. public-data is tried first.
// A 404 or a network error falls back to main. After the first miss, the
// rest of this session uses main so a missing branch costs one extra request.
// A hit locks the session to public-data. A later missing file still falls
// back to main for that file only.
const ORIGIN = "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data";
let sessionBase = "";

export function resetDataBase() {
  sessionBase = "";
}

export function dataBase() {
  return sessionBase;
}

export function repoUrl(branch, path) {
  const clean = String(path || "").replace(/^\/+/, "");
  return `${ORIGIN}/${branch}/${clean}`;
}

// Browser copies cannot fall back. The function body is copied into pages,
// so it must not call another function. Card files outside public/ stay on main.
export function browserAssetUrl(path) {
  const clean = String(path || "").replace(/^\/+/, "");
  return "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/" + clean;
}

// Dive JSON and derived catalogues live on main only. Probing public-data
// first doubled every cold /p/ and /c/ render and pushed Workers past CPU
// limits (1102 / intermittent 503). Keep public-data for research/assets/public.
export function mainOnlyPath(path) {
  const clean = String(path || "").replace(/^\/+/, "");
  return clean.startsWith("research/pulse/") || clean.startsWith("data/derived/");
}

export async function fetchRepo(path, fetchImpl = fetch, init) {
  const clean = String(path || "").replace(/^\/+/, "");
  const load = (branch) => fetchImpl(repoUrl(branch, clean), init);
  if (mainOnlyPath(clean)) return load("main");
  if (sessionBase === "main") return load("main");
  if (sessionBase === "public-data") {
    try {
      const hit = await load("public-data");
      if (hit && hit.ok) return hit;
    } catch { /* that file falls back */ }
    return load("main");
  }
  try {
    const hit = await load("public-data");
    if (hit && hit.ok) {
      sessionBase = "public-data";
      return hit;
    }
  } catch { /* missing branch or network */ }
  sessionBase = "main";
  return load("main");
}

const mem = new Map();
let pokemonBundle = null;
export const MEM_TTL_MS = 5 * 60 * 1000;
let nowFn = () => Date.now();
export function setCacheClock(fn) { nowFn = fn || (() => Date.now()); }

// Cached for MEM_TTL_MS; on a failed refetch the stale copy is served.
async function cached(key, load) {
  const hit = mem.get(key);
  if (hit && nowFn() - hit.at < MEM_TTL_MS) return hit.data;
  try {
    const data = await load();
    if (!hit && mem.size > 24) mem.clear();
    mem.set(key, { data, at: nowFn() });
    return data;
  } catch (err) {
    if (hit) return hit.data;
    throw err;
  }
}

export function resetJsonCache() {
  mem.clear();
  rowMem.clear();
  pokemonBundle = null;
  resetDataBase();
}

export function parseIndexPrefix(text) {
  const raw = String(text || "");
  const cut = raw.indexOf('"items"');
  const head = cut >= 0 ? raw.slice(0, cut) : raw;
  return {
    singleIndex: extractJsonArray(head, "singleIndex") || [],
    sealedIndex: extractJsonArray(head, "sealedIndex") || [],
  };
}

function extractJsonArray(text, key) {
  const at = text.indexOf(`"${key}"`);
  if (at < 0) return null;
  const start = text.indexOf("[", at);
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i += 1) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "[") depth += 1;
    else if (c === "]") {
      depth -= 1;
      if (depth === 0) {
        try {
          const arr = JSON.parse(text.slice(start, i + 1));
          return Array.isArray(arr) ? arr : null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

// Indexes sit before "items" in the set file. Read only that prefix.
// A full set file is about 2 MB. The product page must not download it.
async function readUntilItems(res, cap = 65536) {
  if (!res || !res.body || typeof res.body.getReader !== "function") {
    const text = res ? await res.text() : "";
    const cut = text.indexOf('"items"');
    return (cut >= 0 ? text.slice(0, cut) : text).slice(0, cap);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let text = "";
  try {
    while (text.length < cap) {
      const { value, done } = await reader.read();
      if (done) break;
      text += dec.decode(value, { stream: true });
      const cut = text.indexOf('"items"');
      if (cut >= 0) return text.slice(0, cut);
    }
  } finally {
    try { await reader.cancel(); } catch { /* closed */ }
  }
  const cut = text.indexOf('"items"');
  return cut >= 0 ? text.slice(0, cut) : text;
}

export async function loadSetIndexes(slug, fetchImpl = fetch) {
  const clean = String(slug || "");
  if (!/^[a-z0-9-]+$/.test(clean)) return null;
  return cached(`set-index:${clean}`, async () => {
    const res = await fetchRepo(`research/assets/public/sets/${clean}.json`, fetchImpl, {
      headers: { Range: "bytes=0-65535" },
      cf: { cacheTtl: 300 },
    });
    if (!res || (!res.ok && res.status !== 206)) throw new Error(`set-index ${clean} ${res && res.status}`);
    const head = await readUntilItems(res);
    const parsed = parseIndexPrefix(head);
    if (!parsed.singleIndex.length && !parsed.sealedIndex.length) throw new Error(`set-index ${clean} empty`);
    return parsed;
  });
}

export async function loadJson(rel, fetchImpl = fetch) {
  return cached(rel, async () => {
    const res = await fetchRepo(`research/assets/public/${rel}`, fetchImpl, { cf: { cacheTtl: 3600, cacheEverything: true } });
    if (!res.ok) throw new Error(`${rel} ${res.status}`);
    return res.json();
  });
}

// Live Feed news. Catchem-data writes research/digests/feed-news.json on every
// news run (nightly), already free of Japan-only items. It is not on public-data,
// so it is read from main. Null on any miss; the Feed then uses the baked copy.
export const FEED_NEWS_PATH = "research/digests/feed-news.json";
export async function loadFeedNews(fetchImpl = fetch) {
  try {
    return await cached("feed-news", async () => {
      const res = await fetchImpl(repoUrl("main", FEED_NEWS_PATH), { cf: { cacheTtl: 300 } });
      if (!res.ok) throw new Error(`feed-news ${res.status}`);
      const doc = await res.json();
      if (!doc || !Array.isArray(doc.items) || !/^\d{4}-\d{2}-\d{2}$/.test(String(doc.asOf || ""))) throw new Error("feed-news shape");
      return doc;
    });
  } catch {
    return null;
  }
}

export function publicContentType(rel) {
  const name = String(rel || "");
  if (name.endsWith(".xml")) return "application/xml; charset=utf-8";
  if (name.endsWith(".mjs")) return "text/javascript; charset=utf-8";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return "application/json; charset=utf-8";
}

export async function proxyPublic(rel, fetchImpl = fetch) {
  const res = await fetchRepo(`research/assets/public/${rel}`, fetchImpl, { cf: { cacheTtl: 300 } });
  if (!res.ok) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  const type = publicContentType(rel);
  return new Response(res.body, {
    status: 200,
    headers: {
      "content-type": type,
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });
}

export async function loadDiveIndex(fetchImpl = fetch) {
  return cached("dive:index", async () => {
    const res = await fetchRepo("research/pulse/dive/index.json", fetchImpl, { cf: { cacheTtl: 3600, cacheEverything: true } });
    if (!res.ok) throw new Error(`dive index ${res.status}`);
    return res.json();
  });
}

export async function loadDive(id, fetchImpl = fetch) {
  const key = "dive:" + id;
  const safe = String(id || "").replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safe || safe !== id) throw new Error("bad dive id");
  return cached(key, async () => {
    const res = await fetchRepo(`research/pulse/dive/${encodeURIComponent(safe)}.json`, fetchImpl, { cf: { cacheTtl: 3600, cacheEverything: true } });
    if (!res.ok) throw new Error(`dive ${safe} ${res.status}`);
    return res.json();
  });
}

async function readCatalogue(rel, fetchImpl) {
  const res = await fetchRepo(`data/${rel}`, fetchImpl, { cf: { cacheTtl: 3600 } });
  if (!res.ok) throw new Error(`${rel} ${res.status}`);
  return res.json();
}

export async function loadCatalogue(rel, fetchImpl = fetch) {
  return cached("cat:" + rel, async () => readCatalogue(rel, fetchImpl));
}

export async function loadPokemonBundle(fetchImpl = fetch) {
  if (pokemonBundle) return pokemonBundle;
  const [attrs, catalogue] = await Promise.all([
    readCatalogue("card-attrs.json", fetchImpl),
    readCatalogue("card-catalogue.json", fetchImpl),
  ]);
  pokemonBundle = buildPokemonPages(attrs?.cards || {}, catalogue?.cards || {});
  return pokemonBundle;
}

// One row out of a big bucket file without parsing the whole file. Bucket files
// are ~800 KB each (singles fill made them grow); parsing dozens per request ran
// the worker out of CPU and memory (Error 1102). Text is fetched through the
// Cloudflare cache; only the matching row is parsed. Results are memoized briefly.
const rowMem = new Map();
export function extractRow(text, id) {
  const s = String(text || "");
  const needle = `{"id":${JSON.stringify(String(id))}`;
  // Nested "also" entries carry the same id with only a name; a real row has more.
  for (let at = s.indexOf(needle); at >= 0; at = s.indexOf(needle, at + 1)) {
    let depth = 0, inStr = false, esc = false, end = -1;
    for (let i = at; i < s.length; i++) {
      const c = s[i];
      if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true;
      else if (c === "{" || c === "[") depth++;
      else if (c === "}" || c === "]") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end < 0) return null;
    try {
      const row = JSON.parse(s.slice(at, end + 1));
      if (row && typeof row === "object" && Object.keys(row).some((k) => k !== "id" && k !== "name")) return row;
    } catch { /* keep looking */ }
  }
  return null;
}
export function extractPacked(text, id) {
  const s = String(text || "");
  const key = `${JSON.stringify(String(id))}:"`;
  const at = s.indexOf(key);
  if (at < 0) return "";
  const end = s.indexOf('"', at + key.length);
  return end < 0 ? "" : s.slice(at + key.length, end);
}
// Cloudflare Cache API + FEED_KV so cold /p/ does not re-pull ~1MB bucket
// files from GitHub on every colo. KV is global; Cache API is per-colo.
const RAW_TTL = 3600;
let rawKv = null;
let rawWaitUntil = null;
export function setRawKv(kv, waitUntil) {
  rawKv = kv || null;
  rawWaitUntil = typeof waitUntil === "function" ? waitUntil : null;
}
function rawKvKey(path) { return `rawpub:v1:${path}`; }

async function rawText(rel, fetchImpl) {
  const path = `research/assets/public/${rel}`;
  let edge = null;
  try { edge = typeof caches !== "undefined" && caches.default ? caches.default : null; } catch { edge = null; }
  const key = new Request(`https://catchem.internal/raw/${path}`, { method: "GET" });
  if (edge) {
    try {
      const hit = await edge.match(key);
      if (hit) return await hit.text();
    } catch { /* miss */ }
  }
  if (rawKv) {
    try {
      const hit = await rawKv.get(rawKvKey(path));
      if (hit) {
        if (edge) {
          try { void edge.put(key, new Response(hit, { headers: { "content-type": "application/json", "cache-control": `public, max-age=${RAW_TTL}` } })).catch(() => {}); } catch {}
        }
        return hit;
      }
    } catch { /* miss */ }
  }
  const res = await fetchRepo(path, fetchImpl, { cf: { cacheTtl: RAW_TTL, cacheEverything: true } });
  if (!res.ok) throw new Error(`${rel} ${res.status}`);
  const text = await res.text();
  if (text) {
    if (rawKv) {
      try { void rawKv.put(rawKvKey(path), text, { expirationTtl: RAW_TTL }).catch(() => {}); } catch {}
    }
    if (edge) {
      try {
        void edge.put(key, new Response(text, { headers: { "content-type": "application/json", "cache-control": `public, max-age=${RAW_TTL}` } })).catch(() => {});
      } catch { /* never block */ }
    }
  }
  return text;
}
export function bucketOf(id) {
  return String((Number((String(id).match(/(\d+)/) || [])[1]) || 0) % 100).padStart(2, "0");
}
async function memoRow(key, load) {
  const hit = rowMem.get(key);
  if (hit && nowFn() - hit.at < MEM_TTL_MS) return hit.data;
  const data = await load();
  if (data == null || data === "") return data; // a miss or a failed read is not remembered
  if (rowMem.size > 2000) rowMem.clear();
  rowMem.set(key, { data, at: nowFn() });
  return data;
}
function prodrowKey(id) { return `prodrow:v2:${id}`; }

/** Pull every tcgcsv id out of a bucket file body (for KV row seeding). */
export function listBucketIds(text) {
  const out = [];
  const re = /"id":"(tcgcsv-\d+)"/g;
  let m;
  const s = String(text || "");
  while ((m = re.exec(s))) out.push(m[1]);
  return [...new Set(out)];
}

/** One pass over a bucket body. Calling extractRow once per id was O(n²) on ~1MB and hung warmBucket. */
export function extractAllRows(text) {
  const s = String(text || "");
  const out = [];
  let at = 0;
  while (at < s.length) {
    const start = s.indexOf('{"id":"tcgcsv-', at);
    if (start < 0) break;
    let depth = 0, inStr = false, esc = false, end = -1;
    for (let i = start; i < s.length; i++) {
      const c = s[i];
      if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true;
      else if (c === "{" || c === "[") depth++;
      else if (c === "}" || c === "]") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end < 0) break;
    at = end + 1;
    try {
      const row = JSON.parse(s.slice(start, end + 1));
      if (row && typeof row === "object" && row.id && Object.keys(row).some((k) => k !== "id" && k !== "name")) out.push(row);
    } catch { /* skip malformed */ }
  }
  return out;
}

/** Seed tiny per-id KV rows from a bucket body so later /p/ hits skip the ~1MB read. */
export async function seedProdRowsFromBucket(text, kv, ttl = RAW_TTL) {
  if (!kv || !text) return 0;
  const rows = extractAllRows(text);
  const puts = [];
  for (const row of rows) {
    if (!row || !row.id) continue;
    puts.push(kv.put(prodrowKey(row.id), JSON.stringify(row), { expirationTtl: ttl }).catch(() => {}));
  }
  for (let i = 0; i < puts.length; i += 5) {
    await Promise.all(puts.slice(i, i + 5));
  }
  return puts.length;
}

function prodrowBucketKey(pad) { return `prodrow-bucket:v2:${pad}`; }

/** Load one bucket file and seed every prodrow into FEED_KV (for /api/prewarm-buckets or ?prewarm=1). */
export async function warmBucket(bucketPad, fetchImpl = fetch) {
  const pad = String(bucketPad || "").padStart(2, "0");
  if (rawKv) {
    try {
      if (await rawKv.get(prodrowBucketKey(pad))) return { bytes: 0, rows: 0, skipped: true };
    } catch { /* seed anyway */ }
  }
  const text = await rawText(`buckets/${pad}.json`, fetchImpl);
  const n = await seedProdRowsFromBucket(text, rawKv);
  if (rawKv && n > 0) {
    try { await rawKv.put(prodrowBucketKey(pad), String(n), { expirationTtl: RAW_TTL }).catch(() => {}); } catch {}
  }
  return { bytes: text.length, rows: n };
}


export async function bucketRow(id, fetchImpl = fetch) {
  return memoRow(`b:${id}`, async () => {
    if (rawKv) {
      try {
        const hit = await rawKv.get(prodrowKey(id));
        if (hit) {
          try { return JSON.parse(hit); } catch { /* fall through */ }
        }
      } catch { /* miss */ }
    }
    const text = await rawText(`buckets/${bucketOf(id)}.json`, fetchImpl);
    const row = extractRow(text, id);
    if (row && rawKv) {
      try { void rawKv.put(prodrowKey(id), JSON.stringify(row), { expirationTtl: RAW_TTL }).catch(() => {}); } catch {}
    }
    // Full-bucket prodrow seeding only via warmBucket / ?prewarm=1 (not on every hit).
    return row;
  });
}
export async function longHistOf(id, fetchImpl = fetch) {
  return memoRow(`l:${id}`, async () => { try { return extractPacked(await rawText(`hist-long/${bucketOf(id)}.json`, fetchImpl), id); } catch { return ""; } });
}
export function resetRowCache() { rowMem.clear(); }

// Many rows at once: one fetch per bucket file (not per row), rows pulled from text.
export async function bucketRows(ids, fetchImpl = fetch) {
  const out = new Map();
  const byBucket = new Map();
  for (const id of new Set(ids)) {
    const hit = rowMem.get(`b:${id}`);
    if (hit && nowFn() - hit.at < MEM_TTL_MS) { out.set(id, hit.data); continue; }
    const b = bucketOf(id);
    if (!byBucket.has(b)) byBucket.set(b, []);
    byBucket.get(b).push(id);
  }
  const jobs = [...byBucket.entries()];
  for (let i = 0; i < jobs.length; i += 8) {
    await Promise.all(jobs.slice(i, i + 8).map(async ([b, list]) => {
      let text = "";
      try { text = await rawText(`buckets/${b}.json`, fetchImpl); } catch { return; }
      for (const id of list) {
        const row = extractRow(text, id);
        out.set(id, row);
        if (row) { if (rowMem.size > 2000) rowMem.clear(); rowMem.set(`b:${id}`, { data: row, at: nowFn() }); }
      }
    }));
  }
  return out;
}

// Per-read facts file. Small and per id, so it skips the shared cache (keeps reads.json warm).
export async function loadReadFacts(id, fetchImpl = fetch) {
  const name = String(id || "").replace(/[^A-Za-z0-9._-]/g, "_");
  if (!name) return null;
  try {
    const res = await fetchRepo(`research/assets/public/feed/facts/${name}.json`, fetchImpl, { cf: { cacheTtl: 300 } });
    if (!res.ok) return null;
    const doc = await res.json();
    return doc && typeof doc === "object" && doc.id === String(id) ? doc : null;
  } catch { return null; }
}

// One item's row from its set's item-read shard (feed/items/<setSlug>.json).
// One item per line, so the row is sliced out of the text; the shard is never parsed whole.
export async function loadItemRead(setSlug, id, fetchImpl = fetch) {
  const slug = String(setSlug || "").replace(/[^A-Za-z0-9._-]/g, "_");
  if (!slug || !id) return null;
  try {
    const text = await rawText(`feed/items/${slug}.json`, fetchImpl);
    return itemLine(text, id);
  } catch { return null; }
}

export function itemLine(text, id) {
  const s = String(text || "");
  const key = `\n${JSON.stringify(String(id))}:`;
  const at = s.indexOf(key);
  if (at < 0) return null;
  const end = s.indexOf("\n", at + key.length);
  const body = s.slice(at + key.length, end < 0 ? undefined : end).replace(/,\s*$/, "");
  try { const doc = JSON.parse(body); return doc && typeof doc === "object" ? doc : null; } catch { return null; }
}

// Small per-item bucket files (feed/item-reads, feed/card/*). Own memo with
// its own cap, so these never push the big shared files out of the main memo.
// A 404 resolves to null; other failures throw so callers can fall back.
const smallMem = new Map();
export async function smallJson(rel, fetchImpl = fetch) {
  const hit = smallMem.get(rel);
  if (hit && nowFn() - hit.at < MEM_TTL_MS) return hit.data;
  const res = await fetchRepo(`research/assets/public/${rel}`, fetchImpl, { cf: { cacheTtl: 300 } });
  if (res && res.status === 404) return null;
  if (!res || !res.ok) throw new Error(`${rel} ${res && res.status}`);
  const data = await res.json();
  if (smallMem.size > 150) smallMem.clear();
  smallMem.set(rel, { data, at: nowFn() });
  return data;
}
export const idBucket = (id) => String((Number((String(id).match(/(\d+)/) || [])[1]) || 0) % 100).padStart(2, "0");
