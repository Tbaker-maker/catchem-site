import { readFileSync } from "node:fs";
const ui = readFileSync(new URL("../src/ui.mjs", import.meta.url), "utf8");
if (!ui.includes("sum-chip{display:inline-flex;align-items:center;min-height:44px")) { console.log("FAIL summary chips are 44px"); process.exit(1); }
console.log("ok   summary chips 44px");
if (!ui.includes("<details class=\"nav-more\">")) { console.log("FAIL desktop nav has More"); process.exit(1); }
console.log("ok   desktop nav trimmed with More");
const idx = readFileSync(new URL("../src/index.mjs", import.meta.url), "utf8");
if (ui.includes("|| opts.itemListings") || idx.includes("pageOpts.itemListings = pageOpts.itemListings ||")) { console.log("FAIL sealed chip still falls back to listings-counted.json"); process.exit(1); }
console.log("ok   sealed chip does not fall back to listings-counted.json");
