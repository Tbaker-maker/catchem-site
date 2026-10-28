#!/usr/bin/env node
// Prove a live /p/ page matches the latest public-data price + counts.asOf.
// Usage: node scripts/freshness-proof.mjs [tcgcsv-id]
import assert from "node:assert/strict";

const id = process.argv[2] || "tcgcsv-90285";
const origin = process.env.CATCHEM_ORIGIN || "https://catchemtcg.com";
const raw = "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/public-data/research/assets/public";

const counts = await (await fetch(`${raw}/counts.json`)).json();
const asOf = String(counts.asOf || "").slice(0, 10);
assert.match(asOf, /^\d{4}-\d{2}-\d{2}$/);

const bucket = String((Number((id.match(/(\d+)/) || [])[1]) || 0) % 100).padStart(2, "0");
const text = await (await fetch(`${raw}/buckets/${bucket}.json`)).text();
const needle = `{"id":${JSON.stringify(id)}`;
let row = null;
for (let at = text.indexOf(needle); at >= 0; at = text.indexOf(needle, at + 1)) {
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = at; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) break;
  try {
    const parsed = JSON.parse(text.slice(at, end + 1));
    if (parsed && Object.keys(parsed).some((k) => k !== "id" && k !== "name")) { row = parsed; break; }
  } catch { /* keep */ }
}
assert.ok(row, `row ${id} missing in public-data bucket ${bucket}`);
const price = Number(row.price);
assert.ok(price > 0, "public-data price missing");

const res = await fetch(`${origin}/p/${id}`, {
  headers: { "user-agent": "catchem-freshness-proof/1", accept: "text/html" },
});
const html = await res.text();
const dv = res.headers.get("x-data-version") || "";
const status = res.status;

const priceStr = price >= 100 ? `$${Math.round(price)}` : `$${price.toFixed(2).replace(/\.00$/, "")}`;
const alt = `$${price.toFixed(2)}`;
const shown = html.includes(priceStr) || html.includes(alt) || html.includes(String(price));

console.log(JSON.stringify({
  id, asOf, publicPrice: price, status, dataVersion: dv,
  edge: res.headers.get("x-edge-cache") || "",
  priceShown: shown, soft: res.headers.get("x-catchem-soft") || "",
}, null, 2));

assert.equal(status, 200, "page must be 200");
assert.equal(dv, asOf, `x-data-version ${dv} must equal counts.asOf ${asOf}`);
assert.ok(shown, `HTML must show public-data price ${price} (tried ${priceStr} / ${alt})`);
console.log("freshness-proof ok");
