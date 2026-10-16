// Small per-Pokemon lookup for the card page species strip.
//
// The strip used to parse card-catalogue (6.9 MB), card-attrs (1.8 MB),
// search-lite (4.1 MB) and catalogue-images (0.9 MB) on a cold worker, which ran
// past Cloudflare limits (Error 1102). scripts/build-strip-index.mjs now does that
// work at build time and writes tiny shards into the static assets:
//   strip/c/<shard>.json  card id -> species slug
//   strip/p/<shard>.json  slug -> [name, [nightly ids]]
// A request reads one shard of each (a few KB). Prices still come from tonight's data.

export const SHARDS = 64;

export function shardOf(key) {
  let h = 0;
  const s = String(key || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return String(h % SHARDS).padStart(2, "0");
}

let assets = null;
export function setStripAssets(binding) { assets = binding && typeof binding.fetch === "function" ? binding : null; }

const shardMem = new Map();
async function readShard(kind, shard) {
  const key = kind + shard;
  if (shardMem.has(key)) return shardMem.get(key);
  if (!assets) return null;
  let doc = null;
  try {
    const res = await assets.fetch(new Request(`https://assets.local/strip/${kind}/${shard}.json`));
    if (res.ok) doc = await res.json();
  } catch { doc = null; }
  if (shardMem.size > 256) shardMem.clear();
  shardMem.set(key, doc);
  return doc;
}

export async function stripSlugFor(cardId) {
  const doc = await readShard("c", shardOf(cardId));
  return doc && typeof doc[cardId] === "string" ? doc[cardId] : "";
}

export async function stripPageFor(slug) {
  if (!slug) return null;
  const doc = await readShard("p", shardOf(slug));
  const row = doc && doc[slug];
  return Array.isArray(row) ? { name: row[0], slug, ids: Array.isArray(row[1]) ? row[1] : [] } : null;
}

export function resetStripIndex() { shardMem.clear(); }
