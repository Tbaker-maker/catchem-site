import assert from "node:assert/strict";
import { freshOrder, freshRandom, pickWording, readSeen, markSeen } from "../src/fresh.mjs";

const kinds = ["climb", "newsline", "release", "single", "pokemon", "setheat"];
const sets = ["A", "B", "C", "D"];
const rows = Array.from({ length: 36 }, (_, i) => ({ id: `r${i}`, sku: `p${i % 30}`, readKind: kinds[i % kinds.length], set: sets[i % sets.length], headline: `h${i}` }));

for (let seed = 1; seed <= 50; seed += 1) {
  const out = freshOrder(rows, { seed });
  assert.equal(new Set(out.map((r) => r.id)).size, out.length, "no read repeats in one loop");
  assert.equal(new Set(out.map((r) => r.sku)).size, out.length, "no product repeats in one loop");
  let side = 0;
  for (let i = 1; i < out.length; i += 1) if (out[i].readKind === out[i - 1].readKind) side += 1;
  assert.equal(side, 0, "no two of one kind side by side");
  let sameSet = 0;
  for (let i = 1; i < out.length; i += 1) if (out[i].set === out[i - 1].set) sameSet += 1;
  assert.ok(sameSet <= 2, "sets spread out");
}
const a = freshOrder(rows, { seed: 11 }).map((r) => r.id).join();
const b = freshOrder(rows, { seed: 12 }).map((r) => r.id).join();
assert.notEqual(a, b, "a new seed is a new order");

// Across refreshes: what was shown first is not shown first again.
const mem = new Map();
const store = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
const first = freshOrder(rows, { seed: 3, seen: readSeen(store) });
markSeen(store, first.slice(0, 10).map((r) => r.id));
const second = freshOrder(rows, { seed: 4, seen: readSeen(store) });
const firstTen = new Set(first.slice(0, 10).map((r) => r.id));
assert.ok(second.slice(0, 10).every((r) => !firstTen.has(r.id)), "unseen reads come first on the next refresh");
markSeen(store, second.slice(0, 10).map((r) => r.id));
const third = freshOrder(rows, { seed: 5, seen: readSeen(store) });
const both = new Set([...firstTen, ...second.slice(0, 10).map((r) => r.id)]);
assert.ok(third.slice(0, 10).every((r) => !both.has(r.id)), "no repeat across three refreshes while unseen reads remain");
assert.equal(third.length, rows.length - 6, "nothing dropped except product duplicates");

const v = { id: "x", headline: "A", variants: ["B", "C"] };
const picks = new Set(Array.from({ length: 40 }, (_, i) => pickWording(v, freshRandom(i + 1)).headline));
assert.ok(picks.size >= 2 && [...picks].every((t) => ["A", "B", "C"].includes(t)), "wording rotates within the file-built list");
assert.equal(pickWording({ id: "y", headline: "Only" }, freshRandom(1)).headline, "Only");
console.log("fresh tests passed");
