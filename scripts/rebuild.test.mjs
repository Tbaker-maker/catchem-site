import worker, { pageKind, renderPath } from "../src/index.mjs";
import { esc } from "../src/ui.mjs";
import { isFeedPath, redirectPath } from "../src/feed.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.log("  FAIL", name); }
};

const BANNED = /\b(buys?|sells?|selling|holds?|holding|floors?|targets?|plays?|picks?|bullish|bearish|roi|invest(?:ing|ment|or)?s?|crypto|nfts?|web3|dsk|tickers?|tapes?)\b/i;
const LOCKED = "The full catalogue: every card and every artist. Pick one and the post is ready for X or Facebook.";

function clean(html) {
  return String(html).replaceAll(LOCKED, "LOCKED");
}

const counts = { asOf: "2026-09-27", source: "TCGplayer market", items: 31265, single: 28030, sealed: 3235, slab: 0, sets: 2, artists: 1 };
const sets = { asOf: "2026-09-27", source: "TCGplayer market", sets: [{ slug: "base", name: "Base Set", era: "Original", single: 1, sealed: 1, priced: 1, release: "1999-01-09" }] };
const setDoc = { ...sets.sets[0], items: [{ id: "tcgcsv-10", name: "Alakazam", num: "1", kind: "single", rarity: "Holo Rare", price: 12.5, pid: 10, artist: "Ken Sugimori", pct: 4.2 }] };
const artists = { note: "Partial.", artists: [{ slug: "ken-sugimori", name: "Ken Sugimori", count: 1 }] };
const artist = { name: "Ken Sugimori", source: "partial", cards: [{ id: "tcgcsv-10", name: "Alakazam", set: "Base Set", num: "1", price: 12.5 }] };
const card = { id: "tcgcsv-10", name: "Alakazam", set: "Base Set", setSlug: "base", kind: "single", price: 12.5, pct: 4.2, num: "1", rarity: "Holo Rare", artist: "Ken Sugimori", pid: 10, source: "TCGplayer market", asOf: "2026-09-27" };
const reads = { asOf: "2026-09-27", reads: [
  { id: "heating-tcgcsv-10", type: "heating", headline: "Alakazam is heating up, up 4.2% since yesterday.", price: 12.5, changePct: 4.2, source: "TCGplayer market", asOf: "2026-09-27", confidence: "Early", history: [12, 12.5], why: "One day is not a trend.", href: "/c/tcgcsv-10", set: "Base Set", image: "" },
  { id: "box-etb", type: "box", headline: "Elite Trainer Box works out to $3.50 a pack on the eBay ask.", price: 31.5, changePct: null, source: "eBay ask", asOf: "2026-09-27", confidence: "Tracked", history: [30, 31.5], why: "Median eBay ask divided by 9 packs.", href: "/p/sv3pt5-etb.html", set: "151" },
]};
const movers = { asOf: "2026-09-27", note: "One day.", singles: [{ id: "tcgcsv-10", name: "Alakazam", set: "Base Set", price: 12.5, changePct: 4.2, href: "/c/tcgcsv-10" }], sealed: [], slabs: [] };
const receipts = { asOf: "2026-09-27", note: "No direction was written first.", hitRate: null, rows: [{ headline: "Umbreon VMAX, revisited: unchanged since yesterday.", price: 20, source: "TCGplayer market", why: "Not a hit or a miss." }] };
const files = {
  "counts.json": counts,
  "sets.json": sets,
  "sets/base.json": setDoc,
  "artists.json": artists,
  "artists/ken-sugimori.json": artist,
  "buckets/10.json": [card],
  "reads.json": reads,
  "movers.json": movers,
  "receipts.json": receipts,
};

const fetchImpl = async (url) => {
  const rel = String(url).split("/public/")[1];
  if (!files[rel]) return { ok: false, status: 404, json: async () => null, text: async () => "" };
  return { ok: true, status: 200, json: async () => files[rel], text: async () => JSON.stringify(files[rel]) };
};

t("old product urls are not catalog cards", pageKind("/p/sv3pt5-etb") === null && pageKind("/p/sv3pt5-etb.html") === null);
t("catalog cards and shorts have kinds", pageKind("/c/tcgcsv-10") === "card" && pageKind("/p/tcgcsv-10") === "card" && pageKind("/feed") === "feed" && pageKind("/feed/r/heating-tcgcsv-10") === "feed");
t("pulse is the morning edition, not the shorts", isFeedPath("/pulse") && isFeedPath("/pulse.html") && !isFeedPath("/feed") && !isFeedPath("/feed/"));
t("app and try still go to the feed", redirectPath("/app/") === "/feed" && redirectPath("/try/index.html") === "/feed");
const escaped = esc("A & B <x>");
t("esc keeps markup out of a name", escaped.includes("amp;") && escaped.includes("lt;") && escaped.includes("gt;") && !escaped.includes("<"));

const feed = await renderPath("/feed", fetchImpl);
const feedHtml = await feed.text();
t("the feed is one read at a time", feedHtml.includes("scroll-snap-type:y mandatory") && feedHtml.includes("min(420px,100%)") && feedHtml.includes("caught up") && feedHtml.includes("$14.99/mo") && feedHtml.includes("4.2%") && !feedHtml.includes("$undefined") && !feedHtml.includes("NaN"));
t("the feed names Pokémon and hides a missing image price", feedHtml.includes("Pokémon") && !/(\$0|\$null|\$NaN)/.test(feedHtml));
const deep = await (await renderPath("/feed/r/box-etb", fetchImpl)).text();
t("a deep link starts on that read", deep.includes('id="start"') && deep.includes("box-etb"));
const all = await (await renderPath("/feed/all", fetchImpl)).text();
t("all reads is a list", all.includes("All reads") && all.includes("Alakazam"));
const setPage = await (await renderPath("/sets/missing", fetchImpl));
t("a missing set falls through", setPage === null);
const cardPage = await (await renderPath("/c/tcgcsv-10", fetchImpl)).text();
t("a card page has the market price", cardPage.includes("$12.50") && cardPage.includes("TCGplayer market") && cardPage.includes("Ken Sugimori"));
const board = await (await renderPath("/board", fetchImpl)).text();
t("movers keep slabs off the list", board.includes("Slabs") && board.includes("graded feed") && board.includes("Alakazam"));
const post = await (await renderPath("/post-office", fetchImpl)).text();
t("post office keeps the locked line", post.includes(LOCKED));
const method = await (await renderPath("/methodology", fetchImpl)).text();
t("methodology uses the catalog counts", method.includes("28,030") && method.includes("3,235"));
const badCopy = [feedHtml, cardPage, board, method, all].map(clean).filter((html) => BANNED.test(html));
t("pages skip the banned words", badCopy.length === 0);
const postClean = clean(post);
t("the locked pick line is the only exception", !BANNED.test(postClean));

const env = {
  PUBLIC_FETCH: fetchImpl,
  ASSETS: { fetch: async () => new Response("asset", { status: 200, headers: { "content-type": "text/html" } }) },
};
const homeFeed = await worker.fetch(new Request("https://catchemtcg.com/feed"), env);
t("the worker serves shorts for /feed", (await homeFeed.text()).includes("scroll-snap-type"));
const moved = await worker.fetch(new Request("https://catchemtcg.com/movers"), env);
t("movers redirects to the board", moved.status === 301 && moved.headers.get("location").endsWith("/board"));
const old = await worker.fetch(new Request("https://catchemtcg.com/p/sv3pt5-etb"), env);
t("an old lander is still the asset", (await old.text()) === "asset");

if (fail) process.exit(1);
console.log("rebuild routes ok");
