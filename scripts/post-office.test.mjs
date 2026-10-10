import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker, { renderPath } from "../src/index.mjs";
import { artistNotable, clientHelpers, comparePair, downloadName, parseQuery, preferPrinting, priceLine } from "../src/post-copy.mjs";
import { patchEditorHtml, patchPaperRows, PAPER_PATH, EDITOR_URL } from "../src/full-editor.mjs";
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
t("homepage says catalog", !/catalog/i.test(home));
t("nav close wins on small screens", home.lastIndexOf(".site-bar nav{display:none") > home.indexOf(".site-bar nav{display:none"));
t("dock hide is the last dock display", home.lastIndexOf(".dock{display:none") > home.lastIndexOf(".dock{display:flex"));
t("homepage does not link the hidden pages", !/href="\/(board|receipts|accuracy|movers)/.test(home) && home.includes('href="/feed">Open the Feed'));

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
  if (String(url).includes("/play.html")) return { ok: true, status: 200, text: async () => "<!doctype html><html><head></head><body>Pin two cards. We make a picture.</body></html>", json: async () => null };
  return { ok: false, status: 404, json: async () => null, text: async () => "" };
};
const post = await (await renderPath("/post-office", fetchImpl)).text();
t("editor is on the page", post.includes('src="/post-office/app?v=') && post.includes("Post Office editor") && !post.includes("The full catalog:") && !post.includes('id="fresh"'));
t("post office footer names the build", post.includes('id="post-office-build"') && post.includes("Post Office build "));
t("editor does not use the old paper file", !post.includes("paper-rows") && !post.includes("Opening soon") && !post.includes("sells for") && !post.includes("about 0"));
t("catalog spelling stays off this page", !post.includes("The full catalog:") && !post.includes("catalogue"));
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
  '<button class="chip" data-i="sell">Selling</button>',
  'add("question", "Would you still buy the " + first.s + " " + first.n + " today?");',
  'const label = fIntent === "want" ? "Looking for" : fIntent === "trade" ? "Trade list" : "For sale";',
  'box.innerHTML = "<b>We will not make a sell image for singles.</b><br>" + "The whole question on a single is condition, and a buyer needs to see the card you are actually sending. ";',
  '<button id="make">Make the image</button>',
  '<input id="q" placeholder="Pokémon, artist, or set">',
  "let INDEX = [], tray = [], blob = null;",
  "</body>",
].join("\n");
const patchedHtml = patchEditorHtml(shell, "2026-09-27");
t("full editor keeps its tools", patchedHtml.includes("Compare both") && patchedHtml.includes("binder page") && patchedHtml.includes("Just art") && patchedHtml.includes("Make the image") && patchedHtml.includes("artist"));
t("full editor uses live price words", patchedHtml.includes(PAPER_PATH) && patchedHtml.includes('PRICES_AS_OF = "2026-09-27"') && patchedHtml.includes("TCGplayer market") && !patchedHtml.includes("sells for") && patchedHtml.includes("Facebook") && patchedHtml.includes("YouTube") && patchedHtml.includes("Instagram") && patchedHtml.includes("catchem.png") && !patchedHtml.includes('".jpg"') && patchedHtml.includes("Write the post") && patchedHtml.includes("Ideas") && patchedHtml.includes("Copy all") && patchedHtml.includes("var INDEX = [], tray = []"));
t("editor drops buy and sell prompts", !patchedHtml.includes("Selling") && !patchedHtml.includes("Would you still buy") && !patchedHtml.includes("For sale") && !patchedHtml.includes("sell image for singles") && !patchedHtml.includes("buyer needs") && patchedHtml.includes("Looking for") && patchedHtml.includes("Trade list") && patchedHtml.includes("Make the image"));
const stamped = patchEditorHtml(shell, "2026-09-27", "Post Office build abc1234 · 2026-09-28");
t("editor stamp sits in the footer", stamped.includes('id="post-build"') && stamped.includes("Post Office build abc1234 · 2026-09-28") && stamped.indexOf("post-build") < stamped.lastIndexOf("</body>"));
t("editor file is play", EDITOR_URL.endsWith("/play.html") && !EDITOR_URL.endsWith("/build.html"));
const playRaw = await (await fetch(EDITOR_URL)).text();
const playHtml = patchEditorHtml(playRaw, "2026-09-27", "Post Office build abc");
t("play assets leave the page origin", playHtml.includes("https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/research/assets/") && !playHtml.includes("document.baseURI") && playHtml.includes('"/data/editor/tcg/"') && !playHtml.includes("images.pokemontcg.io") && !playHtml.includes('throw new Error("miss "'));
t("play wears the site skin", playHtml.includes('id="site-skin"') && playHtml.includes("--accent:#d9b779") && playHtml.includes("body>header{display:none}") && playHtml.includes("Pin two cards. We make a picture.") && playHtml.includes('data-med="paper"') && playHtml.includes(">Pocket<") && playHtml.includes(">Games<") && !playHtml.includes("Visual content") && !playHtml.includes("Visual Quantity"));
t("first screen is forty priced pictures", playHtml.includes("function screenRows") && playHtml.includes("var SCREEN = 40;") && playHtml.includes("screenAsk = SCREEN") && playHtml.includes("storedPrice(c) > 0 && pictureInFile(c)") && playHtml.includes("storedPrice(b) - storedPrice(a)") && playHtml.includes("first.slice(0, SCREEN)") && playHtml.includes("/cards/c30/ir-moltres.png") && playHtml.includes("/cards/c30/ir-articuno.png") && playHtml.includes("/cards/c30/ir-zapdos.png") && !playHtml.includes("function screenCap") && !playHtml.includes("return 12") && !playHtml.includes("return 24") && !playHtml.includes("var shown = rows;"));
t("a card with no src says the picture is missing", playHtml.includes("The picture is missing.") && playHtml.includes('return !!(c && String(c.src || "").trim());') && playHtml.includes("storedPrice(c) > 0 && pictureInFile(c)") && !playHtml.includes("if (pictureInFile(c)) lead.push") && playHtml.includes("data-more"));
t("151 pathways stay on their own ids", playHtml.includes('["sv3pt5-129", "sv3pt5-130"]') && playHtml.includes('["sv3pt5-79", "sv3pt5-80"]') && playHtml.includes('["sv3pt5-170", "sv3pt5-171", "sv3pt5-200"]') && playHtml.includes('c.id === "base5-3"') && playHtml.includes('c.id === "base1-63"'));
t("tonight leaves base squirtle off", !playHtml.includes('pins = ["base1-63", "sv3pt5-170"]') && playHtml.includes("function pinTonight"));
t("an unresolved 151 line is not offered", playHtml.includes("function path151Offer") && playHtml.includes("return cards || [];") && playHtml.includes('var offer = path151Offer(who, "line");') && playHtml.includes("if (offer) return offer;") && playHtml.includes('var onlyLine = path151Offer(mon, "line");') && playHtml.includes("if (onlyLine) return onlyLine;") && playHtml.includes("if (lineOffer.length)") && !playHtml.includes('var safe = path151For(who, "line");') && playHtml.includes('["sv3pt5-144", "sv3pt5-202", "sv3pt5-146"]') && playHtml.includes('["sv3pt5-170", "sv3pt5-171", "sv3pt5-200"]') && playHtml.includes('id:"sv3pt5-200", name:"Blastoise ex"'));
t("play keeps ideas on the pin list", playHtml.includes('id="dl"') && playHtml.includes("window.pins"));
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
t("matched paper row keeps the catalog id", pricedRows.rows[0][22] === "tcgcsv-89171" && pricedRows.rows[3][22] == null);
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
const badScan = await worker.fetch(new Request("https://catchemtcg.com/data/editor/tcg/not-a-set"), { PUBLIC_FETCH: fetchImpl, ASSETS: env.ASSETS });
t("card scan proxy rejects a bad path", badScan.status === 400);
const build = await worker.fetch(new Request("https://catchemtcg.com/build"), { PUBLIC_FETCH: fetchImpl, ASSETS: env.ASSETS });
const buildHtml = await build.text();
t("build is the editor", build.status === 200 && !build.headers.get("location") && buildHtml.includes('src="/post-office/app?v=') && buildHtml.includes("Post Office editor"));
const buildHead = await worker.fetch(new Request("https://catchemtcg.com/build", { method: "HEAD" }), { PUBLIC_FETCH: fetchImpl, ASSETS: env.ASSETS });
const buildHeadHtml = await buildHead.text();
t("build head is the editor", buildHead.status === 200 && !buildHead.headers.get("location") && buildHeadHtml.includes('src="/post-office/app?v='));
const slash = await worker.fetch(new Request("https://catchemtcg.com/post-office/"), { PUBLIC_FETCH: fetchImpl, ASSETS: env.ASSETS });
const slashHtml = await slash.text();
t("post office slash is the editor", slash.status === 200 && !slash.headers.get("location") && slashHtml.includes('src="/post-office/app?v=dev"'));
const officeHead = await worker.fetch(new Request("https://catchemtcg.com/post-office", { method: "HEAD" }), { PUBLIC_FETCH: fetchImpl, ASSETS: env.ASSETS });
t("post office head is the editor", officeHead.status === 200 && (await officeHead.text()).includes("Post Office editor"));
const sneak = await worker.fetch(new Request("https://catchemtcg.com/feed?video=1"), { PUBLIC_FETCH: fetchImpl, ASSETS: env.ASSETS });
t("video query does not open the feed", sneak.status === 302 && new URL(sneak.headers.get("location"), "https://catchemtcg.com").pathname === "/");

resetQuota();
resetCatalogCache();
const anon = await worker.fetch(new Request("https://catchemtcg.com/api/ideas", { method: "POST", body: "{}" }), { SESSION_SECRET: "test-secret", PUBLIC_FETCH: fetchImpl });
const anonBody = await anon.json();
t("ideas require sign-in", anon.status === 401 && anonBody.card && anonBody.card.title && /Discord sign-in is not turned on yet/.test(anonBody.line) && anonBody.ready === false);
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
    t("idea " + (i + 1) + " is from the catalog", res.status === 200 && body.ideas && body.ideas[0].includes("Umbreon") && body.ideas.join(" ").includes("TCGplayer market: $2,214.79 (2026-09-27)") && body.ideas.every((line) => line.includes("Pokémon")));
    t("idea quota counts down", body.quota && body.quota.left === 2 - i && body.quota.cap === 3);
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
t("fact post does not invent", local.length === 3 && local.every((v) => v.includes("Keiichiro Ito") && v.includes("Evolving Skies") && v.includes("Pokémon") && v.includes("TCGplayer market: $2,214.79 (2026-09-27)")));
const sampleCard = { name: "Umbreon VMAX", printing: "215/203", edition: "Evolving Skies", artist: "Keiichiro Ito", price: "TCGplayer market: $2,214.79 (2026-09-27)" };
const toneNames = ["informative", "hype", "chill", "funny"];
const tonePosts = toneNames.map((tone) => factPost([sampleCard], tone));
t("tones change the text", new Set(tonePosts.map((lines) => lines[0])).size === 4 && tonePosts.every((lines) => lines.length === 3));
const pocketCard = { name: "Pikachu", printing: "094", edition: "Genetic Apex", artist: "", price: "No market price" };
const samples = tonePosts.concat([factPost([pocketCard], "informative")]);
const bannedPost = /\b(buys?|sells?|selling|holds?|holding|floors?|targets?|plays?|picks?|bullish|bearish|invest|roi|crypto|nfts?|web3)\b|to the moon|about 0/i;
t("five sample posts stay inside the rules", samples.length === 5 && samples.every((lines) => lines.length === 3 && lines.every((line) => line.includes("Pokémon") && !line.includes("Pokemon") && !bannedPost.test(line) && line.length <= 280 && (line.includes("Pikachu") ? !line.includes("TCGplayer market:") : line.includes("TCGplayer market: $2,214.79 (2026-09-27)")))));
const signPage = await worker.fetch(new Request("https://catchemtcg.com/signin"), { PUBLIC_FETCH: fetchImpl });
const signHtml = await signPage.text();
t("signed out sign-in is one line and not a button", signPage.status === 200 && signHtml.includes("Discord sign-in is not turned on yet") && !signHtml.includes("<button") && !signHtml.includes("/auth/discord"));
const sessionOff = await worker.fetch(new Request("https://catchemtcg.com/api/session"), { SESSION_SECRET: secret, PUBLIC_FETCH: fetchImpl });
const sessionOffBody = await sessionOff.json();
t("session tells a signed-out visitor how to sign in", sessionOff.status === 200 && sessionOffBody.signedIn === false && sessionOffBody.ready === false && /not turned on yet/.test(sessionOffBody.line));
const sessionOn = await worker.fetch(new Request("https://catchemtcg.com/api/session", { headers: { cookie } }), { SESSION_SECRET: secret, PUBLIC_FETCH: fetchImpl });
const sessionOnBody = await sessionOn.json();
t("signed in session shows the free idea cap", sessionOn.status === 200 && sessionOnBody.signedIn === true && sessionOnBody.premium === false && sessionOnBody.ideas.cap === 3 && sessionOnBody.ideas.left === 0);
const discordEnv = { SESSION_SECRET: secret, DISCORD_CLIENT_ID: "id", DISCORD_CLIENT_SECRET: "sec", PUBLIC_FETCH: fetchImpl, ASSETS: env.ASSETS };
const readyPage = await worker.fetch(new Request("https://catchemtcg.com/signin"), discordEnv);
const readyHtml = await readyPage.text();
t("configured sign-in is a Discord link", readyHtml.includes('href="/auth/discord?next=/post-office"') && readyHtml.includes("Sign in with Discord") && !readyHtml.includes("<button"));
const start = await worker.fetch(new Request("https://catchemtcg.com/auth/discord?next=/post-office"), discordEnv);
t("discord sign-in leaves for Discord", start.status === 302 && String(start.headers.get("location")).startsWith("https://discord.com/oauth2/authorize?") && String(start.headers.get("location")).includes("client_id=id"));
const badCb = await worker.fetch(new Request("https://catchemtcg.com/auth/discord/callback?code=x&state=nope"), discordEnv);
t("discord callback rejects a bad state", (await badCb.text()).includes("did not finish"));

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

const gateEnv = {
  SESSION_SECRET: secret,
  DISCORD_CLIENT_ID: "id",
  DISCORD_CLIENT_SECRET: "sec",
  PUBLIC_FETCH: fetchImpl,
  ASSETS: env.ASSETS,
  POST_OFFICE_ALLOWLIST: "111, pro",
};
const gate = await worker.fetch(new Request("https://catchemtcg.com/post-office"), gateEnv);
const gateHtml = await gate.text();
t("a set allowlist does not hide the editor", gate.status === 200 && !gate.headers.get("location") && gateHtml.includes('src="/post-office/app?v=') && gateHtml.includes("Post Office editor") && !gateHtml.includes("invite-only"));
const gateHead = await worker.fetch(new Request("https://catchemtcg.com/post-office/", { method: "HEAD" }), gateEnv);
const gateHeadHtml = await gateHead.text();
t("head stays the editor when the list is set", gateHead.status === 200 && gateHeadHtml.includes("Post Office editor") && !gateHeadHtml.includes("invite-only"));
const gateBuild = await worker.fetch(new Request("https://catchemtcg.com/build"), gateEnv);
const gateBuildHtml = await gateBuild.text();
t("build stays the editor when the list is set", gateBuild.status === 200 && gateBuildHtml.includes('src="/post-office/app?v=') && !gateBuildHtml.includes("invite-only"));
const onList = "ce_session=" + await signSession({ sub: "d:111", premium: false }, secret);
const allowedPage = await worker.fetch(new Request("https://catchemtcg.com/build", { headers: { cookie: onList } }), gateEnv);
const allowedHtml = await allowedPage.text();
t("allowlisted discord id gets the editor", allowedPage.status === 200 && allowedHtml.includes('src="/post-office/app?v=dev"') && allowedHtml.includes("Post Office editor"));
const offList = "ce_session=" + await signSession({ sub: "d:222", premium: true }, secret);
const deniedPage = await worker.fetch(new Request("https://catchemtcg.com/post-office", { headers: { cookie: offList } }), gateEnv);
const deniedHtml = await deniedPage.text();
t("a discord id off the list gets the editor", deniedHtml.includes('src="/post-office/app?v=') && deniedHtml.includes("Post Office editor") && !deniedHtml.includes("invite-only"));
const gatedApp = await worker.fetch(new Request("https://catchemtcg.com/post-office/app"), gateEnv);
const gatedAppHtml = await gatedApp.text();
t("the app url is the editor", gatedApp.status === 200 && gatedAppHtml.includes("Pin two cards. We make a picture.") && !gatedAppHtml.includes("invite-only"));
const blank = await worker.fetch(new Request("https://catchemtcg.com/post-office"), { ...gateEnv, POST_OFFICE_ALLOWLIST: "  " });
t("a blank allowlist stays open", (await blank.text()).includes('src="/post-office/app?v=dev"'));
const faq = await worker.fetch(new Request("https://catchemtcg.com/faq"), gateEnv);
const faqHtml = await faq.text();
t("faq stays public", faq.status === 200 && faqHtml.includes("Questions") && !faqHtml.includes("invite-only"));
const blockedIdea = await worker.fetch(new Request("https://catchemtcg.com/api/ideas", {
  method: "POST",
  headers: { cookie: offList, "content-type": "application/json" },
  body: JSON.stringify({ ids: ["tcgcsv-246723"] }),
}), gateEnv);
const blockedBody = await blockedIdea.json();
t("ideas follow the allowlist", blockedIdea.status === 403 && /invite-only/.test(blockedBody.line));
const allowedIdea = await worker.fetch(new Request("https://catchemtcg.com/api/ideas", {
  method: "POST",
  headers: { cookie: onList, "content-type": "application/json" },
  body: JSON.stringify({ ids: ["tcgcsv-246723"] }),
}), gateEnv);
const allowedIdeaBody = await allowedIdea.json();
t("allowlisted ideas still run", allowedIdea.status === 200 && allowedIdeaBody.ideas && allowedIdeaBody.ideas[0].includes("Umbreon"));
const proCookie = "ce_session=" + await signSession({ sub: "pro", premium: true }, secret);
const proText = await worker.fetch(new Request("https://catchemtcg.com/api/post-text", {
  method: "POST",
  headers: { cookie: proCookie, "content-type": "application/json" },
  body: JSON.stringify({ ids: ["tcgcsv-517045"] }),
}), gateEnv);
t("listed premium post text still runs", proText.status === 200);

const quota = await worker.fetch(new Request("https://catchemtcg.com/api/video/quota", { method: "POST", body: JSON.stringify({ action: "status" }) }), { SESSION_SECRET: secret });
t("video quota is sign-in, not a cookie bucket", quota.status === 401);

const looked = await factsFor(["tcgcsv-246723"], fetchImpl);
t("fact pack uses the live row", looked.cards[0].price === "TCGplayer market: $2,214.79 (2026-09-27)");

if (fail) process.exit(1);
console.log("post office ok");

{
  const { patchPocketRows, pocketImageMap } = await import("../src/full-editor.mjs");
  const rows = [
    ["tcgp-A1-001", "Bulbasaur", "Genetic Apex", "2024", 0, "One Diamond", 0, "P", 70, 0, 0, "Basic", "001", "A1", "https://assets.tcgdex.net/en/tcgp/A1/001/high.webp"],
    ["tcgp-B2a-010", "X", "S", "2026", 0, 0, 0, "P", 0, 0, 0, 0, "010", "B2a", "https://evil.example/x.webp"],
    ["tcgp-A1-002", "Ivysaur", "Genetic Apex", "2024", 0, 0, 0, "P", 0, 0, 0, 0, "002", "A1", 0],
  ];
  const out = patchPocketRows(rows);
  const okPocket = out[0][14] === "/data/editor/pocket/tcgp-A1-001" && out[1][14] === 0 && out[2][14] === 0 && pocketImageMap(rows).get("tcgp-A1-001") === rows[0][14] && pocketImageMap(rows).size === 1;
  if (!okPocket) { console.error("FAIL a Pocket picture is the checked URL for that id, served same-origin"); process.exitCode = 1; }
  else console.log("ok a Pocket picture is the checked URL for that id, served same-origin");
}
