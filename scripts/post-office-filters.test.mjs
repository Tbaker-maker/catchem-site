// Post Office Show / medium filters. These assertions fail on the unpatched editor.
import { EDITOR_URL, patchEditorHtml } from "../src/full-editor.mjs";
import {
  GOLD_STAR_LANE,
  CONNECTING_30TH_BIRDS,
  CONNECTING_STUB_IDS,
  JP_SET_PINS,
  compareDesk,
  cutoutRows,
  goldStarLaneValue,
  is30thCard,
  isConnectingCard,
  isGoldStarCard,
  isJapanesePrint,
  mangaRows,
  matchesShowPrompt,
  nextShowPrompt,
  deskAllows,
  rewriteOfficeFilters,
  rowsFromTcgdexSet,
  speciesFromJaName,
  filterPatchHits,
} from "../src/post-office-filters.mjs";
import { DEX_EN, DEX_JA } from "../src/dex-names.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.log("  FAIL", name); }
};

const gold = { id: "ex13-17", name: "Umbreon ★", species: "Umbreon", set: "Unseen Forces", rarity: "Rare Holo Star", tags: "gold-star chase" };
const vstar = { id: "swsh12-201", name: "Lucario VSTAR", species: "Lucario", rarity: "Rare Holo VSTAR", tags: "" };
const prism = { id: "sm8-146", name: "Dusk Mane Necrozma-GX", species: "Necrozma", rarity: "Rare Prism Star", name2: "Necrozma ◇" };
const me55common = { id: "me55-1", name: "Exeggcute", species: "Exeggcute", set: "30th Celebration", setId: "me55", rarity: "Common", tags: "", src: "" };
const me55moltres = { id: "me55-130", name: "Moltres", species: "Moltres", set: "30th Celebration", setId: "me55", rarity: "Illustration Rare", artist: "mashu", tags: "", src: "" };
const me55articuno = { id: "me55-132", name: "Articuno", species: "Articuno", set: "30th Celebration", setId: "me55", rarity: "Illustration Rare", artist: "mashu", tags: "", src: "" };
const me55zapdos = { id: "me55-133", name: "Zapdos", species: "Zapdos", set: "30th Celebration", setId: "me55", rarity: "Illustration Rare", artist: "mashu", tags: "", src: "" };
const stub = { id: "c30-ir-moltres", name: "Moltres", species: "Moltres", set: "30th Celebration", tags: "30th connecting birds ir en", src: "/cards/c30/ir-moltres.png" };
const sir = { id: "sv3pt5-200", name: "Blastoise ex", species: "Blastoise", rarity: "Special Illustration Rare", tags: "", kind: "" };
const future = { id: "me55-157", name: "Mewtwo ex", species: "Mewtwo", set: "30th Celebration", setId: "me55", rarity: "Futuristic Rare", tags: "", src: "" };
const bwr = { id: "zsv10pt5-172", name: "Zekrom ex", species: "Zekrom", set: "Black Bolt", rarity: "Black White Rare", tags: "" };
const base = { id: "base1-4", name: "Charizard", species: "Charizard", set: "Base", rarity: "Rare Holo", tags: "", lang: "" };
const jpRow = { id: "SV2a-025", name: "Pikachu", species: "Pikachu", set: "JP 151", lang: "jp", tags: "jp JP 151", rarity: "Common" };
const paperPika = { id: "sv3pt5-173", name: "Pikachu ex", species: "Pikachu", rarity: "Special Illustration Rare", kind: "", rank: 90 };
const pocketPika = { id: "tcgp-A1-285", name: "Pikachu ex", species: "Pikachu", rarity: "im", kind: "pocket", rank: 80 };
const paperZard = { id: "sv3-199", name: "Charizard ex", species: "Charizard", rarity: "Special Illustration Rare", kind: "", rank: 95 };
const pocketZard = { id: "tcgp-A2-xxx", name: "Charizard ex", species: "Charizard", rarity: "IM", kind: "pocket", rank: 70 };
const onlyPaper = { id: "xy-1", name: "Venusaur", species: "Venusaur", rarity: "Rare Holo", kind: "", rank: 20 };

t("Gold Star lane is goldstar, not the pair-story key star", goldStarLaneValue() === "goldstar" && GOLD_STAR_LANE !== "star");
t("Rare Holo Star is a Gold Star", isGoldStarCard(gold) && matchesShowPrompt(gold, "goldstar"));
t("VSTAR is not a Gold Star", !isGoldStarCard(vstar) && !matchesShowPrompt(vstar, "goldstar"));
t("Prism Star is not a Gold Star", !isGoldStarCard({ ...prism, name: "Dusk Mane Necrozma ◇" }));
t("the old star prompt is not the Gold Star lane", !matchesShowPrompt(gold, "star"));

t("30th matches me55 rows with empty tags", is30thCard(me55common) && is30thCard(me55moltres) && matchesShowPrompt(me55common, "30th"));
t("30th does not keep a Base set card", !is30thCard(base) && !matchesShowPrompt(base, "30th"));
t("30th drops the wrong stub bird files", !is30thCard(stub) && !matchesShowPrompt(stub, "30th"));

t("Connecting art keeps the mashu 30th birds", isConnectingCard(me55moltres) && isConnectingCard(me55articuno) && isConnectingCard(me55zapdos));
t("Connecting art drops the wrong stub files", !isConnectingCard(stub) && CONNECTING_STUB_IDS.includes(stub.id));
t("Connecting art ids are the catalog birds", CONNECTING_30TH_BIRDS.join() === "me55-130,me55-132,me55-133");

t("SIR matches Special Illustration Rare only", matchesShowPrompt(sir, "sir") && !matchesShowPrompt(base, "sir") && !matchesShowPrompt(future, "sir"));
t("Futuristic matches Futuristic Rare", matchesShowPrompt(future, "future") && !matchesShowPrompt(sir, "future"));
t("BWR matches Black White Rare", matchesShowPrompt(bwr, "bwr") && !matchesShowPrompt(sir, "bwr"));

t("Show All after BWR is all", nextShowPrompt("bwr", "all") === "all");
t("Show All after 30th is all", nextShowPrompt("30th", "all") === "all");
t("clicking All when already all stays all", nextShowPrompt("all", "all") === "all");
t("clicking BWR again toggles back to all", nextShowPrompt("bwr", "bwr") === "all");
t("clicking Gold Star from all goes to goldstar", nextShowPrompt("all", "goldstar") === "goldstar");
t("an empty-src 30th or Futuristic card stays on the desk", deskAllows(me55common) && deskAllows(future) && deskAllows(me55moltres));
t("stub- ids and known mismatches stay off the desk", !deskAllows({ id: "stub-1", src: "/x.png" }) && !deskAllows({ id: "xy6-11", src: "/x.png" }) && !deskAllows({ id: "sm1-79" }) && !deskAllows({ id: "ok", tags: "mismatch", src: "/x.png" }) && !deskAllows(null));
t("English and Japanese dex lists match, and Pikachu is 25", DEX_EN.length === DEX_JA.length && DEX_EN.length >= 1025 && DEX_EN[24] === "Pikachu" && DEX_JA[24] === "ピカチュウ");

t("Japanese print is lang jp", isJapanesePrint(jpRow) && !isJapanesePrint(base));
t("Japanese print also accepts a jp tag", isJapanesePrint({ id: "x", tags: " jp special", lang: "" }));
t("ピカチュウ maps to Pikachu", speciesFromJaName("ピカチュウ") === "Pikachu" && speciesFromJaName("ピカチュウex") === "Pikachu");
t("リザードン maps to Charizard", speciesFromJaName("リザードン") === "Charizard");

t("Paper vs Pocket with no mon still returns pairs", compareDesk([paperPika, pocketPika, paperZard, pocketZard, onlyPaper, base], "").map((c) => c.id).join() === [paperPika, pocketPika, paperZard, pocketZard].map((c) => c.id).join());
t("Paper vs Pocket with a mon stays on that mon", compareDesk([paperPika, pocketPika, paperZard, pocketZard], "Pikachu").every((c) => c.species === "Pikachu") && compareDesk([paperPika, pocketPika, paperZard, pocketZard], "Pikachu").length === 2);
t("a species only on paper is not a pair", compareDesk([onlyPaper, paperPika], "").length === 0);

const cuts = cutoutRows(6);
t("Cutouts has official art, HOME, and Pokédex stills", cuts.length === 18 && cuts.some((c) => c.set === "Official artwork" && c.kind === "cutout") && cuts.some((c) => c.set === "Pokémon HOME") && cuts.some((c) => c.set === "Pokédex still"));
t("Cutout Charizard official art uses the PokeAPI artwork file", cuts.filter((c) => c.species === "Charizard" && c.set === "Official artwork")[0].src.includes("/official-artwork/6.png"));
const books = mangaRows();
t("Manga rows are books, not movie posters", books.length >= 4 && books.every((c) => c.kind === "manga") && books.some((c) => c.set === "Pokémon Adventures") && books.some((c) => c.set === "Electric Tale") && !books.some((c) => /Mewtwo Strikes Back/.test(c.name)));
t("Manga cover URLs are Wikimedia files", books.every((c) => /^https:\/\/upload\.wikimedia\.org\//.test(c.src)));

const jpSet = {
  id: "SV2a",
  name: "ポケモンカード151",
  releaseDate: "2023-06-16",
  cardCount: { official: 165 },
  serie: { id: "SV" },
  cards: [
    { id: "SV2a-025", localId: "025", name: "ピカチュウ", rarity: "Common", image: "https://assets.tcgdex.net/ja/SV/SV2a/025" },
  ],
};
const jpBuilt = rowsFromTcgdexSet(jpSet, "JP 151");
t("TCGdex JP 151 Pikachu is lang jp with an English species", jpBuilt.length === 1 && jpBuilt[0].lang === "jp" && jpBuilt[0].species === "Pikachu" && jpBuilt[0].set === "JP 151" && jpBuilt[0].src.endsWith("/high.webp"));
t("JP set pins include JP 151 as SV2a and Storm Emeralda as M6", JP_SET_PINS.some((p) => p.pin === "JP 151" && p.id === "SV2a") && JP_SET_PINS.some((p) => p.pin === "Storm Emeralda" && p.id === "M6"));

// Unpatched editor (the raw play.html the site still patches) fails these.
const raw = await (await fetch(EDITOR_URL)).text();
t("fetched the desk editor", raw.includes("Pin two cards. We make a picture.") && raw.length > 1000);
t("unpatched Gold Star chip uses the colliding star key", raw.includes('star: "Gold Star"') && raw.includes('v: "star"') && raw.includes('if (isGoldStar(c)) return "star";'));
t("unpatched 30th filter is tags-only", raw.includes('if (prompt === "30th") return (c.tags || "").indexOf("30th") !== -1;'));
t("unpatched Connecting art pins the stub bird files", raw.includes('pins = ["c30-ir-moltres", "c30-ir-articuno", "c30-ir-zapdos"]'));
t("unpatched Paper vs Pocket with no mon returns no cards", raw.includes("if (medium === \"compare\") {\n        if (!mon) return [];"));
t("unpatched Japanese print blocks when CATALOG.jp is false", raw.includes('if (next === "jp" && !CATALOG.jp) {\n        catalogNote();\n        return false;'));
t("unpatched boot never marks cutouts, manga, or jp ready", !raw.includes("CATALOG.cutouts = true") && !raw.includes("CATALOG.manga = true") && !raw.includes("CATALOG.jp = true"));
t("unpatched onDesk drops a card with no picture", raw.includes('if (!c.src && c.fact !== "The picture is missing.") return false;'));
t("unpatched 30th and Connecting buttons are tags-only", raw.includes('pool.some(function (c) { return (c.tags || "").indexOf("30th") !== -1; })') && raw.includes('pool.some(function (c) { return (c.tags || "").indexOf("connecting") !== -1; })'));
t("unpatched Paper vs Pocket empty copy asks for a name first", raw.includes("Pick a Pokémon first. Paper vs Pocket needs a name."));

const patched = rewriteOfficeFilters(raw);
const hits = filterPatchHits();
const missed = hits.filter((h) => !h.ok).map((h) => h.label);
t("every filter patch hit the unpatched editor: " + (missed.join(", ") || "all"), missed.length === 0);
t("patched Gold Star lane is goldstar", patched.includes('goldstar: "Gold Star"') && patched.includes('return "goldstar"') && !patched.includes('if (isGoldStar(c)) return "star";'));
t("patched 30th uses is30thCard", patched.includes("if (prompt === \"30th\") return is30thCard(c);") && !patched.includes('if (prompt === "30th") return (c.tags || "").indexOf("30th") !== -1;'));
t("patched Connecting art uses the catalog birds, not the stub files as pins", patched.includes("CE_CONNECT_BIRDS") && !patched.includes('pins = ["c30-ir-moltres", "c30-ir-articuno", "c30-ir-zapdos"]'));
t("patched Paper vs Pocket builds pairs with no mon picked", patched.includes("if (!mon) {") && patched.includes("paperBy") && !patched.includes("if (medium === \"compare\") {\n        if (!mon) return [];"));
t("patched Show All always means all", patched.includes('if (v === "all") prompt = "all";'));
t("patched Japanese print loads the catalog instead of staying English", patched.includes("Loading Japanese prints") && patched.includes("loadJpCatalog") && patched.includes("api.tcgdex.net/v2/ja/sets"));
t("patched boot loads cutouts and manga", patched.includes("loadVisualCatalogs") && patched.includes("CATALOG.cutouts = true") && patched.includes("CATALOG.manga = true") && patched.includes("Pokédex still"));
t("patched onDesk keeps a 30th card with no picture", !patched.includes('if (!c.src && c.fact !== "The picture is missing.") return false;') && patched.includes("function onDesk(c)"));
t("patched 30th and Connecting buttons use the card helpers", patched.includes("pool.some(is30thCard)") && patched.includes("pool.some(isConnectingCard)"));
t("patched Cutouts and Manga load when the catalog is still closed", patched.includes('if (next === "cutouts" || next === "manga") loadVisualCatalogs();'));
t("patched Paper vs Pocket empty copy no longer blocks the desk", patched.includes("No Paper vs Pocket pairs on this desk yet") && !patched.includes("Pick a Pokémon first. Paper vs Pocket needs a name."));
t("patched Star vs now pairing still finds Gold Stars", patched.includes('return l === "goldstar" || l === "shining";'));

const through = patchEditorHtml(raw, "2026-11-11");
t("patchEditorHtml still applies the filter rewrite", through.includes("is30thCard") && through.includes("goldstar: \"Gold Star\"") && through.includes("loadVisualCatalogs"));
t("filter rewrite does not touch Stripe or play.html on disk", !through.includes("sk_live") && !through.includes("Stripe") && through.includes("Pin two cards. We make a picture."));

if (fail) {
  console.error(fail + " failed");
  process.exit(1);
}
console.log("post-office-filters ok");
