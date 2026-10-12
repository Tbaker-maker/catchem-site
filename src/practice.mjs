// Practice pack: a plain random draw of real singles from one set file.
// data/pull-rates.json has 0 rows, so no rarity weights are used or shown.
import { officialSrc } from "./catalogue-image.mjs";

export const PRACTICE_NOTE = "Practice draw from the set list. Not real pull rates.";
export const PACK_SIZE = 10;

// mulberry32: same seed, same pack.
export function seededRandom(seed) {
  let a = (Number(seed) >>> 0) || 1;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Draws without repeats. Returns rows from the pool itself, never new ones.
export function drawPack(pool, n, seed) {
  const rand = seededRandom(seed);
  const idx = pool.map((_, i) => i);
  const k = Math.min(n, idx.length);
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(rand() * (idx.length - i));
    const tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp;
  }
  return idx.slice(0, k).map((i) => pool[i]);
}

// Placeholder release dates: one date stamped on 10+ sets is not a release.
export function practiceSets(setsDoc, today) {
  const sets = Array.isArray(setsDoc?.sets) ? setsDoc.sets : [];
  const seen = {};
  for (const s of sets) if (s.release) seen[s.release] = (seen[s.release] || 0) + 1;
  return sets
    .filter((s) => s && s.slug && Number(s.single) >= PACK_SIZE)
    .map((s) => ({ slug: s.slug, name: s.name, release: s.release && seen[s.release] < 10 && s.release <= today ? s.release : "" }))
    .sort((a, b) => (a.release === b.release ? a.name.localeCompare(b.name) : a.release < b.release ? 1 : -1));
}

export function practicePool(setDoc, images = {}) {
  const items = Array.isArray(setDoc?.items) ? setDoc.items : [];
  return items.filter((r) => r && r.kind === "single" && /^tcgcsv-\d+$/.test(String(r.id || ""))).map((r) => {
    const pr = (r.printings || []).find((p) => p && p.name === r.printing) || (r.printings || [])[0] || {};
    const price = Number(r.price) > 0 ? Number(r.price) : 0;
    const pic = officialSrc({ id: r.id, kind: "single", pid: r.pid, tcgPlayerId: r.pid }, images);
    const name = String(r.name || "").replace(new RegExp(" - " + String(r.num || "").replace(/[^0-9A-Za-z/]/g, "") + "$"), "");
    return { id: r.id, name, num: r.num || "", rarity: r.rarity || "", price, date: price ? String(pr.asOf || setDoc.asOf || "").slice(0, 10) : "", src: pic.src || "", alts: pic.alts || [] };
  });
}
