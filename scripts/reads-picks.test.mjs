// Saved rarity, era, artist and generation picks really filter the email.
import { buildArticle, followFromPlan, pathwayOf, picksTest, artistChoices, renderArticle, okCopy } from "../src/reads-article.mjs";
import { gatePlan, planFromFields, followCount } from "../src/reads.mjs";

let fail = 0;
const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail++; console.log("  FAIL", name); } };
const D = (i) => new Date(Date.parse("2026-10-18T00:00:00Z") - i * 86400000).toISOString().slice(0, 10);
const series = (vals) => vals.map((v, i) => [D(vals.length - 1 - i), v]);
const up = (b) => series([b, b * 1.01, b * 1.02, b * 1.03, b * 1.05, b * 1.06, b * 1.08, b * 1.1, b * 1.12, b * 1.15]);
const dn = (b) => series([b, b * 0.99, b * 0.98, b * 0.97, b * 0.95, b * 0.94, b * 0.92, b * 0.9, b * 0.88, b * 0.85]);
const S = (id, name, set, hist) => ({ id: "move-tcgcsv-" + id, name, set, hist, href: "/c/tcgcsv-" + id });
const movers = { asOf: "2026-10-18", singles: [
  S(1, "Umbreon ex - 161/131", "SV: Prismatic Evolutions", up(900)),
  S(2, "Sylveon ex - 156/131", "SV: Prismatic Evolutions", dn(300)),
  S(3, "Pikachu - 004/131", "SV: Prismatic Evolutions", up(2)),
  S(4, "Charizard V - 154/172", "SWSH09: Brilliant Stars", up(50)),
  S(5, "Moltres IR - 210/198", "SV01: Scarlet & Violet Base Set", up(20)),
  S(6, "Dark Charizard", "Team Rocket", up(400)),
  S(7, "Mega Venusaur ex - 200/132", "ME01: Mega Evolution", up(60)),
], sealed: [{ id: "move-tcgcsv-77", name: "Prismatic Evolutions Elite Trainer Box", set: "SV: Prismatic Evolutions", hist: up(90), href: "/p/tcgcsv-77" }] };
const sets = { sets: [
  { slug: "sv-pe", name: "SV: Prismatic Evolutions", era: "Scarlet & Violet", release: "2025-01-17" },
  { slug: "swsh9", name: "SWSH09: Brilliant Stars", era: "Sword & Shield", release: "2022-02-25" },
  { slug: "sv1", name: "SV01: Scarlet & Violet Base Set", era: "Scarlet & Violet", release: "2023-03-31" },
  { slug: "team-rocket", name: "Team Rocket", era: "Original", release: "2000-04-24" },
  { slug: "me1", name: "ME01: Mega Evolution", era: "Mega Evolution", release: "2025-09-26" },
] };
const tags = { byId: {
  "tcgcsv-1": { rarity: "Special Illustration Rare", artist: "Akira Komayama", artistSlug: "akira-komayama", generation: "9" },
  "tcgcsv-2": { rarity: "Special Illustration Rare", artist: "Akira Komayama", artistSlug: "akira-komayama", generation: "9" },
  "tcgcsv-3": { artist: "Ken Sugimori", artistSlug: "ken-sugimori", generation: "9" },
  "tcgcsv-4": { rarity: "Ultra Rare", artist: "Akira Komayama", artistSlug: "akira-komayama", generation: "8" },
  "tcgcsv-5": { rarity: "Illustration Rare", generation: "9" },
  "tcgcsv-6": { artist: "Ken Sugimori", artistSlug: "ken-sugimori", generation: "1" },
  "tcgcsv-7": { rarity: "Special Illustration Rare", generation: "ME" },
} };
const ctx = { movers, sets, tags, listings: { products: [] }, reads: { reads: [] }, holdIds: {} };
const ids = (a) => [a.top, ...a.ups, ...a.downs].map((i) => i.id).sort();

// Chase card hunter: the plan the preset saves, through the real save and send steps.
const saved = gatePlan(planFromFields({ product: "singles", rarity: ["Special Illustration Rare", "Illustration Rare"], length: "glance" }), { premium: false }).plan;
t("a free member keeps both chase rarities (picks count as one follow)", saved.rarities.length === 2 && followCount(saved) === 1);
const follow = followFromPlan(saved, "2026-10-18");
t("followFromPlan carries rarities to the send step", follow.rarities.length === 2);
t("rarity picks make the picks pathway", pathwayOf(follow) === "picks");
const chase = buildArticle({ follow, ctx, asOf: "2026-10-18", length: "glance" });
t("chase read only holds IR and SIR singles", JSON.stringify(ids(chase)) === JSON.stringify(["tcgcsv-1", "tcgcsv-2", "tcgcsv-5", "tcgcsv-7"]));
t("chase read has no sealed and no vintage extra", !chase.vintage && ![chase.top, ...chase.ups, ...chase.downs].some((i) => i.kind === "sealed"));
t("chase label names the picks", chase.label === "Special Illustration Rares, Illustration Rares");

const era = buildArticle({ follow: followFromPlan({ rarities: ["Special Illustration Rare"], eras: ["Scarlet and Violet"] }), ctx, asOf: "2026-10-18" });
t("rarity and era together narrow to both", JSON.stringify(ids(era)) === JSON.stringify(["tcgcsv-1", "tcgcsv-2"]));
const poke = buildArticle({ follow: { pokemon: ["Charizard"], eras: ["Sword and Shield"] }, ctx, asOf: "2026-10-18" });
t("era picks narrow a Pokemon pathway too, or it falls back and says so", poke.path === "pokemon" ? ids(poke).every((i) => i === "tcgcsv-4") : /quiet day/.test(poke.fallback));
t("watchlist ignores picks", picksTest({}) === null && pathwayOf({ cards: ["tcgcsv-6"], rarities: ["Illustration Rare"] }) === "watchlist");

// Artist pathway: only tagged cards.
const art = buildArticle({ follow: followFromPlan({ artists: ["akira-komayama"] }), ctx, asOf: "2026-10-18" });
t("artist pathway holds only that artist's tagged cards", art.path === "artist" && JSON.stringify(ids(art)) === JSON.stringify(["tcgcsv-1", "tcgcsv-2", "tcgcsv-4"]));
t("artist label uses the credit name", art.label === "Art by Akira Komayama" && okCopy(art.intro));
const artSir = buildArticle({ follow: followFromPlan({ artists: ["akira-komayama"], rarities: ["Special Illustration Rare"] }), ctx, asOf: "2026-10-18" });
t("artist plus rarity narrows to both", JSON.stringify(ids(artSir)) === JSON.stringify(["tcgcsv-1", "tcgcsv-2"]));
const gen = buildArticle({ follow: followFromPlan({ generations: ["9"] }), ctx, asOf: "2026-10-18" });
t("generation pathway holds only that generation", gen.path === "generation" && ids(gen).every((i) => ["tcgcsv-1", "tcgcsv-2", "tcgcsv-3", "tcgcsv-5"].includes(i)) && gen.label === "Generation 9");
t("Mega Evolution is its own generation", followFromPlan({ generations: ["ME", "bad"] }).generations.join() === "ME");
t("artist choices count tagged cards", artistChoices(tags, 1)[0].slug === "akira-komayama" && artistChoices(tags, 1)[0].n === 3);
const html = renderArticle(chase, {}).replace("A listing is not a sale.", "");
t("chase email copy follows the rules", !/[\u2013\u2014]/.test(html) && !/\bsold\b|\bsales?\b/i.test(html) && !/\bNM\b/.test(html));
const saveArt = gatePlan(planFromFields({ artist: ["ken-sugimori", "nobody"], generation: ["ME", "12"] }), { premium: true }).plan;
t("saved artist and generation picks are cleaned to known choices", saveArt.artists.join() === "ken-sugimori" && saveArt.generations.join() === "ME");

if (fail) { console.log(fail + " failed"); process.exit(1); }
console.log("reads picks: all passed");
