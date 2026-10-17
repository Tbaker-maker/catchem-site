import { renderSearch } from "../src/ui.mjs";
const h = renderSearch({});
let fail = 0; const t = (n, ok) => { console.log((ok ? "ok   " : "FAIL ") + n); if (!ok) fail++; };
t("search has recent and popular searches", h.includes("catchem-recent-q") && h.includes("Popular") && h.includes("id=\"sugg\""));
const mod = [...h.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map((m) => m[1].replace(/^import .*$/gm, ""));
for (const s of mod) { try { new Function(s); } catch (e) { t("search script parses: " + e.message, false); } }
t("no em dash", !/\u2014/.test(h));
if (fail) process.exit(1);
