// Pokémon pages. A page is one dex from card-attrs whose catalogue cards
// share one species name. Counts use those rows. A price, a date, and a
// TCGplayer product id are copied off the card. Nothing is looked up by name.

const FORM = /^(Galarian|Alolan|Hisuian|Paldean|Dark|Light|Shining|Radiant|Team Aqua's|Team Magma's|Team Rocket's|Rocket's|Misty's|Brock's|Erika's|Sabrina's|Blaine's|Koga's|Giovanni's|Lillie's|N's|Marnie's|Ethan's|Cynthia's|Steven's|Iono's|Arven's|Hop's|Bea's|Crystal|Shadow|Mega)\s+/i;
const MECH = /\s+(ex|EX|GX|V|VMAX|VSTAR|BREAK|LEGEND|Prime|Star|LV\.X|-EX|-GX)$/;
const NOT_A_MON = /^(Energy|Pokémon|Pokemon|Trainer|Item|Supporter|Stadium|Tool|Professor|Team|Tapu|Iron|Great|Roaring|Slither|Scream|Brute|Flutter|Sandy|Walking|Gouging|Raging)$/i;

const FINISH = {
  "1stEdition": "1st Edition",
  unlimited: "Unlimited",
  normal: "Normal",
  holofoil: "Holofoil",
  reverseHolofoil: "Reverse Holofoil",
};

export function speciesToken(name) {
  let text = String(name || "").replace(/\s*\([^)]*\)/g, " ").replace(/\s+-\s+\S+$/, " ").replace(/\s+/g, " ").trim();
  for (let i = 0; i < 2; i += 1) text = text.replace(FORM, "");
  text = text.replace(MECH, "").trim();
  const token = text.split(" ")[0] || "";
  if (!token || NOT_A_MON.test(token)) return "";
  return token;
}

// The priced-card strip is for a card that is that Pokémon, not a trainer
// whose name starts with one. Leftover words (Spirit Link, Energy) stay off.
export function speciesPageToken(name) {
  let text = String(name || "").replace(/\s*\([^)]*\)/g, " ").replace(/\s+-\s+\S+$/, " ").replace(/\s+/g, " ").trim();
  for (let i = 0; i < 2; i += 1) text = text.replace(FORM, "");
  text = text.replace(MECH, "").trim();
  if (!text || /\s/.test(text) || NOT_A_MON.test(text)) return "";
  return text;
}

// Nightly bucket id. Catalogue rows keep their own id and a TCGplayer product id.
// A catalogue id with no product id can still join when the public image map
// stores the same picture path on a tcgcsv id. That path is the join. A name is not.
export function nightlyIdOf(card) {
  const id = String(card?.id || "");
  if (/^tcgcsv-\d+$/.test(id)) return id;
  const n = Number(card?.tcgPlayerId);
  return Number.isInteger(n) && n > 0 ? `tcgcsv-${n}` : "";
}

function normName(name) {
  return String(name || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normSet(name) {
  let text = String(name || "").toLowerCase().replace(/&/g, "and");
  text = text.replace(/^(?:sv\d*|swsh\d*|sm|xy|bw)\s*[:\-]\s*/, "");
  return text.replace(/[^a-z0-9]+/g, " ").trim();
}

function normNum(num) {
  return String(num || "").trim().toLowerCase().split("/")[0].trim().replace(/^0+/, "");
}

function cardPath(path) {
  return typeof path === "string" && /^\/img\/[A-Za-z0-9]+\/[A-Za-z0-9]+$/.test(path);
}

// Picture path first. A catalogue card with no shared path can still match one
// search-lite single by name, set, and number. Two hits is no match.
export function nightlyIdsForPage(page, images, rows) {
  const byPath = new Map();
  if (images && typeof images === "object") {
    for (const [id, path] of Object.entries(images)) {
      if (!/^tcgcsv-\d+$/.test(id) || !cardPath(path)) continue;
      const list = byPath.get(path);
      if (list) list.push(id);
      else byPath.set(path, [id]);
    }
  }
  const byName = new Map();
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (!Array.isArray(row) || row[5] !== "single") continue;
      const id = String(row[0] || "");
      if (!/^tcgcsv-\d+$/.test(id)) continue;
      const name = normName(row[1]);
      const set = normSet(row[2]);
      const num = normNum(row[3]);
      if (!name || !set || !num) continue;
      const key = `${name}\n${set}\n${num}`;
      const list = byName.get(key);
      if (list) list.push(id);
      else byName.set(key, [id]);
    }
  }
  const out = [];
  const seen = new Set();
  const push = (id) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  };
  for (const card of page?.cards || []) {
    const direct = nightlyIdOf(card);
    if (direct) { push(direct); continue; }
    const path = images && typeof images === "object" ? images[card?.id] : "";
    const hits = cardPath(path) ? byPath.get(path) : null;
    if (hits && hits.length) { hits.forEach(push); continue; }
    const name = normName(card?.name);
    const set = normSet(card?.set);
    const num = normNum(card?.number);
    const named = name && set && num ? byName.get(`${name}\n${set}\n${num}`) : null;
    if (named && named.length === 1) push(named[0]);
  }
  return out;
}

// Price range for one Pokémon page from tonight's quotes only. A catalogue
// price on the card is not used. A quote needs a price and a date.
export function nightlySpeciesStrip(page, quotes, ids) {
  const name = String(page?.name || "").trim();
  const slug = String(page?.slug || "").trim();
  if (!name || !slug) return null;
  const wanted = Array.isArray(ids)
    ? [...new Set(ids.filter((id) => /^tcgcsv-\d+$/.test(String(id))))]
    : (page?.cards || []).map(nightlyIdOf).filter(Boolean);
  const rows = [];
  for (const id of wanted) {
    const quote = quotes ? quotes[id] : null;
    const price = Number(quote?.price);
    const date = String(quote?.date || quote?.asOf || "").slice(0, 10);
    if (!(price > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    rows.push({ price, date });
  }
  if (!rows.length) return null;
  let low = rows[0];
  let high = rows[0];
  for (const row of rows) {
    if (row.price < low.price || (row.price === low.price && row.date > low.date)) low = row;
    if (row.price > high.price || (row.price === high.price && row.date > high.date)) high = row;
  }
  return { name, slug, count: rows.length, low: low.price, lowDate: low.date, high: high.price, highDate: high.date };
}

export function pokemonSlug(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function isoDay(value) {
  const s = String(value || "").trim();
  const hit = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
  if (!hit) return "";
  const y = Number(hit[1]);
  const m = Number(hit[2]);
  const d = Number(hit[3]);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return "";
  return dt.toISOString().slice(0, 10);
}

function storedUrl(card) {
  const keys = ["tcgplayer", "tcgplayerUrl", "productUrl", "url", "link", "href"];
  for (let i = 0; i < keys.length; i++) {
    const value = String(card?.[keys[i]] || "").trim();
    if (/^https:\/\/(?:www\.)?tcgplayer\.com\/product\/\d+(?:[/?#]|$)/i.test(value)) return value;
  }
  return "";
}

function productId(card) {
  const keys = ["tcgPlayerId", "tcgplayerId", "tcgplayerProductId", "productId", "pid"];
  for (let i = 0; i < keys.length; i++) {
    const n = Number(card?.[keys[i]]);
    if (Number.isInteger(n) && n > 0) return n;
  }
  const sku = String(card?.sku || card?.id || "");
  const hit = sku.match(/^tcgcsv-(\d+)$/);
  return hit ? Number(hit[1]) : 0;
}

// The link only when that product id or that product URL is already on the card.
export function productLink(card) {
  if (!card || typeof card !== "object") return "";
  const url = storedUrl(card);
  if (url) return url;
  const pid = productId(card);
  return pid ? "https://www.tcgplayer.com/product/" + pid : "";
}

export function catalogCard(id, card) {
  const row = card && typeof card === "object" ? card : {};
  const price = Number(row.price);
  const day = isoDay(row.priceUpdatedAt || row.asOf);
  const finish = FINISH[String(row.priceFinish || "")] || "";
  const source = /tcgplayer/i.test(String(row.priceSource || row.source || "")) ? "TCGplayer market" : "";
  return {
    id: String(id),
    name: String(row.name || "").trim(),
    set: String(row.setName || row.set || "").trim(),
    number: String(row.number || row.num || "").trim(),
    artist: String(row.artist || "").trim(),
    release: isoDay(String(row.releaseDate || "").replaceAll("/", "-")) || String(row.release || "").slice(0, 10),
    price: price > 0 ? price : null,
    priceDate: price > 0 ? day : "",
    finish: price > 0 ? finish : "",
    source: price > 0 ? source : "",
    link: productLink(row),
    tcgPlayerId: productId(row) || null,
    cutout: typeof row.cutout === "string" ? row.cutout.trim() : "",
  };
}

export function pokemonCatalogLine(page) {
  if (!page) return "";
  const name = String(page.name || "").trim();
  const cardCount = Number(page.cardCount);
  const artistCount = Number(page.artistCount);
  const dex = Number(page.dex);
  if (!name || !Number.isInteger(cardCount) || !Number.isInteger(artistCount) || !Number.isInteger(dex)) return "";
  if (cardCount < 1 || artistCount < 1 || dex < 1) return "";
  return `${name} has ${cardCount} cards in the catalog, drawn by ${artistCount} artists, and the national dex number on those cards is ${dex}.`;
}

export function sortPokemonCards(cards, mode) {
  const list = (cards || []).slice();
  if (mode === "set") {
    list.sort((a, b) => {
      const ar = a.release || "9999-99-99";
      const br = b.release || "9999-99-99";
      return ar.localeCompare(br)
        || String(a.set || "").localeCompare(String(b.set || ""))
        || String(a.number || "").localeCompare(String(b.number || ""), undefined, { numeric: true })
        || String(a.id).localeCompare(String(b.id));
    });
    return list;
  }
  list.sort((a, b) => {
    const ap = a.price > 0 ? a.price : -1;
    const bp = b.price > 0 ? b.price : -1;
    if (bp !== ap) return bp - ap;
    return String(a.name || "").localeCompare(String(b.name || "")) || String(a.id).localeCompare(String(b.id));
  });
  return list;
}

// Same grouping as the feed fact: one name per dex, and a name that belongs
// to two dex numbers is not a page.
export function buildPokemonPages(attrs, catalogue, cutouts) {
  const byDex = new Map();
  const attrCards = attrs && typeof attrs === "object" ? attrs : {};
  const cards = catalogue && typeof catalogue === "object" ? catalogue : {};
  for (const [id, card] of Object.entries(cards)) {
    const dex = Number(attrCards[id]?.dex);
    if (!Number.isInteger(dex) || dex <= 0) continue;
    const token = speciesToken(card?.name);
    if (!token) continue;
    if (!byDex.has(dex)) byDex.set(dex, []);
    byDex.get(dex).push({ id, token, artist: String(card?.artist || "").trim(), card });
  }
  const named = new Map();
  for (const [dex, rows] of byDex) {
    const counts = new Map();
    for (const row of rows) counts.set(row.token, (counts.get(row.token) || 0) + 1);
    let token = "";
    let best = -1;
    for (const [name, n] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      if (n > best) {
        best = n;
        token = name;
      }
    }
    const artists = new Set(rows.map((row) => row.artist).filter(Boolean));
    if (!token || rows.length < 1 || artists.size < 1) continue;
    if (!named.has(token)) named.set(token, []);
    named.get(token).push({ name: token, dex, cardCount: rows.length, artistCount: artists.size, rows });
  }
  const bySlug = {};
  const pending = [];
  for (const [token, entries] of named) {
    if (entries.length !== 1) continue;
    const entry = entries[0];
    const slug = pokemonSlug(token);
    if (!slug) continue;
    pending.push({ slug, entry });
  }
  const seen = new Map();
  for (const row of pending) {
    if (!seen.has(row.slug)) seen.set(row.slug, []);
    seen.get(row.slug).push(row);
  }
  const byId = {};
  for (const [slug, rows] of seen) {
    if (rows.length !== 1) continue;
    const entry = rows[0].entry;
    const views = sortPokemonCards(entry.rows.map((row) => catalogCard(row.id, row.card)), "price");
    const cut = cutouts && (cutouts[slug] || cutouts[entry.name]);
    const cutout = typeof cut === "string" ? cut.trim() : "";
    bySlug[slug] = {
      slug,
      name: entry.name,
      dex: entry.dex,
      cardCount: entry.cardCount,
      artistCount: entry.artistCount,
      cutout,
      cards: views,
    };
    for (const view of views) byId[view.id] = { ...view, slug, species: entry.name };
  }
  return { bySlug, byId };
}

// Affiliate config comes from the worker env (TCGPLAYER_AFFILIATE_URL,
// EPN_CAMPAIGN_ID). Empty or malformed means plain links.
let AFF = { tcg: "", epn: "" };
export function setAffiliateConfig(env) {
  AFF = { tcg: String(env?.TCGPLAYER_AFFILIATE_URL || "").trim(), epn: String(env?.EPN_CAMPAIGN_ID || "").trim() };
}
export function getAffiliateConfig() { return { ...AFF }; }
export function affTcg(url, base) {
  if (!url || !base || !/^https:\/\/[^\s"'<>]+$/.test(base)) return url;
  return base + (base.includes("?") ? "&" : "?") + "u=" + encodeURIComponent(url);
}
export function affEbay(url, campid) {
  if (!url || !/^[0-9]{6,12}$/.test(String(campid || ""))) return url;
  return url + "&mkcid=1&mkrid=711-53200-19255-0&siteid=0&campid=" + campid + "&toolid=10001&mkevt=1";
}
export const PAID_NOTE = "Paid link";
export const PAID_FOOTER = "Paid link. We may earn a commission if you buy, at no extra cost to you.";

// eBay search link for this exact product: name + set (+ card number for a
// single), minus obvious noise. A search, not a listing and not a sale.
export function ebayQuery(card) {
  if (!card || typeof card !== "object") return "";
  const clean = (s) => String(s || "").replace(/tcgcsv-\d+/gi, "").replace(/[[\](){}"]/g, " ").replace(/\s+/g, " ").trim();
  const name = clean(card.name);
  if (!name) return "";
  const set = clean(card.set);
  const sealed = card.kind === "sealed";
  const num = sealed ? "" : clean(card.num).split("/")[0];
  const words = ["Pokemon", name];
  if (set && !name.toLowerCase().includes(set.toLowerCase())) words.push(set);
  if (num && !name.includes(num)) words.push(num);
  const noise = sealed ? ["-lot", "-proxy", "-custom", "-empty", "-code"] : ["-lot", "-proxy", "-custom", "-orica"];
  if (sealed && !/\bcase\b/i.test(name)) noise.push("-case");
  return [...words, ...noise].join(" ");
}
export function ebaySearchUrl(card, cfg = AFF) {
  const q = ebayQuery(card);
  return q ? affEbay("https://www.ebay.com/sch/i.html?_nkw=" + encodeURIComponent(q), cfg.epn) : "";
}
export function tcgStoreUrl(card, cfg = AFF) {
  return affTcg(productLink(card), cfg.tcg);
}
// Both store links with the disclosure next to them. Hidden when neither exists.
export function storeLinksHtml(card, esc) {
  const tcg = tcgStoreUrl(card);
  const ebay = ebaySearchUrl(card);
  if (!tcg && !ebay) return "";
  const bits = [];
  if (tcg) bits.push(`<a href="${esc(tcg)}" rel="sponsored noopener">TCGplayer</a>`);
  if (ebay) bits.push(`<a href="${esc(ebay)}" rel="sponsored noopener">eBay</a>`);
  return `<p class="store-links">${bits.join(" · ")} <small class="paid-note">${PAID_NOTE}</small></p>`;
}
