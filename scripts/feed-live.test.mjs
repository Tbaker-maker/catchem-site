import { isFeedPath, loadLatestFeed, stampFeed } from "../src/feed.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.log("  FAIL", name); }
};

t("feed paths", isFeedPath("/feed") && isFeedPath("/feed/") && isFeedPath("/pulse.html") && isFeedPath("/try/index.html") && isFeedPath("/app"));
t("not a product page", !isFeedPath("/p/sv3pt5-etb") && !isFeedPath("/methodology"));

const now = Date.parse("2026-09-26T22:00:00.000Z");
const html = `<head></head><body><div class="byline" id="fresh" data-at="2026-09-01T00:00:00.000Z">Updated old</div><div class="byline">Written by the machine at 15:46 UTC · every number is live production data</div><p>A floor that far below the median usually rewards patience.</p></body>`;
const out = stampFeed(html, "2026-09-26T20:20:22.665Z", now);
t("clock is the run", out.includes('data-at="2026-09-26T20:20:22.665Z"') && out.includes("Updated Sep 26, 1:20 PM PT") && !out.includes("Updated old"));
t("body clock matches the run", out.includes("Written by the machine at Sep 26, 1:20 PM PT") && !out.includes("15:46"));
t("floor wording is gone", !/\bfloor\b/i.test(out) && out.includes("The lowest ask sits far below the median."));
t("wide logo is constrained", out.includes('id="feed-fit"') && out.includes("max-width:56px") && out.includes("overflow-x:hidden"));
const late = stampFeed(html, "2026-09-20T00:00:00.000Z", now);
t("a late run says delayed but keeps the clock", late.includes("Data delayed") && late.includes('data-at="2026-09-20T00:00:00.000Z"'));

const sha = "a".repeat(40);
const seen = [];
const fake = async (url) => {
  seen.push(url);
  if (String(url).includes("/commits/main")) return { ok: true, json: async () => ({ sha }) };
  if (String(url).endsWith("run-report.json")) return { ok: true, json: async () => ({}), text: async () => JSON.stringify({ finishedAt: "2026-09-26T20:20:22.665Z" }) };
  return { ok: true, text: async () => html };
};
const loaded = await loadLatestFeed(fake, now);
t("reads the tip commit, not a cached raw URL", seen.some((u) => u.includes("/commits/main")) && seen.some((u) => u.includes(`/${sha}/research/assets/the-pulse.html`)) && loaded.includes("Updated Sep 26, 1:20 PM PT"));

if (fail) process.exit(1);
console.log("feed live ok");
