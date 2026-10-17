import { scrubMethod } from "../src/ui.mjs";
import { readFileSync } from "node:fs";
let fail = 0; const t = (n, ok) => { console.log((ok ? "ok   " : "FAIL ") + n); if (!ok) fail++; };
t("method sentences are dropped", scrubMethod("Up $1.99 on the ask. Moves need 8% and $1.") === "Up $1.99 on the ask.");
const all = ["ui.mjs", "features.mjs", "read-sheet.mjs"].map((f) => readFileSync(new URL("../src/" + f, import.meta.url), "utf8")).join("\n");
t("no 80% rule in UI copy", !/at least 80%/.test(all));
t("no at least 8% rule in read copy", !/is at least 8%/.test(all));
t("no later-time-split method line", !/later dates than it was built/.test(all));
if (fail) process.exit(1);

// Round 3b: rating explainer and receipts carry no thresholds or weights.
{
  const fs = await import("node:fs");
  const cr = fs.readFileSync(new URL("../src/card-rating.mjs", import.meta.url), "utf8");
  const ui = fs.readFileSync(new URL("../src/ui.mjs", import.meta.url), "utf8");
  for (const bad of ["at least 5 such", "0.8x", "1.25x", "Weights:"]) if (cr.includes(bad)) { console.error("FAIL rating reveals", bad); process.exit(1); }
  for (const bad of ["8% mover line", "spans at least 150 days", "Looks like a buy", "at least 15%", "Under 15%, so it is not a read"]) if (ui.includes(bad)) { console.error("FAIL ui reveals", bad); process.exit(1); }
  console.log("ok rating and receipts keep method private");
}
