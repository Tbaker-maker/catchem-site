import worker, { pageKind, renderPath } from "../src/index.mjs";
import vm from "node:vm";
import { esc, renderSets, renderMine, isVolumeRow, isShapeRow, soldSafeText, volumeReads, renderAll, renderDive, renderFeed, keepFeedRead, isFactRow, isLagRow, isSupplyRow, filesDisagree, readStaleAgainstCard, buildFeedLoop, renderSearch, pokemonFactLine, pricedMonCards, readUnderTitle, shownRead, isSealedProductRow, cardIdentity, countPublishedReads, newsSlice, factCutout, tcgLink, withoutSoldClaim, isOutlierRow, isDiveRow, flaggedReads, diveReads, renderSetShell, renderMethod, renderPremium, renderPost, renderPokemon, renderSupply, gapChartSvg, splitDated, exactWindowPct, listingTrend, rangeMarker, renderTrackRecord, renderToday } from "../src/ui.mjs";
import { imageForId, brandedTile, officialSrc, newsTile, visualGaps } from "../src/catalogue-image.mjs";
import { isFeedPath, redirectPath } from "../src/feed.mjs";
import { hidePublishedNotes } from "./public-routes.mjs";
import { localPaths, scriptFetchPaths, deadLocals } from "./dead-paths.mjs";
import { readFile } from "node:fs/promises";
import { resetJsonCache } from "../src/data.mjs";
import { buildPokemonPages, productLink } from "../src/pokemon.mjs";
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
  "catalogue-images.json": { source: "Post Office catalogue. Match by id only.", images: { "tcgcsv-10": "/img/base1/1", "base1-4": "/cards/seed/base1-4.png" } },
  "today.json": {
    asOf: "2026-10-09",
    supply: "off",
    lines: [
      { slot: "mover", text: "Pidgey (Base Set, 1999, #57) is up 74.2% this month: $1.51 → $2.63.", href: "/c/tcgcsv-42401" },
      { slot: "high", text: "Rebel Clash Booster Pack (Rebel Clash, 2020) hit a 6-month high: $12.55, up 33.5% in 90 days.", href: "/p/tcgcsv-210562" },
      { slot: "fact", text: "Pidgey (#16): 17 cards, 14 artists.", note: "Species fact on the short list. No set move was shipped." },
      { slot: "news", text: "Mega Evolution - Delta Reign (PokeGuardian, 2026-11-06).", href: "https://www.pokeguardian.com/3231721_pokemon-tcg-mega-evolution-delta-reign-teased-november-release" },
    ],
  },
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

t("catalogue image is the id hit only", imageForId({ "base1-1": "/img/base1/1" }, "base1-1") === "/data/editor/tcg/base1/1_hires.png" && imageForId({ a: "https://images.pokemontcg.io/base1/1.png" }, "a") === "" && imageForId({ "sv3pt5-200": "/cards/seed/sv3pt5-200.png" }, "sv3pt5-200").endsWith("/research/assets/cards/seed/sv3pt5-200.png") && imageForId({ "base1-1": "/img/base1/1" }, "tcgcsv-10") === "" && brandedTile("logo").includes("tile-logo") && brandedTile("card").includes("Catch'em"));
const japanNews = newsTile({ id: "jp-news", source: "Pokémon Card (Japan)", place: "Japan news", asOf: "2026-10-02" });
const enNews = newsTile({ id: "en-news", source: "Bulbagarden", place: "", asOf: "2026-10-01" });
const newsLooks = new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => (newsTile({ id, source: "S", asOf: "2026-10-02" }).match(/news-tile v(\d)/) || [])[1]));
t("news is a Catch'em tile, never a source preview", japanNews.includes("news-tile") && japanNews.includes("Japan news") && japanNews.includes("Oct 2, 2026") && japanNews.includes("Pokémon Card (Japan)") && enNews.includes("Bulbagarden") && enNews.includes("Oct 1, 2026") && !enNews.includes("Japan news") && !japanNews.includes("og:image") && newsLooks.size >= 2);
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
  const withChange = renderDive({
    id: "cel25-etb", name: "Celebrations Elite Trainer Box", asOf: "2026-10-06",
    series: [{ date: "2026-10-06", price: 161.99, listingCount: 29 }],
    latest: { id: "cel25-etb", set: "Celebrations", subtype: "etb", priceMedian: 161.99, listingCount: 29 },
    volume: null, volumeNote: "Sold counts need Insights scope.",
    listingChange: { label: "net change in active eBay listings (estimate)", net: 191, from: "2026-10-04", to: "2026-10-06", days: 3, startTotal: 3881, endTotal: 4072, readEligible: false },
  }, "stamp", { feed: true });
  t("dive shows the listing-change estimate with its exact label and day count", withChange.includes("net change in active eBay listings (estimate): <b>+191</b> over 3 days of eBay Browse totals (2026-10-04 to 2026-10-06)"));
  const changeBit = withChange.slice(withChange.indexOf("net change in active eBay listings"), withChange.indexOf("</p>", withChange.indexOf("net change in active eBay listings")));
  t("the estimate never says sold or sell-through", !/\bsold\b|sell-through/i.test(changeBit));
  const wrongLabel = renderDive({ id: "x", name: "X", series: [], latest: {}, listingChange: { label: "sold", net: 5, days: 3, from: "a", to: "b" } }, "stamp", { feed: true });
  t("an estimate without the exact label is not shown", !wrongLabel.includes("over 3 days of eBay Browse totals"));
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
t("a sealed id missing from the catalogue uses its tcgplayer id", cardPage.includes("/api/card-img?pid=503313") && !cardPage.includes("tcgplayer-cdn.tcgplayer.com") && !cardPage.includes("images.pokemontcg.io"));
t("a row with no id match is the branded tile", officialSrc({ id: "no-such", kind: "sealed", name: "Mystery Box" }, {}).src === "" && brandedTile("sealed", { kind: "sealed", name: "Elite Trainer Box" }).includes("ETB") && brandedTile("row", { kind: "single", name: "Mew" }).includes("Single"));
}

t("catalog cards and shorts have kinds", pageKind("/c/tcgcsv-10") === "card" && pageKind("/p/tcgcsv-10") === "product" && pageKind("/feed") === "feed" && pageKind("/feed/r/heating-tcgcsv-10") === "feed" && pageKind("/pokemon/lickitung") === "pokemon");
t("pulse is redirected, not the baked shorts", !isFeedPath("/pulse") && !isFeedPath("/feed"));
t("app and try still go to the feed", redirectPath("/app/") === "/feed" && redirectPath("/try/index.html") === "/feed");
const escaped = esc("A & B <x>");
t("esc keeps markup out of a name", escaped.includes("amp;") && escaped.includes("lt;") && escaped.includes("gt;") && !escaped.includes("<"));

const hidden = await renderPath("/feed", fetchImpl);
t("feed is hidden without the flag", hidden.status === 302 && hidden.headers.get("location") === "/");

{
  const off = renderSupply({
    enabled: false,
    asOf: "2026-10-09",
    nightCount: 19,
    products: 183,
    productsOnLatest: 177,
    wouldQualify: 0,
    windows: { "7": { qualify: 0, exactStart: "2026-10-02", exactStartOnFile: false, productsWithBothDays: 1 }, "30": { qualify: 0, exactStart: "2026-09-09", exactStartOnFile: false, productsWithBothDays: 0 } },
    belowGate: [{ name: "Unbroken Bonds Booster Box", pct: -5.6, from: 18, to: 17, fromDate: "2026-08-19", toDate: "2026-08-26" }],
    reads: [{ sentence: "Fewer copies listed: should not show" }],
  }, "stamp");
  t("supply page stays off and does not publish a read", off.includes("This read is off") && off.includes("0 would qualify") && off.includes("Unbroken Bonds Booster Box") && off.includes("not sales") && !off.includes("should not show") && !/\bholds?\b/i.test(off));
  const segs = splitDated([
    { date: "2026-10-05", listings: 140 },
    { date: "2026-10-07", listings: 109 },
  ], "listings");
  const chart = gapChartSvg(segs);
  t("a missing night is a gap in the chart", segs.length === 2 && chart.split("<path").length === 3);
  const on = renderSupply({
    enabled: true,
    asOf: "2026-10-09",
    wouldQualify: 1,
    windows: { "7": { qualify: 1, exactStart: "2026-10-02", exactStartOnFile: true, productsWithBothDays: 1 }, "30": { qualify: 0, exactStart: "2026-09-09", exactStartOnFile: false, productsWithBothDays: 0 } },
    reads: [{
      sentence: "Fewer copies listed: Surging Sparks ETB eBay listings fell 22.1% in 7 days (140 → 109).",
      wrong: "What would make this wrong: either exact night is missing, the listing change is under 15%, or a listing was treated as a sale.",
      series: [
        { date: "2026-10-05", ask: 16.98, listings: 140 },
        { date: "2026-10-07", ask: 16.98, listings: 109 },
      ],
    }],
  }, "stamp");
  t("a kept supply read draws both lines and the wrong-check", on.includes("The read is on") && on.includes("140 → 109") && on.includes("What would make this wrong") && on.includes("eBay listings") && on.split("<path").length >= 3);
}

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

t("tracked reads stay on this device", (await (await renderPath("/feed/mine", fetchImpl, { feed: true })).text()).includes("Nothing saved on this device yet.") && (await (await renderPath("/feed/mine", fetchImpl, { feed: true })).text()).includes("catchem-watch") && !(await (await renderPath("/feed/mine", fetchImpl, { feed: true })).text()).includes("Sign in with Discord to see your tracked reads."));
const all = await (await renderPath("/feed/all", fetchImpl, { feed: true })).text();
t("all reads is a list", all.includes("All reads") && all.includes("Alakazam"));
const setPage = await renderPath("/sets/missing", fetchImpl);
t("a missing set is not a generic redirect", setPage.status === 404);
const known = await renderPath("/sets/base1", fetchImpl);
t("a known old set slug is one hop", known.status === 301 && known.headers.get("location") === "/sets/base-set");
const cardPage = await (await renderPath("/c/tcgcsv-10", fetchImpl)).text();
t("a card page has the market price", cardPage.includes("$12.50") && cardPage.includes("TCGplayer market") && cardPage.includes("Ken Sugimori") && cardPage.includes("7D —") && cardPage.includes("30D —") && cardPage.includes("90D —") && cardPage.includes("6-month high —") && cardPage.includes("No reads on file") === false && cardPage.includes("Alakazam is heating up"));
t("a missing exact day is a dash, not the nearest night", exactWindowPct([["2026-10-01", 10], ["2026-10-09", 8]], 7, "2026-10-09") === null && exactWindowPct([["2026-10-02", 10], ["2026-10-09", 8]], 7, "2026-10-09") === -20);
t("sealed listings use the exact night or a dash", listingTrend([{ date: "2026-08-20", listingCount: 40 }, { date: "2026-10-06", listingCount: 35 }], "2026-10-06") === "eBay listings 7D — · 30D —");
t("a 6-month marker needs the day 183 back", rangeMarker([["2026-09-26", 12], ["2026-10-09", 10]], "2026-10-09").text.startsWith("6-month high —"));
{
  const page = renderTrackRecord({
    asOf: "2026-10-09",
    oldest: "2026-10-09",
    count: 2,
    tooEarly: 1,
    noLaterPrice: 1,
    scored7: 0,
    scored30: 0,
    types: [{ type: "price", reads: 1, tooEarly: 1, noLaterPrice: 0, scored7: 0, hit7: 0, scored30: 0, hit30: 0 }],
    rows: [
      { status: "too-early", shipped: "2026-10-09", headline: "Pidgey is up 74.2% this month: $1.51 → $2.63." },
      { status: "no-score", shipped: "2026-10-09", headline: "Pidgey (#16): 17 cards, 14 artists.", note: "The read has no date, product id, or price." },
    ],
  }, "stamp");
  t("track record shows too early and does not invent a hit rate", page.includes("Too early to score") && page.includes("Scored at 7 days: 0") && page.includes("17 cards, 14 artists") && !page.includes("tcgcsv-"));
}
{
  const today = await (await renderPath("/today", fetchImpl)).text();
  const visible = today.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
  t("today lists the morning lines and keeps the listings line off", pageKind("/today") === "today" && today.includes("<h1>Today</h1>") && today.includes("Biggest move") && today.includes("74.2%") && today.includes("$12.55") && today.includes("The listings line is off.") && today.includes("Delta Reign") && today.includes("No set move was shipped.") && today.includes("Share card") && today.includes("catchem-today.png") && !visible.includes("tcgcsv"));
  const drawn = renderToday({ asOf: "2026-10-09", supply: "on", lines: [{ slot: "supply", text: "Fewer copies listed: Unbroken Bonds Booster Box eBay listings fell 5.6% in 7 days (18 → 17)." }] }, "");
  t("a kept listings line is the only supply sentence", drawn.includes("Fewer copies listed") && !drawn.includes("The listings line is off."));
}
t("a card picture is the catalogue hit for that id", cardPage.includes("/data/editor/tcg/base1/1_hires.png") && !cardPage.includes("tcgplayer-cdn.tcgplayer.com") && !cardPage.includes("images.pokemontcg.io"));
t("a card page does not link the hidden pages", !/href="\/(feed|board|receipts|accuracy|movers)/.test(cardPage));
const setHtml = await (await renderPath("/sets/base", fetchImpl)).text();
t("a set page does not link the hidden pages", !/href="\/(feed|board|receipts|accuracy|movers)/.test(setHtml));
t("a set page uses the catalogue id or the branded tile", setHtml.includes("function pictureSrc") && setHtml.includes("row.icon") && setHtml.includes("function cropStyle") && setHtml.includes("brandedTile") && setHtml.includes("catalogue-images.json") && setHtml.includes("/api/card-img?pid=") && setHtml.includes("Sealed line") && !setHtml.includes("tcgplayer-cdn.tcgplayer.com/product/") && !setHtml.includes("images.pokemontcg.io") && !setHtml.includes("String(data.logo)") && !setHtml.includes("The picture is missing."));
t("a visible row has a picture or a branded tile", visualGaps(cardPage).length === 0 && visualGaps(setHtml).length === 0 && visualGaps(renderSearch()).length === 0 && visualGaps((await (await renderPath("/artists/ken-sugimori", fetchImpl)).text())).length === 0 && visualGaps((await (await renderPath("/board", fetchImpl, { feed: true })).text())).length === 0);
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
t("the homepage price line points at premium", homeOff.includes('href="/premium"') && homeOff.includes("$14.99/mo") && homeOff.includes("Join the Catch'em Club") && homeOff.includes("See Premium") && homeOff.includes("All site tools stay free.") && homeOff.includes("The Premium role and your numbered First 222 role") && !homeOff.includes("Early beta access") && !homeOff.includes("bigger limits") && !homeOff.includes("Private channels") && !/lifetime|forever/i.test(homeOff) && !/more entries/i.test(homeOff) && !homeOff.includes("Discord Premium is $14.99"));

t("homepage does not claim a free Premium entry route", !homeOff.includes("free entry route") && !/AMOE|no purchase necessary/i.test(homeOff) && !homeOff.includes("giveaway auto-entry") && homeOff.includes("Watch the Stadium live"));
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
t("the Talonflame fact is the short count, with no catalogue and no invented set", pokemonFactLine({ name: "Talonflame", set: "", sku: "pokemon-talonflame", cardCount: 15, artistCount: 8, dex: 662 }) === "Talonflame (#662): 15 cards, 8 artists." && !/catalog/i.test(pokemonFactLine({ name: "Talonflame", cardCount: 15, artistCount: 8, dex: 662 })) && cardIdentity({ name: "Talonflame", set: "", sku: "pokemon-talonflame" }) === "pokemon-talonflame");
t("Gyarados starts at the price move and shows the set and id already on the card", readUnderTitle("Gyarados", gyaraPrice) === "latest price fell from $1.57 on Sep 18 to $1.36 on Sep 25, down 13.4%." && !readUnderTitle("Gyarados", gyaraPrice).includes("Gyarados") && cardIdentity({ name: "Gyarados", set: "SV: Scarlet & Violet 151", sku: "tcgcsv-516693" }) === "SV: Scarlet & Violet 151 · tcgcsv-516693");
t("the Gyarados fact is the short count, with no catalogue and no invented set", pokemonFactLine({ name: "Gyarados", set: "", sku: "pokemon-gyarados", cardCount: 42, artistCount: 11, dex: 130 }) === "Gyarados (#130): 42 cards, 11 artists." && !/catalog/i.test(pokemonFactLine({ name: "Gyarados", cardCount: 42, artistCount: 11, dex: 130 })) && cardIdentity({ name: "Gyarados", set: "", sku: "pokemon-gyarados" }) === "pokemon-gyarados");
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
t("premium has the joining card and the faq", premiumHtml.includes("What you're joining") && premiumHtml.includes("Your First 222 number + Premium role") && premiumHtml.includes("Cancelling stops the next renewal. 7-day refund on the first charge.") && !premiumHtml.includes("Early beta access") && !premiumHtml.includes("Private member channels") && !premiumHtml.includes("Bigger tool limits") && !premiumHtml.includes("50 AI Ideas") && premiumHtml.includes("What's free?") && premiumHtml.includes("Pause up to 2 months in any 12, your number and rate stay.") && premiumHtml.includes("Use /premium in Discord."));
const paid = await (await worker.fetch(new Request("https://catchemtcg.com/?premium=success"), env)).text();
const stopped = await (await worker.fetch(new Request("https://catchemtcg.com/premium?premium=cancel"), env)).text();
t("a paid return names the role and the number", paid.includes("Payment sent.") && paid.includes("Discord Premium turns on when the payment lands. You get the Premium role and a First 222 number in Discord. Then run /pull week."));
t("a canceled checkout says nothing was charged", stopped.includes("No charge.") && stopped.includes("Checkout was canceled. Nothing was charged. Run /premium in Discord when you want to try again."));

t("premium does not claim free entry or AMOE", !/free entry|AMOE|no purchase necessary|mail-?in/i.test(premiumHtml));
t("premium does not invent ungated perks", !premiumHtml.includes("Vault votes") && !premiumHtml.includes("member-only drops") && !premiumHtml.includes("Premium votes"));
t("premium does not promise a Stadium giveaway auto-entry", !premiumHtml.includes("monthly Stadium giveaway auto-entry") && !premiumHtml.includes("giveaway auto-entry") && premiumHtml.includes("Watching the Stadium for free is fine."));
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
t("one set matches the slug already stored on the row", buildFeedLoop([{ ...priced, set: "Other", setSlug: "base-set" }], browseDoc, { filter: "set", set: "base-set" }).some((r) => r.id === "move-tcgcsv-10-7" && r.setSlug === "base-set"));
t("one set with nothing picked does not repeat prices", buildFeedLoop([priced, fact], browseDoc, { filter: "set" }).length === 0);
t("a pokemon fact says the short count and does not say catalogue", pokemonFactLine(fact) === "Duraludon (#884): 19 cards, 12 artists." && !/catalog/i.test(pokemonFactLine(fact)));
t("japanese stays off when that count is not on the row", !pokemonFactLine(fact).includes("Japanese"));
t("a japanese count already on the row is not added", pokemonFactLine({ ...fact, japaneseCount: 4 }) === "Duraludon (#884): 19 cards, 12 artists.");
{
  const attrs = { "sv5-180": { dex: 108 }, "base4-48": { dex: 108 }, "sv5-124": { dex: 108 }, "sm11-161": { dex: 108 } };
  const catalogue = {
    "sv5-180": { name: "Lickitung", artist: "A", setName: "Temporal Forces", number: "180", price: 30.28, priceUpdatedAt: "2026/08/22", priceFinish: "holofoil", priceSource: "tcgplayer via pokemontcg.io", releaseDate: "2024/03/22", tcgPlayerId: 542901 },
    "base4-48": { name: "Lickitung", artist: "B", setName: "Base Set 2", number: "48", price: 2.02, priceUpdatedAt: "2026/08/22", priceFinish: "normal", priceSource: "tcgplayer via pokemontcg.io", releaseDate: "2000/02/24" },
    "sv5-124": { name: "Lickitung", artist: "A", setName: "Temporal Forces", number: "124", price: 0.22, priceUpdatedAt: "2026/08/22", priceSource: "tcgplayer via pokemontcg.io", releaseDate: "2024/03/22" },
    "sm11-161": { name: "Lickitung", artist: "C", setName: "Unified Minds", number: "161", releaseDate: "2019/08/02" },
  };
  const built = buildPokemonPages(attrs, catalogue);
  const lick = built.bySlug.lickitung;
  const withPics = { ...lick, cards: lick.cards.map((card) => ({ ...card, image: card.id === "sm11-161" ? "" : "/data/editor/tcg/" + card.id + ".png" })) };
  const page = renderPokemon(withPics, "");
  const words = page.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");
  const order = [...page.matchAll(/<span class="num">([^<]*)<\/span>/g)].map((m) => m[1]).join(",");
  t("a Pokémon page is every catalog card for that dex, highest price first", lick.cardCount === 4 && lick.cards.length === 4 && order === "180,48,124,161");
  t("the page names the card, the set, and the number, and hides ids", page.includes(">Lickitung<") && page.includes("Temporal Forces") && page.includes("Base Set 2") && page.includes("Unified Minds") && !words.includes("tcgcsv") && !words.includes("base4-48") && !words.includes("pokemon-lickitung") && !words.includes("The picture is missing.") && !words.includes("The cutout is missing."));
  t("a stored price keeps its date, and a card with no price says so", page.includes("TCGplayer market") && page.includes("$30.28") && page.includes("Aug 22, 2026") && page.includes("No price yet") && (page.match(/No price yet/g) || []).length === 1);
  t("a TCGplayer link is only the stored product id", page.includes('href="https://www.tcgplayer.com/product/542901"') && page.includes(">TCGplayer<") && (page.match(/tcgplayer\.com\/product\//g) || []).length === 1 && productLink({ name: "Lickitung" }) === "" && productLink({ id: "base4-48", name: "Lickitung" }) === "");
  t("a missing catalogue picture is a branded tile", page.includes('class="tile tile-card"') && page.includes('src="/data/editor/tcg/sv5-180.png"') && page.includes("loading=\"lazy\"") && page.includes("mon-grid") && page.includes("repeat(2,minmax(0,1fr))") && page.includes("min-width:768px") && page.includes("min-width:1280px") && page.includes("Set order"));
  t("the hero without a cutout is the branded tile", page.includes('class="poke-hero"') && !page.includes("The cutout is missing"));
}
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
  { kind: "news", title: "A new Pokémon TCG set is out.", url: "https://example.com/a", source: "Bulbagarden", date: "2026-10-02", sentence: "The file says a new Pokémon TCG set is out. A second sentence stays. A third sentence stays off." },
  { kind: "news", title: "New merch collection starring Dedenne.", url: "https://example.com/merch", source: "Bulbagarden", date: "2026-10-02", sentence: "The Pokémon Company announced a merch collection." },
  { kind: "news", title: "Get codes for the Pokémon GO Night Out.", url: "https://example.com/go", source: "Pokémon GO", date: "2026-10-02", sentence: "Get codes for the Pokémon GO Night Out." },
  { kind: "news", title: "A new scout in Pokémon Masters EX.", url: "https://example.com/masters", source: "Bulbagarden", date: "2026-10-02" },
  { kind: "news", title: "Pokémon Horizons episode review.", url: "https://example.com/anime", source: "Bulbagarden", date: "2026-10-02", sentence: "This episode of the anime looks at a town." },
  { kind: "news", title: "Pokémon GO celebrates the Pokémon TCG.", url: "https://example.com/go-tcg", source: "Pokémon GO", date: "2026-10-02", sentence: "A Pokémon TCG event is live." },
  { kind: "news", title: "Old recap.", url: "https://example.com/b", source: "PokeBeach", date: "2026-08-01", sentence: "The column looks at an event." },
  { kind: "news", title: "「大会」開催！", url: "https://example.com/c", source: "Pokémon Card (Japan)", date: "2026-10-02", language: "ja", region: "jp", note: "Translation is missing." },
  { kind: "news", title: "「ここから」開催！", titleEn: "Japan: A first event is being held", originalTitle: "「ここから」開催！", url: "https://example.com/d", source: "Pokémon Card (Japan)", date: "2026-10-02", language: "ja", region: "jp" },
  { kind: "news", title: "A new card revealed", url: "https://example.com/e", source: "PokeBeach", date: "2026-08-20" },
  { kind: "news", title: "A booster box date.", url: "https://example.com/f", source: "PokeBeach", date: "2026-08-01", sentence: "The source says the booster box releases on October 10, 2026.", setDate: "November 6th", product: "Booster Box" },
]};
const newsRows = newsSlice(newsDoc);
const keptA = newsRows.find((row) => row.href === "https://example.com/a");
t("a news slice keeps the English title, the date, and the source link", keptA && keptA.name === "A new Pokémon TCG set is out." && keptA.asOf === "2026-10-02" && keptA.dayLabel === "Oct 2, 2026" && keptA.source === "Bulbagarden" && keptA.summary === "The file says a new Pokémon TCG set is out. A second sentence stays.");
t("an uncertain translation stays off", !newsRows.some((row) => row.href === "https://example.com/c"));
t("an old item stays off unless the source states a release inside two weeks", !newsRows.some((row) => row.href === "https://example.com/b") && !newsRows.some((row) => row.href === "https://example.com/e") && newsRows.some((row) => row.href === "https://example.com/f"));
t("news keeps Pokémon TCG and drops GO, games, anime, and merch", newsRows.some((row) => row.href === "https://example.com/go-tcg") && !newsRows.some((row) => row.href === "https://example.com/go") && !newsRows.some((row) => row.href === "https://example.com/masters") && !newsRows.some((row) => row.href === "https://example.com/anime") && !newsRows.some((row) => row.href === "https://example.com/merch"));
const boxDate = newsRows.find((row) => row.href === "https://example.com/f");
t("a news row keeps the product and set date already in the file", boxDate && boxDate.details.some((row) => row.label === "Product" && row.value === "Booster Box") && boxDate.details.some((row) => row.label === "Set date" && row.value === "November 6th"));
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
const sealedRow = {
  id: "move-tcgcsv-242811-90",
  sku: "tcgcsv-242811",
  kind: "sealed",
  name: "Celebrations Elite Trainer Box",
  set: "Celebrations",
  setSlug: "celebrations",
  headline: "Celebrations Elite Trainer Box is up.",
  path: "Celebrations Elite Trainer Box is up.",
  price: 356.56,
};
t("sealed is a kind and an id, not a product name", isSealedProductRow(sealedRow) && !isSealedProductRow(dive) && !isSealedProductRow({ kind: "sealed" }) && !/elite trainer box/i.test(isSealedProductRow.toString()));
t("sealed filter keeps kind sealed and drops a dive name match", buildFeedLoop([priced, sealedRow], flagBrowse, { filter: "sealed" }).map((r) => r.id).join() === "move-tcgcsv-242811-90");
t("sealed filter is empty when no row has kind sealed", buildFeedLoop([priced, dive], flagBrowse, { filter: "sealed" }).length === 0);
t("prices filter leaves outlier and dive out", buildFeedLoop([priced, outlier, dive], flagBrowse, { filter: "prices" }).every((r) => r.readKind !== "outlier" && r.readKind !== "dive"));
t("default mix includes non-price types when present", buildFeedLoop([priced, fact, outlier, dive], flagBrowse, { news: newsDoc }).some((r) => r.readKind === "news") && buildFeedLoop([priced, fact, outlier, dive], flagBrowse, {}).some((r) => r.readKind === "outlier" || r.readKind === "dive"));
t("flagged and dive empty shelves stay honest", flaggedReads({ filters: { flagged: { items: [] } } }, []).length === 0 && diveReads({ filters: { dive: { items: [] } } }, []).length === 0);

// ── volume reads: a TCGplayer count with its window and source may say "sold" ──
const volume = {
  id: "volume-tcgcsv-662182",
  sku: "tcgcsv-662182",
  readKind: "volume",
  kind: "volume",
  name: "Mega Charizard X ex",
  set: "ME02: Phantasmal Flames",
  headline: "Mega Charizard X ex (ME02: Phantasmal Flames, 013/094): 815 Near Mint copies sold on TCGplayer in the 30 days Sep 5–Oct 4, 133 of them in the last 7 (Sep 28–Oct 4).",
  path: "Mega Charizard X ex (ME02: Phantasmal Flames, 013/094): 815 Near Mint copies sold on TCGplayer in the 30 days Sep 5–Oct 4, 133 of them in the last 7 (Sep 28–Oct 4).",
  why: "TCGplayer sales via PokemonPriceTracker. TCGplayer's daily sold counts for the Holofoil printing in Near Mint, added up; days with no sale add nothing.",
  asOf: "2026-10-04",
  href: "/c/tcgcsv-662182",
  sold: { condition: "Near Mint", printing: "Holofoil", count30d: 815, window30d: { from: "2026-09-05", to: "2026-10-04" }, count7d: 133, window7d: { from: "2026-09-28", to: "2026-10-04" }, source: "TCGplayer sales via PokemonPriceTracker" },
};
t("a verified volume row is kept and keeps its sold sentence", isVolumeRow(volume) && keepFeedRead(volume) && soldSafeText(volume, volume.path) === volume.path);
const forged = { ...volume, id: "volume-forged", sold: { ...volume.sold, source: "eBay" } };
const mismatch = { ...volume, id: "volume-mismatch", sold: { ...volume.sold, count30d: 900 } };
const noWindow = { ...volume, id: "volume-nowindow", sold: { ...volume.sold, window30d: {} } };
t("a volume row without the source, a matching count, or a window is not trusted", !isVolumeRow(forged) && !isVolumeRow(mismatch) && !isVolumeRow(noWindow) && soldSafeText(forged, forged.path) === "");
t("a sold sentence on any other row still comes out", soldSafeText(priced, "Sales volume is 40. 12 copies sold.") === "");
const volBrowse = { ...flagBrowse, filters: { ...flagBrowse.filters, volume: { items: [volume, forged], empty: "No sold counts on file." } } };
t("volume filter returns verified volume rows only", buildFeedLoop([priced, outlier, dive], volBrowse, { filter: "volume" }).map((r) => r.id).join() === "volume-tcgcsv-662182");
t("prices filter leaves volume out", buildFeedLoop([priced, volume], volBrowse, { filter: "prices" }).every((r) => r.readKind !== "volume"));
t("default mix includes the volume read", buildFeedLoop([priced], volBrowse, {}).some((r) => r.id === "volume-tcgcsv-662182"));
t("no volume shelf means no volume rows", volumeReads({ filters: {} }, []).length === 0 && buildFeedLoop([priced], flagBrowse, { filter: "volume" }).length === 0);
const volAll = renderAll({ asOf: "2026-10-06", reads: [volume, { id: "only-sold", headline: "Sales volume is 40 copies sold.", price: 10 }] }, "");
t("all reads keeps the attributed volume line and drops the bare sold claim", volAll.includes("815 Near Mint copies sold on TCGplayer") && !volAll.includes("Sales volume is 40"));

const quiet = {
  id: "quiet-tcgcsv-1",
  sku: "tcgcsv-1",
  readKind: "quiet",
  kind: "quiet",
  name: "Piplup",
  set: "Diamond & Pearl",
  path: "No TCGplayer sales recorded in 7 days. That is not a scarcity claim. Piplup stayed $2.03 in Near Mint over Sep 28–Oct 4.",
  headline: "No TCGplayer sales recorded in 7 days. That is not a scarcity claim. Piplup stayed $2.03 in Near Mint over Sep 28–Oct 4.",
  why: "No TCGplayer sales recorded in 7 days. That is not a scarcity claim. Piplup stayed $2.03 in Near Mint over Sep 28–Oct 4.",
  asOf: "2026-10-04",
  href: "/c/tcgcsv-1",
  receipt: { days: 7, price: 2.03, from: "2026-09-28", to: "2026-10-04" },
};
const quietForged = { ...quiet, id: "quiet-forged", path: "No sales. Scarce.", headline: "No sales. Scarce.", why: "No sales. Scarce.", receipt: { days: 7, price: 2.03 } };
t("a shape row keeps its sentence only with the clause and the price", isShapeRow(quiet) && keepFeedRead(quiet) && soldSafeText(quiet, quiet.path) === quiet.path && !isShapeRow(quietForged) && soldSafeText(quietForged, "12 copies sold.") === "");
const shapeBrowse = { ...flagBrowse, filters: { ...flagBrowse.filters, quiet: { items: [quiet, quietForged], empty: "No quiet Near Mint window is on file." } } };
t("the quiet filter returns the verified row only", buildFeedLoop([priced], shapeBrowse, { filter: "quiet" }).map((r) => r.id).join() === "quiet-tcgcsv-1");
t("prices filter leaves a shape row out", buildFeedLoop([priced, quiet], shapeBrowse, { filter: "prices" }).every((r) => r.readKind !== "quiet"));
t("default mix includes the shape read", buildFeedLoop([priced], shapeBrowse, {}).some((r) => r.id === "quiet-tcgcsv-1"));
t("the feed lists the new filters", renderFeed({ asOf: "2026-10-06", reads: [priced] }, "").includes('value="quiet">No sales') && renderFeed({ asOf: "2026-10-06", reads: [priced] }, "").includes('value="still">Nothing moved'));

const conditionCard = {
  id: "conditions-tcgcsv-211451",
  name: "Carracosta GX",
  readKind: "conditions",
  kind: "conditions",
  path: "Near Mint $1.45 and Lightly Played $1.10 for Carracosta GX on Oct 5. Two condition prices. Not a grade result.",
  receipt: { date: "2026-10-05", nearMint: 1.45, played: 1.1, playedCondition: "Lightly Played" },
};
const marketCard = {
  id: "mktmove-me5-pack",
  name: "Pitch Black Booster Pack",
  readKind: "mktmove",
  kind: "mktmove",
  path: "The TCGplayer market price for Pitch Black Booster Pack went from $5.73 to $5.89 over Oct 6–Oct 7. The eBay ask stayed $10.25. The market price changed. The ask did not. Asks are not sales.",
  receipt: { from: "2026-10-06", to: "2026-10-07", marketFrom: 5.73, marketTo: 5.89, ask: 10.25 },
};
const mixCard = {
  id: "mix-tcgcsv-138598",
  name: "Persian",
  readKind: "mix",
  kind: "mix",
  path: "Persian, Sep 29–Oct 5: 7 Near Mint, 2 Lightly Played, 0 Moderately Played, 1 Heavily Played. This is the mix of copies that sold, not the copy in your hand.",
  receipt: { from: "2026-09-29", to: "2026-10-05", conditions: [{ condition: "Near Mint", sold: 7 }, { condition: "Lightly Played", sold: 2 }, { condition: "Moderately Played", sold: 0 }, { condition: "Heavily Played", sold: 1 }] },
};
const spreadCard = {
  id: "spread-sm11-booster-box",
  name: "Unified Minds Booster Box",
  readKind: "spread",
  kind: "spread",
  path: "The search for Unified Minds Booster Box asks from $3,250.00 to $6,933.97. Asking prices from the search. Not sold prices.",
  receipt: { low: 3250, high: 6933.97 },
};
const shownLines = [conditionCard, marketCard, mixCard, spreadCard].map(shownRead);
t("a shown read keeps the name and does not say for on or for went", shownLines.every((line) => line && !line.includes("for on") && !line.includes("for went") && !line.startsWith(",") && !line.startsWith(" ")) && shownRead(conditionCard).includes("Carracosta GX") && shownRead(marketCard).includes("Pitch Black Booster Pack") && shownRead(mixCard).startsWith("Persian") && shownRead(spreadCard).includes("Unified Minds Booster Box"));
t("an ask spread is a plain asking range from the receipt", shownRead(spreadCard) === "Asks on eBay for Unified Minds Booster Box range from $3,250 to $6,934 (listings, not sales).");
t("every shown read starts with a capital", shownLines.every((line) => /^[A-Z]/.test(line)) && shownRead({ name: "Abra", path: "abra latest price rose from $1.00 on Sep 3 to $1.10 on Oct 3.", kind: "single", readKind: "price" }).startsWith("Abra"));
t("a missing name is put back and a leading comma is not a sentence", shownRead({ name: "Persian", path: ", Sep 29–Oct 5: 7 Near Mint.", readKind: "price", kind: "single" }).startsWith("Persian") && !shownRead({ name: "Persian", path: ", Sep 29–Oct 5: 7 Near Mint.", readKind: "price", kind: "single" }).startsWith(","));

const liveNews = newsSlice(feedNews);
const dedenne = liveNews.find((row) => row.href === "https://bulbagarden.net/threads/new-merch-collection-starring-dedenne-joltik-and-more-electric-types-coming-soon-to-pokemon-centers-in-japan.311717/");
const nightOut = liveNews.find((row) => row.href === "https://pokemongo.com/news/pokemon-night-out-twitch-drops2026");
const japanFile = liveNews.find((row) => row.href === "https://www.pokemon-card.com/info/005559.html");
const valentine = liveNews.find((row) => row.href === "https://www.pokebeach.com/forums/threads/pokemon-to-release-first-ever-valentine%E2%80%99s-day-tcg-set.157072/");
const goTcg = liveNews.find((row) => row.href === "https://pokemongo.com/news/tcg-30th-celebration-event");
t("the news file drops merch and Pokémon GO with no TCG angle", !dedenne && !nightOut && valentine && valentine.dayLabel === "Oct 1, 2026" && valentine.summary.startsWith("We can exclusively reveal") && goTcg && goTcg.source === "Pokémon GO");
t("the Japan card in the news file says Japan news and keeps the original title", japanFile && japanFile.place === "Japan news" && japanFile.asOf === "2026-10-02" && japanFile.dayLabel === "Oct 2, 2026" && japanFile.originalTitle === "「ここからデビュー！はじめてポケカ体験会」開催！" && japanFile.name.startsWith("Japan:"));
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
t("the fact card says the English count, keeps Cards on the Pokémon page, and does not change the filters", factHtml.includes("pokemonFactLine(card)") && monFn.includes('className="mon-btn"') && monFn.includes('"/pokemon/"+') && monFn.includes("pokemonSlug(card&&card.name)") && !monFn.includes("fetch(") && !monFn.includes("tcgcsv") && !monFn.includes("The picture is missing.") && factHtml.includes(">Prices<") && factHtml.includes(">Sealed<") && factHtml.includes(">One set<") && factHtml.includes(">News<") && factHtml.includes(">Pokémon facts<") && factHtml.includes(">Waves & reprints<") && factHtml.includes(">Flagged<") && factHtml.includes(">Dive<") && !factHtml.includes("card.why"));
t("a missing cutout is a branded tile and the news filter says there is no news", !factHtml.includes("The cutout is missing.") && factHtml.includes("function factCutLine") && factHtml.slice(factHtml.indexOf("function factCutLine"), factHtml.indexOf("function cardEl")).includes("brandedTile(") && factHtml.slice(factHtml.indexOf("function factCutLine"), factHtml.indexOf("function cardEl")).includes("cutoutSrc(card)") && !factHtml.includes("The picture is missing.") && factHtml.includes("function newsTile") && factHtml.includes("news-tile") && !factHtml.includes("news-preview") && factHtml.includes("There is no news.") && factHtml.includes("No flagged prices.") && factHtml.includes("No deep dives.") && factHtml.includes("No wave or reprint news."));
const newsFn = factHtml.slice(factHtml.indexOf("function newsDetailHtml"), factHtml.indexOf("function factCutLine"));
t("a news read is sized to the file and keeps Previous and Next on the card", newsFn.includes('className="feed-card news-card"') && newsFn.includes(">NEWS<") && newsFn.includes("news-sum") && newsFn.includes("Read at ") && newsFn.includes("dayLabel") && !newsFn.includes("card.asOf") && factHtml.includes("is-news") && factHtml.includes("Swipe sideways for the next read.") && factHtml.includes('textContent=news?"Previous"') && factHtml.includes("news-card{flex:0 0 auto"));
t("a fact with the same headline and path paints that sentence once", factHtml.includes("headline===pathText") && factHtml.includes("sameSentence||line") && !factHtml.includes("The cutout is missing."));
t("premium sees the hide control and the unranked loop walks the shuffled file", factHtml.includes("Hide Pokémon facts") && factHtml.includes("browse.ranked") && factHtml.includes("browse.unfiltered") && !factHtml.includes('id="hide-facts" hidden') && !factHtml.includes("No path is stored") && !factHtml.includes("the last step is"));
t("the unranked loop mixes news and wave rows already on the file", factHtml.includes("Mix news, wave, flagged, and dive rows already on the file into the shuffled walk.") && factHtml.includes("while(ei<extras.length)"));
t("the feed filter is a pinned chip row and each filter has a URL", factHtml.includes('id="f-loop"') && factHtml.includes('class="chip-row"') && factHtml.includes(">All<") && factHtml.includes(">Prices<") && factHtml.includes(">Sealed<") && factHtml.includes(">One set<") && factHtml.includes('value="signals">Signals') && factHtml.includes(">News<") && factHtml.includes(">Pokémon facts<") && factHtml.includes('value="wave">Waves & reprints') && factHtml.includes(">Flagged<") && factHtml.includes(">Dive<") && factHtml.includes('value="quiet">No sales') && factHtml.includes('value="still">Nothing moved') && factHtml.includes("No signal reads tonight.") && factHtml.includes("function moreBlock") && factHtml.includes("Why it matters.") && factHtml.includes("What would make this wrong.") && factHtml.includes("pageMode!==\"read\"") && factHtml.includes("position:sticky") && factHtml.includes("overflow-x:auto") && factHtml.includes("min-height:44px") && factHtml.includes("URLSearchParams(location.search)") && factHtml.includes('.get("f")') && factHtml.includes("history.pushState") && factHtml.includes('id="set-picker"') && factHtml.includes('aria-label="Find a set"') && factHtml.includes("Nothing in this filter.") && factHtml.includes("browse.ranked") && factHtml.includes("browse.unfiltered") && !factHtml.includes("pill-menu") && factHtml.includes("function readUnderTitle") && factHtml.includes("function dropTitleName") && factHtml.includes("function cardIdentity") && factHtml.includes("card-meta") && factHtml.includes("isFact(card)?pokemonFactLine(card):moveLine(card)") && factHtml.includes("if(!path) return \"\";") && factHtml.includes("function __name(t,v)") && !factHtml.includes("No path is stored") && !factHtml.includes("the last step is"));
t("the feed moves one read at a time", factHtml.includes("Math.abs(dx)<60") && factHtml.includes("Math.abs(dx)<=Math.abs(dy)") && factHtml.includes('closest("#feed-one article.feed-card")') && factHtml.includes("ArrowLeft") && factHtml.includes("ArrowRight") && factHtml.includes("wheelAt=now+300") && factHtml.includes("prefers-reduced-motion: reduce") && factHtml.includes('pos+" of "+total') && factHtml.includes('.get("r")') && factHtml.includes("is-bounce-next") && factHtml.includes("is-enter-next") && factHtml.includes("200ms") && factHtml.includes("feed-arrows-seen") && factHtml.includes('aria-label","Previous"') && factHtml.includes('aria-label","Next"') && factHtml.includes("touch-action:pan-y") && !factHtml.includes('id="feed-count"') && factHtml.includes("function setLine") && factHtml.includes("html(setName)") && !factHtml.includes("html(ident)"));
t("ATH ATL copy uses filled triangle words", factHtml.includes("▲ high") && factHtml.includes("▼ low"));
const shippingCard = '<h2>Correction log</h2><div class="c"><div class="d">2026-08-23 <span class="chip m">AFFECTED A PUBLISHED NUMBER</span></div><div class="w">shipping comparison</div></div><div class="c"><div class="w">auto-fix rewrote a price</div></div><h2>Kept</h2>';
const hiddenNotes = hidePublishedNotes(shippingCard);
t("a public page drops the correction log and the shipping card", !hiddenNotes.includes("Correction log") && !hiddenNotes.includes("AFFECTED A PUBLISHED NUMBER") && !/auto-fix/i.test(hiddenNotes) && hiddenNotes.includes("Kept"));
const searchHtml = renderSearch();
t("search stays capped at 40, highest stored value first, with the stored price and rarity", searchHtml.includes("searchCatalog(q, rows, 40)") && searchHtml.includes("rankCatalog(q, rows, 40, codes)") && searchHtml.includes(".slice(0,40)") && searchHtml.includes("return y-x") && searchHtml.includes("No market price") && searchHtml.includes("set-logos.json") && searchHtml.includes("r[8]") && searchHtml.includes("r[9]"));

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

// ── every inline client script must parse ──
// A regex written inside a template literal loses its backslashes; on Oct 6
// "/\\/p\\/…/" shipped as "//p/…" and the whole feed script stopped.
{
  const pages = {
    feed: renderFeed({ asOf: "2026-10-06", reads: [volume, outlier, dive] }, "", "stamp", { feed: true }),
    search: renderSearch({ feed: true }),
    mine: renderMine("stamp", { feed: true }),
    sets: renderSets({ sets: [] }, "stamp", { feed: true }),
    set: renderSetShell("base", "stamp"),
  };
  const broken = [];
  for (const [name, page] of Object.entries(pages)) {
    for (const m of String(page).matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (/application\/(ld\+)?json/.test(m[1])) continue;
      let code = m[2];
      if (/^\s*[\[{]/.test(code)) continue;
      // Module scripts: drop the import lines and parse the body as an async function.
      if (/type=["']module["']/.test(m[1])) code = "(async()=>{" + code.replace(/^\s*import\s[^;]+;\s*$/gm, "") + "\n})";
      try { new vm.Script(code); } catch (e) { broken.push(`${name}: ${e.message}`); }
    }
  }
  t("every inline client script parses", broken.length === 0);
  if (broken.length) console.error(broken.join("\n"));
}

{
  const shell = renderSetShell("me-30th-celebration", "Updated");
  t("a set page draws the list without wiping a loaded title", shell.includes('let rows=[], shown=48, setLogo=""') && shell.includes("pictureSrc(r, setLogo)") && !shell.includes("pictureSrc(r, data.logo)") && shell.includes('title.textContent==="Set"') && shell.includes("This set did not load."));
  t("a set page keeps a labelled section and does not mix it into the first page", shell.includes('r=>!r.section') && shell.includes('class="set-section"') && shell.includes('id="sections"') && shell.includes("location.hash") && shell.includes("scrollIntoView"));
  t("a set page offers All, Master set, and Base set only", shell.includes('id="scope"') && shell.includes(">All</option>") && shell.includes("Master set") && shell.includes("Base set only"));
  t("a set page can tick owned printings on this device", shell.includes("Grand master") && shell.includes("My set") && shell.includes("catchem-set:") && shell.includes("Cost to complete") && shell.includes("cards unpriced") && shell.includes('data-own'));
  t("a set page writes the completion line from the file", shell.includes('id="completion"') && shell.includes(" cards · ") && shell.includes(" printings · ") && shell.includes(" sealed") && shell.includes("Number.isInteger(data.cards)") && shell.includes("Number.isInteger(data.printings)") && shell.includes("Number.isInteger(data.sealed)"));
  t("a set row names the printing", shell.includes("r.printing") && shell.includes('bits.push("Case")'));
  const dated = renderSets({ sets: [{ slug: "me-30th-celebration", name: "ME: 30th Celebration", era: "Mega Evolution", single: 191, sealed: 38, priced: 227, release: "2026-09-16" }] }, "");
  t("a set tile writes Sep 16, 2026 and does not wrap the date", dated.includes("Sep 16, 2026") && dated.includes('class="set-date"') && !dated.includes(">2026-09-16<") && dated.includes("191 singles"));
  t("an index chart is a level and a price chart keeps $", shell.includes("indexLevel=/index/i.test") && shell.includes("maximumFractionDigits:1") && shell.includes('"$"+Number(n)'));
  const linked = [
    factHtml,
    renderSearch(),
    renderMethod(null),
    renderPremium(""),
    renderPost("", ""),
    renderSets(sets, ""),
    shell,
  ].join("\n");
  const dead = deadLocals(localPaths(linked), pageKind);
  t("rendered pages link no dead path", dead.length === 0);
  if (dead.length) console.error(dead.join("\n"));
  const fetched = scriptFetchPaths(linked).filter((path) => path.startsWith("/"));
  const deadFetch = deadLocals(fetched, pageKind);
  t("a script fetch the site cannot serve fails the check", deadFetch.length === 0 && deadLocals(scriptFetchPaths('<script>fetch("/no-such-page")</script>'), pageKind).join() === "/no-such-page");
  if (deadFetch.length) console.error(deadFetch.join("\n"));
  t("a path the site cannot serve fails the check", deadLocals(["/no-such-page"], pageKind).join() === "/no-such-page" && deadLocals(["/sets", "/corrections"], pageKind).length === 0);
  t("a script template is not a path", localPaths(`<a href="/dive/'+encodeURIComponent(diveId)+'">x</a><a href="/sets">Sets</a>`).join() === "/sets" && scriptFetchPaths('<script>fetch("/data/feed/"+part+".json");fetch("/data/feed/meta.json")</script>').join() === "/data/feed/meta.json");
  t("the chip row fades and a blank filter says so", factHtml.includes("chip-more") && factHtml.includes("chip-scroller") && factHtml.includes("min-width:0") && factHtml.includes("--chip-fade") && factHtml.includes("sealedAvailable") && factHtml.includes("function shownRead") && factHtml.includes("Asks on eBay for ") && factHtml.includes("function photoEl") && factHtml.includes("brandedTile") && !factHtml.includes("card.image") && factHtml.includes("No sealed reads tonight.") && factHtml.includes("function __name") && factHtml.includes("let look=null") && factHtml.includes("setSlug") && factHtml.includes("/data/feed/catalogue.json") && factHtml.includes("/data/sets.json") && !factHtml.includes('loopFilter==="sealed" || (loopFilter==="set" && !wantedSet)'));
  t("every page says it is made for collectors, rippers and flippers", factHtml.includes("Made for collectors, rippers and flippers.") && indexHtml.includes("Made for collectors, rippers and flippers.") && !indexHtml.includes("Made by one person who collects."));
}

{
  const { imageTag } = await import("../src/catalogue-image.mjs");
  const ui = await readFile(new URL("../src/ui.mjs", import.meta.url), "utf8");
  const single = imageTag("/api/card-img?pid=610435", "card", "Dudunsparce", { kind: "single", crop: true });
  const sealed = imageTag("/api/card-img?pid=654136", "sealed", "ETB", { kind: "sealed", crop: false });
  t("a single card picture uses the Post Office card face", /class="shot card-face"/.test(single) && single.includes('data-crop-card="1"'));
  t("a sealed picture is not a card face", !sealed.includes("card-face") && !sealed.includes("data-crop-card"));
  t("the card face is the Post Office formula", /img\.card-face\{display:block;aspect-ratio:63\/88;object-fit:contain;object-position:center;background:#141416;border-radius:14px/.test(ui));
  t("feed, set and search card pictures use the card face", ui.includes('img.className="card-face"') && ui.includes("shot card-face thumb") && ui.includes(".feed-card img.card-face{"));
}

if (fail) process.exit(1);
console.log("rebuild routes ok");
