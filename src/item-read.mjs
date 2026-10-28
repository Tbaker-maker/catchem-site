// "Our read" block on /c/* and /p/* pages, from the item's row in feed/items/<set>.json.
// Every figure carries its date. Empty fields hide; no block when nothing is backed.
import { factChips, factCards } from "./read-sheet.mjs";
import { banGuard } from "./advice-rules.mjs";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Shared advice-phrase rules (Catchem-data rules/advice-phrases.json). "supply" is a house rule: say listings counted.
const BANNED = banGuard("item read", /\bsupply\b/i);
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(iso || "") ? `${months[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}` : "");
const pp = (n) => (Number(n) > 0 ? "+" : "") + Math.round(Number(n) * 10) / 10 + "%";

export function itemReadBlock(f, { skipRip = false, skipRotation = false, skipWindows = false, kind = "" } = {}) {
  if (!f || typeof f !== "object") return "";
  const doc = { ...f, id: f.id || "item", asOf: f.asOf || f.item?.priceAsOf || "", kind: kind || f.kind || f.item?.kind || "" };
  if (skipRip) delete doc.rip;
  const chips = factChips({ ...doc, change: { ...(doc.change || {}), d30: undefined, y1: undefined } });
  const ch = doc.change || {};
  const windows = [["7-day", ch.d7], ["30-day", ch.d30], ["90-day", ch.d90], ["1Y", ch.y1]].filter(([, c]) => c && Number.isFinite(c.pct) && short(c.from))
    .map(([l, c]) => `<li class="rd-chip">${esc(`${l} ${pp(c.pct)}, ${short(c.from)} to ${short(c.to)}`)}</li>`);
  if (!skipRotation && doc.rotation && (doc.rotation.mark || doc.rotation.status)) chips.push(`<li class="rd-chip">${esc([doc.rotation.mark ? `Mark ${doc.rotation.mark}` : "", doc.rotation.status].filter(Boolean).join(" · "))}</li>`);
  const fc = factCards(doc);
  const line = String(doc.line || doc.breakdown?.sections?.[0]?.text || "").trim();
  const lineHtml = line && !BANNED.test(line) && !/[\u2014\u2013]/.test(line) ? `<p class="ir-line">${esc(line)}</p>` : "";
  // Extra section paras only when they add a signal not already in the lead line.
  const extras = Array.isArray(doc.breakdown?.sections) ? doc.breakdown.sections : [];
  const detail = extras
    .filter((s) => s && s.text && s.text !== line && !line.includes(s.text) && !BANNED.test(s.text) && !/[\u2014\u2013]/.test(s.text))
    .slice(0, 2)
    .map((s) => `<p class="ir-detail"><strong>${esc(s.title || "Detail")}</strong> ${esc(s.text)}${s.note ? ` <span class="muted">${esc(s.note)}</span>` : ""}</p>`)
    .join("");
  const all = [...(skipWindows ? [] : windows), ...chips];
  const cardsHtml = fc.ordered || `${fc.range || ""}${fc.cards.join("")}${fc.similar || ""}`;
  const body = `${lineHtml}${detail}${all.length ? `<ul class="rd-chips">${all.join("")}</ul>` : ""}${fc.pattern}${cardsHtml ? `<div class="rd-cards">${cardsHtml}</div>` : ""}`;
  if (!body) return "";
  return `<section class="item-read" aria-label="Our read"><style>${CSS}</style><h2>Our read</h2>${body}<p class="muted ir-src">${esc(`From our dated files. TCGplayer market, eBay asks and listings counted. As of ${short(doc.asOf)}.`)}</p></section>`;
}

const CSS = `.item-read{display:grid;gap:12px;margin:16px 0;padding:16px;border-radius:20px;background:#15130f;border:1px solid #2f2b26}
.item-read h2{margin:0;font-size:18px}.ir-line{margin:0;font-size:16px;line-height:1.45}.ir-detail{margin:0;font-size:14px;line-height:1.45}.ir-detail strong{font-weight:650}.ir-src{margin:0;font-size:13px}
.item-read .rd-chips{display:flex;gap:8px;flex-wrap:wrap;list-style:none;margin:0;padding:0}
.item-read .rd-chip{min-height:44px;display:inline-flex;align-items:center;padding:0 14px;border-radius:999px;background:rgba(255,255,255,.06);font:600 14px/1.2 var(--sans)}
.item-read .rd-pattern,.item-read .rd-card{padding:14px 16px;border-radius:18px;background:#1a1815;border:1px solid #2f2b26}
.item-read .rd-card h3,.item-read .rd-pattern h3{margin:0 0 6px;font-size:15px}.item-read .rd-card p,.item-read .rd-pattern p{margin:0 0 6px}
.item-read .rd-lead{font-weight:650;font-size:16px;line-height:1.35}
.item-read .rd-small{font-size:13px;color:#c4baab}
.item-read .rd-bars{display:grid;gap:6px;margin:8px 0 4px;min-height:44px}
.item-read .rd-bar{display:grid;grid-template-columns:92px minmax(0,1fr);gap:8px;align-items:center;min-height:18px}
.item-read .rd-bar span{font-size:12px;color:#c4baab}
.item-read .rd-bar i{display:block;height:8px;border-radius:999px;background:#8a8175}
.item-read .rd-bar.is-pat i{background:#7fc79a}
.item-read .rd-pattern,.item-read .rd-card{overflow:hidden}
.item-read a.rd-mom{display:block;color:inherit;text-decoration:none;min-height:44px}
.item-read a.rd-mom:focus-visible{outline:2px solid #d9b779;outline-offset:3px}
.item-read .rd-spark{display:block;width:100%;height:72px;min-height:72px;max-width:100%;margin:2px 0 8px}
.item-read .rd-cards{display:grid;gap:10px}@media(min-width:800px){.item-read .rd-cards{grid-template-columns:1fr 1fr}}`;
