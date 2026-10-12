// Four data-driven blocks: set value, rotation badge, upcoming releases,
// and eBay listings counted. Every number comes from a Catchem-data public
// file and is shown with that file's date. Copy: catchem-data-private
// docs/growth/feature-copy.md (458337d); the release list copy is the
// upcoming-releases version Tyler set on 2026-10-12.
import { imageTag, officialSrc } from "./catalogue-image.mjs";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function isDay(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")); }
export function shortDay(s) { return isDay(s) ? `${MONTHS[Number(s.slice(5, 7)) - 1]} ${Number(s.slice(8, 10))}` : ""; }
export function longDay(s) { return isDay(s) ? `${shortDay(s)}, ${s.slice(0, 4)}` : ""; }
export function cash(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return "";
  return "$" + x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
// Source text can carry em or en dashes; the site never shows them.
export function noDash(s) { return String(s ?? "").replace(/\s*[\u2014\u2013]\s*/g, ": "); }

export const COPY = {
  setValue: {
    heading: "Set value",
    explainer: "The top 10 cards by TCGplayer market price, plus a master-set total for one of each card in the set. Both come from the card file, dated on the page.",
    empty: "No card prices on file for this set.",
  },
  rotation: {
    heading: "Rotation",
    explainer: "A set page shows the regulation mark when at least 80% of that set's cards in the card file share one letter. A rotated date is shown only for a letter the two Pokémon announcements say left Standard: F on April 11, 2025, and G on April 10, 2026.",
    empty: "No regulation mark on file for this set.",
  },
  releases: {
    heading: "Coming up",
    explainer: "Upcoming Pokémon TCG releases with a confirmed date and source. Market shows only when a daily price file has one.",
    empty: "No confirmed releases on file.",
  },
  listings: {
    heading: "Listings counted",
    explainer: "An ask is a listing price. A listing is not a sale.",
    empty: "No listings counted for this product on this date.",
  },
};

// Base Set and its Shadowless printing are separate files that point at each other.
export const SET_PAIRS = {
  "base-set": { slug: "base-set-shadowless", label: "Base Set (Shadowless)" },
  "base-set-shadowless": { slug: "base-set", label: "Base Set" },
};

export function setValueBlock(doc, images = {}, slug = "") {
  const c = COPY.setValue;
  const pair = SET_PAIRS[slug || doc?.slug || ""];
  const pairLine = pair ? `<p class="sv-pair">Also see <a href="/sets/${esc(pair.slug)}">${esc(pair.label)} set value</a>.</p>` : "";
  const top = Array.isArray(doc?.top) ? doc.top.filter((r) => r && r.id && Number(r.price) > 0).slice(0, 10) : [];
  const m = doc?.master || {};
  const total = cash(m.total);
  if (!doc || (!top.length && !total)) {
    return `<section class="sv" aria-labelledby="sv-h"><h2 id="sv-h">${c.heading}</h2><p class="muted">${c.empty}</p>${pairLine}</section>`;
  }
  const rows = top.map((r, i) => {
    const nm = String(r.name || "").replace(new RegExp(" - " + String(r.number || "").replace(/[^0-9A-Za-z/]/g, "") + "$"), "");
    const pic = officialSrc({ id: r.id, kind: "single" }, images);
    const img = imageTag(pic.src, "row", nm, { kind: "single", name: nm, crop: pic.crop, alts: pic.alts });
    return `<li class="sv-row">${img}<a href="/c/${esc(r.id)}"><b>${i + 1}. ${esc(nm)}</b><br><span class="muted">${esc(r.number || "")}${r.date ? ` · ${esc(shortDay(r.date))}` : ""}</span></a><b class="sv-px">${cash(r.price)}</b></li>`;
  }).join("");
  const day = longDay(doc.asOf);
  const counts = Number.isFinite(Number(m.priced))
    ? `${Number(m.priced)} priced, ${Number(m.unpriced) || 0} unpriced${Number(m.inSet) ? `, ${Number(m.inSet)} cards in the set` : ""}.`
    : "";
  return `<section class="sv" aria-labelledby="sv-h"><h2 id="sv-h">${c.heading}</h2>
<p class="muted">${c.explainer}</p>
${total ? `<p class="sv-total">Master-set total <b>${total}</b></p>` : ""}
${counts ? `<p>${esc(counts)}</p>` : ""}
${rows ? `<ol class="sv-list">${rows}</ol>` : `<p class="muted">${c.empty}</p>`}
<p class="muted">TCGplayer market, ${esc(day)}. File: ${esc(doc.source || "")}.</p>
${pairLine}</section>`;
}

export function rotationRow(doc, slug) {
  const sets = Array.isArray(doc?.sets) ? doc.sets : [];
  return sets.find((s) => s && s.slug === slug) || null;
}

export function rotationBadge(row, doc) {
  if (!row || !row.mark) return "";
  const status = row.status ? ` · ${esc(row.status)}` : "";
  const day = longDay(doc?.asOf);
  return `<p class="rot-badge"><a href="/rotation" aria-label="Rotation: regulation mark ${esc(row.mark)}${row.status ? `, ${esc(row.status)}` : ""}"><span class="rm">${esc(row.mark)}</span> Regulation mark ${esc(row.mark)}${status}</a>${day ? ` <span class="muted">Card file, ${esc(day)}.</span>` : ""}</p>`;
}

const TYPE_LABELS = {
  "main-set": "Main set",
  "jp-product": "Japan product",
  product: "Product",
  decks: "Decks",
  wave: "Product wave",
};

export function upcomingReleases(doc, today) {
  const rows = Array.isArray(doc?.releases) ? doc.releases : [];
  return rows.filter((r) => r && isDay(r.date) && r.source && r.date >= today).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function releasesBody(doc, today) {
  const c = COPY.releases;
  const rows = upcomingReleases(doc, today);
  const list = rows.map((r) => {
    const src = String(r.source || "");
    const href = /^https?:\/\//.test(src) ? src : `https://${src}`;
    const host = src.replace(/^https?:\/\//, "").split("/")[0].split(".").slice(-2).join(".");
    const mk = r.market && Number(r.market.price) > 0 && isDay(r.market.date)
      ? `<p>Market <b>${cash(r.market.price)}</b> on ${esc(longDay(r.market.date))}, <a href="/p/${esc(r.market.id)}">${esc(noDash(r.market.name))}</a>. TCGplayer market.</p>`
      : "";
    return `<li class="rel"><p class="rel-date">${esc(longDay(r.date))}</p><h2>${esc(noDash(r.name))}</h2><p class="muted">${esc(TYPE_LABELS[r.type] || "Product")} · Source <a href="${esc(href)}" rel="noopener">${esc(host)}</a>${r.checked ? ` · checked ${esc(longDay(r.checked))}` : ""}</p>${mk}</li>`;
  }).join("");
  return `<main id="main" tabindex="-1" class="wrap releases"><h1>${c.heading}</h1>
<p class="muted">${c.explainer}</p>
${list ? `<ol class="rel-list">${list}</ol>` : `<p class="muted">${c.empty}</p>`}
${doc?.checked ? `<p class="muted">Release file checked ${esc(longDay(doc.checked))}.</p>` : ""}
</main>`;
}

export function listingsEntry(doc, sealedId) {
  const rows = Array.isArray(doc?.products) ? doc.products : [];
  return rows.find((p) => p && p.id === sealedId) || null;
}

export function listingsCountedLine(entry) {
  const lc = entry?.listingsCounted;
  if (!lc || !Number.isFinite(Number(lc.n)) || !isDay(lc.date)) return "";
  const prev = lc.prev && Number.isFinite(Number(lc.prev.n)) && isDay(lc.prev.date) ? `, from ${Number(lc.prev.n)} on ${shortDay(lc.prev.date)}` : "";
  return `eBay listings counted: ${Number(lc.n)} on ${shortDay(lc.date)}${prev}.`;
}

export function listingsBlock(entry) {
  const line = listingsCountedLine(entry);
  if (!line) return "";
  return `<section class="lc" aria-labelledby="lc-h"><h2 id="lc-h">${COPY.listings.heading}</h2><p>${esc(line)}</p><p class="muted">${COPY.listings.explainer}</p></section>`;
}

export const FEATURE_CSS = `.sv-list{list-style:none;margin:8px 0;padding:0}.sv-row{display:grid;grid-template-columns:64px minmax(0,1fr) auto;gap:10px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line)}.sv-row a{min-width:0;overflow-wrap:anywhere;color:inherit;text-decoration:none}.sv-row img,.sv-row .tile{width:64px;max-width:64px;height:auto}.sv-total b{font:600 28px/1.1 var(--serif);color:var(--gold)}.rot-badge a{display:inline-flex;align-items:center;gap:8px;min-height:44px}.rot-badge .rm{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:1px solid var(--gold);border-radius:6px;font-weight:600;color:var(--gold)}.rel-list{list-style:none;margin:0;padding:0}.rel{border-bottom:1px solid var(--line);padding:10px 0;overflow-wrap:anywhere}.rel h2{margin:4px 0;font-size:1.1rem}.rel-date{margin:0;color:var(--gold);font-weight:600}`;
