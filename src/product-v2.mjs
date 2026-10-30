// Sealed page: market line against retail, and a listings runway.
// Flag TF_PRODUCT_V2 defaults off.
// Market points are month-end readings from the live 151 Elite Trainer Box chart.
// Retail is not on that page, so retail stays "No price".
// Sealed pages do not show a condition.

export const FLAG = "TF_PRODUCT_V2";

const INK = "#12100e";
const IVORY = "#efe9de";
const GOLD = "#d9b779";

export function productOn(env) {
  return String(env && env.TF_PRODUCT_V2 || "").trim().toLowerCase() === "on";
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => {
    if (c === "&") return "&" + "amp;";
    if (c === "<") return "&" + "lt;";
    if (c === ">") return "&" + "gt;";
    if (c === '"') return "&" + "quot;";
    return "&" + "#39;";
  });
}


const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function prettyDay(iso) {
  const d = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "";
  return MONTHS[Number(d.slice(5, 7)) - 1] + " " + Number(d.slice(8, 10)) + ", " + d.slice(0, 4);
}

export function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return "No price";
  return "$" + x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function moveText(from, to) {
  if (!(Number(from) > 0) || !(Number(to) > 0)) return "No price";
  const pct = ((Number(to) - Number(from)) / Number(from)) * 100;
  const r = Math.round(pct * 10) / 10;
  if (Math.abs(r) < 0.05) return "Flat 0.0%";
  if (r > 0) return "Up \u25B2 +" + r.toFixed(1) + "%";
  return "Down \u25BC " + r.toFixed(1) + "%";
}

// Last market point is the sealed-prices.json row sv3pt5-etb on 2026-10-29: TCGplayer market 497.13. Listings counted are eBay, 117, same date. Earlier month points are the previous fixture. Live /p/ pages do not use this fixture.
export const ETB = {
  name: "151 Elite Trainer Box",
  id: "tcgcsv-503313",
  sealed: true,
  source: "TCGplayer market",
  points: [
    ["2025-09-30", 405.23],
    ["2025-10-31", 411.11],
    ["2025-11-30", 353.73],
    ["2025-12-31", 373.78],
    ["2026-01-31", 425.67],
    ["2026-02-28", 482.64],
    ["2026-03-31", 620.72],
    ["2026-04-30", 604.15],
    ["2026-05-31", 657.93],
    ["2026-06-30", 605.54],
    ["2026-07-31", 612.02],
    ["2026-08-31", 569.14],
    ["2026-09-30", 480.21],
    ["2026-10-29", 497.13],
  ],
  retail: null,
  listings: { n: 117, date: "2026-10-29", source: "eBay listings counted" },
};

export function lifecycleSvg(points, retail) {
  const pts = (points || []).filter((p) => p && Number(p[1]) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(p[0]));
  if (pts.length < 2) return `<p class="tf-miss">No price</p>`;
  const vals = pts.map((p) => Number(p[1]));
  const retailN = retail && Number(retail.price) > 0 ? Number(retail.price) : null;
  const all = retailN ? vals.concat([retailN]) : vals;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const w = 640;
  const h = 220;
  const x = (i) => 16 + (i / (pts.length - 1)) * (w - 32);
  const y = (v) => 20 + ((max - v) / span) * (h - 48);
  const d = pts.map((p, i) => (i ? "L" : "M") + x(i).toFixed(1) + "," + y(p[1]).toFixed(1)).join(" ");
  const retailLine = retailN
    ? `<line x1="16" x2="${w - 16}" y1="${y(retailN).toFixed(1)}" y2="${y(retailN).toFixed(1)}" stroke="#c4baab" stroke-width="2" stroke-dasharray="4 4"/>`
    : "";
  const label = "Market " + money(pts[0][1]) + " on " + prettyDay(pts[0][0]) + " to " + money(pts.at(-1)[1]) + " on " + prettyDay(pts.at(-1)[0]);
  return `<svg class="tf-life" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}"><path d="${d}" fill="none" stroke="${GOLD}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${retailLine}</svg>`;
}

export function runwayText(listings) {
  if (!listings || listings.n == null || !prettyDay(listings.date)) return "No listings counted";
  const n = Number(listings.n);
  if (!Number.isFinite(n) || n < 0) return "No listings counted";
  const where = listings.source ? " " + listings.source : " listings counted";
  return n + where + " on " + prettyDay(listings.date) + ". One count is not a runway.";
}

export function productSection(doc) {
  const row = doc || {};
  const pts = row.points || [];
  const first = pts[0];
  const last = pts[pts.length - 1];
  const move = first && last ? moveText(first[1], last[1]) : "No price";
  const retail = row.retail && Number(row.retail.price) > 0 && prettyDay(row.retail.date)
    ? money(row.retail.price) + " on " + prettyDay(row.retail.date)
    : "No price";
  const latest = last ? money(last[1]) : "No price";
  const when = last ? prettyDay(last[0]) : "Date not on this number";
  return `<section id="tf-product-v2" aria-labelledby="tf-life-h">
    <h2 id="tf-life-h">Lifecycle</h2>
    <p>${esc(row.name || "Sealed product")}. ${esc(row.source || "Source not on this number")}, ${esc(when)}.</p>
    <p><b>${esc(latest)}</b> <span class="tf-move">${esc(move)}</span></p>
    ${lifecycleSvg(pts, row.retail)}
    <p>Retail: ${esc(retail)}. ${retail === "No price" ? "No retail price is on this page." : ""}</p>
    <h2>Listings counted</h2>
    <p>${esc(runwayText(row.listings))}</p>
    <p class="muted">Sealed. No condition on this page.</p>
  </section>`;
}

export const PRODUCT_CSS = `
#tf-product-v2{margin:16px 0;padding:16px;border-radius:22px;background:#1a1815;border:1px solid #2f2b26}
#tf-product-v2 h2{font:600 22px/1.2 Georgia,serif;margin:0 0 8px}
.tf-life{width:100%;height:auto;display:block;border-radius:16px}
.tf-move{font-weight:600}
.tf-miss{min-height:44px}
html[data-theme="light"] #tf-product-v2{background:#fff;color:${INK};border-color:#e2dacb}
`;

export function sectionFromPage(html) {
  const src = String(html || "");
  const attr = src.match(/data-pts="([^"]+)"/);
  let points = [];
  if (attr) {
    try {
      const raw = attr[1].split("&" + "quot;").join('"');
      const parsed = JSON.parse(raw);
      const by = new Map();
      for (const p of parsed) {
        if (p && Number(p[1]) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(String(p[0]))) by.set(String(p[0]).slice(0, 7), [String(p[0]), Number(p[1])]);
      }
      points = [...by.values()];
    } catch { points = []; }
  }
  const listed = src.match(/(\d[\d,]*)\s+listings counted,\s*([A-Z][a-z]+)\s+(\d{1,2}),\s*(\d{4})/i);
  const month = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
  let listings = null;
  if (listed) {
    const mm = month[listed[2].toLowerCase()];
    if (mm) listings = { n: Number(listed[1].replace(/,/g, "")), date: listed[4] + "-" + mm + "-" + String(listed[3]).padStart(2, "0") };
  }
  const h1 = (src.match(/<h1[^>]*>([^<]+)/) || [])[1] || "Sealed product";
  return productSection({
    name: h1,
    sealed: true,
    source: src.includes("TCGplayer") ? "TCGplayer market" : "",
    points,
    retail: null,
    listings,
  });
}

export function injectProduct(html) {
  const src = String(html || "");
  if (src.includes('id="tf-product-v2"') || !src.includes("</body>")) return src;
  const block = `<style>${PRODUCT_CSS}</style>${sectionFromPage(src)}`;
  if (src.includes("</h1>")) return src.replace("</h1>", "</h1>" + block);
  return src.replace("</body>", block + "</body>");
}

export async function paintProduct(res, request) {
  if (!res || request.method === "HEAD") return res;
  const path = new URL(request.url).pathname;
  if (!path.startsWith("/p/")) return res;
  const type = res.headers.get("content-type") || "";
  if (!type.includes("text/html")) return res;
  const headers = new Headers(res.headers);
  headers.delete("content-length");
  return new Response(injectProduct(await res.text()), { status: res.status, statusText: res.statusText, headers });
}

export function previewPage(theme) {
  const mode = theme === "light" ? "light" : "dark";
  return `<!doctype html><html lang="en" data-theme="${mode}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>151 Elite Trainer Box · Catch'em</title>
<style>*{box-sizing:border-box}body{margin:0;background:${INK};color:${IVORY};font:16px/1.45 "IBM Plex Sans",system-ui,sans-serif;padding:16px 16px 40px}
html[data-theme="light"] body{background:${IVORY};color:${INK}}
html[data-theme="light"] a,html[data-theme="light"] .kicker,html[data-theme="light"] .logo span,html[data-theme="light"] .tf-tab[aria-pressed="true"],html[data-theme="light"] .tf-chip[aria-pressed="true"],html[data-theme="light"] .tf-dock a[aria-current="page"]{color:#7a5a1e}
h1{font:500 36px/1.1 Georgia,serif}.logo{font:600 28px/1 Georgia,serif;color:inherit;text-decoration:none;min-height:44px;display:inline-flex;align-items:center}.logo span{color:${GOLD}}
a{color:${GOLD}}
${PRODUCT_CSS}
</style></head><body>
<a class="logo" href="/">Catch'em<span>.</span></a>
<main id="main"><h1>151 Elite Trainer Box</h1>${productSection(ETB)}</main>
</body></html>`;
}
