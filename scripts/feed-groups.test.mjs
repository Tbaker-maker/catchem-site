// A group filter (One set) must show a read for every priced item in that set,
// not only the items that already have a mover read. Runs the feed's own client
// code from the rendered page in a sandbox.
import vm from "node:vm";
import { renderFeed } from "../src/ui.mjs";

let fail = 0;
const t = (name, ok) => { console.log(`${ok ? "  ok  " : "  FAIL "}${name}`); if (!ok) fail = 1; };

const page = renderFeed({ asOf: "2026-10-15", reads: [] }, "", "", { feed: true });
const script = page.match(/\/\/ Feed quality: one read per item[\s\S]*?(?=function buildFlat\(\)\{)/);
t("the feed carries the per-item group code", !!script);
if (script) {
  const items = [];
  for (let i = 0; i < 32; i++) items.push({ id: `tcgcsv-${1000 + i}`, name: i < 8 ? `First Partner Pack (R${i})` : `Starter ${i}`, num: i < 8 ? "" : `${i}/102`, kind: i < 8 ? "sealed" : "single", price: 2 + i, rank: i + 1, of: 32, hist: [["2026-09-26", 2 + i], ["2026-10-08", 2.5 + i], ["2026-10-15", 2 + i]] });
  items.push({ id: "tcgcsv-9999", name: "No price", kind: "single", price: null, hist: [] });
  const doc = { name: "First Partner Pack", asOf: "2026-10-15", era: "Scarlet & Violet", items };
  const otherItems = [
    { id: "tcgcsv-2001", name: "Era Card", num: "1/10", kind: "single", price: 9.5, rank: 1, of: 2, hist: [["2026-09-26", 8], ["2026-10-08", 9], ["2026-10-15", 9.5]] },
    { id: "tcgcsv-2002", name: "Era Box", kind: "sealed", price: 40, rank: 2, of: 2, hist: [["2026-09-26", 36], ["2026-10-08", 38], ["2026-10-15", 40]] },
    { id: "tcgcsv-2003", name: "Unpriced", kind: "single", price: 0, hist: [] },
  ];
  const other = { name: "Prismatic Evolutions", asOf: "2026-10-15", era: "Scarlet & Violet", items: otherItems };
  const docs = { "first-partner-pack": doc, "prismatic-evolutions": other };
  const ctx = {
    setBook: {
      bySlug: {
        "first-partner-pack": { slug: "first-partner-pack", name: "First Partner Pack", era: "Scarlet & Violet", priced: 32 },
        "prismatic-evolutions": { slug: "prismatic-evolutions", name: "Prismatic Evolutions", era: "Scarlet & Violet", priced: 2 },
      },
      byName: { "First Partner Pack": "first-partner-pack", "Prismatic Evolutions": "prismatic-evolutions" },
    },
    setIndex: { "first-partner-pack": [{ id: "move-tcgcsv-1000-7", sku: "tcgcsv-1000", headline: "First Partner Pack (R0) is up 5% this week, from $1.90 to $2.00." }] },
    fetch: async (url) => {
      const slug = String(url).split("/").pop().replace(".json", "");
      return { ok: true, json: async () => docs[slug] };
    },
    encodeURIComponent, Object, Math, Number, String, Array, Date, JSON,
  };
  vm.createContext(ctx);
  vm.runInContext(script[0] + "\nthis.ensureSetItems=ensureSetItems; this.capMoves=capMoves; this.varyMove=varyMove; this.spreadTemplates=spreadTemplates; this.templateKey=templateKey; this.withPriceSource=withPriceSource;", ctx);
  await ctx.ensureSetItems("first-partner-pack");
  await ctx.ensureSetItems("prismatic-evolutions");
  const rows = ctx.setIndex["first-partner-pack"];
  const priced = items.filter((x) => x.price > 0).length;
  t(`a set shows every priced item (${rows.length} of ${priced})`, rows.length === priced);
  t("no item shows twice", new Set(rows.map((r) => r.sku)).size === rows.length);
  const bySku = Object.fromEntries(items.map((it) => [it.id, it]));
  const sealedN = rows.filter((r) => bySku[r.sku] && bySku[r.sku].kind === "sealed").length;
  const singleN = rows.filter((r) => bySku[r.sku] && bySku[r.sku].kind === "single").length;
  t(`sealed product type matches priced sealed (${sealedN} of 8)`, sealedN === 8 && singleN === 24);
  const eraSlugs = ["first-partner-pack", "prismatic-evolutions"];
  const eraShown = eraSlugs.reduce((n, slug) => n + ctx.setIndex[slug].length, 0);
  const eraPriced = eraSlugs.reduce((n, slug) => n + docs[slug].items.filter((x) => Number(x.price) > 0).length, 0);
  t(`an era shows every priced item (${eraShown} of ${eraPriced})`, eraShown === eraPriced && eraPriced === 34);
  const heads = rows.map((r) => r.headline);
  const moneyOk = heads.every((h) => {
    const dollars = h.match(/\$\d[\d,]*(?:\.\d+)?/g) || [];
    const pcts = h.match(/\d+(?:\.\d+)?%/g) || [];
    return dollars.every((d) => /^\$\d{1,3}(?:,\d{3})*\.\d{2}$/.test(d)) && pcts.every((p) => /^\d+(?:\.\d)?%$/.test(p));
  });
  t("item reads use their own numbers and never say sales", heads.every((h) => /\$\d/.test(h) && /TCGplayer market price/.test(h) && !/\bsales?\b|\u2014/i.test(h)) && moneyOk);
  const moves = Array.from({ length: 10 }, (_, i) => ({ id: `move-x-${i}`, headline: `Card ${i} is up 5% this week, from $1.00 to $1.05.` }));
  const otherReads = Array.from({ length: 10 }, (_, i) => ({ id: `deep-${i}`, headline: `Deep ${i}.` }));
  const mixed = ctx.capMoves(moves.concat(otherReads)).slice(0, 12);
  const moveN = mixed.filter((r) => /^move-/.test(r.id)).length;
  t("plain price moves stay at 25% or less while other reads last", moveN / mixed.length <= 0.25 && moveN === 3);
  const same = Array.from({ length: 20 }, (_, i) => ({ id: `m-${i}`, headline: "Card is up 5% this week, from $1.00 to $1.05.", alts: ["Card sits $0.10 under its high of $1.15 NM from Oct 1, at $1.05 now. TCGplayer market price.", "Since Oct 1, Card went from $1.00 NM to $1.05 NM, up 5%. TCGplayer market price."] }));
  const spread = ctx.spreadTemplates(same);
  let repeat = false;
  const keys = [];
  for (let i = 0; i < spread.length; i++) {
    const key = ctx.templateKey(spread[i].headline);
    keys.push(key);
    for (let j = Math.max(0, i - 19); j < i; j++) if (ctx.templateKey(spread[j].headline) === key) repeat = true;
  }
  t("no repeated template in any 20 reads", !repeat && new Set(keys).size === 20);
  t("a price line names TCGplayer market price", ctx.withPriceSource("Pikachu is at $57.41 NM.") === "Pikachu is at $57.41 NM. TCGplayer market price.");
  const chipSrc = page.slice(page.indexOf("function shapeCount(kind){"), page.indexOf("function paintChips(){"));
  t("empty chips are decided in the page", chipSrc.includes("function filterReads") && chipSrc.includes('if(f==="mktmove"') === false && chipSrc.includes("return shapeCount(f)"));
  const chipCtx = {
    browse: { ranked: [], filters: { mktmove: { items: [] }, still: { items: [] }, news: { items: [] } } },
    newsRows: [],
    setBook: ctx.setBook,
    setIndex: ctx.setIndex,
    readLibrary: { signals: [] },
    sealedList: () => [],
    leadRows: () => [],
    isFact: () => false,
    isShapeRow: (r) => !!(r && r.shape),
    isVolumeRow: () => false,
    FQ_WAVE: {},
  };
  vm.createContext(chipCtx);
  vm.runInContext(chipSrc + "\nthis.filterReads=filterReads; this.shapeCount=shapeCount;", chipCtx);
  t("a filter with no reads stays hidden", chipCtx.filterReads("mktmove") === 0 && chipCtx.filterReads("still") === 0 && chipCtx.filterReads("news") === 0 && chipCtx.filterReads("") === 1 && chipCtx.filterReads("set") === 1);
}
process.exit(fail);
