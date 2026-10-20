// Interest order for the feed lead. No cutoff numbers live here.
// Each export is self-contained so the feed page can inline it.
// The same math is in Catchem-data scripts/lib/feed-rank.mjs.

export function readMove(read) {
  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function pair(a, b) {
    const x = num(a);
    const y = num(b);
    return x != null && y != null ? [x, y] : null;
  }
  const rec = read && read.receipt && typeof read.receipt === "object" ? read.receipt : {};
  let got = null;
  if (typeof rec.from !== "string" && typeof rec.to !== "string") got = pair(rec.from, rec.to);
  if (!got) got = pair(rec.fromPrice, rec.toPrice);
  if (!got && rec.then && typeof rec.then === "object") got = pair(rec.then.price, rec.now && rec.now.price);
  if (!got && rec.start && typeof rec.start === "object") got = pair(rec.start.price, rec.end && rec.end.price);
  if (!got) got = pair(rec.askFrom, rec.askTo);
  if (!got) got = pair(rec.marketFrom, rec.marketTo);
  if (!got) got = pair(rec.sealedFrom, rec.sealedTo);
  if (!got) got = pair(rec.chaseFrom, rec.chaseTo);
  let from = got ? got[0] : 0;
  let to = got ? got[1] : 0;
  let price = num(read && read.price);
  if (!(price > 0) && to > 0) price = to;
  if (!(price > 0) && rec.now && typeof rec.now === "object") price = num(rec.now.price);
  if (!(price > 0)) price = num(rec.now);
  if (!(price > 0)) price = num(rec.price);
  let dollars = from > 0 && to > 0 ? Math.abs(to - from) : 0;
  let pct = Math.abs(num(read && read.changePct) || 0);
  if (!(pct > 0) && from > 0 && dollars > 0) pct = Math.abs((to - from) / from) * 100;
  if (!(pct > 0)) pct = Math.abs(num(rec.pct) || num(rec.week) || 0);
  function textMove(text) {
    const s = String(text || "");
    if (!s) return null;
    const mv = s.match(/\$(\d[\d,]*(?:\.\d+)?)[^$]{0,48}?\bto\b[^$]{0,24}?\$(\d[\d,]*(?:\.\d+)?)/i);
    if (!mv) return null;
    const tf = Number(mv[1].replace(/,/g, ""));
    const tt = Number(mv[2].replace(/,/g, ""));
    if (!(tf > 0) || !(tt > 0)) return null;
    let tp = 0;
    const pm = s.match(/(?:Up|Down|\()\s*([+-]?\d+(?:\.\d+)?)\s*%/i);
    if (pm) tp = Math.abs(Number(pm[1]));
    return { from: tf, to: tt, dollars: Math.abs(tt - tf), pct: tp };
  }
  const MOVE_TEXT = { single: 1, sealed: 1, plain: 1, streak: 1, mover: 1, solddown: 1, soldflat: 1, askmove: 1, mktmove: 1, turned: 1, mixed: 1, year: 1, "year-ago": 1, season: 1, "pattern-forming": 1, "pattern-ending": 1, sealedchase: 1, high: 1, backto: 1 };
  const kind = String((read && (read.readKind || read.kind)) || "");
  const moveKind = !!MOVE_TEXT[kind] || String((read && read.id) || "").indexOf("move-") === 0;
  let told = textMove(read && read.headline);
  if (!told || !(told.pct > 0)) {
    const alt = textMove(read && read.path);
    if (alt && (alt.pct > 0 || !told)) told = alt;
  }
  if (told && (!(from > 0) || !(to > 0)) && (pct > 0 || told.pct > 0 || moveKind)) {
    from = told.from;
    to = told.to;
    if (!(dollars > 0)) dollars = told.dollars;
    if (!(pct > 0) && told.pct > 0) pct = told.pct;
    if (!(pct > 0) && from > 0) pct = Math.abs((to - from) / from) * 100;
  }
  if (!(price > 0) && to > 0) price = to;
  return { price: price > 0 ? price : 0, dollars, pct, from, to };
}

export function interestScore(read) {
  const QUIET_KINDS = { news: 1, newsline: 1, wave: 1, pokemon: 1, rotation: 1, release: 1 };
  const MOVE_KINDS = { single: 1, sealed: 1, plain: 1, streak: 1, mover: 1, solddown: 1, soldflat: 1, askmove: 1, mktmove: 1, turned: 1, mixed: 1, year: 1, "year-ago": 1, season: 1, "pattern-forming": 1, "pattern-ending": 1, sealedchase: 1, high: 1, backto: 1 };
  if (!read || typeof read !== "object") return 0;
  const kind = String(read.readKind || read.kind || "");
  if (QUIET_KINDS[kind]) return 0;
  const m = readMove(read);
  if (!(m.dollars > 0) || !(m.pct > 0)) return 0;
  let score = m.dollars * m.pct;
  if (m.price > 0) score += Math.log10(m.price + 1) * Math.max(m.pct, 1);
  const tags = Array.isArray(read.tags) ? read.tags.join(" ") : "";
  const sealed = kind === "sealed" || kind === "listings" || kind === "rip" || kind === "sealedchase" || /^\/p\//.test(String(read.href || ""));
  const chase = /illustration rare|special illustration|hyper rare|secret rare/i.test(tags) || kind === "sealedchase";
  if (sealed) score *= 1.35;
  if (chase) score *= 1.15;
  const strength = (Array.isArray(read.signals) ? read.signals : []).reduce(function (max, s) { return Math.max(max, Number(s && s.strength) || 0); }, 0);
  if (strength) score *= 1 + strength / 20;
  if (!MOVE_KINDS[kind] && String(read.id || "").indexOf("move-") !== 0) score *= 0.15;
  return score;
}

export function rankLead(rows, n) {
  const slots = n || 8;
  const lead = [];
  const rest = [];
  const scored = [];
  const list = rows || [];
  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    if (!row || row.pending || row.skip) { rest.push(row); continue; }
    if (interestScore(row) > 0) scored.push(row);
    else rest.push(row);
  }
  scored.sort(function (a, b) { return interestScore(b) - interestScore(a) || String(a.id).localeCompare(String(b.id)); });
  return { lead: scored.slice(0, slots), rest: scored.slice(slots).concat(rest) };
}

export function pinIds(rows, ids, n) {
  if (!Array.isArray(ids) || !ids.length) return null;
  const slots = n || 8;
  const by = {};
  const list = rows || [];
  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    if (row && row.id != null && !Object.prototype.hasOwnProperty.call(by, String(row.id))) by[String(row.id)] = row;
  }
  const lead = [];
  const used = {};
  for (let i = 0; i < ids.length; i++) {
    const row = by[String(ids[i])];
    if (!row || used[String(ids[i])]) continue;
    lead.push(row);
    used[String(ids[i])] = 1;
    if (lead.length >= slots) break;
  }
  if (!lead.length) return null;
  const rest = list.filter(function (row) { return !row || !used[String(row.id)]; });
  return { lead: lead, rest: rest };
}

export function listingsWording(text) {
  let s = String(text ?? "");
  if (!s) return s;
  const swaps = [
    [/No sold counts on file/g, "No listings counted on file"],
    [/No sold count is on file, so no volume read ships\./g, "No count is on file, so no volume read ships."],
    [/No sold count is on this read/g, "No listings count is on this read"],
    [/No sold counts/g, "No listings counted"],
    [/No sold count/g, "No listings count"],
    [/No TCGplayer sales recorded/g, "No TCGplayer listings counted"],
    [/Sales and a price change/g, "Listings counted and a price change"],
    [/Share of copies sold/g, "Share of listings counted"],
    [/copies that sold/gi, "listings counted"],
    [/Not sold prices/g, "Not completed prices"],
    [/Asks are not sales/g, "Asks are not listings gone"],
    [/Not sales\./g, "Not listings gone."],
    [/copies sold/gi, "listings counted"],
    [/copy sold/gi, "listing counted"],
    [/\bsales\b/gi, "listings counted"],
    [/\bsold\b/gi, "listings counted"],
  ];
  for (let i = 0; i < swaps.length; i++) s = s.replace(swaps[i][0], swaps[i][1]);
  return s;
}

export function glanceChips(card) {
  if (!card || typeof card !== "object" || card.waveItem) return "";
  function e(s) {
    return String(s ?? "").replace(/&/g, "&" + "amp;").replace(/</g, "&" + "lt;").replace(/>/g, "&" + "gt;").replace(/"/g, "&" + "quot;");
  }
  function svg(d) {
    return '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="' + d + '"/></svg>';
  }
  function chip(cls, icon, text) {
    return '<span class="qchip' + (cls ? " " + cls : "") + '">' + icon + "<span>" + e(text) + "</span></span>";
  }
  const parts = [];
  const m = readMove(card);
  const down = (m.from > 0 && m.to > 0 && m.to < m.from) || Number(card.changePct) < 0;
  const up = (m.from > 0 && m.to > 0 && m.to > m.from) || Number(card.changePct) > 0;
  if (m.pct >= 0.05 && (up || down)) {
    parts.push(chip(down ? "is-down" : "is-up", svg(down ? "M8 3v8M5 8l3 3 3-3" : "M8 13V5M5 8l3-3 3 3"), (down ? "Down " : "Up ") + (Math.round(m.pct * 10) / 10) + "%"));
  }
  if (m.price > 0) {
    const dollars = "$" + m.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    parts.push(chip("", svg("M3 6h10v7H3zM5 6V4h6v2"), dollars));
  }
  const rec = card.receipt && typeof card.receipt === "object" ? card.receipt : {};
  const listed = Number.isInteger(rec.sold) ? rec.sold : (Number.isInteger(rec.n) ? rec.n : (Number.isInteger(rec.listingCount) ? rec.listingCount : null));
  if (listed != null) parts.push(chip("", svg("M3 11h10M4 8h8M5 5h6"), listed + (listed === 1 ? " listing counted" : " listings counted")));
  const set = String(card.set || "").trim();
  if (set && !/^tcgcsv/i.test(set) && set.length <= 32) parts.push(chip("", svg("M2 8h12M8 2v12"), set));
  if (!parts.length) {
    const day = String(card.asOf || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) parts.push(chip("", svg("M3 4h10v9H3zM3 7h10"), day));
  }
  if (!parts.length) return "";
  return '<div class="qrow" aria-label="Quick read">' + parts.join("") + "</div>";
}
