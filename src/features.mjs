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
    return "";
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
${rows ? `<ol class="sv-list">${rows}</ol>` : ""}
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
  const checked = longDay(row.checked);
  return `<p class="rot-badge"><a href="/rotation" aria-label="Rotation: regulation mark ${esc(row.mark)}${row.status ? `, ${esc(row.status)}` : ""}"><span class="rm">${esc(row.mark)}</span> Regulation mark ${esc(row.mark)}${status}</a>${checked ? ` <span class="muted">Checked ${esc(checked)}.</span>` : day ? ` <span class="muted">Card file, ${esc(day)}.</span>` : ""}</p>`;
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

function releaseKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const RELEASE_PREFIX = /^(?:ex|xy|sm|sv|swsh|mee|me|sve|bw|dp|hgss|hs)\d*(?:pt\d+)?\s+/;

function releaseLogo(name, sets) {
  const hay = releaseKey(name);
  let best = "";
  let bestLen = 0;
  for (const set of sets || []) {
    const logo = String(set && set.logo || "");
    if (!/^\/img\/[a-z0-9]+\/logo\.png$/i.test(logo)) continue;
    const full = releaseKey(set.name);
    const rest = full.replace(RELEASE_PREFIX, "").trim();
    for (const token of [full, rest]) {
      if (token.length < 8 || !hay.includes(token)) continue;
      if (token.length > bestLen) {
        best = logo;
        bestLen = token.length;
      }
    }
  }
  return best;
}

export function releasesBody(doc, today, sets) {
  const c = COPY.releases;
  const rows = upcomingReleases(doc, today);
  const list = rows.map((r) => {
    const src = String(r.source || "");
    const href = /^https?:\/\//.test(src) ? src : `https://${src}`;
    const host = src.replace(/^https?:\/\//, "").split("/")[0].split(".").slice(-2).join(".");
    const logo = releaseLogo(r.name, sets);
    const face = logo ? `<img class="rel-logo" alt="" width="220" height="48" loading="lazy" decoding="async" src="${esc(logo)}">` : "";
    const mk = r.market && Number(r.market.price) > 0 && isDay(r.market.date)
      ? `<p>Market <b>${cash(r.market.price)}</b> on ${esc(longDay(r.market.date))}, <a href="/p/${esc(r.market.id)}">${esc(noDash(r.market.name))}</a>. TCGplayer market.</p>`
      : "";
    return `<li class="rel">${face}<p class="rel-date">${esc(longDay(r.date))}</p><h2>${esc(noDash(r.name))}</h2><p class="muted">${esc(TYPE_LABELS[r.type] || "Product")} · Source <a href="${esc(href)}" rel="noopener">${esc(host)}</a>${r.checked ? ` · checked ${esc(longDay(r.checked))}` : ""}</p>${mk}</li>`;
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

export const FEATURE_CSS = `.sv-list{list-style:none;margin:8px 0;padding:0}.sv-row{display:grid;grid-template-columns:64px minmax(0,1fr) auto;gap:10px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line)}.sv-row a{min-width:0;overflow-wrap:anywhere;color:inherit;text-decoration:none}.sv-row img,.sv-row .tile{width:64px;max-width:64px;height:auto}.sv-total b{font:600 28px/1.1 var(--serif);color:var(--gold)}.rot-badge a{display:inline-flex;align-items:center;gap:8px;min-height:44px}.rot-badge .rm{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:1px solid var(--gold);border-radius:6px;font-weight:600;color:var(--gold)}.rel-list{list-style:none;margin:0;padding:0}.rel{border-bottom:1px solid var(--line);padding:10px 0;overflow-wrap:anywhere}.rel h2{margin:4px 0;font-size:1.1rem}.rel-date{margin:0;color:var(--gold);font-weight:600}.rel-logo{display:block;height:48px;width:min(220px,100%);object-fit:contain;border-radius:12px;background:#12100e;margin:8px 0}.pp-btn{min-height:44px;padding:0 20px;font-weight:600}.pp-grid{list-style:none;margin:8px 0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.pp-card{display:flex;flex-direction:column;gap:4px;min-width:0;overflow-wrap:anywhere}.pp-card img,.pp-card .tile{width:100%;max-width:100%;height:auto}.pp-total b{font:600 28px/1.1 var(--serif);color:var(--gold)}.practice select{max-width:100%}@media (min-width:768px){.pp-grid{grid-template-columns:repeat(5,minmax(0,1fr))}}`;

// Not moved yet: similar cards (same era, same rarity) or sealed items (same
// era, same product type), matched by id in Catchem-data feed/not-moved.json,
// whose price stayed flat over the same window. Hidden when the list is empty.
export const NOT_MOVED_LABEL = "Similar cards that have not moved yet. A take, not a rule.";
export function notMovedBlock(entry, { images = {}, sealed = false, pidFor = null } = {}) {
  const list = Array.isArray(entry?.lagging) ? entry.lagging.filter((row) => row && row.id && Number(row.from) > 0 && Number(row.to) > 0 && isDay(row.start) && isDay(row.end)).slice(0, 6) : [];
  if (!list.length || !(Number(entry.from) > 0) || !(Number(entry.to) > 0) || !isDay(entry.start) || !isDay(entry.end)) return "";
  const pct = (a, b) => ((b - a) / a) * 100;
  const fmt = (p) => `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`;
  const label = sealed ? "Similar sealed items that have not moved yet. A take, not a rule." : NOT_MOVED_LABEL;
  const head = `This ${sealed ? "item" : "card"} went from ${cash(entry.from)} to ${cash(entry.to)} (${shortDay(entry.start)} to ${shortDay(entry.end)}, ${fmt(pct(entry.from, entry.to))}).`;
  const items = list.map((row) => {
    const pid = sealed ? (pidFor ? pidFor(row.id) : 0) : 0;
    const pic = officialSrc(sealed ? { id: row.id, kind: "sealed", tcgPlayerId: pid || "" } : { id: row.id, kind: "single" }, images);
    const img = imageTag(pic.src, sealed ? "sealed" : "card", row.name, { ...row, kind: sealed ? "sealed" : "single", crop: pic.crop, alts: pic.alts });
    const href = sealed ? `/p/${encodeURIComponent(row.id)}` : `/c/${encodeURIComponent(row.id)}`;
    const meta = [row.set, row.number ? `#${row.number}` : ""].filter(Boolean).join(" ");
    return `<li class="pp-card nm-card"><a href="${href}">${img}<b>${esc(noDash(row.name))}</b></a>${meta ? `<span class="muted">${esc(noDash(meta))}</span>` : ""}<span>${cash(row.to)}, was ${cash(row.from)}</span><span class="muted">${fmt(pct(row.from, row.to))}, ${shortDay(row.start)} to ${shortDay(row.end)}</span></li>`;
  }).join("");
  return `<section class="nm" aria-labelledby="nm-h"><h2 id="nm-h">Not moved yet</h2><p>${esc(label)}</p><p class="muted">${esc(head)} Same era and same ${sealed ? "product type" : "rarity"}, matched by id. TCGplayer market prices.</p><ul class="pp-grid">${items}</ul></section>`;
}
