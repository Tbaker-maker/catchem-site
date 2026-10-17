import { readFileSync } from "node:fs";
const ui = readFileSync(new URL("../src/ui.mjs", import.meta.url), "utf8");
const { leadWithStory } = await import("../src/ui.mjs");
let fail = 0; const t = (n, ok) => { console.log((ok ? "ok   " : "FAIL ") + n); if (!ok) fail++; };
t("our data read leads over news", leadWithStory([{ id: 1, readKind: "single" }, { id: 2, readKind: "news" }, { id: 3, readKind: "listings" }])[0].id === 3);
t("new since last visit marker", ui.includes("New since your last visit") && ui.includes("catchem-feed-last-day"));
t("client lead skips news first", ui.includes("!plainish(flat[n]) && !newsish(flat[n])"));
if (fail) process.exit(1);
