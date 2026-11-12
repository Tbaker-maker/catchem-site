// Post Office editor rows and AI text read the live catalog: prices and catalog ids
// come from search-lite every time, never from the baked paper file.
import worker from "../src/index.mjs";
import { patchedPaper, patchEditorHtml, resetEditorCache } from "../src/full-editor.mjs";
import { acceptable, resetCatalogCache } from "../src/ai.mjs";
import { resetQuota, signSession } from "../src/quota.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.log("  FAIL", name); }
};

// The baked Catchem-data file: 22 columns, prices from an old night.
const baked = (id, name, set, year, artist, rarity, price) => {
  const row = [id, name, set, year, artist, rarity, price];
  while (row.length < 22) row.push(0);
  return row;
};
const paper = [
  baked("swsh7-215", "Umbreon VMAX", "Evolving Skies", "2021", "Keiichiro Ito", "Rare Secret", 2410),
  baked("base1-4", "Charizard", "Base", "1999", "Ken Sugimori", "Rare Holo", 855.52),
  baked("zz-1", "Nobody", "Nowhere", "1999", "", "", 99),
];
for (let i = 0; i < 30; i++) paper.push(baked("fill-" + i, "Filler " + i, "Nowhere", "1999", "", "", 5));
const lite = [
  ["tcgcsv-246723", "Umbreon VMAX (Alternate Art Secret)", "SWSH07: Evolving Skies", "215/203", "Keiichiro Ito", "single", 2214.79, "", "Secret Rare"],
  ["tcgcsv-42382", "Charizard", "Base Set", "004/102", "Ken Sugimori", "single", 944.53, "", ""],
];
const counts = { asOf: "2026-11-10", single: 2, sealed: 0 };
let paperFetches = 0;
const fetchImpl = async (url) => {
  const u = String(url);
  const ok = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
  if (u.includes("paper-rows.json")) { paperFetches += 1; return ok(paper); }
  if (u.includes("search-lite.json")) return ok(lite);
  if (u.includes("counts.json")) return ok(counts);
  return { ok: false, status: 404, json: async () => null, text: async () => "" };
};

resetEditorCache();
const rows = JSON.parse(await patchedPaper(fetchImpl, 1000));
const byId = new Map(rows.map((r) => [r[0], r]));
t("a mostly priced baked file is still re-priced from the live catalog", byId.get("swsh7-215")[6] === 2214.79 && byId.get("base1-4")[6] === 944.53);
t("matched rows carry the catalog id in column 22", byId.get("swsh7-215")[22] === "tcgcsv-246723" && byId.get("base1-4")[22] === "tcgcsv-42382");
t("a row with no live match ships with no price, not the stale one", byId.get("zz-1")[6] === 0 && !byId.get("zz-1")[22]);
t("no baked price survives", rows.every((r) => r[6] === 0 || r[6] === 2214.79 || r[6] === 944.53));
await patchedPaper(fetchImpl, 2000);
t("patched rows are reused inside the window", paperFetches === 1);
await patchedPaper(fetchImpl, 1000 + 31 * 60 * 1000);
t("patched rows refresh after 30 minutes", paperFetches === 2);

const editor = patchEditorHtml('<html><head></head><body><div id="compose-dock"><p class="note" id="tray-fact"></p></div></body></html>', "2026-11-10");
t("the editor shows the price date under the tray", editor.includes('id="price-date"') && editor.includes("Prices: TCGplayer market (Nov 10)."));

resetQuota();
resetCatalogCache();
resetEditorCache();
const secret = "test-secret";
const env = { SESSION_SECRET: secret, PUBLIC_FETCH: fetchImpl, POST_OFFICE_ALLOWLIST: "user-1" };
const cookie = "ce_session=" + await signSession({ sub: "user-1", premium: false }, secret);
const call = (path, body) => worker.fetch(new Request("https://catchemtcg.com" + path, {
  method: "POST",
  headers: { cookie, "content-type": "application/json" },
  body: JSON.stringify(body),
}), env);

const ideas = await call("/api/ideas", { ids: ["swsh7-215"] });
const ideasBody = await ideas.json();
t("Ideas resolve an editor id to its catalog row", ideas.status === 200 && ideasBody.ok === true && ideasBody.ideas.join(" ").includes("Umbreon VMAX"));
t("Ideas print the live price with its date", ideasBody.ideas.join(" ").includes("TCGplayer market: $2,214.79 (2026-11-10)") && !ideasBody.ideas.join(" ").includes("2,410"));

const post = await call("/api/post-text", { ids: ["swsh7-215", "base1-4"], tone: "informative", platform: "x" });
const postBody = await post.json();
t("Write the post works for editor ids", post.status === 200 && postBody.variations.length === 3);
t("post text uses the live price and date", postBody.variations.every((v) => v.includes("TCGplayer market: $2,214.79 (2026-11-10)")) && !postBody.variations.join(" ").includes("2,410"));

const nobody = await call("/api/ideas", { ids: ["zz-1"] });
const nobodyBody = await nobody.json();
t("a card with no live row says so", nobody.status === 400 && /No catalog row for zz-1/.test(nobodyBody.error || ""));

const facts = [{ price: "TCGplayer market: $1,501.23 (2026-10-30)" }];
t("model text with the supplied cents price passes", acceptable("Pokémon note. TCGplayer market: $1,501.23 (2026-10-30)", facts));
t("model text with a different price is refused", !acceptable("Pokémon note. TCGplayer market: $1,400.00 (2026-10-30)", facts));
t("model text with a stray dollar figure is refused", !acceptable("Pokémon note, once $99.99.", facts));
t("model text with the price but no date is refused", !acceptable("Pokémon note. TCGplayer market: $1,501.23", facts));
t("model text with no price passes", acceptable("Pokémon note with no number.", facts));

// The model path: a mocked model answer that quotes the live price is kept.
const realFetch = globalThis.fetch;
let modelFacts = "";
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith("https://api.x.ai/")) {
    modelFacts = JSON.parse(init.body).messages[0].content;
    const line = (n) => "Variation " + n + ": Umbreon VMAX Pokémon art by Keiichiro Ito. TCGplayer market: $2,214.79 (2026-11-10)";
    return new Response(JSON.stringify({ choices: [{ message: { content: [1, 2, 3].map(line).join("\n") } }] }), { headers: { "content-type": "application/json" } });
  }
  return realFetch(url, init);
};
resetQuota();
const modelPost = await worker.fetch(new Request("https://catchemtcg.com/api/post-text", {
  method: "POST",
  headers: { cookie, "content-type": "application/json" },
  body: JSON.stringify({ ids: ["swsh7-215"], tone: "hype", platform: "x" }),
}), { ...env, AI_API_KEY: "test-only" });
const modelBody = await modelPost.json();
globalThis.fetch = realFetch;
t("the model gets the live price as a fact", modelFacts.includes("TCGplayer market: $2,214.79 (2026-11-10)") && !modelFacts.includes("2410"));
t("a model answer with the live cents price is used, not dropped", modelPost.status === 200 && modelBody.model !== "fact-pack" && modelBody.variations.every((v) => v.includes("$2,214.79")));

if (fail) { console.log(fail + " failed"); process.exit(1); }
console.log("post-office live catalog ok");
