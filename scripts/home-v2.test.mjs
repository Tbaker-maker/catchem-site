import { readFileSync } from "node:fs";
import { banGuard } from "../src/advice-rules.mjs";
import { FLAG, ONE_LINE, homeBlock, homeOn, injectHome, previewPage } from "../src/home-v2.mjs";

let fail = 0;
const t = (name, ok) => { console.log((ok ? "ok   " : "FAIL ") + name); if (!ok) fail++; };
const BANNED = banGuard("home-v2", /\bsolds?\b|Collectr|\bNM\b/i);

t("flag defaults off", FLAG === "TF_HOME_V2" && homeOn({}) === false && homeOn({ TF_HOME_V2: "on" }) === true);
const block = homeBlock();
t("one action and six tools", block.includes(ONE_LINE) && ["/feed", "/collection", "/heatmap", "/rip", "/reads", "/releases"].every((href) => block.includes('href="' + href + '"')));
t("since visit is device storage and sign in is optional", block.includes("Since your last visit") && block.includes("Sign in is optional") && previewPage("dark").includes("localStorage"));
t("no invented price", !block.includes("$") && !/\$0\b/.test(block));
const injected = injectHome("<html><body><h1>Old</h1></body></html>");
t("inject keeps the old headline and adds the action once", injected.includes("<h1>Old</h1>") && injected.includes(ONE_LINE) && injectHome(injected) === injected);
t("copy is clean", !/[\u2014\u2013]/.test(block + ONE_LINE) && !BANNED.test(block));
const wired = readFileSync(new URL("../src/index.mjs", import.meta.url), "utf8");
t("paint is behind the flag", wired.includes("homeOn(env)"));

if (fail) { console.log(fail + " failed"); process.exit(1); }
console.log("home v2 ok");
