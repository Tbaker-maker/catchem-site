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
