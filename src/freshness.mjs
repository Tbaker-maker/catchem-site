// Public copy never names the age cutoff. Ops JSON lists asOf only, plus a
// late flag, so the cutoff stays in this file.

const FRESH_MS = 36 * 3600 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dayOf(raw) {
  const s = String(raw || "").trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

// A date-only asOf is the start of that day Pacific, same as newestStamp.
export function asOfMs(raw) {
  const s = String(raw || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return Date.parse(`${s}T08:00:00Z`);
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : NaN;
}

export function freshnessLate(raw, nowMs = Date.now()) {
  const t = asOfMs(raw);
  if (!Number.isFinite(t)) return true;
  return nowMs - t > FRESH_MS;
}

export function freshnessText(raw, nowMs = Date.now()) {
  const day = dayOf(raw);
  if (!day) return "";
  if (freshnessLate(raw, nowMs)) return "Prices updating";
  const label = MONTHS[Number(day.slice(5, 7)) - 1] + " " + Number(day.slice(8, 10));
  return `Updated ${label}`;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => {
    if (c === "&") return "&amp;";
    if (c === "<") return "&lt;";
    if (c === ">") return "&gt;";
    if (c === '"') return "&quot;";
    return "&#39;";
  });
}

export function freshnessBadgeHtml(raw, nowMs = Date.now()) {
  const text = freshnessText(raw, nowMs);
  if (!text) return "";
  const wait = text === "Prices updating" ? " fresh-wait" : "";
  return `<span class="fresh-badge${wait}" role="status">${esc(text)}</span>`;
}

export function listingsAsOf(doc) {
  const top = dayOf(doc && doc.asOf);
  if (top) return top;
  let best = "";
  const rows = Array.isArray(doc && doc.products) ? doc.products : [];
  for (const row of rows) {
    const d = dayOf(row && row.listingsCounted && row.listingsCounted.date);
    if (d && d > best) best = d;
  }
  return best;
}

export function buildFreshnessDoc(docs = {}, nowMs = Date.now()) {
  const row = (raw) => {
    const asOf = dayOf(raw);
    return { asOf, late: freshnessLate(raw, nowMs) };
  };
  return {
    prices: row(docs.prices),
    listings: row(docs.listings),
    pulse: row(docs.pulse),
    news: row(docs.news),
  };
}
