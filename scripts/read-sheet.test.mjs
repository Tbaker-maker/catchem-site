import { readSheet, patternSentence } from "../src/read-sheet.mjs";
import { renderFeed } from "../src/ui.mjs";
import vm from "node:vm";
import { readFileSync } from "node:fs";

let fail = 0;
const t = (name, cond) => { console.log(`${cond ? "  ok " : "  FAIL"} ${name}`); if (!cond) fail++; };
const BANNED = /\b(buy|sell|hold|support|resistance|bottom|printed|play|target|invest|stack|load up|crypto|supply)\b/i;

const read = {
  id: "scan-pattern-forming-breakout-tcgcsv-86123",
  sku: "tcgcsv-86123",
  href: "/c/tcgcsv-86123",
  readKind: "pattern-forming",
  name: "Ho-Oh",
  set: "POP Series 5",
  number: "001/017",
  image: "https://catchemtcg.com/data/editor/tcg/pop5/1_hires.png",
  price: 35,
  asOf: "2026-10-13",
  startDate: "2026-09-12",
  endDate: "2026-10-13",
  windowDays: 30,
  changePct: 12.5,
  source: "TCGplayer market, 2026-09-12 to 2026-10-13",
  tags: ["Holo"],
  stale: false,
  prices: [
    { amount: 35, date: "2026-10-13", source: "tcgplayer", condition: "NM", label: "Near Mint" },
    { amount: 40, date: "2026-10-13", source: "ebay", condition: "any condition", label: "any condition" },
  ],
  receipt: { pattern: "breakout", stage: "confirmed", gate: { n: 509, horizon: 30, rate: 55.7, baseRate: 45 }, eraHeld: true },
};
const peers = [
  { id: "set-pop", readKind: "set", name: "POP Series 5", set: "POP Series 5", headline: "POP Series 5, 2 of 10 priced cards up.", asOf: "2026-10-13", source: "TCGplayer market" },
  { id: "rare-pop", readKind: "rarity-band", name: "POP Series 5", receipt: { set: "POP Series 5" }, headline: "Holo Rare: 1 up, 2 down.", asOf: "2026-10-13", source: "TCGplayer market" },
  { id: "art", readKind: "artist-band", name: "Ken Sugimori", receipt: { artist: "Ken Sugimori" }, headline: "Ken Sugimori: 4 up, 1 down.", asOf: "2026-10-13", source: "TCGplayer market, artist from the card file" },
  { id: "cycle", readKind: "release-cycle", name: "POP Series 5", headline: "POP Series 5 release cycle is on file.", asOf: "2026-10-13", source: "sets.json" },
  { id: "other", readKind: "single", name: "Pikachu", set: "POP Series 5", number: "002/017", href: "/c/tcgcsv-2", image: "https://catchemtcg.com/data/editor/tcg/pop5/2_hires.png", price: 4 },
];
const html = readSheet(read, {
  meta: { rarity: "Holo Rare", artist: "Ken Sugimori", num: "001/017", set: "POP Series 5", setSlug: "pop-series-5" },
  logo: "/img/pop5/logo.png",
  rotation: { mark: "H", status: "Standard", asOf: "2026-08-24" },
  reads: peers,
});
t("hero has the photo, number, logo, rarity, artist, and NM price", html.includes("rd-face") && html.includes(">Ho-Oh<") && html.includes("001/017") && html.includes("/img/pop5/logo.png") && html.includes("Holo Rare") && html.includes("Ken Sugimori") && html.includes("NM $35.00"));
t("eBay ask keeps its condition", html.includes("eBay ask $40.00 (any condition), Oct 13, 2026"));
t("chips scroll and keep the dated changes", html.includes("rd-chips") && html.includes("30-day +12.5%, Sep 12, 2026 to Oct 13, 2026") && html.includes("Mark H · Standard, as of Aug 24, 2026") && html.includes("Holo") && html.includes("eBay ask is $5.00 above the TCGplayer price"));
t("pattern sentence uses the gate numbers", patternSentence(read).text === "This pattern was right 55.7% of the time vs 45% normally, over 509 cases, looking 30 days ahead." && html.includes("Held in every era on file"));
t("staircase stays off until it passes", patternSentence({ receipt: { pattern: "staircase", stage: "forming", gate: { n: 10, horizon: 30, rate: 40, baseRate: 20 } } }) === null);
t("context cards and a similar thumbnail", html.includes("Set momentum") && html.includes("Rarity band") && html.includes("Artist band") && html.includes("Release cycle") && html.includes("Similar cards") && html.includes("002/017"));
t("a thin read draws nothing", readSheet({ id: "x" }) === "");
t("sheet copy stays clean", !/[\u2014\u2013]/.test(html) && !BANNED.test(html.replace(/<[^>]+>/g, " ")) && !/No data/i.test(html));

const page = renderFeed({ reads: [read, ...peers] }, read.id, "", { feed: true, page: "read", readYear: { id: read.id, html: "", meta: { artist: "Ken Sugimori", rarity: "Holo Rare", num: "001/017" } } });
t("the read page keeps Back, Track, and the sheet", page.includes(">Back<") && page.includes(">Track<") && page.includes('id="read-sheet"') && page.includes("NM $35.00"));
const chart = readFileSync(new URL("../src/history-chart.mjs", import.meta.url), "utf8");
t("backfill is a soft line and own days stay solid", chart.includes('p[2]==="f"') && chart.includes("stroke-opacity=\"'+op+'\"") && chart.includes('snap==="real"') && !/stroke-opacity="\.22"|Faded stretches|Missing days show as gaps/.test(chart));
try { new vm.Script(chart.match(/export const HISTORY_JS = `([\s\S]*)`;/)[1]); t("chart script parses", true); }
catch (err) { t("chart script parses", false); console.error(err.message); }

if (fail) { console.log(`${fail} failed`); process.exit(1); }
console.log("read sheet ok");
