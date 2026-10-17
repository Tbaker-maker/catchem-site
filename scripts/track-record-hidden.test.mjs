import { renderPath } from "../src/index.mjs";
import { resetJsonCache } from "../src/data.mjs";
let fails = 0;
const t = (name, ok) => { console.log(`${ok ? "ok" : "FAIL"}: ${name}`); if (!ok) fails++; };
const fetchFor = (doc) => async (url) => doc && String(url).includes("track-record.json")
  ? { ok: true, status: 200, json: async () => doc, text: async () => JSON.stringify(doc) }
  : { ok: false, status: 404, json: async () => null, text: async () => "" };
const types = [{ type: "price", reads: 1, tooEarly: 1, noLaterPrice: 0, scored14: 0, scored28: 0, scored56: 0 }];
const get = async (doc) => { resetJsonCache(); const res = await renderPath("/track-record", fetchFor(doc), {}); return { status: res.status, body: await res.text() }; };
for (const [label, doc] of [["public false", { public: false, count: 0, scoreMin: 20, types: [], rows: [] }], ["no public field", { count: 5, types, rows: [] }], ["missing file", null]]) {
  const { status, body } = await get(doc);
  t(`${label}: 200`, status === 200);
  t(`${label}: no score text`, body.includes("<h1>Track record</h1>") && body.includes("More history added nightly") && !body.includes("scored so far") && !body.includes("14 days"));
}
const pub = await get({ public: true, asOf: "2026-10-17", thin: true, disclaimer: "Past moves don't predict future prices.", summary: "Of 9 reads in 90 days, 2 moved the way the read described.", windows: { d90: { reads: 9, moved: 2, line: "Of 9 reads in 90 days, 2 moved the way the read described." } }, rows: [{ date: "2026-10-01", name: "Example Box", said: "Recorded at $10.00.", priceThen: 10, priceNow: 11, source: "eBay asking prices", priceDate: "2026-10-02", kind: "sealed", moved: true }] });
t("public true: page renders", pub.status === 200 && pub.body.includes("Of 9 reads in 90 days, 2 moved the way the read described.") && pub.body.includes("Past moves don") && pub.body.includes("More history added nightly"));
t("public page hides the scoring method", !pub.body.includes("scored so far") && !pub.body.includes("14 days") && !pub.body.includes("too early"));
if (fails) { console.log(`track-record-hidden: ${fails} failed`); process.exit(1); }
console.log("track-record-hidden ok");
