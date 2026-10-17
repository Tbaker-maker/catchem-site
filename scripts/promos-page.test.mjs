import assert from "node:assert/strict";
import vm from "node:vm";
import { pageKind } from "../src/index.mjs";
import { renderPromos } from "../src/promos.mjs";
import { pageChrome } from "../src/ui.mjs";
import { describePage } from "../src/seo.mjs";

assert.equal(pageKind("/promos"), "promos");
const page = pageChrome("Promos", renderPromos(), "Promos", "Updated Oct 17, 2026", "", true);
assert.ok(page.includes('href="/promos"'), "nav links promos");
assert.ok(page.includes('aria-label="Art type"'), "art chips");
assert.ok(page.includes('aria-label="Source product"'), "source chips");
assert.ok(page.includes(">Sealed promos<"), "sealed tab");
assert.ok(page.includes('id="promo-count"'), "count line");
assert.ok(page.includes('id="promo-more"'), "show more");
assert.ok(page.includes("shown=48"), "first page is 48");
assert.ok(!page.includes("Near Mint") && !/\bNM\b/.test(page.slice(page.indexOf("promo-page"))), "no condition label");
assert.equal(describePage("promos"), "Every priced Pokémon TCG promo, with the TCGplayer market price and the art type.");
for (const m of page.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
  if (/application\/(ld\+)?json/.test(m[1])) continue;
  let code = m[2];
  if (/^\s*[\[{]/.test(code)) continue;
  if (/type=["']module["']/.test(m[1])) code = "(async()=>{" + code.replace(/^\s*import\s[^;]+;\s*$/gm, "") + "\n})";
  new vm.Script(code);
}
const min = [...page.matchAll(/min-height:44px/g)];
assert.ok(min.length >= 1, "chip tap target");
console.log("promos page ok");
