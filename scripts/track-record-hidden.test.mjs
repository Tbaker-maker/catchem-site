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
  t(`${label}: 404`, status === 404);
  t(`${label}: no score text`, !body.includes("scored so far") && !body.includes("Track record"));
}
const pub = await get({ public: true, count: 1, types, rows: [] });
t("public true: page renders", pub.status === 200 && pub.body.includes("scored so far"));
if (fails) { console.log(`track-record-hidden: ${fails} failed`); process.exit(1); }
console.log("track-record-hidden ok");
