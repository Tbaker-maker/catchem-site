import { withoutShopButtons } from "../src/pokemon.mjs";
// Open data: every read with an item lands on that item's page at a real
// section. Item pages show every read, rank and related, hide empty sections,
// keep NM off sealed and skip banned words.
import { openDataHref, ITEM_SECTIONS } from "../src/open-data.mjs";
import { renderCard } from "../src/ui.mjs";

let fail = 0;
const t = (name, cond) => { console.log(`${cond ? "  ok " : "  FAIL"} ${name}`); if (!cond) fail++; };
const BANNED = /\b(buy|sell|hold|support|resistance|bottom|printed|play|target|invest|stack|load up|crypto|sales)\b/i;
const SECTIONS = new Set(ITEM_SECTIONS.map(([id]) => id));
const resolves = (href) => {
  const m = href.match(/^\/(c|p)\/([a-z0-9-]+)#([a-z]+)$/i);
  return m ? SECTIONS.has(m[3]) : /^\/(feed\/r\/|feed(\?|$)|sets(\/|$)|rotation$|releases$|pokemon\/|search\?|movers$)/.test(href);
};

t("deep read lands on price", openDataHref({ id: "a", readKind: "deep", sku: "tcgcsv-1", href: "/c/tcgcsv-1" }) === "/c/tcgcsv-1#price");
t("listings read lands on supply", openDataHref({ id: "b", readKind: "listings", href: "/p/tcgcsv-9" }) === "/p/tcgcsv-9#supply");
t("rarity band lands on rank", openDataHref({ id: "c", kind: "rarity-band", sku: "tcgcsv-4" }) === "/c/tcgcsv-4#rank");
t("set read keeps its set page", openDataHref({ id: "d", readKind: "set", href: "/sets/sv3pt5" }) === "/sets/sv3pt5");
t("no item, no href: read page", openDataHref({ id: "e f", readKind: "pokemon" }) === "/feed/r/e%20f");
t("sealed slug keeps its redirect and section", openDataHref({ id: "h", readKind: "mktmove", href: "/p/sv3pt5-bb" }) === "/p/sv3pt5-bb#price");
t("outside links never used", openDataHref({ id: "g", href: "https://x.com/c/tcgcsv-1" }) === "/feed/r/g");

// Every live read resolves (skipped offline).
try {
  const res = await fetch("https://catchemtcg.com/data/reads.json", { signal: AbortSignal.timeout(15000) });
  const reads = (await res.json()).reads || [];
  const bad = reads.filter((r) => !resolves(openDataHref(r)));
  if (bad.length) console.error(bad.slice(0, 5).map((r) => `${r.id} -> ${openDataHref(r)}`));
  t(`every live read's Open data resolves (${reads.length})`, reads.length > 0 && bad.length === 0);
} catch (e) { console.log("  skip live reads:", e.message); }

const reads = [
  { id: "r1", kind: "listings", headline: "Listings counted fell 12% over 30 days.", lines: ["41 listings counted on Oct 16."], asOf: "2026-10-16", source: "eBay listings counted" },
  { id: "r2", kind: "deep", headline: "Up 8.2% over 30 days.", lines: [], asOf: "2026-10-15" },
];
const sealed = { id: "tcgcsv-500", name: "Test Booster Box", kind: "sealed", set: "Test Set", setSlug: "tst", price: 180, asOf: "2026-10-16", source: "TCGplayer market", hist: [["2026-10-01", 170], ["2026-10-16", 180]], rank: 2, of: 30, also: [{ id: "tcgcsv-501", name: "Test ETB", price: 60 }] };
const page = renderCard(sealed, "stamp", { allReads: reads, feed: true, listingSeries: [{ date: "2026-10-01", listingCount: 50 }, { date: "2026-10-16", listingCount: 41 }] });
const main = page.slice(page.indexOf("<main"), page.indexOf("</main>"));
const visible = withoutShopButtons(main).replace(/<style>[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");
t("sealed page has every read", main.includes('id="read-r1"') && main.includes('id="read-r2"') && main.includes("(2)"));
t("sealed page has price, supply, rank, stats, reads, related", ["price", "supply", "rank", "stats", "reads", "related"].every((id) => main.includes(`id="${id}"`)));
t("jump row links each section", main.includes('class="item-jump"') && main.includes('href="#supply"') && main.includes('href="#related"'));
t("no NM on sealed", !/\bNM\b|Near Mint/.test(visible));
t("no banned words or em dashes", !BANNED.test(visible) && !/[\u2014\u2013]/.test(visible));
t("read links open the read", main.includes('href="/feed/r/r1"'));

const single = { id: "tcgcsv-77", name: "Pikachu", kind: "single", set: "Base Set", price: 15, asOf: "2026-10-16", source: "TCGplayer market", hist: [["2026-10-01", 12], ["2026-10-16", 15]] };
const bare = renderCard(single, "stamp", {});
t("empty sections hidden on a bare card", !bare.includes('id="rank"') && !bare.includes('id="related"') && !bare.includes('id="reads"') && !/no\s+data/i.test(bare));
const full = renderCard({ ...single, rank: 1, of: 102, also: [{ id: "tcgcsv-78", name: "Raichu" }] }, "stamp", { allReads: reads });
t("single shows rank and related", full.includes("#1 of 102") && full.includes('href="/c/tcgcsv-78"') && full.includes('id="reads"'));

const order = (h) => ITEM_SECTIONS.map(([id]) => h.indexOf(`id="${id}"`)).filter((i) => i >= 0);
const sorted = (a) => a.every((v, i) => i === 0 || a[i - 1] < v);
t("sealed sections follow the jump row order", sorted(order(main)));
t("single sections follow the jump row order", sorted(order(full)));
if (fail) { console.error(`${fail} failed`); process.exit(1); }
console.log("open data ok");
