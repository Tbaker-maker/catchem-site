// Card Rating panel for card pages. A factual comparison of this card's
// price and facts on file against similar cards. Not advice.
// Free viewers see the verdict and the peer line. Premium sees the factor bars.
import { esc } from "./ui.mjs";
import { shortDate } from "./ir-cycle.mjs";
import { indexHref, indexKeyOf } from "./indexes.mjs";

export const ORDER = ["peer", "popularity", "scarcity", "pull", "demand", "age", "artist", "range"];
export const LABEL = { peer: "Price vs similar cards", popularity: "Popularity", scarcity: "How rare this version is", pull: "Pull rate", demand: "Recent demand", age: "Age", artist: "Artist", range: "Price vs its own history" };
const cash = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function shardOf(id) { const n = Number(String(id || "").replace(/\D/g, "")) || 0; return String(n % 64).padStart(2, "0"); }

export const RATING_CSS = `.crt{margin:14px 0;padding:16px 18px;border:1px solid var(--line);border-radius:18px;background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01))}.crt h2{margin:0 0 4px;font:600 18px/1.3 var(--serif)}.crt .grp{margin:0 0 10px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;opacity:.65}.crt .verdict{margin:0 0 6px;font-weight:700;color:var(--gold);font-size:16px}.crt .peer{margin:0 0 12px;font-size:14px;opacity:.85}.crt ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}.crt li{display:grid;gap:4px}.crt .row{display:flex;justify-content:space-between;gap:10px;font-size:13px}.crt .row b{font-weight:600}.crt .bar{height:8px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}.crt .bar i{display:block;height:100%;border-radius:999px;background:var(--gold)}.crt .fact{font-size:12px;opacity:.65;overflow-wrap:anywhere}.crt .gate{margin:12px 0 0;font-size:14px}.crt .gate a{color:var(--gold);font-weight:600}.crt details{margin-top:12px;font-size:12px;opacity:.75}.crt summary{cursor:pointer}.crt .verdict.none{color:inherit;opacity:.85}.crt .near{margin:0 0 8px;font-size:14px;font-weight:600;opacity:.9}.crt h3{margin:12px 0 8px;font:600 14px/1.3 var(--sans)}.crt ul.cw{list-style:none;margin:0 0 6px;padding:0;display:grid;gap:8px}.crt ul.cw a{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:10px;align-items:center;color:inherit;text-decoration:none;padding:6px;border-radius:12px;border:1px solid var(--line)}.crt .cw-pic img,.crt .cw-pic .tile{width:44px;max-width:44px;height:auto;border-radius:6px}.crt .cw-main{display:grid;gap:2px;font-size:13px;min-width:0}.crt .cw-main b{font-weight:600;overflow-wrap:anywhere}.crt .cw-main span{opacity:.65;font-size:12px}.crt .cw-price{text-align:right;font-weight:600;font-size:13px}.crt .cw-price small{display:block;font-weight:400;opacity:.6;font-size:11px}.crt .cw-more{margin:6px 0 0;opacity:1;font-size:13px}`;

export const SHOW_FIRST = 5;
// Page weight: at most 25 comparison rows render (each row is a picture).
export const SHOW_MAX = 25;
// Names without the TCGplayer number or variant suffix; the variant chip covers them.
export const cleanName = (n) => String(n || "").replace(/\s+-\s+[A-Z]*\d+[a-z]?\/[A-Z]*\d+\s*$/, "").replace(/(\s*\((\d+[a-z]?|[A-Z]{1,3}\d+|Alternate[^)]*|Full Art|Secret|Delta Species)\))+\s*$/i, "").trim();

// Every comparison card: picture, name, set and number, dated price, link.
// The first 5 show; the rest open with a tap.
export function comparedWith(row, pool, pic = () => "") {
  const list = (pool?.rows || []).filter((p) => !(p[0] === row.id && !!p[6] === !!row.firstEd)).sort((a, b) => b[4] - a[4]);
  if (!list.length) return "";
  const li = (p) => `<li><a href="/c/${esc(p[0])}"><span class="cw-pic">${pic({ id: p[0], name: p[1] })}</span><span class="cw-main"><b>${esc(cleanName(p[1]))}${p[6] ? " 1st Edition" : ""}</b><span>${esc(p[2])}${p[3] ? ` · ${esc(p[3])}` : ""}</span></span><span class="cw-price">${cash(p[4])}<small>${esc(shortDate(p[5]))}</small></span></a></li>`;
  const first = list.slice(0, SHOW_FIRST).map(li).join("");
  const rest = list.slice(SHOW_FIRST, SHOW_MAX);
  const left = list.length - SHOW_FIRST - rest.length;
  const more = rest.length ? `<details class="cw-more"><summary>Show ${rest.length} more</summary><ul class="cw">${rest.map(li).join("")}</ul>${left > 0 ? `<p class="muted">${left} more priced in the same group. <a href="/search">Search them</a>.</p>` : ""}</details>` : "";
  return `<div class="cw-wrap"><h3>Compared with ${list.length} ${esc(row.peers?.matched ? `${row.groupLabel} with similar pull rate and popularity` : row.groupLabel)}</h3><ul class="cw">${first}</ul>${more}</div>`;
}

export function ratingPanel(row, doc, { premium = false, pool = null, pic } = {}) {
  if (!row) return "";
  const asOf = doc?.asOf || row.price?.date;
  const head = `<h2>Rating</h2><p class="grp">${esc(row.groupOne || row.groupLabel || "")}${row.firstEd ? " · 1st Edition printing" : ""}</p>`;
  if (row.check) {
    return `<style>${RATING_CSS}</style><section class="crt" aria-label="Rating">${head}<p class="peer">The price on file for this card is far from similar cards, so we are checking it before we compare.</p></section>`;
  }
  const high = row.nearHigh ? `<p class="near">Near its own high on file (${cash(row.nearHigh.price)}, ${shortDate(row.nearHigh.date)})</p>` : "";
  const verdict = row.verdict || row.verdictNote || "Not enough similar cards for a fair comparison";
  const why = row.reason === "no published pull rate for this set" ? `No published pull rate for this set and rarity, so there is no fair group to compare against.` : `Fewer than 5 ${esc(row.groupLabel)} share its pull rate and popularity.`;
  const peer = !row.verdict ? `${cash(row.price.price)} on ${shortDate(row.price.date)}, TCGplayer market. ${why} The cards below are listed without a verdict.` : row.peers ? `Price vs similar cards: ${cash(row.price.price)} vs a typical ${cash(row.peers.median)} for ${esc(row.groupLabel)} (${row.peers.n} cards). TCGplayer market, ${shortDate(row.price.date)}.` : "";
  let body = "";
  if (premium) {
    const items = ORDER.filter((k) => row.factors?.[k]).map((k) => {
      const f = row.factors[k];
      const pct = Math.round(Math.max(0, Math.min(1, Number(f.v))) * 100);
      return `<li><div class="row"><b>${esc(LABEL[k])}</b><span>${pct}</span></div><div class="bar" role="img" aria-label="${esc(LABEL[k])} ${pct} of 100"><i style="width:${pct}%"></i></div><div class="fact">${esc(f.fact || "")}</div></li>`;
    }).join("");
    body = `<ul>${items}</ul>`;
  } else {
    const have = ORDER.filter((k) => row.factors?.[k]).map((k) => LABEL[k].toLowerCase());
    const list = have.length > 1 ? `${have.slice(0, -1).join(", ")} and ${have.at(-1)}` : have[0] || "";
    body = have.length ? `<p class="gate">Factor bars for ${esc(list)} are in <a href="/premium">Premium</a>.</p>` : "";
  }
  const w = doc?.weights ? ORDER.filter((k) => doc.weights[k] != null).map((k) => `${LABEL[k]} ${doc.weights[k]}`).join(", ") : "";
  const about = `<details><summary>About this rating</summary><p>Similar cards are other ${esc(row.rarity || row.groupLabel)} cards from the same generation, in sets with a similar published pull rate, and with similar popularity. A verdict needs at least 5 such cards. With fewer than 5 there is no verdict. The typical price is the middle price of those cards. "Below" means 0.8x the typical price or less, "above" 1.25x or more. ${w ? `Weights: ${esc(w)}.` : ""} Factors with nothing on file are left out. Facts from our files as of ${esc(shortDate(asOf))}. A factual comparison, not advice.</p></details>`;
  return `<style>${RATING_CSS}</style><section class="crt" aria-label="Rating">${head}<p class="verdict${row.verdict ? "" : " none"}">${esc(verdict)}</p>${high}<p class="peer">${peer}</p>${comparedWith(row, pool, pic)}${row.index ? `<p class="gate"><a href="${indexHref(indexKeyOf(row, !!row.verdict))}">See the index for these cards</a></p>` : ""}${body}${about}</section>`;
}
