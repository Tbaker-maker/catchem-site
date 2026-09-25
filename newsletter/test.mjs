// node newsletter/test.mjs — banned-word filter, sample vs real mode, CASL address gate.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ADDRESS_PLACEHOLDER, isBanned, render } from "./build.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const tpl = readFileSync(join(root, "template.html"), "utf8");
const sample = JSON.parse(readFileSync(join(root, "sample-week.json"), "utf8"));
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log(`  ok  ${name}`); };

// Card condition words are allowed.
for (const s of ["Near Mint", "near-mint copy", "PSA 10 Gem Mint", "Gem-Mint slab", "Mint condition", "Mint/Near Mint", "NM", "NM-MT"]) {
  ok(`allowed: ${s}`, () => assert.equal(isBanned(s), false));
}
// Crypto usage stays blocked.
for (const s of ["mint your NFT", "free mint today", "minting now", "minted on chain", "crypto drop", "token gated", "a new protocol", "buyback", "investment grade", "NFTs"]) {
  ok(`blocked: ${s}`, () => assert.equal(isBanned(s), true));
}

ok("sample week builds with a Near Mint row kept", () => {
  const { html, cards, sample: isSample } = render(sample, tpl, { mailingAddress: "" });
  assert.equal(isSample, true);
  assert.equal(cards, 6);
  assert.ok(html.includes("Near Mint"));
});
ok("sample week with no address shows the loud placeholder", () => {
  const { html } = render(sample, tpl, { mailingAddress: "" });
  assert.ok(html.includes(ADDRESS_PLACEHOLDER.replace(/"/g, "&quot;")));
});

const real = structuredClone(sample);
delete real.sample;
for (const c of [real.play, ...real.cards]) c.price = c.price.replace("SAMPLE ", "");
ok("real week with an empty address fails loudly", () => {
  assert.throws(() => render(real, tpl, { mailingAddress: "" }), /mailingAddress is empty/);
  assert.throws(() => render(real, tpl, {}), /mailingAddress is empty/);
});
ok("real week with an address renders it, no placeholder", () => {
  const { html, sample: isSample } = render(real, tpl, { mailingAddress: "TEST ADDRESS LINE" });
  assert.equal(isSample, false);
  assert.ok(html.includes("TEST ADDRESS LINE"));
  assert.ok(!html.includes("CASL MAILING ADDRESS REQUIRED"));
});
ok("real week never carries SAMPLE prices", () => {
  const mixed = structuredClone(real);
  mixed.cards = sample.cards;
  assert.throws(() => render(mixed, tpl, { mailingAddress: "TEST ADDRESS LINE" }), /need 5 to 7 feed cards/);
});
ok("the shipped config has no address filled in yet", () => {
  const cfg = JSON.parse(readFileSync(join(root, "config.json"), "utf8"));
  assert.equal(typeof cfg.mailingAddress, "string");
});

console.log(`\n${n} passed`);
