import { readFileSync } from "node:fs";
import { isFactRow, splitDated, keepFeedRead, feedFilterOptions } from "../src/ui.mjs";

const src = readFileSync(new URL("../src/ui.mjs", import.meta.url), "utf8");
const code = src.slice(src.indexOf("const NUM_LABELS="), src.indexOf("function productIdOf(card){"));
const html = (s) => String(s ?? "");
const money = (n) => (Number(n) > 0 ? "$" + Number(n).toFixed(2) : "");
const api = new Function("html", "money", code + "\nreturn { numbersBlock: numbersBlock, readChartHtml: readChartHtml };")(html, money);
const numbersBlock = api.numbersBlock;
const readChartHtml = api.readChartHtml;

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail += 1; console.error("  FAIL", name); }
};

const spread = {
  id: "spread-rsv10pt5-wf-pc-etb",
  readKind: "spread",
  kind: "spread",
  name: "White Flare Pokemon Center Elite Trainer Box",
  asOf: "2026-10-11",
  sourceLine: "rsv10pt5-wf-pc-etb",
  whyItMatters: "The high ask is $484.32. The low ask is $230.00.",
  whatWouldMakeThisWrong: "Wrong if the receipt prices are not the ones on those dates.",
  receipt: { low: 230, high: 484.32, median: 275.65, count: 55, basis: "p10-p90" },
};
const askmove = {
  id: "askmove-swsh12pt5-etb",
  readKind: "askmove",
  kind: "askmove",
  asOf: "2026-10-11",
  sourceLine: "swsh12pt5-etb",
  why: "Up $1.99 on the ask.",
  whatWouldMakeThisWrong: "Wrong if the receipt prices are not the ones on those dates.",
  receipt: { from: "2026-10-10", to: "2026-10-11", askFrom: 333, askTo: 334.99, market: 320.44 },
};
const mover = {
  id: "mover-tcgcsv-175275",
  readKind: "mover",
  kind: "mover",
  source: "TCGplayer market",
  sourceLine: "tcgcsv-175275",
  startDate: "2026-10-03",
  endDate: "2026-10-10",
  fromPrice: 10.6,
  toPrice: 22.93,
  price: 22.93,
  take: "up",
  whyItMatters: "Up $12.33 on those two dates.",
  whatWouldMakeThisWrong: "Wrong if either date has a different market price.",
};
const streak = {
  id: "streak-tcgcsv-178818",
  readKind: "streak",
  kind: "streak",
  source: "TCGplayer market",
  sourceLine: "tcgcsv-178818",
  startDate: "2026-10-05",
  endDate: "2026-10-11",
  fromPrice: 13.66,
  toPrice: 63.86,
  whyItMatters: "Up $50.20 on those two dates.",
  whatWouldMakeThisWrong: "Wrong if a day in the run is missing or a step went the other way.",
  run: [
    ["2026-10-05", 13.66],
    ["2026-10-06", 14.07],
    ["2026-10-07", 15.13],
    ["2026-10-08", 19.24],
    ["2026-10-09", 23.07],
    ["2026-10-10", 54.16],
    ["2026-10-11", 63.86],
  ],
};
const mktmove = {
  id: "mktmove-x",
  readKind: "mktmove",
  kind: "mktmove",
  sourceLine: "mkt-1",
  whyItMatters: "Down $1.00 on the market price.",
  whatWouldMakeThisWrong: "Wrong if the receipt prices are not the ones on those dates.",
  receipt: { from: "2026-10-06", to: "2026-10-07", marketFrom: 5.73, marketTo: 4.5, ask: 10.25 },
};

for (const card of [spread, askmove, mover, streak, mktmove]) {
  const html = numbersBlock(card);
  t(`${card.readKind} renders the numbers block`, html.includes("<h4>The numbers</h4>"));
  t(`${card.readKind} shows why`, html.includes("<b>Why.</b>"));
  t(`${card.readKind} shows what would make this wrong`, html.includes("<b>What would make this wrong.</b>"));
  t(`${card.readKind} shows sourceLine`, html.includes(`class="source-line">${card.sourceLine}`));
}
t("spread shows ask low, high, median, and listing count", numbersBlock(spread).includes("$230.00") && numbersBlock(spread).includes("$484.32") && numbersBlock(spread).includes("$275.65") && numbersBlock(spread).includes("Listing count") && numbersBlock(spread).includes(">55<") === false && numbersBlock(spread).includes("55"));
t("spread names eBay asks", numbersBlock(spread).includes("eBay asks"));
t("spread has no chart", readChartHtml(spread) === "");
t("askmove shows both ask dates and the market price", numbersBlock(askmove).includes("$333.00") && numbersBlock(askmove).includes("$334.99") && numbersBlock(askmove).includes("$320.44") && numbersBlock(askmove).includes("2026-10-10") && numbersBlock(askmove).includes("TCGplayer market"));
t("askmove chart marks both dates and hides ranges without two points", readChartHtml(askmove).includes('data-marks="2026-10-10,2026-10-11"') && readChartHtml(askmove).includes('data-range="All"') && !readChartHtml(askmove).includes('data-range="30D"'));
t("mover shows the take label and footer", numbersBlock(mover).includes("Looks like a buy") && numbersBlock(mover).includes("A take is our read of the numbers, not advice.") && numbersBlock(mover).indexOf("Looks like a buy") < numbersBlock(mover).indexOf("The numbers"));
t("mover shows start and end", numbersBlock(mover).includes("$10.60") && numbersBlock(mover).includes("$22.93") && numbersBlock(mover).includes("2026-10-03"));
t("a missing day is not one segment", splitDated([{ date: "2026-10-03", ask: 10.6 }, { date: "2026-10-10", ask: 22.93 }], "ask").length === 2);
t("streak lists every day", ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"].every((day) => numbersBlock(streak).includes(day)));
t("a read with no chart data shows no chart", readChartHtml({ whyItMatters: "Only a sentence.", whatWouldMakeThisWrong: "Wrong if the sentence is not the one on file.", sourceLine: "none" }) === "");
t("no take is invented", !numbersBlock(spread).includes("Looks like a buy") && !numbersBlock(spread).includes("Watch"));
t("a missing why is not invented", !numbersBlock({ sourceLine: "tcgcsv-1", price: 2, asOf: "2026-10-11", source: "TCGplayer market" }).includes("<b>Why.</b>"));
const hidden = feedFilterOptions(false).map((row) => row[0]);
t("sold filters stay hidden without a sold file", ["volume", "quiet", "mix", "soldflat", "solddown"].every((value) => !hidden.includes(value)) && hidden.includes("still") && hidden.includes("conditions"));
t("one sold file shows those filters", ["volume", "quiet", "mix", "soldflat", "solddown"].every((value) => feedFilterOptions(true).some((row) => row[0] === value)));
t("a fact with no source does not render", !isFactRow({ readKind: "pokemon", kind: "pokemon", name: "Duraludon", cardCount: 19, artistCount: 12, dex: 884, headline: "Duraludon (#884): 19 cards, 12 artists." }));
t("a fact with a source does render", isFactRow({ readKind: "pokemon", kind: "pokemon", name: "Duraludon", cardCount: 19, artistCount: 12, dex: 884, headline: "Duraludon (#884): 19 cards, 12 artists.", source: "pokemontcg.io", date: "2026-09-28" }));
t("a receipt spread stays without the honesty clause", keepFeedRead({ ...spread, headline: "White Flare asks.", path: "White Flare asks." }) && keepFeedRead({ ...askmove, headline: "Crown Zenith ask.", path: "Crown Zenith ask." }));

if (fail) {
  console.error(fail + " failed");
  process.exit(1);
}
console.log("long-read ok");
