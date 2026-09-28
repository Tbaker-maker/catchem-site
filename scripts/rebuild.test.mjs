import worker, { pageKind, renderPath } from "../src/index.mjs";
import { esc } from "../src/ui.mjs";
import { isFeedPath, redirectPath } from "../src/feed.mjs";
import { readFile } from "node:fs/promises";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.log("  FAIL", name); }
};

const BANNED = /\b(buys?|sells?|selling|holds?|holding|floors?|targets?|plays?|picks?|bullish|bearish|roi|invest(?:ing|ment|or)?s?|crypto|nfts?|web3|dsk|tickers?|tapes?)\b/i;
const LOCKED = "The full catalog: every card and every artist. Pick one and the post is ready for X or Facebook.";

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
  "redirects.json": { products: { "sv3pt5-etb": "/p/tcgcsv-504467" }, sets: { base1: "/sets/base-set" } },
};

const fetchImpl = async (url) => {
  const rel = String(url).split("/public/")[1];
  if (!files[rel]) return { ok: false, status: 404, json: async () => null, text: async () => "" };
  return { ok: true, status: 200, json: async () => files[rel], text: async () => JSON.stringify(files[rel]) };
};

t("old product urls are catalog routes that redirect", pageKind("/p/sv3pt5-etb") === "product" && pageKind("/p/sv3pt5-etb.html") === "product");
t("catalog cards and shorts have kinds", pageKind("/c/tcgcsv-10") === "card" && pageKind("/p/tcgcsv-10") === "product" && pageKind("/feed") === "feed" && pageKind("/feed/r/heating-tcgcsv-10") === "feed");
t("pulse is redirected, not the baked shorts", !isFeedPath("/pulse") && !isFeedPath("/feed"));
t("app and try still go to the feed", redirectPath("/app/") === "/feed" && redirectPath("/try/index.html") === "/feed");
const escaped = esc("A & B <x>");
t("esc keeps markup out of a name", escaped.includes("amp;") && escaped.includes("lt;") && escaped.includes("gt;") && !escaped.includes("<"));

const hidden = await renderPath("/feed", fetchImpl);
t("feed is hidden without the flag", hidden.status === 302 && hidden.headers.get("location") === "/");
t("board, receipts, and accuracy are hidden without the flag",
  (await renderPath("/board", fetchImpl)).status === 302
  && (await renderPath("/receipts", fetchImpl)).headers.get("location") === "/"
  && (await renderPath("/accuracy", fetchImpl)).status === 302
  && (await renderPath("/feed/r/box-etb", fetchImpl)).status === 302);
const feed = await renderPath("/feed", fetchImpl, { feed: true });
const feedHtml = await feed.text();
t("the feed is one read at a time", feed.status === 200 && feedHtml.includes("scroll-snap-type:y mandatory") && feedHtml.includes("min(420px,100%)") && feedHtml.includes("Caught up") && feedHtml.includes("$14.99/mo") && feedHtml.includes("4.2%") && feedHtml.includes("height:180px") && !feedHtml.includes("$undefined") && !feedHtml.includes("NaN"));
t("the feed names Pokémon and hides a missing image price", feedHtml.includes("Pokémon") && !/(\$0|\$null|\$NaN)/.test(feedHtml));
const deep = await (await renderPath("/feed/r/box-etb", fetchImpl, { feed: true })).text();
t("a deep link starts on that read", deep.includes('id="start"') && deep.includes("box-etb"));
const all = await (await renderPath("/feed/all", fetchImpl, { feed: true })).text();
t("all reads is a list", all.includes("All reads") && all.includes("Alakazam"));
const setPage = await renderPath("/sets/missing", fetchImpl);
t("a missing set is not a generic redirect", setPage.status === 404);
const known = await renderPath("/sets/base1", fetchImpl);
t("a known old set slug is one hop", known.status === 301 && known.headers.get("location") === "/sets/base-set");
const cardPage = await (await renderPath("/c/tcgcsv-10", fetchImpl)).text();
t("a card page has the market price", cardPage.includes("$12.50") && cardPage.includes("TCGplayer market") && cardPage.includes("Ken Sugimori"));
t("a card page does not link the hidden pages", !/href="\/(feed|board|receipts|accuracy|movers)/.test(cardPage));
const setHtml = await (await renderPath("/sets/base", fetchImpl)).text();
t("a set page does not link the hidden pages", !/href="\/(feed|board|receipts|accuracy|movers)/.test(setHtml));
const board = await (await renderPath("/board", fetchImpl, { feed: true })).text();
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
t("the worker sends /feed home", homeFeed.status === 302 && new URL(homeFeed.headers.get("location"), "https://catchemtcg.com").pathname === "/");
const moved = await worker.fetch(new Request("https://catchemtcg.com/movers"), env);
t("movers sends home when the feed is off", moved.status === 302 && new URL(moved.headers.get("location"), "https://catchemtcg.com").pathname === "/");
const old = await worker.fetch(new Request("https://catchemtcg.com/p/sv3pt5-etb"), env);
t("an old lander redirects", old.status === 301);
const pulse = await worker.fetch(new Request("https://catchemtcg.com/pulse"), env);
t("pulse sends home when the feed is off", pulse.status === 302 && new URL(pulse.headers.get("location"), "https://catchemtcg.com").pathname === "/");
const app = await worker.fetch(new Request("https://catchemtcg.com/app"), env);
t("app does not land on the feed", app.status === 301 && new URL(app.headers.get("location"), "https://catchemtcg.com").pathname === "/");
const on = { ...env, FEED_ENABLED: "true" };
const opened = await worker.fetch(new Request("https://catchemtcg.com/feed"), on);
t("the worker serves shorts when the flag is on", (await opened.text()).includes("scroll-snap-type"));
const movedOn = await worker.fetch(new Request("https://catchemtcg.com/movers"), on);
t("movers redirects to the board when the flag is on", movedOn.status === 301 && movedOn.headers.get("location").endsWith("/board"));
const pulseOn = await worker.fetch(new Request("https://catchemtcg.com/pulse"), on);
t("pulse redirects to the feed when the flag is on", pulseOn.status === 301 && pulseOn.headers.get("location").endsWith("/feed"));
t("the header is one row and the dock hides on a wide screen", feedHtml.includes("menu-btn") && feedHtml.includes("min-width:1024px") && feedHtml.includes(".dock{display:none") && feedHtml.includes("TCGplayer market") && !feedHtml.includes("2 days of history") && !feedHtml.includes("Axis from the low"));
t("the feed nav shows only when the flag is on", !/href="\/feed"/.test(cardPage) && cardPage.includes("Sets") && (await (await renderPath("/c/tcgcsv-10", fetchImpl, { feed: true })).text()).includes('href="/feed">Feed'));
t("a vote that does not save uses plain words", feedHtml.includes("Votes are not open yet.") && !feedHtml.includes("server store"));
t("a mover name keeps the main width", board.includes("row mover") && board.includes("-webkit-line-clamp:2") && board.includes("mover-stat"));
const indexHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
const homeAssets = { fetch: async () => new Response(indexHtml, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }) };
const homeOff = await (await worker.fetch(new Request("https://catchemtcg.com/"), { ...env, ASSETS: homeAssets })).text();
const homeOn = await (await worker.fetch(new Request("https://catchemtcg.com/"), { ...env, ASSETS: homeAssets, FEED_ENABLED: "true" })).text();
t("the homepage price line points at premium", homeOff.includes('href="/premium"') && homeOff.includes("$14.99/mo") && !homeOff.includes('href="/feed"'));
t("the homepage hero and nav gain a feed link only when the flag is on", (homeOn.match(/href="\/feed"/g) || []).length === 3 && homeOn.includes('class="btn btn-primary" href="/feed">Feed'));
const premium = await worker.fetch(new Request("https://catchemtcg.com/premium"), env);
const premiumHtml = await premium.text();
const lock = "The rate you check out at stays yours while you stay subscribed or on a valid pause. Cancel and the number is retired. If you come back, you pay the public rate then on the site.";
t("premium is a worker page", pageKind("/premium") === "premium" && premium.status === 200);
t("premium pause and cancel sit together", premiumHtml.includes('class="prem-acts"') && premiumHtml.includes(">Pause</a><a href=") && premiumHtml.includes(">Cancel</a>"));
t("premium keeps the lock sentence", premiumHtml.includes(lock));
t("premium skips lifetime, forever, and investing words", !/lifetime|forever/i.test(premiumHtml) && !BANNED.test(premiumHtml));

if (fail) process.exit(1);
console.log("rebuild routes ok");
