import { readFileSync } from "node:fs";
import { banGuard } from "../src/advice-rules.mjs";
import { CATALOG, CHIPS, FLAG, TAP_PATHS, TABS, exploreMain, exploreOn, keepRow, previewPage } from "../src/explore-page.mjs";

let fail = 0;
const t = (name, ok) => { console.log((ok ? "ok   " : "FAIL ") + name); if (!ok) fail++; };
const BANNED = banGuard("explore", /\bsolds?\b|Collectr|\bNM\b/i);

t("flag defaults off", FLAG === "TF_EXPLORE" && exploreOn({}) === false && exploreOn({ TF_EXPLORE: "on" }) === true);
const page = previewPage("dark");
t("search tabs chips sort crumbs", page.includes('role="search"') && TABS.every((tab) => page.includes(tab)) && CHIPS.length === 3 && CHIPS.every((chip) => page.includes(chip)) && page.includes('id="tf-sort"') && page.includes("Breadcrumb"));
t("recent interesting surprise keep", page.includes("Recently viewed") && page.includes("Interesting right now") && page.includes("Surprise me") && page.includes("Keep exploring"));
t("scroll is restored from this device", page.includes("tf-scroll:"));
t("every catalog item is a link", CATALOG.every((row) => page.includes('href="' + row.href + '"')));
t("tap paths stay within 3", TAP_PATHS.length === 5 && TAP_PATHS.every((row) => row.taps <= 3 && row.taps >= 1));
const row = keepRow("/p/tcgcsv-503313");
t("keep row leaves the current product out", !row.includes('href="/p/tcgcsv-503313"') && row.includes("Keep exploring"));
t("wordmark and 44px targets", page.includes("Catch'em") && page.includes("min-height:44px"));
t("copy is clean", !/[\u2014\u2013]/.test(exploreMain()) && !BANNED.test(exploreMain()));
t("no frozen date and no dollar", !exploreMain().includes("Oct 23") && !exploreMain().includes("$"));
const wired = readFileSync(new URL("../src/index.mjs", import.meta.url), "utf8");
t("route is behind the flag", wired.includes("exploreOn(env)") && wired.includes('"/explore"'));

if (fail) { console.log(fail + " failed"); process.exit(1); }
console.log("explore ok");
