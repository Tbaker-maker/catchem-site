import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeStripIndex } from "./build-strip-index.mjs";
import { shardOf, setStripAssets, stripSlugFor, stripPageFor, resetStripIndex } from "../src/strip-index.mjs";

assert.equal(shardOf("tcgcsv-1"), shardOf("tcgcsv-1"));
const dir = mkdtempSync(join(tmpdir(), "strip-"));
writeStripIndex(dir, { cards: { "tcgcsv-1": "pikachu" }, pages: { pikachu: ["Pikachu", ["tcgcsv-1", "tcgcsv-2"]] } });
setStripAssets({ async fetch(req) {
  const p = new URL(req.url).pathname;
  try { return new Response(readFileSync(join(dir, p))); } catch { return new Response("", { status: 404 }); }
} });
assert.equal(await stripSlugFor("tcgcsv-1"), "pikachu");
assert.equal(await stripSlugFor("tcgcsv-9"), "");
assert.deepEqual(await stripPageFor("pikachu"), { name: "Pikachu", slug: "pikachu", ids: ["tcgcsv-1", "tcgcsv-2"], strip: null });
resetStripIndex(); setStripAssets(null);
assert.equal(await stripPageFor("pikachu"), null);
console.log("strip-index ok");

// Strip quotes are built at build time; facts win, sealed rows drop.
{
  const { quotesFrom, buildStripIndex } = await import("./build-strip-index.mjs");
  const q = quotesFrom([[{ id: "tcgcsv-1", price: 5, asOf: "2026-10-15" }, { id: "tcgcsv-3", kind: "sealed", price: 90, asOf: "2026-10-15" }]], { "tcgcsv-1": { price: 6, asOf: "2026-10-16" }, "tcgcsv-3": { price: 1, asOf: "2026-10-16" } });
  assert.deepEqual(q, { "tcgcsv-1": { price: 6, date: "2026-10-16" } });
  void buildStripIndex;
  // The card page never fetches buckets for the strip.
  const src = (await import("node:fs")).readFileSync(new URL("../src/index.mjs", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("async function pokemonStripFor"), src.indexOf("export async function quickFor"));
  assert.ok(!fn.includes("nightlyQuotes") && !fn.includes("buckets/"));
  console.log("strip quotes ok");
}
