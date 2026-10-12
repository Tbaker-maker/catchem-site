import { readFileSync } from "node:fs";
import { renderPath, quickFor } from "../src/index.mjs";
import worker from "../src/index.mjs";
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

const card = { id: "tcgcsv-10", name: "Alakazam", set: "Base Set", setSlug: "base", kind: "single", price: 12.5, num: "1", source: "TCGplayer market", asOf: "2026-09-27" };
const privateDoc = {
  public: false,
  count: 3,
  scored14: 2,
  cardLines: { "tcgcsv-10": "TRACKLINE-PRIVATE-8841 scored so far" },
  rows: [{ productId: "tcgcsv-10", direction: "down", price: 8841.25, shipped: "2026-01-15", name: "Secret Track Name" }],
  types: [{ type: "price", reads: 3, line14: "2 scored so far" }],
};
const publicDoc = { ...privateDoc, public: true };
const fetchProduct = (doc) => async (url) => {
  const s = String(url);
  if (s.includes("track-record.json")) return { ok: true, status: 200, json: async () => doc, text: async () => JSON.stringify(doc) };
  if (s.includes("buckets/10.json")) return { ok: true, status: 200, json: async () => [card], text: async () => JSON.stringify([card]) };
  return { ok: false, status: 404, json: async () => null, text: async () => "" };
};
const banned = ["TRACKLINE-PRIVATE-8841", "8841.25", "Secret Track Name", "scored so far", 'href="/track-record"', "This line would be wrong"];
const quietPaths = ["/c/tcgcsv-10", "/premium", "/search", "/rotation", "/methodology"];
resetJsonCache();
const quiet = [];
for (const path of quietPaths) {
  const res = await renderPath(path, fetchProduct(privateDoc), {});
  quiet.push(await res.text());
}
const sheet = await quickFor("tcgcsv-10", fetchProduct(privateDoc), {});
quiet.push(JSON.stringify(sheet || {}));
const home = await worker.fetch(new Request("https://catchemtcg.com/"), {
  FEED_ENABLED: "true",
  PUBLIC_FETCH: fetchProduct(privateDoc),
  ASSETS: { fetch: async () => new Response("<main id=\"top\"><h1>Home</h1></main>", { headers: { "content-type": "text/html" } }) },
});
quiet.push(await home.text());
const joined = quiet.join("\n");
t("public false: no track-record numbers or links", banned.every((bit) => !joined.includes(bit)));
resetJsonCache();
const shown = await (await renderPath("/c/tcgcsv-10", fetchProduct(publicDoc), {})).text();
t("public true: the product can show the logged line", shown.includes("TRACKLINE-PRIVATE-8841") && shown.includes("above $8841.25") && shown.includes("This line would be wrong"));
const ui = readFileSync(new URL("../src/ui.mjs", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
t("the shell has no track-record link", !ui.includes('href="/track-record"') && !indexHtml.includes("/track-record"));
if (fails) { console.log(`track-record-hidden: ${fails} failed`); process.exit(1); }
console.log("track-record-hidden ok");
