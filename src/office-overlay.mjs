// Post Office picture overlay: the pinned card's TCGplayer market price, its date, and a
// 90-day mini chart, drawn on the picture when the user turns it on. The price and date
// are the same ones Ideas and Write the post print (search-lite + counts.json). The chart
// is the card's own dated series (cardPriceSeries) on the product chart's y domain (#418).
import { factsFor } from "./ai.mjs";
import { officeAllowed } from "./auth.mjs";
import { bucketRow, longHistOf } from "./data.mjs";
import { postOfficeOn } from "./post-office-flag.mjs";
import { yDomain } from "./product-chart.mjs";
import { readUser } from "./quota.mjs";
import { cardPriceSeries } from "./ui.mjs";

export const OVERLAY_PATH = "/post-office/api/overlay";
export const OVERLAY_DAYS = 90;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function miniSeries(series, asOf, days = OVERLAY_DAYS) {
  const end = DAY.test(String(asOf || "")) ? String(asOf) : "";
  const pts = [];
  for (const p of Array.isArray(series) ? series : []) {
    if (!Array.isArray(p) || !DAY.test(String(p[0])) || !(Number(p[1]) > 0)) continue;
    if (end && String(p[0]) > end) continue;
    pts.push([String(p[0]), Math.round(Number(p[1]) * 100) / 100]);
  }
  pts.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const last = end || (pts.length ? pts[pts.length - 1][0] : "");
  if (!last) return null;
  const from = new Date(Date.parse(last + "T00:00:00Z") - days * 86400000).toISOString().slice(0, 10);
  const win = pts.filter((p) => p[0] >= from);
  if (win.length < 2) return null;
  let hi = win[0];
  let lo = win[0];
  for (const p of win) {
    if (p[1] > hi[1]) hi = p;
    if (p[1] < lo[1]) lo = p;
  }
  return { from, to: last, points: win, domain: yDomain(win.map((p) => p[1]), "price"), high: hi, low: lo };
}

export async function overlayFor(ids, fetchImpl) {
  const facts = await factsFor(ids, fetchImpl);
  const out = [];
  for (const pin of facts.pins || []) {
    const card = pin.card;
    if (!card || !card.price || !card.price.startsWith("TCGplayer market:")) {
      out.push({ id: pin.id, price: "", chart: null });
      continue;
    }
    let chart = null;
    if (String(card.id).startsWith("tcgcsv-")) {
      try {
        const row = await bucketRow(card.id, fetchImpl);
        if (row) {
          if (row.kind !== "sealed") {
            const packed = await longHistOf(card.id, fetchImpl).catch(() => "");
            if (packed) row.longHist = packed;
          }
          chart = miniSeries(cardPriceSeries(row, Array.isArray(row.hist) ? row.hist : [], row.kind === "sealed"), facts.asOf);
        }
      } catch { chart = null; }
    }
    out.push({ id: pin.id, name: card.name, price: card.price, chart });
  }
  return { asOf: facts.asOf, cards: out };
}

export async function handleOverlay(request, env, fetchImpl = fetch) {
  const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
  if (!postOfficeOn(env)) return new Response(JSON.stringify({ ok: false }), { status: 404, headers });
  const user = await readUser(request, env);
  if (!officeAllowed(user, env)) return new Response(JSON.stringify({ ok: false }), { status: 403, headers });
  const ids = String(new URL(request.url).searchParams.get("ids") || "").split(",").map((s) => s.trim()).filter((s) => /^[A-Za-z0-9._-]{1,40}$/.test(s)).slice(0, 4);
  if (!ids.length) return new Response(JSON.stringify({ ok: false, error: "No ids." }), { status: 400, headers });
  const body = await overlayFor(ids, fetchImpl);
  return new Response(JSON.stringify({ ok: true, ...body }), { headers });
}
