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

export async function fetchRepo(path, fetchImpl = fetch, init) {
  const clean = String(path || "").replace(/^\/+/, "");
  const load = (branch) => fetchImpl(repoUrl(branch, clean), init);
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

export async function loadJson(rel, fetchImpl = fetch) {
  return cached(rel, async () => {
    const res = await fetchRepo(`research/assets/public/${rel}`, fetchImpl, { cf: { cacheTtl: 300 } });
    if (!res.ok) throw new Error(`${rel} ${res.status}`);
    return res.json();
  });
}

export async function proxyPublic(rel, fetchImpl = fetch) {
  const res = await fetchRepo(`research/assets/public/${rel}`, fetchImpl, { cf: { cacheTtl: 300 } });
  if (!res.ok) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  const type = rel.endsWith(".xml") ? "application/xml; charset=utf-8"
    : rel.endsWith(".mjs") ? "text/javascript; charset=utf-8"
    : "application/json; charset=utf-8";
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
    const res = await fetchRepo("research/pulse/dive/index.json", fetchImpl, { cf: { cacheTtl: 300 } });
    if (!res.ok) throw new Error(`dive index ${res.status}`);
    return res.json();
  });
}

export async function loadDive(id, fetchImpl = fetch) {
  const key = "dive:" + id;
  const safe = String(id || "").replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safe || safe !== id) throw new Error("bad dive id");
  return cached(key, async () => {
    const res = await fetchRepo(`research/pulse/dive/${encodeURIComponent(safe)}.json`, fetchImpl, { cf: { cacheTtl: 300 } });
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
async function rawText(rel, fetchImpl) {
  const res = await fetchRepo(`research/assets/public/${rel}`, fetchImpl, { cf: { cacheTtl: 300 } });
  if (!res.ok) throw new Error(`${rel} ${res.status}`);
  return res.text();
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
export async function bucketRow(id, fetchImpl = fetch) {
  return memoRow(`b:${id}`, async () => extractRow(await rawText(`buckets/${bucketOf(id)}.json`, fetchImpl), id));
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
