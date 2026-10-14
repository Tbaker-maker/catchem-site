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

function sameName(a, b) {
  const x = String(a || "").trim().toLowerCase();
  const y = String(b || "").trim().toLowerCase();
  return !!x && x === y;
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

function priceBits(read) {
  const rows = Array.isArray(read?.prices) ? read.prices : [];
  const tcg = rows.find((row) => row && String(row.source || "").toLowerCase() === "tcgplayer" && Number(row.amount) > 0);
  const ebay = rows.find((row) => row && String(row.source || "").toLowerCase() === "ebay" && Number(row.amount) > 0);
  const out = [];
  if (tcg) {
    const nm = /near mint|^nm$/i.test(String(tcg.label || tcg.condition || ""));
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

const SHEET_CSS = `<style>
.read-sheet{display:grid;gap:12px;margin:8px 0 16px}
.rd-hero{display:flex;gap:12px;align-items:flex-start}
.rd-hero img.rd-face{width:120px;height:auto;border-radius:16px;background:#141416;object-fit:contain}
.rd-logo{height:28px;width:auto;border-radius:8px;background:#1a1815}
.rd-meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:4px 0}
.rd-chips{display:flex;gap:8px;overflow-x:auto;list-style:none;margin:0;padding:0 0 4px}
.rd-chip{flex:none;min-height:44px;display:inline-flex;align-items:center;padding:0 14px;border-radius:999px;background:rgba(255,255,255,.06);font:600 14px/1.2 var(--sans)}
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
  const number = String(read.number || meta.num || "").trim();
  const rarity = String(meta.rarity || "").trim();
  const artist = String(meta.artist || "").trim();
  const prices = priceBits(read);
  const name = String(read.name || meta.name || "").trim();
  const bits = [number, rarity, artist].filter(Boolean);
  const hero = (face || logo || name || bits.length || prices.line)
    ? `<div class="rd-hero">${face ? `<img class="rd-face" alt="" src="${esc(face)}" width="120" height="168">` : ""}<div>${name ? `<h2>${esc(name)}</h2>` : ""}<div class="rd-meta">${logo ? `<img class="rd-logo" alt="" src="${esc(logo)}" height="28">` : ""}${bits.map((bit) => `<span>${esc(bit)}</span>`).join("")}</div>${prices.line ? `<p>${esc(prices.line)}</p>` : ""}</div></div>`
    : "";
  const chipRow = chipsFor(read, ctx);
  const chips = chipRow ? `<ul class="rd-chips">${chipRow}</ul>` : "";
  const pattern = patternSentence(read);
  const patternHtml = pattern
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
  const sims = similarCards(read, peers);
  const context = (cards || sims)
    ? `<div class="rd-cards">${cards}${sims ? `<article class="rd-card"><h3>Similar cards</h3><div class="rd-sims">${sims}</div></article>` : ""}</div>`
    : "";
  if (!hero && !chips && !patternHtml && !context) return "";
  return `<section class="read-sheet" id="read-sheet" aria-label="Read details">${SHEET_CSS}${hero}${chips}${patternHtml}${context}</section>`;
}
