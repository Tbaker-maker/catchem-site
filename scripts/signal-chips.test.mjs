import { readFileSync } from "node:fs";
import { preSend } from "../src/reads.mjs";
import { ICON_LINES, ICON_SOURCE, attachSignals, signalRowHtml } from "../src/signal-chips.mjs";
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
t("up is green and down is red only on the price arrow", row.includes("is-down") && row.includes("is-amber") && !row.includes("is-up"));
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
t("the feed has fast mode and the icon key", page.includes("id=\"fast-mode\"") && page.includes("What the icons mean") && page.includes("catchem-fast") && page.includes("sig-row"));
t("feed copy for the key stays clean", ICON_LINES.every(([, line]) => preSend(line).ok));
const opened = renderFeed({ reads: [{ id: "fake-all", name: "Umbreon ex", headline: "A read.", href: "/c/tcgcsv-1", signals: [{ kind: "art", badge: "SIR", label: "Special Illustration Rare" }], blurb: "Art type is Special Illustration Rare.", asOf: "2026-10-17" }] }, "fake-all", "Oct 17", { page: "read" });
t("the deep read header shows the chip", opened.includes("sig-block") && opened.includes("SIR") && opened.includes(">Read</h1>"));

const dotted = all.signals.map((chip) => ({ ...chip, strength: chip.kind === "move" ? 2 : 3 }));
for (const chip of dotted) {
  const html = signalRowHtml({ signals: [chip], blurb: all.blurb });
  t("dots on " + chip.kind, (html.match(/class="sig-strength"/g) || []).length === 1 && !html.includes("sig-score"));
}
const down = signalRowHtml({
  signals: [{ kind: "move", dir: "down", text: "5% 7D", label: "Price down 5 percent over 7 days", strength: 2 }],
  blurb: all.blurb,
  strength: 4,
});
t("the score sits on top and the dots are not a direction class", down.includes("sig-score") && down.indexOf("sig-score") < down.indexOf("sig-row") && down.includes("is-down") && !/class="sig-strength[^"]*is-/.test(down));
const css = readFileSync(new URL("../src/signal-chips.mjs", import.meta.url), "utf8");
t("dots stay one colour in either direction", css.includes(".sig.is-down .sig-strength") && css.includes(".sig.is-up .sig-strength") && css.includes(".sig-strength{display:inline-flex;gap:3px;align-items:center;margin-left:2px;color:#d9b779}") && !css.includes(".sig-strength{color:#e0675b") && !css.includes(".sig-strength{color:#7fc79a"));
t("fast mode keeps the dots and the score", css.includes(".is-fast .sig-blurb") && !css.includes(".is-fast .sig-score") && !css.includes(".is-fast .sig-strength"));
t("the score row can wrap and stays a 44px tap", css.includes(".sig-score{display:flex;flex-wrap:wrap") && css.includes(".sig-score{display:flex;flex-wrap:wrap;align-items:center;gap:8px;max-width:100%;min-width:0;min-height:44px"));
const dashDots = signalRowHtml({ signals: [{ kind: "move", dir: "dash", text: "", label: "Price being checked", strength: 5 }], blurb: "Price being checked." });
t("a grey dash has no dots and no score", dashDots.includes("is-dash") && !dashDots.includes("sig-strength") && !dashDots.includes("sig-score") && !dashDots.includes("%"));
const quiet = signalRowHtml({ signals: [{ kind: "listings", dir: "down", text: "18%", label: "Listings counted down 18 percent", strength: 2 }], blurb: "Listings counted are down 18%, as of Oct 17." });
t("no proven score stays off the row", !quiet.includes("sig-score") && quiet.includes("sig-strength") && !/\bNM\b|Near Mint/.test(quiet));
t("the strength line passes the copy rules", preSend("Signal strength, Oct 17.").ok && preSend("One dot is a quiet reading. Five dots is an unusual reading.").ok);

if (fail) { console.log(fail + " failed"); process.exit(1); }
console.log("signal chips: all ok");
