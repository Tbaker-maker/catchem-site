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

  t("october box and a missing month stay the figures on file", heat.includes("-4.1%") && heat.includes("+5.7%") && heat.includes("No reading") && heat.includes("2214") === false);
  t("median is the october figure", pctLabel(-1.055) === "-1.1%" && heat.includes("-1.1%"));
  t("no em or en dash, no advice, no sold", !DASH.test(text) && !guard.test(text) && !SOLD.test(text));
  t("sealed share has no NM", sealed.sealed === true && pulse.sealed === true && !NM.test(sealedSvg) && !NM.test(pulseSvg) && !NM.test(visible(heat)));
  t("share cards use the same mark", pulseSvg.includes(BRAND.gold) && pulseSvg.includes(BRAND.paper) && pulseSvg.includes("Catch'em") && pulseSvg.includes("catchemtcg.com/meter") && pulseSvg.includes(pulse.source) && pulseSvg.includes(pulse.date) && pulseSvg.includes('font-size="120"'));

  const og = shareSvg(new URLSearchParams("n=Evolving%20Skies%20Booster%20Box&p=2214.94&s=1"));
  t("public share card uses the same gold and font", og.includes(BRAND.gold) && og.includes(BRAND.font) && og.includes("Catch'em") && !og.includes("#d4af37") && !og.includes("Georgia") && !NM.test(og));
  t("before is the old equal square", legacy.includes("height:36px") && legacy.includes("#3ddc84") && legacy.includes("#ff7b72") && !legacy.includes(BRAND.gold) && !legacy.includes("data-h=\"72\""));

  if (fail) console.log(`brand visuals: ${fail} failed`);
  else console.log("brand visuals: all passed");
  return fail;
}

const isMain = process.argv[1] && process.argv[1].endsWith("brand-visuals.test.mjs");
if (isMain) {
  const fail = runBrandVisualTests();
  if (fail) process.exit(1);
}
