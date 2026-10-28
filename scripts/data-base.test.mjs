// public-data is tried first. A miss locks the session to main.
// A hit keeps public-data, and a later missing file falls back for that file only.
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { dataBase, fetchRepo, mainOnlyPath, resetDataBase, resetJsonCache } from "../src/data.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

function harness(ok) {
  const calls = [];
  const fetchImpl = async (url) => {
    const s = String(url);
    calls.push(s);
    const branch = s.includes("/public-data/") ? "public-data" : "main";
    const path = s.split("/" + branch + "/")[1] || "";
    if (ok.has(branch + ":" + path)) {
      return { ok: true, status: 200, json: async () => ({}), text: async () => "" };
    }
    return { ok: false, status: 404, json: async () => null, text: async () => "" };
  };
  return { calls, fetchImpl };
}

resetDataBase();
{
  const { calls, fetchImpl } = harness(new Set([
    "main:research/assets/public/a.json",
    "main:research/assets/public/b.json",
  ]));
  const a = await fetchRepo("research/assets/public/a.json", fetchImpl);
  const b = await fetchRepo("research/assets/public/b.json", fetchImpl);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(calls.length, 3);
  assert.match(calls[0], /\/public-data\/research\/assets\/public\/a\.json$/);
  assert.match(calls[1], /\/main\/research\/assets\/public\/a\.json$/);
  assert.match(calls[2], /\/main\/research\/assets\/public\/b\.json$/);
  assert.equal(dataBase(), "main");
}

resetDataBase();
{
  const { calls, fetchImpl } = harness(new Set([
    "public-data:research/assets/public/ok.json",
    "main:data/card-catalogue.json",
    "public-data:research/assets/public/next.json",
  ]));
  await fetchRepo("research/assets/public/ok.json", fetchImpl);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /\/public-data\/research\/assets\/public\/ok\.json$/);
  calls.length = 0;
  const cat = await fetchRepo("data/card-catalogue.json", fetchImpl);
  assert.equal(cat.ok, true);
  assert.equal(calls.length, 2);
  assert.match(calls[0], /\/public-data\/data\/card-catalogue\.json$/);
  assert.match(calls[1], /\/main\/data\/card-catalogue\.json$/);
  calls.length = 0;
  const next = await fetchRepo("research/assets/public/next.json", fetchImpl);
  assert.equal(next.ok, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /\/public-data\/research\/assets\/public\/next\.json$/);
}


resetDataBase();
{
  const { calls, fetchImpl } = harness(new Set([
    "main:research/pulse/dive/swsh7-booster-box.json",
    "main:data/derived/rip-roi.json",
  ]));
  assert.equal(mainOnlyPath("research/pulse/dive/x.json"), true);
  assert.equal(mainOnlyPath("data/derived/rip-roi.json"), true);
  assert.equal(mainOnlyPath("research/assets/public/a.json"), false);
  const dive = await fetchRepo("research/pulse/dive/swsh7-booster-box.json", fetchImpl);
  assert.equal(dive.ok, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /\/main\/research\/pulse\/dive\/swsh7-booster-box\.json$/);
  calls.length = 0;
  const rip = await fetchRepo("data/derived/rip-roi.json", fetchImpl);
  assert.equal(rip.ok, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /\/main\/data\/derived\/rip-roi\.json$/);
}

resetJsonCache();
assert.equal(dataBase(), "");

async function walk(dir, out = []) {
  for (const name of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, name.name);
    if (name.isDirectory()) await walk(path, out);
    else if (/\.(mjs|js)$/.test(name.name)) out.push(path);
  }
  return out;
}
const hits = [];
for (const path of await walk(root)) {
  if (path.endsWith("/data.mjs")) continue;
  const body = await readFile(path, "utf8");
  if (body.includes("Catchem-data/main")) hits.push(path);
}
assert.deepEqual(hits, []);

resetDataBase();
console.log("data-base ok");
