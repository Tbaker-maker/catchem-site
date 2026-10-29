import { readFileSync } from "node:fs";
import { flagLine } from "../src/advice-rules.mjs";
import { buildVariantTracker, variantSummaryLine, renderVariants, handleVariantTracker } from "../src/variant-tracker.mjs";
import { pageKind } from "../src/index.mjs";

let fail = 0;
const t = (name, ok) => { console.log((ok ? "ok   " : "FAIL ") + name); if (!ok) fail++; };

const setDoc = {
  slug: "demo-set",
  name: "Demo Set",
  asOf: "2026-10-28",
  source: "TCGplayer market",
  items: [
    { id: "tcgcsv-1", name: "Alpha", kind: "single", rarity: "Rare", price: 10, printings: [
      { name: "Normal", price: 10, asOf: "2026-10-28", id: "tcgcsv-1" },
      { name: "Reverse Holofoil", price: 4, asOf: "2026-10-28", id: "tcgcsv-11" },
    ] },
    { id: "tcgcsv-2", name: "Beta", kind: "single", rarity: "Common", price: 5, printings: [
      { name: "Normal", price: 5, asOf: "2026-10-28", id: "tcgcsv-2" },
    ] },
    { id: "tcgcsv-9", name: "Box", kind: "sealed", price: 100 },
  ],
};
const holdings = [
  { id: "tcgcsv-1", name: "Alpha", kind: "single", qty: 1, price: 10 },
];

const tracker = buildVariantTracker(setDoc, holdings);
t("tracks every printing", tracker.rows.length === 3 && tracker.rows.filter((r) => r.owned).length === 1);
t("finish groups", tracker.finishes.some((f) => f.finish === "Reverse Holofoil" && f.have === 0 && f.total === 1));
t("sealed separate", tracker.sealed.length === 1 && tracker.sealed[0].owned === false);
t("summary line", /Demo Set/.test(variantSummaryLine(tracker)) && /Cost to finish/.test(variantSummaryLine(tracker)) && !/sold/i.test(variantSummaryLine(tracker)));
t("href", tracker.href === "/variants?set=demo-set");

const src = readFileSync(new URL("../src/variant-tracker.mjs", import.meta.url), "utf8");
t("no em dash", !/[\u2013\u2014]/.test(src));
for (const line of [variantSummaryLine(tracker), "No set on file."]) {
  t("advice: " + line.slice(0, 40), flagLine(line).length === 0);
}


t("page kind", pageKind("/variants") === "variants");
const page = renderVariants("", { set: "demo-set" });
t("variants page shell", page.includes("<h1>Variant tracker</h1>") && page.includes('id="set-slug"') && page.includes('value="demo-set"') && page.includes("/api/collection/variants") && !/[\u2013\u2014]/.test(page));
const api = await handleVariantTracker(new Request("https://catchemtcg.com/api/collection/variants", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ setDoc, holdings }),
}));
const apiBody = await api.json();
t("variants api", api.status === 200 && apiBody.ok && apiBody.tracker.rows.length === 3);

if (fail) { console.error(fail + " failed"); process.exit(1); }
console.log("variant-tracker tests passed");
