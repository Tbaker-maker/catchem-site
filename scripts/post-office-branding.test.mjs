// Post Office branding: free to keep or remove for everyone, and no plan, price, or
// paywall copy anywhere in the editor or the Ideas copy.
import { EDITOR_URL, PLAN_COPY, patchEditorHtml } from "../src/full-editor.mjs";
import { ideasSignInLine, limitCard, signInCard } from "../src/quota.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.log("  FAIL", name); }
};

const raw = await (await fetch(EDITOR_URL)).text();
const html = patchEditorHtml(raw, "2026-11-10", "Post Office build test");
const hits = html.match(new RegExp(PLAN_COPY.source, "gi")) || [];
t("the editor has no Premium, $9, /mo, monetize, or paywall copy", hits.length === 0);
t("the branding buttons say Keep branding and Remove branding", html.includes(">Keep branding</button>") && html.includes(">Remove branding</button>"));
t("the desk seats say the same", html.includes("<b>Keep branding</b>") && html.includes("<b>Remove branding</b>") && html.includes("Free for everyone."));
t("remove branding needs no sign-in or entitlement", html.includes('localStorage.setItem("ce-seat", "studio")') && !/seatIsStudio[^}]*(fetch|premium|session)/.test(html));
t("the free mark is still the default", html.includes('var FREE_MARK = "CatchEmTCG.com";') && html.includes('if (!seatIsStudio()) return FREE_MARK;'));
t("the X caption check still refuses payout coaching", html.includes("how to (get paid|monet[a-z]+|farm impressions)") && html.includes("Payout-coaching posts are ineligible."));

const copy = [ideasSignInLine(true), ideasSignInLine(false), signInCard("ideas").body, signInCard("post").body, signInCard("video").body,
  limitCard("ideas", 3).body, limitCard("post-text", 3).body, limitCard("video", 1).body].join(" ");
t("Ideas and limit copy has no seat tier", !/premium|free seat|free is/i.test(copy) && copy.includes("50 a day"));

if (fail) { console.log(fail + " failed"); process.exit(1); }
console.log("post-office branding ok");
