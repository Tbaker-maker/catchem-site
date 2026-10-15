import assert from "node:assert/strict";
import { loadJson, resetJsonCache, setCacheClock, MEM_TTL_MS } from "../src/data.mjs";

let t = 1000; setCacheClock(() => t); resetJsonCache();
let calls = 0, fail = false;
const f = async () => { calls++; if (fail) return { ok: false, status: 500 }; return { ok: true, json: async () => ({ v: calls }) }; };
assert.deepEqual(await loadJson("x.json", f), { v: 1 });
t += MEM_TTL_MS - 1; assert.deepEqual(await loadJson("x.json", f), { v: 1 }); assert.equal(calls, 1);
t += 2; assert.deepEqual(await loadJson("x.json", f), { v: 2 }, "expired entry refetches");
t += MEM_TTL_MS + 1; fail = true;
assert.deepEqual(await loadJson("x.json", f), { v: 2 }, "failed refetch keeps old copy");
assert.equal(calls, 4);
await assert.rejects(loadJson("y.json", f));
setCacheClock(); resetJsonCache();
console.log("data-cache ok");
