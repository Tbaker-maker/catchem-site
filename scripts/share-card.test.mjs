// Branded 1200x630 share card. SVG, same-origin pictures only.
import { banGuard } from "../src/advice-rules.mjs";
// Whole pages carry code comments, so dashes are checked by their own assertion here.
const PAGE = { skipKinds: ["house"] };
import worker from "../src/index.mjs";
import { cardFieldsFromRow, handleShareCard, readShareUrl, safeImagePath, setCompleteShareUrl, shareCardUrl, shareId, shareSvg } from "../src/share-card.mjs";
import { renderFeed, shownRead } from "../src/ui.mjs";
import { priceBits } from "../src/read-sheet.mjs";
import { runSharePostTests } from "./share-posts.test.mjs";

let fail = 0;
const t = (name, cond) => { console.log(`${cond ? "  ok " : "  FAIL"} ${name}`); if (!cond) fail++; };
const BANNED = banGuard("share-card", null, PAGE);

t("same-origin card path is kept", safeImagePath("/data/editor/tcg/base1/4_hires.png") === "/data/editor/tcg/base1/4_hires.png");
t("origin prefix is stripped", safeImagePath("https://catchemtcg.com/data/editor/tcg/bw8/101_hires.png") === "/data/editor/tcg/bw8/101_hires.png");
t("logo path is kept", safeImagePath("/img/base1/logo.png") === "/img/base1/logo.png");
t("foreign hosts are rejected", safeImagePath("https://tcgplayer-cdn.tcgplayer.com/product/1.jpg") === "" && safeImagePath("https://evil.example/data/editor/tcg/base1/4.png") === "");
t("og.png and traversal are rejected", safeImagePath("https://catchemtcg.com/og.png") === "" && safeImagePath("/data/editor/tcg/../secret") === "");

// A share card's numbers come from the product's own data row, never the URL.
// Fake rows only. Prices and dates here are test values.
const ROW = {
  id: "tcgcsv-9001", name: "Charizard", num: "4/102", kind: "single", set: "Base Set",
  price: 12.5, asOf: "2026-11-25", source: "TCGplayer market", scan: "base1/4_hires.png",
  hist: [["2026-11-17", 9.5], ["2026-11-18", 10], ["2026-11-24", 12], ["2026-11-25", 12.5]],
};
const loadRow = async (id) => (id === ROW.id ? ROW : null);
const url = shareCardUrl({ kind: "card", id: "tcgcsv-9001", name: "Charizard", price: 968.91, change: 500, img: "/data/editor/tcg/base1/4_hires.png" });
t("card share url carries only the kind and the product id", url === "https://catchemtcg.com/og/card.svg?k=card&id=tcgcsv-9001");
t("a card share url with no product id is empty", shareCardUrl({ kind: "card", name: "Charizard", price: 968.91 }) === "");
t("share ids are tcgcsv ids only", shareId("tcgcsv-1") === "tcgcsv-1" && shareId("/c/tcgcsv-2") === "tcgcsv-2" && shareId("tcgcsv-1&p=9") === "" && shareId("../x") === "");

const svg = shareSvg(new URL(url).searchParams, ROW);
t("svg is 1200 by 630 and rounded", svg.includes('width="1200"') && svg.includes('height="630"') && svg.includes('rx="36"') && svg.includes("Catch'em") && svg.includes("$12.50") && !svg.includes("NM"));
t("price carries its source and date", svg.includes("TCGplayer market, Nov 25, 2026"));
t("change is 7 days, computed from the row", svg.includes("+25% 7D"));
t("the card photo comes from the row", svg.includes("/data/editor/tcg/base1/4_hires.png"));

const forged = new URLSearchParams("k=card&id=tcgcsv-9001&n=Made%20Up&p=99999&c=500&s=1&cond=NM&img=%2Fdata%2Feditor%2Ftcg%2Fbase1%2F9.png");
const forgedSvg = shareSvg(forged, ROW);
t("URL price, change, name, condition and photo are ignored", !forgedSvg.includes("99,999") && !forgedSvg.includes("500%") && !forgedSvg.includes("Made Up") && !forgedSvg.includes("NM") && !forgedSvg.includes("base1/9.png") && forgedSvg.includes("$12.50"));
const noRow = shareSvg(new URLSearchParams("k=card&n=Made%20Up&p=99999&c=500"));
t("an unknown product renders no number", !/\$\d/.test(noRow) && !/\d%/.test(noRow) && !noRow.includes("Made Up") && noRow.includes("No market price on file") && !noRow.includes("TCGplayer market</text>"));
const heldSvg = shareSvg(forged, { ...ROW, price: null, priceStatus: "checking" });
t("a held price renders no number", !/\$\d/.test(heldSvg) && !/\d%/.test(heldSvg) && heldSvg.includes("No market price on file"));
const undated = cardFieldsFromRow({ ...ROW, asOf: "", hist: [] });
t("a price with no date renders no number", undated.price === "" && undated.date === "");
const stale = cardFieldsFromRow({ ...ROW, asOf: "2026-11-25", hist: [["2026-11-08", 11], ["2026-11-15", 12.5]] });
t("the date is the last price on file, never later", stale.date === "Nov 15, 2026" && stale.change === "+13.6% 7D");
const nmRow = cardFieldsFromRow({ ...ROW, condition: "NM" });
t("NM shows only when the row's price is NM, never on sealed", nmRow.cond === "NM" && cardFieldsFromRow({ ...ROW, kind: "sealed", condition: "NM" }).cond === "" && cardFieldsFromRow(ROW).cond === "");
t("svg has no em dash and no banned words", !/[\u2014\u2013]/.test(svg) && !BANNED.test(svg));
t("svg escapes a name", shareSvg(new URLSearchParams("k=card&id=tcgcsv-9001"), { ...ROW, name: "A&B" }).includes("A\u0026amp;B"));

const readUrl = readShareUrl({
  name: "Snorlax",
  number: "101/135",
  price: 28.87,
  changePct: 254.2,
  image: "https://catchemtcg.com/data/editor/tcg/bw8/101_hires.png",
  set: "Plasma Storm",
  href: "/c/tcgcsv-1",
});
t("read share url carries only the product id", readUrl === "https://catchemtcg.com/og/card.svg?k=read&id=tcgcsv-1");
t("a read with no product id has no share card url", readShareUrl({ name: "Snorlax", price: 28.87, changePct: 254.2 }) === "");

const res = await handleShareCard(new Request(url), new URL(url), loadRow);
const resBody = await res.text();
t("handler is a cached svg built from the row", res.status === 200 && res.headers.get("content-type").includes("image/svg+xml") && res.headers.get("cache-control") === "public, max-age=3600" && resBody.includes("$12.50"));
const head = await handleShareCard(new Request(url, { method: "HEAD" }), new URL(url), loadRow);
t("head has no body", head.status === 200 && head.body === null);
const forgedUrl = "https://catchemtcg.com/og/card.svg?k=card&id=tcgcsv-404&n=Made%20Up&p=99999&c=500";
const miss = await handleShareCard(new Request(forgedUrl), new URL(forgedUrl), loadRow);
const missBody = await miss.text();
t("handler: unknown id renders no number", miss.status === 200 && !missBody.includes("99,999") && !missBody.includes("500%") && !missBody.includes("Made Up"));
const swapped = await handleShareCard(new Request(forgedUrl), new URL(forgedUrl), async () => ROW);
t("handler: a row for another id is not used", !(await swapped.text()).includes("$12.50"));

const env = { ASSETS: { fetch: async () => new Response("", { status: 404 }) }, PUBLIC_FETCH: async () => new Response("", { status: 404 }) };
const live = await worker.fetch(new Request("https://catchemtcg.com/og/card.svg?k=card&n=Pikachu&p=99999&c=500"), env);
const liveBody = await live.text();
t("route serves the share card without URL numbers", live.status === 200 && liveBody.includes('width="1200"') && !liveBody.includes("Pikachu") && !liveBody.includes("99,999") && !liveBody.includes("500%"));

const setUrl = setCompleteShareUrl({
  name: "SV08: Surging Sparks",
  setName: "SV08: Surging Sparks",
  logo: "/img/sv8/logo.png",
  have: 162,
  total: 162,
  date: "2026-10-28",
  era: "scarlet & violet",
});
t("set complete share url", setUrl.includes("k=set") && setUrl.includes("n=SV08") && setUrl.includes("num=162%2F162") && setUrl.includes("img=%2Fimg%2Fsv8%2Flogo.png") && setUrl.includes("d=2026-10-28"));
const setSvg = shareSvg(new URL(setUrl).searchParams);
t("set complete svg is branded and rounded", setSvg.includes('width="1200"') && setSvg.includes('rx="36"') && setSvg.includes("Catch'em") && setSvg.includes("Set complete") && setSvg.includes("162/162 complete") && setSvg.includes("2026-10-28") && setSvg.includes("/img/sv8/logo.png"));
t("set complete svg has no advice and no creator names", !/\b(should|consider|recommend|must buy)\b/i.test(setSvg) && !/Pok[eé]mon TCG Pocket|Collectr|creator/i.test(setSvg) && !/[\u2013\u2014]/.test(setSvg) && !BANNED.test(setSvg));
const setLive = await worker.fetch(new Request(setUrl), env);
const setBody = await setLive.text();
t("route serves set complete card", setLive.status === 200 && setBody.includes("Set complete") && setBody.includes("SV08: Surging Sparks"));


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
t("a read page uses the branded share image by product id", readHtml.includes("property=\"og:image\" content=\"https://catchemtcg.com/og/card.svg?k=read\u0026amp;id=tcgcsv-1\""));
const feedHtml = renderFeed(bundle, "", "stamp", {});
t("the feed index stays on og.png", feedHtml.includes('property="og:image" content="https://catchemtcg.com/og.png"') && !feedHtml.includes("/og/card.svg"));

// Guard: NM is a single-card condition. No sealed text may say NM or Near Mint.
const NMX = /\bNM\b|Near Mint/i;
const sealedLine = shownRead({ kind: "sealed", name: "First Partner Pack (Alola)", headline: "First Partner Pack (Alola) is up 5% this week: $23.54 NM \u2192 $24.71 NM." });
t("a sealed feed line has no NM and no arrow", !NMX.test(sealedLine) && !sealedLine.includes("\u2192") && sealedLine.includes("from $23.54 to $24.71"));
const singleLine = shownRead({ kind: "single", name: "Pikachu", headline: "Pikachu is up 5% this week, from $1.00 NM to $2.00 NM." });
t("a single without a condition drops NM", singleLine.includes("from $1.00 to $2.00") && !/\bNM\b/.test(singleLine));
const nmLine = shownRead({ kind: "single", name: "Pikachu", condition: "NM", headline: "Pikachu is up 5% this week, from $1.00 NM to $2.00 NM." });
t("a single keeps NM when the row is NM", nmLine.includes("$1.00 NM") && nmLine.includes("$2.00 NM"));
const sealedPrice = priceBits({ kind: "sealed", prices: [{ amount: 24.71, date: "2026-10-14", source: "tcgplayer", condition: "NM", label: "Near Mint" }] });
t("a sealed price chip has no NM", !NMX.test(JSON.stringify(sealedPrice)));
const sealedSvg = shareSvg(new URL(shareCardUrl({ id: "tcgcsv-9002" })).search, { id: "tcgcsv-9002", name: "Delta Reign Elite Trainer Box", kind: "sealed", condition: "NM", price: 121.52, asOf: "2026-11-25", hist: [["2026-11-25", 121.52]] });
t("a sealed share card has no NM", !NMX.test(sealedSvg) && sealedSvg.includes("TCGplayer market"));
fail += runSharePostTests();

if (fail) { console.log(`${fail} failed`); process.exit(1); }
console.log("share card: all passed");
