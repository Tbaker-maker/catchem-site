// Sealed product cards. Cutout on top, then the name, type, price date, and change.
// Sizes come from the cutout file. Every card sits on one baseline.

export const SEALED_SHELF_CSS = `
.seal-shelf{display:flex;gap:22px;align-items:stretch;overflow-x:auto;padding:8px 2px 22px;scroll-snap-type:x mandatory}
.seal-card{flex:0 0 auto;width:max-content;min-width:176px;max-width:320px;display:flex;flex-direction:column;gap:12px;padding:16px 16px 18px;border-radius:22px;background:#221e1a;color:#efe9de;text-decoration:none;border:1px solid rgba(255,255,255,.08);scroll-snap-align:start;box-shadow:0 10px 28px rgba(0,0,0,.22)}
.seal-stage{height:244px;display:flex;align-items:flex-end;justify-content:center}
.seal-stage img{height:calc(var(--rel, 1) * 228px);width:auto;max-width:none}
.seal-name{font:600 15px/1.3 var(--sans, sans-serif);letter-spacing:0}
.seal-type{display:inline-flex;align-self:flex-start;padding:4px 10px;border-radius:999px;background:rgba(217,183,121,.16);color:#e4c98a;font:600 12px/1.2 var(--sans, sans-serif)}
.seal-price{font:600 18px/1.2 var(--sans, sans-serif)}
.seal-asof{display:block;margin-top:4px;font:500 12px/1.3 var(--sans, sans-serif);opacity:.68}
.seal-chs{display:flex;flex-wrap:wrap;gap:6px}
.seal-ch{padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.06);font:600 12px/1.2 var(--sans, sans-serif);color:#b7aea3}
.seal-ch.up{color:#1f8a3b;background:rgba(31,138,59,.12)}
.seal-ch.down{color:#b7aea3}
@media (prefers-color-scheme: light){
  .seal-card{background:#f7f5f2;color:#1c1916;border-color:rgba(0,0,0,.08);box-shadow:0 10px 24px rgba(40,30,16,.08)}
  .seal-type{background:rgba(120,84,20,.1);color:#7a5a1e}
  .seal-ch{background:rgba(0,0,0,.05);color:#5c564e}
  .seal-ch.up{color:#1b7a34;background:rgba(31,138,59,.12)}
  .seal-ch.down{color:#5c564e}
}
`.trim();

const TYPE_LABEL = {
  "booster-pack": "Booster pack",
  "sleeved-pack": "Sleeved pack",
  "prize-pack": "Prize pack",
  blister: "Blister",
  "mini-tin": "Mini tin",
  "booster-box": "Booster box",
  "booster-bundle": "Booster bundle",
  etb: "ETB",
  "pc-etb": "PC ETB",
  tin: "Tin",
  deck: "Deck",
  "build-battle": "Build and Battle",
  "special-collection": "Collection",
  upc: "UPC",
  case: "Case",
};

function pointsOf(hist) {
  const out = [];
  for (const row of hist || []) {
    if (Array.isArray(row) && row.length >= 2) out.push([String(row[0]).slice(0, 10), Number(row[1])]);
    else if (row && row.date) out.push([String(row.date).slice(0, 10), Number(row.price)]);
  }
  return out.filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p[0]) && p[1] > 0).sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

export function changeOver(hist, asOf, days) {
  const pts = pointsOf(hist);
  if (!pts.length || !(days > 0)) return null;
  const end = /^\d{4}-\d{2}-\d{2}$/.test(String(asOf || "").slice(0, 10)) ? String(asOf).slice(0, 10) : pts[pts.length - 1][0];
  const now = [...pts].reverse().find((p) => p[0] <= end);
  if (!now) return null;
  const start = new Date(Date.parse(end + "T00:00:00Z") - days * 86400000).toISOString().slice(0, 10);
  const then = [...pts].reverse().find((p) => p[0] <= start);
  if (!then || then[0] === now[0]) return null;
  return { pct: (now[1] - then[1]) / then[1] * 100, from: then[0], to: now[0] };
}

function asOfLabel(iso) {
  const d = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months[Number(d.slice(5, 7)) - 1] + " " + Number(d.slice(8, 10));
}

function money(n) {
  if (!(Number(n) > 0)) return "";
  return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function chip(label, change) {
  if (!change) return "";
  const n = Math.round(Math.abs(change.pct) * 10) / 10;
  const num = n.toFixed(1).replace(/\.0$/, "");
  let word = "flat";
  let cls = "flat";
  if (change.pct >= 0.5) { word = "up"; cls = "up"; }
  else if (change.pct <= -0.5) { word = "down"; cls = "down"; }
  const text = word === "flat" ? label + " flat" : label + " " + word + " " + num + "%";
  return '<span class="seal-ch ' + cls + '">' + text + "</span>";
}

export function cutoutIndex(doc) {
  const map = {};
  for (const row of (doc && doc.products) || []) {
    if (!row || row.pass !== true || !row.file || !(row.height > 0)) continue;
    if (row.id) map[row.id] = row;
    if (row.siteId) map[row.siteId] = row;
    if (row.tcgPlayerId) map["tcgcsv-" + row.tcgPlayerId] = row;
  }
  return map;
}

export function sealedShelfHtml(items, doc, asOf) {
  const map = cutoutIndex(doc);
  const cards = [];
  const ids = {};
  for (const item of items || []) {
    if (!item || item.kind !== "sealed") continue;
    const cut = map[item.id];
    if (!cut) continue;
    cards.push({ item, cut });
    ids[item.id] = 1;
  }
  if (!cards.length) return { html: "", ids };
  const maxH = Math.max(...cards.map((c) => c.cut.height));
  cards.sort((a, b) => a.cut.height - b.cut.height || String(a.item.name).localeCompare(String(b.item.name)));
  const html = cards.map(({ item, cut }) => {
    const rel = Math.round((cut.height / maxH) * 1000) / 1000;
    const type = TYPE_LABEL[cut.productType] || "Sealed";
    const pts = pointsOf(item.hist);
    const day = asOfLabel((pts.length ? pts[pts.length - 1][0] : "") || asOf);
    const price = money(item.price);
    const priceLine = price
      ? '<div class="seal-price">' + price + (day ? '<span class="seal-asof">as of ' + day + "</span>" : "") + "</div>"
      : "";
    const chips = [
      chip("3M", changeOver(item.hist, asOf, 92)),
      chip("6M", changeOver(item.hist, asOf, 183)),
      chip("1Y", changeOver(item.hist, asOf, 366)),
    ].join("");
    const src = "/data/" + String(cut.file).replace(/^\/+/, "");
    return '<a class="seal-card" href="/p/' + encodeURIComponent(item.id) + '">'
      + '<span class="seal-stage"><img alt="' + esc(item.name) + '" style="--rel:' + rel + '" src="' + esc(src) + '"></span>'
      + '<span class="seal-name">' + esc(item.name) + "</span>"
      + '<span class="seal-type">' + esc(type) + "</span>"
      + priceLine
      + (chips ? '<span class="seal-chs">' + chips + "</span>" : "")
      + "</a>";
  }).join("");
  return { html: '<div class="seal-shelf">' + html + "</div>", ids };
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "\u0026amp;",
    "<": "\u0026lt;",
    ">": "\u0026gt;",
    '"': "\u0026quot;",
    "'": "\u0026#39;",
  }[c]));
}

export function shelfClientSource() {
  const body = [
    "const TYPE_LABEL = " + JSON.stringify(TYPE_LABEL) + ";",
    pointsOf.toString(),
    changeOver.toString(),
    asOfLabel.toString(),
    money.toString(),
    chip.toString(),
    cutoutIndex.toString(),
    sealedShelfHtml.toString(),
    esc.toString(),
    "return sealedShelfHtml;",
  ].join("\n");
  return "var sealedShelfHtml = (function(){\n" + body + "\n})();";
}

