// Product and card share tags: unique titles, dated descriptions, canonical URLs,
// Product JSON-LD offers only when a real price is on the page, and no invented
// ratings or sold counts.
import { addShareMeta, extractMarketPrice, productPageTitle, setAlreadyInName } from "../src/seo.mjs";
import { withReleasesInSitemap, withTrackInSitemap } from "../src/index.mjs";

let fail = 0;
const t = (name, cond) => { console.log(`${cond ? "  ok " : "  FAIL"} ${name}`); if (!cond) fail++; };

const ldBlocks = (html) => [...String(html).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const ldOf = (html, type) => ldBlocks(html).find((o) => o["@type"] === type) || null;

t("set name inside the product name is not repeated", setAlreadyInName("Lost Origin Elite Trainer Box", "SWSH11: Lost Origin") && setAlreadyInName("Prismatic Evolutions Elite Trainer Box", "SV8.5: Prismatic Evolutions") && !setAlreadyInName("Elite Trainer Box", "Prismatic Evolutions"));

const etb = `<html><head><title>Prismatic Evolutions Elite Trainer Box · Catch'em</title></head><body>
<p class="muted"><a href="/sets/sv8pt5-prismatic-evolutions">SV8.5: Prismatic Evolutions</a> · Sealed</p>
<h1>Prismatic Evolutions Elite Trainer Box</h1>
<div data-rv-price="49.99" data-rv-date="2026-11-11"></div>
<img alt="Prismatic Evolutions Elite Trainer Box" loading="eager" src="/data/cutouts/sv8pt5-etb.webp">
<section class="item-sec" id="related"><h2>Related items</h2><div class="rel-grid"><a href="/p/tcgcsv-111"><b>Prismatic Evolutions Booster Bundle</b></a></div></section>
</body></html>`;
const etbMeta = addShareMeta(etb, "/p/tcgcsv-999001", "product");
const etbTitle = "Prismatic Evolutions Elite Trainer Box price · Sealed · $49.99 on Nov 11, 2026 · Catch'em";
const etbDesc = "Prismatic Evolutions Elite Trainer Box (sealed) in SV8.5: Prismatic Evolutions: $49.99 TCGplayer market on Nov 11, 2026. Price chart and 12-month range on Catch'em.";
t("product title names the product, type, and dated price", etbMeta.includes(`<title>${etbTitle}</title>`));
t("product meta description includes set, type, price and date", etbMeta.includes(`name="description" content="${etbDesc}"`));
t("product canonical points at the product path", etbMeta.includes('<link rel="canonical" href="https://catchemtcg.com/p/tcgcsv-999001">'));
t("product Open Graph and X tags use the composed PNG, not the hero", etbMeta.includes(`property="og:title" content="${etbTitle}"`) && etbMeta.includes(`property="og:description" content="${etbDesc}"`) && etbMeta.includes('property="og:type" content="product"') && etbMeta.includes('property="og:image" content="https://catchemtcg.com/og/product.png?') && etbMeta.includes('property="og:image:width" content="1200"') && etbMeta.includes('property="og:image:height" content="630"') && etbMeta.includes('name="twitter:card" content="summary_large_image"') && etbMeta.includes('name="twitter:image" content="https://catchemtcg.com/og/product.png?') && !etbMeta.includes('twitter:image" content="https://catchemtcg.com/data/cutouts/sv8pt5-etb.webp"') && etbMeta.includes("Prismatic+Evolutions+Elite+Trainer+Box") && etbMeta.includes("49.99") && etbMeta.includes("Nov+11%2C+2026") && etbMeta.includes("TCGplayer+market"));
t("set name already in the product name is not repeated in the title", (etbMeta.match(/<title>([^<]*)<\/title>/)||[])[1] === etbTitle && !etbTitle.includes("SV8.5"));

const product = ldOf(etbMeta, "Product");
const crumbs = ldOf(etbMeta, "BreadcrumbList");
t("product JSON-LD keeps the set breadcrumb", !!(crumbs && crumbs.itemListElement.some((x) => x.item === "https://catchemtcg.com/sets/sv8pt5-prismatic-evolutions")));
t("product JSON-LD Offer uses the real market price only", !!(product && product.offers && product.offers["@type"] === "Offer" && product.offers.price === "49.99" && product.offers.priceCurrency === "USD" && product.offers.seller && product.offers.seller.name === "TCGplayer" && product.offers.url === "https://catchemtcg.com/p/tcgcsv-999001"));
t("product JSON-LD does not invent ratings, reviews, or sold counts", !!(product && !("aggregateRating" in product) && !("review" in product) && !("reviewCount" in product) && !(product.offers && ("offerCount" in product.offers)) && !/sold/i.test(JSON.stringify(product)) && !/condition/i.test(JSON.stringify(product))));
t("product JSON-LD has no condition label on sealed", !!(product && !product.itemCondition && !(product.offers && product.offers.itemCondition)));

const bare = `<html><head><title>Mystery Box · Catch'em</title></head><body><h1>Mystery Box</h1><p>Price being checked</p></body></html>`;
const bareMeta = addShareMeta(bare, "/p/tcgcsv-000", "product");
const bareProduct = ldOf(bareMeta, "Product");
t("a product with no price has no Offer and no invented price", !!(bareProduct && !bareProduct.offers && bareMeta.includes("<title>Mystery Box price · Sealed · Catch'em</title>") && !/\$[0-9]/.test(bareMeta.match(/<meta name="description"[^>]*>/)[0])));
t("extractMarketPrice ignores a missing price", extractMarketPrice(bare) === null);

const card = `<html><head><title>Charizard · Catch'em</title></head><body><p class="cp-set"><a href="/sets/base-set">Base Set</a> · #4</p><img alt="Charizard" loading="eager" src="/data/editor/tcg/base1/4_hires.png"><span>$968.91</span><span>Oct 13, 2026</span></body></html>`;
const cardMeta = addShareMeta(card, "/c/tcgcsv-42382", "card");
const cardTitle = "Charizard price · Card · Base Set · $968.91 on Oct 13, 2026 · Catch'em";
t("card title includes set, type and dated price", cardMeta.includes(`<title>${cardTitle}</title>`) && cardMeta.includes('og:title" content="' + cardTitle + '"'));
t("card description names the set and dated market price", cardMeta.includes("Charizard (card) in Base Set: $968.91 TCGplayer market on Oct 13, 2026"));
const cardProduct = ldOf(cardMeta, "Product");
t("card JSON-LD Offer is present only for the real price", !!(cardProduct && cardProduct.offers && cardProduct.offers.price === "968.91" && cardProduct.category === "Base Set"));

t("productPageTitle omits a redundant set", productPageTitle("product", "Lost Origin Elite Trainer Box", { money: "$194.33", date: "Oct 30, 2026" }, "SWSH11: Lost Origin") === "Lost Origin Elite Trainer Box price · Sealed · $194.33 on Oct 30, 2026 · Catch'em");

const listingsTrap = `<html><head><title>Lost Origin Elite Trainer Box · Catch'em</title></head><body><div data-rv-price="194.33" data-rv-date="2026-10-30"></div><img loading="eager" src="/data/sealed-cutouts/x.svg"><p class="sum-strip"><span class="sum-chip">$194.33 · Oct 30</span><span class="sum-chip">137 listings counted, Oct 30 <span aria-label="Up 0.7% since Oct 29, 2026">▲ 0.7%</span></span></p></body></html>`;
const trapMeta = addShareMeta(listingsTrap, "/p/tcgcsv-277335", "product");
t("share description still uses the page's own price date", trapMeta.includes("$194.33 TCGplayer market on Oct 30, 2026") && !trapMeta.includes("Oct 29, 2026. Price"));
t("a product share image is the PNG card even when the hero is SVG", trapMeta.includes('og:image" content="https://catchemtcg.com/og/product.png?') && trapMeta.includes('twitter:image" content="https://catchemtcg.com/og/product.png?') && trapMeta.includes('og:image:height" content="630"') && !trapMeta.includes("og.png"));

const set = addShareMeta(`<html><head><title>ME06: Delta Reign · Catch'em</title></head><body></body></html>`, "/sets/me06-delta-reign", "set");
t("set pages keep their own title and get no Product offer", set.includes("<title>ME06: Delta Reign · Catch'em</title>") && set.includes('og:title" content="ME06: Delta Reign · Catch\'em"') && set.includes("in ME06: Delta Reign") && !ldOf(set, "Product"));

const coreMap = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://catchemtcg.com/feed</loc></url>\n</urlset>`;
const filled = await withReleasesInSitemap(new Response(coreMap, { status: 200, headers: { "content-type": "application/xml" } }));
const filledText = await filled.text();
for (const path of ["/", "/releases", "/weekly", "/scanner", "/heatmap", "/indexes"]) {
  const loc = `<loc>https://catchemtcg.com${path === "/" ? "/" : path}</loc>`;
  t(`sitemap-00 gains ${path}`, filledText.includes(loc) && (filledText.match(new RegExp(loc.replace(/\//g, "\\/"), "g")) || []).length === 1);
}
t("sitemap does not invent a /promos URL while that page is down", !filledText.includes("/promos"));
const withHome = `<?xml version="1.0"?><urlset><url><loc>https://catchemtcg.com/</loc></url>\n</urlset>`;
const again = await withReleasesInSitemap(new Response(withHome, { status: 200 }));
const againText = await again.text();
t("homepage is listed once when it was already in the map", (againText.match(/<loc>https:\/\/catchemtcg\.com\/<\/loc>/g) || []).length === 1);

const tracked = await withTrackInSitemap(new Response(againText, { status: 200 }), false, true);
const trackedText = await tracked.text();
t("closed track-record stays out of the core sitemap", !trackedText.includes("/track-record") && trackedText.includes("<loc>https://catchemtcg.com/</loc>"));

if (fail) { console.log(`${fail} failed`); process.exit(1); }
console.log("seo-product: all passed");
