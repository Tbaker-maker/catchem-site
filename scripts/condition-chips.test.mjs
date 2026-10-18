// Condition chips: a price only for that condition and printing. Sealed has none.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { banGuard } from "../src/advice-rules.mjs";
import { renderCard } from "../src/ui.mjs";

const PAGE = { skipKinds: ["house"] };
const ban = banGuard("condition chips", null, PAGE);
let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.log("  FAIL", name); }
};

const css = readFileSync(new URL("../src/ui.mjs", import.meta.url), "utf8");
const rowCss = (css.match(/\.cond-chips\{[^}]+\}/) || [""])[0];
const chipCss = (css.match(/\.cond-chip\{[^}]+\}/) || [""])[0];
t("chip row wraps and clips at 390px", rowCss.includes("flex-wrap:wrap") && rowCss.includes("overflow-x:clip") && rowCss.includes("min-width:0") && chipCss.includes("min-height:44px") && chipCss.includes("border-radius:999px") && chipCss.includes("max-width:100%"));

const ladder = {
  asOf: "2026-10-17",
  source: "TCGplayer market",
  printings: {
    Holofoil: { date: "2026-10-17", NM: 10, LP: 8, MP: 6, HP: 4, DMG: 2 },
  },
};

const modern = renderCard({
  id: "tcgcsv-1",
  name: "Five",
  kind: "single",
  set: "Test",
  price: 99,
  asOf: "2026-10-17",
  printing: "Holofoil",
  printings: [{ name: "Holofoil", price: 99, asOf: "2026-10-17" }],
  source: "TCGplayer market",
}, "stamp", { conditionLadder: ladder });
t("five conditions show their own prices", ["$10.00", "$8.00", "$6.00", "$4.00", "$2.00"].every((n) => modern.includes(n)) && modern.includes(">NM<") && modern.includes(">LP<") && modern.includes(">MP<") && modern.includes(">HP<") && modern.includes(">DMG<"));
t("headline defaults to NM", modern.includes("cp-cond-label") && modern.includes(">NM<") && modern.includes('aria-pressed="true"') && modern.includes("$10.00") && !modern.includes("$99.00"));
const tap = (modern.match(/aria-label="Where this number comes from: ([^"]+)"/) || [])[1] || "";
t("info tap is the source and the date", tap === "TCGplayer market, Oct 17" && !modern.includes("threshold") && !/[\u2014\u2013]/.test(modern));

const nmOnly = renderCard({
  id: "tcgcsv-2",
  name: "Mint",
  kind: "single",
  set: "Test",
  price: 3,
  asOf: "2026-10-17",
  printing: "Normal",
  source: "TCGplayer market",
}, "stamp", { conditionLadder: { asOf: "2026-10-17", printings: { Normal: { date: "2026-10-17", NM: 3 } } } });
t("NM only shows that chip", nmOnly.includes("$3.00") && nmOnly.includes(">NM<") && !nmOnly.includes(">LP<") && !nmOnly.includes("Price being checked"));

const played = renderCard({
  id: "tcgcsv-3",
  name: "Played vintage",
  kind: "single",
  set: "Base",
  price: 30,
  asOf: "2026-10-17",
  printing: "Holofoil",
  source: "TCGplayer market",
}, "stamp", {
  conditionLadder: { asOf: "2026-10-17", printings: { Holofoil: { date: "2026-10-17", LP: 12, MP: 7 } } },
  allReads: [{ id: "r1", headline: "Night $4.00 NM.", lines: ["Night $4.00 NM."] }],
});
t("LP and MP show and NM is not filled in", played.includes("$12.00") && played.includes("$7.00") && played.includes(">LP<") && !played.includes("NM $") && !played.includes("$30.00"));
t("a read drops NM when NM has no price", !played.includes("$4.00 NM") && !played.includes("NM."));

const heldPlayed = renderCard({
  id: "tcgcsv-85316",
  name: "Espeon (1)",
  kind: "single",
  set: "Neo Discovery",
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
  conditionLadder: { asOf: "2026-10-17", printings: { "1st Edition Holofoil": { date: "2026-10-17", LP: 12, MP: 7 } } },
  priceCheck: true,
});
t("a held vintage card says the checking line once and has no chips", (heldPlayed.match(/Price being checked/g) || []).length === 1 && !heldPlayed.includes('class="cond-chip"') && heldPlayed.includes("1st Edition Holofoil") && heldPlayed.includes("Unlimited Holofoil") && heldPlayed.includes("Buy on TCGplayer") && heldPlayed.includes("Buy on eBay") && !heldPlayed.includes("$12.00") && !heldPlayed.includes("$237.50") && !heldPlayed.includes("$365.17") && !heldPlayed.includes("NM $"));

const plain = renderCard({
  id: "tcgcsv-87428",
  name: "Mewtwo ex",
  kind: "single",
  set: "EX Ruby and Sapphire",
  price: 677.43,
  asOf: "2026-10-17",
  printing: "Holofoil",
  source: "TCGplayer market",
}, "stamp", { conditionLadder: { asOf: "2026-10-17", source: "TCGplayer market", printings: {} } });
t("a modern card with no conditions shows the market dollar and no chips", plain.includes("$677.43") && plain.includes("TCGplayer market") && !plain.includes('class="cond-chip"') && !plain.includes("Price being checked") && !/\bNM\b/.test(plain));

const unverified = renderCard({
  id: "tcgcsv-11",
  name: "Odd",
  kind: "single",
  set: "Test",
  price: 50,
  priceStatus: "checking",
  asOf: "2026-10-17",
  printing: "Holofoil",
  printings: [{ name: "Holofoil", price: 50, asOf: "2026-10-17" }],
  source: "TCGplayer market",
}, "stamp", { priceHeld: true, conditionLadder: { asOf: "2026-10-17", printings: { Holofoil: { date: "2026-10-17", NM: 50 } } } });
t("a modern unverified card is one checking line and no chips", (unverified.match(/Price being checked/g) || []).length === 1 && !unverified.includes('class="cond-chip"') && !unverified.includes("$50"));

const passed = renderCard({
  id: "tcgcsv-12",
  name: "Charizard",
  kind: "single",
  set: "Base",
  price: 400,
  asOf: "2026-10-17",
  printing: "1st Edition Holofoil",
  source: "TCGplayer market",
}, "stamp", { conditionLadder: { asOf: "2026-10-17", printings: { "1st Edition Holofoil": { date: "2026-10-17", NM: 400 } } } });
t("a vintage card with a passing sample shows that dollar and its chip", passed.includes("$400.00") && passed.includes(">NM<") && passed.includes('class="cond-chip"') && !passed.includes("Price being checked") && !passed.includes(">LP<"));

const split = renderCard({
  id: "tcgcsv-4",
  name: "Split",
  kind: "single",
  set: "Base",
  price: 90,
  asOf: "2026-10-17",
  printing: "1st Edition Holofoil",
  printings: [
    { name: "1st Edition Holofoil", price: 90, asOf: "2026-10-17" },
    { name: "Unlimited Holofoil", price: 40, asOf: "2026-10-17" },
  ],
  source: "TCGplayer market",
}, "stamp", {
  conditionLadder: {
    asOf: "2026-10-17",
    printings: {
      "1st Edition Holofoil": { date: "2026-10-17", NM: 200 },
      "Unlimited Holofoil": { date: "2026-10-17", NM: 40 },
    },
  },
});
t("printings stay on their own chip rows", split.includes("1st Edition Holofoil") && split.includes("Unlimited Holofoil") && split.includes("$200.00") && split.includes("$40.00") && split.split("cond-block").length >= 3);

const sealed = renderCard({
  id: "tcgcsv-5",
  name: "Booster Box",
  kind: "sealed",
  set: "Test",
  price: 100,
  asOf: "2026-10-17",
  source: "TCGplayer market",
}, "stamp", { conditionLadder: ladder });
t("a sealed product has no condition chips", !sealed.includes("cond-chip") && !/\bNM\b|Near Mint/.test(sealed) && sealed.includes("$100.00"));

const script = (modern.match(/<script>\(function\(\)\{\s*var blocks=document\.querySelectorAll\("\.cond-block"\)([\s\S]*?)<\/script>/) || ["", ""])[0].replace(/^<script>/, "").replace(/<\/script>$/, "");
let parsed = false;
try { new vm.Script(script); parsed = script.includes("data-cond"); } catch { parsed = false; }
t("the chip script parses", parsed);

t("chip copy passes the rules", !ban.test(modern.replace(/<[^>]+>/g, " ")) && !ban.test(played.replace(/<[^>]+>/g, " ")));

if (fail) process.exit(1);
console.log("condition chips ok");
