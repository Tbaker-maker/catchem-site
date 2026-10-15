// Read-page deep sheet. Every figure comes from the read or a field passed in.
// A missing figure is left out. No invented prices.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "\u0026amp;", "<": "\u0026lt;", ">": "\u0026gt;", '"': "\u0026quot;", "'": "\u0026#39;" }[c]));

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return "";
  return "$" + x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dayLabel(iso) {
  const s = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(s.slice(5, 7)) - 1]} ${Number(s.slice(8, 10))}, ${s.slice(0, 4)}`;
}

function asPct(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  const shown = Math.abs(v) <= 1 && v !== 0 ? v * 100 : v;
  return Math.round(shown * 10) / 10;
}

function signedPct(n) {
  const v = asPct(n);
  if (v == null) return "";
  return (v > 0 ? "+" : "") + v + "%";
}

function safeSrc(src) {
  const s = String(src || "").trim();
  if (!s || /["'<>\s]/.test(s)) return "";
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  if (/^https:\/\/(catchemtcg\.com|images\.pokemontcg\.io|tcgplayer-cdn\.tcgplayer\.com)\//.test(s)) return s;
  return "";
}

// "Misty's Psyduck - 193/182" -> "Misty's Psyduck". Display only.
export function cleanTitle(name) {
  return String(name || "").replace(/\s+-\s+[A-Za-z]{0,4}\d+[A-Za-z]?(?:\/[A-Za-z]{0,4}\d+)?\s*$/, "").trim() || String(name || "");
}

function sameName(a, b) {
  const bare = (v) => String(v || "").trim().toLowerCase().replace(/^[^:]{1,12}:\s*/, "");
  const x = String(a || "").trim().toLowerCase();
  const y = String(b || "").trim().toLowerCase();
  return !!x && !!y && (x === y || bare(x) === bare(y));
}

export function patternSentence(read) {
  const rec = read?.receipt && typeof read.receipt === "object" ? read.receipt : null;
  if (!rec) return null;
  const gate = rec.gate && typeof rec.gate === "object" ? rec.gate : rec;
  const name = String(rec.pattern || "").toLowerCase();
  const stage = String(rec.stage || "").toLowerCase();
  if (/stair|slow-climb|slowclimb|sealed-slow/.test(name) && stage !== "confirmed" && stage !== "passed") return null;
  const rate = asPct(gate.rate);
  const base = asPct(gate.baseRate);
  const n = Number(gate.n);
  const days = Number(gate.horizon);
  if (rate == null || base == null || !(n > 0) || !(days > 0)) return null;
  return {
    text: `This pattern was right ${rate}% of the time vs ${base}% normally, over ${Math.round(n)} cases, looking ${Math.round(days)} days ahead.`,
    era: rec.eraHeld === true || rec.erasHeld === true,
    asOf: String(read.asOf || read.endDate || "").slice(0, 10),
    source: String(read.source || "").trim(),
  };
}

export function priceBits(read) {
  const rows = Array.isArray(read?.prices) ? read.prices : [];
  const tcg = rows.find((row) => row && String(row.source || "").toLowerCase() === "tcgplayer" && Number(row.amount) > 0);
  const ebay = rows.find((row) => row && String(row.source || "").toLowerCase() === "ebay" && Number(row.amount) > 0);
  const out = [];
  if (tcg) {
    const nm = read?.kind !== "sealed" && read?.item?.kind !== "sealed" && /near mint|^nm$/i.test(String(tcg.label || tcg.condition || ""));
    const when = dayLabel(tcg.date);
    out.push(`${nm ? "NM " : ""}${money(tcg.amount)} TCGplayer${when ? `, ${when}` : ""}`);
  }
  if (ebay) {
    const cond = String(ebay.label || ebay.condition || "").trim();
    const when = dayLabel(ebay.date);
    out.push(`eBay ask ${money(ebay.amount)}${cond ? ` (${cond})` : ""}${when ? `, ${when}` : ""}`);
  }
  let gap = "";
  if (tcg && ebay && tcg.date && ebay.date) {
    const diff = Math.round((Number(ebay.amount) - Number(tcg.amount)) * 100) / 100;
    if (diff !== 0) gap = `eBay ask is ${money(Math.abs(diff))} ${diff > 0 ? "above" : "under"} the TCGplayer price`;
  }
  return { line: out.join(". "), gap };
}

function chip(text) {
  const s = String(text || "").trim();
  return s ? `<li class="rd-chip">${esc(s)}</li>` : "";
}

function changeChip(label, pct, from, to) {
  const shown = signedPct(pct);
  const a = dayLabel(from);
  const b = dayLabel(to);
  if (!shown || !a || !b) return "";
  return chip(`${label} ${shown}, ${a} to ${b}`);
}

function listingsChip(read) {
  const kind = String(read?.readKind || read?.kind || "");
  const rec = read?.receipt && typeof read.receipt === "object" ? read.receipt : {};
  const fromListings = kind === "listings";
  const n = fromListings && Number.isInteger(Number(rec.n))
    ? Number(rec.n)
    : (Number.isInteger(Number(read?.listings)) ? Number(read.listings) : null);
  const day = dayLabel(fromListings ? (rec.date || read?.listingsAsOf) : read?.listingsAsOf);
  if (n == null || n < 0 || !day) return "";
  const prev = fromListings ? Number(rec.prev) : NaN;
  const prevDay = fromListings ? dayLabel(rec.prevDate) : "";
  let change = "";
  if (prev > 0 && prevDay) {
    const pct = Math.round(((n - prev) / prev) * 1000) / 10;
    change = `, 7-day ${pct > 0 ? "+" : ""}${pct}% from ${prevDay}`;
  }
  return chip(`${n} listings counted, ${day}${change}`);
}

function chipsFor(read, ctx) {
  const bits = [];
  const listed = listingsChip(read);
  if (listed) bits.push(listed);
  const days = Number(read?.windowDays);
  const pct = read?.changePct;
  const from = read?.startDate;
  const to = read?.endDate || read?.asOf;
  if (days === 7) bits.push(changeChip("7-day", pct, from, to));
  if (days === 30 || Number(read?.change30)) {
    const p = days === 30 ? pct : read.change30;
    bits.push(changeChip("30-day", p, days === 30 ? from : "", days === 30 ? to : read.asOf));
  }
  if (days >= 360) bits.push(changeChip("1Y", pct, from, to));
  else if (Number.isFinite(Number(read?.change365))) bits.push(changeChip("1Y", read.change365, "", read.asOf));
  const rot = ctx.rotation;
  if (rot && (rot.mark || rot.status)) {
    const when = dayLabel(rot.asOf);
    const mark = rot.mark ? `Mark ${rot.mark}` : "";
    const status = rot.status ? String(rot.status) : "";
    const countdown = dayLabel(rot.until) && rot.daysLeft >= 0 ? `, ${rot.daysLeft} days until ${dayLabel(rot.until)}` : "";
    if (when) bits.push(chip([mark, status].filter(Boolean).join(" · ") + `, as of ${when}` + countdown));
  }
  const tags = Array.isArray(read?.tags) ? read.tags.map((tag) => String(tag || "").trim()).filter(Boolean) : [];
  if (tags.length) bits.push(chip(tags.join(" · ")));
  const prices = priceBits(read);
  if (prices.gap) bits.push(chip(prices.gap));
  if (read?.stale === true && dayLabel(read.asOf)) bits.push(chip(`Stale as of ${dayLabel(read.asOf)}`));
  return bits.filter(Boolean).join("");
}

// Rotation, tag and stale chips shared by both paths.
function rotTagChips(read, ctx) {
  const out = [];
  const rot = ctx.rotation;
  if (rot && (rot.mark || rot.status) && dayLabel(rot.asOf)) out.push(chip([rot.mark ? `Mark ${rot.mark}` : "", rot.status || ""].filter(Boolean).join(" · ") + `, as of ${dayLabel(rot.asOf)}`));
  const tags = Array.isArray(read?.tags) ? read.tags.map((tag) => String(tag || "").trim()).filter(Boolean) : [];
  if (tags.length) out.push(chip(tags.join(" · ")));
  if (read?.stale === true && dayLabel(read.asOf)) out.push(chip(`Stale as of ${dayLabel(read.asOf)}`));
  return out;
}

function contextCard(title, row) {
  const text = String(row?.headline || row?.path || "").trim();
  if (!text || /[\u2014\u2013]/.test(text)) return "";
  const when = dayLabel(row.asOf || row.endDate);
  const src = String(row.source || "").trim();
  const note = [src, when].filter(Boolean).join(" · ");
  return `<article class="rd-card"><h3>${esc(title)}</h3><p>${esc(text)}</p>${note ? `<p class="muted">${esc(note)}</p>` : ""}</article>`;
}

function similarCards(read, reads) {
  const set = read?.set;
  const rows = (reads || []).filter((row) => row && row !== read && row.id !== read.id && sameName(row.set, set) && safeSrc(row.image) && String(row.number || "").trim() && String(row.href || "").startsWith("/"));
  return rows.slice(0, 4).map((row) => {
    const href = String(row.href);
    return `<a class="rd-sim" href="${esc(href)}"><img alt="" src="${esc(safeSrc(row.image))}" width="44" height="62"><span><b>${esc(row.name || "Card")}</b><small>${esc(row.number)}${money(row.price) ? ` · ${money(row.price)}` : ""}</small></span></a>`;
  }).join("");
}

// Facts values are already percents (0.6 means 0.6%).
const pp = (n) => (Number.isFinite(Number(n)) ? (Number(n) > 0 ? "+" : "") + Math.round(Number(n) * 10) / 10 + "%" : "");
const shortDay = (iso) => dayLabel(iso).replace(/, \d{4}$/, "");
const KEY_WORDS = {
  "set_age=under_90d": "set under 90 days old", "set_age=under_1y": "set under 1 year old", "set_age=1_to_3y": "set 1 to 3 years old", "set_age=over_3y": "set over 3 years old",
  "rotation_stage=current": "current era", "rotation_stage=previous": "previous era, still in Standard", "rotation_stage=rotated": "rotated out of Standard", "rotation_stage=older": "older era",
};

function card(title, text, note) {
  const t = String(text || "").trim();
  if (!t || /[\u2014\u2013]/.test(t)) return "";
  return `<article class="rd-card"><h3>${esc(title)}</h3><p>${esc(t)}</p>${note ? `<p class="muted">${esc(note)}</p>` : ""}</article>`;
}

// Facts file (Catchem-data feed/facts/<id>.json). Every line keeps its date.
export function factChips(f) {
  if (!f || typeof f !== "object") return [];
  const out = [];
  const l = f.listings;
  if (l && Number.isInteger(l.n) && dayLabel(l.date)) {
    let tail = "";
    if (Number.isFinite(l.pct) && dayLabel(l.prevDate)) tail = `, ${l.span >= 7 ? "7-day" : `${l.span}-day`} ${pp(l.pct)} from ${shortDay(l.prevDate)}`;
    out.push(chip(`${l.n} listings counted, ${shortDay(l.date)}${tail}`));
  }
  const c = f.change || {};
  if (c.d30 && dayLabel(c.d30.from)) out.push(chip(`30-day ${pp(c.d30.pct)}, ${shortDay(c.d30.from)} to ${shortDay(c.d30.to)}`));
  if (c.y1 && dayLabel(c.y1.from)) out.push(chip(`1Y ${pp(c.y1.pct)}, ${dayLabel(c.y1.from)} to ${dayLabel(c.y1.to)}`));
  const g = f.gap;
  if (g && g.ebay > 0 && g.tcg > 0 && g.diff && dayLabel(g.ebayDate)) out.push(chip(`eBay ask ${money(g.ebay)} vs TCGplayer ${money(g.tcg)} (${pp(g.pct)}), ${shortDay(g.ebayDate)}`));
  return out.filter(Boolean);
}

export function factCards(f) {
  const none = { range: "", pattern: "", cards: [], similar: "" };
  if (!f || typeof f !== "object") return none;
  const r = f.range;
  let range = "";
  if (r && r.high && r.low && dayLabel(r.high.date) && dayLabel(r.low.date) && r.high.date !== r.low.date) {
    const lines = [
      `High ${money(r.high.price)} on ${dayLabel(r.high.date)}. Low ${money(r.low.price)} on ${dayLabel(r.low.date)}.`,
      r.daysSinceHigh > 0 && Number.isFinite(r.fromHighPct) ? `${r.daysSinceHigh} days since the last high, now ${Math.abs(r.fromHighPct)}% under it.` : (r.daysSinceHigh === 0 ? "At its high on file tonight." : ""),
      f.rank && f.rank.rank > 0 ? `No. ${f.rank.rank} of ${f.rank.of} by price in ${f.rank.set}.` : "",
    ].filter(Boolean);
    range = `<article class="rd-card"><h3>High and low</h3>${lines.map((x) => `<p>${esc(x)}</p>`).join("")}<p class="muted">${esc(`TCGplayer market, ${dayLabel(r.from)} to ${dayLabel(r.now?.date || f.asOf)}`)}</p></article>`;
  }
  let pattern = "";
  const p = f.pattern;
  if (p && p.rate > 0 && p.base > 0 && p.n > 0 && p.horizon > 0) {
    const when = (p.keys || []).map((k) => KEY_WORDS[k]).filter(Boolean).join(", ");
    pattern = `<section class="rd-pattern"><h3>Passed scanner pattern</h3><p>${esc(`This pattern was right ${p.rate}% of the time vs ${p.base}% normally, over ${p.n} cases, looking ${p.horizon} days ahead.`)}</p>${when ? `<p>${esc(`Matches this item: ${when}.`)}</p>` : ""}<p class="muted">${esc(`Own nightly days only, later time split. ${dayLabel(p.asOf)}`)}</p></section>`;
  }
  const cards = [];
  const m = f.setMomentum;
  if (m && Number.isFinite(m.pct) && dayLabel(m.from)) cards.push(card("Set momentum", `${m.set} ${m.kind} index ${pp(m.pct)}, ${shortDay(m.from)} to ${shortDay(m.to)}.`, "Chain-linked TCGplayer market index"));
  const rb = f.rarityBand;
  if (rb && rb.n > 0) cards.push(card("Rarity band", `${rb.n} ${rb.rarity} cards in ${rb.set}: median ${pp(rb.median)} over 30 days, ${rb.up} up, ${rb.down} down.`, `TCGplayer market, ${shortDay(rb.from)} to ${shortDay(rb.to)}`));
  const ab = f.artistBand;
  if (ab && ab.n > 0) cards.push(card("Artist band", `${ab.n} priced cards by ${ab.artist}: median ${pp(ab.median)} over 30 days, ${ab.up} up, ${ab.down} down.`, `TCGplayer market, ${shortDay(ab.from)} to ${shortDay(ab.to)}`));
  const v = f.variants;
  if (Array.isArray(v) && v.length >= 2) cards.push(card("Variants", v.map((x) => `${x.name} ${money(x.price)}`).join(" · "), `TCGplayer market, ${dayLabel(v[0].asOf)}`));
  const rip = f.rip;
  if (rip && rip.contentsEV > 0 && rip.price > 0) cards.push(card("Rip value", `Expected contents ${money(rip.contentsEV)} vs ${money(rip.price)} sealed (${pp(rip.roiPct)}).${Number.isFinite(rip.beatChance) ? ` ${rip.beatChance}% of simulated openings beat the price.` : ""}`, `History-based estimate from dated pull rates, ${dayLabel(rip.asOf)}. Not advice`));
  const sims = (Array.isArray(f.similar) ? f.similar : []).filter((x) => safeSrc(x.image) && String(x.href || "").startsWith("/")).slice(0, 4).map((x) =>
    `<a class="rd-sim" href="${esc(x.href)}"><img alt="" loading="lazy" src="${esc(safeSrc(x.image))}" width="44" height="62"><span><b>${esc(cleanTitle(x.name))}</b><small>${esc([x.number, money(x.price)].filter(Boolean).join(" · "))}</small></span></a>`).join("");
  const similar = sims ? `<article class="rd-card"><h3>Similar by price in this set</h3><div class="rd-sims">${sims}</div><p class="muted">${esc(`TCGplayer market, ${dayLabel(f.asOf)}`)}</p></article>` : "";
  return { range, pattern, cards: cards.filter(Boolean), similar };
}

const SHEET_CSS = `<style>
.read-sheet{display:grid;gap:12px;margin:8px 0 16px}
.rd-hero{display:flex;gap:12px;align-items:flex-start}
.rd-hero img.rd-face{width:120px;height:auto;border-radius:16px;background:#141416;object-fit:contain}
.rd-logo{height:28px;width:auto;border-radius:8px;background:#1a1815}
.rd-meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:4px 0}
.rd-chips{display:flex;gap:8px;overflow-x:auto;list-style:none;margin:0;padding:0 0 4px}
.rd-chip{flex:none;min-height:44px;display:inline-flex;align-items:center;padding:0 14px;border-radius:999px;background:rgba(255,255,255,.06);font:600 14px/1.2 var(--sans)}
.rd-pattern h3,.rd-card h3{margin:0 0 6px;font-size:15px}.rd-pattern p,.rd-card p{margin:0 0 6px}
.rd-pattern,.rd-card{padding:14px 16px;border-radius:18px;background:#1a1815;border:1px solid #2f2b26}
.rd-era{display:inline-flex;align-items:center;min-height:32px;margin-top:8px;padding:0 10px;border-radius:999px;color:#d9b779;background:rgba(217,183,121,.12)}
.rd-cards{display:grid;gap:10px}
.rd-sims{display:flex;flex-direction:column;gap:8px}
.rd-sim{display:flex;gap:8px;align-items:center;min-height:44px;color:inherit;text-decoration:none}
.rd-sim img{width:44px;height:62px;object-fit:contain;border-radius:8px;background:#141416}
.rd-sim small{display:block;color:var(--dim);font-weight:500;font-size:14px}
@media(min-width:800px){.rd-cards{grid-template-columns:1fr 1fr}.rd-sims{flex-direction:row;flex-wrap:wrap}}
</style>`;

export function readSheet(read, ctx = {}) {
  if (!read || typeof read !== "object") return "";
  const meta = ctx.meta && typeof ctx.meta === "object" ? ctx.meta : {};
  const face = safeSrc(read.image);
  const logo = safeSrc(ctx.logo);
  const facts = ctx.facts && typeof ctx.facts === "object" && ctx.facts.id === read.id ? ctx.facts : null;
  const it = facts?.item || {};
  const number = String(read.number || meta.num || it.number || "").trim();
  const rarity = String(meta.rarity || it.rarity || "").trim();
  const artist = String(meta.artist || it.artist || "").trim();
  const prices = it.price > 0 && dayLabel(it.priceAsOf)
    ? { line: `${it.kind === "sealed" ? "" : "NM "}${money(it.price)} TCGplayer, ${dayLabel(it.priceAsOf)}`, gap: "" }
    : priceBits(read);
  const name = cleanTitle(String(read.name || meta.name || "").trim());
  const bits = [number, rarity, artist].filter(Boolean);
  const hero = (face || logo || name || bits.length || prices.line)
    ? `<div class="rd-hero">${face ? `<img class="rd-face" alt="" src="${esc(face)}" width="120" height="168">` : ""}<div>${name ? `<h2>${esc(name)}</h2>` : ""}<div class="rd-meta">${logo ? `<img class="rd-logo" alt="" src="${esc(logo)}" height="28">` : ""}${bits.map((bit) => `<span>${esc(bit)}</span>`).join("")}</div>${prices.line ? `<p>${esc(prices.line)}</p>` : ""}</div></div>`
    : "";
  const fc = factCards(facts);
  const chipRow = facts ? [!facts.listings ? listingsChip(read) : "", ...factChips(facts), ...rotTagChips(read, ctx)].filter(Boolean).join("") : chipsFor(read, ctx);
  const chips = chipRow ? `<ul class="rd-chips">${chipRow}</ul>` : "";
  const pattern = patternSentence(read);
  const patternHtml = (!pattern && fc.pattern) ? fc.pattern : pattern
    ? `<section class="rd-pattern"><p>${esc(pattern.text)}</p>${pattern.era ? `<p class="rd-era">Held in every era on file</p>` : ""}${pattern.source || dayLabel(pattern.asOf) ? `<p class="muted">${esc([pattern.source, dayLabel(pattern.asOf)].filter(Boolean).join(" · "))}</p>` : ""}</section>`
    : "";
  const peers = Array.isArray(ctx.reads) ? ctx.reads : [];
  const setName = read.set || meta.set || "";
  const artistName = artist;
  const cards = [
    contextCard("Set momentum", peers.find((row) => (row.readKind === "set" || row.readKind === "breadth") && (sameName(row.set, setName) || sameName(row.name, setName)))),
    contextCard("Rarity band", peers.find((row) => row.readKind === "rarity-band" && (sameName(row.receipt?.set, setName) || sameName(row.name, setName)))),
    contextCard("Artist band", peers.find((row) => row.readKind === "artist-band" && (sameName(row.receipt?.artist, artistName) || sameName(row.name, artistName)))),
    contextCard("Release cycle", peers.find((row) => row.readKind === "release-cycle" && (sameName(row.name, setName) || sameName(row.set, setName)))),
    contextCard("Rip value", peers.find((row) => row.readKind === "rip" && (sameName(row.sku, read.sku) || sameName(row.name, read.name)))),
  ].filter(Boolean).join("");
  const sims = fc.similar ? "" : similarCards(read, peers);
  const have = new Set((fc.cards.join("").match(/<h3>[^<]+<\/h3>/g) || []));
  const peerCards = (cards.match(/<article class="rd-card">[\s\S]*?<\/article>/g) || []).filter((a) => !have.has((a.match(/<h3>[^<]+<\/h3>/) || [""])[0])).join("");
  const all = fc.range + fc.cards.join("") + peerCards + (fc.similar || (sims ? `<article class="rd-card"><h3>Similar cards</h3><div class="rd-sims">${sims}</div></article>` : ""));
  const context = all ? `<div class="rd-cards">${all}</div>` : "";
  if (!hero && !chips && !patternHtml && !context) return "";
  return `<section class="read-sheet" id="read-sheet" aria-label="Read details">${SHEET_CSS}${hero}${chips}${patternHtml}${context}</section>`;
}
