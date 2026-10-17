import assert from "node:assert/strict";
import { artType } from "../src/art-type.mjs";
import { renderCard, renderSearch, renderSetShell } from "../src/ui.mjs";

assert.equal(artType({ rarity: "Illustration Rare", num: "1/100", printing: "Holofoil" }), "Illustration Rare");
assert.equal(artType({ rarity: "Common", num: "1/100", printing: "Normal", tags: ["Reverse Holo"] }), "Regular");
assert.equal(artType({ kind: "sealed", name: "Promo Pack" }), "");

const set = renderSetShell("sv08-surging-sparks", "Updated Oct 17, 2026");
assert.ok(set.includes('id="art-chips"'), "set page has art chips");
assert.ok(set.includes('data-art=""'), "All is the default chip");
assert.ok(set.includes("Special Illustration Rare"), "set page lists the art types");
assert.ok(set.includes("function artType"), "art type is computed on the page");
assert.equal((set.match(/id="art-chips"/g) || []).length, 1);

const search = renderSearch({});
assert.ok(search.includes('id="art-chips"'), "search has art chips");
assert.ok(search.includes("or an art type"), "search can start from an art type");

const single = renderCard({ id: "tcgcsv-1", name: "Pikachu", kind: "single", rarity: "Illustration Rare", num: "170/165", printing: "Holofoil", set: "Test", price: 12, asOf: "2026-10-17", hist: [["2026-10-01", 10], ["2026-10-17", 12]] }, "stamp", {});
assert.ok(single.includes('class="artchip"') && single.includes("Illustration Rare"), "item page shows the art chip");
const sealed = renderCard({ id: "tcgcsv-2", name: "Booster Box", kind: "sealed", subtype: "booster-box", price: 100, asOf: "2026-10-17", hist: [["2026-10-01", 90], ["2026-10-17", 100]] }, "stamp", {});
assert.ok(!sealed.includes('class="artchip"'), "sealed pages do not show an art chip");
assert.ok(!/\bNM\b/.test(sealed.replace(/<script[\s\S]*?<\/script>/g, " ")), "sealed render stays free of NM");
console.log("art type ui ok");
