import { banGuard } from "../src/advice-rules.mjs";
import worker from "../src/index.mjs";
import { renderWatch } from "../src/ui.mjs";
import { frameSvg, frameUrl } from "../src/return-share.mjs";
import {
  alertHookDoc,
  buildVisitPayload,
  formatLine,
  howWeKnow,
  priceMove,
  returnLines,
  typicalSwing,
  weekLines,
} from "../src/return-visit.mjs";

let fail = 0;
const t = (name, ok) => { console.log((ok ? "ok   " : "FAIL ") + name); if (!ok) fail++; };
const BANNED = banGuard("return-visit", /\bsold\b|Collectr|\bNM\b/i, { skipKinds: ["house"] });
const day = (n) => new Date(Date.parse("2026-10-01T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const flat = (last) => Array.from({ length: 25 }, (_, i) => [day(i), i === 24 ? last : 100]);
const quiet = { id: "tcgcsv-1", name: "Quiet Box", href: "/p/tcgcsv-1", kind: "sealed", source: "TCGplayer market", hist: flat(104) };
const jumpyHist = Array.from({ length: 25 }, (_, i) => [day(i), i % 2 ? 130 : 100]);
const jumpy = { id: "tcgcsv-2", name: "Jumpy Card", href: "/c/tcgcsv-2", kind: "single", source: "TCGplayer market", hist: jumpyHist };
const listed = {
  id: "tcgcsv-3",
  name: "Evolving Skies Booster Box",
  href: "/p/tcgcsv-3",
  kind: "sealed",
  source: "TCGplayer market",
  hist: [["2026-10-18", 100, 20], ["2026-10-19", 100, 20], ["2026-10-20", 100, 22], ["2026-10-21", 100, 24], ["2026-10-22", 100, 28], ["2026-10-23", 100, 30], ["2026-10-24", 100, 32], ["2026-10-25", 95.8, 32]],
};

t("example line", formatLine({ name: "Evolving Skies Booster Box", pct: -4.2, since: "2026-10-18", listings: 12 }) === "Evolving Skies Booster Box: down 4.2% since Oct 18, listings counted up 12");
t("flat one decimal is not a change", priceMove([["2026-10-18", 10], ["2026-10-25", 10.004]], "2026-10-18", "2026-10-25") === null);
t("a hole longer than two days is left out", priceMove([["2026-10-01", 10], ["2026-10-25", 12]], "2026-10-18", "2026-10-25") === null);
t("swing needs five closes", typicalSwing([["2026-10-22", 10], ["2026-10-23", 11], ["2026-10-24", 12], ["2026-10-25", 13]]) === null);

const back = returnLines([quiet, jumpy], "2026-10-18", "2026-10-25");
t("return visit ranks a quiet move ahead of a jumpy one", back[0] && back[0].id === "tcgcsv-1" && back.length <= 5);
const week = weekLines([quiet, jumpy], "2026-10-25");
t("a first visit keeps the three biggest week moves", week.length <= 3 && week[0].id === "tcgcsv-2");

const model = { asOf: "2026-10-25", products: [quiet, jumpy, listed] };
const first = buildVisitPayload(model, {});
t("first visit title", first.mode === "week" && first.title === "Biggest moves this week" && first.lines.length >= 1 && first.lines.length <= 3);
const again = buildVisitPayload(model, { since: "2026-10-18" });
t("return title and cap", again.mode === "return" && again.title === "Since your last visit" && again.lines.length <= 5);
const watched = buildVisitPayload(model, { since: "2026-10-18", ids: ["tcgcsv-3"] });
t("watch payload is that product", watched.lines.length === 1 && watched.lines[0].text.includes("listings counted"));
t("a line without a source is dropped", !watched.lines[0] || watched.lines[0].know.startsWith("TCGplayer market"));
const unsourced = buildVisitPayload({ asOf: "2026-10-25", products: [{ ...quiet, source: "guess" }] }, {});
t("unknown source never becomes a number", unsourced.lines.length === 0);
const sameDay = buildVisitPayload(model, { since: "2026-10-25" });
t("same day states that nothing new is on file", sameDay.mode === "today" && sameDay.lines.length === 0 && /No price change is on file/.test(sameDay.note));

const know = howWeKnow({ source: "TCGplayer market via TCGCSV", date: "2026-10-25", listings: 18, track: "12 of 20 reads moved the way they said." });
t("how we know names source, date, listings, and track record", know.includes("TCGplayer market") && know.includes("Oct 25") && know.includes("18 listings counted") && know.includes("Track record:"));
t("how we know stays blank without a date", howWeKnow({ source: "TCGplayer market", listings: 4 }) === "");
t("track record is omitted until a line is passed", !howWeKnow({ source: "eBay asks", date: "2026-10-25" }).includes("Track record"));

const hooks = alertHookDoc([{ id: "tcgcsv-3", name: "Evolving Skies Booster Box", href: "/p/tcgcsv-3" }, { id: "nope", name: "x", href: "/" }]);
t("alert hook does not send", hooks.send === false && hooks.endpoint === "" && hooks.items.length === 1);

const cardUrl = frameUrl({
  name: "Evolving Skies Booster Box",
  price: 2214.94,
  date: "2026-10-25",
  fact: "down 0.7% since Oct 18",
  img: "/api/card-img?pid=242436",
  sealed: true,
  source: "TCGplayer market",
  points: [["2026-10-18", 2198.94], ["2026-10-25", 2214.94]],
});
const svg = frameSvg(new URL(cardUrl).searchParams);
t("share card is 1200 by 675 with a chart and no condition", svg.includes('width="1200"') && svg.includes('height="675"') && svg.includes('rx="32"') && svg.includes("Catch'em") && svg.includes("$2,214.94") && svg.includes("down 0.7% since Oct 18") && svg.includes("<path ") && !/\bNM\b|Near Mint/.test(svg));
t("a price without a date is left off the card", !frameSvg(new URLSearchParams("n=Box&p=10&src=tcg&s=1")).includes("$10"));
t("copy has no dash, sold, or advice", [formatLine({ name: "Evolving Skies Booster Box", pct: -4.2, since: "2026-10-18", listings: 12 }), know, first.title, again.title, sameDay.note, "Nothing saved on this device yet.", "Tap Watch on a product, or start with one of these."].every((line) => !/[\u2014\u2013]/.test(line) && !BANNED.test(line)));

const page = renderWatch("Updated Oct 25");
t("watch page has an empty state and no account", page.includes("Nothing saved on this device yet.") && page.includes('data-rv-page="watch"') && !/sign in to watch/i.test(page));

const env = { ASSETS: { fetch: async () => new Response("", { status: 404 }) }, PUBLIC_FETCH: async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } }) };
const res = await worker.fetch(new Request("https://catchemtcg.com/api/return-visit"), env);
const body = await res.json();
t("api stays quiet when movers are missing", res.status === 200 && Array.isArray(body.lines) && body.lines.length === 0);
const frame = await worker.fetch(new Request(cardUrl), env);
const frameBody = await frame.text();
t("frame route serves the camera card", frame.status === 200 && frame.headers.get("content-type").includes("image/svg+xml") && frameBody.includes('height="675"'));

if (fail) { console.log(fail + " failed"); process.exit(1); }
console.log("return-visit ok");
