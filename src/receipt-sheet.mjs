// Tap a number, get the receipt. Flag TF_RECEIPT defaults off.
// A missing price is "No price". It is never shown as 0.

export const FLAG = "TF_RECEIPT";

const INK = "#12100e";
const IVORY = "#efe9de";
const GOLD = "#d9b779";

export function receiptOn(env) {
  return String(env && env.TF_RECEIPT || "").trim().toLowerCase() === "on";
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


export function noDash(s) {
  return String(s ?? "").replace(/\s*[\u2014\u2013]\s*/g, ": ").replace(/[\u2014\u2013]/g, ": ");
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

export function listingsText(n, date) {
  if (n == null || n === "" || !prettyDay(date)) return "No listings counted";
  const num = Number(n);
  if (!Number.isFinite(num) || num < 0) return "No listings counted";
  return num + " listings counted on " + prettyDay(date);
}

export function receiptModel(input) {
  const row = input || {};
  const price = row.missing ? "No price" : money(row.price);
  return {
    title: noDash(row.name || "This number"),
    price,
    source: noDash(row.source || "Source not on this number"),
    date: prettyDay(row.date) || "Date not on this number",
    listings: listingsText(row.listings, row.listingsDate || row.date),
    method: noDash(row.method || "Method not on this number"),
    sealed: row.sealed === true,
  };
}

export const ETB_RECEIPT = receiptModel({
  name: "151 Elite Trainer Box",
  price: 497.13,
  source: "TCGplayer market",
  date: "2026-10-29",
  listings: 117,
  listingsDate: "2026-10-29",
  method: "TCGplayer market on the product page. Not an average. 117 eBay listings counted on Oct 29, 2026.",
  sealed: true,
});

export function numButton(model) {
  const m = model.price ? model : receiptModel(model);
  return `<button type="button" class="tf-num" data-receipt="1" data-title="${esc(m.title)}" data-price="${esc(m.price)}" data-source="${esc(m.source)}" data-date="${esc(m.date)}" data-listings="${esc(m.listings)}" data-method="${esc(m.method)}">${esc(m.price)}</button>`;
}

export const RECEIPT_CSS = `
.tf-num{min-height:44px;min-width:44px;padding:8px 14px;border-radius:14px;border:1px solid ${GOLD};background:transparent;color:inherit;font:600 22px/1.2 Georgia,serif;cursor:pointer}
.tf-sheet{position:fixed;inset:0;z-index:40;display:none;align-items:flex-end;justify-content:center;background:rgba(18,16,14,.55)}
.tf-sheet.on{display:flex}
.tf-panel{width:min(560px,100%);margin:0;padding:14px 16px calc(18px + env(safe-area-inset-bottom));border-radius:22px 22px 0 0;background:${INK};color:${IVORY};border:1px solid #2f2b26;border-bottom:0}
.tf-grab{width:44px;height:4px;border-radius:999px;background:${GOLD};margin:4px auto 12px}
.tf-panel h2{margin:0 0 8px;font:600 22px/1.15 Georgia,serif}
.tf-panel .tf-price{margin:0 0 12px;font:600 36px/1 Georgia,serif;color:${GOLD}}
.tf-row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid #2f2b26;font:500 16px/1.35 "IBM Plex Sans",system-ui,sans-serif}
.tf-row span{color:#c4baab}
.tf-row b{font-weight:600;text-align:right}
.tf-close{min-height:44px;min-width:44px;margin-top:12px;padding:0 16px;border-radius:999px;border:1px solid ${GOLD};background:${GOLD};color:${INK};font:600 16px/1 "IBM Plex Sans",system-ui,sans-serif}
html[data-theme="light"] .tf-panel{background:${IVORY};color:${INK};border-color:#e2dacb}
html[data-theme="light"] .tf-row{border-top-color:#e2dacb}
html[data-theme="light"] .tf-row span{color:#5c564e}
html[data-theme="light"] .tf-price{color:#7a5a1e}
`;

export const RECEIPT_JS = `(function(){
  if (window.__tfReceipt) return;
  window.__tfReceipt = 1;
  var root = document.createElement("div");
  root.className = "tf-sheet";
  root.id = "tf-receipt";
  root.innerHTML = '<div class="tf-panel" role="dialog" aria-modal="true" aria-labelledby="tf-receipt-h"><div class="tf-grab"></div><h2 id="tf-receipt-h">Receipt</h2><p class="tf-price" id="tf-receipt-price"></p><div class="tf-row"><span>Source</span><b id="tf-receipt-source"></b></div><div class="tf-row"><span>Date</span><b id="tf-receipt-date"></b></div><div class="tf-row"><span>Listings counted</span><b id="tf-receipt-listings"></b></div><div class="tf-row"><span>Method</span><b id="tf-receipt-method"></b></div><button type="button" class="tf-close" id="tf-receipt-close">Close</button></div>';
  document.body.appendChild(root);
  var last = null;
  function set(id, text){ var n = document.getElementById(id); if (n) n.textContent = text || ""; }
  function open(btn){
    last = btn;
    set("tf-receipt-h", btn.getAttribute("data-title") || "Receipt");
    set("tf-receipt-price", btn.getAttribute("data-price") || "No price");
    set("tf-receipt-source", btn.getAttribute("data-source") || "Source not on this number");
    set("tf-receipt-date", btn.getAttribute("data-date") || "Date not on this number");
    set("tf-receipt-listings", btn.getAttribute("data-listings") || "No listings counted");
    set("tf-receipt-method", btn.getAttribute("data-method") || "Method not on this number");
    root.classList.add("on");
    document.getElementById("tf-receipt-close").focus();
  }
  function close(){ root.classList.remove("on"); if (last && last.focus) last.focus(); }
  document.addEventListener("click", function(ev){
    var btn = ev.target && ev.target.closest && ev.target.closest("[data-receipt]");
    if (btn) { ev.preventDefault(); open(btn); return; }
    if (ev.target === root) close();
  });
  document.getElementById("tf-receipt-close").addEventListener("click", close);
  document.addEventListener("keydown", function(ev){ if (ev.key === "Escape") close(); });
})();`;

export function sheetShell() {
  return `<div class="tf-sheet" id="tf-receipt" data-tf-receipt="1"></div><style>${RECEIPT_CSS}</style><script>${RECEIPT_JS}</script>`;
}

export function injectReceipt(html) {
  const src = String(html || "");
  if (!src || src.includes("data-tf-receipt")) return src;
  if (!src.includes("</body>")) return src;
  return src.replace("</body>", sheetShell() + "</body>");
}

export async function paintReceipt(res, request) {
  if (!res || request.method === "HEAD") return res;
  const type = res.headers.get("content-type") || "";
  if (!type.includes("text/html")) return res;
  const html = injectReceipt(await res.text());
  const headers = new Headers(res.headers);
  headers.delete("content-length");
  return new Response(html, { status: res.status, statusText: res.statusText, headers });
}

export function previewBody() {
  const blank = receiptModel({ name: "A number with nothing behind it", missing: true, sealed: true });
  return `<main id="main">
    <p class="kicker">Receipt</p>
    <h1>Tap a number.</h1>
    <p>151 Elite Trainer Box. Sealed, so there is no condition.</p>
    <p>${numButton(ETB_RECEIPT)}</p>
    <p>Missing price</p>
    <p>${numButton(blank)}</p>
  </main>`;
}

export function previewPage(theme) {
  const mode = theme === "light" ? "light" : "dark";
  return `<!doctype html><html lang="en" data-theme="${mode}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Receipt · Catch'em</title>
<style>
:root{--bg:${INK};--txt:${IVORY}}
html[data-theme="light"]{--bg:${IVORY};--txt:${INK}}
html[data-theme="light"] a,html[data-theme="light"] .kicker,html[data-theme="light"] .logo span{color:#7a5a1e}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font:16px/1.45 "IBM Plex Sans",system-ui,sans-serif;padding:16px 16px 32px}
a{color:${GOLD}}h1{font:500 40px/1.05 Georgia,serif;margin:8px 0 12px}
.logo{font:600 28px/1 Georgia,serif;color:inherit;text-decoration:none;min-height:44px;display:inline-flex;align-items:center}
.logo span{color:${GOLD}}
.kicker{letter-spacing:.08em;text-transform:uppercase;color:${GOLD};font:600 12px/1 system-ui}
main a,button{min-height:44px}
</style></head><body>
<a class="logo" href="/">Catch'em<span>.</span></a>
${previewBody()}
${sheetShell()}
</body></html>`;
}
