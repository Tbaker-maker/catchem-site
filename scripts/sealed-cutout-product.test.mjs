import { sealedCutoutSrc, officialSrc } from "../src/catalogue-image.mjs";
import { publicContentType } from "../src/data.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.log("  FAIL", name); }
};

const doc = {
  products: [
    { id: "swsh5-pack", siteId: "tcgcsv-229276", tcgPlayerId: 229276, file: "cutouts/swsh5-pack.webp", width: 546, height: 1000, productType: "booster-pack", pass: true },
    { id: "sv8-etb", siteId: "tcgcsv-1", tcgPlayerId: 1, file: "cutouts/sv8-etb.webp", width: 10, height: 10, productType: "etb", pass: false },
  ],
};

const pack = sealedCutoutSrc({ id: "swsh5-pack", kind: "sealed", tcgPlayerId: 229276 }, doc);
t("a passed cutout is the /data file", pack && pack.src === "/data/cutouts/swsh5-pack.webp" && pack.crop === false);
t("CDN stays as the alt", pack && pack.alts.join() === "/api/card-img?pid=229276");
t("a failed cutout is not used", sealedCutoutSrc({ id: "sv8-etb", kind: "sealed", tcgPlayerId: 1 }, doc) === null);
t("no doc keeps the old path", sealedCutoutSrc({ id: "swsh5-pack", kind: "sealed", tcgPlayerId: 229276 }, null) === null);

const cdn = officialSrc({ id: "swsh5-pack", kind: "sealed", tcgPlayerId: 229276 }, {});
t("without a cutout map officialSrc is still the CDN proxy", cdn.src === "/api/card-img?pid=229276");

t("webp and png are image types", publicContentType("cutouts/swsh5-pack.webp") === "image/webp" && publicContentType("cutouts/swsh5-pack.png") === "image/png");
t("json stays json", publicContentType("sealed-cutouts.json") === "application/json; charset=utf-8");

if (fail) {
  console.error(fail + " failed");
  process.exit(1);
}
console.log("sealed-cutout-product ok");
