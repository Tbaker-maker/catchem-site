// Loads every Feed chip at 390 and 1280 against the published JSON.
// Fails if a chip that has reads in those files paints 0 cards, or the page throws.
// Does not invent reads. Run locally; CI does not start a browser.
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, normalize } from "node:path";
import { renderFeed, isVolumeRow, isShapeRow, isFactRow, newsSlice, readStaleAgainstCard } from "../src/ui.mjs";
import { feedNews } from "../data/feed-news.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("/workspace/node_modules/playwright");

const pub = process.env.CATCHEM_PUBLIC || "/tmp/cdata/research/assets/public";
const outDir = "/workspace/artifacts/feed-filters";
mkdirSync(outDir, { recursive: true });
const shots = [];

function load(rel) {
  return JSON.parse(readFileSync(join(pub, rel), "utf8"));
}

const browse = load("feed/browse.json");
const catalogue = load("feed/catalogue.json");
const setsDoc = load("sets.json");
const meta = load("feed/meta.json");
const readsDoc = load("reads.json");
const html = renderFeed({ reads: readsDoc.reads || [] }, "", "Updated");
const lead = JSON.parse(html.match(/id="feed-lead">([\s\S]*?)<\/script>/)[1]);
const newsRows = newsSlice(feedNews);

const bySlug = {};
const byName = {};
for (const tile of setsDoc.sets || []) {
  if (!tile || !tile.slug || !tile.name) continue;
  bySlug[tile.slug] = tile;
  if (!byName[tile.name]) byName[tile.name] = tile.slug;
}
function readSlug(row) {
  if (!row) return "";
  const slug = String(row.setSlug || "");
  if (slug && bySlug[slug]) return slug;
  const name = String(row.set || "").trim();
  if (name && byName[name]) return byName[name];
  return "";
}
const cards = catalogue.cards && typeof catalogue.cards === "object"
  ? (Array.isArray(catalogue.cards) ? catalogue.cards : Object.values(catalogue.cards))
  : [];
const rankAt = {};
(browse.ranked || []).forEach((id, i) => { if (typeof id === "string" && rankAt[id] == null) rankAt[id] = i; });
const setIndex = {};
{
  const seen = new Set();
  const add = (row) => {
    if (!row || !row.id) return;
    const id = String(row.id);
    if (seen.has(id)) return;
    const slug = readSlug(row);
    if (!slug) return;
    seen.add(id);
    (setIndex[slug] || (setIndex[slug] = [])).push(row);
  };
  cards.forEach(add);
  for (const block of Object.values(browse.filters || {})) for (const row of block.items || []) add(row);
  lead.forEach(add);
}
const sealedRows = [];
{
  const seen = new Set();
  const add = (row) => {
    if (!row || row.kind !== "sealed" || !row.id) return;
    const id = String(row.id);
    if (seen.has(id)) return;
    seen.add(id);
    sealedRows.push(row);
  };
  cards.forEach(add);
  for (const block of Object.values(browse.filters || {})) for (const row of block.items || []) add(row);
  lead.forEach(add);
}
function uniq(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    if (!row || !row.id || seen.has(String(row.id))) continue;
    seen.add(String(row.id));
    out.push(row);
  }
  return out;
}
function byRank(rows) {
  return rows.slice().sort((a, b) => {
    const aa = rankAt[a.id] == null ? 1e15 : rankAt[a.id];
    const bb = rankAt[b.id] == null ? 1e15 : rankAt[b.id];
    if (aa !== bb) return aa - bb;
    return String(a.id) < String(b.id) ? -1 : 1;
  });
}
const bucketCache = {};
function published(sku) {
  const n = Number((String(sku || "").match(/([0-9]+)/) || [])[1]);
  if (!n) return null;
  const bucket = String(n % 100).padStart(2, "0");
  if (!bucketCache[bucket]) bucketCache[bucket] = JSON.parse(readFileSync(join(pub, "buckets/" + bucket + ".json"), "utf8"));
  return bucketCache[bucket].find((row) => row && row.id === sku) || null;
}
function stale(row) {
  if (!row || !row.sku) return false;
  const priced = row.kind === "single" || row.kind === "sealed" || row.readKind === "price";
  if (!priced) return false;
  return readStaleAgainstCard(row, published(row.sku));
}
function shownTotal(rows, ok) {
  let skip = 0;
  for (const row of rows) {
    if (!ok(row) || stale(row)) skip += 1;
    else break;
  }
  return rows.length - skip;
}
const priceRows = (browse.ranked || []).map((id) => catalogue.cards[id]).filter(Boolean);
const priceOk = (row) => Number(row.price) > 0 && row.readKind !== "outlier" && row.kind !== "outlier" && row.readKind !== "dive" && row.kind !== "dive" && row.readKind !== "news" && row.readKind !== "wave";
function items(kind) {
  return browse.filters && browse.filters[kind] && browse.filters[kind].items || [];
}
const expectCount = {
  prices: uniq((browse.ranked || []).map((id) => (catalogue.cards && catalogue.cards[id]) || { id })).length,
  sealed: sealedRows.length,
  news: newsRows.length,
  pokemon: lead.filter((r) => isFactRow(r)).length,
  wave: items("wave").filter((item) => item && (item.title || item.sentence)).length,
  flagged: uniq(items("flagged").concat(lead.filter((r) => r && (r.readKind === "outlier" || r.kind === "outlier" || (r.flagged && r.flagged.on))))).length,
  dive: uniq(items("dive").concat(lead.filter((r) => r && (r.readKind === "dive" || r.kind === "dive")))).length,
  volume: uniq(items("volume").filter(isVolumeRow).concat(lead.filter(isVolumeRow))).length,
};
const shapeKinds = ["quiet", "mix", "conditions", "soldflat", "solddown", "setshare", "spread", "askmove", "mktmove", "still"];
for (const kind of shapeKinds) {
  expectCount[kind] = uniq(items(kind).filter(isShapeRow).concat(lead.filter((r) => isShapeRow(r) && (r.readKind === kind || r.kind === kind)))).length;
}
expectCount.pricesShown = shownTotal(priceRows, priceOk);
expectCount.sealedShown = shownTotal(byRank(sealedRows), (row) => row.kind === "sealed" && row.id);
for (const slug of Object.keys(setIndex)) {
  setIndex[slug] = byRank(setIndex[slug]);
  expectCount["set:" + slug] = shownTotal(setIndex[slug], () => true);
}
const oldName = /booster box|booster pack|booster bundle|elite trainer box|ultra[- ]premium|build & battle|premium collection/i;
const before = {
  sealedNameMatches: items("dive").filter((row) => oldName.test(String(row && row.name || ""))).length,
  sealedKind: cards.filter((row) => row && row.kind === "sealed").length,
  picker: (meta.sets || []).length,
  tiles: (setsDoc.sets || []).length,
  ranked: (browse.ranked || []).length,
};
const setTargets = [
  ["sv-prismatic-evolutions", "SV: Prismatic Evolutions"],
  ["sv-scarlet-and-violet-151", "SV: Scarlet & Violet 151"],
  ["sv10-destined-rivals", "SV10: Destined Rivals"],
  ["me-ascended-heroes", "ME: Ascended Heroes"],
  ["sv-black-bolt", "SV: Black Bolt"],
  ["celebrations", "Celebrations"],
];
const chips = [
  ["", "All"],
  ["prices", "Prices"],
  ["sealed", "Sealed"],
  ["set", "One set"],
  ["signals", "Signals"],
  ["news", "News"],
  ["pokemon", "Pokémon facts"],
  ["wave", "Waves & reprints"],
  ["flagged", "Flagged"],
  ["dive", "Dive"],
  ["volume", "Volume"],
  ["quiet", "No sales"],
  ["mix", "Condition mix"],
  ["conditions", "Condition prices"],
  ["soldflat", "Sold, price flat"],
  ["solddown", "Sold, price down"],
  ["setshare", "Set share"],
  ["spread", "Ask spread"],
  ["askmove", "Ask moved"],
  ["mktmove", "Market moved"],
  ["still", "Nothing moved"],
];

const fails = [];
function check(ok, msg) {
  if (!ok) fails.push(msg);
}

function serve() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      if (url.pathname === "/" || url.pathname === "/feed") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }
      if (url.pathname.startsWith("/data/")) {
        const rel = normalize(decodeURIComponent(url.pathname.slice("/data/".length))).replace(/^(\.\.(\/|\\|$))+/, "");
        if (rel.startsWith("..") || rel.includes("\0")) {
          res.writeHead(400); res.end(); return;
        }
        try {
          const body = readFileSync(join(pub, rel));
          res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
          res.end(body);
        } catch {
          res.writeHead(404); res.end();
        }
        return;
      }
      res.writeHead(404); res.end();
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function paint(page, label) {
  const file = join(outDir, label + ".png");
  await page.screenshot({ path: file });
  shots.push(file);
}

async function readState(page) {
  return page.evaluate(() => {
    const host = document.getElementById("feed-one");
    const pos = host && host.querySelector(".read-pos");
    const muted = host && host.querySelector("p.muted");
    const form = document.getElementById("feed-loop-form");
    const scroller = document.querySelector(".chip-scroller");
    const card = host && host.querySelector("article.feed-card");
    const m = pos && String(pos.textContent || "").match(/(\d+) of (\d+)/);
    return {
      cards: host ? host.querySelectorAll("article.feed-card").length : 0,
      total: m ? Number(m[2]) : 0,
      muted: muted ? muted.textContent : "",
      formW: form ? form.scrollWidth : 0,
      formC: form ? form.clientWidth : 0,
      scrollW: scroller ? scroller.scrollWidth : 0,
      scrollC: scroller ? scroller.clientWidth : 0,
      docW: document.documentElement.scrollWidth,
      inner: window.innerWidth,
      set: new URLSearchParams(location.search).get("set") || "",
      f: new URLSearchParams(location.search).get("f") || "",
      meta: card ? (card.querySelector(".card-meta") || {}).textContent || "" : "",
      title: card ? (card.querySelector("h3") || {}).textContent || "" : "",
      options: Array.from(document.querySelectorAll("#f-loop-set option")).filter((o) => o.value).map((o) => ({ value: o.value, text: o.textContent, logo: o.dataset.logo || "" })),
      hits: document.querySelectorAll("#set-hits button").length,
      hitImg: document.querySelectorAll("#set-hits img").length,
    };
  });
}

const server = await serve();
const port = server.address().port;
const browser = await chromium.launch({ headless: true });
const report = { before, expectCount, sets: {}, chips: {}, width: {} };
try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 800 } });
    const errors = [];
    page.on("pageerror", (err) => errors.push(String(err && err.message || err)));
    await page.goto(`http://127.0.0.1:${port}/feed`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#feed-one article.feed-card, #feed-one p.muted", { timeout: 20000 });
    const widthBox = await readState(page);
    report.width[width] = { formW: widthBox.formW, formC: widthBox.formC, scrollW: widthBox.scrollW, scrollC: widthBox.scrollC, docW: widthBox.docW };
    check(widthBox.formW < 1400, width + " form scrollWidth " + widthBox.formW);
    check(widthBox.docW <= width + 2, width + " page scrollWidth " + widthBox.docW);
    check(errors.length === 0, width + " page error on load: " + errors.join(" | "));
    const initial = await readState(page);
    report.chips.all = report.chips.all || {};
    report.chips.all[width] = { cards: initial.cards, total: initial.total, muted: initial.muted };
    check(initial.cards > 0, width + " All rendered 0");
    check(errors.length === 0, width + " page error on load: " + errors.join(" | "));
    await paint(page, "feed-" + width);
    for (const [value, label] of chips) {
      if (!value) continue;
      errors.length = 0;
      await page.locator(`#feed-loop-form .chip-row button[data-value="${value}"]`).click();
      await page.waitForFunction((value) => {
        const f = new URLSearchParams(location.search).get("f") || "";
        if (f !== value) return false;
        const host = document.getElementById("feed-one");
        return !!(host && (host.querySelector("article.feed-card") || host.querySelector("p.muted")));
      }, value);
      const state = await readState(page);
      const key = value || "all";
      report.chips[key] = report.chips[key] || {};
      report.chips[key][width] = { cards: state.cards, total: state.total, muted: state.muted };
      if (value === "set") {
        check(state.muted.includes("Choose a set to see its reads.") || state.cards > 0, width + " one set has no empty state");
        check(state.options.length === Object.keys(setIndex).length, width + " picker " + state.options.length + " vs " + Object.keys(setIndex).length);
        const dated = state.options.map((o) => bySlug[o.value]).filter((t) => t && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(t.release || ""));
        const newest = dated.map((t) => t.release).sort().at(-1);
        check(!newest || (bySlug[state.options[0].value] || {}).release === newest, width + " picker is not newest first");
        check(state.hits > 0, width + " set list is hidden");
        check(state.formW < 1400, width + " form still wide after picker " + state.formW);
      } else if ((expectCount[value] || 0) > 0) {
        const shown = value === "prices" ? expectCount.pricesShown : value === "sealed" ? expectCount.sealedShown : expectCount[value];
        check(state.cards > 0, width + " " + label + " rendered 0");
        check(state.total === shown, width + " " + label + " shows " + state.total + " of " + shown);
      } else {
        check(state.cards === 0 && state.muted.length > 0, width + " " + label + " empty state missing");
      }
      check(errors.length === 0, width + " " + label + " page error: " + errors.join(" | "));
    }
    await page.locator("#feed-loop-form .chip-row button[data-value='sealed']").click();
    await page.waitForFunction(() => new URLSearchParams(location.search).get("f") === "sealed" && !!document.querySelector("#feed-one article.feed-card"));
    await paint(page, "sealed-" + width);
    await page.goto(`http://127.0.0.1:${port}/feed?f=set`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#set-hits button");
    await paint(page, "picker-" + width);
    await page.locator("#set-q").fill("Prismatic");
    await page.locator("#set-hits button", { hasText: "Prismatic Evolutions" }).click();
    await page.waitForFunction(() => new URLSearchParams(location.search).get("set") === "sv-prismatic-evolutions" && !!document.querySelector("#feed-one article.feed-card"));
    const picked = await readState(page);
    check(picked.set === "sv-prismatic-evolutions", width + " picker set param " + picked.set);
    check(picked.f === "set", width + " picker f param " + picked.f);
    check(picked.cards > 0, width + " picker selection rendered 0");
    await page.goto(`http://127.0.0.1:${port}/feed?f=set&set=` + encodeURIComponent("SV: Prismatic Evolutions"), { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => new URLSearchParams(location.search).get("set") === "sv-prismatic-evolutions" && !!document.querySelector("#feed-one article.feed-card"));
    const legacy = await readState(page);
    check(legacy.set === "sv-prismatic-evolutions", width + " name url stayed " + legacy.set);
    for (const [slug, name] of setTargets) {
      errors.length = 0;
      await page.goto(`http://127.0.0.1:${port}/feed?f=set&set=` + encodeURIComponent(slug), { waitUntil: "domcontentloaded" });
      await page.waitForFunction((slug) => {
        const q = new URLSearchParams(location.search);
        const host = document.getElementById("feed-one");
        return q.get("f") === "set" && q.get("set") === slug && !!(host && (host.querySelector("article.feed-card") || host.querySelector("p.muted")));
      }, slug);
      const state = await readState(page);
      const n = (setIndex[slug] || []).length;
      const shown = expectCount["set:" + slug];
      report.sets[slug] = report.sets[slug] || { name, file: n, shown };
      report.sets[slug][width] = { cards: state.cards, total: state.total, set: state.set, meta: state.meta };
      check(n > 0, slug + " has no reads in the files");
      check(state.cards > 0, width + " " + slug + " rendered 0");
      check(state.total === shown, width + " " + slug + " shows " + state.total + " of " + shown);
      check(state.set === slug, width + " " + slug + " url set=" + state.set);
      check(state.meta.includes(name) || state.title.includes(name), width + " " + slug + " card does not name the set: " + state.meta);
      check(errors.length === 0, width + " " + slug + " page error: " + errors.join(" | "));
    }
    await paint(page, "celebrations-" + width);
    await page.goto(`http://127.0.0.1:${port}/feed?f=set&set=sv-prismatic-evolutions`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("article.feed-card");
    await paint(page, "prismatic-" + width);
    await page.goto(`http://127.0.0.1:${port}/feed?f=prices`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("article.feed-card");
    await paint(page, "prices-" + width);
    await page.goto(`http://127.0.0.1:${port}/feed?f=news`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("article.feed-card");
    await paint(page, "news-" + width);
    await page.goto(`http://127.0.0.1:${port}/feed?f=spread`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#feed-one article.feed-card, #feed-one p.muted");
    await paint(page, "spread-" + width);
    await page.goto(`http://127.0.0.1:${port}/feed?f=wave`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#feed-one p.muted");
    await paint(page, "wave-empty-" + width);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

report.picker = Object.keys(setIndex).length;
report.shots = shots;
writeFileSync(join(outDir, "counts.json"), JSON.stringify(report, null, 2));
if (fails.length) {
  console.error(fails.join("\n"));
  process.exit(1);
}
console.log("feed filters ok");
console.log(JSON.stringify({ before, picker: report.picker, expectCount, sets: Object.fromEntries(setTargets.map(([slug]) => [slug, (setIndex[slug] || []).length])) }, null, 2));
