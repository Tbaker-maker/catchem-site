// Rotation chips and the IR cycle panel for IR, SIR and their SWSH
// equivalents (Trainer Gallery, Galarian Gallery, alternate arts).
// Facts only, every number with its date. Not advice.
import { esc } from "./ui.mjs";

const DAY = 86400000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
export const shortDate = (s) => (isDay(s) ? `${MONTHS[Number(s.slice(5, 7)) - 1]} ${Number(s.slice(8, 10))}, ${s.slice(0, 4)}` : "");
const cash = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function artKind(card) {
  const r = String(card?.rarity || "");
  const num = String(card?.num || "");
  const name = String(card?.name || "");
  if (r === "Illustration Rare") return "Illustration Rare";
  if (r === "Special Illustration Rare") return "Special Illustration Rare";
  if (/^TG\d/i.test(num)) return "Trainer Gallery";
  if (/^GG\d/i.test(num)) return "Galarian Gallery";
  if (/Alternate (Full )?Art|Alternate Art Secret/i.test(name)) return / & /.test(name) || (card?.release && String(card.release) < "2020-02") ? "Tag Team (Alternate Art)" : "Alternate Art";
  return "";
}

export function rotationChipData(rot, slug, today, cardMark) {
  // A card's own mark (mixed sets) wins over the set-wide mark.
  const row = cardMark
    ? { mark: cardMark, status: (rot?.sources || []).some((s) => s.mark === cardMark) ? "Rotated" : (rot?.expected || []).some((e) => e.mark === cardMark) || /^[H-Z]$/.test(cardMark) ? "Standard" : null, own: true }
    : (rot?.sets || []).find((s) => s && s.slug === slug);
  if (!row || !row.mark) return null;
  const src = (rot.sources || []).find((s) => s.mark === row.mark && isDay(s.date));
  if (src) {
    const left = Math.round((Date.parse(src.date) - Date.parse(today)) / DAY);
    if (left > 0) return { mark: row.mark, official: true, text: `Rotates in ${left} days (${shortDate(src.date)}, mark ${row.mark})`, href: src.href };
    return { mark: row.mark, official: true, rotated: true, text: `Rotated ${shortDate(src.date)}`, sub: `mark ${row.mark}`, href: src.href };
  }
  const exp = (rot.expected || []).find((e) => e.mark === row.mark);
  if (exp) return { mark: row.mark, official: false, text: `Mark ${row.mark} · Rotation date not announced`, sub: `Expected window: ${exp.window}`, basis: exp.basis };
  if (row.status === "Standard") return { mark: row.mark, official: false, text: `Mark ${row.mark} · In Standard`, sub: "No rotation date announced" };
  // Older marks (D, E) have no dated source in our file: name the mark only.
  return { mark: row.mark, official: false, past: true, text: `Regulation mark ${row.mark}`, sub: "" };
}

export const CHIP_CSS = `.rchips{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.rchip{display:inline-flex;align-items:center;gap:8px;min-height:36px;padding:6px 14px;border-radius:999px;border:1px solid var(--line);background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02));font:600 13px/1.25 var(--sans);color:inherit;text-decoration:none}.rchip .dot{width:8px;height:8px;border-radius:999px;background:var(--gold);flex:none}.rchip.past .dot{background:#8a8f98}.rchip.est{border-style:dashed}.rchip .sub{font-weight:500;opacity:.72}.rchip.kind{border-color:var(--gold);color:var(--gold)}.rchip.lift{border-color:rgba(212,175,55,.45);background:rgba(212,175,55,.08)}
.ircy{margin:14px 0;padding:16px 18px;border:1px solid var(--line);border-radius:18px;background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01))}.ircy h2{margin:0 0 10px;font:600 18px/1.3 var(--serif)}.ircy dl{display:grid;grid-template-columns:minmax(0,9em) minmax(0,1fr);gap:6px 14px;margin:0}.ircy dt{opacity:.7;font-size:13px}.ircy dd{margin:0;font-size:14px;overflow-wrap:anywhere}.ircy .fine{margin:10px 0 0;font-size:12px;opacity:.65}`;

export function chipsHtml(card, rot, today, cardMark) {
  const kind = artKind(card);
  if (!kind || !card?.setSlug) return "";
  const r = rotationChipData(rot, card.setSlug, today, cardMark);
  if (r && cardMark) r.sub = [r.sub, "this card's own mark"].filter(Boolean).join(" · ");
  // The kind itself is shown by the catalogue variant tag under the name.
  const kindChip = "";
  if (!r) return `<div class="rchips">${kindChip}</div>`;
  const cls = r.rotated || r.past ? "rchip past" : r.official ? "rchip" : "rchip est";
  const title = r.basis ? ` title="${esc(r.basis)}"` : "";
  return `<div class="rchips">${kindChip}<a class="${cls}" href="/rotation"${title}><span class="dot" aria-hidden="true"></span><span>${esc(r.text)}${r.sub ? ` <span class="sub">· ${esc(r.sub)}</span>` : ""}</span></a></div>`;
}

export function setChipHtml(slug, rot, today, irCount) {
  const r = rotationChipData(rot, slug, today);
  if (!r && !irCount) return "";
  const cls = r ? (r.rotated || r.past ? "rchip past" : r.official ? "rchip" : "rchip est") : "";
  const chip = r ? `<a class="${cls}" href="/rotation"><span class="dot" aria-hidden="true"></span><span>${esc(r.text)}${r.sub ? ` <span class="sub">· ${esc(r.sub)}</span>` : ""}</span></a>` : "";
  const ir = irCount ? `<a class="rchip kind" href="/ir-watchlist?set=${encodeURIComponent(slug)}">${irCount} cards on the IR watchlist</a>` : "";
  return `<style>${CHIP_CSS}</style><div class="rchips">${chip}${ir}</div>`;
}

function trendText(t) {
  if (!t) return "Not enough dated prices";
  const sign = t.pct > 0 ? "Up" : t.pct < 0 ? "Down" : "Flat";
  return `${sign}${t.pct ? " " + Math.abs(t.pct) + "%" : ""}: ${cash(t.from.price)} (${shortDate(t.from.date)}) to ${cash(t.to.price)} (${shortDate(t.to.date)})`;
}

export function listingsText(l) {
  if (!l) return "No sealed listings counted for this set";
  const prev = l.prev ? `, ${l.prev.n} on ${shortDate(l.prev.date)}` : "";
  return `${l.n} eBay listings counted for ${l.name} on ${shortDate(l.date)}${prev}`;
}

export function cycleRows(row) {
  return [
    ["Days since release", `${row.daysSinceRelease} (released ${shortDate(row.release)})`],
    ["Price", `${cash(row.price.price)} on ${shortDate(row.price.date)}, TCGplayer market`],
    ["Range on file", `Low ${cash(row.low.price)} (${shortDate(row.low.date)}), high ${cash(row.high.price)} (${shortDate(row.high.date)}), since ${shortDate(row.onFileSince)}`],
    ["Where it sits", row.position || "Range too flat to place"],
    ["30 days", trendText(row.trend30)],
    ["90 days", trendText(row.trend90)],
    ["Price pattern", `Stage: ${row.curve.stage}. ${row.curve.text}`],
  ];
}

export function liftChips(r) {
  const lifts = (r.lifts || []).map((l) => `<span class="rchip lift">${esc(l.text)}</span>`);
  const pop = (r.popularity || []).map((t) => `<span class="rchip">${esc(TAG_LABEL[t] || t)}</span>`);
  return [...lifts, ...pop].join("");
}

export const hasRangeChip = (r) => (r.lifts || []).some((l) => l.factor === "range");

export function cyclePanel(row, asOf) {
  if (!row) return "";
  const chips = liftChips(row);
  const dl = cycleRows(row).filter(([k]) => !(k === "Where it sits" && hasRangeChip(row))).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("");
  return `<section class="ircy" aria-label="Release cycle"><h2>Release cycle${row.kindLabel ? ` <span class="sub" style="font:500 13px/1 var(--sans);opacity:.7">· ${esc(row.kindLabel)}</span>` : ""}</h2>${chips ? `<div class="rchips">${chips}</div>` : ""}<dl>${dl}</dl><p class="fine">Facts from our files as of ${esc(shortDate(asOf))}. Not advice. Pattern from our study of TCGplayer market history.</p></section>`;
}

export function cardArtHtml(card, rot, doc, today, marks) {
  const chips = chipsHtml(card, rot, today, marks?.cards?.[card.id]?.mark);
  if (!chips) return "";
  const row = (doc?.rows || []).find((r) => r.id === card.id);
  return `<style>${CHIP_CSS}</style>${chips}${cyclePanel(row, doc?.asOf)}`;
}

export const FREE_ROWS = 3;

export function watchlistBody(doc, opts = {}) {
  const set = String(opts.set || "");
  const all = (doc?.rows || []).filter((r) => !set || r.setSlug === set);
  const premium = opts.premium === true;
  const PAGE = 100;
  const pages = Math.max(1, Math.ceil(all.length / PAGE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(opts.page, 10) || 1));
  const shown = premium ? all.slice((page - 1) * PAGE, page * PAGE) : all.slice(0, FREE_ROWS);
  const fmt = (n) => Number(n).toLocaleString("en-US");
  const qs = (n) => `/ir-watchlist?${set ? `set=${encodeURIComponent(set)}&` : ""}page=${n}`;
  const pager = premium && pages > 1 ? `<nav class="wl-pager" aria-label="Pages"><span>Showing ${fmt((page - 1) * PAGE + 1)} to ${fmt(Math.min(all.length, page * PAGE))} of ${fmt(all.length)}</span>${page > 1 ? `<a class="rchip" href="${qs(page - 1)}">Previous</a>` : ""}${page < pages ? `<a class="rchip kind" href="${qs(page + 1)}">Next ${PAGE}</a>` : ""}</nav>` : "";
  const pic = typeof opts.pic === "function" ? opts.pic : () => "";
  const items = shown.map((r) => {
    const facts = cycleRows(r).filter(([k]) => k !== "Price pattern" && !(k === "Where it sits" && hasRangeChip(r))).map(([k, v]) => `<li><span>${esc(k)}</span> ${esc(v)}</li>`).join("");
    const tags = liftChips(r);
    return `<li class="wl-row"><a class="wl-pic" href="/c/${esc(r.id)}">${pic(r)}</a><div class="wl-main"><p class="wl-set">${esc(r.set)} · ${esc(r.kindLabel || r.kind)} · ${esc(r.num || "")}</p><h2><a href="/c/${esc(r.id)}">${esc(r.name.replace(/\s+-\s+\S+$/, ""))}</a></h2><ul class="wl-facts">${facts}</ul><p class="wl-curve">${esc(r.curve.text)}</p>${tags ? `<div class="rchips">${tags}</div>` : ""}</div></li>`;
  }).join("");
  const gate = premium ? "" : `<div class="wl-gate"><p>Showing ${Math.min(FREE_ROWS, all.length)} of <b>${fmt(all.length)} cards</b>${set ? " in this set" : ""}. Premium shows all ${fmt(all.length)}, with every fact dated.</p><a class="wl-btn" href="/premium">See it with Premium</a></div>`;
  const filter = set ? `<p class="muted">One set. <a href="/ir-watchlist">Show every set</a></p>` : "";
  return `<main id="main" tabindex="-1" class="wrap wl"><style>${CHIP_CSS}
.wl h1{font:500 clamp(30px,7vw,46px)/1.08 var(--serif);letter-spacing:-.02em;margin:0 0 8px}.wl .lede{max-width:40em;font-size:16px;line-height:1.5;opacity:.85}.wl-list{list-style:none;margin:16px 0;padding:0;display:grid;gap:14px}.wl-row{display:grid;grid-template-columns:96px minmax(0,1fr);gap:16px;padding:16px;border:1px solid var(--line);border-radius:20px;background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.01))}.wl-pic img,.wl-pic .tile{width:96px;max-width:96px;height:auto;border-radius:10px}.wl-set{margin:0;font-size:12px;letter-spacing:.06em;text-transform:uppercase;opacity:.65}.wl h2{margin:4px 0;font:600 20px/1.25 var(--serif)}.wl h2 a{color:inherit;text-decoration:none}.wl-pos{margin:0 0 8px;color:var(--gold);font-weight:600}.wl-facts{list-style:none;margin:0;padding:0;display:grid;gap:4px;font-size:14px}.wl-facts span{opacity:.6;margin-right:6px}.wl-curve{margin:8px 0 0;font-size:13px;opacity:.7}.wl-gate{margin:18px 0;padding:20px;border-radius:20px;border:1px solid var(--gold);text-align:center}.wl-btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 26px;border-radius:999px;background:var(--gold);color:#111;font-weight:700;text-decoration:none}.wl-pager{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:8px 0 16px;font-size:14px}.wl .fine{font-size:12px;opacity:.6;max-width:44em}
@media (min-width:768px){.wl-row{grid-template-columns:120px minmax(0,1fr)}.wl-pic img,.wl-pic .tile{width:120px;max-width:120px}}</style>
<p class="kicker" style="letter-spacing:.14em;text-transform:uppercase;font:600 12px/1 var(--sans);color:var(--gold)">Premium</p>
<h1>IR watchlist</h1>
<p class="lede">Illustration Rares and Special Illustration Rares (Scarlet &amp; Violet and Mega), Trainer Gallery, Galarian Gallery and Alternate Art cards (Sword &amp; Shield), and Tag Team (Alternate Art) cards (Sun &amp; Moon), each named by its own rarity. Each one shows its age, where its price sits against its own low and high on file, and its 30 and 90 day trend.</p>
${filter}<ul class="wl-list">${items}</ul>${pager}${gate}
<p class="fine">Facts from our files as of ${esc(shortDate(doc?.asOf))}. Prices are TCGplayer market. The order weighs several facts together: time since release, where the price sits in its range on file, the Pokémon's popularity (Gen 1, starters, Eeveelutions, Pikachu, Charizard and a few others), how its 90 days compare with set and era peers, and its trend. The chips on each card name the facts that weigh most for it. This is a factual signal, not advice.</p></main>`;
}

const TAG_LABEL = { headliner: "Fan favourite", eeveelution: "Eeveelution", gen1: "Gen 1", starter: "Starter", popular: "Popular Pokémon" };

// Replaces the set badge on a mixed-set card: the card's own mark, cited.
export function cardMarkBadge(entry, doc) {
  if (!entry?.mark) return "";
  const day = shortDate(String(doc?.attrsGenerated || ""));
  return `<p class="rot-badge"><a href="/rotation" aria-label="Rotation: regulation mark ${esc(entry.mark)}"><span class="rm">${esc(entry.mark)}</span> Regulation mark ${esc(entry.mark)} on this card</a> <span class="muted">Mixed set. pokemontcg.io ${esc(entry.ptcgId)}${day ? `, card file ${esc(day)}` : ""}.</span></p>`;
}
