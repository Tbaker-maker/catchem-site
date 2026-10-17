// 'Normal' is the default printing and never renders as its own label in list rows.
import assert from "node:assert/strict";
import { renderSetShell, renderSearch } from "../src/ui.mjs";
for (const [name, page] of [["set", renderSetShell("x", "2026-10-12", {})], ["search", renderSearch({})]]) {
  const m = page.match(/function rowHtml\(r\)\{[\s\S]*?\n\}/);
  assert.ok(m, name + " page has a row renderer");
  const html = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";");
  const ctx = { html, officialSrc: () => ({}), catImages: {}, money: (n) => "$" + n, mineOn: () => false, logos: {}, catalogueUrl: (s) => s, stored: (r) => r[6], sparkBags: {}, bucketOf: () => 0, sparkAsOf: "", storeLinks: () => "", brandedTile: () => "", setLogo: "", altAttr: () => "", window: {}, readOwned: () => ({}), ownKey: () => "", holdIds: {}, isOdd: () => false };
  const vt = page.match(/function visTags\(t\)\{[^\n]*\}/);
  const fn = new Function(...Object.keys(ctx), (vt ? vt[0] : "") + "\n" + m[0] + "\nreturn rowHtml;")(...Object.values(ctx));
  const rows = name === "set"
    ? [fn({ id: "a", name: "151 Elite Trainer Box", kind: "sealed", printing: "Normal", price: 506 }), fn({ id: "b", name: "Mew", kind: "single", printing: "Normal", tags: ["Normal"], price: 2 }), fn({ id: "c", name: "Pikachu", kind: "single", printing: "Reverse Holofoil", price: 3 })]
    : [fn(["a", "151 Elite Trainer Box", "151", "", "", "sealed", 506, "151", "", ["Normal"]]), fn(["b", "Mew", "151", "1", "", "single", 2, "151", "", ["Normal", "Holofoil"]])];
  for (const r of rows) assert.ok(!/>\s*Normal\s*</.test(r), name + ": 'Normal' never renders as a standalone label: " + r);
  if (name === "set") assert.ok(rows[2].includes('class="vpill">Reverse Holofoil<'), "non-default printing shows as a pill under the name");
  else assert.ok(rows[1].includes(">Holofoil<"), "other variants still show");
}
const css = renderSetShell("x", "2026-10-12", {});
assert.ok(/\.vpill\{[^}]*border-radius:999px/.test(css), "pill is rounded");
assert.ok(/\.row>b\{flex:none;white-space:nowrap/.test(css), "price never wraps");
assert.ok(/-webkit-line-clamp:2/.test(css), "name clamps to 2 lines");
console.log("variant row tests passed");
