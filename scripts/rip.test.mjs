// Rip value page: numbers come only from the rip file, empty fields stay off.
import { banGuard } from "../src/advice-rules.mjs";
// Whole pages carry code comments, so dashes are checked by their own assertion here.
const PAGE = { skipKinds: ["house"] };
import { pageKind, renderPath } from "../src/index.mjs";
import { resetJsonCache } from "../src/data.mjs";
import { ripBody } from "../src/rip.mjs";

let fail = 0;
const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail++; console.log("  FAIL", name); } };
const BANNED = banGuard("rip", /\b(supply)\b/i, PAGE);
const visible = (h) => String(h).replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");

const doc = {
  asOf: "2026-10-13",
  label: "Rip value",
  note: "History-based estimates from dated pull rates and our singles prices. Not advice.",
  method: { copy: "Public label is Rip value. EV and ROI % are history-based estimates." },
  pullRatesUpdated: "2026-10-12",
  ranking: ["box-b", "pack-a", "thin"],
  sources: [{ url: "https://example.com/rates", published: "2026-09-15", author: "Ada" }],
  rows: [
    { id: "pack-a", name: "Journey Together Booster Box", set: "Journey Together", setSlug: "sv09", subtype: "booster-box", price: 191.93, contentsEV: 96.48, roiPct: -49.7, beatChance: 9.1, median: 69.66, priceAsOf: "2026-10-13", priceSource: "TCGplayer market" },
    { id: "box-b", name: "Prismatic Pack", set: "Prismatic Evolutions", setSlug: "sv-prism", subtype: "booster-pack", price: 12.5, contentsEV: 8.2, roiPct: -34.4, beatChance: 22, median: 6.1, priceAsOf: "2026-10-13", priceSource: "TCGplayer market" },
    { id: "thin", name: "Thin Product", set: "Lost Origin", setSlug: "sw-lost", subtype: "etb", price: 40 },
  ],
};
const sets = { sets: [
  { slug: "sv09", era: "Scarlet & Violet", logo: "https://images.pokemontcg.io/sv9/logo.png" },
  { slug: "sv-prism", era: "Scarlet & Violet", logo: "/img/sv8pt5/logo.png" },
  { slug: "sw-lost", era: "Sword & Shield" },
] };
const fetchImpl = async (url) => {
  const u = String(url);
  const send = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  if (u.endsWith("/data/derived/rip-roi.json")) return send(doc);
  if (u.endsWith("/research/assets/public/sets.json")) return send(sets);
  if (u.endsWith("/research/assets/public/counts.json")) return send({ asOf: "2026-10-13", updatedAt: "2026-10-13T12:00:00Z" });
  if (u.endsWith("/research/assets/public/feed/status.json")) return send({ images: { tcgplayer: true } });
  return new Response("no", { status: 404 });
};

t("page kind", pageKind("/rip") === "rip" && pageKind("/rip/") === "rip");
const bare = ripBody(null);
t("missing file hides the list", bare.includes("<h1>Rip value</h1>") && !bare.includes("rip-row") && !/No data/i.test(bare));
const body = ripBody(doc, {
  eras: { sv09: "Scarlet & Violet", "sv-prism": "Scarlet & Violet", "sw-lost": "Sword & Shield" },
  logos: { sv09: "https://images.pokemontcg.io/sv9/logo.png", "sv-prism": "/img/sv8pt5/logo.png" },
});
t("ranking order", body.indexOf("Prismatic Pack") < body.indexOf("Journey Together") && body.indexOf("Journey Together") < body.indexOf("Thin Product"));
t("file numbers", body.includes("$96.48") && body.includes("$191.93") && body.includes("-49.7%") && body.includes("9.1%") && body.includes("$69.66") && body.includes("22%"));
t("labels and dates", body.includes("Average pull value") && body.includes("Chance an opening beats the price") && body.includes("Typical opening") && body.includes("As of Oct 13, 2026") && body.includes("Pull rates updated Oct 12, 2026") && body.includes("TCGplayer market, Oct 13, 2026"));
t("image and set link", body.includes('href="/sets/sv09"') && body.includes("https://images.pokemontcg.io/sv9/logo.png") && body.includes("/img/sv8pt5/logo.png"));
const thin = body.split('data-type="etb"')[1] || "";
t("empty fields stay off the thin row", !thin.includes("Average pull value") && !thin.includes("Chance an opening beats the price") && !thin.includes("Typical opening") && !thin.includes("ROI") && thin.includes("$40.00"));
t("filters", body.includes('aria-label="Era"') && body.includes("Violet") && body.includes("Booster box") && body.includes("Under $25") && body.includes("$100 to $249") && body.includes("Sword"));
t("no dash, no banned words, no No data", !/[\u2014\u2013]/.test(body) && !BANNED.test(visible(body)) && !/No data/i.test(body));

resetJsonCache();
const res = await renderPath("/rip", fetchImpl, {});
const html = await res.text();
t("route renders", res.status === 200 && html.includes("<h1>Rip value</h1>") && html.includes('href="/rip"') && html.includes("aria-current=\"page\"") && html.includes("$96.48") && html.includes("Shield"));
t("route copy stays clean", !/[\u2014\u2013]/.test(visible(html)) && !BANNED.test(visible(html).replace(/support@catchemtcg\.com/g, "")) && !/No data/i.test(html));

if (fail) { console.log(`rip: ${fail} failed`); process.exit(1); }
console.log("rip ok");
