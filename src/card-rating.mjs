// Card Rating panel for card pages. A factual comparison of this card's
// price and facts on file against similar cards. Not advice.
// Free viewers see the verdict and the peer line. Premium sees the factor bars.
import { esc } from "./ui.mjs";
import { shortDate } from "./ir-cycle.mjs";

export const ORDER = ["peer", "popularity", "scarcity", "demand", "age", "artist", "supply", "range"];
export const LABEL = { peer: "Peer value", popularity: "Popularity", scarcity: "Scarcity of the treatment", demand: "Demand signals", age: "Age and print window", artist: "Artist", supply: "Supply counted", range: "Range on file" };
const cash = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function shardOf(id) { const n = Number(String(id || "").replace(/\D/g, "")) || 0; return String(n % 64).padStart(2, "0"); }

export const RATING_CSS = `.crt{margin:14px 0;padding:16px 18px;border:1px solid var(--line);border-radius:18px;background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01))}.crt h2{margin:0 0 4px;font:600 18px/1.3 var(--serif)}.crt .grp{margin:0 0 10px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;opacity:.65}.crt .verdict{margin:0 0 6px;font-weight:700;color:var(--gold);font-size:16px}.crt .peer{margin:0 0 12px;font-size:14px;opacity:.85}.crt ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}.crt li{display:grid;gap:4px}.crt .row{display:flex;justify-content:space-between;gap:10px;font-size:13px}.crt .row b{font-weight:600}.crt .bar{height:8px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}.crt .bar i{display:block;height:100%;border-radius:999px;background:var(--gold)}.crt .fact{font-size:12px;opacity:.65;overflow-wrap:anywhere}.crt .gate{margin:12px 0 0;font-size:14px}.crt .gate a{color:var(--gold);font-weight:600}.crt details{margin-top:12px;font-size:12px;opacity:.75}.crt summary{cursor:pointer}`;

export function ratingPanel(row, doc, { premium = false } = {}) {
  if (!row) return "";
  const asOf = doc?.asOf || row.price?.date;
  const head = `<h2>Rating</h2><p class="grp">${esc(row.groupOne || row.groupLabel || "")}${row.firstEd ? " · 1st Edition printing" : ""}</p>`;
  if (row.check || !row.verdict) {
    return `<style>${RATING_CSS}</style><section class="crt" aria-label="Rating">${head}<p class="peer">The price on file for this card is far from similar cards, so we are checking it before we compare.</p></section>`;
  }
  const peer = row.peers ? `${cash(row.price.price)} on ${shortDate(row.price.date)}, TCGplayer market. Median of ${row.peers.n} similar ${esc(row.groupLabel)}: ${cash(row.peers.median)}.` : "";
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
  const about = `<details><summary>About this rating</summary><p>Similar cards are ${esc(row.groupLabel)} in the same popularity band, or all ${esc(row.groupLabel)} when a band has fewer than 5. "Below" means 0.8x the median or less, "above" 1.25x or more. ${w ? `Weights: ${esc(w)}.` : ""} Factors with no data are left out. Facts from our files as of ${esc(shortDate(asOf))}. A factual comparison, not advice.</p></details>`;
  return `<style>${RATING_CSS}</style><section class="crt" aria-label="Rating">${head}<p class="verdict">${esc(row.verdict)}</p><p class="peer">${peer}</p>${body}${about}</section>`;
}
