// Phase 2: learns your length, catch up, watchlist report card, quiet days, length by day.
import worker from "../src/index.mjs";
import { buildArticle, buildingQuietly, catchUp, lengthFor, renderArticle, weekdayOf, windowMove, analyze } from "../src/reads-article.mjs";
import { briefLink, deliverOutboxEmails, handleBrief, handleLengthLink, historyFor, lengthLink, loadStats, recordSend, statsKey, suggestLength } from "../src/reads-email.mjs";
import { gatePlan, lengthByDayPicker, planFromFields, renderReadsPage } from "../src/reads.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.log("  FAIL", name); }
};
function kv() {
  const m = new Map();
  return { m, async get(k, type) { const v = m.get(k); if (v == null) return null; return type === "json" ? JSON.parse(v) : v; }, async put(k, v) { m.set(k, String(v)); }, async delete(k) { m.delete(k); } };
}
const ID = "123456789012345678";
const TO = "member@example.com";
const calls = [];
const resend = async (url, init) => { calls.push(JSON.parse(init.body)); return new Response("{}", { status: 200 }); };
const fresh = () => { const store = kv(); return { store, env: { FEED_KV: store, READS_EMAIL_KEY: "re_test_key_not_real", CUSTOM_READS_TOKEN: "x".repeat(40) } }; };
const DAYS = (n) => Array.from({ length: n }, (_, i) => new Date(Date.parse("2026-10-17T00:00:00Z") - (n - 1 - i) * 86400000).toISOString().slice(0, 10));
async function member(store, plan, stats) {
  await store.put(`reads:d:${ID}`, JSON.stringify({ channels: { discord: true, email: true }, frequency: "daily", watch: [], ...plan }));
  await store.put(`reads-email:${ID}`, JSON.stringify({ email: TO, status: "confirmed" }));
  if (stats) await store.put(statsKey(ID), JSON.stringify(stats));
}
const outbox = { day: "2026-10-18", members: [{ discordId: ID, lead: "Your daily Catch'em read, Oct 18.", reads: [{ line: "Ledian 144/142 is $6.30 on TCGplayer market, as of Oct 18.", cardId: "tcgcsv-1001", kind: "card" }] }] };
const visible = (html) => html.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/A listing is not a sale\./g, " ");
const clean = (html) => !/[\u2013\u2014]/.test(html) && !/\bsold\b|\bsales?\b|\bNM\b|Near Mint/i.test(visible(html));

const D = (i) => new Date(Date.parse("2026-10-18T00:00:00Z") - i * 86400000).toISOString().slice(0, 10);
const series = (vals) => vals.map((v, i) => [D(vals.length - 1 - i), v]);
const movers = { asOf: "2026-10-18", singles: [
  { id: "move-tcgcsv-1001", name: "Ledian - 144/142", set: "SV07: Stellar Crown", hist: series([5, 5.1, 5.0, 5.2, 5.1, 5.3, 5.4, 5.6, 5.9, 6.3]), href: "/c/tcgcsv-1001" },
  { id: "move-tcgcsv-1002", name: "Charizard ex - 199/165", set: "SV: Scarlet & Violet 151", hist: series([300, 310, 330, 350, 370, 360, 340, 320, 300, 280]), href: "/c/tcgcsv-1002" },
  { id: "move-tcgcsv-1003", name: "Pikachu - 004/131", set: "SV: Prismatic Evolutions", hist: series([2, 2, 2, 2, 2, 2, 2, 2, 2.2, 2.3]), href: "/c/tcgcsv-1003" },
  { id: "move-tcgcsv-1004", name: "Junk Ask Card", set: "SV: Prismatic Evolutions", hist: series([10, 10, 10, 10, 10, 10, 10, 10, 99999, 99999]), href: "/c/tcgcsv-1004" },
  { id: "move-tcgcsv-555", name: "Espeon", set: "Neo Discovery", hist: series([900, 910, 920, 930, 940, 950, 960, 970, 980, 1200]), href: "/c/tcgcsv-555" },
  { id: "move-tcgcsv-1005", name: "Dark Charizard", set: "Team Rocket", hist: series([400, 400, 405, 410, 420, 430, 440, 450, 455, 470]), href: "/c/tcgcsv-1005" },
], sealed: [
  { id: "move-tcgcsv-77", name: "Shining Legends Elite Trainer Box", set: "Shining Legends", hist: series([80, 81, 82, 82, 83, 84, 85, 86, 88, 90]), href: "/p/tcgcsv-77" },
] };
const listings = { asOf: "2026-10-18", products: [
  { id: "sm35-etb", name: "Shining Legends Elite Trainer Box", listingsCounted: { n: 20, date: "2026-10-18", prev: { n: 6, date: "2026-10-17" } } },
  { id: "tiny", name: "Tiny Tin", listingsCounted: { n: 2, date: "2026-10-18", prev: { n: 1, date: "2026-10-17" } } },
] };
const readsDoc = { asOf: "2026-10-18", reads: [
  { id: "pf-1", readKind: "pattern-forming", headline: "Charizard ex 199/165: a flat range is forming, $280.00 on Sep 10 to $280.00 on Oct 18.", href: "/c/tcgcsv-1002", asOf: "2026-10-18" },
  { id: "news-1", readKind: "newsline", headline: "Stream details for the Nice Regional are out (Victory Road, Oct 14)", href: "https://victoryroad.pro/2027-nice/", source: "Victory Road, 2026-10-14" },
  { id: "rot-1", readKind: "rotation", headline: "SV: Scarlet & Violet 151 (mark G) left Standard: rotated April 10, 2026.", asOf: "2026-10-18" },
] };
const setsDoc = { sets: [{ slug: "sv-scarlet-and-violet-151", name: "SV: Scarlet & Violet 151", release: "2023-09-22" }, { slug: "team-rocket", name: "Team Rocket", release: "2000-04-24" }, { slug: "neo-discovery", name: "Neo Discovery", release: "2001-06-01" }, { slug: "sv07", name: "SV07: Stellar Crown", release: "2024-09-13" }] };
const holdIds = { "tcgcsv-555": "vintage" };
const actx = { movers, listings, reads: readsDoc, sets: setsDoc, holdIds };

// (1) Learns your length
const glanceOpened = { sent: DAYS(4).slice(0, 3).map((d) => ({ day: d, length: "glance", opens: 1 })) };
t("three opened Glance reads suggest Standard", suggestLength(glanceOpened, "glance", false)?.to === "standard");
t("six unopened Standard reads suggest Glance", suggestLength({ sent: DAYS(6).map((d) => ({ day: d, length: "standard", opens: 0 })) }, "standard", false)?.to === "glance");
t("Deep dive is only suggested to Premium", suggestLength({ sent: DAYS(5).map((d) => ({ day: d, length: "standard", opens: 2 })) }, "standard", false) === null && suggestLength({ sent: DAYS(5).map((d) => ({ day: d, length: "standard", opens: 2 })) }, "standard", true)?.to === "deep");
t("too little history suggests nothing", suggestLength({ sent: [{ day: "2026-10-17", length: "glance", opens: 1 }] }, "glance", false) === null);
{
  const { store, env } = fresh();
  await member(store, { length: "glance" }, glanceOpened);
  calls.length = 0;
  const run = await deliverOutboxEmails({ store, env, outbox, fetchImpl: resend, feedReads: [], articleCtx: actx });
  const mail = calls[0] || {};
  t("the footer suggests a better length with a signed accept link", run.sent === 1 && /You opened Read more on 3 of your last 3 Glance reads/.test(mail.text) && mail.html.includes(">Try Standard<") && mail.html.includes("/reads/email/length?id=" + ID + "&amp;l=standard&amp;t="));
  t("the suggestion copy is clean", clean(mail.html));
  const plan0 = JSON.parse(store.m.get(`reads:d:${ID}`));
  t("sending never changes the length on its own", plan0.length === "glance");
  const link = await lengthLink(env, "https://catchemtcg.com", ID, "standard");
  const view = await handleLengthLink(new Request(link), env);
  const viewHtml = await view.text();
  t("opening the link shows one Switch button and changes nothing", viewHtml.includes(">Switch to Standard<") && viewHtml.includes('method="post"') && JSON.parse(store.m.get(`reads:d:${ID}`)).length === "glance");
  const done = await handleLengthLink(new Request(link, { method: "POST" }), env);
  t("the tap switches the length", (await done.text()).includes("Length saved") && JSON.parse(store.m.get(`reads:d:${ID}`)).length === "standard");
  const forged = await handleLengthLink(new Request(link.replace("l=standard", "l=deep"), { method: "POST" }), env);
  t("a forged length link is refused", (await forged.text()).includes("Link not valid") && JSON.parse(store.m.get(`reads:d:${ID}`)).length === "standard");
  const sunday = await lengthLink(env, "https://catchemtcg.com", ID, "deep", "sun");
  await handleLengthLink(new Request(sunday, { method: "POST" }), env);
  t("a weekday suggestion sets only that day, and free stays Standard", JSON.parse(store.m.get(`reads:d:${ID}`)).lengthByDay.sun === "standard");
  const stats = await loadStats(store, ID);
  t("each send is logged in KV with its length and no address", stats.sent.some((s) => s.day === "2026-10-18" && s.length === "glance") && !store.m.get(statsKey(ID)).includes(TO));
  const brief = await briefLink(env, "https://catchemtcg.com", ID, "2026-10-18");
  await store.put("custom-reads:outbox", JSON.stringify(outbox));
  await handleBrief(new Request(brief), env, { ctx: actx });
  t("a Read more tap on /reads/brief counts one open", (await loadStats(store, ID)).sent.find((s) => s.day === "2026-10-18").opens === 1);
  const again = await deliverOutboxEmails({ store, env, outbox, fetchImpl: resend, feedReads: [], articleCtx: actx });
  t("still one email per member per day", again.sent === 0 && calls.length === 1);
}

// (2) Catch up
t("a paused weekly member gets a catch up from the last read", historyFor({ sent: [{ day: "2026-09-27", length: "standard", opens: 1 }] }, { frequency: "weekly" }, "2026-10-18").awaySince === "2026-09-27");
t("a member on schedule gets no catch up", !historyFor({ sent: [{ day: "2026-10-11", length: "standard", opens: 0 }] }, { frequency: "weekly" }, "2026-10-18").awaySince);
t("three unopened reads in a row start a catch up", historyFor({ sent: ["2026-10-13", "2026-10-15", "2026-10-17"].map((d) => ({ day: d, length: "standard", opens: 0 })) }, { frequency: "daily" }, "2026-10-18").awaySince === "2026-10-13");
t("a catch up does not repeat within a week", !historyFor({ awayDay: "2026-10-16", sent: ["2026-10-13", "2026-10-15", "2026-10-17"].map((d) => ({ day: d, length: "standard", opens: 0 })) }, { frequency: "daily" }, "2026-10-18").awaySince);
{
  const away = buildArticle({ ctx: actx, asOf: "2026-10-18", history: { awaySince: "2026-10-11" } });
  t("While you were away shows the three biggest moves with dates", away.away.rows.length === 3 && away.away.rows.every((r) => r.from[0] <= "2026-10-11" && r.to[0] === "2026-10-18") && !away.away.rows.some((r) => r.id === away.top.id));
  t("held cards and junk never appear in a catch up", !JSON.stringify(away.away).includes("Espeon") && !JSON.stringify(away.away).includes("Junk"));
  const old = buildArticle({ ctx: actx, asOf: "2026-10-18", history: { awaySince: "2026-09-01" } });
  t("a catch up names the real start when history is shorter", old.away.since === "2026-10-09");
  const html = renderArticle(away);
  t("the catch up card renders cleanly", html.includes("While you were away") && html.includes("The three biggest moves since Oct 11") && clean(html));
  t("no catch up section when nothing was missed", !renderArticle(buildArticle({ ctx: actx, asOf: "2026-10-18" })).includes("While you were away"));
}

// (3) Watchlist report card
{
  const follow = { cards: ["tcgcsv-1001", "tcgcsv-555"], sealed: ["tcgcsv-77"] };
  const doc = buildArticle({ follow, ctx: actx, asOf: "2026-10-18", history: { sinceDay: "2026-10-11" } });
  t("the report card covers each followed item since the last read", doc.report && doc.report.since === "2026-10-11" && doc.report.rows.length === 2 && doc.report.rows.every((r) => r.from[0] === "2026-10-11" && r.to[0] === "2026-10-18"));
  t("a held watched item stays out of the report card", !doc.report.rows.some((r) => r.id === "tcgcsv-555"));
  const html = renderArticle(doc);
  t("the report card sits at the top with dates", html.indexOf("Watchlist report card") > 0 && html.indexOf("Watchlist report card") < html.indexOf("Top move") && html.includes("since your last read, Oct 11") && clean(html));
  const first = buildArticle({ follow, ctx: actx, asOf: "2026-10-18" });
  t("a first read uses the last 7 days and says so", first.report.firstRead && first.report.since === "2026-10-11");
  t("no watchlist, no report card", !buildArticle({ ctx: actx, asOf: "2026-10-18" }).report);
}

// (4) Quiet day mode
const slow = (start, step) => series(Array.from({ length: 10 }, (_, i) => Math.round(start * (1 + step * i) * 100) / 100));
const quietCtx = { movers: { asOf: "2026-10-18", singles: [
  { id: "move-tcgcsv-2001", name: "Slow Riser", set: "SV07: Stellar Crown", hist: slow(40, 0.005), href: "/c/tcgcsv-2001" },
  { id: "move-tcgcsv-2002", name: "Flat Card", set: "SV07: Stellar Crown", hist: series([10, 10, 10, 10, 10, 10, 10, 10, 10, 10.1]), href: "/c/tcgcsv-2002" },
  { id: "move-tcgcsv-2003", name: "Slow Slider", set: "SV07: Stellar Crown", hist: slow(60, -0.004), href: "/c/tcgcsv-2003" },
], sealed: [] }, listings: { products: [] }, reads: { reads: [] }, sets: setsDoc, holdIds: {} };
{
  const q = buildArticle({ ctx: quietCtx, asOf: "2026-10-18", length: "standard" });
  t("a day with no solid move is quiet", q.quiet === true && !buildArticle({ ctx: actx, asOf: "2026-10-18" }).quiet);
  t("What's building quietly lists slow real signals", q.building.length === 2 && q.building[0].name === "Slow Riser" && /in a row|slow drift/.test(q.building[0].line) && !q.building.some((r) => r.name === "Flat Card"));
  const html = renderArticle(q);
  t("Standard on a quiet day shows the section", html.includes("What&#39;s building quietly") && clean(html));
  t("Deep dive shows it too, Glance never does", renderArticle(buildArticle({ ctx: quietCtx, asOf: "2026-10-18", length: "deep" })).includes("building quietly") && buildArticle({ ctx: quietCtx, asOf: "2026-10-18", length: "glance" }).building.length === 0);
  t("a busy day has no building quietly section", !renderArticle(buildArticle({ ctx: actx, asOf: "2026-10-18" })).includes("building quietly"));
  const { store, env } = fresh();
  await member(store, { length: "glance" });
  calls.length = 0;
  const run = await deliverOutboxEmails({ store, env, outbox, fetchImpl: resend, feedReads: [], articleCtx: quietCtx });
  t("Glance sends nothing on a quiet day and leaves the ledger alone", run.sent === 0 && calls.length === 0 && !store.m.get("reads-email-sent:2026-10-18"));
  calls.length = 0;
  const empty = await deliverOutboxEmails({ store, env, outbox: { ...outbox, day: "2026-10-19" }, fetchImpl: resend, feedReads: [], articleCtx: { movers: { singles: [], sealed: [] }, listings: { products: [] }, reads: { reads: [] }, sets: setsDoc, holdIds: {} } });
  t("Glance with nothing to write up sends nothing either", empty.sent === 0 && calls.length === 0);
  await member(store, { length: "standard" });
  const run2 = await deliverOutboxEmails({ store, env, outbox, fetchImpl: resend, feedReads: [], articleCtx: quietCtx });
  t("Standard still sends on a quiet day, with the section", run2.sent === 1 && calls[0].html.includes("building quietly"));
}

t("ratio and year ago charts never count as prices", (() => { const c = { ...actx, movers: { singles: [], sealed: [] }, reads: { asOf: "2026-10-18", reads: [{ id: "deep-1", sku: "tcgcsv-9100", name: "Singles vs sealed: Crown Zenith", readKind: "deep", chart: { label: "Singles total / sealed price", points: series([7, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 9]) } }] } }; return !buildArticle({ ctx: c, asOf: "2026-10-18" }); })());

// (5) Length by day
t("weekday of the send day", weekdayOf("2026-10-18") === "sun" && weekdayOf("2026-10-19") === "mon");
t("a Sunday Deep dive applies on Sunday for Premium", lengthFor({ length: "glance", lengthByDay: { sun: "deep" }, deep: true }, "2026-10-18").length === "deep" && lengthFor({ length: "glance", lengthByDay: { sun: "deep" }, deep: true }, "2026-10-19").length === "glance");
t("free Deep dive days read as Standard", lengthFor({ lengthByDay: { sun: "deep" }, deep: false }, "2026-10-18").length === "standard");
t("the form saves weekday lengths", (() => { const p = gatePlan(planFromFields(new URLSearchParams("length=glance&len_sun=deep&len_mon=glance&len_tue=")), { premium: true }).plan; return p.length === "glance" && p.lengthByDay.sun === "deep" && p.lengthByDay.mon === "glance" && !("tue" in p.lengthByDay); })());
t("free plans lose Deep dive days with a note", (() => { const g = gatePlan({ lengthByDay: { sun: "deep" } }, { premium: false }); return g.plan.lengthByDay.sun === "standard" && g.notes.some((n) => n.includes("Deep dive days")); })());
const picker = lengthByDayPicker({ lengthByDay: { sun: "deep" } }, true);
t("the picker has a row per weekday with point and click chips", (picker.match(/<fieldset class="rd-day">/g) || []).length === 7 && (picker.match(/type="radio" name="len_/g) || []).length === 28 && picker.includes('name="len_sun" value="deep" data-label="Deep dive" checked') && picker.includes("Glance weekdays"));
t("free members see Deep dive days locked", /name="len_sun" value="deep"[^>]*disabled/.test(lengthByDayPicker({}, false)));
const onPage = renderReadsPage({ signedIn: true, emailArmed: true, premium: true, plan: { ...gatePlan({}, { premium: true }).plan, lengthByDay: { sun: "deep" } } });
t("/reads shows length by day once email is on, with 44px chips", onPage.includes("Length by day (1 set)") && onPage.includes(".rd-chip{display:inline-flex;align-items:center;gap:8px;min-height:44px") && onPage.includes(".rd-days summary{min-height:44px") && !/[\u2013\u2014]/.test(onPage));
t("while email is off, no length controls show", !renderReadsPage({ signedIn: true }).includes("Length by day"));
{
  const { store, env } = fresh();
  await member(store, { length: "glance", lengthByDay: { sun: "deep" }, deep: true });
  calls.length = 0;
  await deliverOutboxEmails({ store, env, outbox, fetchImpl: resend, feedReads: [], articleCtx: actx });
  t("a Sunday send uses the Sunday length", calls.length === 1 && calls[0].html.includes("Deep dive") && calls[0].html.includes("Why it matters"));
}
const routed = await worker.fetch(new Request("https://catchemtcg.com/reads/email/length"), { FEED_KV: kv() }, { waitUntil() {} });
t("the worker serves /reads/email/length", routed.status === 200 && (await routed.text()).includes("Not available"));

if (fail) { console.log(fail + " failed"); process.exit(1); }
console.log("reads phase 2 ok");
