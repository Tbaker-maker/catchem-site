// Set momentum sparkline: same window as the percent, hidden when thin, no full set download.
import { readFileSync } from "node:fs";
import { factCards } from "../src/read-sheet.mjs";
import { itemReadBlock } from "../src/item-read.mjs";
import { SPARK_MIN, sparkMove, sparkSvg, applySetSpark } from "../src/set-spark.mjs";
import { loadSetIndexes, parseIndexPrefix, resetJsonCache } from "../src/data.mjs";

let fail = 0;
const t = (n, c) => { console.log(`${c ? "  ok " : "  FAIL"} ${n}`); if (!c) fail++; };
const iso = (n) => new Date(Date.parse("2026-09-01T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

function series(n, { gapAt = -1, start = 100, step = 1 } = {}) {
  const out = [];
  for (let i = 0; i < n; i += 1) out.push({ d: iso(i), v: i === gapAt ? null : start + i * step, n: 8 });
  return out;
}

const full = series(12, { gapAt: 5, step: -0.4 });
const move = sparkMove(full, full[0].d, full.at(-1).d);
t("window uses the first and last real days", move && move.from === full[0].d && move.to === full.at(-1).d && move.n === 11);
const svg = sparkSvg(full, { from: move.from, to: move.to, pct: move.pct });
t("svg from, to, and percent match the move", svg.includes(`data-from="${move.from}"`) && svg.includes(`data-to="${move.to}"`) && svg.includes(`data-pct="${move.pct}"`));
t("down line uses the down colour", move.pct < 0 && svg.includes("#e0675b") && !svg.includes("#7fc79a"));
t("a gap day is a soft line and never a No data label", svg.includes('stroke-opacity="0.35"') && !svg.includes("No data"));
t("spark reserves 72px and cannot be wider than the tile", svg.includes('width="100%"') && svg.includes('height="72"') && svg.includes("max-width:100%") && svg.includes('viewBox="0 0 320 72"') && svg.includes("min-height:72px"));
t("no em dash in the spark", !/[\u2014\u2013]/.test(svg));

const up = series(10, { step: 0.5 });
const upMove = sparkMove(up, up[0].d, up.at(-1).d);
const upSvg = sparkSvg(up, upMove);
t("up line uses the up colour", upMove.pct > 0 && upSvg.includes("#7fc79a"));
const flat = series(10, { step: 0 });
const flatMove = sparkMove(flat, flat[0].d, flat.at(-1).d);
t("flat line uses the flat colour", flatMove.pct === 0 && sparkSvg(flat, flatMove).includes("#d9b779"));

const thin = series(SPARK_MIN - 1);
const thinMove = sparkMove(thin, thin[0].d, thin.at(-1).d);
t("thin series has a move but no chart", thinMove && thinMove.n === SPARK_MIN - 1 && sparkSvg(thin, thinMove) === "");
t("a percent that does not match the line is not drawn", sparkSvg(full, { from: move.from, to: move.to, pct: move.pct + 1 }) === "");
t("a shifted window is not drawn", sparkSvg(full, { from: iso(1), to: move.to, pct: move.pct }) === "");

const mom = { pct: move.pct, from: move.from, to: move.to, set: "SV: Scarlet & Violet 151", kind: "sealed", slug: "sv-scarlet-and-violet-151", series: full };
const cards = factCards({ setMomentum: mom }).cards.join("");
t("tile links to that set's sealed chart", cards.includes('href="/sets/sv-scarlet-and-violet-151#sealed-chart"') && cards.includes('class="rd-card rd-mom"') && cards.includes("min-height:72px"));
t("singles tile links to the singles chart", factCards({ setMomentum: { ...mom, kind: "singles", series: up, pct: upMove.pct, from: upMove.from, to: upMove.to } }).cards.join("").includes("#single-chart"));
const thinHtml = factCards({ setMomentum: { pct: thinMove.pct, from: thinMove.from, to: thinMove.to, set: "Thin Set", kind: "singles", slug: "thin-set", series: thin } }).cards.join("");
t("thin data keeps the text and the link, and hides the chart", thinHtml.includes("singles index") && !thinHtml.includes("<svg") && thinHtml.includes('href="/sets/thin-set#single-chart"'));
t("no slug keeps the article and draws nothing", factCards({ setMomentum: { pct: -18.3, from: "2026-09-14", to: "2026-10-14", set: "SV10: Destined Rivals", kind: "singles" } }).cards.join("").includes("<article") && !factCards({ setMomentum: { pct: -18.3, from: "2026-09-14", to: "2026-10-14", set: "SV10: Destined Rivals", kind: "singles" } }).cards.join("").includes("<svg"));
t("bad slug is not a link", !factCards({ setMomentum: { ...mom, slug: "../nope" } }).cards.join("").includes("href="));
const block = itemReadBlock({ id: "tcgcsv-1", setMomentum: mom });
t("product read shows the spark and no em dash", block.includes("sealed index") && block.includes("<svg") && block.includes("a.rd-mom") && !/[\u2014\u2013]/.test(block));

const ui = readFileSync(new URL("../src/ui.mjs", import.meta.url), "utf8");
t("set chart keeps its id and opens on 1M from the tile", ui.includes("if(host.id) fig.id=host.id;") && ui.includes('fig.setAttribute("data-default-days","31")') && ui.includes('location.hash==="#"+host.id'));

const head = '{"name":"T","singleIndex":[{"d":"2026-10-01","v":2,"n":1},{"d":"2026-10-02","v":3,"n":1}],"sealedIndex":[{"d":"2026-10-01","v":4,"n":1}],"items":[';
t("prefix stops before items", parseIndexPrefix(head + "HUGE").singleIndex.length === 2 && parseIndexPrefix(head + "HUGE").sealedIndex[0].v === 4);

resetJsonCache();
let pulls = 0;
let cancelled = false;
const fetchImpl = async () => {
  pulls += 1;
  const stream = new ReadableStream({
    pull(controller) {
      controller.enqueue(new TextEncoder().encode(pulls === 1 ? head : "999999,"));
      if (pulls > 1 && controller.desiredSize <= 0) controller.close();
    },
    cancel() { cancelled = true; },
  });
  return new Response(stream, { status: 200, headers: { "content-type": "application/json" } });
};
const loaded = await loadSetIndexes("sv-test-set", fetchImpl);
t("range read returns the index and cancels the rest", loaded && loaded.singleIndex.length === 2 && cancelled === true);
t("a bad slug never fetches", await loadSetIndexes("Bad Slug", fetchImpl) === null && pulls === 1);
const again = await loadSetIndexes("sv-test-set", fetchImpl);
t("the prefix is cached", again && again.sealedIndex[0].v === 4 && pulls === 1);

const attached = applySetSpark({ setMomentum: { pct: 1, from: "2026-10-01", to: "2026-10-02", set: "T", kind: "sealed" } }, "sv-test-set", loaded);
t("sealed facts take the sealed index", attached.setMomentum.slug === "sv-test-set" && attached.setMomentum.series[0].v === 4);

if (fail) process.exit(1);
