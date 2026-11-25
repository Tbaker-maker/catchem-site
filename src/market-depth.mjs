// PkmnPrices-derived market depth on product pages: eBay sold comps (median, count,
// middle half, graded medians), graded population counts, and the Cardmarket EUR
// price. Catchem-data publishes only these derived numbers in
// research/assets/public/market-depth/<pid % 100>.json. Every line names its source
// and date. A stat the file does not carry is not shown.
// "Sold" is used only for these eBay sold comps. Listings stay "listings counted".
import { smallJson } from "./data.mjs";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (d) => { if (!ISO.test(String(d || ""))) return ""; const p = String(d).split("-"); return `${MONTHS[+p[1] - 1]} ${+p[2]}, ${p[0]}`; };
const usd = (n) => `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const eur = (n) => `€${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const int = (n) => Math.round(Number(n)).toLocaleString("en-US");

export function depthKey(card) {
  if (/^tcgcsv-\d+$/.test(String(card?.id || ""))) return String(card.id);
  const pid = Number(card?.pid || card?.tcgPlayerId);
  return pid > 0 ? `tcgcsv-${pid}` : "";
}

// #557 writes this sentence into market-depth/meta.json once the band has run.
// The old file says "half-price/double filter" and does not carry it.
export function bandFromMeta(meta) {
  return typeof meta?.note === "string" && meta.note.includes("private band");
}

// One pop count. The label and the grader rows use the sum of published
// grader totals. pop.total can be larger (copies not in those rows).
export function popCount(pop) {
  const graders = pop && pop.graders && typeof pop.graders === "object" ? pop.graders : {};
  const summed = Object.values(graders).reduce((s, g) => s + (Number(g && g.total) > 0 ? Number(g.total) : 0), 0);
  if (summed > 0) return summed;
  const total = Number(pop && pop.total);
  return total > 0 ? total : 0;
}

export async function marketDepthFor(card, fetchImpl = fetch) {
  const key = depthKey(card);
  if (!key) return null;
  const b = String(Number(key.slice(7)) % 100).padStart(2, "0");
  try {
    const doc = await smallJson(`market-depth/${b}.json`, fetchImpl);
    const item = doc?.items?.[key];
    if (!item) return null;
    let bandReady = false;
    try {
      const meta = await smallJson("market-depth/meta.json", fetchImpl);
      bandReady = bandFromMeta(meta);
    } catch { bandReady = false; }
    return { ...item, asOf: String(doc.asOf || "").slice(0, 10), source: doc.source || "eBay sold comps via PkmnPrices", popSource: doc.popSource || "", eurSource: doc.eurSource || "", bandReady };
  } catch { return null; }
}

// Daily sold series for the chart's Sold view.
export function soldSeries(depth) {
  if (!depth || depth.bandReady !== true) return [];
  return Array.isArray(depth.daily) ? depth.daily.filter((p) => Array.isArray(p) && ISO.test(p[0]) && Number.isInteger(p[1])) : [];
}

const GRADER_ORDER = ["PSA", "BGS", "CGC", "SGC"];

export function marketDepthHtml(depth, { kind = "single" } = {}) {
  if (!depth) return "";
  const asOf = day(depth.asOf);
  const parts = [];
  const s = depth.sold;
  // Sold comps stay off until market-depth/meta.json carries the #557 band note.
  if (depth.bandReady === true && s && s.n >= 5 && s.median > 0 && ISO.test(s.first) && ISO.test(s.last)) {
    const what = kind === "sealed" ? "eBay sold comps" : "eBay sold comps, raw copies in any condition";
    const lines = [
      `<li><span>Median</span><b>${usd(s.median)}</b></li>`,
      `<li><span>Comps counted</span><b>${int(s.n)}${Number(s.read) > s.n ? ` of the latest ${int(s.read)}` : ""}</b></li>`,
      `<li><span>Middle half</span><b>${usd(s.p25)} to ${usd(s.p75)}</b></li>`,
      `<li><span>Dates</span><b>${esc(day(s.first))} to ${esc(day(s.last))}</b></li>`,
    ];
    const g = (Array.isArray(depth.graded) ? depth.graded : []).filter((r) => r && r.n >= 3 && r.median > 0 && /^[A-Z]{3} [\d.]+( [A-Za-z ]+)?$/.test(String(r.label || "")));
    const graded = g.length
      ? `<h3>Graded sold comps</h3><ul class="cp-facts">${g.map((r) => `<li><span>${esc(r.label)}</span><b>${usd(r.median)} · ${int(r.n)} comps · last ${esc(day(r.last))}</b></li>`).join("")}</ul>`
      : "";
    const dropped = Number(s.dropped) > 0 ? ` ${int(s.dropped)} other comps were left out: a different item, graded, a different currency, or under half or over double the median.` : "";
    parts.push(`<section class="cp-sec md-sold" id="sold"><h2>eBay sold comps</h2>
<ul class="cp-facts">${lines.join("")}</ul>${graded}
<p class="muted">${esc(what)} in the ${int(s.days || 90)} days to ${esc(asOf)}${s.truncated ? ", newest 20 read" : ""}.${esc(dropped)} Source: ${esc(depth.source)}, as of ${esc(asOf)}.</p></section>`);
  }
  const p = depth.pop;
  const counted = popCount(p);
  if (kind !== "sealed" && p && counted > 0) {
    const rows = GRADER_ORDER.filter((g) => p.graders?.[g]?.total > 0).map((g) => {
      const r = p.graders[g];
      const top = Object.entries(r.top || {}).sort((a, b) => Number(b[0]) - Number(a[0])).map(([k, v]) => `${k}: ${int(v)}`).join(" · ");
      const extra = [r.pristine ? `Pristine 10: ${int(r.pristine)}` : "", r.blackLabel ? `Black Label: ${int(r.blackLabel)}` : ""].filter(Boolean).join(" · ");
      return `<li><span>${g}</span><b>${int(r.total)} graded${top ? ` · ${top}` : ""}${extra ? ` · ${extra}` : ""}</b></li>`;
    });
    const same = counted === Number(p.total);
    const gem = same && Number.isFinite(Number(p.gemRate)) && p.gemRate !== null ? `<li><span>Gem rate</span><b>${Number(p.gemRate).toFixed(1)}% (${int(p.gems)} of ${int(counted)})</b></li>` : "";
    parts.push(`<section class="cp-sec md-pop" id="pop"><h2>Graded population</h2>
<ul class="cp-facts"><li><span>Total graded</span><b>${int(counted)}</b></li>${gem}${rows.join("")}</ul>
<p class="muted">${p.variant ? `Printing: ${esc(p.variant)}. ` : ""}Counts from ${esc(p.asOf ? day(p.asOf) : asOf)}${p.changed ? `, last change ${esc(day(p.changed))}` : ""}. Source: ${esc(depth.popSource || "grader population reports via PkmnPrices")}.</p></section>`);
  }
  const e = depth.eur;
  if (e && e.market > 0 && ISO.test(e.asOf)) {
    const label = kind === "sealed" ? "Cardmarket market price" : "Cardmarket market price, Near Mint";
    parts.push(`<section class="cp-sec md-eur" id="eur"><h2>Europe</h2><ul class="cp-facts"><li><span>${esc(label)}</span><b>${eur(e.market)} · ${esc(day(e.asOf))}</b></li></ul><p class="muted">Source: ${esc(depth.eurSource || "Cardmarket via PkmnPrices")}.</p></section>`);
  }
  return parts.join("\n");
}

// The market-depth file owns this line: the total across the graders that
// have a count, plus the pop date. A missing label is left off. Graders are
// not named here.
export function gradedPopLabel(pop) {
  if (!(popCount(pop) > 0)) return "";
  const label = String(pop.label || "").replace(/\s+/g, " ").trim();
  if (!label || label.length > 180) return "";
  if (!/graded/i.test(label)) return "";
  if (/[<>&]|[\u2013\u2014]/.test(label)) return "";
  return label;
}

// One large line for camera mode. Sold comps stay off this line until the
// comps are proven. Graded pop is singles only, and the words are pop.label.
// Listings counted stay on the summary chip.
// A missing stat is left out. Nothing here is estimated.
export function cameraLine(depth, { kind = "single" } = {}) {
  if (!depth) return "";
  const bits = [];
  if (kind !== "sealed") {
    const label = gradedPopLabel(depth.pop);
    if (label) bits.push(label);
  }
  const e = depth.eur;
  if (e && e.market > 0 && ISO.test(e.asOf)) bits.push(`Cardmarket ${eur(e.market)}`);
  return bits.join(". ");
}
