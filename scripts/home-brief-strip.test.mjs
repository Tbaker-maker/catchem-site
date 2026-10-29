import { readFileSync } from "node:fs";
import { flagLine } from "../src/advice-rules.mjs";
import {
  HOME_BRIEF_HIDE_KEY,
  HOME_BRIEF_MARK,
  homeBriefStripSource,
  paintHomeBriefStrip,
} from "../src/home-brief-strip.mjs";

let fail = 0;
const t = (name, ok) => { console.log((ok ? "ok   " : "FAIL ") + name); if (!ok) fail++; };

const bare = `<!doctype html><html><head><title>t</title></head><body><main><header class="hero"></header><hr class="rule"><section></section></main></body></html>`;
const painted = paintHomeBriefStrip(bare);
t("injects strip mark", painted.includes(HOME_BRIEF_MARK));
t("injects css and script", painted.includes("home-brief-strip-css") && painted.includes("Morning Brief"));
t("idempotent", paintHomeBriefStrip(painted) === painted);
t("hide key constant", HOME_BRIEF_HIDE_KEY === "catchem-brief-home-hide");

const src = homeBriefStripSource();
t("client reads collection storage", src.includes("catchem-collection") && src.includes(HOME_BRIEF_HIDE_KEY));
t("strip links to collection and can hide", painted.includes('href="/collection"') && painted.includes("hb-hide") && painted.includes("Hide"));
t("no em dash", !/[\u2013\u2014]/.test(src) && !/[\u2013\u2014]/.test(painted));
t("listings counted wording available", /listings counted/.test(src));
for (const line of ["Morning Brief", "Open collection", "Cost to finish", "listings counted"]) {
  t("advice clean: " + line, flagLine(line).length === 0);
}

const indexMod = readFileSync(new URL("../src/index.mjs", import.meta.url), "utf8");
t("worker paints strip on home", indexMod.includes("paintHomeBriefStrip"));

if (fail) { console.error(fail + " failed"); process.exit(1); }
console.log("home-brief-strip tests passed");
