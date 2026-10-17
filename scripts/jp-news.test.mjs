// Region-only news stays out of the Feed. Real headlines, same cases as Catchem-data and catchem-bot.
import { readFile } from "node:fs/promises";
import { jpNewsDecision } from "../src/jp-news.mjs";
import RULES from "../src/jp-news-rules.mjs";
import { newsSlice } from "../src/ui.mjs";
import { feedNews } from "../data/feed-news.mjs";
import { RULES_URL, toModule } from "./sync-jp-news.mjs";

let fail = 0;
const t = (name, ok, extra = "") => { console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` ${extra}`}`); if (!ok) fail++; };

const cases = JSON.parse(await readFile(new URL("./jp-news-cases.json", import.meta.url), "utf8"));
for (const c of cases) {
  const d = jpNewsDecision(c.row);
  t(`${c.keep ? "keeps" : "drops"}: ${c.row.title}`, d.keep === c.keep && d.rule === c.rule, JSON.stringify(d));
}

// The Feed: no Japan-only story, and the reason never shows on the page.
const rows = newsSlice(feedNews);
const raw = new Map((feedNews.items || []).map((item) => [String(item.url || ""), item]));
const bad = rows.filter((row) => { const item = raw.get(row.href); return item && !jpNewsDecision(item).keep; });
t("the Feed has no Japan-only story", bad.length === 0, bad.slice(0, 3).map((r) => r.name).join(" | "));
t("the Feed still has news", rows.length > 0);
t("no Feed row starts with Japan:", rows.every((row) => !/^Japan:/.test(row.name)));
t("no drop reason or rule id reaches a Feed row", !/JP-only|jp-source|japan-event|left out/.test(JSON.stringify(rows)));
const mixed = newsSlice({ asOf: "2026-10-16", items: [
  { kind: "news", title: "Japan: Winner interview for \"Champions League 2027 Yokohama\"", url: "https://www.pokemon-card.com/info/1.html", source: "Pokémon Card (Japan)", region: "jp", date: "2026-10-15", sentence: "A Pokémon TCG winner talks." },
  { kind: "news", title: "New Pokémon TCG Regional Championships confirmed in the United States", url: "https://victoryroad.pro/2027-season-calendar/", source: "Play! Pokémon", date: "2026-10-15", sentence: "Pokémon TCG dates." },
] });
t("a Japan-only story is left out next to an NA story", mixed.length === 1 && mixed[0].href.includes("victoryroad"), JSON.stringify(mixed.map((r) => r.href)));
const product = newsSlice({ asOf: "2026-10-16", items: [
  { kind: "news", title: "Mega Dragonite ex, Mega Gengar ex, and Mega Feraligatr ex “Special Deck Set” Revealed", url: "https://www.pokebeach.com/forums/threads/special-deck-set.4/", source: "PokeBeach", date: "2026-10-15", sentence: "A new deck set." },
  { kind: "news", title: "Mega Charizard X ex Premium Collection Coming in November", url: "https://example.com/pc", source: "PokeGuardian", date: "2026-10-15" },
  { kind: "news", title: "“Gem Pack Vol 7” to Release in China Featuring Exclusive Misty’s Psyduck!", url: "https://www.pokebeach.com/forums/threads/gem-pack-vol-7.1/", source: "PokeBeach", date: "2026-10-16", sentence: "A China-only pack." },
  { kind: "news", title: "Get codes for the Pokémon GO Night Out.", url: "https://example.com/go", source: "Pokémon GO", date: "2026-10-15", sentence: "Codes." },
] });
t("Special Deck Set and Premium Collection headlines count as card news", product.some((r) => r.href.includes("special-deck-set")) && product.some((r) => r.href === "https://example.com/pc"), JSON.stringify(product.map((r) => r.href)));
t("a China-only story and a GO story stay off", !product.some((r) => r.href.includes("gem-pack") || r.href.includes("/go")));

// The copy must match Catchem-data main byte for byte.
const local = await readFile(new URL("../src/jp-news-rules.mjs", import.meta.url), "utf8");
let remote = "";
let status = 0;
try {
  const r = await fetch(RULES_URL, { signal: AbortSignal.timeout(10000) });
  status = r.status;
  if (r.ok) remote = await r.text();
} catch {}
if (status && !remote) t("Catchem-data main has rules/jp-news.json", false, `HTTP ${status}`);
else if (!remote) console.log("note: could not reach Catchem-data main, drift check skipped on this run");
else t("src/jp-news-rules.mjs matches Catchem-data main", local === toModule(remote) && JSON.stringify(JSON.parse(remote)) === JSON.stringify(RULES), "run: node scripts/sync-jp-news.mjs");

if (fail) process.exit(1);
