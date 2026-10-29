// Rip value: history-based estimates from data/derived/rip-roi.json.
// Every number on the page is a field from that file, with its date.
import { esc } from "./ui.mjs";
import { brandedTile } from "./catalogue-image.mjs";
import { shortDate } from "./ir-cycle.mjs";

const TYPE_LABEL = {
  "booster-pack": "Pack",
  "booster-box": "Booster box",
  "booster-bundle": "Booster bundle",
  etb: "Elite Trainer Box",
  "pc-etb": "Pokémon Center ETB",
};

const BANDS = [
  ["under-25", "Under $25", (n) => n < 25],
  ["25-99", "$25 to $99", (n) => n >= 25 && n < 100],
  ["100-249", "$100 to $249", (n) => n >= 100 && n < 250],
  ["250-up", "$250 and up", (n) => n >= 250],
];

const RIP_CSS = `.rip-head h1{margin:6px 0 4px}.rip-lede{margin:0 0 8px;max-width:68ch}.rip-list{display:grid;gap:12px;margin:8px 0 20px}.rip-row{display:grid;gap:10px;padding:14px;border:1px solid var(--line);border-radius:20px;background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.015))}.rip-id{display:grid;grid-template-columns:88px minmax(0,1fr);gap:12px;align-items:center;color:inherit;text-decoration:none;min-height:44px}.rip-id img{width:88px;height:56px;object-fit:contain;background:#12100e;border-radius:12px}.rip-id .tile{width:88px;max-width:88px}.rip-id b{display:block;font-weight:650;letter-spacing:-.01em}.rip-id .rip-sub{display:block;font-size:13px;opacity:.7;margin-top:2px}.rip-nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:8px;margin:0}.rip-nums div{padding:8px 10px;border-radius:14px;background:rgba(255,255,255,.045)}.rip-nums dt{font:500 12px/1.3 var(--sans);opacity:.65}.rip-nums dd{margin:2px 0 0;font:650 16px/1.2 var(--sans);letter-spacing:-.01em}.rip-when{margin:0;font-size:12px}.rip-sources{margin:8px 0 16px;border:1px solid var(--line);border-radius:16px;padding:10px 14px}.rip-sources summary{cursor:pointer;font-weight:600;min-height:44px;display:flex;align-items:center}.rip-sources li{font-size:13px;margin:4px 0}@media(max-width:600px){.rip-id{grid-template-columns:72px minmax(0,1fr)}.rip-id img{width:72px}}`;

function cash(n) {
  const x = Number(n);
  if (!(x > 0)) return "";
  return "$" + x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "";
  const rounded = Math.round(x * 10) / 10;
  return (Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)) + "%";
}

function bandOf(price) {
  const n = Number(price);
  if (!(n > 0)) return "";
  return (BANDS.find((row) => row[2](n)) || [])[0] || "";
}

function safeHref(url) {
  const raw = String(url || "").trim();
  if (!/^https:\/\//.test(raw)) return "";
  return raw.replace(/\u2014/g, "%E2%80%94").replace(/\u2013/g, "%E2%80%93");
}

function face(row, logo) {
  const src = String(logo || "");
  const ok = /^https:\/\//.test(src) || /^\/img\/[a-z0-9]+\/logo\.png$/i.test(src);
  if (ok) return `<img alt="" width="88" height="56" loading="lazy" decoding="async" src="${esc(src)}">`;
  return brandedTile("sealed", { kind: "sealed", subtype: row.subtype, name: row.name });
}

function stat(label, value) {
  if (!value) return "";
  return `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
}

function orderedRows(doc) {
  const byId = new Map();
  for (const row of doc.rows || []) {
    if (row && row.id && !byId.has(row.id)) byId.set(row.id, row);
  }
  const ranking = Array.isArray(doc.ranking) ? doc.ranking : [];
  const seen = new Set();
  const out = [];
  for (const id of ranking) {
    const row = byId.get(id);
    if (!row || seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  for (const row of byId.values()) {
    if (!seen.has(row.id)) out.push(row);
  }
  return out;
}

export function ripBody(doc, ctx = {}) {
  const eras = ctx.eras && typeof ctx.eras === "object" ? ctx.eras : {};
  const logos = ctx.logos && typeof ctx.logos === "object" ? ctx.logos : {};
  const rows = doc && Array.isArray(doc.rows) ? orderedRows(doc) : [];
  if (!rows.length) {
    const why = doc
      ? "No products scored on this build."
      : "The published rip file did not load. Open this page again in a minute.";
    return `<main id="main" tabindex="-1" class="wrap"><h1>Rip value</h1><p class="muted">${esc(why)}</p><p><a href="/sets">Browse sets</a></p></main>`;
  }
  const asOf = shortDate(doc.asOf);
  const rates = shortDate(doc.pullRatesUpdated);
  const label = String(doc.label || "").trim() || "Rip value";
  const note = String(doc.note || "").trim();
  const copy = String(doc.method?.copy || "").trim();
  const painted = rows.map((row) => {
    const era = String(eras[row.setSlug] || "");
    const type = TYPE_LABEL[row.subtype] || "";
    const price = cash(row.price);
    const pull = cash(row.contentsEV);
    const roi = pct(row.roiPct);
    const beat = pct(row.beatChance);
    const typical = cash(row.median);
    const whenBits = [];
    const priceDay = shortDate(row.priceAsOf);
    if (row.priceSource && priceDay) whenBits.push(`${row.priceSource}, ${priceDay}`);
    else if (priceDay) whenBits.push(priceDay);
    else if (row.priceSource) whenBits.push(String(row.priceSource));
    if (asOf && row.priceAsOf && String(row.priceAsOf).slice(0, 10) !== String(doc.asOf || "").slice(0, 10)) whenBits.push(`File ${asOf}`);
    const nums = [
      stat("Average pull value", pull),
      stat("Price", price),
      stat("ROI", roi),
      stat("Chance an opening beats the price", beat),
      stat("Typical opening", typical),
    ].join("");
    const sub = [type, row.set, era].filter(Boolean).map((bit) => esc(bit)).join(" · ");
    const href = row.setSlug ? `/sets/${encodeURIComponent(row.setSlug)}` : "";
    const inner = `${face(row, logos[row.setSlug])}<span><b>${esc(row.name || "")}</b>${sub ? `<span class="rip-sub">${sub}</span>` : ""}</span>`;
    const id = href ? `<a class="rip-id" href="${esc(href)}">${inner}</a>` : `<div class="rip-id">${inner}</div>`;
    return `<article class="rip-row" data-era="${esc(era)}" data-type="${esc(type ? row.subtype : "")}" data-band="${esc(bandOf(row.price))}">${id}${nums ? `<dl class="rip-nums">${nums}</dl>` : ""}${whenBits.length ? `<p class="rip-when muted">${esc(whenBits.join(". "))}</p>` : ""}</article>`;
  }).join("");
  const eraNames = [...new Set(rows.map((row) => eras[row.setSlug]).filter(Boolean))];
  const types = [...new Set(rows.map((row) => row.subtype).filter((key) => TYPE_LABEL[key]))];
  const bands = BANDS.filter((band) => rows.some((row) => bandOf(row.price) === band[0]));
  const eraOpts = eraNames.map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join("");
  const typeOpts = types.map((key) => `<option value="${esc(key)}">${esc(TYPE_LABEL[key])}</option>`).join("");
  const bandOpts = bands.map((band) => `<option value="${esc(band[0])}">${esc(band[1])}</option>`).join("");
  const filters = (eraOpts || typeOpts || bandOpts)
    ? `<div class="filters" aria-label="Filter rip value">${eraOpts ? `<select id="rip-era" aria-label="Era"><option value="">All eras</option>${eraOpts}</select>` : ""}${typeOpts ? `<select id="rip-type" aria-label="Product type"><option value="">All product types</option>${typeOpts}</select>` : ""}${bandOpts ? `<select id="rip-band" aria-label="Price band"><option value="">All prices</option>${bandOpts}</select>` : ""}</div><p class="muted" id="rip-count">${rows.length} products</p><p class="muted" id="rip-empty" hidden>Nothing matches these filters.</p>`
    : "";
  const sources = (doc.sources || []).map((row) => {
    const href = safeHref(row?.url);
    if (!href) return "";
    const day = shortDate(row.published);
    const who = String(row.author || "").trim();
    const bits = [day, who].filter(Boolean).join(", ");
    return `<li><a href="${esc(href)}" rel="noopener">${esc(bits || href)}</a></li>`;
  }).filter(Boolean).join("");
  const sourceBlock = sources ? `<details class="rip-sources"><summary>Pull rate sources</summary><ul>${sources}</ul></details>` : "";
  const lede = [note, copy].filter(Boolean).map((line) => `<p class="rip-lede">${esc(line)}</p>`).join("");
  const meta = [asOf ? `As of ${asOf}` : "", rates ? `Pull rates updated ${rates}` : ""].filter(Boolean).join(". ");
  const script = `<script>
(function(){
  var era=document.getElementById("rip-era");
  var type=document.getElementById("rip-type");
  var band=document.getElementById("rip-band");
  var count=document.getElementById("rip-count");
  var empty=document.getElementById("rip-empty");
  function apply(){
    var e=era?era.value:"";
    var t=type?type.value:"";
    var b=band?band.value:"";
    var n=0;
    document.querySelectorAll(".rip-row").forEach(function(row){
      var ok=(!e||row.getAttribute("data-era")===e)&&(!t||row.getAttribute("data-type")===t)&&(!b||row.getAttribute("data-band")===b);
      row.hidden=!ok;
      if(ok) n++;
    });
    if(count) count.textContent=n+" products";
    if(empty) empty.hidden=n!==0;
  }
  [era,type,band].forEach(function(el){ if(el) el.addEventListener("change", apply); });
})();
</script>`;
  return `<main id="main" tabindex="-1" class="wrap"><style>${RIP_CSS}</style><div class="rip-head"><h1>${esc(label)}</h1>${lede}${meta ? `<p class="muted">${esc(meta)}.</p>` : ""}</div>${sourceBlock}${filters}<div class="rip-list">${painted}</div>${filters ? script : ""}</main>`;
}
