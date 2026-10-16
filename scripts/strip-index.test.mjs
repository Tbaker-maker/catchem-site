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
assert.deepEqual(await stripPageFor("pikachu"), { name: "Pikachu", slug: "pikachu", ids: ["tcgcsv-1", "tcgcsv-2"] });
resetStripIndex(); setStripAssets(null);
assert.equal(await stripPageFor("pikachu"), null);
console.log("strip-index ok");
