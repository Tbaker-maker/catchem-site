// Public price indexes: one TCGplayer rarity, one generation per index.
// Two versions: all pull rates, and sets with a similar published pull rate.
// Equal-weight typical (middle) price plus total value, only cards priced that day.
import { esc } from "./ui.mjs";
import { shortDate } from "./ir-cycle.mjs";
import { cleanName } from "./card-rating.mjs";

const cash = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cash0 = (n) => "$" + Math.round(Number(n)).toLocaleString("en-US");
export const indexHref = (key) => `/indexes/${encodeURIComponent(key)}`;
// Rating rows carry index "group~rarity~era" and prBand; files use "--" for "~".
export const indexKeyOf = (row, similar) => `${String(row.index || "").replace(/~/g, "--")}--${similar && row.prBand != null ? `pr${row.prBand}` : "all"}`;
const chg = (a, b) => { const p = Math.round(((b - a) / a) * 1000) / 10; return p > 0 ? `up ${p}%` : p < 0 ? `down ${Math.abs(p)}%` : "flat"; };

export const INDEX_CSS = `.ix-list{display:grid;gap:12px;margin:16px 0}.ix-era{margin:26px 0 6px;font:600 20px/1.3 var(--serif)}.ix-card{display:grid;gap:6px;padding:14px 16px;border:1px solid var(--line);border-radius:18px;background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.015));color:inherit;text-decoration:none;transition:background .2s,transform .2s}.ix-card:hover{background:rgba(255,255,255,.06)}.ix-card b{font-weight:600;font-size:15px}.ix-card .ix-sub{font-size:12px;opacity:.65}.ix-card .ix-nums{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:13px}.ix-pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:600;background:rgba(255,255,255,.08);margin-right:6px}.ix-pill.sim{background:rgba(217,183,121,.18);color:var(--gold)}
.ix-head h1{margin:6px 0 4px}.ix-lede{opacity:.8;margin:0 0 12px}.ix-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:14px 0}.ix-stat{padding:12px 14px;border-radius:16px;border:1px solid var(--line);background:rgba(255,255,255,.03)}.ix-stat span{display:block;font-size:12px;opacity:.65}.ix-stat b{font-size:20px;font-weight:650;letter-spacing:-.01em}.ix-stat small{display:block;font-size:12px;opacity:.65;margin-top:2px}
.ix-chart{margin:12px 0;padding:14px 16px 10px;border-radius:20px;border:1px solid var(--line);background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.02))}.ix-chart h2{margin:0 0 2px;font:600 15px/1.3 var(--sans)}.ix-chart p{margin:0 0 8px;font-size:12px;opacity:.65}.ix-chart svg{display:block;width:100%;height:150px}.ix-axis{display:flex;justify-content:space-between;font-size:11px;opacity:.6;margin-top:4px}
.ix-note{padding:10px 14px;border-radius:14px;background:rgba(217,183,121,.1);font-size:13px;margin:10px 0}.ix-sec{margin:22px 0 8px;font:600 17px/1.3 var(--serif)}
.ix-members{list-style:none;margin:0;padding:0;display:grid;gap:8px}.ix-members a{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:10px;align-items:center;color:inherit;text-decoration:none;padding:6px 8px;border-radius:14px;border:1px solid var(--line)}.ix-members img,.ix-members .tile{width:44px;max-width:44px;height:auto;border-radius:6px}.ix-members .m{display:grid;gap:2px;font-size:13px;min-width:0}.ix-members .m b{font-weight:600;overflow-wrap:anywhere}.ix-members .m span{font-size:12px;opacity:.65}.ix-members .p{text-align:right;font-weight:600;font-size:13px}.ix-members .p small{display:block;font-weight:400;opacity:.6;font-size:11px}
.ix-changes{list-style:none;margin:0;padding:0;display:grid;gap:6px;font-size:13px}.ix-changes li{padding:8px 12px;border-radius:12px;background:rgba(255,255,255,.04)}
.ix-about{margin:18px 0;border:1px solid var(--line);border-radius:16px;padding:10px 14px}.ix-about summary{cursor:pointer;font-weight:600;font-size:14px}.ix-about p,.ix-about li{font-size:13px;line-height:1.5}.ix-about ul{padding-left:18px}.ix-about a{color:var(--gold)}.ix-more{margin-top:8px;font-size:13px}.ix-more summary{cursor:pointer}
@media(max-width:600px){.ix-chart svg{height:120px}.ix-stat b{font-size:18px}}`;

function line(points, col, color) {
  const pts = points.map((p) => [p[0], Number(p[col])]).filter((p) => p[1] > 0);
  if (pts.length < 2) return "";
  const W = 600, H = 150, P = 8;
  const t0 = Date.parse(pts[0][0]), t1 = Date.parse(pts.at(-1)[0]);
  const vs = pts.map((p) => p[1]); let mn = Math.min(...vs), mx = Math.max(...vs); const pad = (mx - mn) * 0.1 || mx * 0.05 || 1; mn -= pad; mx += pad;
  const xy = pts.map(([d, v]) => [((Date.parse(d) - t0) / (t1 - t0 || 1)) * W, P + (1 - (v - mn) / (mx - mn)) * (H - 2 * P)]);
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const id = `ixg${col}`;
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Weekly values from ${esc(shortDate(pts[0][0]))} to ${esc(shortDate(pts.at(-1)[0]))}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".25"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${d} L${W},${H} L0,${H} Z" fill="url(#${id})"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg><div class="ix-axis"><span>${esc(shortDate(pts[0][0]))}</span><span>${esc(shortDate(pts.at(-1)[0]))}</span></div>`;
}

const kindPill = (k) => (k === "similar" ? `<span class="ix-pill sim">Similar pull rates</span>` : `<span class="ix-pill">All pull rates</span>`);

export function indexListBody(list) {
  const rows = list?.indexes || [];
  if (!rows.length) return `<main id="main" tabindex="-1" class="wrap"><h1>Indexes</h1><p class="muted">The indexes are being rebuilt. Check back after tonight's update.</p></main>`;
  const eras = [...new Set(rows.map((r) => r.era))];
  const card = (r) => `<a class="ix-card" href="${indexHref(r.key)}"><b>${esc(r.name.replace(/, similar pull rates.*$/, ""))}</b><span>${kindPill(r.kind)}${r.kind === "similar" ? `<span class="ix-sub">${esc((r.name.match(/\(([^)]*per pack)\)/) || [])[1] || "")}</span>` : ""}</span><span class="ix-nums"><span>Typical ${cash(r.last[2])}</span><span>Total ${cash0(r.last[1])}</span><span>${r.last[3]} cards priced</span></span><span class="ix-sub">${esc(shortDate(r.last[0]))}, TCGplayer market${r.smallGroup ? ". Small group" : ""}</span></a>`;
  return `<main id="main" tabindex="-1" class="wrap"><style>${INDEX_CSS}</style><div class="ix-head"><h1>Indexes</h1><p class="ix-lede">Each index follows one TCGplayer rarity in one generation, with its real rarity name. "All pull rates" includes every set. "Similar pull rates" only includes sets whose published pull rate for that rarity is close, with the source linked on the index page. Prices are TCGplayer market, as of ${esc(shortDate(list.asOf))}. A factual record of prices on file, not advice.</p></div>${eras.map((e) => `<h2 class="ix-era">${esc(e)}</h2><div class="ix-list">${rows.filter((r) => r.era === e).map(card).join("")}</div>`).join("")}</main>`;
}

export function indexPageBody(doc, { pic = () => "" } = {}) {
  const pts = doc.points || [];
  const first = pts[0], last = pts.at(-1);
  const members = [...(doc.members || [])].sort((a, b) => b[4] - a[4]);
  const li = (m) => `<li><a href="/c/${esc(m[0])}"><span>${pic({ id: m[0], name: m[1] })}</span><span class="m"><b>${esc(cleanName(m[1]))}</b><span>${esc(m[2])}${m[3] ? ` · ${esc(m[3])}` : ""}</span></span><span class="p">${cash(m[4])}<small>${esc(shortDate(m[5]))}</small></span></a></li>`;
  const memberHtml = `<ul class="ix-members">${members.slice(0, 10).map(li).join("")}</ul>${members.length > 10 ? `<details class="ix-more"><summary>Show ${members.length - 10} more</summary><ul class="ix-members" style="margin-top:8px">${members.slice(10).map(li).join("")}</ul></details>` : ""}`;
  const changes = (doc.changes || []).map((c) => `<li><b>${esc(shortDate(c.date))}</b>: ${c.started != null ? `index started with ${c.started} cards` : `${(c.added || []).length} added, ${(c.removed || []).length} removed`}</li>`).join("");
  const small = doc.smallGroup ? `<p class="ix-note">Small group: ${members.length} cards. One card's price can move this index a lot.</p>` : "";
  const prs = (doc.pullRates || []).map((p) => `<li>${esc(p.set)}: ${p.pct}% per pack for ${esc(p.article || doc.rarity)}${p.ci95 ? ` (plus or minus ${p.ci95}%)` : ""}${p.samplePacks ? `, ${Number(p.samplePacks).toLocaleString("en-US")} packs` : ""}. <a href="${esc(p.url)}" rel="noopener">Source</a>${p.published ? `, published ${esc(shortDate(p.published))}` : ""}</li>`).join("");
  const sim = doc.kind === "similar";
  const about = `<details class="ix-about"><summary>About this index</summary><p>${esc(doc.method || "")}</p><p>Rarity: ${esc(doc.rarity)}, ${esc(doc.era)} only. Prices: ${esc(doc.source || "TCGplayer market")}.${sim ? ` Sets are in this version because their published pull rate for this rarity falls between ${doc.band?.lo}% and ${doc.band?.hi}% per pack. A set with no published rate is left out, never guessed.` : " Every set with this rarity is included, whatever its pull rate."}</p>${prs ? `<p>Pull-rate sources:</p><ul>${prs}</ul>` : ""}<p>Cards in this index (${members.length}):</p><ul>${members.map((m) => `<li><a href="/c/${esc(m[0])}">${esc(cleanName(m[1]))}</a>, ${esc(m[2])}${m[3] ? ` ${esc(m[3])}` : ""}</li>`).join("")}</ul><p>A factual record of prices on file, not advice.</p></details>`;
  const head = `<div class="ix-head"><p><a href="/indexes">All indexes</a></p><h1>${esc(doc.name.replace(/, similar pull rates.*$/, ""))}</h1><p>${kindPill(doc.kind)}${sim ? `<span class="ix-sub">${esc((doc.name.match(/\(([^)]*per pack)\)/) || [])[1] || "")}</span>` : ""}</p></div>`;
  const stats = last ? `<div class="ix-stats"><div class="ix-stat"><span>Typical price</span><b>${cash(last[2])}</b><small>${esc(shortDate(last[0]))}${first && first !== last ? `, ${chg(first[2], last[2])} since ${esc(shortDate(first[0]))}` : ""}</small></div><div class="ix-stat"><span>Total value</span><b>${cash0(last[1])}</b><small>${last[3]} cards priced on ${esc(shortDate(last[0]))}</small></div></div>` : "";
  const charts = `<div class="ix-chart"><h2>Typical price</h2><p>Middle price of the cards priced each week, equal weight.</p>${line(pts, 2, "#d9b779")}</div><div class="ix-chart"><h2>Total value</h2><p>Sum of the cards priced each week. The count can change as cards gain or lose a price.</p>${line(pts, 1, "#8fb3d9")}</div>`;
  return `<main id="main" tabindex="-1" class="wrap"><style>${INDEX_CSS}</style>${head}${small}${stats}${charts}<h2 class="ix-sec">Cards in this index</h2>${memberHtml}${changes ? `<h2 class="ix-sec">Membership changes</h2><ul class="ix-changes">${changes}</ul>` : ""}${about}</main>`;
}
