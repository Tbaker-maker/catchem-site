// Branded 1200x630 share card. SVG, same-origin pictures only.
import { banGuard } from "../src/advice-rules.mjs";
// Whole pages carry code comments, so dashes are checked by their own assertion here.
const PAGE = { skipKinds: ["house"] };
import worker from "../src/index.mjs";
import { handleShareCard, readShareUrl, safeImagePath, shareCardUrl, shareSvg } from "../src/share-card.mjs";
import { renderFeed, shownRead } from "../src/ui.mjs";
import { priceBits } from "../src/read-sheet.mjs";

let fail = 0;
const t = (name, cond) => { console.log(`${cond ? "  ok " : "  FAIL"} ${name}`); if (!cond) fail++; };
const BANNED = banGuard("share-card", null, PAGE);

t("same-origin card path is kept", safeImagePath("/data/editor/tcg/base1/4_hires.png") === "/data/editor/tcg/base1/4_hires.png");
t("origin prefix is stripped", safeImagePath("https://catchemtcg.com/data/editor/tcg/bw8/101_hires.png") === "/data/editor/tcg/bw8/101_hires.png");
t("logo path is kept", safeImagePath("/img/base1/logo.png") === "/img/base1/logo.png");
t("foreign hosts are rejected", safeImagePath("https://tcgplayer-cdn.tcgplayer.com/product/1.jpg") === "" && safeImagePath("https://evil.example/data/editor/tcg/base1/4.png") === "");
t("og.png and traversal are rejected", safeImagePath("https://catchemtcg.com/og.png") === "" && safeImagePath("/data/editor/tcg/../secret") === "");

const url = shareCardUrl({ kind: "card", name: "Charizard", price: 968.91, img: "/data/editor/tcg/base1/4_hires.png" });
t("card share url is the branded svg", url === "https://catchemtcg.com/og/card.svg?k=card&n=Charizard&p=968.91&img=%2Fdata%2Feditor%2Ftcg%2Fbase1%2F4_hires.png");

const svg = shareSvg(new URL(url).searchParams);
t("svg is 1200 by 630 and rounded", svg.includes('width="1200"') && svg.includes('height="630"') && svg.includes('rx="36"') && svg.includes("Catch'em") && svg.includes("$968.91") && !svg.includes("NM"));
const nmSvg = shareSvg(new URLSearchParams("n=Charizard&p=968.91&cond=NM"));
t("NM is on the share card only when the price is NM", nmSvg.includes("NM · TCGplayer market") && !shareSvg(new URLSearchParams("n=Box&p=10&s=1")).includes("NM"));
t("svg has no em dash and no banned words", !/[\u2014\u2013]/.test(svg) && !BANNED.test(svg));
t("svg escapes a name", shareSvg(new URLSearchParams("n=A%26B")).includes("A\u0026amp;B"));

const readUrl = readShareUrl({
  name: "Snorlax",
  number: "101/135",
  price: 28.87,
  changePct: 254.2,
  image: "https://catchemtcg.com/data/editor/tcg/bw8/101_hires.png",
  set: "Plasma Storm",
});
t("read share url carries name, number, price, and change", readUrl.includes("k=read") && readUrl.includes("n=Snorlax") && readUrl.includes("num=101%2F135") && readUrl.includes("p=28.87") && readUrl.includes("c=%2B254.2") && readUrl.includes("img=%2Fdata%2Feditor%2Ftcg%2Fbw8%2F101_hires.png"));

const res = handleShareCard(new Request(url), new URL(url));
t("handler is cached svg", res.status === 200 && res.headers.get("content-type").includes("image/svg+xml") && res.headers.get("cache-control") === "public, max-age=86400");
const head = handleShareCard(new Request(url, { method: "HEAD" }), new URL(url));
t("head has no body", head.status === 200 && head.body === null);

const env = { ASSETS: { fetch: async () => new Response("", { status: 404 }) }, PUBLIC_FETCH: async () => new Response("", { status: 404 }) };
const live = await worker.fetch(new Request("https://catchemtcg.com/og/card.svg?k=card&n=Pikachu&p=1.5"), env);
const liveBody = await live.text();
t("route serves the share card", live.status === 200 && liveBody.includes('width="1200"') && liveBody.includes("Pikachu") && liveBody.includes("$1.50"));

const bundle = {
  reads: [{
    id: "year-snorlax",
    name: "Snorlax",
    set: "Plasma Storm",
    number: "101/135",
    price: 28.87,
    changePct: 254.2,
    image: "https://catchemtcg.com/data/editor/tcg/bw8/101_hires.png",
    headline: "One year on: Snorlax.",
    href: "/c/tcgcsv-1",
    kind: "year",
  }],
};
const readHtml = renderFeed(bundle, "year-snorlax", "stamp", { page: "read" });
t("a read page uses the branded share image", readHtml.includes("property=\"og:image\" content=\"https://catchemtcg.com/og/card.svg?k=read\u0026amp;n=Snorlax"));
const feedHtml = renderFeed(bundle, "", "stamp", {});
t("the feed index stays on og.png", feedHtml.includes('property="og:image" content="https://catchemtcg.com/og.png"') && !feedHtml.includes("/og/card.svg"));

// Guard: NM is a single-card condition. No sealed text may say NM or Near Mint.
const NMX = /\bNM\b|Near Mint/i;
const sealedLine = shownRead({ kind: "sealed", name: "First Partner Pack (Alola)", headline: "First Partner Pack (Alola) is up 5% this week: $23.54 NM \u2192 $24.71 NM." });
t("a sealed feed line has no NM and no arrow", !NMX.test(sealedLine) && !sealedLine.includes("\u2192") && sealedLine.includes("from $23.54 to $24.71"));
const singleLine = shownRead({ kind: "single", name: "Pikachu", headline: "Pikachu is up 5% this week, from $1.00 NM to $2.00 NM." });
t("a single keeps NM", singleLine.includes("$1.00 NM"));
const sealedPrice = priceBits({ kind: "sealed", prices: [{ amount: 24.71, date: "2026-10-14", source: "tcgplayer", condition: "NM", label: "Near Mint" }] });
t("a sealed price chip has no NM", !NMX.test(JSON.stringify(sealedPrice)));
const sealedSvg = shareSvg(new URL(shareCardUrl({ name: "Delta Reign Elite Trainer Box", price: "121.52", sealed: true })).search);
t("a sealed share card has no NM", !NMX.test(sealedSvg) && sealedSvg.includes("TCGplayer market"));

if (fail) { console.log(`${fail} failed`); process.exit(1); }
console.log("share card: all passed");
