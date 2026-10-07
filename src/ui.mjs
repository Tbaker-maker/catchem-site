import { BUILD_SHA } from "./build-stamp.mjs";
import { DISCORD_INVITE, INVITE_LINE } from "./auth.mjs";
import { feedNews } from "../data/feed-news.mjs";

const DISCORD = DISCORD_INVITE;

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
  const rec = row.receipt;
  if (!path || !rec || typeof rec !== "object") return false;
  if (kind === "quiet") return path.includes("No TCGplayer sales recorded in " + rec.days + " days.") && path.includes("That is not a scarcity claim.") && path.includes(shapeCash(rec.price));
  if (kind === "mix") {
    if (!path.includes("This is the mix of copies that sold, not the copy in your hand.")) return false;
    if (!Array.isArray(rec.conditions) || rec.conditions.length < 2) return false;
    for (let i = 0; i < rec.conditions.length; i += 1) {
      const bit = rec.conditions[i];
      if (!bit || !path.includes(String(bit.sold) + " " + bit.condition)) return false;
    }
    return true;
  }
  if (kind === "conditions") return path.includes("Two condition prices. Not a grade result.") && path.includes(shapeCash(rec.nearMint)) && path.includes(shapeCash(rec.played)) && path.includes(String(rec.playedCondition || ""));
  if (kind === "soldflat") return path.includes("Sales and a price change in the same window. Not a cause.") && path.includes(String(rec.sold)) && path.includes(shapeCash(rec.price));
  if (kind === "solddown") return path.includes("Sales and a price change in the same window. Not a cause.") && path.includes(String(rec.sold)) && path.includes(shapeCash(rec.fromPrice)) && path.includes(shapeCash(rec.toPrice));
  if (kind === "setshare") return path.includes("Share of copies sold. Not share of dollars.") && path.includes(String(rec.top)) && path.includes(String(rec.total));
  if (kind === "spread") return path.includes("Asking prices from the search. Not sold prices.") && path.includes(shapeCash(rec.low)) && path.includes(shapeCash(rec.high));
  if (kind === "askmove") return path.includes("The ask changed. The market price did not. Asks are not sales.") && path.includes(shapeCash(rec.askFrom)) && path.includes(shapeCash(rec.askTo)) && path.includes(shapeCash(rec.market));
  if (kind === "mktmove") return path.includes("The market price changed. The ask did not. Asks are not sales.") && path.includes(shapeCash(rec.marketFrom)) && path.includes(shapeCash(rec.marketTo)) && path.includes(shapeCash(rec.ask));
  if (kind === "still") return path.includes("Asks and listing count. Not sales.") && path.includes(shapeCash(rec.price)) && path.includes(String(rec.listingCount));
  return false;
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
// count, and the dex. No price is added to make the row show.
export function isFactRow(row) {
  if (!row || typeof row !== "object") return false;
  if (row.readKind !== "pokemon" && row.kind !== "pokemon") return false;
  const cardCount = row.cardCount;
  const artistCount = row.artistCount;
  const dex = row.dex;
  if (!Number.isInteger(cardCount) || !Number.isInteger(artistCount) || !Number.isInteger(dex)) return false;
  if (cardCount < 1 || artistCount < 1 || dex < 1) return false;
  return String(row.headline || row.path || "").trim().length > 0;
}

// English is cardCount when the file has no separate language split.
// Japanese is said only when that count is already on the row.
export function pokemonFactLine(row) {
  if (!row || typeof row !== "object") return "";
  const name = String(row.name || "").trim();
  if (!name) return "";
  let english = Number.isInteger(row.englishCount) && row.englishCount >= 0 ? row.englishCount : null;
  if (english == null && Number.isInteger(row.enCount) && row.enCount >= 0) english = row.enCount;
  let japanese = Number.isInteger(row.japaneseCount) && row.japaneseCount >= 0 ? row.japaneseCount : null;
  if (japanese == null && Number.isInteger(row.jaCount) && row.jaCount >= 0) japanese = row.jaCount;
  if (japanese == null && Number.isInteger(row.jpCount) && row.jpCount >= 0) japanese = row.jpCount;
  if (english == null && Number.isInteger(row.cardCount) && row.cardCount >= 0) english = row.cardCount;
  const parts = [];
  if (english != null) parts.push(`${english} English TCG card${english === 1 ? "" : "s"}`);
  if (japanese != null) parts.push(`${japanese} Japanese TCG card${japanese === 1 ? "" : "s"}`);
  if (!parts.length) return "";
  if (parts.length === 1) return `${name} has ${parts[0]}.`;
  return `${name} has ${parts[0]} and ${parts[1]}.`;
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

function isNewReveal(item) {
  const title = String(item.title || "") + " " + String(item.titleEn || "");
  return /\breveal(?:ed|s|ing)?\b/i.test(title);
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
    const older = date < cut;
    if (older && !isNewReveal(item) && !releaseInNextTwoWeeks(item, asOf)) continue;
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
    const original = String(item.originalTitle || "").trim();
    if (original) row.originalTitle = original;
    else if (nonEnglishTitle(item.title)) row.originalTitle = String(item.title || "").trim();
    const place = newsPlace(item, name);
    if (place) row.place = place;
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

export function keepFeedRead(row) {
  if (!row || typeof row !== "object") return false;
  if (!String(row.headline || row.path || "").trim()) return false;
  if (isFactRow(row)) return true;
  if (isLagRow(row)) return true;
  if (isSupplyRow(row)) return true;
  if (isOutlierRow(row)) return true;
  if (isDiveRow(row)) return true;
  if (isVolumeRow(row)) return true;
  if (isShapeRow(row)) return true;
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
    if (filter === "sealed" && row.kind !== "sealed") return;
    if (filter === "set" && setName && row.set !== setName) return;
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
  const payload = esc(JSON.stringify(hist || []));
  return `<div class="chart-box"><div class="chart" data-chart="${payload}" data-release="${esc(release || "")}" data-caption="${esc(caption)}" style="height:180px;min-height:180px"></div><div class="filters" data-ranges><button type="button" data-range="7D">7D</button><button type="button" data-range="30D">30D</button><button type="button" data-range="90D">90D</button><button type="button" data-range="1Y">1Y</button><button type="button" data-range="All" aria-pressed="true">All</button></div><p class="muted chart-note"></p></div>`;
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
  return dedup;
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
    host.innerHTML='<p class="muted" style="margin:0">No daily points in this range.</p>';
    if(hover) hover.textContent="";
    if(note) note.textContent=(caption||"TCGplayer market, daily")+". No daily points in this range.";
    return;
  }
  var wMeasured=host.getBoundingClientRect?Math.round(host.getBoundingClientRect().width):0;
  var w=wMeasured>=280?wMeasured:640,h=Number(host.getAttribute("data-h"))||180,min=Math.min.apply(null,pts.map(function(p){return p.v})),max=Math.max.apply(null,pts.map(function(p){return p.v}));
  host.style.height=h+"px";
  host.style.minHeight=h+"px";
  var span=max-min||Math.max(max*0.04,0.01);
  var lo=min-span*0.08, hi=max+span*0.08, plot=hi-lo;
  var step=(w-112)/Math.max(1,pts.length-1);
  function y(v){return (22+((hi-v)/plot)*(h-52));}
  var d=pts.map(function(p,i){return (i?"L":"M")+(96+i*step).toFixed(1)+","+y(p.v).toFixed(1)}).join(" ");
  var rel="";
  if(release){
    for(var i=0;i<pts.length;i++){
      if(pts[i].d>=release){ rel='<line x1="'+(96+i*step).toFixed(1)+'" y1="18" x2="'+(96+i*step).toFixed(1)+'" y2="'+(h-30)+'" stroke="#6f9be8" stroke-dasharray="3 3"/>'; break; }
    }
  }
  var money=function(n){return "$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})};
  function when(d){var parts=String(d).split("-"); var months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return months[(Number(parts[1])||1)-1]+" "+Number(parts[2])+", "+parts[0];}
  var label=(caption||"TCGplayer market, daily").replace(/"/g,"");
  host.innerHTML='<svg width="100%" height="'+h+'" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+label+" "+when(pts[0].d)+" "+money(pts[0].v)+" to "+when(pts[pts.length-1].d)+" "+money(pts[pts.length-1].v)+'" style="display:block;width:100%;height:'+h+'px;min-height:'+h+'px;flex:none;touch-action:pan-y"><text x="6" y="20" fill="#efe9de" font-size="14">'+money(max)+'</text><text x="6" y="'+(h-32)+'" fill="#efe9de" font-size="14">'+money(min)+'</text>'+rel+'<path d="'+d+'" fill="none" stroke="#d9b779" stroke-width="2.5" stroke-linecap="butt" stroke-linejoin="miter"></path><text x="96" y="'+(h-8)+'" fill="#efe9de" font-size="14">'+pts[0].d.slice(5)+'</text><text x="'+(w-72)+'" y="'+(h-8)+'" fill="#efe9de" font-size="14">'+pts[pts.length-1].d.slice(5)+'</text></svg>';
  if(note) note.textContent=(caption||"TCGplayer market, daily")+". "+when(pts[0].d)+" "+money(pts[0].v)+" to "+when(pts[pts.length-1].d)+" "+money(pts[pts.length-1].v)+".";
  if(hover) hover.textContent=when(pts[pts.length-1].d)+" · "+money(pts[pts.length-1].v);
  var svg=host.querySelector("svg");
  function show(ev){
    if(!svg||!hover) return;
    var rect=svg.getBoundingClientRect();
    if(!rect.width) return;
    var x=(ev.clientX-rect.left)/rect.width*w;
    var i=Math.round((x-96)/step);
    if(i<0) i=0; if(i>=pts.length) i=pts.length-1;
    hover.textContent=when(pts[i].d)+" · "+money(pts[i].v);
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
    var release=host.getAttribute("data-release")||"";
    var box=host.parentElement;
    var span=all.length<2?0:Math.round((Date.parse(all[all.length-1].d+"T00:00:00Z")-Date.parse(all[0].d+"T00:00:00Z"))/86400000)+1;
    var allow=["All"];
    if(span>=7) allow.unshift("7D");
    if(span>=30) allow.splice(allow.indexOf("All"),0,"30D");
    if(span>=90) allow.splice(allow.indexOf("All"),0,"90D");
    if(span>=365) allow.splice(allow.indexOf("All"),0,"1Y");
    function paint(range){ catchemDraw(host, catchemFilter(all, range), release, caption); }
    paint("All");
    if(!box) return;
    box.querySelectorAll("[data-range]").forEach(function(btn){
      if(allow.indexOf(btn.getAttribute("data-range"))<0) btn.hidden=true;
      btn.addEventListener("click", function(){
        box.querySelectorAll("[data-range]").forEach(function(x){ x.setAttribute("aria-pressed","false"); });
        btn.setAttribute("aria-pressed","true");
        paint(btn.getAttribute("data-range"));
      });
    });
  });
}
`;

const CSS = `
:root{--bg:#12100e;--panel:#1a1815;--line:#2f2b26;--txt:#efe9de;--dim:#c4baab;--gold:#d9b779;--green:#7fc79a;--red:#e0675b;--serif:'Fraunces',Georgia,serif;--sans:'IBM Plex Sans',system-ui,sans-serif}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--txt);font:16px/1.5 var(--sans)}
body{overflow-x:hidden;padding-bottom:72px}
a{color:var(--gold)}
.px{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 12px;margin:8px 0}
.win{font:600 16px/1.2 var(--sans)}
.win.up{color:var(--green)}
.win.down{color:var(--red)}
.means{background:#211e1a;border-radius:14px;padding:12px 14px}
.means p{margin:0 0 8px}
.means p:last-child{margin:0}
.site-bar{display:flex;flex-wrap:nowrap;align-items:center;justify-content:space-between;gap:10px 16px;padding:0 16px;height:56px;min-height:56px;max-height:56px;border-bottom:1px solid var(--line);background:var(--bg);position:sticky;top:0;z-index:5}
.site-bar .logo{font:600 26px/1 var(--serif);color:var(--txt);text-decoration:none;letter-spacing:-.03em}
.site-bar .logo span{color:var(--gold)}
.menu-btn{display:none;min-height:44px}
.site-bar nav{display:flex;flex-wrap:wrap;gap:8px 14px}
.site-bar nav a{color:var(--dim);text-decoration:none;font:500 14px/1 var(--sans);min-height:44px;display:inline-flex;align-items:center}
.site-bar nav a[aria-current="page"],.site-bar nav a:hover{color:var(--gold)}
@media (max-width:1279px){
  .menu-btn{display:inline-flex;align-items:center;justify-content:center}
  .site-bar nav{display:none;position:absolute;top:100%;left:0;right:0;background:#1a1815;border-bottom:1px solid var(--line);padding:8px 12px;flex-direction:column}
  .site-bar nav.open{display:flex}
}
.dock{position:fixed;left:0;right:0;bottom:0;display:flex;justify-content:space-around;gap:4px;padding:6px 8px calc(6px + env(safe-area-inset-bottom));background:#1a1815;border-top:1px solid var(--line);z-index:6}
.dock a{color:var(--dim);text-decoration:none;font:500 12px/1 var(--sans);min-height:44px;min-width:44px;display:flex;align-items:center;justify-content:center;padding:0 6px}
.dock a[aria-current="page"]{color:var(--gold)}
.chart,.chart svg,.chart-box{display:block;width:100%;min-height:180px}
.chart{height:180px;min-height:180px;flex:none;overflow:hidden}
.chart-readout{min-height:1.4em;margin:0 0 6px;font-size:14px;line-height:1.4}
.wrap{max-width:1040px;margin:0 auto;padding:22px 16px 32px;overflow-x:hidden}
h1{font:500 34px/1.15 var(--serif);letter-spacing:-.02em;margin:0 0 8px}
h2{font:500 22px/1.2 var(--serif);margin:22px 0 8px}
.muted{color:var(--dim)}
.chart-note{font-size:15px;line-height:1.45;margin:8px 0 0}
.counts{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.counts b{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 12px;min-width:44px}
.counts b span{display:block;font:400 12px/1.3 var(--sans);color:var(--dim)}
.card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px;min-width:0}
.ph{width:100%;aspect-ratio:1;border-radius:12px;background:#211e1a;display:grid;place-items:center;color:var(--dim);font-size:13px}
.row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line);min-height:44px;align-items:center;min-width:0;max-width:100%}
.row a{color:var(--txt);text-decoration:none;min-width:0;flex:1;overflow-wrap:anywhere}
.row b{overflow-wrap:anywhere}
.row > b{flex:none;white-space:nowrap}
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
.filters{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.filters input,.filters select{background:var(--bg);color:var(--txt);border:1px solid var(--line);border-radius:10px;min-height:44px;padding:0 10px;font:15px var(--sans)}
button{min-height:44px;padding:0 14px;border-radius:10px;border:1px solid var(--line);background:var(--panel);color:var(--txt);font:600 14px var(--sans);cursor:pointer}
button.primary{background:var(--gold);color:#1a1407;border-color:transparent}
.site-foot{max-width:1040px;margin:0 auto;padding:8px 16px 24px;color:var(--dim);font-size:14px}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{scroll-behavior:auto!important;transition:none!important}}
@media (max-width:1279px){
  .menu-btn{display:inline-flex;align-items:center;justify-content:center}
  .site-bar nav{display:none;position:absolute;top:56px;left:0;right:0;background:#1a1815;border-bottom:1px solid var(--line);padding:8px 12px;flex-direction:column}
  .site-bar nav.open{display:flex}
}
@media (min-width:1024px){.dock{display:none}body{padding-bottom:24px}}
@media (min-width:1280px){.site-bar nav{display:flex}}
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
  const alt = String(share.imageAlt || "Catch'em. A home for collectors, rippers and flippers.").trim();
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

function chrome(active, body, title, stamp, extraFoot = "", feed = false, share = null) {
  const item = (href, label) => `<a href="${href}"${active === label ? ' aria-current="page"' : ""}>${label}</a>`;
  const feedLink = feed ? item("/feed", "Feed") : "";
  const fresh = stamp ? `<div class="wrap" style="padding-bottom:0"><p class="muted" id="fresh" style="margin:0">${esc(stamp)}</p></div>` : "";
  const foot = extraFoot ? `<p id="post-office-build">${esc(extraFoot)}</p>` : "";
  const shareTags = shareMetaTags(title, share);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Catch'em</title>
${shareTags}
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>${CSS}</style><script>${CHART_JS}</script></head><body>
<header class="site-bar"><a class="logo" href="/">Catch'em<span>.</span></a><button class="menu-btn" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button><nav id="site-nav">
${feedLink}${item("/sets", "Sets")}${item("/artists", "Artists")}${item("/search", "Search")}${item("/post-office", "Post Office")}${item(DISCORD, "Discord Premium")}
</nav></header>
${fresh}
${body}
<nav class="dock" aria-label="Primary">
${feedLink}${item("/sets", "Sets")}${item("/artists", "Artists")}${item("/search", "Search")}${item("/post-office", "Post Office")}${item(DISCORD, "Discord Premium")}
</nav>
<footer class="site-foot"><p>Not affiliated with Nintendo, The Pokémon Company, or Creatures.</p><p>Made for collectors, rippers and flippers. Card names are © Pokémon / Nintendo / Creatures / GAME FREAK. Catch'em is a fan project and is not endorsed by them or by TCGplayer. Prices labeled TCGplayer market come from the public TCGCSV feed.</p><p><a href="/methodology">How the numbers are made</a> · <a href="mailto:support@catchemtcg.com">support@catchemtcg.com</a></p>${foot}</footer>
<script>var menuBtn=document.querySelector(".menu-btn");var siteNav=document.getElementById("site-nav");if(menuBtn&&siteNav)menuBtn.addEventListener("click",function(){var open=siteNav.classList.toggle("open");menuBtn.setAttribute("aria-expanded",open?"true":"false")});if(window.catchemMount) catchemMount(document); else if(typeof catchemMount==="function") catchemMount(document);</script>
</body></html>`;
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

export function renderSets(index, stamp, opts = {}) {
  const sets = index?.sets || [];
  const eras = [...new Set(sets.map((s) => s.era))].sort((a, b) => {
    const order = ["Mega Evolution", "Scarlet & Violet", "Sword & Shield", "Sun & Moon", "XY", "Black & White", "HeartGold & SoulSilver", "Diamond & Pearl", "EX", "Original", "Neo", "Promos and extras", "Other"];
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || String(a).localeCompare(String(b));
  });
  const body = `<main class="wrap"><h1>Sets</h1><p class="muted">${sets.length} groups. Newest names sit with their era. Singles and sealed stay apart.</p>
${index?.sealedNote ? `<p class="muted">${esc(index.sealedNote)}</p>` : ""}
${index?.soldNote ? `<p class="muted">${esc(index.soldNote)}</p>` : ""}
${chartBox(index?.singlesIndex || [], "Singles index, chain-linked")}
${eras.map((era) => `<h2>${esc(era)}</h2><div class="grid">${sets.filter((s) => s.era === era).sort((a, b) => String(b.release || "").localeCompare(String(a.release || ""))).map((s) => `<a class="card" href="/sets/${esc(s.slug)}"><b>${esc(s.name)}</b><p class="muted">${s.single} singles · ${s.sealed} sealed${s.priced ? ` · ${s.priced} priced` : ""}${s.release ? ` · ${esc(s.release)}` : ""}</p></a>`).join("")}</div>`).join("")}
</main>`;
  return chrome("Sets", body, "Sets", stamp, "", feedNav(opts));
}

export function renderSetShell(slug, stamp, opts = {}) {
  const body = `<main class="wrap"><h1 id="title">Set</h1>
<div id="lines"></div><div id="charts"></div>
<div class="filters"><select id="kind" aria-label="Kind"><option value="">Singles and sealed</option><option value="single">Singles</option><option value="sealed">Sealed</option></select>
<input id="q" aria-label="Filter by name, rarity, or artist" placeholder="Name, rarity, artist">
<select id="sort" aria-label="Sort"><option value="price">Price</option><option value="name">Name</option><option value="num">Number</option></select>
</div><div id="list"></div><button id="more" type="button">Show more</button></main>
<script type="application/json" id="meta">${JSON.stringify({ slug }).replace(/</g, "\\u003c")}</script>
<script>
const slug=JSON.parse(document.getElementById("meta").textContent).slug;
const money=n=>!(n>0)?"No market price":"$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
function html(s){
  return String(s==null?"":s).replace(/[&<>"']/g,function(c){
    if(c==="&") return "&"+"amp;";
    if(c==="<") return "&"+"lt;";
    if(c===">") return "&"+"gt;";
    if(c==='"') return "&"+"quot;";
    return "&"+"#39;";
  });
}
let rows=[], shown=48;
function draw(){
  const kind=document.getElementById("kind").value;
  const q=document.getElementById("q").value.trim().toLowerCase();
  const sort=document.getElementById("sort").value;
  let list=rows.filter(r=>!kind||r.kind===kind);
  if(q) list=list.filter(r=>(r.name+" "+(r.rarity||"")+" "+(r.artist||"")+" "+(r.num||"")).toLowerCase().includes(q));
  list.sort((a,b)=>sort==="name"?a.name.localeCompare(b.name):sort==="num"?String(a.num).localeCompare(String(b.num)):((b.price||0)-(a.price||0)));
  const view=list.slice(0, shown);
  document.getElementById("list").innerHTML=view.map(r=>{
    const href=r.kind==="sealed"?"/p/"+encodeURIComponent(r.id):"/c/"+encodeURIComponent(r.id);
    const src=pictureSrc(r, data.logo);
    const crop=cropStyle(r&&r.crop);
    const img=src?'<img alt="" width="64" height="64" style="width:64px;height:64px;'+(crop?crop:"object-fit:contain")+';border-radius:8px;background:#211e1a" src="'+String(src).replace(/"/g,"")+'">':'<span class="muted">The picture is missing.</span>';
    return '<div class="row">'+img+'<a href="'+href+'"><b>'+html(r.name)+'</b><br><span class="muted">'+html(r.num||"")+' '+html(r.rarity||"")+(r.artist?" · "+html(r.artist):"")+'</span></a><b>'+money(r.price)+'</b></div>';
  }).join("") || '<p class="muted">Nothing matches.</p>';
  document.getElementById("more").hidden=shown>=list.length;
}
function pictureSrc(row, logo){
  if(!row || typeof row!=="object") return "";
  if(row.icon) return "";
  const image=typeof row.image==="string"?row.image.trim():"";
  const scan=typeof row.scan==="string"?row.scan.trim():"";
  const src=image||scan;
  if(!src) return "";
  if(logo && src===String(logo)) return "";
  return src;
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
fetch("/data/sets/"+encodeURIComponent(slug)+".json").then(r=>{if(!r.ok) throw 0; return r.json()}).then(data=>{
  document.getElementById("title").textContent=data.name;
  const moneyLine=n=>!(n>0)?"":"$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
  const link=(row,kind)=>row?'<p><b>'+(kind==="sealed"?"Sealed line":"Chase line")+'</b> <a href="'+(kind==="sealed"?"/p/":"/c/")+encodeURIComponent(row.id)+'">'+html(row.name)+'</a> '+moneyLine(row.price)+'</p>':"";
  document.getElementById("lines").innerHTML=(data.logo?'<img alt="" width="120" height="48" src="'+String(data.logo).replace(/"/g,"")+'" style="height:48px;width:auto;background:#211e1a;border-radius:8px">':"")+link(data.sealedLine,"sealed")+link(data.chaseLine,"single");
  document.getElementById("charts").innerHTML='<div class="chart-box"><p class="muted">Singles index</p><div class="chart" id="single-chart" data-caption="Singles index, chain-linked. TCGplayer market, daily" style="height:180px;min-height:180px"></div><div class="filters" data-ranges><button type="button" data-range="7D">7D</button><button type="button" data-range="30D">30D</button><button type="button" data-range="90D">90D</button><button type="button" data-range="1Y">1Y</button><button type="button" data-range="All" aria-pressed="true">All</button></div><p class="muted chart-note"></p></div><div class="chart-box"><p class="muted">Sealed index</p><div class="chart" id="sealed-chart" data-caption="Sealed index, chain-linked. TCGplayer market, daily" style="height:180px;min-height:180px"></div><div class="filters" data-ranges><button type="button" data-range="7D">7D</button><button type="button" data-range="30D">30D</button><button type="button" data-range="90D">90D</button><button type="button" data-range="1Y">1Y</button><button type="button" data-range="All" aria-pressed="true">All</button></div><p class="muted chart-note"></p></div>';
  document.getElementById("single-chart").setAttribute("data-chart", JSON.stringify(data.singleIndex||[]));
  document.getElementById("sealed-chart").setAttribute("data-chart", JSON.stringify(data.sealedIndex||[]));
  document.getElementById("single-chart").setAttribute("data-release", data.release||"");
  document.getElementById("sealed-chart").setAttribute("data-release", data.release||"");
  if(typeof catchemMount==="function") catchemMount(document.getElementById("charts"));
  rows=(data.items||[]).filter(r=>r&&r.name);
  draw();
}).catch(()=>{document.getElementById("title").textContent="This set did not load."});
["kind","q","sort"].forEach(id=>document.getElementById(id).addEventListener("input",()=>{shown=48;draw()}));
document.getElementById("more").addEventListener("click",()=>{shown+=48;draw()});
</script>`;
  return chrome("Sets", body, "Set", stamp, "", feedNav(opts));
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

export function renderCard(card, stamp, opts = {}) {
  if (!card) return chrome("", `<main class="wrap"><h1>Not in the catalog</h1><p class="muted">That id is not in the TCGplayer catalog we publish.</p></main>`, "Not found", stamp, "", feedNav(opts));
  const fact = opts.fact || null;
  const shown = fact?.price > 0 ? fact.price : card.price;
  const price = money(shown);
  const asOf = fact?.asOf || card.asOf;
  const hist = histWithFact(card.hist || [], fact);
  const computed = seriesFacts(hist, asOf);
  const chips = [
    winChip("7D", fact?.change7 ?? computed?.change7),
    winChip("30D", fact?.change30 ?? computed?.change30),
    winChip("90D", fact?.change90 ?? computed?.change90),
  ].join("");
  const high = fact?.high ?? computed?.high;
  const highOn = fact?.highOn || computed?.highOn || "";
  const low = fact?.low ?? computed?.low;
  const lowOn = fact?.lowOn || computed?.lowOn || "";
  const since = fact?.daysSinceHigh ?? computed?.daysSinceHigh;
  const breakBits = [];
  if (high && highOn && low && lowOn) breakBits.push(`<p>▲ high ${money(high)} on ${esc(highOn)}. ▼ low ${money(low)} on ${esc(lowOn)}.</p>`);
  if (Number.isFinite(Number(since))) breakBits.push(`<p>${Number(since)} days since the high.</p>`);
  const listings = Number(fact?.listings);
  if (listings >= 20 && fact?.listingsAsOf) breakBits.push(`<p>Active listings: ${listings} (as of ${esc(fact.listingsAsOf)}).</p>`);
  const flagged = flagHtml(fact?.flagged);
  if (flagged) breakBits.push(`<p>${flagged}</p>`);
  const checked = checkedLabel(asOf);
  const hrefKind = card.kind === "sealed" ? "Sealed" : "Single";
  const img = card.pid
    ? `<img alt="${esc(card.name)}" width="320" height="320" src="https://tcgplayer-cdn.tcgplayer.com/product/${Number(card.pid)}_in_400x400.jpg" style="width:min(320px,100%);height:auto;border-radius:16px;background:#211e1a" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ph',textContent:'No stock image'}))">`
    : (card.scan && String(card.scan).startsWith("https://images.pokemontcg.io/")
      ? `<img alt="${esc(card.name)}" width="320" height="446" src="${esc(card.scan)}" style="width:min(280px,100%);height:auto;border-radius:16px;background:#211e1a" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ph',textContent:'No stock image'}))">`
      : `<div class="ph">No stock image</div>`);
  const also = (card.also || []).map((row) => `<a href="${card.kind === "sealed" ? "/p/" : "/c/"}${esc(row.id)}">${esc(row.name)}</a>`).join(" · ");
  const body = `<main class="wrap">
<p class="muted"><a href="/sets/${esc(card.setSlug || "")}">${esc(card.set || "")}</a> · ${esc(hrefKind)}</p>
<h1>${esc(card.name)}</h1>
<p class="px"><span style="font:600 40px/1 var(--serif);color:var(--gold)">${price || "No market price"}</span>${chips}</p>
<p class="muted">${esc(card.source || "TCGplayer market")}${asOf ? `, ${esc(String(asOf).slice(0, 10))}` : ""}${checked ? `. ${esc(checked)}` : ""}</p>
${breakBits.length ? `<div class="means">${breakBits.join("")}</div>` : ""}
<p>Artist ${card.artist ? `<a href="/artists/${esc(String(card.artist).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))}">${esc(card.artist)}</a>` : "not matched"} · Number ${esc(card.num || "—")} · Rarity ${esc(card.rarity || "—")}</p>
<p class="muted">${card.sold && Number(card.sold.n) > 0 ? `TCGplayer recent sales (${esc(card.sold.n)}, ${esc(card.sold.dates || "")})` : "No sold data yet"}</p>
${(card.versions || []).length ? `<p class="muted">Prize pack versions, kept with this card and left out of search.</p><ul>${card.versions.map((v) => `<li>${esc(v.name)} ${money(v.price) || "No market price"}</li>`).join("")}</ul>` : ""}
${opts.video ? `<p><a href="/video/studio.html?ids=${esc(card.id)}">Make a Short</a></p>` : ""}
${img}
${chartBox(hist, "TCGplayer market, daily", card.release || "")}
${opts.diveHref ? `<p><a class="open-data" href="${esc(opts.diveHref)}">Deeper look</a> · <a href="${esc(opts.diveHref)}">See the chart</a> (eBay ask series)</p>` : ""}
<details><summary>See the math</summary>
<p>Number ${esc(card.num || "—")} · Rarity ${esc(card.rarity || "—")} · Artist ${card.artist ? `<a href="/artists/${esc(String(card.artist).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))}">${esc(card.artist)}</a>` : "not matched"}</p>
<p>${card.rank ? `Rank ${card.rank} of ${card.of} priced singles in this set.` : "No rank, because this row has no market price or it is sealed."}</p>
<p>${also ? `Also in this set: ${also}` : "No related rows stored."}</p>
<p>Condition prices are not in this feed. The market price is one number for the printing we publish.</p>
<p>Recent sold prices: ${card.sold && Number(card.sold.n) > 0 ? `TCGplayer recent sales (${esc(card.sold.n)}, ${esc(card.sold.dates || "")}).` : "No sold data yet."}</p>
<p><button type="button" id="paid">I paid or sold at a price</button></p>
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
</main>`;
  return chrome("", body, card.name, stamp, "", feedNav(opts));
}

export function renderArtists(index, stamp, opts = {}) {
  const rows = index?.artists || [];
  const body = `<main class="wrap"><p class="muted">${esc(index?.note || "")}</p><h1>Artists</h1>
<div class="filters"><input id="q" aria-label="Find an artist" placeholder="Find an artist"></div>
<div id="list" class="grid">${rows.map((a) => `<a class="card" data-name="${esc(a.name.toLowerCase())}" href="/artists/${esc(a.slug)}"><b>${esc(a.name)}</b><p class="muted">${a.count} matched cards</p></a>`).join("")}</div>
<script>document.getElementById("q").addEventListener("input",ev=>{const q=ev.currentTarget.value.toLowerCase();document.querySelectorAll("#list a").forEach(a=>{a.hidden=!a.dataset.name.includes(q)})})</script>
</main>`;
  return chrome("Artists", body, "Artists", stamp, "", feedNav(opts));
}

export function renderArtist(doc, stamp, opts = {}) {
  if (!doc) return chrome("Artists", `<main class="wrap"><h1>Artist not found</h1></main>`, "Artist", stamp, "", feedNav(opts));
  const top = (doc.cards || []).slice(0, 12);
  const rest = (doc.cards || []).slice(12);
  const row = (c) => `<div class="row">${c.pid ? `<img alt="" width="48" height="48" src="https://tcgplayer-cdn.tcgplayer.com/product/${Number(c.pid)}_in_200x200.jpg" style="width:48px;height:48px;object-fit:contain;border-radius:8px;background:#211e1a" onerror="this.remove()">` : ""}<a href="/c/${esc(c.id)}"><b>${esc(c.name)}</b><br><span class="muted">${esc(c.set)} ${esc(c.num || "")}</span></a><b>${money(c.price) || "No market price"}</b></div>`;
  const body = `<main class="wrap"><h1>${esc(doc.name)}</h1>
${chartBox(doc.index || [], "Artist index, chain-linked")}
<p class="muted">${esc(doc.source || "")}</p>
${top.map(row).join("")}
${rest.length ? `<details><summary>Show all ${doc.cards.length}</summary>${rest.map(row).join("")}</details>` : ""}
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
    const img = r.image ? `<img alt="" width="48" height="48" src="${esc(r.image)}" onerror="this.remove()">` : "";
    const line = withSpark ? spark(r.hist) : "";
    return `<div class="row mover">${img}<a href="${esc(r.href)}"><b>${esc(r.name)}</b><span class="muted">${esc(r.set || "")}</span>${line}</a><b class="mover-stat">${money(r.price) || "—"} <span class="muted">${pct}</span></b></div>`;
  };
  const block = (title, rows) => `<h2>${title}</h2>${(rows || []).slice(0, 12).map((r) => row(r, true)).join("") || `<p class="muted">Nothing to show.</p>`}${(rows || []).length > 12 ? `<details><summary>Show more</summary>${(rows || []).slice(12).map((r) => row(r, false)).join("")}</details>` : ""}`;
  const body = `<main class="wrap"><p class="muted">Updated ${esc(doc?.asOf || "")}. ${esc(doc?.note || "")}</p>
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

export function renderReceipts(doc, stamp, opts = {}) {
  const rows = doc?.rows || [];
const mark = (r) => {
    const v = String(r.result || "open").toLowerCase();
    return v === "hit" ? "Hit" : v === "miss" ? "Miss" : "Open";
  };
  const body = `<main class="wrap"><p class="muted" id="fresh">Updated ${esc(doc?.asOf || "")}</p><h1>Receipts</h1>
<p>${esc(doc?.note || "")}</p>
<p class="muted">Scored calls: ${Number(doc?.scored) || 0}. Hit rate: ${doc?.hitRate == null ? "not shown until 20 calls are scored" : esc(String(doc.hitRate))}</p>
${chartBox(doc?.series || [], "TCGplayer market")}
${rows.map((r) => `<article class="card" style="margin:10px 0"><p class="muted">${mark(r)}</p><h2>${esc(r.headline)}</h2><p>${money(r.price) || "No price"} · ${esc(r.source || "")}</p>${chartBox(r.hist || [], r.source || "TCGplayer market")}<p class="muted">${esc(r.why || "")}</p></article>`).join("") || `<p class="muted">No scored calls yet.</p>`}
</main>`;
  return chrome("", body, "Receipts", stamp, "", feedNav(opts));
}

export function renderSearch(opts = {}) {
  const body = `<main class="wrap"><h1>Search</h1><p class="muted">Nicknames, numbers, artists, and set shorthand. 151 ETB means the Elite Trainer Box, not a warehouse bundle.</p>
<div class="filters"><input id="q" aria-label="Search the catalog" placeholder="Moonbreon, 215/203, or Keiichiro Ito" autofocus></div>
<p class="muted" id="meta">Loading the index.</p><div id="list"></div>
<script type="module">
import * as search from "/data/search-rank.mjs";
const rankCatalog=search.rankCatalog;
const searchCatalog=search.searchCatalog;
function html(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){if(c==="&")return "&"+"amp;";if(c==="<")return "&"+"lt;";if(c===">")return "&"+"gt;";if(c==='"')return "&"+"quot;";return "&"+"#39;"})}
let rows=[];
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
function take(list){
  return (list||[]).slice(0,40).sort(byValue);
}
function rowHtml(r){
  const href=(r[5]==="sealed"?"/p/":"/c/")+encodeURIComponent(r[0]);
  return '<div class="row"><a href="'+href+'"><b>'+html(r[1])+'</b><br><span class="muted">'+html(r[5])+' · '+html(r[2]||"")+' '+html(r[3]||"")+' '+html(r[4]||"")+'</span></a></div>';
}
function draw(){
  const q=document.getElementById("q").value.trim();
  if(q.length<2){document.getElementById("list").innerHTML="";document.getElementById("meta").textContent=rows.length+" names loaded. Type at least 2 letters.";return}
  const found=typeof searchCatalog==="function"?searchCatalog(q, rows, 40):{hits:rankCatalog(q, rows, 40),nearest:[]};
  const shown=take(found.hits);
  const near=take(found.nearest);
  if(!shown.length){
    document.getElementById("meta").textContent="Not in the TCGplayer catalog.";
    document.getElementById("list").innerHTML=(near.length?'<p class="muted">Nearest names</p>':"")+near.map(rowHtml).join("")||'<p class="muted">No nearby name.</p>';
    return;
  }
  document.getElementById("meta").textContent=shown.length+" shown";
  document.getElementById("list").innerHTML=shown.map(rowHtml).join("");
}
fetch("/data/search-lite.json").then(r=>r.json()).then(data=>{rows=data;document.getElementById("meta").textContent=rows.length+" names loaded.";draw()}).catch(()=>{document.getElementById("meta").textContent="Search did not load."});
document.getElementById("q").addEventListener("input",draw);
</script></main>`;
  return chrome("Search", body, "Search", "", "", feedNav(opts));
}

export function renderMethod(counts, stamp, opts = {}) {
  const single = Number(counts?.single);
  const sealed = Number(counts?.sealed);
  const catalog = Number.isFinite(single) && Number.isFinite(sealed)
    ? `The public catalog is ${single.toLocaleString("en-US")} singles and ${sealed.toLocaleString("en-US")} sealed products. Slabs are not in it.`
    : "Singles and sealed are counted apart. Slabs are not in the catalog.";
  const body = `<main class="wrap"><h1>How the numbers are made</h1>
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

export function renderAccuracy(doc, stamp, opts = {}) {
  const body = `<main class="wrap"><h1>Accuracy</h1>
<p>${esc(doc?.note || "A hit rate is shown after 20 calls had a direction written down first.")}</p>
<p class="muted">Scored ${Number(doc?.scored) || 0}. Hits ${Number(doc?.hits) || 0}. Misses ${Number(doc?.misses) || 0}. Crowd votes are not in this score until the server store is on.</p>
<p>Baseline: a read that says the price stays the same. We do not print a rate from a handful of calls.</p>
${(doc?.rows || []).map((r) => `<article class="card" style="margin:10px 0"><h2>${esc(r.name)}</h2><p>${esc(r.result || "open")} · ${esc(r.date || "")}</p></article>`).join("")}
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
  const body = `<main class="wrap"><h1>${esc(title)}</h1><p>${esc(line)}</p><p><a href="/sets">Sets</a> · <a href="/methodology">How the numbers are made</a> · <a href="https://discord.gg/fUSjxDX4Hy">Discord</a></p></main>`;
  return chrome("", body, title, "", "", feedNav(opts));
}

export function renderOfficeGate(opts = {}) {
  const invite = INVITE_LINE.replace("Join Discord", `<a href="${esc(DISCORD)}">Join Discord</a>`);
  const sign = opts.ready && !opts.signedIn
    ? `<p><a href="/auth/discord?next=/post-office">Sign in with Discord</a></p>`
    : "";
  const body = `<main class="wrap"><h1>Post Office</h1><p>${invite}</p>${sign}</main>`;
  return chrome("Post Office", body, "Post Office", "", "", feedNav(opts));
}

export function renderPost(stamp, mark = "", opts = {}) {
  void stamp;
  const line = typeof mark === "string" ? mark : "";
  const rev = encodeURIComponent(String(opts.editorRev || BUILD_SHA || "dev").slice(0, 12) || "dev");
  const body = `<iframe title="Post Office editor" src="/post-office/app?v=${rev}" style="display:block;width:100%;border:0;background:#12100e"></iframe>
<style>
body:has(iframe[title="Post Office editor"]){overflow:hidden;height:100dvh;padding-bottom:0}
body:has(iframe[title="Post Office editor"]) .site-foot{display:none}
iframe[title="Post Office editor"]{height:calc(100dvh - 128px)}
</style>`;
  return chrome("Post Office", body, "Post Office", "", line, feedNav(opts));
}

const RATE_LOCK = "The rate you check out at stays yours while you stay subscribed or on a valid pause. Cancel and the number is retired. If you come back, you pay the public rate then on the site.";
const PAUSE_STAY = "Pause up to 2 months in any 12, your number and rate stay.";

export function renderPremium(stamp, opts = {}) {
  void stamp;
  const ico = (paths) => `<span class="prem-ico" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths}</svg></span>`;
  const card = (paths, title, copy) => `<article class="prem-card">${ico(paths)}<h3>${title}</h3><p>${copy}</p></article>`;
  const body = `<main class="wrap prem">
<style>
.prem-hero{padding:18px 0 6px}
.prem-kicker{margin:0 0 14px;letter-spacing:.14em;text-transform:uppercase;font:600 12px/1 var(--sans);color:var(--gold)}
.prem-hero h1{font:500 clamp(34px,7vw,58px)/1.02 var(--serif);letter-spacing:-.03em;margin:0 0 14px;max-width:11em}
.prem-lede{font-size:18px;line-height:1.4;margin:0 0 16px;max-width:28em}
.prem-price{margin:0 0 16px;font:600 22px/1.2 var(--serif);color:var(--gold)}
.prem-join{display:flex;width:100%;align-items:center;justify-content:center;min-height:48px;padding:0 22px;border-radius:12px;background:var(--gold);color:#1a1407;text-decoration:none;font:600 16px/1 var(--sans)}
.prem-join:hover{color:#1a1407}
.prem-fine{margin:12px 0 0;color:var(--dim);font-size:14px;max-width:36em}
.prem-grid{display:grid;gap:12px;grid-template-columns:1fr}
.prem-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px}
.prem-card h3{margin:10px 0 6px;font:600 16px/1.3 var(--sans)}
.prem-card p{margin:0;color:var(--dim);font-size:15px;line-height:1.45}
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
.prem-acts{display:flex;flex-wrap:nowrap;gap:8px;margin:8px 0 0}
.prem-acts a{flex:1 1 0;min-width:0;text-align:center;text-decoration:none;color:var(--txt);background:var(--panel);border:1px solid var(--line);border-radius:10px;min-height:44px;display:flex;align-items:center;justify-content:center;font:600 14px var(--sans)}
@media(min-width:840px){
  .prem-grid{grid-template-columns:repeat(6,1fr)}
  .prem-card{grid-column:span 2}
  .prem-card:nth-child(4),.prem-card:nth-child(5){grid-column:span 3}
  .prem-faq{grid-template-columns:1fr 1fr;column-gap:28px}
  .prem-join{display:inline-flex;width:auto;min-width:220px}
}
</style>
<section class="prem-hero">
<p class="prem-kicker">Discord Premium</p>
<h1>Join the club.<br>Claim your First 222 number.</h1>
<p class="prem-lede">Hang out with serious collectors, rippers and flippers.</p>
<p class="prem-price">$14.99 a month. Cancel anytime.</p>
<a class="prem-join" href="${DISCORD}">Join Premium</a>
<p class="prem-fine">One number per person. Never reused. Card payments only. Checkout starts in Discord.</p>
</section>
<h2>What you're joining</h2>
<div class="prem-grid">
${card('<path d="M10 4.5v15M14 4.5v15M5.5 9h13M5.5 15h13"/>', "Your First 222 number + Premium role", "Premium members get a number and the Premium role. One person, one number. Never reused.")}
${card('<path d="M4 16V7.5A1.5 1.5 0 0 1 5.5 6h8A1.5 1.5 0 0 1 15 7.5V12H7.2L4 14.6z"/><path d="M9 11.5h8.5A1.5 1.5 0 0 1 19 13V18l-2.4-2H10.5A1.5 1.5 0 0 1 9 14.5z"/>', "Private member channels", "The rooms that open with the seat.")}
${card('<path d="M12 3l1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3z"/>', "Early beta access", "Try new Feed features, bots and tools before anyone else, and help shape them. Beta channel, feedback votes, a first look at new reads, alerts, and Post Office tools.")}
${card('<path d="M5 19V11M12 19V5M19 19v-6"/>', "Bigger tool limits", "50 AI Ideas a day, not 3. Post text is 100 a day, not 3. Video export is 5 a day and 35 a week, not 1 a day and 2 a week.")}
</div>
<h2>Your price stays locked</h2>
<div class="prem-lock">
<p>${RATE_LOCK}</p>
<p>${PAUSE_STAY}</p>
</div>
<h2>Members also get</h2>
<div class="prem-also">
<p>Watching the Stadium for free is fine.</p>
</div>
<h2>Questions</h2>
<div class="prem-faq">
<div class="prem-q"><b>What's free?</b><p>All tools on the site stay free.</p></div>
<div class="prem-q"><b>Can I pause?</b><p>${PAUSE_STAY}</p></div>
<div class="prem-q"><b>What happens if I cancel?</b><p>Cancel and the number is retired. If you come back, you pay the public rate then on the site.</p></div>
<div class="prem-q"><b>How do I manage it?</b><p>Use /premium in Discord.</p></div>
</div>
<p class="prem-manage">Already in?</p>
<div class="prem-acts"><a href="${DISCORD}">Pause</a><a href="${DISCORD}">Cancel</a></div>
</main>`;
  return chrome("", body, "Discord Premium", "", "", feedNav(opts));
}

export function renderDive(doc, stamp, opts = {}) {
  if (!doc || !doc.id) {
    return chrome("", `<main class="wrap"><h1>Deep dive not found</h1><p class="muted">No payload for that product yet.</p><p><a href="/feed">Back to the feed</a></p></main>`, "Not found", stamp, "", feedNav(opts), {
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
    ? `Price flagged: ${Math.abs(Number(outlier.pctGap))}% ${Number(outlier.pctGap) < 0 || outlier.direction === "low" ? "below" : "above"} recent median — review`
    : null));
  const outlierLine = outlier
    ? `<p style="border:1px solid var(--gold);border-radius:10px;padding:12px 14px;margin:12px 0"><b>${esc(outlierNote || `Outlier: ${String(outlier.flag)}`)}</b>${outlier.asOf ? ` <span class="muted">(${esc(outlier.asOf)})</span>` : ""}${outlier.provisionalLabel ? `<br><span class="muted">${esc(String(outlier.provisionalLabel))}</span>` : ""}</p>`
    : `<p class="muted">Outlier flags: none yet.</p>`;
  const change = doc.listingChange || null;
  const changeLine = change && change.label === "net change in active eBay listings (estimate)" && Number.isInteger(change.net) && Number.isInteger(change.days) && change.days >= 2
    ? `<p>${esc(change.label)}: <b>${change.net > 0 ? "+" : ""}${esc(String(change.net))}</b> over ${esc(String(change.days))} days of eBay Browse totals (${esc(change.from || "")} to ${esc(change.to || "")})</p>`
    : "";
  const buyoutLine = browse
    ? `<p>Browse total (eBay): <b>${esc(browse)}</b>${buyout.browseTotalBefore != null ? ` · prior ${esc(String(buyout.browseTotalBefore))}` : ""} · level ${esc(String(buyout.level || "unscored"))}</p>`
    : `<p class="muted">Browse total: not on file for this product.</p>`;
  const body = `<main class="wrap">
<p class="muted"><a href="/feed">Feed</a> · <a href="/board">Board</a> · Deep dive</p>
<h1>${esc(doc.name || doc.id)}</h1>
<p class="muted">${esc(latest.set || "")} · ${esc(latest.subtype || "")} · as of ${esc(doc.asOf || "")}</p>
<p class="price" style="font:600 28px/1 var(--serif);color:var(--gold)">${price || "—"}</p>
<p class="muted">eBay Browse ask median · ${esc(listings)} active listings (asks, not solds)</p>
${buyoutLine}
${changeLine}
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
  const diveTitle = `${doc.name || doc.id} — Deep dive`;
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

export function renderFeed(bundle, startId, stamp, opts = {}) {
  const seen = new Set();
  const reads = (bundle?.reads || []).filter((r) => {
    if (!keepFeedRead(r)) return false;
    const key = String(r.href || r.id || r.headline);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((r) => ({
    ...r,
    headline: soldSafeText(r, r.headline),
    ...(r.path ? { path: soldSafeText(r, r.path) } : {}),
    ...(r.why ? { why: soldSafeText(r, r.why) } : {}),
  }));
  const lead = JSON.stringify(reads).replace(/</g, "\\u003c");
  const newsLead = JSON.stringify(newsSlice(feedNews)).replace(/</g, "\\u003c");
  const diveLead = JSON.stringify(opts.diveMap || { ids: [], byTcgcsv: {} }).replace(/</g, "\u003c");
  const css = `
  .feed-page{padding-top:8px}
  .feed-filters{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0;align-items:flex-start}
  .feed-filters select,.feed-filters input{min-height:44px;max-width:100%}
  .pill-menu{position:relative;max-width:100%}
  .pill-native{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
  .pill-menu-btn{appearance:none;background:var(--gold);color:#1a1407;border:1px solid transparent;border-radius:10px;min-height:48px;padding:0 22px;font:600 16px/1 var(--sans);max-width:100%;cursor:pointer}
  .pill-menu-list{position:absolute;z-index:20;left:0;top:calc(100% + 6px);margin:0;padding:6px;list-style:none;background:#12100e;color:var(--gold);border:1px solid var(--gold);border-radius:10px;display:flex;flex-direction:column;gap:4px;width:max-content;min-width:100%;max-width:calc(100vw - 40px);max-height:min(70vh,420px);overflow:auto}
  .pill-menu-list[hidden]{display:none}
  .pill-menu-list button{appearance:none;background:transparent;color:var(--gold);border:0;border-radius:10px;min-height:48px;padding:0 16px;text-align:left;font:600 16px/1.2 var(--sans);width:100%;cursor:pointer}
  .pill-menu-list button[aria-selected="true"]{background:var(--gold);color:#1a1407}
  @media (max-width:390px){
    .pill-menu,.pill-menu-btn{max-width:100%}
    .pill-menu-list{max-width:calc(100vw - 40px)}
  }
  @media (min-width:1280px){
    .pill-menu-list{max-width:320px}
  }
  .feed-sec{border-top:1px solid var(--line);padding:8px 0}
  .feed-sec summary{cursor:pointer;min-height:44px;display:flex;align-items:center;gap:8px;font:600 18px/1.3 var(--serif)}
  .feed-sec summary span{color:var(--gold);font:600 14px var(--sans)}
  .feed-card{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:12px;margin:12px 0;display:flex;flex-direction:column;gap:8px}
  .feed-card img{width:100%;max-height:220px;object-fit:contain;background:#211e1a;border-radius:12px}
  .feed-card h3{font:600 22px/1.25 var(--serif);margin:0}
  .one-line{margin:0}
  .card-meta{margin:0;color:var(--gold);font:600 14px/1.3 var(--sans)}
  .means{background:#211e1a;border-radius:14px;padding:12px 14px}
  .means b{display:block;margin:0 0 6px}
  .means p{margin:0 0 8px}
  .means p:last-child{margin:0}
  .open-data{min-height:44px;display:inline-flex;align-items:center;font-weight:600}
  .data-block{display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--line);padding-top:12px}
  .data-block h4{margin:0;font:600 16px/1.3 var(--sans)}
  .data-block p{margin:0}
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
  .read-nav button{min-height:44px;flex:1 1 0}
  .pile{overflow:hidden}
  .feed-stage{min-height:calc(100dvh - 88px);display:flex;flex-direction:column}
  .feed-stage .feed-card{flex:1 1 auto}
  .feed-stage .feed-card.fact-card{flex:0 0 auto;width:100%}
  .mon-btn{background:#12100e;color:#d9b779;border:1px solid #d9b779;border-radius:10px;min-height:48px;font:600 16px/1 "IBM Plex Sans",system-ui,sans-serif}
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
  @media (max-width:420px){.feed-card h3{font-size:20px}}
  `;
  const titles = { today: "Today", watches: "Watches", watch: "Watches", cooks: "Cooks", cook: "Cooks", movers: "Movers", tracked: "Tracked" };
  const focusTitle = titles[String(opts.section || "")] || "";
  const page = opts.page === "read" ? "read" : "feed";
  const body = `<style>${css}</style><main class="wrap feed-page">
${page === "read" ? '<p><a href="/feed" id="feed-back">Back</a></p><h1>Read</h1>' : `<h1>${focusTitle || "The Feed"}</h1>
${focusTitle ? '<p><a href="/feed" id="feed-back">Back</a></p>' : '<p><a href="/feed/mine">My tracked reads</a></p>'}`}
<p class="muted" id="feed-count">TCGplayer market.</p>
${!focusTitle && page !== "read" ? `<form class="feed-filters" id="feed-loop-form">
  <div class="pill-menu">
  <select id="f-loop" class="pill-native" aria-label="Filter"><option value="">All</option><option value="prices">Prices</option><option value="sealed">Sealed</option><option value="set">One set</option><option value="news">News</option><option value="pokemon">Pokémon facts</option><option value="wave">Wave and reprint</option><option value="flagged">Flagged</option><option value="dive">Dive</option><option value="volume">Volume</option><option value="quiet">No sales</option><option value="mix">Condition mix</option><option value="conditions">Condition prices</option><option value="soldflat">Sold, price flat</option><option value="solddown">Sold, price down</option><option value="setshare">Set share</option><option value="spread">Ask spread</option><option value="askmove">Ask moved</option><option value="mktmove">Market moved</option><option value="still">Nothing moved</option></select>
  <button type="button" class="pill-menu-btn" aria-haspopup="listbox" aria-expanded="false">All</button>
  <ul class="pill-menu-list" role="listbox" hidden></ul>
  </div>
  <div class="pill-menu" hidden>
  <select id="f-loop-set" class="pill-native" aria-label="Set"><option value="">Every set</option></select>
  <button type="button" class="pill-menu-btn" aria-haspopup="listbox" aria-expanded="false">Every set</button>
  <ul class="pill-menu-list" role="listbox" hidden></ul>
  </div>
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
<div id="feed-one"></div>
${page === "read" ? "" : '<div id="feed-sections"></div>'}
</main>
<script type="application/json" id="feed-lead">${lead}</script>
<script type="application/json" id="dive-map">${diveLead}</script>
<script type="application/json" id="feed-news">${newsLead}</script>
<script type="application/json" id="start">${JSON.stringify(startId || "")}</script>
<script>
const lead=JSON.parse(document.getElementById("feed-lead").textContent);
const newsRows=JSON.parse(document.getElementById("feed-news").textContent);
const start=JSON.parse(document.getElementById("start").textContent);
const money=n=>!(Number(n)>0)?"":"$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
${opts.video ? "const shortFor=card=>'<a href=\"/video/studio.html?ids='+encodeURIComponent(String(card.href||'').split('/').pop())+'\">Make a Short</a>';" : "const shortFor=()=>'';"}
function html(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){if(c==="&")return "&"+"amp;";if(c==="<")return "&"+"lt;";if(c===">")return "&"+"gt;";if(c==='"')return "&"+"quot;";return "&"+"#39;"})}
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
let flat=null;
let hideFacts=false;
let loopFilter="";
let look=null;
function isFact(card){
  if(!card) return false;
  if(card.readKind!=="pokemon" && card.kind!=="pokemon") return false;
  const c=card.cardCount, a=card.artistCount, d=card.dex;
  if(!Number.isInteger(c) || !Number.isInteger(a) || !Number.isInteger(d)) return false;
  if(c<1 || a<1 || d<1) return false;
  return !!(card.headline || card.path);
}
${cutoutSrc.toString()}
${tcgLink.toString()}
${pokemonFactLine.toString()}
${pricedMonCards.toString()}
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
const HOME_CAP=6;
const PAGE=24;
const cursor={};
let meta=null;
let catalogue=null;
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
  const src=String(card.source||"").trim();
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
${isShapeRow.toString()}
${cardIdentity.toString()}
function moveLine(card){
  const path=isVolumeRow(card)||isShapeRow(card)?String(card.path||"").trim():withoutSoldClaim(String(card.path||"").trim());
  if(!path) return "";
  return readUnderTitle(card.name, path);
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
function logoFor(card){
  if(card.logo) return String(card.logo);
  const sets=(meta&&meta.sets)||[];
  for(let i=0;i<sets.length;i++){
    const s=sets[i];
    if(s && (s.name===card.set || (card.setSlug && s.slug===card.setSlug)) && s.logo) return s.logo;
  }
  return "";
}
function placeholder(setName){
  const ph=document.createElement("div");
  ph.className="set-ph";
  ph.textContent=setName||"Pokémon";
  return ph;
}
function photoEl(card){
  const logo=logoFor(card);
  const setName=card.set||"Pokémon";
  const src=card.image?String(card.image):"";
  if(!src && !logo) return placeholder(setName);
  const img=document.createElement("img");
  img.alt="";
  img.src=src||logo;
  img.onerror=function(){
    if(logo && img.getAttribute("data-logo")!=="1"){
      img.setAttribute("data-logo","1");
      img.src=logo;
      return;
    }
    img.replaceWith(placeholder(setName));
  };
  return img;
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
  const line=readUnderTitle(card.name, card.path||card.headline||"");
  const ident=cardIdentity(card);
  const link=card.href?'<p><a href="'+html(card.href)+'">'+html(card.source||"Source")+"</a></p>":"";
  el.innerHTML="<h3>"+html(card.name||card.headline||"Read")+"</h3>"+(ident?'<p class="card-meta">'+html(ident)+"</p>":"")+(line?'<p class="one-line">'+html(line)+"</p>":"")+link;
  return el;
}
function mountMon(el, card){
  const btn=document.createElement("button");
  btn.type="button";
  btn.className="mon-btn";
  btn.setAttribute("aria-expanded","false");
  btn.textContent="Cards";
  const list=document.createElement("div");
  list.className="mon-list";
  list.hidden=true;
  list.onclick=function(ev){ ev.stopPropagation(); };
  btn.onclick=function(ev){
    ev.stopPropagation();
    const open=btn.getAttribute("aria-expanded")==="true";
    if(open){ btn.setAttribute("aria-expanded","false"); list.hidden=true; return; }
    btn.setAttribute("aria-expanded","true");
    list.hidden=false;
    if(list.dataset.ready==="1") return;
    list.dataset.ready="1";
    const priced=pricedMonCards(Array.isArray(lead)?lead:[], card.name);
    list.innerHTML="";
    if(!priced.length){
      const p=document.createElement("p");
      p.className="muted";
      p.textContent="No priced cards are in the file.";
      list.appendChild(p);
      return;
    }
    priced.forEach(function(row){
      const p=document.createElement("p");
      const parts=[];
      if(row.cutout) parts.push('<img class="cutout" alt="" src="'+html(row.cutout)+'">');
      else parts.push("The picture is missing.");
      parts.push(money(row.price));
      if(row.name) parts.push(html(row.name));
      if(row.set) parts.push(html(row.set));
      const cardId=row.sku||row.id||"";
      if(cardId) parts.push(html(cardId));
      let line=parts.join(" · ");
      if(row.link) line+=' <a href="'+html(row.link)+'">'+html(row.link)+"</a>";
      p.innerHTML=line;
      list.appendChild(p);
    });
  };
  el.appendChild(btn);
  el.appendChild(list);
}
function newsEl(card){
  const el=document.createElement("article");
  el.className="feed-card";
  el.id="r-"+card.id;
  const place=card.place?'<p>'+html(card.place)+"</p>":"";
  const when=card.asOf?'<p>'+html(card.asOf)+"</p>":"";
  const label=card.source||card.href||"";
  const link=card.href?'<p><a href="'+html(card.href)+'">'+html(label)+"</a></p>":"";
  el.innerHTML="<h3>"+html(card.name||"")+"</h3>"+place+when+link;
  return el;
}
function factCutLine(card){
  const who=String(card && card.name || "").trim();
  return '<p class="cut-miss">The cutout is missing. '+html(who)+"</p>";
}
function cardEl(card, facts){
  if(card && card.waveItem) return waveEl(card);
  if(card && (card.readKind==="news" || card.kind==="news")) return newsEl(card);
  const el=document.createElement("article");
  el.className="feed-card";
  el.id="r-"+card.id;
  const src=isVolumeRow(card)?card.sold.source+", Near Mint, "+card.sold.window30d.from+" to "+card.sold.window30d.to:(card.source || ("TCGplayer market"+(card.asOf?", "+card.asOf:"")));
  const supply=supplyPreset(card);
  const readHref="/feed/r/"+encodeURIComponent(card.id);
  const line=isFact(card)?pokemonFactLine(card):moveLine(card);
  const ident=cardIdentity(card);
  const headline=String(card.headline||"").trim();
  const pathText=String(card.path||"").trim();
  const sameSentence=isFact(card) && headline && headline===pathText ? headline : "";
  const shown=sameSentence||line;
  const title=html(card.name||(isVolumeRow(card)||isShapeRow(card)?card.headline:withoutSoldClaim(card.headline))||"Read");
  const h3=pageMode==="read"?"<h3>"+title+"</h3>":'<h3><a href="'+readHref+'">'+title+"</a></h3>";
  const open='<p><a class="open-data" href="'+readHref+'">Open the data</a></p>';
  const diveId=diveIdFor(card);
  const diveLink=diveId?'<p><a class="open-data" href="/dive/'+encodeURIComponent(diveId)+'">Deeper look</a> · <a href="/dive/'+encodeURIComponent(diveId)+'">See the chart</a></p>':"";
  const cut=isFact(card)?factCutLine(card):"";
  const head=h3+(ident?'<p class="card-meta">'+html(ident)+"</p>":"")+(shown?'<p class="one-line">'+html(shown)+"</p>":"")+cut+(isFact(card)?"":priceRow(card));
  if(pageMode!=="read"){
    el.innerHTML=head+open+diveLink;
    if(isFact(card)){ el.classList.add("fact-card"); mountMon(el, card); }
    else el.insertBefore(photoEl(card), el.firstChild);
    el.addEventListener("click", function(ev){
    if(el.dataset.swipe==="1"){ el.dataset.swipe=""; return; }
      const node=ev["tar"+"get"];
      if(node && node.closest("button, a, form, input, select, label")) return;
      remember();
      location.href=readHref;
    });
    const nameLink=el.querySelector("h3 a");
    if(nameLink) nameLink.addEventListener("click", remember);
    return el;
  }
  if(isFact(card)){
    el.classList.add("fact-card");
    el.innerHTML=head;
    mountMon(el, card);
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
  if(flagged) bits.push("<p>"+flagged+"</p>");
  const checked=checkedLine(card.asOf);
  if(checked) bits.push('<p class="muted">'+html(checked)+"</p>");
  bits.push('<p class="muted">'+html(src)+"</p>");
  const extra=shortFor(card);
  const supplyBox=supply?'<label><input type="checkbox" data-opt="listings" checked> Listings move 20% either way, below '+supply.low+" or above "+supply.high+"</label>":"";
  const supplyFields=supply?'<input name="listingsBelow" inputmode="numeric" aria-label="Listings below" value="'+supply.low+'"><input name="listingsAbove" inputmode="numeric" aria-label="Listings above" value="'+supply.high+'">':"";
  const voteLabel="Where's it heading?";
  const dmLine="We'll DM you on Discord.";
  el.innerHTML=head+diveLink+'<section class="data-block"><h4>The data</h4><div class="slot"></div>'+bits.join("")+(extra?"<p>"+extra+"</p>":"")+'</section><button type="button" data-act="track">Track</button><div class="vote-block"><p class="vote-q">'+voteLabel+'</p><div class="feed-acts"><button type="button" data-vote="up">Up</button><button type="button" data-vote="sideways">Sideways</button><button type="button" data-vote="down">Down</button></div><p class="vote muted"></p></div><form class="track-sheet"><p>'+dmLine+'</p><label><input type="checkbox" data-opt="price" checked> Price moves 10% either way</label>'+supplyBox+'<button type="button" data-act="custom">Customize</button><div class="custom" hidden><input name="pct" inputmode="decimal" aria-label="Percent" placeholder="Percent" value="10"><input name="price" inputmode="decimal" aria-label="Price" placeholder="Price"><select name="direction" aria-label="Which way"><option value="either">Either way</option><option value="up">Up</option><option value="down">Down</option></select>'+supplyFields+'</div><button type="submit">Save</button><p class="sheet-note muted"></p></form>';
  el.insertBefore(photoEl(card), el.firstChild);
  const slot=el.querySelector(".slot");
  if(card.hist && slot) slot.appendChild(chart(card.hist, src));
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
      changePct:card.changePct
    }, extraBody||{});
  }
  function saveAlert(body){
    fetch("/api/alerts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)})
      .then(function(res){return res.json().then(function(j){return {ok:res.ok,j:j}})})
      .then(function(res){
        if(!res.ok){ note.textContent=res.j.error||"Sign in with Discord to track this."; return; }
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
      .catch(function(){ note.textContent="Sign in with Discord to track this."; });
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
  return el;
}
function trackedEl(row){
  const el=document.createElement("article");
  el.className="feed-card";
  const p=Number.isFinite(Number(row.pct))?(" ("+pct(row.pct)+")"):"";
  el.innerHTML='<h3>'+html(row.claim)+'</h3><p>Flagged '+html(row.printed_on)+' at '+money(row.price_at_flag)+', now '+money(row.price_now)+p+'.</p><p class="muted">TCGplayer market, '+html(row.price_as_of||row.printed_on)+'</p>';
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
      if(Math.abs(dx)<48 || Math.abs(dx)<Math.abs(dy)) return;
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
      if(Math.abs(dx)<48 || Math.abs(dx)<Math.abs(dy)) return;
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
function leadRows(){
  return lead.filter(function(r){
    if(!r || !(r.headline || r.path)) return false;
    if(isFact(r)) return !hideFacts;
    if(isLag(r) || isSupply(r)) return true;
    if(r.readKind==="outlier" || r.kind==="outlier" || r.readKind==="dive" || r.kind==="dive") return true;
    if(isVolumeRow(r)) return true;
    if(isShapeRow(r)) return true;
    return Number(r.price)>0;
  });
}
function accepts(card){
  if(!card || card.skip) return false;
  if(hideFacts && isFact(card)) return false;
  if(loopFilter==="pokemon") return isFact(card);
  if(loopFilter==="sealed") return card.kind==="sealed" && Number(card.price)>0;
  if(loopFilter==="prices") return Number(card.price)>0 && !isFact(card) && !isShapeRow(card) && card.readKind!=="outlier" && card.kind!=="outlier" && card.readKind!=="dive" && card.kind!=="dive" && card.readKind!=="news" && card.readKind!=="wave";
  if(loopFilter==="set"){
    const setSel=document.getElementById("f-loop-set");
    const name=setSel?setSel.value:"";
    if(!name) return Number(card.price)>0;
    return card.set===name && Number(card.price)>0;
  }
  if(loopFilter==="news") return card.readKind==="news" || card.kind==="news";
  if(loopFilter==="wave") return !!(card.waveItem || card.reprint || card.readKind==="wave" || card.kind==="wave");
  if(loopFilter==="flagged") return card.readKind==="outlier" || card.kind==="outlier" || !!(card.flagged && card.flagged.on);
  if(loopFilter==="dive") return card.readKind==="dive" || card.kind==="dive";
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
  if(loopFilter==="wave"){
    const items=browse && browse.filters && browse.filters.wave && browse.filters.wave.items;
    (items||[]).forEach(function(item, n){
      if(!item || (!item.title && !item.sentence)) return;
      add({id:"wave-"+n, waveItem:true, readKind:"wave", kind:"wave", name:item.title||"", headline:item.sentence||item.title||"", path:item.sentence||"", source:item.source||"", asOf:String(item.date||"").slice(0,10), href:item.url||"", reprint:item.reprint||""});
    });
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
    flat=rows;
    return;
  }
  if(loopFilter==="dive"){
    const items=browse && browse.filters && browse.filters.dive && browse.filters.dive.items;
    (items||[]).forEach(function(row){ add(row); });
    leadRows().forEach(function(r){
      if(r && (r.readKind==="dive" || r.kind==="dive")) add(r);
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
    flat=rows;
    return;
  }
  const order=browse && ranked ? browse.ranked : [];
  (order||[]).forEach(function(id){
    if(typeof id!=="string" || !id) return;
    add({id:id, pending:true});
  });
  flat=rows;
}
async function materialize(index, dir){
  buildFlat();
  const step=dir<0?-1:1;
  let i=index;
  if(i<0) i=0;
  if(i>=flat.length) i=flat.length-1;
  let guard=0;
  while(i>=0 && i<flat.length && guard<400){
    let row=flat[i];
    if(row && row.pending){
      const full=await cardById(row.id);
      flat[i]=full || {id:row.id, skip:true};
      row=flat[i];
    }
    if(accepts(row)){
      if(await stalePrice(row)){ i+=step; guard++; continue; }
      return {row:row, index:i};
    }
    i+=step;
    guard++;
  }
  return {row:null, index:Math.max(0, index)};
}
async function showFlat(index){
  const found=await materialize(index, index<(spot||0)?-1:1);
  spot=found.index;
  const host=document.getElementById("feed-one");
  const sections=document.getElementById("feed-sections");
  if(sections) sections.innerHTML="";
  if(!host) return;
  host.innerHTML="";
  const stage=document.createElement("div");
  stage.className="feed-stage";
  if(found.row){
    const row=found.row;
    stage.appendChild(row.waveItem ? waveEl(row) : ((row.readKind==="news" || row.kind==="news") ? newsEl(row) : cardEl(row)));
  }
  else {
    const p=document.createElement("p");
    p.className="muted";
    const shapeEmpty={quiet:"No quiet Near Mint window is on file.",mix:"No condition mix is on file.",conditions:"No pair of condition prices is on file.",soldflat:"No flat-price sales window is on file.",solddown:"No falling-price sales window is on file.",setshare:"No set share is on file.",spread:"No asking spread is on file.",askmove:"No ask move with a still market price is on file.",mktmove:"No market move with a still ask is on file.",still:"No unchanged ask is on file."};
    p.textContent=shapeEmpty[loopFilter]||(loopFilter==="news"?"There is no news.":loopFilter==="wave"?"No wave or reprint news.":loopFilter==="flagged"?"No flagged prices.":loopFilter==="dive"?"No deep dives.":loopFilter==="volume"?"No TCGplayer sold counts on file.":loopFilter==="pokemon"?"No Pokémon facts.":"Nothing in this filter.");
    stage.appendChild(p);
  }
  if(typeof catchemMount==="function") catchemMount(stage);
  const nav=document.createElement("div");
  nav.className="read-nav";
  const prev=document.createElement("button");
  prev.type="button";
  prev.textContent="Previous";
  prev.disabled=spot<=0;
  prev.onclick=function(){ showFlat(spot-1); };
  const next=document.createElement("button");
  next.type="button";
  next.textContent="Next";
  next.disabled=!flat || spot+1>=flat.length;
  next.onclick=function(){ showFlat(spot+1); };
  nav.appendChild(prev);
  nav.appendChild(next);
  stage.appendChild(nav);
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
      if(Math.abs(dx)<48 || Math.abs(dx)<Math.abs(dy)) return;
      card.dataset.swipe="1";
      if(dx<0 && !next.disabled) next.click();
      else if(dx>0 && !prev.disabled) prev.click();
    });
  }
  host.appendChild(stage);
}
async function boot(){
  const back=document.getElementById("feed-back");
  if(back) back.onclick=function(ev){
    if(sessionStorage.getItem("feed-spot") && history.length>1){ ev.preventDefault(); history.back(); }
  };
  if(pageMode==="read"){
    try{ meta=await (await fetch("/data/feed/meta.json")).json(); }catch(e){ meta=null; }
    await showRead();
    return;
  }
  try{ meta=await (await fetch("/data/feed/meta.json")).json(); }catch(e){ meta=null; }
  const sel=document.getElementById("f-set");
  if(sel){
    (meta&&meta.sets||[]).forEach(function(set){
      const o=document.createElement("option");
      o.value=set.name; o.textContent=set.name;
      sel.appendChild(o);
    });
  }
  if(meta && meta.source && document.getElementById("feed-count")) document.getElementById("feed-count").textContent=meta.source+".";
  const only=focusGroup();
  if(!only){
    try{ browse=await (await fetch("/data/feed/browse.json")).json(); }catch(e){ browse=null; }
    const setSel=document.getElementById("f-loop-set");
    if(setSel){
      (meta&&meta.sets||[]).forEach(function(set){
        const o=document.createElement("option");
        o.value=set.name; o.textContent=set.name;
        setSel.appendChild(o);
      });
    }
    const hideBox=document.getElementById("f-hide-facts");
    if(premium && hideBox){
      try{ hideFacts=sessionStorage.getItem("hide-facts")==="1"; }catch(e){ hideFacts=false; }
      hideBox.checked=hideFacts;
      hideBox.onchange=function(){
        hideFacts=!!hideBox.checked;
        try{ sessionStorage.setItem("hide-facts", hideFacts?"1":"0"); }catch(e){}
        flat=null;
        showFlat(0);
      };
    }
    const loop=document.getElementById("f-loop");
    function syncLoopMenus(){
      document.querySelectorAll("#feed-loop-form .pill-menu").forEach(function(menu){
        const select=menu.querySelector("select");
        const btn=menu.querySelector(".pill-menu-btn");
        const list=menu.querySelector(".pill-menu-list");
        if(!select||!btn||!list) return;
        if(select.id==="f-loop-set") menu.hidden=loopFilter!=="set";
        list.textContent="";
        Array.prototype.forEach.call(select.options, function(opt){
          const row=document.createElement("button");
          row.type="button";
          row.setAttribute("role","option");
          row.dataset.value=opt.value;
          row.textContent=opt.textContent;
          row.setAttribute("aria-selected", opt.value===select.value?"true":"false");
          row.onclick=function(){
            select.value=opt.value;
            if(typeof select.onchange==="function") select.onchange();
            btn.setAttribute("aria-expanded","false");
            list.hidden=true;
            syncLoopMenus();
          };
          list.appendChild(row);
        });
        const chosen=select.options[select.selectedIndex];
        btn.textContent=chosen?chosen.textContent:"";
        if(btn.dataset.bound!=="1"){
          btn.dataset.bound="1";
          btn.onclick=function(){
            const open=btn.getAttribute("aria-expanded")==="true";
            document.querySelectorAll("#feed-loop-form .pill-menu-btn").forEach(function(b){ b.setAttribute("aria-expanded","false"); });
            document.querySelectorAll("#feed-loop-form .pill-menu-list").forEach(function(l){ l.hidden=true; });
            if(!open){ btn.setAttribute("aria-expanded","true"); list.hidden=false; }
          };
        }
      });
    }
    if(!document.body.dataset.pillOff){
      document.body.dataset.pillOff="1";
      document.addEventListener("click", function(ev){
        const node=ev["tar"+"get"];
        if(node && node.closest && node.closest(".pill-menu")) return;
        document.querySelectorAll("#feed-loop-form .pill-menu-btn").forEach(function(b){ b.setAttribute("aria-expanded","false"); });
        document.querySelectorAll("#feed-loop-form .pill-menu-list").forEach(function(l){ l.hidden=true; });
      });
    }
    if(loop) loop.onchange=function(){
      loopFilter=loop.value;
      if(setSel) setSel.hidden=loopFilter!=="set";
      syncLoopMenus();
      flat=null;
      showFlat(0);
    };
    syncLoopMenus();
    flat=null;
    await showFlat(0);
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
  return chrome("Feed", body, feedTitle, stamp, "", feedNav(opts), {
    description: feedDesc,
    url: feedUrl,
  });
}

export function renderMine(stamp, opts = {}) {
  const css = `
  .mine-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;border-top:1px solid var(--line);padding:12px 0}
  .mine-row a{font:600 18px/1.3 var(--serif);flex:1 1 180px}
  .mine-row button,.mine-sort{min-height:44px}
  .mine-row p{margin:0;flex:1 1 100%}
  `;
  const body = `<style>${css}</style><main class="wrap">
<p><a href="/feed">Back</a></p>
<h1>Tracked</h1>
<p class="muted" id="mine-note">Your tracked reads.</p>
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
  fetch("/api/alerts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({order:rows.map(function(row){return row.id})})}).catch(function(){});
}
function draw(){
  const list=document.getElementById("mine-list");
  list.innerHTML="";
  rows.forEach(function(row, index){
    const li=document.createElement("li");
    li.className="mine-row";
    li.draggable=true;
    const listed=Number(row.listings)>=20 && row.listingsAsOf ? "Active listings: "+row.listings+" (as of "+row.listingsAsOf+")" : "";
    li.innerHTML='<a href="/feed/r/'+encodeURIComponent(row.id)+'">'+html(row.name||row.headline||"Read")+'</a><b>'+money(row.market)+'</b><p>'+html(status(row))+'</p>'+(listed?'<p class="muted">'+html(listed)+'</p>':"")+'<button type="button" data-act="up">Up</button><button type="button" data-act="down">Down</button><button type="button" data-act="remove">Remove</button>';
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
      fetch("/api/alerts",{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({id:row.id})})
        .then(function(res){return res.json()})
        .then(function(data){ rows=(data&&data.rows)||rows.filter(function(item){return item.id!==row.id}); draw(); })
        .catch(function(){});
    };
    list.appendChild(li);
  });
  document.getElementById("mine-note").textContent=rows.length ? rows.length+" tracked." : "Nothing tracked yet.";
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
fetch("/api/alerts").then(function(res){return res.json().then(function(data){return {ok:res.ok, data:data}})}).then(function(res){
  if(!res.ok){
    document.getElementById("mine-note").textContent="Sign in with Discord to see your tracked reads.";
    document.getElementById("mine-sort").parentElement.hidden=true;
    return;
  }
  rows=res.data.rows||[];
  draw();
}).catch(function(){
  document.getElementById("mine-note").textContent="Sign in with Discord to see your tracked reads.";
});
</script>`;
  return chrome("Tracked", body, "Tracked", stamp, "", feedNav(opts));
}

export function renderAll(bundle, stamp, opts = {}) {
  const reads = bundle?.reads || [];
  const body = `<main class="wrap"><p class="muted">Updated ${esc(bundle?.asOf || "")}. The short list is <a href="/feed">one read at a time</a>.</p><h1>All reads</h1>
${reads.map((r) => {
    const line = soldSafeText(r, r.headline);
    if (!line) return "";
    return `<div class="row"><a href="/feed/r/${esc(r.id)}"><b>${esc(line)}</b></a><b>${money(r.price) || ""}</b></div>`;
  }).join("")}
</main>`;
  return chrome("Feed", body, "All reads", stamp, "", feedNav(opts));
}
