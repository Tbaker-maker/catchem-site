// Sourced US MSRP from Catchem-data data/msrp-sourced.json.
// Only high- or medium-confidence rows with an amount, a source URL and a
// check date are shown. A missing MSRP is left off. Never estimated.

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function accept(row) {
  if (!row || typeof row !== "object") return null;
  if (!(Number(row.msrpUsd) > 0)) return null;
  if (String(row.currency || "USD").toUpperCase() !== "USD") return null;
  const conf = String(row.confidence || "").toLowerCase();
  if (conf !== "high" && conf !== "medium") return null;
  if (!ISO.test(String(row.dateChecked || "").slice(0, 10))) return null;
  if (!/^https?:\/\//.test(String(row.sourceUrl || row.citedPrimarySource || ""))) return null;
  return row;
}

// keys: catalog ids that may name this product (sealed id, page id, slugs).
// pid: TCGplayer product id of this page, if known.
export function msrpOf({ keys = [], pid = "", redirects = null, pageId = "" } = {}, doc) {
  const products = doc && doc.products && typeof doc.products === "object" ? doc.products : null;
  if (!products) return null;
  const want = new Set(keys.filter(Boolean).map(String));
  const dests = redirects && redirects.products && typeof redirects.products === "object" ? redirects.products : {};
  if (pageId) {
    for (const [slug, dest] of Object.entries(dests)) {
      if (String(dest || "").replace(/^\/p\//, "") === String(pageId)) want.add(slug);
    }
  }
  for (const key of want) {
    const row = accept(products[key]);
    if (row) return { ...row, key };
  }
  const id = String(pid || "").replace(/^tcgcsv-/, "");
  if (/^\d+$/.test(id)) {
    for (const [key, row] of Object.entries(products)) {
      if (String(row && row.tcgPlayerId) === id) {
        const hit = accept(row);
        if (hit) return { ...hit, key };
      }
    }
  }
  return null;
}

const HOSTS = {
  "phdgames.com": "PHD Games distributor page",
  "deviramericas.com": "TPCi launch sheet",
  "cdn.pidgi.net": "TPCi launch sheet",
  "files.bbystatic.com": "TPCi launch sheet",
  "tmng-al.uspto.gov": "Pokémon Center listing",
  "pokemoncenter.com": "Pokémon Center",
  "pokebeach.com": "PokeBeach",
  "pokeguardian.com": "PokeGuardian",
  "dittobase.com": "Dittobase",
  "snkrdunk.com": "SNKRDUNK",
  "bestbuy.com": "Best Buy",
  "icv2.com": "ICv2",
  "nintendowire.com": "Nintendo Wire",
  "pokemon.com": "Pokémon",
};

function hostLabel(url) {
  let u = String(url || "");
  const wayback = u.match(/^https?:\/\/web\.archive\.org\/web\/\d+[a-z_]*\/(.+)$/i);
  if (wayback) u = /^https?:/i.test(wayback[1]) ? wayback[1] : `http://${wayback[1]}`;
  try {
    const host = new URL(u).hostname.replace(/^www\./, "");
    return HOSTS[host] || host;
  } catch {
    return "";
  }
}

export function msrpSourceLabel(row) {
  if (!row) return "";
  return hostLabel(row.citedPrimarySource) || hostLabel(row.sourceUrl) || "Sourced US MSRP";
}

export function marketOverMsrp(market, msrp) {
  const m = Number(market);
  const s = Number(msrp);
  if (!(m > 0) || !(s > 0)) return null;
  const x = m / s;
  const rounded = x < 10 ? Math.round(x * 100) / 100 : Math.round(x * 10) / 10;
  return Number.isFinite(rounded) ? rounded : null;
}
