import { openDataHref, ITEM_SECTIONS } from "./open-data.mjs";
import { REFUND_LINE } from "./policy.mjs";
import { splitName } from "./display-name.mjs";
import { needsTile, setTile, SET_TILE_CSS } from "./set-tile.mjs";
import { historyChart, mergeHistory, HISTORY_CSS, HISTORY_JS } from "./history-chart.mjs";
import { readSheet, patternSentence, priceBits } from "./read-sheet.mjs";
import { readShareUrl } from "./share-card.mjs";
import { BUILD_SHA } from "./build-stamp.mjs";
import { DISCORD_INVITE, INVITE_LINE } from "./auth.mjs";
import { feedNews } from "../data/feed-news.mjs";
import { isNaRelevant } from "./jp-news.mjs";
import { altAttr, brandedTile, cataloguePath, nextImage, catalogueUrl, imageForId, imageTag, newsTile, newsVariant, officialSrc, productTypeLabel, ptcgFile, tcgPid } from "./catalogue-image.mjs";
import { browserAssetUrl } from "./data.mjs";
import { PAID_FOOTER, PAID_NOTE, affEbay, affTcg, ebayQuery, ebaySearchUrl, getAffiliateConfig, pokemonCatalogLine, pokemonSlug, productLink, sortPokemonCards, storeLinksHtml, tcgStoreUrl } from "./pokemon.mjs";
import { queryShardIds } from "./search-shards.mjs";
import { FEATURE_CSS, releasesBody, longDay } from "./features.mjs";
import { freshRandom, freshSeed, freshOrder, pickWording, readSeen, markSeen, SEEN_KEY } from "./fresh.mjs";
import { PRACTICE_NOTE, PACK_SIZE, SLOTS, TIERS, buildPack, seededRandom } from "./practice.mjs";
import { GUIDE_PARAS, PRINT_RUN_LINE, ROTATION_SOURCES, isRotatedSet, rotatedSetKeys, setRotation } from "./rotation.mjs";

const DISCORD = DISCORD_INVITE;

export const TAKE_LABELS = {
  up: "Trending up",
  dip: "Cooling",
  watch: "Watch",
  avoid: "Avoid for now",
  stretched: "Looks stretched",
};
export const TAKE_FOOTER = "A take is our read of the numbers, not advice.";
export const SOLD_FILE = "/data/derived/tcgplayer-volume.json";
export const SOLD_FILTERS = [
  ["volume", "Volume"],
  ["quiet", "No sales"],
  ["mix", "Condition mix"],
  ["soldflat", "Sold, price flat"],
  ["solddown", "Sold, price down"],
];

// "Where this number comes from": source and date only, never the method.
export function infoTap(text) {
  const t = String(text || "").trim();
  if (!t || /[\u2014\u2013]/.test(t)) return "";
  return `<span class="itap" tabindex="0" role="button" aria-label="Where this number comes from: ${esc(t)}"><span class="itap-i" aria-hidden="true">i</span><span class="itap-pop" role="tooltip">${esc(t)}</span></span>`;
}
export const ITAP_CSS = `.itap{display:inline-flex;align-items:center;justify-content:center;position:relative;vertical-align:middle;min-width:44px;min-height:44px;margin:-10px -6px -10px 0;border-radius:999px;cursor:pointer;outline:none;color:var(--dim,#a8a091)}.itap-i{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:999px;border:1px solid currentColor;font:italic 600 12px/1 Georgia,serif;opacity:.75}.itap:focus-visible .itap-i{outline:2px solid var(--gold,#d9b779);outline-offset:2px}.itap-pop{display:none;position:absolute;z-index:30;left:0;top:100%;width:max-content;max-width:260px;padding:10px 12px;border-radius:14px;background:#1a1815;border:1px solid #3a352d;box-shadow:0 10px 24px rgba(0,0,0,.45);font:500 13px/1.4 var(--sans);font-style:normal;color:var(--txt,#efe9de);white-space:normal;text-align:left}.itap:focus .itap-pop,.itap:hover .itap-pop{display:block}@media(max-width:700px){.itap-pop{position:fixed;left:16px;right:16px;top:auto;bottom:96px;width:auto;max-width:none}}`;

// Method stays private: drop sentences that state thresholds, cutoffs or matching rules.
export function scrubMethod(text) {
  const parts = String(text || "").split(/(?<=[.!?])\s+/);
  const METHOD = /\b(needs?|at least|or more|or less|under \d|over \d|threshold|cutoff|counted by|matched by|nearest|rule|weights?|weighted|scor(?:e|ed|es|ing)|must|only if|is set at)\b/i;
  return parts.filter((x) => x && !METHOD.test(x)).join(" ").trim();
}

export function feedFilterOptions(hasSoldFile) {
  const rows = [
    ["", "All"],
    ["prices", "Prices"],
    ["sealed", "Sealed"],
    ["set", "One set"],
    ["signals", "Signals"],
    ["news", "News"],
    ["pokemon", "Pokémon facts"],
    ["wave", "Waves & reprints"],
    ["flagged", "Flagged"],
    ["dive", "Dive"],
    ["conditions", "Condition prices"],
    ["setshare", "Set share"],
    ["spread", "Ask spread"],
    ["askmove", "Ask moved"],
    ["mktmove", "Market moved"],
    ["still", "Nothing moved"],
  ];
  if (hasSoldFile === true) {
    const at = rows.findIndex((row) => row[0] === "conditions");
    rows.splice(at, 0, ...SOLD_FILTERS);
  }
  return rows;
}

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "\u0026amp;",
    "<": "\u0026lt;",
    ">": "\u0026gt;",
    '"': "\u0026quot;",
    "'": "&#39;",
  }[c]));
}

export function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return null;
  return "$" + x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// A read may mention sales volume, thin sales, or copies sold. No file has a
// sold count, so that sentence comes out. A price already in the file stays.
// Nothing is written in its place.
export function withoutSoldClaim(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return "";
  const claim = /\b(?:sales volume|thin sales|few sales|sold counts?|cop(?:y|ies) sold)\b/i;
  const parts = raw.split(/(?<=\.)\s+/);
  const kept = [];
  for (const sentence of parts) {
    if (!claim.test(sentence)) {
      kept.push(sentence);
      continue;
    }
    let s = sentence;
    s = s.replace(/,?\s*with\s+[\d,]+\s+cop(?:y|ies)\s+sold\b[^.]*/gi, "");
    s = s.replace(/,?\s*[\d,]+\s+cop(?:y|ies)\s+sold\b[^.]*/gi, "");
    s = s.replace(/,?\s*on\s+(?:few|thin)\s+sales\b[^.]*/gi, "");
    s = s.replace(/,?\s*(?:sales volume|thin sales|few sales|sold counts?)\b[^.]*/gi, "");
    s = s.replace(/\s{2,}/g, " ").replace(/\s+([,.])/g, "$1").replace(/,\s*(?=\.)/g, "").replace(/,\s*$/g, "").trim();
    if (!s || !/[A-Za-z]/.test(s) || claim.test(s)) continue;
    kept.push(s);
  }
  return kept.join(" ").trim();
}

// A volume read is the one place a sold count may stay: a TCGplayer count that
// carries its window and source on the row (Catchem-data builds it from
// data/derived/tcgplayer-volume.json). Any other sold sentence still comes out.
// Self-contained: the client script gets this function by toString().
export function isVolumeRow(row) {
  if (!row || typeof row !== "object") return false;
  if (row.readKind !== "volume" && row.kind !== "volume") return false;
  const s = row.sold;
  if (!s || s.source !== "TCGplayer sales via PokemonPriceTracker" || s.condition !== "Near Mint") return false;
  if (!Number.isInteger(s.count30d) || s.count30d <= 0) return false;
  const w = s.window30d || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(w.from || "")) || !/^\d{4}-\d{2}-\d{2}$/.test(String(w.to || ""))) return false;
  return String(row.headline || row.path || "").includes(s.count30d + " Near Mint cop");
}

export function shapeCash(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return "";
  return "$" + x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const SHAPE_KINDS = ["quiet", "mix", "conditions", "soldflat", "solddown", "setshare", "spread", "askmove", "mktmove", "still"];

// A shape read keeps its sentence only when the honesty line and the receipt numbers are on the row.
export function isShapeRow(row) {
  if (!row || typeof row !== "object") return false;
  const kind = String(row.readKind || "");
  if (kind !== row.kind || !SHAPE_KINDS.includes(kind)) return false;
  const path = String(row.path || row.headline || "");
  const why = String(row.why || "");
  const rec = row.receipt;
  if (!path || !rec || typeof rec !== "object") return false;
  const has = (clause) => why.includes(clause) || path.includes(clause);
  if (kind === "quiet") return path.includes("No TCGplayer sales recorded in " + rec.days + " days.") && has("That is not a scarcity claim.") && path.includes(shapeCash(rec.price));
  if (kind === "mix") {
    if (!has("This is the mix of copies that sold, not the copy in your hand.")) return false;
    if (!Array.isArray(rec.conditions) || rec.conditions.length < 2) return false;
    for (let i = 0; i < rec.conditions.length; i += 1) {
      const bit = rec.conditions[i];
      if (!bit || !path.includes(String(bit.sold) + " " + bit.condition)) return false;
    }
    return true;
  }
  if (kind === "conditions") return has("Two condition prices. Not a grade result.") && path.includes(shapeCash(rec.nearMint)) && path.includes(shapeCash(rec.played)) && path.includes(String(rec.playedCondition || ""));
  if (kind === "soldflat" || kind === "still") return false;
  if (kind === "solddown") return has("Sales and a price change in the same window. Not a cause.") && path.includes(String(rec.sold)) && path.includes(shapeCash(rec.fromPrice)) && path.includes(shapeCash(rec.toPrice));
  if (kind === "setshare") return has("Share of copies sold. Not share of dollars.") && path.includes(String(rec.top)) && path.includes(String(rec.total));
  if (kind === "spread") return has("Asking prices from the search. Not sold prices.") && path.includes(shapeCash(rec.low)) && path.includes(shapeCash(rec.high));
  if (kind === "askmove") return has("The ask changed. The market price did not. Asks are not sales.") && path.includes(shapeCash(rec.askFrom)) && path.includes(shapeCash(rec.askTo)) && path.includes(shapeCash(rec.market));
  if (kind === "mktmove") return has("The market price changed. The ask did not. Asks are not sales.") && path.includes(shapeCash(rec.marketFrom)) && path.includes(shapeCash(rec.marketTo)) && path.includes(shapeCash(rec.ask));
  return false;
}

// A sealed read is a row whose kind is sealed. Match that kind and its id.
// A product name does not make a dive row sealed, and no sealed price is invented.
export function isSealedProductRow(row) {
  if (!row || typeof row !== "object") return false;
  return row.kind === "sealed" && String(row.id || "").length > 0;
}

// The line under the title keeps the product name. A spread already on the row
// is said as an asking range. No price is rounded except that spread, and the
// dollars come from the receipt. The first word is a capital.
export function shownRead(card) {
  if (!card || typeof card !== "object") return "";
  const name = String(card.name || "").trim();
  const raw = String(card.path || card.headline || "").trim();
  const path = isVolumeRow(card) || isShapeRow(card) ? raw : withoutSoldClaim(raw);
  if (!path) return "";
  let line = path;
  if ((card.readKind === "spread" || card.kind === "spread") && isShapeRow(card)) {
    const low = Number(card.receipt && card.receipt.low);
    const high = Number(card.receipt && card.receipt.high);
    if (low > 0 && high > 0) {
      const dollars = (n) => "$" + Math.round(n).toLocaleString("en-US");
      line = name
        ? "Asks on eBay for " + name + " range from " + dollars(low) + " to " + dollars(high) + " (listings, not sales)."
        : "Asks on eBay range from " + dollars(low) + " to " + dollars(high) + " (listings, not sales).";
    }
  }
  if (card.kind === "sealed" || card.readKind === "sealed") {
    // NM is a single-card condition. Sealed lines show plain prices.
    line = line.replace(/\s*\((?:NM|Near Mint)\)/gi, "").replace(/(\$[\d,]+(?:\.\d{1,2})?)\s+NM\b/g, "$1").replace(/,?\s*\bNear Mint\b/gi, "").replace(/\bNM\b\s*/g, "")
      .replace(/:\s*(\$[\d,]+(?:\.\d{1,2})?)\s*(?:\u2192|->)\s*(\$[\d,]+(?:\.\d{1,2})?)/g, ", from $1 to $2").replace(/ {2,}/g, " ");
  }
  line = line.replace(/^[,.\s]+/, "").trim();
  if (name && line && !line.includes(name) && !line.includes(String(name).split(" - ")[0].trim())) line = name + ": " + line;
  if (!line) return "";
  return line.charAt(0).toUpperCase() + line.slice(1);
}

export function soldSafeText(row, text) {
  return isVolumeRow(row) || isShapeRow(row) ? String(text ?? "").trim() : withoutSoldClaim(text);
}


function dropTitleName(title, line) {
  const text = String(line ?? "").trim();
  const who = String(title ?? "").trim();
  if (!text || !who || !text.includes(who)) return text;
  const escaped = who.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text
    .replace(new RegExp("(^|[^A-Za-z0-9])" + escaped + "(?=$|[^A-Za-z0-9])", "g"), "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,])/g, "$1")
    .trim();
}

// The title already shows the name and number. The line under it starts at the
// price move. A line that is only the title is blank. Prices, dates, and
// percents in the file stay as written.
export function readUnderTitle(name, path) {
  const title = String(name ?? "").trim();
  const line = String(path ?? "").trim();
  if (!line) return "";
  if (title && (line === title || line.replace(/\.+$/, "") === title)) return "";
  if (title) {
    const marker = "The latest price of " + title + " is";
    if (line.startsWith(marker + " ") || line === marker || line.startsWith(marker + ".")) {
      const rest = line.slice(marker.length).replace(/^\./, "").trim();
      return rest ? dropTitleName(title, "The latest price is " + rest) : "";
    }
  }
  if (title && line.startsWith(title)) {
    const next = line.charAt(title.length);
    if (next === "" || /[\s:–—-]/.test(next)) {
      let rest = line.slice(title.length).replace(/^[\s:–—-]+/, "").trim();
      const at = rest.indexOf("latest price");
      if (at > 0) rest = rest.slice(at).trim();
      return dropTitleName(title, rest);
    }
  }
  return dropTitleName(title, line);
}

// The set name and the card id already on the card. A blank field stays off.
export function cardIdentity(card) {
  if (!card || typeof card !== "object") return "";
  const set = String(card.set ?? "").trim();
  const id = String(card.sku ?? "").trim();
  if (set && id) return set + " · " + id;
  return set || id || "";
}

export function countPublishedReads(doc) {
  const rows = publishedReadRows(doc);
  const reads = rows.filter((row) => row && String(row.readKind || row.kind || "") !== "news");
  if (!reads.length) return null;
  let day = "";
  for (const row of reads) {
    const found = String(row.asOf || row.date || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(found) && found > day) day = found;
  }
  let onDay = 0;
  if (day) {
    for (const row of reads) {
      if (String(row.asOf || row.date || "").slice(0, 10) === day) onDay += 1;
    }
  }
  return { total: reads.length, onDay, day };
}

function publishedReadRows(doc) {
  if (!doc || typeof doc !== "object") return [];
  if (doc.cards && typeof doc.cards === "object") return Object.values(doc.cards);
  if (Array.isArray(doc.reads)) return doc.reads;
  if (Array.isArray(doc)) return doc;
  return [];
}

// A Pokémon fact renders only when this file already has the count, the artist
// count, the dex, and a source. No price is added to make the row show.
// A fact with no source does not render.
export function isFactRow(row) {
  if (!row || typeof row !== "object") return false;
  if (row.readKind !== "pokemon" && row.kind !== "pokemon") return false;
  const cardCount = row.cardCount;
  const artistCount = row.artistCount;
  const dex = row.dex;
  if (!Number.isInteger(cardCount) || !Number.isInteger(artistCount) || !Number.isInteger(dex)) return false;
  if (cardCount < 1 || artistCount < 1 || dex < 1) return false;
  if (!String(row.source || "").trim()) return false;
  return String(row.headline || row.path || "").trim().length > 0;
}

// English is cardCount when the file has no separate language split.
// Japanese is said only when that count is already on the row.
export function pokemonFactLine(row) {
  if (!row || typeof row !== "object") return "";
  const name = String(row.name || "").trim();
  const cardCount = Number.isInteger(row.cardCount) ? row.cardCount : null;
  const artistCount = Number.isInteger(row.artistCount) ? row.artistCount : null;
  const dex = Number.isInteger(row.dex) ? row.dex : null;
  if (!name || cardCount == null || artistCount == null || dex == null) return "";
  if (cardCount < 1 || artistCount < 1 || dex < 1) return "";
  return name + " (#" + dex + "): " + cardCount + " cards, " + artistCount + " artists.";
}

// A cutout only when that field is already on the row. A product image is not a cutout.
export function cutoutSrc(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return "";
  const direct = row.cutout;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  if (direct && typeof direct === "object") {
    const src = String(direct.src || "").trim();
    if (src) return src;
  }
  if (row.kind === "cutout") {
    const src = String(row.src || "").trim();
    if (src) return src;
  }
  return "";
}

// The TCGplayer link only when that link is already on the row. A CDN image is not the link.
export function tcgLink(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return "";
  const keys = ["tcgplayer", "tcgplayerUrl", "productUrl", "url", "link", "href"];
  for (let i = 0; i < keys.length; i++) {
    const value = String(row[keys[i]] || "").trim();
    if (/^https:\/\/(?:www\.)?tcgplayer\.com\//i.test(value)) return value;
  }
  return "";
}

// Highest price already on the row first, then cheapest. A row with no price stays off.
export function pricedMonCards(rows, name) {
  const mon = String(name || "").trim();
  if (!mon) return [];
  const out = [];
  for (const row of rows || []) {
    let cardName = "";
    let price = null;
    let id = "";
    let set = "";
    let sku = "";
    let cutout = "";
    let link = "";
    if (Array.isArray(row)) {
      cardName = String(row[1] || "").trim();
      price = Number(row[6]);
      id = String(row[0] || "");
      set = String(row[2] || "");
    } else if (row && typeof row === "object") {
      cardName = String(row.name || "").trim();
      price = Number(row.price);
      id = String(row.id || "");
      set = String(row.set || "").trim();
      sku = String(row.sku || "").trim();
      cutout = cutoutSrc(row);
      link = tcgLink(row);
    } else continue;
    if (cardName !== mon && !cardName.startsWith(mon + " ")) continue;
    if (!(price > 0)) continue;
    const item = { id, name: cardName, set, price };
    if (sku) item.sku = sku;
    if (cutout) item.cutout = cutout;
    if (link) item.link = link;
    out.push(item);
  }
  out.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return out;
}

// The Post Office cutout on that Pokémon. A different card's picture is not one.
export function factCutout(catalogue, name) {
  const who = String(name || "").trim().toLowerCase();
  if (!who || !catalogue) return "";
  let cards = [];
  if (Array.isArray(catalogue)) cards = catalogue;
  else if (Array.isArray(catalogue.cards)) cards = catalogue.cards;
  else if (catalogue.cards && typeof catalogue.cards === "object") cards = Object.values(catalogue.cards);
  else return "";
  for (let i = 0; i < cards.length; i++) {
    const row = cards[i];
    if (!row || typeof row !== "object") continue;
    const species = String(row.species || "").trim().toLowerCase();
    const named = String(row.name || "").trim().toLowerCase();
    if (species !== who && named !== who) continue;
    const src = cutoutSrc(row);
    if (src) return src;
  }
  return "";
}

const NEWS_MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

function newsPartsToIso(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1000) return "";
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return "";
  return dt.toISOString().slice(0, 10);
}

function shiftIso(iso, days) {
  const t = Date.parse(String(iso) + "T00:00:00Z");
  if (!Number.isFinite(t)) return "";
  return new Date(t + days * 86400000).toISOString().slice(0, 10);
}

function statedDayList(text, yearFromFile) {
  const src = String(text || "");
  const out = [];
  const monthRe = /\b(january|february|march|april|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sept|sep|oct|nov|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?(?:\s+(\d{4}))?/gi;
  let m;
  while ((m = monthRe.exec(src))) {
    const mon = NEWS_MONTHS[m[1].toLowerCase()];
    const year = m[3] ? Number(m[3]) : yearFromFile;
    const iso = newsPartsToIso(year, mon, Number(m[2]));
    if (iso && out.indexOf(iso) < 0) out.push(iso);
  }
  const isoRe = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  while ((m = isoRe.exec(src))) {
    const iso = newsPartsToIso(Number(m[1]), Number(m[2]), Number(m[3]));
    if (iso && out.indexOf(iso) < 0) out.push(iso);
  }
  const dotRe = /\b(\d{4})\.(\d{1,2})\.(\d{1,2})\b/g;
  while ((m = dotRe.exec(src))) {
    const iso = newsPartsToIso(Number(m[1]), Number(m[2]), Number(m[3]));
    if (iso && out.indexOf(iso) < 0) out.push(iso);
  }
  return out;
}

function nonEnglishTitle(title) {
  return /[぀-ヿ一-龯가-힣]/.test(String(title || ""));
}

function newsSourceUrl(item) {
  const url = String(item && item.url || "").trim();
  if (!/^https?:\/\//i.test(url)) return "";
  return url;
}

function translationUncertain(item) {
  if (String(item.note || "").includes("Translation is missing.")) return true;
  const title = String(item.title || "");
  const en = String(item.titleEn || "").trim();
  if (nonEnglishTitle(title) && !en) return true;
  return false;
}

function newsEnglishName(item) {
  const title = String(item.title || "").trim();
  const en = String(item.titleEn || "").trim();
  if (nonEnglishTitle(title)) return en;
  return title;
}

function newsPlace(item, name) {
  const region = String(item.region || "");
  const language = String(item.language || "");
  if (region === "jp" || language === "ja" || String(name || "").startsWith("Japan:")) return "Japan news";
  if (region === "kr" || language === "ko") return "Korea news";
  if (language === "zh") return "Chinese news";
  if (language === "ru") return "Russian news";
  if (language === "ar") return "Arabic news";
  if (language === "th" || region === "th") return "Thai news";
  if (language && language !== "en") return language + " news";
  return "";
}

function releaseInNextTwoWeeks(item, asOf) {
  const year = Number(String(asOf).slice(0, 4));
  const text = [item.title, item.titleEn, item.sentence, item.setDate, item.statedDate].filter(Boolean).join(" ");
  const end = shiftIso(asOf, 14);
  if (!end) return false;
  const days = statedDayList(text, year);
  for (let i = 0; i < days.length; i++) {
    if (days[i] > asOf && days[i] <= end) return true;
  }
  return false;
}

function newsText(item) {
  return [item && item.title, item && item.titleEn, item && item.sentence, item && item.source, item && item.url].filter(Boolean).join(" ");
}

// The Feed only carries Pokémon TCG: sets, products (deck sets, collections, boxes), reprints, events, and organized play.
// Pokémon GO, video games, and anime stay out unless the same item also has a TCG angle.
function isTcgNews(item) {
  const text = newsText(item);
  const source = String(item && item.source || "");
  const tcg = /pok[eé]mon\s+tcg|\btcg\b|trading card|ポケカ|ポケモンカード|tcg pocket|elite trainer|boosters?|build & battle|build and battle|illustration rare|prerelease|pre-release|promo card|card game|deluxe pack|delta reign|pok[eé]mon card|カードゲーム|チャンピオンズリーグ|champions league|cards?\s+revealed|\breprints?\b|special deck set|\bdeck set\b|premium deck|battle deck|starter deck|theme deck|battle academy|premium collection|collection box|\bex box\b|booster bundle|mini tins?|collector'?s? tin|poster collection|binder collection|\betbs?\b|set list|card list|secret rares?|special illustration|full art/i;
  if (tcg.test(text)) return true;
  if (/^Pokémon Card \((Japan|Asia)\)$/.test(source.trim())) return true;
  const other = /pok[eé]mon go|\bgo pass\b|masters ex|pok[eé]mon masters|pok[eé]mon unite|\bunite license\b|pok[eé]mon sleep|tera raid|pok[eé]mon legends|pok[eé]mon horizons|\banime\b|\bepisode\b|pok[eé]mon champions|caf[eé] remix|pokopia|\bwordle\b|starbucks|sponge cake|terrarium|\bmerch\b|merchandise|\bplush\b|lego pok[eé]mon|\bvgc\b|video game championships|scarlet & violet/i;
  if (other.test(text)) return false;
  if (source.trim() === "Play! Pokémon") return true;
  return false;
}

const NEWS_DAY_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function newsPrettyDay(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const months = NEWS_DAY_MONTHS;
  const build = (y, m, d) => {
    const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    if (dt.getUTCFullYear() !== Number(y) || dt.getUTCMonth() !== Number(m) - 1 || dt.getUTCDate() !== Number(d)) return "";
    return months[Number(m) - 1] + " " + Number(d) + ", " + y;
  };
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (m) return build(m[1], m[2], m[3]);
  m = /^(\d{4})\.(\d{1,2})\.(\d{1,2})/.exec(raw);
  if (m) return build(m[1], m[2], m[3]);
  m = /^(\d{1,2})-(\d{1,2})-(\d{4})/.exec(raw);
  if (m) return build(m[3], m[2], m[1]);
  return raw;
}

function newsTwoSentences(text) {
  const src = String(text || "").replace(/\s+/g, " ").trim();
  if (!src) return "";
  const parts = [];
  let buf = "";
  for (let i = 0; i < src.length; i++) {
    const c = src.charAt(i);
    buf += c;
    if ((c === "." || c === "!" || c === "?") && (i + 1 === src.length || src.charAt(i + 1) === " ")) {
      parts.push(buf.trim());
      buf = "";
      if (src.charAt(i + 1) === " ") i++;
      if (parts.length === 2) return parts.join(" ");
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts.join(" ");
}

function newsSummary(name, sentence) {
  const text = newsTwoSentences(sentence);
  if (!text) return "";
  const bare = (s) => String(s || "").replace(/[.!?]+$/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  if (bare(text) === bare(name)) return "";
  return text;
}

function newsDetails(item, asOf) {
  const out = [];
  const push = (label, value) => {
    const v = newsPrettyDay(value);
    if (!v) return;
    if (out.some((row) => row.label === label && row.value === v)) return;
    out.push({ label, value: v });
  };
  if (item.product) push("Product", item.product);
  if (item.set) push("Set", item.set);
  if (item.wave) push("Wave", item.wave);
  if (item.setDate) push("Set date", item.setDate);
  const article = newsPrettyDay(asOf);
  const stated = newsPrettyDay(item.statedDate);
  if (stated && stated !== article && !out.some((row) => row.value === stated)) push("Date", item.statedDate);
  return out;
}

// One link when the story names exactly one set or sealed product already on file.
// A shorter name buried inside a longer one drops. Two different pages stay off.
export function newsLinkTarget(card, sets, products) {
  const parts = [];
  if (card && card.name) parts.push(card.name);
  if (card && card.summary) parts.push(card.summary);
  if (card && card.originalTitle) parts.push(card.originalTitle);
  const details = card && Array.isArray(card.details) ? card.details : [];
  for (let i = 0; i < details.length; i++) {
    const row = details[i];
    const label = String(row && row.label || "");
    if (label === "Date" || label === "Set date" || label === "Wave") continue;
    if (row && row.value) parts.push(row.value);
  }
  const text = parts.join(" ").toLowerCase();
  if (!text) return null;
  const hits = [];
  function edge(ch) {
    return !ch || !/[a-z0-9]/.test(ch);
  }
  function hasPhrase(phrase) {
    const p = String(phrase || "").toLowerCase();
    if (p.length < 8) return false;
    let from = 0;
    while (from <= text.length) {
      const at = text.indexOf(p, from);
      if (at < 0) return false;
      const before = at === 0 ? "" : text.charAt(at - 1);
      const after = at + p.length >= text.length ? "" : text.charAt(at + p.length);
      if (edge(before) && edge(after)) return true;
      from = at + 1;
    }
    return false;
  }
  function add(match, href, label) {
    if (!hasPhrase(match)) return;
    hits.push({ match: String(match).toLowerCase(), href, label });
  }
  const setRows = Array.isArray(sets) ? sets : [];
  for (let i = 0; i < setRows.length; i++) {
    const tile = setRows[i];
    if (!tile || !tile.slug || !tile.name) continue;
    const name = String(tile.name).trim();
    const href = "/sets/" + encodeURIComponent(tile.slug);
    add(name, href, name);
    const cut = name.indexOf(": ");
    if (cut > 0) add(name.slice(cut + 2).trim(), href, name);
  }
  const prodRows = Array.isArray(products) ? products : [];
  for (let i = 0; i < prodRows.length; i++) {
    const row = prodRows[i];
    if (!row || !row.id || !row.name) continue;
    const id = String(row.id);
    if (!/^tcgcsv-[0-9]+$/.test(id)) continue;
    const name = String(row.name).trim();
    add(name, "/p/" + encodeURIComponent(id), name);
  }
  const kept = [];
  for (let i = 0; i < hits.length; i++) {
    let buried = false;
    for (let j = 0; j < hits.length; j++) {
      if (i === j) continue;
      if (hits[j].match.length > hits[i].match.length && hits[j].match.indexOf(hits[i].match) >= 0) buried = true;
    }
    if (!buried) kept.push(hits[i]);
  }
  const seen = {};
  const uniq = [];
  for (let i = 0; i < kept.length; i++) {
    if (seen[kept[i].href]) continue;
    seen[kept[i].href] = 1;
    uniq.push(kept[i]);
  }
  if (uniq.length !== 1) return null;
  return { href: uniq[0].href, label: uniq[0].label };
}

// A short slice of an item already in the news file. No headline, date, or link is added.
export function newsSlice(doc) {
  const root = Array.isArray(doc) ? { items: doc } : (doc && typeof doc === "object" ? doc : null);
  if (!root) return [];
  const asOf = isoDay(root.asOf) ? root.asOf : "";
  if (!asOf) return [];
  let items = Array.isArray(root.items) ? root.items : null;
  if (!items && root.filters && root.filters.news && Array.isArray(root.filters.news.items)) {
    items = root.filters.news.items;
  }
  if (!items) return [];
  const cut = shiftIso(asOf, -14);
  const seen = new Set();
  const out = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || typeof item !== "object") continue;
    if (item.kind && item.kind !== "news") continue;
    const href = newsSourceUrl(item);
    const date = String(item.date || "").slice(0, 10);
    if (!href || !isoDay(date) || seen.has(href)) continue;
    if (translationUncertain(item)) continue;
    const name = newsEnglishName(item);
    if (!name) continue;
    if (!isTcgNews(item)) continue;
    // Japan-only items stay out unless they name an NA or English release.
    if (!isNaRelevant(item)) continue;
    const older = date < cut;
    if (older && !releaseInNextTwoWeeks(item, asOf)) continue;
    seen.add(href);
    const row = {
      id: href,
      readKind: "news",
      kind: "news",
      name,
      asOf: date,
      href,
      source: String(item.source || "").trim(),
    };
    const image = String(item.image || "");
    if (image.startsWith("/img/") || image.startsWith("/news-img/") || image.startsWith("/data/")) row.image = image;
    const original = String(item.originalTitle || "").trim();
    if (original) row.originalTitle = original;
    else if (nonEnglishTitle(item.title)) row.originalTitle = String(item.title || "").trim();
    const place = newsPlace(item, name);
    if (place) row.place = place;
    const dayLabel = newsPrettyDay(date);
    if (dayLabel) row.dayLabel = dayLabel;
    const summary = newsSummary(name, item.sentence);
    if (summary) row.summary = summary;
    const details = newsDetails(item, date);
    if (details.length) row.details = details;
    out.push(row);
  }
  out.sort((a, b) => (a.asOf < b.asOf ? 1 : a.asOf > b.asOf ? -1 : (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)));
  return out;
}

export function isOutlierRow(row) {
  if (!row || typeof row !== "object") return false;
  if (row.readKind !== "outlier" && row.kind !== "outlier") return false;
  if (!String(row.id || "").trim()) return false;
  return String(row.headline || row.path || "").trim().length > 0;
}

export function isDiveRow(row) {
  if (!row || typeof row !== "object") return false;
  if (row.readKind !== "dive" && row.kind !== "dive") return false;
  if (!String(row.diveId || row.id || "").trim()) return false;
  return String(row.headline || row.path || "").trim().length > 0;
}

function receiptBacked(row) {
  const kind = String(row?.readKind || row?.kind || "");
  const rec = row?.receipt;
  if (!rec || typeof rec !== "object") return false;
  if (kind === "spread") return Number(rec.low) > 0 && Number(rec.high) > 0;
  if (kind === "askmove") return Number(rec.askFrom) > 0 && Number(rec.askTo) > 0;
  if (kind === "mktmove") return Number(rec.marketFrom) > 0 && Number(rec.marketTo) > 0;
  return false;
}

// Reads board v3 rows (Catchem-data scripts/lib/board-mix.mjs): non-price reads
// that carry their own source line and date. Behind reads.library in that repo.
const BOARD_V3_KINDS = new Set(["climb", "setheat", "release", "newsline", "listings", "rotation", "pokemon", "breadth", "sealedchase", "set", "deep", "rip", "release-cycle", "season", "pattern-forming", "pattern-ending", "year-ago", "year-range"]);
export function isBoardV3Row(row) {
  if (!row || typeof row !== "object" || (row.board !== "v3" && !(row.board === "hist" && (row.readKind || row.kind) === "set"))) return false;
  if (!BOARD_V3_KINDS.has(String(row.readKind || row.kind || ""))) return false;
  if (!String(row.source || "").trim() || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.asOf || ""))) return false;
  return !/[\u2014\u2013]/.test(String(row.headline || row.path || ""));
}

export function keepFeedRead(row) {
  if (!row || typeof row !== "object") return false;
  if (!String(row.headline || row.path || "").trim()) return false;
  if (isFactRow(row)) return true;
  if (isBoardV3Row(row)) return true;
  if (isLagRow(row)) return true;
  if (isSupplyRow(row)) return true;
  if (isOutlierRow(row)) return true;
  if (isDiveRow(row)) return true;
  if (isVolumeRow(row)) return true;
  if (isShapeRow(row)) return true;
  if (receiptBacked(row)) return true;
  return money(row.price) != null;
}

function isoDay(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function statedPrice(value) {
  return Number(value) > 0;
}

// A lag names the pack or singles price, the sealed price, and the dates.
// Both prices have to already be on the row. A missing side stays out.
export function isLagRow(row) {
  if (!row || typeof row !== "object") return false;
  if (row.readKind !== "lag" && row.kind !== "lag") return false;
  const pack = row.pack;
  const sealed = row.box || row.sealed;
  if (!pack || !sealed) return false;
  if (!statedPrice(pack.from) || !statedPrice(pack.to) || !statedPrice(sealed.from) || !statedPrice(sealed.to)) return false;
  if (!isoDay(pack.fromDate) || !isoDay(pack.toDate) || !isoDay(sealed.fromDate) || !isoDay(sealed.toDate)) return false;
  return String(row.headline || row.path || "").trim().length > 0;
}

// Supply is the listing total, and only when this row already states it.
export function isSupplyRow(row) {
  if (!row || typeof row !== "object") return false;
  if (row.readKind !== "supply" && row.kind !== "supply") return false;
  return Number.isInteger(row.listings) && row.listings >= 1;
}

export function filesDisagree(card, other) {
  if (!card || !other || typeof card !== "object" || typeof other !== "object") return false;
  const left = Number(card.price);
  const right = Number(other.price);
  if (left > 0 && right > 0 && Math.round(left * 100) !== Math.round(right * 100)) return true;
  if (Number.isInteger(card.listings) && Number.isInteger(other.listings) && card.listings !== other.listings) return true;
  return false;
}

// The card file is newer and names a different price for this same id.
// An older card price does not throw out a later read. A fact is not a price.
export function readStaleAgainstCard(read, card) {
  if (!read || !card || typeof read !== "object" || typeof card !== "object") return false;
  if (read.readKind === "pokemon" || read.kind === "pokemon") return false;
  if (read.readKind === "news" || read.kind === "news") return false;
  if (read.readKind === "lag" || read.kind === "lag") return false;
  if (read.readKind === "supply" || read.kind === "supply") return false;
  const priced = read.readKind === "price" || read.kind === "single" || read.kind === "sealed";
  if (!priced) return false;
  const left = Number(read.price);
  const right = Number(card.price);
  if (!(left > 0) || !(right > 0)) return false;
  if (Math.round(left * 100) === Math.round(right * 100)) return false;
  const readDay = String(read.asOf || "").slice(0, 10);
  const cardDay = String(card.asOf || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(readDay) || !/^\d{4}-\d{2}-\d{2}$/.test(cardDay)) return false;
  return cardDay >= readDay;
}

const RANKED_FILTERS = new Set(["prices", "sealed", "set", "news", "wave", "flagged", "dive", "volume"]);

function waveRead(item, n) {
  return {
    id: `wave-${n}`,
    waveItem: true,
    readKind: "wave",
    kind: "wave",
    name: item.title || "",
    headline: item.sentence || item.title || "",
    path: item.sentence || "",
    source: item.source || "",
    asOf: String(item.date || "").slice(0, 10),
    href: item.url || "",
    reprint: item.reprint || "",
  };
}

export function waveReads(browse) {
  const items = browse?.filters?.wave?.items;
  if (!Array.isArray(items)) return [];
  const out = [];
  items.forEach((item, n) => {
    if (!item || (!item.title && !item.sentence)) return;
    out.push(waveRead(item, n));
  });
  return out;
}

function newsReads(browse, opts) {
  let baked = opts && opts.news ? opts.news : null;
  const block = browse && browse.filters ? browse.filters.news : null;
  if (!baked && block && Array.isArray(block.items)) baked = { asOf: block.asOf || "", items: block.items };
  return newsSlice(baked);
}

export function flaggedReads(browse, bundleReads) {
  const fromBrowse = browse?.filters?.flagged?.items;
  const out = [];
  const seen = new Set();
  const push = (row) => {
    if (!isOutlierRow(row) && !(row && row.flagged && row.flagged.on && Number(row.price) > 0)) return;
    const id = String(row.id || "");
    if (id && seen.has(id)) return;
    if (id) seen.add(id);
    out.push(row);
  };
  if (Array.isArray(fromBrowse)) for (const row of fromBrowse) push(row);
  for (const row of bundleReads || []) {
    if (isOutlierRow(row) || (row && row.flagged && row.flagged.on)) push(row);
  }
  return out;
}

export function diveReads(browse, bundleReads) {
  const fromBrowse = browse?.filters?.dive?.items;
  const out = [];
  const seen = new Set();
  const push = (row) => {
    if (!isDiveRow(row)) return;
    const id = String(row.id || "");
    if (id && seen.has(id)) return;
    if (id) seen.add(id);
    out.push(row);
  };
  if (Array.isArray(fromBrowse)) for (const row of fromBrowse) push(row);
  for (const row of bundleReads || []) if (isDiveRow(row)) push(row);
  return out;
}

export function volumeReads(browse, bundleReads) {
  const fromBrowse = browse?.filters?.volume?.items;
  const out = [];
  const seen = new Set();
  const push = (row) => {
    if (!isVolumeRow(row)) return;
    const id = String(row.id || "");
    if (id && seen.has(id)) return;
    if (id) seen.add(id);
    out.push(row);
  };
  if (Array.isArray(fromBrowse)) for (const row of fromBrowse) push(row);
  for (const row of bundleReads || []) if (isVolumeRow(row)) push(row);
  return out;
}

export function shapeReads(browse, bundleReads, kind = "") {
  const want = String(kind || "");
  const out = [];
  const seen = new Set();
  const push = (row) => {
    if (!isShapeRow(row)) return;
    if (want && row.readKind !== want) return;
    const id = String(row.id || "");
    if (id && seen.has(id)) return;
    if (id) seen.add(id);
    out.push(row);
  };
  const kinds = want ? [want] : SHAPE_KINDS;
  for (const key of kinds) {
    const items = browse?.filters?.[key]?.items;
    if (Array.isArray(items)) for (const row of items) push(row);
  }
  for (const row of bundleReads || []) push(row);
  return out;
}

export function buildFeedLoop(bundleReads, browse, opts = {}) {
  const filter = String(opts.filter || "");
  const hideFacts = opts.hideFacts === true;
  const setName = String(opts.set || "");
  const kept = (bundleReads || []).filter(keepFeedRead);
  const seen = new Set();
  const out = [];
  const push = (row) => {
    if (!row || typeof row !== "object") return;
    const id = String(row.id || "");
    if (id && seen.has(id)) return;
    if (row.pending) {
      if (id) seen.add(id);
      out.push(row);
      return;
    }
    if (hideFacts && isFactRow(row)) return;
    if (filter === "pokemon" && !isFactRow(row)) return;
    if (filter === "prices" && (isFactRow(row) || isOutlierRow(row) || isDiveRow(row) || row.readKind === "news" || row.readKind === "wave" || !(Number(row.price) > 0))) return;
    if (filter === "set" && setName && row.set !== setName && row.setSlug !== setName) return;
    if (filter === "news" && row.readKind !== "news" && row.kind !== "news") return;
    if (filter === "wave" && row.readKind !== "wave" && row.kind !== "wave" && !row.reprint && !row.waveItem) return;
    if (filter === "flagged" && !isOutlierRow(row) && !(row.flagged && row.flagged.on)) return;
    if (filter === "dive" && !isDiveRow(row)) return;
    if (filter === "volume" && !isVolumeRow(row)) return;
    if (SHAPE_KINDS.includes(filter) && (!isShapeRow(row) || row.readKind !== filter)) return;
    if (id) seen.add(id);
    out.push(row);
  };
  if (filter === "pokemon") {
    for (const row of kept) if (isFactRow(row)) push(row);
    return out;
  }
  if (filter === "wave") {
    for (const row of waveReads(browse)) push(row);
    return out;
  }
  if (filter === "news") {
    for (const row of newsReads(browse, opts)) push(row);
    return out;
  }
  if (filter === "flagged") {
    for (const row of flaggedReads(browse, kept)) push(row);
    return out;
  }
  if (filter === "dive") {
    for (const row of diveReads(browse, kept)) push(row);
    return out;
  }
  if (filter === "volume") {
    for (const row of volumeReads(browse, kept)) push(row);
    return out;
  }
  if (SHAPE_KINDS.includes(filter)) {
    for (const row of shapeReads(browse, kept, filter)) push(row);
    return out;
  }
  if (filter === "sealed") {
    for (const row of kept) if (row && row.kind === "sealed") push(row);
    return out;
  }
  if (filter === "signals") {
    for (const row of kept) {
      const days = Number(row?.windowDays);
      const change = Number(row?.changePct);
      const head = String(row?.headline || "");
      const kind = String(row?.signal || row?.readKind || row?.kind || "");
      const signal = kind === "mover" || kind === "set" || kind === "high" || kind === "streak" || kind === "lag" || kind === "group" || (days === 7 && Number.isFinite(change) && Math.abs(change) >= 8) || head.includes("6-month high");
      if (signal) push(row);
    }
    return out;
  }
  if (filter === "set" && !setName) return [];
  // The short front is the reads already on this bundle. It is not the whole
  // file. Unranked ids follow in the shuffled order the file already stored.
  // News, wave, flagged, dive, and volume rows already in the files are mixed in.
  // A ranked filter below keeps that order. No price is added for a bare id.
  if (!filter) {
    for (const row of kept) push(row);
    const extras = newsReads(browse, opts)
      .concat(waveReads(browse))
      .concat(flaggedReads(browse, kept).filter((row) => !seen.has(String(row.id || ""))))
      .concat(diveReads(browse, kept).filter((row) => !seen.has(String(row.id || ""))))
      .concat(volumeReads(browse, kept).filter((row) => !seen.has(String(row.id || ""))))
      .concat(shapeReads(browse, kept).filter((row) => !seen.has(String(row.id || ""))));
    let ei = 0;
    const rest = browse?.unfiltered;
    if (Array.isArray(rest)) {
      for (const id of rest) {
        if (typeof id !== "string" || !id || seen.has(id)) continue;
        const before = out.length;
        const row = kept.find((item) => item && item.id === id);
        push(row || { id, pending: true });
        if (out.length !== before && ei < extras.length) push(extras[ei++]);
      }
    }
    while (ei < extras.length) push(extras[ei++]);
    return out;
  }
  const ranked = RANKED_FILTERS.has(filter);
  const order = ranked ? browse?.ranked : browse?.unfiltered;
  if (Array.isArray(order)) {
    for (const id of order) {
      if (typeof id !== "string" || !id || seen.has(id)) continue;
      const row = kept.find((item) => item && item.id === id);
      push(row || { id, pending: true });
    }
  }
  return out;
}

export function clockLabel(iso) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return "";
  const clock = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(t));
  return `Updated ${clock} PT`;
}

export function chartBox(hist, caption = "TCGplayer market, daily", release = "") {
  const rows = Array.isArray(hist) ? hist : [];
  const hasPoint = rows.some((point) => {
    if (Array.isArray(point)) return point.some((v) => typeof v === "number" && Number.isFinite(v));
    if (!point || typeof point !== "object") return false;
    return Object.values(point).some((v) => typeof v === "number" && Number.isFinite(v));
  });
  if (!hasPoint) return `<div class="chart-empty"><svg class="chart-faded" style="height:48px;min-height:0" width="100%" height="48" viewBox="0 0 320 48" preserveAspectRatio="none" aria-hidden="true"><path d="M8,24 L312,24" fill="none" stroke="#d9b779" stroke-opacity=".45" stroke-width="3" stroke-linecap="round"></path></svg><p class="muted chart-note">${esc(caption)}. The line fills in as nightly prices land.</p></div>`;
  const payload = esc(JSON.stringify(hist || []));
  return `<div class="chart-box"><div class="chart" data-chart="${payload}" data-release="${esc(release || "")}" data-caption="${esc(caption)}" style="height:180px;min-height:180px"></div><div class="filters" data-ranges>${rangeButtons(hist)}</div><p class="muted chart-note"></p></div>`;
}

function datedPricePoints(hist) {
  const rows = Array.isArray(hist) ? hist : [];
  const out = [];
  for (const point of rows) {
    const d = Array.isArray(point) ? point[0] : (point && point.d);
    const v = Number(Array.isArray(point) ? point[1] : (point && point.v != null ? point.v : point));
    if (d && v > 0) out.push({ d: String(d).slice(0, 10), v });
  }
  out.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  const dedup = [];
  for (const row of out) {
    if (dedup.length && dedup[dedup.length - 1].d === row.d) dedup[dedup.length - 1] = row;
    else dedup.push(row);
  }
  return dedup;
}

function pointsInRange(pts, range) {
  if (!pts.length || range === "All") return pts.length;
  const days = range === "7D" ? 7 : range === "30D" ? 30 : range === "90D" ? 90 : 365;
  const end = Date.parse(`${pts[pts.length - 1].d}T00:00:00Z`);
  const cut = new Date(end - (days - 1) * 86400000).toISOString().slice(0, 10);
  return pts.filter((p) => p.d >= cut).length;
}

function rangeButtons(hist) {
  const pts = datedPricePoints(hist);
  const span = pts.length < 2 ? 0 : Math.round((Date.parse(`${pts[pts.length - 1].d}T00:00:00Z`) - Date.parse(`${pts[0].d}T00:00:00Z`)) / 86400000) + 1;
  const names = [];
  if (span >= 7 && pointsInRange(pts, "7D") >= 2) names.push("7D");
  if (span >= 30 && pointsInRange(pts, "30D") >= 2) names.push("30D");
  if (span >= 90 && pointsInRange(pts, "90D") >= 2) names.push("90D");
  if (span >= 365 && pointsInRange(pts, "1Y") >= 2) names.push("1Y");
  names.push("All");
  return names.map((name) => `<button type="button" data-range="${name}"${name === "All" ? ' aria-pressed="true"' : ""}>${name}</button>`).join("");
}

export function splitDated(points, key) {
  const rows = (points || []).filter((point) => point && /^\d{4}-\d{2}-\d{2}$/.test(String(point.date || "")) && Number.isFinite(Number(point[key])));
  const segments = [];
  let run = [];
  let prev = "";
  for (const point of rows) {
    const next = String(point.date);
    const expected = prev ? new Date(Date.parse(`${prev}T00:00:00Z`) + 86400000).toISOString().slice(0, 10) : "";
    if (prev && next !== expected && run.length) {
      segments.push(run);
      run = [];
    }
    run.push([next, Number(point[key])]);
    prev = next;
  }
  if (run.length) segments.push(run);
  return segments;
}

export function gapChartSvg(segments, color = "#d9b779") {
  const flat = (segments || []).flat().filter((point) => Array.isArray(point) && /^\d{4}-\d{2}-\d{2}$/.test(point[0]) && Number.isFinite(Number(point[1])));
  if (!flat.length) return "";
  const vals = flat.map((point) => Number(point[1]));
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const t0 = Date.parse(`${flat[0][0]}T00:00:00Z`);
  const t1 = Date.parse(`${flat[flat.length - 1][0]}T00:00:00Z`);
  const w = 320;
  const h = 140;
  const x = (day) => {
    const t = Date.parse(`${day}T00:00:00Z`);
    if (t1 === t0) return 16;
    return 16 + ((t - t0) / (t1 - t0)) * (w - 32);
  };
  const y = (v) => h - 16 - ((v - min) / span) * (h - 32);
  const paths = (segments || []).map((seg) => {
    const pts = (seg || []).filter((point) => Array.isArray(point));
    if (!pts.length) return "";
    const d = pts.map((point, i) => `${i ? "L" : "M"}${x(point[0]).toFixed(1)},${y(Number(point[1])).toFixed(1)}`).join(" ");
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2"/>`;
  }).join("");
  return `<svg class="gap-chart" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Line with gaps left open">${paths}</svg>`;
}

export function renderSupply(doc, stamp, opts = {}) {
  const on = doc?.enabled === true;
  const reads = on ? (doc?.reads || []) : [];
  const w7 = doc?.windows?.["7"] || {};
  const w30 = doc?.windows?.["30"] || {};
  const below = (doc?.belowGate || []).map((row) => `<li>${esc(row.name)} eBay listings ${row.pct > 0 ? "+" : ""}${esc(row.pct)}% (${esc(row.from)} → ${esc(row.to)}) from ${esc(row.fromDate)} to ${esc(row.toDate)}. Checked, and left off the feed.</li>`).join("");
  const cards = reads.map((read) => {
    const askSeg = splitDated((read.series || []).map((point) => ({ date: point.date, ask: point.ask })), "ask");
    const listSeg = splitDated((read.series || []).map((point) => ({ date: point.date, listings: point.listings })), "listings");
    return `<article class="card" style="margin:12px 0"><h2>${esc(read.sentence)}</h2><p class="muted">${esc(read.wrong || "")}</p><p class="muted">eBay ask</p>${gapChartSvg(askSeg, "#d9b779")}<p class="muted">eBay listings</p>${gapChartSvg(listSeg, "#7fc79a")}</article>`;
  }).join("");
  const body = `<main id="main" tabindex="-1" class="wrap">
<h1>Listing supply</h1>
<p class="muted">${on ? "The read is on." : "This read is off until the rule is kept."} Updated ${esc(doc?.asOf || "")}.</p>
<p>Counts are active eBay listings, not sales. Both exact nights have to be on file.</p>
<p>Nights on file: ${Number(doc?.nightCount) || 0}. Products: ${Number(doc?.products) || 0}. Products on ${esc(doc?.asOf || "the latest night")}: ${Number(doc?.productsOnLatest) || 0}.</p>
<p>7 days: ${Number(w7.qualify) || 0} would qualify. Exact start ${esc(w7.exactStart || "—")} is ${w7.exactStartOnFile ? "on file" : "not a night on file"}. Products with both of their own exact days: ${Number(w7.productsWithBothDays) || 0}.</p>
<p>30 days: ${Number(w30.qualify) || 0} would qualify. Exact start ${esc(w30.exactStart || "—")} is ${w30.exactStartOnFile ? "on file" : "not a night on file"}. Products with both of their own exact days: ${Number(w30.productsWithBothDays) || 0}.</p>
<p>Flag off or on, published reads: ${reads.length}. Counted before the flag: ${Number(doc?.wouldQualify) || 0}.</p>
${below ? `<h2>Checked, not shipped</h2><ul>${below}</ul>` : ""}
${cards}
</main>`;
  return chrome("", body, "Listing supply", stamp, "", feedNav(opts));
}

export function renderSetValue(doc, stamp, opts = {}) {
  const on = doc?.enabled === true;
  const reads = on ? (doc?.reads || []) : [];
  const days = (doc?.priceDaysOnFile || []).join(", ");
  const cards = reads.map((read) => `<article class="card" style="margin:12px 0"><h2>${esc(read.sentence)}</h2><p>${esc(read.count)} cards priced on both days. ${money(read.from)} on ${esc(read.fromDate)} and ${money(read.to)} on ${esc(read.toDate)}. Days between are not filled in.</p></article>`).join("");
  const body = `<main id="main" tabindex="-1" class="wrap">
<h1>Set value</h1>
<p class="muted">${on ? "The read is on." : "This read is off until the rule is kept."} Updated ${esc(doc?.asOf || "")}.</p>
<p>The sum is TCGplayer market for singles priced on both exact days. A missing day drops the set. The card count is how many singles had a price on both days.</p>
<p>Sets on file: ${Number(doc?.sets) || 0}. Window: ${Number(doc?.windowDays) || 30} days.</p>
<p>Exact start ${esc(doc?.exactStart || "—")} is ${doc?.exactStartOnFile ? "on file" : "not a price day on file"}.</p>
<p>Would qualify: ${Number(doc?.wouldQualify) || 0}. Published reads: ${reads.length}.</p>
${days ? `<p class="muted">Price days on file: ${esc(days)}.</p>` : ""}
${cards}
</main>`;
  return chrome("", body, "Set value", stamp, "", feedNav(opts));
}

const CHART_JS = `
function catchemPoints(raw){
  var rows=Array.isArray(raw)?raw:[];
  var out=[];
  for(var i=0;i<rows.length;i++){
    var p=rows[i];
    var d=Array.isArray(p)?p[0]:(p&&p.d);
    var v=Number(Array.isArray(p)?p[1]:(p&&p.v!=null?p.v:p));
    if(d&&v>0) out.push({d:String(d).slice(0,10),v:v});
  }
  out.sort(function(a,b){return a.d<b.d?-1:a.d>b.d?1:0});
  var dedup=[];
  for(var j=0;j<out.length;j++){
    if(dedup.length&&dedup[dedup.length-1].d===out[j].d) dedup[dedup.length-1]=out[j];
    else dedup.push(out[j]);
  }
  // No gaps: a missing day carries the last real price forward. f keeps the last real date for the tooltip.
  var full=[];
  for(var k=0;k<dedup.length;k++){
    if(full.length){
      var last=full[full.length-1],t=Date.parse(last.d+"T00:00:00Z")+86400000,stop=Date.parse(dedup[k].d+"T00:00:00Z");
      var real=last.f||last.d;
      while(t<stop){ full.push({d:new Date(t).toISOString().slice(0,10),v:last.v,f:real}); t+=86400000; }
    }
    full.push(dedup[k]);
  }
  return full;
}
function catchemFilter(pts,range){
  if(!pts.length||range==="All") return pts.slice();
  var days=range==="7D"?7:range==="30D"?30:range==="90D"?90:365;
  var end=Date.parse(pts[pts.length-1].d+"T00:00:00Z");
  var cut=new Date(end-(days-1)*86400000).toISOString().slice(0,10);
  return pts.filter(function(p){return p.d>=cut});
}
function catchemDraw(host,pts,release,caption){
  host.innerHTML="";
  host.style.height="180px";
  host.style.minHeight="180px";
  var box=host.parentElement;
  var hover=box&&box.querySelector(".chart-readout");
  if(box&&!hover){
    hover=document.createElement("p");
    hover.className="chart-readout muted";
    hover.setAttribute("aria-live","polite");
    box.insertBefore(hover, host);
  }
  var note=host.parentElement&&host.parentElement.querySelector(".chart-note");
  if(pts.length<2){
    host.style.height="auto";
    host.style.minHeight="0";
    host.style.height="48px";
    host.style.minHeight="48px";
    host.innerHTML='<svg style="height:48px;min-height:0" width="100%" height="48" viewBox="0 0 320 48" preserveAspectRatio="none" aria-hidden="true">'+(pts.length===1?'<circle cx="160" cy="24" r="4" fill="#d9b779"></circle>':'')+'</svg>';
    if(hover) hover.textContent="";
    if(note) note.textContent=(caption||"TCGplayer market, daily")+(pts.length===1?". First price on file "+pts[0].d+". The line starts here and grows each night.":". The line starts at the first price on file.");
    return;
  }
  var wMeasured=host.getBoundingClientRect?Math.round(host.getBoundingClientRect().width):0;
  var w=wMeasured>=280?wMeasured:640,h=Number(host.getAttribute("data-h"))||180,min=Math.min.apply(null,pts.map(function(p){return p.v})),max=Math.max.apply(null,pts.map(function(p){return p.v}));
  host.style.height=h+"px";
  host.style.minHeight=h+"px";
  var span=max-min||Math.max(max*0.04,0.01);
  var lo=min-span*0.08, hi=max+span*0.08, plot=hi-lo;
  function dayN(d){return Math.round(Date.parse(String(d)+"T00:00:00Z")/86400000);}
  var d0=dayN(pts[0].d), dSpan=Math.max(1,dayN(pts[pts.length-1].d)-d0);
  var step=(w-112)/Math.max(1,pts.length-1);
  function xAt(i){return 96+((dayN(pts[i].d)-d0)/dSpan)*(w-112);}
  function y(v){return (22+((hi-v)/plot)*(h-52));}
  // A missing calendar day is a gap: the line lifts and restarts, nothing is drawn across it.
  function cut(i){return i>0&&dayN(pts[i].d)-dayN(pts[i-1].d)>1;}
  var d=pts.map(function(p,i){return (i&&!cut(i)?"L":"M")+xAt(i).toFixed(1)+","+y(p.v).toFixed(1)}).join(" ");
  var dots="";
  for(var di=0;di<pts.length;di++){ if((di===0||cut(di))&&(di===pts.length-1||cut(di+1))) dots+='<circle cx="'+xAt(di).toFixed(1)+'" cy="'+y(pts[di].v).toFixed(1)+'" r="2.5" fill="#d9b779"></circle>'; }
  var rel="";
  if(release){
    for(var i=0;i<pts.length;i++){
      if(pts[i].d>=release){ rel='<line x1="'+xAt(i).toFixed(1)+'" y1="18" x2="'+xAt(i).toFixed(1)+'" y2="'+(h-30)+'" stroke="#6f9be8" stroke-dasharray="3 3"/>'; break; }
    }
  }
  var marks="";
  var markSet={};
  String(host.getAttribute("data-marks")||"").split(",").forEach(function(bit){ if(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(bit)) markSet[bit]=1; });
  for(var mi=0; mi<pts.length; mi++){
    if(!markSet[pts[mi].d]) continue;
    marks+='<line x1="'+xAt(mi).toFixed(1)+'" y1="18" x2="'+xAt(mi).toFixed(1)+'" y2="'+(h-30)+'" stroke="#efe9de" stroke-dasharray="2 3"></line>';
    marks+='<circle cx="'+xAt(mi).toFixed(1)+'" cy="'+y(pts[mi].v).toFixed(1)+'" r="3.5" fill="#efe9de"></circle>';
  }
  var indexLevel=/index/i.test(String(caption||""));
  var listings=/listings/i.test(String(caption||""));
  var stroke=listings?"#7fc79a":"#d9b779";
  var money=indexLevel
    ? function(n){var v=Number(n); if(!Number.isFinite(v)) return ""; var r=Math.round(v*10)/10; return r.toLocaleString("en-US",{maximumFractionDigits:1});}
    : listings
    ? function(n){return Number(n).toLocaleString("en-US",{maximumFractionDigits:0});}
    : function(n){return "$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})};
  function when(d){var parts=String(d).split("-"); var months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return months[(Number(parts[1])||1)-1]+" "+Number(parts[2])+", "+parts[0];}
  var label=(caption||"TCGplayer market, daily").replace(/"/g,"");
  host.innerHTML='<svg width="100%" height="'+h+'" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+label+" "+when(pts[0].d)+" "+money(pts[0].v)+" to "+when(pts[pts.length-1].d)+" "+money(pts[pts.length-1].v)+'" style="display:block;width:100%;height:'+h+'px;min-height:'+h+'px;flex:none;touch-action:pan-y"><text x="6" y="20" fill="#efe9de" font-size="14">'+money(max)+'</text><text x="6" y="'+(h-32)+'" fill="#efe9de" font-size="14">'+money(min)+'</text>'+rel+marks+'<path d="'+d+'" fill="none" stroke="'+stroke+'" stroke-width="2.5" stroke-linecap="butt" stroke-linejoin="miter"></path>'+dots+'<text x="96" y="'+(h-8)+'" fill="#efe9de" font-size="14">'+pts[0].d.slice(5)+'</text><text x="'+(w-72)+'" y="'+(h-8)+'" fill="#efe9de" font-size="14">'+pts[pts.length-1].d.slice(5)+'</text></svg>';
  if(note) note.textContent=(caption||"TCGplayer market, daily")+". "+when(pts[0].d)+" "+money(pts[0].v)+" to "+when(pts[pts.length-1].d)+" "+money(pts[pts.length-1].v)+".";
  if(hover) hover.textContent=when(pts[pts.length-1].d)+" · "+money(pts[pts.length-1].v);
  var svg=host.querySelector("svg");
  function show(ev){
    if(!svg||!hover) return;
    var rect=svg.getBoundingClientRect();
    if(!rect.width) return;
    var x=(ev.clientX-rect.left)/rect.width*w;
    var i=0,best=Infinity;
    for(var k=0;k<pts.length;k++){var dx=Math.abs(xAt(k)-x); if(dx<best){best=dx;i=k;}}
    hover.textContent=when(pts[i].d)+" · "+money(pts[i].v)+(pts[i].f?" · last price on file "+when(pts[i].f):"");
  }
  var active=false;
  svg.addEventListener("pointerdown", function(ev){ active=true; show(ev); });
  svg.addEventListener("pointermove", function(ev){
    if(ev.pointerType==="touch" && !active) return;
    show(ev);
  });
  svg.addEventListener("pointerup", function(){ active=false; });
  svg.addEventListener("pointercancel", function(){ active=false; });
}
function catchemMount(root){
  (root||document).querySelectorAll(".chart[data-chart]").forEach(function(host){
    var raw=[]; try{ raw=JSON.parse(host.getAttribute("data-chart")||"[]"); }catch(e){ raw=[]; }
    var all=catchemPoints(raw);
    var caption=host.getAttribute("data-caption")||"TCGplayer market, daily";
    var unit=/index/i.test(caption)?"index":/listings/i.test(caption)?"count":"price";
    var box=host.parentElement&&host.parentElement.classList.contains("chart-box")?host.parentElement:host;
    if(all.length<2){ box.innerHTML='<p class="muted chart-note">'+(all.length?"The line starts here and grows each night.":"The line starts at the first price on file.")+'</p>'; return; }
    var pts=all.map(function(p){ return p.f?[p.d,p.v,"n",p.f]:[p.d,p.v,"n"]; });
    var span=(Date.parse(pts[pts.length-1][0])-Date.parse(pts[0][0]))/864e5;
    var ranges=[["1M",31],["3M",92],["6M",183],["1Y",366],["All",0]].filter(function(r){ return r[1]===0||span>r[1]*0.5; });
    var pills=ranges.map(function(r,i){ return '<button type="button" class="hc-pill" data-days="'+r[1]+'" aria-pressed="'+(i===ranges.length-1?"true":"false")+'">'+r[0]+'</button>'; }).join("");
    var fig=document.createElement("figure");
    fig.className="hc";
    fig.setAttribute("data-unit",unit);
    fig.setAttribute("data-snap","all");
    fig.setAttribute("data-color",unit==="count"?"#7fc79a":"#d9b779");
    fig.setAttribute("data-pts",JSON.stringify(pts));
    fig.innerHTML='<div class="hc-top"><div class="hc-read"><span class="hc-price"></span><span class="hc-date muted"></span></div><div class="hc-pills" role="group" aria-label="Chart range">'+pills+'</div></div><div class="hc-plot"><svg class="hc-svg" viewBox="0 0 600 220" preserveAspectRatio="none" role="img" aria-label="'+caption.replace(/"/g,"")+'"></svg><div class="hc-gls" aria-hidden="true"></div><div class="hc-tip" hidden></div></div><div class="hc-axis muted"></div>';
    var capEl=box!==host&&box.querySelector("p.muted:not(.chart-note):not(.chart-readout)");
    if(capEl&&capEl.textContent.trim()){ var cap=document.createElement("p"); cap.className="hc-cap"; cap.style.cssText="margin:0 0 6px;font:600 13px/1.2 var(--sans);opacity:.75"; cap.textContent=capEl.textContent.trim(); fig.insertBefore(cap, fig.firstChild); }
    box.replaceWith(fig);
    if(window.catchemHistoryMount) window.catchemHistoryMount();
  });
}
`;

const QUICK_JS = "function catchemSpark(packed, asOf){\n  var end=String(asOf||\"\").slice(0,10);\n  if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(end) || !packed) return \"\";\n  var endMs=Date.parse(end+\"T00:00:00Z\");\n  var pts=[];\n  String(packed).split(\",\").forEach(function(bit){\n    var m=bit.match(/^([0-9]+):([0-9]+(?:[.][0-9]+)?)$/);\n    if(!m) return;\n    var off=Number(m[1]);\n    var v=Number(m[2]);\n    if(off<0 || off>29 || !(v>0)) return;\n    pts.push([new Date(endMs-off*86400000).toISOString().slice(0,10), v]);\n  });\n  pts.sort(function(a,b){ return a[0]<b[0]?-1:a[0]>b[0]?1:0; });\n  if(pts.length<2) return \"\";\n  var w=72,h=28,vals=pts.map(function(p){return p[1]}),min=Math.min.apply(null,vals),max=Math.max.apply(null,vals),span=max-min||1;\n  var t0=Date.parse(pts[0][0]+\"T00:00:00Z\"), t1=Date.parse(pts[pts.length-1][0]+\"T00:00:00Z\");\n  function x(d){ var t=Date.parse(d+\"T00:00:00Z\"); if(t1===t0) return 2; return 2+((t-t0)/(t1-t0))*(w-4); }\n  function y(v){ return 2+((max-v)/span)*(h-4); }\n  var d=\"\", prev=\"\";\n  pts.forEach(function(p){\n    var expected=prev?new Date(Date.parse(prev+\"T00:00:00Z\")+86400000).toISOString().slice(0,10):\"\";\n    d+=(!prev || p[0]!==expected ? \"M\" : \"L\")+x(p[0]).toFixed(1)+\",\"+y(p[1]).toFixed(1);\n    prev=p[0];\n  });\n  return '<svg class=\"spark30\" width=\"72\" height=\"28\" viewBox=\"0 0 72 28\" aria-hidden=\"true\"><path d=\"'+d+'\" fill=\"none\" stroke=\"#d9b779\" stroke-width=\"1.5\"></path></svg>';\n}\nwindow.catchemSpark=catchemSpark;\nvar qCache={};\nvar qAnchor=null;\nfunction qEls(){\n  return {back:document.getElementById(\"qback\"), sheet:document.getElementById(\"qsheet\"), body:document.getElementById(\"q-body\")};\n}\nfunction qClose(){\n  var el=qEls();\n  if(!el.sheet) return;\n  el.sheet.hidden=true;\n  if(el.back) el.back.hidden=true;\n  document.body.classList.remove(\"q-open\");\n  el.sheet.style.transform=\"\";\n  el.sheet.classList.remove(\"tall\");\n}\nfunction qPlace(anchor){\n  var el=qEls();\n  var sheet=el.sheet;\n  if(!sheet) return;\n  var wide=window.matchMedia(\"(min-width:768px)\").matches;\n  sheet.classList.toggle(\"pop\", wide);\n  if(!wide){\n    sheet.style.left=\"\";\n    sheet.style.top=\"\";\n    sheet.style.width=\"\";\n    return;\n  }\n  var w=Math.min(440, window.innerWidth-32);\n  var r=anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null;\n  var left=r ? Math.min(window.innerWidth-w-16, Math.max(16, r.left)) : (window.innerWidth-w)/2;\n  var top=r ? r.bottom+8 : 24;\n  if(top>window.innerHeight-180) top=r ? Math.max(16, r.top-16) : 24;\n  sheet.style.left=left+\"px\";\n  sheet.style.top=Math.max(16, top)+\"px\";\n  sheet.style.width=w+\"px\";\n}\nfunction qAttr(s){\n  return String(s==null?\"\":s).replace(/[&<>\"']/g, function(c){\n    if(c===\"&\") return \"&\"+\"amp;\";\n    if(c===\"<\") return \"&\"+\"lt;\";\n    if(c===\">\") return \"&\"+\"gt;\";\n    if(c==='\"') return \"&\"+\"quot;\";\n    return \"&\"+\"#39;\";\n  });\n}\nfunction qText(s){\n  return qAttr(s).replace(new RegExp(\"tcg\"+\"csv-\"+\"[0-9]+\",\"gi\"), \"\").replace(/\\s{2,}/g, \" \").trim();\n}\nfunction qMoney(n){\n  if(!(Number(n)>0)) return \"\";\n  return \"$\"+Number(n).toLocaleString(\"en-US\",{minimumFractionDigits:2,maximumFractionDigits:2});\n}\nfunction qSaved(id){\n  try{\n    var cur=JSON.parse(localStorage.getItem(\"catchem-watch\")||\"[]\");\n    return Array.isArray(cur) && cur.some(function(row){ return row && (row.sku||row.id)===id; });\n  }catch(e){ return false; }\n}\nfunction qSave(id, doc){\n  var body={ id:id, sku:id, name:doc.name||\"\", market:doc.price, kind:doc.kind||\"\", headline:doc.name||\"\", href:\"/p/\"+encodeURIComponent(id) };\n  var wins=doc.windows||[];\n  for(var i=0;i<wins.length;i++){ if(wins[i].label===\"7D\" && typeof wins[i].pct===\"number\") body.change7=wins[i].pct; }\n  try{\n    var cur=JSON.parse(localStorage.getItem(\"catchem-watch\")||\"[]\");\n    if(!Array.isArray(cur)) cur=[];\n    cur=cur.filter(function(row){ return row && (row.sku||row.id)!==id && row.id!==id; });\n    cur.unshift(body);\n    localStorage.setItem(\"catchem-watch\", JSON.stringify(cur.slice(0,100)));\n    return true;\n  }catch(e){ return false; }\n}\nfunction qPaint(id, doc){\n  var el=qEls();\n  var box=el.body;\n  if(!box) return;\n  var cash=qMoney(doc.price);\n  var price=cash?qText(cash):\"\";\n  var when=(doc.asOf?qText(doc.source||\"TCGplayer market\")+\", \"+qText(doc.asOf):qText(doc.source||\"TCGplayer market\"))+\".\";\n  var wins=(doc.windows||[]).map(function(w){\n    if(typeof w.pct!==\"number\") return \"\";\n    var cls=w.pct>0?\" up\":w.pct<0?\" down\":\"\";\n    var sign=w.pct>0?\"+\":\"\";\n    var note=w.from&&w.to?'<span class=\"muted\"> '+qText(w.from)+\" to \"+qText(w.to)+\"</span>\":\"\";\n    return '<span class=\"win'+cls+'\">'+qText(w.label)+\" \"+sign+w.pct+\"%</span>\"+note;\n  }).filter(Boolean).join(\" \");\n  var photo=\"\";\n  if(doc.photo && doc.photo.src){\n    var crop=doc.kind!==\"sealed\" && doc.photo.crop;\n    photo='<img alt=\"'+qText(doc.name)+'\" width=\"168\" height=\"234\" class=\"'+(crop?\"card-face\":\"shot\")+'\" '+(crop?'data-crop-card=\"1\" onload=\"if(window.cropCardEdge)cropCardEdge(this)\" ':\"\")+(doc.photo.alts&&doc.photo.alts.length?'data-alts=\"'+qAttr(doc.photo.alts.join(\"|\"))+'\" ':\"\")+'onerror=\"var a=(this.getAttribute(\\'data-alts\\')||\\'\\').split(\\'|\\').filter(Boolean);if(a.length){this.setAttribute(\\'data-alts\\',a.slice(1).join(\\'|\\'));this.src=a[0]}else{this.remove()}\" src=\"'+qAttr(doc.photo.src)+'\">';\n  }\n  var list=\"\";\n  if(doc.listings && doc.listings.text){\n    list='<p>'+qText(doc.listings.text)+'</p><p class=\"muted\">'+qText(doc.listings.source||\"eBay listings\")+(doc.listings.asOf?\", \"+qText(doc.listings.asOf):\"\")+\". Listings are not sales.</p>\";\n    if((doc.listings.points||[]).length>=2){\n      list+='<div class=\"chart-box\" data-keep-ranges=\"1\"><div class=\"chart\" data-h=\"140\" data-caption=\"eBay listings\" data-chart=\"'+qAttr(JSON.stringify(doc.listings.points))+'\"></div><div class=\"filters\" data-ranges><button type=\"button\" data-range=\"7D\">7D</button><button type=\"button\" data-range=\"30D\">30D</button><button type=\"button\" data-range=\"90D\">90D</button><button type=\"button\" data-range=\"All\" aria-pressed=\"true\">All</button></div><p class=\"chart-note muted\"></p></div>';\n    }\n  }\n  var reads=(doc.reads||[]).map(function(read){\n    var line=qText(read.date)+\" \"+qText(read.text);\n    var src=read.source?'<p class=\"muted\">'+qText(read.source)+(read.date?\", \"+qText(read.date):\"\")+\"</p>\":\"\";\n    var body=read.href?'<a href=\"'+qAttr(read.href)+'\">'+line+\"</a>\":line;\n    return \"<li>\"+body+src+\"</li>\";\n  }).join(\"\");\n  var tcgA=doc.tcgUrl?'<a class=\"shop-btn shop-tcg\" href=\"'+qAttr(doc.tcgUrl)+'\" rel=\"sponsored noopener\" target=\"_blank\">Buy on TCGplayer</a>':\"\";\n  var ebA=doc.ebayUrl?'<a class=\"shop-btn shop-ebay\" href=\"'+qAttr(doc.ebayUrl)+'\" rel=\"sponsored noopener\" target=\"_blank\">Buy on eBay</a>':\"\";\n  var tcg=(tcgA||ebA)?'<div class=\"shop-block\"><div class=\"shop-btns\">'+tcgA+ebA+'</div><p class=\"shop-note\">Catch\\'em may earn a small commission, at no extra cost to you.</p></div>':\"\";\n  var page=\"/p/\"+encodeURIComponent(id);\n  box.innerHTML=photo\n    +\"<h2>\"+qText(doc.name)+\"</h2>\"\n    +'<p class=\"muted\">'+qText(doc.set||\"not in the file\")+\" · \"+qText(doc.num||\"not in the file\")+\" · \"+qText(doc.printing||\"not in the file\")+\"</p>\"\n    +(price?'<p class=\"px\"><span class=\"q-price\">'+price+\"</span></p>\":\"\")\n    +(when?'<p class=\"muted\">'+when+\"</p>\":\"\")\n    +(wins?\"<p>\"+wins+\"</p>\":\"\")\n    +(doc.range?\"<p>\"+qText(doc.range)+\"</p>\":\"\")\n    +list\n    +'<div class=\"chart-box\" data-keep-ranges=\"1\"><div class=\"chart\" data-h=\"160\" data-caption=\"TCGplayer market, daily\" data-chart=\"'+qAttr(JSON.stringify(doc.hist||[]))+'\"></div><div class=\"filters\" data-ranges><button type=\"button\" data-range=\"7D\">7D</button><button type=\"button\" data-range=\"30D\">30D</button><button type=\"button\" data-range=\"90D\">90D</button><button type=\"button\" data-range=\"All\" aria-pressed=\"true\">All</button></div><p class=\"chart-note muted\"></p></div>'\n    +(reads?\"<h3>Reads</h3>\"+'<ul class=\"glance-reads\">'+reads+\"</ul>\":\"\")\n    +tcg\n    +'<p class=\"q-acts\"><button type=\"button\" id=\"q-save\">'+(qSaved(id)?\"Saved\":\"Save\")+'</button><a class=\"q-page\" href=\"'+qAttr(page)+'\">Full page</a></p>';\n  var save=document.getElementById(\"q-save\");\n  if(save) save.onclick=function(){ if(qSave(id, doc)) save.textContent=\"Saved\"; };\n  if(typeof catchemMount===\"function\") catchemMount(box);\n  qPlace(qAnchor);\n}\nfunction catchemQuick(id, anchor){\n  if(!id) return;\n  qAnchor=anchor||null;\n  var el=qEls();\n  if(!el.sheet || !el.body) return;\n  el.sheet.hidden=false;\n  if(el.back) el.back.hidden=false;\n  document.body.classList.add(\"q-open\");\n  el.sheet.style.transform=\"\";\n  qPlace(anchor);\n  if(qCache[id]){ qPaint(id, qCache[id]); return; }\n  el.body.innerHTML='<p class=\"muted\">'+\"Opening this product.\"+'</p>';\n  fetch(\"/api/quick?id=\"+encodeURIComponent(id)).then(function(r){\n    if(!r.ok) throw 0;\n    return r.json();\n  }).then(function(doc){\n    qCache[id]=doc;\n    if(!el.sheet.hidden) qPaint(id, doc);\n  }).catch(function(){\n    if(!el.sheet.hidden) el.body.innerHTML='<p>Not in the catalog.</p>';\n  });\n}\nwindow.catchemQuick=catchemQuick;\nfunction qInit(){\n  var el=qEls();\n  if(!el.sheet || el.sheet.dataset.ready) return;\n  el.sheet.dataset.ready=\"1\";\n  var closeBtn=document.getElementById(\"q-close\");\n  if(closeBtn) closeBtn.addEventListener(\"click\", qClose);\n  if(el.back) el.back.addEventListener(\"click\", qClose);\n  document.addEventListener(\"keydown\", function(ev){ if(ev.key===\"Escape\") qClose(); });\n  document.addEventListener(\"click\", function(ev){\n    if(ev.defaultPrevented || ev.button || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;\n    var node=ev[\"tar\"+\"get\"];\n    if(!node || !node.closest) return;\n    if(node.closest(\"#qsheet\")) return;\n    if(node.closest(\"button, input, select, textarea, label\")) return;\n    var link=node.closest(\"a\");\n    if(link && !link.hasAttribute(\"data-quick\")) return;\n    var hit=node.closest(\"[data-quick]\");\n    if(!hit) return;\n    var qid=hit.getAttribute(\"data-quick\");\n    if(!qid) return;\n    ev.preventDefault();\n    catchemQuick(qid, hit);\n  });\n  var drag=null;\n  el.sheet.addEventListener(\"pointerdown\", function(ev){\n    if(el.sheet.classList.contains(\"pop\")) return;\n    var from=ev[\"tar\"+\"get\"];\n    var grab=from && from.closest && from.closest(\".q-grab, .q-head\");\n    if(!grab && el.sheet.scrollTop>0) return;\n    if(!grab && from && from.closest && from.closest(\"a, button, input, select, textarea\")) return;\n    drag={y:ev.clientY, dy:0, id:ev.pointerId};\n  });\n  el.sheet.addEventListener(\"pointermove\", function(ev){\n    if(!drag || drag.id!==ev.pointerId) return;\n    drag.dy=ev.clientY-drag.y;\n    if(drag.dy>0) el.sheet.style.transform=\"translateY(\"+drag.dy+\"px)\";\n  });\n  function endDrag(ev){\n    if(!drag || (ev && drag.id!==ev.pointerId)) return;\n    var dy=drag.dy;\n    drag=null;\n    el.sheet.style.transform=\"\";\n    if(dy>90) qClose();\n    else if(dy<-40) el.sheet.classList.add(\"tall\");\n  }\n  el.sheet.addEventListener(\"pointerup\", endDrag);\n  el.sheet.addEventListener(\"pointercancel\", endDrag);\n}\nif(document.readyState===\"loading\") document.addEventListener(\"DOMContentLoaded\", qInit);\nelse qInit();";
const CSS = `.skip-link{position:absolute;left:8px;top:-60px;z-index:1000;background:#111;color:#fff;padding:8px 12px;border-radius:6px}.skip-link:focus{top:8px}:focus-visible{outline:3px solid #d9b779;outline-offset:2px}main:focus{outline:none}

.paid-note,.paid-foot small{font:400 12px/1.4 var(--sans);color:#a39d93}
.paid-note{margin-left:4px}
:root{--r-xs:6px;--r-sm:10px;--r-md:14px;--r-lg:20px;--r-pill:999px;--r-card:4.8%/3.4%}
img,svg,canvas,video,iframe{border-radius:var(--r-xs)}iframe,table{border-radius:var(--r-md)}table{border-collapse:separate;border-spacing:0;overflow:hidden}input,select,textarea,button{border-radius:var(--r-sm)}dialog{border-radius:var(--r-lg)}.chart svg{border-radius:var(--r-sm)}.chart:empty{border-radius:16px;min-height:120px;background:linear-gradient(90deg,rgba(255,255,255,.035),rgba(255,255,255,.08),rgba(255,255,255,.035))}
.skel-row{height:72px;border-radius:16px;margin:8px 0;background:linear-gradient(90deg,rgba(255,255,255,.04),rgba(255,255,255,.09),rgba(255,255,255,.04))}
.dock{border-radius:var(--r-lg) var(--r-lg) 0 0}img.card-face,.card-face,.pp-front img,.pp-card img.card-face{border-radius:var(--r-card)!important}.tile{border-radius:var(--r-md)}
:root{--bg:#12100e;--panel:#1a1815;--line:#2f2b26;--txt:#efe9de;--dim:#c4baab;--gold:#d9b779;--green:#7fc79a;--red:#e0675b;--serif:'Fraunces',Georgia,serif;--sans:'IBM Plex Sans',system-ui,sans-serif}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--txt);font:16px/1.5 var(--sans)}
body{overflow-x:hidden;padding-bottom:88px}
a{color:var(--gold)}
:focus-visible{outline:2px solid var(--gold);outline-offset:3px}
.skip{position:fixed;top:8px;left:12px;z-index:80;transform:translateY(-200%);background:var(--gold);color:#1a1407;padding:8px 12px;border-radius:8px;font-weight:600;min-height:44px;display:inline-flex;align-items:center}
.skip:focus,.skip:focus-visible{transform:none}
.px{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 12px;margin:8px 0}
.win{font:600 16px/1.2 var(--sans)}
.win.up{color:var(--green)}
.win.down{color:var(--red)}
.sum-strip{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 0}@media(max-width:600px){.sum-strip{display:grid;grid-template-columns:1fr 1fr}.sum-strip .sum-chip{text-align:center;justify-content:center}}
.sum-chip{display:inline-flex;align-items:center;min-height:44px;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.06);font:600 13px/1.2 var(--sans)}
.sum-chip.up{color:var(--green)}.sum-arrow{font-size:12px;margin-left:4px}.sum-arrow.up{color:var(--green)}.sum-arrow.down{color:var(--red)}.itap{display:inline-flex;align-items:center;justify-content:center;position:relative;vertical-align:middle;min-width:44px;min-height:44px;margin:-10px -6px -10px 0;border-radius:999px;cursor:pointer;outline:none;color:var(--dim,#a8a091)}.itap-i{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:999px;border:1px solid currentColor;font:italic 600 12px/1 Georgia,serif;opacity:.75}.itap:focus-visible .itap-i{outline:2px solid var(--gold,#d9b779);outline-offset:2px}.itap-pop{display:none;position:absolute;z-index:30;left:0;top:100%;width:max-content;max-width:260px;padding:10px 12px;border-radius:14px;background:#1a1815;border:1px solid #3a352d;box-shadow:0 10px 24px rgba(0,0,0,.45);font:500 13px/1.4 var(--sans);font-style:normal;color:var(--txt,#efe9de);white-space:normal;text-align:left}.itap:focus .itap-pop,.itap:hover .itap-pop{display:block}@media(max-width:700px){.itap-pop{position:fixed;left:16px;right:16px;top:auto;bottom:96px;width:auto;max-width:none}}
.sum-chip.down{color:var(--red)}
.means{background:#211e1a;border-radius:14px;padding:12px 14px}
.means p{margin:0 0 8px}
.means p:last-child{margin:0}
.site-bar{display:flex;flex-wrap:nowrap;align-items:center;justify-content:space-between;gap:10px 16px;padding:0 16px;height:56px;min-height:56px;max-height:56px;border-bottom:1px solid var(--line);background:var(--bg);position:sticky;top:0;z-index:5}
.stale-banner{margin:0;padding:10px 16px;background:#3a2a12;color:#f3e6c8;font:600 14px/1.4 var(--sans)}
.status-list{list-style:none;padding:0;margin:0}
.status-list li{padding:8px 0;border-bottom:1px solid var(--line)}
.site-bar .logo{font:600 26px/1 var(--serif);color:var(--txt);text-decoration:none;letter-spacing:-.03em;min-height:44px;display:inline-flex;align-items:center}
.site-bar .logo span{color:var(--gold)}
a.tap,.site-foot a{min-height:44px;display:inline-flex;align-items:center}
.menu-btn{display:none;min-height:44px}
.site-bar nav{display:flex;flex-wrap:wrap;gap:8px 14px}
.site-bar nav a{color:var(--dim);text-decoration:none;font:500 14px/1 var(--sans);min-height:44px;min-width:44px;display:inline-flex;align-items:center;justify-content:center;padding:0 8px}
.site-bar nav a[aria-current="page"],.site-bar nav a:hover{color:var(--gold)}
@media (max-width:1023px){
  .menu-btn{display:inline-flex;align-items:center;justify-content:center}
  .site-bar nav{display:none;position:absolute;top:100%;left:0;right:0;background:#1a1815;border-bottom:1px solid var(--line);padding:8px 12px;flex-direction:column}
  .site-bar nav.open{display:flex}
}
.dock{position:fixed;left:0;right:0;bottom:0;display:flex;justify-content:space-around;gap:4px;padding:6px 8px calc(6px + env(safe-area-inset-bottom));background:#1a1815;border-top:1px solid var(--line);z-index:6;overflow-x:auto}
.dock a{color:var(--dim);text-decoration:none;font:500 11px/1.15 var(--sans);min-height:48px;min-width:44px;flex:1 1 0;display:flex;flex-direction:column;gap:3px;align-items:center;justify-content:center;padding:4px 2px;text-align:center;white-space:nowrap;border-radius:14px}.dock a svg{border-radius:8px;display:block}
.dock a[aria-current="page"]{color:var(--gold)}
@media (max-width:420px){.dock a{font-size:10px;padding:4px 0}}
.chart,.chart svg,.chart-box{display:block;width:100%;min-height:180px}
.chart{height:180px;min-height:180px;flex:none;overflow:hidden}
.chart-box.chart-sm{min-height:0;height:auto}
.chart-box.chart-sm .chart,.chart-box.chart-sm .chart svg,.numbers-block .chart-box{min-height:0;height:auto}
.chart-box.chart-sm .chart,.chart-box.chart-sm svg{min-height:140px;height:140px}
.chart-readout{min-height:1.4em;margin:0 0 6px;font-size:14px;line-height:1.4}
.wrap{max-width:1040px;margin:0 auto;padding:22px 16px 32px;overflow-x:hidden}
.set-rot{margin:4px 0 8px;font:500 16px/1.45 var(--sans);max-width:40em}
.print-run{margin:8px 0;color:var(--dim);font:400 15px/1.45 var(--sans);max-width:40em}
h1{font:500 34px/1.15 var(--serif);letter-spacing:-.02em;margin:0 0 8px}
h2{font:500 22px/1.2 var(--serif);margin:22px 0 8px}
.muted{color:var(--dim)}
.vchips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 4px}.vchip{display:inline-flex;align-items:center;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600;letter-spacing:.01em;color:var(--gold);background:rgba(212,175,55,.10);border:1px solid rgba(212,175,55,.35);text-decoration:none}a.vchip:hover{background:rgba(212,175,55,.18)}.vchips.sm{margin:4px 0 0}@media(max-width:480px){.srow{flex-wrap:wrap;align-items:flex-start;row-gap:6px}.srow>svg.spark30,.srow>img[height="28"]{display:none}.srow>a{flex:1 1 0;min-width:0}.srow>a b,.srow>a .muted{overflow-wrap:break-word;word-break:normal}.srow>b{align-self:flex-start;padding-top:2px}.srow>.store-links{order:9;flex-basis:100%;padding-left:76px}}.feed-card .vchips{margin:2px 0 6px}.row a:has(.vchips){flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;overflow-wrap:normal}.row a:has(.vchips) br{display:none}.row a:has(.vchips) b,.row a:has(.vchips) .muted{overflow-wrap:break-word;word-break:normal}.vchips.sm .vchip{padding:2px 9px;font-size:11px}
.chart-note{font-size:15px;line-height:1.45;margin:8px 0 0}
.counts{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.counts b{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 12px;min-width:44px}
.counts b span{display:block;font:400 12px/1.3 var(--sans);color:var(--dim)}
.card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px;min-width:0}
.ph{width:100%;aspect-ratio:1;border-radius:12px;background:#211e1a;display:grid;place-items:center;color:var(--dim);font-size:13px}
.tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;overflow:hidden;text-align:center;background:#1a1815;border:1px solid #2f2b26;border-radius:12px;color:#efe9de;box-sizing:border-box;padding:6px}
.tile .mark{font:600 13px/1 var(--serif);letter-spacing:-.03em;color:#efe9de}
.tile .dot{color:var(--gold)}
.tile .ptype{font:600 10px/1.15 var(--sans);letter-spacing:.04em;text-transform:uppercase;color:#d9b779}
.tile img{width:44px;height:22px;object-fit:contain;background:transparent}
.tile-card{width:min(280px,100%);aspect-ratio:63/88}
.tile-card .mark{font-size:22px}
.tile-card .ptype{font-size:13px}
.tile-sealed,.tile-row{width:64px;height:88px;flex:none;aspect-ratio:auto}
.tile-logo{width:min(220px,100%);height:72px;aspect-ratio:auto}
.tile-logo .mark{font-size:13px;color:#d9b779}
.tile-logo .tname{font:600 14px/1.15 var(--sans);color:#efe9de;max-width:100%}
img.set-logo,.grid .card>.tile-logo{width:100%;height:72px;max-width:none;object-fit:contain;border-radius:12px;background:#12100e;box-sizing:border-box}
.set-mark{height:28px;width:auto;max-width:96px;object-fit:contain;vertical-align:middle;border-radius:8px;background:#12100e;margin:0 8px 0 0}
.row .tile,.row .shot{flex:none;width:64px;height:88px}
img.shot{object-fit:contain;background:#12100e;border-radius:8px;display:block}
img.shot[data-tile="card"]{width:min(280px,100%);height:auto;aspect-ratio:63/88}
.poke-hero{display:flex;justify-content:center;margin:8px 0 4px}
.poke-hero .tile-card{width:min(220px,100%)}
.mon-sort{display:flex;gap:8px;margin:8px 0 12px}
.mon-sort button{min-height:44px;padding:0 14px}
.mon-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.mon-tile{min-width:0;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:8px;display:flex;flex-direction:column;gap:6px}
.mon-tile .mon-open{display:flex;flex-direction:column;gap:4px;min-width:0;color:inherit;text-decoration:none}
.mon-tile img.shot,.mon-tile .tile{width:100%;max-width:none;height:auto;aspect-ratio:63/88;object-fit:contain}
.mon-tile .tile-card{width:100%;aspect-ratio:63/88}
.mon-tile b{font:600 15px/1.25 var(--serif)}
.mon-tile .set,.mon-tile .num{color:var(--muted,#b7b1a6);font:500 13px/1.3 var(--sans)}
.mon-tile .px{display:flex;flex-direction:column;gap:1px;font:500 12px/1.3 var(--sans);color:#b7b1a6}
.mon-tile .px .cash{font:600 16px/1.2 var(--sans);color:var(--gold)}
.mon-tile .shop{min-height:44px;display:inline-flex;align-items:center}
@media (min-width:768px){.mon-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (min-width:1024px){.mon-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media (min-width:1280px){.mon-grid{grid-template-columns:repeat(5,minmax(0,1fr))}}
@media (min-width:1600px){.mon-grid{grid-template-columns:repeat(6,minmax(0,1fr))}}
.news-tile{box-sizing:border-box;width:100%;height:220px;border-radius:16px;padding:16px 18px;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;background:#1a1815;border:1px solid #2f2b26;color:#efe9de}
.news-tile .mark{margin:0;font:600 22px/1 var(--serif);letter-spacing:-.03em}
.news-tile .dot{color:#d9b779}
.news-tile .src{margin:0;font:600 26px/1.15 var(--serif);letter-spacing:-.02em}
.news-tile .tag{margin:0;align-self:flex-start;font:600 12px/1 var(--sans);letter-spacing:.06em;text-transform:uppercase;color:#1a1407;background:#d9b779;border-radius:999px;padding:6px 10px}
.news-tile .when{margin:0;font:500 14px/1.2 var(--sans);color:#c4baab}
.news-tile.news-art{position:relative;align-items:center;justify-content:center;aspect-ratio:16/9;height:auto;padding:0;border-radius:16px;overflow:hidden;background:#12100e}
.news-tile.news-art img{width:100%;height:100%;max-width:100%;max-height:100%;object-fit:cover;border-radius:16px}
.news-tile.news-art.logo img{object-fit:contain;padding:16px;box-sizing:border-box}
.news-tile.news-plain{aspect-ratio:16/9;height:auto;padding:0;border-radius:16px;background:#1a1815}
.fl-news{display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#2a2418,#12100e);border:1px solid #d9b779;border-radius:10px;color:#d9b779;font:600 11px/1 var(--sans);letter-spacing:.04em;text-transform:uppercase}
.news-tile.v1{background:linear-gradient(160deg,#2a2418 0%,#12100e 58%);border-color:#d9b779}
.news-tile.v1 .src{color:#d9b779}
.news-tile.v2{background:#12100e;border-top:8px solid #d9b779}
.news-tile.v2 .mark{color:#d9b779}
.news-tile.v3{background:#211e1a;position:relative}
.news-tile.v3::after{content:"";position:absolute;right:0;top:0;width:72px;height:72px;background:#d9b779;clip-path:polygon(100% 0,0 0,100% 100%)}
.shot{width:min(280px,100%);height:auto;border-radius:16px;background:#12100e;display:block}
.row .shot{width:48px;height:auto;border-radius:8px;object-fit:contain}
.row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line);min-height:44px;align-items:center;min-width:0;max-width:100%}
.row a{color:var(--txt);text-decoration:none;min-width:44px;min-height:44px;flex:1;overflow-wrap:anywhere;display:flex;align-items:center}
.row b{overflow-wrap:anywhere}
.row>a{flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;min-width:0;overflow-wrap:normal}.row>a br{display:none}.row>a>b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-overflow:ellipsis;overflow-wrap:break-word;word-break:normal;max-width:100%}.row>b{flex:none;white-space:nowrap;overflow-wrap:normal}.vpill{display:inline-block;margin-top:2px;padding:2px 8px;border-radius:999px;font-size:12px;line-height:1.4;color:var(--dim);border:1px solid var(--line);white-space:nowrap}
.row > b{flex:none;white-space:nowrap}
.own{flex:none;display:flex;align-items:center;gap:4px;font-size:12px;white-space:nowrap}
.row svg{flex:none}
.row.mover{align-items:center;gap:10px}
.row.mover img{flex:none;width:48px;height:48px;object-fit:contain;border-radius:8px;background:#211e1a}
.row.mover a{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;align-items:stretch;gap:2px;overflow-wrap:break-word}
.row.mover a b{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;overflow:hidden;white-space:normal}
.row.mover .mover-stat{flex:0 0 auto;white-space:nowrap;text-align:right;padding-left:8px}
.row.mover svg{display:block;width:100%;max-width:160px;height:36px}
img,svg{max-width:100%}
.filters input,.filters select{max-width:100%;min-width:0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(240px,100%),1fr));gap:12px}
.set-date{white-space:nowrap}
.filters{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.sort-chip{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;border-radius:10px;border:1px solid var(--line);background:var(--panel);color:var(--txt);font:600 14px var(--sans);text-decoration:none;white-space:nowrap}
.sort-chip[aria-pressed="true"]{background:var(--gold);color:#1a1407;border-color:transparent}
@media (max-width:600px){.sort-chips{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px}}
.filters input,.filters select{background:var(--bg);color:var(--txt);border:1px solid var(--line);border-radius:10px;min-height:44px;min-width:44px;padding:0 10px;font:15px var(--sans)}
button{min-height:44px;min-width:44px;padding:0 14px;border-radius:10px;border:1px solid var(--line);background:var(--panel);color:var(--txt);font:600 14px var(--sans);cursor:pointer}
.filters [data-range]{min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center}
.store-links a{min-height:44px;min-width:44px;display:inline-flex;align-items:center}
.shop-block{margin:14px 0 6px;max-width:440px}.shop-btns{display:flex;flex-wrap:wrap;gap:10px}.shop-btn{flex:1 1 160px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;padding:0 18px;border-radius:var(--r-pill,999px);font:600 15px/1 var(--sans);text-decoration:none;border:1px solid var(--line);background:var(--panel);color:var(--txt)}.shop-btn.shop-tcg{background:var(--gold);color:#1a1407;border-color:transparent}.shop-btn:hover{filter:brightness(1.08)}.shop-note{margin:8px 2px 0;font:400 12px/1.4 var(--sans);color:#a39d93}
button.primary{background:var(--gold);color:#1a1407;border-color:transparent}
.site-foot{max-width:1040px;margin:0 auto;padding:8px 16px 24px;color:var(--dim);font-size:14px}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{scroll-behavior:auto!important;transition:none!important}}
@media (max-width:1023px){
  .menu-btn{display:inline-flex;align-items:center;justify-content:center}
  .site-bar nav{display:none;position:absolute;top:56px;left:0;right:0;background:#1a1815;border-bottom:1px solid var(--line);padding:8px 12px;flex-direction:column}
  .site-bar nav.open{display:flex}
}
.nav-more{position:relative}
.nav-more-list{display:flex;flex-direction:column}
.nav-more>summary{list-style:none;cursor:pointer;color:var(--dim);font:500 14px/1 var(--sans);min-height:44px;display:inline-flex;align-items:center;padding:0 8px;border-radius:12px}
.nav-more>summary::-webkit-details-marker{display:none}
@media (min-width:1024px){
  .nav-more-list{position:absolute;right:0;top:100%;z-index:30;display:flex;flex-direction:column;min-width:180px;padding:8px;background:#1a1815;border:1px solid var(--line);border-radius:16px;box-shadow:0 12px 30px rgba(0,0,0,.4)}
  .nav-more-list a{justify-content:flex-start!important}
  .menu-btn{display:none}
  .site-bar{height:auto;max-height:none}
  .site-bar nav{display:flex;position:static;flex-direction:row;background:transparent;border-bottom:0;padding:0}
  .dock{display:none}
  body{padding-bottom:24px}
}
/* One card face, the Post Office formula (its .card img rule):
   aspect-ratio 63/88, object-fit contain, centered, Post Office sheet behind, rounded to the card corner.
   Every single-card picture on the site uses this class. */
img.card-face{display:block;aspect-ratio:63/88;object-fit:contain;object-position:center;background:#141416;border-radius:14px;height:auto}
img.card-face[data-tile="card"]{width:min(280px,100%);height:auto}
.row img.card-face,img.card-face.thumb{flex:none;width:64px;height:auto;border-radius:8px}
.row.mover img.card-face{width:48px;height:auto}
.mon-tile img.card-face{width:100%;max-width:none;height:auto;border-radius:14px}
#qback[hidden],#qsheet[hidden]{display:none !important}
#qback{position:fixed;inset:0;background:rgba(8,7,6,.62);z-index:40}
#qsheet{position:fixed;left:0;right:0;bottom:0;z-index:41;height:78vh;max-height:92vh;overflow:auto;background:#1a1815;color:#efe9de;border:1px solid #2f2b26;border-bottom:0;border-radius:18px 18px 0 0;padding:8px 16px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -16px 40px rgba(0,0,0,.45)}
#qsheet.tall{height:92vh}
#qsheet.pop{height:auto;max-height:min(720px,calc(100vh - 32px));border-radius:16px;border-bottom:1px solid #2f2b26;box-shadow:0 18px 50px rgba(0,0,0,.5)}
#qsheet.pop .q-grab{display:none}
.q-grab{width:48px;height:6px;border-radius:99px;background:#6b645a;margin:4px auto 8px;touch-action:none}
.q-head{display:flex;justify-content:flex-end;position:sticky;top:0;background:#1a1815;z-index:1}
.q-price{font:600 32px/1 var(--serif);color:var(--gold)}
.q-acts{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.q-acts a{min-height:44px;display:inline-flex;align-items:center}
#qsheet .chart,#qsheet .chart-box,#qsheet .chart svg{min-height:0}
#qsheet img.card-face,#qsheet img.shot{width:168px;max-width:100%}
.spark30{flex:none;width:72px;height:28px;max-width:72px}
[data-quick]{cursor:pointer}
`;

function feedNav(opts) {
  return opts?.feed === true || opts?.FEED_ENABLED === "true";
}

function shareMetaTags(title, share) {
  if (!share || typeof share !== "object") return "";
  const pageTitle = `${title} · Catch'em`;
  const desc = String(share.description || "").trim();
  const url = String(share.url || "").trim();
  const image = String(share.image || "https://catchemtcg.com/og.png").trim();
  if (!desc || !url) return "";
  const alt = String(share.imageAlt || "Catch'em. Know what every card and pack is doing.").trim();
  return `<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc("Catch'em")}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:title" content="${esc(pageTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(alt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(pageTitle)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
<link rel="canonical" href="${esc(url)}">`;
}

let priceBanner = "";
export function setPriceBanner(line) {
  priceBanner = String(line || "");
}
export function priceBannerLine(updatedAt, nowMs = Date.now()) {
  const raw = String(updatedAt || "");
  let t = Date.parse(raw);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) t = Date.parse(`${raw}T04:00:00Z`);
  if (!Number.isFinite(t)) return "";
  if (nowMs - t <= 36 * 3600 * 1000) return "";
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(t));
  return `Prices last updated ${day}.`;
}

const DOCK_ICON = {
  home: '<path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z"/>',
  feed: '<rect x="4" y="5" width="16" height="5" rx="2"/><rect x="4" y="13" width="16" height="6" rx="2"/>',
  sets: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>',
  indexes: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M7 15l4-4 3 2 5-6"/>',
  practice: '<rect x="6" y="3" width="12" height="18" rx="3"/><path d="M9 8h6"/>',
  premium: '<path d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z"/>',
};
function dockNav(active, feed) {
  const rows = [feed ? ["/feed", "Feed", "feed"] : ["/", "Home", "home"], ["/sets", "Sets", "sets"], ["/search", "Search", "search"], ["/indexes", "Indexes", "indexes"], [DISCORD, "Premium", "premium", "Discord Premium"]];
  return rows.map(([href, label, icon, match]) => `<a href="${href}"${active === label || (match && active === match) ? ' aria-current="page"' : ""}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${DOCK_ICON[icon]}</svg><span>${label}</span></a>`).join("");
}

function chrome(active, body, title, stamp, extraFoot = "", feed = false, share = null) {
  const item = (href, label) => `<a href="${href}"${active === label ? ' aria-current="page"' : ""}>${label}</a>`;
  const feedLink = feed ? item("/feed", "Feed") : "";
  const fresh = stamp ? `<div class="wrap" style="padding-bottom:0"><p class="muted" id="fresh" style="margin:0">${esc(stamp)}</p></div>` : "";
  const foot = extraFoot ? `<p id="post-office-build">${esc(extraFoot)}</p>` : "";
  const shareTags = shareMetaTags(title, share);
  const tcgOn = !(typeof globalThis !== "undefined" && globalThis.CATCHEM_TCG_IMAGES === false);
  const banner = priceBanner ? `<p class="stale-banner" role="status">${esc(priceBanner)}</p>` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Catch'em</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${shareTags}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&display=optional" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&display=optional"></noscript>
<style>${CSS}${FEATURE_CSS}</style><script>var CATCHEM_TCG_IMAGES=${tcgOn ? "true" : "false"};function __name(t,v){try{Object.defineProperty(t,"name",{value:v,configurable:true})}catch(e){}return t}</script><style>${HISTORY_CSS}</style><script>${QUICK_JS}</script></head><body><a class="skip-link" href="#main">Skip to content</a>\n<div id="qback" hidden></div><div id="qsheet" role="dialog" aria-modal="true" aria-label="Price chart" hidden><div class="q-grab" aria-hidden="true"></div><div class="q-head"><button type="button" id="q-close">Close</button></div><div id="q-body"></div></div>
<header class="site-bar"><a class="logo" href="/">Catch'em<span>.</span></a><button class="menu-btn" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button><nav id="site-nav">
${feedLink}${item("/sets", "Sets")}${item("/search", "Search")}${item("/indexes", "Indexes")}${item("/releases", "Releases")}<details class="nav-more"><summary>More</summary><div class="nav-more-list">${item("/collection", "My collection")}${item("/alerts", "Alerts")}${item("/me", "Account")}${item("/weekly", "Weekly")}${item("/reads", "Reads")}${item("/scanner", "Scanner")}${item("/rip", "Rip value")}${item("/artists", "Artists")}${item("/compare", "Compare")}${item("/post-office", "Post Office")}</div></details>${item(DISCORD, "Discord Premium")}
</nav></header>
${banner}
${fresh}
<div id="content" tabindex="-1">
${body}
</div>
<nav class="dock" aria-label="Primary">
${dockNav(active, feed)}
</nav>
<footer class="site-foot"><p>Not affiliated with Nintendo, The Pokémon Company, or Creatures.</p><p>Catch'em. From Base Set to the latest drops. Card names are © Pokémon / Nintendo / Creatures / GAME FREAK. Catch'em is a fan project and is not endorsed by them or by TCGplayer. Prices labeled TCGplayer market come via TCGCSV, published the day before the date shown.</p><p>This product uses TCGplayer data but is not endorsed or certified by TCGplayer.</p><p class="paid-foot"><small>${PAID_FOOTER}</small></p><p><a href="/methodology">How the numbers are made</a> · <a href="/track-record">Track record</a> · <a href="/rotation">Rotation and print runs</a> · <a href="/status">Status</a> · <a href="mailto:support@catchemtcg.com">support@catchemtcg.com</a></p><p class="legal-links"><a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · <a href="/disclaimer">Disclaimer</a></p>${foot}</footer>
<script>var menuBtn=document.querySelector(".menu-btn");var siteNav=document.getElementById("site-nav");if(menuBtn&&siteNav)menuBtn.addEventListener("click",function(){var open=siteNav.classList.toggle("open");menuBtn.setAttribute("aria-expanded",open?"true":"false")});document.addEventListener("keydown",function(ev){if(ev.key!=="/"||ev.metaKey||ev.ctrlKey||ev.altKey||ev.defaultPrevented)return;var el=ev["tar"+"get"];var tag=el&&el.tagName;if(tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT"||(el&&el.isContentEditable))return;var box=document.getElementById("q");if(box){ev.preventDefault();box.focus();return;}if(location.pathname!=="/search")location.href="/search";});if(window.catchemMount) catchemMount(document); else if(typeof catchemMount==="function") catchemMount(document);
window.cropCardEdge=function(img){
  if(!img||img.getAttribute("data-cropped")==="1"||img.getAttribute("data-crop-card")!=="1") return;
  img.setAttribute("data-cropped","1");
  try{
    var w=img.naturalWidth,h=img.naturalHeight;
    if(!w||!h||w<16||h<16) return;
    var c=document.createElement("canvas");
    c.width=w;c.height=h;
    var x=c.getContext("2d",{willReadFrequently:true});
    x.drawImage(img,0,0);
    var d=x.getImageData(0,0,w,h).data;
    function matte(px,py){
      var i=(py*w+px)*4,r=d[i],g=d[i+1],b=d[i+2],a=d[i+3];
      if(a<18) return true;
      var C=Math.max(r,g,b)-Math.min(r,g,b),L=(r+g+b)/3;
      if(C<=22&&L>=242) return true;
      if(C<=18&&L<=14) return true;
      return false;
    }
    if(!(matte(1,1)&&matte(w-2,1)&&matte(1,h-2)&&matte(w-2,h-2))) return;
    function rowMatte(y){for(var xx=0;xx<w;xx+=4) if(!matte(xx,y)) return false; return true;}
    function colMatte(xx){for(var yy=0;yy<h;yy+=4) if(!matte(xx,yy)) return false; return true;}
    var top=0,bot=h-1,left=0,right=w-1;
    while(top<bot&&rowMatte(top)) top++;
    while(bot>top&&rowMatte(bot)) bot--;
    while(left<right&&colMatte(left)) left++;
    while(right>left&&colMatte(right)) right--;
    var cw=right-left+1,ch=bot-top+1;
    if(cw<8||ch<8||(top<2&&left<2&&h-1-bot<2&&w-1-right<2)) return;
    var out=document.createElement("canvas");
    out.width=cw;out.height=ch;
    out.getContext("2d").drawImage(c,left,top,cw,ch,0,0,cw,ch);
    img.src=out.toDataURL("image/jpeg",0.86);
  }catch(e){}
};
</script>
<script>${CHART_JS}\n${HISTORY_JS}</script>
<script>window.addEventListener("error",function(e){var body=JSON.stringify({message:String(e.message||""),source:String(e.filename||""),line:e.lineno||0,at:new Date().toISOString()});try{navigator.sendBeacon("/api/client-log",new Blob([body],{type:"application/json"}))}catch(err){fetch("/api/client-log",{method:"POST",headers:{"content-type":"application/json"},body:body,keepalive:true})}});window.addEventListener("unhandledrejection",function(e){var reason=e.reason;var message=reason&&reason.message?String(reason.message):String(reason||"");var body=JSON.stringify({message:message,source:"",line:0,at:new Date().toISOString()});try{navigator.sendBeacon("/api/client-log",new Blob([body],{type:"application/json"}))}catch(err){fetch("/api/client-log",{method:"POST",headers:{"content-type":"application/json"},body:body,keepalive:true})}});</script></body></html>`;
}

function spark(values) {
  const pts = (values || []).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (pts.length < 2) return "";
  const w = 280, h = 72, min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1;
  const step = (w - 16) / (pts.length - 1);
  const d = pts.map((v, i) => `${i ? "L" : "M"}${(8 + i * step).toFixed(1)},${(h - 10 - ((v - min) / span) * (h - 24)).toFixed(1)}`).join(" ");
  const up = pts[pts.length - 1] >= pts[0];
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="TCGplayer market"><path d="${d}" fill="none" stroke="${up ? "#7fc79a" : "#e0675b"}" stroke-width="2"/></svg>`;
}

const ERA_ORDER = ["Mega Evolution", "Scarlet & Violet", "Sword & Shield", "Sun & Moon", "XY", "Black & White", "HeartGold & SoulSilver", "Diamond & Pearl", "EX", "Original", "Neo", "Promos and extras", "Other"];
const eraId = (era) => `era-${String(era).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthYear(iso) {
  const m = /^(\d{4})-(\d{2})/.exec(String(iso || ""));
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : "";
}
const ERA_SHORT = { "Mega Evolution": "ME", "Scarlet & Violet": "SV", "Sword & Shield": "SWSH", "Sun & Moon": "SM", "XY": "XY", "Black & White": "BW", "HeartGold & SoulSilver": "HGSS", "Diamond & Pearl": "DP", "EX": "EX", "Original": "WOTC", "Neo": "Neo", "Promos and extras": "Promo", "Other": "More" };
const BROWSE_CSS = `.sb-head{display:flex;flex-direction:column;gap:12px;margin:8px 0 4px}
.sb-head h1{margin:0;font-size:30px;letter-spacing:-.02em}
.sb-search{width:100%;box-sizing:border-box;min-height:44px;padding:10px 16px;border-radius:14px;border:1px solid #2f2b26;background:#16140f;color:inherit;font:inherit;font-size:16px;outline:none;transition:border-color .2s}
.sb-search:focus{border-color:#d9b779}
.sb-chips{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding:2px 0;-webkit-overflow-scrolling:touch}
.sb-chips::-webkit-scrollbar{display:none}
.sb-chip{flex:none;min-height:44px;padding:0 16px;border-radius:999px;border:1px solid #2f2b26;background:#16140f;color:#cfc7b8;font:inherit;font-size:14px;display:inline-flex;align-items:center;cursor:pointer;text-decoration:none;transition:background .2s,border-color .2s,color .2s}
.sb-chip:hover{border-color:#5a4d36}
.sb-chip[aria-pressed=true]{background:#d9b779;border-color:#d9b779;color:#14120f}
.sb-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.sb-label{font-size:12px;color:#8f877a;text-transform:uppercase;letter-spacing:.08em;margin-right:4px}
.sb-jump{position:sticky;top:0;z-index:6;background:rgba(14,13,11,.86);backdrop-filter:saturate(180%) blur(14px);-webkit-backdrop-filter:saturate(180%) blur(14px);margin:0 -16px;padding:8px 16px;border-bottom:1px solid #221f1a}
.sb-jump .sb-chip{font-size:13px}
select.sb-chip{appearance:none;-webkit-appearance:none;padding-right:16px;max-width:44vw}
html{scroll-behavior:smooth}
.sb-era{scroll-margin-top:64px;margin-top:20px}
.sb-era h2{position:sticky;top:60px;z-index:5;margin:0 -16px 10px;padding:10px 16px;font-size:17px;font-weight:600;background:rgba(14,13,11,.86);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);display:flex;justify-content:space-between;align-items:baseline}
.sb-era h2 span{font-size:13px;font-weight:400;color:#8f877a}
.sb-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
@media(min-width:700px){.sb-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(min-width:980px){.sb-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(min-width:1200px){.sb-grid{grid-template-columns:repeat(5,minmax(0,1fr))}}
a.sb-card{display:flex;flex-direction:column;gap:8px;min-height:44px;padding:12px;border-radius:18px;background:#16140f;border:1px solid #24211c;color:inherit;text-decoration:none;transition:transform .18s ease,border-color .18s ease,background .18s ease;-webkit-tap-highlight-color:transparent}
a.sb-card:hover{transform:translateY(-2px);border-color:#4a3f2c;background:#1a1712}
a.sb-card:active{transform:scale(.98)}
a.sb-card:focus-visible{outline:2px solid #d9b779;outline-offset:2px}
.sb-face{aspect-ratio:220/96;border-radius:12px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:linear-gradient(90deg,#1c1914 0%,#25211a 50%,#1c1914 100%);background-size:200% 100%;animation:sb-shim 1.4s ease-in-out infinite}
.sb-face.ok{animation:none;background:#1c1914}
.sb-face img.set-logo{width:86%;height:80%;object-fit:contain;opacity:0;transition:opacity .25s}
.sb-face.ok img.set-logo{opacity:1}
.sb-face .set-tile{width:100%;height:100%;aspect-ratio:auto;min-height:0;border-radius:12px}
@keyframes sb-shim{0%{background-position:100% 0}100%{background-position:-100% 0}}
@media(prefers-reduced-motion:reduce){.sb-face{animation:none}a.sb-card{transition:none}}
.sb-name{font-size:14px;font-weight:600;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.sb-meta{display:flex;align-items:center;gap:6px;font-size:12px;color:#8f877a;flex-wrap:wrap}
.sb-pill{font-size:11px;padding:2px 8px;border-radius:999px;background:#221e17;color:#d9b779;border:1px solid #3a3226}
.sb-count{font-size:12px;color:#8f877a}
.sb-none{text-align:center;color:#8f877a;padding:40px 0}`;
const BROWSE_JS = `<script>(function(){var q=document.getElementById("q"),cards=[].slice.call(document.querySelectorAll("a.sb-card")),eras=[].slice.call(document.querySelectorAll("section.sb-era")),none=document.getElementById("sb-none"),sort="new",era="",sealed=false;
document.querySelectorAll(".sb-face img").forEach(function(i){function ok(){i.parentNode.classList.add("ok")}if(i.complete&&i.naturalWidth)ok();else{i.addEventListener("load",ok);i.addEventListener("error",ok)}});
function press(group,btn){document.querySelectorAll("[data-"+group+"]").forEach(function(b){b.setAttribute("aria-pressed",b===btn?"true":"false")})}
function key(a){if(sort==="az")return a.getAttribute("data-name");if(sort==="value")return -Number(a.getAttribute("data-value")||0);return "~"+(9e15-Date.parse(a.getAttribute("data-release")||"1990-01-01"))}
function apply(){var v=(q.value||"").trim().toLowerCase(),any=false;eras.forEach(function(sec){var grid=sec.querySelector(".sb-grid"),list=[].slice.call(grid.children),hit=0;list.sort(function(x,y){var a=key(x),b=key(y);return a<b?-1:a>b?1:0}).forEach(function(c){grid.appendChild(c);var ok=(!v||c.getAttribute("data-name").indexOf(v)>=0)&&(!era||sec.getAttribute("data-era")===era)&&(!sealed||Number(c.getAttribute("data-sealed"))>0);c.hidden=!ok;if(ok)hit++});sec.hidden=!hit;if(hit)any=true});none.hidden=any}
q.addEventListener("input",apply);
document.querySelectorAll("[data-sort]").forEach(function(b){b.addEventListener("click",function(){sort=b.getAttribute("data-sort");press("sort",b);apply()})});
var ef=document.getElementById("era-filter");ef.addEventListener("change",function(){era=ef.value;ef.setAttribute("aria-pressed",era?"true":"false");apply()});
var hs=document.getElementById("has-sealed");if(hs)hs.addEventListener("click",function(){sealed=!sealed;hs.setAttribute("aria-pressed",sealed?"true":"false");apply()});
})();</script>`;

export function renderSets(index, stamp, opts = {}) {
  const sets = index?.sets || [];
  const eras = [...new Set(sets.map((s) => s.era))].sort((a, b) => {
    const ia = ERA_ORDER.indexOf(a);
    const ib = ERA_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || String(a).localeCompare(String(b));
  });
  const hasValue = sets.some((s) => Number(s.value) > 0);
  const hasSealed = sets.some((s) => Number(s.sealed) > 0);
  const card = (s, eager) => {
    const face = !needsTile(s)
      ? `<div class="sb-face"><img class="set-logo" alt="" width="220" height="96" loading="${eager ? "eager" : "lazy"}" decoding="async" src="${esc(s.logo)}"></div>`
      : `<div class="sb-face ok">${setTile(s)}</div>`;
    const when = monthYear(s.release);
    const cards = Number(s.single) || 0;
    const sealed = Number(s.sealed) || 0;
    const count = [cards ? `${cards.toLocaleString("en-US")} cards` : "", sealed ? `${sealed} sealed` : ""].filter(Boolean).join(" · ");
    return `<a class="sb-card" data-name="${esc(String(s.name || "").toLowerCase())}" data-release="${esc(s.release || "")}" data-sealed="${sealed}" data-value="${Number(s.value) > 0 ? Number(s.value) : 0}" href="/sets/${esc(s.slug)}">${face}<span class="sb-name">${esc(s.name)}</span><span class="sb-meta">${when ? `<span>${esc(when)}</span>` : ""}<span class="sb-pill">${esc(ERA_SHORT[s.era] || s.era)}</span></span>${count ? `<span class="sb-count">${esc(count)}</span>` : ""}</a>`;
  };
  const byNew = (a, b) => String(b.release || "").localeCompare(String(a.release || ""));
  const body = `<style>${SET_TILE_CSS}${BROWSE_CSS}</style><main id="main" tabindex="-1" class="wrap">
<div class="sb-head"><h1>Sets</h1>
<input id="q" class="sb-search" type="search" aria-label="Find a set" placeholder="Search ${sets.length} sets" autocomplete="off">
<div class="sb-row sb-chips" role="group" aria-label="Sort"><span class="sb-label">Sort</span><button type="button" class="sb-chip" data-sort="new" aria-pressed="true">Newest</button><button type="button" class="sb-chip" data-sort="az" aria-pressed="false">A-Z</button>${hasValue ? `<button type="button" class="sb-chip" data-sort="value" aria-pressed="false">Set value</button>` : ""}</div>
<div class="sb-row sb-chips" role="group" aria-label="Filter"><span class="sb-label">Filter</span><select id="era-filter" class="sb-chip" aria-label="Era"><option value="">All eras</option>${eras.map((era) => `<option value="${esc(era)}">${esc(era)}</option>`).join("")}</select>${hasSealed ? `<button type="button" class="sb-chip" id="has-sealed" aria-pressed="false">Has sealed</button>` : ""}</div>
</div>
<nav class="sb-jump sb-chips" aria-label="Jump to an era">${eras.map((era) => `<a class="sb-chip" href="#${esc(eraId(era))}">${esc(era)}</a>`).join("")}</nav>
${eras.map((era, eraIdx) => {
    const list = sets.filter((s) => s.era === era).sort(byNew);
    return `<section class="sb-era" data-era="${esc(era)}" id="${esc(eraId(era))}"><h2>${esc(era)}<span>${list.length} sets</span></h2><div class="sb-grid">${list.map((s, i) => card(s, eraIdx === 0 && i < 6)).join("")}</div></section>`;
  }).join("")}
<p class="sb-none" id="sb-none" hidden>No sets match that search.</p>${BROWSE_JS}</main>`;
  return chrome("Sets", body, "Sets", stamp, "", feedNav(opts));
}

function setRotationBlock(slug) {
  const row = setRotation(slug);
  if (!row) return "";
  const when = row.rotated
    ? ` <a href="/rotation">Rotated ${esc(row.rotated)}</a>.`
    : ` <a href="/rotation">Rotation and print runs</a>.`;
  const supply = row.rotated
    ? `<p class="print-run">${esc(PRINT_RUN_LINE)} <a href="/rotation">Rotation and print runs</a>.</p>`
    : "";
  return `<p class="set-rot">Regulation mark ${esc(row.mark)}.${when}</p>${supply}`;
}

export function renderSetShell(slug, stamp, opts = {}) {
  const body = `<main id="main" tabindex="-1" class="wrap"><h1 id="title">Set</h1>
<p class="muted" id="completion"></p>
${typeof opts.rotationHtml === "string" ? opts.rotationHtml : setRotationBlock(slug)}
${opts.setValueHtml || ""}
<style>.st-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:14px 0}.st-tile{display:flex;flex-direction:column;gap:4px;padding:14px;border-radius:18px;background:#1a1815;border:1px solid #2f2b26;color:inherit;text-decoration:none;min-width:0}.st-k{font:600 12px/1.2 var(--sans);color:var(--gold)}.st-tile b{font:650 20px/1.1 var(--sans)}.st-n{font:500 12px/1.3 var(--sans);opacity:.7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}@media(max-width:600px){.st-tiles{grid-template-columns:1fr 1fr}.st-tile:last-child{grid-column:1/-1}}.jump{position:sticky;top:56px;z-index:5;display:flex;gap:8px;overflow-x:auto;padding:8px 0;margin:8px 0;background:#12100e;scrollbar-width:none}.jump a{flex:0 0 auto;padding:8px 16px;border-radius:999px;border:1px solid #2f2b26;color:inherit;text-decoration:none;font:600 14px/1 var(--sans)}</style>
<div id="lines"></div><nav class="jump" aria-label="Jump to"><a href="#charts">Charts</a><a href="#set-filters">Cards</a><a href="#sections">Sections</a></nav><div id="charts"></div>
<div class="filters" id="set-filters"><button type="button" id="mine-toggle" aria-pressed="false">My set</button><select id="scope" aria-label="Set scope"><option value="">All</option><option value="master">Master set</option><option value="grand">Grand master</option><option value="base">Base set only</option></select>
<select id="kind" aria-label="Kind"><option value="">Singles and sealed</option><option value="single">Singles</option><option value="sealed">Sealed</option></select>
<select id="vtag" aria-label="Variant"><option value="">All variants</option></select>
<input id="q" aria-label="Filter by name, rarity, or artist" placeholder="Name, rarity, artist">
<select id="sort" aria-label="Sort"><option value="price">Price</option><option value="name">Name</option><option value="num">Number</option></select>
</div><p class="muted" id="mine-line"></p><div id="list"></div><button id="more" type="button">Show more</button><div id="sections"></div></main>
<script type="application/json" id="meta">${JSON.stringify({ slug }).replace(/</g, "\\u003c")}</script>
<script>
const slug=JSON.parse(document.getElementById("meta").textContent).slug;
${splitName.toString()}
var rowDay="";
const money=n=>!(n>0)?"":"$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
function html(s){
  return String(s==null?"":s).replace(/[&<>"']/g,function(c){
    if(c==="&") return "&"+"amp;";
    if(c==="<") return "&"+"lt;";
    if(c===">") return "&"+"gt;";
    if(c==='"') return "&"+"quot;";
    return "&"+"#39;";
  });
}
let rows=[], shown=48, setLogo="";
let catImages={};
${cataloguePath.toString()}
${browserAssetUrl.toString()}
${catalogueUrl.toString()}
${imageForId.toString()}
${tcgPid.toString()}
${ptcgFile.toString()}
${productTypeLabel.toString()}
${officialSrc.toString()}
${altAttr.toString()}
${nextImage.toString()}
${brandedTile.toString()}
function miss(img){
  if(nextImage(img)) return;
  var d=document.createElement("div");
  var kind=img.getAttribute("data-kind")==="sealed"?"sealed":"row";
  d.innerHTML=brandedTile(kind,{kind:img.getAttribute("data-kind"),name:img.alt,logo:typeof setLogo==="string"?setLogo:""});
  if(d.firstChild) img.replaceWith(d.firstChild);
}
function rowHtml(r){
  const href=r.kind==="sealed"?"/p/"+encodeURIComponent(r.id):"/c/"+encodeURIComponent(r.id);
  const pic=officialSrc(r, catImages)||{};
  const src=pic.src||"";
  const img=src?'<img alt="'+html(r.name)+'" width="64" height="89" loading="lazy" decoding="async" '+((r.kind==="single")?'':'class="shot" ')+'data-kind="'+(r.kind==="sealed"?"sealed":"single")+'" '+((r.kind==="single")?'data-crop-card="1" onload="if(window.cropCardEdge)cropCardEdge(this)" ':'')+((r.kind==="single")?'class="shot card-face thumb" ':'style="width:64px;height:88px;object-fit:contain;border-radius:8px;background:#12100e" ')+'src="'+String(src).replace(/"/g,"")+'"'+altAttr(pic)+' onerror="miss(this)">':brandedTile(r&&r.kind==="sealed"?"sealed":"row",{kind:r&&r.kind,name:r&&r.name,subtype:r&&r.subtype,logo:setLogo});
  const bits=[];
  var sn=(${splitName.toString().replace(/\n\s*/g, " ")})(r.name,r.num);
  if(sn.num) bits.push(html(sn.num));
  sn.variants.forEach(function(v){ bits.push(html(v)); });
  if(r.rarity) bits.push(html(r.rarity));
  if(r.kind==="sealed" && r.subtype==="case") bits.push("Case");
  if(r.artist) bits.push(html(r.artist));
  var tick="";
  if(mineOn() && r.kind!=="sealed"){
    var key=ownKey(r);
    var owned=readOwned();
    tick='<label class="own"><input type="checkbox" data-own="'+html(key)+'"'+(owned[key]===1?" checked":"")+'> Owned</label>';
  }
  return '<div class="row" data-quick="'+html(r.id)+'">'+tick+img+'<a href="'+href+'" data-quick="'+html(r.id)+'"><b>'+html(sn.title)+'</b>'+(bits.length?'<span class="muted">'+bits.concat(typeof rowDay==="string"&&rowDay?[rowDay]:[]).join(" · ")+'</span>':'')+(r.kind!=="sealed"&&r.printing&&!/^normal$/i.test(String(r.printing).trim())?'<span class="vpill">'+html(r.printing)+'</span>':'')+(visTags(r.tags).length?'<span class="vchips sm">'+visTags(r.tags).map(function(t){return '<span class="vchip">'+html(t)+'</span>';}).join("")+'</span>':'')+'</a>'+(money(r.price)?'<b>'+money(r.price)+'</b>':'')+'</div>';
}
function visTags(t){ return (Array.isArray(t)?t:[]).filter(function(x){return x&&!/^normal$/i.test(String(x).trim())}); }
function ownKey(r){ return String(r.id||"")+"|"+String(r.printing||""); }
function readOwned(){
  try { return JSON.parse(localStorage.getItem("catchem-set:"+slug)||"{}"); }
  catch(e) { return {}; }
}
function mineOn(){
  var btn=document.getElementById("mine-toggle");
  return !!(btn && btn.getAttribute("aria-pressed")==="true");
}
function cash(n){
  return "$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
}
function paintMine(){
  var el=document.getElementById("mine-line");
  if(!el) return;
  if(!mineOn()){ el.textContent=""; return; }
  var scope=document.getElementById("scope").value;
  var list=expand(rows, scope).filter(function(r){ return r && r.kind!=="sealed"; });
  var owned=readOwned();
  var total=list.length, have=0, cost=0, unpriced=0, leftPriced=0;
  list.forEach(function(r){
    var key=ownKey(r);
    var got=owned[key]===1;
    if(got) have++;
    var price=Number(r.price);
    if(!(price>0)){ unpriced++; return; }
    if(!got){ cost+=price; leftPriced++; }
  });
  var pct=total?Math.round((have/total)*1000)/10:0;
  var costText=leftPriced?cash(cost):"—";
  var mode=scope==="grand"?"Grand master. ":scope==="master"?"Master set. ":scope==="base"?"Base set. ":"";
  var noun=unpriced===1?"card unpriced.":"cards unpriced.";
  el.textContent=mode+"Owned "+have+" of "+total+" ("+pct+"%). Cost to complete "+costText+". "+unpriced+" "+noun;
}
function expand(list, scope){
  const out=[];
  list.forEach(function(r){
    if(r.kind==="sealed"){
      if(scope==="master" || scope==="base" || scope==="grand") return;
      out.push(r);
      return;
    }
    const prints=(Array.isArray(r.printings)?r.printings:[]).filter(function(p){return p&&p.name});
    if(scope==="base" || !prints.length){
      out.push(r);
      return;
    }
    prints.forEach(function(p){
      out.push(Object.assign({}, r, {printing:p.name, price:p.price>0?p.price:null, id:p.id||r.id, pid:p.pid||r.pid}));
    });
  });
  return out;
}
function completionLine(data){
  const items=Array.isArray(data.items)?data.items:[];
  const cards=Number.isInteger(data.cards)?data.cards:(Number.isInteger(data.single)?data.single:items.filter(function(r){return r&&r.kind!=="sealed"}).length);
  const sealed=Number.isInteger(data.sealed)?data.sealed:items.filter(function(r){return r&&r.kind==="sealed"}).length;
  const printings=Number.isInteger(data.printings)?data.printings:items.filter(function(r){return r&&r.kind!=="sealed"}).reduce(function(n,r){
    const list=(r.printings||[]).filter(function(p){return p&&p.name});
    return n+(list.length||1);
  },0);
  const bits=[];
  if(cards>0) bits.push(cards+" cards");
  if(printings>0 && cards>0) bits.push(printings+" printings");
  if(sealed>0) bits.push(sealed+" sealed");
  if(!cards && sealed>0) return bits.join(" · ")+". Singles show here once they are priced.";
  return bits.length?bits.join(" · "):"Prices show here once this set is priced.";
}
function draw(){
  const kind=document.getElementById("kind").value;
  const scope=document.getElementById("scope").value;
  const q=document.getElementById("q").value.trim().toLowerCase();
  const sort=document.getElementById("sort").value;
  let list=expand(rows, scope);
  list=list.filter(r=>!kind||r.kind===kind);
  list=list.filter(r=>r.kind!=="sealed"||Number(r.price)>0);
  const vsel=document.getElementById("vtag");
  if(vsel && vsel.options.length===1){var seenT={};rows.forEach(function(r){(r.tags||[]).forEach(function(t){seenT[t]=(seenT[t]||0)+1;});});Object.keys(seenT).sort().forEach(function(t){var o=document.createElement("option");o.value=t;o.textContent=t+" ("+seenT[t]+")";vsel.appendChild(o);});}
  const vtag=vsel?vsel.value:"";
  if(vtag) list=list.filter(r=>(r.tags||[]).indexOf(vtag)>=0);
  if(q) list=list.filter(r=>(r.name+" "+(r.rarity||"")+" "+(r.artist||"")+" "+(r.num||"")+" "+(r.printing||"")+" "+(r.tags||[]).join(" ")).toLowerCase().includes(q));
  list.sort((a,b)=>sort==="name"?a.name.localeCompare(b.name):sort==="num"?String(a.num).localeCompare(String(b.num)):((b.price||0)-(a.price||0)));
  const main=list.filter(r=>!r.section);
  const order=[];
  const grouped={};
  list.forEach(function(r){
    if(!r.section) return;
    if(!grouped[r.section]){ grouped[r.section]=[]; order.push(r.section); }
    grouped[r.section].push(r);
  });
  const view=main.slice(0, shown);
  document.getElementById("list").innerHTML=view.map(rowHtml).join("") || (order.length?"":'<p class="muted">Nothing matches.</p>');
  document.getElementById("sections").innerHTML=order.map(function(name){
    const id=String(name).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
    const cards=grouped[name];
    return '<h2 id="'+id+'" class="set-section">'+html(name)+'</h2><p class="muted">'+cards.length+' cards</p>'+cards.map(rowHtml).join("");
  }).join("");
  document.getElementById("more").hidden=shown>=main.length;
  paintMine();
  if(location.hash.length>1){
    var el=document.getElementById(location.hash.slice(1));
    if(el) el.scrollIntoView({block:"start"});
  }
}
function pictureSrc(row, logo){
  if(!row || typeof row!=="object") return "";
  const hit=officialSrc(row, catImages);
  if(hit&&hit.src) return hit.src;
  if(row.icon) return "";
  return "";
}
function cropStyle(crop){
  if(!crop || typeof crop!=="object") return "";
  const x=Number(crop.x);
  const y=Number(crop.y);
  const w=Number(crop.w!=null?crop.w:crop.width);
  const h=Number(crop.h!=null?crop.h:crop.height);
  if(!Number.isFinite(x)||!Number.isFinite(y)||!(w>0)||!(h>0)) return "";
  return "object-fit:none;object-position:-"+x+"px -"+y+"px;width:"+w+"px;height:"+h+"px";
}
fetch("/data/sets/"+encodeURIComponent(slug)+".json").then(r=>{if(!r.ok) throw 0; return r.json()}).then(async function(data){
  try{
    var cres=await fetch("/data/catalogue-images.json");
    var doc=cres.ok?await cres.json():{};
    catImages=(doc&&doc.images)||{};
  }catch(e){ catImages={}; }
  document.getElementById("title").textContent=data.name;
  const completion=document.getElementById("completion");
  if(completion) completion.textContent=completionLine(data);
  setLogo="";
  const moneyLine=n=>!(n>0)?"":"$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
  const tile=(label,row,href,sub)=>row?'<a class="st-tile" '+(row.id?'data-quick="'+html(row.id)+'" ':'')+'href="'+href+'"><span class="st-k">'+label+'</span><b>'+moneyLine(row.price)+'</b><span class="st-n">'+html(sub)+'</span></a>':"";
  const setTiles=function(d){
    const singles=(Array.isArray(d.items)?d.items:[]).filter(function(r){return r&&r.kind!=="sealed"&&Number(r.price)>0;});
    const master=singles.reduce(function(n,r){return n+Number(r.price);},0);
    const t=[
      d.sealedLine?tile(/booster pack/i.test(d.sealedLine.name)?"Booster Pack":"Sealed",d.sealedLine,"/p/"+encodeURIComponent(d.sealedLine.id),d.sealedLine.name):"",
      d.chaseLine?tile("Chase card",d.chaseLine,"/c/"+encodeURIComponent(d.chaseLine.id),d.chaseLine.name):"",
      master>0?tile("Master set",{price:master},"#list",singles.length+" priced cards"):""
    ].join("");
    return t?'<div class="st-tiles">'+t+'</div>':"";
  };
  const link=(row,kind)=>row?'<p><b>'+(kind==="sealed"?"Sealed line":"Chase line")+'</b> <a data-quick="'+html(row.id)+'" href="'+(kind==="sealed"?"/p/":"/c/")+encodeURIComponent(row.id)+'">'+html(row.name)+'</a> '+moneyLine(row.price)+'</p>':"";
  var logoSrc=catalogueUrl(cataloguePath(catImages, slug));
  if(!logoSrc && typeof data.logo==="string" && /^\/img\/[a-z0-9]+\/logo\.png$/i.test(data.logo)) logoSrc=data.logo;
  if(!logoSrc && typeof data.logo==="string" && data.logo.indexOf("https://")===0) logoSrc=data.logo;
  setLogo=logoSrc||"";
  document.getElementById("lines").innerHTML=(logoSrc?'<img class="set-logo" alt="" width="220" height="72" loading="lazy" decoding="async" src="'+String(logoSrc).replace(/"/g,"")+'" style="height:72px;width:100%;max-width:280px;object-fit:contain;background:#12100e;border-radius:12px">':brandedTile("logo",{kind:"set",name:data.name}))+setTiles(data);
  const hasIdx=function(a){ return Array.isArray(a) && a.filter(function(p){ return p && p.v!=null && Number(p.n)>0; }).length>=2; };
  const boxSingle='<div class="chart-box"><p class="muted">Singles index</p><div class="chart" id="single-chart" data-caption="Singles index, chain-linked. TCGplayer market, daily" style="height:180px;min-height:180px"></div><div class="filters" data-ranges><button type="button" data-range="7D">7D</button><button type="button" data-range="30D">30D</button><button type="button" data-range="90D">90D</button><button type="button" data-range="1Y">1Y</button><button type="button" data-range="All" aria-pressed="true">All</button></div><p class="muted chart-note"></p></div>';
  const boxSealed='<div class="chart-box"><p class="muted">Sealed index</p><div class="chart" id="sealed-chart" data-caption="Sealed index, chain-linked. TCGplayer market, daily'+(data.fillNote?". "+html(data.fillNote).replace(/\.$/,""):"")+'" style="height:180px;min-height:180px"></div><div class="filters" data-ranges><button type="button" data-range="7D">7D</button><button type="button" data-range="30D">30D</button><button type="button" data-range="90D">90D</button><button type="button" data-range="1Y">1Y</button><button type="button" data-range="All" aria-pressed="true">All</button></div><p class="muted chart-note"></p></div>';
  document.getElementById("charts").innerHTML=(hasIdx(data.singleIndex)?boxSingle:"")+(hasIdx(data.sealedIndex)?boxSealed:"");
  const sc=document.getElementById("single-chart"), dc=document.getElementById("sealed-chart");
  if(sc){ sc.setAttribute("data-chart", JSON.stringify(data.singleIndex||[])); sc.setAttribute("data-release", data.release||""); }
  if(dc){ dc.setAttribute("data-chart", JSON.stringify(data.sealedIndex||[])); dc.setAttribute("data-release", data.release||""); }
  if(typeof catchemMount==="function") catchemMount(document.getElementById("charts"));
  rows=(data.items||[]).filter(r=>r&&r.name);
  rowDay=(function(d){d=String(d||"").slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return "";return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Number(d.slice(5,7))-1]+" "+Number(d.slice(8,10));})(data.asOf);
  draw();
}).catch(function(){
  var title=document.getElementById("title");
  if(title && title.textContent==="Set") title.textContent="This set did not load.";
});
["kind","q","sort","scope","vtag"].forEach(id=>document.getElementById(id).addEventListener("input",()=>{shown=48;draw()}));
document.getElementById("more").addEventListener("click",()=>{shown+=48;draw()});
document.getElementById("mine-toggle").addEventListener("click", function(){
  var on=this.getAttribute("aria-pressed")==="true";
  this.setAttribute("aria-pressed", on?"false":"true");
  draw();
});
document.addEventListener("change", function(ev){
  var box=ev.target;
  if(!box || !box.getAttribute || box.getAttribute("data-own")==null) return;
  var owned=readOwned();
  var key=box.getAttribute("data-own");
  if(box.checked) owned[key]=1;
  else delete owned[key];
  try { localStorage.setItem("catchem-set:"+slug, JSON.stringify(owned)); } catch(e) {}
  paintMine();
});
</script>`;
  return chrome("Sets", body, String(opts.title || "").trim() || "Set", stamp, "", feedNav(opts));
}

const CHECK_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function checkedLabel(iso) {
  const s = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  return `Checked ${CHECK_MONTHS[Number(s.slice(5, 7)) - 1]} ${Number(s.slice(8, 10))}, ${s.slice(0, 4)} PT`;
}

function seriesFacts(hist, asOf) {
  const pts = (hist || []).filter((p) => Array.isArray(p) && /^\d{4}-\d{2}-\d{2}$/.test(String(p[0])) && Number(p[1]) > 0);
  if (pts.length < 2) return null;
  const end = pts[pts.length - 1];
  const endDate = /^\d{4}-\d{2}-\d{2}$/.test(String(asOf || "").slice(0, 10)) ? String(asOf).slice(0, 10) : end[0];
  const at = (days) => {
    const target = new Date(Date.parse(`${endDate}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
    let then = null;
    for (const p of pts) {
      if (p[0] <= target) then = p;
      else break;
    }
    if (!then || !(Number(then[1]) > 0) || !(Number(end[1]) > 0)) return null;
    const pct = Math.round(((Number(end[1]) - Number(then[1])) / Number(then[1])) * 1000) / 10;
    return Number.isFinite(pct) ? pct : null;
  };
  const start = new Date(Date.parse(`${endDate}T00:00:00Z`) - 90 * 86400000).toISOString().slice(0, 10);
  const win = pts.filter((p) => p[0] >= start && p[0] <= endDate);
  const use = win.length >= 2 ? win : pts;
  let hi = use[0];
  let lo = use[0];
  for (const p of use) {
    if (p[1] > hi[1] || (p[1] === hi[1] && p[0] > hi[0])) hi = p;
    if (p[1] < lo[1] || (p[1] === lo[1] && p[0] > lo[0])) lo = p;
  }
  const days = Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${hi[0]}T00:00:00Z`)) / 86400000);
  return { change7: at(7), change30: at(30), change90: at(90), high: hi[1], highOn: hi[0], low: lo[1], lowOn: lo[0], daysSinceHigh: days };
}

function winChip(label, n) {
  if (typeof n !== "number" || !Number.isFinite(n) || n === 0) return "";
  const cls = n > 0 ? "up" : "down";
  return `<span class="win ${cls}">${label} ${n > 0 ? "+" : ""}${n}%</span>`;
}

function flagHtml(f) {
  if (!f?.on) return "";
  if (f.first) return `Flagged ${esc(f.on)} at ${money(f.at)}.`;
  const pct = Number(f.pct);
  const extra = Number.isFinite(pct) ? ` (${pct > 0 ? "+" : ""}${pct}%)` : "";
  return `Flagged ${esc(f.on)} at ${money(f.at)}, now ${money(f.now)}${esc(extra)}.`;
}

function histWithFact(hist, fact) {
  const pts = Array.isArray(hist) ? hist.slice() : [];
  if (!(fact?.price > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(String(fact.asOf || "").slice(0, 10))) return pts;
  const day = String(fact.asOf).slice(0, 10);
  const last = pts[pts.length - 1];
  if (!last || String(last[0]) < day) pts.push([day, fact.price]);
  else if (String(last[0]) === day) pts[pts.length - 1] = [day, fact.price];
  return pts;
}

const PRICE_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function priceDay(iso) {
  const s = String(iso || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  return PRICE_MONTHS[Number(s.slice(5, 7)) - 1] + " " + Number(s.slice(8, 10)) + ", " + s.slice(0, 4);
}

function pokemonPriceHtml(card) {
  if (!(card && card.price > 0)) return "No price yet";
  const bits = [];
  if (card.source) bits.push(`<span>${esc(card.source)}</span>`);
  const cash = money(card.price);
  if (cash) bits.push(`<b class="cash">${esc(cash)}</b>`);
  if (card.finish) bits.push(`<span>${esc(card.finish)}</span>`);
  const when = priceDay(card.priceDate);
  if (when) bits.push(`<span>${esc(when)}</span>`);
  return bits.join("");
}

function pokemonFace(card) {
  const alt = [card.name, card.set].filter(Boolean).join(", ");
  if (card.image) return imageTag(card.image, "card", alt, { kind: "single", name: card.name, catalogueCrop: true, crop: true, alts: card.imageAlts || [] });
  return brandedTile("card", { kind: "single", name: card.name });
}

export function renderPokemon(page, stamp, opts = {}) {
  if (!page) {
    return chrome("", `<main id="main" tabindex="-1" class="wrap"><h1>Not in the catalog</h1><p class="muted">That Pokémon is not in the catalog.</p><p><a href="/search">Search</a></p></main>`, "Not found", stamp, "", feedNav(opts));
  }
  const cards = sortPokemonCards(page.cards || [], "price");
  const hero = page.cutout
    ? `<img class="cutout" alt="${esc(page.name)}" width="220" height="220" loading="lazy" decoding="async" src="${esc(page.cutout)}">`
    : brandedTile("card", { kind: "single", name: page.name });
  const tiles = cards.map((card) => {
    const open = `<a class="mon-open" data-quick="${esc(card.id)}" href="/c/${esc(card.id)}">${pokemonFace(card)}<b>${esc(card.name)}</b><span class="set">${esc(card.set)}</span><span class="num">${esc(card.number)}</span><span class="px">${pokemonPriceHtml(card)}</span></a>`;
    const shop = card.link ? `<span class="store-links"><a class="shop" href="${esc(affTcg(card.link))}" rel="sponsored noopener">TCGplayer</a> <small class="paid-note">${PAID_NOTE}</small></span>` : "";
    const release = /^\d{4}-\d{2}-\d{2}$/.test(String(card.release || "")) ? card.release : "9999-99-99";
    return `<article class="mon-tile" data-price="${card.price > 0 ? card.price : ""}" data-release="${esc(release)}" data-set="${esc(card.set)}" data-num="${esc(card.number)}" data-name="${esc(card.name)}">${open}${shop}</article>`;
  }).join("");
  const line = pokemonCatalogLine(page);
  const body = `<main id="main" tabindex="-1" class="wrap poke-page">
<div class="poke-hero">${hero}</div>
<h1>${esc(page.name)}</h1>
${line ? `<p>${esc(line)}</p>` : ""}
<section id="cards">
<h2>Cards</h2>
<div class="mon-sort" role="group" aria-label="Sort cards">
<button type="button" id="sort-price" aria-pressed="true">Price</button>
<button type="button" id="sort-set" aria-pressed="false">Set order</button>
</div>
<div class="mon-grid" id="mon-grid">${tiles}</div>
</section>
<script>
(function(){
  var box=document.getElementById("mon-grid");
  var priceBtn=document.getElementById("sort-price");
  var setBtn=document.getElementById("sort-set");
  if(!box||!priceBtn||!setBtn) return;
  function num(v){ var n=Number(v); return n>0?n:-1; }
  function sort(mode){
    var tiles=[].slice.call(box.children);
    tiles.sort(function(a,b){
      if(mode==="set"){
        return (a.dataset.release||"").localeCompare(b.dataset.release||"")
          || (a.dataset.set||"").localeCompare(b.dataset.set||"")
          || String(a.dataset.num||"").localeCompare(String(b.dataset.num||""), undefined, {numeric:true})
          || (a.dataset.name||"").localeCompare(b.dataset.name||"");
      }
      var d=num(b.dataset.price)-num(a.dataset.price);
      if(d) return d;
      return (a.dataset.name||"").localeCompare(b.dataset.name||"");
    });
    tiles.forEach(function(el){ box.appendChild(el); });
    priceBtn.setAttribute("aria-pressed", mode==="price"?"true":"false");
    setBtn.setAttribute("aria-pressed", mode==="set"?"true":"false");
  }
  priceBtn.addEventListener("click", function(){ sort("price"); });
  setBtn.addEventListener("click", function(){ sort("set"); });
})();
</script>
</main>`;
  return chrome("", body, page.name, stamp, "", feedNav(opts));
}

export function exactWindowPct(hist, days, endDate) {
  const endDay = String(endDate || "").slice(0, 10);
  const pts = (hist || []).filter((point) => Array.isArray(point) && /^\d{4}-\d{2}-\d{2}$/.test(String(point[0])) && Number(point[1]) > 0);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDay) || (days !== 7 && days !== 30 && days !== 90 && days !== 365)) return null;
  const end = pts.find((point) => point[0] === endDay) || null;
  const startDay = new Date(Date.parse(`${endDay}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
  const start = pts.find((point) => point[0] === startDay) || null;
  if (!end || !start) return null;
  const pct = Math.round(((Number(end[1]) - Number(start[1])) / Number(start[1])) * 1000) / 10;
  return Number.isFinite(pct) ? pct : null;
}

export function rangeMarker(hist, endDate) {
  const endDay = String(endDate || "").slice(0, 10);
  const pts = (hist || []).filter((point) => Array.isArray(point) && /^\d{4}-\d{2}-\d{2}$/.test(String(point[0])) && Number(point[1]) > 0 && point[0] <= endDay);
  if (!pts.length || !/^\d{4}-\d{2}-\d{2}$/.test(endDay)) return { text: "" };
  const startDay = new Date(Date.parse(`${endDay}T00:00:00Z`) - 183 * 86400000).toISOString().slice(0, 10);
  const covers = pts.some((point) => point[0] <= startDay);
  const use = covers ? pts.filter((point) => point[0] >= startDay) : pts;
  let hi = use[0];
  let lo = use[0];
  for (const point of use) {
    if (point[1] > hi[1] || (point[1] === hi[1] && point[0] > hi[0])) hi = point;
    if (point[1] < lo[1] || (point[1] === lo[1] && point[0] > lo[0])) lo = point;
  }
  if (!covers) return { text: `History since ${pts[0][0]}. 6-month high and low show once we have 6 months.` };
  const end = pts.find((point) => point[0] === endDay);
  const freshHigh = end && Number(end[1]) === Number(hi[1]) && hi[0] === endDay;
  const freshLow = end && Number(end[1]) === Number(lo[1]) && lo[0] === endDay;
  const highBit = freshHigh ? `New 6-month high ${money(hi[1])} on ${hi[0]}.` : `6-month high ${money(hi[1])} on ${hi[0]}.`;
  const lowBit = freshLow ? `New 6-month low ${money(lo[1])} on ${lo[0]}.` : `6-month low ${money(lo[1])} on ${lo[0]}.`;
  return { text: `${highBit} ${lowBit}` };
}

const RANGE_YEAR_DAYS = 366;

function rangeDay(iso, withYear) {
  const s = String(iso || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const bit = `${PRICE_MONTHS[Number(s.slice(5, 7)) - 1]} ${Number(s.slice(8, 10))}`;
  return withYear ? `${bit}, ${s.slice(0, 4)}` : bit;
}

// Low and high from the same series the price chart draws. A full year is labeled
// 12-month. A shorter series uses the days on file and names the first one.
export function yearRange(points, endDate) {
  const endDay = String(endDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDay)) return null;
  const rows = [];
  for (const point of points || []) {
    if (!Array.isArray(point) || point[3]) continue;
    const day = String(point[0] || "").slice(0, 10);
    const val = Number(point[1]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !(val > 0) || day > endDay) continue;
    rows.push([day, val]);
  }
  rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const byDay = new Map();
  for (const [day, val] of rows) byDay.set(day, val);
  const days = [...byDay.keys()];
  if (days.length < 2) return null;
  const first = days[0];
  const yearStart = new Date(Date.parse(`${endDay}T00:00:00Z`) - RANGE_YEAR_DAYS * 86400000).toISOString().slice(0, 10);
  const full = first <= yearStart;
  const use = full ? days.filter((day) => day >= yearStart) : days;
  if (use.length < 2) return null;
  let loD = use[0];
  let hiD = use[0];
  for (const day of use) {
    const val = byDay.get(day);
    if (val < byDay.get(loD) || (val === byDay.get(loD) && day > loD)) loD = day;
    if (val > byDay.get(hiD) || (val === byDay.get(hiD) && day > hiD)) hiD = day;
  }
  const nowD = byDay.has(endDay) ? endDay : days.at(-1);
  const now = byDay.get(nowD);
  const lo = byDay.get(loD);
  const hi = byDay.get(hiD);
  const at = hi === lo ? 50 : Math.max(0, Math.min(100, ((now - lo) / (hi - lo)) * 100));
  const endYear = endDay.slice(0, 4);
  const label = full ? "12-month" : `Since ${rangeDay(first, false)}`;
  return {
    label,
    low: lo,
    lowDate: loD,
    high: hi,
    highDate: hiD,
    price: now,
    priceDate: nowD,
    at,
    text: `${label} low ${money(lo)} (${rangeDay(loD, loD.slice(0, 4) !== endYear)}) · high ${money(hi)} (${rangeDay(hiD, hiD.slice(0, 4) !== endYear)})`,
  };
}

export function yearRangeHtml(points, endDate) {
  const row = yearRange(points, endDate);
  if (!row || /\u2014|\u2013/.test(row.text)) return "";
  const at = (Math.round(row.at * 10) / 10).toFixed(1);
  return `<div class="yr"><p class="yr-line">${esc(row.text)}</p><div class="yr-track" aria-hidden="true"><span class="yr-fill" style="width:${at}%"></span><span class="yr-knob" style="left:${at}%"></span></div></div>`;
}

function exactChip(label, n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "";
  const cls = n > 0 ? "up" : n < 0 ? "down" : "";
  const sign = n > 0 ? "+" : "";
  return `<span class="win ${cls}">${label} ${sign}${n}%</span>`;
}

function rotationChipLabel(html) {
  const src = String(html || "");
  const aria = src.match(/aria-label="Rotation: ([^"]+)"/);
  if (aria) return `Mark ${aria[1].replace(/regulation mark /i, "").replace(/, /g, " · ")}`;
  const mark = src.match(/class="rm">([^<]+)</);
  if (!mark) return "";
  const status = src.match(/Regulation mark [^<·]*· ([^<]+)/);
  return status ? `Mark ${mark[1]} · ${status[1]}` : `Mark ${mark[1]}`;
}

function countedListings(fact, series, endDay) {
  const n = Number(fact?.listings);
  const day = String(fact?.listingsAsOf || "").slice(0, 10);
  if (Number.isFinite(n) && n >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(day)) return { n, day };
  const pts = (series || []).filter((point) => point && /^\d{4}-\d{2}-\d{2}$/.test(String(point.date || "")) && Number.isFinite(Number(point.listingCount)) && Number(point.listingCount) >= 0);
  const endMs = Date.parse(`${endDay}T00:00:00Z`);
  const near = Number.isFinite(endMs) ? pts.filter((point) => { const ms = Date.parse(`${String(point.date).slice(0, 10)}T00:00:00Z`); return ms <= endMs && endMs - ms <= 3 * 86400000; }).sort((a, b) => (String(a.date) < String(b.date) ? 1 : -1)) : [];
  const row = pts.find((point) => String(point.date).slice(0, 10) === endDay) || near[0] || null;
  if (!row) return null;
  const rowDay = String(row.date).slice(0, 10);
  const prev = pts.filter((point) => String(point.date).slice(0, 10) < rowDay).sort((a, b) => (String(a.date) < String(b.date) ? 1 : -1))[0];
  const pct = prev && Number(prev.listingCount) > 0 ? Math.round(((Number(row.listingCount) - Number(prev.listingCount)) / Number(prev.listingCount)) * 1000) / 10 : null;
  return { n: Number(row.listingCount), day: rowDay, pct, prevDay: prev ? String(prev.date).slice(0, 10) : "" };
}

// One signed, colored change table: 7D / 30D / 90D / 1Y. A window with no
// exact start day is left out. Nothing shows when no window has a number.
export function changeTable(series, endDay) {
  const cells = [["7D", 7], ["30D", 30], ["90D", 90], ["1Y", 365]]
    .map(([label, days]) => [label, exactWindowPct(series, days, endDay)])
    .filter(([, n]) => typeof n === "number" && Number.isFinite(n));
  if (!cells.length) return "";
  return `<style>.chg{display:grid;grid-template-columns:repeat(${cells.length},minmax(0,1fr));gap:6px;margin:10px 0 14px;padding:6px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid #2f2b26;max-width:420px}.chg div{padding:8px 6px;border-radius:12px;text-align:center}.chg dt{font:500 12px/1.2 var(--sans);color:var(--dim)}.chg dd{margin:3px 0 0;font:650 15px/1.2 var(--sans)}.chg .up{color:#7fc79a}.chg .down{color:#e0877a}</style><dl class="chg" aria-label="Price change">${cells.map(([label, n]) => `<div><dt>${label}</dt><dd class="${n > 0 ? "up" : n < 0 ? "down" : ""}">${n > 0 ? "+" : ""}${n}%</dd></div>`).join("")}</dl><p class="chg-src muted" style="margin:-8px 0 12px;font-size:13px">Change in TCGplayer market price${priceDay(endDay) ? ` to ${esc(priceDay(endDay).replace(/, \d{4}$/, ""))}` : ""}${infoTap(`TCGplayer market price, our dated nightly files${priceDay(endDay) ? `, ${priceDay(endDay).replace(/, \d{4}$/, "")}` : ""}`)}</p>`;
}

function summaryStrip({ nm = false, price = "", year = null, listings = null, rotation = "" } = {}) {
  const bits = [];
  if (price) bits.push(`<span class="sum-chip">${nm ? "NM " : ""}${esc(price)}</span>`);
  if (typeof year === "number" && Number.isFinite(year)) {
    const cls = year > 0 ? " up" : year < 0 ? " down" : "";
    bits.push(`<span class="sum-chip${cls}">1Y ${year > 0 ? "+" : ""}${year}%</span>`);
  }
  if (listings && Number.isFinite(listings.n) && listings.day) {
    const when = priceDay(listings.day);
    const pct = Number(listings.pct);
    const arrow = Number.isFinite(pct) && pct === 0 ? `<span class="sum-arrow" aria-label="Flat since ${esc(priceDay(listings.prevDay || "") || "the last count")}">\u2192 0%</span>` : Number.isFinite(pct) ? `<span class="sum-arrow ${pct > 0 ? "up" : "down"}" aria-label="${pct > 0 ? "Up" : "Down"} ${Math.abs(Math.round(pct * 10) / 10)}% since ${esc(priceDay(listings.prevDay || "") || "the last count")}">${pct > 0 ? "\u25B2" : "\u25BC"} ${Math.abs(Math.round(pct * 10) / 10)}%</span>` : "";
    bits.push(`<span class="sum-chip">${Number(listings.n).toLocaleString("en-US")} listings counted${when ? `, ${esc(when.replace(/, \d{4}$/, ""))}` : ""}${arrow ? ` ${arrow}` : ""}${infoTap(`eBay listings counted${when ? `, ${when.replace(/, \d{4}$/, "")}` : ""}`)}</span>`);
  }
  if (rotation) bits.push(`<span class="sum-chip">${esc(rotation)}</span>`);
  return bits.length ? `<p class="sum-strip">${bits.join("")}</p>` : "";
}

export function listingTrend(series, endDate) {
  const endDay = String(endDate || "").slice(0, 10);
  const pts = (series || []).filter((point) => point && /^\d{4}-\d{2}-\d{2}$/.test(String(point.date || "")) && Number.isInteger(Number(point.listingCount)));
  const end = pts.find((point) => point.date === endDay) || null;
  if (!end) return "";
  const bits = [7, 30].map((days) => {
    const startDay = new Date(Date.parse(`${endDay}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
    const start = pts.find((point) => point.date === startDay) || null;
    if (!start || !(Number(start.listingCount) > 0)) return "";
    const pct = Math.round(((Number(end.listingCount) - Number(start.listingCount)) / Number(start.listingCount)) * 1000) / 10;
    return `${days}D ${pct > 0 ? "+" : ""}${pct}% (${start.listingCount} → ${end.listingCount})`;
  });
  const live = bits.filter(Boolean);
  return live.length ? `eBay listings ${live.join(" · ")}` : `eBay listings ${end.listingCount} on ${endDay}`;
}

function dayBefore(endDay, days) {
  return new Date(Date.parse(`${endDay}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
}

export function decodeSpark(packed, asOf) {
  const end = String(asOf || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end) || !packed) return [];
  const endMs = Date.parse(`${end}T00:00:00Z`);
  const out = [];
  for (const bit of String(packed).split(",")) {
    const m = bit.match(/^(\d+):(\d+(?:\.\d+)?)$/);
    if (!m) continue;
    const off = Number(m[1]);
    const v = Number(m[2]);
    if (off < 0 || off > 29 || !(v > 0)) continue;
    out.push([new Date(endMs - off * 86400000).toISOString().slice(0, 10), v]);
  }
  out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return out;
}

export function sparkSvg(points) {
  const pts = (points || []).filter((point) => Array.isArray(point) && /^\d{4}-\d{2}-\d{2}$/.test(point[0]) && Number(point[1]) > 0);
  if (pts.length < 2) return "";
  const w = 72;
  const h = 28;
  const vals = pts.map((point) => Number(point[1]));
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const t0 = Date.parse(`${pts[0][0]}T00:00:00Z`);
  const t1 = Date.parse(`${pts[pts.length - 1][0]}T00:00:00Z`);
  const x = (day) => {
    const t = Date.parse(`${day}T00:00:00Z`);
    if (t1 === t0) return 2;
    return 2 + ((t - t0) / (t1 - t0)) * (w - 4);
  };
  const y = (v) => 2 + ((max - v) / span) * (h - 4);
  let d = "";
  let prev = "";
  for (const point of pts) {
    const expected = prev ? new Date(Date.parse(`${prev}T00:00:00Z`) + 86400000).toISOString().slice(0, 10) : "";
    d += `${!prev || point[0] !== expected ? "M" : "L"}${x(point[0]).toFixed(1)},${y(Number(point[1])).toFixed(1)}`;
    prev = point[0];
  }
  return `<svg class="spark30" width="72" height="28" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" fill="none" stroke="#d9b779" stroke-width="1.5"></path></svg>`;
}

export function quickView(card, extra = {}) {
  if (!card || typeof card !== "object" || !card.name) return null;
  const fact = extra.fact || null;
  const hist = histWithFact(Array.isArray(card.hist) ? card.hist : [], fact)
    .filter((point) => Array.isArray(point) && /^\d{4}-\d{2}-\d{2}$/.test(String(point[0])) && Number(point[1]) > 0)
    .map((point) => [String(point[0]).slice(0, 10), Number(point[1])]);
  const asOf = String(fact?.asOf || card.asOf || "").slice(0, 10);
  const endDay = /^\d{4}-\d{2}-\d{2}$/.test(asOf) ? asOf : "";
  const source = sourceLine(card);
  const shown = fact?.price > 0 ? Number(fact.price) : (Number(card.price) > 0 ? Number(card.price) : null);
  const windows = [7, 30, 90].map((days) => {
    const pct = exactWindowPct(hist, days, endDay);
    return {
      label: `${days}D`,
      pct: typeof pct === "number" ? pct : null,
      from: typeof pct === "number" ? dayBefore(endDay, days) : "",
      to: typeof pct === "number" ? endDay : "",
      source,
    };
  });
  const sealed = card.kind === "sealed";
  const series = sealed && Array.isArray(extra.listingSeries) ? extra.listingSeries : [];
  const listingPoints = series
    .filter((point) => point && /^\d{4}-\d{2}-\d{2}$/.test(String(point.date || "")) && Number.isFinite(Number(point.listingCount)))
    .map((point) => [String(point.date).slice(0, 10), Number(point.listingCount)]);
  const reads = (extra.productReads || []).filter((read) => read && (read.headline || read.path)).slice(0, 3).map((read) => ({
    date: String(read.asOf || "").slice(0, 10),
    text: String(read.headline || read.path || ""),
    source: String(read.source || ""),
    href: extra.feed && read.id ? `/feed/r/${encodeURIComponent(read.id)}` : "",
  }));
  return {
    name: String(card.name || ""),
    set: String(card.set || ""),
    num: String(card.num || ""),
    printing: String(card.printing || ""),
    kind: sealed ? "sealed" : "single",
    price: shown,
    asOf: endDay,
    source,
    windows,
    range: rangeMarker(hist, endDay).text,
    hist,
    listings: sealed ? {
      text: listingTrend(series, endDay),
      source: "eBay listings",
      asOf: endDay,
      points: listingPoints,
    } : null,
    reads,
    tcgUrl: tcgStoreUrl(card),
    ebayUrl: ebaySearchUrl(card),
    photo: { src: String(extra.photo || ""), alts: (extra.photoAlts || []).map(String), crop: sealed ? false : !!extra.crop },
  };
}

function printingTags(card) {
  const out = [];
  const seen = new Set();
  const add = (value) => {
    const text = String(value || "").trim();
    if (!text || /^normal$/i.test(text)) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(text);
  };
  for (const tag of card?.tags || []) add(tag);
  add(card?.printing);
  return out;
}

function artistSlug(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function plainRead(read) {
  const raw = String(read?.headline || read?.path || "").trim();
  return raw.replace(/\s*[\u2014\u2013]\s*/g, ": ").replace(/\s+/g, " ").trim();
}

function readForCard(read, cardId) {
  if (!read || typeof read !== "object") return false;
  const href = String(read.href || "");
  if (href.startsWith("/p/") || href.startsWith("/dive/") || href.startsWith("/sets/")) return false;
  const sku = String(read.sku || read.cardId || read.leadId || "");
  if (sku && sku !== cardId) return false;
  if (href.startsWith("/c/") && href !== `/c/${cardId}`) return false;
  return !!plainRead(read);
}

const SIT_KINDS = new Set(["year-range", "year-ago", "season"]);

function readKindOf(read) {
  return String(read?.readKind || read?.kind || read?.type || "");
}

function newestReads(list) {
  return (list || []).slice().sort((a, b) => String(b.asOf || "").localeCompare(String(a.asOf || "")) || String(a.id || "").localeCompare(String(b.id || "")));
}

function readItems(list, cardId) {
  const out = [];
  const seen = new Set();
  for (const read of newestReads(list)) {
    if (!readForCard(read, cardId)) continue;
    const text = plainRead(read);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push({ text, asOf: String(read.asOf || "").slice(0, 10), kind: readKindOf(read) });
  }
  return out;
}

function readListHtml(items) {
  return `<ul class="cp-reads">${items.map((item) => {
    const when = priceDay(item.asOf);
    return `<li><p>${esc(item.text)}</p>${when ? `<p class="muted">${esc(when)}</p>` : ""}</li>`;
  }).join("")}</ul>`;
}

export function pokemonStripHtml(strip) {
  const name = String(strip?.name || "").trim();
  const slug = String(strip?.slug || "").trim();
  const count = Number(strip?.count);
  if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !Number.isInteger(count) || count < 1) return "";
  const end = (amount, day) => {
    const cash = money(amount);
    const when = priceDay(day);
    return cash && when ? `${cash} on ${when}` : "";
  };
  const low = end(strip.low, strip.lowDate);
  const high = end(strip.high, strip.highDate);
  if (!low || !high) return "";
  const noun = count === 1 ? "card" : "cards";
  const sameDay = priceDay(strip.lowDate) && priceDay(strip.lowDate) === priceDay(strip.highDate);
  const range = count === 1 || low === high ? low : sameDay ? `${money(strip.low)} to ${money(strip.high)} on ${priceDay(strip.highDate)}` : `${low} to ${high}`;
  const text = `Every ${name} card we price: ${count} ${noun}, ${range}.`;
  if (/[\u2014\u2013]/.test(text)) return "";
  return `<a class="cp-mon" href="/pokemon/${esc(slug)}">${esc(text)}</a>`;
}

const SINGLE_CSS = `
.card-page{padding-bottom:48px}
.cp-head{display:flex;flex-direction:column;align-items:center;text-align:center;gap:16px;margin:0 0 8px}
.cp-photo{width:min(240px,72%)}
.cp-photo img,.cp-photo .tile{width:100%;height:auto;border-radius:22px;background:#1a1815}
.cp-id{min-width:0;max-width:100%}
.cp-set{margin:0 0 4px;color:var(--dim);font:500 14px/1.3 var(--sans)}
.cp-set a{color:inherit;text-decoration:none;min-height:44px;display:inline-flex;align-items:center}
.card-page h1{margin:0;font:600 34px/1.05 var(--serif);letter-spacing:-.03em}
.cp-price{display:flex;align-items:baseline;justify-content:center;gap:8px;margin:12px 0 2px;white-space:nowrap}
.cp-now{font:600 34px/1 var(--serif);color:var(--gold);letter-spacing:-.03em}
.cp-date{font:500 13px/1 var(--sans);color:var(--dim)}
.cp-src{margin:0 0 8px;color:var(--dim);font:500 13px/1.3 var(--sans)}
.cp-wins{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:8px 0 0}
.cp-prints{display:flex;gap:8px;overflow-x:auto;list-style:none;margin:10px 0 0;padding:0 0 4px}
.cp-prints li{flex:none;min-height:44px;display:flex;align-items:center;gap:8px;padding:0 14px;border-radius:999px;background:rgba(255,255,255,.06);font:600 14px/1.2 var(--sans)}
.cp-prints small{font:500 14px/1.2 var(--sans);color:var(--dim)}
.cp-cond,.cp-gap{margin:6px 0 0;font:500 14px/1.35 var(--sans)}
.cp-cond{color:var(--dim)}
.cp-pattern{margin:12px 0;padding:14px 16px;border-radius:18px;background:#1a1815;border:1px solid #2f2b26}
.cp-pattern p{margin:0;font:500 16px/1.4 var(--sans)}
.cp-pattern .muted{margin-top:6px;font-size:14px}
.cp-pattern .rd-era{display:inline-flex;align-items:center;min-height:32px;margin-top:8px;padding:0 10px;border-radius:999px;color:#d9b779;background:rgba(217,183,121,.12)}
.card-page .win{display:inline-flex;align-items:center;min-height:32px;margin:0;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.06)}
.cp-charts{margin:8px 0 18px}
.cp-sec{margin:18px 0;padding:18px 16px;border-radius:22px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06)}
.cp-sec h2{margin:0 0 10px;font:600 13px/1.2 var(--sans);letter-spacing:.04em;text-transform:uppercase;color:var(--dim)}
.cp-facts{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.cp-facts li{display:flex;justify-content:space-between;gap:12px;align-items:baseline;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.04)}
.cp-facts span{color:var(--dim);font:500 13px/1.2 var(--sans)}
.cp-facts b{font-weight:600;text-align:right}
.cp-mon{display:block;margin-top:12px;padding:14px 14px;border-radius:16px;background:rgba(217,183,121,.08);color:var(--txt);text-decoration:none;font:600 15px/1.35 var(--sans)}
.cp-panels{display:grid;gap:16px;margin:18px 0}
.card-page .crt,.card-page .ircy{border-radius:22px;max-width:100%;min-width:0}
.card-page .crt ul.cw a{border-radius:16px;min-width:0}
.card-page .rchip{border-radius:999px}
.cp-reads{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.cp-reads li{padding:12px 14px;border-radius:16px;background:rgba(255,255,255,.04)}
.cp-reads p{margin:0}
.cp-reads .muted{margin-top:4px}
.yr{margin:2px 0 14px;max-width:100%}
.yr-line{margin:0 0 9px;font:600 13px/1.25 var(--sans);letter-spacing:-.02em;white-space:nowrap}
.yr-track{position:relative;height:6px;margin:0 9px;border-radius:999px;background:rgba(255,255,255,.10)}
.yr-fill{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:linear-gradient(90deg,rgba(217,183,121,.28),#d9b779)}
.yr-knob{position:absolute;top:50%;width:8px;height:8px;border-radius:50%;background:#f6f1e7;transform:translate(-50%,-50%);pointer-events:none}
@media(max-width:480px){
  .card-page h1{font-size:28px}
  .cp-now{font-size:28px}
  .cp-date{font-size:12px}
  .yr-line{font-size:11px;letter-spacing:-.03em}
}
@media(min-width:768px){
  .cp-head{flex-direction:row;align-items:flex-start;text-align:left;gap:28px}
  .cp-photo{width:240px;flex:none}
  .cp-price,.cp-wins{justify-content:flex-start}
}
@media(min-width:1100px){
  .cp-charts.has-counts{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,.85fr);gap:16px;align-items:start}
}
`;

function printingsHtml(card) {
  const rows = (Array.isArray(card?.printings) ? card.printings : []).filter((row) => {
    const day = String(row?.asOf || "").slice(0, 10);
    return row && String(row.name || "").trim() && Number(row.price) > 0 && priceDay(day);
  });
  if (rows.length < 2) return "";
  return `<ul class="cp-prints" aria-label="Printings">${rows.map((row) => {
    const when = priceDay(String(row.asOf).slice(0, 10));
    return `<li><span>${esc(row.name)}</span><b>${money(row.price)}</b><small>${esc(when)}</small></li>`;
  }).join("")}</ul>`;
}

function conditionLine(note) {
  const text = String(note?.text || "").trim();
  const when = priceDay(String(note?.asOf || "").slice(0, 10));
  if (!text || !when) return "";
  const src = String(note.source || "").trim();
  const tail = [src, when].filter(Boolean).join(", ");
  return `<p class="cp-cond">${esc(text)}${tail ? ` <span class="muted">${esc(tail)}</span>` : ""}</p>`;
}

function ebayBlock(read) {
  if (!read) return "";
  const bits = priceBits(read);
  const ask = String(bits.line || "").split(". ").find((part) => part.startsWith("eBay ask"));
  return [ask, bits.gap].filter(Boolean).map((part) => `<p class="cp-gap">${esc(part)}</p>`).join("");
}

function patternBlock(read) {
  const hit = patternSentence(read);
  if (!hit) return "";
  const when = priceDay(hit.asOf);
  const note = [hit.source, when].filter(Boolean).join(" · ");
  return `<section class="cp-pattern"><p>${esc(hit.text)}</p>${hit.era ? `<p class="rd-era">Held in every era on file</p>` : ""}${note ? `<p class="muted">${esc(note)}</p>` : ""}</section>`;
}

function readLink(card) {
  const id = String(card?.id || "");
  if (!id.startsWith("tcgcsv-")) return "";
  const kind = card.kind === "sealed" ? "sealed" : "card";
  return `<p class="muted"><a class="tap" href="/reads?${kind}=${esc(id)}">Add this to your read</a></p>`;
}


// Item page sections shared by singles and sealed: where it ranks, every read
// about it, related items, and a jump row. A section is left out when its numbers are missing.
const KIND_LABEL = { deep: "Deep read", listings: "Listings counted", breadth: "Listings counted", rotation: "Rotation", release: "Release", "release-cycle": "Release cycle", season: "Season", rip: "Rip value", high: "New high", low: "New low", year: "Year", "year-range": "Year range", "year-ago": "A year ago", backto: "Back to", "rarity-band": "Rarity band", "artist-band": "Artist band", set: "Set", streak: "Streak", "pattern-forming": "Pattern", "pattern-ending": "Pattern", "past-cases": "Past cases", mixed: "Mixed", plain: "Price move", mktmove: "Price move" };
const ITEM_CSS = `.item-jump{display:flex;gap:8px;overflow-x:auto;margin:14px 0 4px;padding:2px 0 6px;scrollbar-width:none}.item-jump::-webkit-scrollbar{display:none}
.item-jump a{flex:0 0 auto;min-height:44px;display:inline-flex;align-items:center;padding:0 16px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid #2f2b26;color:inherit;text-decoration:none;font:600 14px/1 var(--sans)}
.item-sec{margin:16px 0;padding:16px;border-radius:20px;background:#15130f;border:1px solid #2f2b26}.item-sec>h2{margin:0 0 10px;font-size:18px}
[id]{scroll-margin-top:76px}
.rank-big{margin:0;font:600 28px/1.1 var(--serif);color:var(--gold)}.rank-bar{position:relative;height:8px;margin:12px 0 6px;border-radius:999px;background:rgba(255,255,255,.08)}.rank-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:linear-gradient(90deg,rgba(217,183,121,.3),#d9b779)}
.all-reads{list-style:none;margin:0;padding:0;display:grid;gap:10px}.all-reads li{padding:14px 16px;border-radius:16px;background:#1a1815;border:1px solid #2f2b26}
.all-reads .rk{display:inline-flex;align-items:center;min-height:26px;padding:0 10px;border-radius:999px;background:rgba(217,183,121,.12);color:var(--gold);font:600 12px/1 var(--sans);margin-right:8px}
.all-reads h3{margin:8px 0 4px;font:600 16px/1.35 var(--sans)}.all-reads details summary{min-height:44px;display:flex;align-items:center;cursor:pointer;font:600 14px/1 var(--sans);color:var(--gold)}.all-reads ul{margin:0 0 6px;padding-left:18px}
.all-reads .rd-go{min-height:44px;display:inline-flex;align-items:center}
.rel-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.rel-grid a{min-height:44px;display:flex;flex-direction:column;justify-content:center;padding:12px 14px;border-radius:16px;background:#1a1815;border:1px solid #2f2b26;color:inherit;text-decoration:none}.rel-grid b{font:600 14px/1.3 var(--sans)}.rel-grid span{font:500 13px/1.3 var(--sans);color:var(--dim)}`;

export function itemRankHtml(card) {
  const rank = Number(card?.rank);
  const of = Number(card?.of);
  if (!(rank >= 1) || !(of >= rank)) return "";
  const setName = card.setSlug ? `<a href="/sets/${esc(card.setSlug)}">${esc(card.set || "this set")}</a>` : esc(card.set || "this set");
  const pctTop = Math.max(1, Math.round((rank / of) * 1000) / 10);
  const fill = Math.max(4, Math.round((1 - (rank - 1) / of) * 100));
  return `<section class="item-sec" id="rank"><h2>Where it ranks in its set</h2><p class="rank-big">#${rank} of ${of}</p><div class="rank-bar" aria-hidden="true"><i style="width:${fill}%"></i></div><p class="muted">By TCGplayer market price among priced ${card.kind === "sealed" ? "products" : "singles"} in ${setName}. Top ${pctTop}%.</p></section>`;
}

export function itemReadsHtml(reads, { feed = false } = {}) {
  const list = (Array.isArray(reads) ? reads : []).filter((r) => r && String(r.headline || "").trim() && !/[\u2014\u2013]/.test(String(r.headline)));
  if (!list.length) return "";
  const items = list.map((r) => {
    const when = priceDay(String(r.asOf || "").slice(0, 10));
    const label = KIND_LABEL[r.kind] || "Read";
    const lines = (r.lines || []).filter(Boolean);
    const more = lines.length ? `<details><summary>Full read</summary><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>${r.source ? `<p class="muted">${esc(r.source)}</p>` : ""}</details>` : "";
    const go = feed && r.id ? `<a class="rd-go" href="/feed/r/${encodeURIComponent(r.id)}">Open this read</a>` : "";
    return `<li id="read-${esc(r.id || "")}"><span class="rk">${esc(label)}</span>${when ? `<span class="muted">${esc(when)}</span>` : ""}<h3>${esc(r.headline)}</h3>${more}${go}</li>`;
  }).join("");
  return `<section class="item-sec" id="reads"><h2>All reads about this item <span class="muted">(${list.length})</span></h2><ul class="all-reads">${items}</ul></section>`;
}

export function itemRelatedHtml(card) {
  const rows = (card?.also || []).filter((row) => row && /^tcgcsv-\d+$/.test(String(row.id || "")) && row.name);
  if (!rows.length) return "";
  const base = card.kind === "sealed" ? "/p/" : "/c/";
  return `<section class="item-sec" id="related"><h2>Related items</h2><div class="rel-grid">${rows.slice(0, 12).map((row) => `<a href="${base}${esc(row.id)}"><b>${esc(row.name)}</b>${money(row.price) ? `<span>${money(row.price)}</span>` : ""}</a>`).join("")}</div></section>`;
}

export function itemJumpHtml(body) {
  const have = ITEM_SECTIONS.filter(([id]) => body.includes(`id="${id}"`));
  if (have.length < 2) return "";
  return `<nav class="item-jump" aria-label="On this page">${have.map(([id, label]) => `<a href="#${id}">${label}</a>`).join("")}</nav>`;
}

// Puts the jump row right after the header block and the CSS once.
export function withItemSections(mainHtml, marker) {
  const jump = itemJumpHtml(mainHtml);
  const i = mainHtml.indexOf(marker);
  const css = `<style>${ITEM_CSS}</style>`;
  if (i < 0) return css + mainHtml;
  const at = i + marker.length;
  return mainHtml.slice(0, at) + css + jump + mainHtml.slice(at);
}

function renderSingleCard({ card, opts, price, endDay, hist, priceSeries, rangeRow, img, setBit }) {
  const tags = printingTags(card);
  const chips = changeTable(priceSeries.length ? priceSeries : hist, endDay);
  const strip = summaryStrip({
    nm: true,
    price,
    listings: countedListings(opts.fact, opts.listingSeries, endDay),
    rotation: rotationChipLabel(opts.rotationFact),
  });
  const when = priceDay(endDay);
  const num = String(card.num || "").trim();
  const numBit = num ? ` · ${num.startsWith("#") ? num : `#${num}`}` : "";
  const priceReal = (priceSeries || []).filter((point) => point && Number(point[1]) > 0 && !point[3]);
  const priceChart = priceReal.length >= 2 ? historyChart(priceSeries, { asOf: endDay }) : "";
  const listReal = (opts.listingSeries || [])
    .filter((point) => point && /^\d{4}-\d{2}-\d{2}$/.test(String(point.date || "")) && Number.isFinite(Number(point.listingCount)) && Number(point.listingCount) >= 0)
    .map((point) => [String(point.date).slice(0, 10), Number(point.listingCount), "n"])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const listChart = listReal.length >= 2
    ? `<section class="cp-sec cp-counts" id="supply"><h2>eBay listings counted</h2>${historyChart(listReal, { asOf: endDay, color: "#7fc79a", unit: "count", snap: "real" })}</section>`
    : "";
  const chartOn = !!(priceChart || rangeRow || listChart);
  const sit = readItems(opts.sitReads, card.id).filter((item) => SIT_KINDS.has(item.kind));
  const boardSrc = Array.isArray(opts.boardReads) ? opts.boardReads : (opts.productReads || []);
  const board = readItems(boardSrc, card.id).filter((item) => !SIT_KINDS.has(item.kind)).slice(0, 5);
  const facts = [];
  if (card.rarity) facts.push(["Rarity", esc(card.rarity)]);
  if (card.set) facts.push(["Set", setBit || esc(card.set)]);
  const released = priceDay(String(card.release || "").slice(0, 10));
  if (released) facts.push(["Released", esc(released)]);
  const factList = facts.map(([label, value]) => `<li><span>${label}</span><b>${value}</b></li>`).join("");
  let monStrip = opts.pokemon;
  // The range always includes the card on this page.
  const own = Number(card.price);
  if (monStrip && own > 0) {
    const day = String(card.asOf || card.priceDate || monStrip.highDate || "").slice(0, 10);
    if (Number(monStrip.high) > 0 && own > Number(monStrip.high)) monStrip = { ...monStrip, high: own, highDate: day || monStrip.highDate };
    if (Number(monStrip.low) > 0 && own < Number(monStrip.low)) monStrip = { ...monStrip, low: own, lowDate: day || monStrip.lowDate };
  }
  const mon = pokemonStripHtml(monStrip);
  const rotation = String(opts.rotationFact || "");
  const printRun = isRotatedSet(card) ? `<p class="print-run">${esc(PRINT_RUN_LINE)} <a href="/rotation">Rotation and print runs</a>.</p>` : "";
  const factBlock = (factList || rotation || mon || printRun)
    ? `<section class="cp-sec" id="stats"><h2>Key stats</h2>${factList ? `<ul class="cp-facts">${factList}</ul>` : ""}${rotation}${printRun}${mon}</section>`
    : "";
  const panels = [opts.ratingHtml, opts.cycleHtml].map((html) => String(html || "").trim()).filter(Boolean).join("");
  const also = (card.also || []).map((row) => `<a href="/c/${esc(row.id)}">${esc(row.name)}</a>`).join(" · ");
  void also;
  const math = [];
  const allReadsHtml = itemReadsHtml(opts.allReads, { feed: !!opts.feed });
  
  return withItemSections(`<main id="main" tabindex="-1" class="wrap product-glance card-page">
<style>${SINGLE_CSS}</style>
<header class="cp-head">
<div class="cp-photo">${img}</div>
<div class="cp-id">
<p class="cp-set">${setBit || esc(card.set || "")}${esc(numBit)}</p>
<h1>${esc(card.name)}</h1>
${readLink(card)}
${tags.length ? `<div class="vchips" aria-label="Printing">${tags.map((tag) => `<a class="vchip" href="/search?tag=${encodeURIComponent(tag)}">${esc(tag)}</a>`).join("")}</div>` : ""}
${storeLinksHtml(card, esc)}
${price ? `<p class="cp-price"><span class="cp-now">${price}</span>${when ? `<span class="cp-date">${esc(when)}</span>` : ""}${opts.priceCheck ? `<span class="cp-check" style="display:inline-block;margin-left:8px;padding:4px 10px;border-radius:999px;background:#3a2f1a;color:#d9b779;font:600 12px/1.2 var(--sans)">Unverified: far from similar cards</span>` : ""}</p><p class="cp-src">${esc(sourceLine(card))}${infoTap(`${sourceLine(card) || "TCGplayer market"} price${when ? `, ${when.replace(/, \d{4}$/, "")}` : ""}`.replace(/price price/i, "price"))}</p>` : ""}
${chips}
${strip}
${printingsHtml(card)}
${conditionLine(opts.conditionNote)}
${ebayBlock(opts.priceRead)}
</div>
</header>
${chartOn ? `<style>${HISTORY_CSS}</style><div class="cp-charts${listChart ? " has-counts" : ""}">${priceChart || rangeRow ? `<div class="cp-price-col" id="price">${priceChart}${rangeRow}</div>` : ""}${listChart}</div><script>${HISTORY_JS}</script>` : ""}
${opts.itemReadHtml || ""}
${patternBlock(opts.patternRead)}
${sit.length ? `<section class="cp-sec"><h2>Where it sits</h2>${readListHtml(sit)}</section>` : ""}
${itemRankHtml(card)}
${factBlock}
${panels ? `<div class="cp-panels">${panels}</div>` : ""}
${allReadsHtml || (board.length ? `<section class="cp-sec" id="reads"><h2>Reads about this card</h2>${readListHtml(board)}</section>` : "")}
${itemRelatedHtml(card)}
<details><summary>See the math</summary>
${math.join("")}
<p><button type="button" id="paid">Report a price I paid</button></p>
<form id="paid-form" hidden>
<label>Price <input name="price" inputmode="decimal" required></label>
<label>Date <input name="date" type="date" required></label>
<label>Condition <input name="condition" required></label>
<label>Where <input name="where" required></label>
<button type="submit">Send</button>
<p class="muted" id="paid-status"></p>
<p class="muted">A report stays private. A community median shows only after 5 reports of the same product. We do not attach your name. Proof photos are not accepted on this page.</p>
</form>
</details>
<script type="application/json" id="paid-id">${esc(card.id)}</script>
<script>
document.getElementById("paid").addEventListener("click",function(){document.getElementById("paid-form").hidden=false});
document.getElementById("paid-form").addEventListener("submit",function(ev){
  ev.preventDefault();
  var fd=new FormData(ev.currentTarget);
  var status=document.getElementById("paid-status");
  fetch("/api/report",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:document.getElementById("paid-id").textContent,price:fd.get("price"),date:fd.get("date"),condition:fd.get("condition"),where:fd.get("where")})})
    .then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j}})})
    .then(function(res){status.textContent=res.ok?"Saved.":(res.j&&res.j.error)||"Not stored. The server store is not on."})
    .catch(function(){status.textContent="Not stored. The server store is not on."});
});
</script>
</main>`, "</header>\n");
}

export function sourceLine(card) {
  const src = String(card && card.source || "TCGplayer market");
  return /^tcgcsv-/.test(String(card && card.id || "")) && !/tcgcsv/i.test(src) ? `${src} via TCGCSV` : src;
}

// Chart series for a card: fan-site fill only before our first own night (and,
// for singles, only after the tcgcsv archive ends), archive, then our own days.
export function cardPriceSeries(card, hist, sealed = card?.kind === "sealed") {
  const ownDays = (hist || []).filter((point) => Array.isArray(point) && /^\d{4}-\d{2}-\d{2}$/.test(String(point[0]))).map((point) => String(point[0])).sort();
  const firstOwn = ownDays[0] || "";
  const longLast = sealed ? "" : String(card.longHist || "").split(",").map((b) => Number(b.split(":")[0])).filter((n) => n > 0).reduce((m, n) => Math.max(m, n), 0);
  const longLastIso = longLast ? new Date(longLast * 86400000).toISOString().slice(0, 10) : "";
  const fillPts = Array.isArray(card.fillHist) ? card.fillHist.filter((point) => {
    if (!Array.isArray(point) || !/^\d{4}-\d{2}-\d{2}$/.test(String(point[0])) || !(Number(point[1]) > 0)) return false;
    const day = String(point[0]);
    if (firstOwn && day >= firstOwn) return false;
    if (longLastIso && day <= longLastIso) return false;
    return true;
  }) : [];
  return mergeHistory(fillPts.length ? [...fillPts, ...hist] : hist, sealed ? "" : card.longHist, fillPts.length ? (card.fillTo || firstOwn) : "");
}

// Read pages: the card's year chart, same component as the card page. Tooltips
// snap only to real dated points. The read's own numbers stay on our own days.
export function readYearChart(card, asOf = "") {
  if (!card || !Array.isArray(card.hist)) return "";
  const series = cardPriceSeries(card, card.hist);
  if (series.length < 2) return "";
  return `<div class="read-year"><style>${HISTORY_CSS}</style>${historyChart(series, { asOf: String(asOf || "").slice(0, 10), snap: "real" })}</div>`;
}

function ebayAskLine(ask) {
  const amount = Number(ask?.amount);
  const day = String(ask?.asOf || "").slice(0, 10);
  // A date after today is a bad stamp; never show a future day.
  const today = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const when = day && day <= today ? priceDay(day) : "";
  if (!(amount > 0) || !when) return "";
  const src = String(ask?.source || "").trim();
  return `<section class="ebay-card" style="margin:14px 0;padding:14px 16px;border-radius:18px;background:#1a1815;border:1px solid #2f2b26"><h2 style="margin:0 0 8px;font:600 16px/1.2 var(--sans)">eBay</h2><dl class="kv" style="margin:0;padding:0;background:none;border:0"><div><dt>Ask</dt><dd>${money(amount)}</dd></div><div><dt>Date</dt><dd>${esc(when)}</dd></div></dl></section>`;
}

function ripValueBlock(rip) {
  if (!rip || typeof rip !== "object") return "";
  const when = priceDay(String(rip.asOf || "").slice(0, 10));
  if (!when) return "";
  const roi = Number(rip.roiPct);
  const beat = Number(rip.beatChance);
  const bits = [];
  const add = (label, value) => { if (value) bits.push(`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`); };
  add("Average pull value", money(rip.contentsEV));
  if (Number.isFinite(roi)) add("ROI", `${Math.round(roi * 10) / 10}%`);
  if (Number.isFinite(beat)) add("Chance an opening beats the price", `${Math.round(beat * 10) / 10}%`);
  add("Typical opening", money(rip.median));
  if (!bits.length) return "";
  const src = [String(rip.priceSource || "").trim(), when].filter(Boolean).join(", ");
  return `<section class="sealed-rip"><h2>Rip value</h2><dl>${bits.join("")}</dl>${src ? `<p class="muted">${esc(src)}</p>` : ""}</section>`;
}

export function renderCard(card, stamp, opts = {}) {
  if (!card) return chrome("", `<main id="main" tabindex="-1" class="wrap"><h1>Not in the catalog</h1><p class="muted">That id is not in the TCGplayer catalog we publish.</p></main>`, "Not found", stamp, "", feedNav(opts));
  const fact = opts.fact || null;
  const shown = fact?.price > 0 ? fact.price : card.price;
  const price = money(shown);
  const asOf = fact?.asOf || card.asOf;
  const hist = histWithFact(card.hist || [], fact);
  const endDay = String(asOf || "").slice(0, 10);
  const chips = "";
  const sealed = card.kind === "sealed";
  const listingsLine = sealed ? listingTrend(opts.listingSeries || [], endDay) : "";
  const reads = (opts.productReads || []).filter((read) => read && (read.headline || read.path)).slice(0, 3);
  const readHtml = reads.length
    ? `<ul class="glance-reads">${reads.map((read) => {
      const when = esc(priceDay(String(read.asOf || "").slice(0, 10)));
      const line = esc(read.headline || "");
      const href = opts.feed && read.id ? `/feed/r/${encodeURIComponent(read.id)}` : "";
      return `<li>${href ? `<a href="${esc(href)}">${when} ${line}</a>` : `${when} ${line}`}</li>`;
    }).join("")}</ul>`
    : "";
  const supplyNote = isRotatedSet(card)
    ? `<p class="print-run">${esc(PRINT_RUN_LINE)} <a href="/rotation">Rotation and print runs</a>.</p>`
    : "";
  const pricePts = (hist || []).filter((point) => Array.isArray(point)).map((point) => ({ date: point[0], ask: Number(point[1]) }));
  const chartFile = sealed ? "data/history/tcgplayer-market" : "data/history/tcgcsv-daily";
  void chartFile; void pricePts;
  // Fan-site fill (sealed and singles) only charts days before our first own day.
  // A fill price on or after that day is not a card price and must not move the
  // chart or the since range. For singles the tcgcsv daily archive (longHist)
  // wins on overlap, so fill only covers days after its last point.
  const priceSeries = cardPriceSeries(card, hist, sealed);
  const priceChart = `<style>${HISTORY_CSS}</style>${historyChart(priceSeries, { asOf: endDay, ownLabel: sealed ? "TCGplayer market price, our nightly pull" : undefined })}<script>${HISTORY_JS}</script>`;
  const rangeRow = yearRangeHtml(priceSeries, endDay);
  const changeHtml = sealed ? changeTable(priceSeries.length ? priceSeries : hist, endDay) : "";
  const sealedStrip = sealed ? summaryStrip({
    price: price && priceDay(endDay) ? `${price} · ${priceDay(endDay).replace(/, \d{4}$/, "")}` : price,
    listings: countedListings(fact, opts.listingSeries, endDay) || opts.itemListings || null,
    rotation: rotationChipLabel(opts.rotationFact || opts.rotationHtml),
  }) : "";
  const listReal = (opts.listingSeries || [])
    .filter((point) => point && /^\d{4}-\d{2}-\d{2}$/.test(String(point.date || "")) && Number.isFinite(Number(point.listingCount)) && Number(point.listingCount) >= 0)
    .map((point) => [String(point.date).slice(0, 10), Number(point.listingCount), "n"])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const listChart = sealed && listReal.length >= 2
    ? `<h2>eBay listings counted</h2>${historyChart(listReal, { asOf: endDay, color: "#7fc79a", unit: "count", snap: "real" })}`
    : "";
  const breakBits = [];
  const listings = Number(fact?.listings);
  if (listings >= 20 && fact?.listingsAsOf) breakBits.push(`<p>Active listings: ${listings} (as of ${esc(fact.listingsAsOf)}).</p>`);
  const flagged = flagHtml(fact?.flagged);
  if (flagged) breakBits.push(`<p>${flagged}</p>`);
  const checked = checkedLabel(asOf);
  const hrefKind = card.kind === "sealed" ? "Sealed" : "Single";
  const setMark = /^\/img\/[a-z0-9]+\/logo\.png$/i.test(String(opts.setLogo || ""))
    ? `<img class="set-mark" alt="" width="96" height="28" loading="lazy" decoding="async" src="${esc(opts.setLogo)}">`
    : "";
  const setBit = setMark + (card.setSlug
    ? `<a href="/sets/${esc(card.setSlug)}">${esc(card.set || "")}</a>`
    : esc(card.set || ""));
  const img = imageTag(opts.catalogueSrc || "", card.kind === "sealed" ? "sealed" : "card", card.name, { ...card, catalogueCrop: false, crop: false, logo: opts.setLogo || "", alts: opts.catalogueAlts || [] }).replace('loading="lazy"', 'loading="eager"');
  const also = (card.also || []).map((row) => `<a href="${card.kind === "sealed" ? "/p/" : "/c/"}${esc(row.id)}">${esc(row.name)}</a>`).join(" · ");
  if (!sealed) {
    return chrome("", renderSingleCard({ card, opts, price, endDay, hist, priceSeries, rangeRow, img, setBit }), card.name, stamp, "", feedNav(opts));
  }
  const allReadsHtml = itemReadsHtml(opts.allReads, { feed: !!opts.feed });
  const released = priceDay(String(card.release || "").slice(0, 10));
  void also;
  const body = withItemSections(`<main id="main" tabindex="-1" class="wrap product-glance">
<style>
.glance{display:block;max-width:100%}
.glance-photo{max-width:100%}
.glance-photo{display:flex;align-items:center;justify-content:center;width:min(320px,100%);aspect-ratio:1/1;padding:18px;box-sizing:border-box;border-radius:20px;background:radial-gradient(120% 100% at 50% 30%,#2a2620 0%,#16140f 75%);border:1px solid #2f2b26;overflow:hidden}
.glance-photo img{border-radius:12px;max-height:100%}
.glance img.shot,.glance img.card-face,.glance img.card-face[data-tile="card"]{width:min(280px,100%);max-width:100%;height:auto;object-fit:contain;object-position:center}
.win{display:inline-flex;align-items:center;min-height:44px;min-width:44px;margin:0 8px 6px 0;font:600 13px/1.2 var(--sans)}
.glance-reads{margin:8px 0;padding-left:18px}
.sealed-ask{margin:8px 0;font:600 16px/1.35 var(--sans)}
.sealed-rip{margin:12px 0;padding:14px 16px;border-radius:18px;background:#1a1815;border:1px solid #2f2b26}
.sealed-rip h2{margin:0 0 8px;font:600 16px/1.2 var(--sans)}
.sealed-rip dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin:0}
.sealed-rip div{padding:8px 10px;border-radius:14px;background:rgba(255,255,255,.05)}
.sealed-rip dt{font:500 14px/1.3 var(--sans);color:var(--dim)}
.sealed-rip dd{margin:2px 0 0;font:650 16px/1.2 var(--sans)}
.sealed-rip .muted{font-size:14px}
@media (min-width:768px){
  .glance{display:grid;grid-template-columns:220px 1fr;gap:16px;align-items:start}
  .glance img.shot,.glance img.card-face,.glance img.card-face[data-tile="card"]{width:min(200px,100%)}
}
@media (min-width:1100px){
  .glance img.shot,.glance img.card-face,.glance img.card-face[data-tile="card"]{width:min(240px,100%)}
}
.yr{margin:2px 0 14px;max-width:100%}
.yr-line{margin:0 0 9px;font:600 13px/1.25 var(--sans);letter-spacing:-.02em;white-space:nowrap}
.yr-track{position:relative;height:6px;margin:0 9px;border-radius:999px;background:rgba(255,255,255,.10)}
.yr-fill{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:linear-gradient(90deg,rgba(217,183,121,.28),#d9b779)}
.yr-knob{position:absolute;top:50%;width:8px;height:8px;border-radius:50%;background:#f6f1e7;transform:translate(-50%,-50%);pointer-events:none}
@media(max-width:480px){.yr-line{font-size:11px;letter-spacing:-.03em}}
</style>
<div class="glance">
<div class="glance-photo">${img}</div>
<div>
<p class="muted">${setBit} · ${esc(hrefKind)}</p>
<h1>${esc(card.name)}</h1>
${readLink(card)}
${(card.tags || []).length ? `<div class="vchips" aria-label="Variant">${card.tags.map((t) => `<a class="vchip" href="/search?tag=${encodeURIComponent(t)}">${esc(t)}</a>`).join("")}</div>` : ""}
${storeLinksHtml(card, esc)}
${price ? `<p class="px"><span style="font:600 40px/1 var(--serif);color:var(--gold)">${price}</span>${infoTap(`TCGplayer market price${priceDay(endDay) ? `, ${priceDay(endDay).replace(/, \d{4}$/, "")}` : ""}`)}</p>` : ""}
${sealedStrip}
<!--jump-->
<section id="price">${changeHtml}
${priceChart}
${rangeRow}</section>
${opts.itemReadHtml || ""}
${opts.rotationHtml || ""}
${listingsLine || opts.listingsHtml || listChart ? `<section id="supply">${listingsLine ? `<p>${esc(listingsLine)}</p>` : ""}${opts.listingsHtml || ""}${listChart}</section>` : ""}
${ebayAskLine(opts.ebayAsk)}
${ripValueBlock(opts.rip)}
${opts.notMovedHtml || ""}
${itemRankHtml(card)}
${KV_CSS}<section id="stats"><h2>Key stats</h2>
${renderFacts({ market: shown, low: Number(fact?.low) > 0 ? fact.low : (Number(card.low) > 0 ? card.low : null), date: endDay, source: sourceLine(card) })}${released ? `<p class="muted">Released ${esc(released)}</p>` : ""}</section>
${allReadsHtml || (readHtml ? `<section id="reads"><h2>Reads</h2>\n${readHtml}</section>` : "")}
${itemRelatedHtml(card)}
${supplyNote}
</div>
</div>
${checked ? `<p class="muted">${esc(checked)}</p>` : ""}
${breakBits.length ? `<div class="means">${breakBits.join("")}</div>` : ""}
${sealed ? "" : `<p>Artist ${card.artist ? `<a href="/artists/${esc(String(card.artist).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))}">${esc(card.artist)}</a>` : "not matched"} · Number ${esc(card.num || "not in the file")} · Rarity ${esc(card.rarity || "not in the file")}</p>`}
${(card.versions || []).length ? `<p class="muted">Prize pack versions, kept with this card and left out of search.</p><ul>${card.versions.map((v) => `<li>${esc(v.name)} ${money(v.price) || ""}</li>`).join("")}</ul>` : ""}
${opts.diveHref ? `<p><a class="open-data" href="${esc(opts.diveHref)}">Deeper look</a> · <a href="${esc(opts.diveHref)}">See the chart</a> (eBay ask series)</p>` : ""}
<details><summary>See the math</summary>
<p>Condition prices are not in this feed. The market price is one number for the printing we publish.</p>
<p><button type="button" id="paid">Report a price I paid</button></p>
<form id="paid-form" hidden>
<label>Price <input name="price" inputmode="decimal" required></label>
<label>Date <input name="date" type="date" required></label>
<label>Condition <input name="condition" required></label>
<label>Where <input name="where" required></label>
<button type="submit">Send</button>
<p class="muted" id="paid-status"></p>
<p class="muted">A report stays private. A community median shows only after 5 reports of the same product. We do not attach your name. Proof photos are not accepted on this page.</p>
</form>
</details>
<script type="application/json" id="paid-id">${esc(card.id)}</script>
<script>
document.getElementById("paid").addEventListener("click",function(){document.getElementById("paid-form").hidden=false});
document.getElementById("paid-form").addEventListener("submit",function(ev){
  ev.preventDefault();
  var fd=new FormData(ev.currentTarget);
  var status=document.getElementById("paid-status");
  fetch("/api/report",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:document.getElementById("paid-id").textContent,price:fd.get("price"),date:fd.get("date"),condition:fd.get("condition"),where:fd.get("where")})})
    .then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j}})})
    .then(function(res){status.textContent=res.ok?"Saved.":(res.j&&res.j.error)||"Not stored. The server store is not on."})
    .catch(function(){status.textContent="Not stored. The server store is not on."});
});
</script>
</main>`, "<!--jump-->\n");
  return chrome("", body, card.name, stamp, "", feedNav(opts));
}

// Folded groups for long lists. Search opens every group and hides misses.
const FOLD_CSS = `<style>.fold{margin:12px 0;border:1px solid #2f2b26;border-radius:18px;background:#1a1815;overflow:hidden}.fold>summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:52px;padding:0 18px;font:600 19px/1.2 var(--serif)}.fold>summary::-webkit-details-marker{display:none}.fold>summary::after{content:"";width:9px;height:9px;border-right:2px solid var(--gold);border-bottom:2px solid var(--gold);transform:rotate(45deg);margin-left:auto;transition:transform .2s}.fold[open]>summary::after{transform:rotate(-135deg)}.fold-n{font:500 14px/1 var(--sans);margin-left:auto}.fold>.grid{padding:0 14px 14px}</style>`;
const FOLD_JS = `${FOLD_CSS}<script>(function(){var q=document.getElementById("q");var folds=[].slice.call(document.querySelectorAll("details.fold"));var none=document.getElementById("fold-none");var keep=folds.map(function(d){return d.open});function openHash(){var h=location.hash.slice(1);if(!h)return;var d=document.getElementById(h);if(d&&d.tagName==="DETAILS")d.open=true}window.addEventListener("hashchange",openHash);openHash();if(!q)return;q.addEventListener("input",function(){var v=q.value.trim().toLowerCase();var any=false;folds.forEach(function(d,i){var hit=0;d.querySelectorAll("a[data-name]").forEach(function(a){var ok=!v||a.getAttribute("data-name").indexOf(v)>=0;a.hidden=!ok;if(ok)hit++});d.hidden=!!v&&!hit;d.open=v?hit>0:keep[i];if(hit)any=true});if(none)none.hidden=!v||any})})();</script>`;

export function artistGroups(rows) {
  const groups = new Map();
  for (const a of rows) {
    const c = String(a.name || "").trim().charAt(0).toUpperCase();
    const key = /[A-Z]/.test(c) ? c : "#";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a);
  }
  const keys = [...groups.keys()].sort((x, y) => (x === "#") - (y === "#") || x.localeCompare(y));
  return keys.map((k, i) => {
    const list = groups.get(k).slice().sort((x, y) => String(x.name).localeCompare(String(y.name), "en", { sensitivity: "base" }));
    return `<details class="fold" id="artists-${k === "#" ? "other" : k.toLowerCase()}"${i === 0 ? " open" : ""}><summary><span>${k === "#" ? "Other" : k}</span><span class="muted fold-n">${list.length} artists</span></summary><div class="grid">${list.map((a) => `<a class="card" data-name="${esc(String(a.name).toLowerCase())}" href="/artists/${esc(a.slug)}"><b>${esc(a.name)}</b><p class="muted">${a.count} matched cards</p></a>`).join("")}</div></details>`;
  }).join("");
}

export function renderArtists(index, stamp, opts = {}) {
  const rows = index?.artists || [];
  const body = `<main id="main" tabindex="-1" class="wrap"><p class="muted">${esc(index?.note || "")}</p><h1>Artists</h1>
<div class="filters"><input id="q" aria-label="Find an artist" placeholder="Find an artist"></div>
${artistGroups(rows)}
<p class="muted" id="fold-none" hidden>Nothing matches.</p>${FOLD_JS}
</main>`;
  return chrome("Artists", body, "Artists", stamp, "", feedNav(opts));
}

export const ARTIST_SORTS = [
  ["", "Default"],
  ["name-asc", "Name A to Z"],
  ["name-desc", "Name Z to A"],
  ["price-desc", "Price high to low"],
  ["price-asc", "Price low to high"],
  ["release-desc", "Newest set"],
  ["release-asc", "Oldest set"],
];

function cardNumParts(num) {
  const m = String(num || "").match(/^([A-Za-z]*)(\d+)/);
  return m ? [m[1].toLowerCase(), Number(m[2]), String(num)] : ["~", Infinity, String(num || "")];
}

function byCardNum(a, b) {
  const x = cardNumParts(a.num), y = cardNumParts(b.num);
  return x[0].localeCompare(y[0]) || x[1] - y[1] || x[2].localeCompare(y[2]);
}

// Sorts an artist's cards. Unknown or empty sort keeps the published order.
// Price is TCGplayer market; unpriced cards always go last. Release is the
// set release date, then card number; cards with no release date go last.
export function sortArtistCards(cards, sort = "", releaseBySlug = {}) {
  const list = (cards || []).map((c, i) => ({ c, i }));
  const priced = (c) => Number(c.price) > 0;
  const rel = (c) => (releaseBySlug.__strict ? releaseBySlug[c.setSlug] : c.release || releaseBySlug[c.setSlug]) || "";
  const name = (a, b) => String(a.c.name || "").localeCompare(String(b.c.name || ""), "en", { sensitivity: "base" }) || a.i - b.i;
  const cmp = {
    "name-asc": name,
    "name-desc": (a, b) => -name(a, b) || a.i - b.i,
    "price-desc": (a, b) => (priced(b.c) - priced(a.c)) || (priced(a.c) ? Number(b.c.price) - Number(a.c.price) : 0) || a.i - b.i,
    "price-asc": (a, b) => (priced(b.c) - priced(a.c)) || (priced(a.c) ? Number(a.c.price) - Number(b.c.price) : 0) || a.i - b.i,
    "release-desc": (a, b) => (!!rel(b.c) - !!rel(a.c)) || rel(b.c).localeCompare(rel(a.c)) || String(a.c.setSlug || "").localeCompare(String(b.c.setSlug || "")) || byCardNum(a.c, b.c) || a.i - b.i,
    "release-asc": (a, b) => (!!rel(b.c) - !!rel(a.c)) || rel(a.c).localeCompare(rel(b.c)) || String(a.c.setSlug || "").localeCompare(String(b.c.setSlug || "")) || byCardNum(a.c, b.c) || a.i - b.i,
  }[sort];
  if (!cmp) return list.map((x) => x.c);
  return list.sort(cmp).map((x) => x.c);
}

export function renderArtist(doc, stamp, opts = {}) {
  if (!doc) return chrome("Artists", `<main id="main" tabindex="-1" class="wrap"><h1>Artist not found</h1><p class="muted">That artist is not in the file.</p></main>`, "Artist", stamp, "", feedNav(opts));
  const sort = ARTIST_SORTS.some(([k]) => k && k === opts.sort) ? opts.sort : "";
  const cards = sortArtistCards(doc.cards || [], sort, opts.releaseBySlug || {});
  const top = cards.slice(0, 12);
  const rest = cards.slice(12);
  const row = (c) => `<div class="row" data-quick="${esc(c.id)}">${imageTag(c.catalogueSrc || "", c.kind === "sealed" ? "sealed" : "row", c.name || "", c)}<a data-quick="${esc(c.id)}" href="/c/${esc(c.id)}"><b>${esc(c.name)}</b><br><span class="muted">${esc(c.set)} ${esc(c.num || "")}</span></a>${money(c.price) ? `<b>${money(c.price)}</b>` : ""}</div>`;
  const base = `/artists/${encodeURIComponent(doc.slug || "")}`;
  const chips = ARTIST_SORTS.map(([k, label]) => `<a class="sort-chip" href="${esc(k ? `${base}?sort=${k}` : base)}" data-sort="${esc(k)}" aria-pressed="${k === sort ? "true" : "false"}"${k === sort ? ` aria-current="true"` : ""}>${esc(label)}</a>`).join("");
  const unpriced = cards.filter((c) => !(Number(c.price) > 0)).length;
  const relMap = opts.releaseBySlug || {};
  const undated = cards.filter((c) => !(relMap.__strict ? relMap[c.setSlug] : c.release || relMap[c.setSlug])).length;
  const caption = `Artist index, chain-linked${Number(doc.indexCards) > 0 ? `. ${Number(doc.indexCards)} of ${cards.length} cards` : ""}`;
  const body = `<main id="main" tabindex="-1" class="wrap"><h1>${esc(doc.name)}</h1>
${chartBox(doc.index || [], caption)}
${doc.indexNote ? `<p class="muted">${esc(doc.indexNote)}</p>` : ""}
<p class="muted">${esc(doc.source || "")}</p>
<nav class="filters sort-chips" aria-label="Sort cards">${chips}</nav>
<script>(function(){var n=document.querySelector(".sort-chips"),a=n&&n.querySelector('[aria-pressed="true"]');if(n&&a&&n.scrollWidth>n.clientWidth)n.scrollLeft=Math.max(0,a.offsetLeft-n.offsetLeft-16);})();</script>
${sort.startsWith("price") && unpriced ? `<p class="muted">${unpriced} cards with no market price are listed last.</p>` : ""}
${sort.startsWith("release") && undated ? `<p class="muted">${undated} cards from sets with no release date on file are listed last.</p>` : ""}
<div id="artist-cards">
${cards.length ? top.map(row).join("") : `<p class="muted">No cards matched to this artist.</p>`}
${rest.length ? `<details><summary>Show all ${cards.length}</summary>${rest.map(row).join("")}</details>` : ""}
</div>
</main>`;
  return chrome("Artists", body, doc.name, stamp, "", feedNav(opts));
}

export function renderMovers(doc, stamp, opts = {}) {
  const spark = (hist) => {
    const pts = (hist || []).map((p) => Number(Array.isArray(p) ? p[1] : p?.v)).filter((n) => n > 0);
    if (pts.length < 2) return "";
    const w = 96, h = 36, min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1;
    const step = (w - 8) / (pts.length - 1);
    const d = pts.map((v, i) => `${i ? "L" : "M"}${(4 + i * step).toFixed(1)},${(h - 4 - ((v - min) / span) * (h - 8)).toFixed(1)}`).join(" ");
    return `<svg width="96" height="36" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" fill="none" stroke="#d9b779" stroke-width="2"/></svg>`;
  };
  const row = (r, withSpark) => {
    const pct = Number.isFinite(r.changePct) ? `${r.changePct > 0 ? "+" : ""}${r.changePct}%` : "";
    const face = imageTag(r.catalogueSrc || "", "row", r.name || "", r);
    const line = withSpark ? spark(r.hist) : "";
    return `<div class="row mover">${face}<a href="${esc(r.href)}"><b>${esc(r.name)}</b><span class="muted">${esc(r.set || "")}</span>${line}</a><b class="mover-stat">${money(r.price) || "—"} <span class="muted">${pct}</span></b></div>`;
  };
  const block = (title, rows) => `<h2>${title}</h2>${(rows || []).slice(0, 12).map((r) => row(r, true)).join("") || `<p class="muted">Nothing to show.</p>`}${(rows || []).length > 12 ? `<details><summary>Show more</summary>${(rows || []).slice(12).map((r) => row(r, false)).join("")}</details>` : ""}`;
  const body = `<main id="main" tabindex="-1" class="wrap"><p class="muted">Updated ${esc(doc?.asOf || "")}. ${esc(doc?.note || "")}</p>
<h1>Movers</h1>
<div id="index-charts"></div>
<div class="filters"><button type="button" data-tab="singles" aria-pressed="true">Singles</button><button type="button" data-tab="sealed">Sealed</button><button type="button" data-tab="slabs">Slabs</button></div>
<div id="singles">${block("Rising", doc?.singlesRising || doc?.singles)}${block("Falling", doc?.singlesFalling)}</div>
<div id="sealed" hidden>${block("Rising", doc?.sealedRising)}${block("Falling", doc?.sealedFalling)}</div>
<div id="slabs" hidden><h2>Slabs</h2><p class="muted">Hidden until a graded feed exists. Slabs are not mixed into the singles or sealed lists.</p></div>
<script>
document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{["singles","sealed","slabs"].forEach(id=>{document.getElementById(id).hidden=id!==b.dataset.tab});document.querySelectorAll("[data-tab]").forEach(x=>x.setAttribute("aria-pressed", x===b?"true":"false"))}));
fetch("/data/indexes.json").then(r=>r.json()).then(idx=>{
  const box=document.getElementById("index-charts");
  box.innerHTML='<div class="chart-box"><div class="chart" id="m-single" data-caption="Singles index, chain-linked. TCGplayer market, daily" style="height:180px;min-height:180px"></div><div class="filters" data-ranges><button type="button" data-range="All" aria-pressed="true">All</button></div><p class="chart-note muted"></p></div>';
  document.getElementById("m-single").setAttribute("data-chart", JSON.stringify(idx.singles||[]));
  if(typeof catchemMount==="function") catchemMount(box);
}).catch(()=>{});
</script>
</main>`;
  return chrome("Movers", body, "Movers", stamp, "", feedNav(opts));
}

export function todayStrip(doc) {
  const lines = Array.isArray(doc?.lines) ? doc.lines : [];
  const take = (slot) => lines.find((row) => row && row.slot === slot && String(row.text || "").trim());
  const cards = [
    ["Biggest move", take("mover")],
    ["Pattern", take("fact")],
    doc?.supply === "on" ? ["Listings counted", take("supply")] : null,
  ].filter((row) => row && row[1]);
  if (!cards.length) return "";
  const asOf = /^\d{4}-\d{2}-\d{2}$/.test(String(doc?.asOf || "")) ? String(doc.asOf) : "";
  const items = cards.map(([label, row]) => {
    const body = row.href ? `<a href="${esc(row.href)}">${esc(row.text)}</a>` : esc(row.text);
    return `<article><b>${esc(label)}</b><p>${body}</p></article>`;
  }).join("");
  return `<section class="today-strip" aria-label="Today"><style>.today-strip{max-width:1040px;margin:0 auto;padding:8px 16px 24px}.today-strip h2{margin:0 0 10px;font:600 22px/1.2 Georgia,serif}.today-cards{display:grid;gap:10px}.today-cards article{padding:14px 16px;border-radius:18px;background:#1a1815;border:1px solid #2f2b26}.today-cards a{color:inherit;text-decoration:none}.today-cards b{display:block;margin-bottom:6px;color:#d9b779}@media(min-width:800px){.today-cards{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}}</style><h2>Today${asOf ? ` · ${esc(asOf)}` : ""}</h2><div class="today-cards">${items}</div></section>`;
}

// Phone-first hero add-on: three short "what you get" lines and tonight's live read.
export function heroToday(doc) {
  const lines = Array.isArray(doc?.lines) ? doc.lines : [];
  const row = lines.find((r) => r && r.slot === "mover" && String(r.text || "").trim() && /^\/(c|p)\//.test(String(r.href || "")))
    || lines.find((r) => r && r.slot === "fact" && String(r.text || "").trim() && /^\//.test(String(r.href || "")));
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(doc?.asOf || "")) ? String(doc.asOf) : "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const when = day ? `${months[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8, 10))}` : "";
  const text = String(row?.text || "").trim();
  if (/[\u2014\u2013]/.test(text)) return "";
  const live = row ? `<a class="hx-read" href="${esc(row.href)}"><span class="hx-tag">Latest read${when ? `, ${esc(when)}` : ""}</span><span class="hx-text">${esc(text)}</span><span class="hx-go">Open the data</span></a>` : "";
  return `<style>.hx{display:grid;gap:12px;margin:18px 0 0}.hx-get{list-style:none;margin:0;padding:0;display:grid;gap:6px;font:500 15px/1.4 var(--sans)}.hx-get li{display:flex;gap:10px;align-items:flex-start}.hx-get li::before{content:"";flex:0 0 8px;height:8px;margin-top:7px;border-radius:999px;background:var(--gold,#d9b779)}.hx-read{display:grid;gap:6px;padding:14px 16px;border-radius:18px;background:#1a1815;border:1px solid #2f2b26;color:inherit;text-decoration:none}.hx-tag{font:600 12px/1.2 var(--sans);letter-spacing:.06em;text-transform:uppercase;color:var(--gold,#d9b779)}.hx-text{font:500 15px/1.45 var(--sans)}.hx-go{min-height:44px;display:inline-flex;align-items:center;font:600 15px/1 var(--sans);color:var(--gold,#d9b779)}@media(max-width:700px){.hero{padding:20px 0 28px!important;gap:12px!important}.hero .mark{display:none}.hero .kicker{margin-top:0}}</style><div class="hx" id="hero-today"><ul class="hx-get" aria-label="What you get"><li>Daily reads on every card and sealed product</li><li>Price charts and listings counted, each with its date</li><li>Free to use, no account needed</li></ul>${live}</div>`;
}

export function renderToday(doc, stamp, opts = {}) {
  const labels = { mover: "Biggest move", high: "6-month high", fact: "Fact", news: "News", supply: "Listings" };
  const lines = (doc?.lines || []).map((line) => {
    const label = labels[line.slot] || line.slot;
    const body = line.href ? `<a href="${esc(line.href)}">${esc(line.text)}</a>` : esc(line.text);
    const note = line.note ? `<p class="muted">${esc(line.note)}</p>` : "";
    return `<li><b>${esc(label)}</b><p>${body}</p>${note}</li>`;
  }).join("");
  const supply = doc?.supply === "on" ? "" : `<p>The listings line is off.</p>`;
  const payload = JSON.stringify((doc?.lines || []).map((line) => ({ text: line.text }))).replace(/</g, "\\u003c");
  const body = `<main id="main" tabindex="-1" class="wrap">
<h1>Today</h1>
<p class="muted">${esc(doc?.asOf || "")}</p>
${supply}
<ol class="today-lines">${lines}</ol>
<p><button type="button" id="share-card">Share card</button></p>
<p class="muted" id="share-note"></p>
<script type="application/json" id="today-lines">${payload}</script>
<script type="application/json" id="today-date">${esc(doc?.asOf || "")}</script>
<script>
document.getElementById("share-card").addEventListener("click", function(){
  var lines=JSON.parse(document.getElementById("today-lines").textContent);
  var canvas=document.createElement("canvas");
  canvas.width=1080; canvas.height=1350;
  var pen=canvas.getContext("2d");
  pen.fillStyle="#12100e"; pen.fillRect(0,0,1080,1350);
  pen.fillStyle="#d9b779"; pen.font="700 72px Georgia, serif"; pen.fillText("Catch'em", 72, 150);
  pen.fillStyle="#efe9de"; pen.font="36px Georgia, serif";
  var y=280;
  function wrap(text, max){
    var words=String(text||"").split(" ");
    var out=[];
    var cur="";
    words.forEach(function(word){
      if(!cur){ cur=word; return; }
      if((cur+" "+word).length<=max) cur=cur+" "+word;
      else { out.push(cur); cur=word; }
    });
    if(cur) out.push(cur);
    return out;
  }
  lines.forEach(function(line){
    wrap(line.text, 42).forEach(function(row){
      if(y<1180){ pen.fillText(row, 72, y); y+=52; }
    });
    y+=28;
  });
  pen.fillStyle="#c4baab"; pen.font="28px Georgia, serif";
  pen.fillText(document.getElementById("today-date").textContent, 72, 1260);
  var link=document.createElement("a");
  link.href=canvas.toDataURL("image/png");
  link.download="catchem-today.png";
  link.click();
  document.getElementById("share-note").textContent="Card saved on this device.";
});
</script>
</main>`;
  return chrome("", body, "Today", stamp, "", feedNav(opts));
}

const KV_CSS = `<style>.kv{margin:8px 0 16px;padding:4px 16px;border-radius:18px;background:#1a1815;border:1px solid #2f2b26}.kv div{display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.06)}.kv div:last-child{border-bottom:0}.kv dt{color:var(--dim);font:500 14px/1.3 var(--sans)}.kv dd{margin:0;font:600 14px/1.3 var(--sans);text-align:right}.glance-reads{list-style:none;padding:0!important;display:grid;gap:8px}.glance-reads li{padding:12px 14px;border-radius:16px;background:#1a1815;border:1px solid #2f2b26}</style>`;

export function factsLines(row) {
  const lines = [];
  if (Number(row?.market) > 0) lines.push({ label: "Market", value: money(row.market) });
  if (Number(row?.low) > 0) lines.push({ label: "Low", value: money(row.low) });
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(row?.date || ""))) lines.push({ label: "Date", value: String(row.date).slice(0, 10) });
  if (typeof row?.source === "string" && row.source.trim()) lines.push({ label: "Source", value: row.source.trim() });
  return lines;
}

export function renderFacts(row) {
  const lines = factsLines(row);
  if (!lines.length) return "";
  return `<dl class="kv">${lines.map((line) => `<div><dt>${esc(line.label)}</dt><dd>${esc(line.value)}</dd></div>`).join("")}</dl>`;
}

export function compareRows(left, right) {
  const fields = [
    ["Market", "market", "number"],
    ["Low", "low", "number"],
    ["Date", "date", "date"],
    ["Source", "source", "text"],
  ];
  const ok = (value, kind) => kind === "number" ? Number(value) > 0 : kind === "date" ? /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) : typeof value === "string" && value.trim().length > 0;
  const rows = [];
  for (const [label, key, kind] of fields) {
    if (!ok(left?.[key], kind) || !ok(right?.[key], kind)) continue;
    const show = (value, kind) => kind === "number" ? (money(value) || "") : String(value);
    rows.push({ label, left: show(left[key], kind), right: show(right[key], kind) });
  }
  return rows;
}

const CMP_COLORS = ["#d9b779", "#7fc79a", "#8eb4e8", "#e09a7a"];
const CMP_RANGES = [["1M", 31], ["3M", 92], ["6M", 183], ["1Y", 366], ["All", 0]];

function cmpPoints(raw) {
  const out = [];
  for (const point of raw || []) {
    const day = Array.isArray(point) ? String(point[0] || "") : "";
    const price = Number(Array.isArray(point) ? point[1] : 0);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !(price > 0)) continue;
    if (out.length && out[out.length - 1][0] === day) out[out.length - 1][1] = price;
    else out.push([day, price]);
  }
  out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return out;
}

function cmpSafeSrc(src) {
  const s = String(src || "");
  if (/^\/(?!\/)/.test(s) && !/["'<>\s]/.test(s)) return s;
  if (/^https:\/\//.test(s) && !/["'<>\s]/.test(s)) return s;
  return "";
}

function cmpInWindow(points, days, endMs) {
  let n = 0;
  for (const point of points) {
    if (!days || Date.parse(`${point[0]}T00:00:00Z`) >= endMs - days * 86400000) n += 1;
  }
  return n;
}

function compareChart(series) {
  const rows = (series || []).map((row) => ({ ...row, points: cmpPoints(row?.points) })).filter((row) => row.points.length >= 2).slice(0, 4);
  if (rows.length < 2) return "";
  let endMs = 0;
  for (const row of rows) {
    const t = Date.parse(`${row.points[row.points.length - 1][0]}T00:00:00Z`);
    if (t > endMs) endMs = t;
  }
  const pills = CMP_RANGES.filter(([, days]) => rows.some((row) => cmpInWindow(row.points, days, endMs) >= 2));
  const buttons = pills.map(([label, days], i) => `<button type="button" data-cmp="${days}" aria-pressed="${i === pills.length - 1 ? "true" : "false"}">${label}</button>`).join("");
  const legs = rows.map((row, i) => {
    const href = /^tcgcsv-\d+$/.test(String(row.id || "")) ? (row.kind === "sealed" ? `/p/${row.id}` : `/c/${row.id}`) : "";
    const thumb = cmpSafeSrc(row.thumb);
    const img = thumb ? `<img alt="" width="28" height="36" src="${esc(thumb)}">` : "";
    const name = esc(row.name || "Product");
    const inner = `<i class="cmp-swatch" style="background:${CMP_COLORS[i]}"></i>${img}<span>${name}</span>`;
    return href ? `<a class="cmp-leg" href="${href}">${inner}</a>` : `<span class="cmp-leg">${inner}</span>`;
  }).join("");
  const payload = JSON.stringify(rows.map((row) => row.points)).replace(/</g, "\\u003c");
  return `<section class="cmp" aria-label="Price lines">
<div class="cmp-legs">${legs}</div>
<div class="chart cmp-plot" id="cmp-plot"></div>
<div class="cmp-ranges">${buttons}</div>
<script type="application/json" id="cmp-series">${payload}</script>
<script>${CMP_JS}</script>
</section>`;
}

const CMP_JS = `(function(){
var host=document.getElementById("cmp-plot");
var raw=document.getElementById("cmp-series");
if(!host||!raw) return;
var series=[];
try{ series=JSON.parse(raw.textContent)||[]; }catch(e){ series=[]; }
var colors=["#d9b779","#7fc79a","#8eb4e8","#e09a7a"];
var DAY=86400000;
function ms(d){return Date.parse(d+"T00:00:00Z");}
function iso(t){return new Date(t).toISOString().slice(0,10);}
function fill(pts){
  var out=[];
  for(var i=0;i<pts.length;i++){
    var p=pts[i];
    if(!p||!(Number(p[1])>0)) continue;
    var last=out.length?out[out.length-1]:null;
    if(last){
      var real=last[3]||last[0];
      for(var t=ms(last[0])+DAY;t<ms(p[0]);t+=DAY) out.push([iso(t),last[1],1,real]);
    }
    out.push([p[0],Number(p[1]),0,""]);
  }
  return out;
}
var lines=[];
for(var i=0;i<series.length&&lines.length<4;i++){
  var pts=fill(series[i]||[]);
  if(pts.length>=2) lines.push({color:colors[lines.length],pts:pts});
}
if(lines.length<2) return;
var latest=0;
for(var j=0;j<lines.length;j++){ var end=ms(lines[j].pts[lines[j].pts.length-1][0]); if(end>latest) latest=end; }
function draw(days){
  var sets=lines.map(function(s){ return days?s.pts.filter(function(p){return ms(p[0])>=latest-days*DAY;}):s.pts; });
  var flat=[];
  for(var a=0;a<sets.length;a++) if(sets[a].length>=2) for(var b=0;b<sets[a].length;b++) flat.push(sets[a][b]);
  if(flat.length<2){ host.textContent=""; return; }
  var min=flat[0][1],max=flat[0][1],t0=ms(flat[0][0]),t1=t0;
  for(var c=0;c<flat.length;c++){
    if(flat[c][1]<min) min=flat[c][1];
    if(flat[c][1]>max) max=flat[c][1];
    var tt=ms(flat[c][0]);
    if(tt<t0) t0=tt;
    if(tt>t1) t1=tt;
  }
  var span=(max-min)||(max*0.04)||0.01;
  var lo=min-span*0.08, hi=max+span*0.08, plot=(hi-lo)||1;
  var w=640,h=220;
  function x(t){ return t1===t0?48:48+((t-t0)/(t1-t0))*(w-64); }
  function y(v){ return 18+((hi-v)/plot)*(h-40); }
  function money(n){ return "$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}); }
  var paths="";
  for(var s=0;s<sets.length;s++){
    if(sets[s].length<2) continue;
    var d="";
    for(var k=0;k<sets[s].length;k++) d+=(k?"L":"M")+x(ms(sets[s][k][0])).toFixed(1)+","+y(sets[s][k][1]).toFixed(1);
    paths+='<path d="'+d+'" fill="none" stroke="'+lines[s].color+'" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>';
  }
  host.innerHTML='<svg viewBox="0 0 '+w+' '+h+'" width="100%" height="'+h+'" role="img" aria-label="Price lines"><text x="8" y="16" fill="#efe9de" font-size="12">'+money(max)+'</text><text x="8" y="'+(h-10)+'" fill="#efe9de" font-size="12">'+money(min)+'</text>'+paths+'</svg>';
}
var buttons=document.querySelectorAll("[data-cmp]");
for(var n=0;n<buttons.length;n++){
  buttons[n].addEventListener("click",function(ev){
    var btn=ev.currentTarget;
    for(var m=0;m<buttons.length;m++) buttons[m].setAttribute("aria-pressed","false");
    btn.setAttribute("aria-pressed","true");
    draw(Number(btn.getAttribute("data-cmp"))||0);
  });
}
draw(0);
})();`;

export function renderCompare(left, right, stamp, opts = {}) {
  const ids = Array.isArray(opts.ids) ? opts.ids : [];
  const packed = [left, right, opts.third || null, opts.fourth || null];
  const slots = [];
  for (let i = 0; i < packed.length; i++) {
    const id = String(ids[i] || "");
    if (!id) continue;
    const row = packed[i];
    slots.push(row && row.name ? row : { id, missing: true, name: "" });
  }
  const fields = [
    ["Market", "market", "number"],
    ["Low", "low", "number"],
    ["Date", "date", "date"],
    ["Source", "source", "text"],
  ];
  const has = (row, key, kind) => kind === "number" ? Number(row?.[key]) > 0 : kind === "date" ? /^\d{4}-\d{2}-\d{2}$/.test(String(row?.[key] || "")) : typeof row?.[key] === "string" && row[key].trim().length > 0;
  const show = (row, key, kind) => has(row, key, kind) ? (kind === "number" ? (money(row[key]) || "") : String(row[key])) : "";
  const bodyRows = fields.filter(([, key, kind]) => slots.filter((row) => has(row, key, kind)).length >= 2).map(([label, key, kind]) => `<tr><th>${label}</th>${slots.map((row) => `<td>${esc(show(row, key, kind))}</td>`).join("")}</tr>`).join("");
  const heads = slots.map((row) => {
    const href = !row.missing && /^tcgcsv-\d+$/.test(String(row.id || "")) ? (row.kind === "sealed" ? `/p/${row.id}` : `/c/${row.id}`) : "";
    const name = esc(row.name || "Not in the catalog");
    return `<th>${href ? `<a href="${href}">${name}</a>` : name}</th>`;
  }).join("");
  const table = slots.length >= 2 ? `<div class="cmp-table-wrap"><table class="cmp-table"><thead><tr><th></th>${heads}</tr></thead><tbody>${bodyRows}</tbody></table></div>` : `<p class="muted">Add two product ids.</p>`;
  const chart = compareChart(opts.charts);
  const field = (name, label) => `<label>${label} <input name="${name}" value="${esc(opts[name] || "")}" aria-label="${label} product"></label>`;
  const body = `<main id="main" tabindex="-1" class="wrap">
<style>
.cmp-form{display:grid;gap:8px;margin:12px 0}
.cmp-form label{display:flex;flex-direction:column;gap:4px;font-size:13px}
.cmp-form input,.cmp-form button{min-height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:#1a1815;color:inherit;padding:0 12px;font:inherit}
.cmp-form button{background:#d9b779;color:#1a1407;font-weight:650}
.cmp-legs{display:flex;flex-direction:column;gap:8px;margin:12px 0}
.cmp-leg{display:flex;align-items:center;gap:8px;min-height:44px;padding:4px 12px 4px 8px;border-radius:999px;background:rgba(255,255,255,.05);color:inherit;text-decoration:none;font:600 14px/1.2 var(--sans)}
.cmp-swatch{width:10px;height:10px;border-radius:999px;flex:none}
.cmp-leg img{width:28px;height:36px;object-fit:contain;border-radius:6px;background:#12100e}
.cmp-ranges{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}
.cmp-ranges button{min-height:44px;min-width:44px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:transparent;color:inherit;font:600 13px/1 var(--sans)}
.cmp-ranges button[aria-pressed="true"]{background:rgba(217,183,121,.18);color:#d9b779}
.cmp-plot{border-radius:16px}
.cmp-table-wrap{overflow-x:auto;margin:12px 0}
.cmp-table{width:100%;border-collapse:collapse}
.cmp-table th,.cmp-table td{text-align:left;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.08);white-space:nowrap}
@media(min-width:800px){
  .cmp-form{grid-template-columns:1fr 1fr}
  .cmp-legs{flex-direction:row;flex-wrap:wrap}
}
</style>
<h1>Compare two products</h1>
<form class="cmp-form" method="get" action="/compare">
${field("a", "First")}
${field("b", "Second")}
${field("c", "Third")}
${field("d", "Fourth")}
<button type="submit">Show</button>
</form>
${chart}
${table}
<p class="muted">A missing number is left off.</p>
</main>`;
  return chrome("Compare", body, "Compare", stamp, "", feedNav(opts));
}

export function renderTrackRecord(doc, stamp, opts = {}) {
  const rows = [...(Array.isArray(doc?.rows) ? doc.rows : [])].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(a.name || "").localeCompare(String(b.name || "")));
  const windows = doc?.windows || {};
  const money2 = (n) => Number(n) > 0 ? `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    return m ? `${months[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}` : "";
  };
  const mark = (row) => row.moved === true ? `<p class="tr-hit">Moved the way the read described</p>` : row.moved === false ? `<p class="tr-miss">Moved the other way</p>` : `<p class="muted">Still open</p>`;
  const cards = rows.map((row) => `<article class="tr-row" data-kind="${esc(row.kind || "")}" data-date="${esc(row.date || "")}" data-moved="${row.moved === true ? "1" : row.moved === false ? "0" : ""}">
<p class="muted">${esc(day(row.date))}</p>
<h2>${esc(row.name || "")}</h2>
<p>${esc(row.said || "")}</p>
<p>${esc(money2(row.priceThen))} then. ${esc(money2(row.priceNow))} now.</p>
<p class="muted">${esc(row.source || "")}${row.priceDate ? `, ${esc(day(row.priceDate))}` : ""}</p>
${mark(row)}
</article>`).join("");
  const line = windows.d90?.line || doc?.summary || "";
  const thin = doc?.thin !== false;
  const body = `<main id="main" tabindex="-1" class="wrap tr-page">
<style>
.tr-page h1{margin:8px 0 6px}
.tr-note{color:#8f877a;font-size:13px;margin:0 0 12px}
.tr-sum{background:#16140f;border:1px solid #2a261f;border-radius:20px;padding:18px;margin:0 0 14px}
.tr-sum p{margin:0}
.tr-sum .tr-line{font:600 20px/1.35 var(--serif)}
.tr-chips{display:flex;gap:8px;overflow-x:auto;padding:2px 0 12px;scrollbar-width:none}
.tr-chips button{flex:none;min-height:44px;padding:0 16px;border-radius:999px;border:1px solid #2f2b26;background:#16140f;color:#efe9de;font:600 14px/1 var(--sans)}
.tr-chips button[aria-pressed="true"]{background:#d9b779;color:#1a1407;border-color:#d9b779}
.tr-row{background:#16140f;border:1px solid #24211c;border-radius:16px;padding:14px 16px;margin:0 0 10px}
.tr-row h2{margin:2px 0 8px;font:600 18px/1.3 var(--serif)}
.tr-row p{margin:0 0 6px}
.tr-hit{color:#7fc79a;font-weight:600}
.tr-miss{color:#e0877a;font-weight:600}
</style>
<h1>Track record</h1>
<p class="tr-note">${esc(doc?.disclaimer || "Past moves don't predict future prices.")}</p>
<section class="tr-sum" aria-live="polite">
<p class="tr-line" id="tr-line">${esc(line || "More history added nightly")}</p>
${thin ? `<p class="tr-note" id="tr-thin">More history added nightly</p>` : ""}
</section>
<div class="tr-chips" role="group" aria-label="Filter">${[["sealed", "Sealed"], ["single", "Singles"], ["30", "30d"], ["90", "90d"]].map(([k, label]) => `<button type="button" data-tr="${k}" aria-pressed="${k === "90" ? "true" : "false"}">${label}</button>`).join("")}</div>
<div id="tr-rows">${cards}</div>
<script type="application/json" id="tr-windows">${JSON.stringify(windows).replace(/</g, "\\u003c")}</script>
<script>(function(){
  var rows=[].slice.call(document.querySelectorAll(".tr-row"));
  var line=document.getElementById("tr-line");
  var wins={};
  try{ wins=JSON.parse(document.getElementById("tr-windows").textContent||"{}"); }catch(e){ wins={}; }
  var asOf=${JSON.stringify(String(doc?.asOf || ""))};
  function on(k){ var b=document.querySelector('[data-tr="'+k+'"]'); return !!(b && b.getAttribute("aria-pressed")==="true"); }
  function age(iso){ if(!asOf||!iso) return 0; return Math.round((Date.parse(asOf+"T00:00:00Z")-Date.parse(iso+"T00:00:00Z"))/86400000); }
  function paint(){
    var sealed=on("sealed"), single=on("single"), d30=on("30"), d90=on("90")||!on("30");
    var days=d30&&!d90?30:90;
    var shown=0;
    rows.forEach(function(row){
      var kind=row.getAttribute("data-kind");
      var kindOk=(!sealed&&!single)||(sealed&&kind==="sealed")||(single&&kind==="single");
      var dayOk=age(row.getAttribute("data-date"))<=days;
      var ok=kindOk&&dayOk;
      row.hidden=!ok;
      if(ok) shown++;
    });
    var key=(sealed&&!single?"sealed":!sealed&&single?"single":"")+(days===30?"30":"90");
    if(key==="30") key="d30"; else if(key==="90") key="d90"; else if(key==="sealed30"||key==="sealed90"||key==="single30"||key==="single90") {}
    var bag=wins[key]||{};
    line.textContent=bag.line||(shown?"More history added nightly":"More history added nightly");
  }
  document.querySelectorAll("[data-tr]").forEach(function(btn){
    btn.addEventListener("click", function(){
      var k=btn.getAttribute("data-tr");
      if(k==="30"||k==="90"){
        document.querySelector('[data-tr="30"]').setAttribute("aria-pressed", k==="30"?"true":"false");
        document.querySelector('[data-tr="90"]').setAttribute("aria-pressed", k==="90"?"true":"false");
      }else btn.setAttribute("aria-pressed", btn.getAttribute("aria-pressed")==="true"?"false":"true");
      paint();
    });
  });
  paint();
})();</script>
</main>`;
  return chrome("Track record", body, "Track record", stamp, "", feedNav(opts));
}

export function renderReceipts(doc, stamp, opts = {}) {
  const rows = doc?.rows || [];
const mark = (r) => {
    const v = String(r.result || "open").toLowerCase();
    return v === "hit" ? "Hit" : v === "miss" ? "Miss" : "Open";
  };
  const body = `<main id="main" tabindex="-1" class="wrap"><p class="muted" id="fresh">Updated ${esc(doc?.asOf || "")}</p><h1>Receipts</h1>
<p>${esc(doc?.note || "")}</p>
<p class="muted">Scored calls: ${Number(doc?.scored) || 0}. Hit rate: ${doc?.hitRate == null ? "not shown until 20 calls are scored" : esc(String(doc.hitRate))}</p>
${chartBox(doc?.series || [], "TCGplayer market")}
${rows.map((r) => `<article class="card" style="margin:10px 0"><p class="muted">${mark(r)}</p><h2>${esc(r.headline)}</h2><p>${money(r.price) || "No price"} · ${esc(r.source || "")}</p>${chartBox(r.hist || [], r.source || "TCGplayer market")}</article>`).join("") || `<p class="muted">No scored calls yet.</p>`}
</main>`;
  return chrome("", body, "Receipts", stamp, "", feedNav(opts));
}

export function statusLights(status) {
  const steps = Array.isArray(status?.steps) ? status.steps : [];
  const pick = (name) => steps.find((row) => row && row.name === name && row.file);
  const tone = (row) => {
    const result = String(row?.result || "");
    if (/file is present|failed is 0/.test(result)) return "ok";
    if (!result) return "";
    return "wait";
  };
  const when = (row) => {
    const detail = String(row?.detail || "").trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(detail)) return detail.replace("T", " ").slice(0, 16);
    return detail;
  };
  const specs = [
    ["Prices", pick("TCGCSV day")],
    ["Listings counted", pick("eBay sealed prices")],
    ["Reads", pick("Reads")],
  ];
  const bits = [];
  for (const [label, row] of specs) {
    if (!row) continue;
    const state = tone(row);
    if (!state) continue;
    const day = when(row);
    bits.push(`<li class="light ${state}"><b>${esc(label)}</b>${day ? `<span>${esc(day)}</span>` : ""}</li>`);
  }
  return bits.length ? `<ul class="lights" aria-label="Feed status">${bits.join("")}</ul>` : "";
}

export function renderStatus(doc, stamp, opts = {}) {
  const status = doc?.status;
  const sources = doc?.sources;
  const gap = doc?.gap;
  const errors = Array.isArray(doc?.errors) ? doc.errors : [];
  if (!status) {
    const body = `<main id="main" tabindex="-1" class="wrap"><h1>Status</h1><p class="muted">The status file is not in the public feed.</p></main>`;
    return chrome("", body, "Status", stamp, "", feedNav(opts));
  }
  const steps = (status.steps || []).map((row) => `<li><b>${esc(row.name)}</b>: ${esc(row.result || "not in the files")}${row.detail ? ` (${esc(row.detail)})` : ""}. <span class="muted">${esc(row.file || "")}</span></li>`).join("");
  const missing = (status.missingDays || []).map((day) => esc(day)).join(", ");
  const counts = status.counts || {};
  const countBits = ["items", "single", "sealed", "slab", "sets", "priced", "artists"].filter((key) => Number.isFinite(Number(counts[key]))).map((key) => `${key} ${Number(counts[key]).toLocaleString("en-US")}`).join(" · ");
  const ebayAt = status.ebayUpdatedAt ? esc(status.ebayUpdatedAt) : "";
  const ebayMs = Date.parse(status.ebayUpdatedAt || "");
  const ebayAge = Number.isFinite(ebayMs) ? `${Math.round(((Date.now() - ebayMs) / 3600000) * 10) / 10} hours` : "";
  const files = (sources?.files || []).map((row) => `<li><b>${esc(row.file)}</b> · ${esc((row.readers || []).join(", ") || "no reader")}${row.asOf ? ` · ${esc(row.asOf)}` : ""}${row.live ? "" : " · not a nightly price file"}${row.note ? ` · ${esc(row.note)}` : ""}</li>`).join("");
  const types = (gap?.byType || []).map((row) => `${esc(row.type)} ${Number(row.lose).toLocaleString("en-US")}`).join(" · ");
  const err = errors.length
    ? `<ol>${errors.map((row) => `<li>${esc(row.message)} <span class="muted">${Number(row.count) || 0}</span></li>`).join("")}</ol>`
    : `<p class="muted">No client errors stored on this server yet.</p>`;
  const body = `<main id="main" tabindex="-1" class="wrap">
<style>.lights{list-style:none;display:flex;flex-wrap:wrap;gap:8px;margin:12px 0;padding:0}.lights li{display:flex;flex-direction:column;gap:2px;min-width:140px;min-height:44px;padding:10px 12px;border-radius:16px;background:rgba(255,255,255,.04)}.lights .ok b{color:#7fc79a}.lights .wait b{color:#d9b779}.lights span{font-size:13px;opacity:.75}</style>
<h1>Status</h1>
${statusLights(status)}
<p>${esc(status.note || "")}</p>
<p>Last time in the files: ${status.lastFileTimePt ? esc(status.lastFileTimePt) : "not in the files"}${status.lastFile ? ` (${esc(status.lastFile)})` : ""}.</p>
<p>Newest price day: ${status.newestPriceDay ? esc(status.newestPriceDay) : "not in the files"}.</p>
<p>eBay file time: ${ebayAt || "not in the files"}${ebayAge ? `. Age: ${esc(ebayAge)}.` : ""}.</p>
<p>Product counts: ${countBits || "not in the files"}.</p>
<h2>Missing price days</h2>
<p>${missing || "No missing day between the first and last file."}</p>
<h2>Steps</h2>
<ul class="status-list">${steps || `<li>No step lines in the status file.</li>`}</ul>
<h2>Pictures with the TCGplayer photo off</h2>
${gap ? `<p>Search rows ${Number(gap.rows) || 0}. Catalogue hit ${Number(gap.catalogue) || 0}. pokemontcg.io id ${Number(gap.pokemontcg) || 0}. TCGplayer photo is the only picture ${Number(gap.tcgplayerOnly) || 0}. Already a tile ${Number(gap.tileOnly) || 0}.</p><p>Would lose a real picture: ${Number(gap.lose) || 0}. ${types}</p><p class="muted">${esc(gap.note || "")}</p>` : `<p class="muted">The image count file is not in the public feed.</p>`}
<h2>Files the site, bot, and newsletter read</h2>
<ul class="status-list">${files || `<li>The source list is not in the public feed.</li>`}</ul>
<h2>Client errors</h2>
${err}
</main>`;
  return chrome("", body, "Status", stamp, "", feedNav(opts));
}

export function renderSearch(opts = {}) {
  const body = `<main id="main" tabindex="-1" class="wrap"><h1>Search</h1><p class="muted">Nicknames, numbers, and set shorthand. 151 ETB means the Elite Trainer Box, not a warehouse bundle.</p>
<div class="filters"><input id="q" aria-label="Search the catalog" placeholder="Moonbreon, 215/203, or Evolving Skies" autofocus><select id="vtag" aria-label="Variant"><option value="">All variants</option><option value="Special Illustration Rare">Special Illustration Rare</option><option value="Illustration Rare">Illustration Rare</option><option value="Tag Team (Alternate Art)">Tag Team (Alternate Art)</option><option value="Alternate Art">Alternate Art</option><option value="Trainer Gallery">Trainer Gallery</option><option value="Galarian Gallery">Galarian Gallery</option><option value="Shiny Vault">Shiny Vault</option><option value="Gold">Gold</option><option value="Rainbow Rare">Rainbow Rare</option><option value="Full Art">Full Art</option><option value="Tag Team">Tag Team</option><option value="Radiant">Radiant</option><option value="Prism Star">Prism Star</option><option value="Amazing Rare">Amazing Rare</option><option value="Shiny">Shiny</option><option value="Classic Collection">Classic Collection</option><option value="Black &amp; White Rare">Black &amp; White Rare</option><option value="ACE SPEC">ACE SPEC</option><option value="Cosmos Holo">Cosmos Holo</option><option value="Cracked Ice Holo">Cracked Ice Holo</option><option value="Poké Ball Pattern">Poké Ball Pattern</option><option value="Master Ball Pattern">Master Ball Pattern</option><option value="Delta Species">Delta Species</option><option value="Promo">Promo</option><option value="Reverse Holo">Reverse Holo</option></select></div>
<style>.sugg{margin:6px 0 14px}.sugg[hidden]{display:none}.sg-h{margin:12px 0 6px;font:600 13px/1.2 var(--sans);color:var(--dim)}.sg-row{display:flex;flex-wrap:wrap;gap:8px}.sg-chip,.sg-clear{min-height:44px;padding:0 16px;border-radius:999px;border:1px solid var(--line);background:#1a1815;color:inherit;font:500 15px/1 var(--sans);cursor:pointer}.sg-clear{background:transparent;color:var(--dim)}</style><div id="sugg" class="sugg" aria-label="Recent and suggested searches"></div><p class="muted" id="meta">Type at least 2 letters.</p><div id="list"></div>
<script type="module">
import * as search from "/data/search-rank.mjs";
const rankCatalog=search.rankCatalog;
const ebayQuery=${ebayQuery.toString()};
const AFF=${JSON.stringify(getAffiliateConfig()).replace(/</g, "\\u003c")};
const affTcg=${affTcg.toString()};
const affEbay=${affEbay.toString()};
const queryShardIds=${queryShardIds.toString()};
function storeLinks(r){var m=String(r[0]).match(/^tcgcsv-([0-9]+)$/);var t=m?'<a href="'+html(affTcg("https://www.tcgplayer.com/product/"+m[1], AFF.tcg))+'" rel="sponsored noopener">TCGplayer</a>':"";var q=ebayQuery({name:r[1],set:r[2],num:r[3],kind:r[5]});var e=q?'<a href="'+html(affEbay("https://www.ebay.com/sch/i.html?_nkw="+encodeURIComponent(q), AFF.epn))+'" rel="sponsored noopener">eBay</a>':"";return (t||e)?'<span class="store-links">'+[t,e].filter(Boolean).join(" · ")+' <small class="paid-note">Paid link</small></span>':"";}
const searchCatalog=search.searchCatalog;
function html(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){if(c==="&")return "&"+"amp;";if(c==="<")return "&"+"lt;";if(c===">")return "&"+"gt;";if(c==='"')return "&"+"quot;";return "&"+"#39;"})}
let rows=[];
let catImages={};
let logos={};
let codes={};
let sparkAsOf="";
const sparkBags={};
function bucketOf(id){
  var m=String(id||"").match(/([0-9]+)/);
  var n=m?Number(m[1]):0;
  return String(n%100).padStart(2,"0");
}
async function ensureSparks(list){
  var need={};
  (list||[]).forEach(function(r){ var b=bucketOf(r[0]); if(!sparkBags[b]) need[b]=1; });
  await Promise.all(Object.keys(need).map(function(b){
    return fetch("/data/sparks/"+b+".json").then(function(res){ return res.ok?res.json():{}; }).then(function(doc){
      sparkBags[b]=(doc&&doc.rows)||{};
      if(doc&&doc.asOf) sparkAsOf=doc.asOf;
    }).catch(function(){ sparkBags[b]={}; });
  }));
}
${cataloguePath.toString()}
${browserAssetUrl.toString()}
${catalogueUrl.toString()}
${imageForId.toString()}
${tcgPid.toString()}
${ptcgFile.toString()}
${productTypeLabel.toString()}
${officialSrc.toString()}
${altAttr.toString()}
${nextImage.toString()}
${brandedTile.toString()}
function miss(img){
  if(nextImage(img)) return;
  var d=document.createElement("div");
  d.innerHTML=brandedTile("row",{kind:img.getAttribute("data-kind"),name:img.alt});
  if(d.firstChild) img.replaceWith(d.firstChild);
}
window.miss=miss;
function stored(r){
  const n=Number(r&&r[6]);
  return Number.isFinite(n)&&n>0?n:null;
}
function byValue(a,b){
  const x=stored(a), y=stored(b);
  if(x==null&&y==null) return 0;
  if(x==null) return 1;
  if(y==null) return -1;
  return y-x;
}
let limit=40;
let twinMin={};
function twinKey(r){ return String(r[1]||"").split(" - ")[0].trim().toLowerCase()+"|"+String(r[3]||"").trim(); }
function buildTwins(list){ twinMin={}; (list||[]).forEach(function(r){ const p=stored(r); if(p==null||!r[3]) return; const k=twinKey(r); if(twinMin[k]==null||p<twinMin[k]) twinMin[k]=p; }); }
// A price far above the same card number in another set is shown as unverified.
function isOdd(r){ const p=stored(r); const m=twinMin[twinKey(r)]; return p!=null && m!=null && p>=m*8 && p-m>=50; }
function take(list){
  return (list||[]).slice(0,limit).sort(byValue);
}
function rowHtml(r){
  const href=(r[5]==="sealed"?"/p/":"/c/")+encodeURIComponent(r[0]);
  const row={id:r[0],name:r[1],kind:r[5]};
  const hit=officialSrc(row, catImages);
  const face=hit.src?'<img alt="'+html(r[1])+'" width="64" height="89" loading="lazy" decoding="async" class="'+((r[5]!=="sealed")?'shot card-face thumb':'shot')+'" data-kind="'+html(r[5])+'" '+((r[5]!=="sealed")?'data-crop-card="1" onload="if(window.cropCardEdge)cropCardEdge(this)" ':'style="width:64px;height:88px;object-fit:contain;border-radius:8px;background:#12100e" ')+'src="'+hit.src+'"'+altAttr(hit)+' onerror="miss(this)">':brandedTile("row",row);
  var mark=logos[r[7]||""];
  var logoSrc=mark && typeof mark.src==="string"?catalogueUrl(mark.src):"";
  var logo=logoSrc?'<img alt="" width="72" height="28" loading="lazy" decoding="async" src="'+html(logoSrc)+'" style="height:28px;width:auto;max-width:72px;object-fit:contain;border-radius:6px;background:#12100e" onerror="this.remove()">':"";
  var chips="";
  if(r[8]) chips+='<span class="win">'+html(r[8])+'</span>';
  var vt=(Array.isArray(r[9])?r[9]:[]).filter(function(x){return x&&!/^normal$/i.test(String(x).trim())});
  if(vt.length) chips+='<span class="vchips sm">'+vt.map(function(t){return '<span class="vchip">'+html(t)+'</span>';}).join("")+'</span>';
  var price=stored(r);
  var cash=price==null?"":"$"+price.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
  var bag=sparkBags[bucketOf(r[0])]||{};
  var spark=window.catchemSpark?catchemSpark(bag[r[0]]||"", sparkAsOf):"";
  return '<div class="row srow" data-quick="'+html(r[0])+'">'+face+logo+'<a href="'+href+'" data-quick="'+html(r[0])+'"><b>'+html(r[1])+'</b><br><span class="muted">'+html(r[2]||"")+' '+html(r[3]||"")+'</span> '+chips+((typeof isOdd==="function"&&isOdd(r))?'<span class="win" style="background:#3a2f1a;color:#d9b779">Unverified price</span>':"")+'</a>'+storeLinks(r)+spark+'<b>'+cash+'</b></div>';
}
let drawN=0;
let manifest=null;
let usedLite=false;
const shardCache={};
async function ensureBags(){
  if(ensureBags.done) return;
  try{ var doc=await (await fetch("/data/catalogue-images.json")).json(); catImages=(doc&&doc.images)||{}; }catch(e){ catImages={}; }
  try{
    var marks=await (await fetch("/data/set-logos.json")).json();
    logos=(marks&&marks.logos)||{};
    codes={};
    Object.keys(logos).forEach(function(key){
      var row=logos[key];
      if(row && row.setId && row.slug) codes[String(row.setId).toLowerCase()]=row.slug;
    });
  }catch(e){ logos={}; codes={}; }
  ensureBags.done=1;
}
async function ensureRows(q){
  if(usedLite) return;
  if(!manifest){
    var res=await fetch("/data/feed/search/manifest.json");
    if(!res.ok){
      rows=await (await fetch("/data/search-lite.json")).json();
      usedLite=true;
      return;
    }
    manifest=await res.json();
  }
  var ids=queryShardIds(q).filter(function(id){ return manifest.shards && manifest.shards[id]; });
  await Promise.all(ids.map(function(id){
    if(shardCache[id]) return Promise.resolve();
    return fetch("/data/feed/search/shards/"+id+".json").then(function(r){ return r.ok?r.json():[]; }).then(function(body){ shardCache[id]=body; }).catch(function(){ shardCache[id]=[]; });
  }));
  var seen={};
  rows=[];
  ids.forEach(function(id){ (shardCache[id]||[]).forEach(function(row){ if(row && !seen[row[0]]){ seen[row[0]]=1; rows.push(row); } }); });
}
async function draw(){
  const n=++drawN;
  const q=document.getElementById("q").value.trim();
  const vtag=document.getElementById("vtag").value;
  const hasTag=function(r){return Array.isArray(r[9])&&r[9].indexOf(vtag)>=0;};
  if(q.length<2 && !vtag){document.getElementById("list").innerHTML="";document.getElementById("meta").textContent="Type at least 2 letters, or pick a variant.";return}
  document.getElementById("list").innerHTML='<div class="skel-row" aria-hidden="true"></div><div class="skel-row" aria-hidden="true"></div><div class="skel-row" aria-hidden="true"></div>';
  if(q.length<2 && vtag){
    try{ await ensureBags(); if(!usedLite){ rows=await (await fetch("/data/search-lite.json")).json(); usedLite=true; } }catch(e){ document.getElementById("meta").textContent="Search did not load."; return; }
    if(n!==drawN) return;
    var all=rows.filter(hasTag);
    var top=all.slice().sort(function(a,b){return (b[6]||0)-(a[6]||0);}).slice(0,40);
    await ensureSparks(top);
    if(n!==drawN) return;
    document.getElementById("meta").textContent=all.length.toLocaleString("en-US")+" "+vtag+" cards. Top 40 by TCGplayer market price.";
    document.getElementById("list").innerHTML=top.map(rowHtml).join("");
    return;
  }
  try{ await ensureBags(); await ensureRows(q); }catch(e){ document.getElementById("meta").textContent="Search did not load."; return; }
  if(n!==drawN) return;
  const src=rows;
  var hits, found;
  { const rows=vtag?src.filter(hasTag):src;
  hits=rankCatalog(q, rows, limit+1, codes);
  found=hits.length?{hits:hits,nearest:[]}:(typeof searchCatalog==="function"?searchCatalog(q, rows, limit+1):{hits:rankCatalog(q, rows, limit+1),nearest:[]}); }
  buildTwins(found.hits);
  const more=found.hits.length>limit;
  const shown=take(found.hits);
  const near=take(found.nearest);
  await ensureSparks(shown.concat(near));
  if(n!==drawN) return;
  if(!shown.length){
    document.getElementById("meta").textContent="No match in the TCGplayer catalog.";
    const tips='<div class="s-empty" style="background:#1a1815;border:1px solid #2f2b26;border-radius:16px;padding:14px 16px;margin:8px 0"><p style="margin:0 0 8px">Try a card name, a card number like 215/203, or a set name. Japanese-only cards are not in the TCGplayer catalog yet, so search the English name.</p><p style="margin:0;display:flex;flex-wrap:wrap;gap:6px">'+["Charizard","Pikachu","Umbreon","Prismatic Evolutions","Evolving Skies","151"].map(function(t){return '<a class="win" href="/search?q='+encodeURIComponent(t)+'">'+html(t)+'</a>';}).join("")+'</p></div>';
    document.getElementById("list").innerHTML=tips+(near.length?'<p class="muted">Nearest names</p>'+near.map(rowHtml).join(""):"");
    return;
  }
  const nameWords=(String(shown[0]&&shown[0][1]||"")+" "+String(shown[0]&&shown[0][2]||"")).toLowerCase().replace(/[^a-z0-9]+/g," ").split(" ").filter(Boolean);
  function editDist(x,y){ const d=[]; for(let i=0;i<=x.length;i++){ d[i]=[i]; } for(let j=1;j<=y.length;j++) d[0][j]=j; for(let i=1;i<=x.length;i++) for(let j=1;j<=y.length;j++) d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(x[i-1]===y[j-1]?0:1)); return d[x.length][y.length]; }
  let fixed=false;
  const fixedQ=String(q||"").toLowerCase().split(" ").filter(Boolean).map(function(w){
    if(w.length<4 || !/^[a-z]+$/.test(w) || nameWords.some(function(n){ return n.indexOf(w)===0; })) return w;
    let best="", bd=3;
    nameWords.forEach(function(n){ const dd=editDist(w,n); if(dd<bd){ bd=dd; best=n; } });
    if(best){ fixed=true; return best; }
    return w;
  }).join(" ");
  const lead=fixed ? fixedQ : "";
  document.getElementById("meta").textContent=shown.length.toLocaleString("en-US")+" shown"+(lead?". Showing matches for \u201c"+lead+"\u201d.":"");
  document.getElementById("list").innerHTML=shown.map(rowHtml).join("")+(more?'<p><button type="button" id="s-more" class="win" style="min-height:44px;padding:0 18px;border-radius:12px">Show 40 more</button></p>':"");
  const sm=document.getElementById("s-more"); if(sm) sm.onclick=function(){ limit+=40; draw(); };
}
document.getElementById("q").addEventListener("input",function(){ limit=40; draw(); });
document.getElementById("q").addEventListener("focus",function(){
  if(manifest||usedLite) return;
  fetch("/data/feed/search/manifest.json").then(function(res){ return res.ok?res.json():null; }).then(function(doc){ if(doc&&!manifest) manifest=doc; }).catch(function(){});
});
document.getElementById("vtag").addEventListener("input",draw);
(function(){var q0=new URLSearchParams(location.search).get("q");var qi=document.getElementById("q");if(q0&&qi){qi.value=q0.slice(0,80);qi.dispatchEvent(new Event("input"));}})();
(function(){var t=new URLSearchParams(location.search).get("tag");if(t){var s=document.getElementById("vtag");for(var i=0;i<s.options.length;i++){if(s.options[i].value===t){s.value=t;draw();break;}}}})();
(function(){
  var KEY="catchem-recent-q";
  var box=document.getElementById("sugg");
  var qi=document.getElementById("q");
  if(!box||!qi) return;
  var SUG=["Charizard","Moonbreon","Pikachu","151 ETB","Evolving Skies booster box","Prismatic Evolutions","Mew ex","Gengar"];
  function recent(){ try{ return (JSON.parse(localStorage.getItem(KEY)||"[]")||[]).filter(function(x){ return typeof x==="string" && x.length>1; }).slice(0,6); }catch(e){ return []; } }
  function save(v){
    v=String(v||"").trim().slice(0,60);
    if(v.length<2) return;
    var r=recent().filter(function(x){ return x.toLowerCase()!==v.toLowerCase(); });
    r.unshift(v);
    try{ localStorage.setItem(KEY, JSON.stringify(r.slice(0,6))); }catch(e){}
  }
  function chip(t){ return '<button type="button" class="sg-chip" data-q="'+html(t)+'">'+html(t)+'</button>'; }
  function paint(){
    var show=qi.value.trim().length<2;
    box.hidden=!show;
    if(!show) return;
    var r=recent();
    box.innerHTML=(r.length?'<p class="sg-h">Recent</p><div class="sg-row">'+r.map(chip).join("")+'<button type="button" class="sg-clear">Clear</button></div>':"")+'<p class="sg-h">Popular</p><div class="sg-row">'+SUG.map(chip).join("")+'</div>';
  }
  box.addEventListener("click", function(e){
    var b=e.target.closest("button");
    if(!b) return;
    if(b.classList.contains("sg-clear")){ try{ localStorage.removeItem(KEY); }catch(x){} paint(); return; }
    qi.value=b.dataset.q;
    qi.dispatchEvent(new Event("input"));
    save(b.dataset.q);
  });
  var idle=0;
  qi.addEventListener("input", function(){
    paint();
    clearTimeout(idle);
    idle=setTimeout(function(){ if(document.querySelectorAll("#list img").length) save(qi.value); }, 2500);
  });
  qi.addEventListener("keydown", function(e){ if(e.key==="Enter") save(qi.value); });
  document.getElementById("list").addEventListener("click", function(e){ if(e.target.closest("a")) save(qi.value); });
  paint();
})();
</script></main>`;
  return chrome("Search", body, "Search", "", "", feedNav(opts));
}

export function renderMethod(counts, stamp, opts = {}) {
  const single = Number(counts?.single);
  const sealed = Number(counts?.sealed);
  const catalog = Number.isFinite(single) && Number.isFinite(sealed)
    ? `The public catalog is ${single.toLocaleString("en-US")} singles and ${sealed.toLocaleString("en-US")} sealed products. Slabs are not in it.`
    : "Singles and sealed are counted apart. Slabs are not in the catalog.";
  const body = `<main id="main" tabindex="-1" class="wrap"><h1>How the numbers are made</h1>
<p>Catch'em shows one price for a product: the TCGplayer market price. Singles and sealed are never added into one index.</p>
<ul>
<li><b>TCGplayer market</b> is the catalog price. ${catalog}</li>
<li>A sold list is shown only when the file has one, labeled TCGplayer recent sales. Otherwise the page says no sold data yet. The market price is still the one catalog number.</li>
</ul>
<p>If a price is missing, the page says so. We do not show a blank, a zero, or a made-up sold price.</p>
<p>The chart axis runs from the low to the high, not from zero. A range button is shown only when the series covers that range. The line is labeled TCGplayer market and shows the first and last price and date. Missing days are not filled in.</p>
<p>Box math divides that same market price by the pack count. Artist pages only include illustrator credits we could match.</p>
<p><a href="/corrections">Corrections</a></p>
</main>`;
  return chrome("", body, "Methodology", stamp, "", feedNav(opts));
}

export function renderRotation(stamp, opts = {}) {
  const paras = GUIDE_PARAS.map((p) => `<p class="copy">${esc(p)}</p>`).join("");
  const sources = ROTATION_SOURCES.map((src) => `<li><a href="${esc(src.href)}">${esc(src.label)}</a></li>`).join("");
  const body = `<main id="main" tabindex="-1" class="wrap rot"><style>
.rot h1{font:500 clamp(32px,8vw,52px)/1.05 var(--serif);letter-spacing:-.03em;margin:0 0 12px;max-width:12em}
.rot .kicker{margin:0 0 12px;letter-spacing:.14em;text-transform:uppercase;font:600 12px/1 var(--sans);color:var(--gold)}
.rot .marks{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 16px}
.rot .marks span{display:flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;padding:0 12px;border:1px solid var(--gold);border-radius:12px;color:var(--gold);font:600 18px/1 var(--serif)}
.rot .copy{font-size:17px;line-height:1.5;max-width:40em;margin:0 0 14px}
.rot h2{font:600 22px/1.3 var(--serif);margin:22px 0 8px}
.rot .sources{list-style:none;padding:0;margin:0;max-width:40em}
.rot .sources li{margin:0;border-top:1px solid var(--line)}
.rot .sources a{display:flex;align-items:center;min-height:48px}
.rot .note{color:var(--dim);font-size:14px;line-height:1.45;max-width:40em}
</style>
<p class="kicker">Standard</p>
<h1>Rotation and print runs</h1>
<div class="marks" aria-hidden="true"><span>F</span><span>G</span></div>
${paras}
<h2>Sources</h2>
<ul class="sources">${sources}</ul>
<p class="note">A set page shows the regulation mark from our card file. The card file is dated 2026-08-24. A rotated date is shown only for a letter these two announcements say left Standard: F on April 11, 2025, and G on April 10, 2026. This page does not say a set was released again after it rotated.</p>
</main>`;
  return chrome("", body, "Rotation and print runs", stamp, "", feedNav(opts), {
    description: GUIDE_PARAS[0],
    url: "https://catchemtcg.com/rotation",
  });
}

export function renderAccuracy(doc, stamp, opts = {}) {
  const body = `<main id="main" tabindex="-1" class="wrap"><h1>Accuracy</h1>
<p>${esc(doc?.note || "A hit rate is shown after 20 calls had a direction written down first.")}</p>
<p class="muted">Scored ${Number(doc?.scored) || 0}. Hits ${Number(doc?.hits) || 0}. Misses ${Number(doc?.misses) || 0}. Crowd votes are not in this score until the server store is on.</p>
<p>Baseline: a read that says the price stays the same. We do not print a rate from a handful of calls.</p>
${(doc?.rows || []).map((r) => `<article class="card" style="margin:10px 0"><h2>${esc(r.name)}</h2><p>${esc(r.result || "open")} · ${esc(r.date || "")}</p></article>`).join("") || `<p class="muted">No scored calls in this file.</p>`}
<h2>Privacy</h2>
<p>A vote is a yes or a no on a read. A price report is the number you say you paid or received, the date, the condition, and where. We do not ask for your name. Reports stay private. A community median is shown only after five reports of the same product. You can email support@catchemtcg.com to ask for a report to be deleted.</p>
</main>`;
  return chrome("", body, "Accuracy", stamp, "", feedNav(opts));
}

export function renderRetired(kind, opts = {}) {
  const pages = {
    faq: ["Questions", "The tools are free. One price, labeled TCGplayer market. The community is on Discord."],
    build: ["This page is retired", "The current site is the catalog. Older build notes are not kept here."],
    creators: ["This page is retired", "Creator notes from the old site are not the current product."],
  };
  const [title, line] = pages[kind] || pages.faq;
  const body = `<main id="main" tabindex="-1" class="wrap"><h1>${esc(title)}</h1><p>${esc(line)}</p><p><a href="/sets">Sets</a> · <a href="/methodology">How the numbers are made</a> · <a href="https://discord.gg/fUSjxDX4Hy">Discord</a></p></main>`;
  return chrome("", body, title, "", "", feedNav(opts));
}

export function renderOfficeGate(opts = {}) {
  const invite = INVITE_LINE.replace("Join Discord", `<a href="${esc(DISCORD)}">Join Discord</a>`);
  const sign = opts.ready && !opts.signedIn
    ? `<p><a href="/auth/discord?next=/post-office">Sign in with Discord</a></p>`
    : "";
  const body = `<main id="main" tabindex="-1" class="wrap"><h1>Post Office</h1><p>${invite}</p>${sign}</main>`;
  return chrome("Post Office", body, "Post Office", "", "", feedNav(opts));
}

export function renderPost(stamp, mark = "", opts = {}) {
  void stamp;
  const line = typeof mark === "string" ? mark : "";
  const rev = encodeURIComponent(String(opts.editorRev || BUILD_SHA || "dev").slice(0, 12) || "dev");
  const body = `<iframe title="Post Office editor" src="/post-office/app?v=${rev}" style="display:block;width:100%;border:0;background:#12100e"></iframe>
<style>iframe[title="Post Office editor"]{height:calc(100dvh - 188px)}@media(min-width:1024px){iframe[title="Post Office editor"]{height:calc(100dvh - 64px)}}</style>`;
  return chrome("Post Office", body, "Post Office", "", line, feedNav(opts));
}

const RATE_LOCK = "The rate you check out at stays yours while you stay subscribed or on a valid pause. Cancel and the number is retired. If you come back, you pay the public rate then on the site.";
const PAUSE_STAY = "Pause up to 2 months in any 12. Your number and rate stay. Or cancel anytime.";
const WATCH_PERK = "Watch up to 25 cards or products. We DM you when the price or listings counted crosses the number you set. Free members can save 25 too, without the DM.";

export function renderPremium(stamp, opts = {}) {
  void stamp;
  const proof = opts.proof || null;
  const member = opts.premium === true;
  const week = Array.isArray(proof?.week) ? proof.week.slice(0, 3) : [];
  const count = Number(proof?.reads30);
  const examples = week.length ? week.map((row) => {
    const name = member ? esc(row.name || "") : `<span class="prem-blur" aria-hidden="true">${esc(row.name || "")}</span><span class="sr">Name hidden until Premium</span>`;
    return `<li>${name}<span class="muted">${esc(String(row.asOf || ""))}</span></li>`;
  }).join("") : `<li class="muted">More history added nightly</li>`;
  const countLine = count > 0 ? `<p class="prem-count"><b>${count.toLocaleString("en-US")}</b> reads in the last 30 days.</p>` : "";
  const ico = (paths) => `<span class="prem-ico" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths}</svg></span>`;
  const card = (paths, title, copy) => `<article class="prem-card">${ico(paths)}<h3>${title}</h3><p>${copy}</p></article>`;
  const body = `<main id="main" tabindex="-1" class="wrap prem">
<style>
.prem-hero{padding:18px 0 6px}
.prem-kicker{margin:0 0 14px;letter-spacing:.14em;text-transform:uppercase;font:600 12px/1 var(--sans);color:var(--gold)}
.prem-hero h1{font:500 clamp(30px,6vw,52px)/1.08 var(--serif);letter-spacing:-.02em;margin:0 0 14px;max-width:14em}
.prem-lede{font-size:18px;line-height:1.4;margin:0 0 16px;max-width:28em}
.prem-price{margin:0 0 16px;font:600 22px/1.2 var(--serif);color:var(--gold)}
.prem-join{display:flex;width:100%;align-items:center;justify-content:center;min-height:48px;padding:0 22px;border-radius:12px;background:var(--gold);color:#1a1407;text-decoration:none;font:600 16px/1 var(--sans)}
.prem-join:hover{color:#1a1407}
.prem-fine{margin:12px 0 0;color:var(--dim);font-size:14px;max-width:36em}
.prem-grid{display:grid;gap:12px;grid-template-columns:1fr}
.prem-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px}
.prem-card h3{margin:10px 0 6px;font:600 16px/1.3 var(--sans)}
.prem-card p{margin:0;color:var(--dim);font-size:15px;line-height:1.45}
.prem-soon{display:inline-block;margin-left:6px;padding:2px 8px;border-radius:999px;background:#241f18;color:var(--gold);font:600 11px/1.5 var(--sans);vertical-align:2px}
.prem-ico{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:#241f18;color:var(--gold)}
.prem-lock{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:16px;padding:16px}
.prem-lock p{margin:8px 0 0}
.prem-also{color:var(--dim);font-size:15px}
.prem-also ul{margin:8px 0;padding-left:18px}
.prem-faq{display:grid;gap:0;margin:4px 0 8px}
.prem-q{border-top:1px solid var(--line);padding:12px 0}
.prem-q b{display:block;font:600 15px/1.4 var(--sans)}
.prem-q p{margin:4px 0 0;color:var(--dim);font-size:15px}
.prem-manage{margin:18px 0 0;color:var(--dim);font-size:14px}
.prem-acts{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 0}
.prem-acts a{flex:1 1 220px;min-width:44px;text-align:center;text-decoration:none;color:var(--txt);background:var(--panel);border:1px solid var(--line);border-radius:10px;min-height:44px;display:flex;align-items:center;justify-content:center;font:600 14px var(--sans);padding:8px 12px}
.prem-proof{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px;margin:8px 0 18px}
.prem-proof h2{margin:0 0 8px;font:600 18px/1.3 var(--sans)}
.prem-count{margin:0 0 8px;font-size:16px}
.prem-week{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.prem-week li{display:flex;justify-content:space-between;gap:12px;align-items:center;min-height:44px;border-radius:12px;background:#12100e;padding:8px 12px}
.prem-blur{filter:blur(6px);user-select:none}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
.prem-proof a{min-height:44px;display:inline-flex;align-items:center}
@media(min-width:840px){
  .prem-grid{grid-template-columns:repeat(6,1fr)}
  .prem-card{grid-column:span 2}
    .prem-faq{grid-template-columns:1fr 1fr;column-gap:28px}
  .prem-join{display:inline-flex;width:auto;min-width:220px}
}
</style>
<section class="prem-hero">
<p class="prem-kicker">Discord Premium</p>
<h1>Catch'em Premium · $14.99 USD a month</h1>
<p class="prem-lede">See the market before everyone else.</p>
<a class="prem-join" href="${DISCORD}">Get Premium</a>
<p class="prem-fine">7-day refund on your first charge. Cancel anytime.</p>
<p class="prem-agree muted"><small>By subscribing you agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.</small></p>
</section>
<section class="prem-proof">
<h2>From our own files</h2>
${countLine}
<p>Example reads from this week.${member ? "" : " Names stay blurred until you are a member."}</p>
<ul class="prem-week">${examples}</ul>
<p><a href="/track-record">Track record</a></p>
</section>
<h2>Everything free, plus:</h2>
<div class="prem-grid">
${card('<path d="M4 6h16M4 12h16M4 18h10"/>', "Premium reads in Discord", "The deeper reads land in our members-only #reads channel first, every morning.")}
${card('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>', "Watchlist pings", WATCH_PERK)}
${card('<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>', "Member drops <span class=\"prem-soon\">Coming soon</span>", "Monthly below-market drops of sealed and singles, with early access for members.")}
${card('<path d="M5 12l4 4 10-10"/>', "Vault Votes <span class=\"prem-soon\">Coming soon</span>", "Every Friday, members vote on what Catch'em adds to the vault next.")}
${card('<path d="M10 4.5v15M14 4.5v15M5.5 9h13M5.5 15h13"/>', "First 222", "The first 222 Premium members get a numbered role that stays yours while you stay. If your membership ends, that number is retired for good.")}
${card('<path d="M5 5h14v10H9l-4 4z"/>', "Members-only Discord", "Premium channels, the weekly recap and the leaderboard.")}
</div>
<h2>Your price stays locked</h2>
<div class="prem-lock">
<p>${RATE_LOCK}</p>
</div>
<h2>Questions</h2>
<div class="prem-faq">
<div class="prem-q"><b>Can I pause?</b><p>${PAUSE_STAY}</p></div>
<div class="prem-q"><b>What happens if I cancel?</b><p>Your number is retired for good, and the locked rate ends with it.</p></div>
<div class="prem-q"><b>Can I get a refund?</b><p>${REFUND_LINE}</p></div>
<div class="prem-q"><b>How do I manage it?</b><p>Pause or cancel in Discord with /premium.</p></div>
</div>
<p class="prem-manage">Already in?</p>
<div class="prem-acts"><a href="${DISCORD}">Manage in Discord with /premium</a></div>
</main>`;
  return chrome("Discord Premium", body, "Discord Premium", "", "", feedNav(opts));
}

export function renderPremiumResult(kind) {
  const success = kind === "success";
  const title = success ? "Payment sent." : "No charge.";
  const rest = success
    ? "Discord Premium turns on when the payment lands. You get the Premium role and a First 222 number in Discord. Then run /pull week."
    : "Checkout was canceled. Nothing was charged. Run /premium in Discord when you want to try again.";
  const body = `<main id="main" tabindex="-1" class="wrap"><h1>${title}</h1><p>${rest}</p></main>`;
  return chrome("", body, success ? "Payment sent" : "No charge", "", "");
}

export function renderDive(doc, stamp, opts = {}) {
  if (!doc || !doc.id) {
    return chrome("", `<main id="main" tabindex="-1" class="wrap"><h1>Deep dive not found</h1><p class="muted">No payload for that product yet.</p><p><a href="/feed">Back to the feed</a></p></main>`, "Not found", stamp, "", feedNav(opts), {
      description: "That deep-dive payload is not on file yet. Open the Feed for live market reads.",
      url: "https://catchemtcg.com/feed",
    });
  }
  const series = Array.isArray(doc.series) ? doc.series : [];
  const hist = series.filter((r) => r && r.date && r.price != null).map((r) => [r.date, r.price]);
  const latest = doc.latest || {};
  const buyout = doc.buyout || null;
  const outlier = doc.outlier || null;
  const price = money(latest.priceMedian);
  const listings = latest.listingCount != null ? String(latest.listingCount) : "—";
  const browse = buyout && buyout.browseTotalNow != null ? String(buyout.browseTotalNow) : null;
  const rows = series.slice().reverse().map((r) => {
    const lc = r.listingCount != null ? String(r.listingCount) : "—";
    return `<tr><td>${esc(r.date)}</td><td>${money(r.price) || "—"}</td><td>${esc(lc)}</td><td class="muted">${esc(r.source || "ebay-browse-ask")}</td></tr>`;
  }).join("");
  const catalog = doc.tcgcsvId ? `<p><a href="/p/${esc(doc.tcgcsvId)}">TCGplayer catalog page</a> (market price, labeled separately from eBay asks)</p>` : "";
  const volumeLine = `<p class="muted">Volume / solds: not available. ${esc(doc.volumeNote || "Sold counts need Insights scope. listingCount is not solds.")}</p>`;
  const outlierNote = outlier && (outlier.note || (outlier.pctGap != null
    ? `Price flagged for review: ${Math.abs(Number(outlier.pctGap))}% ${Number(outlier.pctGap) < 0 || outlier.direction === "low" ? "below" : "above"} the recent median`
    : null));
  const outlierLine = outlier
    ? `<p style="border:1px solid var(--gold);border-radius:10px;padding:12px 14px;margin:12px 0"><b>${esc(outlierNote || `Outlier: ${String(outlier.flag)}`)}</b>${outlier.asOf ? ` <span class="muted">(${esc(outlier.asOf)})</span>` : ""}${outlier.provisionalLabel ? `<br><span class="muted">${esc(String(outlier.provisionalLabel))}</span>` : ""}</p>`
    : `<p class="muted">Outlier flags: none yet.</p>`;
  const buyoutLine = browse
    ? `<p>Browse total (eBay): <b>${esc(browse)}</b>${buyout.browseTotalBefore != null ? ` · prior ${esc(String(buyout.browseTotalBefore))}` : ""} · level ${esc(String(buyout.level || "unscored"))}</p>`
    : `<p class="muted">Browse total: not on file for this product.</p>`;
  const body = `<main id="main" tabindex="-1" class="wrap">
<p class="muted"><a href="/feed">Feed</a> · <a href="/board">Board</a> · Deep dive</p>
<h1>${esc(doc.name || doc.id)}</h1>
${imageTag(officialSrc({ id: doc.tcgcsvId, kind: "sealed", name: doc.name, subtype: latest.subtype }, null).src, "card", doc.name || "", { kind: "sealed", name: doc.name, subtype: latest.subtype, catalogueCrop: false })}
<p class="muted">${esc(latest.set || "")} · ${esc(latest.subtype || "")} · as of ${esc(doc.asOf || "")}</p>
<p class="price" style="font:600 28px/1 var(--serif);color:var(--gold)">${price || "—"}</p>
<p class="muted">eBay Browse ask median · ${esc(listings)} active listings (asks, not solds)</p>
${buyoutLine}
${chartBox(hist, "eBay Browse ask median, daily")}
<table style="width:100%;border-collapse:collapse;margin:16px 0">
<thead><tr><th align="left">Date</th><th align="left">Ask median</th><th align="left">Listings</th><th align="left">Source</th></tr></thead>
<tbody>${rows || `<tr><td colspan="4" class="muted">No series points yet.</td></tr>`}</tbody>
</table>
${volumeLine}
${outlierLine}
${catalog}
<p class="muted">Charts-only hub is deferred. This page is the launch-lean deep-dive a read can open.</p>
</main>`;
  const diveTitle = `${doc.name || doc.id} · Deep dive`;
  const diveDesc = [
    latest.set || "",
    latest.subtype || "",
    price ? `eBay Browse ask median ${price}` : "eBay Browse ask series",
    "asks, not solds",
  ].filter(Boolean).join(" · ");
  return chrome("", body, diveTitle, stamp, "", feedNav(opts), {
    description: diveDesc,
    url: `https://catchemtcg.com/dive/${encodeURIComponent(doc.id)}`,
  });
}

// The feed page inlines only the first FEED_INLINE reads. The rest load from
// FEED_REST_URL after the first card paints, so the first payload stays small.
export const FEED_INLINE = 8;
export const FEED_REST_URL = "/feed/lead.json";

export function feedReads(bundle) {
  const seen = new Set();
  const reads = (bundle?.reads || []).filter((r) => {
    if (!keepFeedRead(r)) return false;
    const href = String(r.href || "");
    const key = /^\/(?:c|p)\//.test(href) ? href : String(r.id || r.headline);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((r) => ({
    ...r,
    headline: soldSafeText(r, r.headline),
    ...(r.path ? { path: soldSafeText(r, r.path) } : {}),
    ...(r.why ? { why: scrubMethod(soldSafeText(r, r.why)) } : {}),
  }));
  return reads;
}

export function inlineFeedReads(reads, startId = "", n = FEED_INLINE) {
  const out = reads.slice(0, n);
  if (startId && !out.some((r) => String(r.id) === String(startId))) {
    const hit = reads.find((r) => String(r.id) === String(startId));
    if (hit) out.push(hit);
  }
  return out;
}

const PLAIN_PRICE = new Set(["single", "sealed", "streak", "mover", "price", "askmove", "mktmove"]);
export function leadWithStory(reads) {
  const list = Array.isArray(reads) ? reads : [];
  if (!list.length) return list;
  const kindOf = (r) => String(r?.readKind || r?.kind || "");
  const isFact = (r) => /^pokemon/.test(kindOf(r)) || /^pokemon-/.test(String(r?.id || ""));
  const isNews = (r) => ["news", "newsline", "wave"].includes(kindOf(r)) || !!r?.waveItem;
  const isPlain = (r) => PLAIN_PRICE.has(kindOf(r));
  const isStory = (r) => r && !isPlain(r) && !isFact(r) && !isNews(r);
  if (isStory(list[0])) return list;
  let i = -1;
  if (isPlain(list[0]) || isNews(list[0])) {
    i = list.findIndex((r, n) => n > 0 && n < 12 && isStory(r));
    if (i < 0) i = list.findIndex((r, n) => n > 0 && n < 12 && !isPlain(r) && !isNews(r));
  }
  if (i < 0 && isNews(list[0])) i = list.findIndex((r, n) => n > 0 && !isNews(r));
  if (i <= 0) return list;
  return [list[i], ...list.slice(0, i), ...list.slice(i + 1)];
}

export function renderFeed(bundle, startId, stamp, opts = {}) {
  const reads = leadWithStory(feedReads(bundle));
  const first = inlineFeedReads(reads, startId);
  const lead = JSON.stringify(first).replace(/</g, "\\u003c");
  const restCfg = JSON.stringify({ total: reads.length, url: reads.length > first.length ? FEED_REST_URL : "", sold: opts.soldOn === true });
  // Live news from Catchem-data. The baked copy is only for when that file did not load,
  // so a quiet live day shows no news rather than an old snapshot.
  const newsLead = JSON.stringify(opts.news ? newsSlice(opts.news) : newsSlice(feedNews)).replace(/</g, "\\u003c");
  const diveLead = JSON.stringify(opts.diveMap || { ids: [], byTcgcsv: {} }).replace(/</g, "\u003c");
  const css = `
  .feed-page{padding-top:8px}
  .feed-filters{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0;align-items:flex-start;position:relative}
  #feed-loop-form{display:flex;flex-direction:column;align-items:stretch;gap:8px;min-width:0;max-width:100%;width:100%}
  .chip-scroller{position:relative;min-width:0;max-width:100%;width:100%;display:flex;align-items:center;gap:4px}
  .chip-scroller > .chip-row{flex:1 1 auto;padding-right:28px}
  .chip-scroller > .chip-more{position:static;transform:none;flex:0 0 44px;background:#12100e;border-radius:10px}
  .chip-scroller.can-scroll::after{content:"";position:absolute;top:0;right:48px;bottom:0;width:var(--chip-fade,48px);pointer-events:none;background:#12100e;z-index:6}
  .chip-row{position:sticky;top:56px;z-index:4;display:flex;flex-wrap:nowrap;gap:8px;overflow-x:auto;width:100%;min-width:0;background:#12100e;padding:8px 48px 8px 0;margin:0;scrollbar-width:none}
  .chip-row button{flex:0 0 auto;min-height:44px;min-width:44px;padding:0 16px;border-radius:10px;border:1px solid var(--gold);background:transparent;color:var(--gold);font:600 16px/1 var(--sans)}
  .chip-row button[aria-pressed="true"]{background:var(--gold);color:#1a1407;border-color:transparent}
  .chip-more{position:absolute;right:0;top:50%;transform:translateY(-50%);z-index:5;min-width:44px;min-height:44px;padding:0;border:0;background:transparent;color:var(--gold);font:600 28px/1 var(--sans)}
  .chip-more[hidden]{display:none}
  .new-badge{display:inline-flex;align-items:center;align-self:flex-start;min-height:28px;margin:0 0 8px;padding:0 12px;border-radius:999px;background:rgba(127,199,154,.14);color:#7fc79a;font:600 12px/1 var(--sans);letter-spacing:.02em}
  .pill-native{position:absolute;width:44px;height:44px;padding:0;margin:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0;pointer-events:none}
  .set-picker{display:flex;flex-direction:column;gap:8px;width:100%;max-width:100%;min-width:0;position:relative;z-index:6}
  .set-picker[hidden]{display:none}
  .set-picker input{min-height:44px;width:100%;max-width:100%;box-sizing:border-box;border-radius:12px;border:1px solid var(--line);background:#1a1815;color:var(--txt,#efe9de);padding:0 14px;font:500 16px/1 var(--sans)}
  .set-picker input::placeholder{color:#8f877b}
  .set-quick{display:flex;flex-wrap:wrap;gap:6px}
  .set-quick button{min-height:44px;padding:0 12px;border-radius:999px;border:1px solid var(--line);background:#1a1815;color:var(--txt,#efe9de);font:600 14px/1 var(--sans)}
  .set-hits{display:flex;flex-direction:column;gap:4px;max-height:min(280px,50dvh);overflow:auto;background:#1a1815;border:1px solid var(--line);border-radius:12px;padding:4px}
  .set-hits[hidden]{display:none}
  .set-hits button{min-height:44px;text-align:left;width:100%;display:flex;align-items:center;gap:8px}
  .set-hits img{width:44px;height:22px;object-fit:contain;flex:0 0 auto;background:#12100e;border-radius:4px}
  @media (max-width:767px){
    .set-picker.is-open:not([hidden]){position:fixed;z-index:40;left:0;right:0;bottom:0;max-height:min(70dvh,560px);overflow:auto;background:#1a1815;border-top:1px solid var(--line);border-radius:16px 16px 0 0;padding:12px 12px calc(16px + env(safe-area-inset-bottom));box-shadow:0 -12px 40px rgba(0,0,0,.45)}
    .set-picker.is-open .set-hits{max-height:none;border:0;background:transparent;padding:0}
  }
  .feed-filters select,.feed-filters input{min-height:44px;max-width:100%}
  .feed-sec{border-top:1px solid var(--line);padding:8px 0}
  .feed-sec summary{cursor:pointer;min-height:44px;display:flex;align-items:center;gap:8px;font:600 18px/1.3 var(--serif)}
  .feed-sec summary span{color:var(--gold);font:600 14px var(--sans)}
  .feed-card{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:12px;margin:12px 0;display:flex;flex-direction:column;gap:8px;touch-action:pan-y}
  .feed-card :where(img:not(.card-face,.card-thumb)){width:100%;max-height:220px;object-fit:contain;background:#12100e;border-radius:12px;-webkit-user-drag:none;user-select:none}
  .feed-card img.card-face{width:auto;height:220px;max-width:100%;margin:0 auto;-webkit-user-drag:none;user-select:none}
  .skel-card{height:280px;border-radius:18px;background:#1c1915}
  .feed-card img.is-skel{background:#1c1915}
  .feed-card>.tile{width:min(220px,100%);height:220px;margin:0 auto;aspect-ratio:auto}
  .feed-card>.news-tile{width:100%;height:220px;margin:0}
  .feed-card.news-card{flex:0 0 auto;gap:8px;margin:0;min-width:0}
  .feed-card.news-card>.news-tile{height:auto;aspect-ratio:16/9;padding:0}
  .feed-card.news-card>.news-tile .mark{font-size:18px}
  .feed-card.news-card>.news-tile .src{font-size:20px}
  .news-kicker{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0}
  .news-kicker .k{font:600 12px/1 var(--sans);letter-spacing:.08em;color:var(--gold)}
  .news-card .news-kicker .k{color:#1a1407;background:var(--gold);border-radius:999px;padding:4px 8px}
  .news-kicker .tag{font:600 12px/1 var(--sans);color:#1a1407;background:var(--gold);border-radius:999px;padding:4px 8px}
  .news-card h2{font:600 22px/1.25 var(--serif);margin:0;overflow-wrap:break-word}
  .news-sum{margin:0;font:400 15px/1.45 var(--sans);overflow-wrap:break-word}
  .news-meta{list-style:none;margin:0;padding:10px 12px;background:#211e1a;border-radius:12px;display:flex;flex-direction:column;gap:4px}
  .news-meta li{margin:0;font:500 14px/1.35 var(--sans);color:var(--dim)}
  .news-meta b{color:var(--gold);font-weight:600}
  .news-by{margin:0;color:var(--dim);font:500 14px/1.3 var(--sans)}
  .news-chip{margin:0}
  .news-acts{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
  .news-acts .news-go{flex:1 1 auto}
  .news-acts button{flex:0 0 auto;border-radius:12px}
  .news-go{min-height:44px;display:flex;align-items:center;justify-content:center;border-radius:12px;background:var(--gold);color:#1a1407;text-decoration:none;font:600 16px/1 var(--sans)}
  .feed-card h2{font:600 22px/1.25 var(--serif);margin:0}
  .feed-card h2 a{min-height:44px;display:inline-flex;align-items:center}
  .one-line{margin:0}
  .card-meta{margin:0;color:var(--gold);font:600 14px/1.3 var(--sans)}
  .means{background:#211e1a;border-radius:14px;padding:12px 14px}
  .means b{display:block;margin:0 0 6px}
  .means p{margin:0 0 8px}
  .means p:last-child{margin:0}
  .open-data{min-height:44px;display:inline-flex;align-items:center;font-weight:600}
  .feed-card .open-data{justify-content:center;padding:0 20px;border-radius:14px;background:var(--gold);color:#1a1407;text-decoration:none}
  .feed-list{margin:18px 0 8px}.feed-list h3{margin:0 0 8px;font:600 16px/1.2 var(--sans);color:var(--dim)}
  .fl-scroll{display:flex;flex-direction:column;gap:8px;max-height:min(560px,70dvh);overflow-y:auto;padding-right:2px;-webkit-mask-image:linear-gradient(180deg,#000 88%,transparent);mask-image:linear-gradient(180deg,#000 88%,transparent)}
  .fl-row{display:flex;align-items:center;gap:12px;width:100%;min-height:64px;padding:8px 12px;border-radius:16px;border:1px solid var(--line);background:var(--panel);color:inherit;text-align:left;font:inherit;cursor:pointer}
  .fl-brand{display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,#d9b779,#a8854a)!important;color:#1a1407;font:700 18px/1 Georgia,serif}
  .fl-row img,.fl-ph{flex:0 0 44px;width:44px;height:44px;object-fit:contain;border-radius:10px;background:#12100e}
  .fl-name{flex:1 1 auto;min-width:0;font:600 14px/1.3 var(--sans);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  .fl-num{flex:0 0 auto;display:flex;flex-direction:column;align-items:flex-end;gap:2px;font:600 14px/1.2 var(--sans)}.fl-num .up{color:#7fc79a;font-size:12px}.fl-num .down{color:#e0877a;font-size:12px}
  .data-block{display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--line);padding-top:12px}
  .data-block h4{margin:0;font:600 16px/1.3 var(--sans)}
  .data-block p{margin:0}
  .more-block{display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--line);padding-top:12px}
  .more-block h4{margin:0;font:600 16px/1.3 var(--sans)}
  .more-block p{margin:0}
  .numbers-block{display:flex;flex-direction:column;gap:6px;border-top:1px solid var(--line);padding-top:12px}
  .numbers-block h4{margin:0;font:600 16px/1.3 var(--sans)}
  .numbers-block p,.numbers-block ul{margin:0}
  .numbers,.streak-days{list-style:none;padding:0;display:grid;gap:4px}
  .source-line{font-size:12px;color:#8a8a8a}
  .take-label{margin:0;font:600 18px/1.3 var(--serif)}
  .take-foot{margin:0;font-size:12px;color:#8a8a8a}
  .vote-q{margin:4px 0 0;font-weight:600}
  .set-ph{min-height:160px;display:flex;align-items:center;justify-content:center;background:#211e1a;border-radius:12px;padding:16px;text-align:center;font:600 16px/1.3 var(--sans);color:var(--gold)}
  .stats{display:flex;flex-direction:column;gap:4px}
  .stats p{margin:0}
  .track-done{margin:0;color:var(--gold)}
  .custom{display:flex;flex-wrap:wrap;gap:8px}
  .custom[hidden]{display:none}
  .track-sheet{display:none}
  .track-sheet.open{display:flex;flex-direction:column;gap:10px;position:fixed;z-index:30;left:12px;right:12px;bottom:12px;max-width:440px;margin:0 auto;background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:16px}
  .track-sheet label{min-height:44px;display:flex;gap:8px;align-items:center}
  .track-sheet button,.track-sheet input,.track-sheet select{min-height:44px}
  .feed-card .price{font:600 28px/1 var(--serif);color:var(--gold);margin:0}
  .feed-card .chg{display:flex;flex-wrap:wrap;gap:8px}
  .feed-card .chg b{font-weight:600}
  .feed-acts{display:flex;flex-wrap:wrap;gap:8px}
  .feed-acts button,.feed-acts a,.see-all{min-height:44px;display:inline-flex;align-items:center}
  .read-nav{display:flex;gap:8px}
  .deep-card h2{font-size:1.15rem;line-height:1.35}
  .deep-more{margin:10px 0 4px;border:1px solid rgba(217,183,121,.35);border-radius:14px;padding:10px 14px;background:rgba(217,183,121,.05)}
  .deep-more summary{cursor:pointer;color:var(--gold);font-weight:600;list-style:none;min-height:28px}
  .deep-more summary::-webkit-details-marker{display:none}
  .deep-lines{margin:8px 0;padding-left:0;list-style:none;display:grid;gap:6px;line-height:1.45}
  .deep-line{display:flex;flex-wrap:wrap;align-items:center;gap:12px;min-width:0;padding:8px;border-radius:12px;background:rgba(255,255,255,.03)}
  .deep-line>span{flex:1 1 180px;min-width:0;overflow-wrap:anywhere}
  .deep-line .card-thumb{width:60px;height:84px;border-radius:8px}
  .card-thumb{width:28px;height:38px;object-fit:cover;border-radius:6px;flex:none;background:#1c1916}
  .deep-chart{margin:10px 0 4px}
  .deep-chart svg{width:100%;height:auto;display:block;border-radius:10px;background:rgba(255,255,255,.02)}
  .deep-chart figcaption{font-size:.8rem;opacity:.7;margin-top:4px}
  .deep-bar{display:grid;grid-template-columns:minmax(0,18em) minmax(40px,1fr) 3.5em;gap:8px;align-items:center;font-size:.85rem;margin:3px 0}
  .deep-bar-l{white-space:normal;min-width:0;overflow-wrap:anywhere;display:flex;align-items:center;gap:6px}
  .deep-bar-t{height:10px;border-radius:999px;background:rgba(255,255,255,.06);overflow:hidden}
  .deep-bar-t i{display:block;height:100%;border-radius:999px;background:#d9b779}
  .deep-bar-t i.neg{background:#c97a6a}
  .deep-bar-v{text-align:right;font-variant-numeric:tabular-nums}
  .read-nav button{min-height:44px;flex:1 1 0}
  .feed-slide .read-nav{position:absolute;left:0;right:0;top:72px;z-index:2;justify-content:space-between;pointer-events:none;gap:0}
  .feed-slide .read-nav button{pointer-events:auto;min-width:44px;width:44px;flex:0 0 44px;padding:0;background:transparent;border-color:transparent;color:var(--gold);font:600 34px/1 var(--sans);opacity:.9}
  .feed-slide .read-nav.hint button{opacity:.4}
  .read-pos{margin:0;color:var(--dim);font:600 13px/1.3 var(--sans);text-align:center}
  .feed-slide{position:relative;overflow:hidden;flex:1 1 auto;min-width:0}
  .feed-slide .feed-card{width:100%}
  .feed-card.is-enter-next{animation:feedInNext 200ms ease}
  .feed-card.is-enter-prev{animation:feedInPrev 200ms ease}
  .feed-card.is-leave-next,.feed-card.is-leave-prev{position:absolute;left:0;right:0;top:0;width:100%;pointer-events:none}
  .feed-card.is-leave-next{animation:feedOutNext 200ms ease forwards}
  .feed-card.is-leave-prev{animation:feedOutPrev 200ms ease forwards}
  .feed-card.is-bounce-next{animation:feedBounceNext 200ms ease}
  .feed-card.is-bounce-prev{animation:feedBouncePrev 200ms ease}
  @keyframes feedInNext{from{transform:translateX(100%)}to{transform:none}}
  @keyframes feedInPrev{from{transform:translateX(-100%)}to{transform:none}}
  @keyframes feedOutNext{from{transform:none}to{transform:translateX(-100%)}}
  @keyframes feedOutPrev{from{transform:none}to{transform:translateX(100%)}}
  @keyframes feedBounceNext{0%,100%{transform:none}45%{transform:translateX(-18px)}}
  @keyframes feedBouncePrev{0%,100%{transform:none}45%{transform:translateX(18px)}}
  @media (prefers-reduced-motion:reduce){
    .feed-card.is-enter-next,.feed-card.is-enter-prev,.feed-card.is-leave-next,.feed-card.is-leave-prev,.feed-card.is-bounce-next,.feed-card.is-bounce-prev{animation:none!important}
  }
  .pile{overflow:hidden}
  .feed-stage{min-height:calc(100dvh - 88px);display:flex;flex-direction:column}
  .feed-stage.is-news{min-height:0;max-height:calc(100dvh - 348px)}
  .feed-stage.is-news .read-pos,.feed-stage.is-news .news-bar{flex:0 0 auto}
  .feed-stage.is-news .feed-slide{flex:1 1 auto;min-height:0;overflow-x:hidden;overflow-y:auto}
  .feed-stage .feed-card{flex:1 1 auto}
  .feed-stage .feed-card.fact-card,.feed-stage.is-news .feed-card{flex:0 0 auto;width:100%}
  .news-bar{position:static;z-index:4;background:var(--bg);padding:8px 0 0}
  .news-bar .read-nav{position:static;pointer-events:auto;gap:8px}
  .news-bar .read-nav button,.news-bar .read-nav.hint button{width:auto;flex:1 1 0;min-height:44px;padding:0 12px;background:#1a1815;border:1px solid var(--gold);color:var(--gold);border-radius:12px;font:600 16px/1 var(--sans);opacity:1}
  .swipe-hint{margin:0 0 6px;text-align:center;color:var(--dim);font:500 13px/1.3 var(--sans)}
  .mon-btn{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;background:#12100e;color:#d9b779;border:1px solid #d9b779;border-radius:10px;min-height:48px;padding:0 16px;font:600 16px/1 "IBM Plex Sans",system-ui,sans-serif;text-decoration:none}
  .mon-list{display:flex;flex-direction:column;gap:6px;margin:0}
  .mon-list[hidden]{display:none}
  .mon-list p{margin:0;color:#d9b779}
  #feed-sections:empty{display:none}
  .linkish{background:none;border:0;color:var(--gold);font:600 14px var(--sans);padding:0 4px}
  .track-line{margin:0}
  .alert-box{display:none;gap:8px;flex-wrap:wrap}
  .alert-box.open{display:flex}
  .alert-box input{min-height:44px;max-width:140px}
  .mine-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;border-top:1px solid var(--line);padding:12px 0}
  .mine-row a{font:600 18px/1.3 var(--serif);flex:1;min-width:160px}
  .mine-row button{min-height:44px}
  @media (max-width:420px){.feed-card h2{font-size:20px}}
  `;
  const titles = { today: "Today", watches: "Watches", watch: "Watches", cooks: "Cooks", cook: "Cooks", movers: "Movers", tracked: "Tracked" };
  const focusTitle = titles[String(opts.section || "")] || "";
  const page = opts.page === "read" ? "read" : "feed";
  const pool = page === "read" ? (bundle?.reads || []).filter((row) => row && typeof row === "object").map((row) => ({
    ...row,
    ...(row.headline ? { headline: soldSafeText(row, row.headline) } : {}),
    ...(row.path ? { path: soldSafeText(row, row.path) } : {}),
    ...(row.why ? { why: scrubMethod(soldSafeText(row, row.why)) } : {}),
  })) : reads;
  const opened = page === "read" ? pool.find((row) => String(row.id) === String(startId)) : null;
  const sheet = opened ? readSheet(opened, { meta: opts.readYear?.meta, logo: opts.logo || "", rotation: opts.rotation || null, reads: pool, facts: opts.facts || null }) : "";
  let body = `<style>${css}</style><main id="main" tabindex="-1" class="wrap feed-page">
<link rel="preload" href="/data/feed/meta.json" as="fetch" crossorigin>
<link rel="preload" href="/data/feed/browse.json" as="fetch" crossorigin>
${page === "read" ? '<p><a href="/feed" id="feed-back">Back</a></p><h1>Read</h1>' : `<h1>${focusTitle || "The Feed"}</h1>
${focusTitle ? '<p><a class="tap" href="/feed" id="feed-back">Back</a></p>' : '<p><a class="tap" href="/feed/mine">My tracked reads</a></p>'}`}
${sheet}
${!focusTitle && page !== "read" ? `<form class="feed-filters" id="feed-loop-form">
  <select id="f-loop" class="pill-native" aria-label="Filter">${feedFilterOptions(false).map(function(row){ return '<option value="'+row[0]+'">'+row[1]+'</option>'; }).join("")}</select>
  <div class="chip-scroller">
  <div class="chip-row" role="toolbar" aria-label="Filter"></div>
  <button type="button" class="chip-more" aria-label="More filters" hidden>›</button>
  </div>
  <div id="set-picker" class="set-picker" hidden>
    <input id="set-q" aria-label="Find a set" placeholder="Find a set" autocomplete="off">
    <div id="set-hits" class="set-hits" role="listbox"></div>
  </div>
  <select id="f-loop-set" class="pill-native" aria-label="Set"><option value="">Every set</option></select>
  <label id="hide-facts"${opts.premium === true ? "" : " hidden"}><input type="checkbox" id="f-hide-facts"> Hide Pokémon facts</label>
</form>` : ""}
${focusTitle && page !== "read" ? `<form class="feed-filters" id="feed-filters">
  <select id="f-kind" aria-label="Sealed or singles"><option value="">Sealed and singles</option><option value="sealed">Sealed</option><option value="single">Singles</option></select>
  <select id="f-set" aria-label="Set"><option value="">Every set</option></select>
  <input id="f-min" inputmode="decimal" aria-label="Minimum price" placeholder="Min price">
  <input id="f-max" inputmode="decimal" aria-label="Maximum price" placeholder="Max price">
  <select id="f-dir" aria-label="Direction"><option value="">Up or down</option><option value="up">Up</option><option value="down">Down</option></select>
  <select id="f-sort" aria-label="Sort"><option value="move">Biggest move</option><option value="price">Price</option><option value="name">Name</option></select>
</form>` : ""}
<div id="feed-one"><div class="skel-card" aria-hidden="true"></div></div>
${page === "read" ? "" : '<div id="feed-sections"></div>'}
</main>
<script type="application/json" id="feed-lead">${lead}</script>
<script type="application/json" id="dive-map">${diveLead}</script>
<script type="application/json" id="feed-news">${newsLead}</script>
<script type="application/json" id="start">${JSON.stringify(startId || "")}</script>
<script type="application/json" id="feed-rest">${restCfg}</script>
<script type="application/json" id="read-year">${JSON.stringify(opts.readYear || null).replace(/</g, "\\u003c")}</script>
${page === "read" ? `<style>.read-year{margin:8px 0 4px}.read-year .hc{margin:0}</style><script>${HISTORY_JS}</script><script>(function(){var host=document.getElementById("feed-one");if(!host||!window.MutationObserver)return;new MutationObserver(function(){if(window.catchemHistoryMount)window.catchemHistoryMount();}).observe(host,{childList:true,subtree:true});})();</script>` : ""}
<script>
const SEEN_KEY=${JSON.stringify(SEEN_KEY)};
${freshRandom.toString()}
${freshSeed.toString()}
${freshOrder.toString()}
${pickWording.toString()}
${openDataHref.toString()}
${readSeen.toString()}
${markSeen.toString()}
const lead=JSON.parse(document.getElementById("feed-lead").textContent);
const newsRows=JSON.parse(document.getElementById("feed-news").textContent);
function grabJson(url){
  return fetch(url).then(function(res){ return res.ok ? res.json() : null; }).catch(function(){ return null; });
}
const feedPack=Promise.all([
  grabJson("/data/feed/meta.json"),
  grabJson("/data/feed/browse.json")
]);
const imagePack=grabJson;
const start=JSON.parse(document.getElementById("start").textContent);
const money=n=>!(Number(n)>0)?"":"$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const shortFor=()=>'';
function cents(t){return String(t).replace(/\\s+\u2014\\s+/g,", ").replace(/\u2014/g,": ").replace(/\\$([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(\\.[0-9]+)?(?![0-9KkMm])/g,function(m,i,d){if(d&&d.length===3)return m;return "$"+i+"."+(((d||".").slice(1))+"00").slice(0,2);});}
function html(s){return cents(String(s==null?"":s)).replace(/[&<>"']/g,function(c){if(c==="&")return "&"+"amp;";if(c==="<")return "&"+"lt;";if(c===">")return "&"+"gt;";if(c==='"')return "&"+"quot;";return "&"+"#39;"})}
function showPct(n){return typeof n==="number" && Number.isFinite(n)}
function pct(n){const v=Number(n);return (v>0?"+":"")+v+"%"}
const focus=${JSON.stringify(String(opts.section || ""))};

function diveMapDoc(){
  try{ return JSON.parse((document.getElementById("dive-map")||{}).textContent||"{}"); }catch(e){ return {ids:[],byTcgcsv:{}}; }
}
const __diveMap=diveMapDoc();
const __diveIds=new Set(Array.isArray(__diveMap.ids)?__diveMap.ids:[]);
const __diveByTcg=__diveMap.byTcgcsv&&typeof __diveMap.byTcgcsv==="object"?__diveMap.byTcgcsv:{};
function diveIdFor(card){
  if(!card) return "";
  if(card.diveId && __diveIds.has(card.diveId)) return card.diveId;
  if(card.id && __diveIds.has(card.id)) return card.id;
  const href=String(card.href||"");
  // No backslashes here: this line sits inside a template literal, which ate
  // the escapes in /\\/p\\/…/ and shipped "//p/…" — a syntax error that stopped the
  // whole feed script.
  const m=href.match(new RegExp("/p/([^/?#]+)"));
  let pid=m?decodeURIComponent(m[1]):"";
  if(pid.endsWith(".html")) pid=pid.slice(0,-5);
  if(pid && __diveIds.has(pid)) return pid;
  if(pid && __diveByTcg[pid]) return __diveByTcg[pid];
  const sku=String(card.sku||"");
  if(sku && __diveByTcg[sku]) return __diveByTcg[sku];
  if(card.id && __diveByTcg[card.id]) return __diveByTcg[card.id];
  return "";
}
const pageMode=${JSON.stringify(page)};
const premium=${opts.premium === true ? "true" : "false"};
let browse=null;
let readLibrary=null;
let flat=null;
let hideFacts=false;
let loopFilter="";
let wantedSet="";
let filterGen=0;
let urlIntent="replace";
let openRead="";
let moveBusy=false;
let wheelAt=0;
function isFact(card){
  if(!card) return false;
  if(card.readKind!=="pokemon" && card.kind!=="pokemon") return false;
  const c=card.cardCount, a=card.artistCount, d=card.dex;
  if(!Number.isInteger(c) || !Number.isInteger(a) || !Number.isInteger(d)) return false;
  if(c<1 || a<1 || d<1) return false;
  if(!String(card.source||"").trim()) return false;
  return !!(card.headline || card.path);
}
function factSourceLine(card){
  if(!isFact(card)) return "";
  const source=String(card.source||"").trim();
  const date=String(card.date||card.asOf||"").slice(0,10);
  const when=/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)?" · "+html(date):"";
  return '<p class="muted fact-source">'+html(source)+when+"</p>";
}
${cutoutSrc.toString()}
${tcgLink.toString()}
${pokemonFactLine.toString()}
${pricedMonCards.toString()}
${pokemonSlug.toString()}
function dayOk(v){ return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(String(v||"")); }
function priceOk(n){ return Number(n)>0; }
function isLag(card){
  if(!card || (card.readKind!=="lag" && card.kind!=="lag")) return false;
  const pack=card.pack, sealed=card.box||card.sealed;
  if(!pack || !sealed) return false;
  if(!priceOk(pack.from) || !priceOk(pack.to) || !priceOk(sealed.from) || !priceOk(sealed.to)) return false;
  if(!dayOk(pack.fromDate) || !dayOk(pack.toDate) || !dayOk(sealed.fromDate) || !dayOk(sealed.toDate)) return false;
  return !!(card.headline || card.path);
}
function isSupply(card){
  return !!(card && (card.readKind==="supply" || card.kind==="supply") && Number.isInteger(card.listings) && card.listings>=1);
}
function filesDisagree(card, other){
  if(!card || !other) return false;
  const left=Number(card.price), right=Number(other.price);
  if(left>0 && right>0 && Math.round(left*100)!==Math.round(right*100)) return true;
  if(Number.isInteger(card.listings) && Number.isInteger(other.listings) && card.listings!==other.listings) return true;
  return false;
}
${readStaleAgainstCard.toString()}
const bucketCache={};
let feedDay=null;
function computeFeedDay(){
  if(feedDay!==null) return feedDay;
  feedDay="";
  try{ (JSON.parse((document.getElementById("feed-lead")||{}).textContent||"[]")||[]).forEach(function(r){ const d=String(r&&r.asOf||"").slice(0,10); if(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d) && d>feedDay) feedDay=d; }); }catch(e){ feedDay=""; }
  return feedDay;
}
let lastVisitDay=null;
function lastFeedVisit(){
  if(lastVisitDay!==null) return lastVisitDay;
  lastVisitDay="";
  try{ lastVisitDay=String(localStorage.getItem("catchem-feed-last-day")||""); }catch(e){ lastVisitDay=""; }
  try{ const today=computeFeedDay(); if(today && today>lastVisitDay) localStorage.setItem("catchem-feed-last-day", today); }catch(e){}
  return lastVisitDay;
}
function isNewSinceVisit(row){
  const last=lastFeedVisit();
  if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(last)) return false;
  const d=String(row&&(row.asOf||row.date)||"").slice(0,10);
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d) && d>last;
}
async function publishedCard(sku){
  const id=String(sku||"");
  const n=Number((id.match(/([0-9]+)/)||[])[1]);
  if(!n) return null;
  const bucket=String(n%100).padStart(2,"0");
  if(!Object.prototype.hasOwnProperty.call(bucketCache, bucket)){
    try{
      const res=await fetch("/data/buckets/"+bucket+".json");
      bucketCache[bucket]=res.ok?await res.json():[];
    }catch(e){ bucketCache[bucket]=[]; }
  }
  const rows=bucketCache[bucket]||[];
  for(let i=0;i<rows.length;i++) if(rows[i] && rows[i].id===id) return rows[i];
  return null;
}
async function stalePrice(row){
  if(!row || !row.sku) return false;
  // A read built the same night as the card files cannot disagree with them,
  // so skip the 130 KB bucket fetch. Older reads still get checked.
  computeFeedDay();
  const asOf=String(row.asOf||"").slice(0,10);
  if(feedDay && asOf>=feedDay) return false;
  const card=await publishedCard(row.sku);
  return readStaleAgainstCard(row, card);
}
if(history.scrollRestoration) history.scrollRestoration="manual";
const GROUPS=[
  {id:"today",slug:"today",title:"Today",parts:["today"]},
  {id:"watch",slug:"watches",title:"Watches",parts:["watch"]},
  {id:"cook",slug:"cooks",title:"Cooks",parts:["cook"]},
  {id:"movers",slug:"movers",title:"Movers",parts:["up","down"]},
  {id:"tracked",slug:"tracked",title:"Tracked",parts:["tracked"]}
];
const SAID={up:"Up",sideways:"Sideways",down:"Down"};
const pages={};
let look=null;
const HOME_CAP=6;
const PAGE=24;
const cursor={};
let meta=null;
let catalogue=null;
let setBook=null;
let setIndex=null;
let rankAt=null;
let drawing=false;
function focusGroup(){
  const key=String(focus||"");
  return GROUPS.find(function(g){return g.id===key||g.slug===key})||null;
}
function filters(){
  const kind=document.getElementById("f-kind");
  if(!kind) return {kind:"",set:"",min:null,max:null,dir:"",sort:"move"};
  return {
    kind:kind.value,
    set:document.getElementById("f-set").value,
    min:Number(document.getElementById("f-min").value),
    max:Number(document.getElementById("f-max").value),
    dir:document.getElementById("f-dir").value,
    sort:document.getElementById("f-sort").value
  };
}
function filteringOn(f){
  return !!(f.kind||f.set||f.dir||(Number.isFinite(f.min)&&f.min>0)||(Number.isFinite(f.max)&&f.max>0));
}
function pass(card,f){
  if(!card) return false;
  if(f.kind && card.kind!==f.kind) return false;
  if(f.set && card.set!==f.set) return false;
  if(Number.isFinite(f.min) && f.min>0 && !(card.price>=f.min)) return false;
  if(Number.isFinite(f.max) && f.max>0 && !(card.price<=f.max)) return false;
  if(f.dir && card.direction && card.direction!==f.dir) return false;
  return true;
}
function chart(hist, caption){
  const el=document.createElement("div");
  el.className="chart-box";
  el.innerHTML='<div class="chart" style="height:180px;min-height:180px"></div><div class="filters" data-ranges><button type="button" data-range="7D">7D</button><button type="button" data-range="30D">30D</button><button type="button" data-range="90D">90D</button><button type="button" data-range="All" aria-pressed="true">All</button></div>';
  const host=el.querySelector(".chart");
  host.setAttribute("data-chart", JSON.stringify(hist||[]));
  host.setAttribute("data-caption", caption||"TCGplayer market");
  return el;
}
function changes(card){
  const bits=[];
  if(showPct(card.change7)) bits.push("<b>7D</b> "+pct(card.change7));
  if(showPct(card.change30)) bits.push("<b>30D</b> "+pct(card.change30));
  if(showPct(card.change90)) bits.push("<b>90D</b> "+pct(card.change90));
  return bits.join(" · ");
}
function winChip(label, n){
  if(!showPct(n) || !Number(n)) return "";
  const cls=Number(n)>0?"up":"down";
  return '<span class="win '+cls+'">'+label+" "+pct(n)+"</span>";
}
function priceRow(card){
  if(!(Number(card.price)>0)) return "";
  const day=monthDay(card.asOf);
  const year=String(card.asOf||"").slice(0,4);
  const stamp=day && /^[0-9]{4}$/.test(year)?'<span class="muted">'+day+", "+year+"</span>":"";
  const src=String(card.source||"").replace(/,? *[0-9]{4}-[0-9]{2}-[0-9]{2}( to)?/g,"").replace(/ *via +tcgcsv/i,"").replace(/[ ,;]+$/,"").trim();
  const srcBit=src?'<span class="muted"> · '+html(src)+"</span>":"";
  return '<p class="px"><span class="price">'+money(card.price)+"</span>"+stamp+srcBit+winChip("7D", card.change7)+winChip("30D", card.change30)+winChip("90D", card.change90)+"</p>";
}
function checkedLine(iso){
  const s=String(iso||"").slice(0,10);
  if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s)) return "";
  const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return "Checked "+months[Number(s.slice(5,7))-1]+" "+Number(s.slice(8,10))+", "+s.slice(0,4)+" PT";
}
function flagLine(card){
  const f=card.flagged;
  if(!f || !f.on) return "";
  if(f.first) return "Flagged "+html(f.on)+" at "+money(f.at)+".";
  const p=Number.isFinite(Number(f.pct))?(" ("+pct(f.pct)+")"):"";
  return "Flagged "+html(f.on)+" at "+money(f.at)+", now "+money(f.now)+p+".";
}
function voteLine(choice, counts){
  const up=Number(counts&&counts.up)||0;
  const side=Number(counts&&counts.sideways)||0;
  const down=Number(counts&&counts.down)||0;
  const total=up+side+down;
  const bits=[];
  if(SAID[choice]) bits.push("You said "+SAID[choice]);
  if(total>=10){
    const best=[{k:"Up",n:up},{k:"Sideways",n:side},{k:"Down",n:down}].sort(function(a,b){return b.n-a.n})[0];
    const share=Math.round((best.n/total)*100);
    if(share>0) bits.push("Community: "+share+"% "+best.k);
  }
  return bits.join(". ");
}
function supplyPreset(card){
  const n=Number(card&&card.listings);
  if(!(n>=20) || !card.listingsAsOf) return null;
  const low=Math.round(n*0.8);
  const high=Math.round(n*1.2);
  if(!(low>0) || !(high>low)) return null;
  return {low:low, high:high};
}
function listingsLine(card){
  const n=Number(card&&card.listings);
  if(!Number.isInteger(n) || n<1) return "";
  const day=String(card&&card.listingsAsOf||"").slice(0,10);
  if(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(day)) return "Active listings: "+n+" (as of "+day+")";
  return "Active listings: "+n;
}
function daySpan(days){
  if(days===7) return "7 days";
  if(days===30) return "30 days";
  if(days===90) return "90 days";
  if(days>0) return days+" days";
  return "this window";
}
function priorMoney(card){
  const now=Number(card.price);
  const pctN=Number(card.changePct);
  if(!(now>0) || !Number.isFinite(pctN)) return "";
  const denom=1+pctN/100;
  if(!(denom>0)) return "";
  const from=now/denom;
  return from>0?money(from):"";
}
${dropTitleName.toString()}
${readUnderTitle.toString()}
${withoutSoldClaim.toString()}
${isVolumeRow.toString()}
${shapeCash.toString()}
const SHAPE_KINDS=${JSON.stringify(SHAPE_KINDS)};
${isShapeRow.toString()}
${isSealedProductRow.toString()}
${shownRead.toString()}
${cardIdentity.toString()}
function setLine(card){
  const set=String(card&&card.set||"").trim();
  if(/^tcgcsv-\d+$/i.test(set) || /^pokemon-[a-z0-9-]+$/i.test(set)) return "";
  return set;
}
const ROTATED_SET=${JSON.stringify(rotatedSetKeys())};
function printRunLine(card){
  if(!card) return "";
  const slug=String(card.setSlug||"").trim().toLowerCase();
  const name=String(card.set||"").trim().toLowerCase();
  if((slug && ROTATED_SET[slug]) || (name && ROTATED_SET[name])) return ${JSON.stringify(PRINT_RUN_LINE)};
  return "";
}
function moveLine(card){
  if(!card) return "";
  if(!(isShapeRow(card) || isVolumeRow(card))){
    const head=String(card.headline||"").trim();
    const path=String(card.path||"").trim();
    if(head && head!==path && (head.indexOf("$")>=0 || head.indexOf("%")>=0)) return shownRead(Object.assign({}, card, {path: head}));
  }
  const path=String(card&&(card.path||card.headline)||"").trim();
  if(!path) return "";
  return shownRead(card);
}
function watchDay(iso){
  const t=Date.parse(String(iso||"").slice(0,10)+"T00:00:00Z");
  if(!Number.isFinite(t)) return "";
  const d=new Date(t+7*86400000);
  const months=["January","February","March","April","May","June","July","August","September","October","November","December"];
  return months[d.getUTCMonth()]+" "+d.getUTCDate();
}
function meansCopy(card){
  const line=moveLine(card);
  return line?[line]:[];
}
let catalogueImages=null;
${cataloguePath.toString()}
${browserAssetUrl.toString()}
${catalogueUrl.toString()}
${imageForId.toString()}
${tcgPid.toString()}
${ptcgFile.toString()}
${productTypeLabel.toString()}
${officialSrc.toString()}
${altAttr.toString()}
${nextImage.toString()}
${brandedTile.toString()}
${newsVariant.toString()}
${newsTile.toString()}
${newsLinkTarget.toString()}
function logoFor(card){
  return catalogueUrl(cataloguePath(catalogueImages, card&&card.id))||"";
}
function placeholder(setName){
  const ph=document.createElement("div");
  ph.className="set-ph";
  ph.textContent=setName||"Pokémon";
  return ph;
}
function staticTile(kind){
  const el=document.createElement("div");
  const k=kind==="sealed"?"sealed":"card";
  el.className="tile tile-"+k;
  el.setAttribute("role","img");
  el.setAttribute("aria-label","Catch'em");
  el.innerHTML='<span class="mark">Catch'+"'"+'em<span class="dot">.</span></span>';
  return el;
}
function safeTile(kind, card){
  try{
    const html=brandedTile(kind, card);
    const box=document.createElement("div");
    box.innerHTML=html;
    if(box.firstChild) return box.firstChild;
  }catch(e){}
  return staticTile(kind);
}
// News art: the logo of the set the headline names (same-origin /img only).
function newsArtSrc(card){
  try{
    if(!setBook || !card) return "";
    const t=" "+String(card.name||card.headline||"").toLowerCase()+" ";
    let best="", len=0;
    Object.keys(setBook.bySlug).forEach(function(slug){
      const tile=setBook.bySlug[slug];
      const n=String(tile && tile.name || "").toLowerCase();
      if(n.length<4 || n.length<=len || !tile.logo || String(tile.logo).charAt(0)!=="/") return;
      if(t.indexOf(n)>=0){ best=String(tile.logo); len=n.length; }
    });
    return best;
  }catch(e){ return ""; }
}
function safeNewsHtml(card){
  const row=card&&typeof card==="object"?Object.assign({}, card):{};
  if(!row.image){
    const art=newsArtSrc(row);
    if(art) row.logo=art;
  }
  if(!row.image && !row.logo){
    try{
      const hit=officialSrc(row, catalogueImages);
      if(hit && hit.src && String(hit.src).charAt(0)==="/") row.logo=hit.src;
    }catch(e){}
  }
  try{ return newsTile(row); }catch(e){}
  return '<div class="news-tile news-plain" role="img" aria-label="News"></div>';
}
function safeBrandHtml(kind, row){
  try{ return brandedTile(kind, row); }catch(e){}
  return '<div class="tile tile-card" role="img" aria-label="Catch'+"'"+'em"><span class="mark">Catch'+"'"+'em<span class="dot">.</span></span></div>';
}
function photoEl(card){
  const kind=card&&card.kind==="sealed"?"sealed":"card";
  // Deep reads about a whole set, era or rarity show that set's logo, never one stray card.
  if(card && card.readKind==="deep" && !card.sku){
    const logoSrc=(card.setSlug && setBook && setBook.bySlug[card.setSlug] && setBook.bySlug[card.setSlug].logo) || newsArtSrc(card);
    if(logoSrc && String(logoSrc).charAt(0)==="/"){
      const box=document.createElement("div");
      box.className="news-tile news-art";
      box.innerHTML='<img alt="" loading="lazy" src="'+html(logoSrc)+'">';
      return box;
    }
    return safeTile(kind, card);
  }
  try{
    const hit=officialSrc(card, catalogueImages);
    if(!hit || !hit.src) return safeTile(kind, card);
    const img=document.createElement("img");
    img.alt=card&&card.name?String(card.name):"";
    img.width=280;
    img.height=392;
    img.loading="eager";
    img.decoding="async";
    img.draggable=false;
    img.className="card-face";
    if(hit.crop) img.classList.add("is-skel");
    else img.className="is-skel";
    if(hit.alts&&hit.alts.length) img.setAttribute("data-alts", hit.alts.join("|"));
    img.src=hit.src;
    if(hit.crop) img.setAttribute("data-crop-card","1");
    img.onload=function(){
      img.classList.remove("is-skel");
      if(hit.crop && window.cropCardEdge) cropCardEdge(img);
    };
    img.onerror=function(){
      try{
        if(nextImage(img)) return;
        const next=safeTile(kind, card);
        if(img.replaceWith) img.replaceWith(next);
      }catch(e){}
    };
    return img;
  }catch(e){
    return staticTile(kind);
  }
}
function monthDay(iso){
  const s=String(iso||"").slice(0,10);
  if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s)) return "";
  const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return months[Number(s.slice(5,7))-1]+" "+Number(s.slice(8,10));
}
function watchCopy(card){
  const now=money(card.price);
  const when=watchDay(card.asOf);
  const bits=[];
  if(when && now) bits.push("Check on "+when+" and see if it is still near "+now+".");
  else if(now) bits.push("Check again in a week and see if it is still near "+now+".");
  return bits;
}
function dataFacts(card, facts){
  const row=facts && typeof facts==="object" ? facts : {};
  let high=Number(row.high);
  let low=Number(row.low);
  let highOn=row.highOn||"";
  let lowOn=row.lowOn||"";
  if(!(high>0) || !(low>0)){
    const hist=card.hist||[];
    for(let i=0;i<hist.length;i++){
      const v=Number(hist[i][1]);
      if(!(v>0)) continue;
      if(!(high>0) || v>high){ high=v; highOn=hist[i][0]; }
      if(!(low>0) || v<low){ low=v; lowOn=hist[i][0]; }
    }
  }
  return {
    high: high>0?high:null,
    highOn: highOn,
    low: low>0?low:null,
    lowOn: lowOn,
    listings: row.listings!=null?row.listings:card.listings,
    listingsAsOf: row.listingsAsOf||card.listingsAsOf||"",
    flagged: row.flagged||card.flagged||null
  };
}
function waveEl(card){
  const el=document.createElement("article");
  el.className="feed-card";
  el.id="r-"+card.id;
  const line=shownRead(card);
  const setName=setLine(card);
  const link=card.href?'<p><a href="'+html(card.href)+'">'+html(card.source||"Source")+"</a></p>":"";
  el.innerHTML=safeNewsHtml(card)+"<h2>"+html(card.name||card.headline||"Read")+"</h2>"+(setName?'<p class="card-meta">'+html(setName)+"</p>":"")+(line?'<p class="one-line">'+html(line)+"</p>":"")+link;
  return el;
}
function matterLines(card){
  if(!card) return null;
  const whyLine=card["whyItMatters"];
  const wrongLine=card["whatWouldMakeThisWrong"];
  if(whyLine && wrongLine) return {why:whyLine, wrong:wrongLine};
  const sku=String(card.sku||"");
  if(!/^tcgcsv-[0-9]+$/.test(sku)) return null;
  const asOf=String(card.asOf||"");
  const price=Number(card.price);
  const priceText=price>0?"$"+price.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}):"";
  const days=Number(card.windowDays);
  const change=Number(card.changePct);
  const head=String(card.headline||"");
  const hasChange=isFinite(change);
  let why="", wrong="";
  if(days===7 && hasChange && Math.abs(change)>=8 && priceText && asOf){
    why="TCGplayer market price, "+asOf+". Latest price "+priceText+".";
    wrong="";
  }else if(head.indexOf("6-month high")>=0){
    why="The sentence on this card already calls the latest price a 6-month high"+(priceText?" at "+priceText:"")+(asOf?" on "+asOf:"")+". Product id "+sku+".";
    wrong="";
  }else if(head.indexOf("6-month low")>=0){
    why="The sentence on this card already calls the latest price a 6-month low"+(priceText?" at "+priceText:"")+(asOf?" on "+asOf:"")+". Product id "+sku+".";
    wrong="";
  }else if(days===7 && hasChange && Math.abs(change)<8 && priceText && asOf){
    why="TCGplayer market price, "+asOf+". Latest price "+priceText+".";
    wrong="";
  }else if(head || priceText){
    why="This read is product id "+sku+(asOf?", as of "+asOf:"")+(priceText?", latest price "+priceText:"")+".";
    wrong="Wrong if the sentence names a different product than "+sku+". A listing is not a sale.";
  }
  if(!why||!wrong) return null;
  return {why:why, wrong:wrong};
}
function shipReady(card){
  const dir=card&&card.direction;
  const price=Number(card&&card.shipPrice);
  return (dir==="up"||dir==="down") && price>0;
}
const NUM_LABELS={low:"Low ask",high:"High ask",median:"Median ask",count:"Listings",basis:"Basis",from:"Start date",to:"End date",askFrom:"Start ask",askTo:"End ask",market:"TCGplayer market",startPrice:"Start price",endPrice:"End price",startDate:"Start date",endDate:"End date",shipPrice:"Price when posted"};
const TAKE_WORDS={up:"Trending up",dip:"Cooling",watch:"Watch",avoid:"Avoid for now",stretched:"Looks stretched"};
const TAKE_NOTE="A take is our read of the numbers, not advice.";
function isoDayOf(value){
  const s=String(value||"").slice(0,10);
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s)?s:"";
}
function cashOf(value){
  const x=Number(value);
  if(!Number.isFinite(x)||x<=0) return "";
  return "$"+x.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
}
function attr(s){
  return String(s==null?"":s).replace(/[&<>"']/g,function(c){
    if(c==="&") return "\u0026amp;";
    if(c==="<") return "\u0026lt;";
    if(c===">") return "\u0026gt;";
    if(c==='"') return "\u0026quot;";
    return "\u0026#39;";
  });
}
function pointDate(point){
  if(Array.isArray(point)) return isoDayOf(point[0]);
  if(point && typeof point==="object") return isoDayOf(point.date||point.d);
  return "";
}
function pointValue(point){
  if(Array.isArray(point)) return point[1];
  if(point && typeof point==="object"){
    if(point.price!=null) return point.price;
    if(point.v!=null) return point.v;
    return point.market;
  }
  return null;
}
function chartPointsOf(card){
  const pts=[];
  const seen={};
  function add(date, value){
    const d=isoDayOf(date);
    const v=Number(value);
    if(!d||!(v>0)||seen[d]) return;
    seen[d]=1;
    pts.push({d:d,v:v});
  }
  const hist=Array.isArray(card&&card.hist)?card.hist:[];
  for(let i=0;i<hist.length;i++) add(pointDate(hist[i]), pointValue(hist[i]));
  const series=Array.isArray(card&&card.run)&&card.run.length?card.run:(Array.isArray(card&&card.days)?card.days:[]);
  if(pts.length<2){
    for(let i=0;i<series.length;i++) add(pointDate(series[i]), pointValue(series[i]));
  }
  const rec=card&&card.receipt&&typeof card.receipt==="object"?card.receipt:{};
  if(pts.length<2 && (rec.askFrom!=null||rec.askTo!=null)){
    add(rec.from, rec.askFrom);
    add(rec.to, rec.askTo);
  }else if(pts.length<2 && (rec.marketFrom!=null||rec.marketTo!=null)){
    add(rec.from, rec.marketFrom);
    add(rec.to, rec.marketTo);
  }else if(pts.length<2){
    add(card&&card.startDate, card&&(card.fromPrice!=null?card.fromPrice:card.startPrice));
    add(card&&(card.endDate||card.asOf), card&&(card.toPrice!=null?card.toPrice:(card.endPrice!=null?card.endPrice:card.price)));
  }
  pts.sort(function(a,b){ return a.d<b.d?-1:a.d>b.d?1:0; });
  return pts;
}
var READ_YEAR=(function(){try{var el=document.getElementById("read-year");return el?JSON.parse(el.textContent):null;}catch(e){return null;}})();
function readChartHtml(card){
  if(card && typeof card.yearChart==="string" && card.yearChart) return card.yearChart;
  if(card && READ_YEAR && READ_YEAR.html && String(card.id)===String(READ_YEAR.id)) return READ_YEAR.html;
  const pts=chartPointsOf(card);
  if(pts.length<2) return "";
  const rec=card&&card.receipt&&typeof card.receipt==="object"?card.receipt:{};
  const marks=[];
  const start=isoDayOf((card&&card.startDate)||rec.from);
  const end=isoDayOf((card&&card.endDate)||rec.to||(card&&card.asOf));
  function has(d){ for(let i=0;i<pts.length;i++) if(pts[i].d===d) return true; return false; }
  if(start && has(start)) marks.push(start);
  if(end && end!==start && has(end)) marks.push(end);
  const span=Math.round((Date.parse(pts[pts.length-1].d+"T00:00:00Z")-Date.parse(pts[0].d+"T00:00:00Z"))/86400000)+1;
  function inRange(name){
    if(name==="All") return pts.length;
    const days=name==="7D"?7:name==="30D"?30:name==="90D"?90:365;
    const cut=new Date(Date.parse(pts[pts.length-1].d+"T00:00:00Z")-(days-1)*86400000).toISOString().slice(0,10);
    let n=0;
    for(let i=0;i<pts.length;i++) if(pts[i].d>=cut) n++;
    return n;
  }
  const names=[];
  if(span>=7 && inRange("7D")>=2) names.push("7D");
  if(span>=30 && inRange("30D")>=2) names.push("30D");
  if(span>=90 && inRange("90D")>=2) names.push("90D");
  if(span>=365 && inRange("1Y")>=2) names.push("1Y");
  if(inRange("All")>=2) names.push("All");
  let buttons="";
  for(let i=0;i<names.length;i++){
    const name=names[i];
    buttons+='<button type="button" data-range="'+name+'"'+(name==="All"?' aria-pressed="true"':"")+">"+name+"</button>";
  }
  const kind=String(card&&(card.readKind||card.kind)||"");
  const caption=kind==="spread"||kind==="askmove"?"eBay asks":"TCGplayer market, daily";
  const payload=[];
  for(let i=0;i<pts.length;i++) payload.push([pts[i].d, pts[i].v]);
  return '<div class="chart-box chart-sm"><div class="chart" data-h="140" data-caption="'+attr(caption)+'" data-marks="'+attr(marks.join(","))+'" data-chart="'+attr(JSON.stringify(payload))+'" style="height:140px;min-height:140px"></div>'+(buttons?'<div class="filters" data-ranges>'+buttons+"</div>":"")+'<p class="chart-note muted"></p></div>';
}
function scrubMethodC(t){
  return String(t||"").split(". ").filter(function(x){ return x && !/(need|at least|or more|or less|threshold|cutoff|counted by|matched by|nearest|rule|weight|scor|must |only if|is set at)/i.test(x); }).join(". ").trim();
}
function numbersBlock(card){
  if(!card || typeof card!=="object") return "";
  const rec=card.receipt&&typeof card.receipt==="object"?card.receipt:{};
  const rows=[];
  const sources=[];
  function addSource(name){
    const s=String(name||"").trim();
    if(s && sources.indexOf(s)<0) sources.push(s);
  }
  function addMoney(label, value, date, source){
    const cash=cashOf(value);
    if(!cash) return;
    rows.push({label:label, value:cash, date:isoDayOf(date)});
    addSource(source);
  }
  function addCount(label, value, date, source){
    const n=Number(value);
    if(!Number.isInteger(n)||n<0) return;
    rows.push({label:label, value:String(n), date:isoDayOf(date)});
    addSource(source);
  }
  const askDate=isoDayOf(rec.asOf||rec.date||card.asOf);
  if(rec.low!=null||rec.high!=null||rec.median!=null||rec.count!=null){
    addMoney("Ask low", rec.low, askDate, "eBay asks");
    addMoney("Ask high", rec.high, askDate, "eBay asks");
    addMoney("Ask median", rec.median, askDate, "eBay asks");
    addCount("Listing count", rec.count, askDate, "eBay asks");
    if(rec.basis) rows.push({label:"Basis", value:String(rec.basis), date:askDate});
  }
  if(rec.askFrom!=null||rec.askTo!=null){
    addMoney("Ask, start", rec.askFrom, rec.from, "eBay asks");
    addMoney("Ask, end", rec.askTo, rec.to, "eBay asks");
    addMoney("Market price", rec.market, rec.to||card.asOf, "TCGplayer market");
  }
  if(rec.marketFrom!=null||rec.marketTo!=null){
    addMoney("Start price", rec.marketFrom, rec.from, "TCGplayer market");
    addMoney("End price", rec.marketTo, rec.to, "TCGplayer market");
    addMoney("Ask", rec.ask, rec.to||card.asOf, "eBay asks");
  }
  const priced=rows.some(function(row){ return row.label==="Start price"||row.label==="End price"||row.label==="Market price"; });
  if(!priced){
    addMoney("Start price", card.fromPrice!=null?card.fromPrice:card.startPrice, card.startDate, card.source||"TCGplayer market");
    addMoney("End price", card.toPrice!=null?card.toPrice:(card.endPrice!=null?card.endPrice:card.price), card.endDate||card.asOf, card.source||"TCGplayer market");
  }
  if(!rows.some(function(row){ return row.label==="End price"||row.label==="Market price"||row.label==="Ask, end"; })){
    addMoney("Price", card.price, card.asOf||card.endDate, card.source||"");
  }
  if(isoDayOf(card.startDate)) rows.push({label:"Start date", value:isoDayOf(card.startDate), date:""});
  if(isoDayOf(card.endDate)) rows.push({label:"End date", value:isoDayOf(card.endDate), date:""});
  if(card.source) addSource(card.source);
  const kind=String(card.readKind||card.kind||card.signal||"");
  const series=kind==="streak"?(Array.isArray(card.run)&&card.run.length?card.run:(Array.isArray(card.days)?card.days:[])):[];
  const days=[];
  for(let i=0;i<series.length;i++){
    const date=pointDate(series[i]);
    const cash=cashOf(pointValue(series[i]));
    if(date && cash) days.push({date:date, cash:cash});
  }
  const path=String(card.path||"").trim();
  const whyRaw=scrubMethodC(String(card["whyItMatters"]||card["why"]||"").trim());
  const why=whyRaw && whyRaw!==path?whyRaw:"";
  const wrong=scrubMethodC(String(card["whatWouldMakeThisWrong"]||"").trim());
  const take=TAKE_WORDS[String(card.take||"")]||"";
  const line=String(card.sourceLine||"").trim();
  const chart=readChartHtml(card);
  if(!rows.length && !days.length && !why && !wrong && !take && !line && !chart && !sources.length) return "";
  let list="";
  for(let i=0;i<rows.length;i++){
    const row=rows[i];
    list+="<li><b>"+attr(row.label)+"</b> "+attr(row.value)+(row.date?' <span class="muted">'+attr(row.date)+"</span>":"")+"</li>";
  }
  let dayList="";
  for(let i=0;i<days.length;i++) dayList+="<li>"+attr(days[i].date)+" "+attr(days[i].cash)+"</li>";
  let sourceHtml="";
  for(let i=0;i<sources.length;i++) sourceHtml+="<p>"+attr(sources[i])+"</p>";
  return '<section class="numbers-block">'+(take?'<p class="take-label">'+attr(take)+'</p><p class="take-foot">'+attr(TAKE_NOTE)+"</p>":"")+'<h4>The numbers</h4>'+(list?'<ul class="numbers">'+list+"</ul>":"")+sourceHtml+(line?'<p class="source-line">'+attr(line)+"</p>":"")+(why?"<p><b>Why.</b> "+attr(why)+"</p>":"")+(wrong?"<p><b>What would make this wrong.</b> "+attr(wrong)+"</p>":"")+(dayList?'<p><b>Every day in the run</b></p><ul class="streak-days">'+dayList+"</ul>":"")+chart+"</section>";
}
function moreBlock(card){
  if(!card) return "";
  return numbersBlock(card);
}
function productIdOf(card){
  const sku=String(card&&card.sku||"");
  if(/^tcgcsv-[0-9]+$/.test(sku)) return sku;
  const href=String(card&&card.href||"");
  const m=href.match(new RegExp("/(?:c|p)/(tcgcsv-[0-9]+)"));
  return m?m[1]:"";
}
function mountMon(){
  return;
}
function newsDetailHtml(){
  return "";
}
function newsTrackChip(card){
  const sets=[];
  if(setBook && setBook.bySlug){
    Object.keys(setBook.bySlug).forEach(function(slug){
      const tile=setBook.bySlug[slug];
      if(tile && tile.name) sets.push({slug:slug, name:String(tile.name)});
    });
  }
  const products=[];
  const sealed=sealedList();
  for(let i=0;i<sealed.length;i++){
    const row=sealed[i];
    const sku=String(row&&row.sku||"");
    let id="";
    if(/^tcgcsv-[0-9]+$/.test(sku)) id=sku;
    else {
      const m=String(row&&row.id||"").match(/tcgcsv-([0-9]+)/);
      if(m) id="tcgcsv-"+m[1];
    }
    if(id && row && row.name) products.push({id:id, name:String(row.name)});
  }
  const hit=newsLinkTarget(card, sets, products);
  if(!hit || !hit.href || !hit.label) return "";
  return '<p class="news-chip"><a class="vchip" href="'+html(hit.href)+'">'+html(hit.label)+"</a></p>";
}
function newsEl(card){
  const el=document.createElement("article");
  el.className="feed-card news-card";
  el.id="r-"+card.id;
  const place=String(card.place||"").trim();
  const kicker='<p class="news-kicker"><span class="k">NEWS</span>'+(place?'<span class="tag">'+html(place)+"</span>":"")+"</p>";
  const sum=String(card.summary||"").trim();
  const blurb=sum?'<p class="news-sum">'+html(sum)+"</p>":"";
  const when=String(card.dayLabel||"").trim();
  const source=String(card.source||"").trim();
  const metaBits=[];
  if(source) metaBits.push(html(source));
  if(when) metaBits.push(html(when));
  const by=metaBits.length?'<p class="news-by">'+metaBits.join(" · ")+"</p>":"";
  const link=card.href?'<a class="news-go" href="'+html(card.href)+'">Read at '+html(source||"the source")+"</a>":"";
  const chip=newsTrackChip(card);
  el.innerHTML=kicker+"<h2>"+html(card.name||"")+"</h2>"+by+blurb+chip+(link?'<div class="news-acts">'+link+"</div>":"");
  bindShare(el, card);
  const share=el.querySelector("button");
  const acts=el.querySelector(".news-acts");
  if(share && acts) acts.appendChild(share);
  return el;
}
function factCutLine(card){
  const src=cutoutSrc(card);
  if(src) return '<img class="cutout" alt="'+html(String(card&&card.name||""))+'" width="220" height="220" loading="lazy" decoding="async" src="'+html(src)+'">';
  try{ return brandedTile("card",{kind:"single",name:card&&card.name}); }
  catch(e){ return safeBrandHtml("card",{kind:"single",name:card&&card.name}); }
}
function factPhoto(card){
  try{
    const hit=officialSrc(card, catalogueImages);
    if(!hit || !hit.src) return null;
    return photoEl(card);
  }catch(e){ return null; }
}
function bindShare(el, card){
  var btn=document.createElement("button");
  btn.type="button";
  btn.textContent="Share";
  btn.addEventListener("click", function(ev){
    ev.preventDefault();
    ev.stopPropagation();
    var canvas=document.createElement("canvas");
    canvas.width=1080;
    canvas.height=1350;
    var pen=canvas.getContext("2d");
    pen.fillStyle="#12100e";
    pen.fillRect(0,0,1080,1350);
    pen.fillStyle="#d9b779";
    pen.font="700 64px Georgia, serif";
    pen.fillText("Catch'em", 72, 100);
    var img=el.querySelector("img");
    var y=170;
    var src=img?String(img.currentSrc||img.src||""):"";
    var same=src.indexOf(location.origin)===0;
    if(img && same && img.complete && img.naturalWidth){
      try { pen.drawImage(img, 390, 150, 300, 420); y=620; } catch(err) {}
    }
    pen.fillStyle="#efe9de";
    pen.font="36px Georgia, serif";
    var sentence=el.querySelector(".one-line") || el.querySelector("h2");
    var text=sentence?sentence.textContent:String(card.headline||"");
    var words=String(text||"").split(" ");
    var cur="";
    words.forEach(function(word){
      if(!cur){ cur=word; return; }
      if((cur+" "+word).length<=40) cur=cur+" "+word;
      else { if(y<1160) pen.fillText(cur, 72, y); y+=48; cur=word; }
    });
    if(cur && y<1160){ pen.fillText(cur, 72, y); y+=56; }
    pen.fillStyle="#c4baab";
    pen.font="28px Georgia, serif";
    pen.fillText(String(card.asOf||""), 72, 1220);
    pen.fillText(String(card.source||"TCGplayer market"), 72, 1260);
    pen.fillText("catchemtcg.com/feed", 72, 1300);
    var link=document.createElement("a");
    link.href=canvas.toDataURL("image/png");
    link.download="catchem-read.png";
    link.click();
  });
  el.appendChild(btn);
}
// Deep read: a short headline, then 3 to 6 lines and a small chart behind one tap.
function deepChartSvg(chart){
  if(!chart) return "";
  const W=320,H=96,P=8;
  if(Array.isArray(chart.points) && chart.points.length>=2){
    const vals=chart.points.map(function(p){return Number(p[1]);});
    const lo=Math.min.apply(null, vals), hi=Math.max.apply(null, vals);
    const span=hi-lo||1;
    const xy=chart.points.map(function(p,i){
      const x=P+(i*(W-2*P))/(chart.points.length-1);
      const y=H-P-((Number(p[1])-lo)/span)*(H-2*P);
      return x.toFixed(1)+","+y.toFixed(1);
    });
    const first=chart.points[0][0], last=chart.points[chart.points.length-1][0];
    return '<figure class="deep-chart"><svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+html(chart.label||"Chart")+'"><defs><linearGradient id="dg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9b779" stop-opacity=".35"/><stop offset="1" stop-color="#d9b779" stop-opacity="0"/></linearGradient></defs><polygon fill="url(#dg)" points="'+P+','+(H-P)+' '+xy.join(" ")+' '+(W-P)+','+(H-P)+'"/><polyline fill="none" stroke="#d9b779" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="'+xy.join(" ")+'"/></svg><figcaption>'+html(chart.label||"")+" · "+html(first)+" to "+html(last)+"</figcaption></figure>";
  }
  if(Array.isArray(chart.bars) && chart.bars.length){
    const max=Math.max.apply(null, chart.bars.map(function(b){return Math.abs(Number(b[1]))||0;}))||1;
    const rows=chart.bars.map(function(b){
      const v=Number(b[1]);
      const w=Math.max(2, Math.round((Math.abs(v)/max)*100));
      const thumb=b[2]?'<img class="card-thumb" alt="" src="'+html(b[2])+'">':"";
      return '<div class="deep-bar"><span class="deep-bar-l">'+thumb+html(b[0])+'</span><span class="deep-bar-t"><i class="'+(v<0?"neg":"pos")+'" style="width:'+w+'%"></i></span><span class="deep-bar-v">'+html(String(v))+"</span></div>";
    }).join("");
    return '<figure class="deep-chart">'+rows+"<figcaption>"+html(chart.label||"")+"</figcaption></figure>";
  }
  return "";
}
function deepEl(card){
  const el=document.createElement("article");
  el.className="feed-card deep-card";
  el.id="r-"+card.id;
  const faces=Array.isArray(card.lineCards)?card.lineCards:[];
  const lines=(Array.isArray(card.lines)?card.lines:[]).slice(0,6).map(function(l,i){
    const row=faces[i]||{};
    const pics=Array.isArray(row.cards)?row.cards:(row.image?[{image:row.image}]:[]);
    const thumbs=pics.filter(function(c){return c&&c.image;}).map(function(c){return '<img class="card-thumb" alt="" src="'+html(c.image)+'">';}).join("");
    return '<li class="deep-line">'+thumbs+"<span>"+html(l)+"</span></li>";
  }).join("");
  const go=card.href&&!/^https?:/.test(card.href)?'<p><a class="open-data" href="'+html(openDataHref(card))+'">Open it</a></p>':"";
  el.innerHTML='<p class="news-kicker"><span class="k">DEEP READ</span></p><h2>'+html(card.headline||card.name||"")+'</h2><details class="deep-more"><summary>Tap for the full read</summary><ul class="deep-lines">'+lines+"</ul>"+deepChartSvg(card.chart)+'<p class="muted">'+html(card.source||"")+"</p></details>"+go;
  bindShare(el, card);
  return el;
}
function cardEl(card, facts){
  if(card && card.waveItem) return waveEl(card);
  if(card && (card.readKind==="deep" || card.kind==="deep")) return deepEl(card);
  if(card && (card.readKind==="news" || card.kind==="news")) return newsEl(card);
  const el=document.createElement("article");
  el.className="feed-card";
  el.id="r-"+card.id;
  const kindName=String(card.readKind||card.kind||"");
  const src=isVolumeRow(card)?card.sold.source+", Near Mint, "+card.sold.window30d.from+" to "+card.sold.window30d.to:(card.source?card.source+(card.asOf?", "+card.asOf:""):(kindName==="spread"||kindName==="askmove"?"eBay asks"+(card.asOf?", "+card.asOf:""):("TCGplayer market"+(card.asOf?", "+card.asOf:""))));
  const supply=supplyPreset(card);
  const readHref="/feed/r/"+encodeURIComponent(card.id);
  const line=isFact(card)?pokemonFactLine(card):moveLine(card);
  const setName=setLine(card);
  const face=isFact(card)?factPhoto(card):null;
  const headline=String(card.headline||"").trim();
  const pathText=String(card.path||"").trim();
  const sameSentence=isFact(card) && headline && headline===pathText ? headline : "";
  const shown=sameSentence||line;
  const run=printRunLine(card);
  const runHtml=run?'<p class="print-run">'+html(run)+' <a href="/rotation">Rotation and print runs</a>.</p>':"";
  const title=html(card.name||(isVolumeRow(card)||isShapeRow(card)?card.headline:withoutSoldClaim(card.headline))||"Read");
  const pid=productIdOf(card);
  const h2=pageMode==="read"?"<h2>"+title+"</h2>":(pid?'<h2><a href="'+readHref+'" data-quick="'+html(pid)+'">'+title+"</a></h2>":'<h2><a href="'+readHref+'">'+title+"</a></h2>");
  const open='<p><a class="open-data" href="'+html(openDataHref(card))+'">Open the data</a></p>';
  const diveId=diveIdFor(card);
  const diveLink=diveId?'<p><a class="open-data" href="/dive/'+encodeURIComponent(diveId)+'">Deeper look</a> · <a href="/dive/'+encodeURIComponent(diveId)+'">See the chart</a></p>':"";
  const cut=isFact(card)?(face?"":factCutLine(card)):"";
  const vchips=(card.tags||[]).length?'<div class="vchips sm" aria-label="Variant">'+card.tags.map(function(t){return '<a class="vchip" href="/search?tag='+encodeURIComponent(t)+'">'+html(t)+'</a>';}).join("")+'</div>':"";
  const head=h2+vchips+(setName?'<p class="card-meta">'+html(setName)+"</p>":"")+(shown?'<p class="one-line">'+html(shown)+"</p>":"")+runHtml+cut+(isFact(card)?factSourceLine(card):priceRow(card));
  if(pageMode!=="read"){
    el.innerHTML=head+open+diveLink;
    if(isFact(card)){
      el.classList.add("fact-card");
      if(face) el.insertBefore(face, el.firstChild);
      mountMon(el, card);
    }
    else {
      const photo=photoEl(card);
      if(photo) el.insertBefore(photo, el.firstChild);
    }
    if(pid) el.setAttribute("data-quick", pid);
    el.addEventListener("click", function(ev){
    if(el.dataset.swipe==="1"){ el.dataset.swipe=""; return; }
      const node=ev["tar"+"get"];
      if(node && node.closest("button, a, form, input, select, label")) return;
      if(pid) return;
      remember();
      location.href=readHref;
    });
    const nameLink=el.querySelector("h2 a");
    if(nameLink) nameLink.addEventListener("click", remember);
    bindShare(el, card);
    return el;
  }
  if(isFact(card)){
    el.classList.add("fact-card");
    el.innerHTML=head;
    if(face) el.insertBefore(face, el.firstChild);
    mountMon(el, card);
    bindShare(el, card);
    return el;
  }
  const info=dataFacts(card, facts);
  const bits=[];
  const hi=[];
  if(info.high) hi.push("▲ high "+money(info.high)+(info.highOn?" on "+monthDay(info.highOn):""));
  if(info.low) hi.push("▼ low "+money(info.low)+(info.lowOn?" on "+monthDay(info.lowOn):""));
  if(hi.length) bits.push("<p>"+html(hi.join(". ")+".")+"</p>");
  const listed=listingsLine({listings: info.listings, listingsAsOf: info.listingsAsOf});
  if(listed) bits.push('<p class="muted">'+html(listed.replace("Active listings", "Listings for sale"))+"</p>");
  const flagged=flagLine(Object.assign({}, card, {flagged: info.flagged}));
  const checked=checkedLine(card.asOf);
  if(flagged && checked) bits.push("<p>"+flagged+" "+html(checked)+"</p>");
  else if(flagged) bits.push("<p>"+flagged+"</p>");
  else if(checked) bits.push('<p class="muted">'+html(checked)+"</p>");
  bits.push('<p class="muted">'+html(src)+"</p>");
  const extra=shortFor(card);
  const supplyBox=supply?'<label><input type="checkbox" data-opt="listings" checked> Listings move 20% either way, below '+supply.low+" or above "+supply.high+"</label>":"";
  const supplyFields=supply?'<input name="listingsBelow" inputmode="numeric" aria-label="Listings below" value="'+supply.low+'"><input name="listingsAbove" inputmode="numeric" aria-label="Listings above" value="'+supply.high+'">':"";
  const voteLabel="Where's it heading?";
  const dmLine="We'll DM you on Discord.";
  let numbers=numbersBlock(card);
  const extraBits=bits.join("")+(extra?"<p>"+extra+"</p>":"");
  if(extraBits){
    if(numbers) numbers=numbers.replace("</section>", extraBits+"</section>");
    else numbers='<section class="numbers-block"><h4>The numbers</h4>'+extraBits+"</section>";
  }
  el.innerHTML=head+diveLink+numbers+'<button type="button" data-act="track">Track</button><div class="vote-block"><p class="vote-q">'+voteLabel+'</p><div class="feed-acts"><button type="button" data-vote="up">Up</button><button type="button" data-vote="sideways">Sideways</button><button type="button" data-vote="down">Down</button></div><p class="vote muted"></p></div><form class="track-sheet"><p>'+dmLine+'</p><label><input type="checkbox" data-opt="price" checked> Price moves 10% either way</label>'+supplyBox+'<button type="button" data-act="custom">Customize</button><div class="custom" hidden><input name="pct" inputmode="decimal" aria-label="Percent" placeholder="Percent" value="10"><input name="price" inputmode="decimal" aria-label="Price" placeholder="Price"><select name="direction" aria-label="Which way"><option value="either">Either way</option><option value="up">Up</option><option value="down">Down</option></select>'+supplyFields+'</div><button type="submit">Save</button><p class="sheet-note muted"></p></form>';
  const readPhoto=photoEl(card);
  if(readPhoto) el.insertBefore(readPhoto, el.firstChild);
  const sheet=el.querySelector(".track-sheet");
  const note=sheet.querySelector(".sheet-note");
  const trackBtn=el.querySelector("[data-act=track]");
  function alertBody(extraBody){
    return Object.assign({
      id:card.id,
      sku:card.sku||"",
      name:card.name||"",
      headline:card.headline||"",
      market:card.price,
      listings:card.listings,
      listingsAsOf:card.listingsAsOf||"",
      changePct:card.changePct,
      change7:card.change7,
      kind:card.kind||"",
      href:card.href||""
    }, extraBody||{});
  }
  function saveAlert(body){
    try {
      var key="catchem-watch";
      var cur=JSON.parse(localStorage.getItem(key)||"[]");
      if(!Array.isArray(cur)) cur=[];
      var id=body.sku||body.id;
      cur=cur.filter(function(row){return (row.sku||row.id)!==id && row.id!==body.id});
      cur.unshift(body);
      localStorage.setItem(key, JSON.stringify(cur.slice(0,25)));
      note.textContent="Saved on this device.";
    } catch (err) {
      note.textContent="This browser did not store the save.";
    }
    fetch("/api/alerts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)})
      .then(function(res){return res.json().then(function(j){return {ok:res.ok,j:j}})})
      .then(function(res){
        if(!res.ok) return;
        sheet.classList.remove("open");
        trackBtn.textContent="Tracking";
        let done=el.querySelector(".track-done");
        if(!done){
          done=document.createElement("p");
          done.className="track-done";
          trackBtn.insertAdjacentElement("afterend", done);
        }
        done.textContent="Tracking. We'll DM you.";
        note.textContent="";
      })
      .catch(function(){});
  }
  trackBtn.onclick=function(){
    const opened=sheet.classList.contains("open");
    document.querySelectorAll(".track-sheet.open").forEach(function(s){ s.classList.remove("open"); });
    if(opened) return;
    document.body.appendChild(sheet);
    sheet.classList.add("open");
  };
  sheet.querySelector("[data-act=custom]").onclick=function(){
    const box=sheet.querySelector(".custom");
    box.hidden=!box.hidden;
  };
  el.querySelectorAll("[data-vote]").forEach(function(btn){
    btn.onclick=function(){
      const voteNote=el.querySelector(".vote");
      fetch("/api/vote",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:card.id,vote:btn.dataset.vote})})
        .then(function(res){return res.json().then(function(j){return {ok:res.ok,j:j}})})
        .then(function(res){
          if(!res.ok){ voteNote.textContent=res.j.error||"Votes are not open yet."; return; }
          voteNote.textContent=voteLine(btn.dataset.vote, res.j);
        })
        .catch(function(){ voteNote.textContent="Votes are not open yet."; });
    };
  });
  sheet.onsubmit=function(ev){
    ev.preventDefault();
    const priceOn=!!sheet.querySelector("[data-opt=price]").checked;
    const listBox=sheet.querySelector("[data-opt=listings]");
    const listOn=!!(listBox && listBox.checked);
    const custom=!sheet.querySelector(".custom").hidden;
    const price=custom?sheet.price.value:"";
    const pct=priceOn?(custom && sheet.pct.value!==""?sheet.pct.value:10):"";
    const direction=custom?sheet.direction.value:"either";
    let below="";
    let above="";
    if(listOn && supply){
      below=custom && sheet.listingsBelow?sheet.listingsBelow.value:supply.low;
      above=custom && sheet.listingsAbove?sheet.listingsAbove.value:supply.high;
    }
    if(!priceOn && !listOn && !(Number(price)>0)){
      note.textContent="Choose a price move or a listings move.";
      return;
    }
    saveAlert(alertBody({
      price:price,
      pct:pct,
      direction:direction,
      listingsBelow:below,
      listingsAbove:above
    }));
  };
  bindShare(el, card);
  return el;
}
function trackedEl(row){
  const el=document.createElement("article");
  el.className="feed-card";
  const p=Number.isFinite(Number(row.pct))?(" ("+pct(row.pct)+")"):"";
  el.innerHTML='<h2>'+html(row.claim)+'</h2><p>Flagged '+html(row.printed_on)+' at '+money(row.price_at_flag)+', now '+money(row.price_now)+p+'.</p><p class="muted">TCGplayer market, '+html(row.price_as_of||row.printed_on)+'</p>';
  return el;
}
function listFor(part){
  const f=filters();
  if(catalogue){
    if(part==="tracked") return (catalogue.tracked||[]).filter(function(row){return !f.dir || row.direction===f.dir});
    const ids=catalogue[part]||[];
    let rows=ids.map(function(id){return catalogue.cards[id]}).filter(function(card){return pass(card,f)});
    return rows;
  }
  return (pages[part]||[]).filter(function(card){return pass(card,f)});
}
function fits(card, group){
  if(!card) return false;
  if(group.id==="tracked") return true;
  const days=Number(card.windowDays);
  if(!days) return true;
  const abs=Math.abs(Number(card.changePct)||0);
  if(group.id==="cook") return days===90;
  if(group.id==="watch") return days===30;
  if(group.id==="movers") return days===7 && abs>=8;
  if(group.id==="today") return days===7 && abs<8;
  return true;
}
function combined(group){
  const rows=[];
  const seen=new Set();
  for(const part of group.parts){
    for(const row of listFor(part)){
      if(!fits(row, group)) continue;
      const key=row.id||row.call_id||row.headline||row.claim;
      if(seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }
  const f=filters();
  if(f.sort==="price") rows.sort(function(a,b){return (b.price||0)-(a.price||0)});
  else if(f.sort==="name") rows.sort(function(a,b){return String(a.name||a.headline||a.claim).localeCompare(String(b.name||b.headline||b.claim))});
  else if(group.id==="movers") rows.sort(function(a,b){return Math.abs(b.score||b.changePct||b.pct||0)-Math.abs(a.score||a.changePct||a.pct||0)});
  return rows;
}
function sectionCount(group){
  const f=filters();
  if(catalogue || filteringOn(f)) return combined(group).length;
  if(meta && meta.sections){
    const n=group.parts.reduce(function(s,p){return s+(Number(meta.sections[p])||0)},0);
    if(n>0) return n;
  }
  return combined(group).length;
}
async function loadSlice(part, n){
  const key=part+"#"+n;
  if(Object.prototype.hasOwnProperty.call(pages, key)) return;
  let rows=[];
  try{
    const res=await fetch("/data/feed/"+part+"/"+n+".json");
    if(res.ok){
      const data=await res.json();
      if(Array.isArray(data)) rows=data;
    }
  }catch(e){}
  pages[key]=rows;
  const merged=[];
  for(let i=0;i<=n;i++){
    const slice=pages[part+"#"+i];
    if(!slice) break;
    merged.push(...slice);
  }
  pages[part]=merged;
  if(part==="today" && !merged.length && lead.length) pages.today=lead.slice();
}
async function ensure(group, want){
  if(catalogue) return;
  for(const part of group.parts){
    let n=0;
    while((pages[part]||[]).length<want){
      const before=(pages[part]||[]).length;
      const total=meta&&meta.sections?Number(meta.sections[part]||0):0;
      if(total && before>=total) break;
      if(Object.prototype.hasOwnProperty.call(pages, part+"#"+n)){
        if((pages[part]||[]).length>=(n+1)*PAGE){ n++; continue; }
        break;
      }
      await loadSlice(part, n);
      if((pages[part]||[]).length===before) break;
      n++;
    }
  }
}
function paint(group, details, index){
  const rows=combined(group).filter(function(row){
    const id=row.id||row.call_id;
    const node=id&&document.getElementById("r-"+id);
    return !(node && !details.contains(node));
  });
  const pile=details.querySelector(".pile");
  const span=details.querySelector("summary span");
  const count=sectionCount(group);
  if(span) span.textContent=count>0?count.toLocaleString("en-US"):"";
  let i=Number(index);
  if(!Number.isFinite(i) || i<0) i=0;
  if(rows.length && i>=rows.length) i=rows.length-1;
  cursor[group.id]=i;
  pile.innerHTML="";
  const row=rows[i];
  if(row) pile.appendChild(row.claim && !row.headline ? trackedEl(row) : cardEl(row));
  if(typeof catchemMount==="function") catchemMount(pile);
  const total=count>0?count:rows.length;
  const nav=document.createElement("div");
  nav.className="read-nav";
  const prev=document.createElement("button");
  prev.type="button";
  prev.textContent="Previous";
  prev.disabled=i<=0;
  prev.onclick=function(){ paint(group, details, i-1); };
  const next=document.createElement("button");
  next.type="button";
  next.textContent="Next";
  next.disabled=i+1>=total;
  next.onclick=async function(){
    if(i+1>=rows.length) await ensure(group, rows.length+1);
    paint(group, details, i+1);
  };
  nav.appendChild(prev);
  nav.appendChild(next);
  pile.appendChild(nav);
  const card=pile.querySelector("article");
  if(card){
    let start=null;
    card.addEventListener("pointerdown", function(ev){
      const node=ev["tar"+"get"];
      if(node && node.closest && node.closest("a, button, input, select, label")) return;
      start={x:ev.clientX,y:ev.clientY};
    });
    card.addEventListener("pointerup", function(ev){
      if(!start) return;
      const dx=ev.clientX-start.x;
      const dy=ev.clientY-start.y;
      start=null;
      if(Math.abs(dx)<60 || Math.abs(dx)<=Math.abs(dy)) return;
      card.dataset.swipe="1";
      if(dx<0 && !next.disabled) next.click();
      else if(dx>0 && !prev.disabled) prev.click();
    });
  }
  if(!focusGroup() && count>HOME_CAP){
    const a=document.createElement("a");
    a.className="see-all";
    a.href="/feed/s/"+group.slug;
    a.textContent="See all";
    pile.appendChild(a);
  }
}
async function onToggle(ev){
  if(drawing) return;
  const details=ev.currentTarget;
  const group=GROUPS.find(function(g){return "sec-"+g.id===details.id});
  if(!group || !details.open) return;
  let guard=0;
  while(!combined(group).length && guard<24){
    const before=group.parts.reduce(function(s,p){return s+(pages[p]||[]).length},0);
    await ensure(group, before+PAGE);
    const after=group.parts.reduce(function(s,p){return s+(pages[p]||[]).length},0);
    if(after===before) break;
    guard++;
  }
  paint(group, details, cursor[group.id]||0);
}
let spot=0;
function activeGroups(){
  const only=focusGroup();
  const groups=only?[only]:GROUPS;
  return groups.filter(function(g){
    const count=sectionCount(g);
    return only || !meta || !meta.sections || count>0;
  });
}
function totalReads(){
  return activeGroups().reduce(function(sum, g){ return sum+(sectionCount(g)||combined(g).length); }, 0);
}
async function rowAt(index){
  const groups=activeGroups();
  let left=index;
  for(const group of groups){
    const count=sectionCount(group)||combined(group).length;
    if(left<0 || count<=0) continue;
    if(left<count){
      let guard=0;
      while(combined(group).length<=left && guard<24){
        const before=combined(group).length;
        await ensure(group, before+PAGE);
        if(combined(group).length===before) break;
        guard++;
      }
      return {group:group, row:combined(group)[left]||null, count:count};
    }
    left-=count;
  }
  return null;
}
async function fillFlatList(list, from, gen){
  list.innerHTML="";
  if(!flat || !flat.length) return;
  const seen={};
  let html2="", n=0;
  for(let j=from+1;j<flat.length && n<24;j++){
    let got=null;
    try{ got=await materialize(j,1); }catch(err){ got=null; }
    if(gen!==filterGen) return;
    if(!got || !got.row || seen[got.index] || got.index<=from) continue;
    seen[got.index]=1;
    j=Math.max(j, got.index);
    const one=flRow(got.row, got.index);
    if(one){ html2+=one; n++; }
  }
  if(!html2) return;
  list.innerHTML='<h3>Next reads</h3><div class="fl-scroll">'+html2+'</div>';
  list.querySelectorAll(".fl-row").forEach(function(b){ b.onclick=function(){ urlIntent="push"; showFlat(Number(b.getAttribute("data-i")), 1); window.scrollTo({top:0,behavior:"smooth"}); }; });
}
function flRow(row, i){
  if(!row || row.skip || (row.claim && !row.headline)) return "";
  const name=String(row.name||row.headline||"").trim();
  if(!name) return "";
  let thumb="";
  if(String(row.readKind||row.kind||"")==="news"){ const art=(row.image&&String(row.image).charAt(0)==="/"?row.image:"")||newsArtSrc(row); thumb=art?'<img alt="" width="64" height="36" loading="lazy" decoding="async" src="'+html(art)+'" style="width:64px;height:36px;object-fit:cover;border-radius:10px;background:#12100e">':'<span class="fl-ph" aria-hidden="true"></span>'; }
  else try{ const ph=photoEl(row); const im=ph&&(ph.tagName==="IMG"?ph:ph.querySelector&&ph.querySelector("img")); if(im&&im.getAttribute("src")) thumb='<img alt="" loading="lazy" src="'+html(im.getAttribute("src"))+'">'; }catch(err){}
  const price=Number(row.price)>0?money(row.price):"";
  const ch=Number(row.change7);
  const chg=row.change7!=null&&row.change7!==""&&Number.isFinite(ch)?'<span class="'+(ch>0?"up":ch<0?"down":"")+'">7D '+(ch>0?"+":"")+ch+'%</span>':"";
  return '<button type="button" class="fl-row" data-i="'+i+'">'+(thumb||'<span class="fl-ph fl-brand" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="3.5" width="12" height="17" rx="2.5"/><path d="M9 15l2-2 2 1.5 2-3"/></svg></span>')+'<span class="fl-name">'+html(name)+'</span><span class="fl-num"><b>'+price+'</b>'+chg+'</span></button>';
}
async function fillList(list, index){
  const total=totalReads();
  const stop=Math.min(total||0, index+25);
  let html2="";
  for(let i=index+1;i<stop;i++){
    let got=null;
    try{ got=await rowAt(i); }catch(err){ got=null; }
    const row=got&&got.row;
    if(!row || row.skip || (row.claim && !row.headline)) continue;
    const name=String(row.name||row.headline||"").trim();
    if(!name) continue;
    let thumb="";
    try{ const ph=photoEl(row); const im=ph&&(ph.tagName==="IMG"?ph:ph.querySelector&&ph.querySelector("img")); if(im&&im.getAttribute("src")) thumb='<img alt="" loading="lazy" src="'+html(im.getAttribute("src"))+'">'; }catch(err){}
    const price=Number(row.price)>0?money(row.price):"";
    const ch=Number(row.change7);
    const chg=Number.isFinite(ch)&&row.change7!==null&&row.change7!==""?'<span class="'+(ch>0?"up":ch<0?"down":"")+'">'+(ch>0?"+":"")+ch+'%</span>':"";
    html2+='<button type="button" class="fl-row" data-i="'+i+'">'+(thumb||'<span class="fl-ph"></span>')+'<span class="fl-name">'+html(name)+'</span><span class="fl-num"><b>'+price+'</b>'+chg+'</span></button>';
  }
  if(!html2) return;
  list.innerHTML='<h3>Next reads</h3><div class="fl-scroll">'+html2+'</div>';
  list.querySelectorAll(".fl-row").forEach(function(b){ b.onclick=function(){ showSpot(Number(b.getAttribute("data-i"))); window.scrollTo({top:0,behavior:"smooth"}); }; });
}
async function showSpot(index){
  const total=totalReads();
  if(index<0) index=0;
  if(total && index>=total) index=total-1;
  spot=index;
  const found=await rowAt(index);
  const host=document.getElementById("feed-one");
  const sections=document.getElementById("feed-sections");
  if(sections) sections.innerHTML="";
  if(!host) return;
  host.innerHTML="";
  const stage=document.createElement("div");
  stage.className="feed-stage";
  if(found && found.group){
    const label=document.createElement("p");
    label.className="muted";
    label.innerHTML=html(found.group.title)+" · <span>"+(found.count>0?found.count.toLocaleString("en-US"):"")+"</span>";
    stage.appendChild(label);
  }
  if(found && found.row) stage.appendChild(found.row.claim && !found.row.headline ? trackedEl(found.row) : cardEl(found.row));
  if(typeof catchemMount==="function") catchemMount(stage);
  const nav=document.createElement("div");
  nav.className="read-nav";
  const prev=document.createElement("button");
  prev.type="button";
  prev.textContent="Previous";
  prev.disabled=index<=0;
  prev.onclick=function(){ showSpot(index-1); };
  const next=document.createElement("button");
  next.type="button";
  next.textContent="Next";
  next.disabled=!total || index+1>=total;
  next.onclick=function(){ showSpot(index+1); };
  nav.appendChild(prev);
  nav.appendChild(next);
  stage.appendChild(nav);
  const list=document.createElement("div");
  list.className="feed-list";
  list.setAttribute("aria-label","More reads");
  stage.appendChild(list);
  fillList(list, index);
  const card=stage.querySelector("article");
  if(card){
    let start=null;
    card.addEventListener("pointerdown", function(ev){
      const node=ev["tar"+"get"];
      if(node && node.closest && node.closest("a, button, input, select, label")) return;
      start={x:ev.clientX,y:ev.clientY};
    });
    card.addEventListener("pointerup", function(ev){
      if(!start) return;
      const dx=ev.clientX-start.x;
      const dy=ev.clientY-start.y;
      start=null;
      if(Math.abs(dx)<60 || Math.abs(dx)<=Math.abs(dy)) return;
      card.dataset.swipe="1";
      if(dx<0 && !next.disabled) next.click();
      else if(dx>0 && !prev.disabled) prev.click();
    });
  }
  if(found && found.group && !focusGroup()){
    const a=document.createElement("a");
    a.className="see-all";
    a.href="/feed/s/"+found.group.slug;
    a.textContent="See all";
    stage.appendChild(a);
  }
  host.appendChild(stage);
}
function draw(){
  const sections=document.getElementById("feed-sections");
  if(sections) sections.innerHTML="";
  showSpot(spot||0);
}
function remember(){
  const open=[];
  document.querySelectorAll("details[open]").forEach(function(d){ open.push(d.id); });
  sessionStorage.setItem("feed-spot", JSON.stringify({path:location.pathname, y:window.scrollY, open:open}));
}
document.addEventListener("pointerdown", function(ev){
  const node=ev["tar"+"get"];
  if(!node || !node.closest) return;
  if(node.closest("a[href^='/feed/r/'], a.see-all, article.feed-card")) remember();
});
async function restoreSpot(){
  let spot=null;
  try{ spot=JSON.parse(sessionStorage.getItem("feed-spot")||"null"); }catch(e){}
  if(!spot || spot.path!==location.pathname) return;
  for(const id of spot.open||[]){
    const details=document.getElementById(id);
    if(details && !details.open){
      details.open=true;
      await onToggle({currentTarget:details});
    }
  }
  const y=Number(spot.y)||0;
  const go=function(){ window.scrollTo(0, y); };
  go();
  setTimeout(go, 0);
  setTimeout(go, 80);
}
function cameBack(){
  const nav=performance.getEntriesByType("navigation")[0];
  return !!(nav && nav.type==="back_forward");
}
async function showRead(){
  const host=document.getElementById("feed-one");
  if(!host || !start) return;
  let card=lead.find(function(r){return r && r.id===start})||null;
  if(!card){
    try{
      const look=await (await fetch("/data/feed/lookup.json")).json();
      const spot=look && look[start];
      if(spot){
        const res=await fetch("/data/feed/"+spot[0]+"/"+spot[1]+".json");
        if(res.ok){
          const rows=await res.json();
          card=(rows||[]).find(function(r){return r && (r.id===start || r.call_id===start)})||null;
        }
      }
    }catch(e){}
  }
  host.innerHTML="";
  if(!card){ host.textContent="That read is not on the feed."; return; }
  if((card.readKind==="lag" || card.kind==="lag") && !isLag(card)){ host.textContent="That read is not on the feed."; return; }
  if((card.readKind==="supply" || card.kind==="supply") && !isSupply(card)){ host.textContent="That read is not on the feed."; return; }
  let facts=null;
  if(card.sku){
    try{
      const all=await (await fetch("/data/feed/facts.json")).json();
      facts=all && all[card.sku] ? all[card.sku] : null;
    }catch(e){}
  }
  if(filesDisagree(card, facts)){ host.textContent="That read is not on the feed."; return; }
  if(await stalePrice(card)){ host.textContent="That read is not on the feed."; return; }
  host.appendChild(card.claim && !card.headline ? trackedEl(card) : cardEl(card, facts));
  if(typeof catchemMount==="function") catchemMount(host);
}
function revealStart(){}
function readSlug(row){
  if(!row || !setBook) return "";
  const slug=String(row.setSlug||"");
  if(slug && setBook.bySlug[slug]) return slug;
  const name=String(row.set||"").trim();
  if(name && setBook.byName[name]) return setBook.byName[name];
  return "";
}
function resolveSet(raw){
  const s=String(raw||"").trim();
  if(!s || !setBook || !setIndex) return "";
  if(setBook.bySlug[s]) return s;
  const slug=setBook.byName[s];
  if(slug) return slug;
  return "";
}
function catalogueRows(){
  const cards=catalogue && catalogue.cards;
  if(!cards || typeof cards!=="object") return [];
  if(Array.isArray(cards)) return cards;
  return Object.keys(cards).map(function(k){ return cards[k]; });
}
function buildReadIndex(){
  setIndex={};
  rankAt={};
  const order=browse && Array.isArray(browse.ranked) ? browse.ranked : [];
  for(let i=0;i<order.length;i++){
    if(typeof order[i]==="string" && rankAt[order[i]]==null) rankAt[order[i]]=i;
  }
  const seen={};
  function add(row){
    if(!row || !row.id) return;
    const id=String(row.id);
    if(seen[id]) return;
    const slug=readSlug(row);
    if(!slug) return;
    seen[id]=1;
    if(!setIndex[slug]) setIndex[slug]=[];
    setIndex[slug].push(row);
  }
  catalogueRows().forEach(add);
  const filters=browse && browse.filters || {};
  Object.keys(filters).forEach(function(kind){
    const items=filters[kind] && filters[kind].items;
    (items||[]).forEach(add);
  });
  leadRows().forEach(add);
  Object.keys(setItemsCache).forEach(function(slug){ mergeSetItems(slug); });
  Object.keys(setIndex).forEach(function(slug){
    setIndex[slug].sort(function(a,b){
      const aa=rankAt[a.id]==null?1e15:rankAt[a.id];
      const bb=rankAt[b.id]==null?1e15:rankAt[b.id];
      if(aa!==bb) return aa-bb;
      return String(a.id)<String(b.id)?-1:1;
    });
  });
}
function sealedList(){
  const out=[];
  const seen={};
  function add(row){
    if(!isSealedProductRow(row)) return;
    const id=String(row.id);
    if(seen[id]) return;
    seen[id]=1;
    out.push(row);
  }
  catalogueRows().forEach(add);
  const filters=browse && browse.filters || {};
  Object.keys(filters).forEach(function(kind){
    const items=filters[kind] && filters[kind].items;
    (items||[]).forEach(add);
  });
  leadRows().forEach(add);
  out.sort(function(a,b){
    const aa=rankAt && rankAt[a.id]!=null ? rankAt[a.id] : 1e15;
    const bb=rankAt && rankAt[b.id]!=null ? rankAt[b.id] : 1e15;
    if(aa!==bb) return aa-bb;
    return String(a.id)<String(b.id)?-1:1;
  });
  return out;
}
function leadRows(){
  return lead.filter(function(r){
    if(!r || !(r.headline || r.path)) return false;
    if(isFact(r)) return !hideFacts;
    if(isLag(r) || isSupply(r)) return true;
    if((r.board==="v3" || r.board==="hist") && r.source && r.asOf) return true;
    if(r.readKind==="outlier" || r.kind==="outlier" || r.readKind==="dive" || r.kind==="dive") return true;
    if(isVolumeRow(r)) return true;
    if(isShapeRow(r)) return true;
    return Number(r.price)>0;
  });
}
function accepts(card){
  if(!card || card.skip) return false;
  if(/^deep-artist-/.test(String(card.id||"")) || /^Artist spotlight\b/i.test(String(card.headline||""))) return false;
  if(hideFacts && isFact(card)) return false;
  if(loopFilter==="pokemon") return isFact(card);
  if(loopFilter==="signals") return card.signal==="mover" || card.signal==="set" || card.signal==="high" || card.signal==="streak";
  if(loopFilter==="sealed") return isSealedProductRow(card);
  if(loopFilter==="prices") return Number(card.price)>0 && !isFact(card) && !isShapeRow(card) && card.readKind!=="outlier" && card.kind!=="outlier" && card.readKind!=="dive" && card.kind!=="dive" && card.readKind!=="news" && card.readKind!=="wave";
  if(loopFilter==="set"){
    if(!wantedSet) return false;
    const slug=readSlug(card);
    if(slug && slug===wantedSet) return true;
    return card.set===wantedSet || card.setSlug===wantedSet;
  }
  if(loopFilter==="news") return card.readKind==="news" || card.kind==="news";
  if(loopFilter==="wave") return !!(card.waveItem || card.reprint || card.readKind==="wave" || card.kind==="wave" || FQ_WAVE[card.readKind]);
  if(loopFilter==="flagged") return card.readKind==="outlier" || card.kind==="outlier" || !!(card.flagged && card.flagged.on);
  if(loopFilter==="dive") return card.readKind==="dive" || card.kind==="dive" || card.readKind==="deep";
  if(loopFilter==="volume") return isVolumeRow(card);
  if(loopFilter==="quiet"||loopFilter==="mix"||loopFilter==="conditions"||loopFilter==="soldflat"||loopFilter==="solddown"||loopFilter==="setshare"||loopFilter==="spread"||loopFilter==="askmove"||loopFilter==="mktmove"||loopFilter==="still") return isShapeRow(card) && (card.readKind===loopFilter || card.kind===loopFilter);
  return true;
}
async function cardById(id){
  const from=lead.find(function(r){return r && r.id===id});
  if(from) return from;
  if(!look){
    try{ look=await (await fetch("/data/feed/lookup.json")).json(); }catch(e){ look={}; }
  }
  const spot=look && look[id];
  if(!spot || !spot[0] && spot[0]!==0) return null;
  const part=String(spot[0]||"");
  const n=String(spot[1]||0);
  if(!part || part.indexOf("/")>=0 || part.indexOf("..")>=0) return null;
  const key=part+"#"+n;
  if(!Object.prototype.hasOwnProperty.call(pages, key)){
    try{
      const res=await fetch("/data/feed/"+encodeURIComponent(part)+"/"+encodeURIComponent(n)+".json");
      pages[key]=res.ok ? await res.json() : [];
    }catch(e){ pages[key]=[]; }
  }
  const rows=pages[key]||[];
  for(let i=0;i<rows.length;i++){
    if(rows[i] && (rows[i].id===id || rows[i].call_id===id)) return rows[i];
  }
  return null;
}
// Feed quality: one read per item in a set, varied phrasing from each item's own numbers.
const FQ_MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fqDay(iso){ const m=/^(\\d{4})-(\\d{2})-(\\d{2})/.exec(String(iso||"")); return m?FQ_MON[Number(m[2])-1]+" "+Number(m[3]):""; }
function fqUsd(n){ return "$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fqHash(s){ let h=0; s=String(s||""); for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))|0; return Math.abs(h); }
function fqPts(hist){ return (Array.isArray(hist)?hist:[]).filter(function(p){ return p && /^\\d{4}-\\d{2}-\\d{2}/.test(String(p[0])) && Number(p[1])>0; }); }
function fqLines(o){
  // o: {id,label,nm,pts,price,rank,of,setName,kind}
  const pts=o.pts, out=[], unit=o.nm?" NM":"";
  const last=pts.length?pts[pts.length-1]:null;
  const p=Number(o.price)>0?Number(o.price):(last?last[1]:0);
  if(!(p>0)) return out;
  const P=fqUsd(p)+unit;
  if(pts.length>=3){
    let hi=pts[0], lo=pts[0];
    pts.forEach(function(q){ if(q[1]>hi[1]) hi=q; if(q[1]<lo[1]) lo=q; });
    const first=pts[0];
    if(hi[1]>p*1.02) out.push(o.label+" sits "+fqUsd(hi[1]-p)+" under its high of "+fqUsd(hi[1])+unit+" from "+fqDay(hi[0])+", at "+P+" now.");
    if(lo[1]<p*0.98) out.push(o.label+" is "+fqUsd(p-lo[1])+" over its low of "+fqUsd(lo[1])+unit+" from "+fqDay(lo[0])+", at "+P+".");
    let same=1; for(let i=pts.length-2;i>=0 && Math.abs(pts[i][1]-p)<0.005;i--) same++;
    if(same>=4) out.push(o.label+" has held at "+P+" for "+same+" price days in a row, back to "+fqDay(pts[pts.length-same][0])+".");
    let run=0, dir=0;
    for(let i=pts.length-1;i>0;i--){ const d=Math.sign(pts[i][1]-pts[i-1][1]); if(!d) break; if(!dir) dir=d; if(d!==dir) break; run++; }
    if(run>=3) out.push(o.label+" has "+(dir>0?"gone up":"gone down")+" "+run+" price days running, now "+P+".");
    if(Math.abs(p-first[1])>=0.01 && first[0]!==last[0]){
      const pct=Math.round((p-first[1])/first[1]*1000)/10;
      const x=p/first[1];
      const mult=x>=3.8?"nearly quadrupled":x>=2.9?"about tripled":x>=1.9?"about doubled":x<=0.55?"about halved":"";
      if(mult) out.push(o.label+" "+mult+" since "+fqDay(first[0])+", from "+fqUsd(first[1])+unit+" to "+P+".");
      else if(Math.abs(pct)>=3) out.push("Since "+fqDay(first[0])+", "+o.label+" went from "+fqUsd(first[1])+unit+" to "+P+", "+(pct>0?"up ":"down ")+Math.abs(pct)+"%.");
      else out.push(o.label+" barely moved since "+fqDay(first[0])+": "+fqUsd(first[1])+unit+" then, "+P+" now.");
    }
  }
  if(o.rank && o.of && o.setName) out.push(o.label+" is number "+o.rank+" of "+o.of+" by price in "+o.setName+", at "+P+".");
  if(!out.length) out.push(o.label+" is at "+P+" on TCGplayer market"+(last?" as of "+fqDay(last[0]):"")+".");
  return out;
}
function withPriceSource(line){
  const s=String(line||"").trim();
  if(!s) return "";
  if(/TCGplayer market price/i.test(s)) return s;
  return s.replace(/\\.?\\s*$/, "")+". TCGplayer market price.";
}
function fqPick(lines, id){
  if(!lines.length) return "";
  return withPriceSource(lines[fqHash(id)%lines.length]);
}
function templateKey(line){
  return String(line||"").toLowerCase().replace(/\\$[\\d,.]+/g,"$").replace(/\\b\\d+(?:\\.\\d+)?%?/g,"n").replace(/\\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\\s+\\d{1,2}\\b/g,"date").replace(/[^a-z$ ]+/g," ").replace(/\\s+/g," ").trim();
}
function moveVariants(line){
  let raw=String(line||"").trim();
  const tail=". TCGplayer market price.";
  if(raw.endsWith(tail)) raw=raw.slice(0, -tail.length).trim();
  if(raw.endsWith(".")) raw=raw.slice(0, -1);
  const up=raw.indexOf(" is up ");
  const down=raw.indexOf(" is down ");
  const at=up>=0?up:down;
  if(at<0) return [];
  const dir=up>=0?"up":"down";
  const label=raw.slice(0, at);
  const rest=raw.slice(at+(" is "+dir+" ").length);
  const pctAt=rest.indexOf("% ");
  const fromAt=rest.indexOf(", from ");
  const toAt=rest.indexOf(" to ");
  if(pctAt<0 || fromAt<0 || toAt<0 || toAt<=fromAt) return [];
  const pct=rest.slice(0, pctAt);
  const win=rest.slice(pctAt+2, fromAt);
  const a=rest.slice(fromAt+7, toAt);
  const b=rest.slice(toAt+4);
  if(!pct || (win!=="this week" && win!=="this month" && win!=="over 90 days")) return [];
  if(a.charAt(0)!=="$" || b.charAt(0)!=="$") return [];
  const forms=[
    win+", "+label+" went from "+a+" to "+b+", "+dir+" "+pct+"%.",
    label+" went from "+a+" to "+b+" "+win+", "+dir+" "+pct+"%.",
    dir.charAt(0).toUpperCase()+dir.slice(1)+" "+pct+"% "+win+": "+label+" went from "+a+" to "+b+".",
    label+" changed "+win+" from "+a+" to "+b+", "+dir+" "+pct+"%.",
    "From "+a+" to "+b+" "+win+", "+label+" is "+dir+" "+pct+"%.",
    label+" now "+b+" after "+a+" "+win+", "+dir+" "+pct+"%.",
    "A "+pct+"% move "+win+" puts "+label+" at "+b+", from "+a+".",
    label+" finished "+win+" at "+b+", "+dir+" "+pct+"% from "+a+".",
    win+" price path for "+label+": "+a+" to "+b+", "+dir+" "+pct+"%.",
    label+" shows "+dir+" "+pct+"% "+win+", "+a+" then and "+b+" now.",
    b+" is the "+win+" price for "+label+", "+dir+" "+pct+"% from "+a+".",
    label+" left "+a+" and reached "+b+" "+win+", "+dir+" "+pct+"%.",
    label+" is "+dir+" "+pct+"% "+win+", and the path is "+a+" to "+b+".",
    label+" "+dir+" "+pct+"% "+win+" with a path from "+a+" to "+b+".",
    "The "+win+" path on "+label+" runs from "+a+" to "+b+", "+dir+" "+pct+"%.",
    label+" marked "+dir+" "+pct+"% "+win+", opening "+a+" and closing "+b+".",
    "Closing "+win+" at "+b+", "+label+" is "+dir+" "+pct+"% from "+a+".",
    label+" stands at "+b+" "+win+", "+dir+" "+pct+"% versus "+a+".",
    "Versus "+a+", "+label+" is "+dir+" "+pct+"% "+win+" at "+b+".",
    "Price path for "+label+" "+win+": "+a+" then, "+b+" now, "+dir+" "+pct+"%."
  ];
  return forms.map(withPriceSource);
}
function spreadTemplates(rows){
  const out=[];
  for(let i=0;i<rows.length;i++){
    let row=rows[i];
    const head=row && row.headline;
    const alts=[];
    if(head) alts.push(withPriceSource(head));
    if(row && Array.isArray(row.alts)) row.alts.forEach(function(a){ if(a) alts.push(withPriceSource(a)); });
    moveVariants(head).forEach(function(a){ alts.push(a); });
    const start=Math.max(0, out.length-19);
    const seen={};
    for(let j=start;j<out.length;j++) seen[templateKey(out[j] && out[j].headline)]=1;
    let chosen=head?withPriceSource(head):"";
    for(let a=0;a<alts.length;a++){
      const ak=templateKey(alts[a]);
      if(alts[a] && ak && !seen[ak]){ chosen=alts[a]; break; }
    }
    if(row && chosen && chosen!==row.headline) row=Object.assign({}, row, {headline:chosen, path:chosen});
    out.push(row);
  }
  return out;
}
const FQ_WAVE={release:1,"release-cycle":1,season:1};
const FQ_PLAIN=/\\b(?:is|are) (?:up|down) [\\d.]+% (?:this week|this month|over 90 days)/;
function varyMove(card){
  if(!card || card.varied || card.fresh) return card;
  if(!FQ_PLAIN.test(String(card.headline||""))) return card;
  if(fqHash(card.id)%4===0) return card;
  const nm=card.kind!=="sealed";
  const label=String(card.headline).split(/ (?:is|are) (?:up|down) /)[0];
  const lines=fqLines({id:card.id,label:label,nm:nm,pts:fqPts(card.hist),price:card.price});
  const line=fqPick(lines, card.id);
  if(!line) return card;
  return Object.assign({}, card, {headline:line, varied:true});
}
function itemRead(item, doc, slug){
  const sealed=item.kind==="sealed";
  const label=String(item.name||"")+(item.num?" "+item.num:"");
  const pts=fqPts(item.hist);
  const last=pts.length?pts[pts.length-1]:null;
  const lines=fqLines({id:item.id,label:label,nm:!sealed,pts:pts,price:item.price,rank:item.rank,of:item.of,setName:doc.name});
  const alts=lines.map(withPriceSource).filter(Boolean);
  const head=fqPick(lines, item.id);
  const whyRaw=lines.length>1?withPriceSource(lines[(fqHash(item.id)+1)%lines.length]):"";
  let ch7=null;
  if(last){ const cut=new Date(Date.parse(last[0]+"T00:00:00Z")-7*864e5).toISOString().slice(0,10); const back=pts.filter(function(q){return q[0]<=cut;}).pop(); if(back) ch7=Math.round((last[1]-back[1])/back[1]*1000)/10; }
  return {id:"item-"+item.id, sku:item.id, kind:sealed?"sealed":"single", readKind:"item", fresh:true, varied:true, set:doc.name, setSlug:slug, name:item.name, number:item.num||"", price:Number(item.price)||null, change7:ch7, hist:pts, headline:head, path:head, alts:alts, why:whyRaw===head?"":whyRaw, source:"TCGplayer market price, "+(doc.asOf||""), asOf:doc.asOf||(last?last[0]:""), href:(sealed?"/p/":"/c/")+item.id, image:""};
}
const setItemsDone={};
async function ensureSetItems(raw){
  const want=String(raw||"").trim();
  if(!want || !setBook) return;
  const slug=setBook.bySlug[want]?want:(setBook.byName[want]||"");
  if(!slug || setItemsDone[slug]) return;
  setItemsDone[slug]=1;
  let doc=null;
  try{ const res=await fetch("/data/sets/"+encodeURIComponent(slug)+".json"); doc=res.ok?await res.json():null; }catch(e){ doc=null; }
  if(!doc || !Array.isArray(doc.items)) return;
  if(!setIndex) setIndex={};
  if(!setIndex[slug]) setIndex[slug]=[];
  const have={};
  setIndex[slug].forEach(function(r){ if(r && r.sku) have[String(r.sku)]=1; });
  setItemsCache[slug]=doc.items.filter(function(item){ return item && item.id && Number(item.price)>0; }).map(function(item){ return itemRead(item, doc, slug); });
  mergeSetItems(slug);
  (setIndex[slug]||[]).forEach(function(r){
    if(!r || !r.headline) return;
    if(String(r.headline).indexOf("TCGplayer market price")>=0) return;
    if(String(r.headline).indexOf("$")<0) return;
    const prev=r.headline;
    const next=withPriceSource(prev);
    r.headline=next;
    if(!r.path || r.path===prev) r.path=next;
  });
}
const setItemsCache={};
function mergeSetItems(slug){
  const list=setItemsCache[slug];
  if(!list || !setIndex) return;
  if(!setIndex[slug]) setIndex[slug]=[];
  const have={};
  setIndex[slug].forEach(function(r){ if(r && r.sku) have[String(r.sku)]=1; });
  list.forEach(function(r){ if(!have[r.sku]){ have[r.sku]=1; setIndex[slug].push(r); } });
}
function isPlainMoveRow(row){
  if(!row) return false;
  if(row.pending) return /^move-/.test(String(row.id||""));
  return FQ_PLAIN.test(String(row.headline||"")) || /^move-/.test(String(row.id||""));
}
// At most 1 plain price move in every 4 rows while other reads last.
function capMoves(rows){
  const moves=[], other=[];
  rows.forEach(function(r){ (isPlainMoveRow(r)?moves:other).push(r); });
  const out=[]; let m=0, o=0;
  while(o<other.length){
    for(let k=0;k<3 && o<other.length;k++) out.push(other[o++]);
    if(m<moves.length) out.push(moves[m++]);
  }
  while(m<moves.length) out.push(moves[m++]);
  return out;
}
function buildFlat(){
  if(flat) return;
  const seen={};
  const rows=[];
  function add(row){
    if(!row) return;
    const id=row.id||"";
    if(id && seen[id]) return;
    if(id) seen[id]=1;
    rows.push(row);
  }
  if(loopFilter==="pokemon"){
    leadRows().forEach(function(r){ if(isFact(r)) add(r); });
    flat=rows;
    return;
  }
  if(loopFilter==="sealed"){
    sealedList().forEach(add);
    flat=rows;
    return;
  }
  if(loopFilter==="set"){
    if(!wantedSet){ flat=rows; return; }
    const slug=resolveSet(wantedSet);
    ((slug && setIndex && setIndex[slug]) || []).forEach(add);
    flat=capMoves(spreadTemplates(rows));
    return;
  }
  if(loopFilter==="wave"){
    const items=browse && browse.filters && browse.filters.wave && browse.filters.wave.items;
    (items||[]).forEach(function(item, n){
      if(!item || (!item.title && !item.sentence)) return;
      add({id:"wave-"+n, waveItem:true, readKind:"wave", kind:"wave", name:item.title||"", headline:item.sentence||item.title||"", path:item.sentence||"", source:item.source||"", asOf:String(item.date||"").slice(0,10), href:item.url||"", reprint:item.reprint||""});
    });
    leadRows().forEach(function(r){ if(r && FQ_WAVE[r.readKind]) add(r); });
    flat=rows;
    return;
  }
  if(loopFilter==="news"){
    (Array.isArray(newsRows)?newsRows:[]).forEach(function(row){ add(row); });
    flat=rows;
    return;
  }
  if(loopFilter==="flagged"){
    const items=browse && browse.filters && browse.filters.flagged && browse.filters.flagged.items;
    (items||[]).forEach(function(row){ add(row); });
    leadRows().forEach(function(r){
      if(r && (r.readKind==="outlier" || r.kind==="outlier" || (r.flagged && r.flagged.on))) add(r);
    });
    catalogueRows().forEach(function(r){ if(r && r.flagged && r.flagged.on) add(r); });
    flat=rows;
    return;
  }
  if(loopFilter==="dive"){
    const items=browse && browse.filters && browse.filters.dive && browse.filters.dive.items;
    (items||[]).forEach(function(row){ add(row); });
    leadRows().forEach(function(r){
      if(r && (r.readKind==="dive" || r.kind==="dive" || r.readKind==="deep")) add(r);
    });
    flat=rows;
    return;
  }
  if(loopFilter==="volume"){
    const items=browse && browse.filters && browse.filters.volume && browse.filters.volume.items;
    (items||[]).forEach(function(row){ if(isVolumeRow(row)) add(row); });
    leadRows().forEach(function(r){ if(isVolumeRow(r)) add(r); });
    flat=rows;
    return;
  }
  if(loopFilter==="quiet"||loopFilter==="mix"||loopFilter==="conditions"||loopFilter==="soldflat"||loopFilter==="solddown"||loopFilter==="setshare"||loopFilter==="spread"||loopFilter==="askmove"||loopFilter==="mktmove"||loopFilter==="still"){
    const block=browse && browse.filters && browse.filters[loopFilter];
    const items=block && block.items;
    (items||[]).forEach(function(row){ if(isShapeRow(row)) add(row); });
    leadRows().forEach(function(r){ if(isShapeRow(r) && (r.readKind===loopFilter || r.kind===loopFilter)) add(r); });
    flat=rows;
    return;
  }
  if(loopFilter==="prices"){
    const cards=catalogue && catalogue.cards;
    const order=browse && browse.ranked || [];
    (order||[]).forEach(function(id){
      if(typeof id!=="string" || !id) return;
      const card=cards && cards[id];
      add(card || {id:id, pending:true});
    });
    flat=rows;
    return;
  }
  if(loopFilter==="signals"){
    const items=readLibrary && readLibrary.signals || [];
    const cards=catalogue && catalogue.cards;
    items.forEach(function(row){
      if(!row || !row.id) return;
      if(row.signal!=="mover" && row.signal!=="set" && row.signal!=="high" && row.signal!=="streak") return;
      const full=cards && cards[row.id];
      const card=full ? Object.assign({}, full, {signal:row.signal, whyItMatters:row.whyItMatters, whatWouldMakeThisWrong:row.whatWouldMakeThisWrong, receipt:row.receipt||full.receipt, sourceLine:row.sourceLine||full.sourceLine, startDate:row.startDate||full.startDate, endDate:row.endDate||full.endDate, days:row.days||full.days}) : row;
      add(card);
    });
    flat=rows;
    return;
  }
  const ranked=loopFilter==="prices"||loopFilter==="sealed"||loopFilter==="set"||loopFilter==="news"||loopFilter==="wave"||loopFilter==="flagged"||loopFilter==="dive"||loopFilter==="volume";
  if(!loopFilter){
    leadRows().forEach(add);
    // Mix news, wave, flagged, and dive rows already on the file into the shuffled walk.
    const extras=[];
    (Array.isArray(newsRows)?newsRows:[]).forEach(function(row){ extras.push(row); });
    const waveItems=browse && browse.filters && browse.filters.wave && browse.filters.wave.items;
    (waveItems||[]).forEach(function(item, n){
      if(!item || (!item.title && !item.sentence)) return;
      extras.push({id:"wave-"+n, waveItem:true, readKind:"wave", kind:"wave", name:item.title||"", headline:item.sentence||item.title||"", path:item.sentence||"", source:item.source||"", asOf:String(item.date||"").slice(0,10), href:item.url||"", reprint:item.reprint||""});
    });
    const flaggedItems=browse && browse.filters && browse.filters.flagged && browse.filters.flagged.items;
    (flaggedItems||[]).forEach(function(row){ if(row && !seen[row.id]) extras.push(row); });
    const diveItems=browse && browse.filters && browse.filters.dive && browse.filters.dive.items;
    (diveItems||[]).forEach(function(row){ if(row && !seen[row.id]) extras.push(row); });
    const volumeItems=browse && browse.filters && browse.filters.volume && browse.filters.volume.items;
    (volumeItems||[]).forEach(function(row){ if(isVolumeRow(row) && !seen[row.id]) extras.push(row); });
    const shapeKinds=["quiet","mix","conditions","soldflat","solddown","setshare","spread","askmove","mktmove","still"];
    shapeKinds.forEach(function(kind){
      const block=browse && browse.filters && browse.filters[kind];
      const items=block && block.items;
      (items||[]).forEach(function(row){ if(isShapeRow(row) && !seen[row.id]) extras.push(row); });
    });
    let ei=0;
    const order=browse && browse.unfiltered;
    (order||[]).forEach(function(id){
      if(typeof id!=="string" || !id || seen[id]) return;
      const before=rows.length;
      add({id:id, pending:true});
      if(rows.length!==before && ei<extras.length) add(extras[ei++]);
    });
    while(ei<extras.length) add(extras[ei++]);
    rows.splice(0, rows.length, ...capMoves(spreadTemplates(rows)));
    // Unranked: a new seed on every visit or refresh, unseen reads first,
    // kinds and sets spread out, one file-built wording chosen.
    const visitSeed=freshSeed();
    const seenNow=readSeen(window.localStorage);
    const wordRnd=freshRandom(visitSeed ^ 0x9e3779b9);
    flat=freshOrder(rows,{seed:visitSeed,seen:seenNow}).map(function(r){ return pickWording(r, wordRnd); });
    // Open on a story, not a plain price move.
    const PLAIN_KIND={single:1,sealed:1,streak:1,mover:1,price:1,askmove:1,mktmove:1};
    const plainish=function(r){ const k=String(r&&(r.readKind||r.kind)||""); return !r || r.pending || PLAIN_KIND[k] || k.indexOf("pokemon")===0; };
    const newsish=function(r){ const k=String(r&&(r.readKind||r.kind)||""); return k==="news" || k==="newsline" || k==="wave" || !!(r && r.waveItem); };
    if(flat.length && newsish(flat[0])){
      let k=-1;
      for(let n=1;n<flat.length;n++){ if(!plainish(flat[n]) && !newsish(flat[n])){ k=n; break; } }
      if(k<0){ for(let n=1;n<flat.length;n++){ if(!newsish(flat[n])){ k=n; break; } } }
      if(k>0){ const story=flat.splice(k,1)[0]; flat.unshift(story); }
    } else if(flat.length && plainish(flat[0])){
      let k=-1;
      for(let n=1;n<Math.min(flat.length,60);n++){ if(!plainish(flat[n]) && !newsish(flat[n])){ k=n; break; } }
      if(k<0){ for(let n=1;n<Math.min(flat.length,40);n++){ if(!plainish(flat[n])){ k=n; break; } } }
      if(k>0){ const story=flat.splice(k,1)[0]; flat.unshift(story); }
    }
    markSeen(window.localStorage, flat.slice(0,10).map(function(r){ return String(r.id||""); }));
    return;
  }
  const order=browse && ranked ? browse.ranked : [];
  (order||[]).forEach(function(id){
    if(typeof id!=="string" || !id) return;
    add({id:id, pending:true});
  });
  flat=rows;
}
// QA hook: walks the current filter and returns what a reader would see. Read-only.
window.__feedQA=async function(max){
  const out=[]; let i=0; buildFlat();
  while(flat && i<flat.length && out.length<(max||400)){
    const g=await materialize(i,1);
    if(!g.row || g.index<i) break;
    const r=g.row;
    out.push({id:String(r.id||""), kind:String(r.kind||""), readKind:String(r.readKind||""), headline:String(r.headline||r.name||""), set:String(r.setSlug||r.set||""), image:String(r.image||r.catalogueSrc||"")});
    i=g.index+1;
  }
  return {total:flat?flat.length:0, rows:out};
};
async function materialize(index, dir){
  buildFlat();
  const step=dir<0?-1:1;
  let i=index;
  if(i<0) i=0;
  if(i>=flat.length) i=flat.length-1;
  let guard=0;
  while(i>=0 && i<flat.length && guard<flat.length){
    let row=flat[i];
    if(row && row.pending){
      const full=await cardById(row.id);
      flat[i]=full || {id:row.id, skip:true};
      row=flat[i];
    }
    if(accepts(row)){
      if(!row.varied && FQ_PLAIN.test(String(row.headline||""))){ row=varyMove(row); flat[i]=row; }
      if(!row.fresh && await stalePrice(row)){
        flat[i]={id:row.id, skip:true};
        i+=step; guard++; continue;
      }
      return {row:row, index:i};
    }
    flat[i]={id:row&&row.id||"", skip:true};
    i+=step;
    guard++;
  }
  return {row:null, index:Math.max(0, index)};
}
function reduceMotion(){
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}
function indexOfId(id){
  buildFlat();
  if(!id || !flat) return -1;
  for(let i=0;i<flat.length;i++) if(flat[i] && String(flat[i].id)===String(id)) return i;
  return -1;
}
function placeLabel(){
  if(!flat || !flat.length) return "";
  let pos=0;
  let total=0;
  for(let i=0;i<flat.length;i++){
    if(flat[i] && flat[i].skip) continue;
    total++;
    if(i<=spot) pos++;
  }
  if(!total || !pos) return "";
  return pos+" of "+total;
}
let hintReady=false;
let hintOn=false;
function wantHint(){
  if(!hintReady){
    hintReady=true;
    try{ hintOn=localStorage.getItem("feed-arrows-seen")!=="1"; }catch(err){ hintOn=false; }
    try{ if(hintOn) localStorage.setItem("feed-arrows-seen","1"); }catch(err){}
  }
  return hintOn;
}
function writeUrl(f, setName, readId, push){
  const url=new URL(location.href);
  if(f) url.searchParams.set("f", f); else url.searchParams.delete("f");
  if(f==="set" && setName) url.searchParams.set("set", setName); else url.searchParams.delete("set");
  if(readId) url.searchParams.set("r", readId); else url.searchParams.delete("r");
  const next=url.pathname+url.search+url.hash;
  const cur=location.pathname+location.search+location.hash;
  if(next===cur) return;
  const state={f:f||"", set:setName||"", r:readId||""};
  if(push) history.pushState(state, "", next);
  else history.replaceState(state, "", next);
}
function commitReadUrl(row){
  if(urlIntent==="silent"){ urlIntent="push"; return; }
  const id=row && row.id ? String(row.id) : "";
  writeUrl(loopFilter, wantedSet, id, urlIntent==="push");
  urlIntent="push";
}
function nodeOf(ev){
  return ev && ev["tar"+"get"];
}
function bindSwipe(card){
  let start=null;
  let pid=0;
  function finish(ev){
    if(!start || !ev || ev.pointerId!==pid) return;
    const dx=ev.clientX-start.x;
    const dy=ev.clientY-start.y;
    start=null;
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", abort);
    if(Math.abs(dx)<60 || Math.abs(dx)<=Math.abs(dy)) return;
    card.dataset.swipe="1";
    stepRead(dx<0?1:-1);
  }
  function abort(){
    start=null;
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", abort);
  }
  card.addEventListener("pointerdown", function(ev){
    if(ev.pointerType==="mouse" && ev.button!==0) return;
    const node=nodeOf(ev);
    if(node && node.closest && node.closest("a, button, input, select, label, textarea")) return;
    if(node && node.closest && node.closest("img")) ev.preventDefault();
    start={x:ev.clientX, y:ev.clientY};
    pid=ev.pointerId;
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", abort);
  });
  card.addEventListener("pointermove", function(ev){
    if(!start || ev.pointerId!==pid) return;
    const dx=ev.clientX-start.x;
    const dy=ev.clientY-start.y;
    if(Math.abs(dx)>10 && Math.abs(dx)>Math.abs(dy)) ev.preventDefault();
  }, {passive:false});
}
function bounceCard(card, dir){
  if(!card || reduceMotion()) return;
  card.classList.remove("is-bounce-next","is-bounce-prev");
  void card.offsetWidth;
  card.classList.add(dir>0?"is-bounce-next":"is-bounce-prev");
}
let pendingStep=0;
async function stepRead(dir){
  if(!dir) return;
  if(moveBusy){ pendingStep=dir; return; }
  if(!document.getElementById("feed-loop-form")) return;
  const host=document.getElementById("feed-one");
  const card=host && (host.querySelector("article.feed-card:not(.is-leave-next):not(.is-leave-prev)") || host.querySelector("article.feed-card"));
  if(!card) return;
  buildFlat();
  if(!flat || !flat.length) return;
  moveBusy=true;
  try{
    const gen=filterGen;
    // Always advance: past either end it wraps around.
    let goTo=dir<0?spot-1:spot+1;
    if(goTo<0) goTo=flat.length-1;
    if(goTo>=flat.length) goTo=0;
    let found=await materialize(goTo, dir);
    if(gen!==filterGen) return;
    if(!found.row || found.index===spot){
      found=await materialize(dir>0?0:flat.length-1, dir);
      if(gen!==filterGen) return;
    }
    const live=host.querySelector("article.feed-card:not(.is-leave-next):not(.is-leave-prev)") || card;
    if(!found.row || found.index===spot){ bounceCard(live||card, dir); return; }
    urlIntent="push";
    await showFlat(found.index, dir);
  }finally{
    moveBusy=false;
    if(pendingStep){ const d=pendingStep; pendingStep=0; setTimeout(function(){ stepRead(d); }, 0); }
  }
}
async function showFlat(index, dir){
  const gen=filterGen;
  const found=await materialize(index, index<(spot||0)?-1:1);
  if(gen!==filterGen) return;
  spot=found.index;
  const host=document.getElementById("feed-one");
  const sections=document.getElementById("feed-sections");
  if(sections) sections.innerHTML="";
  if(!host) return;
  if(!found.row){
    host.innerHTML="";
    const p=document.createElement("p");
    p.className="muted";
    const shapeEmpty={quiet:"No quiet Near Mint window is on file.",mix:"No condition mix is on file.",conditions:"No pair of condition prices is on file.",soldflat:"No flat-price sales window is on file.",solddown:"No falling-price sales window is on file.",setshare:"No set share is on file.",spread:"No asking spread is on file.",askmove:"No ask move with a still market price is on file.",mktmove:"No market move with a still ask is on file.",still:"No unchanged ask is on file."};
    let msg=shapeEmpty[loopFilter]||"";
    if(!msg && loopFilter==="sealed") msg="No sealed reads tonight.";
    else if(!msg && loopFilter==="set" && !wantedSet) msg="Choose a set to see its reads.";
    else if(!msg && loopFilter==="set") msg="No reads for this set.";
    else if(!msg && loopFilter==="news") msg="There is no news.";
    else if(!msg && loopFilter==="wave") msg="No wave or reprint news.";
    else if(!msg && loopFilter==="flagged") msg="No flagged prices.";
    else if(!msg && loopFilter==="dive") msg="No deep dives.";
    else if(!msg && loopFilter==="volume") msg="No TCGplayer sold counts on file.";
    else if(!msg && loopFilter==="signals") msg="No signal reads tonight.";
    else if(!msg && loopFilter==="pokemon") msg="No Pokémon facts.";
    else if(!msg) msg="Nothing in this filter.";
    p.textContent=msg;
    host.appendChild(p);
    commitReadUrl(null);
    return;
  }
  const row=found.row;
  const news=row.readKind==="news" || row.kind==="news";
  const card=row.waveItem ? waveEl(row) : (news ? newsEl(row) : cardEl(row));
  if(card && isNewSinceVisit(row)){
    const nb=document.createElement("span");
    nb.className="new-badge";
    nb.textContent="New since your last visit";
    card.insertBefore(nb, card.firstChild);
  }
  let stage=host.querySelector(".feed-stage");
  if(!stage){
    host.innerHTML="";
    stage=document.createElement("div");
    stage.className="feed-stage";
    host.appendChild(stage);
  }
  stage.classList.remove("is-news");
  let pos=stage.querySelector(".read-pos");
  if(!pos){
    pos=document.createElement("p");
    pos.className="read-pos";
    stage.appendChild(pos);
  }
  pos.textContent="";
  let slide=stage.querySelector(".feed-slide");
  if(!slide){
    slide=document.createElement("div");
    slide.className="feed-slide";
    const navNow=stage.querySelector(".read-nav");
    if(navNow) stage.insertBefore(slide, navNow);
    else stage.appendChild(slide);
  }
  slide.querySelectorAll("article.is-leave-next, article.is-leave-prev").forEach(function(node){ node.remove(); });
  const old=slide.querySelector("article.feed-card");
  const animate=!!dir && !reduceMotion() && !!old;
  if(animate){
    card.classList.add(dir>0?"is-enter-next":"is-enter-prev");
    old.classList.add(dir>0?"is-leave-next":"is-leave-prev");
    const navNow=slide.querySelector(".read-nav");
    if(navNow) slide.insertBefore(card, navNow);
    else slide.appendChild(card);
    old.addEventListener("animationend", function(){ old.remove(); }, {once:true});
    setTimeout(function(){ if(old.isConnected) old.remove(); }, 260);
  }else{
    if(old) old.remove();
    const navNow=slide.querySelector(".read-nav");
    if(navNow) slide.insertBefore(card, navNow);
    else slide.appendChild(card);
  }
  if(typeof catchemMount==="function") catchemMount(stage);
  let flList=stage.querySelector(".feed-list");
  if(!flList){ flList=document.createElement("div"); flList.className="feed-list"; flList.setAttribute("aria-label","More reads"); stage.appendChild(flList); }
  fillFlatList(flList, spot, gen);
  try{
    const ahead=flat && flat[spot+1];
    const aheadHit=ahead?officialSrc(ahead, catalogueImages):null;
    if(aheadHit && aheadHit.src){
      const warm=new Image();
      warm.decoding="async";
      warm.src=aheadHit.src;
    }
  }catch(e){}
  let nav=stage.querySelector(".read-nav");
  if(!nav){
    nav=document.createElement("div");
    nav.className="read-nav";
    const prev=document.createElement("button");
    prev.type="button";
    prev.setAttribute("aria-label","Previous");
    prev.textContent="‹";
    prev.onclick=function(){ stepRead(-1); };
    const next=document.createElement("button");
    next.type="button";
    next.setAttribute("aria-label","Next");
    next.textContent="›";
    next.onclick=function(){ stepRead(1); };
    nav.appendChild(prev);
    nav.appendChild(next);
  }
  // News reads use the same card and the same side arrows as every other read.
  const buttons=nav.querySelectorAll("button");
  if(buttons[0]) buttons[0].textContent="‹";
  if(buttons[1]) buttons[1].textContent="›";
  nav.classList.toggle("hint", wantHint());
  const bar=stage.querySelector(".news-bar");
  if(nav.parentElement!==slide) slide.appendChild(nav);
  if(bar) bar.remove();
  bindSwipe(card);
  commitReadUrl(row);
}
function mergeLocalWatch(){
  var flag="catchem-watch-merged";
  fetch("/api/session").then(function(res){ return res.ok ? res.json() : null; }).then(function(view){
    if(!view || !view.signedIn) return;
    try { if(localStorage.getItem(flag)==="1") return; } catch(err) { return; }
    var cur=[];
    try { cur=JSON.parse(localStorage.getItem("catchem-watch")||"[]"); } catch(err) { cur=[]; }
    if(!Array.isArray(cur)) cur=[];
    fetch("/api/alerts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({merge:true,rows:cur.slice(0,25)})})
      .then(function(res){ if(res.ok){ try { localStorage.setItem(flag,"1"); } catch(err) {} } })
      .catch(function(){});
  }).catch(function(){});
}
async function boot(){
  const pack=await feedPack;
  mergeLocalWatch();
  const back=document.getElementById("feed-back");
  if(back) back.onclick=function(ev){
    if(sessionStorage.getItem("feed-spot") && history.length>1){ ev.preventDefault(); history.back(); }
  };
  if(pageMode==="read"){
    meta=pack[0];
    readLibrary=await grabJson("/data/feed/read-library.json");
    await showRead();
    return;
  }
  meta=pack[0];
  const sel=document.getElementById("f-set");
  if(sel){
    (meta&&meta.sets||[]).forEach(function(set){
      const o=document.createElement("option");
      o.value=set.name; o.textContent=set.name;
      sel.appendChild(o);
    });
  }
  const only=focusGroup();
  if(!only){
    browse=pack[1];
    catalogue=null;
    readLibrary=null;
    setBook={bySlug:{}, byName:{}};
    buildReadIndex();
    const setSel=document.getElementById("f-loop-set");
    function fillSetOptions(){
      if(!setSel) return;
      while(setSel.options.length>1) setSel.remove(1);
      const rows=[];
      // Every set in the catalogue, not only sets that already have a read.
      Object.keys(setBook && setBook.bySlug || {}).forEach(function(slug){
        const tile=setBook.bySlug[slug];
        if(tile && (Number(tile.priced)>0 || (setIndex && setIndex[slug] && setIndex[slug].length))) rows.push(tile);
      });
      rows.sort(function(a,b){
        const ar=String(a.release||"");
        const br=String(b.release||"");
        const aOk=/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(ar);
        const bOk=/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(br);
        if(aOk && bOk && ar!==br) return ar<br?1:-1;
        if(aOk!==bOk) return aOk?-1:1;
        return String(a.name||"").localeCompare(String(b.name||""));
      });
      rows.forEach(function(tile){
        const o=document.createElement("option");
        o.value=tile.slug;
        o.textContent=tile.name;
        if(String(tile.logo||"").indexOf("https://")===0) o.dataset.logo=tile.logo;
        setSel.appendChild(o);
      });
    }
    fillSetOptions();
    const hideBox=document.getElementById("f-hide-facts");
    if(premium && hideBox){
      try{ hideFacts=sessionStorage.getItem("hide-facts")==="1"; }catch(e){ hideFacts=false; }
      hideBox.checked=hideFacts;
      hideBox.onchange=function(){
        hideFacts=!!hideBox.checked;
        try{ sessionStorage.setItem("hide-facts", hideFacts?"1":"0"); }catch(e){}
        flat=null;
        urlIntent="replace";
        showFlat(0, 0);
      };
    }
    const loop=document.getElementById("f-loop");
    const picker=document.getElementById("set-picker");
    const setQ=document.getElementById("set-q");
    const chipRow=document.querySelector("#feed-loop-form .chip-row");
    const chipMore=document.querySelector("#feed-loop-form .chip-more");
    function knownFilter(f){
      if(!loop) return "";
      return Array.prototype.some.call(loop.options, function(o){ return o.value===f; }) ? f : "";
    }
    function sealedAvailable(){
      return sealedList().length>0;
    }
    function fitChips(){
      if(!chipRow) return;
      const buttons=chipRow.querySelectorAll("button");
      const left=chipRow.scrollLeft;
      const right=left+chipRow.clientWidth;
      let partial=null;
      for(let i=0;i<buttons.length;i++){
        const b=buttons[i];
        const bLeft=b.offsetLeft;
        const bRight=bLeft+b.offsetWidth;
        if(bLeft>=left-1 && bLeft<right-8 && bRight>right+1){ partial=b; break; }
      }
      const overflow=chipRow.scrollWidth>chipRow.clientWidth+8;
      const scroller=chipRow.parentElement;
      if(scroller){
        scroller.classList.toggle("can-scroll", overflow);
        const cover=partial ? Math.min(chipRow.clientWidth-44, Math.ceil(right-partial.offsetLeft)+6) : 48;
        scroller.style.setProperty("--chip-fade", (overflow ? cover : 0)+"px");
      }
      if(chipMore) chipMore.hidden=!overflow;
    }
    function shapeCount(kind){
      let n=0;
      const block=browse && browse.filters && browse.filters[kind];
      const items=block && block.items;
      (items||[]).forEach(function(row){ if(isShapeRow(row)) n++; });
      leadRows().forEach(function(r){ if(isShapeRow(r) && (r.readKind===kind || r.kind===kind)) n++; });
      return n;
    }
    function filterReads(f){
      if(f==="set"){
        if(!setBook || !setBook.bySlug) return 0;
        return Object.keys(setBook.bySlug).some(function(slug){
          const tile=setBook.bySlug[slug];
          return tile && (Number(tile.priced)>0 || (setIndex && setIndex[slug] && setIndex[slug].length));
        }) ? 1 : 0;
      }
      if(f==="news") return (Array.isArray(newsRows)?newsRows:[]).length;
      if(f==="sealed") return sealedList().length;
      if(f==="prices") return (browse && browse.ranked || []).length;
      if(f==="signals") return (readLibrary && readLibrary.signals || []).filter(function(r){ return r && (r.signal==="mover"||r.signal==="set"||r.signal==="high"||r.signal==="streak"); }).length;
      if(f==="pokemon") return leadRows().filter(isFact).length;
      if(f==="wave"){
        const items=browse && browse.filters && browse.filters.wave && browse.filters.wave.items || [];
        return items.filter(function(it){ return it && (it.title||it.sentence); }).length + leadRows().filter(function(r){ return r && FQ_WAVE[r.readKind]; }).length;
      }
      if(f==="flagged"){
        const items=browse && browse.filters && browse.filters.flagged && browse.filters.flagged.items || [];
        return items.length + leadRows().filter(function(r){ return r && (r.readKind==="outlier" || r.kind==="outlier" || (r.flagged && r.flagged.on)); }).length;
      }
      if(f==="dive"){
        const items=browse && browse.filters && browse.filters.dive && browse.filters.dive.items || [];
        return items.length + leadRows().filter(function(r){ return r && (r.readKind==="dive" || r.kind==="dive" || r.readKind==="deep"); }).length;
      }
      if(f==="volume") return (browse && browse.filters && browse.filters.volume && browse.filters.volume.items || []).filter(isVolumeRow).length + leadRows().filter(isVolumeRow).length;
      if(f==="quiet"||f==="mix"||f==="conditions"||f==="soldflat"||f==="solddown"||f==="setshare"||f==="spread"||f==="askmove"||f==="mktmove"||f==="still") return shapeCount(f);
      return 1;
    }
    const CHIP_MAIN={"":1,"prices":1,"sealed":1,"set":1,"signals":1,"news":1};
    let chipsAll=false;
    function paintChips(){
      if(!chipRow||!loop) return;
      chipRow.textContent="";
      let tucked=0;
      Array.prototype.forEach.call(loop.options, function(opt){
        if(opt.value!=="" && filterReads(opt.value)===0) return;
        if(!chipsAll && !CHIP_MAIN[opt.value] && opt.value!==loop.value){ tucked++; return; }
        const b=document.createElement("button");
        b.type="button";
        b.dataset.value=opt.value;
        b.textContent=opt.textContent;
        b.setAttribute("aria-pressed", opt.value===loop.value ? "true" : "false");
        b.onclick=function(){ applyFilter(opt.value, setSel ? setSel.value : "", true); };
        chipRow.appendChild(b);
      });
      if(tucked || chipsAll){
        const m=document.createElement("button");
        m.type="button";
        m.className="chip-toggle";
        m.textContent=chipsAll ? "Fewer" : "More";
        m.setAttribute("aria-expanded", chipsAll ? "true" : "false");
        m.onclick=function(){ chipsAll=!chipsAll; paintChips(); };
        chipRow.appendChild(m);
      }
      fitChips();
      requestAnimationFrame(function(){ fitChips(); });
    }
    if(chipMore) chipMore.onclick=function(){
      if(!chipRow) return;
      const buttons=chipRow.querySelectorAll("button");
      const right=chipRow.scrollLeft+chipRow.clientWidth;
      for(let i=0;i<buttons.length;i++){
        if(buttons[i].offsetLeft+buttons[i].offsetWidth>right-4){
          chipRow.scrollTo({left:Math.max(0, buttons[i].offsetLeft), behavior:"smooth"});
          return;
        }
      }
    };
    if(chipRow) chipRow.addEventListener("scroll", function(){ fitChips(); });
    window.addEventListener("resize", function(){ fitChips(); });
    let setHitsOpen=false;
    function fillSetHits(q){
      const box=document.getElementById("set-hits");
      if(!box||!setSel) return;
      const query=String(q||"").trim().toLowerCase();
      box.textContent="";
      box.hidden=!setHitsOpen;
      if(!setHitsOpen) return;
      if(!query && setBook){
        const quick=Object.keys(setBook.bySlug).map(function(k){ return setBook.bySlug[k]; }).filter(function(t){ return t && Number(t.value)>0; }).sort(function(a,b){ return Number(b.value)-Number(a.value); }).slice(0,6);
        if(quick.length){
          const row=document.createElement("div");
          row.className="set-quick";
          quick.forEach(function(t){
            const b=document.createElement("button");
            b.type="button"; b.textContent=t.name;
            b.onclick=function(){ setHitsOpen=false; if(setQ) setQ.value=t.name; if(picker) picker.classList.remove("is-open"); applyFilter("set", t.slug, true); };
            row.appendChild(b);
          });
          box.appendChild(row);
        }
      }
      let n=0;
      Array.prototype.forEach.call(setSel.options, function(opt){
        if(!opt.value) return;
        if(query && opt.textContent.toLowerCase().indexOf(query)<0) return;
        const b=document.createElement("button");
        b.type="button";
        b.setAttribute("role","option");
        const logo=String(opt.dataset.logo||"");
        if(logo.indexOf("https://")===0){
          const img=document.createElement("img");
          img.alt="";
          img.width=44;
          img.height=22;
          img.src=logo;
          b.appendChild(img);
        }
        const label=document.createElement("span");
        label.textContent=opt.textContent;
        b.appendChild(label);
        b.setAttribute("aria-selected", opt.value===setSel.value ? "true" : "false");
        b.onclick=function(){
          setHitsOpen=false;
          if(setQ) setQ.value=opt.textContent;
          if(picker) picker.classList.remove("is-open");
          applyFilter("set", opt.value, true);
        };
        box.appendChild(b);
        n++;
      });
      if(!n){
        const p=document.createElement("p");
        p.className="muted";
        p.textContent="No set matches.";
        box.appendChild(p);
      }
    }
    async function applyFilter(f, setName, push){
      filterGen++;
      const next=knownFilter(f);
      if(loop) loop.value=next;
      loopFilter=next;
      if(loopFilter==="set"){
        wantedSet=resolveSet(setName);
        setHitsOpen=wantedSet ? false : true;
      }else{
        wantedSet="";
        setHitsOpen=false;
      }
      if(setSel){
        const match=!!(wantedSet && Array.prototype.some.call(setSel.options, function(o){ return o.value===wantedSet; }));
        setSel.value=match ? wantedSet : "";
        if(setQ && document.activeElement!==setQ){
          if(match){
            const opt=Array.prototype.find.call(setSel.options, function(o){ return o.value===wantedSet; });
            setQ.value=opt ? opt.textContent : "";
          }else setQ.value="";
        }
      }
      if(picker){
        picker.hidden=loopFilter!=="set";
        picker.classList.toggle("is-open", loopFilter==="set" && setHitsOpen);
      }
      paintChips();
      if(loopFilter==="set") fillSetHits(setQ ? setQ.value : "");
      if(loopFilter==="set" && wantedSet) await ensureSetItems(wantedSet);
      flat=null;
      const startId=openRead;
      openRead="";
      if(urlIntent!=="silent") urlIntent=push?"push":"replace";
      let index=0;
      buildFlat();
      if(startId){
        const at=indexOfId(startId);
        if(at>=0) index=at;
      }
      await showFlat(index, 0);
    }
    if(setQ){
      setQ.addEventListener("input", function(){
        setHitsOpen=true;
        if(picker) picker.classList.add("is-open");
        fillSetHits(setQ.value);
      });
      setQ.addEventListener("focus", function(){
        setHitsOpen=true;
        if(picker) picker.classList.add("is-open");
        fillSetHits(setQ.value);
      });
    }
    window.addEventListener("popstate", function(){
      const q=new URLSearchParams(location.search);
      const f=q.get("f")||"";
      const setName=q.get("set")||"";
      const rid=q.get("r")||"";
      const same=f===loopFilter && (f!=="set" || setName===wantedSet);
      if(same && flat){
        urlIntent="silent";
        const at=indexOfId(rid);
        const dir=at<0?0:(at<spot?-1:(at>spot?1:0));
        showFlat(at<0?spot:at, dir);
        return;
      }
      openRead=rid;
      urlIntent="silent";
      applyFilter(f, setName, false);
    });
    document.addEventListener("keydown", function(ev){
      if(ev.altKey||ev.ctrlKey||ev.metaKey) return;
      if(ev.key!=="ArrowLeft" && ev.key!=="ArrowRight") return;
      const box=nodeOf(ev);
      if(box && box.closest && box.closest("input, textarea, select")) return;
      if(!document.querySelector("#feed-one article.feed-card")) return;
      ev.preventDefault();
      stepRead(ev.key==="ArrowRight"?1:-1);
    });
    document.addEventListener("wheel", function(ev){
      const box=nodeOf(ev);
      const card=box && box.closest && box.closest("#feed-one article.feed-card");
      if(!card) return;
      ev.preventDefault();
      const now=Date.now();
      if(now<wheelAt) return;
      if(!ev.deltaY) return;
      wheelAt=now+300;
      stepRead(ev.deltaY>0?1:-1);
    }, {passive:false});
    const startQ=new URLSearchParams(location.search);
    openRead=startQ.get("r")||"";
    urlIntent="replace";
    await applyFilter(startQ.get("f")||"", startQ.get("set")||"", false);
    const warmHeavy=function(){
      imagePack("/data/catalogue-images.json").then(function(doc){ catalogueImages=doc&&doc.images||null; }).catch(function(){});
      grabJson("/data/feed/catalogue.json").then(function(doc){ catalogue=doc; buildReadIndex(); }).catch(function(){});
      grabJson("/data/feed/read-library.json").then(function(doc){ readLibrary=doc; }).catch(function(){});
      grabJson("/data/sets.json").then(function(doc){
        const bySlug={}, byName={};
        (doc && Array.isArray(doc.sets) ? doc.sets : []).forEach(function(tile){
          if(!tile || !tile.slug || !tile.name) return;
          bySlug[tile.slug]=tile;
          if(!byName[tile.name]) byName[tile.name]=tile.slug;
        });
        setBook={bySlug:bySlug, byName:byName};
        buildReadIndex();
        fillSetOptions();
      }).catch(function(){});
    };
    if("requestIdleCallback" in window) requestIdleCallback(warmHeavy, {timeout:1800}); else setTimeout(warmHeavy, 400);
    const restCfg=(function(){ try{ return JSON.parse(document.getElementById("feed-rest").textContent)||{}; }catch(e){ return {}; } })();
    function loadRest(){
      if(!restCfg.url) return;
      fetch(restCfg.url).then(function(res){ return res.ok ? res.json() : null; }).catch(function(){ return null; }).then(function(rows){
        if(!Array.isArray(rows) || !rows.length) return;
        const have={};
        lead.forEach(function(r){ if(r && r.id!=null) have[String(r.id)]=1; });
        let added=0;
        rows.forEach(function(r){ if(r && r.id!=null && !have[String(r.id)]){ lead.push(r); added++; } });
        if(!added) return;
        buildReadIndex();
        fillSetOptions();
        const cur=flat && flat[spot||0] ? flat[spot||0].id : "";
        flat=null;
        buildFlat();
        const at=cur ? indexOfId(cur) : -1;
        if(at>=0) spot=at;
      });
    }
    if("requestIdleCallback" in window) requestIdleCallback(loadRest, {timeout:1500}); else setTimeout(loadRest, 300);
    (restCfg.sold ? fetch("/data/derived/tcgplayer-volume.json") : Promise.resolve({ok:false})).then(function(res){
      if(!res.ok) return null;
      return res.json().catch(function(){ return null; });
    }).then(function(doc){
      if(!doc || typeof doc!=="object" || Array.isArray(doc)) return;
      const loopEl=document.getElementById("f-loop");
      if(!loopEl) return;
      const have={};
      Array.prototype.forEach.call(loopEl.options, function(o){ have[o.value]=1; });
      const soldPairs=[["volume","Volume"],["quiet","No sales"],["mix","Condition mix"],["soldflat","Sold, price flat"],["solddown","Sold, price down"]];
      const anchor=Array.prototype.find.call(loopEl.options, function(o){ return o.value==="conditions"; });
      let added=false;
      soldPairs.forEach(function(pair){
        if(have[pair[0]]) return;
        const o=document.createElement("option");
        o.value=pair[0];
        o.textContent=pair[1];
        if(anchor) loopEl.insertBefore(o, anchor);
        else loopEl.appendChild(o);
        added=true;
      });
      if(added) paintChips();
    }).catch(function(){});
    await restoreSpot();
    return;
  }
  if(only){
    for(const part of only.parts) await loadSlice(part, 0);
  }
  draw();
  const form=document.getElementById("feed-filters");
  if(form) form.onchange=async function(){
    if(!catalogue){
      try{ catalogue=await (await fetch("/data/feed/catalogue.json")).json(); }catch(e){ catalogue=null; }
    }
    spot=0;
    showSpot(0);
  };
  await restoreSpot();
}
window.addEventListener("pageshow", function(ev){
  if(ev.persisted || cameBack()) restoreSpot();
});
boot();

</script>`;
  const feedTitle = page === "read" ? "Read" : (focusTitle || "The Feed");
  const feedDesc = page === "read"
    ? "One market read from Catch'em. TCGplayer market prices stay labeled separately from eBay asks."
    : "Daily market reads for Pokémon TCG collectors. Singles and sealed stay apart; asks are not solds.";
  const feedUrl = page === "read" && startId
    ? `https://catchemtcg.com/feed?id=${encodeURIComponent(startId)}`
    : "https://catchemtcg.com/feed";
  // Inline feed script: drop leading indentation (the script has no template strings).
  body = body.replace(/<script>([\s\S]*?)<\/script>/g, (m, js) => js.includes("`") ? m : `<script>${js.replace(/\n[ \t]+/g, "\n")}</script>`);
  const read = page === "read" && startId ? reads.find((row) => String(row.id) === String(startId)) : null;
  const shareImage = read ? readShareUrl(read) : "";
  return chrome("Feed", body, feedTitle, stamp, "", feedNav(opts), {
    description: feedDesc,
    url: feedUrl,
    ...(shareImage ? { image: shareImage, imageAlt: read.name || read.headline || "Catch'em read" } : {}),
  });
}

export function renderMine(stamp, opts = {}) {
  const css = `
  .mine-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;border-top:1px solid var(--line);padding:12px 0}
  .mine-row a{font:600 18px/1.3 var(--serif);flex:1 1 180px}
  .mine-row button,.mine-sort{min-height:44px}
  .mine-row p{margin:0;flex:1 1 100%}
  `;
  const body = `<style>${css}</style><main id="main" tabindex="-1" class="wrap">
<p><a href="/feed">Back</a></p>
<h1>Tracked</h1>
<p class="muted" id="mine-note">Nothing saved on this device yet.</p>
<label class="mine-sort">Sort
  <select id="mine-sort" aria-label="Sort tracked reads">
    <option value="custom">Your order</option>
    <option value="newest">Newest</option>
    <option value="move">Biggest move</option>
  </select>
</label>
<ul id="mine-list"></ul>
</main>
<script>
${productTypeLabel.toString()}
${brandedTile.toString()}
${ptcgFile.toString()}
${nextImage.toString()}
const money=n=>!(Number(n)>0)?"":"$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
function html(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){if(c==="&")return "&"+"amp;";if(c==="<")return "&"+"lt;";if(c===">")return "&"+"gt;";if(c==='"')return "&"+"quot;";return "&"+"#39;"})}
let rows=[];
let dragId="";
function status(row){
  const bits=[];
  if(Number(row.pct)>0) bits.push(row.pct+"% "+(row.direction==="either"?"either way":row.direction));
  else if(Number(row.price)>0) bits.push("price "+money(row.price));
  if(row.listingsBelow && row.listingsAbove) bits.push("listings below "+row.listingsBelow+" or above "+row.listingsAbove);
  else if(row.listingsBelow) bits.push("listings below "+row.listingsBelow);
  else if(row.listingsAbove) bits.push("listings above "+row.listingsAbove);
  return bits.length ? "Alert: "+bits.join(". ") : "Alert saved";
}
function saveOrder(){
  try { localStorage.setItem("catchem-watch", JSON.stringify(rows)); } catch(err) {}
}
function readLocal(){
  try {
    var cur=JSON.parse(localStorage.getItem("catchem-watch")||"[]");
    return Array.isArray(cur)?cur:[];
  } catch(err) { return []; }
}
function pidOf(row){
  const sku=String(row&&row.sku||"");
  const skuHit=sku.match(/^tcgcsv-([0-9]+)$/);
  if(skuHit) return skuHit[1];
  const id=String(row&&row.id||"");
  const hit=id.match(/tcgcsv-([0-9]+)/);
  return hit?hit[1]:"";
}
function missMine(img){
  if(nextImage(img)) return;
  const box=document.createElement("div");
  box.innerHTML=brandedTile("row",{kind:img.getAttribute("data-kind")||"single",name:img.alt||""});
  if(box.firstChild) img.replaceWith(box.firstChild);
}
function faceHtml(row){
  const pid=pidOf(row);
  const scan=row.kind==="sealed"?"":ptcgFile(row.id);
  const list=[pid?"/api/card-img?pid="+pid:"", scan?"/data/editor/tcg/"+scan:""].filter(Boolean);
  if(!list.length) return brandedTile("row",{kind:row.kind||"single",name:row.name||row.headline,id:row.id,sku:row.sku});
  return '<img alt="'+html(row.name||"")+'" width="64" height="89" loading="lazy" decoding="async" data-kind="'+(row.kind||"single")+'" src="'+list[0]+'"'+(list.length>1?' data-alts="'+list.slice(1).join("|")+'"':'')+' onerror="missMine(this)">';
}
function draw(){
  const list=document.getElementById("mine-list");
  list.innerHTML="";
  rows.forEach(function(row, index){
    const li=document.createElement("li");
    li.className="mine-row";
    li.draggable=true;
    const seven=Number.isFinite(Number(row.change7)) ? "7D "+(Number(row.change7)>0?"+":"")+row.change7+"%" : "7D not on file";
    const listed=Number(row.listings)>=0 && row.listingsAsOf ? "Listings counted "+row.listings+" as of "+row.listingsAsOf : "Listings counted not on file";
    const href=row.href||("/feed/r/"+encodeURIComponent(row.id));
    const sku=String(row.sku||"");
    const quick=/^tcgcsv-[0-9]+$/.test(sku)?sku:(/^tcgcsv-[0-9]+$/.test(String(row.id||""))?String(row.id):"");
    if(quick) li.setAttribute("data-quick", quick);
    li.innerHTML=faceHtml(row)+'<a href="'+href+'"'+(quick?' data-quick="'+html(quick)+'"':"")+'>'+html(row.name||row.headline||"Read")+'</a><b>'+money(row.market||row.price)+'</b><p>'+html(seven)+'</p><p class="muted">'+html(listed)+'</p><p>'+html(row.headline||"")+'</p><button type="button" data-act="up">Up</button><button type="button" data-act="down">Down</button><button type="button" data-act="remove">Remove</button>';
    li.ondragstart=function(){ dragId=row.id; };
    li.ondragover=function(ev){ ev.preventDefault(); };
    li.ondrop=function(ev){
      ev.preventDefault();
      const from=rows.findIndex(function(item){return item.id===dragId});
      const to=index;
      if(from<0 || from===to) return;
      const item=rows.splice(from,1)[0];
      rows.splice(to,0,item);
      saveOrder();
      draw();
    };
    li.querySelector("[data-act=up]").onclick=function(){ move(index,-1); };
    li.querySelector("[data-act=down]").onclick=function(){ move(index,1); };
    li.querySelector("[data-act=remove]").onclick=function(){
      rows=rows.filter(function(item){return item.id!==row.id});
      saveOrder();
      draw();
    };
    list.appendChild(li);
  });
  document.getElementById("mine-note").textContent=rows.length ? rows.length+" saved on this device." : "Nothing saved on this device yet.";
}
function move(index, dir){
  const next=index+dir;
  if(next<0 || next>=rows.length) return;
  const item=rows.splice(index,1)[0];
  rows.splice(next,0,item);
  saveOrder();
  draw();
}
document.getElementById("mine-sort").onchange=function(ev){
  const mode=ev.currentTarget.value;
  if(mode==="newest") rows.sort(function(a,b){return String(b.at||"").localeCompare(String(a.at||""))});
  else if(mode==="move") rows.sort(function(a,b){return Math.abs(Number(b.changePct)||0)-Math.abs(Number(a.changePct)||0)});
  if(mode!=="custom") saveOrder();
  draw();
};
rows=readLocal();
draw();
</script>`;
  return chrome("Tracked", body, "Tracked", stamp, "", feedNav(opts));
}

export function renderAll(bundle, stamp, opts = {}) {
  const reads = (bundle?.reads || []).filter((r) => !/^deep-artist-/.test(String(r?.id || "")) && !/^Artist spotlight\b/i.test(String(r?.headline || "")));
  const body = `<main id="main" tabindex="-1" class="wrap"><p class="muted">Updated ${esc(bundle?.asOf || "")}. The short list is <a href="/feed">one read at a time</a>.</p><h1>All reads</h1>
${reads.map((r) => {
    const line = soldSafeText(r, r.headline);
    if (!line) return "";
    return `<div class="row">${imageTag(officialSrc(r, null).src, "row", line, r)}<a href="/feed/r/${esc(r.id)}"><b>${esc(line)}</b></a><b>${money(r.price) || ""}</b></div>`;
  }).join("")}
</main>`;
  return chrome("Feed", body, "All reads", stamp, "", feedNav(opts));
}

export function renderReleases(doc, stamp, opts = {}) {
  const today = opts.today || new Date().toISOString().slice(0, 10);
  return chrome("Releases", releasesBody(doc, today, opts.sets), "Coming up", stamp, "", feedNav(opts));
}

export function renderSetValuePage(slug, title, html, stamp, opts = {}) {
  const body = `<main id="main" tabindex="-1" class="wrap"><h1>${esc(title)}</h1>${opts.rotationHtml || ""}${html}</main>`;
  return chrome("Sets", body, title, stamp, "", feedNav(opts));
}

export function renderPractice(sets, slug, setDoc, pool, stamp, opts = {}) {
  const options = sets.map((x) => `<option value="${esc(x.slug)}"${x.slug === slug ? " selected" : ""}>${esc(x.name)}${x.release ? ` (${esc(longDay(x.release))})` : ""}</option>`).join("");
  const name = setDoc?.name || slug;
  const art = opts.art || null;
  const data = JSON.stringify({ slug, name, asOf: setDoc?.asOf || "", size: PACK_SIZE, pool, art }).replace(/</g, "\\u003c");
  const css = `.pp-stage{position:relative;display:flex;flex-direction:column;align-items:center;gap:12px;margin:12px 0;min-height:420px}
.pp-pack{position:relative;width:min(240px,64vw);aspect-ratio:5/8.6;border:0;padding:0;background:none;cursor:pointer;touch-action:pan-y;filter:drop-shadow(0 10px 18px rgba(0,0,0,.45));animation:ppBob 2.4s ease-in-out infinite}
.pp-pack .half{position:absolute;left:0;right:0;overflow:hidden;transition:transform .6s cubic-bezier(.2,.8,.3,1),opacity .6s}
.pp-pack .top{top:0;height:18%;border-radius:var(--r-sm) var(--r-sm) 0 0}.pp-pack .bot{bottom:0;height:82%;border-radius:0 0 var(--r-sm) var(--r-sm)}.pp-pack .half img{border-radius:0}
.pp-pack .half img,.pp-pack .half .tile{position:absolute;left:0;width:100%;height:auto}
.pp-pack .top img,.pp-pack .top .tile{top:0}.pp-pack .bot img,.pp-pack .bot .tile{bottom:0}
.pp-pack.torn{animation:none}.pp-pack.torn .top{transform:translate(40%,-120%) rotate(18deg);opacity:0}.pp-pack.torn .bot{transform:translateY(130%);opacity:0}
.pp-pack .hint{position:absolute;left:50%;bottom:-34px;transform:translateX(-50%);white-space:nowrap;font-weight:600;color:var(--gold)}
@keyframes ppBob{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-6px) rotate(1deg)}}
.pp-deck{position:relative;width:min(260px,70vw);aspect-ratio:63/88;perspective:1200px}
.pp-flip{position:absolute;inset:0;border:0;padding:0;background:none;cursor:pointer;transform-style:preserve-3d;transition:transform .55s ease}
.pp-flip.up{transform:rotateY(180deg)}
.pp-face{position:absolute;inset:0;backface-visibility:hidden;border-radius:var(--r-card);overflow:hidden;display:flex;align-items:center;justify-content:center}
.pp-back{background:radial-gradient(circle at 50% 50%,#e8c05a 0 14%,#1b2333 15% 22%,#c33 23% 49%,#1b2333 50% 53%,#f4f4f4 54%);border:6px solid #1b2333}
.pp-front{transform:rotateY(180deg);background:transparent}.pp-front img,.pp-front .tile{width:100%;height:100%;object-fit:contain;background:transparent;border-radius:10px}
.pp-card img.card-face{width:100%;border-radius:10px;background:transparent}
.pp-hit .pp-front{box-shadow:0 0 0 3px var(--gold),0 0 28px 6px rgba(232,192,90,.75)}
.pp-hit .pp-front::after{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.55) 45%,rgba(120,220,255,.35) 52%,transparent 65%);background-size:250% 100%;mix-blend-mode:screen;animation:ppShine 1.6s linear infinite}
.pp-rh .pp-front::after{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,0,150,.18),rgba(0,200,255,.18),rgba(255,230,0,.18));mix-blend-mode:screen}
@keyframes ppShine{from{background-position:150% 0}to{background-position:-100% 0}}
.pp-shake{animation:ppShake .4s}@keyframes ppShake{0%,100%{transform:none}25%{transform:translate(-4px,2px)}50%{transform:translate(4px,-2px)}75%{transform:translate(-2px,1px)}}
.pp-burst{position:absolute;inset:0;pointer-events:none;overflow:visible}.pp-burst i{position:absolute;left:50%;top:40%;width:8px;height:12px;border-radius:2px;animation:ppPop 1s ease-out forwards}
@keyframes ppPop{to{transform:translate(var(--x),var(--y)) rotate(var(--r));opacity:0}}
.pp-info{text-align:center;min-height:72px;overflow-wrap:anywhere}.pp-info .tag{display:inline-block;padding:2px 8px;border:1px solid var(--gold);border-radius:999px;color:var(--gold);font-weight:600;font-size:.85rem}
.pp-big{font:700 1.3rem/1.2 var(--serif);color:var(--gold)}
.pp-count{color:var(--muted,#999)}.pp-row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.pp-actions{display:flex;flex-direction:column;align-items:stretch;gap:10px;margin:16px 0;width:100%}
.pp-actions .pp-btn{width:100%;min-height:48px;padding:0 22px;border-radius:12px;font:600 16px/1 var(--sans);cursor:pointer}
.pp-primary{background:var(--gold);border:1px solid var(--gold);color:#12100e}
.pp-primary:hover{filter:brightness(1.08)}
.pp-secondary{background:transparent;border:1px solid var(--gold);color:var(--gold)}
.pp-quiet{align-self:center;min-height:44px;padding:0 12px;background:none;border:0;color:var(--muted,#9a9184);font:500 14px var(--sans);text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.pp-quiet:hover{color:var(--txt)}
@media (min-width:600px){.pp-actions{flex-direction:row;flex-wrap:wrap;align-items:center;justify-content:center}.pp-actions .pp-btn{width:auto;min-width:200px}.pp-quiet{align-self:center}}

.pp-card.hit{outline:2px solid var(--gold);border-radius:8px}
@media (prefers-reduced-motion:reduce){.pp-pack,.pp-pack .half,.pp-flip{animation:none!important;transition:none!important}.pp-hit .pp-front::after,.pp-burst,.pp-shake{animation:none!important;display:none}}`;
  const body = `<main id="main" tabindex="-1" class="wrap practice"><style>${css}</style><h1>Practice pack</h1>
<p class="pp-note"><b>${esc(PRACTICE_NOTE)}</b></p>
<form class="filters" method="get" action="/practice"><label for="pp-set">Set</label> <select id="pp-set" name="set" onchange="this.form.submit()">${options}</select><noscript><button type="submit">Pick</button></noscript></form>
<p class="muted">${esc(name)}: ${pool.length} singles in the set file. Each pack is ${PACK_SIZE} cards: 5 Common, 3 Uncommon, 1 reverse holo slot, then 1 Rare or better last. Pack art: ${art ? esc(art.name) : "Catch'em tile, no booster pack in the set file"}.</p>
<div class="pp-actions"><button type="button" id="pp-open" class="pp-btn pp-primary">Open a pack</button><button type="button" id="pp-binder-btn" class="pp-btn pp-secondary">View binder</button></div>
<div id="pp-stage" class="pp-stage" aria-live="polite"></div>
<div id="pp-out" aria-live="polite"></div>
<section id="pp-binder" hidden></section>
<script type="application/json" id="pp-data">${data}</script>
<script>
${seededRandom.toString()}
var SLOTS=${JSON.stringify(SLOTS)},TIERS=${JSON.stringify(TIERS)};
${buildPack.toString()}
${productTypeLabel.toString()}
${brandedTile.toString()}
(function(){
var D=JSON.parse(document.getElementById("pp-data").textContent);
var RM=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
var KEY="catchem-practice-binder";
function h(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return "&#"+c.charCodeAt(0)+";"});}
var M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function day(s){return /^\\d{4}-\\d{2}-\\d{2}$/.test(s)?M[Number(s.slice(5,7))-1]+" "+Number(s.slice(8,10))+", "+s.slice(0,4):"";}
function cash(n){return "$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});}
function $(id){return document.getElementById(id);}
window.ppMiss=function(img){var a=(img.getAttribute("data-alts")||"").split("|").filter(Boolean);if(a.length){img.setAttribute("data-alts",a.slice(1).join("|"));img.src=a[0];return;}var d=document.createElement("div");d.innerHTML=brandedTile(img.getAttribute("data-k")||"card",{kind:img.getAttribute("data-k")==="sealed"?"sealed":"single",name:img.alt});img.replaceWith(d.firstChild);};
function pic(src,alts,alt,k){return src?'<img alt="'+h(alt)+'" data-k="'+k+'"'+(k==="card"?' class="shot card-face" data-crop-card="1" onload="if(window.cropCardEdge)cropCardEdge(this)"':'')+' src="'+h(src)+'" data-alts="'+h((alts||[]).join("|"))+'" onerror="ppMiss(this)">':brandedTile(k,{kind:k==="sealed"?"sealed":"single",name:alt});}
function load(){try{return JSON.parse(localStorage.getItem(KEY)||"{}")||{};}catch(e){return {};}}
function save(b){try{localStorage.setItem(KEY,JSON.stringify(b));}catch(e){}}
function collect(c){var b=load();var k=c.id+(c.rh?":rh":"");var e=b[k]||{id:c.id,name:c.name,num:c.num,rarity:c.rarity,rh:c.rh,set:D.name,src:c.src,alts:c.alts,n:0};e.n++;e.price=c.price;e.date=c.date;b[k]=e;save(b);}
function priceLine(c){return c.price>0?'<b>'+cash(c.price)+'</b> <span class="muted">TCGplayer market, '+h(day(c.date))+'</span>':'';}
function burst(el){if(RM)return;var b=document.createElement("div");b.className="pp-burst";var cols=["#e8c05a","#ff4d6d","#4dd2ff","#fff","#7cff7c"];for(var i=0;i<28;i++){var p=document.createElement("i");var a=Math.random()*6.283,r=90+Math.random()*120;p.style.setProperty("--x",Math.cos(a)*r+"px");p.style.setProperty("--y",Math.sin(a)*r+"px");p.style.setProperty("--r",(Math.random()*720)+"deg");p.style.background=cols[i%5];b.appendChild(p);}el.appendChild(b);setTimeout(function(){b.remove();},1100);}
function shake(){if(RM)return;var m=$("main");m.classList.remove("pp-shake");void m.offsetWidth;m.classList.add("pp-shake");}
var pack=[],seed=0,at=0;
function showPack(s){
  seed=s;pack=buildPack(D.pool,s);at=0;$("pp-out").innerHTML="";$("pp-binder").hidden=true;
  var A=D.art||{};
  var img=pic(A.src,A.alts,A.name||D.name+" booster pack","sealed");
  $("pp-stage").innerHTML='<button type="button" class="pp-pack" id="pp-pack" aria-label="Tear open the '+h(A.name||D.name)+' pack"><span class="half top">'+img+'</span><span class="half bot">'+img+'</span><span class="hint">Tap or swipe to tear</span></button><p class="muted">Pack #'+s+'</p>';
  var el=$("pp-pack"),x0=null;
  el.addEventListener("click",tear);
  el.addEventListener("pointerdown",function(e){x0=e.clientX;});
  el.addEventListener("pointerup",function(e){if(x0!=null&&Math.abs(e.clientX-x0)>30)tear();x0=null;});
}
function tear(){var el=$("pp-pack");if(!el||el.classList.contains("torn"))return;el.classList.add("torn");setTimeout(deal,RM?0:650);}
function deal(){
  $("pp-stage").innerHTML='<div class="pp-deck" id="pp-deck"></div><div class="pp-info" id="pp-info"></div><p class="pp-count" id="pp-count"></p>';
  next();
}
function next(){
  if(at>=pack.length)return done();
  var c=pack[at],last=at===pack.length-1;
  $("pp-deck").innerHTML='<button type="button" class="pp-flip'+(c.hit?" pp-hit":"")+(c.rh?" pp-rh":"")+'" id="pp-flip" aria-label="Flip card '+(at+1)+'"><span class="pp-face pp-back"></span><span class="pp-face pp-front">'+pic(c.src,c.alts,c.name,"card")+'</span></button>';
  $("pp-info").innerHTML=last?'<span class="tag">Rare slot</span><p>Tap to flip the last card</p>':'<p>Tap to flip</p>';
  $("pp-count").textContent="Card "+(at+1)+" of "+pack.length;
  var f=$("pp-flip");
  f.addEventListener("click",function once(){
    if(!f.classList.contains("up")){
      f.classList.add("up");collect(c);
      $("pp-info").innerHTML=(c.hit?'<p class="pp-big">Big hit!</p>':'')+'<p><span class="tag">'+h(c.rh?"Reverse Holo":c.rarity||"Card")+'</span></p><p><a href="/c/'+encodeURIComponent(c.id)+'"><b>'+h(c.name)+'</b></a> <span class="muted">'+h(c.num)+'</span></p><p>'+priceLine(c)+'</p><p class="muted">Added to your binder. Tap the card for the next one.</p>';
      if(c.hit){setTimeout(function(){burst($("pp-deck"));shake();},RM?0:450);}
    } else {at++;next();}
  });
}
function done(){
  var total=0,priced=0,dates={};
  var rows=pack.map(function(c){if(c.price>0){total+=c.price;priced++;if(c.date)dates[c.date]=1;}
    return '<li class="pp-card'+(c.hit?" hit":"")+'" data-id="'+h(c.id)+'" data-slot="'+h(c.slot)+'">'+pic(c.src,c.alts,c.name,"card")+'<a href="/c/'+encodeURIComponent(c.id)+'"><b>'+h(c.name)+'</b></a><span class="muted">'+h(c.num)+(c.rarity?" · "+h(c.rarity):"")+(c.rh?" · Reverse Holo":"")+'</span><span>'+priceLine(c)+'</span></li>';}).join("");
  var ds=Object.keys(dates).sort(),when=ds.length?(ds.length===1?day(ds[0]):day(ds[0])+" to "+day(ds[ds.length-1])):"";
  var link="/practice?set="+encodeURIComponent(D.slug)+"&seed="+seed;
  $("pp-stage").innerHTML="";
  $("pp-out").innerHTML='<p class="pp-total">Pack total <b>'+cash(total)+'</b></p><p class="muted">'+priced+' of '+pack.length+' cards priced. TCGplayer market'+(when?", "+h(when):"")+'. Pack <a href="'+h(link)+'">#'+seed+'</a>.</p><div class="pp-actions"><button type="button" class="pp-btn pp-primary" id="pp-again">Open another pack</button><button type="button" class="pp-btn pp-secondary" id="pp-see">View binder</button></div><ol class="pp-grid">'+rows+'</ol>';
  $("pp-again").addEventListener("click",fresh);$("pp-see").addEventListener("click",binder);
}
function binder(){
  var b=load(),keys=Object.keys(b),n=0,total=0,dates={};
  keys.forEach(function(k){var e=b[k];n+=e.n;if(e.price>0){total+=e.price*e.n;if(e.date)dates[e.date]=1;}});
  keys.sort(function(a,c){return (b[c].price||0)-(b[a].price||0);});
  var ds=Object.keys(dates).sort(),when=ds.length?(ds.length===1?day(ds[0]):day(ds[0])+" to "+day(ds[ds.length-1])):"";
  var el=$("pp-binder");el.hidden=false;$("pp-stage").innerHTML="";$("pp-out").innerHTML="";
  el.innerHTML='<h2>My practice binder</h2><p>'+n+' cards, '+keys.length+' different. Total value <b>'+cash(total)+'</b>'+(when?' <span class="muted">TCGplayer market, '+h(when)+' (the date each card was pulled)</span>':'')+'.</p><p class="muted">Saved on this device only. No account needed.</p><div class="pp-actions"><button type="button" class="pp-btn pp-primary" id="pp-b-open">Open another pack</button>'+(keys.length?'<button type="button" class="pp-quiet" id="pp-b-clear">Clear binder</button>':'')+'</div><ol class="pp-grid">'+keys.map(function(k){var e=b[k];return '<li class="pp-card">'+pic(e.src,e.alts,e.name,"card")+'<a href="/c/'+encodeURIComponent(e.id)+'"><b>'+h(e.name)+'</b></a><span class="muted">'+h(e.set)+' · '+h(e.rarity)+(e.rh?" · Reverse Holo":"")+'</span><span>x'+e.n+' · '+priceLine(e)+'</span></li>';}).join("")+'</ol>';
  $("pp-b-open").addEventListener("click",fresh);
  var cl=$("pp-b-clear");if(cl)cl.addEventListener("click",function(){if(confirm("Clear your practice binder?")){save({});binder();}});
}
function fresh(){var s=(Math.random()*4294967295)>>>0||1;history.replaceState(null,"","/practice?set="+encodeURIComponent(D.slug)+"&seed="+s);showPack(s);window.scrollTo(0,$("pp-stage").offsetTop-60);}
$("pp-open").addEventListener("click",fresh);
$("pp-binder-btn").addEventListener("click",binder);
var q=new URLSearchParams(location.search).get("seed");
if(q&&/^\\d+$/.test(q)) showPack(Number(q)>>>0); else if(new URLSearchParams(location.search).get("view")==="binder") binder();
})();
</script>
</main>`;
  return chrome("Practice", body, "Practice pack", stamp, "", feedNav(opts));
}
export { chrome as pageChrome };

// Branded 404 for any path the site does not serve.
export function renderNotFound(stamp = "", opts = {}) {
  const body = `<main id="main" tabindex="-1" class="wrap nf">
<style>.nf{max-width:640px;margin:0 auto;padding:48px 16px 64px;text-align:center}.nf-card{background:#1a1815;border:1px solid #2f2b26;border-radius:22px;padding:36px 22px}.nf-code{font:600 64px/1 var(--serif);color:var(--gold);margin:0 0 8px}.nf h1{margin:0 0 10px}.nf form{display:flex;gap:8px;margin:22px auto 18px;max-width:440px}.nf input{flex:1;min-width:0;min-height:44px;border-radius:14px;border:1px solid #3a352e;background:#12100e;color:inherit;padding:0 14px;font:inherit}.nf button{min-height:44px;border-radius:14px;border:0;background:var(--gold);color:#12100e;padding:0 18px;font:600 15px/1 inherit;cursor:pointer}.nf-links{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:0}.nf-links a{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border-radius:999px;border:1px solid #3a352e;text-decoration:none}</style>
<div class="nf-card">
<p class="nf-code">404</p>
<h1>This page is not here</h1>
<p class="muted">The link may be old or mistyped. Try a search, or head back home.</p>
<form method="get" action="/search" role="search"><input name="q" aria-label="Search cards and sets" placeholder="Search a card, set, or number"><button type="submit">Search</button></form>
<p class="nf-links"><a href="/">Home</a><a href="/sets">All sets</a><a href="/releases">Releases</a></p>
</div>
</main>`;
  return chrome("Not found", body, "Page not found", stamp, "", feedNav(opts));
}
