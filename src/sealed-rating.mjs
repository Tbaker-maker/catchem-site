// Sealed Rating panel for sealed product pages. Factual position data for this
// product against sealed products of the same type. Not advice.
// Everyone sees the verdict and the facts. Premium also sees the factor bars.
import { esc } from "./ui.mjs";
import { shortDate } from "./ir-cycle.mjs";
import { RATING_CSS } from "./card-rating.mjs";

export const ORDER = ["chase", "setValue", "trend"];
export const LABEL = { chase: "Top card vs sealed price", setValue: "Set value vs sealed price", trend: "Price trend, nightly history" };
const cash = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sign = (n) => (n > 0 ? "+" : "") + n + "%";

export function sealedShard(id) { return String((Number((String(id).match(/(\d+)/) || [])[1]) || 0) % 16).padStart(2, "0"); }

export function sealedFacts(row) {
  const out = [];
  if (row.chase) out.push(`Top card in the set: ${row.chase.name} at ${cash(row.chase.price)}, ${row.chase.ratio}x this product's ${cash(row.price.price)} (${shortDate(row.price.date)}).`);
  if (row.peers?.medianChaseRatio != null && row.chase) out.push(`Median for ${row.peers.n} ${row.typeLabel === "booster box" ? "booster boxes" : "products of this type"}: ${row.peers.medianChaseRatio}x.`);
  if (row.setValue) out.push(`Set value: ${row.setValue.n} priced singles add up to ${cash(row.setValue.total)}, ${row.setValue.ratio}x this product.`);
  if (row.perPack) out.push(`${row.packs} packs, ${cash(row.perPack)} a pack.`);
  if (row.trend?.pct != null) out.push(`Our nightly history: ${cash(row.trend.a)} (${shortDate(row.trend.from)}) to ${cash(row.trend.z)} (${shortDate(row.trend.to)}), ${sign(row.trend.pct)} over ${row.trend.days} nights.`);
  if (row.listings?.n != null) out.push(`eBay listings counted: ${row.listings.n} (${shortDate(row.listings.date)})${row.listings.prev ? `, ${row.listings.prev.n} the night before` : ""}. Listings are not sales.`);
  if (row.stage) out.push(`Print stage: ${row.stage.label}${row.stage.label === row.stage.era ? "" : `, ${row.stage.era}`}. ${(row.stage.lines || []).join(" ")}`.trim());
  if (row.ageDays != null && row.release) out.push(`Out since ${shortDate(row.release)}, ${(row.ageDays / 365).toFixed(1)} years.`);
  return out;
}

export function sealedRatingPanel(row, doc, { premium = false } = {}) {
  if (!row) return "";
  const asOf = doc?.asOf || row.price?.date;
  const head = `<h2>Sealed Rating</h2><p class="grp">${esc(row.typeLabel || "")}</p>`;
  const verdict = row.verdict ? `<p class="verdict">${esc(row.verdict)}</p>` : `<p class="peer">Not enough same-type products with a top card on file to compare this one yet.</p>`;
  const facts = sealedFacts(row).map((f) => `<li><div class="fact" style="opacity:.85;font-size:13px">${esc(f)}</div></li>`).join("");
  let bars = "";
  const have = ORDER.filter((k) => row.factors?.[k]);
  if (premium && have.length) {
    bars = `<ul style="margin-bottom:12px">${have.map((k) => { const pct = Math.round(Math.max(0, Math.min(1, Number(row.factors[k].v))) * 100); return `<li><div class="row"><b>${esc(LABEL[k])}</b><span>${pct}</span></div><div class="bar" role="img" aria-label="${esc(LABEL[k])} ${pct} of 100"><i style="width:${pct}%"></i></div></li>`; }).join("")}</ul>`;
  } else if (have.length) {
    const list = have.map((k) => LABEL[k].toLowerCase());
    bars = `<p class="gate">Factor bars for ${esc(list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list.at(-1)}` : list[0])} are in <a href="/premium">Premium</a>.</p>`;
  }
  const waiting = (doc?.waiting || []).map((w) => `${w.label}: ${w.why}`).join(" ");
  const about = `<details><summary>About this rating</summary><p>Each bar is the share of ${esc(row.typeLabel || "same-type")} products on file that sit below this one, 0 to 100. "Low price next to its set's top card" means the highest 25% on the top-card bar, "high" the lowest 25%. The top card is the highest-priced single in the set that day; a card priced 4x or more over the next one is held for a check. Prices are TCGplayer market as of ${esc(shortDate(asOf))}. ${waiting ? `Coming when the data is ready: ${esc(waiting)}` : ""} A factual comparison, not advice.</p></details>`;
  return `<style>${RATING_CSS}</style><section class="crt" aria-label="Sealed Rating">${head}${verdict}${bars}<ul>${facts}</ul>${about}</section>`;
}
