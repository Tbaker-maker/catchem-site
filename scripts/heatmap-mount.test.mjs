import { readFileSync } from "node:fs";
import { brandPage } from "../src/brand-visuals.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log(`  ok  ${name}`);
  else {
    fail += 1;
    console.error(`  FAIL ${name}`);
  }
};

const entry = readFileSync(new URL("../src/site-entry.mjs", import.meta.url), "utf8");
t("site-entry imports sealedPulseResponse", /sealedPulseResponse/.test(entry) && /brand-visuals/.test(entry));
t("site-entry serves /sealed-pulse", entry.includes('"/sealed-pulse"'));
t("site-entry serves /heatmap", entry.includes('"/heatmap"'));
t("site-entry serves /brand-visuals alias", entry.includes('"/brand-visuals"'));
t("site-entry serves /heat alias", entry.includes('"/heat"'));
const page = brandPage();
t("brand page renders Catch'em mark", page.includes("Catch'em") && page.includes("#12100e") && page.includes("#d9b779"));
t("brand page names TCGplayer market source", /TCGplayer market/.test(page));
t("no em or en dash in brand page", !/[\u2013\u2014]/.test(page));
t("no NM on sealed copy", !/\bNM\b/.test(page));
t("does not say sold", !/\bsold\b/i.test(page));

if (fail) {
  console.error(`${fail} failed`);
  process.exit(1);
}
console.log("heatmap mount ok");
