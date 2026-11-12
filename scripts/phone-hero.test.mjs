// Phone product heroes use a mid-size JPEG (or official mid-res PNG), not the
// 734px _hires scan. A srcset that also lists the hires file still downloads it
// on a 3x phone, so desktop keeps hires behind a min-width picture source.
import { phoneCardHeroImg, imageTag, tcgPid } from "../src/catalogue-image.mjs";
import { renderCard } from "../src/ui.mjs";

let fail = 0;
const t = (name, ok) => { console.log(`${ok ? "  ok " : "  FAIL"} ${name}`); if (!ok) fail++; };

const hires = "/data/editor/tcg/swsh7/215_hires.png";
const mid = "/data/editor/tcg/swsh7/215.png";
const tag = imageTag(hires, "card", "Umbreon VMAX", { kind: "single", name: "Umbreon VMAX" }).replace('loading="lazy"', 'loading="eager" fetchpriority="high"');

const withPid = phoneCardHeroImg(tag, { id: "swsh7-215", kind: "single", tcgPlayerId: 246723 });
t("slug ids still resolve a TCGplayer id", tcgPid({ id: "swsh7-215", tcgPlayerId: 246723 }) === 246723);
t("phone src is card-hero, not hires", /<img[^>]*\ssrc="\/api\/card-hero\?pid=246723&amp;fb=/.test(withPid) && !/<img[^>]*\ssrc="\/data\/editor\/tcg\/[^"]*_hires\.png"/.test(withPid));
t("hires is only a desktop picture source", withPid.includes('<picture>') && withPid.includes('<source media="(min-width: 768px)" srcset="' + hires + '">') && !/srcset="[^"]*_hires\.png 733w"/.test(withPid));
t("eager LCP attributes stay on the img", withPid.includes('loading="eager"') && withPid.includes('fetchpriority="high"') && withPid.includes('width="280"') && withPid.includes('height="392"'));

const fromSku = phoneCardHeroImg(tag, { id: "swsh7-215", kind: "single", sku: "tcgcsv-246723" });
t("sku tcgcsv ids also feed card-hero", fromSku.includes('src="/api/card-hero?pid=246723&amp;fb='));

const noPid = phoneCardHeroImg(tag, { id: "swsh7-215", kind: "single" });
t("without a pid, the official mid-res png is the phone src", noPid.includes('src="' + mid + '"') && noPid.includes('srcset="' + hires + '"') && !noPid.includes("/api/card-hero"));

const sealed = phoneCardHeroImg(imageTag("/data/cutouts/sv8-etb.webp", "sealed", "ETB", { kind: "sealed" }), { id: "tcgcsv-1", kind: "sealed" });
t("sealed cutouts are left alone", sealed.includes('src="/data/cutouts/sv8-etb.webp"') && !sealed.includes("<picture>"));

const page = renderCard({
  id: "swsh7-215",
  name: "Umbreon VMAX",
  kind: "single",
  set: "Evolving Skies",
  tcgPlayerId: 246723,
  price: 10,
  asOf: "2026-10-13",
  hist: [["2026-10-01", 8], ["2026-10-13", 10]],
}, "stamp", { catalogueSrc: hires });
t("pretty-URL card pages use the phone hero", page.includes("<picture>") && /<img[^>]*\ssrc="\/api\/card-hero\?pid=246723&amp;fb=/.test(page) && page.includes('media="(min-width: 768px)"') && !/<img[^>]*\ssrc="\/data\/editor\/tcg\/swsh7\/215_hires\.png"/.test(page));

const tcgcsv = renderCard({
  id: "tcgcsv-246723",
  name: "Umbreon VMAX",
  kind: "single",
  set: "Evolving Skies",
  price: 10,
  asOf: "2026-10-13",
  hist: [["2026-10-01", 8], ["2026-10-13", 10]],
}, "stamp", { catalogueSrc: hires });
t("tcgcsv card ids also use card-hero", tcgcsv.includes('src="/api/card-hero?pid=246723&amp;fb='));

if (fail) process.exit(1);
console.log("phone hero ok");
