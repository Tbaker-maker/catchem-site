import { banGuard } from "../src/advice-rules.mjs";
import {
  cleanIds,
  parseOfficeQuery,
  officeQuery,
  officeHref,
  officeAppQuery,
  moveCaption,
  makePostLink,
  makePostCss,
  prefillBootJs,
} from "../src/office-path.mjs";
import { renderPost, renderPostClosed, setPostOfficeOpen } from "../src/ui.mjs";
import { returnActions } from "../src/return-visit.mjs";
import { weeklyBody } from "../src/weekly.mjs";
import { paintHomePostOffice, postOfficeOn } from "../src/post-office-flag.mjs";
import { patchEditorHtml } from "../src/full-editor.mjs";
import { pageKind, renderPath } from "../src/index.mjs";
import { resetJsonCache } from "../src/data.mjs";

let fail = 0;
const t = (name, cond) => { console.log(`${cond ? "  ok " : "  FAIL"} ${name}`); if (!cond) fail++; };
const BANNED = banGuard("office-path");
const visible = (h) => String(h).replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");

t("catalog and paper ids are kept; junk is dropped",
  cleanIds(["tcgcsv-88967", "base1-4", "tcgp-A1-001", "../etc/passwd", "sold"]).join(",") === "tcgcsv-88967,base1-4,tcgp-a1-001");

t("href prefills a product",
  officeHref({ ids: "tcgcsv-88967", kind: "single" }) === "/post-office?ids=tcgcsv-88967&kind=single");

t("a weekly move rides in the query", (() => {
  const href = officeHref({
    ids: "tcgcsv-88967",
    kind: "single",
    name: "Scizor ex",
    move: "+298.9%",
    from: "2026-10-10",
    to: "2026-10-13",
    p0: 45.99,
    p1: 183.44,
  });
  const q = parseOfficeQuery(href);
  return q.ids[0] === "tcgcsv-88967" && q.move === "+298.9%" && q.from === "2026-10-10" && q.p0 === "45.99" && q.name === "Scizor ex";
})());

t("hostile query values never reach the href",
  officeQuery({ ids: ["tcgcsv-1", "tcgcsv-1<script>"], name: "Buy now — sold", move: "buy!", kind: "premium", tone: "money" }) === "ids=tcgcsv-1");

t("the iframe src carries only the allow-listed query",
  officeAppQuery("?ids=tcgcsv-246723&kind=single&evil=<script>&v=hack", "rev123456789") === "/post-office/app?v=rev123456789&ids=tcgcsv-246723&kind=single");

t("move caption is the prices and the dates, never advice",
  moveCaption({ name: "Scizor ex", move: "+298.9%", from: "2026-10-10", to: "2026-10-13", p0: 45.99, p1: 183.44 })
    === "Scizor ex: $45.99 on Oct 10, 2026 to $183.44 on Oct 13, 2026. +298.9%.");

t("listings caption says listings counted",
  moveCaption({ name: "Pikachu", listings: true, p0: 12, p1: 10, from: "2026-10-13", to: "2026-10-06", move: "+20%" })
    === "Pikachu: 12 listings counted on Oct 13, 2026, from 10 on Oct 6, 2026. +20%.");

const hrefOf = (html) => ((html.match(/class="make-post" href="([^"]+)"/) || [])[1] || "").replaceAll("&amp;", "&");
const link = makePostLink({ ids: "tcgcsv-88967", kind: "single" });
t("the Make a post link points at the prefilled office",
  link.includes("Make a post") && hrefOf(link) === "/post-office?ids=tcgcsv-88967&kind=single" && makePostCss().includes("min-height:44px"));

const card = { id: "tcgcsv-88967", name: "Scizor ex", kind: "single", asOf: "2026-10-13" };
const acts = returnActions(card, { asOf: "2026-10-13", price: 183.44, series: [["2026-10-10", 45.99], ["2026-10-13", 183.44]] });
t("a product page action row has Make a post next to Share", (() => {
  const href = hrefOf(acts);
  const q = parseOfficeQuery(href);
  return acts.includes('class="rv-share"') && acts.includes("Make a post") && q.ids[0] === "tcgcsv-88967" && q.kind === "single";
})());

const sealedActs = returnActions({ id: "tcgcsv-100", name: "Surging Sparks ETB", kind: "sealed" }, { asOf: "2026-10-13", price: 49.99 });
t("a sealed product prefills kind=sealed",
  parseOfficeQuery(hrefOf(sealedActs)).ids[0] === "tcgcsv-100" && parseOfficeQuery(hrefOf(sealedActs)).kind === "sealed");

const weekly = weeklyBody({
  asOf: "2026-10-13",
  movers: [{ id: "tcgcsv-88967", name: "Scizor ex", number: "108/115", set: "EX Unseen Forces", from: "2026-10-10", to: "2026-10-13", p0: 45.99, p1: 183.44, pct: 298.9 }],
}, {});
t("a weekly mover row has a prefilled Make a post link", (() => {
  const href = (weekly.match(/class="make-post" href="([^"]+)"/) || [])[1] || "";
  const q = parseOfficeQuery(href.replaceAll("&amp;", "&"));
  return weekly.includes('href="/c/tcgcsv-88967"') && weekly.includes("Make a post") && q.ids[0] === "tcgcsv-88967" && q.move === "+298.9%" && q.kind === "single" && q.from === "2026-10-10";
})());

const listingsWeek = weeklyBody({
  asOf: "2026-10-13",
  listingsCounted: { changes: [{ id: "tcgcsv-1", name: "Pikachu", n: 12, prev: 10, date: "2026-10-13", prevDate: "2026-10-06" }] },
}, {});
t("a listings-counted row also has Make a post",
  listingsWeek.includes("listings counted") && listingsWeek.includes("Make a post") && listingsWeek.includes("ids=tcgcsv-1") && listingsWeek.includes("listings=1"));

setPostOfficeOpen(true);
const page = renderPost("", "", { editorRev: "abcdef123456", officeSearch: "?ids=tcgcsv-246723&kind=single" });
t("the open Post Office iframe is prefilled from the page query",
  page.includes('src="/post-office/app?v=abcdef123456&ids=tcgcsv-246723&kind=single"') && page.includes("Post Office editor"));

setPostOfficeOpen(false);
const closed = renderPostClosed({});
t("coming soon still renders when the flag is off, even with a query",
  closed.includes("Coming soon") && !closed.includes("Post Office editor"));
setPostOfficeOpen(true);

const baked = '<a class="po-beta-link" href="/post-office" data-po="closed">Post Office <span class="po-beta">Closed Beta</span></a>';
t("an open nav label is Make a post",
  paintHomePostOffice(baked, true).includes('href="/post-office">Make a post</a>') && postOfficeOn({ POST_OFFICE: "on" }) === true);

const boot = prefillBootJs();
t("prefill resolves tcgcsv ids, fills a caption, and has empty and error states",
  boot.includes("window.__ce.inject") && boot.includes("c.cid") && boot.includes("Draft started")
  && boot.includes("Pick a card, then Make the picture")
  && boot.includes("That product is not in the Post Office catalog.")
  && boot.includes("That sealed product is not in the Post Office catalog yet.")
  && boot.includes("copy the text or post to X")
  && !/sold/i.test(boot) && !/premium|\$9|monetize/i.test(boot));

const patched = patchEditorHtml("<html><body><p class=\"note\" id=\"tray-fact\"></p><script></script></body></html>", "2026-10-13");
t("the patched editor includes the prefill boot",
  patched.includes('id="path-boot"') && patched.includes("window.__ce.inject"));

t("copy stays clean", !BANNED.test(visible(link + acts + weekly + moveCaption({ name: "Scizor ex", move: "+1%", from: "2026-10-10", to: "2026-10-13", p0: 1, p1: 2 })))
  && !/[\u2014\u2013]/.test(weekly) && !/\bsolds?\b/i.test(weekly + acts + link));

const fetchImpl = async (url) => {
  const u = String(url);
  const send = (payload) => new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
  if (u.endsWith("/research/assets/public/counts.json")) return send({ asOf: "2026-10-13", updatedAt: "2026-10-13T12:00:00Z" });
  if (u.endsWith("/research/assets/public/feed/status.json")) return send({ images: { tcgplayer: false } });
  return new Response("no", { status: 404 });
};
resetJsonCache();
t("post-office is the post kind", pageKind("/post-office") === "post");
const openPage = await renderPath("/post-office", fetchImpl, { postOffice: true, officeSearch: "?ids=tcgcsv-246723", editorRev: "testdevrev01" });
const openHtml = await openPage.text();
t("renderPath forwards the prefill query into the iframe",
  openPage.status === 200 && openHtml.includes("ids=tcgcsv-246723") && openHtml.includes("/post-office/app?"));

if (fail) { console.log(`${fail} failed`); process.exit(1); }
console.log("office-path ok");
