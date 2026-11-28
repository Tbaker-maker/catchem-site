import { pageKind, renderPath } from "../src/index.mjs";
import entry from "../src/site-entry.mjs";
import { resetJsonCache } from "../src/data.mjs";
import { catalogRows, renderExplore, PAGE_SIZE } from "../src/explorer.mjs";

let fail = 0;
let pass = 0;
const t = (name, cond) => {
  console.log(`${cond ? "  ok " : "  FAIL"} ${name}`);
  if (cond) pass++;
  else fail++;
};

const rows = [
  { kind: "set", name: "Base Set", source: "TCGplayer market", date: "1999-01-09", detail: "Original" },
  { kind: "single", name: "Pikachu", source: "TCGplayer market", date: "2026-10-13" },
  { kind: "single", name: "Kadabra", source: "TCGplayer market", date: "2026-10-02" },
  { kind: "single", name: "Abra", source: "TCGplayer market", date: "2026-10-03" },
  { kind: "sealed", name: "NM 151 Elite Trainer Box Near Mint", source: "TCGplayer market", date: "2026-10-23", listingsCounted: 119 },
  { kind: "sealed", name: "Booster Box", source: "TCGplayer market", date: "2026-10-01" },
  { kind: "single", name: "No Date Card", source: "TCGplayer market" },
  { kind: "single", name: "No Source Card", date: "2026-10-02" },
  { kind: "sealed", name: "LP Hidden Tin", source: "TCGplayer market", date: "2026-09-01", listingsCounted: { n: 4 } },
];

function articles(html) {
  return [...html.matchAll(/<article class="ex-row"[\s\S]*?<\/article>/g)].map((m) => m[0]);
}

const all = renderExplore(rows, {});
const found = articles(all);
t("a row missing a date or source is omitted", !all.includes("No Date Card") && !all.includes("No Source Card") && found.length === 7);
t("every rendered row includes its source and date", found.every((row) => row.includes("Source: TCGplayer market") && /Date: \d{4}-\d{2}-\d{2}/.test(row) && row.includes("data-source=") && row.includes("data-date=")));

const searched = renderExplore(rows, { q: "pika" });
t("search narrows rows", searched.includes("Pikachu") && !searched.includes("Kadabra") && !searched.includes("Abra") && !searched.includes("Base Set") && !searched.includes("Booster Box"));

const sealed = renderExplore(rows, { kind: "sealed" });
const sealedRows = articles(sealed);
t("filter kind=sealed drops singles", sealed.includes("151 Elite Trainer Box") && sealed.includes("Booster Box") && !sealed.includes("Pikachu") && !sealed.includes("Abra") && !sealed.includes(">Base Set<") && sealedRows.every((row) => row.includes('data-kind="sealed"')));
const counted = sealedRows.find((row) => row.includes("151 Elite Trainer Box"));
const plain = sealedRows.find((row) => row.includes("Booster Box") && !row.includes("151"));
t("a sealed row with listings counted shows that number and the words listings counted", !!counted && counted.includes("119 listings counted"));
t("a sealed row missing listings counted omits it", !!plain && !plain.includes("listings counted"));
t("a sealed row never contains NM or Near Mint", sealedRows.every((row) => !row.includes("NM") && !/Near Mint/i.test(row)) && !sealed.includes("LP Hidden") && sealed.includes("Hidden Tin"));

const named = renderExplore(rows, { sort: "name" });
const order = [...named.matchAll(/<h2>(?:<a [^>]*>)?([^<]+)/g)].map((m) => m[1]);
t("sort by name", order.join("|") === "151 Elite Trainer Box|Abra|Base Set|Booster Box|Hidden Tin|Kadabra|Pikachu");

const many = Array.from({ length: PAGE_SIZE + 1 }, (_, i) => ({
  kind: "single",
  name: `Card ${String(i + 1).padStart(2, "0")}`,
  source: "TCGplayer market",
  date: "2026-10-01",
}));
const first = renderExplore(many, { sort: "name" });
const second = renderExplore(many, { sort: "name", page: 2 });
t("page size is 25", articles(first).length === PAGE_SIZE && !first.includes("Card 26") && first.includes(">Next</a>") && articles(second).length === 1 && second.includes("Card 26"));
t("copy stays plain", !/[\u2014\u2013]/.test(all) && !/\bsold\b/i.test(all) && !/Collectr/i.test(all) && all.includes("min-height:44px"));

const built = catalogRows({
  sets: {
    source: "TCGplayer market",
    sets: [
      { slug: "base-set", name: "Base Set", era: "Original", release: "1999-01-09" },
      { slug: "undated", name: "No Release", era: "Original" },
    ],
  },
  products: [
    { id: "tcgcsv-1", kind: "sealed", name: "Unbroken Bonds Booster Box", set: "Unbroken Bonds", source: "TCGplayer market", date: "2026-11-27" },
    { id: "tcgcsv-2", kind: "single", name: "Pikachu", source: "", date: "2026-11-27" },
  ],
  listings: {
    products: [{ id: "sm10-booster-box", name: "Unbroken Bonds Booster Box", listingsCounted: { n: 6, date: "2026-11-27" } }],
  },
});
t("catalog rows keep a dated set and a sealed count, and drop a row with no source", built.some((row) => row.kind === "set" && row.name === "Base Set" && row.date === "1999-01-09") && !built.some((row) => row.name === "No Release") && !built.some((row) => row.name === "Pikachu") && built.some((row) => row.listingsCounted === 6));

t("explore is a page", pageKind("/explore") === "explore" && pageKind("/explore/") === "explore");

resetJsonCache();
const files = {
  "counts.json": { asOf: "2026-11-01", source: "TCGplayer market", updatedAt: "2026-11-01T00:00:00Z" },
  "sets.json": { asOf: "2026-11-01", source: "TCGplayer market", sets: [{ slug: "base-set", name: "Base Set", era: "Original", release: "1999-01-09" }] },
  "feed/status.json": { images: { tcgplayer: true } },
};
const fetchImpl = async (url) => {
  const rel = (String(url).split("/public/")[1] || "").split("?")[0];
  if (files[rel]) return { ok: true, status: 200, json: async () => files[rel], text: async () => JSON.stringify(files[rel]) };
  return { ok: false, status: 404, json: async () => null, text: async () => "" };
};
const live = await (await renderPath("/explore", fetchImpl, {})).text();
t("the route draws the set with its source and date", live.includes("Base Set") && live.includes("TCGplayer market") && live.includes('data-date="1999-01-09"') && live.includes('action="/explore"') && !live.includes("No Release"));
resetJsonCache();

const env = {
  PUBLIC_FETCH: fetchImpl,
  ASSETS: { fetch: async () => new Response("no", { status: 404, headers: { "content-type": "text/plain" } }) },
};
const ctx = { waitUntil() {} };
const workerRes = await entry.fetch(new Request("https://catchemtcg.com/explore"), env, ctx);
const workerHtml = await workerRes.text();
t("default worker HTML for /explore contains the explorer heading", workerRes.status === 200 && workerHtml.includes("<h1>Explore</h1>") && !workerHtml.includes("<h1>Wander"));
const flagged = await entry.fetch(new Request("https://catchemtcg.com/explore"), { ...env, TF_EXPLORE: "on" }, ctx);
const flaggedHtml = await flagged.text();
t("TF_EXPLORE on still serves the wander page", flagged.status === 200 && flaggedHtml.includes("<h1>Wander.</h1>") && !flaggedHtml.includes("<h1>Explore</h1>"));
resetJsonCache();

if (fail) {
  console.log(`explorer: ${pass} passed, ${fail} failed`);
  process.exit(1);
}
console.log(`explorer: ${pass} passed, ${fail} failed`);
