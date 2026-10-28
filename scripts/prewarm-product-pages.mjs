#!/usr/bin/env node
// Politely pace GET /p/{id} so FEED_KV product-html + prodrow fill after publish.
// Usage: node scripts/prewarm-product-pages.mjs [limit=200] [sleepMs=400]
const limit = Number(process.argv[2] || 200);
const sleepMs = Number(process.argv[3] || 400);
const base = process.env.CATCHEM_ORIGIN || "https://catchemtcg.com";

async function sleep(ms) { await new Promise((r) => setTimeout(r, ms)); }

const searchUrl =
  "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/public-data/research/assets/public/search-lite.json";
const rows = await (await fetch(searchUrl)).json();
const sealed = rows.filter((r) => Array.isArray(r) && r[5] === "sealed").map((r) => r[0]);
const pick = sealed.slice(0, limit);
let ok = 0;
for (let i = 0; i < pick.length; i += 1) {
  const id = pick[i];
  const t0 = Date.now();
  let code = 0;
  try {
    const res = await fetch(`${base}/p/${id}`, { headers: { "user-agent": "catchem-prewarm-html/1" } });
    code = res.status;
    await res.arrayBuffer();
    if (code === 200) ok += 1;
  } catch {
    code = 0;
  }
  console.log(`${i + 1}/${pick.length} ${id} ${code} ${Date.now() - t0}ms`);
  await sleep(sleepMs);
}
console.log(`FINAL ok=${ok}/${pick.length}`);
