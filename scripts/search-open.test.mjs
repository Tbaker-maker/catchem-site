import { readFile } from "node:fs/promises";
import { createRank } from "../src/catalog-rank.mjs";
import { renderSearch } from "../src/ui.mjs";
import worker from "../src/index.mjs";

let fail = 0;
const t = (n, ok) => { console.log((ok ? "ok   " : "FAIL ") + n); if (!ok) fail++; };
const { pickTarget, typeLabel, rankCatalog } = createRank();

const lite = await (await fetch("https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/research/assets/public/search-lite.json")).json();
const top = (q) => rankCatalog(q, lite, 1)[0];
const fold = (r) => String(`${r?.[1] || ""} ${r?.[2] || ""} ${r?.[3] || ""}`).toLowerCase();

const cases = [
  ["151 mini tin", "list", (r) => /151 mini tin/.test(fold(r))],
  ["shining legends etb", "page", (r) => /shining legends/.test(fold(r)) && /elite trainer box/.test(fold(r))],
  ["pikachu 088", "page", (r) => /pikachu/.test(fold(r)) && /088/.test(fold(r))],
  ["umbreon vmax alt", "page", (r) => /umbreon vmax/.test(fold(r)) && /215/.test(fold(r))],
  ["moonbreon", "page", (r) => /umbreon vmax/.test(fold(r)) && /215/.test(fold(r))],
  ["base set charizard", "page", (r) => r && r[1] === "Charizard" && r[2] === "Base Set"],
  ["charizard ex 199", "page", (r) => /charizard ex/.test(fold(r)) && /199/.test(fold(r))],
  ["199 charizard ex", "page", (r) => /charizard ex/.test(fold(r)) && /199/.test(fold(r))],
  ["151 etb", "page", (r) => /^151 elite trainer box$/.test(String(r?.[1] || "").toLowerCase())],
  ["celebrations upc", "page", (r) => /celebrations/.test(fold(r)) && /ultra-premium/.test(fold(r))],
  ["tins 151", "list", (r) => /151 mini tin/.test(fold(r))],
  ["evolving skies booster box", "page", (r) => /evolving skies booster box/.test(fold(r)) && !/half/.test(fold(r))],
  ["es bb", "page", (r) => /evolving skies booster box/.test(fold(r)) && !/half/.test(fold(r))],
  ["prismatic evolutions etb", "page", (r) => /prismatic evolutions elite trainer box/.test(fold(r)) && !/pokemon center|dollar/.test(fold(r))],
  ["fusion strike etb", "page", (r) => /fusion strike elite trainer box/.test(fold(r)) && !/pokemon center|sam/.test(fold(r))],
  ["hidden fates etb", "page", (r) => /hidden fates elite trainer box/.test(fold(r))],
  ["van gogh pikachu", "page", (r) => /grey felt hat/.test(fold(r))],
  ["surging sparks booster box", "page", (r) => /surging sparks booster box/.test(fold(r)) && !/half/.test(fold(r))],
  ["destined rivals etb", "page", (r) => /destined rivals elite trainer box/.test(fold(r)) && !/pokemon center/.test(fold(r))],
  ["obsidian flames etb", "page", (r) => /obsidian flames elite trainer box/.test(fold(r)) && !/pokemon center/.test(fold(r))],
  ["paldean fates etb", "page", (r) => /paldean fates elite trainer box/.test(fold(r)) && !/pokemon center/.test(fold(r))],
  ["temporal forces booster box", "page", (r) => /temporal forces booster box/.test(fold(r)) && !/half/.test(fold(r))],
  ["brilliant stars booster box", "page", (r) => /brilliant stars booster box/.test(fold(r)) && !/half/.test(fold(r))],
  ["lost origin booster box", "page", (r) => /lost origin booster box/.test(fold(r)) && !/half/.test(fold(r))],
  ["cosmic eclipse booster box", "page", (r) => /cosmic eclipse booster box/.test(fold(r))],
  ["shrouded fable etb", "page", (r) => /shrouded fable elite trainer box/.test(fold(r))],
  ["blaines charizard", "page", (r) => /blaine.?s charizard/.test(fold(r))],
  ["shining legend etb", "page", (r) => /shining legends elite trainer box/.test(fold(r))],
  ["charizard 4/102", "list", (r) => /charizard/.test(fold(r)) && /4\/102|004\/102/.test(fold(r))],
  ["pokemon", "list", (r) => /pokémon|pokemon/.test(fold(r))],
];

t("at least 25 real queries", cases.length >= 25);
for (const [q, mode, pred] of cases) {
  const pick = pickTarget(q, lite, 8);
  const row = pick.hits[0];
  const hrefOk = mode === "page" ? pick.href === `/${row && row[5] === "sealed" ? "p" : "c"}/${row?.[0]}` : pick.href.startsWith("/search?q=");
  t(`${q} -> ${mode}`, pick.mode === mode && pred(row) && hrefOk && !!pick.id);
}
t("a sealed suggestion is not labeled NM", typeLabel(["tcgcsv-1", "151 Mini Tin", "151", "", "", "sealed"]) === "Mini Tin" && typeLabel(["tcgcsv-2", "Shining Legends Elite Trainer Box", "Shining Legends", "", "", "sealed"]) === "ETB" && !/NM|Near Mint/.test(typeLabel(["tcgcsv-3", "Booster Box", "", "", "", "sealed"])));
t("a single keeps the single label", typeLabel(["tcgcsv-4", "Pikachu", "Base", "088", "", "single"]) === "Single");
t("moonbreon still resolves when the shard union is only Umbreon rows", rankCatalog("moonbreon", lite.filter((r) => /umbreon/i.test(r[1])), 1)[0][0] === "tcgcsv-246723");

const search = renderSearch({});
t("search page has a suggestion list and does not import the remote ranker", search.includes('id="finder"') && search.includes("paintFinder") && search.includes("expandQuery(q)") && !search.includes("/data/search-rank.mjs"));
t("search suggestions name the type and stay 44px", search.includes("finder-type") && search.includes("min-height:44px") && search.includes("position:absolute"));

const indexHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
const env = { ASSETS: { fetch: async () => new Response(indexHtml, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }) }, FEED_ENABLED: "true" };
const home = await (await worker.fetch(new Request("https://catchemtcg.com/"), env)).text();
t("home search has a button, a suggestion list, and still offers the feed", home.includes('id="home-q"') && home.includes('id="home-finder"') && home.includes(">Search</button>") && home.includes("catchem-finder") && home.includes('class="btn btn-primary" href="/feed">Open the Feed'));
t("the catalogue index is not requested until the box is focused", home.indexOf("feed/search/manifest") > home.indexOf("function manifest") && home.includes('addEventListener("focus"'));
t("home suggestions do not add another feed link", (home.match(/href="\/feed"/g) || []).length === 4);
t("no em dash in the new search copy", !/\u2014|\u2013/.test(home.slice(home.indexOf("hero-search"), home.indexOf("hero-search") + 2500)));

if (fail) process.exit(1);
console.log("search open ok");
