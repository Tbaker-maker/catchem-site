import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EDGE_TTL, cacheKeyUrl } from "../src/edge-cache.mjs";
import { setRawKv } from "../src/data.mjs";

assert.equal(EDGE_TTL, 1800);
assert.equal(cacheKeyUrl("https://catchemtcg.com/p/tcgcsv-1?seq=9&utm_source=x"), "https://catchemtcg.com/p/tcgcsv-1");
assert.equal(typeof setRawKv, "function");
setRawKv(null);

const index = readFileSync(new URL("../src/index.mjs", import.meta.url), "utf8");
assert.match(index, /promos\.json is ~660KB/);
assert.match(index, /product-html:v1:/);
assert.match(index, /setRawKv\(env\?\.FEED_KV\)/);
assert.doesNotMatch(index, /card \? loadJson\("promos\.json"/);

const data = readFileSync(new URL("../src/data.mjs", import.meta.url), "utf8");
assert.match(data, /rawpub:v1:/);
assert.match(data, /cacheEverything: true/);
console.log("product-cold ok");
