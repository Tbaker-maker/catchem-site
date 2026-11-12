// Post Office sealed mode: sealed rows from the live catalog with the price date, the
// cutout first, Ideas and Write the post for sealed ids, the overlay's listings count,
// and the house rules: sealed never carries a condition, listings are never sales,
// no advice phrases, no plan pricing, nothing gated.
import worker from "../src/index.mjs";
import { patchEditorHtml, PLAN_COPY, resetEditorCache } from "../src/full-editor.mjs";
import { acceptable, factIdeas, factPost, resetCatalogCache, rowFact, SEALED_CONDITION } from "../src/ai.mjs";
import { latestListings } from "../src/office-overlay.mjs";
import { acceptMsrp, acceptRip, extrasById, resetSealedCache, SEALED_JS, SEALED_PATH, sealedRows, sealedType } from "../src/office-sealed.mjs";
import { prefillBootJs } from "../src/office-path.mjs";
import { resetJsonCache } from "../src/data.mjs";
import { resetQuota, signSession } from "../src/quota.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.log("  FAIL", name); }
};

const lite = [
  ["tcgcsv-277335", "Lost Origin Elite Trainer Box", "SWSH11: Lost Origin", "", "", "sealed", 192.59, "swsh11-lost-origin", ""],
  ["tcgcsv-242436", "Evolving Skies Booster Box", "SWSH07: Evolving Skies", "", "", "sealed", 2190.2, "swsh07", ""],
  ["tcgcsv-502000", "Scarlet & Violet 151 Booster Bundle", "SV: Scarlet & Violet 151", "", "", "sealed", 61.4, "sv151", ""],
  ["tcgcsv-503000", "Crown Zenith Mini Tin [Galarian Zapdos]", "Crown Zenith", "", "", "sealed", 0, "crz", ""],
  ["tcgcsv-659591", "Arceus 3 Pack Blister [Darkrai]", "Arceus", "", "", "sealed", 18.5, "arceus", ""],
  ["tcgcsv-42382", "Charizard", "Base Set", "004/102", "Ken Sugimori", "single", 944.53, "", ""],
];
const cutDoc = { products: [
  { id: "swsh11-etb", siteId: "tcgcsv-277335", tcgPlayerId: 277335, pass: true, file: "cutouts/swsh11-etb.webp", height: 400 },
  { id: "swsh7-bb", siteId: "tcgcsv-242436", tcgPlayerId: 242436, pass: false, file: "cutouts/swsh7-bb.webp", height: 400 },
] };
const counts = { asOf: "2026-11-10", single: 1, sealed: 5 };
const msrpDoc = { generated: "2026-11-11", products: {
  "swsh11-etb": { name: "Lost Origin Elite Trainer Box", msrpUsd: 39.99, dateChecked: "2026-11-11", confidence: "high", tcgPlayerId: "277335" },
  "swsh7-bb": { name: "Evolving Skies Booster Box", msrpUsd: 143.64, dateChecked: "2026-11-11", confidence: "low", tcgPlayerId: "242436" },
  "no-date": { name: "Mystery Box", msrpUsd: 49.99, confidence: "high", tcgPlayerId: "999001" },
} };
const ripDoc = { asOf: "2026-10-19", rows: [
  { id: "swsh11-etb", name: "Lost Origin Elite Trainer Box", contentsEV: 21.2, priceAsOf: "2026-10-19" },
  { id: "tcgcsv-502000", name: "Scarlet & Violet 151 Booster Bundle", contentsEV: 40.5, priceAsOf: "2026-10-19" },
  { id: "swsh7-bb", name: "Evolving Skies Booster Box", contentsEV: 0, priceAsOf: "2026-10-19" },
] };

// Types the picker offers.
t("booster boxes, ETBs, bundles, tins, and blisters each get their type",
  sealedType("Evolving Skies Booster Box") === "Booster Box" && sealedType("Lost Origin Elite Trainer Box") === "ETB"
  && sealedType("Scarlet & Violet 151 Booster Bundle") === "Bundle" && sealedType("Crown Zenith Mini Tin [Galarian Zapdos]") === "Tin"
  && sealedType("Arceus 3 Pack Blister [Darkrai]") === "Blister");
t("a booster box case is a case, not a box", sealedType("Evolving Skies Booster Box Case") === "Case");

// Rows.
const doc = sealedRows(lite, cutDoc, counts.asOf);
const byId = new Map(doc.rows.map((r) => [r[0], r]));
t("only sealed rows ship", doc.rows.length === 5 && !byId.has("tcgcsv-42382"));
t("price is the live catalog price, with the catalog date and source", byId.get("tcgcsv-277335")[4] === 192.59 && doc.asOf === "2026-11-10" && doc.source === "TCGplayer market");
t("a product with no price keeps 0, never a guess", byId.get("tcgcsv-503000")[4] === 0);
t("priced rows come first, highest first", doc.rows[0][0] === "tcgcsv-242436" && doc.rows.at(-1)[0] === "tcgcsv-503000");
t("a passed cutout is the picture", byId.get("tcgcsv-277335")[5] === "/data/cutouts/swsh11-etb.webp");
t("a failed cutout is not used (the product photo is the fallback)", byId.get("tcgcsv-242436")[5] === "" && byId.get("tcgcsv-242436")[6] === 242436);
t("type counts ship for the chips", doc.types.ETB === 1 && doc.types.Tin === 1 && doc.types.Blister === 1);
t("no condition rides on a sealed row", doc.rows.every((r) => !r.some((v) => typeof v === "string" && SEALED_CONDITION.test(v))));
t("a missing MSRP or rip file leaves those fields off, never a guess", Object.values(doc.extras || {}).every((x) => !x.msrp && !x.rip));

const full = sealedRows(lite, cutDoc, counts.asOf, msrpDoc, ripDoc);
const fullRow = new Map(full.rows.map((r) => [r[0], r]));
t("sourced high-confidence MSRP joins by TCGplayer id", full.extras["tcgcsv-277335"].msrp === 39.99 && full.extras["tcgcsv-277335"].msrpDate === "2026-11-11");
t("low-confidence or undated MSRP is omitted", !full.extras["tcgcsv-242436"]?.msrp && acceptMsrp(msrpDoc.products["swsh7-bb"]) === null && acceptMsrp(msrpDoc.products["no-date"]) === null);
t("rip value joins a slug row through the cutout, and a tcgcsv id directly", full.extras["tcgcsv-277335"].rip === 21.2 && full.extras["tcgcsv-277335"].ripDate === "2026-10-19" && full.extras["tcgcsv-502000"].rip === 40.5);
t("a rip row with no pull value is omitted", !full.extras["tcgcsv-242436"]?.rip && acceptRip(ripDoc.rows[2], ripDoc.asOf) === null);
t("a product slug resolves to the catalog id", full.slugs["swsh11-etb"] === "tcgcsv-277335");
t("rows stay free of condition labels after extras land", full.rows.every((r) => !r.some((v) => typeof v === "string" && SEALED_CONDITION.test(v))));

// The route: open to everyone (nothing gated), served from the live catalog.
const fetchImpl = async (url) => {
  const u = String(url);
  const ok = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
  if (u.includes("search-lite.json")) return ok(lite);
  if (u.includes("sealed-cutouts.json")) return ok(cutDoc);
  if (u.includes("counts.json")) return ok(counts);
  if (u.includes("msrp-sourced.json")) return ok(msrpDoc);
  if (u.includes("rip-roi.json")) return ok(ripDoc);
  return { ok: false, status: 404, json: async () => null, text: async () => "" };
};
resetSealedCache();
resetJsonCache();
const env = { SESSION_SECRET: "test-secret", PUBLIC_FETCH: fetchImpl, POST_OFFICE_ALLOWLIST: "user-1" };
const res = await worker.fetch(new Request("https://catchemtcg.com" + SEALED_PATH), env);
const body = await res.json();
t("the sealed rows route answers without a session", res.status === 200 && body.rows.length === 5 && body.asOf === "2026-11-10");
t("the route ships sourced MSRP and published rip value", body.extras["tcgcsv-277335"].msrp === 39.99 && body.extras["tcgcsv-277335"].rip === 21.2);

// Facts, Ideas, and Write the post.
const fact = rowFact(lite[0], "2026-11-10");
t("a sealed fact has no printing, artist, or condition", fact.kind === "sealed" && fact.printing === "" && fact.artist === "" && !("condition" in fact) && fact.productType === "ETB");
t("a sealed fact prints the price with its date", fact.price === "TCGplayer market: $192.59 (2026-11-10)");
const factFull = rowFact(lite[0], "2026-11-10", full.extras["tcgcsv-277335"]);
t("a sealed fact carries sourced MSRP and published rip value", factFull.msrp === "MSRP $39.99" && factFull.rip === "Average pull value $21.20 (2026-10-19)");
const tones = ["informative", "hype", "chill", "funny"];
const lines = tones.flatMap((tone) => factPost([fact], tone));
t("sealed post text never shows a condition (no NM)", lines.length === 12 && lines.every((l) => !SEALED_CONDITION.test(l)));
t("sealed post text passes the house rules (no sold, no advice) and keeps the dated price", lines.every((l) => acceptable(l, [fact]) && l.includes("TCGplayer market: $192.59 (2026-11-10)")));
t("sealed post text talks about a product, not a card or a binder", lines.every((l) => !/\bcard\b|binder|artwork/i.test(l)));
t("the set is not repeated when the name already carries it", factPost([fact])[0].startsWith("Lost Origin Elite Trainer Box. "));
const fullLines = factPost([factFull], "informative");
t("post text adds MSRP and rip value after the dated market price", fullLines.every((l) => l.includes("TCGplayer market: $192.59 (2026-11-10)") && l.includes("MSRP $39.99") && l.includes("Average pull value $21.20 (2026-10-19)") && acceptable(l, [factFull])));
t("an invented rip or MSRP dollar figure is refused", !acceptable(fullLines[0].replace("MSRP $39.99", "MSRP $12.00"), [factFull]));
const ideas = factIdeas([fact], [{ id: fact.id, card: fact }]);
t("sealed Ideas say sealed product and carry the dated price", ideas.length === 3 && ideas[0].startsWith("Sealed Pokémon TCG product:") && ideas.every((l) => l.includes("$192.59 (2026-11-10)") && !SEALED_CONDITION.test(l)));
t("model text that puts NM on a sealed product is refused", !acceptable("Lost Origin ETB, NM. TCGplayer market: $192.59 (2026-11-10)", [fact]) && !acceptable("Near Mint Lost Origin ETB.", [fact]));
t("model text that calls listings sold is refused", !acceptable("22 sold this week.", [fact]));

resetQuota();
resetCatalogCache();
const cookie = "ce_session=" + await signSession({ sub: "user-1", premium: false }, "test-secret");
const call = (path, b) => worker.fetch(new Request("https://catchemtcg.com" + path, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify(b) }), env);
const ideaRes = await call("/api/ideas", { ids: ["tcgcsv-277335", "tcgcsv-242436"] });
const ideaBody = await ideaRes.json();
t("Ideas work for sealed ids", ideaRes.status === 200 && ideaBody.ideas.join(" ").includes("Lost Origin Elite Trainer Box") && ideaBody.ideas.join(" ").includes("TCGplayer market: $2,190.20 (2026-11-10)"));
const postRes = await call("/api/post-text", { ids: ["tcgcsv-277335"], tone: "hype", platform: "x" });
const postBody = await postRes.json();
t("Write the post works for sealed ids, with no condition", postRes.status === 200 && postBody.variations.length === 3 && postBody.variations.every((v) => v.includes("TCGplayer market: $192.59 (2026-11-10)") && !SEALED_CONDITION.test(v)));
t("Write the post includes sourced MSRP and the published rip value", postBody.variations.every((v) => v.includes("MSRP $39.99") && v.includes("Average pull value $21.20 (2026-10-19)")));

// Overlay: listings counted on or before the price date.
const series = [{ date: "2026-10-28", listingCount: 30 }, { date: "2026-10-30", listingCount: 22 }, { date: "2026-11-12", listingCount: 99 }];
t("the overlay's listings count is the last night on or before the price date", JSON.stringify(latestListings(series, "2026-11-10")) === JSON.stringify({ n: 22, day: "2026-10-30" }));
t("no listings nights means no listings line", latestListings([], "2026-11-10") === null);

// The editor ships sealed mode once, wired into the card flow.
resetEditorCache();
const html = patchEditorHtml('<html><head></head><body><section id="visuals"><div class="banner" id="banner">Pin two cards. We make a picture.</div><div class="media" id="media"><button data-med="paper">Paper TCG</button></div><div id="compose-dock"><p class="note" id="tray-fact"></p><img id="preview"></div></section></body></html>', "2026-11-10");
const js = SEALED_JS.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "");
t("the sealed script ships once and parses", html.split('id="sealed-boot"').length === 2 && (() => { try { new Function(js); return true; } catch { return false; } })());
t("sealed mode is a Sealed button that reads the sealed rows", js.includes('btn.textContent = "Sealed"') && js.includes(SEALED_PATH));
t("the picture goes through the same overlay hook and preview as cards", js.includes("window.__ceOverlay(canvas") && js.includes('$("preview")') && js.includes('$("btn-compose")'));
t("Ideas, Write the post, Download, and the overlay read the sealed picks", html.split("window.__ceSealed && window.__ceSealed.on()").length === 3);
t("the overlay labels listings as counted, never sold", html.includes('" eBay listings counted, "') && !/\bsold\b/i.test(js));
t("the sealed script has no condition label", !/\bNM\b|Near Mint|Lightly Played|condition/i.test(js.replace(/SEALED_CONDITION/g, "")));
t("the sealed script has no plan pricing or paywall copy", !PLAN_COPY.test(js));
t("the sealed script shows the price with its source and date", js.includes('"TCGplayer market " + money(r[4]) + " · " + nice(doc.asOf)'));
t("a product with no picture is refused, not a hole", js.includes("No picture on file for "));
t("nothing posts from the page", !/api\.x\.com|api\.twitter\.com|\/2\/tweets/.test(js));
t("the picker prints MSRP and average pull value when they shipped", js.includes('"MSRP " + money(x.msrp)') && js.includes('"Average pull value " + money(x.rip)'));
t("a Make a post link can prefill sealed picks", js.includes("function prefill(ids)") && prefillBootJs().includes("window.__ceSealed.prefill") && html.includes('id="path-boot"') && html.includes('id="sealed-boot"'));
if (fail) { console.log(fail + " failed"); process.exit(1); }
console.log("post-office sealed ok");
