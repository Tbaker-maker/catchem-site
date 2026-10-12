import { buildPokemonPages } from "./pokemon.mjs";

const BASE = "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/research/assets/public/";
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
  pokemonBundle = null;
}

export async function loadJson(rel, fetchImpl = fetch) {
  return cached(rel, async () => {
    const res = await fetchImpl(BASE + rel, { cf: { cacheTtl: 300 } });
    if (!res.ok) throw new Error(`${rel} ${res.status}`);
    return res.json();
  });
}

export async function proxyPublic(rel, fetchImpl = fetch) {
  const res = await fetchImpl(BASE + rel, { cf: { cacheTtl: 300 } });
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

const DIVE_BASE = "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/research/pulse/dive/";

export async function loadDiveIndex(fetchImpl = fetch) {
  return cached("dive:index", async () => {
    const res = await fetchImpl(DIVE_BASE + "index.json", { cf: { cacheTtl: 300 } });
    if (!res.ok) throw new Error(`dive index ${res.status}`);
    return res.json();
  });
}

export async function loadDive(id, fetchImpl = fetch) {
  const key = "dive:" + id;
  const safe = String(id || "").replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safe || safe !== id) throw new Error("bad dive id");
  return cached(key, async () => {
    const res = await fetchImpl(DIVE_BASE + encodeURIComponent(safe) + ".json", { cf: { cacheTtl: 300 } });
    if (!res.ok) throw new Error(`dive ${safe} ${res.status}`);
    return res.json();
  });
}

const CATALOGUE_ROOT = "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/data/";

async function readCatalogue(rel, fetchImpl) {
  const res = await fetchImpl(CATALOGUE_ROOT + rel, { cf: { cacheTtl: 3600 } });
  if (!res.ok) throw new Error(`${rel} ${res.status}`);
  return res.json();
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
