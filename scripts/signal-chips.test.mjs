import { readFileSync } from "node:fs";
import { preSend } from "../src/reads.mjs";
import { ICON_LINES, ICON_SOURCE, TILE_JS, attachSignals, chipLookup, signalJoin, signalLeadMarkup, signalRowHtml } from "../src/signal-chips.mjs";
import { renderFeed } from "../src/ui.mjs";

let fail = 0;
const t = (name, ok) => { if (ok) console.log("  ok ", name); else { fail++; console.log("  FAIL", name); } };

const all = {
  signals: [
    { kind: "move", dir: "down", text: "5% 7D", label: "Price down 5 percent over 7 days" },
    { kind: "listings", dir: "down", text: "18%", label: "Listings counted down 18 percent" },
    { kind: "gone", dots: 2, label: "Listings gone, steady" },
    { kind: "range", pos: 0.42, days: 21, label: "Today sits in the middle of the 21 day range" },
    { kind: "momentum", word: "Cooling", label: "Momentum Cooling" },
    { kind: "rotation", text: "Rotates in 4 mo", label: "Rotates in 4 months" },
    { kind: "art", badge: "SIR", label: "Special Illustration Rare" },
    { kind: "era", tag: "Vintage", label: "Vintage" },
    { kind: "confidence", bars: 2, label: "Two data bars on file" },
  ],
  blurb: "TCGplayer market is down 5% over 7 days, as of Oct 17.",
};
const row = signalRowHtml(all, { href: "/feed/r/fake-all" });
t("a full read renders a wrapped row and keeps four chips", (row.match(/class="sig /g) || []).length === 4 && row.includes("sig-row") && row.includes("5% 7D") && row.includes("min-height") === false);
t("the row is a 44px tap target in css", readFileSync(new URL("../src/signal-chips.mjs", import.meta.url), "utf8").includes(".sig-row{display:flex;flex-wrap:wrap") && readFileSync(new URL("../src/signal-chips.mjs", import.meta.url), "utf8").includes("min-height:44px"));
t("up is green and down is red only on the price arrow", row.includes("is-down") && row.includes("is-lead") && !row.includes("is-amber") && !row.includes("is-up"));
t("the blurb and every icon line pass the copy rules", preSend(all.blurb).ok && ICON_LINES.every(([, line]) => preSend(line).ok) && preSend(ICON_SOURCE).ok);
t("no sideways scroll rule on the chip row", !/\.sig-row\{[^}]*overflow-x/.test(readFileSync(new URL("../src/signal-chips.mjs", import.meta.url), "utf8")));

const dash = signalRowHtml({ signals: [{ kind: "move", dir: "dash", text: "", label: "Price being checked" }], blurb: "Price being checked." });
t("price being checked is a grey dash and not a percent", dash.includes("is-dash") && !dash.includes("%") && dash.includes("Price being checked."));

const sealed = signalRowHtml({
  signals: [{ kind: "listings", dir: "down", text: "18%", label: "Listings counted down 18 percent" }],
  blurb: "Listings counted are down 18%, as of Oct 17.",
});
t("a sealed read has no condition chip", !/\bNM\b|Near Mint|condition/i.test(sealed) && sealed.includes("18%"));

const empty = signalRowHtml({ signals: [], blurb: "Hidden." });
t("an empty row is hidden", empty === "");

const joined = attachSignals({ reads: [{ id: "a", name: "A" }, { id: "b", signals: [{ kind: "era", tag: "Modern", label: "Modern" }] }] }, {
  byId: { a: { signals: all.signals, blurb: all.blurb }, b: { signals: [{ kind: "move", dir: "up", text: "1% 7D", label: "Price up 1 percent over 7 days" }], blurb: "no" } },
});
t("chips attach without replacing a row that already has them", joined.reads[0].signals.length === 4 && joined.reads[1].signals[0].kind === "era");

const page = renderFeed({ reads: [{ id: "fake-all", name: "Umbreon ex", headline: "A read.", signals: all.signals.slice(0, 4), blurb: all.blurb, asOf: "2026-10-17", source: "TCGplayer market" }] }, "", "Oct 17");
t("the feed has fast mode and no icon key box", page.includes("id=\"fast-mode\"") && !page.includes("What the icons mean") && !page.includes("icon-key") && !page.includes("catchem-icon-key") && page.includes("catchem-fast") && page.includes("sig-row"));
t("feed copy for the chip lines stays clean", ICON_LINES.every(([, line]) => preSend(line).ok) && !ICON_LINES.some(([id]) => id === "dots"));
const opened = renderFeed({ reads: [{ id: "fake-all", name: "Umbreon ex", headline: "A read.", href: "/c/tcgcsv-1", signals: [{ kind: "art", badge: "SIR", label: "Special Illustration Rare" }], blurb: "Art type is Special Illustration Rare.", asOf: "2026-10-17" }] }, "fake-all", "Oct 17", { page: "read" });
t("the deep read header shows the chip", opened.includes("sig-block") && opened.includes("SIR") && opened.includes(">Read</h1>"));

const dotted = all.signals.map((chip) => ({ ...chip, strength: chip.kind === "move" ? 2 : 3 }));
for (const chip of dotted) {
  const html = signalRowHtml({ signals: [chip], blurb: all.blurb, strength: 4 });
  t("no strength dots or score on " + chip.kind, !html.includes("sig-strength") && !html.includes("sig-overall") && !html.includes("of 5"));
}
const css = readFileSync(new URL("../src/signal-chips.mjs", import.meta.url), "utf8");
t("the dots meter and key styles are gone", !css.includes(".sig-strength") && !css.includes(".sig-overall") && !css.includes(".icon-key") && !css.includes("paintIconKey"));
const lead = signalRowHtml({ signals: [{ kind: "listings", dir: "down", text: "Listings -18% 7d · Draining", label: "Listings counted down 18 percent over 7 days. Draining", strength: 4 }], blurb: "Listings counted are down 18% over 7 days, as of Oct 18." }, { asOf: "2026-10-18" });
t("the supply pill still leads when a read has no tiles", lead.includes("is-lead") && lead.includes("Listings -18% 7d") && lead.includes("eBay listings counted, Oct 18.") && preSend("eBay listings counted, Oct 18.").ok);

// Flip tiles
const tiles = {
  data: { bars: 3, of: 3, prices: 225, recent: 17, since: "2024-03-14", through: "2026-10-18", span: "2.5 yrs", source: "TCGplayer market" },
  price: { dir: "up", pct: 7.2, days: 7, from: 19.32, fromDate: "2026-10-11", spark: [19.32, 19.19, 19.39, 19.88, 19.59, 19.53, 20.09, 20.71], source: "TCGplayer market", asOf: "2026-10-18" },
};
const tiled = signalRowHtml({ signals: all.signals, tiles }, { href: "/feed/r/x" });
t("a read with tiles shows the Data and Price tiles", (tiled.match(/class="tl[ "]/g) || []).length === 2 && tiled.includes("Price 7D") && tiled.includes("▲ 7.2%") && tiled.includes("from $19.32, Oct 11") && tiled.includes("2.5 yrs on file"));
t("the data tile back shows counts, source and dates only", tiled.includes("225 prices on file, 17 in the last 30 days.") && tiled.includes("TCGplayer market, Mar 14, 2024 to Oct 18, 2026") && !/cutoff|threshold|flatAbs|minAbsPct/i.test(tiled));
t("tiles are buttons with aria-pressed and a full label", (tiled.match(/<button type="button" class="tl/g) || []).length === 2 && (tiled.match(/aria-pressed="false"/g) || []).length === 2 && tiled.includes('aria-label="Data on file: 3 of 3 bars'));
t("tiles never sit inside a link", !/<a [^>]*>[^]*class="tl/.test(tiled));
t("tiles replace the pills and the dots", !tiled.includes("sig-row") && !tiled.includes("sig-strength"));
t("no listings tile without listings counted", !tiled.includes("Listings counted"));
const box = signalRowHtml({ tiles: { ...tiles, listings: { word: "Draining", dir: "down", pct: 12, days: 7, spark: [41, 41, 40, 39, 38, 37, 36], band: [38, 41], from: "2026-10-12", to: "2026-10-18" } } });
t("a product with listings counted gets a wide listings tile with a band", box.includes("tl wide") && box.includes("Draining") && box.includes("▼ 12%") && box.includes("7D") && box.includes("<rect") && box.includes("eBay listings counted, Oct 12 to Oct 18"));
t("the listings tile has no seller tag or stage pips", !/sellers|Building|Slowing|Stalled|Reversing/.test(box));
t("tile copy passes the rules", !/[\u2013\u2014]| - |\bsold\b|\bsales\b|\bNM\b/i.test(box.replace(/<[^>]+>/g, " ")));
t("tile css: rounded, 44px plus, no layout shift, reduced motion", css.includes(".tl-face{grid-area:1/1") && css.includes("min-height:112px") && css.includes("border-radius:20px") && css.includes("prefers-reduced-motion:reduce") && css.includes(".tl-back{transform:none;opacity:0}"));
t("one guarded listener flips tiles and Escape flips back", TILE_JS.includes("__ceTiles") && TILE_JS.includes("Escape") && TILE_JS.includes("aria-pressed"));
const ui = readFileSync(new URL("../src/ui.mjs", import.meta.url), "utf8");
const client = readFileSync(new URL("../src/signal-chips.mjs", import.meta.url), "utf8");
t("chips and tiles load for a signed out visitor", ui.includes('"/data/signal-chips.json"') && client.includes("function signalJoin") && client.includes("next.tiles = hit.tiles") && !client.includes("premium"));
t("bySku may point at a byId key", chipLookup({ byId: { r1: { tiles } }, bySku: { "tcgcsv-1": "r1" } }, "move-tcgcsv-1-7")?.tiles === tiles);
const joinedMove = signalJoin({ id: "move-tcgcsv-9-7", sku: "tcgcsv-9", href: "/c/tcgcsv-9" }, { byId: { "deep-card-tcgcsv-9": { tiles, signals: all.signals } } });
t("a quick read joins tiles by the tcgcsv id when bySku is empty", joinedMove.tiles === tiles);
const own = { data: tiles.data, price: { ...tiles.price, pct: 1.5 } };
t("the read's own tiles win over another row with the same sku", signalJoin({ id: "move-tcgcsv-9-7", sku: "tcgcsv-9" }, { byId: { "move-tcgcsv-9-7": { tiles: own, signals: [{ kind: "move", dir: "up", text: "1.5% 7D", label: "Price up 1.5 percent over 7 days" }] }, "deep-card-tcgcsv-9": { tiles } } }).tiles.price.pct === 1.5);
const leadHtml = signalLeadMarkup({ id: "move-tcgcsv-9-7", sku: "tcgcsv-9" }, { byId: { "deep-card-tcgcsv-9": { tiles, signals: all.signals } } }, (s) => String(s ?? ""));
t("next reads show compact tiles, not one pill", leadHtml.includes('class="tiles"') && leadHtml.includes("is-compact") && !leadHtml.includes("sig-row"));
const moved = attachSignals({ reads: [{ id: "move-tcgcsv-9-7", sku: "tcgcsv-9", signals: [{ kind: "era", tag: "Modern", label: "Modern" }] }] }, { byId: { "deep-card-tcgcsv-9": { tiles, signals: all.signals, blurb: all.blurb } } });
t("tiles attach by sku when the row already has a chip", moved.reads[0].signals[0].kind === "era" && moved.reads[0].tiles.price.pct === 7.2);
t("fast mode keeps the tiles on screen", css.includes(".is-fast .tiles{display:grid}") && !/\.is-fast \.tiles\{[^}]*display:none/.test(css));
t("a read page replaces a pill header instead of skipping tiles", client.includes("function signalBitsMarkup") && client.includes('closest("article")') && !client.includes('querySelector("main .sig-block"))return ""'));
t("next read tiles are not nested inside the row button", ui.includes('<div class="fl-bits">') && ui.includes("overflow-x:hidden") && !ui.includes('<span class="fl-bits">'));
t("the feed title is the name with a number sign", ui.includes("function readTitle(card)") && ui.includes("html(readTitle(card)"));
t("the key names no Arrow or Flame label", !client.includes(">Arrow<") && !client.includes(">Flame<"));

// Seller tag and run stage: pills only when one fires, plain words on the back.
const lbase = { word: "Draining", dir: "down", pct: 25, days: 7, spark: [52, 50, 47, 45, 42, 40, 39], band: null, from: "2026-10-12", to: "2026-10-18" };
const plain = signalRowHtml({ tiles: { listings: lbase } });
t("no tag or stage, no pill", !plain.includes("tl-tag") && !/Few sellers|Spread out|Building|Slowing|Stalled|Reversing/.test(plain));
const fired = signalRowHtml({ tiles: { listings: { ...lbase,
  tag: { word: "Few sellers hold most", share: 61, usual: 30, peers: 28, sellers: 5, date: "2026-10-18" },
  stage: { word: "Building", dir: "up", days: 7, date: "2026-10-18", listings: "falling" } } } });
t("a fired tag shows a pill on the front", fired.includes('<span class="tl-tag">Few sellers hold most</span>') && fired.includes("Building ▲"));
t("the back explains the tag with shares", fired.includes("the top 2 sellers hold 61% of listings counted. This product usually sits near 30%, and similar products near 28%."));
t("the back explains the stage", fired.includes("price has climbed over the last 7 days, and listings counted are falling."));
t("the back names source and date", fired.includes("Source: eBay listings counted, Oct 18, 2026"));
t("an unknown word never shows", !signalRowHtml({ tiles: { listings: { ...lbase, tag: { word: "Buy now", share: 1 }, stage: { word: "Moon", days: 7 } } } }).includes("tl-tag"));
const single = signalRowHtml({ tiles: { price: { dir: "down", pct: 9.1, days: 7, from: 22, fromDate: "2026-10-11", spark: [22, 21.5, 21, 20.5, 20.2, 20, 20], source: "TCGplayer market", asOf: "2026-10-18",
  stage: { word: "Reversing", dir: "down", days: 7, date: "2026-10-18" } } } });
t("a single shows its stage on the price tile", single.includes("Reversing ▼") && single.includes("price turned down after moving up over the 7 days before."));
t("stage copy has no dashes or sold words", !/[\u2013\u2014]| - |\bsold\b|\bsales\b/i.test(fired + single));

t("an era tag line never shows", !signalRowHtml({ blurb: "Era tag is Vintage.", signals: [{ kind: "era", tag: "Modern" }] }).includes("Era tag"));
t("five data bars render as five", (signalRowHtml({ tiles: { data: { bars: 4, of: 5, prices: 150, recent: 18, since: "2025-01-01", through: "2026-10-19", span: "1.5 yrs", source: "TCGplayer market" } } }).match(/<i class="on"/g) || []).length === 4 && (signalRowHtml({ tiles: { data: { bars: 4, of: 5, prices: 150, recent: 18, since: "2025-01-01", through: "2026-10-19", span: "1.5 yrs", source: "TCGplayer market" } } }).match(/<i class="(on)?" style/g) || []).length === 5);
t("a card with no art gets its own arrow row", ui.includes('slide.classList.toggle("no-art", !card.querySelector("img"))') && ui.includes(".feed-slide.no-art{padding-top:48px}"));
{
  const { splitName } = await import("../src/display-name.mjs");
  const src = ui.slice(ui.indexOf("function readTitle(card){"), ui.indexOf("function cardEl(card, facts){"));
  // The source sits in a template literal, so undo one level of escaping before running it.
  const readTitle = new Function("splitName", src.replace(/\\\\/g, "\\") + "; return readTitle;")(splitName);
  t("a name ending in its number keeps one copy", readTitle({ name: "Chansey ex (EX Ruby and Sapphire) 96/109", number: "96/109" }).split("96/109").length === 2);
  t("the Pikachu title stays Pikachu #088", readTitle({ name: "Pikachu - 088" }) === "Pikachu #088");
}

if (fail) { console.log(fail + " failed"); process.exit(1); }
console.log("signal chips: all ok");
