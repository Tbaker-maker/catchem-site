// Phone product hero: the bottom dock must not cover the listings chip,
// the chip must not clip, and set / dive / print-run links are at least 44px.
import { renderCard } from "../src/ui.mjs";

let fail = 0;
const t = (name, ok) => { console.log(`${ok ? "  ok " : "  FAIL"} ${name}`); if (!ok) fail++; };

const listingSeries = [
  ["2026-10-23", 128], ["2026-10-30", 137],
].map(([date, listingCount]) => ({ date, listingCount }));

const sealed = renderCard({
  id: "tcgcsv-277335",
  name: "Lost Origin Elite Trainer Box",
  kind: "sealed",
  set: "SWSH11: Lost Origin",
  setSlug: "lost-origin",
  price: 194.33,
  asOf: "2026-10-30",
  source: "TCGplayer market",
  hist: [["2026-10-01", 190], ["2026-10-30", 194.33]],
}, "stamp", { listingSeries, diveHref: "/dive/lost-origin-etb" });

const main = sealed.slice(sealed.indexOf("<main"), sealed.indexOf("</main>"));
const stripAt = main.indexOf('class="sum-strip"');
const shopAt = main.indexOf('<div class="shop-block">');
const watchAt = main.indexOf('<p class="rv-actions">');

t("the listings chip is in the hero", stripAt > 0 && main.includes("137 listings counted"));
t("the listings chip comes before Watch, Share, and Buy, so it sits above the dock at 390", stripAt > 0 && stripAt < shopAt && stripAt < watchAt);
t("set link, Deeper look, and See the chart are 44px tap targets", sealed.includes('class="set-link"') && sealed.includes('class="dive-links"') && sealed.includes(">Deeper look</a>") && sealed.includes(">See the chart</a>"));

// CSS lives in the page chrome, so read it from the rendered HTML.
const style = (sealed.match(/<style>([\s\S]*?)<\/style>/g) || []).join("\n");
t("mobile sum-strip stacks instead of a two-column grid that clips the chip", style.includes(".sum-strip{flex-direction:column") && !style.includes("grid-template-columns:1fr 1fr") || (style.includes("@media(max-width:600px){.sum-strip{flex-direction:column") && !/sum-strip\{display:grid;grid-template-columns:1fr 1fr/.test(style)));
t("sum-chip can wrap and stays inside the page width", /sum-chip\{[^}]*white-space:normal/.test(style) && /sum-chip\{[^}]*max-width:100%/.test(style));
t("set, print-run, dive, open-data, and footer legal links are at least 44px tall", /set-link,\.print-run a,\.dive-links a,\.open-data,\.legal-links a\{min-height:44px/.test(style));

const card = renderCard({
  id: "tcgcsv-88635",
  name: "Rayquaza - 026/110 (Delta Species)",
  kind: "single",
  set: "EX Holon Phantoms",
  setSlug: "ex-holon-phantoms",
  price: 99.08,
  asOf: "2026-10-30",
  source: "TCGplayer market",
  hist: [["2026-10-01", 90], ["2026-10-30", 99.08]],
}, "stamp", {});
const cardMain = card.slice(card.indexOf("<main"), card.indexOf("</main>"));
const cardPrice = cardMain.indexOf('class="cp-now"');
const cardShop = cardMain.indexOf('<div class="shop-block">');
const cardWatch = cardMain.indexOf('<p class="rv-actions">');
t("card pages put the price before Buy and Watch", cardPrice > 0 && cardPrice < cardShop && cardPrice < cardWatch);
t("card set link is a 44px target", card.includes('class="set-link"') && card.includes("/sets/ex-holon-phantoms"));
const readAt = main.indexOf('class="muted add-read"');
t("add this to your read sits above Watch so the dock does not cover it", readAt > 0 && readAt < watchAt);
t("phone pages keep the dock clear and Status is a 44px target", style.includes("padding-bottom:88px") && style.includes("padding-bottom:calc(120px + env(safe-area-inset-bottom))") && /a\.tap,\.site-foot a\{min-height:44px;min-width:44px/.test(style));
t("the set kicker is a 44 by 44 box", /set-link,\.print-run a[\s\S]*?min-height:44px;min-width:44px;display:inline-flex;align-items:center;box-sizing:border-box;padding:10px 12px/.test(style));
const cardStyle = (card.match(/<style>([\s\S]*?)<\/style>/g) || []).join("\n");
t("card set name link is at least 44px tall and wide", /cp-set a\{[^}]*min-height:44px;min-width:44px;padding:10px 12px/.test(cardStyle));

if (fail) process.exit(1);
console.log("mobile hero ok");
