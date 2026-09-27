import { isFeedPath, stampFeed } from "../src/feed.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.log("  FAIL", name); }
};

t("feed paths", isFeedPath("/feed") && isFeedPath("/feed/") && isFeedPath("/pulse.html") && isFeedPath("/try/index.html") && isFeedPath("/app"));
t("not a product page", !isFeedPath("/p/sv3pt5-etb") && !isFeedPath("/methodology"));

const now = Date.parse("2026-09-26T22:00:00.000Z");
const html = `<head></head><body><div class="byline" id="fresh" data-at="2026-09-01T00:00:00.000Z">Updated old</div></body>`;
const out = stampFeed(html, "2026-09-26T20:20:22.665Z", now);
t("clock is the run", out.includes('data-at="2026-09-26T20:20:22.665Z"') && out.includes("Updated Sep 26, 1:20 PM PT") && !out.includes("Updated old"));
t("wide logo is constrained", out.includes('id="feed-fit"') && out.includes("max-width:56px") && out.includes("overflow-x:hidden"));
const late = stampFeed(html, "2026-09-20T00:00:00.000Z", now);
t("a late run says delayed but keeps the clock", late.includes("Data delayed") && late.includes('data-at="2026-09-20T00:00:00.000Z"'));

if (fail) process.exit(1);
console.log("feed live ok");
