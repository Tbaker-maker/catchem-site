import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildFreshnessDoc, freshnessBadgeHtml, freshnessText, listingsAsOf } from "../src/freshness.mjs";
import { renderCard } from "../src/ui.mjs";
import worker from "../src/index.mjs";
import { resetJsonCache } from "../src/data.mjs";

const now = Date.parse("2026-11-06T16:00:00Z");
assert.equal(freshnessText("2026-11-06", now), "Updated Nov 6");
assert.equal(freshnessText("2026-11-05", now), "Updated Nov 5");
assert.equal(freshnessText("2026-11-04", now), "Prices updating");
assert.equal(freshnessText("", now), "");
const fresh = freshnessBadgeHtml("2026-11-06", now);
const old = freshnessBadgeHtml("2026-10-01", now);
assert.ok(fresh.includes("Updated Nov 6") && fresh.includes("fresh-badge") && fresh.includes("border-radius") === false);
assert.ok(old.includes("Prices updating") && old.includes("fresh-wait"));
assert.ok(!fresh.includes("36") && !old.includes("hour") && !/[\u2014\u2013]/.test(fresh + old));
assert.ok(!old.includes("2026-10-01") && !old.includes("Oct"));

const doc = buildFreshnessDoc({
  prices: "2026-11-06",
  listings: "2026-11-04",
  pulse: "2026-11-01",
  news: "2026-11-06T12:00:00Z",
}, now);
assert.deepEqual(Object.keys(doc), ["prices", "listings", "pulse", "news"]);
assert.equal(doc.prices.asOf, "2026-11-06");
assert.equal(doc.prices.late, false);
assert.equal(doc.listings.late, true);
assert.equal(doc.pulse.asOf, "2026-11-01");
assert.equal(doc.news.asOf, "2026-11-06");
assert.equal(JSON.stringify(doc).includes("36"), false);

assert.equal(listingsAsOf({ asOf: "2026-11-02", products: [] }), "2026-11-02");
assert.equal(listingsAsOf({ products: [{ listingsCounted: { date: "2026-10-01" } }, { listingsCounted: { date: "2026-11-03" } }] }), "2026-11-03");

const page = renderCard({
  id: "tcgcsv-1",
  name: "Pikachu",
  kind: "single",
  set: "Base",
  price: 12,
  asOf: "2026-10-01",
  source: "TCGplayer market",
}, "stamp", {});
assert.ok(page.includes("Prices updating"));
assert.ok(page.includes('class="fresh-badge fresh-wait"'));
assert.ok(!page.includes("/api/ops/freshness"));
assert.ok(!page.includes("36 hours"));
assert.ok(!/\bNM\b/.test(page));

const today = new Date().toISOString().slice(0, 10);
const sealed = renderCard({
  id: "tcgcsv-9",
  name: "Elite Trainer Box",
  kind: "sealed",
  set: "Base",
  price: 40,
  asOf: today,
  source: "TCGplayer market",
}, "stamp", {});
assert.ok(sealed.includes("Updated "));
assert.ok(sealed.includes('class="fresh-badge"'));
assert.ok(!sealed.includes("Prices updating"));
assert.ok(!/\bNM\b/.test(sealed));

const ladder = renderCard({
  id: "tcgcsv-2",
  name: "Pikachu",
  kind: "single",
  set: "Base",
  price: 12,
  asOf: "2026-10-01",
  printing: "Holofoil",
  source: "TCGplayer market",
}, "stamp", {
  conditionLadder: { asOf: "2026-10-01", printings: { Holofoil: { date: "2026-10-01", NM: 12 } } },
});
assert.ok(ladder.includes("Prices updating"));
assert.ok(!ladder.includes('class="cp-date"'));
assert.ok(ladder.includes(">NM<"));
assert.ok(/class="cp-src">TCGplayer market<span/.test(ladder));
assert.ok(!ladder.includes("/api/ops/freshness"));

const index = readFileSync(new URL("../src/index.mjs", import.meta.url), "utf8");
const ui = readFileSync(new URL("../src/ui.mjs", import.meta.url), "utf8");
assert.ok(index.includes('pathname === "/api/ops/freshness"'));
assert.ok(index.includes("x-robots-tag"));
assert.ok(!ui.includes("/api/ops/freshness"));
assert.ok(ui.includes("border-radius:999px") && ui.includes("fresh-badge"));
assert.ok(index.includes("Disallow: /api/ops/"));

const day = (offset) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
const files = {
  "counts.json": { asOf: day(0) },
  "listings-counted.json": { asOf: day(3), products: [{ listingsCounted: { date: day(3), n: 4 } }] },
  "sealed-market-pulse.json": { asOf: day(5) },
  "feed-news.json": { asOf: day(0), items: [] },
};
resetJsonCache();
const fetchImpl = async (url) => {
  const u = String(url);
  for (const name of Object.keys(files)) {
    if (u.endsWith(name)) return new Response(JSON.stringify(files[name]), { status: 200 });
  }
  return new Response("no", { status: 404 });
};
const ops = await worker.fetch(new Request("https://catchemtcg.com/api/ops/freshness"), { PUBLIC_FETCH: fetchImpl }, { waitUntil() {} });
assert.equal(ops.status, 200);
assert.equal(ops.headers.get("x-robots-tag"), "noindex");
assert.equal(ops.headers.get("cache-control"), "no-store");
const opsBody = await ops.json();
assert.equal(opsBody.prices.asOf, day(0));
assert.equal(opsBody.prices.late, false);
assert.equal(opsBody.listings.asOf, day(3));
assert.equal(opsBody.listings.late, true);
assert.equal(opsBody.pulse.asOf, day(5));
assert.equal(opsBody.news.asOf, day(0));
assert.equal(JSON.stringify(opsBody).includes("36"), false);
const robots = await worker.fetch(new Request("https://catchemtcg.com/robots.txt"), {
  PUBLIC_FETCH: fetchImpl,
  ASSETS: { fetch: async () => new Response("User-agent: *\nAllow: /\n", { status: 200, headers: { "content-type": "text/plain" } }) },
}, { waitUntil() {} });
const robotsText = await robots.text();
assert.ok(robotsText.includes("Disallow: /api/ops/"));
assert.ok(robotsText.includes("Disallow: /post-office"));

console.log("freshness badge ok");
