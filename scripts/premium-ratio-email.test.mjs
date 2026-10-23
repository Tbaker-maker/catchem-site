// Premium ratio pills and the email filter. Fixture flags only. No live bands.
import { buildArticle, followFromPlan, premiumPill, renderArticle } from "../src/reads-article.mjs";
import { gatePlan, planFromFields, planToFollow, renderReadsPage } from "../src/reads.mjs";
import { flagForItem } from "../src/premium-ratio.mjs";
import { isClean } from "../src/advice-rules.mjs";
import { readsEmailHtml } from "../src/reads-email.mjs";

let fail = 0;
const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail++; console.log("  FAIL", name); } };
const D = (i) => new Date(Date.parse("2026-10-18T00:00:00Z") - i * 86400000).toISOString().slice(0, 10);
const series = (vals) => vals.map((v, i) => [D(vals.length - 1 - i), v]);
const up = (b) => series([b, b * 1.01, b * 1.02, b * 1.04, b * 1.06, b * 1.08, b * 1.1, b * 1.12, b * 1.14, b * 1.16]);
const S = (id, name, set, hist, href) => ({ id: "move-" + id, name, set, hist, href: href || "/c/" + id });

const premium = {
  byProduct: { "tcgcsv-77": "above" },
  bySet: {
    "evolving skies": { flag: "below", boxId: "tcgcsv-10" },
    "paldea evolved": { flag: "above", boxId: "tcgcsv-11" },
  },
  sealed: ["tcgcsv-77"],
};
const movers = {
  asOf: "2026-10-18",
  singles: [
    S("tcgcsv-1", "Umbreon VMAX", "SWSH07: Evolving Skies", up(80)),
    S("tcgcsv-2", "Iono", "SV02: Paldea Evolved", up(20)),
    S("tcgcsv-3", "Umbreon ex", "SV: Prismatic Evolutions", up(40)),
  ],
  sealed: [],
};
const ctx = { movers, sets: { sets: [] }, tags: { byId: {} }, listings: { products: [] }, reads: { reads: [] }, holdIds: {}, premium };
const names = (doc) => [doc.top, ...doc.ups, ...doc.downs].filter(Boolean).map((i) => i.name);

const all = buildArticle({ follow: followFromPlan({ premiumRatio: "all" }), ctx, asOf: "2026-10-18", length: "glance" });
const htmlAll = renderArticle(all, {});
t("all shows the green pill, the yellow pill, and the no-pill single", htmlAll.includes("Below its usual premium") && htmlAll.includes("Above its usual premium") && names(all).includes("Umbreon ex") && names(all).includes("Umbreon VMAX") && names(all).includes("Iono"));
t("the no-box single has no pill of its own", !htmlAll.includes("Umbreon ex") || (htmlAll.split("Umbreon ex")[1] || "").slice(0, 180).includes("Below") === false);
const below = buildArticle({ follow: followFromPlan({ premiumRatio: "below" }), ctx, asOf: "2026-10-18", length: "glance" });
const htmlBelow = renderArticle(below, {});
t("below only keeps the green set single", names(below).join("|") === "Umbreon VMAX" && htmlBelow.includes("Below its usual premium") && !htmlBelow.includes("Above its usual premium") && !names(below).includes("Umbreon ex"));
const above = buildArticle({ follow: followFromPlan({ premiumRatio: "above" }), ctx, asOf: "2026-10-18", length: "glance" });
t("above only keeps the yellow set single", names(above).join("|") === "Iono" && renderArticle(above, {}).includes("Above its usual premium") && !names(above).includes("Umbreon ex"));
t("a single does not inherit an ETB flag", flagForItem({ id: "tcgcsv-3", set: "SV: Prismatic Evolutions", kind: "single", href: "/c/tcgcsv-3" }, premium) === "");
t("a base set single inherits that set booster box", flagForItem({ id: "tcgcsv-9", set: "SV01: Scarlet & Violet Base Set", kind: "single", href: "/c/tcgcsv-9" }, { bySet: { "scarlet and violet": { flag: "below" } }, byProduct: {}, sealed: [] }) === "below");
t("151 does not inherit the base set box", flagForItem({ id: "tcgcsv-8", set: "SV: Scarlet & Violet 151", kind: "single", href: "/c/tcgcsv-8" }, { bySet: { "scarlet and violet": { flag: "below" } }, byProduct: {}, sealed: [] }) === "");
t("an ETB keeps its own flag and is not the single fallback", flagForItem({ id: "tcgcsv-77", set: "SV: Prismatic Evolutions", kind: "sealed", href: "/p/tcgcsv-77" }, premium) === "above");
t("umbreon stays below only because bySet has the box", flagForItem({ id: "tcgcsv-246723", set: "SWSH07: Evolving Skies", kind: "single", href: "/c/tcgcsv-246723" }, premium) === "below");
t("the same single is empty when bySet is empty even if an ETB and a tin are flagged", flagForItem({ id: "tcgcsv-246723", set: "SWSH07: Evolving Skies", kind: "single", href: "/c/tcgcsv-246723" }, { bySet: {}, byProduct: { "tcgcsv-77": "above", "tcgcsv-88": "below" }, sealed: ["tcgcsv-77", "tcgcsv-88"] }) === "");
t("a dash era single uses the booster box key, not a tin", flagForItem({ id: "tcgcsv-4", set: "SM - Team Up", kind: "single", href: "/c/tcgcsv-4" }, { bySet: { "team up": { flag: "below", boxId: "tcgcsv-12" } }, byProduct: { "tcgcsv-90": "above" }, sealed: ["tcgcsv-90"] }) === "below");
t("prismatic evolutions stays empty", flagForItem({ id: "tcgcsv-610528", set: "SV: Prismatic Evolutions", kind: "single", href: "/c/tcgcsv-610528" }, { bySet: {}, byProduct: { "tcgcsv-77": "above" }, sealed: ["tcgcsv-77"] }) === "");

const none = buildArticle({
  follow: followFromPlan({ premiumRatio: "below" }),
  ctx: { ...ctx, movers: { asOf: "2026-10-18", singles: [S("tcgcsv-3", "Umbreon ex", "SV: Prismatic Evolutions", up(40))], sealed: [] } },
  asOf: "2026-10-18",
});
const htmlNone = renderArticle(none, {});
t("zero reads is one plain line", none.emptyPremium === true && htmlNone.includes("No reads match this premium filter today.") && !htmlNone.includes("Also moving"));
t("light pills and dark hooks are both in the letter", htmlAll.includes("background:#e5f6ea") && htmlAll.includes("background:#fff4cc") && htmlAll.includes("ce-prem-below") && htmlAll.includes("[data-ogsc]") && htmlAll.includes("#8ee0a8") && htmlAll.includes("#f6dc86"));
t("copy has no dashes and no advice", !/[\u2013\u2014]/.test(htmlAll + htmlBelow + htmlNone) && isClean("Below its usual premium") && isClean("Above its usual premium") && isClean("No reads match this premium filter today."));
t("pill helper is empty when the flag is neutral", premiumPill("") === "" && premiumPill("below").includes("Below its usual premium"));

const saved = gatePlan(planFromFields({ premiumRatio: "below", product: "singles" }), { premium: true }).plan;
t("the pick is saved on the plan and the follow, not as a membership flag", saved.premiumRatio === "below" && planToFollow("12345", saved).premiumRatio === "below" && saved.premium !== true);
const page = renderReadsPage({ signedIn: true, plan: saved });
t("the picker offers all, below, and above", page.includes("Premium ratio") && page.includes("Below its usual premium only") && page.includes("Above its usual premium only") && page.includes('name="premiumRatio"'));
const fallback = readsEmailHtml({ lead: "Today", day: "2026-10-18", reads: [{ headline: "Umbreon VMAX", premium: "below" }, { headline: "Iono", premium: "above" }], empty: false });
t("the fallback letter shows both pills", fallback.includes("Below its usual premium") && fallback.includes("Above its usual premium"));
const emptyLetter = readsEmailHtml({ lead: "Today", day: "2026-10-18", reads: [], empty: true });
t("the fallback letter says so when the filter matches nothing", emptyLetter.includes("No reads match this premium filter today."));

if (fail) { console.log(fail + " failed"); process.exit(1); }
console.log("premium ratio email ok");
