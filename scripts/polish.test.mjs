import { renderStatus, renderSearch, todayStrip, statusLights } from "../src/ui.mjs";
import { pageKind } from "../src/index.mjs";

let fail = 0;
const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail++; console.log("  FAIL", name); } };

const search = renderSearch();
t("slash focuses search and does not steal a field", search.includes('ev.key!=="/"') && search.includes('tag==="INPUT"') && search.includes("skel-row") && search.includes('id="q"'));
t("empty charts keep a rounded placeholder", search.includes(".chart:empty{"));

const status = renderStatus({ status: { note: "From the files.", steps: [
  { name: "TCGCSV day", file: "data/history/tcgcsv-daily/2026-10-13.json", result: "file is present", detail: "2026-10-13" },
  { name: "eBay sealed prices", file: "data/sealed-prices.json", result: "file is present", detail: "2026-10-13T11:37:01.524Z" },
  { name: "Reads", file: "research/assets/public/reads.json", result: "time is in the file, pass or fail is not", detail: "2026-10-13" },
] } }, "");
t("status lights use the file", status.includes("Prices") && status.includes('class="light ok"') && status.includes("2026-10-13") && status.includes("Listings counted") && status.includes('class="light wait"') && status.includes("Reads"));
t("a feed with no step stays off", !statusLights({ steps: [{ name: "Movers", file: "x", result: "file is present", detail: "2026-10-13" }] }).includes("Prices"));

const strip = todayStrip({ asOf: "2026-10-13", supply: "off", lines: [
  { slot: "mover", text: "Lugia up.", href: "/c/tcgcsv-1" },
  { slot: "fact", text: "Five cards up.", href: "/c/tcgcsv-2" },
  { slot: "supply", text: "Should stay off." },
] });
t("today strip keeps the mover and the pattern and hides listings when that line is off", strip.includes("Biggest move") && strip.includes("Lugia up.") && strip.includes("Pattern") && strip.includes("Five cards up.") && !strip.includes("Should stay off") && !strip.includes("listings") && !/[\u2014\u2013]|No data/i.test(strip));
t("an empty today file draws nothing", todayStrip({ lines: [] }) === "" && pageKind("/status") === "status");

if (fail) { console.log(`polish: ${fail} failed`); process.exit(1); }
console.log("polish ok");
