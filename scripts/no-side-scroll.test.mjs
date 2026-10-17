// Guards the layout bug where a broad feed image rule blew card thumbnails up
// to full width and squeezed read text into a one word column on phones.
import { readFileSync } from "node:fs";
const css = readFileSync(new URL("../src/ui.mjs", import.meta.url), "utf8");
let fail = 0;
const t = (n, c) => { if (c) console.log("  ok ", n); else { fail++; console.log("  FAIL", n); } };
t("feed image rule is low specificity and skips thumbnails", css.includes(".feed-card :where(img:not(.card-face,.card-thumb)){width:100%") && !css.includes(".feed-card img:not(.card-face){width:100%"));
t("thumbnails stay small", /\.card-thumb\{width:28px/.test(css));
t("deep read rows are rounded and wrap", /\.deep-line\{[^}]*min-width:0[^}]*border-radius:12px/.test(css) && /\.deep-line>span\{[^}]*min-width:0[^}]*overflow-wrap:anywhere/.test(css));
t("deep chart label column can shrink", css.includes("grid-template-columns:minmax(0,18em)"));
t("no width:100% rule on bare feed images", !/\.feed-card img\{[^}]*width:100%/.test(css));
if (fail) { console.log(fail + " failed"); process.exit(1); }
console.log("no-side-scroll: all ok");
