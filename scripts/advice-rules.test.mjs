// The shared copy checker. Rules, engine and labelled cases live in Catchem-data.
import { readFile } from "node:fs/promises";
import { ADVICE, ALLOWED, banGuard, flagLine, hasAdvice, isClean } from "../src/advice-rules.mjs";
import { CASES_URL, ENGINE_URL, RULES_URL, toModule } from "./sync-advice-phrases.mjs";

let fail = 0;
const t = (name, ok, extra = "") => { console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` ${extra}`}`); if (!ok) fail++; };
const read = (p) => readFile(new URL(p, import.meta.url), "utf8");

for (const a of ["Buy", "Shop", "Sell your cards", "price target", "Buy on TCGplayer", "Buy on eBay"]) t(`allowed and passes: ${a}`, ALLOWED.includes(a) && isClean(a));

// The labelled set, at 100%.
const { cases } = JSON.parse(await read("./advice-cases.json"));
const got = (s) => JSON.stringify([...new Set(flagLine(s).map((f) => f.rule))].sort());
const wrong = cases.filter((c) => got(c.text) !== JSON.stringify(c.expect));
t(`all ${cases.length} labelled lines match (100%)`, cases.length >= 80 && wrong.length === 0, wrong.slice(0, 5).map((c) => `${JSON.stringify(c.text)} expected [${c.expect}] got ${got(c.text)}`).join(" | "));

const f = flagLine("Honestly, you should sell this now.");
t("a flag carries line, rule, span, phrase and reason", f.length === 1 && f[0].rule === "directive" && f[0].line.slice(...f[0].span) === f[0].phrase && f[0].reason.length > 10);
t("a guard flags and never rewrites", banGuard("test").test("buy it now") === true && banGuard("test", /\bsold\b/i).test("it sold") === true && banGuard("test").test("Buy on eBay") === false);
t("hasAdvice is the inverse of isClean", hasAdvice("load up on boxes") && !hasAdvice("Shop"));

// The copies must match Catchem-data main byte for byte.
const local = await read("../src/advice-phrases.mjs");
const engine = await read("../src/advice-intent.mjs");
t("the video studio copies match src", (await read("../vendor/video/advice-phrases.mjs")) === local && (await read("../vendor/video/advice-intent.mjs")) === engine && (await read("../vendor/video/advice-rules.mjs")) === (await read("../src/advice-rules.mjs")), "run: node scripts/sync-advice-phrases.mjs");
const fetchText = async (url) => {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    return { status: r.status, text: r.ok ? await r.text() : "" };
  } catch { return { status: 0, text: "" }; }
};
const remotes = [[RULES_URL, "src/advice-phrases.mjs", (s) => local === toModule(s) && JSON.stringify(JSON.parse(s)) === JSON.stringify(ADVICE)],
  [ENGINE_URL, "src/advice-intent.mjs", (s) => engine === s],
  [CASES_URL, "scripts/advice-cases.json", async (s) => s === (await read("./advice-cases.json"))]];
for (const [url, file, same] of remotes) {
  const r = await fetchText(url);
  if (r.status && !r.text) t(`Catchem-data main has ${url.split("/main/")[1]}`, false, `HTTP ${r.status}`);
  else if (!r.text) console.log(`note: could not reach Catchem-data main, drift check for ${file} skipped on this run`);
  else t(`${file} matches Catchem-data main`, await same(r.text), "run: node scripts/sync-advice-phrases.mjs");
}

if (fail) process.exit(1);
