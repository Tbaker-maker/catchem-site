import { hasAdvice } from "../src/advice-rules.mjs";
import { copyFact, copyFactHtml, readFactInput } from "../src/copy-fact.mjs";
import { renderCard, renderFeed } from "../src/ui.mjs";

let fail = 0;
const t = (name, ok) => { console.log((ok ? "ok   " : "FAIL ") + name); if (!ok) fail++; };

const example = {
  name: "Example Booster Box",
  href: "/p/example-booster-box",
  price: 123.45,
  source: "TCGplayer market",
  date: "2026-11-25",
  changePct: -11.8,
  days: 90,
  listings: 86,
  listingsDate: "2026-11-23",
};
const expected = "Example Booster Box: $123.45 TCGplayer market, Nov 25, 2026, down 11.8% in 90 days, 86 eBay listings counted Nov 23. catchemtcg.com/p/example-booster-box";
const line = copyFact(example);
t("copied sentence matches the page fields", line === expected);
t("the sentence is in the button html and visible without a script", copyFactHtml(example).includes("Copy fact") && copyFactHtml(example).includes(expected) && !copyFactHtml(example).includes("<script"));
t("a held price copies no price", copyFact({ name: "Held Box", href: "/p/held-box", held: true, price: 50, source: "TCGplayer market", date: "2026-11-25" }) === "Held Box: Price being checked. catchemtcg.com/p/held-box" && !/\$\d/.test(copyFact({ name: "Held Box", href: "/p/held-box", priceStatus: "checking", price: 50, source: "TCGplayer market", date: "2026-11-25" })));
t("a missing date or source copies nothing", copyFact({ ...example, date: "" }) === "" && copyFact({ ...example, source: "" }) === "");
t("banned phrases fail closed", copyFact({ ...example, name: "buy now box" }) === "" && hasAdvice("buy now box"));
t("no dash in a fact", !/[\u2014\u2013]/.test(line));

const end = "2026-11-25";
const start = "2026-08-27";
const hist = [[start, 140], [end, 123.45]];
const sealed = renderCard({
  id: "tcgcsv-9001",
  name: "Example Booster Box",
  kind: "sealed",
  set: "Example",
  slug: "example-booster-box",
  price: 123.45,
  source: "TCGplayer market",
  asOf: end,
  hist,
}, "stamp", {
  listingSeries: [{ date: "2026-11-16", listingCount: 80 }, { date: "2026-11-23", listingCount: 86 }],
});
t("sealed page sentence uses the page price, source, and link", sealed.includes("Example Booster Box: $123.45 TCGplayer market via TCGCSV, Nov 25, 2026, down 11.8% in 90 days, 86 eBay listings counted Nov 23. catchemtcg.com/p/example-booster-box") && sealed.includes("Copy fact"));
const heldPage = renderCard({ id: "tcgcsv-9002", name: "Held Box", kind: "sealed", set: "Example", price: 40, source: "TCGplayer market", asOf: end, priceStatus: "checking", hist }, "stamp", { priceHeld: true });
t("held product page copies no dollar amount", heldPage.includes("Held Box: Price being checked.") && !/Held Box:[^<]*\$\d/.test(heldPage));

const single = renderCard({ id: "tcgcsv-9003", name: "Example Card", kind: "single", set: "Example", price: 10, source: "TCGplayer market", asOf: end, hist: [[start, 8], [end, 10]] }, "stamp", {});
t("single page has a copy fact with no condition word", single.includes("Example Card: $10.00 TCGplayer market via TCGCSV, Nov 25, 2026") && single.includes("catchemtcg.com/c/tcgcsv-9003") && !/copy-fact-line">[^<]*\bNM\b/.test(single));

const read = {
  id: "read-1",
  name: "Example Card",
  href: "/c/tcgcsv-9003",
  price: 10,
  source: "TCGplayer market",
  asOf: end,
  changePct: -11.8,
  windowDays: 90,
  headline: "Example Card moved.",
};
t("read input does not invent a source", copyFact(readFactInput({ ...read, source: "" })) === "");
const feed = renderFeed({ reads: [read], asOf: end }, "", "stamp", {});
t("read card sentence is in the first html", feed.includes('data-fact-for="read-1"') && feed.includes("Example Card: $10.00 TCGplayer market, Nov 25, 2026, down 11.8% in 90 days. catchemtcg.com/c/tcgcsv-9003"));
t("a read with no price is omitted", !renderFeed({ reads: [{ id: "bare", name: "Bare", href: "/c/x", source: "TCGplayer market", asOf: end }] }, "", "stamp", {}).includes("copy-fact-line"));

if (fail) {
  console.error(fail + " failed");
  process.exit(1);
}
console.log("copy-fact ok");
