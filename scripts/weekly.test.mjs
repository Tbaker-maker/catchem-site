// Weekly and scanner: passed patterns and dated movers. Empty lists stay off.
import { banGuard } from "../src/advice-rules.mjs";
// Whole pages carry code comments, so dashes are checked by their own assertion here.
const PAGE = { skipKinds: ["house"] };
import { pageKind, renderPath } from "../src/index.mjs";
import { resetJsonCache } from "../src/data.mjs";
import { parseWeeklyPattern, weeklyBody, scannerBody } from "../src/weekly.mjs";

let fail = 0;
const t = (name, cond) => { console.log(`${cond ? "  ok " : "  FAIL"} ${name}`); if (!cond) fail++; };
const BANNED = banGuard("weekly", /\b(supply)\b/i, PAGE);
const visible = (h) => String(h).replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");

const doc = {
  asOf: "2026-10-13",
  patternsAsOf: "2026-10-13",
  label: "Weekly changes",
  movers: [
    { id: "tcgcsv-88967", name: "Scizor ex", number: "108/115", set: "EX Unseen Forces", from: "2026-10-10", to: "2026-10-13", p0: 45.99, p1: 183.44, pct: 298.9 },
    { id: "nope", name: "Missing prices", from: "2026-10-10", to: "2026-10-13" },
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
const body = weeklyBody(doc, {});
t("movers keep the prices, the dates, and a card link", body.includes("Scizor ex") && body.includes("108/115") && body.includes("$45.99") && body.includes("$183.44") && body.includes("+298.9%") && body.includes('href="/c/tcgcsv-88967"') && body.includes("Oct 10, 2026") && body.includes("Oct 13, 2026") && !body.includes("Missing prices"));
t("empty listings stay off", !body.includes("Listings counted") && !body.includes("stays empty"));
t("scanner is the same passed sentence", scannerBody(doc).includes(parseWeeklyPattern(doc.patterns[0]).text) && !scannerBody(doc).includes("train=") && !scannerBody(doc).includes("slow-slide"));
const withChange = weeklyBody({ ...doc, listingsCounted: { changes: [{ id: "tcgcsv-1", name: "Pikachu", n: 12, prev: 10, date: "2026-10-13", prevDate: "2026-10-06" }] } }, {});
t("a dated listings change can show", withChange.includes("12 listings counted on Oct 13, 2026") && withChange.includes("from 10 on Oct 6, 2026") && withChange.includes("+20%"));
t("copy stays clean", !/[\u2014\u2013]/.test(body) && !BANNED.test(visible(body)) && !/No data/i.test(body));

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
t("route renders", res.status === 200 && html.includes("<h1>Weekly</h1>") && html.includes('href="/weekly"') && html.includes("Scizor ex") && html.includes('href="/scanner"'));
const scan = await (await renderPath("/scanner", fetchImpl, {})).text();
t("scanner route renders", scan.includes("<h1>Scanner</h1>") && scan.includes("38.5%") && !scan.includes("train="));

if (fail) { console.log(`${fail} failed`); process.exit(1); }
console.log("weekly ok");
