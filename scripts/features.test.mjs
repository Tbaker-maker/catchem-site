// Set value, rotation badge, /releases, and eBay listings counted.
// Imported by rebuild.test.mjs so CI runs it without a workflow edit.
import { banGuard } from "../src/advice-rules.mjs";
// Whole pages carry code comments, so dashes are checked by their own assertion here.
const PAGE = { skipKinds: ["house"] };
import { renderPath, pageKind } from "../src/index.mjs";
import { resetJsonCache } from "../src/data.mjs";
import { PRINT_RUN_LINE } from "../src/rotation.mjs";
import { listingsCountedLine, rotationBadge, setValueBlock, upcomingReleases, noDash, COPY } from "../src/features.mjs";

let fail = 0;
const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail++; console.log("  FAIL", name); } };
const BANNED = banGuard("features", /\b(supply)\b/i, PAGE);
const visible = (h) => String(h).replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");

const top = (n) => Array.from({ length: n }, (_, i) => ({ id: `tcgcsv-${42300 + i}`, name: `Card ${i}`, number: `${i + 1}/102`, price: 100 - i, date: "2026-10-12" }));
const files = {
  "counts.json": { asOf: "2026-10-12", updatedAt: "2026-10-12T10:00:00Z" },
  "sets/base-set.json": { name: "Base Set", items: [] },
  "set-value/base-set.json": { slug: "base-set", name: "Base Set", asOf: "2026-10-12", source: "data/history/tcgcsv-daily/2026-10-12.json", top: [{ id: "tcgcsv-42382", name: "Charizard", number: "004/102", price: 928.06, date: "2026-10-12" }, ...top(9)], master: { total: 2180.37, priced: 101, unpriced: 1, inSet: 102 } },
  "set-value/base-set-shadowless.json": { slug: "base-set-shadowless", name: "Base Set (Shadowless)", asOf: "2026-10-12", source: "data/history/tcgcsv-daily/2026-10-12.json", top: top(10), master: { total: 9525.05, priced: 102, unpriced: 0, inSet: 102 } },
  "sets/sv02-paldea-evolved.json": { name: "SV02: Paldea Evolved", items: [] },
  "rotation-status.json": { asOf: "2026-08-24", sets: [{ slug: "sv02-paldea-evolved", mark: "G", status: "Rotated April 10, 2026" }, { slug: "base-set", mark: null, status: null }, { slug: "me01-mega-evolution", mark: "I", status: "Standard" }] },
  "catalogue-images.json": { images: {} },
  "releases.json": { checked: "2026-10-09", releases: [
    { name: "Old thing", date: "2026-10-01", type: "product", source: "pokemon.com/x" },
    { name: "30th Celebration \u2014 Binder Collection", date: "2026-12-04", type: "product", source: "pokemon.com/us/a", checked: "2026-10-09", market: { id: "tcgcsv-704169", name: "30th Celebration Binder Collection", price: 89.36, date: "2026-09-26" } },
    { name: "Delta Reign (ME06)", date: "2026-11-06", type: "main-set", source: "support.pokemoncenter.com/hc/x", checked: "2026-10-09", market: { id: "tcgcsv-712094", name: "Delta Reign Booster Box", price: 262.92, date: "2026-09-26" } },
  ] },
  "listings-counted.json": { asOf: "2026-10-12", products: [{ id: "me1-enhanced-booster-box", listingsCounted: { n: 37, date: "2026-10-12", prev: { n: 35, date: "2026-10-11" } } }, { id: "sm10-booster-box", listingsCounted: { n: 8, date: "2026-10-12" } }] },
  "buckets/00.json": [{ id: "tcgcsv-644300", name: "Mega Evolution Enhanced Booster Box", kind: "sealed", set: "ME01: Mega Evolution", setSlug: "me01-mega-evolution", price: 150, asOf: "2026-10-12", source: "TCGplayer market" }],
  "sitemap-00.xml": `<?xml version="1.0"?><urlset><url><loc>https://catchemtcg.com/</loc></url></urlset>`,
};
const dive = { ids: ["me1-enhanced-booster-box"], byTcgcsv: { "tcgcsv-644300": "me1-enhanced-booster-box" } };
const fetchImpl = async (url) => {
  const u = String(url);
  if (u.endsWith("/dive/index.json")) return new Response(JSON.stringify(dive));
  const rel = u.split("/research/assets/public/")[1];
  if (rel && rel in files) return new Response(typeof files[rel] === "string" ? files[rel] : JSON.stringify(files[rel]));
  return new Response("nope", { status: 404 });
};
const page = async (p, opts = {}) => { resetJsonCache(); const r = await renderPath(p, fetchImpl, opts); return { status: r.status, text: await r.text() }; };

const base = await page("/sets/base-set");
t("set value heading and total", base.text.includes(">Set value<") && base.text.includes("$2,180.37") && base.text.includes("101 priced, 1 unpriced"));
t("set value date and source", base.text.includes("TCGplayer market, Oct 12, 2026") && !base.text.includes("tcgcsv-daily/2026-10-12.json"));
t("top 10 rows", (base.text.match(/class="sv-row"/g) || []).length === 10 && base.text.includes("/c/tcgcsv-42382"));
t("every row has an image or a branded tile", (base.text.match(/class="sv-row"><(img|div class="tile)/g) || []).length === 10);
t("Base Set links to Shadowless", base.text.includes('href="/sets/base-set-shadowless"'));
t("no badge when mark is null", !base.text.includes('class="rot-badge"'));
const shadow = await page("/sets/base-set-shadowless");
t("Shadowless page renders", shadow.status === 200 && shadow.text.includes("$9,525.05") && shadow.text.includes('href="/sets/base-set"'));
const pe = await page("/sets/sv02-paldea-evolved");
t("rotation badge with status links /rotation", pe.text.includes('class="rm">G<') && pe.text.includes("Rotated April 10, 2026") && pe.text.includes('href="/rotation"'));
t("rotation shows once on a set page", pe.text.includes('class="rot-badge"') && !/class="rchip[^"]*" href="\/rotation"/.test(pe.text));
t("empty set value hides", !pe.text.includes(COPY.setValue.empty) && !pe.text.includes("No market price"));
t("badge null mark", rotationBadge({ mark: null }, {}) === "");
t("pageKind releases", pageKind("/releases") === "releases");
const rel = await page("/releases", { today: "2026-10-12" });
t("releases heading and explainer", rel.text.includes(">Coming up<") && rel.text.includes(COPY.releases.explainer));
t("releases only upcoming, sorted", !rel.text.includes("Old thing") && rel.text.indexOf("Delta Reign") < rel.text.indexOf("Binder Collection"));
t("Delta Reign market row", rel.text.includes("$262.92") && rel.text.includes("Sep 26, 2026") && rel.text.includes("/p/tcgcsv-712094"));
t("releases source link", rel.text.includes('href="https://support.pokemoncenter.com/hc/x"'));
t("releases nav link", rel.text.includes('href="/releases"'));
t("releases empty line", (await page("/releases", { today: "2027-01-01" })).text.includes(COPY.releases.empty));
t("upcoming filter", upcomingReleases(files["releases.json"], "2026-11-07").length === 1);
const prod = await page("/p/tcgcsv-644300");
t("listings line with previous night", prod.text.includes("eBay listings counted: 37 on Oct 12, from 35 on Oct 11."));
t("listings line without previous", listingsCountedLine(files["listings-counted.json"].products[1]) === "eBay listings counted: 8 on Oct 12.");
t("product rotation badge", prod.text.includes('class="rm">I<') && prod.text.includes("Standard"));
const sm = await page("/sitemap-00.xml");
t("sitemap has /releases", sm.text.includes("https://catchemtcg.com/releases</loc>"));
for (const [name, p] of [["base", base], ["shadow", shadow], ["pe", pe], ["releases", rel]]) {
  const v = visible(p.text.split('<div id="content"')[1] || p.text).split("<footer")[0];
  const body = v.split("Not affiliated")[0];
  t(`${name}: no em dash`, !/\u2014/.test(body));
  t(`${name}: no banned words`, !BANNED.test(body) || (console.log("    hit:", body.match(BANNED)?.[0]), false));
}
const prodBody = visible(prod.text.split('<h2 id="lc-h"')[1]?.split("</section>")[0] || "");
t("listings block: no supply or dash", prodBody && !/supply|\u2014/i.test(prodBody));
t("noDash", noDash("A \u2014 B") === "A: B");
t("set value hides when no doc", setValueBlock(null) === "");

t("set value strips number from name", setValueBlock({ asOf: "2026-10-12", top: [{ id: "tcgcsv-1", name: "Magikarp - 203/193", number: "203/193", price: 5 }], master: { total: 5, priced: 1, unpriced: 0 } }).includes("1. Magikarp</b>"));
t("print-run line is the approved text", PRINT_RUN_LINE === "Rotated sets historically stop getting new print runs. Older packs can still turn up in tins and collections.");
t("print-run line never says supply", !/supply/i.test(PRINT_RUN_LINE));
resetJsonCache();
if (fail) { console.log(`features: ${fail} failed`); process.exitCode = 1; throw new Error(`features: ${fail} failed`); }
console.log("features ok");
