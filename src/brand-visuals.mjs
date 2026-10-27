// Sealed Market Pulse heatmap and the share cards that use the same mark.
// Prices are month end TCGplayer market figures on file. Nothing here is filled in.

import { ALLOWED_IMAGE_HOSTS, allowedImageUrl, BRAND } from "./brand.mjs";

export const AS_OF = "2026-10-27";
export const SOURCE = "TCGplayer market";
export const BASELINE = 76;

// Booster boxes are taller than ETBs. Both sit on BASELINE.
export const KIND_HEIGHT = Object.freeze({
  "booster-box": 72,
  "pc-etb": 58,
  etb: 54,
  "booster-pack": 36,
});

const TYPE_LABEL = {
  "booster-box": "Booster box",
  "pc-etb": "PC ETB",
  etb: "ETB",
  "booster-pack": "Booster pack",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function cell(month, pct, price, priceDate) {
  let direction = null;
  if (pct != null && Number.isFinite(Number(pct))) {
    const n = Number(pct);
    direction = n > 0 ? "up" : n < 0 ? "down" : "flat";
  }
  return { month, pct, price, priceDate, direction };
}

export const MARKET_MEDIAN = Object.freeze([
  { ym: "2026-07", pct: -0.5532 },
  { ym: "2026-08", pct: -1.1614 },
  { ym: "2026-09", pct: -0.8687 },
  { ym: "2026-10", pct: -1.6587 },
]);

// Four rows on file, including misses and a down month. Not a win list.
export const PULSE_SAMPLE = Object.freeze([
  {
    id: "tcgcsv-242436",
    name: "Evolving Skies Booster Box",
    set: "Evolving Skies",
    type: "booster-box",
    tcgPlayerId: 242436,
    cells: [
      cell("2026-07", -5.989, 2510.64, "2026-07-31"),
      cell("2026-08", -2.2592, 2453.92, "2026-08-31"),
      cell("2026-09", -6.4146, 2296.51, "2026-09-30"),
      cell("2026-10", -5.1195, 2178.94, "2026-10-27"),
    ],
  },
  {
    id: "tcgcsv-155661",
    name: "Ultra Prism Booster Box",
    set: "Ultra Prism",
    type: "booster-box",
    tcgPlayerId: 155661,
    cells: [
      cell("2026-07", null, null, null),
      cell("2026-08", null, null, null),
      cell("2026-09", null, null, null),
      cell("2026-10", null, 1561.08, "2026-10-27"),
    ],
  },
  {
    id: "tcgcsv-593355",
    name: "Prismatic Evolutions Elite Trainer Box",
    set: "Prismatic Evolutions",
    type: "etb",
    tcgPlayerId: 593355,
    cells: [
      cell("2026-07", -19.4703, 164.49, "2026-07-31"),
      cell("2026-08", -7.5202, 152.12, "2026-08-31"),
      cell("2026-09", -8.204, 139.64, "2026-09-30"),
      cell("2026-10", -14.3011, 119.67, "2026-10-27"),
    ],
  },
  {
    id: "tcgcsv-242811",
    name: "Celebrations Elite Trainer Box",
    set: "Celebrations",
    type: "etb",
    tcgPlayerId: 242811,
    cells: [
      cell("2026-07", -15.4902, 422.49, "2026-07-31"),
      cell("2026-08", -16.372, 353.32, "2026-08-31"),
      cell("2026-09", 0.9963, 356.84, "2026-09-30"),
      cell("2026-10", -6.4146, 333.95, "2026-10-27"),
    ],
  },
]);

export function kindHeight(kind) {
  return KIND_HEIGHT[kind] || 40;
}

export function productImage(row) {
  const pid = Number(row && row.tcgPlayerId);
  if (Number.isInteger(pid) && pid > 0) {
    return allowedImageUrl("https://tcgplayer-cdn.tcgplayer.com/product/" + pid + "_in_400x400.jpg");
  }
  return allowedImageUrl((row && (row.logo || row.image)) || "");
}

export function pctLabel(n) {
  if (n == null || !Number.isFinite(Number(n))) return "No reading";
  const v = Number(n);
  const sign = v > 0 ? "+" : "";
  return sign + v.toFixed(1) + "%";
}

export function prettyDay(iso) {
  const d = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "";
  return MONTHS[Number(d.slice(5, 7)) - 1] + " " + Number(d.slice(8, 10)) + ", " + d.slice(0, 4);
}

function monthLabel(ym) {
  const [y, m] = String(ym).split("-");
  return MONTHS[Number(m) - 1] + " " + String(y);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => {
    if (c === "&") return "&" + "amp;";
    if (c === "<") return "&" + "lt;";
    if (c === ">") return "&" + "gt;";
    if (c === '"') return "&" + "quot;";
    return c;
  });
}

function money(n) {
  if (!(Number(n) > 0)) return "";
  return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function stage(row) {
  const h = kindHeight(row.type);
  const src = productImage(row);
  const inner = src
    ? `<img alt="" style="height:${h}px" src="${esc(src)}">`
    : `<span class="bv-ph" style="height:${h}px"></span>`;
  return `<span class="bv-stage" data-baseline="${BASELINE}" data-kind="${esc(row.type)}" data-h="${h}">${inner}</span>`;
}

function monthsOf(rows) {
  const seen = [];
  for (const row of rows) {
    for (const c of row.cells || []) {
      if (c && c.month && !seen.includes(c.month)) seen.push(c.month);
    }
  }
  return seen;
}

export function heatmapHtml(rows = PULSE_SAMPLE, opts = {}) {
  const months = monthsOf(rows);
  const head = [`<div class="bv-hh">Product</div>`]
    .concat(months.map((m) => `<div class="bv-hh">${esc(monthLabel(m))}</div>`))
    .join("");
  const body = rows.map((row) => {
    const name = `<div class="bv-name">${stage(row)}<span class="bv-copy"><strong>${esc(row.set)}</strong><span>${esc(TYPE_LABEL[row.type] || "Sealed")}</span></span></div>`;
    const cells = months.map((month) => {
      const c = (row.cells || []).find((item) => item.month === month) || { month, pct: null };
      const label = pctLabel(c.pct);
      const up = c.direction === "up";
      const down = c.direction === "down";
      const cls = up ? "bv-cell bv-up" : down ? "bv-cell bv-down" : "bv-cell";
      const wash = (up || down) ? Math.min(0.45, Math.abs(Number(c.pct)) / 40).toFixed(2) : "0";
      const mirrored = c.priceSource === "archived-market" || c.mirrored === true;
      const readDay = c.readAt || c.priceDate || "";
      const srcBits = [];
      if (mirrored) srcBits.push("mirrored third-party");
      if (c.priceSource) srcBits.push(String(c.priceSource));
      if (readDay) srcBits.push("read " + prettyDay(readDay));
      const src = srcBits.length ? " (" + srcBits.join(", ") + ")" : "";
      return `<button type="button" class="${cls}" style="--wash:${wash}" aria-label="${esc(row.set + " " + monthLabel(month) + " " + label + src)}" title="${esc(label + src)}">${esc(label)}</button>`;
    }).join("");
    return name + cells;
  }).join("");
  const last = opts.median || MARKET_MEDIAN[MARKET_MEDIAN.length - 1];
  const source = opts.source || SOURCE;
  const asOf = opts.asOf || AS_OF;
  return `<section class="bv-card" id="heat">
    <div class="bv-scroll">
      <div class="bv-heat" style="--m:${months.length}">${head}${body}</div>
    </div>
    <p class="bv-note">${esc(monthLabel(last.ym))} sealed market median ${esc(pctLabel(last.pct))}. ${esc(source)}, ${esc(prettyDay(asOf))}. A blank month says No reading. These rows are on file.</p>
  </section>`;
}

export const BRAND_CSS = `
.bv-page{margin:0;background:${BRAND.paper};color:${BRAND.ink};font:16px/1.4 ${BRAND.font};padding:20px 16px 48px}
.bv-mark{color:${BRAND.gold};font:600 28px/1 ${BRAND.font};letter-spacing:-0.03em;text-decoration:none;min-height:44px;display:inline-flex;align-items:center}
.bv-kicker{margin:14px 0 0;color:${BRAND.gold};font:600 12px/1 ${BRAND.font};letter-spacing:.08em;text-transform:uppercase}
.bv-page h1{margin:8px 0 6px;font:600 34px/1.05 ${BRAND.font};letter-spacing:-0.03em}
.bv-src{margin:0 0 16px;color:${BRAND.dim};font:15px/1.4 ${BRAND.font}}
.bv-card{background:#1a1815;border:1px solid ${BRAND.line};border-radius:${BRAND.radius}px;padding:14px}
.bv-scroll{overflow-x:auto;border-radius:16px}
.bv-heat{display:grid;grid-template-columns:168px repeat(var(--m), minmax(96px, 1fr));gap:6px;min-width:600px}
.bv-hh{min-height:44px;display:flex;align-items:flex-end;color:${BRAND.dim};font:600 13px/1.2 ${BRAND.font}}
.bv-hh:first-child{position:sticky;left:0;background:#1a1815;z-index:2}
.bv-name{display:flex;gap:8px;align-items:flex-end;min-height:76px;position:sticky;left:0;background:#1a1815;z-index:2}
.bv-stage{height:${BASELINE}px;display:flex;align-items:flex-end;justify-content:center;flex:0 0 auto;width:72px;padding:4px 4px 0;border-radius:12px;background:rgba(239,233,222,.16)}
.bv-stage img,.bv-ph{width:auto;max-width:64px;display:block;object-fit:contain;object-position:center bottom;border-radius:8px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.65)) drop-shadow(0 0 1px rgba(0,0,0,.4))}
.bv-ph{width:36px;border-radius:8px;background:#2a2622}
.bv-copy{display:flex;flex-direction:column;min-width:0;padding-bottom:4px}
.bv-copy strong{font-weight:600;font-size:14px;line-height:1.2;font-family:${BRAND.font};letter-spacing:-0.02em}
.bv-copy span{color:${BRAND.dim};font:12px/1.3 ${BRAND.font}}
.bv-cell{min-width:44px;min-height:44px;border:0;border-radius:14px;background:rgba(239,233,222,.06);color:${BRAND.dim};font-family:${BRAND.font};font-size:15px;font-weight:600;line-height:1.15;padding:8px 4px}
.bv-up{background:rgba(127,199,154,var(--wash));color:${BRAND.up}}
.bv-down{background:rgba(224,122,122,var(--wash));color:#e07a7a}
.bv-note{margin:12px 0 0;color:${BRAND.dim};font:14px/1.4 ${BRAND.font}}
.bv-foot{margin:28px 0 0;padding-top:14px;border-top:1px solid ${BRAND.line};color:${BRAND.dim};font:13px/1.4 ${BRAND.font}}
.bv-shares{display:grid;gap:14px;margin-top:22px}
@media (max-width:520px){
.bv-scroll{overflow:visible}
.bv-heat{grid-template-columns:repeat(var(--m),minmax(0,1fr));min-width:0}
.bv-hh:first-child{display:none}
.bv-hh{min-height:28px;justify-content:center}
.bv-name{grid-column:1/-1;position:static;min-height:0;margin-top:8px}
.bv-cell{font-size:14px;padding:8px 2px}
}
.bv-shares svg{width:100%;height:auto;border-radius:${BRAND.radius}px;min-height:320px}
`.trim();



export const MIRROR_NOTE = "Pulse history before Oct 14, 2026 is mirrored third-party data. Each point shows its source and the date we read it.";
export const SITE_FOOTER = "Prices and counts are informational. Each number shows its source and date.";

export function rowsFromPulseDoc(doc) {
  const rows = Array.isArray(doc && doc.rows) ? doc.rows : [];
  return rows
    .filter((r) => r && r.set && Array.isArray(r.cells) && r.cells.length)
    .map((r) => ({
      id: r.id,
      name: r.name,
      set: r.set,
      type: r.type || "etb",
      tcgPlayerId: r.tcgPlayerId != null ? Number(r.tcgPlayerId) : null,
      logo: r.logo || null,
      about: r.about || null,
      usedMirror: !!r.usedMirror,
      cells: (r.cells || []).map((c) => {
        const pct = c && c.pct != null && Number.isFinite(Number(c.pct)) ? Number(c.pct) : null;
        const built = cell(c.month, pct, c.price != null ? Number(c.price) : null, c.priceDate || null);
        built.priceSource = c.priceSource || null;
        built.mirrored = c.mirrored === true || c.priceSource === "archived-market";
        built.readAt = c.readAt || c.readDate || null;
        built.listingsCount = c.listingsCount != null ? c.listingsCount : null;
        return built;
      }),
    }));
}

export function medianFromDoc(doc) {
  const med = doc && doc.marketMedian;
  if (!med || typeof med !== "object") return MARKET_MEDIAN;
  return Object.keys(med)
    .sort()
    .map((ym) => ({ ym, pct: med[ym] }));
}

export function brandPageFromDoc(doc) {
  const rows = rowsFromPulseDoc(doc);
  const use = rows.length ? rows : PULSE_SAMPLE;
  const asOf = (doc && doc.asOf) || AS_OF;
  const source = (doc && doc.source) || SOURCE;
  const about = (doc && doc.about) || "";
  const medians = medianFromDoc(doc);
  const last = medians[medians.length - 1] || MARKET_MEDIAN[MARKET_MEDIAN.length - 1];
  const months = monthsOf(use);
  // Prefer the latest months in view on phones: scroll script stays; note names the window.
  const heat = heatmapHtml(use, { asOf, source, median: last, about });
  const pulse = {
    id: "pulse-median",
    title: "Sealed market median",
    big: pctLabel(last.pct),
    sealed: true,
    lines: medians.slice(-4).map((row) => monthLabel(row.ym) + " " + pctLabel(row.pct)),
    source,
    date: prettyDay(asOf),
    href: "https://catchemtcg.com/sealed-pulse",
  };
  const lead = use[0];
  const leadCell = lead && lead.cells ? lead.cells[lead.cells.length - 1] : null;
  const sealed = {
    id: "sealed-box",
    title: lead ? lead.name : "Sealed",
    big: money(leadCell && leadCell.price),
    sealed: true,
    imageUrl: lead ? productImage(lead) : "",
    lines: ["Month change " + pctLabel(leadCell && leadCell.pct)],
    source,
    date: prettyDay(asOf),
    href: "https://catchemtcg.com/sealed-pulse",
  };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sealed Market Pulse</title><style>${BRAND_CSS}</style></head><body class="bv-page">
<a class="bv-mark" href="https://catchemtcg.com/">${esc(BRAND.wordmark)}</a>
<p class="bv-kicker">Sealed Market Pulse</p>
<h1>Month end market.</h1>
<p class="bv-src">${esc(source)}. ${esc(prettyDay(asOf))}.</p>
${heat}
<p class="bv-note">${esc(MIRROR_NOTE)}</p>
<section class="bv-shares" id="shares">
  <h2>Share cards</h2>
  ${brandShareSvg(pulse)}
  ${brandShareSvg(sealed)}
</section>
<footer class="bv-foot">${esc(SITE_FOOTER)}</footer>
<script>var s=document.querySelector(".bv-scroll");if(s)s.scrollLeft=s.scrollWidth;</script>
</body></html>`;
}

export function brandPage(rows = PULSE_SAMPLE) {
  return brandPageFromDoc({ asOf: AS_OF, source: SOURCE, marketMedian: Object.fromEntries(MARKET_MEDIAN.map((m) => [m.ym, m.pct])), rows });
}

export function legacyHeatmapHtml(rows = PULSE_SAMPLE) {
  const months = monthsOf(rows);
  const head = `<div class="lg-h">Product</div>` + months.map((m) => `<div class="lg-h">${esc(monthLabel(m))}</div>`).join("");
  const body = rows.map((row) => {
    const src = productImage(row);
    const img = src ? `<img alt="" style="height:36px;width:36px" src="${esc(src)}">` : "";
    const cells = months.map((month) => {
      const c = (row.cells || []).find((item) => item.month === month) || {};
      const label = c.pct == null ? "" : pctLabel(c.pct);
      const cls = c.direction === "down" ? "lg-c lg-down" : c.direction === "up" ? "lg-c lg-up" : "lg-c";
      return `<div class="${cls}">${esc(label)}</div>`;
    }).join("");
    return `<div class="lg-name">${img}<span>${esc(row.set)}</span></div>` + cells;
  }).join("");
  return `<div class="lg-heat" style="--m:${months.length}">${head}${body}</div>`;
}

export const LEGACY_CSS = `
.lg-page{margin:0;background:#0c0d10;color:#f4f4f6;font:12px/1.3 "Segoe UI",sans-serif;padding:12px}
.lg-heat{display:grid;grid-template-columns:120px repeat(var(--m), minmax(54px,1fr));gap:3px;min-width:520px}
.lg-h{color:#9a9aa3;font-size:11px;min-height:18px}
.lg-name{display:flex;gap:6px;align-items:center;font-size:11px}
.lg-name img{height:36px;width:36px;object-fit:cover;border-radius:8px}
.lg-c{min-height:28px;border-radius:8px;font-size:11px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.04)}
.lg-up{background:#3ddc84;color:#06210f}
.lg-down{background:#ff7b72;color:#2a0606}
`.trim();

export function legacyPage(rows = PULSE_SAMPLE) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pulse before</title><style>${LEGACY_CSS}</style></head><body class="lg-page">${legacyHeatmapHtml(rows)}</body></html>`;
}

export function brandShareSvg(card) {
  const lines = card.lines || [];
  const hasImg = Boolean(card.imageUrl);
  // Pack hero + months under the title. Four or more months go two-up.
  // A light plate behind the product hides white CDN paper (Celebrations ETB).
  const col = lines.length >= 4;
  const monthRows = col ? Math.ceil(lines.length / 2) : Math.max(lines.length, 1);
  const monthBlock = monthRows * 52;
  const heroH = 150;
  const gap = 28;
  const blockTop = 210;
  const bigY = blockTop + heroH - 20;
  const lineStart = bigY + gap + 20;
  const footY = Math.min(920, lineStart + monthRows * 52 + 100);
  const img = hasImg
    ? `<defs><clipPath id="shareImg"><rect x="700" y="${blockTop}" width="280" height="280" rx="24"/></clipPath></defs><rect x="700" y="${blockTop}" width="280" height="280" rx="24" fill="#cfc6b6"/><image href="${esc(card.imageUrl)}" x="700" y="${blockTop}" width="280" height="280" preserveAspectRatio="xMidYMid meet" clip-path="url(#shareImg)"/>`
    : "";
  const lineHtml = lines.map((line, i) => {
    const second = col && i >= Math.ceil(lines.length / 2);
    const x = second ? 560 : 72;
    const row = second ? i - Math.ceil(lines.length / 2) : i;
    return `<text x="${x}" y="${lineStart + row * 52}" fill="${BRAND.ink}" font-family="${BRAND.font}" font-size="36">${esc(line)}</text>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080" role="img">
<title>${esc(card.title)}</title>
<rect width="1080" height="1080" rx="48" fill="${BRAND.paper}"/>
<rect x="28" y="28" width="1024" height="1024" rx="36" fill="none" stroke="${BRAND.gold}" stroke-width="8"/>
<text x="72" y="100" fill="${BRAND.gold}" font-family="${BRAND.font}" font-size="40">${esc(BRAND.wordmark)}</text>
<text x="72" y="172" fill="${BRAND.ink}" font-family="${BRAND.font}" font-size="40">${esc(card.title)}</text>
${img}
<text x="72" y="${bigY}" fill="${BRAND.ink}" font-family="${BRAND.font}" font-size="156">${esc(card.big)}</text>
${lineHtml}
<text x="72" y="${footY}" fill="${BRAND.dim}" font-family="${BRAND.font}" font-size="30">${esc(card.source)}</text>
<text x="72" y="${footY + 44}" fill="${BRAND.dim}" font-family="${BRAND.font}" font-size="30">${esc(card.date)}</text>
<text x="72" y="${footY + 94}" fill="${BRAND.gold}" font-family="${BRAND.font}" font-size="30">${esc(String(card.href || "").replace("https://", ""))}</text>
</svg>`;
}

export function pulseShareCard() {
  const last = MARKET_MEDIAN[MARKET_MEDIAN.length - 1];
  return {
    id: "pulse-median",
    title: "Sealed market median",
    big: pctLabel(last.pct),
    sealed: true,
    lines: MARKET_MEDIAN.map((row) => monthLabel(row.ym) + " " + pctLabel(row.pct)),
    source: SOURCE,
    date: prettyDay(AS_OF),
    href: "https://catchemtcg.com/sealed-pulse",
  };
}

export function sealedShareCard() {
  const row = PULSE_SAMPLE[0];
  const oct = row.cells[row.cells.length - 1];
  return {
    id: "sealed-box",
    title: row.name,
    big: money(oct.price),
    sealed: true,
    imageUrl: productImage(row) || "",
    lines: ["Month change " + pctLabel(oct.pct)],
    source: SOURCE,
    date: prettyDay(AS_OF),
    href: "https://catchemtcg.com/sealed-pulse",
  };
}

export { ALLOWED_IMAGE_HOSTS };


export async function sealedPulseResponse(request, env = {}) {
  const { loadJson } = await import("./data.mjs");
  const fetchImpl = env.PUBLIC_FETCH || fetch;
  let doc = null;
  try { doc = await loadJson("sealed-market-pulse.json", fetchImpl); } catch { doc = null; }
  const html = brandPageFromDoc(doc || { asOf: AS_OF, source: SOURCE, marketMedian: Object.fromEntries(MARKET_MEDIAN.map((m) => [m.ym, m.pct])), rows: PULSE_SAMPLE });
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
