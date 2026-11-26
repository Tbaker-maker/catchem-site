import { cleanLetterName, gatePlan, planFromFields, renderReadsPage } from "../src/reads.mjs";
import { breadthSectionHtml, renderArticle } from "../src/reads-article.mjs";

let fail = 0;
const t = (name, ok) => { console.log((ok ? "ok   " : "FAIL ") + name); if (!ok) fail++; };

const raw = planFromFields(new URLSearchParams("point=news&point=breadth&point=nope&letter_name=Monday+letter&set=me-30th-celebration"));
const gated = gatePlan(raw, { premium: false });
t("points round trip in fixed order and the letter name is kept", gated.plan.points.join(",") === "breadth,news" && gated.plan.letterName === "Monday letter");
t("an advice letter name is dropped", cleanLetterName("buy now") === "" && gatePlan(planFromFields(new URLSearchParams("letter_name=buy+now")), { premium: false }).plan.letterName === "");

const payload = {
  asOf: "2026-11-25",
  publicRead: {
    id: "market-breadth",
    line: "4 of 10 sets up over 7 days.",
    source: "TCGplayer market",
    asOf: "2026-11-25",
    permalink: "https://catchemtcg.com/reads#market-breadth",
  },
  facts: [{ text: "4 of 10 sets up over 7 days.", source: "TCGplayer market", date: "2026-11-25" }],
  sinceLastWeek: "No prior week on file.",
  share: {
    permalink: "https://catchemtcg.com/reads#market-breadth",
    numbers: { upShare: 0.4, G: 12 },
    series: [{ name: "singles", points: [{ d: "2026-11-25", v: 3 }] }],
  },
  backtest: { passed: false, reason: "not passed yet" },
};
const section = breadthSectionHtml(payload, { on: true });
t("breadth section renders the public line and the share card", section.includes("Market breadth") && section.includes("4 of 10 sets up over 7 days.") && section.includes("https://catchemtcg.com/reads#market-breadth") && section.includes("singles 3 on Nov 25"));
t("G stays off until the backtest passes", !section.includes(">12<") && !/\bG\b/.test(section.replace(/<[^>]+>/g, " ")));
t("a missing payload or a flag off omits the section", breadthSectionHtml(null, { on: true }) === "" && breadthSectionHtml(payload, { on: false }) === "" && breadthSectionHtml({ publicRead: null }, { on: true }) === "");

const page = renderReadsPage({ signedIn: false, breadth: payload, plan: { points: ["breadth"], letterName: "Monday letter", sets: ["me-30th-celebration"], watch: [], addons: {} } });
t("the phone picker collapses groups and names the letter", page.includes("Name your letter") && page.includes('class="rd-group"') && page.includes("Market breadth") && page.includes('name="letter_name"') && page.includes('id="rd-letter-name">Monday letter</p>'));
t("preview shows breadth when that point is on and hides it when it is off", page.includes('<div id="rd-breadth">') && !page.includes('id="rd-breadth" hidden') && renderReadsPage({ signedIn: false, breadth: payload, plan: { points: [], sets: ["me-30th-celebration"], watch: [], addons: {} } }).includes('id="rd-breadth" hidden'));
t("a missing file does not draw a blank breadth block", !renderReadsPage({ signedIn: false }).includes('id="rd-breadth"'));
t("other point ids stay off the first picker", !page.includes('value="top"') && !page.includes('value="listings"'));
t("a saved later id stays on the plan without a fake section", renderReadsPage({ signedIn: false, plan: { points: ["news"], sets: ["me-30th-celebration"], watch: [], addons: {} } }).includes('type="hidden" name="point" value="news"') && !renderReadsPage({ signedIn: false, plan: { points: ["news"], sets: ["me-30th-celebration"], watch: [], addons: {} } }).includes("id=\"market-breadth\""));
t("checking breadth shows the preview section", page.includes('breadth.hidden = vals("point").indexOf("breadth") < 0'));

const doc = {
  asOf: "2026-11-25",
  length: "standard",
  label: "Your read",
  intro: "A short read.",
  lead: "Example Card led your read, up 4.0%.",
  fallback: "",
  path: "default",
  top: { id: "tcgcsv-1", name: "Example Card", href: "https://catchemtcg.com/c/tcgcsv-1", set: "Example", image: "", story: "It moved.", premiumFlag: "", a: { change: 4, start: ["2026-11-18", 10], last: ["2026-11-25", 10.4], pts: [["2026-11-18", 10], ["2026-11-25", 10.4]], thin: false } },
  tiles: [],
  ups: [],
  downs: [],
  supply: [],
  vintage: null,
  pattern: null,
  rotation: null,
  news: null,
  setCompare: [],
  breadthHtml: section,
};
const letter = renderArticle(doc);
t("the letter places the breadth section when it is real", letter.includes("market-breadth") && letter.includes("4 of 10 sets up"));
const quiet = renderArticle({ ...doc, breadthHtml: "" });
t("an empty breadth field adds no section", !quiet.includes("market-breadth"));

if (fail) {
  console.error(fail + " failed");
  process.exit(1);
}
console.log("letter presets ok");
