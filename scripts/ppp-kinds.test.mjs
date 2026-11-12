import assert from "node:assert/strict";
import { keepFeedRead, isBoardV3Row } from "../src/ui.mjs";

// PkmnPrices pathway reads (Catchem-data scripts/lib/ppp-reads) are dated board rows.
const kinds = ["sold-gap", "sold-pace", "sold-trend", "sell-through", "msrp-sold", "pop-growth", "gem-rate", "low-pop", "graded-spread", "eu-gap", "jp-en", "range52"];
for (const kind of kinds) {
  const row = { board: "v3", readKind: kind, kind, sku: "tcgcsv-1", href: "/c/tcgcsv-1", headline: "Card: eBay sold median $60.00 across 13 sold comps, Oct 30, 2026 to Nov 11, 2026, against a TCGplayer market of $55.00 on Nov 12, 2026 (+9.1%).", source: "eBay sold comps via PkmnPrices; TCGplayer market, 2026-10-30 to 2026-11-11", asOf: "2026-11-12" };
  assert.ok(isBoardV3Row(row) && keepFeedRead(row), `${kind} row kept`);
  assert.ok(!keepFeedRead({ ...row, source: "" }), `${kind} with no source is not kept`);
}
console.log("ppp kinds tests passed");
