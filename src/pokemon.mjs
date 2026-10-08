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
