import { readFileSync } from "node:fs";
import { glanceChips, interestScore, listingsWording, rankLead } from "../src/feed-rank.mjs";
import { renderFeed } from "../src/ui.mjs";

let fail = 0;
const t = (name, ok) => { if (ok) console.log("  ok ", name); else { fail++; console.log("  FAIL", name); } };

const cent = {
  id: "solddown-tcgcsv-1",
  readKind: "solddown",
  kind: "solddown",
  name: "Cinderace ex",
  set: "Prismatic Evolutions",
  price: 0.83,
  asOf: "2026-10-16",
  headline: "Cinderace ex: 12 Near Mint copies sold over Oct 10 to Oct 16 and the market price went from $0.84 to $0.83.",
  path: "Cinderace ex: 12 Near Mint copies sold over Oct 10 to Oct 16 and the market price went from $0.84 to $0.83.",
  receipt: { sold: 12, fromPrice: 0.84, toPrice: 0.83 },
};
const box = {
  id: "sealed-week-tin",
  readKind: "sealed",
  kind: "sealed",
  name: "151 Mini Tin Display Case",
  set: "SV: Scarlet & Violet 151",
  price: 1886.95,
  changePct: -16.7,
  href: "/p/sv3pt5-mini-tin-case",
  headline: "151 Mini Tin Display Case: $2,265.93 (Oct 12) to $1,886.95 (Oct 19) on TCGplayer market. Down 17%.",
  receipt: { from: 2265.93, to: 1886.95 },
  signals: [{ kind: "move", strength: 5 }],
};
t("a cent move ranks under a sealed dollar move", interestScore(cent) > 0 && interestScore(cent) < interestScore(box));
t("the lead opens on the sealed read", rankLead([cent, box]).lead[0].id === "sealed-box" || rankLead([cent, box]).lead[0].id === box.id);
t("sold and sales become listings counted", !/\b(sold|sales)\b/i.test(listingsWording(cent.headline)) && listingsWording(cent.headline).includes("listings counted") && listingsWording("Asks are not sales.").includes("listings gone"));
const chips = glanceChips(cent);
t("a read with no signal row still has quick chips", chips.includes('class="qrow"') && chips.includes("qchip") && chips.includes("listings counted") && chips.includes("$0.83") && chips.includes("%"));
t("chip markup has no sold wording and no dash", !/\b(sold|sales)\b/i.test(chips) && !/[\u2013\u2014]/.test(chips));
const css = readFileSync(new URL("../src/signal-chips.mjs", import.meta.url), "utf8");
const ui = readFileSync(new URL("../src/ui.mjs", import.meta.url), "utf8");
t("fast mode does not hide the one-line", !css.includes(".is-fast .one-line{display:none") && !css.includes(".is-fast .sig-blurb,.is-fast .one-line") && ui.includes(".is-fast .one-line{display:block}"));
t("fast mode stays off until stored", css.includes('localStorage.getItem("catchem-fast") === "1"') && css.includes('aria-pressed="false"'));
t("glance chips are 44px, wrap, and stay inside 390", ui.includes(".qchip{display:inline-flex") && ui.includes("min-height:44px") && ui.includes("flex-wrap:wrap") && ui.includes("max-width:100%"));
const page = renderFeed({ reads: [cent, box] }, "", "Oct 19");
t("the feed page carries the chip renderer and the interest lead", page.includes("function glanceChips") && page.includes("function rankLead") && page.includes("Interest leads the feed.") && page.includes('id="feed-lead-order"'));
t("the inlined lead opens on the stronger read", page.indexOf(box.id) < page.indexOf(cent.id));

if (fail) process.exit(1);
