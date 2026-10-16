// Build-time species strip index (see src/strip-index.mjs). Network or data
// failure writes nothing; the card page then simply shows no strip.
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { buildPokemonPages, nightlyIdsForPage, nightlySpeciesStrip } from "../src/pokemon.mjs";
import { shardOf } from "../src/strip-index.mjs";

const RAW = "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/";

// Nightly quotes for every id, same rules the card page used per request:
// bucket row price and date, sealed rows dropped, facts.json wins when dated.
export function quotesFrom(bucketDocs, facts) {
  const quotes = {};
  const sealed = new Set();
  for (const rows of bucketDocs) for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || !/^tcgcsv-\d+$/.test(String(row.id || ""))) continue;
    if (row.kind === "sealed") { sealed.add(row.id); continue; }
    const price = Number(row.price);
    const date = String(row.asOf || "").slice(0, 10);
    if (price > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date)) quotes[row.id] = { price, date };
  }
  for (const [id, fact] of Object.entries(facts || {})) {
    if (sealed.has(id)) continue;
    const price = Number(fact?.price);
    const date = String(fact?.asOf || "").slice(0, 10);
    if (price > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date)) quotes[id] = { price, date };
  }
  for (const id of sealed) delete quotes[id];
  return quotes;
}

export function buildStripIndex(attrs, catalogue, images, lite, quotes = null) {
  const bundle = buildPokemonPages(attrs?.cards || {}, catalogue?.cards || {});
  const pages = {};
  for (const [slug, page] of Object.entries(bundle.bySlug || {})) {
    const ids = nightlyIdsForPage(page, images || {}, lite || []);
    if (!ids.length) continue;
    // The strip is built here so a card page never fetches dozens of buckets.
    const strip = quotes ? nightlySpeciesStrip({ name: page.name, slug }, quotes, ids) : null;
    pages[slug] = strip ? [page.name, ids, strip] : [page.name, ids];
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
    let quotes = null;
    try {
      const facts = await get("research/assets/public/feed/facts.json").catch(() => ({}));
      const docs = [];
      for (let i = 0; i < 100; i += 10) docs.push(...await Promise.all(Array.from({ length: 10 }, (_, j) => get(`research/assets/public/buckets/${String(i + j).padStart(2, "0")}.json`).catch(() => []))));
      quotes = quotesFrom(docs, facts);
    } catch (err) { console.warn("strip quotes skipped:", err.message); }
    const n = writeStripIndex(outDir, buildStripIndex(attrs, catalogue, images, lite, quotes));
    console.log(`strip index: ${n.pages} species, ${n.cards} cards`);
    return n;
  } catch (err) {
    console.warn("strip index skipped:", err.message);
    return null;
  }
}
