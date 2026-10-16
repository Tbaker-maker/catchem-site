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
  const doc = { name: "First Partner Pack", asOf: "2026-10-15", items };
  const ctx = {
    setBook: { bySlug: { "first-partner-pack": { slug: "first-partner-pack", name: "First Partner Pack" } }, byName: { "First Partner Pack": "first-partner-pack" } },
    setIndex: { "first-partner-pack": [{ id: "move-tcgcsv-1000-7", sku: "tcgcsv-1000", headline: "First Partner Pack (R0) is up 5% this week, from $1.90 to $2.00." }] },
    fetch: async () => ({ ok: true, json: async () => doc }),
    encodeURIComponent, Object, Math, Number, String, Array, Date, JSON,
  };
  vm.createContext(ctx);
  vm.runInContext(script[0] + "\nthis.ensureSetItems=ensureSetItems; this.capMoves=capMoves; this.varyMove=varyMove;", ctx);
  await ctx.ensureSetItems("first-partner-pack");
  const rows = ctx.setIndex["first-partner-pack"];
  const priced = items.filter((x) => x.price > 0).length;
  t(`a set shows every priced item (${rows.length} of ${priced})`, rows.length === priced);
  t("no item shows twice", new Set(rows.map((r) => r.sku)).size === rows.length);
  const heads = rows.map((r) => r.headline);
  t("item reads use their own numbers and never say sales", heads.every((h) => /\$\d/.test(h) && !/\bsales?\b|\u2014/i.test(h)));
  const moves = Array.from({ length: 10 }, (_, i) => ({ id: `move-x-${i}`, headline: `Card ${i} is up 5% this week, from $1.00 to $1.05.` }));
  const other = Array.from({ length: 10 }, (_, i) => ({ id: `deep-${i}`, headline: `Deep ${i}.` }));
  const mixed = ctx.capMoves(moves.concat(other)).slice(0, 10);
  t("at most 40% plain price moves while other reads last", mixed.filter((r) => /^move-/.test(r.id)).length <= 4);
}
process.exit(fail);
