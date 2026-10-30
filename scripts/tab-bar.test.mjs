import { readFileSync } from "node:fs";
import { banGuard } from "../src/advice-rules.mjs";
import { FLAG, injectTabs, previewPage, tabBar, tabsOn } from "../src/tab-bar.mjs";

let fail = 0;
const t = (name, ok) => { console.log((ok ? "ok   " : "FAIL ") + name); if (!ok) fail++; };
const BANNED = banGuard("tab-bar", /\bsolds?\b|Collectr|\bNM\b/i);

t("flag defaults off", FLAG === "TF_TABS" && tabsOn({}) === false && tabsOn({ TF_TABS: "on" }) === true);
const bar = tabBar("Feed");
for (const label of ["Feed", "Collection", "Heatmap", "Rip value", "Reads", "Releases", "More"]) t("has " + label, bar.includes(label));
const primary = bar.split('id="tf-more"')[0];
t("indexes is not a primary tab", !primary.includes("Indexes") && bar.includes('href="/indexes"'));
t("more holds search sets and watchlist", bar.includes('href="/search"') && bar.includes('href="/sets"') && bar.includes('href="/watchlist"'));
t("more sheet starts closed", previewPage("dark").includes(".tf-more-sheet[hidden]{display:none}"));
t("tap target css", bar && previewPage("dark").includes("min-height:48px") && previewPage("dark").includes("min-width:44px"));
t("watchlist empty state", previewPage("light", "watch").includes("Nothing saved on this device yet.") && previewPage("light", "watch").includes("Sign in is optional"));
t("wordmark", previewPage("dark").includes("Catch'em"));
const dock = '<nav class="dock" aria-label="Primary"><a href="/feed">Feed</a><a href="/collection">Collection</a><a href="/heatmap">Heatmap</a><a href="/rip">Rip value</a><a href="/reads">Reads</a><a href="/releases">Releases</a></nav>';
const kept = injectTabs(dock, "/feed");
t("six tool dock stays", kept === dock && kept.includes(">Feed<") && kept.includes("Releases"));
const bare = injectTabs("<html><body><p>Hi</p></body></html>", "/feed");
t("a page without a dock gets the six tools", bare.includes("data-tf-tabs") && bare.includes(">Feed<") && bare.includes("Rip value") && !bare.split('id="tf-more"')[0].includes("Indexes"));
t("copy is clean", !/[\u2014\u2013]/.test(bar) && !BANNED.test(bar + previewPage("dark", "watch")));
const wired = readFileSync(new URL("../src/index.mjs", import.meta.url), "utf8");
t("watchlist route is behind the flag", wired.includes("tabsOn(env)") && wired.includes('"/watchlist"'));

if (fail) { console.log(fail + " failed"); process.exit(1); }
console.log("tab bar ok");
