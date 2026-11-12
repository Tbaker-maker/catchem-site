// Weekly and scanner: passed patterns, dated movers, shareable filters.
import { banGuard } from "../src/advice-rules.mjs";
// Whole pages carry code comments, so dashes are checked by their own assertion here.
const PAGE = { skipKinds: ["house"] };
import { pageKind, renderPath } from "../src/index.mjs";
import { resetJsonCache } from "../src/data.mjs";
import { parseWeeklyPattern, weeklyBody, scannerBody, listingFields, scannerQuery, scannerHref, filterScreener } from "../src/weekly.mjs";

let fail = 0;
const t = (name, cond) => { console.log(`${cond ? "  ok " : "  FAIL"} ${name}`); if (!cond) fail++; };
const BANNED = banGuard("weekly", /\b(supply)\b/i, PAGE);
const visible = (h) => String(h).replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");

const doc = {
  asOf: "2026-10-13",
  windowFrom: "2026-10-06",
  windowDays: 7,
  source: "TCGplayer market via TCGCSV",
  patternsAsOf: "2026-10-13",
  label: "Weekly changes",
  movers: [
    { id: "tcgcsv-88967", name: "Scizor ex", number: "108/115", set: "EX Unseen Forces", from: "2026-10-10", to: "2026-10-13", p0: 45.99, p1: 183.44, pct: 298.9, printing: "Holofoil" },
    { id: "nope", name: "Missing prices", from: "2026-10-10", to: "2026-10-13" },
    { id: "tcgcsv-86684", name: "Leafeon LV.X", number: "99/100", set: "Stormfront", from: "2026-10-06", to: "2026-10-13", p0: 200, p1: 200, pct: 0, flag: "thin-spike" },
  ],
  patterns: [
    "breakaway|confirmed|single|up|7d|n=692|rate=38.5|lo=35.3|base=30.4|train=34.5|test=42.2",
    "slow-slide|forming|single|down|7d|n=10|rate=40|base=20",
    "staircase|forming|single|up|30d|n=10|rate=40|base=20",
  ],
  listingsCounted: { daysOnFile: 1, changes: [], note: "Listings counted changes need two dated files. Until then this list stays empty." },
};
t("page kind", pageKind("/weekly") === "weekly" && pageKind("/scanner") === "scanner");
t("forming and staircase stay off until they pass", parseWeeklyPattern(doc.patterns[1]) === null && parseWeeklyPattern(doc.patterns[2]) === null);
t("a passed pattern is one sentence without the private rates", parseWeeklyPattern(doc.patterns[0]).text === "1.3x more likely than usual to rise and finish above the usual move within 7 days. Breakaway on singles, up. 38.5% of 692 past cases vs 30.4% for all items." && !/\bright\b/.test(parseWeeklyPattern(doc.patterns[0]).text) && !scannerBody(doc).toLowerCase().includes("right"));
t("a pattern object with the same fields also parses", parseWeeklyPattern({ pattern: "breakaway", stage: "confirmed", kind: "single", dir: "up", horizon: 7, n: 692, rate: 38.5, base: 30.4 }).text === parseWeeklyPattern(doc.patterns[0]).text);
t("a pattern object without base does not invent a lift", parseWeeklyPattern({ pattern: "breakaway", stage: "passed", kind: "single", dir: "up", horizon: "7d", n: 692, rate: 38.5 }).text === "Breakaway on singles, up. 38.5% of 692 past cases, over 7 days.");
const body = weeklyBody(doc, {});
t("movers keep the prices, the dates, and a card link", body.includes("Scizor ex") && body.includes("108/115") && body.includes("$45.99") && body.includes("$183.44") && body.includes("+298.9%") && body.includes('href="/c/tcgcsv-88967"') && body.includes("Oct 10, 2026") && body.includes("Oct 13, 2026") && !body.includes("Missing prices"));
t("risers and fallers are separate lists", body.includes("<h2>Risers</h2>") && body.includes("<h2>Fallers</h2>") && body.includes("Scizor ex"));
t("printing and source are on the letter", body.includes("Holofoil") && body.includes("TCGplayer market via TCGCSV") && body.includes("7-day window"));
t("a short spike is labelled, not treated as a crash", body.includes("Short spike.") && body.includes("Leafeon LV.X"));
t("current weekly tab is marked", body.includes('href="/weekly" aria-current="page"') && body.includes('aria-current="page"'));
t("empty listings show an honest empty state", body.includes("Listings counted") && body.includes("No listings counted changes in this edition, Oct 13, 2026.") && !body.includes("stays empty"));
t("scanner is the same passed sentence", scannerBody(doc).includes(parseWeeklyPattern(doc.patterns[0]).text) && !scannerBody(doc).includes("train=") && !scannerBody(doc).includes("slow-slide"));
t("scanner has an as-of date and a count", scannerBody(doc).includes("Scanner, Oct 13, 2026.") && scannerBody(doc).includes("in this edition, Oct 13, 2026."));
const withChange = weeklyBody({ ...doc, listingsCounted: { changes: [{ id: "tcgcsv-1", name: "Pikachu", n: 12, prev: 10, date: "2026-10-13", prevDate: "2026-10-06" }] } }, {});
t("a dated listings change can show", withChange.includes("12 listings counted on Oct 13, 2026") && withChange.includes("from 10 on Oct 6, 2026") && withChange.includes("+20%"));
const dataShape = weeklyBody({ ...doc, listingsCounted: { changes: [{ id: "tcgcsv-1", name: "Pikachu", fromN: 10, toN: 12, from: "2026-10-06", to: "2026-10-13" }] } }, {});
t("listings also accept from/to/fromN/toN", dataShape.includes("12 listings counted on Oct 13, 2026") && dataShape.includes("from 10 on Oct 6, 2026") && dataShape.includes("+20%"));
t("listing field aliases resolve both shapes", listingFields({ from: "2026-10-06", to: "2026-10-13", fromN: 10, toN: 12 }).n === 12 && listingFields({ prevDate: "2026-10-06", date: "2026-10-13", prev: 10, n: 12 }).prev === 10);
const sealedDoc = weeklyBody({
  ...doc,
  includesSealed: true,
  movers: [],
  sealedRisers: [{ id: "tcgcsv-100", name: "Surging Sparks ETB", kind: "sealed", set: "Surging Sparks", from: "2026-10-06", to: "2026-10-13", p0: 40, p1: 49.99, pct: 25 }],
  sealedFallers: [],
}, {});
t("sealed movers use the product path and a sealed section", sealedDoc.includes("Sealed risers") && sealedDoc.includes("Surging Sparks ETB") && sealedDoc.includes('href="/p/tcgcsv-100"') && sealedDoc.includes("No sealed fallers in this edition, Oct 13, 2026."));
t("copy stays clean", !/[\u2014\u2013]/.test(body) && !BANNED.test(visible(body)) && !/No data/i.test(body) && !/\bsold\b/i.test(visible(body)));

const universe = [
  { id: "tcgcsv-1", name: "A", kind: "single", set: "Surging Sparks", era: "Scarlet & Violet", p1: 12, pct: 20, from: "2026-10-06", to: "2026-10-13", p0: 10, windows: { "30d": { pct: 50, p0: 8, p1: 12, from: "2026-09-13", to: "2026-10-13" } } },
  { id: "tcgcsv-2", name: "B", kind: "sealed", set: "Prismatic Evolutions", era: "Scarlet & Violet", p1: 200, pct: -10, from: "2026-10-06", to: "2026-10-13", p0: 222, listingsPct: 16 },
  { id: "tcgcsv-3", name: "C", kind: "single", set: "Neo Genesis", era: "Neo", p1: 4, pct: 80, from: "2026-10-06", to: "2026-10-13", p0: 2.2, pattern: "breakaway" },
];
t("scanner filters by 30D, sealed, era, set, floor, and pattern",
  filterScreener(universe, scannerQuery({ window: "30d", floor: 10 })).length === 1
  && filterScreener(universe, scannerQuery({ kind: "sealed" }))[0].row.id === "tcgcsv-2"
  && filterScreener(universe, scannerQuery({ era: "Neo" }))[0].row.id === "tcgcsv-3"
  && filterScreener(universe, scannerQuery({ set: "Surging Sparks" }))[0].row.id === "tcgcsv-1"
  && filterScreener(universe, scannerQuery({ listings: "1" }))[0].row.id === "tcgcsv-2"
  && filterScreener(universe, scannerQuery({ pattern: "breakaway" }))[0].row.id === "tcgcsv-3"
  && filterScreener(universe, scannerQuery({ dir: "down" }))[0].row.id === "tcgcsv-2");
t("scanner query params are shareable", scannerHref(scannerQuery({ window: "30d", kind: "sealed", floor: 20 })) === "/scanner?window=30d&kind=sealed&floor=20");
const emptyScan = scannerBody({ asOf: "2026-10-13", patterns: [] });
t("scanner empty state is dated and honest", emptyScan.includes("No patterns passed in this edition, Oct 13, 2026.") && emptyScan.includes("0 of 0 in this edition, Oct 13, 2026.") && emptyScan.includes('aria-current="page"'));
const filteredScan = scannerBody({ asOf: "2026-10-13", screener: universe, patterns: [] }, { kind: "singles", floor: 1000 });
t("a tight filter says nothing matched", filteredScan.includes("No products matched these filters in this edition, Oct 13, 2026.") && filteredScan.includes('action="/scanner"') && filteredScan.includes("7D") && filteredScan.includes("30D") && filteredScan.includes("90D"));

const fetchImpl = async (url) => {
  const u = String(url);
  const send = (payload) => new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
  if (u.endsWith("/data/derived/weekly.json")) return send(doc);
  if (u.endsWith("/research/assets/public/catalogue-images.json")) return send({ images: {} });
  if (u.endsWith("/research/assets/public/counts.json")) return send({ asOf: "2026-10-13", updatedAt: "2026-10-13T12:00:00Z" });
  if (u.endsWith("/research/assets/public/feed/status.json")) return send({ images: { tcgplayer: false } });
  return new Response("no", { status: 404 });
};
resetJsonCache();
const res = await renderPath("/weekly", fetchImpl, {});
const html = await res.text();
t("route renders", res.status === 200 && html.includes("<h1>Weekly</h1>") && html.includes('href="/weekly"') && html.includes("Scizor ex") && html.includes('href="/scanner"') && /wk-nav a\[aria-current="page"\]/.test(html) && html.includes('aria-current="page"'));
const scan = await (await renderPath("/scanner", fetchImpl, { window: "7d" })).text();
t("scanner route renders", scan.includes("<h1>Scanner</h1>") && scan.includes("38.5%") && !scan.includes("train="));

if (fail) { console.log(`${fail} failed`); process.exit(1); }
console.log("weekly ok");
