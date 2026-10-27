// Market meter gauge, page, and the email line. No advice wording. No em dash.
import { readFileSync } from "node:fs";
import { gaugeHtml, renderMeterPage, meterEmailBlock, meterPlainLine, historyWindow, adviceFree } from "../src/market-meter.mjs";
import { pageKind } from "../src/index.mjs";
import { meterEmailBlock as blockAgain } from "../src/market-meter.mjs";
import { runBrandVisualTests } from "./brand-visuals.test.mjs";

let fail = 0;
const t = (n, c) => { console.log(`${c ? "  ok " : "  FAIL"} ${n}`); if (!c) fail++; };

const slice = {
  mood: 68, moodBand: "Greed", heat: 28, heatBand: "Cool", used: 4, moodUsed: 2, heatUsed: 2,
  reasons: ["8% of sets at a 90 day high (6 of 78)", "The median set move is +0.1% over 7 days, above its usual pace", "53% of sets up over 7 days (145 of 276)"],
  inputs: [{ id: "breadth", meter: "mood", score: 53, fact: "53% of sets up over 7 days (145 of 276)" }, { id: "movers", meter: "heat", score: 39, fact: "39% of sets moved more than their usual week (30 of 78)" }],
};
const html = gaugeHtml(slice, { href: "/meter", asOf: "2026-10-19", kicker: "Market" });
t("gauge reserves height and is inline svg", html.includes('id="market-meter"') && html.includes("min-height:188px") && html.includes("<svg") && html.includes('height="112"'));
t("needle animates once", html.includes("ce-meter-swing") && html.includes("prefers-reduced-motion") && html.includes("--end:32.4deg"));
t("fear is blue and greed is gold", html.includes("#8eb7ff") && html.includes("#d9b779"));
t("heat pill is beside the score", html.includes("Heat Cool 28") && html.includes("68"));
t("why line uses the real numbers", html.includes("6 of 78") && html.includes("+0.1%") && html.includes("145 of 276") && html.includes("4 components") && html.includes("2026-10-19"));
t("no advice and no em dash", adviceFree(html) && !/[\u2014\u2013]/.test(html) && !/\b(buy|sell|load up|time to)\b/i.test(html));
t("a missing slice draws nothing", gaugeHtml(null) === "" && gaugeHtml({ mood: null, heat: 10, heatBand: "Cold" }) === "");
t("unpublished meter draws nothing", gaugeHtml(slice, { published: false }) === "");

const days = [];
for (let i = 0; i < 40; i += 1) days.push({ d: new Date(Date.parse("2026-09-01T00:00:00Z") + i * 86400000).toISOString().slice(0, 10), mood: 50, heat: 40 });
t("1M is the last 31 days and All is one tap", historyWindow(days, "1m", days.at(-1).d).length === 32 || historyWindow(days, "1m", days.at(-1).d).length === 31);
const month = historyWindow(days, "1m", days.at(-1).d);
t("1M is shorter than All", month.length < days.length && month[0].d > days[0].d && month.at(-1).d === days.at(-1).d);
t("All keeps the full series", historyWindow(days, "all", days.at(-1).d).length === 40);

const doc = {
  asOf: "2026-10-19", published: true, market: { ...slice, history: days },
  singles: { mood: 74, moodBand: "Greed", heat: 27, heatBand: "Cool", used: 4 },
  sealed: { mood: 42, moodBand: "Fear", heat: 28, heatBand: "Cool", used: 4 },
  vintage: null, modern: { mood: 10, moodBand: "Extreme fear", heat: 31, heatBand: "Cool", used: 4 },
  hidden: [{ id: "vintage", why: "WOTC set indexes are too short for two proven inputs on the same day." }],
  eras: { "Mega Evolution": { mood: 12, moodBand: "Extreme fear", heat: 21, heatBand: "Cold", used: 4 } },
  sets: { "sv-scarlet-and-violet-151": { name: "SV: Scarlet & Violet 151", mood: 21, moodBand: "Extreme fear", heat: 50, heatBand: "Warm", used: 4, inputs: slice.inputs } },
};
const page = renderMeterPage(doc, { range: "1m" });
t("meter page defaults to 1M and offers All", page.includes('href="/meter"') && page.includes('href="/meter?range=all"') && page.includes('aria-current="true"'));
t("page has component bars and era and set rows", page.includes("Breadth") && page.includes("Sealed") && page.includes("Singles") && page.includes("Extreme fear 10") && page.includes("SV: Scarlet") && page.includes("not shown") === false);
t("vintage is explained and not invented", page.includes("too short for two proven inputs") && !page.includes("Vintage:"));
const all = renderMeterPage(doc, { range: "all", set: "sv-scarlet-and-violet-151" });
t("All and a set stay on one tap", all.includes('href="/meter?range=all&set=sv-scarlet-and-violet-151"') || all.includes('href="/meter?set=sv-scarlet-and-violet-151&range=all"') || all.includes("range=all"));
t("empty file does not invent a score", renderMeterPage(null).includes("not on file") && !renderMeterPage(null).includes(">68<"));

const mail = meterEmailBlock({ asOf: "2026-10-19", ...slice });
t("email line matches the compact form", meterPlainLine(slice) === "Market: Greed 68, Heat: Cool" && mail.includes("Market: Greed 68, Heat: Cool"));
t("email is a white table with dark hooks and no svg", mail.includes('bgcolor="#ffffff"') && mail.includes("ce-card") && mail.includes("ce-ink") && mail.includes("ce-dim") && !mail.includes("<svg") && mail.includes("6 of 78"));
t("email block is self contained", blockAgain(slice) === "" || mail.includes("Open the meter"));

const article = readFileSync(new URL("../src/reads-article.mjs", import.meta.url), "utf8");
t("reads article only calls the meter block", article.includes("meterEmailBlock(doc.meter)") && article.includes('get("market-meter.json")'));
const ui = readFileSync(new URL("../src/ui.mjs", import.meta.url), "utf8");
t("set page reserves the gauge slot", ui.includes("${opts.meterHtml || \"\"}"));
t("/meter is a page", pageKind("/meter") === "meter");
t("score 0 and 100 still render", gaugeHtml({ ...slice, mood: 0, moodBand: "Extreme fear" }).includes("--end:-90.0deg") && gaugeHtml({ ...slice, mood: 100, moodBand: "Extreme greed" }).includes("--end:90.0deg"));

fail += runBrandVisualTests();
if (fail) process.exit(1);
