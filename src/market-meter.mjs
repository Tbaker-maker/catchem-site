// Heat and fear and greed. Inline SVG only. A missing slice draws nothing.
// Email markup is a table with the same dark and gold hooks the reads letter uses.

const BANNED = /\b(buy|sell|load up|time to|don't miss|do not miss|to the moon)\b/i;
const DASH = /[\u2014\u2013]/;
const LABELS = {
  breadth: "Breadth",
  momentum: "Momentum",
  movers: "Movers",
  newHighs: "New highs",
  supply: "Supply",
  sellThrough: "Listings gone",
  churn: "Churn",
};

export function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
    if (c === "&") return "&" + "amp;";
    if (c === "<") return "&" + "lt;";
    if (c === ">") return "&" + "gt;";
    if (c === '"') return "&" + "quot;";
    return "&" + "#39;";
  });
}

export function adviceFree(text) {
  const s = String(text || "");
  return !BANNED.test(s) && !DASH.test(s);
}

function addDays(d, n) {
  return new Date(Date.parse(`${String(d).slice(0, 10)}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}

function arcPath() {
  const cx = 110;
  const cy = 96;
  const r = 74;
  const pts = [];
  for (let i = 0; i <= 42; i += 1) {
    const t = Math.PI * (1 - i / 42);
    pts.push(`${(cx + r * Math.cos(t)).toFixed(1)},${(cy - r * Math.sin(t)).toFixed(1)}`);
  }
  return `M${pts.join(" L")}`;
}

const ARC = arcPath();
const CSS = `<style>
@keyframes ce-meter-swing{from{transform:rotate(-90deg)}to{transform:rotate(var(--end,0deg))}}
.ce-needle{transform-box:view-box;transform-origin:110px 96px;animation:ce-meter-swing .9s cubic-bezier(.2,.8,.2,1) 1 both}
@media (prefers-reduced-motion:reduce){.ce-needle{animation:none;transform:rotate(var(--end,0deg))}}
</style>`;

function moodInk(band) {
  if (band === "Extreme fear" || band === "Fear") return "#8eb7ff";
  if (band === "Greed" || band === "Extreme greed") return "#d9b779";
  return "#efe9de";
}

function whyLine(reasons) {
  const lines = (reasons || []).map((s) => String(s || "").trim()).filter((s) => s && adviceFree(s)).slice(0, 3);
  if (!lines.length) return "";
  return `Why: ${lines.join(". ")}.`;
}

export function meterPlainLine(meter) {
  if (!meter || meter.mood == null || !meter.moodBand || meter.heat == null || !meter.heatBand) return "";
  const line = `Market: ${meter.moodBand} ${meter.mood}, Heat: ${meter.heatBand}`;
  return adviceFree(line) ? line : "";
}

export function gaugeHtml(slice, { href = "/meter", asOf = "", published = true, kicker = "Market" } = {}) {
  if (published === false || !slice || slice.mood == null || slice.heat == null) return "";
  const mood = Math.max(0, Math.min(100, Math.round(Number(slice.mood))));
  const heat = Math.max(0, Math.min(100, Math.round(Number(slice.heat))));
  const end = ((mood - 50) * 1.8).toFixed(1);
  const why = whyLine(slice.reasons);
  const used = Number(slice.used) || 0;
  const when = String(asOf || "").slice(0, 10);
  const label = `${kicker}: ${slice.moodBand} ${mood}, Heat ${slice.heatBand}. ${used} components${when ? ` on ${when}` : ""}.`;
  if (!adviceFree(label) || (why && !adviceFree(why))) return "";
  const ink = moodInk(slice.moodBand);
  return `${CSS}<a class="ce-meter" id="market-meter" href="${esc(href)}" aria-label="${esc(label)}" style="display:block;min-height:188px;margin:14px 0;padding:14px 16px 12px;border-radius:22px;background:#1a1815;border:1px solid #2c2823;color:#efe9de;text-decoration:none">
<div style="display:flex;align-items:flex-end;gap:12px">
<div style="flex:1;min-width:0">
<p style="margin:0 0 2px;font:600 12px/1.2 -apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#a89f90">Fear and greed</p>
<svg viewBox="0 0 220 112" width="100%" height="112" aria-hidden="true" style="display:block;width:100%;height:112px">
<defs><linearGradient id="ce-meter-arc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8eb7ff"/><stop offset="0.5" stop-color="#efe9de"/><stop offset="1" stop-color="#d9b779"/></linearGradient></defs>
<path d="${ARC}" fill="none" stroke="url(#ce-meter-arc)" stroke-width="12" stroke-linecap="round"/>
<g class="ce-needle" style="--end:${end}deg">
<line x1="110" y1="96" x2="110" y2="34" stroke="#efe9de" stroke-width="3" stroke-linecap="round"/>
<circle cx="110" cy="96" r="5" fill="#efe9de"/>
</g>
</svg>
<p style="margin:0;font:650 28px/1.1 -apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;color:${ink}">${mood} <span style="font-size:15px;font-weight:600;color:#efe9de">${esc(slice.moodBand)}</span></p>
</div>
<div style="flex:0 0 auto;margin-bottom:6px;border-radius:999px;padding:8px 12px;background:#2a2118;color:#f0a05a;font:600 13px/1.2 -apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;white-space:nowrap"><svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true" style="vertical-align:-2px;margin-right:4px"><path d="M6 13c3 0 5-2.2 5-5.1C11 5.2 8.2 3 7.2 1.2 7 1 6.6.6 6.2 1.1 5.6 2.6 4 3.4 3.2 4.6 2.2 6.1 1 7.2 1 8.6 1 11 3.2 13 6 13z" fill="#f0a05a"/></svg>Heat ${esc(slice.heatBand)} ${heat}</div>
</div>
${why ? `<p id="market-meter-why" style="margin:10px 0 0;font:400 14px/1.45 -apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;color:#cfc6b6">${esc(why)}</p>` : ""}
<p style="margin:4px 0 0;font:500 12px/1.3 -apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;color:#a89f90">${used} components.${when ? ` ${esc(when)}.` : ""}</p>
</a>`;
}

export function historyWindow(points, range, asOf) {
  const list = (Array.isArray(points) ? points : []).filter((p) => p && /^\d{4}-\d{2}-\d{2}$/.test(String(p.d || "")) && p.mood != null && p.heat != null);
  if (range === "all" || list.length < 2) return list;
  const end = String(asOf || list[list.length - 1].d).slice(0, 10);
  const start = addDays(end, -31);
  const cut = list.filter((p) => p.d >= start && p.d <= end);
  return cut.length >= 2 ? cut : list.slice(-31);
}

function linePath(points, key) {
  const w = 640;
  const h = 168;
  const padX = 8;
  const padY = 16;
  return points.map((p, i) => {
    const x = padX + (points.length === 1 ? 0 : (i / (points.length - 1)) * (w - padX * 2));
    const y = padY + (1 - Math.max(0, Math.min(100, Number(p[key]))) / 100) * (h - padY * 2);
    return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

export function historySvg(points) {
  if (!points || points.length < 2) return `<div style="min-height:180px"></div>`;
  const first = points[0].d;
  const last = points[points.length - 1].d;
  return `<svg viewBox="0 0 640 180" width="100%" height="180" role="img" aria-label="Market meter from ${esc(first)} to ${esc(last)}" style="display:block;width:100%;height:180px;min-height:180px">
<line x1="8" y1="92" x2="632" y2="92" stroke="#2c2823" stroke-width="1"/>
<path d="${linePath(points, "mood")}" fill="none" stroke="#d9b779" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
<path d="${linePath(points, "heat")}" fill="none" stroke="#8eb7ff" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
<text x="8" y="174" fill="#a89f90" font-size="12" font-family="-apple-system,BlinkMacSystemFont,sans-serif">${esc(first)}</text>
<text x="632" y="174" fill="#a89f90" font-size="12" text-anchor="end" font-family="-apple-system,BlinkMacSystemFont,sans-serif">${esc(last)}</text>
</svg>`;
}

function barRow(part) {
  const score = Math.max(0, Math.min(100, Math.round(Number(part.score))));
  const label = LABELS[part.id] || part.id;
  const color = part.meter === "heat" ? "#f0a05a" : "#d9b779";
  return `<div style="display:flex;align-items:center;gap:10px;min-height:28px;margin:6px 0">
<span style="width:108px;flex:0 0 108px;font:600 13px/1.2 -apple-system,BlinkMacSystemFont,sans-serif;color:#efe9de">${esc(label)}</span>
<span style="flex:1;height:8px;border-radius:999px;background:#2a261f;overflow:hidden"><span style="display:block;width:${score}%;height:8px;border-radius:999px;background:${color}"></span></span>
<span style="width:32px;text-align:right;font:600 13px/1 -apple-system,BlinkMacSystemFont,sans-serif;color:#a89f90">${score}</span>
</div>${part.fact && adviceFree(part.fact) ? `<p style="margin:0 0 8px 0;font:400 13px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;color:#a89f90">${esc(part.fact)}</p>` : ""}`;
}

function sliceLine(name, slice, href) {
  if (!slice || slice.mood == null) return "";
  const body = `${esc(name)}: ${esc(slice.moodBand)} ${slice.mood}, Heat ${esc(slice.heatBand)} ${slice.heat}. ${slice.used} components.`;
  const inner = href ? `<a href="${esc(href)}" style="color:inherit;text-decoration:none">${body}</a>` : body;
  return `<p style="margin:0 0 8px;font:500 15px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;color:#efe9de">${inner}</p>`;
}

function meterQuery(range, set) {
  const q = new URLSearchParams();
  if (range === "all") q.set("range", "all");
  if (set && /^[a-z0-9-]+$/.test(set)) q.set("set", set);
  const s = q.toString();
  return s ? `/meter?${s}` : "/meter";
}

export function renderMeterPage(doc, { range = "1m", set = "" } = {}) {
  const published = doc && doc.published !== false && doc.market;
  if (!published) {
    return `<main id="main" tabindex="-1" class="wrap"><h1>Market meter</h1><p class="muted" style="min-height:188px">The market meter is not on file for this date.</p></main>`;
  }
  const slug = /^[a-z0-9-]+$/.test(set) ? set : "";
  const focus = slug && doc.sets && doc.sets[slug] ? doc.sets[slug] : doc.market;
  const kicker = slug && doc.sets && doc.sets[slug] ? (doc.sets[slug].name || slug) : "Market";
  const gaugeHref = slug ? `/sets/${slug}` : "/meter";
  const points = historyWindow(doc.market.history, range === "all" ? "all" : "1m", doc.asOf);
  const on = (name) => (range === "all" ? name === "all" : name === "1m");
  const chip = (name, label) => `<a href="${esc(meterQuery(name === "all" ? "all" : "1m", slug))}" aria-current="${on(name) ? "true" : "false"}" style="display:inline-block;margin-right:8px;padding:8px 14px;border-radius:999px;border:1px solid #2c2823;background:${on(name) ? "#d9b779" : "transparent"};color:${on(name) ? "#1a1407" : "#efe9de"};text-decoration:none;font:600 14px/1 -apple-system,BlinkMacSystemFont,sans-serif">${label}</a>`;
  const hidden = (doc.hidden || []).find((row) => row.id === "vintage");
  const eras = Object.entries(doc.eras || {}).sort((a, b) => a[0].localeCompare(b[0]));
  const sets = Object.entries(doc.sets || {}).sort((a, b) => String(a[1].name || a[0]).localeCompare(String(b[1].name || b[0])));
  const inputs = focus.inputs || doc.market.inputs || [];
  return `<main id="main" tabindex="-1" class="wrap"><h1>Market meter</h1>
<p class="muted">Mood and activity for the whole market. Fear and greed are labels for the price action, not instructions.</p>
${gaugeHtml(focus, { href: gaugeHref, asOf: doc.asOf, published: true, kicker })}
<p style="margin:8px 0 12px">${chip("1m", "1M")}${chip("all", "All")}</p>
<div style="min-height:180px">${historySvg(points)}</div>
<p class="muted" style="margin-top:4px">Gold is fear and greed. Blue is heat. ${esc(points[0]?.d || "")} to ${esc(points[points.length - 1]?.d || "")}.</p>
<h2>Components</h2>
${inputs.map(barRow).join("") || `<p class="muted">No component is on file for this day.</p>`}
<h2>Sealed and singles</h2>
${sliceLine("Sealed", doc.sealed)}
${sliceLine("Singles", doc.singles)}
<h2>Eras</h2>
${sliceLine("Modern", doc.modern)}
${doc.vintage ? sliceLine("Vintage", doc.vintage) : `<p class="muted">${esc(hidden?.why || "Vintage is not shown today.")}</p>`}
${eras.map(([name, row]) => sliceLine(name, row)).join("")}
<h2>Sets</h2>
${sets.map(([id, row]) => sliceLine(row.name || id, row, `/sets/${id}`)).join("") || `<p class="muted">No set cleared the minimum today.</p>`}
</main>`;
}

export function meterEmailBlock(meter) {
  if (!meter) return "";
  const line = meterPlainLine(meter);
  const why = whyLine(meter.reasons);
  if (!line) return "";
  const when = String(meter.asOf || "").slice(0, 10);
  const used = Number(meter.used) || 0;
  const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Arial,sans-serif";
  return `<tr><td style="padding:0 0 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="ce-card" bgcolor="#ffffff" style="background:#ffffff;border-radius:22px"><tr><td style="padding:16px 18px">
<p class="ce-soft" style="margin:0 0 6px;font:600 12px/1 ${FONT};letter-spacing:.04em;text-transform:uppercase;color:#8e8e93">Market meter</p>
<p class="ce-ink" style="margin:0;font:700 18px/1.35 ${FONT};color:#1c1c1e">${esc(line)}</p>
${why ? `<p class="ce-dim" style="margin:6px 0 0;font:400 14px/1.45 ${FONT};color:#636366">${esc(why)}</p>` : ""}
<p class="ce-soft" style="margin:6px 0 0;font:400 12px/1.4 ${FONT};color:#8e8e93">${used} components.${when ? ` ${esc(when)}.` : ""} <a href="https://catchemtcg.com/meter" class="ce-ink" style="color:#1c1c1e;text-decoration:underline">Open the meter</a></p>
</td></tr></table></td></tr>`;
}
