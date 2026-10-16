// Build-time species strip index (see src/strip-index.mjs). Network or data
// failure writes nothing; the card page then simply shows no strip.
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { buildPokemonPages, nightlyIdsForPage } from "../src/pokemon.mjs";
import { shardOf } from "../src/strip-index.mjs";

const RAW = "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/";

export function buildStripIndex(attrs, catalogue, images, lite) {
  const bundle = buildPokemonPages(attrs?.cards || {}, catalogue?.cards || {});
  const pages = {};
  for (const [slug, page] of Object.entries(bundle.bySlug || {})) {
    const ids = nightlyIdsForPage(page, images || {}, lite || []);
    if (ids.length) pages[slug] = [page.name, ids];
  }
  const cards = {};
  for (const [id, d] of Object.entries(bundle.byId || {})) {
    if (d?.slug && pages[d.slug]) cards[id] = d.slug;
  }
  return { pages, cards };
}

export function writeStripIndex(outDir, { pages, cards }) {
  const root = join(outDir, "strip");
  rmSync(root, { recursive: true, force: true });
  const shard = (obj) => {
    const out = {};
    for (const [k, v] of Object.entries(obj)) (out[shardOf(k)] ||= {})[k] = v;
    return out;
  };
  for (const [kind, obj] of [["c", cards], ["p", pages]]) {
    mkdirSync(join(root, kind), { recursive: true });
    for (const [s, part] of Object.entries(shard(obj))) writeFileSync(join(root, kind, s + ".json"), JSON.stringify(part));
  }
  return { pages: Object.keys(pages).length, cards: Object.keys(cards).length };
}

export async function buildAndWrite(outDir, fetchImpl = fetch) {
  try {
    const get = async (p) => { const r = await fetchImpl(RAW + p); if (!r.ok) throw new Error(p + " " + r.status); return r.json(); };
    const [attrs, catalogue, img, lite] = await Promise.all([
      get("data/card-attrs.json"), get("data/card-catalogue.json"),
      get("research/assets/public/catalogue-images.json"), get("research/assets/public/search-lite.json"),
    ]);
    const images = img && img.images && !Array.isArray(img.images) ? img.images : {};
    const n = writeStripIndex(outDir, buildStripIndex(attrs, catalogue, images, lite));
    console.log(`strip index: ${n.pages} species, ${n.cards} cards`);
    return n;
  } catch (err) {
    console.warn("strip index skipped:", err.message);
    return null;
  }
}
