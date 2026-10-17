import { itemReadBlock } from "../src/item-read.mjs";
let fail = 0; const t = (n, ok) => { console.log(`${ok ? "ok  " : "FAIL"} ${n}`); if (!ok) fail++; };
const doc = { asOf: "2026-10-16", change: { d30: { pct: -2.3, from: "2026-09-15", to: "2026-10-16" } }, range: { high: { price: 30, date: "2026-10-16" }, low: { price: 29, date: "2026-09-26" }, from: "2026-09-26", daysSinceHigh: 0 } };
const a = itemReadBlock(doc, { skipWindows: true });
t("item page read drops window chips that repeat the change table", !a.includes("30-day"));
t("high and low names its window", a.includes("High and low since Sep 26"));
t("windows still show off item pages", itemReadBlock(doc).includes("30-day"));
if (fail) process.exit(1);
