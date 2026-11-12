// Pretty card URLs use the nightly price chart only when the catalogue row
// already stores a product id. Rows are copied from Catchem-data main.
// swsh7-215 has no product id. me55-1 is 716435 and has a nightly row.
// me55-2 is 716436 with that nightly file left out, so the page stays skinny.
import { renderPath } from "../src/index.mjs";
import { resetJsonCache } from "../src/data.mjs";

let fail = 0;
const t = (name, ok) => { console.log(`${ok ? "  ok " : "  FAIL"} ${name}`); if (!ok) fail++; };

const exeggcute = {
  id: "tcgcsv-716435",
  name: "Exeggcute",
  num: "001/128",
  kind: "single",
  rarity: "Common",
  price: 0.15,
  printing: "Holofoil",
  pid: 716435,
  artist: "Nelnal",
  set: "ME: 30th Celebration",
  setSlug: "me-30th-celebration",
  release: "2026-09-16",
  source: "TCGplayer market",
  asOf: "2026-11-12",
  hist: [["2026-09-26", 0.19], ["2026-09-27", 0.2], ["2026-10-03", 0.18], ["2026-10-05", 0.22], ["2026-10-06", 0.15], ["2026-10-07", 0.17], ["2026-10-08", 0.19], ["2026-10-09", 0.21], ["2026-10-10", 0.18], ["2026-10-11", 0.14], ["2026-10-12", 0.18], ["2026-10-13", 0.2], ["2026-10-14", 0.2], ["2026-10-15", 0.19], ["2026-10-16", 0.17], ["2026-10-17", 0.19], ["2026-10-18", 0.21], ["2026-10-19", 0.19], ["2026-10-20", 0.15], ["2026-10-22", 0.17], ["2026-10-23", 0.13], ["2026-10-24", 0.13], ["2026-10-25", 0.15], ["2026-10-26", 0.17], ["2026-10-27", 0.14], ["2026-10-28", 0.13], ["2026-10-30", 0.16], ["2026-10-31", 0.12], ["2026-11-07", 0.17], ["2026-11-08", 0.18], ["2026-11-09", 0.17], ["2026-11-10", 0.18], ["2026-11-11", 0.18], ["2026-11-12", 0.15]],
};

const files = {
  "research/assets/public/counts.json": { asOf: "2026-11-12", updatedAt: "2026-11-12T00:00:00Z" },
  "research/assets/public/feed/status.json": { images: { tcgplayer: true } },
  "research/assets/public/redirects.json": { products: { "old-slug": "/c/tcgcsv-1" } },
  "data/card-attrs.json": {
    cards: {
      "swsh7-215": { t: ["Darkness"], st: ["VMAX", "Single Strike"], sc: "Pokémon", hp: 310, ev: "Umbreon V", dex: 197, w: "Grass", rm: "E" },
    },
  },
  "data/card-catalogue.json": {
    cards: {
      "swsh7-215": {
        name: "Umbreon VMAX",
        artist: "KEIICHIRO ITO",
        setId: "swsh7",
        setName: "Evolving Skies",
        number: "215",
        rarity: "Rare Rainbow",
        releaseDate: "2021/08/27",
        supertype: "Pokémon",
        price: 2410.66,
        priceFinish: "holofoil",
        priceUpdatedAt: "2026/08/22",
        priceSource: "tcgplayer via pokemontcg.io",
      },
      "me55-1": {
        name: "Exeggcute",
        artist: "Nelnal",
        setId: "me55",
        setName: "30th Celebration",
        number: "001/128",
        rarity: "Common",
        releaseDate: "2026/09/16",
        tcgPlayerId: "716435",
        tcgPlayerIdMethod: "tcgcsv-group-number-name",
        printing: "Holofoil",
        era: "ME",
        eraName: "Mega Evolution",
      },
      "me55-2": {
        name: "Alolan Exeggutor",
        artist: "Oswaldo KATO",
        setId: "me55",
        setName: "30th Celebration",
        number: "002/128",
        rarity: "Common",
        releaseDate: "2026/09/16",
        tcgPlayerId: "716436",
        tcgPlayerIdMethod: "tcgcsv-group-number-name",
        printing: "Holofoil",
        era: "ME",
        eraName: "Mega Evolution",
      },
    },
  },
  "research/assets/public/buckets/35.json": [exeggcute],
};

const catalogue = files["data/card-catalogue.json"].cards;
t("swsh7-215 catalogue row has no product id", catalogue["swsh7-215"].tcgPlayerId == null && catalogue["swsh7-215"].pid == null);
t("me55-1 catalogue product id is the string 716435", catalogue["me55-1"].tcgPlayerId === "716435");
t("me55-2 catalogue product id is the string 716436", catalogue["me55-2"].tcgPlayerId === "716436");

const fetchImpl = async (url) => {
  const path = String(url).replace(/^https:\/\/raw\.githubusercontent\.com\/Tbaker-maker\/Catchem-data\/(?:public-data|main)\//, "");
  if (Object.prototype.hasOwnProperty.call(files, path)) {
    return new Response(JSON.stringify(files[path]), { status: 200, headers: { "content-type": "application/json" } });
  }
  return new Response("no", { status: 404 });
};

async function page(pathname) {
  resetJsonCache();
  const res = await renderPath(pathname, fetchImpl, {});
  return { status: res.status, body: await res.text(), loc: res.headers.get("location") || "" };
}

const pretty = await page("/c/me55-1");
const direct = await page("/c/tcgcsv-716435");
const noPid = await page("/c/swsh7-215");
const noNightly = await page("/c/me55-2");
const missing = await page("/c/not-a-card");
const redir = await page("/c/old-slug");

const chart = (html) => html.includes('class="hc pc"') && html.includes('data-view="price"') && html.includes('data-view="change"');
t("pretty URL is the full chart, not a redirect", pretty.status === 200 && !pretty.loc && chart(pretty.body) && pretty.body.includes("Exeggcute"));
const hero = pretty.body.slice(pretty.body.indexOf('class="cp-photo"'));
const heroImg = hero.match(/<picture><source media="\(min-width: 768px\)" srcset="([^"]+)"><img\b[^>]*?\ssrc="([^"]+)"/);
t("pretty URL keeps the phone hero for product 716435", !!heroImg && heroImg[1] === "/data/editor/tcg/me55/1_hires.png" && heroImg[2].startsWith("/api/card-hero?pid=716435") && heroImg[2].includes("fb=/data/editor/tcg/me55/1_hires.png") && !heroImg[2].startsWith("/data/editor/"));
t("pretty chart watermark uses the slug", pretty.body.includes('class="pc-mark-path">/c/me55-1</span>'));
t("tcgcsv card page still has the price and percent chart", direct.status === 200 && chart(direct.body));
t("a slug with no product id stays skinny and has no chart", noPid.status === 200 && noPid.body.includes("Umbreon VMAX") && !noPid.body.includes('class="hc pc"') && !noPid.body.includes("246723"));
t("a product id with no nightly row stays skinny and is not a 404", noNightly.status === 200 && noNightly.body.includes("Alolan Exeggutor") && !noNightly.body.includes('class="hc pc"') && !/<h1>Not in the catalog<\/h1>/.test(noNightly.body));
t("an unknown slug is not found", missing.status === 404);
t("a stored product redirect still leaves", redir.status === 301 && redir.loc === "/c/tcgcsv-1");
t("these pages do not say sold", !/\bsold\b/i.test(pretty.body + noPid.body + noNightly.body));

if (fail) process.exit(1);
console.log("pretty chart ok");
