import assert from "node:assert/strict";
import vm from "node:vm";
import { pageKind, renderPath } from "../src/index.mjs";
import { resetJsonCache } from "../src/data.mjs";
import { renderPromos } from "../src/promos.mjs";
import { pageChrome } from "../src/ui.mjs";
import { describePage } from "../src/seo.mjs";

assert.equal(pageKind("/promos"), "promos");
const page = pageChrome("Promos", renderPromos(), "Promos", "Updated Oct 17, 2026", "", true);
assert.ok(page.includes('href="/promos"'), "nav links promos");
assert.ok(page.includes('aria-label="Illustration style"'), "illustration style chips");
assert.ok(page.includes('aria-label="Popular Pokemon"'), "popular pokemon chips");
assert.ok(page.includes('aria-label="Source product"'), "source chips");
assert.ok(page.includes("b.hidden"), "empty chips hide");
assert.ok(page.includes('loading="lazy"'), "lazy images");
assert.ok(page.includes("overflow-x:clip"), "no sideways scroll");
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

resetJsonCache();
const fetchImpl = async (url) => {
  const u = String(url);
  const send = (payload) => new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
  if (u.endsWith("/research/assets/public/counts.json")) return send({ asOf: "2026-10-13", updatedAt: "2026-10-13T12:00:00Z" });
  if (u.endsWith("/research/assets/public/feed/status.json")) return send({ images: { tcgplayer: false } });
  if (u.endsWith("/research/assets/public/catalogue-images.json")) return send({ images: {} });
  return new Response("no", { status: 404 });
};
const routed = await renderPath("/promos", fetchImpl, {});
const routedHtml = await routed.text();
assert.equal(routed.status, 200);
assert.ok(routedHtml.includes("<title>Promos") || routedHtml.includes("<h1") && /Promos/i.test(routedHtml), "route renders Promos, not 404");
assert.ok(!/Page not found|This page is not here/i.test(routedHtml), "route is not the 404 page");

console.log("promos page ok");

