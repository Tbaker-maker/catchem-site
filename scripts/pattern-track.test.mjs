// Pattern track record: lift leads, the box hides under the proven minimum.
import { patternCopy, patternShows, liftMultiple, patternBarsEmail, PROVEN_MIN_N } from "../src/pattern-track.mjs";
import { factCards } from "../src/read-sheet.mjs";
import { itemReadBlock } from "../src/item-read.mjs";

let fail = 0;
const t = (n, c) => { console.log(`${c ? "  ok " : "  FAIL"} ${n}`); if (!c) fail++; };

const row = { rate: 29.1, base: 20.8, n: 2962, horizon: 7, dir: "up", keys: ["rotation_stage=rotated"], asOf: "2026-10-19" };
t("minimum matches the proven study", PROVEN_MIN_N === 20);
t("lift is rate over base", liftMultiple(29.1, 20.8) === "1.4" && Math.abs(29.1 / 20.8 - 1.4) < 0.05);
const copy = patternCopy(row);
t("lead is the lift and the move", copy.lead === "1.4x more likely than usual to rise and finish above the usual move within 7 days");
t("small print matches the lift", copy.small === "29.1% of 2,962 past cases vs 20.8% for all items." && copy.small.includes(`${copy.rate}%`) && copy.small.includes(`${copy.base}%`));
t("never the word right", !/\bright\b/i.test(copy.lead + copy.small));
const cards = factCards({ pattern: row, asOf: "2026-10-19" });
t("box has the bar and the why line", cards.pattern.includes(copy.lead) && cards.pattern.includes("This pattern") && cards.pattern.includes("Usual") && cards.pattern.includes("Why it matches: rotated out of Standard.") && cards.pattern.includes("Our nightly files, Oct 19."));
t("hidden under the case minimum", patternShows({ ...row, n: 19 }) === false && factCards({ pattern: { ...row, n: 19 } }).pattern === "");
t("hidden when there is no lift", patternShows({ ...row, rate: 20.8 }) === false && patternCopy({ ...row, rate: 18 }) === null);
t("hidden when the study says it did not pass", patternShows({ ...row, pass: false }) === false);
const down = patternCopy({ ...row, dir: "down", rate: 40, base: 20 });
t("down names the down move", down.lead.includes("fall and finish under the usual move") && down.lead.startsWith("2.0x"));
const mail = patternBarsEmail(copy);
t("email bar is a table, not a sparkline", mail.includes("<table") && mail.includes("This pattern") && !mail.includes("<svg") && !mail.includes("spark"));
const block = itemReadBlock({ pattern: { rate: 10, base: 20, n: 100, horizon: 7, asOf: "2026-10-19" }, asOf: "2026-10-19" });
t("product page hides a pattern under the minimums", !block.includes("Pattern track record"));

if (fail) { console.log(`${fail} failed`); process.exit(1); }
console.log("pattern track ok");
