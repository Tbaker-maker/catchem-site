// Social receipt cards. Facts below are copied from public files dated 2026-10-23.
// Nothing here is posted. A card with no source, no date, or no site link is refused.

const INK = "#efe9de";
const GOLD = "#d9b779";
const PAPER = "#12100e";
const DIM = "#b7b1a6";

const xml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => {
  if (c === "&") return "&" + "amp;";
  if (c === "<") return "&" + "lt;";
  if (c === ">") return "&" + "gt;";
  if (c === "\"") return "&" + "quot;";
  return "&" + "apos;";
});

export const RECEIPT_AS_OF = "2026-10-23";

// market-meter.json history: 2026-09-23 mood 17 heat 26, 2026-10-23 mood 69 heat 41.
export const PULSE_MONTH = {
  id: "pulse-month",
  kicker: "Pulse, one month",
  big: "69",
  title: "Label: Greed",
  lines: [
    "Mood 17 on Sep 23",
    "to 69 on Oct 23",
    "Heat 26 to 41, Cool",
    "Label only. Not a prompt.",
  ],
  source: "TCGplayer market indexes",
  date: "Oct 23, 2026",
  href: "https://catchemtcg.com/meter",
  sealed: false,
};

// today.json news line plus sets/me06-delta-reign.json item tcgcsv-712102.
export const RUMOR_PRICE = {
  id: "rumor-vs-price",
  kicker: "Rumor vs price",
  big: "$106.19",
  title: "Elite Trainer Box",
  lines: [
    "Delta Reign",
    "News names Nov 6, 2026",
    "Market price is Oct 23",
    "The news line has no price.",
  ],
  source: "TCGplayer market",
  date: "Oct 23, 2026",
  href: "https://catchemtcg.com/sets/me06-delta-reign",
  sealed: true,
};

// receipts.json receipt-2026-10-14-sealed-sv3pt5-etb. accuracy.json: 2 hits, 8 misses.
export const LEDGER_MISS = {
  id: "read-ledger",
  kicker: "Read ledger",
  big: "Miss",
  title: "151 Elite Trainer Box",
  lines: [
    "$570.00 written down Oct 14",
    "$571.67 asking price Oct 15",
    "The other way.",
    "2 hits. 8 misses. Rate hidden.",
  ],
  source: "eBay asking prices",
  date: "Oct 15, 2026",
  href: "https://catchemtcg.com/receipts",
  sealed: true,
};

export const RECEIPTS = [PULSE_MONTH, RUMOR_PRICE, LEDGER_MISS];

// Home Today strip, today.json lines, file order. This is the one list.
export const INTERESTING_NOW = [
  {
    id: "year-tcgcsv-86043",
    text: "Heat Rotom (Rising Rivals) RT3, $25.05 on Oct 23, 2025 to $95.07 on Oct 23, 2026. TCGplayer market.",
    href: "https://catchemtcg.com/c/tcgcsv-86043",
    source: "TCGplayer market",
    date: "Oct 23, 2026",
  },
  {
    id: "set30-sv-scarlet-violet-151",
    text: "Scarlet & Violet 151, about 30 days: 2 of 30 priced cards up 10% or more, 12 down 10% or more. Sep 26 to Oct 23, 2026. TCGplayer market.",
    href: "https://catchemtcg.com/c/tcgcsv-517046",
    source: "TCGplayer market",
    date: "Oct 23, 2026",
  },
  {
    id: "news-delta-reign",
    text: "Mega Evolution, Delta Reign. PokeGuardian. Set file release Nov 6, 2026. Elite Trainer Box $106.19 on Oct 23, 2026.",
    href: "https://catchemtcg.com/sets/me06-delta-reign",
    source: "TCGplayer market",
    date: "Oct 23, 2026",
  },
];

const BRAG = /\b(called it|nailed it|winner|to the moon|load up|easy money|guaranteed|you should|buy now|don'?t miss|do not miss)\b/i;
const SOLD = /\bsolds?\b|\bsales\b/i;
const DASH = /[\u2014\u2013]/;
const COND = /\b(NM|LP|MP|HP|Near Mint|Lightly Played|Moderately Played|Heavily Played|Damaged)\b/;
const CREATOR = /\bCollectr\b/i;

export function skeptic(card) {
  const text = [card?.kicker, card?.big, card?.title, ...(card?.lines || []), card?.source, card?.date, card?.text].filter(Boolean).join("\n");
  const reasons = [];
  if (!String(card?.source || "").trim()) reasons.push("no source");
  if (!String(card?.date || "").trim()) reasons.push("no date");
  if (!/^https:\/\/catchemtcg\.com\//.test(String(card?.href || ""))) reasons.push("no site link");
  if (DASH.test(text)) reasons.push("dash");
  if (SOLD.test(text)) reasons.push("sold");
  if (BRAG.test(text)) reasons.push("brag");
  if (CREATOR.test(text)) reasons.push("creator");
  if (card?.sealed && COND.test(text)) reasons.push("condition");
  return reasons;
}

function line(text, y, size, fill, weight = "500") {
  return `<text x="72" y="${y}" fill="${fill}" font-family="Georgia, serif" font-size="${size}" font-weight="${weight}">${xml(text)}</text>`;
}

export function receiptSvg(card) {
  const reasons = skeptic(card);
  if (reasons.length) throw new Error(`refusing card ${card?.id || ""}: ${reasons.join(", ")}`);
  const rows = (card.lines || []).map((bit, i) => line(bit, 780 + i * 64, 36, INK)).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" role="img">
<title>${xml(card.kicker)}</title>
<rect width="1080" height="1350" rx="48" fill="${PAPER}"/>
<rect x="28" y="28" width="1024" height="1294" rx="36" fill="none" stroke="${GOLD}" stroke-width="8"/>
<text x="540" y="760" text-anchor="middle" fill="${INK}" fill-opacity="0.07" font-family="Georgia, serif" font-size="168">Catch'em</text>
${line("Catch'em", 120, 40, GOLD, "600")}
${line(card.kicker, 200, 32, GOLD)}
<text x="72" y="460" fill="${INK}" font-family="Georgia, serif" font-size="168" font-weight="600">${xml(card.big)}</text>
${line(card.title, 560, 56, INK, "600")}
${rows}
${line(card.source, 1120, 32, DIM)}
${line(card.date, 1172, 32, DIM)}
${line(String(card.href).replace("https://", ""), 1248, 32, GOLD)}
</svg>
`;
}

export function foundInExplorer(list = INTERESTING_NOW) {
  const items = (list || []).map((row) => ({ ...row }));
  if (!items.length) return { ok: false, reasons: ["empty list"], items: [], text: "" };
  const text = [
    "Found in the Explorer. Oct 23, 2026.",
    "Taken from the home Today list, in that order.",
    ...items.map((row, i) => `${i + 1}. ${row.text} ${row.href}`),
  ].join("\n");
  const card = {
    id: "found-in-explorer",
    text,
    source: "TCGplayer market",
    date: "Oct 23, 2026",
    href: "https://catchemtcg.com/",
    sealed: false,
    items,
  };
  const reasons = skeptic(card);
  const same = items.length === INTERESTING_NOW.length && items.every((row, i) => row.id === INTERESTING_NOW[i].id);
  if (!same) reasons.push("not the one list");
  return { ok: reasons.length === 0, reasons, items, text, href: card.href, source: card.source, date: card.date };
}

export const SAMPLE_POSTS = [
  {
    id: "pulse",
    when: "Mon",
    text: "Catch'em Pulse, one month. Mood 17 on Sep 23 to 69 on Oct 23. The meter label is Greed. Heat 26 to 41, Cool. Label only. Not a prompt. TCGplayer market indexes, Oct 23, 2026. https://catchemtcg.com/meter",
    source: "TCGplayer market indexes",
    date: "Oct 23, 2026",
    href: "https://catchemtcg.com/meter",
    sealed: false,
  },
  {
    id: "rumor",
    when: "Wed",
    text: "PokeGuardian names Mega Evolution, Delta Reign. The set file says release Nov 6, 2026. Elite Trainer Box is $106.19. TCGplayer market, Oct 23, 2026. https://catchemtcg.com/sets/me06-delta-reign",
    source: "TCGplayer market",
    date: "Oct 23, 2026",
    href: "https://catchemtcg.com/sets/me06-delta-reign",
    sealed: true,
  },
  {
    id: "ledger",
    when: "Fri",
    text: "Miss. 151 Elite Trainer Box. Written down Oct 14, 2026 at $570.00. Next eBay asking price on Oct 15, 2026 was $571.67. The other way. 10 scored. 2 hits. 8 misses. The rate stays hidden until 20. eBay asking prices. https://catchemtcg.com/receipts",
    source: "eBay asking prices",
    date: "Oct 15, 2026",
    href: "https://catchemtcg.com/receipts",
    sealed: true,
  },
  {
    id: "explorer",
    when: "Thu",
    text: "",
    source: "TCGplayer market",
    date: "Oct 23, 2026",
    href: "https://catchemtcg.com/",
    sealed: false,
  },
  {
    id: "downs",
    when: "Tue",
    text: "Scarlet & Violet 151, about 30 days: 2 of 30 priced cards up 10% or more, 12 down 10% or more. Sep 26 to Oct 23, 2026. TCGplayer market. https://catchemtcg.com/c/tcgcsv-517046",
    source: "TCGplayer market",
    date: "Oct 23, 2026",
    href: "https://catchemtcg.com/c/tcgcsv-517046",
    sealed: false,
  },
];

SAMPLE_POSTS.find((row) => row.id === "explorer").text = foundInExplorer().text;

export const WEEK_CALENDAR = [
  { day: "Mon Oct 26", post: "Pulse month", href: "https://catchemtcg.com/meter" },
  { day: "Tue Oct 27", post: "151 thirty day count, more down than up", href: "https://catchemtcg.com/c/tcgcsv-517046" },
  { day: "Wed Oct 28", post: "Rumor vs price, Delta Reign", href: "https://catchemtcg.com/sets/me06-delta-reign" },
  { day: "Thu Oct 29", post: "Found in the Explorer", href: "https://catchemtcg.com/" },
  { day: "Fri Oct 30", post: "Read ledger miss", href: "https://catchemtcg.com/receipts" },
  { day: "Sat Oct 31", post: "No post", href: "" },
  { day: "Sun Nov 1", post: "No post", href: "" },
];
