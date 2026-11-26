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

// Live sweep Nov 25 finding 9: rows ranked by dollar change showed only percent.
{
  const ranked = renderMovers({ asOf: "2026-11-25", singlesRising: [
    { name: "Big Dollar", href: "/c/tcgcsv-11", set: "A", price: 2600.92, fromPrice: 2186.88, fromDate: "2026-10-26", changePct: 18.9, windowDays: 30 },
    { name: "Big Percent", href: "/c/tcgcsv-12", set: "B", price: 30.85, fromPrice: 11, fromDate: "2026-10-26", changePct: 180.5, windowDays: 30 },
  ] }, "");
  t("a list ordered by dollar change says so and shows the dollar change", ranked.includes("Ranked by dollar change, largest first.") && ranked.includes("+$414.04") && ranked.includes("+$19.85"));
  const mixed = renderMovers({ asOf: "2026-11-25", singlesRising: [
    { name: "Small", href: "/c/tcgcsv-13", set: "A", price: 12, fromPrice: 10, fromDate: "2026-10-26", changePct: 20, windowDays: 30 },
    { name: "Large", href: "/c/tcgcsv-14", set: "B", price: 200, fromPrice: 100, fromDate: "2026-10-26", changePct: 100, windowDays: 30 },
  ] }, "");
  t("a list not in dollar order gets no ranking label", !mixed.includes("Ranked by dollar change"));
}

if (fail) {
  console.error(fail + " failed");
  process.exit(1);
}
console.log("movers display ok");
