// Custom Reads email article. Built at send time from public dated files:
// movers.json (daily TCGplayer market with history), listings-counted.json
// (eBay listings counted, two days), reads.json (patterns, rotation, news),
// sets.json (release dates), sparks (30 days per product) and price-hold.json.
// Only real dated numbers. Held cards, junk highs and empty sections stay out.
// Copy is short and plain. No dashes. Listings counted, never sales.

import { banGuard } from "./advice-rules.mjs";
import { ebaySearchUrl, tcgStoreUrl, SHOP_NOTE } from "./pokemon.mjs";
import { AFFILIATION, TCGPLAYER_ATTRIBUTION } from "./affiliation.mjs";
import { stageFromChips, stageLine } from "./run-stage.mjs";
import { patternBarsEmail, patternFromGate } from "./pattern-track.mjs";
import { flagForItem, flagWord } from "./premium-ratio.mjs";

const GUARD = banGuard("email article");
export const SITE = "https://catchemtcg.com";
export const LENGTHS = ["glance", "standard", "deep"];
export const WOTC_END = "2003-06-01";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = 86400000;

export function cleanLength(value, premium = true) {
  const v = String(value || "").toLowerCase();
  if (v === "deep") return premium ? "deep" : "standard";
  return v === "glance" ? "glance" : "standard";
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => {
    if (ch === "&") return "&" + "amp;";
    if (ch === "<") return "&" + "lt;";
    if (ch === ">") return "&" + "gt;";
    if (ch === '"') return "&" + "quot;";
    return "&#" + "39;";
  });
}
export function okCopy(text) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (!s) return false;
  if (/[\u2013\u2014]/.test(s)) return false;
  if (/\bsold\b|\bsales?\b/i.test(s)) return false;
  if (/price being checked/i.test(s)) return false;
  if (s.toLowerCase().includes(["no", "data"].join(" "))) return false;
  return !GUARD.test(s);
}
export function day(d) {
  const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? MONTHS[Number(m[2]) - 1] + " " + Number(m[3]) : "";
}
export function money(n) {
  const v = Number(n);
  if (!(v > 0)) return "";
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pct(n) {
  const v = Math.round(Number(n) * 10) / 10;
  return (v > 0 ? "+" : "") + v.toFixed(1) + "%";
}
function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
function pick(pool, seed) { return pool[hash(seed) % pool.length]; }
export function bareSet(name) {
  return String(name || "").toLowerCase().replace(/^[a-z0-9]{1,8}\s*:\s*/, "").replace(/^(sm|xy|swsh|sv|me)\s+-\s+/, "").replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
}
export function cleanName(name) {
  return String(name || "").replace(/\s+-\s+/g, " ").replace(/\s+/g, " ").trim();
}
function imageFor(sku) {
  const m = String(sku || "").match(/^tcgcsv-(\d+)$/);
  return m ? "https://tcgplayer-cdn.tcgplayer.com/product/" + m[1] + "_in_400x400.jpg" : "";
}

// ---------- series analysis ----------

export function unpackSpark(packed, asOf) {
  const end = Date.parse(String(asOf || "").slice(0, 10) + "T00:00:00Z");
  if (!Number.isFinite(end) || !packed) return [];
  const pts = [];
  for (const bit of String(packed).split(",")) {
    const m = bit.match(/^(\d+):(\d+(?:\.\d+)?)$/);
    if (!m) continue;
    pts.push([new Date(end - Number(m[1]) * DAY).toISOString().slice(0, 10), Number(m[2])]);
  }
  return pts.sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

// Junk highs (placeholder asks like $99,999) and thin files are flagged.
export function analyze(hist) {
  const pts = (Array.isArray(hist) ? hist : []).filter((p) => Array.isArray(p) && /^\d{4}-\d{2}-\d{2}$/.test(String(p[0])) && Number(p[1]) > 0).map((p) => [String(p[0]), Number(p[1])]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  if (pts.length < 2) return null;
  const vals = pts.map((p) => p[1]);
  const sorted = [...vals].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  if (sorted[sorted.length - 1] >= 50000 || sorted[sorted.length - 1] > median * 8 || sorted[0] < median / 8) return { junk: true };
  const last = pts[pts.length - 1];
  const endMs = Date.parse(last[0] + "T00:00:00Z");
  let start = pts[0];
  for (const p of pts) if (Date.parse(p[0] + "T00:00:00Z") <= endMs - 7 * DAY) start = p;
  const change = ((last[1] - start[1]) / start[1]) * 100;
  const steps = [];
  for (let i = 1; i < pts.length; i++) steps.push([pts[i - 1], pts[i], ((pts[i][1] - pts[i - 1][1]) / pts[i - 1][1]) * 100]);
  const moving = steps.filter((s) => Math.abs(s[2]) >= 0.5);
  let streak = 0;
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = Math.sign(steps[i][2]);
    if (!s || (streak && Math.sign(streak) !== s)) break;
    streak += s;
  }
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const peakAt = pts[vals.lastIndexOf(max)];
  const lastStep = steps[steps.length - 1];
  const big = [...steps].sort((a, b) => Math.abs(b[2]) - Math.abs(a[2]))[0];
  const total = vals[vals.length - 1] - vals[0];
  const jumpShare = total ? (big[1][1] - big[0][1]) / total : 0;
  // A single step of 100% or more is not trusted to lead; it gets quiet wording.
  const thin = pts.length < 5 || moving.length <= 1 || Math.abs(big[2]) >= 100;
  // Run stage is not worked out here. buildPool takes it from signal-chips.json.
  const stage = "";
  return {
    pts, first: pts[0], last, start, change, streak, max, min, peakAt, lastStep, big, jumpShare, thin, stage,
    isHigh: last[1] >= max && pts.length >= 8 && change > 0,
    isLow: last[1] <= min && pts.length >= 8 && change < 0,
    days: Math.round((endMs - Date.parse(pts[0][0] + "T00:00:00Z")) / DAY),
  };
}

// A short line that says why it matters. Plain words, every number dated.
export function storyFor(item) {
  const a = item.a;
  const n = item.name;
  const s = item.id;
  const from = money(a.start[1]) + " on " + day(a.start[0]);
  const to = money(a.last[1]) + " on " + day(a.last[0]);
  if (a.thin) return pick([`${n} moved from ${from} to ${to}. That is a single step on a thin file, so treat it lightly.`, `Only a few days on file for ${n}: ${from} to ${to}.`], s);
  const peakIdx = a.pts.indexOf(a.peakAt);
  if (a.change < 0 && peakIdx > 1 && peakIdx < a.pts.length - 1 && a.peakAt[1] > a.first[1] * 1.05) {
    return pick([
      `${n} climbed to ${money(a.peakAt[1])} on ${day(a.peakAt[0])}, then turned. It is ${to} now.`,
      `After a climb to ${money(a.peakAt[1])} (${day(a.peakAt[0])}), ${n} turned down to ${to}.`,
    ], s);
  }
  if (Math.abs(a.jumpShare) > 0.7 && Math.abs(a.big[2]) >= 8 && a.big[1][0] !== a.last[0]) {
    return pick([
      `One jump did most of the work: ${money(a.big[0][1])} to ${money(a.big[1][1])} on ${day(a.big[1][0])}. It has stayed near there since.`,
      `${n} made one big step on ${day(a.big[1][0])}, ${money(a.big[0][1])} to ${money(a.big[1][1])}, then went flat.`,
    ], s);
  }
  if (a.isHigh) return pick([`${n} is at its highest in our ${a.days} days on file: ${to}.`, `New high for ${n} in the last ${a.days} days on file, ${to}.`], s);
  if (a.isLow) return pick([`${n} is at its lowest in our ${a.days} days on file: ${to}.`, `New low for ${n} in the last ${a.days} days on file, ${to}.`], s);
  if (Math.abs(a.streak) >= 3) return pick([`${a.streak > 0 ? "Up" : "Down"} ${Math.abs(a.streak)} price days in a row, now ${to}.`, `${n} has ${a.streak > 0 ? "risen" : "slipped"} ${Math.abs(a.streak)} price days running, to ${to}.`], s);
  return pick([`${n} went from ${from} to ${to}.`, `${from}, then ${to}. That is the move for ${n}.`, `${n} is ${to}, from ${from}.`], s);
}

// ---------- pool ----------

// Rarities and eras a member can pick on /reads. Era comes from sets.json.
export const CHASE_RARITIES = ["Special Illustration Rare", "Illustration Rare", "Ultra Rare"];
export function eraLabel(era) { return String(era || "").replace(/\s*&\s*/g, " and ").trim(); }
export const GENERATION_LABEL = { ME: "Mega Evolution" };
export function generationName(g) { return GENERATION_LABEL[g] || (g ? "Generation " + g : ""); }

function setIndex(setsDoc) {
  const bySlug = new Map();
  const byBare = new Map();
  for (const s of setsDoc?.sets || []) {
    if (!s?.name) continue;
    if (s.slug) bySlug.set(s.slug, s);
    byBare.set(bareSet(s.name), s);
  }
  return { bySlug, byBare };
}

export function buildPool(ctx) {
  const hold = ctx.holdIds || {};
  const stale = new Set((ctx.reads?.priceStaleIds || []).map(String));
  const sets = setIndex(ctx.sets);
  const seen = new Map();
  const add = (row) => {
    if (!row.id || seen.has(row.id) || hold[row.id]) return;
    if (!okCopy(row.name)) return;
    const a = analyze(row.hist);
    if (!a || a.junk) return;
    const st = stageFromChips(ctx.chips, row.id);
    a.stage = st?.word || "";
    a.stageInfo = st;
    const home = sets.byBare.get(bareSet(row.set));
    const release = String(home?.release || "");
    const tag = ctx.tags?.byId?.[row.id] || {};
    const rarity = row.kind === "single" ? String(tag.rarity || row.rarity || "") : "";
    const premiumFlag = flagForItem({ id: row.id, set: row.set, kind: row.kind === "sealed" ? "sealed" : "single", href: row.href }, ctx.premium);
    seen.set(row.id, { ...row, name: cleanName(row.name), a, release, vintage: !!release && release < WOTC_END, image: imageFor(row.id), rarity, era: eraLabel(home?.era), artist: row.kind === "single" ? String(tag.artist || "") : "", artistSlug: row.kind === "single" ? String(tag.artistSlug || "") : "", generation: row.kind === "single" ? String(tag.generation || "") : "", premiumFlag });
  };
  for (const kind of ["singles", "sealed"]) {
    for (const m of ctx.movers?.[kind] || []) {
      const id = (String(m.id || "").match(/tcgcsv-\d+/) || [])[0] || "";
      add({ id, name: m.name, set: m.set, kind: kind === "sealed" ? "sealed" : "single", hist: m.hist, href: SITE + (m.href || "/c/" + id) });
    }
  }
  for (const r of ctx.reads?.reads || []) {
    const rTags = (r.tags || []).map(String);
    if (!/^tcgcsv-\d+$/.test(String(r.sku || "")) || stale.has(String(r.id)) || r.stale) continue;
    // Only daily price charts. Ratios, year ago and range charts are not prices.
    if (r.chart?.label && !/^TCGplayer market/.test(String(r.chart.label))) continue;
    const pts = (r.chart?.points || []).filter((p) => Date.parse(p[0] + "T00:00:00Z") >= Date.parse((ctx.reads?.asOf || "") + "T00:00:00Z") - 35 * DAY);
    const setName = (String(r.name || "").match(/\(([^)]+)\)\s*[\w/]*$/) || [])[1] || "";
    add({ id: r.sku, name: r.name, set: setName, kind: "single", rarity: CHASE_RARITIES.find((x) => rTags.includes(x)) || "", hist: pts, href: SITE + "/feed/r/" + encodeURIComponent(r.id) });
  }
  for (const w of ctx.watched || []) add(w);
  return [...seen.values()];
}

export function supplyRows(ctx) {
  const out = [];
  for (const p of ctx.listings?.products || []) {
    const c = p?.listingsCounted;
    if (!c || !c.prev || !(c.n >= 0) || !(c.prev.n >= 0)) continue;
    const hi = Math.max(c.n, c.prev.n);
    if (hi < 5 || c.n === c.prev.n) continue;
    const change = c.prev.n ? ((c.n - c.prev.n) / c.prev.n) * 100 : 100;
    if (Math.abs(change) < 15) continue;
    out.push({ id: p.id, name: cleanName(p.name), n: c.n, prev: c.prev.n, date: c.date, prevDate: c.prev.date, change, word: c.n < c.prev.n ? "Draining" : "Stacking" });
  }
  return out.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}

// ---------- pathways ----------

function words(s) { return String(s || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean); }

export function pathwayOf(follow) {
  const f = follow || {};
  if ((f.cards || []).length || (f.sealed || []).length) return "watchlist";
  if (f.focus === "vintage") return "vintage";
  if ((f.artists || []).length) return "artist";
  if ((f.generations || []).length) return "generation";
  if ((f.pokemon || []).length) return "pokemon";
  if ((f.sets || []).length) return "set";
  if (f.product === "sealed" && !(f.sets || []).length) return "sealed";
  if ((f.rarities || []).length || (f.eras || []).length) return "picks";
  return "default";
}

// Saved rarity and era picks narrow every pathway except the watchlist.
// Picking a rarity means singles only, since sealed has no rarity.
export function picksTest(follow) {
  const f = follow || {};
  const rar = (f.rarities || []).map(String);
  const eras = (f.eras || []).map(String);
  if (!rar.length && !eras.length) return null;
  return (i) => (!rar.length || (i.kind === "single" && rar.includes(i.rarity))) && (!eras.length || eras.includes(i.era));
}
export function picksLabel(follow) {
  const f = follow || {};
  const short = { "Special Illustration Rare": "Special Illustration Rares", "Illustration Rare": "Illustration Rares", "Ultra Rare": "Ultra Rares" };
  return [...(f.rarities || []).map((r) => short[r] || r), ...(f.eras || [])].join(", ");
}

export function pathwayFilter(path, follow, ctx) {
  const base = pathwayBase(path, follow, ctx);
  const picks = path === "watchlist" ? null : picksTest(follow);
  if (!picks) return base;
  const extra = path === "picks" || path === "default" ? "" : picksLabel(follow);
  return { ...base, test: (i) => base.test(i) && picks(i), label: extra ? `${base.label}, ${extra}` : base.label };
}

function pathwayBase(path, follow, ctx) {
  const f = follow || {};
  const sets = setIndex(ctx.sets);
  if (path === "artist") {
    const want = new Set((f.artists || []).map((a) => String(a).toLowerCase()));
    const names = artistNames(f.artists, ctx);
    return { test: (i) => !!i.artistSlug && want.has(i.artistSlug), label: "Art by " + names.join(", "), intro: `Cards illustrated by ${names.join(" and ")} that moved, from any set.` };
  }
  if (path === "generation") {
    const want = new Set((f.generations || []).map(String));
    const names = (f.generations || []).map(generationName);
    return { test: (i) => i.kind === "single" && want.has(i.generation), label: names.join(", "), intro: `Singles from ${names.join(" and ")} that moved.` };
  }
  if (path === "picks") return { test: () => true, label: picksLabel(f), intro: `Only the ${picksLabel(f).replace(/, ([^,]*)$/, " and $1")} you picked.` };
  if (path === "watchlist") { const ids = new Set([...(f.cards || []), ...(f.sealed || [])]); return { test: (i) => ids.has(i.id), label: "Your watchlist", intro: "Here is how the items you watch moved." }; }
  if (path === "vintage") return { test: (i) => i.vintage, label: "Vintage, WOTC era", intro: "Cards from the Wizards of the Coast era, before mid 2003." };
  if (path === "pokemon") { const want = (f.pokemon || []).map((p) => String(p).toLowerCase()); return { test: (i) => want.some((w) => words(i.name).includes(w)), label: (f.pokemon || []).join(", "), intro: `Every ${(f.pokemon || []).join(" and ")} card that moved, from any set.` }; }
  if (path === "set") {
    const names = (f.sets || []).map((s) => sets.bySlug.get(s)?.name || s);
    const bare = new Set(names.map(bareSet));
    return { test: (i) => bare.has(bareSet(i.set)), label: names.join(", "), intro: `Inside ${names.join(" and ")} today.` };
  }
  if (path === "sealed") return { test: (i) => i.kind === "sealed", label: "Sealed", intro: "Boxes, tins and bundles that moved." };
  return { test: () => true, label: "A bit of everything", intro: "Top moves across singles and sealed, plus listings counted." };
}

function artistNames(slugs, ctx) {
  const byId = ctx?.tags?.byId || {};
  const names = new Map();
  for (const row of Object.values(byId)) if (row?.artistSlug && !names.has(row.artistSlug)) names.set(row.artistSlug, row.artist);
  return (slugs || []).map((s) => names.get(String(s).toLowerCase()) || String(s));
}

// Artists with enough tagged cards to fill a read, most cards first.
export function artistChoices(tags, min = 8) {
  const count = new Map();
  for (const row of Object.values(tags?.byId || {})) {
    if (!row?.artistSlug) continue;
    const c = count.get(row.artistSlug) || { slug: row.artistSlug, name: row.artist, n: 0 };
    c.n++; count.set(row.artistSlug, c);
  }
  return [...count.values()].filter((c) => c.n >= min).sort((a, b) => b.n - a.n || (a.name < b.name ? -1 : 1));
}

// ---------- the article ----------

export function buildArticle({ follow = {}, ctx = {}, asOf = "", length = "standard", history = {} } = {}) {
  const pool = buildPool(ctx);
  const supplyAll = supplyRows(ctx);
  let path = pathwayOf(follow);
  let filter = pathwayFilter(path, follow, ctx);
  let mine = pool.filter(filter.test);
  let fallback = "";
  if (path !== "default" && mine.filter((i) => !i.a.thin).length < 2) {
    fallback = `${filter.label} had a quiet day, so here is a bit of everything.`;
    path = "default";
    filter = pathwayFilter("default", follow, ctx);
    mine = pool;
    const picks = picksTest(follow);
    const narrow = picks ? pool.filter(picks) : [];
    if (picks && narrow.filter((i) => !i.a.thin).length >= 2 && pathwayOf(follow) !== "picks") {
      fallback = `${pathwayBase(pathwayOf(follow), follow, ctx).label} had a quiet day, so here are all your ${picksLabel(follow)}.`;
      path = "picks";
      filter = pathwayFilter("picks", follow, ctx);
      mine = narrow;
    }
  }
  const want = follow.premiumRatio === "below" || follow.premiumRatio === "above" ? follow.premiumRatio : "";
  let reportPool = pool;
  if (want) {
    const keep = (i) => i.premiumFlag === want;
    mine = mine.filter(keep);
    reportPool = pool.filter(keep);
  }
  const strong = (i) => (i.a.thin ? 0.25 : 1) * Math.abs(i.a.change);
  const ranked = [...mine].sort((x, y) => strong(y) - strong(x));
  const top = ranked.find((i) => !i.a.thin) || ranked[0];
  if (!top) {
    if (!want) return null;
    const report = watchReport(follow, reportPool, history.sinceDay, asOf || ctx.asOf);
    const empty = {
      asOf, length, path, label: filter.label, intro: "", fallback: "",
      lead: report ? "Your watchlist." : "No reads match this premium filter today.",
      emptyPremium: true, top: null, ups: [], downs: [], supply: [], tiles: [],
      vintage: null, pattern: null, rotation: null, news: null, setCompare: [],
      report, away: null, quiet: true, building: [],
    };
    return empty;
  }
  // Solid moves first. A thin or single step move only fills an empty slot.
  const side = (dir) => {
    const list = ranked.filter((i) => i !== top && (dir > 0 ? i.a.change > 0.5 : i.a.change < -0.5));
    return [...list.filter((i) => !i.a.thin), ...list.filter((i) => i.a.thin)].slice(0, 3);
  };
  const ups = side(1);
  const downs = side(-1);
  const supplyTest = path === "default" || path === "sealed" ? () => true : (row) => mine.some((i) => i.kind === "sealed" && bareSet(i.name) === bareSet(row.name)) || (path === "set" && filter.label.split(", ").some((n) => bareSet(row.name).includes(bareSet(n))));
  const supply = supplyAll.filter(supplyTest).slice(0, 3);
  const up = mine.filter((i) => i.a.change > 0.5).length;
  const down = mine.filter((i) => i.a.change < -0.5).length;
  const draining = supplyAll.filter((r) => r.word === "Draining" && supplyTest(r)).length;
  const readsAll = ctx.reads?.reads || [];
  const tie = (text) => path === "default" || (filter.label || "").split(", ").some((n) => n && String(text).toLowerCase().includes(String(n).toLowerCase().replace(/^[a-z0-9]{1,8}:\s*/, "")));
  const patternRead = readsAll.find((r) => /^pattern-/.test(String(r.readKind)) && okCopy(r.headline) && tie(r.headline) && !(ctx.holdIds || {})[r.sku]);
  const rotationRead = (path === "default" || path === "set") ? readsAll.find((r) => r.readKind === "rotation" && okCopy(r.headline) && tie(r.headline)) : null;
  const newsRead = readsAll.find((r) => r.readKind === "newsline" && okCopy(r.headline) && /^https:\/\//.test(String(r.href || "")) && tie(r.headline));
  const vintage = path === "default" && !picksTest(follow) ? reportPool.filter((i) => i.vintage && !i.a.thin && i !== top).sort((x, y) => strong(y) - strong(x))[0] : null;
  // Deep dive: set comparison across the sets in this read.
  const bySet = new Map();
  for (const i of mine) {
    if (!i.set) continue;
    const row = bySet.get(i.set) || { set: i.set, up: 0, down: 0, n: 0 };
    row.n++; if (i.a.change > 0.5) row.up++; else if (i.a.change < -0.5) row.down++;
    bySet.set(i.set, row);
  }
  const setCompare = [...bySet.values()].filter((r) => r.n >= 2).sort((a, b) => b.n - a.n).slice(0, 4);
  const lead = (top.a.change > 0 ? pick([`${top.name} rose ${pct(top.a.change).slice(1)}, the biggest move in your read.`, `${top.name} led your read, up ${pct(top.a.change).slice(1)}.`], top.id) : pick([`${top.name} fell ${pct(top.a.change).slice(1)}, the biggest move in your read.`, `${top.name} led your read, down ${pct(top.a.change).slice(1)}.`], top.id));
  const doc = {
    asOf, length, path, label: filter.label, intro: filter.intro, fallback,
    lead, top: { ...top, story: storyFor(top) },
    tiles: mine.length >= 3 ? [{ n: up, t: "went up" }, { n: down, t: "went down" }, ...(supply.length || draining ? [{ n: draining, t: "listings draining" }] : [{ n: mine.length, t: "on file" }])] : [],
    ups: ups.map((i) => ({ ...i, story: storyFor(i) })),
    downs: downs.map((i) => ({ ...i, story: storyFor(i) })),
    supply, vintage: vintage ? { ...vintage, story: storyFor(vintage) } : null,
    pattern: patternEmail(patternRead),
    rotation: rotationRead ? { text: rotationRead.headline, asOf: rotationRead.asOf } : null,
    news: newsRead ? { text: newsRead.headline, href: newsRead.href, source: String(newsRead.source || "").split(",")[0] } : null,
    setCompare,
  };
  // Phase 2. Each part hides when it has nothing real to show.
  doc.report = watchReport(follow, reportPool, history.sinceDay, asOf || ctx.asOf);
  doc.away = history.awaySince ? catchUp(reportPool, history.awaySince, top.id) : null;
  doc.quiet = isQuiet(mine, supply);
  doc.building = doc.quiet && length !== "glance" ? buildingQuietly(mine) : [];
  return doc;
}

// ---------- markup (email safe: tables, inline styles, no SVG) ----------

const C = { page: "#f2f2f7", card: "#ffffff", ink: "#1c1c1e", dim: "#636366", soft: "#8e8e93", tile: "#f8f8fa", line: "#f2f2f7", up: "#1f8a3b", upBg: "#e3f6e8", dn: "#c4362c", dnBg: "#fde8e7" };
const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Arial,sans-serif";

function pill(change) {
  const up = change > 0;
  return `<span class="${up ? "ce-up" : "ce-dn"}" style="display:inline-block;border-radius:999px;padding:3px 10px;font:600 13px/1.4 ${FONT};background:${up ? C.upBg : C.dnBg};color:${up ? C.up : C.dn};white-space:nowrap">${esc(pct(change))}</span>`;
}

const PREM = { below: { fg: "#0d6b32", bg: "#e5f6ea" }, above: { fg: "#6b4e00", bg: "#fff4cc" } };
export function premiumPill(flag) {
  const word = flagWord(flag);
  if (!word) return "";
  const tone = PREM[flag];
  const cls = flag === "below" ? "ce-prem-below" : "ce-prem-above";
  return `<span class="${cls}" style="display:inline-block;margin-top:6px;border-radius:999px;padding:3px 10px;font:600 12px/1.4 ${FONT};background:${tone.bg};color:${tone.fg}">${esc(word)}</span>`;
}

// A small bar chart built from table cells, since Gmail drops SVG.
export function barChart(a, { height = 64 } = {}) {
  const pts = a.pts.slice(-24);
  const vals = pts.map((p) => p[1]);
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const color = a.change >= 0 ? C.up : C.dn;
  const cells = pts.map((p, i) => {
    const h = Math.max(4, Math.round(6 + ((p[1] - lo) / span) * (height - 6)));
    const tone = i === pts.length - 1 ? color : a.change >= 0 ? "#a8dcb6" : "#f1b3ae";
    return `<td valign="bottom" style="padding:0 1px"><div style="height:${h}px;background:${tone};border-radius:3px 3px 0 0;font-size:0;line-height:0">&nbsp;</div></td>`;
  }).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="ce-tile" bgcolor="${C.tile}" style="background:${C.tile};border-radius:16px;margin-top:12px"><tr><td style="padding:10px 10px 6px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed;height:${height}px"><tr>${cells}</tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="ce-soft" style="font:400 10px/1.6 ${FONT};color:${C.soft}">${esc(day(pts[0][0]) + " " + money(pts[0][1]))}</td><td align="right" class="ce-soft" style="font:400 10px/1.6 ${FONT};color:${C.soft}">${esc(day(pts[pts.length - 1][0]) + " " + money(pts[pts.length - 1][1]))}</td></tr></table></td></tr></table>`;
}

function card(inner, id = "") {
  return `<tr><td style="padding:0 0 12px"${id ? ` id="${esc(id)}"` : ""}><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="ce-card" bgcolor="${C.card}" style="background:${C.card};border-radius:22px"><tr><td style="padding:18px">${inner}</td></tr></table></td></tr>`;
}
function h2(t) { return `<p class="ce-soft" style="margin:0 0 12px;font:600 13px/1 ${FONT};letter-spacing:.04em;text-transform:uppercase;color:${C.soft}">${esc(t)}</p>`; }
function para(t, extra = "") { return `<p class="ce-dim" style="margin:10px 0 0;font:400 15px/1.5 ${FONT};color:${C.dim}${extra}">${esc(t)}</p>`; }
function meta(i) { return `${i.set ? i.set + " · " : ""}${money(i.a.start[1])} ${day(i.a.start[0])} to ${money(i.a.last[1])} ${day(i.a.last[0])}`; }

function row(i, { more = "", deep = false } = {}) {
  const img = i.image ? `<td width="52" valign="top" style="padding-right:12px"><img src="${esc(i.image)}" width="52" height="72" alt="" class="ce-img" style="display:block;width:52px;height:72px;object-fit:cover;border-radius:10px;background:${C.line}"></td>` : "";
  const extra = deep && i.a.stageInfo ? ` · Run stage: ${i.a.stage} ${i.a.stageInfo.dir === "down" ? "▼" : "▲"}` : "";
  const moreLink = more ? `<br><a href="${esc(more)}" class="ce-ink" style="color:${C.ink};font-weight:600;text-decoration:underline;display:inline-block;min-height:24px">Read more</a>` : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="ce-line" style="border-top:1px solid ${C.line}"><tr>${img}<td valign="middle" style="padding:8px 0">
<a href="${esc(i.href)}" class="ce-ink" style="text-decoration:none;color:${C.ink};font:600 15px/1.25 ${FONT}">${esc(i.name)}</a>
<p class="ce-dim" style="margin:2px 0 0;font:400 13px/1.35 ${FONT};color:${C.dim}">${esc(meta(i) + extra)}</p>
<p class="ce-dim" style="margin:2px 0 0;font:400 13px/1.35 ${FONT};color:${C.dim}">${esc(i.story)}${moreLink}</p>
${premiumPill(i.premiumFlag)}
${deep ? barChart(i.a, { height: 36 }) : ""}
</td><td width="76" align="right" valign="middle" style="padding-left:8px">${pill(i.a.change)}</td></tr></table>`;
}

function shopButtons(i) {
  const tcg = tcgStoreUrl({ id: i.id });
  const ebay = ebaySearchUrl({ name: i.name, set: i.set, kind: i.kind === "sealed" ? "sealed" : "single" });
  const b = (href, label, dark) => `<td style="padding:0 8px 0 0"><a href="${esc(href)}" target="_blank" rel="sponsored noopener" class="${dark ? "ce-btn-dark" : "ce-btn-light"}" style="display:inline-block;min-height:44px;line-height:44px;padding:0 16px;border-radius:999px;background:${dark ? C.ink : C.card};border:1px solid ${dark ? C.ink : "#d1d1d6"};color:${dark ? "#ffffff" : C.ink};font:600 14px/44px ${FONT};text-decoration:none;white-space:nowrap">${esc(label)}</a></td>`;
  const bits = [tcg ? b(tcg, "Buy on TCGplayer", true) : "", ebay ? b(ebay, "Buy on eBay", false) : ""].join("");
  return bits ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px"><tr>${bits}</tr></table>` : "";
}

function supplyRow(r) {
  const up = r.word === "Stacking";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="ce-line" style="border-top:1px solid ${C.line}"><tr><td style="padding:8px 0"><span class="ce-ink" style="font:600 15px/1.25 ${FONT};color:${C.ink}">${esc(r.name)}</span>
<p class="ce-dim" style="margin:2px 0 0;font:400 13px/1.35 ${FONT};color:${C.dim}">${esc(`${r.word}: ${r.prev} to ${r.n} listings counted, ${day(r.prevDate)} to ${day(r.date)}.`)}</p></td><td width="76" align="right" style="padding-left:8px"><span style="display:inline-block;border-radius:999px;padding:3px 10px;font:600 13px/1.4 ${FONT};background:${C.tile};color:${C.dim};white-space:nowrap" class="ce-dim ce-tile">${esc(pct(r.change))}</span></td></tr></table>`;
}

function tilesHtml(tiles) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${tiles.map((t) => `<td width="33%" style="padding:0 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="ce-tile" bgcolor="${C.tile}" style="background:${C.tile};border-radius:14px"><tr><td align="center" style="padding:10px 4px"><b class="ce-ink" style="display:block;font:700 20px/1.2 ${FONT};color:${C.ink}">${esc(t.n)}</b><span class="ce-soft" style="font:400 12px/1.3 ${FONT};color:${C.soft}">${esc(t.t)}</span></td></tr></table></td>`).join("")}</tr></table>`;
}

// Brand dark look (catchemtcg.com): used when the reader's app is in dark mode.
// Same rules go under prefers-color-scheme and Outlook's [data-ogsc]/[data-ogsb] hooks.
export const DARK = { page: "#12100e", card: "#1a1815", tile: "#211e1a", ink: "#efe9de", dim: "#cfc6b6", soft: "#a89f90", gold: "#d9b779", goldInk: "#1a1407", line: "#2c2823", up: "#7fd99a", upBg: "#123d22", dn: "#ff9a90", dnBg: "#4a1714", premBelow: "#8ee0a8", premBelowBg: "#123d22", premAbove: "#f6dc86", premAboveBg: "#3a2f0c" };
function darkRules(t, b) {
  const D = DARK;
  return [
    `${b}.ce-page{background:${D.page} !important}`, `${b}.ce-card{background:${D.card} !important}`, `${b}.ce-tile{background:${D.tile} !important}`,
    `${t}.ce-ink{color:${D.ink} !important}`, `${t}.ce-dim{color:${D.dim} !important}`, `${t}.ce-soft,${t}.ce-soft a{color:${D.soft} !important}`, `${t}.ce-brand{color:${D.gold} !important}`,
    `${b}.ce-up{background:${D.upBg} !important}`, `${t}.ce-up{color:${D.up} !important}`, `${b}.ce-dn{background:${D.dnBg} !important}`, `${t}.ce-dn{color:${D.dn} !important}`,
    `${b}.ce-prem-below{background:${D.premBelowBg} !important}`, `${t}.ce-prem-below{color:${D.premBelow} !important}`,
    `${b}.ce-prem-above{background:${D.premAboveBg} !important}`, `${t}.ce-prem-above{color:${D.premAbove} !important}`,
    `${b}.ce-btn-dark{background:${D.gold} !important;border-color:${D.gold} !important}`, `${t}.ce-btn-dark{color:${D.goldInk} !important}`,
    `${b}.ce-btn-light{background:${D.card} !important;border-color:${D.gold} !important}`, `${t}.ce-btn-light{color:${D.ink} !important}`,
    `${b}.ce-line{border-color:${D.line} !important}`, `${b}.ce-img{background:${D.tile} !important}`,
  ].join("");
}
export function darkCss() {
  return `@media (prefers-color-scheme: dark){${darkRules("", "")}}\n${darkRules("[data-ogsc] ", "[data-ogsb] ")}`;
}

function shell(title, preheader, body, footer) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${esc(title)}</title>
<style>:root{color-scheme:light dark;supported-color-schemes:light dark}
${darkCss()}</style></head>
<body class="ce-page" style="margin:0;padding:0;background:${C.page}"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="ce-page" bgcolor="${C.page}" style="background:${C.page}"><tr><td align="center" style="padding:16px 14px 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:420px">${body}
<tr><td class="ce-soft" style="padding:8px 10px;text-align:center;font:400 11px/1.5 ${FONT};color:${C.soft}">${footer}</td></tr></table></td></tr></table></body></html>`;
}

// A dated move row for the report card and catch up: from, to, pill.
function windowRow(r) {
  const img = r.image ? `<td width="44" valign="top" style="padding-right:12px"><img src="${esc(r.image)}" width="44" height="60" alt="" class="ce-img" style="display:block;width:44px;height:60px;object-fit:cover;border-radius:10px;background:${C.line}"></td>` : "";
  const flat = Math.abs(r.change) < 0.5;
  const tag = flat
    ? `<span class="ce-dim ce-tile" style="display:inline-block;border-radius:999px;padding:3px 10px;font:600 13px/1.4 ${FONT};background:${C.tile};color:${C.dim};white-space:nowrap">Flat</span>`
    : pill(r.change);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="ce-line" style="border-top:1px solid ${C.line}"><tr>${img}<td valign="middle" style="padding:8px 0">
<a href="${esc(r.href)}" class="ce-ink" style="text-decoration:none;color:${C.ink};font:600 15px/1.25 ${FONT}">${esc(r.name)}</a>
<p class="ce-dim" style="margin:2px 0 0;font:400 13px/1.35 ${FONT};color:${C.dim}">${esc(`${money(r.from[1])} on ${day(r.from[0])} to ${money(r.to[1])} on ${day(r.to[0])}`)}</p>
${premiumPill(r.premiumFlag)}
</td><td width="76" align="right" valign="middle" style="padding-left:8px">${tag}</td></tr></table>`;
}


function patternEmail(patternRead) {
  if (!patternRead) return null;
  const href = SITE + (String(patternRead.href || "/feed").startsWith("/") ? patternRead.href : "/feed");
  const asOf = patternRead.asOf;
  const copy = patternFromGate(patternRead.receipt && patternRead.receipt.gate);
  if (!copy) return { text: patternRead.headline, href, asOf };
  return { text: copy.lead, small: copy.small, bars: patternBarsEmail(copy), href, asOf };
}

function reportCard(rep, L) {
  const head = rep.firstRead ? `Your watchlist since ${day(rep.since)}` : `Your watchlist since your last read, ${day(rep.since)}`;
  const up = rep.rows.filter((r) => r.change >= 0.5).length;
  const down = rep.rows.filter((r) => r.change <= -0.5).length;
  const flat = rep.rows.length - up - down;
  const sum = [up ? `${up} up` : "", down ? `${down} down` : "", flat ? `${flat} flat` : ""].filter(Boolean).join(", ");
  const rows = L === "glance" ? rep.rows.slice(0, 3) : rep.rows;
  return card(h2("Watchlist report card") + `<p class="ce-ink" style="margin:0 0 6px;font:600 15px/1.35 ${FONT};color:${C.ink}">${esc(head)}</p><p class="ce-soft" style="margin:0 0 8px;font:400 13px/1.4 ${FONT};color:${C.soft}">${esc(sum)}. TCGplayer market on the dates shown.</p>` + rows.map(windowRow).join(""), "report-card");
}

function awayCard(away) {
  return card(h2("While you were away") + para(`The three biggest moves since ${day(away.since)}, on TCGplayer market.`, ";margin-top:0;font-size:13px") + away.rows.map(windowRow).join(""), "away");
}

function buildingCard(rows) {
  return card(h2("What's building quietly") + para("A quiet day. These are slow, steady moves that are easy to miss.", ";margin-top:0;font-size:13px") + rows.map((r) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="ce-line" style="border-top:1px solid ${C.line}"><tr>${r.image ? `<td width="44" valign="top" style="padding-right:12px"><img src="${esc(r.image)}" width="44" height="60" alt="" class="ce-img" style="display:block;width:44px;height:60px;object-fit:cover;border-radius:10px;background:${C.line}"></td>` : ""}<td valign="middle" style="padding:8px 0"><a href="${esc(r.href)}" class="ce-ink" style="text-decoration:none;color:${C.ink};font:600 15px/1.25 ${FONT}">${esc(r.name)}</a><p class="ce-dim" style="margin:2px 0 0;font:400 13px/1.35 ${FONT};color:${C.dim}">${esc(r.line)}</p>${premiumPill(r.premiumFlag)}</td><td width="76" align="right" valign="middle" style="padding-left:8px">${pill(r.change)}</td></tr></table>`).join(""), "building");
}

const LENGTH_NAME = { glance: "Glance", standard: "Daily read", deep: "Deep dive" };

export function renderArticle(doc, { unsubscribe = "", manage = SITE + "/reads", more = "", page = false, suggest = null } = {}) {
  const L = doc.length;
  const when = day(doc.asOf);
  if (doc.emptyPremium) {
    const body = [];
    body.push(`<tr><td style="padding:4px 6px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="ce-ink ce-brand" style="font:700 15px/1 ${FONT};color:${C.ink}">Catch'em</td><td align="right" class="ce-soft" style="font:400 13px/1 ${FONT};color:${C.soft}">${esc(when)}</td></tr></table></td></tr>`);
    if (doc.report) body.push(reportCard(doc.report, L));
    else body.push(card(`<p class="ce-ink" style="margin:0;font:600 16px/1.45 ${FONT};color:${C.ink}">No reads match this premium filter today.</p>`));
    const footer = [
      "Prices are TCGplayer market on the dates shown. Listings counted are eBay listings on the dates shown. A listing is not a sale.",
      SHOP_NOTE,
      page ? "" : `You follow this read. <a href="${esc(manage)}" style="color:${C.soft}">Change what you follow</a>${unsubscribe ? ` or <a href="${esc(unsubscribe)}" style="color:${C.soft}">unsubscribe</a>` : ""}.`,
      AFFILIATION + " " + TCGPLAYER_ATTRIBUTION,
    ].filter(Boolean).map((l, i) => (i === 2 ? l : esc(l))).join("<br>");
    return shell(`Your Catch'em reads, ${when}`, doc.lead, body.join("\n"), footer);
  }
  const anchor = (id) => (more ? more + "#" + id : "");
  const body = [];
  body.push(`<tr><td style="padding:4px 6px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="ce-ink ce-brand" style="font:700 15px/1 ${FONT};color:${C.ink}">Catch'em</td><td align="right" class="ce-soft" style="font:400 13px/1 ${FONT};color:${C.soft}">${esc(when)}</td></tr></table></td></tr>`);
  const sub = `${LENGTH_NAME[L]} · ${when} · ${doc.label}`;
  body.push(card(`<p class="ce-ink" style="margin:0 0 6px;font:700 21px/1.3 ${FONT};color:${C.ink}">${esc(doc.lead)}</p><p class="ce-soft" style="margin:0;font:400 13px/1.4 ${FONT};color:${C.soft}">${esc(sub)}</p>${L !== "glance" ? para(doc.intro) : ""}${doc.fallback ? para(doc.fallback, ";font-style:italic") : ""}`));
  if (doc.report) body.push(reportCard(doc.report, L));
  if (doc.away) body.push(awayCard(doc.away));
  const t = doc.top;
  if (L === "glance") {
    const moves = [t, ...doc.ups, ...doc.downs].slice(0, 3);
    body.push(card(h2("Three moves") + moves.map((i, n) => row(i, { more: anchor(n === 0 ? "top-move" : "move-" + i.id) })).join("") + (doc.supply[0] ? `<p class="ce-dim" style="margin:12px 0 0;font:400 14px/1.45 ${FONT};color:${C.dim}">Supply: ${esc(doc.supply[0].name)} ${esc(doc.supply[0].word.toLowerCase())}, ${doc.supply[0].prev} to ${doc.supply[0].n} listings counted (${esc(day(doc.supply[0].prevDate))} to ${esc(day(doc.supply[0].date))}).</p>` : "")));
  } else {
    const img = t.image ? `<td width="88" valign="top" style="padding-right:12px"><img src="${esc(t.image)}" width="88" height="122" alt="" class="ce-img" style="display:block;width:88px;height:122px;object-fit:cover;border-radius:14px;background:${C.line}"></td>` : "";
    const why = L === "deep" ? [t.a.stageInfo ? `Run stage: ${stageLine(t.a.stageInfo)}` : "", t.vintage ? "This card is from the WOTC era, before mid 2003." : "", `Window: ${day(t.a.start[0])} to ${day(t.a.last[0])}, TCGplayer market.`].filter(Boolean) : [];
    body.push(card(h2("Top move") + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${img}<td valign="middle"><a href="${esc(t.href)}" class="ce-ink" style="text-decoration:none;color:${C.ink};font:600 15px/1.25 ${FONT}">${esc(t.name)}</a><p class="ce-dim" style="margin:2px 0 0;font:400 13px/1.35 ${FONT};color:${C.dim}">${esc(meta(t))}</p>${premiumPill(t.premiumFlag)}</td><td width="76" align="right" valign="middle">${pill(t.a.change)}</td></tr></table>` + barChart(t.a) + para(t.story) + (L === "deep" && why.length ? `<p class="ce-ink" style="margin:14px 0 0;font:600 14px/1.3 ${FONT};color:${C.ink}">Why it matters</p>` + why.map((w) => para(w)).join("") : "") + shopButtons(t) + `<p style="margin:10px 0 0"><a href="${esc(t.href)}" class="ce-ink" style="display:inline-block;min-height:44px;line-height:44px;font:600 15px/44px ${FONT};color:${C.ink};text-decoration:underline">See the read</a></p>`, "top-move"));
    if (doc.tiles.length) body.push(card(h2(doc.path === "default" ? "The whole group today" : doc.label + " today") + tilesHtml(doc.tiles) + para(`Price change over each item's latest 7 days on file, up to ${when}. Listings counted are the last two nights.`, ";font-size:13px")));
    if (doc.ups.length) body.push(card(h2("Also moving up") + doc.ups.map((i) => `<div id="move-${esc(i.id)}">${row(i, { deep: L === "deep" })}</div>`).join(""), "moving-up"));
    if (doc.downs.length) body.push(card(h2("Moving down") + doc.downs.map((i) => `<div id="move-${esc(i.id)}">${row(i, { deep: L === "deep" })}</div>`).join(""), "moving-down"));
    if (doc.supply.length) body.push(card(h2("Listings counted") + para("Draining means fewer eBay listings counted than the night before. Stacking means more. A listing is not a sale.", ";margin-top:0;font-size:13px") + doc.supply.map(supplyRow).join(""), "supply"));
    if (doc.building?.length) body.push(buildingCard(doc.building));
    if (L === "deep" && doc.setCompare.length) body.push(card(h2("Set by set") + doc.setCompare.map((r) => `<p class="ce-dim" style="margin:0 0 8px;font:400 14px/1.4 ${FONT};color:${C.dim}"><b class="ce-ink" style="color:${C.ink}">${esc(r.set)}</b>: ${r.up} up, ${r.down} down, of ${r.n} in this read.</p>`).join(""), "sets"));
    if (doc.vintage) body.push(card(h2("Vintage note") + row(doc.vintage, { deep: L === "deep" }), "vintage"));
    if (doc.pattern) {
      const foot = doc.pattern.small
        ? `<p class="ce-soft" style="margin:6px 0 0;font:400 13px/1.45 ${FONT};color:${C.soft}">${esc(doc.pattern.small)} Our nightly files, ${esc(day(doc.pattern.asOf))}.</p>`
        : `<p class="ce-soft" style="margin:6px 0 0;font:400 13px/1.35 ${FONT};color:${C.soft}">Pattern as of ${esc(day(doc.pattern.asOf))}. TCGplayer market.</p>`;
      body.push(card(h2("Pattern to know") + `<p class="ce-ink" style="margin:0;font:600 15px/1.35 ${FONT};color:${C.ink}">${esc(doc.pattern.text)}</p>${doc.pattern.bars || ""}${foot}`, "pattern"));
    }
    if (doc.rotation) body.push(card(h2("Rotation") + `<p class="ce-dim" style="margin:0;font:400 15px/1.45 ${FONT};color:${C.dim}">${esc(doc.rotation.text)}</p>`, "rotation"));
  }
  if (doc.news && L !== "glance") body.push(card(h2("News") + `<p class="ce-ink" style="margin:0;font:600 15px/1.35 ${FONT};color:${C.ink}">${esc(doc.news.text)}</p><p class="ce-soft" style="margin:6px 0 0;font:400 13px/1.35 ${FONT}"><a href="${esc(doc.news.href)}" style="color:${C.soft};text-decoration:underline">${esc(doc.news.source || "Source")}</a></p>`, "news"));
  const cta = more || SITE + "/feed";
  const ctaLabel = L === "glance" ? "Read the full version" : more ? "Open this read on the site" : "See every card in your read";
  body.push(`<tr><td style="padding:4px 0 8px"><a href="${esc(cta)}" class="ce-btn-dark" style="display:block;text-align:center;background:${C.ink};color:#ffffff;border-radius:999px;padding:12px;min-height:20px;font:600 15px/20px ${FONT};text-decoration:none">${esc(ctaLabel)}</a></td></tr>`);
  if (suggest?.href && suggest?.text) {
    body.push(`<tr><td style="padding:4px 10px 4px;text-align:center"><p class="ce-soft" style="margin:0;font:400 12px/1.5 ${FONT};color:${C.soft}">${esc(suggest.text)}</p><a href="${esc(suggest.href)}" class="ce-btn-light" style="display:inline-block;margin-top:6px;min-height:44px;line-height:44px;padding:0 18px;border-radius:999px;background:${C.card};border:1px solid #d1d1d6;color:${C.ink};font:600 14px/44px ${FONT};text-decoration:none">${esc(suggest.label)}</a></td></tr>`);
  }
  const footer = [
    "Prices are TCGplayer market on the dates shown. Listings counted are eBay listings on the dates shown. A listing is not a sale.",
    SHOP_NOTE,
    page ? "" : `You follow this read. <a href="${esc(manage)}" style="color:${C.soft}">Change what you follow</a>${unsubscribe ? ` or <a href="${esc(unsubscribe)}" style="color:${C.soft}">unsubscribe</a>` : ""}.`,
    AFFILIATION + " " + TCGPLAYER_ATTRIBUTION,
  ].filter(Boolean).map((l, i) => (i === 2 ? l : esc(l))).join("<br>");
  return shell(`Your Catch'em reads, ${when}`, doc.lead, body.join("\n"), footer);
}

export function articleText(doc, { unsubscribe = "", more = "", suggest = null } = {}) {
  if (doc.emptyPremium) {
    const out = [doc.report ? "Your watchlist." : "No reads match this premium filter today."];
    if (doc.report) out.push(...doc.report.rows.map((r) => [r.name, flagWord(r.premiumFlag)].filter(Boolean).join(". ")));
    out.push("", SHOP_NOTE, unsubscribe ? "Unsubscribe: " + unsubscribe : "", "Change your reads: " + SITE + "/reads");
    return out.filter((l) => l !== undefined).join("\n");
  }
  const out = [doc.lead, doc.intro];
  if (doc.fallback) out.push(doc.fallback);
  const w = (r) => `${r.name}: ${money(r.from[1])} on ${day(r.from[0])} to ${money(r.to[1])} on ${day(r.to[0])} (${pct(r.change)})`;
  if (doc.report) out.push("", "Watchlist report card, since " + day(doc.report.since), ...doc.report.rows.map(w));
  if (doc.away) out.push("", "While you were away, since " + day(doc.away.since), ...doc.away.rows.map(w));
  out.push("", "Top move: " + doc.top.name + " " + pct(doc.top.a.change), [flagWord(doc.top.premiumFlag), doc.top.story].filter(Boolean).join(" "), doc.top.href, "");
  for (const i of [...doc.ups, ...doc.downs].slice(0, doc.length === "glance" ? 2 : 6)) out.push([i.name, pct(i.a.change), flagWord(i.premiumFlag)].filter(Boolean).join(" "), i.story, "");
  for (const r of doc.supply.slice(0, doc.length === "glance" ? 1 : 3)) out.push(`${r.name}: ${r.word.toLowerCase()}, ${r.prev} to ${r.n} listings counted (${day(r.prevDate)} to ${day(r.date)}).`);
  if (doc.building?.length && doc.length !== "glance") out.push("", "What's building quietly", ...doc.building.map((r) => r.name + ": " + r.line));
  if (more) out.push("", "Read the full version: " + more);
  if (suggest?.href) out.push("", suggest.text + " " + suggest.label + ": " + suggest.href);
  out.push("", SHOP_NOTE, unsubscribe ? "Unsubscribe: " + unsubscribe : "", "Change your reads: " + SITE + "/reads");
  return out.filter((l) => l !== undefined).join("\n");
}

// ---------- inputs ----------

// The saved plan (reads:d:<id> in FEED_KV) as an article follow.
// Deep dive needs plan.deep, which gatePlan sets only for Premium.
export function followFromPlan(plan, sendDay = "") {
  const p = plan && typeof plan === "object" ? plan : {};
  const pickLength = lengthFor(p, sendDay);
  const cards = [];
  const sealed = [];
  const names = {};
  for (const row of p.watch || []) {
    const id = String(row?.id || "");
    if (!/^tcgcsv-\d+$/.test(id)) continue;
    (row.kind === "sealed" ? sealed : cards).push(id);
    if (row.name) names[id] = String(row.name);
  }
  return {
    sets: Array.isArray(p.sets) ? p.sets : [],
    pokemon: Array.isArray(p.pokemon) ? p.pokemon : [],
    rarities: Array.isArray(p.rarities) ? p.rarities.filter((r) => CHASE_RARITIES.includes(r)) : [],
    eras: Array.isArray(p.eras) ? p.eras.map(String).slice(0, 6) : [],
    artists: Array.isArray(p.artists) ? p.artists.map((a) => String(a).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60)).filter(Boolean).slice(0, 5) : [],
    generations: Array.isArray(p.generations) ? p.generations.map(String).filter((g) => /^([1-9]|ME)$/.test(g)).slice(0, 3) : [],
    cards,
    sealed,
    names,
    product: p.product === "sealed" || p.sealed === true ? "sealed" : "singles",
    focus: p.focus === "vintage" ? "vintage" : "",
    premiumRatio: p.premiumRatio === "below" || p.premiumRatio === "above" ? p.premiumRatio : "",
    length: pickLength.length,
    weekday: pickLength.weekday,
  };
}

// Artist, generation and chase rarity per single, from Catchem-data.
export const PATH_TAGS = "data/path-tags.json";

// Public dated files, loaded once per run. Sparks load lazily per bucket.
export async function loadContext(fetchImpl = fetch) {
  const { loadJson } = await import("./data.mjs");
  const get = (f) => loadJson(f, fetchImpl).catch(() => null);
  const { fetchRepo } = await import("./data.mjs");
  const getTags = () => fetchRepo(PATH_TAGS, fetchImpl).then((r) => (r && r.ok ? r.json() : null)).catch(() => null);
  const [reads, hold, movers, listings, sets, chips, tags, premium] = await Promise.all([get("reads.json"), get("price-hold.json"), get("movers.json"), get("listings-counted.json"), get("sets.json"), get("signal-chips.json"), getTags(), get("premium-ratio.json")]);
  const holdIds = hold?.ids && typeof hold.ids === "object" ? hold.ids : {};
  const bags = new Map();
  const spark = async (id) => {
    const n = Number((String(id).match(/(\d+)/) || [])[1] || 0);
    const b = String(n % 100).padStart(2, "0");
    if (!bags.has(b)) bags.set(b, await get("sparks/" + b + ".json"));
    const doc = bags.get(b);
    return doc?.rows?.[id] ? unpackSpark(doc.rows[id], doc.asOf) : [];
  };
  return { reads, holdIds, movers, listings, sets, chips, tags, premium, spark, asOf: String(movers?.asOf || reads?.asOf || "") };
}

// Watched items get their own 30 day history from the sparks file.
export async function watchedFor(follow, ctx) {
  const out = [];
  const names = new Map();
  for (const r of ctx?.reads?.reads || []) if (r?.sku && !names.has(r.sku)) names.set(r.sku, r.name);
  for (const id of [...(follow?.cards || []), ...(follow?.sealed || [])].slice(0, 25)) {
    if (!/^tcgcsv-\d+$/.test(id) || ctx?.holdIds?.[id]) continue;
    const hist = ctx?.spark ? await ctx.spark(id) : [];
    const name = names.get(id) || follow?.names?.[id] || "";
    if (hist.length < 2 || !name) continue;
    out.push({ id, name, set: "", kind: (follow.sealed || []).includes(id) ? "sealed" : "single", hist, href: SITE + "/c/" + id });
  }
  return out;
}

export async function articleForPlan(plan, ctx, asOf, lengthOverride = "", history = {}) {
  if (!ctx) return null;
  const follow = followFromPlan(plan, asOf || ctx.asOf);
  const length = lengthOverride || follow.length;
  const watched = await watchedFor(follow, ctx);
  const doc = buildArticle({ follow, ctx: { ...ctx, watched }, asOf: asOf || ctx.asOf, length, history });
  if (doc) doc.weekday = follow.weekday;
  return doc;
}

// ---------- phase 2: length by day ----------

export const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
export const WEEKDAY_NAMES = { sun: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday" };

export function weekdayOf(d) {
  const ms = Date.parse(String(d || "").slice(0, 10) + "T12:00:00Z");
  return Number.isFinite(ms) ? WEEKDAYS[new Date(ms).getUTCDay()] : "";
}

// The length for one send day. A weekday choice wins over the everyday length.
export function lengthFor(plan, sendDay) {
  const premium = plan?.deep === true;
  const w = weekdayOf(sendDay);
  const by = w ? String(plan?.lengthByDay?.[w] || "") : "";
  if (by && LENGTHS.includes(by)) return { length: cleanLength(by, premium), weekday: w };
  return { length: cleanLength(plan?.length, premium), weekday: "" };
}

export function cleanLengthByDay(value, premium) {
  const out = {};
  for (const w of WEEKDAYS) {
    const v = String(value?.[w] || "");
    if (LENGTHS.includes(v)) out[w] = cleanLength(v, premium);
  }
  return out;
}

// ---------- phase 2: windows, report card, catch up, quiet days ----------

function dayMs(d) { return Date.parse(String(d).slice(0, 10) + "T00:00:00Z"); }

// Price on the last day on file at or before sinceDay, then the latest price.
export function windowMove(a, sinceDay) {
  if (!a?.pts?.length || !/^\d{4}-\d{2}-\d{2}$/.test(String(sinceDay || ""))) return null;
  let base = null;
  for (const p of a.pts) if (p[0] <= sinceDay) base = p;
  if (!base) base = a.pts[0];
  const last = a.pts[a.pts.length - 1];
  if (!(last[0] > base[0])) return null;
  const inside = a.pts.filter((p) => p[0] >= base[0]);
  let bigStep = 0;
  for (let i = 1; i < inside.length; i++) bigStep = Math.max(bigStep, Math.abs((inside[i][1] - inside[i - 1][1]) / inside[i - 1][1]) * 100);
  return { from: base, to: last, change: ((last[1] - base[1]) / base[1]) * 100, points: inside.length, bigStep };
}

// How each watched item moved since the member's last read, with both dates.
export function watchReport(follow, pool, sinceDay, asOf) {
  const ids = [...(follow?.cards || []), ...(follow?.sealed || [])];
  if (!ids.length) return null;
  const fallbackSince = asOf ? new Date(dayMs(asOf) - 7 * DAY).toISOString().slice(0, 10) : "";
  const since = /^\d{4}-\d{2}-\d{2}$/.test(String(sinceDay || "")) ? sinceDay : fallbackSince;
  const byId = new Map(pool.map((i) => [i.id, i]));
  const rows = [];
  for (const id of ids) {
    const i = byId.get(id);
    if (!i) continue;
    const w = windowMove(i.a, since);
    if (!w) continue;
    rows.push({ id, name: i.name, kind: i.kind, image: i.image, href: i.href, premiumFlag: i.premiumFlag || "", ...w });
  }
  if (!rows.length) return null;
  rows.sort((x, y) => Math.abs(y.change) - Math.abs(x.change));
  return { since, firstRead: !sinceDay, rows: rows.slice(0, 8) };
}

// The three biggest moves across the days a member missed. Thin or one step
// jumps stay out so a catch up never leads with a shaky number.
export function catchUp(pool, sinceDay, skipId = "") {
  const rows = [];
  for (const i of pool) {
    if (i.id === skipId) continue;
    const w = windowMove(i.a, sinceDay);
    if (!w || w.points < 3 || w.bigStep >= 100 || Math.abs(w.change) < 5) continue;
    rows.push({ id: i.id, name: i.name, kind: i.kind, image: i.image, href: i.href, premiumFlag: i.premiumFlag || "", ...w });
  }
  if (!rows.length) return null;
  rows.sort((x, y) => Math.abs(y.change) - Math.abs(x.change));
  const top3 = rows.slice(0, 3);
  // Say the real start: if our history begins after sinceDay, use that date.
  const earliest = top3.map((r) => r.from[0]).sort()[0];
  return { since: earliest > sinceDay ? earliest : sinceDay, rows: top3 };
}

// Quiet: no solid move of 5% or more in this read, and no listings counted shift.
export function isQuiet(items, supply) {
  if ((supply || []).length) return false;
  return !(items || []).some((i) => !i.a.thin && Math.abs(i.a.change) >= 5);
}

// Slow real signals: small steps the same way for several price days, or a
// steady drift with no step bigger than 3%.
export function buildingQuietly(items) {
  const out = [];
  for (const i of items || []) {
    const a = i.a;
    if (!a || a.junk || a.pts.length < 8) continue;
    const recent = a.pts.slice(-8);
    const steps = [];
    for (let k = 1; k < recent.length; k++) steps.push(((recent[k][1] - recent[k - 1][1]) / recent[k - 1][1]) * 100);
    if (steps.some((x) => Math.abs(x) > 3)) continue;
    const drift = ((recent[recent.length - 1][1] - recent[0][1]) / recent[0][1]) * 100;
    const run = Math.abs(a.streak);
    if (run < 4 && Math.abs(drift) < 2) continue;
    const dir = drift >= 0 ? "up" : "down";
    const line = run >= 4
      ? `${run} price days in a row ${dir === "up" ? "up" : "down"}, in small steps: ${money(recent[0][1])} on ${day(recent[0][0])} to ${money(recent[recent.length - 1][1])} on ${day(recent[recent.length - 1][0])}.`
      : `A slow drift ${dir}, no step over 3%: ${money(recent[0][1])} on ${day(recent[0][0])} to ${money(recent[recent.length - 1][1])} on ${day(recent[recent.length - 1][0])}.`;
    out.push({ id: i.id, name: i.name, image: i.image, href: i.href, premiumFlag: i.premiumFlag || "", change: drift, line, score: run * 2 + Math.abs(drift) });
  }
  return out.sort((x, y) => y.score - x.score).slice(0, 3);
}
