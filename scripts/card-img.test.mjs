import worker, { IMAGE_HOSTS } from "../src/index.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.log("  FAIL", name); }
};

t("allowlist is exactly the two current hosts", IMAGE_HOSTS.length === 2
  && IMAGE_HOSTS[0] === "images.pokemontcg.io"
  && IMAGE_HOSTS[1] === "tcgplayer-cdn.tcgplayer.com");

const okBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const realFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const s = String(url);
  if (s.includes("tcgplayer-cdn.tcgplayer.com/product/42386")) {
    return new Response(okBytes, { status: 200, headers: { "content-type": "image/jpeg" } });
  }
  if (s.includes("tcgplayer-cdn.tcgplayer.com/product/999999")) {
    return new Response("no", { status: 404 });
  }
  throw new Error("unexpected host " + s);
};

async function hit(method, pid) {
  const req = new Request("https://catchemtcg.com/api/card-img?pid=" + pid, { method });
  return worker.fetch(req, {}, {});
}

const get200 = await hit("GET", 42386);
const head200 = await hit("HEAD", 42386);
t("200 GET status", get200.status === 200);
t("200 HEAD status matches GET", head200.status === get200.status);
t("200 HEAD content-type matches GET", head200.headers.get("content-type") === get200.headers.get("content-type"));
t("200 HEAD has no body", (await head200.arrayBuffer()).byteLength === 0);
t("200 GET has a body", (await get200.arrayBuffer()).byteLength === okBytes.length);

const get404 = await hit("GET", 999999);
const head404 = await hit("HEAD", 999999);
t("404 GET status", get404.status === 404);
t("404 HEAD status matches GET", head404.status === get404.status);
t("404 HEAD has no body", (await head404.arrayBuffer()).byteLength === 0);

globalThis.fetch = realFetch;
if (fail) process.exit(1);
console.log("card-img ok");
