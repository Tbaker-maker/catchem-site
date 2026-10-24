import { readFile } from "node:fs/promises";
import { renderSetShell } from "../src/ui.mjs";
import { publicContentType } from "../src/data.mjs";
import { changeOver, sealedShelfHtml, SEALED_SHELF_CSS } from "../src/sealed-shelf.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.log("  FAIL", name); }
};

const hist = [
  ["2025-10-20", 80],
  ["2026-04-20", 100],
  ["2026-07-24", 110],
  ["2026-10-24", 121],
];
const up = changeOver(hist, "2026-10-24", 92);
t("3 month change uses the dated points", up && Math.round(up.pct) === 10);
t("a window with no earlier point is empty", changeOver([["2026-10-20", 10], ["2026-10-24", 11]], "2026-10-24", 366) === null);

const doc = {
  products: [
    { id: "swsh11-pack", siteId: "tcgcsv-277325", tcgPlayerId: 277325, file: "cutouts/swsh11-pack.webp", width: 200, height: 420, productType: "booster-pack", pass: true },
    { id: "swsh11-etb", siteId: "tcgcsv-277335", tcgPlayerId: 277335, file: "cutouts/swsh11-etb.webp", width: 700, height: 760, productType: "etb", pass: true },
    { id: "swsh11-pc-etb", siteId: "tcgcsv-277336", tcgPlayerId: 277336, file: "cutouts/swsh11-pc-etb.webp", width: 710, height: 760, productType: "pc-etb", pass: true },
    { id: "swsh11-booster-box", siteId: "tcgcsv-277324", tcgPlayerId: 277324, file: "cutouts/swsh11-booster-box.webp", width: 800, height: 980, productType: "booster-box", pass: true },
    { id: "broken", siteId: "tcgcsv-1", file: "cutouts/broken.webp", width: 10, height: 10, productType: "etb", pass: false },
  ],
};
const items = [
  { id: "tcgcsv-277335", kind: "sealed", name: "Lost Origin Elite Trainer Box", price: 196.73, hist, subtype: "etb" },
  { id: "tcgcsv-277336", kind: "sealed", name: "Lost Origin Pokemon Center Elite Trainer Box", price: 373.44, hist, subtype: "pc-etb" },
  { id: "tcgcsv-277324", kind: "sealed", name: "Lost Origin Booster Box", price: 726.65, hist, subtype: "booster-box" },
  { id: "tcgcsv-277325", kind: "sealed", name: "Lost Origin Booster Pack", price: 17.1, hist, subtype: "booster-pack" },
  { id: "tcgcsv-1", kind: "sealed", name: "Broken", price: 9, hist },
];
const shelf = sealedShelfHtml(items, doc, "2026-10-24");
t("a failed cutout is not on the shelf", !shelf.html.includes("broken") && !shelf.ids["tcgcsv-1"]);
t("the shelf names the product and the type", shelf.html.includes("Lost Origin Elite Trainer Box") && shelf.html.includes(">ETB<") && shelf.html.includes(">PC ETB<") && shelf.html.includes(">Booster box<"));
t("price has an as of date from the history", shelf.html.includes("$196.73") && shelf.html.includes("as of Oct 24"));
t("change chips are 3M, 6M, and 1Y", shelf.html.includes("3M up") && shelf.html.includes("6M up") && shelf.html.includes("1Y up"));
t("no condition label and no sold wording", !/\bNM\b|\bLP\b|sold/i.test(shelf.html));
t("no em or en dash in the shelf", !/[\u2013\u2014]/.test(shelf.html));
const packAt = shelf.html.indexOf("swsh11-pack");
const boxAt = shelf.html.indexOf("swsh11-booster-box");
t("the pack sits before the taller box", packAt > -1 && boxAt > packAt);
t("box is full height and the pack is smaller", shelf.html.includes("swsh11-booster-box.webp") && /--rel:0\.4/.test(shelf.html) && shelf.html.includes("--rel:1"));
t("cards are rounded and share a baseline", SEALED_SHELF_CSS.includes("border-radius:22px") && SEALED_SHELF_CSS.includes("align-items:flex-end") && SEALED_SHELF_CSS.includes("prefers-color-scheme: light"));

const page = renderSetShell("swsh11-lost-origin", "Oct 24");
t("the set page mounts the shelf", page.includes('id="seal-shelf"') && page.includes("function sealedShelfHtml"));
t("cutout files are served as images", publicContentType("cutouts/swsh11-etb.webp") === "image/webp" && publicContentType("cutouts/swsh11-etb.png") === "image/png");
t("json data stays json", publicContentType("sealed-cutouts.json") === "application/json; charset=utf-8");

const src = await readFile(new URL("../src/sealed-shelf.mjs", import.meta.url), "utf8");
t("the shelf source has no em or en dash", !/[\u2013\u2014]/.test(src));

if (fail) {
  console.error(fail + " failed");
  process.exit(1);
}
console.log("sealed cutouts ok");
