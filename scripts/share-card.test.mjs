// Branded 1200x630 share card. SVG, same-origin pictures only.
import worker from "../src/index.mjs";
import { handleShareCard, readShareUrl, safeImagePath, shareCardUrl, shareSvg } from "../src/share-card.mjs";
import { renderFeed } from "../src/ui.mjs";

let fail = 0;
const t = (name, cond) => { console.log(`${cond ? "  ok " : "  FAIL"} ${name}`); if (!cond) fail++; };
const BANNED = /\b(buy|sell|hold|floor|target|plays|picks|bullish|bearish|invest|roi|crypto|nft|web3)\b/i;

t("same-origin card path is kept", safeImagePath("/data/editor/tcg/base1/4_hires.png") === "/data/editor/tcg/base1/4_hires.png");
t("origin prefix is stripped", safeImagePath("https://catchemtcg.com/data/editor/tcg/bw8/101_hires.png") === "/data/editor/tcg/bw8/101_hires.png");
t("logo path is kept", safeImagePath("/img/base1/logo.png") === "/img/base1/logo.png");
t("foreign hosts are rejected", safeImagePath("https://tcgplayer-cdn.tcgplayer.com/product/1.jpg") === "" && safeImagePath("https://evil.example/data/editor/tcg/base1/4.png") === "");
t("og.png and traversal are rejected", safeImagePath("https://catchemtcg.com/og.png") === "" && safeImagePath("/data/editor/tcg/../secret") === "");

const url = shareCardUrl({ kind: "card", name: "Charizard", price: 968.91, img: "/data/editor/tcg/base1/4_hires.png" });
t("card share url is the branded svg", url === "https://catchemtcg.com/og/card.svg?k=card&n=Charizard&p=968.91&img=%2Fdata%2Feditor%2Ftcg%2Fbase1%2F4_hires.png");

const svg = shareSvg(new URL(url).searchParams);
t("svg is 1200 by 630 and rounded", svg.includes('width="1200"') && svg.includes('height="630"') && svg.includes('rx="36"') && svg.includes("Catch'em") && svg.includes("$968.91") && svg.includes("NM"));
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

if (fail) { console.log(`${fail} failed`); process.exit(1); }
console.log("share card: all passed");
