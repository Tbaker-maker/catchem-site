// Weekly changes and the Scanner screener. Every figure is a field on weekly.json.
import { esc, pageChrome } from "./ui.mjs";
import { makePostLink } from "./office-path.mjs";
import { patternCopy } from "./pattern-track.mjs";
import { imageTag, officialSrc } from "./catalogue-image.mjs";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WINDOWS = ["7d", "30d", "90d"];

function dayLabel(iso) {
  const s = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  return `${MONTHS[Number(s.slice(5, 7)) - 1]} ${Number(s.slice(8, 10))}, ${s.slice(0, 4)}`;
}

function shortDay(iso) {
  const s = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  return `${MONTHS[Number(s.slice(5, 7)) - 1]} ${Number(s.slice(8, 10))}`;
}

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return "";
  return "$" + x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function productHref(id, kind) {
  if (!/^tcgcsv-\d+$/.test(String(id || ""))) return "";
  return kind === "sealed" ? `/p/${id}` : `/c/${id}`;
}

function isSealed(row) {
  return String(row?.kind || "").toLowerCase() === "sealed";
}

export function listingFields(row) {
  const date = String(row?.date || row?.to || "").slice(0, 10);
  const prevDate = String(row?.prevDate || row?.from || "").slice(0, 10);
  const n = Number(row?.n ?? row?.toN);
  const prev = Number(row?.prev ?? row?.fromN);
  return {
    id: String(row?.id || "").trim(),
    name: String(row?.name || row?.id || "").trim(),
    kind: isSealed(row) ? "sealed" : "single",
    date,
    prevDate,
    n,
    prev,
  };
}

function patternBits(raw) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    if (raw.line || raw.key) {
      const nested = patternBits(raw.line || raw.key);
      if (nested) {
        return {
          ...nested,
          name: nested.name || String(raw.pattern || raw.name || "").trim().toLowerCase(),
          stage: nested.stage || String(raw.stage || "").trim().toLowerCase(),
        };
      }
    }
    return {
      name: String(raw.pattern || raw.name || "").trim().toLowerCase(),
      stage: String(raw.stage || "").trim().toLowerCase(),
      scope: String(raw.kind || raw.scope || "").trim().toLowerCase(),
      dir: String(raw.dir || "").trim().toLowerCase(),
      days: Number(String(raw.horizon || raw.days || "").toString().replace(/d$/i, "")),
      n: Number(raw.n),
      rate: raw.rate == null ? null : Number(raw.rate),
      base: raw.base == null ? null : Number(raw.base),
    };
  }
  const parts = String(raw || "").split("|");
  if (parts.length < 6) return null;
  const pick = (key) => {
    const bit = parts.find((part) => String(part).startsWith(key + "="));
    if (!bit) return null;
    const n = Number(String(bit).slice(key.length + 1));
    return Number.isFinite(n) ? n : null;
  };
  return {
    name: String(parts[0] || "").trim().toLowerCase(),
    stage: String(parts[1] || "").trim().toLowerCase(),
    scope: String(parts[2] || "").trim().toLowerCase(),
    dir: String(parts[3] || "").trim().toLowerCase(),
    days: Number(String(parts[4] || "").replace(/d$/i, "")),
    n: pick("n"),
    rate: pick("rate"),
    base: pick("base"),
  };
}

export function parseWeeklyPattern(line) {
  const bits = patternBits(line);
  if (!bits) return null;
  const { name, stage, scope, dir, days, n, rate, base } = bits;
  if (!name || (stage !== "confirmed" && stage !== "passed")) return null;
  if (/stair|slow-climb|slowclimb|sealed-slow/.test(name) && stage !== "confirmed" && stage !== "passed") return null;
  if (!(n > 0) || rate == null || !(days > 0)) return null;
  const label = name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, " ");
  const who = scope === "single" ? "singles" : scope === "sealed" ? "sealed" : "";
  const way = dir === "up" || dir === "down" ? dir : "";
  const where = [who, way].filter(Boolean).join(", ");
  const named = `${label}${where ? ` on ${where}` : ""}`;
  const copy = base == null ? null : patternCopy({ rate, base, n, horizon: days, dir: way || "up" });
  if (copy) return { name, stage, scope, dir: way, days, n, rate, base, text: `${copy.lead}. ${named}. ${copy.small}` };
  const cases = Math.round(n).toLocaleString("en-US");
  return { name, stage, scope, dir: way, days, n, rate, base, text: `${named}. ${rate}% of ${cases} past cases, over ${days} days.` };
}

function face(row, images) {
  const kind = isSealed(row) ? "sealed" : "single";
  const hit = officialSrc({ id: row.id, kind }, images || {});
  return imageTag(hit.src, "row", "", { ...row, kind, catalogueCrop: hit.crop, alts: hit.alts || [] });
}

function spikeNote(row) {
  const flag = String(row?.flag || row?.spike || "").toLowerCase();
  const flags = Array.isArray(row?.flags) ? row.flags.map((x) => String(x).toLowerCase()) : [];
  if (flag === "thin-spike" || flag === "short-spike" || flags.includes("thin-spike") || flags.includes("short-spike")) {
    return "Short spike.";
  }
  return "";
}

function moverItem(row, images) {
  const name = String(row?.name || "").trim();
  const id = String(row?.id || "").trim();
  const from = dayLabel(row?.from);
  const to = dayLabel(row?.to);
  const p0 = money(row?.p0);
  const p1 = money(row?.p1);
  if (!name || !id || !from || !to || !p0 || !p1) return "";
  const kind = isSealed(row) ? "sealed" : "single";
  const href = productHref(id, kind);
  if (!href) return "";
  const num = String(row.number || "").trim();
  const set = String(row.set || "").trim();
  const printing = String(row.printing || "").trim();
  const source = String(row.source || "").trim();
  const pct = Number(row.pct);
  const move = Number.isFinite(pct) ? `${pct > 0 ? "+" : ""}${pct}%` : "";
  const meta = [num, set, printing].filter(Boolean).join(" · ");
  const spike = spikeNote(row);
  const extras = [source, spike].filter(Boolean).join(" ");
  const post = makePostLink({
    ids: id,
    kind,
    name,
    move: move || undefined,
    from: String(row.from || "").slice(0, 10),
    to: String(row.to || "").slice(0, 10),
    p0: row.p0,
    p1: row.p1,
  });
  return `<div class="wk-row"><a class="wk-row-main" href="${esc(href)}">${face(row, images)}<span><b>${esc(name)}</b>${meta ? `<small>${esc(meta)}</small>` : ""}<small>${esc(p0)} on ${esc(from)} to ${esc(p1)} on ${esc(to)}${move ? `. ${esc(move)}` : ""}${extras ? `. ${esc(extras)}` : ""}</small></span></a>${post}</div>`;
}

function listingItem(row) {
  const f = listingFields(row);
  if (!f.name || !Number.isFinite(f.n) || f.n < 0 || !dayLabel(f.date) || !(f.prev >= 0) || !dayLabel(f.prevDate)) return "";
  const href = productHref(f.id, f.kind);
  const pct = f.prev > 0 ? Math.round(((f.n - f.prev) / f.prev) * 1000) / 10 : null;
  const change = pct == null ? "" : `, ${pct > 0 ? "+" : ""}${pct}%`;
  const text = `${f.name}: ${f.n} listings counted on ${dayLabel(f.date)}, from ${f.prev} on ${dayLabel(f.prevDate)}${change}.`;
  const inner = `<span><b>${esc(text)}</b></span>`;
  const post = href ? makePostLink({
    ids: f.id,
    kind: f.kind,
    name: f.name,
    listings: true,
    p0: f.n,
    p1: f.prev,
    from: f.date,
    to: f.prevDate,
    move: pct == null ? undefined : `${pct > 0 ? "+" : ""}${pct}%`,
  }) : "";
  return href ? `<div class="wk-row"><a class="wk-row-main" href="${esc(href)}">${inner}</a>${post}</div>` : `<div class="wk-row">${inner}</div>`;
}

export function scannerQuery(opts = {}) {
  const search = String(opts.officeSearch || opts.search || "").replace(/^\?/, "");
  const q = search ? new URLSearchParams(search) : new URLSearchParams();
  const pick = (key, fallback = "") => {
    if (opts[key] != null && String(opts[key]).trim() !== "") return String(opts[key]).trim();
    return String(q.get(key) || fallback).trim();
  };
  const window = WINDOWS.includes(pick("window").toLowerCase()) ? pick("window").toLowerCase() : "7d";
  const kind = pick("kind").toLowerCase() === "sealed" || pick("kind").toLowerCase() === "singles" ? pick("kind").toLowerCase() : "";
  const dir = pick("dir").toLowerCase() === "up" || pick("dir").toLowerCase() === "down" ? pick("dir").toLowerCase() : "";
  const floor = Number(pick("floor"));
  const listings = pick("listings") === "1" || pick("listings").toLowerCase() === "yes";
  return {
    window,
    kind,
    dir,
    era: pick("era"),
    set: pick("set"),
    floor: Number.isFinite(floor) && floor > 0 ? floor : 0,
    listings,
    pattern: pick("pattern").toLowerCase(),
  };
}

export function scannerHref(filters, extra = {}) {
  const next = { ...filters, ...extra };
  const q = new URLSearchParams();
  if (next.window && next.window !== "7d") q.set("window", next.window);
  if (next.kind) q.set("kind", next.kind);
  if (next.dir) q.set("dir", next.dir);
  if (next.era) q.set("era", next.era);
  if (next.set) q.set("set", next.set);
  if (next.floor) q.set("floor", String(next.floor));
  if (next.listings) q.set("listings", "1");
  if (next.pattern) q.set("pattern", next.pattern);
  const s = q.toString();
  return s ? `/scanner?${s}` : "/scanner";
}

function windowMove(row, window) {
  const days = window === "30d" ? 30 : window === "90d" ? 90 : 7;
  const pack = row?.windows && typeof row.windows === "object" ? row.windows : null;
  const named = pack?.[window] || pack?.[`d${days}`] || pack?.[days];
  if (named && Number.isFinite(Number(named.pct))) return named;
  if ((window === "7d" || !window) && Number.isFinite(Number(row?.pct))) {
    return { pct: Number(row.pct), from: row.from, to: row.to, p0: row.p0, p1: row.p1 };
  }
  return null;
}

export function filterScreener(rows, filters) {
  const out = [];
  for (const row of rows || []) {
    if (!row) continue;
    const kind = isSealed(row) ? "sealed" : "singles";
    if (filters.kind && kind !== filters.kind) continue;
    if (filters.era && String(row.era || "").toLowerCase() !== filters.era.toLowerCase()) continue;
    if (filters.set) {
      const want = filters.set.toLowerCase();
      const set = String(row.set || "").toLowerCase();
      const slug = String(row.setSlug || "").toLowerCase();
      if (set !== want && slug !== want) continue;
    }
    if (filters.pattern) {
      const names = [row.pattern, ...(Array.isArray(row.patterns) ? row.patterns : [])].map((x) => String(x || "").toLowerCase());
      if (!names.includes(filters.pattern)) continue;
    }
    if (filters.listings) {
      const f = listingFields(row);
      const has = Number.isFinite(Number(row.listingsPct)) || (Number.isFinite(f.n) && Number.isFinite(f.prev));
      if (!has) continue;
    }
    const move = windowMove(row, filters.window);
    const price = Number(row.p1 ?? row.price ?? move?.p1);
    if (filters.floor && !(price >= filters.floor)) continue;
    const pct = move ? Number(move.pct) : (filters.listings ? Number(row.listingsPct) : NaN);
    if (filters.dir === "up" && !(pct > 0)) continue;
    if (filters.dir === "down" && !(pct < 0)) continue;
    if (!filters.listings && !move) continue;
    out.push({ row, move, pct: Number.isFinite(pct) ? pct : 0, price: Number.isFinite(price) ? price : 0 });
  }
  return out;
}

function screenerUniverse(doc) {
  if (Array.isArray(doc?.screener) && doc.screener.length) return doc.screener;
  const movers = [
    ...(doc?.risers || []),
    ...(doc?.fallers || []),
    ...(doc?.sealedRisers || []),
    ...(doc?.sealedFallers || []),
    ...(doc?.movers || []),
  ];
  const listings = (doc?.listingsCounted?.changes || []).map((row) => {
    const f = listingFields(row);
    return { ...row, listingsPct: row.pct, n: f.n, prev: f.prev, date: f.date, prevDate: f.prevDate };
  });
  const seen = new Set();
  const out = [];
  for (const row of [...movers, ...listings]) {
    const id = String(row?.id || "");
    if (!id || seen.has(id + (row.from || row.date || ""))) continue;
    seen.add(id + (row.from || row.date || ""));
    out.push(row);
  }
  return out;
}

function emptyLine(kind, asOf) {
  const when = asOf ? `, ${asOf}` : "";
  if (kind === "patterns") return `No patterns passed in this edition${when}.`;
  if (kind === "listings") return `No listings counted changes in this edition${when}.`;
  if (kind === "risers") return `No risers in this edition${when}.`;
  if (kind === "fallers") return `No fallers in this edition${when}.`;
  if (kind === "sealed-risers") return `No sealed risers in this edition${when}.`;
  if (kind === "sealed-fallers") return `No sealed fallers in this edition${when}.`;
  if (kind === "filter") return `No products matched these filters in this edition${when}.`;
  return `Nothing in this edition${when}.`;
}

function section(title, inner, empty) {
  return `<section><h2>${esc(title)}</h2>${inner || `<p class="wk-empty">${esc(empty)}</p>`}</section>`;
}

function listBlock(rows, images) {
  const html = (rows || []).map((row) => moverItem(row, images)).filter(Boolean).join("");
  return html ? `<div class="wk-list">${html}</div>` : "";
}

function takeList(doc, key, fallback) {
  return Array.isArray(doc?.[key]) ? doc[key] : fallback;
}

function isSpike(row) {
  return !!spikeNote(row);
}

function splitMovers(doc) {
  const all = Array.isArray(doc?.movers) ? doc.movers : [];
  const singles = all.filter((row) => !isSealed(row));
  const sealed = all.filter((row) => isSealed(row));
  const up = (rows) => rows.filter((row) => Number(row?.pct) > 0 && !isSpike(row));
  const down = (rows) => rows.filter((row) => Number(row?.pct) < 0 && !isSpike(row));
  const spikes = [
    ...(Array.isArray(doc?.spikes) ? doc.spikes : []),
    ...all.filter(isSpike),
  ];
  const seen = new Set();
  const shortSpikes = spikes.filter((row) => {
    const id = String(row?.id || "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return {
    risers: takeList(doc, "risers", up(singles)),
    fallers: takeList(doc, "fallers", down(singles)),
    sealedRisers: takeList(doc, "sealedRisers", up(sealed)),
    sealedFallers: takeList(doc, "sealedFallers", down(sealed)),
    shortSpikes,
    hasSealed: !!(doc?.includesSealed || sealed.length || (doc?.sealedRisers || []).length || (doc?.sealedFallers || []).length),
  };
}

const CSS = `<style>
.wk{display:grid;gap:16px}
.wk h1{margin:0}
.wk-nav{display:flex;gap:8px;overflow-x:auto}
.wk-nav a{flex:none;min-height:44px;display:inline-flex;align-items:center;padding:0 14px;border-radius:999px;background:rgba(255,255,255,.06);color:inherit;text-decoration:none;font:600 14px/1 var(--sans)}
.wk-nav a[aria-current="page"]{background:#f4efe6;color:#12100e;box-shadow:inset 0 0 0 1px #d4cbbd}
.wk-list{display:grid;gap:8px}
.wk-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;min-height:44px;padding:8px;border-radius:16px;background:#1a1815;border:1px solid #2f2b26;color:inherit;text-decoration:none}
.wk-row-main{display:flex;gap:10px;align-items:center;flex:1;min-width:12rem;min-height:44px;color:inherit;text-decoration:none}
.wk-row img,.wk-row .tile{width:44px;height:62px;object-fit:contain;border-radius:8px;background:#12100e;flex:none}
.wk-row b{display:block;font:600 16px/1.3 var(--sans)}
.wk-row small{display:block;color:var(--dim);font:500 14px/1.35 var(--sans)}
.wk-pat{margin:0;padding:14px 16px;border-radius:18px;background:#1a1815;border:1px solid #2f2b26;font:500 16px/1.4 var(--sans)}
.wk-empty{margin:0;color:var(--dim);font:500 15px/1.4 var(--sans)}
.wk-filters{display:flex;flex-wrap:wrap;gap:8px;align-items:end}
.wk-filters label{display:grid;gap:4px;font:600 12px/1.2 var(--sans);color:var(--dim)}
.wk-filters select,.wk-filters input{min-height:44px;padding:0 10px;border-radius:12px;border:1px solid #2f2b26;background:#1a1815;color:inherit;font:500 14px/1 var(--sans)}
.wk-filters button{min-height:44px;padding:0 14px;border-radius:999px;border:0;background:#f4efe6;color:#12100e;font:600 14px/1 var(--sans)}
.wk-count{margin:0;color:var(--dim);font:500 14px/1.4 var(--sans)}
.wk-windows{display:flex;flex-wrap:wrap;gap:8px}
.wk-windows a{flex:none;min-height:44px;display:inline-flex;align-items:center;padding:0 12px;border-radius:999px;background:rgba(255,255,255,.06);color:inherit;text-decoration:none;font:600 14px/1 var(--sans)}
.wk-windows a[aria-current="true"]{background:#f4efe6;color:#12100e}
</style>`;

function shell(title, active, body, stamp, opts) {
  return pageChrome(active, `<main id="main" tabindex="-1" class="wrap wk">${CSS}${body}</main>`, title, stamp, "", opts?.feed === true);
}

function subnav(active) {
  const link = (href, label) => `<a href="${href}"${active === label ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<nav class="wk-nav" aria-label="Weekly">${link("/weekly", "Weekly")}${link("/scanner", "Scanner")}</nav>`;
}

function weekLead(doc) {
  const asOf = String(doc?.asOf || "").slice(0, 10);
  const windowDays = Number(doc?.windowDays) > 0 ? Number(doc.windowDays) : 7;
  const start = dayLabel(doc?.windowFrom);
  const end = dayLabel(asOf);
  const source = String(doc?.source || "").trim();
  const bits = [];
  if (start && end) bits.push(`Week of ${shortDay(doc.windowFrom)}-${shortDay(asOf)} ${end.slice(-4)}`);
  else if (end) bits.push(`Weekly changes, ${end}`);
  if (source) bits.push(source);
  bits.push(`${windowDays}-day window`);
  return bits.length ? `<p class="muted">${esc(bits.join(" · "))}.</p>` : "";
}

export function weeklyBody(doc, images) {
  const asOf = dayLabel(doc?.asOf);
  const split = splitMovers(doc);
  const patterns = (doc?.patterns || []).map(parseWeeklyPattern).filter(Boolean);
  const listingRows = (doc?.listingsCounted?.changes || []).map(listingItem).filter(Boolean);
  const listings = listingRows.join("");
  const showSealed = split.hasSealed;
  const blocks = [
    section("Risers", listBlock(split.risers, images), emptyLine("risers", asOf)),
    section("Fallers", listBlock(split.fallers, images), emptyLine("fallers", asOf)),
    showSealed ? section("Sealed risers", listBlock(split.sealedRisers, images), emptyLine("sealed-risers", asOf)) : "",
    showSealed ? section("Sealed fallers", listBlock(split.sealedFallers, images), emptyLine("sealed-fallers", asOf)) : "",
    split.shortSpikes.length ? section("Short spikes", listBlock(split.shortSpikes, images), emptyLine("spikes", asOf)) : "",
    section("Patterns that passed", patterns.map((row) => `<p class="wk-pat">${esc(row.text)}</p>`).join(""), emptyLine("patterns", asOf)),
    section("Listings counted", listings ? `<div class="wk-list">${listings}</div>` : "", emptyLine("listings", asOf)),
  ].filter(Boolean).join("");
  return `${subnav("Weekly")}<h1>Weekly</h1>${weekLead(doc) || (asOf ? `<p class="muted">Weekly changes, ${esc(asOf)}.</p>` : "")}${blocks}`;
}

function uniqueValues(rows, key) {
  const out = [];
  const seen = new Set();
  for (const row of rows || []) {
    const v = String(row?.[key] || "").trim();
    if (!v) continue;
    const id = v.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(v);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function filterForm(filters, eras, sets, patterns) {
  const opt = (value, label, cur) => `<option value="${esc(value)}"${value === cur ? " selected" : ""}>${esc(label)}</option>`;
  const patternOpts = patterns.map((name) => opt(name, name, filters.pattern)).join("");
  const eraOpts = eras.map((name) => opt(name, name, filters.era)).join("");
  const setOpts = sets.map((name) => opt(name, name, filters.set)).join("");
  return `<form class="wk-filters" method="get" action="/scanner">
<label>Window <select name="window">${WINDOWS.map((w) => opt(w, w.toUpperCase(), filters.window)).join("")}</select></label>
<label>Type <select name="kind">${opt("", "All", filters.kind)}${opt("singles", "Singles", filters.kind)}${opt("sealed", "Sealed", filters.kind)}</select></label>
<label>Direction <select name="dir">${opt("", "All", filters.dir)}${opt("up", "Up", filters.dir)}${opt("down", "Down", filters.dir)}</select></label>
<label>Era <select name="era">${opt("", "All eras", filters.era)}${eraOpts}</select></label>
<label>Set <select name="set">${opt("", "All sets", filters.set)}${setOpts}</select></label>
<label>Pattern <select name="pattern">${opt("", "All patterns", filters.pattern)}${patternOpts}</select></label>
<label>Price floor <input type="number" name="floor" min="0" step="1" inputmode="decimal" value="${filters.floor ? esc(String(filters.floor)) : ""}"></label>
<label>Listings counted <select name="listings">${opt("", "Any", filters.listings ? "1" : "")}${opt("1", "Has a listings change", filters.listings ? "1" : "")}</select></label>
<button type="submit">Apply</button>
</form>`;
}

function screenerItem(entry, images, filters) {
  const row = entry.row;
  const move = entry.move;
  const from = dayLabel(move?.from || row.from);
  const to = dayLabel(move?.to || row.to);
  const p0 = money(move?.p0 ?? row.p0);
  const p1 = money(move?.p1 ?? row.p1 ?? row.price);
  const name = String(row?.name || "").trim();
  const id = String(row?.id || "").trim();
  if (!name || !id) return "";
  const kind = isSealed(row) ? "sealed" : "single";
  const href = productHref(id, kind) || scannerHref(filters);
  const pct = Number.isFinite(entry.pct) ? `${entry.pct > 0 ? "+" : ""}${entry.pct}%` : "";
  const window = String(filters.window || "7d").toUpperCase();
  const meta = [row.number, row.set, row.printing, row.era].filter(Boolean).join(" · ");
  const list = listingFields(row);
  const listings = Number.isFinite(list.n) && Number.isFinite(list.prev)
    ? `${list.n} listings counted${dayLabel(list.date) ? ` on ${dayLabel(list.date)}` : ""}, from ${list.prev}.`
    : "";
  const priceLine = p0 && p1 && from && to ? `${p0} on ${from} to ${p1} on ${to}${pct ? `. ${pct} ${window}` : ""}` : (p1 && pct ? `${p1}. ${pct} ${window}` : (pct ? `${pct} ${window}` : p1));
  const post = href.startsWith("/p/") || href.startsWith("/c/") ? makePostLink({
    ids: id,
    kind,
    name,
    move: pct || undefined,
    from: String(move?.from || row.from || "").slice(0, 10),
    to: String(move?.to || row.to || "").slice(0, 10),
    p0: move?.p0 ?? row.p0,
    p1: move?.p1 ?? row.p1,
  }) : "";
  const body = `<span><b>${esc(name)}</b>${meta ? `<small>${esc(meta)}</small>` : ""}${priceLine ? `<small>${esc(priceLine)}</small>` : ""}${listings ? `<small>${esc(listings)}</small>` : ""}</span>`;
  return `<div class="wk-row"><a class="wk-row-main" href="${esc(href)}">${face(row, images)}${body}</a>${post}</div>`;
}

export function scannerBody(doc, opts = {}, images = {}) {
  const asOfIso = String(doc?.patternsAsOf || doc?.asOf || "").slice(0, 10);
  const asOf = dayLabel(asOfIso);
  const filters = scannerQuery(opts);
  const universe = screenerUniverse(doc);
  const matched = filterScreener(universe, filters);
  const patterns = (doc?.patterns || []).map(parseWeeklyPattern).filter(Boolean);
  const patternNames = uniqueValues([
    ...patterns.map((row) => ({ pattern: row.name })),
    ...universe.map((row) => ({ pattern: row.pattern })),
    ...universe.flatMap((row) => (row.patterns || []).map((pattern) => ({ pattern }))),
  ], "pattern");
  const eras = uniqueValues(universe, "era");
  const sets = uniqueValues(universe, "set");
  const windows = `<nav class="wk-windows" aria-label="Window">${WINDOWS.map((w) => `<a href="${esc(scannerHref(filters, { window: w }))}"${w === filters.window ? ' aria-current="true"' : ""}>${w.toUpperCase()}</a>`).join("")}</nav>`;
  const count = `<p class="wk-count">${matched.length} of ${universe.length} in this edition${asOf ? `, ${esc(asOf)}` : ""}.</p>`;
  const list = matched.map((entry) => screenerItem(entry, images, filters)).filter(Boolean).join("");
  const patternText = patterns.length
    ? patterns.map((row) => `<p class="wk-pat">${esc(row.text)}</p>`).join("")
    : `<p class="wk-empty">${esc(emptyLine("patterns", asOf))}</p>`;
  const rows = list ? `<div class="wk-list">${list}</div>` : `<p class="wk-empty">${esc(emptyLine(universe.length ? "filter" : "patterns", asOf))}</p>`;
  const when = asOf ? `<p class="muted">Scanner, ${esc(asOf)}.</p>` : "";
  return `${subnav("Scanner")}<h1>Scanner</h1>${when}${windows}${filterForm(filters, eras, sets, patternNames)}${count}${rows}<section><h2>Patterns that passed</h2>${patternText}</section>`;
}

export function renderWeekly(doc, stamp, opts = {}, images = {}) {
  return shell("Weekly", "Weekly", weeklyBody(doc, images), stamp, opts);
}

export function renderScanner(doc, stamp, opts = {}, images = {}) {
  return shell("Scanner", "Scanner", scannerBody(doc, opts, images), stamp, opts);
}
