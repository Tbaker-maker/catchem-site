// One dated, sourced sentence from the page's own fields. A held price
// copies no price. Advice, a missing source, or a missing date returns nothing.
import { hasAdvice } from "./advice-rules.mjs";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function money(n) {
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function longDay(raw) {
  const s = String(raw || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const month = MONTHS[Number(s.slice(5, 7)) - 1];
  if (!month) return "";
  return `${month} ${Number(s.slice(8, 10))}, ${s.slice(0, 4)}`;
}

function shortDay(raw) {
  const full = longDay(raw);
  return full ? full.replace(/, \d{4}$/, "") : "";
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => {
    if (ch === "&") return "&" + "amp;";
    if (ch === "<") return "&" + "lt;";
    if (ch === ">") return "&" + "gt;";
    if (ch === '"') return "&" + "quot;";
    return "&#" + "39;";
  });
}

// A feed read uses only fields already on that card. No parsed headline numbers.
export function readFactInput(card = {}) {
  const hrefRaw = String(card.href || "").trim();
  const id = String(card.id || "").trim();
  let href = hrefRaw.startsWith("/") ? hrefRaw.split("?")[0] : "";
  if (!href && id && !/["'<>\s]/.test(id)) href = "/feed/r/" + encodeURIComponent(id);
  return {
    name: String(card.name || card.headline || "").trim(),
    href,
    held: card.held === true || card.priceStatus === "checking",
    price: card.price,
    source: String(card.source || "").trim(),
    date: card.date || card.asOf,
    changePct: card.changePct,
    days: card.windowDays || card.days,
    listings: card.listings,
    listingsDate: card.listingsAsOf || card.listingsDate,
  };
}

export function copyFact(row = {}) {
  const name = String(row.name || "").replace(/[\u2014\u2013]/g, "").trim();
  const path = String(row.href || "").trim();
  if (!name || !path.startsWith("/") || path.includes(" ") || hasAdvice(name)) return "";
  const held = row.held === true || row.priceStatus === "checking";
  const bits = [];
  if (held) {
    bits.push("Price being checked.");
  } else if (Number(row.price) > 0) {
    const src = String(row.source || "").replace(/[\u2014\u2013]/g, "").trim();
    const date = longDay(row.date || row.asOf);
    if (!src || !date || hasAdvice(src)) return "";
    bits.push(`$${money(row.price)} ${src}, ${date}`);
  } else return "";
  if (!held && Number.isFinite(Number(row.changePct)) && Number(row.days) > 0) {
    const n = Number(row.changePct);
    const abs = Math.abs(Math.round(n * 10) / 10);
    const shown = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
    const word = n < 0 ? "down" : n > 0 ? "up" : "";
    if (word) bits.push(`${word} ${shown}% in ${Number(row.days)} days`);
  }
  if (!held && Number.isFinite(Number(row.listings)) && Number(row.listings) >= 0 && shortDay(row.listingsDate)) {
    bits.push(`${Math.round(Number(row.listings)).toLocaleString("en-US")} eBay listings counted ${shortDay(row.listingsDate)}`);
  }
  let text = `${name}: ${bits.join(", ")}`;
  if (!text.endsWith(".")) text += ".";
  text += ` catchemtcg.com${path}`;
  if (/[\u2014\u2013]/.test(text) || hasAdvice(text)) return "";
  if (held && /\$\d/.test(text)) return "";
  return text;
}

export function copyFactHtml(row) {
  const text = copyFact(row);
  if (!text) return "";
  return `<p class="copy-fact"><button type="button" class="copy-fact-btn">Copy fact</button> <span class="copy-fact-line">${esc(text)}</span></p>`;
}

export const COPY_FACT_CSS = `.copy-fact{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:8px 0;max-width:100%}.copy-fact-btn{appearance:none;border:0;background:#d9b779;color:#1a1407;font:600 14px/1 var(--sans,system-ui);min-height:44px;padding:0 16px;border-radius:999px;cursor:pointer}.copy-fact-line{flex:1 1 220px;min-width:0;margin:0;font:500 14px/1.4 var(--sans,system-ui);overflow-wrap:anywhere}`;

export const COPY_FACT_JS = `(function(){document.querySelectorAll(".copy-fact").forEach(function(p){if(p.dataset.ready)return;p.dataset.ready="1";var b=p.querySelector(".copy-fact-btn"),t=p.querySelector(".copy-fact-line");if(!b||!t)return;b.addEventListener("click",function(){var s=t.textContent||"";if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(s);});});})();`;
