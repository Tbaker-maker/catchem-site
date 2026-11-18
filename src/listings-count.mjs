// One listings counted number for the page chip, Key stats, and the share card.
// Sealed: the latest dated row of the dive series the chart draws.
// Singles: the item-read count. listings-counted.json is not a source here.
// A missing row is null. Nothing is estimated.
import { loadDive, loadDiveIndex, loadItemRead } from "./data.mjs";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function seriesRows(series) {
  return (series || [])
    .filter((point) => point && ISO.test(String(point.date || "").slice(0, 10)) && Number.isFinite(Number(point.listingCount)) && Number(point.listingCount) >= 0)
    .map((point) => ({ day: String(point.date).slice(0, 10), n: Math.round(Number(point.listingCount)) }))
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

// kind "sealed" ignores itemListings. kind "single" ignores the series.
export function resolveListings({ kind = "single", series = null, itemListings = null } = {}) {
  if (kind === "sealed") {
    const rows = seriesRows(series);
    if (!rows.length) return null;
    const last = rows[rows.length - 1];
    return { n: last.n, day: last.day };
  }
  const n = Number(itemListings && itemListings.n);
  const day = String(itemListings && (itemListings.day || itemListings.date) || "").slice(0, 10);
  if (!Number.isFinite(n) || n < 0 || !ISO.test(day)) return null;
  return { n: Math.round(n), day };
}

export async function loadProductListings(card, fetchImpl = fetch) {
  if (!card || !card.id) return null;
  try {
    if (card.kind === "sealed") {
      const diveMap = await loadDiveIndex(fetchImpl);
      const id = String(card.id);
      const key = (diveMap && diveMap.byTcgcsv && diveMap.byTcgcsv[id]) || ((diveMap && diveMap.ids || []).includes(id) ? id : "");
      if (!key) return null;
      const dive = await loadDive(key, fetchImpl);
      return resolveListings({ kind: "sealed", series: dive && dive.series });
    }
    if (!card.setSlug) return null;
    const row = await loadItemRead(card.setSlug, card.id, fetchImpl);
    const listed = row && row.listings;
    return resolveListings({ kind: "single", itemListings: listed ? { n: listed.n, day: listed.date || listed.day } : null });
  } catch {
    return null;
  }
}
