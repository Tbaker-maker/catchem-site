// /sets tile for sets with no official logo. The data build's logo.png for these is a
// generated name plate, so the page draws its own: a parent-series logo plus a pill,
// or a clean gradient tile with the set name. No micro brand label.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Slugs in Catchem-data research/assets/img/set-logo-tiles.json (generated plates).
export const TILE_SLUGS = new Set(["alternate-art-promos","battle-academy","battle-academy-2022","battle-academy-2024","blister-exclusives","burger-king-promos","bw-trainer-kit-excadrill-and-zoroark","countdown-calendar-promos","deck-exclusives","dp-trainer-kit-manaphy-and-lucario","e-reader-sample-cards","ex-battle-stadium","ex-trainer-kit-1-latias-and-latios","ex-trainer-kit-2-plusle-and-minun","first-partner-collection-2026","first-partner-pack","hgss-trainer-kit-gyarados-and-raichu","jumbo-cards","kids-wb-promos","league-and-championship-cards","mcdonald-s-promos-2023","mcdonald-s-promos-2024","mee-mega-evolution-energies","miscellaneous-cards-and-products","my-first-battle","nintendo-promos","pikachu-world-collection-promos","player-placement-trainer-promos","prize-pack-series-cards","professor-program-promos","sm-trainer-kit-alolan-sandslash-and-alolan-ninetales","sm-trainer-kit-lycanroc-and-alolan-raichu","southeast-asia-exclusives","trading-card-game-classic","trick-or-trade-booster-bundle","trick-or-trade-booster-bundle-2023","trick-or-trade-booster-bundle-2024","world-championship-decks","xy-trainer-kit-bisharp-and-wigglytuff","xy-trainer-kit-latias-and-latios","xy-trainer-kit-pikachu-libre-and-suicune","xy-trainer-kit-sylveon-and-noivern"]);

// Parent series logo for a prefix in the set name.
const PARENTS = [
  [/^MEE:/i, "/img/me1/logo.png", "Mega Evolution"],
  [/^BW Trainer Kit/i, "/img/bw1/logo.png", "Black & White"],
  [/^DP Trainer Kit/i, "/img/dp1/logo.png", "Diamond & Pearl"],
  [/^EX Trainer Kit/i, "/img/ex1/logo.png", "EX Ruby & Sapphire"],
  [/^HGSS Trainer Kit/i, "/img/hgss1/logo.png", "HeartGold & SoulSilver"],
  [/^SM Trainer Kit/i, "/img/sm1/logo.png", "Sun & Moon"],
  [/^XY Trainer Kit/i, "/img/xy1/logo.png", "XY"],
];

export function pillFor(name) {
  const s = String(name || "");
  if (/^MEE:/i.test(s)) return s.replace(/^MEE:\s*Mega Evolution\s*/i, "").trim() || "Energies";
  const m = s.match(/Trainer Kit(?: \d)?:\s*(.+)$/i);
  return m ? `Trainer Kit · ${m[1]}` : "";
}

export function needsTile(set) {
  return !!set && (TILE_SLUGS.has(set.slug) || !/^(https:\/\/|\/img\/[a-z0-9.-]+\/logo\.png$)/i.test(String(set.logo || "")));
}

export function setTile(set) {
  const name = String(set?.name || "");
  const parent = PARENTS.find(([re]) => re.test(name));
  const pill = pillFor(name);
  if (parent) {
    return `<span class="set-tile has-parent" role="img" aria-label="${esc(name)}"><img alt="" width="160" height="56" loading="lazy" decoding="async" src="${esc(parent[1])}"><span class="set-pill">${esc(pill || parent[2])}</span></span>`;
  }
  return `<span class="set-tile" role="img" aria-label="${esc(name)}"><span class="set-tile-name">${esc(name)}</span></span>`;
}

export const SET_TILE_CSS = `.set-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;width:100%;aspect-ratio:220/72;min-height:72px;box-sizing:border-box;padding:10px 14px;border-radius:16px;background:radial-gradient(120% 140% at 0% 0%,rgba(217,183,121,.22),transparent 55%),linear-gradient(135deg,#221d16,#14120f);border:1px solid rgba(217,183,121,.35);overflow:hidden}
.set-tile img{max-width:70%;max-height:44px;width:auto;height:auto;object-fit:contain}
.set-tile-name{font:650 15px/1.25 var(--sans);color:#f1e7d3;text-align:center;letter-spacing:-.01em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.set-pill{display:inline-flex;align-items:center;min-height:24px;max-width:100%;padding:0 10px;border-radius:999px;background:rgba(217,183,121,.16);color:#d9b779;font:600 12px/1.2 var(--sans);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`;
