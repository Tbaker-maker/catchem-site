// Branded Sealed Market Pulse page: mark and data date in the header.
import { brandPageFromDoc } from "../src/brand-visuals.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log(`  ok  ${name}`);
  else {
    fail += 1;
    console.error(`  FAIL ${name}`);
  }
};

const rows = [
  {
    id: "fixture-etb",
    name: "Fixture Elite Trainer Box",
    set: "Fixture Set",
    type: "etb",
    cells: [
      { month: "2026-10", pct: -1.2, price: 40, direction: "down" },
      { month: "2026-11", pct: 0.4, price: 41, direction: "up" },
    ],
  },
  {
    id: "fixture-box",
    name: "Fixture Booster Box",
    set: "Fixture Box Set",
    type: "booster-box",
    cells: [
      { month: "2026-10", pct: null, price: null },
      { month: "2026-11", pct: -3.5, price: 120, direction: "down" },
    ],
  },
];

const doc = {
  asOf: "2026-11-26",
  source: "TCGplayer market",
  marketMedian: { "2026-11": -0.4 },
  rows,
};

const page = brandPageFromDoc(doc);
const gridAt = page.indexOf('class="bv-heat"');
const before = gridAt >= 0 ? page.slice(0, gridAt) : "";
const band = before.match(/<header class="bv-band"[\s\S]*?<\/header>/);

t("brand mark is Catch'em", page.includes("Catch'em") && page.includes('class="bv-mark"'));
t("date text is the passed asOf", page.includes("Data date") && page.includes("2026-11-26"));
t("mark and date sit in the header before the grid", !!band && band[0].includes("Catch'em") && band[0].includes("Data date") && band[0].includes("2026-11-26") && band[0].includes('class="bv-mark"') && band[0].includes('class="bv-asof"'));
t("header band stays on the first screen at 390 and 1280", page.includes('data-first-screen="390 1280"') && page.includes("@media (max-width:390px)") && page.includes("@media (min-width:1280px)") && page.includes(".bv-band{display:flex") && page.includes("position:sticky"));

const blank = brandPageFromDoc({ ...doc, asOf: "" });
const today = new Date().toISOString().slice(0, 10);
t("missing asOf prints no Data date line", !blank.includes("Data date"));
t("missing asOf does not inject today's ISO date", !blank.includes(today));

if (fail) {
  console.error(`${fail} failed`);
  process.exit(1);
}
console.log("pulse brand ok");
