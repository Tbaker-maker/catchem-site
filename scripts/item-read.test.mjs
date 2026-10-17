// Item read block on /c and /p pages: one shard row, empty fields hidden.
import { banGuard } from "../src/advice-rules.mjs";
// Whole pages carry code comments, so dashes are checked by their own assertion here.
const PAGE = { skipKinds: ["house"] };
import { itemReadBlock } from "../src/item-read.mjs";
import { itemLine } from "../src/data.mjs";
import { renderCard } from "../src/ui.mjs";
let fail = 0;
const t = (n, c) => { console.log(`${c ? "  ok " : "  FAIL"} ${n}`); if (!c) fail++; };
const row = { item: { id: "tcgcsv-1", kind: "single", price: 47.36, priceAsOf: "2026-10-14" },
  change: { d7: { pct: -2.5, from: "2026-10-07", to: "2026-10-14" }, d30: { pct: -22.3, from: "2026-09-14", to: "2026-10-14" }, d90: { pct: -31.1, from: "2026-07-16", to: "2026-10-14" }, y1: { pct: -30.8, from: "2025-10-09", to: "2026-10-14" } },
  range: { from: "2025-05-29", high: { price: 84.54, date: "2025-05-29" }, low: { price: 42.12, date: "2026-01-08" }, daysSinceHigh: 503, fromHighPct: -44, now: { price: 47.36, date: "2026-10-14" } },
  rank: { rank: 8, of: 244, set: "SV10: Destined Rivals" }, listings: { n: 12, date: "2026-10-14", prev: 10, prevDate: "2026-10-13", pct: 20, span: 1 },
  rotation: { mark: "I", status: "Standard", asOf: "2026-08-24" },
  pattern: { rate: 25, base: 20.8, n: 3503, horizon: 7, keys: ["set_age=1_to_3y"], asOf: "2026-10-14" },
  setMomentum: { pct: -18.3, from: "2026-09-14", to: "2026-10-14", set: "SV10: Destined Rivals", kind: "singles" },
  rip: { price: 100, contentsEV: 80, roiPct: -20, beatChance: 30, asOf: "2026-10-14" },
  line: "44% under its high of $84.54 on May 29, 2025, 503 days ago." };
const shard = `{"asOf":"2026-10-14","items":{\n"tcgcsv-0":{"item":{}},\n"tcgcsv-1":${JSON.stringify(row)},\n"tcgcsv-10":{"item":{}}\n}}\n`;
t("row sliced from shard text by exact id", itemLine(shard, "tcgcsv-1")?.rank?.rank === 8 && itemLine(shard, "tcgcsv-2") === null);
const h = itemReadBlock(itemLine(shard, "tcgcsv-1"));
t("7/30/90/1Y changes", ["7-day -2.5%", "30-day -22.3%", "90-day -31.1%", "1Y -30.8%"].every((x) => h.includes(x)));
t("high/low, days since high, rank", h.includes("503 days since the last high") && h.includes("No. 8 of 244"));
t("listings counted with change", h.includes("12 listings counted, Oct 14, 1-day +20% from Oct 13"));
t("pattern and set momentum", h.includes("vs 20.8% normally") && h.includes("singles index -18.3%"));
t("what-we-see line", h.includes("44% under its high"));
t("no invented Near Mint label", !h.includes("(Near Mint)") && !h.includes("NM $"));
t("Rip and rotation skipped when the page already has them", !itemReadBlock(row, { skipRip: true, skipRotation: true }).includes("Rip value") && !itemReadBlock(row, { skipRotation: true }).includes("Mark I"));
t("no banned words, no em dash", !/[\u2014\u2013]/.test(h) && !banGuard("item-read", /\b(supply)\b/i, PAGE).test(h.replace(/<[^>]+>/g, " ")));
t("empty row renders nothing", itemReadBlock({ item: {} }) === "" && itemReadBlock(null) === "");
t("a line with an advice phrase is dropped", !itemReadBlock({ line: "Time to buy." }).includes("buy"));
t("a line with a shop label is kept", itemReadBlock({ line: "Shop it: Buy on eBay." }).includes("Buy on eBay"));
const page = renderCard({ id: "tcgcsv-1", name: "Psyduck", kind: "single", set: "S", num: "1", price: 47.36, asOf: "2026-10-14", source: "TCGplayer market", hist: [["2026-10-01", 50], ["2026-10-14", 47.36]] }, "stamp", { itemReadHtml: h });
const sealedPage = renderCard({ id: "tcgcsv-2", name: "Box", kind: "sealed", set: "S", price: 70, asOf: "2026-10-14", source: "TCGplayer market", hist: [["2026-10-01", 69], ["2026-10-14", 70]] }, "stamp", { itemReadHtml: h });
t("sealed page renders the block", sealedPage.includes('aria-label="Our read"'));
t("card page renders the block", page.includes('aria-label="Our read"'));
if (fail) process.exit(1);
