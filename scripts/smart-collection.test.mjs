import { readFileSync } from "node:fs";
import { flagLine } from "../src/advice-rules.mjs";
import {
  buildSmartPayload,
  cashoutEstimate,
  cashoutKeepRate,
  CASHOUT_METHOD,
  closestSet,
  collectionScore,
  defaultGoal,
  morningBrief,
  movedSince,
  normalizeGoal,
  setGaps,
  briefSectionOrder,
  focusSetPanel,
  normalizeFocusSlug,
} from "../src/smart-collection.mjs";

let fail = 0;
const t = (name, ok) => { console.log((ok ? "ok   " : "FAIL ") + name); if (!ok) fail++; };

const holdings = [
  { id: "tcgcsv-1", name: "Alpha", kind: "single", qty: 1, price: 10, asOf: "2026-10-28", change7: 12, setSlug: "demo-set", href: "/c/tcgcsv-1" },
  { id: "tcgcsv-2", name: "Beta", kind: "single", qty: 2, price: 5, asOf: "2026-10-28", change7: -3, setSlug: "demo-set", href: "/c/tcgcsv-2" },
  { id: "tcgcsv-9", name: "Box", kind: "sealed", qty: 1, price: 100, asOf: "2026-10-28", listings: 40, listingsAsOf: "2026-10-27", change7: 2, setSlug: "demo-set", href: "/p/tcgcsv-9" },
];

const setDoc = {
  slug: "demo-set",
  name: "Demo Set",
  asOf: "2026-10-28",
  source: "TCGplayer market",
  items: [
    { id: "tcgcsv-1", name: "Alpha", kind: "single", rarity: "Rare", price: 10, printings: [{ name: "Normal", price: 10, asOf: "2026-10-28", id: "tcgcsv-1" }, { name: "Reverse Holofoil", price: 4, asOf: "2026-10-28", id: "tcgcsv-11" }] },
    { id: "tcgcsv-2", name: "Beta", kind: "single", rarity: "Common", price: 5, printings: [{ name: "Normal", price: 5, asOf: "2026-10-28", id: "tcgcsv-2" }] },
    { id: "tcgcsv-3", name: "Gamma", kind: "single", rarity: "Ultra Rare", price: 80, printings: [{ name: "Normal", price: 80, asOf: "2026-10-28", id: "tcgcsv-3" }] },
    { id: "tcgcsv-9", name: "Box", kind: "sealed", price: 100 },
    { id: "tcgcsv-10", name: "ETB", kind: "sealed", price: 60 },
  ],
};

t("goal normalize", normalizeGoal("Growth") === "growth" && normalizeGoal("x") === "");
t("smart default leans collecting with set cluster", defaultGoal(holdings) === "collecting" || defaultGoal([{ ...holdings[0], setSlug: "a" }, { ...holdings[1], setSlug: "a" }, { id: "tcgcsv-3", name: "G", kind: "single", qty: 1, price: 1, setSlug: "a" }, { id: "tcgcsv-4", name: "H", kind: "single", qty: 1, price: 1, setSlug: "a" }, { id: "tcgcsv-5", name: "I", kind: "single", qty: 1, price: 1, setSlug: "a" }]) === "collecting");

const gaps = setGaps(holdings, setDoc, { mode: "singles" });
t("master gaps count printings", gaps.total === 4 && gaps.have === 2 && gaps.missing === 2);
t("cheapest missing is reverse", gaps.cheapest[0]?.id === "tcgcsv-11" && gaps.cheapest[0]?.price === 4);
t("rarest missing is gamma", gaps.rarest[0]?.id === "tcgcsv-3" && gaps.rarest[0]?.price === 80);
t("cost to finish sums priced gaps", gaps.cost === 84);

const sealedGaps = setGaps(holdings, setDoc, { mode: "sealed" });
t("sealed master gaps", sealedGaps.total === 2 && sealedGaps.have === 1 && sealedGaps.missing === 1 && sealedGaps.cost === 60);

const close = closestSet(holdings, [setDoc]);
t("closest set is demo", close && close.slug === "demo-set" && close.pct === 0.5);

const emptyScore = collectionScore([], "collecting");
t("empty collection has no score", emptyScore.score == null);

const sellScore = collectionScore(holdings, "selling", { gapList: [gaps] });
const collectScore = collectionScore(holdings, "collecting", { gapList: [gaps] });
t("goal reweights score", sellScore.goal === "selling" && collectScore.goal === "collecting" && sellScore.weights.liquidity > collectScore.weights.liquidity);

const cash = cashoutEstimate(holdings);

t("cashout keep uses listings counted tiers", cashoutKeepRate({ kind: "sealed", listings: 2 }).keep === 0.75 && cashoutKeepRate({ kind: "sealed", listings: 12 }).keep === 0.85 && cashoutKeepRate({ kind: "sealed", listings: 40 }).keep === 0.93 && cashoutKeepRate({ kind: "sealed" }).keep === 0.8);
t("cashout method shows source and tiers", cash.method && cash.method.source === "TCGplayer market price" && /listings counted/i.test(cash.method.listingsSource) && Array.isArray(cash.tiers) && cash.tiers.length >= 1 && cash.rows[0].tierLabel);
t("cashout note names listings counted", /listings counted/i.test(cash.note) && /model, not a quote/i.test(cash.note) && !/\bsold\b/i.test(cash.note));
t("CASHOUT_METHOD has no em dash", !/[\u2013\u2014]/.test(JSON.stringify(CASHOUT_METHOD)));
t("cashout has gross and net", cash.gross === 120 && cash.net > 0 && cash.net < cash.gross && !/sold/i.test(cash.note));

const prev = holdings.map((r) => ({ ...r, price: r.id === "tcgcsv-1" ? 8 : r.price, asOf: "2026-10-27" }));
const moved = movedSince(prev, holdings);
t("moved since last look", moved.length === 1 && moved[0].id === "tcgcsv-1" && moved[0].from === 8 && moved[0].to === 10);

const briefCollect = morningBrief({
  holdings,
  goal: "collecting",
  setDocs: [setDoc],
  prevHoldings: prev,
  reads: [{ id: "tcgcsv-1", headline: "Alpha held above its week window", asOf: "2026-10-28", source: "Catch'em read" }],
  views: { "tcgcsv-1": 9 },
  briefPrefs: { pinned: ["cost"], hidden: ["reads"] },
});
t("collecting brief leads with goal sections", briefCollect.order[0] === "cost" && !briefCollect.order.includes("reads") && briefCollect.order.includes("gaps"));
t("collecting brief has cost and cheapest", briefCollect.sections.some((s) => s.id === "cost" && s.closest && s.closest.cost === 84));

const briefSell = morningBrief({ holdings, goal: "selling", setDocs: [setDoc], prevHoldings: prev });
t("selling brief puts cashout up front", briefSell.order.includes("cashout") && briefSell.order.includes("liquidity") && briefSell.order[0] === "moved");

const briefGrowth = morningBrief({
  holdings,
  goal: "growth",
  setDocs: [setDoc],
  prevHoldings: prev,
  reads: [{ id: "tcgcsv-1", headline: "Alpha held above its week window", asOf: "2026-10-28" }],
});
t("growth brief has risk and reads, no hit rate", briefGrowth.order.includes("risk") && briefGrowth.order.includes("reads") && !JSON.stringify(briefGrowth).includes("60%") && !JSON.stringify(briefGrowth).includes("hit rate"));

const payload = buildSmartPayload({ holdings, goal: "collecting", setDocs: [setDoc], prevHoldings: prev, reads: [{ id: "tcgcsv-1", headline: "Alpha held above its week window", asOf: "2026-10-28" }] });
t("smart payload ok", payload.ok === true && payload.score.score >= 0 && payload.panels.collecting.closest);

const orderPinned = briefSectionOrder("collecting", { pinned: ["rarest", "gaps"], hidden: ["moved"] });

t("focus slug normalize", normalizeFocusSlug("Demo-Set") === "demo-set" && normalizeFocusSlug("bad slug") === "");
const focused = focusSetPanel(holdings, [setDoc], "demo-set");
t("focus set panel has gaps", focused && focused.slug === "demo-set" && focused.singles.missing === 2 && focused.singles.cheapest[0]?.id === "tcgcsv-11" && focused.singles.rarest[0]?.id === "tcgcsv-3");
const focusPayload = buildSmartPayload({ holdings, goal: "collecting", setDocs: [setDoc], focusSet: "demo-set" });
t("smart payload carries focus set", focusPayload.focusSet && focusPayload.focusSet.singles.cost === 84 && focusPayload.panels.collecting.focus.slug === "demo-set");
const focusBrief = morningBrief({ holdings, goal: "collecting", setDocs: [setDoc], focusSet: "demo-set" });
t("focus brief uses that set for gaps", focusBrief.sections.some((s) => s.id === "gaps" && s.closest && s.closest.slug === "demo-set"));
t("pin and hide order", orderPinned[0] === "rarest" && orderPinned[1] === "gaps" && !orderPinned.includes("moved"));

// Copy rules on module + sample brief text
const src = readFileSync(new URL("../src/smart-collection.mjs", import.meta.url), "utf8");
t("no em or en dash in module", !/[\u2013\u2014]/.test(src));
t("says listings counted", /listings counted/i.test(src));
t("never says sold as a claim", !/\bsold\b/i.test(src.replace(/Cashout[\s\S]*?model, not a quote\./, "")));
const blob = JSON.stringify(payload) + JSON.stringify(briefCollect) + cash.note;
for (const line of [cash.note, briefCollect.sections[0]?.title || "Morning Brief", "Cost to finish", "Listings counted"]) {
  const flags = flagLine(line);
  t("advice clean: " + line.slice(0, 40), flags.length === 0);
}
t("blob has no em dash", !/[\u2013\u2014]/.test(blob));
t("sealed holding never forced NM in gaps", !sealedGaps.cheapest.some((r) => /\bNM\b/.test(r.name || "")));

if (fail) {
  console.error(fail + " failed");
  process.exit(1);
}
console.log("smart-collection tests passed");
