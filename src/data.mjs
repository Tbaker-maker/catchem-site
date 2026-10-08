import { buildPokemonPages } from "./pokemon.mjs";

const BASE = "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/research/assets/public/";
const mem = new Map();
let pokemonBundle = null;

export function resetJsonCache() {
  mem.clear();
  pokemonBundle = null;
}

export async function loadJson(rel, fetchImpl = fetch) {
  if (mem.has(rel)) return mem.get(rel);
  const res = await fetchImpl(BASE + rel, { cf: { cacheTtl: 300 } });
  if (!res.ok) throw new Error(`${rel} ${res.status}`);
  const data = await res.json();
  if (mem.size > 24) mem.clear();
  mem.set(rel, data);
  return data;
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
  if (mem.has("dive:index")) return mem.get("dive:index");
  const res = await fetchImpl(DIVE_BASE + "index.json", { cf: { cacheTtl: 300 } });
  if (!res.ok) throw new Error(`dive index ${res.status}`);
  const data = await res.json();
  mem.set("dive:index", data);
  return data;
}

export async function loadDive(id, fetchImpl = fetch) {
  const key = "dive:" + id;
  if (mem.has(key)) return mem.get(key);
  const safe = String(id || "").replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safe || safe !== id) throw new Error("bad dive id");
  const res = await fetchImpl(DIVE_BASE + encodeURIComponent(safe) + ".json", { cf: { cacheTtl: 300 } });
  if (!res.ok) throw new Error(`dive ${safe} ${res.status}`);
  const data = await res.json();
  mem.set(key, data);
  return data;
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
