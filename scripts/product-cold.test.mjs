import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EDGE_TTL, cacheKeyUrl } from "../src/edge-cache.mjs";
import { setRawKv, listBucketIds, extractRow } from "../src/data.mjs";

assert.equal(EDGE_TTL, 1800);
assert.equal(cacheKeyUrl("https://catchemtcg.com/p/tcgcsv-1?seq=9"), "https://catchemtcg.com/p/tcgcsv-1");
assert.equal(typeof setRawKv, "function");
setRawKv(null);

const sample = '{"id":"tcgcsv-1","name":"A","kind":"sealed","price":1},{"id":"tcgcsv-2","name":"B","x":1}';
assert.deepEqual(listBucketIds(sample).sort(), ["tcgcsv-1", "tcgcsv-2"]);
assert.equal(extractRow(sample, "tcgcsv-2").name, "B");

const index = readFileSync(new URL("../src/index.mjs", import.meta.url), "utf8");
assert.match(index, /promos\.json is ~660KB/);
assert.match(index, /product-html:v1:/);
assert.match(index, /prewarm-buckets/);
assert.match(index, /cardImagesSealed/);
assert.match(index, /signal-chips\.json is ~400KB/);
assert.match(index, /seedProdRowsFromBucket/);

const data = readFileSync(new URL("../src/data.mjs", import.meta.url), "utf8");
assert.match(data, /seedProdRowsFromBucket/);
assert.match(data, /prodrow:v1:/);
assert.match(data, /listBucketIds/);
assert.match(data, /seededBuckets/);
console.log("product-cold ok");
