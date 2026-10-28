// LOCK.md gates as CI (2026-10-27). Notes are not tests.
import { readFileSync } from "node:fs";
import { BRAND, allowedImageUrl } from "../src/brand.mjs";
import {
  ALLOWED_IMAGE_HOSTS,
  MIRROR_NOTE,
  SITE_FOOTER,
  brandPage,
  brandShareSvg,
  heatmapHtml,
  sealedShareCard,
  pulseShareCard,
} from "../src/brand-visuals.mjs";

let fail = 0;
const t = (name, cond) => {
  console.log(`${cond ? "  ok " : "  FAIL"} ${name}`);
  if (!cond) fail += 1;
};

const ui = readFileSync(new URL("../src/ui.mjs", import.meta.url), "utf8");
const index = readFileSync(new URL("../src/index.mjs", import.meta.url), "utf8");
const brand = readFileSync(new URL("../src/brand-visuals.mjs", import.meta.url), "utf8");
const data = readFileSync(new URL("../src/data.mjs", import.meta.url), "utf8");

t("Ask spread filter stays off", !/Ask spread/.test(ui) || /Ask spread/.test(ui) && /filters.*Ask/.test(ui) === false);
// Stronger: feed filter chips must not include Ask spread / Ask moved as live labels in filter UI builders
t("no Ask moved filter chip string in ui filter builders", !ui.includes('"Ask moved"') && !ui.includes("'Ask moved'"));
t("no Ask spread filter chip string", !ui.includes('"Ask spread"') && !ui.includes("'Ask spread'"));

t("sealed chart never falls back to priceMedian as Median ask", /Never fall back to priceMedian as Median ask/.test(ui));
t("product page prefers TCGplayer market when no eBay ask", ui.includes('hasAsk ? "Median ask, daily" : "TCGplayer market, daily"'));
t("eBay ask copy uses listings counted", ui.includes("eBay listings counted") || ui.includes("listings counted"));

t("heatmap down tint class ships", brand.includes("bv-down") && heatmapHtml().includes("bv-cell bv-down"));
t("mirror note labels Pulse history before Oct 14", MIRROR_NOTE.includes("Oct 14, 2026") && MIRROR_NOTE.includes("mirrored third-party"));
t("footer requires source and date", SITE_FOOTER.includes("source and date"));

const sealed = sealedShareCard();
const svg = brandShareSvg(sealed);
t("share card clips product into a plate", brand.includes('clipPath id="shareImg"') && svg.includes("clip-path") && svg.includes('fill="#cfc6b6"'));
t("share card names source and date", Boolean(sealed.source) && Boolean(sealed.date) && svg.includes(sealed.source));
t("share card uses Catch'em mark", svg.includes(BRAND.wordmark) && svg.includes(BRAND.gold));

t("pokemontcg.io and tcgplayer CDN are allowed hosts", ALLOWED_IMAGE_HOSTS.includes("images.pokemontcg.io") && ALLOWED_IMAGE_HOSTS.includes("product-images.tcgplayer.com") || ALLOWED_IMAGE_HOSTS.some((h) => /tcgplayer/.test(h)));
t("ebay CDN images are rejected", allowedImageUrl("https://i.ebayimg.com/images/g/x.jpg") === "");

t("dive and derived skip public-data probe", data.includes("mainOnlyPath") && data.includes("research/pulse/") && data.includes("data/derived/"));
t("brand page is TCGplayer market", /TCGplayer market/.test(brandPage()));
t("no em or en dash in lock surfaces", !/[\u2013\u2014]/.test(MIRROR_NOTE + SITE_FOOTER + brandPage()));

if (fail) {
  console.error(`lock-regression: ${fail} failed`);
  process.exit(1);
}
console.log("lock-regression: all passed");
