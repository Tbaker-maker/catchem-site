import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker, { renderPath } from "../src/index.mjs";
import { artistNotable, clientHelpers, comparePair, downloadName, parseQuery, preferPrinting, priceLine } from "../src/post-copy.mjs";
import { patchEditorHtml, patchPaperRows, PAPER_PATH } from "../src/full-editor.mjs";
import { resetQuota, signSession } from "../src/quota.mjs";
import { factPost, factsFor, resetCatalogCache, STYLE_PROMPT } from "../src/ai.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.log("  FAIL", name); }
};

t("price has the date", priceLine(900, "2026-09-27") === "TCGplayer market: $900.00 (2026-09-27)");
t("missing price is not about 0", priceLine(0, "2026-09-27") === "No market price" && !priceLine(0, "2026-09-27").includes("about"));
t("download is png, not png.jpg", downloadName("catchem-post.png") === "catchem-post.png" && downloadName("catchem-post.png.jpg") === "catchem-post.png" && !downloadName("x.png").includes(".jpg"));
t("both stays two cards", comparePair({ id: "a" }, { id: "b" }).layout === "side-by-side" && comparePair({ id: "a" }, { id: "b" }).tcg.id === "a");
t("query chip strips a trailing both", parseQuery("Pikachu, both", "tcg").mode === "both" && parseQuery("Pikachu, both", "tcg").q === "Pikachu");

const commons = [["id-c", "Common", "Set", "1", "Ada", "single", 4, "", "Common"]];
const notable = [["id-n", "Star", "Set", "2", "Ada", "single", 900, "", "Secret Rare"], ...commons];
const picked = artistNotable(notable);
t("artist hunt leads with the high print", picked[0][0] === "id-n" && picked.every((r) => r[6] >= 20));
t("printing preference keeps the crown ahead of a flat tie", preferPrinting([
  ["p", "Pikachu ex", "A", "096", "", "pocket", 0, "", "Four Diamond"],
  ["c", "Pikachu ex", "A", "285", "", "pocket", 0, "", "Crown"],
])[0][0] === "c");

const home = await readFile(join(root, "index.html"), "utf8");
t("homepage h1", home.includes("<h1>A home for collectors, rippers and flippers.</h1>"));
t("homepage title dropped the old line", !home.includes("Know what to rip"));
t("homepage says catalog", home.includes("The full catalog:") && !home.includes("catalogue"));
t("nav close wins on small screens", home.lastIndexOf(".site-bar nav{display:none") > home.indexOf(".site-bar nav{display:none"));
t("dock hide is the last dock display", home.lastIndexOf(".dock{display:none") > home.lastIndexOf(".dock{display:flex"));
t("homepage does not link the hidden pages", !/href="\/(feed|board|receipts|accuracy|movers)/.test(home));

const moon = ["tcgcsv-246723", "Umbreon VMAX (Alternate Art Secret)", "SWSH07: Evolving Skies", "215/203", "Keiichiro Ito", "single", 2214.79, "swsh07-evolving-skies", "Secret Rare"];
const other = ["tcgcsv-246720", "Umbreon VMAX", "SWSH07: Evolving Skies", "095/203", "Akira Egawa", "single", 27.25, "swsh07-evolving-skies", "Ultra Rare"];
const zard = ["tcgcsv-517045", "Charizard ex - 199/165", "SV: Scarlet & Violet 151", "199/165", "miki kudo", "single", 346.31, "sv-scarlet-and-violet-151", "Special Illustration Rare"];
const zardBase = ["tcgcsv-1", "Charizard", "Base Set", "4/102", "", "single", 400, "base", "Holo Rare"];
const pika = ["tcgcsv-2", "Pikachu", "Base Set", "58/102", "", "single", 8, "base", "Common"];
const pikaEx = ["tcgp-A1-285", "Pikachu ex", "Genetic Apex", "285", "PLANETA CG Works", "pocket", 0, "A1", "Crown", "https://example.test/pika.webp"];
const pikaPocketBase = ["tcgp-A1-096b", "Pikachu", "Genetic Apex", "094", "", "pocket", 0, "A1", "One Diamond"];
const rows = [other, moon, zardBase, zard, pika, pikaEx, pikaPocketBase];

const rankSrc = await (await fetch("https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/research/assets/public/search-rank.mjs")).text();
const rankUrl = "data:text/javascript," + encodeURIComponent(rankSrc);
const { rankCatalog } = await import(rankUrl);
t("Umbreon VMAX 215 is the Moonbreon", rankCatalog("Umbreon VMAX 215", rows, 4)[0][3] === "215/203");
t("Charizard 151 SIR is 199/165", rankCatalog("Charizard 151 SIR", rows, 4)[0][3] === "199/165");
t("Pikachu ex Pocket is the ex", rankCatalog("Pikachu ex", rows.filter((r) => r[5] === "pocket"), 4)[0][1] === "Pikachu ex");

const counts = { asOf: "2026-09-27", updatedAt: "2026-09-27T10:19:31.933Z", single: 1, sealed: 1 };
const files = { "counts.json": counts, "reads.json": { reads: [] }, "artists.json": { artists: [] } };
const fetchImpl = async (url) => {
  const rel = String(url).split("/public/")[1];
  if (files[rel]) return { ok: true, status: 200, json: async () => files[rel], text: async () => JSON.stringify(files[rel]) };
  if (String(url).includes("search-lite.json")) return { ok: true, status: 200, json: async () => rows };
  if (String(url).includes("pocket-catalogue.json")) return { ok: true, status: 200, json: async () => ({ cards: { "tcgp-A1-285": { name: "Pikachu ex", setName: "Genetic Apex", number: "285", artist: "PLANETA CG Works", rarity: "Crown" } } }) };
  if (String(url).includes("counts.json")) return { ok: true, status: 200, json: async () => counts };
  return { ok: false, status: 404, json: async () => null, text: async () => "" };
};
const post = await (await renderPath("/post-office", fetchImpl)).text();
t("editor is on the page", post.includes('src="/post-office/app"') && post.includes("Post Office editor") && post.includes("The full catalog:"));
t("editor does not use the old paper file", !post.includes("paper-rows") && !post.includes("Opening soon") && !post.includes("sells for") && !post.includes("about 0"));
t("catalog spelling", post.includes("The full catalog:") && !post.includes("catalogue"));
t("browser helpers define printingRank", clientHelpers().includes("function printingRank"));
const shell = [
  'fetch("paper-rows.json?v=" + v)',
  'fetch("pocket-rows.json?v=" + v)',
  'const PRICES_AS_OF = "2026/08/22";',
  'dateNote = "priced " + PRICES_AS_OF;',
  'priced[0].n + " sells for about " + Math.round(priced[0].p)',
  'priced[priced.length-1].n + " for about " + Math.round(priced[priced.length-1].p)',
  'var name = (typeof fname === "function" ? fname() : "catchem") + ".jpg";',
  "var CARD_ROWS = (window.__PAPER_ROWS && window.__PAPER_ROWS.length) ? window.__PAPER_ROWS : CORE_ROWS.slice();",
  '<option value="both">Compare both</option>',
  '<option value="9">9 — a binder page</option>',
  '<option value="art">Just art</option>',
  '<button id="make">Make the image</button>',
  '<input id="q" placeholder="Pokémon, artist, or set">',
].join("\n");
const patchedHtml = patchEditorHtml(shell, "2026-09-27");
t("full editor keeps its tools", patchedHtml.includes("Compare both") && patchedHtml.includes("binder page") && patchedHtml.includes("Just art") && patchedHtml.includes("Make the image") && patchedHtml.includes("artist"));
t("full editor uses live price words", patchedHtml.includes(PAPER_PATH) && patchedHtml.includes('PRICES_AS_OF = "2026-09-27"') && patchedHtml.includes("TCGplayer market") && !patchedHtml.includes("sells for") && patchedHtml.includes("Facebook") && patchedHtml.includes("YouTube") && patchedHtml.includes("Instagram") && patchedHtml.includes("catchem.png") && !patchedHtml.includes('".jpg"'));
const pricedRows = patchPaperRows([
  ["neo4-113", "Shining Tyranitar", "Neo Destiny", "2002", "Ken Sugimori", "Rare Shining", 4249.99],
  ["ex13-104", "Pikachu ★", "Holon Phantoms", "2006", "", "Rare Holo Star", 3200],
  ["swsh7-215", "Umbreon VMAX", "Evolving Skies", "2021", "Keiichiro Ito", "Rare Secret", 2410],
  ["missing-x", "Not A Card", "Nowhere", "1999", "", "", 99],
  ["ex11-113", "Metagross ★", "Delta Species", "2005", "", "", 951.99],
  ["ex10-105", "Lugia ex", "Unseen Forces", "2005", "", "", 2500],
  ["base1-4", "Charizard", "Base", "1999", "Ken Sugimori", "", 855.52],
], [
  ["tcgcsv-89171", "Shining Tyranitar", "Neo Destiny", "113/105", "Ken Sugimori", "single", 345, "", "Secret Rare"],
  ["tcgcsv-88111", "Pikachu Star", "EX Holon Phantoms", "104/110", "", "single", 900, "", ""],
  ["tcgcsv-246723", "Umbreon VMAX (Alternate Art Secret)", "SWSH07: Evolving Skies", "215/203", "", "single", 2214.79, "", ""],
  ["tcgcsv-87342", "Metagross (Delta Species)", "EX Delta Species", "11/113", "", "single", 130.45, "", ""],
  ["tcgcsv-241789", "Metagross VMAX", "SWSH06: Chilling Reign", "113/198", "", "single", 2.73, "", ""],
  ["tcgcsv-86912", "Lugia ex", "EX Unseen Forces", "105/115", "", "single", 0, "", ""],
  ["tcgcsv-477776", "Lugia ex - 2006 (Hiroki Yano)", "World Championship Decks", "105/115", "", "single", 103.5, "", ""],
  ["tcgcsv-42382", "Charizard", "Base Set", "004/102", "Ken Sugimori", "single", 944.53, "", ""],
  ["tcgcsv-shadow", "Charizard", "Base Set (Shadowless)", "4/102", "", "single", 5000, "", ""],
]);
t("live market replaces the old figures", pricedRows.rows[0][6] === 345 && pricedRows.rows[1][6] === 900 && pricedRows.rows[2][6] === 2214.79 && pricedRows.rows[3][6] === 0);
t("a zero live price stays unpriced", pricedRows.rows[4][6] === 0 && pricedRows.rows[5][6] === 0);
t("base set does not take the shadowless price", pricedRows.rows[6][6] === 944.53);
const feedHidden = await renderPath("/feed", fetchImpl);
t("feed stays home without the flag", feedHidden.status === 302 && feedHidden.headers.get("location") === "/");
const feedVideoOff = await (await renderPath("/feed", fetchImpl, { feed: true })).text();
t("short button stays off without the video flag", !feedVideoOff.includes("Make a Short"));
const feedOn = await (await renderPath("/feed", fetchImpl, { feed: true, video: true })).text();
t("short button is in the feed when both flags are on", feedOn.includes("Make a Short"));
t("dock rule wins", feedVideoOff.lastIndexOf(".dock{display:none") > feedVideoOff.lastIndexOf(".dock{display:flex"));

const env = {
  VIDEO_ENABLED: "true",
  PUBLIC_FETCH: fetchImpl,
  ASSETS: { fetch: async () => new Response("studio", { status: 200, headers: { "content-type": "text/html" } }) },
};
const gated = await worker.fetch(new Request("https://catchemtcg.com/video/studio.html"), { PUBLIC_FETCH: fetchImpl, ASSETS: env.ASSETS });
t("studio is closed until the server flag", gated.status === 404);
const opened = await worker.fetch(new Request("https://catchemtcg.com/video/studio.html?video=1"), env);
t("query string is not the gate", opened.status === 200);
const build = await worker.fetch(new Request("https://catchemtcg.com/build"), { PUBLIC_FETCH: fetchImpl, ASSETS: env.ASSETS });
t("build stays on this site", build.status === 301 && new URL(build.headers.get("location"), "https://catchemtcg.com").pathname === "/post-office");
const buildHead = await worker.fetch(new Request("https://catchemtcg.com/build", { method: "HEAD" }), { PUBLIC_FETCH: fetchImpl, ASSETS: env.ASSETS });
t("build head stays on this site", buildHead.status === 301 && new URL(buildHead.headers.get("location"), "https://catchemtcg.com").pathname === "/post-office");
const sneak = await worker.fetch(new Request("https://catchemtcg.com/feed?video=1"), { PUBLIC_FETCH: fetchImpl, ASSETS: env.ASSETS });
t("video query does not open the feed", sneak.status === 302 && new URL(sneak.headers.get("location"), "https://catchemtcg.com").pathname === "/");

resetQuota();
resetCatalogCache();
const anon = await worker.fetch(new Request("https://catchemtcg.com/api/ideas", { method: "POST", body: "{}" }), { SESSION_SECRET: "test-secret", PUBLIC_FETCH: fetchImpl });
const anonBody = await anon.json();
t("ideas require sign-in", anon.status === 401 && anonBody.card && anonBody.card.title);
const secret = "test-secret";
const cookie = "ce_session=" + await signSession({ sub: "user-1", premium: false }, secret);
let ideaHits = 0;
for (let i = 0; i < 4; i++) {
  const res = await worker.fetch(new Request("https://catchemtcg.com/api/ideas", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ ids: ["tcgcsv-246723"] }),
  }), { SESSION_SECRET: secret, PUBLIC_FETCH: fetchImpl });
  if (i < 3) {
    const body = await res.json();
    t("idea " + (i + 1) + " is from the catalog", res.status === 200 && body.ideas && body.ideas[0].includes("Umbreon") && body.ideas.join(" ").includes("TCGplayer market: $2,214.79 (2026-09-27)"));
  } else {
    const body = await res.json();
    ideaHits = res.status;
    t("fourth idea is the limit card", res.status === 429 && body.card && /3 a day/.test(body.card.body));
  }
}
t("stopped at the free cap", ideaHits === 429);

const text = await worker.fetch(new Request("https://catchemtcg.com/api/post-text", {
  method: "POST",
  headers: { cookie, "content-type": "application/json" },
  body: JSON.stringify({ ids: ["tcgcsv-246723"], tone: "informative", platform: "x" }),
}), { SESSION_SECRET: secret, PUBLIC_FETCH: fetchImpl });
const textBody = await text.json();
t("post text is three lines with the price", text.status === 200 && textBody.variations.length === 3 && textBody.variations.every((v) => v.includes("TCGplayer market: $2,214.79 (2026-09-27)")) && !/sells for|about 0|catalogue/i.test(textBody.variations.join(" ")));
t("style prompt names the guide and the accent", STYLE_PROMPT.includes("POST-TEXT-STYLE-GUIDE.md") && STYLE_PROMPT.includes("Pokémon") && STYLE_PROMPT.includes("3"));
const local = factPost([{ name: "Umbreon VMAX", printing: "215/203", edition: "Evolving Skies", artist: "Keiichiro Ito", price: "TCGplayer market: $2,214.79 (2026-09-27)" }]);
t("fact post does not invent", local.length === 3 && local.every((v) => v.includes("Keiichiro Ito") || v.includes("Evolving Skies")));

const premium = "ce_session=" + await signSession({ sub: "pro", premium: true }, secret);
resetQuota();
let premiumOk = 0;
for (let i = 0; i < 4; i++) {
  const res = await worker.fetch(new Request("https://catchemtcg.com/api/post-text", {
    method: "POST",
    headers: { cookie: premium, "content-type": "application/json" },
    body: JSON.stringify({ ids: ["tcgcsv-517045"] }),
  }), { SESSION_SECRET: secret, PUBLIC_FETCH: fetchImpl });
  if (res.status === 200) premiumOk++;
}
t("premium is not stuck at the free post cap", premiumOk === 4);

const quota = await worker.fetch(new Request("https://catchemtcg.com/api/video/quota", { method: "POST", body: JSON.stringify({ action: "status" }) }), { SESSION_SECRET: secret });
t("video quota is sign-in, not a cookie bucket", quota.status === 401);

const looked = await factsFor(["tcgcsv-246723"], fetchImpl);
t("fact pack uses the live row", looked.cards[0].price === "TCGplayer market: $2,214.79 (2026-09-27)");

if (fail) process.exit(1);
console.log("post office ok");
