// Brand on the Sealed Market Pulse heatmap and the share cards.
import { banGuard } from "../src/advice-rules.mjs";
import { BRAND, allowedImageUrl } from "../src/brand.mjs";
import { shareSvg } from "../src/share-card.mjs";
import {
  ALLOWED_IMAGE_HOSTS,
  BASELINE,
  KIND_HEIGHT,
  PULSE_SAMPLE,
  brandPage,
  brandShareSvg,
  heatmapHtml,
  kindHeight,
  legacyPage,
  pctLabel,
  productImage,
  pulseShareCard,
  sealedShareCard,
  rowsFromPulseDoc,
  brandPageFromDoc,
  MIRROR_NOTE, SITE_FOOTER,
} from "../src/brand-visuals.mjs";

const DASH = /[\u2014\u2013]/;
const NM = /\bNM\b|Near Mint/i;
const SOLD = /\bsold\b|\bsales\b/i;

function visible(html) {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function runBrandVisualTests() {
  let fail = 0;
  const t = (name, cond) => {
    console.log(`${cond ? "  ok " : "  FAIL"} ${name}`);
    if (!cond) fail += 1;
  };
  const guard = banGuard("brand-visuals");
  const page = brandPage();
  const legacy = legacyPage();
  const heat = heatmapHtml();
  const pulse = pulseShareCard();
  const sealed = sealedShareCard();
  const pulseSvg = brandShareSvg(pulse);
  const sealedSvg = brandShareSvg(sealed);
  const text = [visible(page), visible(pulseSvg), visible(sealedSvg)].join(" ");

  t("one paper, ink, and gold", BRAND.paper === "#12100e" && BRAND.ink === "#efe9de" && BRAND.gold === "#d9b779" && BRAND.wordmark === "Catch'em");
  t("system font, not a retro face", BRAND.font.includes("apple-system") && !BRAND.font.includes("Georgia") && page.includes(BRAND.font) && !page.includes("Georgia"));
  t("heatmap uses the mark", page.includes(BRAND.wordmark) && page.includes(BRAND.paper) && page.includes(BRAND.gold) && page.includes("border-radius:22px"));
  t("phone cells stay readable", page.includes("font-size:15px") && page.includes("min-height:44px") && page.includes("min-width:44px"));

  const stages = [...heat.matchAll(/data-baseline="(\d+)" data-kind="([^"]+)" data-h="(\d+)"/g)].map((m) => ({
    baseline: Number(m[1]),
    kind: m[2],
    h: Number(m[3]),
  }));
  const box = Math.max(...stages.filter((s) => s.kind === "booster-box").map((s) => s.h));
  const etb = Math.max(...stages.filter((s) => s.kind === "etb").map((s) => s.h));
  t("booster boxes are bigger than ETBs", box === KIND_HEIGHT["booster-box"] && etb === KIND_HEIGHT.etb && box > etb);
  t("shared baseline", stages.length === 4 && stages.every((s) => s.baseline === BASELINE) && page.includes("align-items:flex-end"));
  t("kind heights stay ordered", kindHeight("booster-box") > kindHeight("pc-etb") && kindHeight("pc-etb") > kindHeight("etb"));

  const srcs = [...heat.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
  t("product images use allowed hosts only", srcs.length === 4 && srcs.every((src) => {
    try {
      return ALLOWED_IMAGE_HOSTS.includes(new URL(src).hostname);
    } catch {
      return false;
    }
  }));
  t("a foreign image is dropped", productImage({ image: "https://i.ebayimg.com/images/g/x.jpg", tcgPlayerId: null }) === "" && allowedImageUrl("https://evil.example/a.png") === "");
  const blocked = heatmapHtml([{ ...PULSE_SAMPLE[0], tcgPlayerId: null, image: "https://i.ebayimg.com/images/g/x.jpg", logo: "http://images.pokemontcg.io/swsh7/logo.png" }]);
  t("ebay and plain http never render", !blocked.includes("ebayimg") && !blocked.includes("<img") && !blocked.includes("http://images.pokemontcg.io"));

  t("october box and a missing month stay the figures on file", heat.includes("-5.1%") && heat.includes("No reading") && heat.includes("2214") === false && heat.includes("-6.4%"));
  t("median is the october figure", pctLabel(-1.6587) === "-1.7%" && heat.includes("-1.7%"));
  t("down months get a red wash", heat.includes("bv-cell bv-down") && /bv-down" style="--wash:0\.[1-4]/.test(heat));
  t("no em or en dash, no advice, no sold", !DASH.test(text) && !guard.test(text) && !SOLD.test(text));
  t("sealed share has no NM", sealed.sealed === true && pulse.sealed === true && !NM.test(sealedSvg) && !NM.test(pulseSvg) && !NM.test(visible(heat)));
  t("share cards use the same mark", pulseSvg.includes(BRAND.gold) && pulseSvg.includes(BRAND.paper) && pulseSvg.includes("Catch'em") && pulseSvg.includes("catchemtcg.com/sealed-pulse") && pulseSvg.includes(pulse.source) && pulseSvg.includes(pulse.date) && pulseSvg.includes('font-size="156"'));
  t("share cards stay compact with no giant watermark", pulseSvg.includes('viewBox="0 0 1080 1080"') && !pulseSvg.includes('fill-opacity="0.07"') && sealedSvg.includes('viewBox="0 0 1080 1080"'));
  t("sealed share carries a product image", Boolean(sealed.imageUrl) && sealedSvg.includes("<image ") && sealedSvg.includes("tcgplayer-cdn"));
  t("product images get a drop shadow so white boxes read", page.includes("drop-shadow"));
  t("stage plate keeps white ETBs readable", page.includes("rgba(239,233,222,.06)") && KIND_HEIGHT.etb >= 54);

  const og = shareSvg(new URLSearchParams("n=Evolving%20Skies%20Booster%20Box&p=2214.94&s=1"));
  t("public share card uses the same gold and font", og.includes(BRAND.gold) && og.includes(BRAND.font) && og.includes("Catch'em") && !og.includes("#d4af37") && !og.includes("Georgia") && !NM.test(og));
  t("before is the old equal square", legacy.includes("height:36px") && legacy.includes("#3ddc84") && legacy.includes("#ff7b72") && !legacy.includes(BRAND.gold) && !legacy.includes("data-h=\"72\""));

  t("phone layout has no sticky column to overlap", /@media \(max-width:520px\)\{[\s\S]*\.bv-name\{grid-column:1\/-1;position:static/.test(page) && page.includes("min-width:0}"));
  const dates = (svg) => (visible(svg).match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}/g) || []);
  t("one date per share card", dates(sealedSvg).length === 1 && dates(pulseSvg).length === 1);
  t("page date stays Oct 27, 2026", visible(page).includes("Oct 27, 2026"));

  const liveDoc = {
    asOf: "2026-10-27",
    source: "TCGplayer market",
    about: "History before Oct 14 2026 comes from archived TCGplayer market prices.",
    marketMedian: { "2026-09": -0.8687, "2026-10": -1.6587 },
    rows: [
      {
        id: "swsh7-booster-box",
        name: "Evolving Skies Booster Box",
        set: "Evolving Skies",
        type: "booster-box",
        tcgPlayerId: "242436",
        cells: [
          { month: "2026-09", pct: -6.4146, price: 2296.51, priceDate: "2026-09-30", priceSource: "archived-market" },
          { month: "2026-10", pct: -5.1195, price: 2178.94, priceDate: "2026-10-27", priceSource: "tcgcsv-daily" },
        ],
      },
    ],
  };
  const liveRows = rowsFromPulseDoc(liveDoc);
  t("live doc keeps Sep 30 archive month end", liveRows[0].cells[0].price === 2296.51 && liveRows[0].cells[0].priceDate === "2026-09-30" && liveRows[0].cells[0].priceSource === "archived-market");
  t("live doc Oct is own print", liveRows[0].cells[1].price === 2178.94 && liveRows[0].cells[1].priceDate === "2026-10-27");
  const livePage = brandPageFromDoc(liveDoc);
  t("live page names the mirror note and sealed-pulse URL", livePage.includes(MIRROR_NOTE) && livePage.includes("sealed-pulse") && livePage.includes("-6.4%") && livePage.includes("-5.1%"));

  t("mirror note names Oct 14 cutoff", MIRROR_NOTE.includes("Oct 14, 2026") && MIRROR_NOTE.includes("mirrored third-party"));
  t("site footer is informational", SITE_FOOTER.includes("informational") && SITE_FOOTER.includes("source and date"));
  t("brand page shows mirror note and footer", page.includes(MIRROR_NOTE) && page.includes(SITE_FOOTER) && livePage.includes(SITE_FOOTER));
  t("footer has no sold wording", !/\bsold\b/i.test(SITE_FOOTER) && !/[\u2013\u2014]/.test(SITE_FOOTER + MIRROR_NOTE));
  t("mirrored cell names source and read date", livePage.includes("mirrored third-party") && livePage.includes("archived-market"));

  if (fail) console.log(`brand visuals: ${fail} failed`);
  else console.log("brand visuals: all passed");
  return fail;
}



const isMain = process.argv[1] && process.argv[1].endsWith("brand-visuals.test.mjs");
if (isMain) {
  const fail = runBrandVisualTests();
  if (fail) process.exit(1);
}
