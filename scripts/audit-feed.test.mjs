import { readFileSync } from "node:fs";
const ui = readFileSync(new URL("../src/ui.mjs", import.meta.url), "utf8");
const { leadWithStory } = await import("../src/ui.mjs");
const lw = leadWithStory([{ id: 1, readKind: "single" }, { id: 2, readKind: "sealed" }, { id: 3, readKind: "listings" }]);
if (lw[0].id !== 3 || lw.length !== 3) { console.log("FAIL feed leads with a non-price read"); process.exit(1); }
if (!ui.includes("CHIP_MAIN={\"\":1,\"prices\":1,\"sealed\":1,\"set\":1,\"signals\":1,\"news\":1}")) { console.log("FAIL six main chips plus More"); process.exit(1); }
console.log("ok   feed leads with a story and shows six chips plus More");
if (!ui.includes("feedDay && asOf>=feedDay) return false;")) { console.log("FAIL feed skips bucket fetch for same-night reads"); process.exit(1); }
console.log("ok   same-night reads skip the bucket fetch");
if (ui.includes("replace(/[\\s,;·]+$/") || !ui.includes("replace(/[ ,;]+$/,\"\")")) { console.log("FAIL feed source regex has no backslashes inside the inline script"); process.exit(1); }
console.log("ok   feed source trim survives the template literal");
if (!ui.includes("Interest leads the feed. A tiny move does not open it.")) { console.log("FAIL client feed does not rank by interest"); process.exit(1); }
console.log("ok   client feed opens on interest");
