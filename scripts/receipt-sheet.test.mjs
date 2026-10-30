import { readFileSync } from "node:fs";
import { banGuard } from "../src/advice-rules.mjs";
import { ETB_RECEIPT, FLAG, injectReceipt, money, previewPage, receiptModel, receiptOn } from "../src/receipt-sheet.mjs";

let fail = 0;
const t = (name, ok) => { console.log((ok ? "ok   " : "FAIL ") + name); if (!ok) fail++; };
const BANNED = banGuard("receipt-sheet", /\bsolds?\b|Collectr|\bNM\b/i);

t("flag name", FLAG === "TF_RECEIPT");
t("flag defaults off", receiptOn({}) === false && receiptOn({ TF_RECEIPT: "off" }) === false);
t("flag on is exact", receiptOn({ TF_RECEIPT: "on" }) === true && receiptOn({ TF_RECEIPT: "ON" }) === true);
t("missing price is not zero", money(0) === "No price" && money(null) === "No price" && !money(undefined).includes("0"));
const blank = receiptModel({ name: "Empty", missing: true, sealed: true });
t("blank receipt says no price", blank.price === "No price" && blank.listings === "No listings counted");
t("etb receipt has source date listings method", ETB_RECEIPT.price === "$497.13" && ETB_RECEIPT.source === "TCGplayer market" && ETB_RECEIPT.date === "Oct 29, 2026" && ETB_RECEIPT.listings.includes("117 listings counted") && ETB_RECEIPT.method.includes("Not an average") && ETB_RECEIPT.method.includes("eBay listings counted"));
const page = previewPage("dark");
t("page has wordmark and sheet", page.includes("Catch'em") && page.includes("tf-receipt") && page.includes("Listings counted") && page.includes("min-height:44px"));
t("inject once", injectReceipt(injectReceipt("<html><body>Hi</body></html>")).match(/data-tf-receipt/g).length === 1);
const copy = page + ETB_RECEIPT.price + ETB_RECEIPT.listings + ETB_RECEIPT.method;
t("copy is clean", !/[\u2014\u2013]/.test(copy) && !BANNED.test(copy));
const wired = readFileSync(new URL("../src/index.mjs", import.meta.url), "utf8");
t("worker stays quiet unless the flag is on", wired.includes("if (!receiptOn(env)) return res;"));

if (fail) { console.log(fail + " failed"); process.exit(1); }
console.log("receipt sheet ok");
