// Held prices, condition labels, and the price row must stay inside the page.
import { readFileSync } from "node:fs";
import { banGuard } from "../src/advice-rules.mjs";
import { renderCard } from "../src/ui.mjs";

const PAGE = { skipKinds: ["house"] };
const ban = banGuard("price hold", null, PAGE);
let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.log("  FAIL", name); }
};

const css = readFileSync(new URL("../src/ui.mjs", import.meta.url), "utf8");
const priceCss = (css.match(/\.cp-price\{[^}]+\}/) || [""])[0];
const pageCss = (css.match(/\.card-page\{[^}]+\}/) || [""])[0];
t("price row wraps and the card page clips overflow", priceCss.includes("flex-wrap:wrap") && priceCss.includes("white-space:normal") && priceCss.includes("min-width:0") && !priceCss.includes("nowrap") && pageCss.includes("overflow-x:clip"));

const espeon = renderCard({
  id: "tcgcsv-85316",
  name: "Espeon (1)",
  kind: "single",
  set: "Neo Discovery",
  num: "01/75",
  price: 237.5,
  priceStatus: "checking",
  asOf: "2026-10-17",
  printing: "1st Edition Holofoil",
  printings: [
    { name: "1st Edition Holofoil", price: 237.5, asOf: "2026-10-17" },
    { name: "Unlimited Holofoil", price: 365.17, asOf: "2026-10-17" },
  ],
  source: "TCGplayer market",
}, "stamp", {
  fact: { price: 237.5, asOf: "2026-10-17" },
  allReads: [{ id: "deep-slump-tcgcsv-85316", headline: "Tonight (Oct 17): $237.50 NM.", lines: ["Tonight (Oct 17): $237.50 NM."] }],
  priceCheck: true,
});
t("Espeon shows Price being checked", espeon.includes("Price being checked") && !espeon.includes("$237.50") && !espeon.includes("NM $") && !espeon.includes("Unverified"));
t("Espeon keeps the two printing names and hides both dollars", espeon.includes("1st Edition Holofoil") && espeon.includes("Unlimited Holofoil") && !espeon.includes("$365.17"));
t("a held read line with a dollar is dropped", !espeon.includes("Tonight"));

const mp = renderCard({
  id: "tcgcsv-9",
  name: "Played",
  kind: "single",
  set: "Test",
  price: 12,
  condition: "MP",
  asOf: "2026-10-17",
  printing: "Holofoil",
  source: "TCGplayer market",
}, "stamp", {});
t("an MP price says MP and never NM", mp.includes("MP $12.00") && !mp.includes("NM $"));

const sealed = renderCard({
  id: "tcgcsv-2",
  name: "Booster Box",
  kind: "sealed",
  set: "Test",
  price: 100,
  condition: "NM",
  asOf: "2026-10-17",
  source: "TCGplayer market",
  hist: [["2026-10-16", 90], ["2026-10-17", 100]],
}, "stamp", {});
t("a sealed product never says NM", !/\bNM\b|Near Mint/.test(sealed) && sealed.includes("$100.00"));

const pair = renderCard({
  id: "tcgcsv-8",
  name: "Split",
  kind: "single",
  set: "Base Set",
  price: 90,
  asOf: "2026-10-17",
  printing: "1st Edition",
  printings: [
    { name: "1st Edition", price: 90, asOf: "2026-10-17" },
    { name: "Unlimited", price: 40, asOf: "2026-10-17" },
  ],
  source: "TCGplayer market",
}, "stamp", {});
t("1st Edition and Unlimited stay separate when published", pair.includes("1st Edition") && pair.includes("Unlimited") && pair.includes("$90.00") && pair.includes("$40.00") && !pair.includes("NM $"));

const phrase = "Price being checked";
t("the checking phrase passes the copy rules", phrase === "Price being checked" && !/[\u2014\u2013]/.test(phrase) && !ban.test(phrase) && !ban.test(espeon.replace(/<[^>]+>/g, " ")));

if (fail) process.exit(1);
console.log("price hold ok");
