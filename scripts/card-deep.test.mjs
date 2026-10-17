import { withoutShopButtons } from "../src/pokemon.mjs";
// Card page deep bits: only figures already on the card or the read.
import { renderCard } from "../src/ui.mjs";
import { patternSentence } from "../src/read-sheet.mjs";

let fail = 0;
const t = (name, cond) => { console.log(`${cond ? "  ok " : "  FAIL"} ${name}`); if (!cond) fail++; };
const BANNED = /\b(buy|sell|hold|support|resistance|bottom|printed|play|target|invest|stack|load up|crypto|supply)\b/i;

const card = {
  id: "tcgcsv-99",
  name: "Pikachu",
  kind: "single",
  set: "Base Set",
  num: "58/102",
  price: 15,
  asOf: "2026-10-13",
  source: "TCGplayer market",
  hist: [["2026-10-01", 12], ["2026-10-13", 15]],
  printings: [
    { name: "Holofoil", price: 15, asOf: "2026-10-13" },
    { name: "Reverse Holofoil", price: 9.5, asOf: "2026-10-13" },
  ],
};
const pattern = {
  id: "pat",
  sku: "tcgcsv-99",
  asOf: "2026-10-13",
  source: "TCGplayer market",
  receipt: { pattern: "breakout", stage: "confirmed", gate: { n: 509, horizon: 30, rate: 55.7, baseRate: 45 } },
};
const ebay = {
  id: "px",
  prices: [
    { amount: 15, date: "2026-10-13", source: "tcgplayer", condition: "NM" },
    { amount: 18, date: "2026-10-13", source: "ebay", condition: "any condition" },
  ],
};
const html = renderCard(card, "stamp", {
  conditionNote: {
    text: "Graded and damaged copies can price very differently, and our prices are Near Mint unless labeled.",
    asOf: "2026-10-13",
    source: "TCGplayer market daily file is Near Mint.",
  },
  patternRead: pattern,
  priceRead: ebay,
});
t("two printings show price and date", html.includes("Holofoil") && html.includes("Reverse Holofoil") && html.includes("$9.50") && html.includes("Oct 13, 2026") && html.includes("cp-prints"));
t("one printing stays off", !renderCard({ ...card, printings: [{ name: "Normal", price: 15, asOf: "2026-10-13" }] }, "stamp", {}).includes('<ul class="cp-prints"'));
t("condition note keeps the file sentence and date", html.includes("Near Mint unless labeled.") && html.includes("TCGplayer market daily file is Near Mint.") && html.includes("Oct 13, 2026"));
t("pattern sentence is the gate", html.includes(patternSentence(pattern).text) && html.includes("cp-pattern"));
t("eBay ask and the gap stay dated", html.includes("eBay ask $18.00 (any condition), Oct 13, 2026") && html.includes("eBay ask is $3.00 above the TCGplayer price"));
t("a thin card hides the deep bits", !renderCard({ id: "tcgcsv-1", name: "X", kind: "single" }, "stamp", {}).includes('<section class="cp-pattern"') && !renderCard({ id: "tcgcsv-1", name: "X", kind: "single" }, "stamp", {}).includes('<p class="cp-cond"'));
t("sealed page does not grow a single pattern box", !renderCard({ id: "tcgcsv-2", name: "Box", kind: "sealed", price: 10, asOf: "2026-10-13", hist: [["2026-10-01", 10], ["2026-10-13", 11]] }, "stamp", { patternRead: pattern, conditionNote: { text: "nope", asOf: "2026-10-13", source: "x" } }).includes("cp-pattern"));
const main = html.slice(html.indexOf("<main"), html.lastIndexOf("</main>"));
const plain = withoutShopButtons(main).replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");
t("card deep copy stays clean", !/[\u2014\u2013]/.test(main) && !BANNED.test(plain) && !/No data/i.test(plain));

if (fail) { console.log(`${fail} failed`); process.exit(1); }
console.log("card deep ok");
