// Launch fixes 2: lighter feed, no optional-file 404s, folded sets and artists, quiet quick view.
import { renderFeed, feedReads, inlineFeedReads, FEED_INLINE, renderSets, renderArtists } from "../src/ui.mjs";
import { handleLive, soldFileExists, resetSoldCheck, renderPath } from "../src/index.mjs";
import fs from "node:fs";

let fail = 0;
const t = (name, cond) => { console.log(`${cond ? "  ok " : "  FAIL"} ${name}`); if (!cond) fail++; };
const visible = (h) => h.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");
const BANNED = /\b(buy|sell|hold|resistance|bottom|printed|play|target|invest|stack|load up|crypto)\b/i;

const reads = Array.from({ length: 300 }, (_, i) => ({ id: `r-${i}`, headline: `Card ${i} moved.`, price: 10 + i, source: "TCGplayer market", asOf: "2026-10-13", kind: "single", href: `/c/tcgcsv-${i}` }));
const page = renderFeed({ reads }, "", "", { feed: true });
const inline = JSON.parse(page.match(/id="feed-lead">([\s\S]*?)<\/script>/)[1]);
t("feed inlines only the first reads", inline.length === FEED_INLINE && feedReads({ reads }).length === 300);
const rest = JSON.parse(page.match(/id="feed-rest">([\s\S]*?)<\/script>/)[1]);
t("feed points at the rest file", rest.url === "/feed/lead.json" && rest.total === 300 && rest.sold === false);
t("a deep link read stays inline", inlineFeedReads(feedReads({ reads }), "r-250").some((r) => r.id === "r-250"));
t("feed asks for the sold file only when it exists", page.includes('restCfg.sold ? fetch("/data/derived/tcgplayer-volume.json")'));
t("rest loads after first paint", page.includes("requestIdleCallback(loadRest"));

resetSoldCheck();
t("missing sold file reads as off", (await soldFileExists(async () => new Response("", { status: 404 }))) === false);
resetSoldCheck();
const lead = await renderPath("/feed/lead.json", async (u) => new Response(String(u).endsWith("reads.json") ? JSON.stringify({ reads }) : "{}"), { feed: true });
const leadRows = lead ? JSON.parse(await lead.text()) : [];
t("/feed/lead.json returns every read", lead && lead.headers.get("content-type").includes("json") && leadRows.length >= FEED_INLINE);

const live = await handleLive(new Request("https://x/live/series/me"), "/live/series/me", async (u) => new Response(JSON.stringify({ id: "me", sets: [], u })));
t("/live/series proxies the public TCGdex file", live.status === 200 && JSON.parse(await live.text()).u === "https://api.tcgdex.net/v2/en/series/me");
const bad = await handleLive(new Request("https://x/live/series/../x"), "/live/series/../x", async () => new Response("{}"));
t("/live rejects odd ids", bad.status === 404);

const sets = renderSets({ sets: [
  { era: "Scarlet & Violet", name: "Paldea Evolved", slug: "sv02", single: 1, sealed: 0, release: "2023-06-09" },
  { era: "Mega Evolution", name: "Mega Evolution", slug: "me01", single: 1, sealed: 0, release: "2025-09-26" },
  { era: "XY", name: "XY", slug: "xy1", single: 1, sealed: 0, release: "2014-02-05" },
] }, "");
const folds = sets.match(/<details class="fold"[^>]*>/g) || [];
t("sets fold by era, newest era open, rest closed", folds.length === 3 && / open>$/.test(folds[0]) && folds[0].includes("era-mega-evolution") && !folds.slice(1).some((f) => / open>/.test(f)));
t("sets keep a search box", sets.includes('id="q"') && sets.includes('data-name="paldea evolved"'));
t("folds are rounded", sets.includes(".fold{margin:12px 0;border:1px solid #2f2b26;border-radius:18px"));
const artists = renderArtists({ artists: [{ name: "Ken Sugimori", slug: "ken", count: 3 }, { name: "Atsuko Nishida", slug: "atsuko", count: 2 }, { name: "5ban Graphics", slug: "5ban", count: 9 }] }, "");
const af = artists.match(/<details class="fold"[^>]*>/g) || [];
t("artists fold A to Z, other last", af.length === 3 && af[0].includes("artists-a") && af[2].includes("artists-other") && artists.includes('id="q"'));
for (const [name, h] of [["sets", sets], ["artists", artists], ["feed", page]]) {
  t(`${name} has no dashes or No data`, !/[\u2014\u2013]/.test(visible(h)) && !/No data/i.test(visible(h)));
  t(`${name} has no banned words`, !BANNED.test(visible(h).replace(/support@catchemtcg\.com/g, "").replace(/commission if you buy/, "")));
}
const ui = fs.readFileSync(new URL("../src/ui.mjs", import.meta.url), "utf8");
t("quick view and product page drop the no-reads line", !ui.includes("No reads on") && !ui.includes("No reads on file"));

if (fail) { console.log(`${fail} failed`); process.exit(1); }
console.log("launch fixes 2: all passed");

{
  const { renderSets: rs } = await import("../src/ui.mjs");
  const h = rs({ sets: [{ slug: "me01", name: "ME01", era: "Mega Evolution", logo: "/img/me1/logo.png", single: 1, sealed: 0 }, { slug: "x", name: "X", era: "Mega Evolution", single: 1, sealed: 0 }] }, "2026-10-13");
  const ok = h.includes('src="/img/me1/logo.png"') && (h.match(/tile-logo/g) || []).length >= 1;
  console.log(ok ? "  ok  sets page shows published /img logos, placeholder only without one" : "  FAIL sets page shows published /img logos");
  if (!ok) process.exitCode = 1;
}
