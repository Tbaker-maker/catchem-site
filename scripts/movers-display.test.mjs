import { renderMovers } from "../src/ui.mjs";

let fail = 0;
const t = (name, ok) => { console.log((ok ? "ok   " : "FAIL ") + name); if (!ok) fail++; };

const doc = {
  asOf: "2026-11-25",
  singlesRising: [
    {
      name: "Example Card",
      href: "/c/tcgcsv-1",
      set: "Example",
      price: 20,
      changePct: 12.5,
      windowDays: 7,
      hist: [["2026-11-18", 17.78], ["2026-11-25", 20]],
      listings: 86,
      fewListings: true,
    },
    {
      name: "Named Ends",
      href: "/c/tcgcsv-2",
      set: "Example",
      changePct: -4,
      windowDays: 30,
      fromPrice: 50,
      toPrice: 48,
      fromDate: "2026-10-26",
      toDate: "2026-11-25",
      listingsCounted: 12,
    },
    {
      name: "Percent Only",
      href: "/c/tcgcsv-3",
      set: "Example",
      price: 9,
      changePct: 3,
      windowDays: 7,
    },
  ],
};
const html = renderMovers(doc, "Updated Nov 25");
const row = (name) => {
  const i = html.indexOf(`>${name}<`);
  const cut = html.slice(Math.max(0, i - 200), i + 500);
  return cut;
};
t("big percent is right aligned in mover-pct", html.includes('class="mover-pct"') && html.includes("+12.5% 7D") && html.includes("mover-stat"));
t("history supplies from and to with dates", row("Example Card").includes("$17.78 Nov 18, 2026 to $20.00 Nov 25, 2026"));
t("named from and to prices are used", row("Named Ends").includes("$50.00 Oct 26, 2026 to $48.00 Nov 25, 2026") && row("Named Ends").includes("-4% 30D"));
t("a percent without history does not invent a from price", row("Percent Only").includes("+3% 7D") && !row("Percent Only").includes("mover-ends"));
t("listings counted stays off until Intel names the field", !html.includes("listings counted") && !html.includes("few") && !html.includes(">86<"));
t("no sold wording and no dash", !/\bsold\b/i.test(html) && !/[\u2014\u2013]/.test(html));
t("rows still wrap inside the page width rules", html.includes("max-width:46%") && html.includes("max-width:700px"));

if (fail) {
  console.error(fail + " failed");
  process.exit(1);
}
console.log("movers display ok");
