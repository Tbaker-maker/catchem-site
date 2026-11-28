import { readFileSync } from "node:fs";
import { flagLine } from "../src/advice-rules.mjs";
import { returnVisitBody, sinceHere, sinceHereHomeHtml } from "../src/return-visit.mjs";

let fail = 0;
const t = (name, ok) => { console.log((ok ? "ok   " : "FAIL ") + name); if (!ok) fail++; };

const day = (n) => new Date(Date.parse("2026-10-01T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const asOf = day(24);
const yesterday = day(23);
const weekAgo = day(17);

function hist(priceAt) {
  return Array.from({ length: 25 }, (_, i) => {
    let price = 100;
    for (const k of Object.keys(priceAt).map(Number).sort((a, b) => a - b)) {
      if (i >= k) price = priceAt[k];
    }
    return [day(i), price];
  });
}

const todayMover = { id: "tcgcsv-1", name: "Today Card", href: "/c/tcgcsv-1", kind: "single", source: "TCGplayer market", hist: hist({ 24: 120 }) };
const midWeek = { id: "tcgcsv-2", name: "Week Card", href: "/c/tcgcsv-2", kind: "single", source: "TCGplayer market", hist: hist({ 20: 150 }) };
const oldMover = { id: "tcgcsv-3", name: "Old Card", href: "/c/tcgcsv-3", kind: "single", source: "TCGplayer market", hist: hist({ 11: 180 }) };
const quiet = { id: "tcgcsv-4", name: "Quiet Box", href: "/p/tcgcsv-4", kind: "sealed", source: "TCGplayer market", hist: hist({}) };
const sealed = {
  id: "tcgcsv-5",
  name: "Evolving Skies Booster Box NM",
  href: "/p/tcgcsv-5",
  kind: "sealed",
  source: "TCGplayer market",
  hist: Array.from({ length: 25 }, (_, i) => [day(i), i === 24 ? 95.8 : 100, i === 24 ? 40 : 32]),
};
const moves = [todayMover, midWeek, oldMover];
const reads = [
  { title: "A dated read", date: asOf, source: "Published reads", href: "/feed" },
  { title: "An older read", date: day(10), source: "Published reads", href: "/feed" },
];
const releases = [
  { name: "A set release", date: asOf, source: "Pokemon.com", href: "/releases" },
  { name: "An old release", date: day(10), source: "Pokemon.com", href: "/releases" },
];

const first = sinceHere({ moves, reads, releases, asOf });
const firstText = JSON.stringify(first);
t("first visit returns today's lines only",
  first.some((line) => line.href === "/c/tcgcsv-1" && line.date === asOf && line.source && line.kind === "move")
  && !first.some((line) => line.href === "/c/tcgcsv-2" || line.href === "/c/tcgcsv-3")
  && first.some((line) => line.kind === "read" && line.date === asOf)
  && !first.some((line) => line.kind === "read" && line.date !== asOf)
  && first.some((line) => line.kind === "release" && line.date === asOf)
  && !first.some((line) => line.kind === "release" && line.date !== asOf)
  && first.every((line) => line.date === asOf)
  && !/missed/i.test(firstText));
t("first visit is not an empty hole or a guilt line", first.length > 0 && !/you missed|this morning|\bstreak\b/i.test(firstText));

const oneDay = sinceHere({ moves, lastVisit: yesterday, asOf });
t("visit one day ago includes a move dated after that day", oneDay.some((line) => line.href === "/c/tcgcsv-1" && line.date > yesterday && line.source));
t("visit one day ago excludes an older move", !oneDay.some((line) => line.href === "/c/tcgcsv-2" || line.href === "/c/tcgcsv-3"));

const week = sinceHere({ moves, lastVisit: weekAgo, asOf });
t("visit one week ago includes the week window",
  week.some((line) => line.href === "/c/tcgcsv-2" && /since Oct 18/.test(line.text) && line.date > weekAgo)
  && week.some((line) => line.href === "/c/tcgcsv-1")
  && !week.some((line) => line.href === "/c/tcgcsv-3"));

const quietDay = sinceHere({ moves: [quiet], lastVisit: weekAgo, asOf });
t("quiet day does not invent a move",
  quietDay.every((line) => line.kind !== "move")
  && !quietDay.some((line) => /Quiet Box/.test(line.text))
  && !quietDay.some((line) => /\b(up|down) \d/.test(line.text)));

const sealedLines = sinceHere({ moves: [sealed], lastVisit: yesterday, asOf });
const sealedText = sealedLines.map((line) => `${line.text} ${line.source}`).join(" ");
const sealedHtml = sinceHereHomeHtml({ moves: [sealed], lastVisit: yesterday, asOf });
t("sealed line has no NM",
  sealedLines.length === 1
  && sealedLines[0].kind === "move"
  && !/\bNM\b|Near Mint/.test(sealedText + sealedHtml)
  && /listings counted/.test(sealedText)
  && !/\bsold\b/i.test(sealedText + sealedHtml));

const lpSealed = { ...sealed, id: "tcgcsv-6", name: "LP Hidden Fates Tin Lightly Played", href: "/p/tcgcsv-6" };
const lpLines = sinceHere({ moves: [lpSealed], lastVisit: yesterday, asOf });
const lpText = lpLines.map((line) => line.text).join(" ");
t("sealed line drops LP and Lightly Played",
  lpLines.length === 1
  && /Hidden Fates Tin/.test(lpText)
  && !/\b(NM|LP|MP|HP|DMG)\b|Near Mint|Lightly Played/.test(lpText));

const bare = sinceHere({ asOf });
t("missing lists are omitted", bare.length === 0);

const shell = sinceHereHomeHtml();
t("server shell has the heading and one honest line",
  shell.includes("Since you were last here")
  && shell.includes("Today's changes load from the published files.")
  && shell.includes('id="since-here-body"><p class="since-here-note"')
  && !shell.includes("you missed"));

const home = readFileSync(new URL("../index.html", import.meta.url), "utf8");
t("home renders the shell", home.includes('id="since-here"') && home.includes("Since you were last here") && home.includes("Today's changes load from the published files.") && !home.includes('id="since-here-body"></div>'));
t("home reuses the visit key and the return-visit payload", home.includes('var KEY="catchem-visit-day"') && home.includes('"/api/return-visit"') && home.includes("doc.here"));
t("home does not load reads or releases for this module", !home.includes("/data/reads.json") && !home.includes("releases.json"));
const staticSince = (home.split('id="since-here-body"')[1] || "").split("</div>")[0];
t("home HTML does not invent read or release rows", !/read|release/i.test(staticSince) && !staticSince.includes("since-here-row"));

const watched = returnVisitBody({ asOf, products: moves }, { since: weekAgo, ids: ["tcgcsv-1"], watchedOnly: true });
t("watched lines stay on that product while here keeps the week window",
  watched.lines.length === 1
  && watched.lines[0].href === "/c/tcgcsv-1"
  && watched.here.some((line) => line.href === "/c/tcgcsv-2"));
const firstBody = returnVisitBody({ asOf, products: moves }, {});
t("first visit payload still has empty lines and fills today's here rows",
  firstBody.mode === "first" && firstBody.lines.length === 0 && firstBody.here.some((line) => line.href === "/c/tcgcsv-1") && !firstBody.here.some((line) => line.href === "/c/tcgcsv-2"));
t("live here payload does not invent read or release rows",
  [firstBody, watched].every((body) => Array.isArray(body.here) && body.here.every((line) => line.kind !== "read" && line.kind !== "release")));

const copy = [
  "Since you were last here",
  "Today's changes load from the published files.",
  ...first.map((line) => line.text),
  ...oneDay.map((line) => line.text),
  ...week.map((line) => line.text),
  ...quietDay.map((line) => line.text),
  ...sealedLines.map((line) => line.text),
  ...lpLines.map((line) => line.text),
];
for (const line of copy) {
  t("copy clean: " + line.slice(0, 60), flagLine(line).length === 0 && !/[\u2014\u2013]/.test(line) && !/\bsold\b/i.test(line));
}

if (fail) {
  console.log(fail + " failed");
  console.log(JSON.stringify({ first, oneDay, week, quietDay, sealedLines }, null, 2));
  process.exit(1);
}
console.log("since-here ok");
