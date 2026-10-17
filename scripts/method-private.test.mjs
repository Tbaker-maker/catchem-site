import { scrubMethod } from "../src/ui.mjs";
import { readFileSync } from "node:fs";
let fail = 0; const t = (n, ok) => { console.log((ok ? "ok   " : "FAIL ") + n); if (!ok) fail++; };
t("method sentences are dropped", scrubMethod("Up $1.99 on the ask. Moves need 8% and $1.") === "Up $1.99 on the ask.");
const all = ["ui.mjs", "features.mjs", "read-sheet.mjs"].map((f) => readFileSync(new URL("../src/" + f, import.meta.url), "utf8")).join("\n");
t("no 80% rule in UI copy", !/at least 80%/.test(all));
t("no at least 8% rule in read copy", !/is at least 8%/.test(all));
t("no later-time-split method line", !/later dates than it was built/.test(all));
if (fail) process.exit(1);
