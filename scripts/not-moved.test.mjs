import assert from "node:assert/strict";
import { notMovedBlock, NOT_MOVED_LABEL } from "../src/features.mjs";
import { keepFeedRead, isBoardV3Row } from "../src/ui.mjs";

const entry = { from: 10, to: 20, start: "2026-10-05", end: "2026-10-12", lagging: [
  { id: "tcgcsv-100618", name: "M Sceptile EX", number: "8/98", set: "XY - Ancient Origins", from: 24.08, to: 24.16, start: "2026-10-05", end: "2026-10-12" },
] };
const html = notMovedBlock(entry, { images: {} });
assert.ok(html.includes(NOT_MOVED_LABEL), "label shown");
assert.ok(html.includes("Similar cards that have not moved yet. A take, not a rule."));
assert.ok(html.includes("$24.16, was $24.08") && html.includes("Oct 5 to Oct 12"), "price, change and dates");
assert.ok(html.includes("/api/card-img?pid=100618"), "TCGplayer photo by id in the chain");
assert.ok(html.includes('href="/c/tcgcsv-100618"'));
assert.ok(!/\bplay\b|[\u2014\u2013]/i.test(html), "no banned word, no em dash");
assert.equal(notMovedBlock({ ...entry, lagging: [] }), "", "hidden when none");
assert.equal(notMovedBlock(null), "", "hidden when no entry");
assert.equal(notMovedBlock({ ...entry, lagging: Array.from({ length: 9 }, (_, i) => ({ ...entry.lagging[0], id: `tcgcsv-${i + 1}` })) }).match(/nm-card/g).length, 6, "at most 6");
const sealed = notMovedBlock({ ...entry, lagging: [{ id: "swsh9-booster-box", name: "Brilliant Stars Booster Box", from: 200, to: 201, start: "2026-10-05", end: "2026-10-12", pid: 263862 }] }, { sealed: true, pidFor: () => 263862 });
assert.ok(sealed.includes("Similar sealed items that have not moved yet. A take, not a rule.") && sealed.includes('href="/p/swsh9-booster-box"'));

const v3 = { board: "v3", readKind: "newsline", kind: "newsline", headline: "Japan: New deck (Pokémon Card (Japan), Oct 11)", source: "Pokémon Card (Japan), 2026-10-11", asOf: "2026-10-11" };
assert.ok(isBoardV3Row(v3) && keepFeedRead(v3), "board v3 row kept");
assert.ok(!keepFeedRead({ ...v3, source: "" }), "no source, not kept");
assert.ok(!keepFeedRead({ ...v3, headline: "a \u2014 b" }), "em dash dropped");
console.log("not-moved tests passed");

{
  const breadth = { board: "v3", readKind: "breadth", headline: "This week in chase cards: 1 went up.", source: "TCGplayer market, 2026-10-05 and 2026-10-12", asOf: "2026-10-12" };
  const chase = { ...breadth, readKind: "sealedchase", headline: "Box went $1.00 to $2.00 while its top chase card went $3.00 to $3.01." };
  const setRow = { ...breadth, board: "hist", readKind: "set", headline: "Set, about 30 days: 5 of 12 priced cards up 10% or more." };
  const histPrice = { board: "hist", readKind: "year", headline: "One year on: X, $1.00 (Oct 9, 2025) to $5.00 (Oct 12).", price: 5, asOf: "2026-10-12" };
  assert.ok(keepFeedRead(breadth) && keepFeedRead(chase) && keepFeedRead(setRow), "breadth, sealed vs chase and set rows kept");
  assert.ok(keepFeedRead(histPrice), "long-history price row kept");
  assert.ok(!isBoardV3Row({ ...setRow, board: "hist", readKind: "climb" }), "hist tag only admits set rows without a price");
}
