import { readFileSync } from "node:fs";
import { banGuard } from "../src/advice-rules.mjs";
import { FLAG, MIRROR_NOTE, MONTH_ENDS, cellText, previewPage, pulseOn, pulseShareSvg } from "../src/pulse-page.mjs";

let fail = 0;
const t = (name, ok) => { console.log((ok ? "ok   " : "FAIL ") + name); if (!ok) fail++; };
const BANNED = banGuard("pulse-page", /\bsolds?\b|Collectr|\bNM\b/i);

t("flag defaults off", FLAG === "TF_PULSE" && pulseOn({}) === false && pulseOn({ TF_PULSE: "on" }) === true);
t("a missing month is not zero", cellText(null, 10) === "No reading" && cellText("", 10) === "No reading");
t("a real zero stays a score", cellText(0, 36).startsWith("0"));
const sep = MONTH_ENDS.find((row) => row.ym === "2026-09");
t("september zero is the file score", sep && sep.mood === 0 && sep.d === "2026-09-29");
const page = previewPage("light");
const svg = pulseShareSvg();
t("page has heatmap wordmark and share card", page.includes("Catch'em") && page.includes("tf-heat") && page.includes(MIRROR_NOTE) && page.includes("<svg"));
t("share card has frame watermark url", svg.includes('stroke="#d9b779"') && svg.includes('fill-opacity="0.07"') && svg.includes("catchemtcg.com/pulse") && svg.includes("Catch'em") && svg.includes(MIRROR_NOTE));
t("copy is clean", !/[\u2014\u2013]/.test(page + svg) && !BANNED.test(page) && !svg.includes("Greed"));
const wired = readFileSync(new URL("../src/index.mjs", import.meta.url), "utf8");
t("route is behind the flag", wired.includes("pulseOn(env)") && wired.includes('=== "/pulse"'));

if (fail) { console.log(fail + " failed"); process.exit(1); }
console.log("pulse page ok");
