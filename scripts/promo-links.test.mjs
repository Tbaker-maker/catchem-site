import assert from "node:assert/strict";
import { renderCard } from "../src/ui.mjs";

const promo = {
  id: "tcgcsv-518871",
  name: "Mew ex - 053",
  num: "053",
  rarity: "Promo",
  set: "Scarlet & Violet Promos",
  setSlug: "sv-scarlet-and-violet-promo-cards",
  kind: "single",
  price: 63.74,
  asOf: "2026-10-17",
};
const page = renderCard(promo, "Updated Oct 17, 2026", {
  feed: true,
  comesFrom: { id: "tcgcsv-502005", name: "151 Ultra-Premium Collection" },
});
assert.ok(page.includes("Comes from"), "comes from label");
assert.ok(page.includes('href="/p/tcgcsv-502005"'), "product link");
assert.ok(page.includes("151 Ultra-Premium Collection"), "product name");
assert.ok(page.includes('href="/promos"'), "all promos link");
assert.ok(!page.includes("bulbapedia") && !page.includes("pokemoncenter.com"), "no citation on the page");

const plain = renderCard({ ...promo, rarity: "Promo" }, "Updated", { feed: true });
assert.ok(!plain.includes("Comes from"), "empty link stays hidden");

const sealed = renderCard({
  id: "tcgcsv-502005",
  name: "151 Ultra-Premium Collection",
  kind: "sealed",
  set: "151",
  setSlug: "sv-scarlet-and-violet-151",
  price: 780.03,
  asOf: "2026-10-17",
}, "Updated Oct 17, 2026", {
  feed: true,
  promosInside: [{ id: "tcgcsv-518871", name: "Mew ex - 053", num: "053" }],
});
assert.ok(sealed.includes("Promos inside"), "promos inside");
assert.ok(sealed.includes('href="/c/tcgcsv-518871"'), "card link");
assert.ok(!/\bNM\b/.test(sealed) && !sealed.includes("Near Mint"), "no NM on sealed");

const emptySealed = renderCard({
  id: "tcgcsv-1",
  name: "Booster Box",
  kind: "sealed",
  price: 100,
  asOf: "2026-10-17",
}, "Updated", { feed: true, promosInside: [] });
assert.ok(!emptySealed.includes("Promos inside"), "empty section hides");
console.log("promo links ok");
