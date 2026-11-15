import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { handleSetLogo } from "../src/index.mjs";
import worker from "../src/index.mjs";
import { catalogueUrl, brandedTile } from "../src/catalogue-image.mjs";
import { releasesBody } from "../src/features.mjs";
import { renderCard } from "../src/ui.mjs";
const png = new Uint8Array([137, 80, 78, 71]);
const seen = [];
const fake = async (u) => { seen.push(u); return u.includes("Catchem-data") && u.includes("/me55/") || u.includes("pokemontcg.io/base1/") ? new Response(png, { status: 200 }) : new Response("", { status: 404 }); };
const get = (p, m = "GET") => handleSetLogo(new Request("https://x" + p, { method: m }), p, fake);
let r = await get("/img/me55/logo.png");
assert.equal(r.status, 200); assert.equal(r.headers.get("content-type"), "image/png");
assert.equal(seen.length, 1, "catalogue file first");
r = await get("/img/base1/logo.png"); assert.equal(r.status, 200);
r = await get("/img/base1/logo.png", "HEAD"); assert.equal(r.status, 200); assert.equal(r.body, null);
assert.equal((await get("/img/nope9/logo.png")).status, 404);
seen.length = 0;
assert.equal((await get("/img/../x/logo.png")).status, 404);
assert.equal((await get("/img/me1/other.png")).status, 404);
assert.equal(seen.length, 0, "bad paths never fetch");
assert.equal(catalogueUrl("/img/me6/logo.png"), "/img/me6/logo.png");
assert.equal(catalogueUrl("/img/base1/1"), "/data/editor/tcg/base1/1_hires.png");
const plate = brandedTile("logo", { kind: "set", name: "Battle Academy" });
assert.equal(plate.includes("tile-logo"), true);
assert.equal(plate.includes("Battle Academy"), true);
assert.equal(plate.includes(">Set<"), false);
assert.equal(brandedTile("card").includes("Catch'em"), true);
assert.equal(brandedTile("sealed", { kind: "sealed", name: "Elite Trainer Box" }).includes("ETB"), true);
const rel = releasesBody({ releases: [
  { name: "Delta Reign (ME06)", date: "2026-11-06", source: "https://www.pokemon.com/us/pokemon-tcg", type: "main-set" },
  { name: "30th Celebration Binder Collection", date: "2026-12-04", source: "https://www.pokemon.com/us/pokemon-tcg", type: "product" },
] }, "2026-10-01", [
  { name: "ME06: Delta Reign", logo: "/img/me6/logo.png" },
  { name: "ME: 30th Celebration", logo: "/img/me55/logo.png" },
  { name: "Celebrations", logo: "/img/cel25/logo.png" },
]);
assert.equal(rel.includes('src="/img/me6/logo.png"'), true);
assert.equal(rel.includes('src="/img/me55/logo.png"'), true);
assert.equal(rel.includes("/img/cel25/logo.png"), false);

const sealed = renderCard({
  id: "tcgcsv-277335",
  name: "Lost Origin Elite Trainer Box",
  kind: "sealed",
  set: "SWSH11: Lost Origin",
  setSlug: "swsh11",
  price: 10,
  asOf: "2026-10-30",
  hist: [["2026-10-01", 9], ["2026-10-30", 10]],
}, "stamp", { setLogo: "/img/swsh11/logo.png" });
const mark = (sealed.match(/<img class="set-mark"[^>]*>/) || [""])[0];
assert.equal(mark.includes('src="/img/swsh11/logo-sm.webp"'), true);
assert.equal(mark.includes('width="96"'), true);
assert.equal(mark.includes('height="28"'), true);
assert.equal(mark.includes("logo.png"), false);
const webp = new Uint8Array([82, 73, 70, 70]);
const assets = { fetch: async () => new Response(webp, { status: 200, headers: { "content-type": "image/webp" } }) };
const env = { ASSETS: assets, PUBLIC_FETCH: async () => new Response("no", { status: 404 }) };
const small = await worker.fetch(new Request("https://catchemtcg.com/img/swsh11/logo-sm.webp"), env);
assert.equal(small.status, 200);
assert.equal(small.headers.get("content-type"), "image/webp");
assert.equal(new Uint8Array(await small.arrayBuffer())[0], 82);
const head = await worker.fetch(new Request("https://catchemtcg.com/img/swsh11/logo-sm.webp", { method: "HEAD" }), env);
assert.equal(head.status, 200);
assert.equal(head.body, null);
assert.equal((await worker.fetch(new Request("https://catchemtcg.com/img/nope/logo-sm.webp"), { ASSETS: { fetch: async () => new Response("no", { status: 404 }) }, PUBLIC_FETCH: async () => new Response("no", { status: 404 }) })).status, 404);
const built = readFileSync(new URL("../scripts/build.mjs", import.meta.url), "utf8");
assert.equal(built.includes('join(dir, "logo-sm.webp")'), true);
const sm = statSync(new URL("../vendor/set-logos/swsh11.webp", import.meta.url)).size;
assert.equal(sm > 200 && sm < 12000, true, `small logo bytes ${sm}`);
console.log("set-logo ok");
