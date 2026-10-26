import { banGuard } from "../src/advice-rules.mjs";
import {
  INTERESTING_NOW,
  LEDGER_MISS,
  PULSE_MONTH,
  RECEIPTS,
  RUMOR_PRICE,
  SAMPLE_POSTS,
  WEEK_CALENDAR,
  foundInExplorer,
  receiptSvg,
  skeptic,
} from "../src/share-receipt.mjs";

const BANNED = banGuard("share-posts");
const DASH = /[\u2014\u2013]/;

export function runSharePostTests() {
  let fail = 0;
  const t = (name, cond) => { console.log(`${cond ? "  ok " : "  FAIL"} ${name}`); if (!cond) fail++; };

  t("three receipt cards", RECEIPTS.length === 3);
  for (const card of RECEIPTS) {
    const svg = receiptSvg(card);
    t(`${card.id} has wordmark, gold frame, watermark, source, date, link`,
      svg.includes("Catch'em")
      && svg.includes('fill="#12100e"')
      && svg.includes('stroke="#d9b779"')
      && svg.includes('fill-opacity="0.07"')
      && svg.includes(card.source)
      && svg.includes(card.date)
      && svg.includes(card.href.replace("https://", ""))
      && svg.includes('font-size="168"'));
    t(`${card.id} copy is clean`, !DASH.test(svg) && !BANNED.test(svg) && skeptic(card).length === 0);
  }
  t("sealed cards do not carry a condition", !/\bNM\b|Near Mint/.test(receiptSvg(RUMOR_PRICE) + receiptSvg(LEDGER_MISS)));
  t("the ledger card shows a miss, not a win", LEDGER_MISS.big === "Miss" && receiptSvg(LEDGER_MISS).includes("8 misses"));
  t("pulse is the month endpoints, not a picked card", PULSE_MONTH.big === "69" && PULSE_MONTH.lines[0].includes("17") && PULSE_MONTH.href.endsWith("/meter"));

  const week = foundInExplorer();
  t("weekly post keeps the one list in order", week.ok && week.items.map((row) => row.id).join() === INTERESTING_NOW.map((row) => row.id).join());
  t("weekly post names the Explorer and links home", week.text.startsWith("Found in the Explorer") && week.href === "https://catchemtcg.com/");
  const dropped = foundInExplorer([INTERESTING_NOW[0]]);
  t("a lone up line is not the weekly post", dropped.ok === false && dropped.reasons.includes("not the one list"));
  t("a brag is refused", skeptic({ ...PULSE_MONTH, lines: ["We called it."] }).includes("brag"));
  t("sold is refused", skeptic({ ...PULSE_MONTH, lines: ["12 sold"] }).includes("sold"));
  t("a sealed condition is refused", skeptic({ ...RUMOR_PRICE, lines: ["$10 NM"] }).includes("condition"));

  t("five sample posts", SAMPLE_POSTS.length === 5);
  for (const post of SAMPLE_POSTS) {
    t(`sample ${post.id} is a receipt`, skeptic(post).length === 0 && !DASH.test(post.text) && !BANNED.test(post.text) && post.text.includes("catchemtcg.com"));
  }
  t("calendar has seven days and two rest days", WEEK_CALENDAR.length === 7 && WEEK_CALENDAR.filter((row) => row.post === "No post").length === 2);
  t("nothing in the samples says Collectr", SAMPLE_POSTS.every((post) => !/Collectr/i.test(post.text)));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("share-posts.test.mjs")) {
  const n = runSharePostTests();
  if (n) { console.log(`${n} failed`); process.exit(1); }
  console.log("share posts: all passed");
}
