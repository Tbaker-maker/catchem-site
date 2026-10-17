// The shared advice-phrase rules. The list lives in Catchem-data rules/advice-phrases.json.
import { readFile } from "node:fs/promises";
import { ADVICE, ALLOWED, banGuard, flagLine, hasAdvice, isClean } from "../src/advice-rules.mjs";
import { RULES_URL, toModule } from "./sync-advice-phrases.mjs";

let fail = 0;
const t = (name, ok, extra = "") => { console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` ${extra}`}`); if (!ok) fail++; };

for (const a of ["Buy", "Shop", "Sell your cards", "price target", "Buy on TCGplayer", "Buy on eBay"]) t(`allowed and passes: ${a}`, ALLOWED.includes(a) && isClean(a));
for (const s of ["Buy on TCGplayer", "Buy on eBay", "Shop sealed", "Sell your cards", "Set a price target", "Sun & Moon booster box", "Hold to zoom", "Best Buy restock"]) t(`passes: ${s}`, isClean(s));
const bad = { "Buy now": "buy-now", "You should sell this": "you-should", "Load up on ETBs": "load-up", "Guaranteed to climb": "guaranteed", "You can't lose": "cant-lose", "To the moon": "to-the-moon", "Pay with crypto": "crypto", "Up 4% \u2014 Oct 1": "dash" };
for (const [s, rule] of Object.entries(bad)) { const f = flagLine(s); t(`flags ${rule}: ${s}`, f[0]?.rule === rule && f[0].line === s && f[0].reason.length > 10); }
t("a guard flags and never rewrites", banGuard("test").test("buy now") === true && banGuard("test", /\bsold\b/i).test("it sold") === true && banGuard("test").test("Buy on eBay") === false);
t("hasAdvice is the inverse of isClean", hasAdvice("load up") && !hasAdvice("Shop"));

// The copy must match Catchem-data main byte for byte.
const local = await readFile(new URL("../src/advice-phrases.mjs", import.meta.url), "utf8");
const read = (p) => readFile(new URL(p, import.meta.url), "utf8");
t("the video studio copy matches src", (await read("../vendor/video/advice-phrases.mjs")) === local && (await read("../vendor/video/advice-rules.mjs")) === (await read("../src/advice-rules.mjs")), "run: node scripts/sync-advice-phrases.mjs");
let remote = "";
let status = 0;
try {
  const r = await fetch(RULES_URL, { signal: AbortSignal.timeout(10000) });
  status = r.status;
  if (r.ok) remote = await r.text();
} catch {}
if (status && !remote) t("Catchem-data main has rules/advice-phrases.json", false, `HTTP ${status}`);
else if (!remote) console.log("note: could not reach Catchem-data main, drift check skipped on this run");
else t("src/advice-phrases.mjs matches Catchem-data main", local === toModule(remote) && JSON.stringify(JSON.parse(remote)) === JSON.stringify(ADVICE), "run: node scripts/sync-advice-phrases.mjs");

if (fail) process.exit(1);
