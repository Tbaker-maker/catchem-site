// Regulation marks are the letter on the card (card-attrs.json field "rm",
// generated 2026-08-24). A set gets one letter only when that letter is on
// at least 80% of the marked cards and those marked cards are at least 80%
// of the set's singles. A shared logo code is used only when one set's
// single count equals the marked-card count.
//
// Rotated dates are the in-person dates from the two Play! Pokémon
// announcements. F left Standard on April 11, 2025. G left on April 10, 2026.
// No other letter has a date here. This file does not say a set was released again.

export const PRINT_RUN_LINE = "Rotated sets historically stop getting new print runs. Older packs can still turn up in tins and collections.";

export const GUIDE_PARAS = [
  "Every spring, Pokémon updates the Standard tournament format. Each card has a small letter near the set symbol, its regulation mark, and the oldest letter leaves Standard. In 2025 that was F (April 11). In 2026 it was G (April 10), which covered 2023 sets like Scarlet & Violet, Paldea Evolved, Obsidian Flames and 151.",
  "Historically, once a set rotates, it stops getting new print runs. From then on, the sealed product already out there is all there is. Pokémon doesn't announce exact out-of-print dates, so the end usually shows up as stores and distributors running dry.",
  "The main exception is older packs turning up in tins and collections after rotation. Rotated cards still work in Expanded, and they never stop being collectible.",
];

export const ROTATION_SOURCES = [
  {
    mark: "F",
    date: "April 11, 2025",
    href: "https://www.pokemon.com/us/pokemon-news/2025-pokemon-tcg-standard-format-rotation-announcement",
    label: "2025 Pokémon TCG Standard format rotation",
  },
  {
    mark: "G",
    date: "April 10, 2026",
    href: "https://www.pokemon.com/us/pokemon-news/2026-pokemon-tcg-standard-format-rotation-announcement",
    label: "2026 Pokémon TCG Standard format rotation",
  },
];

export const ROTATED_DATES = {
  F: "April 11, 2025",
  G: "April 10, 2026",
};

// slug -> letter. 28 sets. Letters D and E are shown with no date.
export const SET_MARKS = {
  "me01-mega-evolution": "I",
  "me02-phantasmal-flames": "I",
  "me03-perfect-order": "J",
  "me04-chaos-rising": "J",
  "pokemon-go": "F",
  "sv-paldean-fates": "G",
  "sv-scarlet-and-violet-151": "G",
  "sv-shrouded-fable": "H",
  "sv01-scarlet-and-violet-base-set": "G",
  "sv02-paldea-evolved": "G",
  "sv03-obsidian-flames": "G",
  "sv04-paradox-rift": "G",
  "sv05-temporal-forces": "H",
  "sv06-twilight-masquerade": "H",
  "sv07-stellar-crown": "H",
  "sv08-surging-sparks": "H",
  "sv10-destined-rivals": "I",
  "swsh01-sword-and-shield-base-set": "D",
  "swsh02-rebel-clash": "D",
  "swsh03-darkness-ablaze": "D",
  "swsh04-vivid-voltage": "D",
  "swsh05-battle-styles": "E",
  "swsh06-chilling-reign": "E",
  "swsh07-evolving-skies": "E",
  "swsh09-brilliant-stars": "F",
  "swsh10-astral-radiance": "F",
  "swsh11-lost-origin": "F",
  "swsh12-silver-tempest": "F",
};

export const SET_NAMES = {
  "me01-mega-evolution": "ME01: Mega Evolution",
  "me02-phantasmal-flames": "ME02: Phantasmal Flames",
  "me03-perfect-order": "ME03: Perfect Order",
  "me04-chaos-rising": "ME04: Chaos Rising",
  "pokemon-go": "Pokémon GO",
  "sv-paldean-fates": "SV: Paldean Fates",
  "sv-scarlet-and-violet-151": "SV: Scarlet & Violet 151",
  "sv-shrouded-fable": "SV: Shrouded Fable",
  "sv01-scarlet-and-violet-base-set": "SV01: Scarlet & Violet Base Set",
  "sv02-paldea-evolved": "SV02: Paldea Evolved",
  "sv03-obsidian-flames": "SV03: Obsidian Flames",
  "sv04-paradox-rift": "SV04: Paradox Rift",
  "sv05-temporal-forces": "SV05: Temporal Forces",
  "sv06-twilight-masquerade": "SV06: Twilight Masquerade",
  "sv07-stellar-crown": "SV07: Stellar Crown",
  "sv08-surging-sparks": "SV08: Surging Sparks",
  "sv10-destined-rivals": "SV10: Destined Rivals",
  "swsh01-sword-and-shield-base-set": "SWSH01: Sword & Shield Base Set",
  "swsh02-rebel-clash": "SWSH02: Rebel Clash",
  "swsh03-darkness-ablaze": "SWSH03: Darkness Ablaze",
  "swsh04-vivid-voltage": "SWSH04: Vivid Voltage",
  "swsh05-battle-styles": "SWSH05: Battle Styles",
  "swsh06-chilling-reign": "SWSH06: Chilling Reign",
  "swsh07-evolving-skies": "SWSH07: Evolving Skies",
  "swsh09-brilliant-stars": "SWSH09: Brilliant Stars",
  "swsh10-astral-radiance": "SWSH10: Astral Radiance",
  "swsh11-lost-origin": "SWSH11: Lost Origin",
  "swsh12-silver-tempest": "SWSH12: Silver Tempest",
};

export function setRotation(slug) {
  const mark = SET_MARKS[String(slug || "")];
  if (!mark) return null;
  return {
    slug: String(slug),
    mark,
    name: SET_NAMES[slug] || "",
    rotated: ROTATED_DATES[mark] || "",
  };
}

export function rotatedSetKeys() {
  const keys = {};
  for (const slug of Object.keys(SET_MARKS)) {
    if (!ROTATED_DATES[SET_MARKS[slug]]) continue;
    keys[slug.toLowerCase()] = 1;
    const name = SET_NAMES[slug];
    if (name) keys[name.toLowerCase()] = 1;
  }
  return keys;
}

export function isRotatedSet(card) {
  if (!card || typeof card !== "object") return false;
  const keys = rotatedSetKeys();
  const slug = String(card.setSlug || "").trim().toLowerCase();
  const name = String(card.set || "").trim().toLowerCase();
  return !!((slug && keys[slug]) || (name && keys[name]));
}
