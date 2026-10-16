// Singles index on /indexes: our days are solid. An earlier series on the file is the soft line.
import { singlesIndexChart, indexListBody } from "../src/indexes.mjs";
import { pageKind, renderPath } from "../src/index.mjs";
import { resetJsonCache } from "../src/data.mjs";

let fail = 0;
const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail++; console.log("  FAIL", name); } };

const own = [
  { d: "2026-09-26", v: 100, n: 10 },
  { d: "2026-10-13", v: 99.4, n: 12 },
];
const plain = singlesIndexChart({ asOf: "2026-10-13", source: "TCGplayer market, daily", singles: own });
t("own days are a solid line", plain.includes('id="singles-index"') && plain.includes('stroke-width="2.5"') && !plain.includes("stroke-opacity") && plain.includes("Sep 26, 2026") && plain.includes("Oct 13, 2026") && plain.includes("our own days"));
t("a short series stays off", singlesIndexChart({ singles: [{ d: "2026-10-13", v: 100 }] }) === "");

const filled = singlesIndexChart({
  asOf: "2026-10-13",
  source: "TCGplayer market, daily",
  singles: own,
  singlesFill: { source: "public fan-site data", points: [{ d: "2025-10-13", v: 80 }, { d: "2026-09-20", v: 97 }, { d: "2026-10-01", v: 250 }] },
});
const axis = filled.slice(filled.indexOf("ix-axis"));
t("earlier series is the soft line and stops before our first day", filled.includes('stroke-opacity="0.35"') && filled.includes("public fan-site data") && axis.includes("Oct 13, 2025") && axis.includes("Oct 13, 2026") && !filled.includes(">250<"));
t("a fill point on our days is not the start of the chart", filled.includes("Oct 13, 2025") && filled.includes("The solid line is our own days"));
t("no em dash and no No data", !/[\u2014\u2013]/.test(plain + filled) && !/No data/i.test(plain + filled));

const list = { asOf: "2026-10-13", indexes: [] };
t("empty rarity list still shows the singles index", indexListBody(list, { asOf: "2026-10-13", source: "TCGplayer market, daily", singles: own }).includes("Singles index"));
t("nothing on file keeps the rebuilt line", indexListBody({ indexes: [] }).includes("being rebuilt") && !indexListBody({ indexes: [] }).includes("singles-index"));

const files = {
  "counts.json": { asOf: "2026-10-13", updatedAt: "2026-10-13T12:00:00Z" },
  "feed/status.json": { images: { tcgplayer: true } },
  "feed/rating/index-list.json": { asOf: "2026-10-13", indexes: [{ key: "k", name: "Illustration Rare, Scarlet & Violet", kind: "all", era: "Scarlet & Violet", last: ["2026-10-13", 1000, 12.5, 8] }] },
  "indexes.json": { asOf: "2026-10-13", source: "TCGplayer market, daily", singles: own },
};
const fetchImpl = async (url) => {
  const rel = String(url).split("/research/assets/public/")[1];
  if (rel && files[rel]) return new Response(JSON.stringify(files[rel]));
  return new Response("no", { status: 404 });
};
resetJsonCache();
const res = await renderPath("/indexes", fetchImpl);
const html = await res.text();
t("route kind and chart", pageKind("/indexes") === "indexes" && res.status === 200 && html.includes('id="singles-index"') && html.includes("Illustration Rare") && !html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").includes("stroke-opacity"));

if (fail) { console.log(`indexes-fill: ${fail} failed`); process.exit(1); }
console.log("indexes-fill ok");
