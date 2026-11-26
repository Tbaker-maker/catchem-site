// Held prices, condition labels, and the price row must stay inside the page.
import { readFileSync } from "node:fs";
import { banGuard } from "../src/advice-rules.mjs";
import { renderCard, isVolumeRow } from "../src/ui.mjs";

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

// Live sweep Nov 25: Charizard ex 199/165 was held, and its Release cycle block still printed $279.99.
const cycleArt = '<div class="rchips"><a class="rchip past" href="/rotation"><span>Rotated Apr 10, 2026</span></a></div><section class="ircy" aria-label="Release cycle"><h2>Release cycle</h2><dl><dt>Price</dt><dd>$279.99 on Nov 25, 2026, TCGplayer market</dd><dt>30 days</dt><dd>Down 5%: $294.42 (Oct 26, 2026) to $279.99 (Nov 25, 2026)</dd></dl></section>';
const rotationChip = '<a class="rchip past" href="/rotation"><span>Rotated Apr 10, 2026</span></a>';
const charizard = renderCard({
  id: "tcgcsv-517045",
  name: "Charizard ex - 199/165",
  kind: "single",
  set: "SV: Scarlet & Violet 151",
  price: null,
  priceStatus: "checking",
  asOf: "2026-11-25",
  source: "TCGplayer market",
}, "stamp", { priceHeld: true, rotationHtml: cycleArt + rotationChip, rotationFact: rotationChip, cycleHtml: cycleArt });
t("a held page prints no price in the release cycle block", charizard.includes("Price being checked") && !charizard.includes("$279.99") && !charizard.includes("$294.42"));
t("a held page keeps its rotation chip", charizard.includes("Rotated Apr 10, 2026"));
const unheld = renderCard({ id: "tcgcsv-517045", name: "Charizard ex - 199/165", kind: "single", set: "SV: Scarlet & Violet 151", price: 279.99, asOf: "2026-11-25", source: "TCGplayer market" }, "stamp", { rotationHtml: cycleArt + rotationChip, rotationFact: rotationChip, cycleHtml: cycleArt });
t("a priced page keeps its release cycle block", unheld.includes("Release cycle") && unheld.includes("$294.42"));

// Live sweep Nov 25 (latent): feed volume rows print "Near Mint" with no sealed guard.
const volumeRow = { readKind: "volume", href: "/c/tcgcsv-1", headline: "5 Near Mint copies on TCGplayer in 30 days.", sold: { source: "TCGplayer sales via PokemonPriceTracker", condition: "Near Mint", count30d: 5, window30d: { from: "2026-10-26", to: "2026-11-25" } } };
t("a card volume row is a volume row (fixture sanity)", isVolumeRow(volumeRow));
t("a sealed product never gets a Near Mint volume row", !isVolumeRow({ ...volumeRow, href: "/p/tcgcsv-2" }) && !isVolumeRow({ ...volumeRow, itemKind: "sealed" }) && !isVolumeRow({ ...volumeRow, sealed: true }));

if (fail) process.exit(1);
console.log("price hold ok");
