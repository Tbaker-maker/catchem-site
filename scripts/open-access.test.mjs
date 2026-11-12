// OPEN_ACCESS default: every visitor gets paid features, with no plan price
// or Premium CTA on user-facing pages. The switch is reversible.
import { readFile } from "node:fs/promises";
import worker, { pageKind } from "../src/index.mjs";
import { openAccess, entitled, paywallHit, paintOpenAccessHtml, FOLLOW_CAP } from "../src/open-access.mjs";
import { ratingPanel } from "../src/card-rating.mjs";
import { sealedRatingPanel } from "../src/sealed-rating.mjs";
import { watchlistBody } from "../src/ir-cycle.mjs";
import { gatePlan, renderReadsPage } from "../src/reads.mjs";
import { renderSearch, renderMethod, setOpenAccess } from "../src/ui.mjs";
import { renderAlerts, renderAccount } from "../src/member.mjs";
import { paintPublicHtml, premiumEmailBlock, premiumPlainLine } from "../src/premium-mode.mjs";
import { peek } from "../src/quota.mjs";

let fail = 0;
const t = (name, ok) => { if (!ok) { fail++; console.log("FAIL", name); } else console.log("ok  ", name); };

t("default is on", openAccess() === true && openAccess({}) === true && openAccess({ OPEN_ACCESS: "" }) === true);
t("only false, 0, or off turns it off", openAccess({ OPEN_ACCESS: "false" }) === false && openAccess({ OPEN_ACCESS: "0" }) === false && openAccess({ OPEN_ACCESS: "off" }) === false && openAccess({ OPEN_ACCESS: "live" }) === true);
t("entitled defaults open even when premium is false", entitled({ premium: false }) === true);
t("entitled respects the switch", entitled({ premium: false, openAccess: false }) === false && entitled({ premium: true, openAccess: false }) === true);
t("follow cap stays 25", FOLLOW_CAP === 25);

const row = { id: "tcgcsv-1", name: "X", groupLabel: "holos", verdict: "Priced below similar cards", price: { price: 10, date: "2026-10-12" }, peers: { median: 12, n: 8 }, factors: { peer: { v: 0.5, fact: "a" } } };
t("rating bars are open by default", /class="bar"/.test(ratingPanel(row, { asOf: "2026-10-12" }, { premium: false })) && !/Premium/.test(ratingPanel(row, { asOf: "2026-10-12" }, {})));

const sealed = { id: "tcgcsv-2", typeLabel: "booster box", verdict: "Low price next to its set's top card", price: { price: 100, date: "2026-10-12" }, factors: { chase: { v: 0.9 } } };
t("sealed bars are open by default", /class="bar"/.test(sealedRatingPanel(sealed, { asOf: "2026-10-12" }, {})));

const watchDoc = { asOf: "2026-10-12", rows: Array.from({ length: 6 }, (_, i) => ({ id: "tcgcsv-" + i, name: "Card " + i, set: "S", kind: "SIR", num: "1/1", release: "2026-01-01", daysSinceRelease: 1, price: { price: 3, date: "2026-10-12" }, low: { price: 2, date: "2026-10-01" }, high: { price: 9, date: "2026-04-01" }, onFileSince: "2026-02-01", position: "Mid", curve: { text: "c" }, lifts: [] })) };
const watch = watchlistBody(watchDoc, { premium: false });
t("watchlist shows every row", (watch.match(/class="wl-row"/g) || []).length === 6 && !/See it with Premium/.test(watch));

const daily = gatePlan({ frequency: "daily", sets: ["me-30th-celebration"], length: "deep" }, { premium: false });
t("reads keep daily and deep", daily.plan.frequency === "daily" && daily.plan.length === "deep" && daily.plan.deep === true);

const readsPage = renderReadsPage({ signedIn: false, premium: false });
t("reads page has no Premium CTA", !/href="\/premium"/.test(readsPage) && !/in Premium/.test(readsPage) && /daily read and up to 25 follows/.test(readsPage));

t("quota uses the paid cap", peek({ sub: "u1", premium: false }, "ideas", {}).cap === 50 && peek({ sub: "u1", premium: false }, "post-text", {}).cap === 100);
t("quota restores the free cap when the switch is off", peek({ sub: "u1", premium: false }, "ideas", { OPEN_ACCESS: "false" }).cap === 3);

t("email upsell is silent when open", premiumEmailBlock("open") === "" && premiumPlainLine("open") === "");

const home = await readFile(new URL("../index.html", import.meta.url), "utf8");
const painted = paintPublicHtml(home, "/", {});
t("painted home has no paywall copy", paywallHit(painted) === "");
t("paint helper strips the club", !paintOpenAccessHtml(home).includes("Join the Catch'em Club"));

setOpenAccess(true);
const pages = [
  ["home", painted],
  ["search", renderSearch({ query: "" })],
  ["methodology", renderMethod({}, "")],
  ["alerts", renderAlerts("")],
  ["account", renderAccount("")],
  ["reads", readsPage],
  ["watchlist", watch],
];
for (const [name, html] of pages) {
  const hit = paywallHit(html);
  t(`${name} has no Premium / $14.99 / $9 plan copy`, hit === "");
  if (hit) console.log("   hit:", hit);
}

const assets = { fetch: async () => new Response(home, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }) };
const env = { ASSETS: assets, PUBLIC_FETCH: async () => new Response("no", { status: 404 }) };
const prem = await worker.fetch(new Request("https://catchemtcg.com/premium"), env);
t("/premium redirects home while open", prem.status === 302 && new URL(prem.headers.get("location"), "https://catchemtcg.com").pathname === "/" && pageKind("/premium") === "premium");
const homeLive = await (await worker.fetch(new Request("https://catchemtcg.com/"), env)).text();
t("live worker home has no paywall copy", paywallHit(homeLive) === "");

// Reversibility: checkout pages still exist when the switch is off.
const gated = await worker.fetch(new Request("https://catchemtcg.com/premium"), { ...env, OPEN_ACCESS: "false", PREMIUM_MODE: "live" });
const gatedHtml = await gated.text();
t("switch off + live still serves the checkout page", gated.status === 200 && gatedHtml.includes("$14.99") && gatedHtml.includes("Get Premium"));

if (fail) { console.log(`open-access: ${fail} failed`); process.exit(1); }
console.log("open-access ok");
