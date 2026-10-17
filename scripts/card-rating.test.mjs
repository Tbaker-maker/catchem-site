import { banGuard } from "../src/advice-rules.mjs";
import { ratingPanel, shardOf } from "../src/card-rating.mjs";
let fail = 0;
const t = (n, c) => { if (!c) { fail++; console.log("  FAIL", n); } };
const row = { id: "tcgcsv-45123", name: "Vaporeon (12)", groupLabel: "vintage WOTC holos", groupOne: "vintage WOTC holo", price: { price: 54.18, date: "2026-10-12" }, peers: { median: 75.15, n: 90, ratio: 0.72 }, verdict: "Priced below similar cards", factors: { peer: { v: 0.62, fact: "a" }, popularity: { v: 0.81, fact: "Gen 1" }, artist: { v: 0.5, fact: "x" } } };
const doc = { asOf: "2026-10-12", weights: { peer: 25, popularity: 15, scarcity: 15, demand: 15, age: 10, artist: 10, supply: 5, range: 5 } };
const free = ratingPanel(row, doc, {});
const paid = ratingPanel(row, doc, { premium: true });
t("shard matches data repo", shardOf("tcgcsv-130") === "02");
t("verdict shown to everyone", /Priced below similar cards/.test(free) && /Priced below similar cards/.test(paid));
t("peer line dated", /\$54\.18 vs a typical/.test(free) && /Oct 12, 2026/.test(free) && /\$75\.15/.test(free));
t("free has no bars", !/class="bar"/.test(free) && /Premium/.test(free));
t("premium has bars in order", (paid.match(/class="bar"/g) || []).length === 3 && paid.indexOf("Price vs similar cards") < paid.indexOf("Popularity"));
t("held row shows no verdict", !/Priced/.test(ratingPanel({ ...row, check: true, verdict: null }, doc, { premium: true })));
const BANNED = banGuard("card-rating");
t("copy clean", !BANNED.test(paid.replace(/<[^>]+>/g, " ")) && !BANNED.test(free.replace(/<[^>]+>/g, " ")));
t("says not advice", /not advice/.test(free));
t("free line lists only the factors the card has", /Factor bars for price vs similar cards, popularity and artist are in/.test(free) && !/supply/i.test(free.replace(/Supply counted \d+/, "")));
t("plain words: typical price, no median or peer jargon", /Price vs similar cards: \$54\.18 vs a typical \$75\.15 for vintage WOTC holos/.test(free) && !/median|peer value/i.test(free.replace(/<[^>]+>/g, " ") + paid.replace(/<[^>]+>/g, " ")));
t("no sealed data on the card panel", !/sealed|listings/i.test(paid.replace(/<[^>]+>/g, " ")) && !/supply/i.test(paid));
{
  const pool = { rows: [["tcgcsv-45123", "Vaporeon (12)", "Jungle", "12/64", 54.18, "2026-10-12", 0], ...Array.from({ length: 8 }, (_, i) => [`tcgcsv-${i + 1}`, `Card ${i + 1} - ${i + 1}/9`, "Set", `${i + 1}/9`, 10 + i, "2026-10-12", 0])] };
  const h = ratingPanel({ ...row, peers: { ...row.peers, matched: true } }, doc, { pool, pic: (r) => `<img alt="${r.name}">` });
  t("compared with lists every card but itself", (h.match(/href="\/c\/tcgcsv-\d+"/g) || []).length === 8 && !/href="\/c\/tcgcsv-45123"/.test(h));
  t("first 5 open, rest collapsed", /Show 3 more/.test(h) && h.indexOf("<details class=\"cw-more\"") > h.indexOf("tcgcsv-4\""));
  t("each comparison has picture, set and number, dated price", /<img alt="Card 8/.test(h) && /Set · 8\/9/.test(h) && /\$17\.00<small>Oct 12, 2026/.test(h));
  t("compared with shown to free viewers too", /Compared with 8/.test(h));
  const nf = ratingPanel({ ...row, verdict: null, verdictNote: "Not enough similar cards for a fair comparison", nearHigh: { price: 92.5, date: "2026-10-05" }, peers: { n: 13, matched: false, pool: "x" } }, doc, { pool, pic: () => "" });
  t("unmatched says not enough similar cards, no below or above", /Not enough similar cards for a fair comparison/.test(nf) && !/Priced (below|above)/.test(nf) && /Compared with 8/.test(nf));
  t("near its own high shown next to the verdict", /Near its own high on file \(\$92\.50, Oct 5, 2026\)/.test(nf));
}
t("comparison names are clean", (await import("../src/card-rating.mjs")).cleanName("Gardevoir & Sylveon GX (205) (Alternate Full Art)") === "Gardevoir & Sylveon GX");
t("no row no panel", ratingPanel(null, doc) === "");
{
  const np = ratingPanel({ ...row, verdict: null, verdictNote: "Not enough similar cards for a fair comparison", reason: "no published pull rate for this set", index: "ir~illustration-rare~scarlet-and-violet", prBand: null }, doc, {});
  t("no pull rate gives the reason", /No published pull rate for this set and rarity/.test(np) && !/Priced (below|above)/.test(np));
  t("panel links to its index", /href="\/indexes\/ir--illustration-rare--scarlet-and-violet--all"/.test(np));
  const { indexListBody, indexPageBody } = await import("../src/indexes.mjs");
  const doc2 = { key: "k", name: "Tag Team (Alternate Art) Index, Sun & Moon", kind: "all", rarity: "Ultra Rare", era: "Sun & Moon", smallGroup: true, method: "m", source: "TCGplayer market", pullRates: [], points: [["2026-10-05", 1000, 100, 6], ["2026-10-12", 1100, 110, 6]], changes: [{ date: "2026-10-12", started: 6 }], members: Array.from({ length: 6 }, (_, i) => [`tcgcsv-${i}`, `Card ${i} - ${i}/9`, "Set", `${i}/9`, 100 + i, "2026-10-12", "Ultra Rare"]) };
  const ip = indexPageBody(doc2, {});
  t("index page: two lines, members, dated changes, about, small note", (ip.match(/<svg/g) || []).length === 2 && /Cards in this index/.test(ip) && /Oct 12, 2026<\/b>: index started with 6 cards/.test(ip) && /About this index/.test(ip) && /Small group/.test(ip));
  t("index pages never say No data", !/No data/i.test(ip + indexListBody({ asOf: "2026-10-12", indexes: [] })));
  t("index list links each index", /href="\/indexes\/k"/.test(indexListBody({ asOf: "2026-10-12", indexes: [{ key: "k", name: doc2.name, kind: "all", era: "Sun & Moon", last: ["2026-10-12", 1100, 110, 6] }] })));
}
if (fail) { console.log(`card-rating: ${fail} failed`); process.exit(1); } else console.log("card-rating ok");
