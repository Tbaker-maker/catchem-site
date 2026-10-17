// Read pages join the per-read facts file. Fixed fixture.
import { banGuard } from "../src/advice-rules.mjs";
// Whole pages carry code comments, so dashes are checked by their own assertion here.
const PAGE = { skipKinds: ["house"] };
import { readSheet, cleanTitle } from "../src/read-sheet.mjs";
import { historyChart } from "../src/history-chart.mjs";
let fail = 0;
const t = (n, c) => { if (c) console.log("ok  ", n); else { fail++; console.error("FAIL", n); } };
const read = { id: "backto-tcgcsv-1", name: "Misty's Psyduck - 193/182", set: "SV10: Destined Rivals", number: "193/182", tags: ["Illustration Rare"], prices: [{ amount: 84.45, source: "tcgplayer", label: "Near Mint", date: "" }] };
const facts = {
  id: "backto-tcgcsv-1", asOf: "2026-10-14",
  item: { kind: "single", price: 47.36, priceAsOf: "2026-10-14", rarity: "Illustration Rare", artist: "Okacheke", number: "193/182" },
  listings: { n: 12, date: "2026-10-14", prev: 10, prevDate: "2026-10-07", pct: 20, span: 7 },
  change: { d30: { pct: -22.3, from: "2026-09-14", to: "2026-10-14" }, y1: { pct: -30.8, from: "2025-10-09", to: "2026-10-14" } },
  range: { from: "2025-05-29", high: { price: 84.54, date: "2025-05-29" }, low: { price: 42.12, date: "2026-01-08" }, daysSinceHigh: 503, fromHighPct: -44, now: { price: 47.36, date: "2026-10-14" } },
  rank: { rank: 8, of: 244, set: "SV10: Destined Rivals" },
  gap: { tcg: 47.36, tcgDate: "2026-10-14", ebay: 50, ebayDate: "2026-10-14", diff: 2.64, pct: 5.6 },
  setMomentum: { pct: 0.6, from: "2026-09-14", to: "2026-10-14", set: "SV10: Destined Rivals", kind: "singles" },
  rarityBand: { n: 23, median: -21.2, up: 0, down: 23, from: "2026-09-14", to: "2026-10-14", set: "SV10: Destined Rivals", rarity: "Illustration Rare" },
  artistBand: { n: 71, median: -1.3, up: 27, down: 41, from: "2026-09-09", to: "2026-10-14", artist: "Okacheke" },
  variants: [{ name: "Normal", price: 41, asOf: "2026-10-14" }, { name: "Reverse Holofoil", price: 55, asOf: "2026-10-14" }],
  pattern: { rate: 25, base: 20.8, n: 3503, horizon: 7, keys: ["set_age=1_to_3y", "rotation_stage=previous"], asOf: "2026-10-14" },
  similar: [{ name: "Team Rocket's Mewtwo ex - 240/182", number: "240/182", price: 50.04, image: "/img/sv10/240", href: "/c/tcgcsv-2" }],
};
const h = readSheet(read, { facts, reads: [], rotation: { mark: "I", status: "Standard", asOf: "2026-08-24" } });
t("listings counted with 7-day change", h.includes("12 listings counted, Oct 14, 7-day +20% from Oct 7"));
t("30-day and 1Y change", h.includes("30-day -22.3%, Sep 14 to Oct 14") && h.includes("1Y -30.8%"));
t("eBay vs TCGplayer gap", h.includes("eBay ask $50.00 vs TCGplayer $47.36 (+5.6%)"));
t("hero uses tonight's dated price, not the old high", h.includes("NM $47.36 TCGplayer, Oct 14, 2026") && !h.includes("$84.45 TCGplayer"));
t("high, low, days since high, rank", h.includes("High $84.54 on May 29, 2025") && h.includes("503 days since the last high, now 44% under it") && h.includes("No. 8 of 244"));
t("percent facts are not scaled twice", h.includes("singles index +0.6%"));
t("pattern shows rate vs base and n", h.includes("right 25% of the time 7 days later, vs 20.8% normally. Based on 3,503 past cases") && h.includes("set 1 to 3 years old"));
t("bands, variants, similar with thumbnail", h.includes("Rarity band") && h.includes("Artist band") && h.includes("Reverse Holofoil $55.00") && h.includes('src="/img/sv10/240"'));
t("rotation chip", h.includes("Mark I · Standard"));
t("clean title", cleanTitle("Misty's Psyduck - 193/182") === "Misty's Psyduck" && cleanTitle("Mew ex") === "Mew ex");
t("no em dash, no banned words in sheet text", !/[\u2014\u2013]/.test(h) && !banGuard("read-facts", null, PAGE).test(h.replace(/<[^>]+>/g, " ")));
t("facts for another read are ignored", !readSheet(read, { facts: { ...facts, id: "other" }, reads: [] }).includes("High and low"));
t("empty facts hide sections", !readSheet({ id: "x", name: "X" }, { facts: { id: "x" }, reads: [] }).includes('class="rd-card"'));
const chart = historyChart([["2026-10-01", 5, "n"], ["2026-10-03", 6, "n"]]);
t("no About this chart box", !chart.includes("About this chart") && !chart.includes("hc-about"));
t("tooltip names the source", chart.includes("srcOf(p)") || !chart.includes("<script"));
if (fail) process.exit(1);
