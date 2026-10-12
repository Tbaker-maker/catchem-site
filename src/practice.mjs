// Practice pack: a plain random draw of real singles from one set file.
// data/pull-rates.json has 0 rows, so no rarity weights are used or shown.
import { officialSrc } from "./catalogue-image.mjs";

export const PRACTICE_NOTE = "Typical pack layout. Not real pull rates.";
// Slot layout of a modern booster: filler, one reverse holo slot, one rare-or-better slot last.
export const SLOTS = ["C", "C", "C", "C", "C", "U", "U", "U", "RH", "R"];
// Rare-or-better tiers, lowest first. Only tiers found in the set file are used.
export const TIERS = ["Rare", "Holo Rare", "Rare Holo", "Rare BREAK", "Prism Rare", "Rare Ace", "ACE SPEC Rare", "Radiant Rare", "Amazing Rare", "Shiny Rare", "Shiny Holo Rare", "Double Rare", "Ultra Rare", "Illustration Rare", "Shiny Ultra Rare", "Rainbow Rare", "Black White Rare", "Secret Rare", "Special Illustration Rare", "Hyper Rare", "Mega Attack Rare", "Mega Hyper Rare"];
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

// Builds one pack by slot. Every card comes from the pool. Tier weight halves per step up,
// a layout choice for practice only, never shown as odds.
export function buildPack(pool, seed) {
  const rand = seededRandom(seed);
  const tierOf = (r) => TIERS.indexOf(r);
  const by = (f) => pool.filter(f);
  const com = by((c) => c.rarity === "Common"), unc = by((c) => c.rarity === "Uncommon");
  const rares = by((c) => tierOf(c.rarity) >= 0);
  const filler = by((c) => tierOf(c.rarity) < 0);
  const used = {};
  const pick = (list) => {
    const open = list.filter((c) => !used[c.id]);
    const from = open.length ? open : list;
    if (!from.length) return null;
    const c = from[Math.floor(rand() * from.length)];
    used[c.id] = 1;
    return c;
  };
  const present = TIERS.filter((t) => rares.some((c) => c.rarity === t));
  const out = [];
  for (const slot of SLOTS) {
    let c = null, rh = false;
    if (slot === "C") c = pick(com.length ? com : filler.length ? filler : pool);
    else if (slot === "U") c = pick(unc.length ? unc : filler.length ? filler : pool);
    else if (slot === "RH") {
      const rev = pool.filter((x) => x.rh && tierOf(x.rarity) < 0);
      const r2 = rev.length ? rev : pool.filter((x) => x.rh);
      c = pick(r2.length ? r2 : filler.length ? filler : pool);
      rh = !!(c && c.rh);
    } else {
      if (present.length) {
        let total = 0; const w = present.map((_, i) => (total += Math.pow(0.5, i)));
        const x = rand() * total; const t = present[w.findIndex((v) => x < v)];
        c = pick(rares.filter((r) => r.rarity === t));
      } else c = pick(pool);
    }
    if (!c) continue;
    const price = rh ? c.rh.price : c.price, date = rh ? c.rh.date : c.date;
    out.push({ ...c, slot, rh, price, date, tier: tierOf(c.rarity) });
  }
  let top = -1, topI = -1;
  out.forEach((c, i) => { if (c.price > top) { top = c.price; topI = i; } });
  const hiTier = present.length > 2 ? TIERS.indexOf(present[2]) : 99;
  out.forEach((c, i) => { c.hit = c.tier >= hiTier || (i === topI && top > 0); });
  return out;
}

// Placeholder release dates: one date stamped on 10+ sets is not a release.
export function practiceSets(setsDoc, today) {
  const sets = Array.isArray(setsDoc?.sets) ? setsDoc.sets : [];
  const seen = {};
  for (const s of sets) if (s.release) seen[s.release] = (seen[s.release] || 0) + 1;
  return sets
    .filter((s) => s && s.slug && Number(s.single) >= PACK_SIZE && !/promo|miscellaneous|collection/i.test(String(s.name || "") + " " + s.slug))
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
    const rp = (r.printings || []).find((p) => p && /reverse/i.test(p.name));
    const rh = rp ? { price: Number(rp.price) > 0 ? Number(rp.price) : 0, date: Number(rp.price) > 0 ? String(rp.asOf || setDoc.asOf || "").slice(0, 10) : "" } : null;
    return { id: r.id, name, num: r.num || "", rarity: r.rarity || "", price, date: price ? String(pr.asOf || setDoc.asOf || "").slice(0, 10) : "", src: pic.src || "", alts: pic.alts || [], rh };
  });
}

// The set's single booster pack product, picture by id: catalogue, then TCGplayer photo, then tile.
export function packArt(setDoc, images = {}) {
  const items = Array.isArray(setDoc?.items) ? setDoc.items : [];
  const bp = items.find((r) => r && r.kind === "sealed" && /booster pack/i.test(r.name || "") && !/bundle|blister|display|case|box|lot|\d+\s*(x|booster packs)/i.test(r.name || ""));
  if (!bp) return null;
  const pic = officialSrc({ id: bp.id, kind: "sealed", pid: bp.pid, tcgPlayerId: bp.pid }, images);
  return { id: bp.id, name: String(bp.name || ""), src: pic.src || "", alts: pic.alts || [] };
}
