// Variant tag chips. Imported by rebuild.test.mjs so CI runs it.
import assert from "node:assert/strict";
import { renderCard, renderSearch, renderSetShell } from "../src/ui.mjs";
const card = { id: "tcgcsv-487086", name: "Fidough - 213/198", num: "213/198", kind: "single", rarity: "Illustration Rare", tags: ["Illustration Rare", "Reverse Holo"], price: 24.37, hist: [], set: "SV01: Scarlet & Violet Base Set", setSlug: "sv01-scarlet-violet-base-set", asOf: "2026-10-12", source: "TCGplayer market" };
const page = renderCard(card, "2026-10-12", {});
assert.ok(page.includes('class="vchips"') && page.includes('href="/search?tag=Illustration%20Rare"'), "card page shows rounded variant chips that link to search");
assert.ok(!renderCard({ ...card, tags: undefined }, "2026-10-12", {}).includes('class="vchips"'), "untagged card shows no chips");
assert.ok(renderSearch({}).includes('id="vtag"') && renderSearch({}).includes("Trainer Gallery"), "search has a variant filter");
assert.ok(renderSetShell("x", "2026-10-12", {}).includes('id="vtag"'), "set page has a variant filter");
assert.ok(/\.vchip\{[^}]*border-radius:999px/.test(page), "chips are rounded");
console.log("variant chip tests passed");
import { renderFeed } from "../src/ui.mjs";
{
  const feed = renderFeed({ asOf: "2026-10-12", reads: [] }, "", "", {});
  assert.ok(feed.includes("card.tags||[]") && feed.includes('class="vchips sm"'), "feed read cards draw variant chips");
  const s = renderSearch({});
  assert.ok(s.includes('row srow') && /@media\(max-width:480px\)\{\.srow\{flex-wrap:wrap/.test(s) && s.includes(".srow>svg.spark30"), "search rows wrap and drop the mini chart on phones");
  console.log("feed and search chip tests passed");
}
import "./variant-row.test.mjs";
