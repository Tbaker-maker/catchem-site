import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EDGE_TTL, cacheKeyUrl, PANEL_CACHE_GEN } from "../src/edge-cache.mjs";
import { REPO_FETCH_GEN, repoUrl } from "../src/data.mjs";
import { setRawKv, listBucketIds, extractRow, extractAllRows, setDataVersion, currentDataVersion, publicDataVersion } from "../src/data.mjs";

assert.equal(EDGE_TTL, 86400);
assert.equal(cacheKeyUrl("https://catchemtcg.com/p/tcgcsv-1?prewarm=1"), "https://catchemtcg.com/p/tcgcsv-1");
assert.equal(typeof setRawKv, "function");
setRawKv(null);

const sample = '{"id":"tcgcsv-1","name":"A","kind":"sealed","price":1},{"id":"tcgcsv-2","name":"B","x":1}';
assert.deepEqual(listBucketIds(sample).sort(), ["tcgcsv-1", "tcgcsv-2"]);
assert.equal(extractRow(sample, "tcgcsv-2").name, "B");
const all = extractAllRows(sample);
assert.equal(all.length, 2);
assert.equal(all[0].id, "tcgcsv-1");
assert.equal(all[1].kind, undefined);
assert.equal(all[1].x, 1);

const index = readFileSync(new URL("../src/index.mjs", import.meta.url), "utf8");
assert.match(index, /prewarm=1/);
assert.match(index, /x-prewarm/);
assert.match(index, /prewarmHtml/);
assert.match(index, /prewarm=html/);
assert.match(index, /html-skip/);
assert.match(index, /PRODUCT_HTML_TTL = 86400/);
assert.match(index, /product-html:v4/);
assert.match(index, /publicDataVersion/);
assert.match(index, /signal-chips\.json ~422KB/);
setDataVersion("2026-10-28");
assert.equal(currentDataVersion(), "2026-10-28");
assert.match(index, /seeds prodrow KV and returns immediately/);
assert.match(index, /warmBucket/);
assert.match(index, /cardImagesSealed/);

const data = readFileSync(new URL("../src/data.mjs", import.meta.url), "utf8");
assert.match(data, /prodrow:v3:/);
assert.match(data, /rawpub:v3:/);
assert.match(data, /publicDataVersion/);
assert.match(data, /warmBucket/);
assert.match(data, /prodrow-bucket:v3:/);
assert.match(data, /extractAllRows/);
assert.match(data, /i \+= 5/);
assert.doesNotMatch(data, /seededBuckets/);
console.log("product-cold ok");

assert.equal(PANEL_CACHE_GEN, "2");
assert.match(repoUrl("public-data", "research/assets/public/counts.json"), /[?&]r=2$/);
assert.equal(REPO_FETCH_GEN, "2");
