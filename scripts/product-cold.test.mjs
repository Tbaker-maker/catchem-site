import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EDGE_TTL, cacheKeyUrl } from "../src/edge-cache.mjs";
import { setRawKv, listBucketIds, extractRow } from "../src/data.mjs";

assert.equal(EDGE_TTL, 1800);
assert.equal(cacheKeyUrl("https://catchemtcg.com/p/tcgcsv-1?prewarm=1"), "https://catchemtcg.com/p/tcgcsv-1");
assert.equal(typeof setRawKv, "function");
setRawKv(null);

const sample = '{"id":"tcgcsv-1","name":"A","kind":"sealed","price":1},{"id":"tcgcsv-2","name":"B","x":1}';
assert.deepEqual(listBucketIds(sample).sort(), ["tcgcsv-1", "tcgcsv-2"]);
assert.equal(extractRow(sample, "tcgcsv-2").name, "B");

const index = readFileSync(new URL("../src/index.mjs", import.meta.url), "utf8");
assert.match(index, /prewarm=1/);
assert.match(index, /x-prewarm/);
assert.match(index, /seeds prodrow KV and returns immediately/);
assert.match(index, /warmBucket/);
assert.match(index, /cardImagesSealed/);
assert.match(index, /signal-chips\.json is ~400KB/);

const data = readFileSync(new URL("../src/data.mjs", import.meta.url), "utf8");
assert.match(data, /prodrow:v1:/);
assert.match(data, /warmBucket/);
assert.match(data, /prodrow-bucket:v1:/);
assert.match(data, /i \+= 5/);
assert.doesNotMatch(data, /seededBuckets/);
console.log("product-cold ok");
