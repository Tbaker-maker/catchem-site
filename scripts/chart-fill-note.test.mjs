// Earlier fan-site days are tagged and named in the About note, with no em dashes.
import { historyChart, mergeHistory } from "../src/history-chart.mjs";
let fail = 0;
const pts = mergeHistory([["2025-10-01", 90], ["2026-03-01", 95], ["2026-09-26", 100], ["2026-10-12", 101]], "", "2026-09-26");
if (pts.filter((p) => p[2] === "f").length !== 2 || pts.filter((p) => p[2] === "n").length !== 2) { console.error("FAIL fill days are not tagged", pts); fail++; }
const html = historyChart(pts, { ownLabel: "TCGplayer market price, our nightly pull" });
if (!/Earlier history comes from public fan-site data/.test(html)) { console.error("FAIL About note does not name the fan-site data"); fail++; }
if (/\u2014/.test(html)) { console.error("FAIL em dash in chart note"); fail++; }
if (!/data-days="366"/.test(html)) { console.error("FAIL a year of history should offer the 1Y range"); fail++; }
const plain = historyChart(mergeHistory([["2026-09-26", 100], ["2026-10-12", 101]], ""));
if (/fan-site/.test(plain)) { console.error("FAIL note names fan-site data with none on the line"); fail++; }
if (fail) process.exit(1); else console.log("chart fill note ok");
