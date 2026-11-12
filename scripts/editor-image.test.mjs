import assert from "node:assert/strict";
import worker from "../src/index.mjs";
import { editorImageFallbacks } from "../src/catalogue-image.mjs";

assert.deepEqual(editorImageFallbacks("cel25c/17_hires.png"), [
  "cel25c/17_hires.png",
  "cel25c/17.png",
  "cel25c/17_A.png",
]);

const calls = [];
const fetchImpl = async (url) => {
  calls.push(String(url));
  if (String(url).endsWith("/cel25c/17_A.png")) {
    return new Response("low", { status: 200, headers: { "content-type": "image/png" } });
  }
  return new Response("no", { status: 404 });
};
const res = await worker.fetch(new Request("https://catchemtcg.com/data/editor/tcg/cel25c/17_hires.png"), { PUBLIC_FETCH: fetchImpl });
assert.equal(res.status, 200);
assert.equal(await res.text(), "low");
assert.ok(calls[calls.length - 1].endsWith("/cel25c/17_A.png"), calls.join("\n"));
console.log("editor image ok");

// When images.pokemontcg.io misses, the same id's TCGplayer photo is served (me2pt5 to me6, mep, mcd17, leftover svp).
{
  const { EDITOR_TCG_PIDS } = await import("../src/editor-tcg-pids.mjs");
  const pid = EDITOR_TCG_PIDS["me55/1"];
  assert.ok(pid > 0, "me55/1 has a TCGplayer id");
  for (const k of ["me2pt5/1", "me3/1", "me4/1", "me5/1", "me55c/4", "me6/1", "mep/1", "mep/9-pc", "mcd17/1", "svp/102"]) assert.ok(EDITOR_TCG_PIDS[k] > 0, k);
  assert.equal(EDITOR_TCG_PIDS["base1/4"], undefined, "sets with pokemontcg.io files keep that source only");
  assert.equal(EDITOR_TCG_PIDS["svp/1"], undefined, "svp ids that pokemontcg.io hosts stay off the fallback map");
  const seen = [];
  const tcgFetch = async (url) => {
    seen.push(String(url));
    if (String(url).startsWith("https://tcgplayer-cdn.tcgplayer.com/product/" + pid + "_")) {
      return new Response("jpeg", { status: 200, headers: { "content-type": "image/jpeg" } });
    }
    return new Response("no", { status: 404 });
  };
  const hit = await worker.fetch(new Request("https://catchemtcg.com/data/editor/tcg/me55/1_hires.png"), { PUBLIC_FETCH: tcgFetch });
  assert.equal(hit.status, 200);
  assert.equal(await hit.text(), "jpeg");
  const firstTcg = seen.findIndex((u) => u.includes("tcgplayer-cdn"));
  assert.ok(seen.slice(0, firstTcg).some((u) => u.startsWith("https://images.pokemontcg.io/me55/1")), "pokemontcg.io is tried first: " + seen.join(" "));
  const miss = await worker.fetch(new Request("https://catchemtcg.com/data/editor/tcg/base1/999_hires.png"), { PUBLIC_FETCH: tcgFetch });
  assert.equal(miss.status, 404, "an id with no product id stays a miss");
  assert.ok(!seen.some((u) => u.includes("tcgplayer") && !u.includes("/" + pid + "_")), "no other product is fetched");
  console.log("editor image TCGplayer fallback ok");
}
