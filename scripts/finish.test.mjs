import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const src = readFileSync(new URL("../src/ui.mjs", import.meta.url), "utf8");
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
function grab(name, endName) {
  const a = src.indexOf(name); const b = src.indexOf(endName, a);
  ok(a >= 0 && b > a, "found " + name); return src.slice(a, b);
}
const code = grab("const NUM_LABELS=", "function productIdOf(card){");
const html = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = v => "$" + Number(v).toFixed(2);
const more = new Function("html", "money", code + "return moreBlock;")(html, money);
const spread = { readKind: "spread", path: "p", why: "The high ask is $484.32.", whyItMatters: "The high ask is $484.32.", whatWouldMakeThisWrong: "Wrong if X.", asOf: "2026-10-11", sourceLine: "rsv10pt5-wf-pc-etb", receipt: { low: 230, high: 484.32, median: 275.65, count: 55, basis: "p10-p90" } };
let out = more(spread);
ok(out.includes("The numbers"), "numbers block"); ok(out.includes("$275.65") && out.includes("55"), "receipt values");
ok(out.includes("eBay asks"), "source name"); ok(out.includes('class="source-line">rsv10pt5-wf-pc-etb'), "sourceLine");
ok(out.includes("What would make this wrong.") && out.includes("<b>Why.</b>"), "why and wrong on a spread");
const ask = { readKind: "askmove", whyItMatters: "Up $1.99.", whatWouldMakeThisWrong: "Wrong if Y.", receipt: { from: "2026-10-10", to: "2026-10-11", askFrom: 333, askTo: 334.99, market: 320.44 }, sourceLine: "swsh12pt5-etb" };
out = more(ask); ok(out.includes("2026-10-10") && out.includes("$334.99") && out.includes("Wrong if Y."), "askmove");
const streak = { readKind: "streak", startDate: "2026-10-01", endDate: "2026-10-07", whyItMatters: "w", days: [{ date: "2026-10-01", price: 5 }, { date: "2026-10-02", price: 6 }] };
out = more(streak); ok(out.includes("2026-10-01") && out.includes("2026-10-07") && out.includes("$6.00"), "streak dates");
out = more({ readKind: "mover", path: "x" }); ok(out === "", "nothing invented when the file is empty");
ok(!more({ whyItMatters: "a" }).includes("What would make this wrong"), "no invented wrong line");
// chart ranges need two real points
const chart = grab("function catchemFilter(pts,range){", "function catchemDraw(");
const filt = new Function(chart + "return catchemFilter;")();
const pts = [{ d: "2026-01-01", v: 1 }, { d: "2026-10-11", v: 2 }];
ok(filt(pts, "30D").length < 2 && filt(pts, "All").length === 2, "sparse 30D has under two points");
ok(src.includes('catchemFilter(all, r).length<2) btn.hidden=true'), "buttons hide without two points");
// skip link and focus ring
ok(src.includes('<a class="skip-link" href="#main">Skip to content</a>'), "skip link");
ok(src.includes(":focus-visible{outline:3px"), "focus ring");
ok(!/<main class=/.test(src), "every main has the skip target");
// no links to routes that 404
for (const bad of ['href="/news"', 'href="/video"', 'href="/pokemon"', 'item("/news"', 'item("/pokemon"', 'item("/video"']) ok(!src.includes(bad), "no " + bad);
console.log("finish ok (" + n + " checks)");
