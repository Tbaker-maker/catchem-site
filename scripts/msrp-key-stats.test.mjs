// MSRP on sealed pages (Nov 11): the sourced US MSRP and market / MSRP show in
// Key stats only for a sourced high or medium row, with its source and date.
// No row, a low row, or a row with no source URL shows nothing.
import { renderCard, msrpFacts } from "../src/ui.mjs";
import { msrpOf, msrpSourceLabel, marketOverMsrp } from "../src/msrp.mjs";

let fail = 0;
const t = (name, cond) => { console.log(`${cond ? "  ok " : "  FAIL"} ${name}`); if (!cond) fail++; };

const doc = { products: {
  "swsh11-etb": { name: "Lost Origin Elite Trainer Box", msrpUsd: 39.99, currency: "USD", region: "US", sourceUrl: "https://pokemerchandise.com/x", citedPrimarySource: "https://deviramericas.com/wp-content/uploads/2022/06/SWSH11_ETB.pdf", dateChecked: "2026-11-11", confidence: "high", tcgPlayerId: "277335" },
  "swsh7-etb": { msrpUsd: 39.99, currency: "USD", sourceUrl: "https://deviramericas.com/a.pdf", dateChecked: "2026-11-11", confidence: "high", tcgPlayerId: "" },
  "sm5-etb": { msrpUsd: 39.99, currency: "USD", sourceUrl: "https://web.archive.org/web/20180108075932/http://www.phdgames.com:80/pokemon-upcoming-releases-ultra-prism-more/", citedPrimarySource: "https://web.archive.org/web/20180108075932/http://www.phdgames.com:80/pokemon-upcoming-releases-ultra-prism-more/", dateChecked: "2026-11-11", confidence: "high" },
  "low-row": { msrpUsd: 9.99, currency: "USD", sourceUrl: "https://x.example/", dateChecked: "2026-11-11", confidence: "low", tcgPlayerId: "1" },
  "no-src": { msrpUsd: 9.99, currency: "USD", sourceUrl: "", dateChecked: "2026-11-11", confidence: "high", tcgPlayerId: "2" },
} };

t("matches by TCGplayer id on a tcgcsv page", msrpOf({ keys: ["tcgcsv-277335"], pid: "tcgcsv-277335" }, doc)?.key === "swsh11-etb");
t("matches by sealed id", msrpOf({ keys: ["swsh11-etb"] }, doc)?.msrpUsd === 39.99);
t("matches a slug that redirects to this page", msrpOf({ keys: ["tcgcsv-999"], pageId: "tcgcsv-999", redirects: { products: { "swsh7-etb": "/p/tcgcsv-999" } } }, doc)?.key === "swsh7-etb");
t("low confidence row is not shown", msrpOf({ keys: ["low-row"], pid: "1" }, doc) === null);
t("row without a source URL is not shown", msrpOf({ keys: ["no-src"], pid: "2" }, doc) === null);
t("no file: nothing", msrpOf({ keys: ["swsh11-etb"] }, null) === null);
t("source label names the launch source", msrpSourceLabel(doc.products["swsh11-etb"]) === "TPCi launch sheet");
t("archived page is labeled by the archived site", msrpSourceLabel(doc.products["sm5-etb"]) === "PHD Games distributor page");
t("multiple rounds to 2 places", marketOverMsrp(192.59, 39.99) === 4.82);
t("no multiple without a market price", marketOverMsrp(0, 39.99) === null);

const facts = msrpFacts(doc.products["swsh11-etb"], 192.59, "2026-11-12", "TCGplayer market");
t("MSRP line has amount, source, region and check date", facts[0].label === "MSRP" && facts[0].value === "$39.99 (TPCi launch sheet, US, checked Nov 11, 2026)");
t("multiple line names the market source and date", facts[1].label === "Market / MSRP" && facts[1].value.startsWith("4.82x (TCGplayer market") && facts[1].value.includes("Nov 12, 2026"));
t("no row: no lines", msrpFacts(null, 100, "2026-11-12").length === 0);

const card = { id: "tcgcsv-277335", name: "Lost Origin Elite Trainer Box", kind: "sealed", set: "Lost Origin", price: 192.59, asOf: "2026-11-12", source: "TCGplayer market", hist: [["2026-11-01", 190], ["2026-11-12", 192.59]] };
const msrp = msrpOf({ keys: [card.id], pid: card.id }, doc);
const html = renderCard(card, "stamp", { msrp });
const stats = (html.match(/<section id="stats">[\s\S]*?<\/section>/) || [""])[0];
t("sealed Key stats shows MSRP", stats.includes("<dt>MSRP</dt>") && stats.includes("$39.99 (TPCi launch sheet, US, checked Nov 11, 2026)"));
t("sealed Key stats shows market / MSRP", stats.includes("<dt>Market / MSRP</dt>") && stats.includes("4.82x"));
const bare = renderCard(card, "stamp", {});
t("no sourced row: no MSRP on the page", !/MSRP/.test((bare.match(/<section id="stats">[\s\S]*?<\/section>/) || [""])[0]));
t("no advice or sold wording in the MSRP lines", !/\b(sold|buy|sell|undervalued|cheap|deal)\b/i.test(facts.map((f) => f.value).join(" ")));

process.exit(fail ? 1 : 0);
