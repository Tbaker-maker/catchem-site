import { readFileSync } from "node:fs";
import { flagLine } from "../src/advice-rules.mjs";
import { morningBrief } from "../src/smart-collection.mjs";
import {
  morningBriefEmailArmed,
  buildMorningBriefEmail,
  normalizeBriefEmailPrefs,
  sendMorningBriefEmail,
  goLiveChecklist,
  BRIEF_EMAIL_FLAG,
} from "../src/morning-brief-email.mjs";

let fail = 0;
const t = (name, ok) => { console.log((ok ? "ok   " : "FAIL ") + name); if (!ok) fail++; };

t("flag off by default", morningBriefEmailArmed({}) === false && morningBriefEmailArmed({ [BRIEF_EMAIL_FLAG]: "on" }) === false);
t("flag needs key", morningBriefEmailArmed({ [BRIEF_EMAIL_FLAG]: "on", READS_EMAIL_KEY: "x".repeat(40) }) === true);
t("flag rejects random", morningBriefEmailArmed({ [BRIEF_EMAIL_FLAG]: "maybe", READS_EMAIL_KEY: "x".repeat(40) }) === false);

const prefs = normalizeBriefEmailPrefs({ optIn: true, email: "you@email.com", goal: "selling" });
t("prefs need email for opt in", prefs.optIn === true && prefs.email === "you@email.com" && prefs.goal === "selling");
t("bad email blocks opt in", normalizeBriefEmailPrefs({ optIn: true, email: "nope" }).optIn === false);

const brief = morningBrief({
  holdings: [{ id: "tcgcsv-1", name: "Alpha", kind: "single", qty: 1, price: 10, change7: 5, setSlug: "demo-set" }],
  goal: "collecting",
  setDocs: [{ slug: "demo-set", name: "Demo Set", asOf: "2026-10-28", source: "TCGplayer market", items: [
    { id: "tcgcsv-1", name: "Alpha", kind: "single", price: 10, printings: [{ name: "Normal", id: "tcgcsv-1", price: 10, asOf: "2026-10-28" }] },
    { id: "tcgcsv-2", name: "Beta", kind: "single", price: 4, printings: [{ name: "Normal", id: "tcgcsv-2", price: 4, asOf: "2026-10-28" }] },
  ] }],
  prevHoldings: [{ id: "tcgcsv-1", name: "Alpha", kind: "single", qty: 1, price: 8, asOf: "2026-10-27" }],
});
const built = buildMorningBriefEmail({ day: "Oct 28, 2026", brief });
t("email has subject and lines", /Morning Brief/.test(built.subject) && built.lines.length >= 1 && /collection/.test(built.text));
t("email copy clean", !/[\u2013\u2014]/.test(built.text + built.html + built.subject) && !/\bsold\b/i.test(built.text));

let called = 0;
const skip = await sendMorningBriefEmail({
  env: {},
  to: "you@email.com",
  brief,
  day: "2026-10-28",
  fetchImpl: async () => { called += 1; return new Response("no", { status: 500 }); },
});
t("send no-ops when flag off", skip.skipped === true && skip.reason === "flag-off" && called === 0);

const checklist = goLiveChecklist();
t("go live checklist", checklist.length >= 4 && checklist.some((l) => /MORNING_BRIEF_EMAIL=on/.test(l)) && checklist.some((l) => /paid mail plan/.test(l)));

const src = readFileSync(new URL("../src/morning-brief-email.mjs", import.meta.url), "utf8");
t("no em dash in module", !/[\u2013\u2014]/.test(src));
for (const line of [built.subject, "You opted in to this email. Turn it off on My collection.", "Sending stays skipped while the flag is off."]) {
  t("advice: " + line.slice(0, 36), flagLine(line).length === 0);
}

if (fail) { console.error(fail + " failed"); process.exit(1); }
console.log("morning-brief-email tests passed");
