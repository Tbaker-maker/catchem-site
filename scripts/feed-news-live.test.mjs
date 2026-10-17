// The Feed reads news live from Catchem-data research/digests/feed-news.json, with the
// Japan-only filter, and falls back to the baked copy when that file cannot load.
import { loadFeedNews, resetJsonCache, FEED_NEWS_PATH } from "../src/data.mjs";
import { renderFeed } from "../src/ui.mjs";

let fail = 0;
const t = (name, ok, extra = "") => { console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` ${extra}`}`); if (!ok) fail++; };
const newsOf = (html) => JSON.parse(String(html).match(/<script type="application\/json" id="feed-news">([\s\S]*?)<\/script>/)[1]);

const live = { asOf: "2026-10-17", items: [
  { kind: "news", title: "New Pokémon TCG Regional Championships confirmed in the United States", url: "https://victoryroad.pro/2027-season-calendar/", source: "Play! Pokémon", date: "2026-10-16", sentence: "Pokémon TCG dates." },
  { kind: "news", title: "Japan: Winner interview for \"Champions League 2027 Yokohama\"", url: "https://www.pokemon-card.com/info/1.html", source: "Pokémon Card (Japan)", region: "jp", date: "2026-10-16", sentence: "A Pokémon TCG winner." },
] };

let asked = "";
resetJsonCache();
const got = await loadFeedNews(async (url) => { asked = url; return new Response(JSON.stringify(live), { status: 200 }); });
t("live news is read from Catchem-data main", asked.endsWith("/main/" + FEED_NEWS_PATH) && got && got.asOf === "2026-10-17", asked);
resetJsonCache();
t("a missing file gives null, never a throw", (await loadFeedNews(async () => new Response("nope", { status: 404 }))) === null);
resetJsonCache();
t("a bad shape gives null", (await loadFeedNews(async () => new Response(JSON.stringify({ items: "x" }), { status: 200 }))) === null);
resetJsonCache();
t("a network error gives null", (await loadFeedNews(async () => { throw new Error("down"); })) === null);
resetJsonCache();

const bundle = { reads: [] };
const withLive = newsOf(renderFeed(bundle, "", "", { news: live }));
t("the Feed shows live news", withLive.length === 1 && withLive[0].href === "https://victoryroad.pro/2027-season-calendar/", JSON.stringify(withLive.map((r) => r.href)));
t("the Japan-only live story stays off", !withLive.some((r) => r.href.includes("pokemon-card.com")));
const baked = newsOf(renderFeed(bundle, "", "", {}));
t("with no live file the baked copy still shows", baked.length > 0);
const emptyLive = newsOf(renderFeed(bundle, "", "", { news: { asOf: "2026-10-17", items: [] } }));
t("a quiet live file shows no news, never the old baked copy", emptyLive.length === 0);

// Live check: the file on Catchem-data main loads and is recent.
try {
  const r = await fetch("https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/" + FEED_NEWS_PATH, { signal: AbortSignal.timeout(10000) });
  if (r.status === 404) console.log("note: feed-news.json is not on Catchem-data main yet");
  else if (r.ok) {
    const doc = await r.json();
    const age = (Date.now() - Date.parse(doc.asOf + "T00:00:00Z")) / 86400000;
    t("feed-news.json on main is at most 3 days old", age <= 3, doc.asOf);
  }
} catch { console.log("note: could not reach Catchem-data main, live check skipped"); }

if (fail) process.exit(1);
