import { readFileSync } from "node:fs";
import { banGuard } from "../src/advice-rules.mjs";
import { ETB, FLAG, money, moveText, previewPage, productOn, productSection, runwayText } from "../src/product-v2.mjs";

let fail = 0;
const t = (name, ok) => { console.log((ok ? "ok   " : "FAIL ") + name); if (!ok) fail++; };
const BANNED = banGuard("product-v2", /\bsolds?\b|Collectr|\bNM\b|Near Mint/i);

t("flag defaults off", FLAG === "TF_PRODUCT_V2" && productOn({}) === false && productOn({ TF_PRODUCT_V2: "on" }) === true);
t("missing money is not zero", money(0) === "No price" && money(null) === "No price");
const move = moveText(ETB.points[0][1], ETB.points.at(-1)[1]);
t("move has an arrow and a sign", move.startsWith("Up \u25B2 +") && move.includes("%"));
t("down has an arrow and a sign", moveText(10, 8).startsWith("Down \u25BC -"));
const html = productSection(ETB);
t("lifecycle names market and says retail is missing", html.includes("$497.13") && html.includes("Retail: No price") && html.includes("<svg"));
t("runway does not invent a length", runwayText(ETB.listings).includes("117 eBay listings counted") && runwayText(ETB.listings).includes("not a runway") && runwayText(null) === "No listings counted");
t("sealed has no condition", !/\bNM\b|Near Mint|Lightly Played/.test(html));
const page = previewPage("dark");
t("wordmark on the page", page.includes("Catch'em") && page.includes("151 Elite Trainer Box"));
t("copy is clean", !/[\u2014\u2013]/.test(page) && !BANNED.test(page) && !page.includes("Supply runway"));
const wired = readFileSync(new URL("../src/index.mjs", import.meta.url), "utf8");
t("paint is behind the flag", wired.includes("productOn(env)"));

if (fail) { console.log(fail + " failed"); process.exit(1); }
console.log("product v2 ok");
