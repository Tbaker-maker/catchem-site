// Data Explorer. Reads published Catchem-data files through data.mjs. No scraping.
// Attached from site-entry.mjs so src/index.mjs stays untouched.

import { fetchRepo } from "./data.mjs";

const FILES = {
  sets: "research/assets/public/sets.json",
  listings: "research/assets/public/listings-counted.json",
  movers: "research/assets/public/movers.json",
  meter: "research/assets/public/market-meter.json",
  today: "research/assets/public/today.json",
  releases: "research/assets/public/releases.json",
  track: "research/assets/public/track-record.json",
};

const LOGS = [
  ["sets", "Sets", "Names, counts, and the value on file."],
  ["sealed", "Sealed", "Sealed products and the price on file."],
  ["singles", "Singles", "Single cards and the price on file."],
  ["listings", "Listings counted", "How many listings were counted."],
  ["history", "Price history", "First and last price on file."],
  ["pulse", "Pulse", "Daily market mood and heat."],
  ["news", "News", "News lines and release dates."],
  ["reads", "Reads", "Past reads and how they turned out."],
];

const CAP = 60;
let cache = null;
let cacheAt = 0;

export function resetExplorerCache() {
  cache = null;
  cacheAt = 0;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => {
    if (c === "&") return "&" + "amp;";
    if (c === "<") return "&" + "lt;";
    if (c === ">") return "&" + "gt;";
    if (c === '"') return "&" + "quot;";
    return "&" + "#39;";
  });
}

// Copy rules flag, they never rewrite. cleanText only tidies whitespace.
// Dashes in third-party product names show as a plain hyphen so no page
// carries an em or en dash. Words are never swapped.
export function cleanText(s) {
  return String(s ?? "").replace(/\s*[\u2013\u2014]\s*/g, " - ").replace(/\s+/g, " ").trim();
}

const FLAG_RULES = [
  [/[\u2013\u2014]/, "em or en dash"],
  [/\bsold\b/i, "say listings counted"],
  [/\bCollectr\b/i, "no Collectr in public copy"],
];

export function copyFlags(s) {
  const text = String(s ?? "");
  return FLAG_RULES.filter(([re]) => re.test(text)).map(([, why]) => why);
}

// eBay asks are listings, not recorded prices. Only TCGplayer prices show.
export function isAskSource(source) {
  return /ebay/i.test(String(source || ""));
}

function sealedName(s) {
  return cleanText(s)
    .replace(/\b(NM|LP|MP|HP|DMG)\b/g, "")
    .replace(/\bnear mint\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.)])/g, "$1")
    .trim();
}

function num(v) {
  if (v === 0 || v === "0") return 0;
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function money(v) {
  const n = num(v);
  if (n == null || n <= 0) return "No price";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function moveText(pct) {
  const n = num(pct);
  if (n == null) return "No price";
  if (Math.abs(n) < 0.05) return "Flat 0.0%";
  const arrow = n > 0 ? "Up \u25B2" : "Down \u25BC";
  const body = (n > 0 ? "+" : "") + n.toFixed(1) + "%";
  return arrow + " " + body;
}

function scoreMove(now, prev) {
  if (now == null) return "No reading";
  if (prev == null) return "No earlier reading";
  const d = now - prev;
  if (d === 0) return "Flat 0";
  const arrow = d > 0 ? "Up \u25B2" : "Down \u25BC";
  const body = (d > 0 ? "+" : "") + String(d);
  return arrow + " " + body;
}

function norm(pathname) {
  let path = String(pathname || "").split("?")[0];
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path || "/";
}

function hay(row) {
  return (row.title + " " + row.detail + " " + row.source + " " + row.date).toLowerCase();
}

function applyQuery(rows, query, sorts, filters, defSort, defFilter = "all") {
  const q = cleanText(query.q || "").toLowerCase();
  const filterIds = new Set(filters.map((f) => f[0]));
  const sortIds = new Set(sorts.map((s) => s[0]));
  const fallback = filterIds.has(defFilter) ? defFilter : (filters[0] ? filters[0][0] : "all");
  const filter = filterIds.has(query.filter) ? query.filter : fallback;
  const sort = sortIds.has(query.sort) ? query.sort : defSort;
  const hasAll = rows.some((r) => r.filter === "all");
  let out = filter === "all"
    ? (hasAll ? rows.filter((r) => r.filter === "all") : rows)
    : rows.filter((r) => r.filter === filter);
  if (q) out = out.filter((r) => hay(r).includes(q));
  const cmp = {
    name: (a, b) => a.title.localeCompare(b.title),
    date: (a, b) => String(b.date).localeCompare(String(a.date)) || a.title.localeCompare(b.title),
    oldest: (a, b) => String(a.date).localeCompare(String(b.date)) || a.title.localeCompare(b.title),
    price: (a, b) => (b.price ?? -1) - (a.price ?? -1),
    move: (a, b) => Math.abs(b.move ?? 0) - Math.abs(a.move ?? 0),
    count: (a, b) => (b.count ?? -1) - (a.count ?? -1),
    release: (a, b) => String(b.when || "").localeCompare(String(a.when || "")) || a.title.localeCompare(b.title),
    published: (a, b) => a.order - b.order,
  }[sort] || ((a, b) => a.order - b.order);
  out = out.slice().sort(cmp);
  const total = out.length;
  return { rows: out.slice(0, CAP), total, filter, sort };
}

function row(partial, order) {
  return {
    title: cleanText(partial.title || "Untitled"),
    detail: cleanText(partial.detail || ""),
    source: cleanText(partial.source || ""),
    date: cleanText(partial.date || ""),
    href: partial.href || "",
    filter: partial.filter || "all",
    price: partial.price ?? null,
    move: partial.move ?? null,
    count: partial.count ?? null,
    when: partial.when || "",
    order,
  };
}

function safeHref(href) {
  const h = String(href || "");
  if (h.startsWith("/c/") || h.startsWith("/p/") || h.startsWith("/sets/")) return h;
  return "";
}

function setsRows(doc) {
  const source = doc?.source || "";
  const date = doc?.asOf || "";
  return (doc?.sets || []).map((s, i) => row({
    title: s.name,
    detail: "Era " + (s.era || "No era") + ". Release " + (s.release || "No date") + ". " + (s.single ?? "No") + " singles on file. " + (s.sealed ?? "No") + " sealed on file. " + (s.priced ?? "No") + " priced. Value on file " + money(s.value) + ".",
    source,
    date,
    href: /^[a-z0-9-]+$/.test(s.slug || "") ? "/sets/" + s.slug : "",
    price: num(s.value),
    when: s.release || "",
    filter: s.era || "all",
  }, i));
}

function moverRows(list, kind) {
  return (list || []).map((item, i) => {
    const title = kind === "sealed" ? sealedName(item.name) : cleanText(item.name);
    return row({
      title,
      detail: "Set " + (item.set || "No set") + ". Price " + money(item.price) + ". Change on file " + moveText(item.changePct) + "." + (kind === "sealed" ? " Sealed." : ""),
      source: "TCGplayer market",
      date: "",
      href: safeHref(item.href),
      price: num(item.price),
      move: num(item.changePct),
      filter: "all",
    }, i);
  });
}

function sealedRows(doc) {
  const date = doc?.asOf || "";
  const all = moverRows(doc?.sealed, "sealed").map((r) => ({ ...r, date, filter: "all" }));
  const rising = moverRows(doc?.sealedRising, "sealed").map((r, i) => ({ ...r, date, filter: "rising", order: 1000 + i }));
  const falling = moverRows(doc?.sealedFalling, "sealed").map((r, i) => ({ ...r, date, filter: "falling", order: 2000 + i }));
  return all.concat(rising, falling);
}

function singleRows(doc) {
  const date = doc?.asOf || "";
  const all = moverRows(doc?.singles, "single").map((r) => ({ ...r, date, filter: "all" }));
  const rising = moverRows(doc?.singlesRising, "single").map((r, i) => ({ ...r, date, filter: "rising", order: 1000 + i }));
  const falling = moverRows(doc?.singlesFalling, "single").map((r, i) => ({ ...r, date, filter: "falling", order: 2000 + i }));
  return all.concat(rising, falling);
}

function ends(hist) {
  const pts = (hist || []).filter((p) => Array.isArray(p) && p[0] && num(p[1]) != null && num(p[1]) > 0);
  if (!pts.length) return null;
  return { start: pts[0], end: pts[pts.length - 1] };
}

function historyRows(doc) {
  const dateFile = doc?.asOf || "";
  const pack = (list, kind) => (list || []).map((item, i) => {
    const span = ends(item.hist);
    const title = kind === "sealed" ? sealedName(item.name) : cleanText(item.name);
    if (!span) {
      return row({
        title,
        detail: "No price on file." + (kind === "sealed" ? " Sealed." : ""),
        source: "TCGplayer market",
        date: dateFile,
        href: safeHref(item.href),
        filter: kind,
      }, i);
    }
    const from = num(span.start[1]);
    const to = num(span.end[1]);
    const pct = from > 0 ? ((to - from) / from) * 100 : null;
    const same = span.start[0] === span.end[0];
    const detail = same
      ? "One price on file: " + money(to) + " on " + span.end[0] + "." + (kind === "sealed" ? " Sealed." : "")
      : "From " + money(from) + " on " + span.start[0] + " to " + money(to) + " on " + span.end[0] + ". " + moveText(pct) + "." + (kind === "sealed" ? " Sealed." : "");
    return row({
      title,
      detail,
      source: "TCGplayer market",
      date: span.end[0],
      href: safeHref(item.href),
      price: to,
      move: pct,
      filter: kind,
    }, (kind === "sealed" ? 1000 : 0) + i);
  });
  const seen = new Set();
  return pack(doc?.singles, "single").concat(pack(doc?.sealed, "sealed")).filter((r) => {
    const key = r.href || r.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function listingRows(doc) {
  const source = doc?.source || "";
  const fileDate = doc?.asOf || "";
  return (doc?.products || []).map((p, i) => {
    const raw = p.listingsCounted;
    const packed = raw && typeof raw === "object" ? raw : { n: raw, date: "" };
    const count = num(packed.n);
    const date = packed.date || fileDate;
    const line = count == null ? "No listings counted." : count + " listings counted.";
    const earlier = packed.prev && num(packed.prev.n) != null
      ? " Earlier count on file: " + packed.prev.n + " on " + (packed.prev.date || "No date") + "."
      : "";
    return row({
      title: sealedName(p.name),
      detail: line + earlier + " Sealed.",
      source,
      date,
      count,
    }, i);
  });
}

function pulsePoints(block) {
  const hist = Array.isArray(block?.history) ? block.history : [];
  return hist.map((p) => ({ d: String(p?.d || ""), mood: num(p?.mood), heat: num(p?.heat) })).filter((p) => p.d);
}

function pulseRows(doc, key) {
  const source = doc?.source || "";
  const pts = pulsePoints(doc?.[key]).slice().sort((a, b) => a.d.localeCompare(b.d));
  return pts.map((p, i) => {
    const prev = i > 0 ? pts[i - 1] : null;
    const moodLine = p.mood == null ? "Mood: No reading." : "Mood " + p.mood + (p.mood === 0 ? ". 0 is a score on file, not a missing price." : ".");
    const heatLine = p.heat == null ? "Heat: No reading." : "Heat " + p.heat + ".";
    const vs = " Mood vs the earlier day on file: " + scoreMove(p.mood, prev ? prev.mood : null) + ".";
    return row({
      title: p.d,
      detail: moodLine + " " + heatLine + vs,
      source,
      date: p.d,
      move: prev && p.mood != null && prev.mood != null ? p.mood - prev.mood : null,
      filter: "all",
    }, i);
  });
}

function newsRows(today, releases) {
  const news = (today?.lines || []).filter((l) => l.slot === "news").map((l, i) => row({
    title: l.text,
    detail: "News line.",
    source: l.source || "",
    date: l.date || today?.asOf || "",
    href: "",
    filter: "news",
  }, i));
  const rel = (releases?.releases || []).map((r, i) => {
    const price = r.market?.price;
    const priceDate = r.market?.date;
    const extra = price != null ? " Price on file " + money(price) + (priceDate ? " on " + priceDate : "") + "." : "";
    return row({
      title: r.name,
      detail: "Type " + (r.type || "No type") + ". Release " + (r.date || "No date") + ". Checked " + (r.checked || "No date") + "." + extra,
      source: r.source || releases?.source || "",
      date: r.date || r.checked || "",
      price: num(price),
      filter: "releases",
    }, 100 + i);
  });
  return news.concat(rel);
}

function readRows(doc) {
  return (doc?.rows || []).map((r, i) => {
    let turned = "Not scored yet.";
    let filter = "unscored";
    if (r.moved === true) { turned = "Moved the way the read described."; filter = "moved"; }
    else if (r.moved === false) { turned = "Did not move the way the read described."; filter = "not"; }
    const kind = r.kind === "sealed" ? "Sealed." : "Single.";
    const ask = isAskSource(r.source);
    const prices = ask
      ? "No TCGplayer price on file for this read."
      : "Price then " + money(r.priceThen) + ". Price now " + money(r.priceNow) + ".";
    return row({
      title: r.kind === "sealed" ? sealedName(r.name) : cleanText(r.name),
      detail: kind + " " + (ask ? "" : (r.said || "") + " ") + prices + " " + turned,
      source: ask ? "Listings counted on eBay" : (r.source || ""),
      date: r.date || "",
      price: ask ? null : num(r.priceNow),
      filter,
    }, i);
  });
}

function eraFilters(doc) {
  const eras = [];
  for (const s of doc?.sets || []) {
    if (s.era && !eras.includes(s.era)) eras.push(s.era);
  }
  return [["all", "All eras"]].concat(eras.map((e) => [e, e]));
}

export function logSpec(id, docs) {
  const sets = docs?.sets;
  const listings = docs?.listings;
  const movers = docs?.movers;
  const meter = docs?.meter;
  const today = docs?.today;
  const releases = docs?.releases;
  const track = docs?.track;
  if (id === "sets") {
    return {
      title: "Sets",
      intro: sets ? "File date " + (sets.asOf || "No date") + "." : "This file did not load.",
      rows: sets ? setsRows(sets) : [],
      filters: eraFilters(sets),
      sorts: [["name", "Name"], ["release", "Release"], ["price", "Value"]],
      defSort: "name",
    };
  }
  if (id === "sealed") {
    return {
      title: "Sealed",
      intro: movers ? "File date " + (movers.asOf || "No date") + ". Sealed only." : "This file did not load.",
      rows: movers ? sealedRows(movers) : [],
      filters: [["all", "All"], ["rising", "Rising"], ["falling", "Falling"]],
      sorts: [["name", "Name"], ["published", "As published"], ["price", "Price"], ["move", "Change"]],
      defSort: "name",
    };
  }
  if (id === "singles") {
    return {
      title: "Singles",
      intro: movers ? "File date " + (movers.asOf || "No date") + "." : "This file did not load.",
      rows: movers ? singleRows(movers) : [],
      filters: [["all", "All"], ["rising", "Rising"], ["falling", "Falling"]],
      sorts: [["name", "Name"], ["published", "As published"], ["price", "Price"], ["move", "Change"]],
      defSort: "name",
    };
  }
  if (id === "listings") {
    return {
      title: "Listings counted",
      intro: listings ? "File date " + (listings.asOf || "No date") + "." : "This file did not load.",
      rows: listings ? listingRows(listings) : [],
      filters: [["all", "All"]],
      sorts: [["name", "Name"], ["count", "Listings counted"]],
      defSort: "name",
    };
  }
  if (id === "history") {
    return {
      title: "Price history",
      intro: movers ? "First and last point on file. File date " + (movers.asOf || "No date") + "." : "This file did not load.",
      rows: movers ? historyRows(movers) : [],
      filters: [["all", "All"], ["single", "Singles"], ["sealed", "Sealed"]],
      sorts: [["name", "Name"], ["date", "Newest end date"], ["move", "Change"]],
      defSort: "name",
    };
  }
  if (id === "pulse") {
    return {
      title: "Pulse",
      intro: meter ? "File date " + (meter.asOf || "No date") + "." : "This file did not load.",
      rows: meter ? pulseRows(meter, "market").map((r) => ({ ...r, filter: "market" }))
        .concat(pulseRows(meter, "singles").map((r) => ({ ...r, filter: "singles" })))
        .concat(pulseRows(meter, "sealed").map((r) => ({ ...r, filter: "sealed" })))
        .concat(pulseRows(meter, "vintage").map((r) => ({ ...r, filter: "vintage" })))
        .concat(pulseRows(meter, "modern").map((r) => ({ ...r, filter: "modern" }))) : [],
      filters: [["market", "Market"], ["singles", "Singles"], ["sealed", "Sealed"], ["vintage", "Vintage"], ["modern", "Modern"]],
      sorts: [["date", "Newest"], ["oldest", "Oldest"]],
      defSort: "date",
      defFilter: "market",
    };
  }
  if (id === "news") {
    return {
      title: "News",
      intro: "News lines use the today file. Releases use the release file.",
      rows: newsRows(today, releases),
      filters: [["all", "All"], ["news", "News"], ["releases", "Releases"]],
      sorts: [["date", "Newest"], ["name", "Name"]],
      defSort: "date",
    };
  }
  if (id === "reads") {
    return {
      title: "Reads",
      intro: track ? cleanText(track.summary || "") + " File date " + (track.asOf || "No date") + "." : "This file did not load.",
      rows: track ? readRows(track) : [],
      filters: [["all", "All"], ["moved", "Moved the way described"], ["not", "Did not"], ["unscored", "Not scored yet"]],
      sorts: [["date", "Newest"], ["oldest", "Oldest"], ["name", "Name"]],
      defSort: "date",
    };
  }
  return null;
}

function countLabel(id, docs) {
  if (id === "sets") {
    if (!docs?.sets) return "This file did not load.";
    return (docs.sets.sets || []).length + " sets.";
  }
  if (id === "sealed") {
    if (!docs?.movers) return "This file did not load.";
    return (docs.movers.sealed || []).length + " sealed.";
  }
  if (id === "singles") {
    if (!docs?.movers) return "This file did not load.";
    return (docs.movers.singles || []).length + " singles.";
  }
  if (id === "listings") {
    if (!docs?.listings) return "This file did not load.";
    return (docs.listings.products || []).length + " products.";
  }
  if (id === "history") {
    if (!docs?.movers) return "This file did not load.";
    return historyRows(docs.movers).length + " prices.";
  }
  if (id === "pulse") {
    if (!docs?.meter) return "This file did not load.";
    return pulsePoints(docs.meter.market).length + " market days.";
  }
  if (id === "news") {
    if (!docs?.today && !docs?.releases) return "This file did not load.";
    return newsRows(docs.today, docs.releases).length + " lines.";
  }
  if (id === "reads") {
    if (!docs?.track) return "This file did not load.";
    return (docs.track.rows || []).length + " reads.";
  }
  return "";
}

const CSS = [
  ":root{--bg:#12100e;--txt:#efe9de;--gold:#d9b779;--card:#1c1916;--line:rgba(239,233,222,.14);--muted:rgba(239,233,222,.72)}",
  "*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font:17px/1.45 ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}",
  "a{color:inherit}.wrap{max-width:880px;margin:0 auto;padding:20px 16px 64px}",
  "header.wrap{padding-bottom:0}main.wrap{padding-top:4px}.logo{font-family:inherit;font-weight:700;letter-spacing:-.02em;font-size:22px;color:var(--gold);text-decoration:none;display:inline-flex;align-items:center;min-height:44px}",
  "h1{font-family:inherit;font-weight:700;font-size:34px;letter-spacing:-.03em;margin:8px 0 8px}",
  ".sub,.meta{color:var(--muted)} .sub{margin:0 0 18px}",
  ".choice{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:64px;padding:14px 16px;background:var(--card);border-radius:18px;text-decoration:none;margin:0 0 10px}",
  ".choice b{display:block;font-size:18px}.choice span{color:var(--muted);font-size:14px}",
  "form{display:grid;gap:10px;margin:0 0 16px}",
  "label{display:grid;gap:6px;font-size:13px;color:var(--muted)}",
  "input,select,button{min-height:44px;border-radius:14px;border:1px solid var(--line);background:var(--card);color:var(--txt);font:inherit;padding:0 12px;width:100%}",
  "button{background:var(--txt);color:var(--bg);font-weight:600}",
  ".row{background:var(--card);border-radius:18px;padding:14px 16px;margin:0 0 10px}",
  ".row h2{font-size:18px;line-height:1.3;margin:0 0 6px;font-weight:600}",
  ".row p{margin:0 0 8px}.row .meta{margin:0;font-size:14px}",
  ".back{display:inline-flex;align-items:center;min-height:44px;text-decoration:none;color:var(--gold)}",
  ".note{color:var(--muted);font-size:14px}",
  "h2,p{overflow-wrap:anywhere}",
].join("");

function pageShell(title, body) {
  return "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>" + esc(title) + "</title><style>" + CSS + ".skip{position:absolute;left:8px;top:-60px;z-index:1000;background:#111;color:#fff;padding:8px 12px;border-radius:6px}.skip:focus{top:8px}:focus-visible{outline:2px solid var(--gold);outline-offset:2px}</style></head><body><a class=\"skip\" href=\"#main\">Skip to content</a><header class=\"wrap\"><a class=\"logo\" href=\"/\">Catch'em</a></header><main class=\"wrap\" id=\"main\" tabindex=\"-1\">" + body + "</main></body></html>";
}

function options(list, current) {
  return list.map(([id, label]) => "<option value=\"" + esc(id) + "\"" + (id === current ? " selected" : "") + ">" + esc(label) + "</option>").join("");
}

function rowHtml(r) {
  const title = r.href ? "<a href=\"" + esc(r.href) + "\">" + esc(r.title) + "</a>" : esc(r.title);
  const source = r.source || "No source on file";
  const date = r.date || "No date on file";
  const sourceLine = source.endsWith(".") ? source : source + ".";
  return "<article class=\"row\"><h2>" + title + "</h2><p>" + esc(r.detail) + "</p><p class=\"meta\">Source: " + esc(sourceLine) + " Date: " + esc(date) + ".</p></article>";
}

export function renderExplorer(id, docs, query = {}) {
  if (!id) {
    const choices = LOGS.map(([lid, title, blurb]) => {
      return "<a class=\"choice\" href=\"/data-explorer/" + lid + "\"><span><b>" + esc(title) + "</b><span>" + esc(blurb) + "</span></span><span>" + esc(countLabel(lid, docs)) + "</span></a>";
    }).join("");
    return pageShell("Data Explorer", "<h1>Data Explorer</h1><p class=\"sub\">Browse one published Catch'em file at a time. Pick a list to open.</p>" + choices + "<p class=\"note\">Rows come from published Catch'em files. This page does not scrape.</p>");
  }
  const spec = logSpec(id, docs);
  if (!spec) {
    return pageShell("Not found", "<a class=\"back\" href=\"/data-explorer\">Data Explorer</a><h1>That log is not on file.</h1>");
  }
  const defFilter = spec.defFilter || "all";
  const q = { q: query.q || "", filter: query.filter || defFilter, sort: query.sort || "" };
  const view = applyQuery(spec.rows, q, spec.sorts, spec.filters, spec.defSort, defFilter);
  const form = "<form method=\"get\" action=\"/data-explorer/" + esc(id) + "\" role=\"search\"><label>Search<input name=\"q\" value=\"" + esc(query.q || "") + "\" placeholder=\"Search this log\"></label>"
    + (spec.filters.length > 1 ? "<label>Filter<select name=\"filter\">" + options(spec.filters, view.filter) + "</select></label>" : "")
    + "<label>Sort<select name=\"sort\">" + options(spec.sorts, view.sort) + "</select></label><button type=\"submit\">Show</button></form>";
  const shown = view.rows.length
    ? view.rows.map(rowHtml).join("")
    : "<p class=\"row\">No rows match.</p>";
  const more = view.total > view.rows.length ? "<p class=\"note\">Showing " + view.rows.length + " of " + view.total + ". Search to narrow.</p>" : "";
  const body = "<a class=\"back\" href=\"/data-explorer\">Data Explorer</a><h1>" + esc(spec.title) + "</h1><p class=\"sub\">" + esc(spec.intro) + "</p>" + form + shown + more;
  return pageShell(spec.title + ", Data Explorer", body);
}

export async function loadDocs(fetchImpl = fetch) {
  const now = Date.now();
  if (cache && now - cacheAt < 5 * 60 * 1000) return cache;
  const entries = await Promise.all(Object.entries(FILES).map(async ([key, path]) => {
    try {
      const res = await fetchRepo(path, fetchImpl, { cf: { cacheTtl: 300 } });
      if (!res || !res.ok) return [key, null];
      return [key, await res.json()];
    } catch {
      return [key, null];
    }
  }));
  cache = Object.fromEntries(entries);
  cacheAt = now;
  return cache;
}

export function explorerLog(pathname) {
  const path = norm(pathname);
  if (path === "/data-explorer") return "";
  if (!path.startsWith("/data-explorer/")) return null;
  const rest = path.slice("/data-explorer/".length);
  if (!rest || rest.includes("/")) return "missing";
  return LOGS.some(([id]) => id === rest) ? rest : "missing";
}

export async function dataExplorerResponse(request, env = {}) {
  const url = new URL(request.url);
  const id = explorerLog(url.pathname);
  if (id == null) return null;
  const docs = await loadDocs(env.PUBLIC_FETCH || fetch);
  const html = id === "missing"
    ? renderExplorer("missing", docs, {})
    : renderExplorer(id, docs, { q: url.searchParams.get("q") || "", filter: url.searchParams.get("filter") || "", sort: url.searchParams.get("sort") || "" });
  const status = id === "missing" ? 404 : 200;
  return new Response(request.method === "HEAD" ? null : html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}
