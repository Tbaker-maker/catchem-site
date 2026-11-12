// Nov 11: GET /api/card-hero?pid=42382 was 200 image/jpeg, HEAD was 404.
// Link checkers and share crawlers probe images with HEAD.
import worker from "../src/index.mjs";

let fail = 0;
const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail++; console.log("  FAIL", name); } };

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
globalThis.fetch = async (url) => {
  const s = String(url);
  if (s.includes("/product/42382_in_")) return new Response(jpeg, { status: 200, headers: { "content-type": "image/jpeg" } });
  if (s.includes("/product/999999_in_")) return new Response("no", { status: 404 });
  throw new Error("unexpected " + s);
};
const hit = (method, q) => worker.fetch(new Request("https://catchemtcg.com/api/card-hero?" + q, { method }), {}, {});

const get = await hit("GET", "pid=42382");
const head = await hit("HEAD", "pid=42382");
t("GET is 200 jpeg with a body", get.status === 200 && get.headers.get("content-type") === "image/jpeg" && (await get.arrayBuffer()).byteLength === jpeg.length);
t("HEAD matches GET: 200 jpeg", head.status === 200 && head.headers.get("content-type") === "image/jpeg");
t("HEAD has no body", (await head.arrayBuffer()).byteLength === 0);
const missGet = await hit("GET", "pid=999999&fb=/data/editor/tcg/base1/4_hires.png");
const missHead = await hit("HEAD", "pid=999999&fb=/data/editor/tcg/base1/4_hires.png");
t("a miss redirects the same way for GET and HEAD", missGet.status === 302 && missHead.status === 302 && missHead.headers.get("location") === missGet.headers.get("location"));
const badHead = await hit("HEAD", "pid=0");
t("a bad pid is 404 for HEAD too", badHead.status === 404);
process.exit(fail ? 1 : 0);
