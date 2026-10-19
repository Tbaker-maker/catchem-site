// The run stage on the site and in the email comes from signal-chips.json, the
// same tile the bot reads. The site has no stage formula of its own.
import { readFile } from "node:fs/promises";
import { analyze, buildPool } from "../src/reads-article.mjs";
import { stageFromChips, stageLine } from "../src/run-stage.mjs";

let fail = 0;
const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail++; console.log("  FAIL", name); } };

const day = (i) => new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10);
// Flat then a steep last few days: the old site formula called this Building.
const hist = Array.from({ length: 19 }, (_, i) => [day(i), i < 15 ? 20 : 20 * 1.06 ** (i - 14)]);
t("analyze no longer works out a stage", analyze(hist).stage === "");

const chips = {
  asOf: day(18),
  bySku: { "tcgcsv-1": "r1", "tcgcsv-2": "r2", "tcgcsv-3": "r3" },
  byId: {
    r1: { tiles: { price: { stage: { word: "Slowing", dir: "up", days: 7, date: day(18) } } } },
    r2: { tiles: { listings: { stage: { word: "Reversing", dir: "down", days: 7, date: day(18) } }, price: { stage: { word: "Building", dir: "up", days: 7 } } } },
    r3: { tiles: { price: { stage: { word: "Going up", dir: "up", days: 7 } } } },
  },
};
// The bot's rule (catchem-bot cogs/_signal_chips.py _tile_words): listings tile first, then price.
function botWord(c, sku) {
  const tiles = c.byId[c.bySku[sku]]?.tiles || {};
  for (const st of [tiles.listings?.stage, tiles.price?.stage]) if (st && ["Building", "Slowing", "Stalled", "Reversing"].includes(st.word)) return `${st.word} ${st.dir === "down" ? "▼" : "▲"}`;
  return "";
}
const site = (sku) => { const s = stageFromChips(chips, sku); return s ? `${s.word} ${s.dir === "down" ? "▼" : "▲"}` : ""; };
t("site and bot agree on every row", ["tcgcsv-1", "tcgcsv-2", "tcgcsv-3", "tcgcsv-9"].every((sku) => site(sku) === botWord(chips, sku)));
t("the listings tile wins over the price tile", stageFromChips(chips, "tcgcsv-2").word === "Reversing");
t("an unknown word or a missing row shows nothing", stageFromChips(chips, "tcgcsv-3") === null && stageFromChips(chips, "tcgcsv-9") === null && stageFromChips(null, "tcgcsv-1") === null);
t("the stage line uses the card tile wording", stageLine({ word: "Reversing", dir: "down", days: 7 }) === "Reversing: price turned down after moving up over the 7 days before.");

const ctx = { movers: { singles: [{ id: "tcgcsv-1", name: "Example - 1/100", set: "Example", hist }, { id: "tcgcsv-9", name: "Other - 2/100", set: "Example", hist }] }, chips };
const pool = buildPool(ctx);
const one = (Array.isArray(pool) ? pool : [...(pool?.values?.() || [])]).find((x) => x.id === "tcgcsv-1");
const nine = (Array.isArray(pool) ? pool : [...(pool?.values?.() || [])]).find((x) => x.id === "tcgcsv-9");
t("the article pool takes the stage from the data", one?.a.stage === "Slowing" && nine?.a.stage === "");

const src = await readFile(new URL("../src/reads-article.mjs", import.meta.url), "utf8");
t("no stage formula is left in the article code", !/stage = "(Building|Slowing|Stalled|Reversing)"/.test(src));

if (fail) { console.log(`run stage: ${fail} failed`); process.exit(1); }
console.log("run stage ok");
