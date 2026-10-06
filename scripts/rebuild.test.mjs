import worker, { pageKind, renderPath } from "../src/index.mjs";
import { esc, renderAll, renderDive, renderFeed, keepFeedRead, isFactRow, isLagRow, isSupplyRow, filesDisagree, readStaleAgainstCard, buildFeedLoop, renderSearch, pokemonFactLine, pricedMonCards, readUnderTitle, cardIdentity, countPublishedReads, newsSlice, factCutout, tcgLink, withoutSoldClaim, isOutlierRow, isDiveRow, flaggedReads, diveReads } from "../src/ui.mjs";
import { isFeedPath, redirectPath } from "../src/feed.mjs";
import { hidePublishedNotes } from "./public-routes.mjs";
import { readFile } from "node:fs/promises";
import { resetJsonCache } from "../src/data.mjs";
import { feedNews } from "../data/feed-news.mjs";

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

function stripNews(html) {
  return String(html).replace(/<script type="application\/json" id="feed-news">[\s\S]*?<\/script>/g, "");
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
  "buckets/13.json": [{ id: "tcgcsv-503313", name: "151 Elite Trainer Box", set: "151", setSlug: "sv-scarlet-violet-151", kind: "sealed", price: 87.5, pid: 503313, source: "TCGplayer market", asOf: "2026-10-06", hist: [["2026-08-20", 90], ["2026-08-21", 88]] }],
  "reads.json": reads,
  "movers.json": movers,
  "receipts.json": receipts,
  "redirects.json": { products: { "sv3pt5-etb": "/p/tcgcsv-504467" }, sets: { base1: "/sets/base-set" } },
};

const diveFiles = {
  "index.json": { asOf: "2026-10-06", count: 1, ids: ["sv3pt5-etb"], byTcgcsv: { "tcgcsv-503313": "sv3pt5-etb" } },
  "sv3pt5-etb.json": {
    id: "sv3pt5-etb",
    name: "151 Elite Trainer Box",
    asOf: "2026-10-06",
    href: "/dive/sv3pt5-etb",
    tcgcsvId: "tcgcsv-503313",
    series: [
      { date: "2026-08-20", price: 90, listingCount: 40, source: "ebay-browse-ask" },
      { date: "2026-08-21", price: 88, listingCount: 38, source: "ebay-browse-ask" },
    ],
    latest: { id: "sv3pt5-etb", name: "151 Elite Trainer Box", set: "151", subtype: "etb", priceMedian: 87.5, listingCount: 35, source: "ebay-browse-api", marketplace: "EBAY_US", dataStatus: "live" },
    buyout: { id: "sv3pt5-etb", browseTotalNow: 324, browseTotalBefore: 323, level: "unscored", ebayCalled: true },
    volume: null,
    volumeNote: "Sold counts need Insights scope.",
    outlier: null,
    outlierHook: "Optional file data/derived/sealed-price-outliers.json",
  },
};

const fetchImpl = async (url) => {
  const s = String(url);
  const diveRel = s.split("/research/pulse/dive/")[1];
  if (diveRel) {
    const doc = diveFiles[diveRel];
    if (!doc) return { ok: false, status: 404, json: async () => null, text: async () => "" };
    return { ok: true, status: 200, json: async () => doc, text: async () => JSON.stringify(doc) };
  }
  const rel = s.split("/public/")[1];
  if (!files[rel]) return { ok: false, status: 404, json: async () => null, text: async () => "" };
  return { ok: true, status: 200, json: async () => files[rel], text: async () => JSON.stringify(files[rel]) };
};

t("old product urls are catalog routes that redirect", pageKind("/p/sv3pt5-etb") === "product" && pageKind("/p/sv3pt5-etb.html") === "product");
t("dive urls are their own kind", pageKind("/dive/sv3pt5-etb") === "dive" && pageKind("/dive/sv3pt5-etb.html") === "dive");

{
  const flagged = renderDive({
    id: "sv5-pc-etb",
    name: "Temporal Forces Pokemon Center Elite Trainer Box",
    asOf: "2026-10-06",
    series: [{ date: "2026-10-06", price: 499.99, listingCount: 6, source: "ebay-browse-ask" }],
    latest: { id: "sv5-pc-etb", set: "Temporal Forces", subtype: "pc-etb", priceMedian: 499.99, listingCount: 6 },
    volume: null,
    volumeNote: "Sold counts need Insights scope.",
    outlier: {
      flag: "high",
      note: "Price flagged: 95.5% above recent median — review",
      asOf: "2026-10-06",
      pctGap: 95.5,
      direction: "high",
      provisionalLabel: "review — possible bad listing; review — possible real move",
    },
  }, "stamp", { feed: true });
  t("dive shows clear price flag", flagged.includes("Price flagged: 95.5% above recent median — review") && flagged.includes("review — possible bad listing") && !flagged.includes("Outlier flags: none yet"));
  t("dive share card has og tags", flagged.includes('property="og:title"') && flagged.includes("Temporal Forces Pokemon Center Elite Trainer Box — Deep dive · Catch&#39;em") && flagged.includes('property="og:description"') && flagged.includes("eBay Browse ask median") && flagged.includes('property="og:image" content="https://catchemtcg.com/og.png"') && flagged.includes('name="twitter:card" content="summary_large_image"') && flagged.includes('rel="canonical" href="https://catchemtcg.com/dive/sv5-pc-etb"'));
}
{
  const divePage = await renderPath("/dive/sv3pt5-etb", fetchImpl, { feed: true });
  const diveHtml = await divePage.text();
  t("dive page renders series chart and table", divePage.status === 200 && diveHtml.includes("151 Elite Trainer Box") && diveHtml.includes("eBay Browse ask median") && diveHtml.includes("2026-08-20") && diveHtml.includes("data-chart") && diveHtml.includes("<table") && diveHtml.includes("Volume / solds: not available") && !diveHtml.includes("$undefined"));
  t("dive without outlier stays quiet", diveHtml.includes("Outlier flags: none yet") && !diveHtml.includes("Price flagged:"));
  const miss = await renderPath("/dive/no-such-sku", fetchImpl, { feed: true });
  t("missing dive is 404", miss.status === 404);
  const cardPage = await (await renderPath("/p/tcgcsv-503313", fetchImpl, { feed: true })).text();
  // card may 404 if bucket missing — only check diveHref when card renders; seed bucket
}

{
  const cardPage = await (await renderPath("/p/tcgcsv-503313", fetchImpl, { feed: true })).text();
  t("catalog sealed page links Deeper look when dive exists", cardPage.includes("Deeper look") && cardPage.includes("/dive/sv3pt5-etb") && cardPage.includes("See the chart"));
}

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
t("the feed is a sectioned list", feed.status === 200 && feedHtml.includes("Today") && feedHtml.includes(" · <span>") && feedHtml.includes("See all") && feedHtml.includes(">Track<") && !feedHtml.includes("What this means") && feedHtml.includes("Where's it heading?") && feedHtml.includes("Tracking. We'll DM you.") && feedHtml.includes("We'll DM you on Discord.") && feedHtml.includes("You said ") && feedHtml.includes("Community: ") && !feedHtml.includes("Track this") && !feedHtml.includes(">Change<") && !feedHtml.includes("Load more") && !feedHtml.includes(">Loading") && !feedHtml.includes("IntersectionObserver") && !feedHtml.includes(">0<") && !feedHtml.includes("Follow") && !feedHtml.includes("Set alert") && feedHtml.includes("Flagged ") && feedHtml.includes(">Up<") && feedHtml.includes("Sideways") && feedHtml.includes("Watches") && feedHtml.includes("Cooks") && feedHtml.includes("Movers") && feedHtml.includes("Tracked") && feedHtml.includes("4.2%") && feedHtml.includes("height:180px") && !feedHtml.includes("$undefined") && !feedHtml.includes("NaN") && !feedHtml.includes("scroll-snap-type"));
t("the feed names Pokémon and hides a missing image price", feedHtml.includes("Pokémon") && !/(\$0|\$null|\$NaN)/.test(feedHtml));
t("a read names the path and the check, and 30D is colored", feedHtml.includes("Open the data") && !feedHtml.includes("Open the page") && feedHtml.includes("Checked ") && feedHtml.includes('class="win ') && feedHtml.includes("30D") && feedHtml.includes("90D") && !feedHtml.includes("What this means") && !feedHtml.includes("No sales count yet") && !feedHtml.includes("Sales volume") && feedHtml.includes('textContent="Next"') && feedHtml.includes('textContent="Previous"') && feedHtml.includes("Listings for sale") && feedHtml.includes("The data") && !feedHtml.includes("What to watch") && !feedHtml.includes("The sales behind") && !feedHtml.includes("Buy it when") && !feedHtml.includes("buyout"));
const deep = await (await renderPath("/feed/r/box-etb", fetchImpl, { feed: true })).text();
t("a deep link starts on that read", deep.includes('id="start"') && deep.includes("box-etb") && deep.includes(">Back<") && deep.includes(">Track<") && !deep.includes("What this means") && deep.includes("Where's it heading?") && deep.includes("height:180px") && deep.includes(">Up<"));

const soldPath = "Prismatic Evolutions Elite Trainer Box latest price fell from $154.77 on Sep 3 to $134.46 on Oct 3, down 13.1%, with 2269 copies sold on TCGplayer over 3 months on Oct 2, not eBay and not a 7-day count.";
const thinHead = "Blastoise (Boundaries Crossed, 2012, #31) is up 11.5% over 90 days, from $21.57 to $24.05, on few sales.";
t("a copies-sold clause comes out and the price stays", withoutSoldClaim(soldPath) === "Prismatic Evolutions Elite Trainer Box latest price fell from $154.77 on Sep 3 to $134.46 on Oct 3, down 13.1%." && !withoutSoldClaim(soldPath).includes("2269"));
t("few sales comes out and the price stays", withoutSoldClaim(thinHead) === "Blastoise (Boundaries Crossed, 2012, #31) is up 11.5% over 90 days, from $21.57 to $24.05." && !/\bfew sales\b/i.test(withoutSoldClaim(thinHead)));
t("a sold-only sentence is removed and not replaced", withoutSoldClaim("Sales volume is 40. Thin sales. 12 copies sold.") === "");
t("a price path with no sold claim stays", withoutSoldClaim("Talonflame latest price rose from $1.26 on Sep 26 to $1.92 on Oct 3, up 52.4%.") === "Talonflame latest price rose from $1.26 on Sep 26 to $1.92 on Oct 3, up 52.4%.");
const soldRead = {
  id: "move-tcgcsv-593355-30",
  headline: thinHead,
  path: soldPath,
  price: 134.46,
  name: "Prismatic Evolutions Elite Trainer Box",
  source: "TCGplayer market",
  asOf: "2026-10-03",
  href: "/p/tcgcsv-593355",
};
const soldFeed = renderFeed({ asOf: "2026-10-03", reads: [soldRead] }, "", "", { feed: true });
const soldLead = JSON.parse(soldFeed.match(/id="feed-lead">([\s\S]*?)<\/script>/)[1]);
t("the live read drops the sold sentence and keeps the price path", soldLead.length === 1 && soldLead[0].path === "Prismatic Evolutions Elite Trainer Box latest price fell from $154.77 on Sep 3 to $134.46 on Oct 3, down 13.1%." && !soldLead[0].path.includes("copies sold") && !soldLead[0].headline.includes("few sales") && soldLead[0].price === 134.46);
const soldAll = renderAll({ asOf: "2026-10-03", reads: [{ id: "only-sold", headline: "Sales volume is 40 copies sold.", price: 10 }] }, "");
t("all reads leaves out a sentence that is only a sold claim", !soldAll.includes("copies sold") && !soldAll.includes("Sales volume") && !soldAll.includes(">40<"));

t("tracked reads are a signed-in list", (await (await renderPath("/feed/mine", fetchImpl, { feed: true })).text()).includes("My tracked") === false && (await (await renderPath("/feed/mine", fetchImpl, { feed: true })).text()).includes("Sign in with Discord to see your tracked reads."));
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
t("a set page uses a picture only when the file already has one", setHtml.includes("function pictureSrc") && setHtml.includes("row.icon") && setHtml.includes("function cropStyle") && setHtml.includes("The picture is missing.") && setHtml.includes("Sealed line") && !setHtml.includes("tcgplayer-cdn.tcgplayer.com/product/"));
const board = await (await renderPath("/board", fetchImpl, { feed: true })).text();
t("movers keep slabs off the list", board.includes("Slabs") && board.includes("graded feed") && board.includes("Alakazam"));
const post = await (await renderPath("/post-office", fetchImpl)).text();
t("post office drops the catalog line", !post.includes(LOCKED) && !post.includes('id="fresh"'));
const method = await (await renderPath("/methodology", fetchImpl)).text();
t("methodology uses the catalog counts", method.includes("28,030") && method.includes("3,235"));
const badCopy = [stripNews(feedHtml), cardPage, board, method, all].map(clean).filter((html) => BANNED.test(html));
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
const openedHtml = await opened.text();
t("the worker serves the feed when the flag is on", openedHtml.includes("The Feed") && openedHtml.includes(" · <span>") && !openedHtml.includes("Load more"));
t("feed share card has og tags", openedHtml.includes('property="og:title"') && openedHtml.includes("The Feed · Catch&#39;em") && openedHtml.includes('property="og:description"') && openedHtml.includes("Daily market reads") && openedHtml.includes('content="https://catchemtcg.com/feed"') && openedHtml.includes('property="og:image" content="https://catchemtcg.com/og.png"') && openedHtml.includes('name="twitter:card" content="summary_large_image"'));
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
t("the homepage price line points at premium", homeOff.includes('href="/premium"') && homeOff.includes("$14.99/mo") && homeOff.includes("Join the Catch'em Club") && homeOff.includes("See Premium") && homeOff.includes("All site tools stay free.") && homeOff.includes("First 222") && !/lifetime|forever/i.test(homeOff) && !/more entries/i.test(homeOff) && !homeOff.includes("Discord Premium is $14.99"));

t("homepage does not claim a free Premium entry route", !homeOff.includes("free entry route") && !/AMOE|no purchase necessary/i.test(homeOff) && homeOff.includes("Monthly Stadium giveaway auto-entry for Premium") && homeOff.includes("Watch the Stadium live"));
t("the homepage What you get row leads with the Feed", homeOff.includes("<h3>Feed</h3>") && homeOff.includes("Daily market reads.") && homeOff.includes("Weekly and monthly wraps, built with the community.") && homeOff.includes('href="/feed">Open the Feed') && !homeOff.includes("<h3>Sets</h3>") && homeOff.includes('href="/sets">Sets</a>') && homeOff.includes("<h3>Post Office</h3>") && homeOff.includes("<h3>The Community</h3>"));
t("the homepage hero and nav gain a feed link only when the flag is on", (homeOff.match(/href="\/feed"/g) || []).length === 1 && !homeOff.includes('class="btn btn-primary" href="/feed"') && (homeOn.match(/href="\/feed"/g) || []).length === 4 && homeOn.includes('class="btn btn-primary" href="/feed">Feed'));
t("Post Office uses the same gold pill and the same page", homeOn.includes('class="btn btn-primary" href="/post-office">Post Office') && homeOff.includes('class="btn btn-primary" href="/post-office">Post Office') && !homeOn.includes('class="btn btn-ghost" href="/post-office"'));
t("the home screen keeps the wordmark and drops the stacked outline", homeOff.includes('class="brand">Catch\'em<span>.</span>') && !homeOff.includes('class="fan"') && !homeOff.includes(".fan{"));
const abra = "Abra latest price fell from $1.94 on Sep 3 to $1.48 on Oct 3, down 23.7%.";
t("the read starts at the price move and keeps the price, the date, and the percent", readUnderTitle("Abra", abra) === "latest price fell from $1.94 on Sep 3 to $1.48 on Oct 3, down 23.7%.");
t("a name and number come off the front of the read", readUnderTitle("Talonflame - 091/088", "Talonflame - 091/088 latest price rose from $1.26 on Sep 26 to $1.92 on Oct 3, up 52.4%.") === "latest price rose from $1.26 on Sep 26 to $1.92 on Oct 3, up 52.4%.");
t("the latest-price line drops the name and keeps the figures", readUnderTitle("Charizard", "The latest price of Charizard is $944.53 on Oct 3.") === "The latest price is $944.53 on Oct 3." && readUnderTitle("Keldeo (47)", "The latest price of Keldeo (47) is $3.16 on Oct 3.") === "The latest price is $3.16 on Oct 3.");
t("a line that is only the title shows no read", readUnderTitle("Abra", "Abra") === "" && readUnderTitle("Abra", "Abra.") === "" && readUnderTitle("Abra", "") === "");
t("the sentence does not say the name again", !readUnderTitle("Gyarados", "Gyarados latest price rose from $12.00 on Sep 3 to $18.00 on Oct 3, up 50.0%.").includes("Gyarados"));
t("the set and the card id already on the card are shown, and a missing one stays off", cardIdentity({ name: "Gyarados", set: "SV: Scarlet & Violet 151", sku: "tcgcsv-516693" }) === "SV: Scarlet & Violet 151 · tcgcsv-516693" && cardIdentity({ name: "Gyarados", sku: "tcgcsv-516693" }) === "tcgcsv-516693" && cardIdentity({ name: "Gyarados", set: "SV: Scarlet & Violet 151" }) === "SV: Scarlet & Violet 151" && cardIdentity({ name: "Gyarados" }) === "");
const talonPrice = "Talonflame - 091/088 latest price rose from $1.26 on Sep 26 to $1.92 on Oct 3, up 52.4%.";
const gyaraPrice = "Gyarados latest price fell from $1.57 on Sep 18 to $1.36 on Sep 25, down 13.4%.";
t("Talonflame starts at the price move and shows the set and id already on the card", readUnderTitle("Talonflame - 091/088", talonPrice) === "latest price rose from $1.26 on Sep 26 to $1.92 on Oct 3, up 52.4%." && !readUnderTitle("Talonflame - 091/088", talonPrice).includes("Talonflame") && cardIdentity({ name: "Talonflame - 091/088", set: "ME03: Perfect Order", sku: "tcgcsv-684406" }) === "ME03: Perfect Order · tcgcsv-684406");
t("the Talonflame fact stays the English line, with no catalogue and no invented set", pokemonFactLine({ name: "Talonflame", set: "", sku: "pokemon-talonflame", cardCount: 15 }) === "Talonflame has 15 English TCG cards." && !/catalog/i.test(pokemonFactLine({ name: "Talonflame", cardCount: 15 })) && cardIdentity({ name: "Talonflame", set: "", sku: "pokemon-talonflame" }) === "pokemon-talonflame");
t("Gyarados starts at the price move and shows the set and id already on the card", readUnderTitle("Gyarados", gyaraPrice) === "latest price fell from $1.57 on Sep 18 to $1.36 on Sep 25, down 13.4%." && !readUnderTitle("Gyarados", gyaraPrice).includes("Gyarados") && cardIdentity({ name: "Gyarados", set: "SV: Scarlet & Violet 151", sku: "tcgcsv-516693" }) === "SV: Scarlet & Violet 151 · tcgcsv-516693");
t("the Gyarados fact stays the English line, with no catalogue and no invented set", pokemonFactLine({ name: "Gyarados", set: "", sku: "pokemon-gyarados", cardCount: 42 }) === "Gyarados has 42 English TCG cards." && !/catalog/i.test(pokemonFactLine({ name: "Gyarados", cardCount: 42 })) && cardIdentity({ name: "Gyarados", set: "", sku: "pokemon-gyarados" }) === "pokemon-gyarados");
t("a fact keeps its counts and does not start with the name", readUnderTitle("Talonflame", "Talonflame has 15 cards in the catalog, drawn by 14 artists, and the national dex number on those cards is 663.") === "has 15 cards in the catalog, drawn by 14 artists, and the national dex number on those cards is 663.");
const counted = countPublishedReads({ cards: {
  a: { id: "a", kind: "single", asOf: "2026-10-03", path: "A latest price fell from $1.00 on Sep 3 to $1.10 on Oct 3, up 10.0%." },
  b: { id: "b", kind: "sealed", asOf: "2026-09-25", path: "B latest price fell from $2.00 on Sep 1 to $1.50 on Sep 25, down 25.0%." },
  c: { id: "c", kind: "news", readKind: "news", asOf: "2026-10-03", path: "A headline." },
}});
t("catalogue counts use reads in the file, skip news, and name the latest file day", counted && counted.total === 2 && counted.onDay === 1 && counted.day === "2026-10-03");
t("a file with no reads adds nothing", countPublishedReads({ cards: {} }) === null && countPublishedReads({ reads: [{ kind: "news", asOf: "2026-10-03" }] }) === null);
const premium = await worker.fetch(new Request("https://catchemtcg.com/premium"), env);
const premiumHtml = await premium.text();
const lock = "The rate you check out at stays yours while you stay subscribed or on a valid pause. Cancel and the number is retired. If you come back, you pay the public rate then on the site.";
t("premium is a worker page", pageKind("/premium") === "premium" && premium.status === 200);
t("premium pause and cancel sit together", premiumHtml.includes('class="prem-acts"') && premiumHtml.includes(">Pause</a><a href=") && premiumHtml.includes(">Cancel</a>"));
t("premium keeps the lock sentence", premiumHtml.includes(lock));
t("premium skips lifetime, forever, and investing words", !/lifetime|forever/i.test(premiumHtml) && !BANNED.test(premiumHtml) && !/pay to win|more entries/i.test(premiumHtml));
t("premium sells the club", premiumHtml.includes("Join the club.") && premiumHtml.includes("Claim your First 222 number.") && premiumHtml.includes("Hang out with serious collectors, rippers and flippers.") && premiumHtml.includes('class="prem-join"') && premiumHtml.includes("Join Premium") && premiumHtml.includes("$14.99 a month"));
t("premium says Premium members", premiumHtml.includes("Premium members") && !premiumHtml.includes("Pokémon members") && !premiumHtml.includes("Pokemon"));
t("premium hides a missing seat count and the updated line", !premiumHtml.includes("numbers left") && !premiumHtml.includes("Updated ") && !premiumHtml.includes('id="fresh"'));
t("premium drops the internal notes", !premiumHtml.includes("does not take a payment") && !premiumHtml.includes("same weight"));
t("premium has the joining cards and the faq", premiumHtml.includes("What you're joining") && premiumHtml.includes("Early beta access") && premiumHtml.includes("50 AI Ideas a day, not 3") && premiumHtml.includes("Post text is 100 a day, not 3") && premiumHtml.includes("35 a week") && premiumHtml.includes("What's free?") && premiumHtml.includes("Pause up to 2 months in any 12, your number and rate stay.") && premiumHtml.includes("Use /premium in Discord."));

t("premium does not claim free entry or AMOE", !/free entry|AMOE|no purchase necessary|mail-?in/i.test(premiumHtml));
t("premium does not invent ungated perks", !premiumHtml.includes("Vault votes") && !premiumHtml.includes("member-only drops") && !premiumHtml.includes("Premium votes"));
t("premium keeps Stadium auto-entry and watch-only", premiumHtml.includes("monthly Stadium giveaway auto-entry") && premiumHtml.includes("Watching the Stadium for free is fine."));
t("join premium uses the discord flow", premiumHtml.includes('class="prem-join" href="https://discord.gg/fUSjxDX4Hy"') && !premiumHtml.includes("checkout.stripe.com") && !/href="\/(feed|board|receipts|accuracy)/.test(premiumHtml));
t("the chart readout sits above the buttons", feedHtml.includes("chart-readout") && feedHtml.includes("pointerdown") && !feedHtml.includes("chart-hover"));

const fact = {
  id: "pokemon-duraludon",
  sku: "pokemon-duraludon",
  readKind: "pokemon",
  kind: "pokemon",
  name: "Duraludon",
  headline: "Duraludon has 19 cards in the catalog, drawn by 12 artists, and the national dex number on those cards is 884.",
  path: "Duraludon has 19 cards in the catalog, drawn by 12 artists, and the national dex number on those cards is 884.",
  cardCount: 19,
  artistCount: 12,
  dex: 884,
  why: "Card count is cards in data/card-catalogue.json whose data/card-attrs.json dex is 884.",
};
const priced = { id: "move-tcgcsv-10-7", sku: "tcgcsv-10", kind: "single", name: "Alakazam", headline: "Alakazam is up.", price: 12.5, set: "Base Set", path: "Alakazam latest price rose from $10 on Sep 1 to $12.50 on Sep 2, up 25%." };
const emptyFact = { id: "pokemon-missing", readKind: "pokemon", kind: "pokemon", name: "Missing", headline: "Missing has no counts." };
const browseDoc = {
  unfiltered: ["move-tcgcsv-99-7", "move-tcgcsv-10-7"],
  ranked: ["move-tcgcsv-10-7", "move-tcgcsv-99-7"],
  filters: { wave: { items: [] } },
};
t("a fact already in the file stays, and a fact without counts does not", isFactRow(fact) && keepFeedRead(fact) && !isFactRow(emptyFact) && !keepFeedRead(emptyFact));
t("keeping a fact does not invent a price", !(fact.price > 0));
const loop = buildFeedLoop([priced, fact, emptyFact], browseDoc, {});
t("the short front stays first and the shuffled reads already in the file follow", loop.map((r) => r.id).join(",") === "move-tcgcsv-10-7,pokemon-duraludon,move-tcgcsv-99-7");
t("a later file id is not an invented price", loop[2] && loop[2].id === "move-tcgcsv-99-7" && loop[2].pending === true && loop[2].price == null);
const setLoop = buildFeedLoop([priced, fact], browseDoc, { filter: "set", set: "Base Set" });
t("one set still shows the catalogue id", setLoop.some((r) => r.id === "move-tcgcsv-99-7") && setLoop.some((r) => r.id === "move-tcgcsv-10-7"));
t("a pokemon fact says the English count and does not say catalogue", pokemonFactLine(fact) === "Duraludon has 19 English TCG cards." && !/catalog/i.test(pokemonFactLine(fact)));
t("japanese stays off when that count is not on the row", !pokemonFactLine(fact).includes("Japanese"));
t("a japanese count already on the row is said", pokemonFactLine({ ...fact, japaneseCount: 4 }) === "Duraludon has 19 English TCG cards and 4 Japanese TCG cards.");
t("priced cards stay highest first and a blank price stays off", pricedMonCards([
  ["a", "Duraludon", "Set A", "", "", "", 2],
  ["b", "Duraludon V", "Set B", "", "", "", 9],
  ["c", "Duraludon", "Set C", "", "", "", 0],
  ["d", "Other", "Set D", "", "", "", 40],
], "Duraludon").map((row) => row.id).join(",") === "b,a");
const pull = pricedMonCards([
  { id: "move-1", sku: "tcgcsv-1", name: "Duraludon", set: "Base Set", price: 4, image: "https://tcgplayer-cdn.tcgplayer.com/product/1_in_400x400.jpg", href: "/c/tcgcsv-1" },
  { id: "move-2", sku: "tcgcsv-2", name: "Duraludon", set: "Set B", price: 9, cutout: "/cards/visuals/duraludon.png", href: "https://www.tcgplayer.com/product/2" },
  { name: "Duraludon", price: 0 },
], "Duraludon");
t("a pull-down row keeps the price, the set, and the card id, and does not invent a link or a cutout", pull.map((row) => row.id).join(",") === "move-2,move-1" && pull[0].sku === "tcgcsv-2" && pull[0].set === "Set B" && pull[0].price === 9 && pull[0].cutout === "/cards/visuals/duraludon.png" && pull[0].link === "https://www.tcgplayer.com/product/2" && !pull[1].cutout && !pull[1].link && tcgLink({ href: "/c/tcgcsv-1", image: "https://tcgplayer-cdn.tcgplayer.com/product/1_in_400x400.jpg" }) === "");
t("a fact cutout is the one already on that Pokémon", factCutout([{ kind: "cutout", species: "Gyarados", src: "/cards/visuals/gyarados.png" }], "Gyarados") === "/cards/visuals/gyarados.png" && factCutout([{ name: "Gyarados", image: "https://tcgplayer-cdn.tcgplayer.com/product/1.jpg" }], "Gyarados") === "" && factCutout(null, "Talonflame") === "");
const newsDoc = { asOf: "2026-10-02", items: [
  { kind: "news", title: "New merch collection starring Dedenne.", url: "https://example.com/a", source: "Bulbagarden", date: "2026-10-02" },
  { kind: "news", title: "Old recap.", url: "https://example.com/b", source: "PokeBeach", date: "2026-08-01", sentence: "The column looks at an event." },
  { kind: "news", title: "「大会」開催！", url: "https://example.com/c", source: "Pokémon Card (Japan)", date: "2026-10-02", language: "ja", region: "jp", note: "Translation is missing." },
  { kind: "news", title: "「ここから」開催！", titleEn: "Japan: A first event is being held", originalTitle: "「ここから」開催！", url: "https://example.com/d", source: "Pokémon Card (Japan)", date: "2026-10-02", language: "ja", region: "jp" },
  { kind: "news", title: "A new card revealed", url: "https://example.com/e", source: "PokeBeach", date: "2026-08-20" },
  { kind: "news", title: "A box date.", url: "https://example.com/f", source: "PokeBeach", date: "2026-08-01", sentence: "The source says the box releases on October 10, 2026." },
]};
const newsRows = newsSlice(newsDoc);
t("a news slice keeps the English title, the date, and the source link", newsRows.find((row) => row.href === "https://example.com/a").name === "New merch collection starring Dedenne." && newsRows.find((row) => row.href === "https://example.com/a").asOf === "2026-10-02" && newsRows.find((row) => row.href === "https://example.com/a").source === "Bulbagarden");
t("an uncertain translation stays off", !newsRows.some((row) => row.href === "https://example.com/c"));
t("an old item stays off unless it is a new reveal or the source states a release inside two weeks", !newsRows.some((row) => row.href === "https://example.com/b") && newsRows.some((row) => row.href === "https://example.com/e") && newsRows.some((row) => row.href === "https://example.com/f"));
const japan = newsRows.find((row) => row.href === "https://example.com/d");
t("Japan news says it is Japan news and the file keeps the original title", japan && japan.place === "Japan news" && japan.name === "Japan: A first event is being held" && japan.originalTitle === "「ここから」開催！" && japan.href === "https://example.com/d");
t("the news filter does not walk price rows", buildFeedLoop([priced, fact], browseDoc, { filter: "news" }).length === 0);
t("the news filter uses the news file slice", buildFeedLoop([], null, { filter: "news", news: newsDoc }).some((row) => row.href === "https://example.com/d"));
const waveBrowse = {
  unfiltered: ["move-tcgcsv-99-7", "move-tcgcsv-10-7"],
  ranked: ["move-tcgcsv-10-7", "move-tcgcsv-99-7"],
  filters: { wave: { items: [{ title: "Ultra Ball reprint", sentence: "Reprints of Ultra Ball.", source: "PokeBeach", date: "2026-08-24", url: "https://example.com/wave", reprint: "Reprints of Ultra Ball." }] } },
};
const mixed = buildFeedLoop([priced, fact], waveBrowse, { news: newsDoc });
t("the default walk keeps the short front and every price id", mixed[0].id === "move-tcgcsv-10-7" && mixed[1].id === "pokemon-duraludon" && mixed.some((r) => r.id === "move-tcgcsv-99-7" && r.pending === true && r.price == null));
t("the default walk mixes news and wave rows already in the files", mixed.some((r) => r.readKind === "news" && r.href === "https://example.com/d") && mixed.some((r) => r.readKind === "wave" && r.href === "https://example.com/wave" && !(r.price > 0)) && mixed.filter((r) => r.readKind === "news").every((r) => !(r.price > 0)));
t("a ranked prices filter still leaves news and wave out", buildFeedLoop([priced, fact], waveBrowse, { filter: "prices", news: newsDoc }).every((r) => r.readKind !== "news" && r.readKind !== "wave"));
const outlier = {
  id: "outlier-sv5-pc-etb",
  sku: "sv5-pc-etb",
  diveId: "sv5-pc-etb",
  readKind: "outlier",
  kind: "outlier",
  name: "Temporal Forces Pokemon Center Elite Trainer Box",
  headline: "Temporal Forces Pokemon Center Elite Trainer Box ask $499.99 on Oct 6 sits 95.5% above its recent median $255.75 — review.",
  path: "Temporal Forces Pokemon Center Elite Trainer Box ask $499.99 on Oct 6 sits 95.5% above its recent median $255.75 — review.",
  price: 499.99,
  asOf: "2026-10-06",
  flagged: { on: "2026-10-06", at: 499.99, first: true },
};
const dive = {
  id: "dive-sv5-pc-etb",
  sku: "sv5-pc-etb",
  diveId: "sv5-pc-etb",
  readKind: "dive",
  kind: "dive",
  name: "Temporal Forces Pokemon Center Elite Trainer Box",
  headline: "Temporal Forces Pokemon Center Elite Trainer Box: $499.99 on Oct 6. Deeper look on the chart.",
  path: "Temporal Forces Pokemon Center Elite Trainer Box: $499.99 on Oct 6. Deeper look on the chart.",
  price: 499.99,
  asOf: "2026-10-06",
  href: "/dive/sv5-pc-etb",
};
t("outlier and dive rows keep their ids", isOutlierRow(outlier) && isDiveRow(dive) && keepFeedRead(outlier) && keepFeedRead(dive) && outlier.sku === "sv5-pc-etb" && dive.diveId === "sv5-pc-etb");
t("no invented solds on outlier or dive copy", !/\bsolds?\b/i.test(outlier.path) && !/\bsolds?\b/i.test(dive.path));
const flagBrowse = {
  unfiltered: ["move-tcgcsv-10-7"],
  ranked: ["move-tcgcsv-10-7"],
  filters: {
    flagged: { items: [outlier], empty: "No flagged prices." },
    dive: { items: [dive], empty: "No deep dives." },
    wave: { items: [] },
  },
};
t("flagged filter returns outlier rows by id", buildFeedLoop([priced, outlier, dive], flagBrowse, { filter: "flagged" }).map((r) => r.id).includes("outlier-sv5-pc-etb"));
t("dive filter returns dive rows by id", buildFeedLoop([priced, outlier, dive], flagBrowse, { filter: "dive" }).map((r) => r.id).includes("dive-sv5-pc-etb"));
t("prices filter leaves outlier and dive out", buildFeedLoop([priced, outlier, dive], flagBrowse, { filter: "prices" }).every((r) => r.readKind !== "outlier" && r.readKind !== "dive"));
t("default mix includes non-price types when present", buildFeedLoop([priced, fact, outlier, dive], flagBrowse, { news: newsDoc }).some((r) => r.readKind === "news") && buildFeedLoop([priced, fact, outlier, dive], flagBrowse, {}).some((r) => r.readKind === "outlier" || r.readKind === "dive"));
t("flagged and dive empty shelves stay honest", flaggedReads({ filters: { flagged: { items: [] } } }, []).length === 0 && diveReads({ filters: { dive: { items: [] } } }, []).length === 0);

const liveNews = newsSlice(feedNews);
const dedenne = liveNews.find((row) => row.href === "https://bulbagarden.net/threads/new-merch-collection-starring-dedenne-joltik-and-more-electric-types-coming-soon-to-pokemon-centers-in-japan.311717/");
const japanFile = liveNews.find((row) => row.href === "https://www.pokemon-card.com/info/005559.html");
t("the news file has the Dedenne card, its date, and its source link", dedenne && dedenne.asOf === "2026-10-02" && dedenne.source === "Bulbagarden" && dedenne.name.startsWith("New merch collection starring Dedenne"));
t("the Japan card in the news file says Japan news and keeps the original title", japanFile && japanFile.place === "Japan news" && japanFile.asOf === "2026-10-02" && japanFile.originalTitle === "「ここからデビュー！はじめてポケカ体験会」開催！" && japanFile.name.startsWith("Japan:"));
const rankedLoop = buildFeedLoop([priced, fact], browseDoc, { filter: "prices" });
t("a ranked filter stays in ranked order and leaves the fact out", rankedLoop.map((r) => r.id).join(",") === "move-tcgcsv-10-7,move-tcgcsv-99-7" && rankedLoop.every((r) => !(r.readKind === "pokemon")));
t("the pokemon filter is file order, not a shuffle", buildFeedLoop([priced, fact], browseDoc, { filter: "pokemon" }).map((r) => r.id).join(",") === "pokemon-duraludon");
t("premium can hide fact rows", buildFeedLoop([priced, fact], browseDoc, { hideFacts: true }).every((r) => r.id !== "pokemon-duraludon"));
t("the same name is still two cards when the ids differ", buildFeedLoop([
  { id: "base5-3", name: "Blastoise", headline: "Dark Blastoise.", price: 4, kind: "single" },
  { id: "sv3pt5-200", name: "Blastoise", headline: "151 Blastoise.", price: 9, kind: "single" },
], null, {}).map((r) => r.id).join(",") === "base5-3,sv3pt5-200");
const factHtml = renderFeed({ asOf: "2026-09-27", reads: [priced, fact, emptyFact] }, "", "", { premium: true });
const leadJson = JSON.parse(factHtml.match(/id="feed-lead">([\s\S]*?)<\/script>/)[1]);
const keptFact = leadJson.find((r) => r.id === "pokemon-duraludon");
t("the live lead keeps the no-price fact and drops the empty one", keptFact && keptFact.cardCount === 19 && keptFact.dex === 884 && !("price" in keptFact) && !leadJson.some((r) => r.id === "pokemon-missing"));
const monFn = factHtml.slice(factHtml.indexOf("function mountMon"), factHtml.indexOf("function cardEl"));
t("the fact card says the English count, keeps the pull-down closed, and does not change the filters", factHtml.includes("pokemonFactLine(card)") && monFn.includes("pricedMonCards(Array.isArray(lead)?lead:[]") && monFn.includes('className="mon-btn"') && monFn.includes('aria-expanded","false"') && monFn.includes("No priced cards are in the file.") && !monFn.includes("paper-rows") && !monFn.includes("fetch(") && factHtml.includes(">Prices<") && factHtml.includes(">Sealed<") && factHtml.includes(">One set<") && factHtml.includes(">News<") && factHtml.includes(">Pokémon facts<") && factHtml.includes(">Wave and reprint<") && factHtml.includes(">Flagged<") && factHtml.includes(">Dive<") && !factHtml.includes("card.why"));
t("a missing cutout stays on the fact and the news filter says there is no news", factHtml.includes("The cutout is missing.") && factHtml.includes("card && card.name") && factHtml.includes("The picture is missing.") && factHtml.includes("There is no news.") && factHtml.includes("No flagged prices.") && factHtml.includes("No deep dives.") && factHtml.includes("No wave or reprint news.") && !factHtml.slice(factHtml.indexOf("function factCutLine"), factHtml.indexOf("function cardEl")).includes("<img"));
t("a fact with the same headline and path paints that sentence once", factHtml.includes("headline===pathText") && factHtml.includes("sameSentence||line") && factHtml.includes("The cutout is missing.") && !factHtml.slice(factHtml.indexOf("function factCutLine"), factHtml.indexOf("function cardEl")).includes("<img"));
t("premium sees the hide control and the unranked loop walks the shuffled file", factHtml.includes("Hide Pokémon facts") && factHtml.includes("browse.ranked") && factHtml.includes("browse.unfiltered") && !factHtml.includes('id="hide-facts" hidden') && !factHtml.includes("No path is stored") && !factHtml.includes("the last step is"));
t("the unranked loop mixes news and wave rows already on the file", factHtml.includes("Mix news, wave, flagged, and dive rows already on the file into the shuffled walk.") && factHtml.includes("while(ei<extras.length)"));
t("the feed filter keeps every row and uses the site pill", factHtml.includes('id="f-loop"') && factHtml.includes(">All<") && factHtml.includes(">Prices<") && factHtml.includes(">Sealed<") && factHtml.includes(">One set<") && factHtml.includes(">News<") && factHtml.includes(">Pokémon facts<") && factHtml.includes(">Wave and reprint<") && factHtml.includes(">Flagged<") && factHtml.includes(">Dive<") && factHtml.includes("pill-menu-btn") && factHtml.includes("max-width:390px") && factHtml.includes("min-width:1280px") && factHtml.includes("background:#12100e") && factHtml.includes('button[aria-selected="true"]') && factHtml.includes("function readUnderTitle") && factHtml.includes("function dropTitleName") && factHtml.includes("function cardIdentity") && factHtml.includes("card-meta") && factHtml.includes("isFact(card)?pokemonFactLine(card):moveLine(card)") && factHtml.includes("if(!path) return \"\";") && !factHtml.includes("__name") && !factHtml.includes("No path is stored") && !factHtml.includes("the last step is"));
t("ATH ATL copy uses filled triangle words", factHtml.includes("▲ high") && factHtml.includes("▼ low"));
const shippingCard = '<h2>Correction log</h2><div class="c"><div class="d">2026-08-23 <span class="chip m">AFFECTED A PUBLISHED NUMBER</span></div><div class="w">shipping comparison</div></div><div class="c"><div class="w">auto-fix rewrote a price</div></div><h2>Kept</h2>';
const hiddenNotes = hidePublishedNotes(shippingCard);
t("a public page drops the correction log and the shipping card", !hiddenNotes.includes("Correction log") && !hiddenNotes.includes("AFFECTED A PUBLISHED NUMBER") && !/auto-fix/i.test(hiddenNotes) && hiddenNotes.includes("Kept"));
const searchHtml = renderSearch();
t("search stays capped at 40, highest stored value first, with no price on the hit", searchHtml.includes("searchCatalog(q, rows, 40)") && searchHtml.includes("rankCatalog(q, rows, 40)") && searchHtml.includes(".slice(0,40)") && searchHtml.includes("return y-x") && !searchHtml.includes("money(r[6])") && !searchHtml.includes("No market price"));

const lagLine = "SV: Prismatic Evolutions: Prismatic Evolutions Booster Pack latest price rose from $8.00 on Sep 3 to $9.00 on Oct 3, up 12.5%. The booster box is $134.46 on Oct 3, the same price as $134.46 on Sep 3. Singles in the set with a price on both days: 4 up, 0 down, 1 unchanged.";
const lag = {
  id: "lag-prismatic",
  readKind: "lag",
  kind: "lag",
  name: "SV: Prismatic Evolutions",
  headline: lagLine,
  path: lagLine,
  pack: { from: 8, fromDate: "2026-09-03", to: 9, toDate: "2026-10-03" },
  box: { from: 134.46, fromDate: "2026-09-03", to: 134.46, toDate: "2026-10-03" },
};
const lagHalf = { id: "lag-half", readKind: "lag", kind: "lag", headline: "Pack only.", pack: { from: 8, fromDate: "2026-09-03", to: 9, toDate: "2026-10-03" } };
const supply = { id: "supply-one", readKind: "supply", kind: "supply", headline: "Listing total for this product.", listings: 42, listingsAsOf: "2026-10-03" };
const supplyBlank = { id: "supply-blank", readKind: "supply", kind: "supply", headline: "No listing total on the row." };
t("a lag stays only when both prices and the dates are on the row", isLagRow(lag) && keepFeedRead(lag) && !isLagRow(lagHalf) && !keepFeedRead(lagHalf));
t("a supply row is the listing total, and a missing total stays out", isSupplyRow(supply) && keepFeedRead(supply) && !isSupplyRow(supplyBlank) && !keepFeedRead(supplyBlank));
t("two files that disagree on price or listings leave the product out", filesDisagree({ id: "tcgcsv-1", price: 10, listings: 5 }, { price: 11, listings: 5 }) && filesDisagree({ listings: 4 }, { listings: 9 }) && !filesDisagree({ price: 10 }, { price: 10 }) && !filesDisagree({ price: 10 }, { listings: 4 }));
const built = renderFeed({ asOf: "2026-10-03", reads: [priced, fact, lag, lagHalf, supply, supplyBlank] }, "", "", {});
const builtLead = JSON.parse(built.match(/id="feed-lead">([\s\S]*?)<\/script>/)[1]);
t("the feed build keeps a move, a lag, a supply line, and a fact", builtLead.map((r) => r.id).join(",") === "move-tcgcsv-10-7,pokemon-duraludon,lag-prismatic,supply-one");
t("the feed build has no volume line", !built.includes("No sales count yet") && !built.includes("Sales volume") && !builtLead.some((r) => r.id === "lag-half" || r.id === "supply-blank"));


t("a newer card price disagrees with the older read", readStaleAgainstCard(
  { sku: "tcgcsv-516693", readKind: "price", kind: "single", price: 1.36, asOf: "2026-09-25" },
  { id: "tcgcsv-516693", price: 0.39, asOf: "2026-09-27" },
) === true);
t("an older card price does not drop a later read", readStaleAgainstCard(
  { sku: "tcgcsv-684406", readKind: "price", kind: "single", price: 1.92, asOf: "2026-10-03" },
  { id: "tcgcsv-684406", price: 1.44, asOf: "2026-09-27" },
) === false);
t("a fact is not dropped as a stale price", readStaleAgainstCard(
  { sku: "pokemon-gyarados", readKind: "pokemon", kind: "pokemon", asOf: "2026-09-25" },
  { id: "tcgcsv-516693", price: 0.39, asOf: "2026-09-27" },
) === false);
const staleFiles = {
  ...files,
  "reads.json": { asOf: "2026-10-03", reads: [
    { id: "move-tcgcsv-684406-7", sku: "tcgcsv-684406", kind: "single", readKind: "price", name: "Talonflame - 091/088", headline: "Talonflame price.", path: "Talonflame - 091/088 latest price rose from $1.26 on Sep 26 to $1.92 on Oct 3, up 52.4%.", price: 1.92, asOf: "2026-10-03" },
    { id: "move-tcgcsv-516693-7", sku: "tcgcsv-516693", kind: "single", readKind: "price", name: "Gyarados", headline: "Gyarados price.", path: "Gyarados latest price fell from $1.57 on Sep 18 to $1.36 on Sep 25, down 13.4%.", price: 1.36, asOf: "2026-09-25" },
    { id: "pokemon-gyarados", sku: "pokemon-gyarados", readKind: "pokemon", kind: "pokemon", name: "Gyarados", headline: "Gyarados has 42 cards in the catalog, drawn by 22 artists, and the national dex number on those cards is 130.", path: "Gyarados has 42 cards in the catalog, drawn by 22 artists, and the national dex number on those cards is 130.", cardCount: 42, artistCount: 22, dex: 130 },
  ]},
  "buckets/06.json": [{ id: "tcgcsv-684406", name: "Talonflame - 091/088", price: 1.44, asOf: "2026-09-27" }],
  "buckets/93.json": [{ id: "tcgcsv-516693", name: "Gyarados", price: 0.39, asOf: "2026-09-27" }],
};
const staleFetch = async (url) => {
  const rel = String(url).split("/public/")[1];
  if (!staleFiles[rel]) return { ok: false, status: 404, json: async () => null, text: async () => "" };
  return { ok: true, status: 200, json: async () => staleFiles[rel], text: async () => JSON.stringify(staleFiles[rel]) };
};
resetJsonCache();
const staleHtml = await (await renderPath("/feed", staleFetch, { feed: true })).text();
const staleLead = JSON.parse(staleHtml.match(/id="feed-lead">([\s\S]*?)<\/script>/)[1]);
t("the feed keeps Talonflame and the Gyarados fact, and drops the older Gyarados price", staleLead.map((r) => r.id).join(",") === "move-tcgcsv-684406-7,pokemon-gyarados");
t("the feed asks the card file before it shows that price", staleHtml.includes("function readStaleAgainstCard") && staleHtml.includes("function stalePrice"));

if (fail) process.exit(1);
console.log("rebuild routes ok");
