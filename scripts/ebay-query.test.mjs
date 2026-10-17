// eBay search link format. Links must read like a seller's listing title so
// they find listings: Pokemon + card name + number as printed + short set
// (singles), Pokemon + set + product type (sealed). No quotes, at most
// -proxy -custom, number once, affiliate params intact.
import assert from "node:assert/strict";
import { ebayQuery, ebaySearchUrl } from "../src/pokemon.mjs";
import { renderSearch } from "../src/ui.mjs";

const q = (name, set, num, kind = "single") => ebayQuery({ name, set, num, kind });
const cases = [
  [["Eevee - 11/12", "McDonald's Promos 2018", "011/012"], "Pokemon Eevee 11/12 McDonald's 2018 -proxy -custom"],
  [["Umbreon VMAX (Alternate Art Secret)", "Evolving Skies", "215/203"], "Pokemon Umbreon VMAX 215/203 Evolving Skies -proxy -custom"],
  [["Duosion - 119/086", "SV: Black Bolt", "119/086"], "Pokemon Duosion 119/086 Black Bolt -proxy -custom"],
  [["Misty's Seel", "Gym Heroes", "088/132"], "Pokemon Misty's Seel 88/132 Gym Heroes -proxy -custom"],
  [["Tapu Koko V", "SWSH01: Sword & Shield Base Set", "072/202"], "Pokemon Tapu Koko V 072/202 Sword Shield -proxy -custom"],
  [["Blaziken VMAX", "SWSH12: Silver Tempest Trainer Gallery", "TG15/TG30"], "Pokemon Blaziken VMAX TG15/TG30 Silver Tempest -proxy -custom"],
  [["Eevee", "SWSH: Sword & Shield Promo Cards", "SWSH190"], "Pokemon Eevee SWSH190 Promo -proxy -custom"],
  [["Melmetal - SM181 (Prerelease)", "SM Promos", "SM181"], "Pokemon Melmetal Prerelease SM181 Promo -proxy -custom"],
  [["Desert Ruins - 2005 (Michael Gonzalez)", "World Championship Decks", "88/101"], "Pokemon Desert Ruins 2005 World Championship -proxy -custom"],
  [["Staryu", "Base Set (Shadowless)", "065/102"], "Pokemon Staryu 65/102 Base Set Shadowless -proxy -custom"],
  [["Battle Styles Booster Box", "SWSH05: Battle Styles", "", "sealed"], "Pokemon Battle Styles Booster Box"],
  [["Elite Trainer Box [Groudon]", "XY - Primal Clash", "", "sealed"], "Pokemon Primal Clash Elite Trainer Box Groudon"],
  [["Evolving Skies Elite Trainer Box [Set of 2]", "SWSH07: Evolving Skies", "", "sealed"], "Pokemon Evolving Skies Elite Trainer Box"],
  [["Surging Sparks Booster Bundle", "SV08: Surging Sparks", "", "sealed"], "Pokemon Surging Sparks Booster Bundle"],
];
for (const [args, want] of cases) assert.equal(q(...args), want);

// Rules that hold for every query.
const all = cases.map(([args]) => q(...args));
for (const s of all) {
  assert.ok(!/["\u201c\u201d]/.test(s), `no quotes: ${s}`);
  assert.ok(!/[\u2014\u2013]/.test(s), `no em dashes: ${s}`);
  assert.ok(!/\s-\s/.test(s), `no " - " suffix left: ${s}`);
  assert.ok(!/tcgcsv/i.test(s));
  const minus = s.match(/(^|\s)-\S+/g) || [];
  assert.ok(minus.every((m) => /^\s?-(proxy|custom)$/.test(m)) && minus.length <= 2, `only -proxy -custom: ${s}`);
  const nums = s.split(" ").filter((w) => /\d+\/\d+/.test(w));
  assert.ok(nums.length <= 1, `number once: ${s}`);
}
assert.ok(!/011/.test(all[0]) && (all[0].match(/11\/12/g) || []).length === 1, "Eevee number appears once, as printed");

// Search page inlines the builder with toString(); it must stand alone.
const inlined = new Function(`return ${ebayQuery.toString()}`)();
for (const [args, want] of cases) assert.equal(inlined({ name: args[0], set: args[1], num: args[2], kind: args[3] || "single" }), want);
assert.ok(renderSearch({}).includes("const ebayQuery=function ebayQuery(card)"));

// Affiliate params stay on the link.
const url = ebaySearchUrl({ name: "Eevee - 11/12", set: "McDonald's Promos 2018", num: "011/012", kind: "single" }, { epn: "5339000000" });
assert.equal(url, "https://www.ebay.com/sch/i.html?_nkw=Pokemon%20Eevee%2011%2F12%20McDonald's%202018%20-proxy%20-custom&mkcid=1&mkrid=711-53200-19255-0&siteid=0&campid=5339000000&toolid=10001&mkevt=1");
console.log("ebay query ok");
