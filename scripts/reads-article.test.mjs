// Custom Reads email article on top of the #291 send path: approved white card
// look, story lines, honesty rules, supply lead, pathways, lengths, brief page.
import worker from "../src/index.mjs";
import { analyze, buildArticle, cleanLength, followFromPlan, loadContext, pathwayOf, renderArticle, storyFor } from "../src/reads-article.mjs";
import { briefLink, deliverOutboxEmails, emailLink, handleBrief } from "../src/reads-email.mjs";
import { gatePlan, lengthPicker, planFromFields, renderReadsPage, PRESETS } from "../src/reads.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.log("  FAIL", name); }
};
function kv() {
  const m = new Map();
  return {
    m,
    async get(k, type) { const v = m.get(k); if (v == null) return null; return type === "json" ? JSON.parse(v) : v; },
    async put(k, v) { m.set(k, String(v)); },
    async delete(k) { m.delete(k); },
  };
}
const ID = "123456789012345678";
const TO = "member@example.com";
const store = kv();
const env = { FEED_KV: store, READS_EMAIL_KEY: "re_test_key_not_real", CUSTOM_READS_TOKEN: "x".repeat(40) };
const calls = [];
const resend = async (url, init) => { calls.push({ url: String(url), init }); return new Response("{}", { status: 200 }); };

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
const art = buildArticle({ follow: {}, ctx: actx, asOf: "2026-10-18", length: "standard" });
const all = JSON.stringify(art);
t("default pathway is a bit of everything with a lead story", art.path === "default" && /led your read|biggest move/.test(art.lead));
t("held cards never appear", !all.includes("Espeon") && !all.includes("tcgcsv-555"));
t("junk outlier highs are skipped", !all.includes("Junk Ask Card"));
t("Vintage means WOTC era only", (() => { const pool = []; const a = buildArticle({ follow: { focus: "vintage" }, ctx: actx, asOf: "2026-10-18" }); return a.path === "vintage" ? a.top.name === "Dark Charizard" : a.fallback.length > 0; })() && !buildArticle({ follow: {}, ctx: actx }).top.vintage === !buildArticle({ follow: {}, ctx: actx }).top.name.includes("Dark Charizard"));
t("supply shows listings counted with both dates and skips tiny counts", art.supply.length === 1 && art.supply[0].word === "Stacking" && art.supply[0].prev === 6 && art.supply[0].n === 20);
t("group tiles count up, down and listings draining", art.tiles.length === 3 && art.tiles[0].t === "went up" && art.tiles[1].t === "went down");
const turn = analyze(series([300, 310, 330, 350, 370, 360, 340, 320, 300, 280]));
t("a turn after a climb gets a turn story", /then turned|turned down/.test(storyFor({ id: "x", name: "Card", a: turn })));
const jump = analyze(series([10, 10, 10, 10, 15, 15, 15, 15.1, 15, 15]));
t("a one step jump then flat gets that story", /One jump|one big step/.test(storyFor({ id: "y", name: "Card", a: jump })));
const thin = analyze([["2026-10-17", 5], ["2026-10-18", 6]]);
t("thin data gets quiet wording", thin.thin && /thin file|Only a few days/.test(storyFor({ id: "z", name: "Card", a: thin })));
t("a huge single step never leads", analyze(series([400, 400, 400, 400, 1500, 1500, 1500, 1500])).thin === true);
t("no story uses the generic up X% over 7 days line", ![art.top, ...art.ups, ...art.downs].some((i) => /over 7 days/i.test(i.story)));
t("pathways come from the follow", pathwayOf({ cards: ["tcgcsv-1"] }) === "watchlist" && pathwayOf({ pokemon: ["Pikachu"] }) === "pokemon" && pathwayOf({ sets: ["a"] }) === "set" && pathwayOf({}) === "default");
const poke = buildArticle({ follow: { pokemon: ["Charizard"] }, ctx: actx, asOf: "2026-10-18" });
t("a Pokemon pathway leads with that Pokemon and has its own intro", poke.path === "pokemon" && /Charizard/.test(poke.top.name) && /Charizard/.test(poke.intro));
const set151 = buildArticle({ follow: { sets: ["sv-scarlet-and-violet-151"] }, ctx: actx, asOf: "2026-10-18" });
t("a narrow quiet set falls back to everything and says so", set151.path === "default" && /quiet day/.test(set151.fallback));
t("news shows only when it ties to the follow", art.news && !poke.news);
const html = renderArticle(art, { unsubscribe: "https://catchemtcg.com/reads/email/unsubscribe?t=x" });
t("the standard article has the approved sections", ["Top move", "The whole group today", "Also moving up", "Moving down", "Listings counted", "Pattern to know", "News"].every((h) => html.includes(h)));
t("card images, pill deltas and a small table chart, no SVG", html.includes("tcgplayer-cdn.tcgplayer.com/product/") && html.includes("border-radius:999px;padding:3px 10px") && html.includes('valign="bottom"') && !html.includes("<svg"));
t("lead move has small rounded shop buttons and the footer has the grey commission note", html.includes(">Buy on TCGplayer<") && html.includes(">Buy on eBay<") && html.includes("Catch&#39;em may earn a small commission, at no extra cost to you."));
t("dark CTA and a small grey footer", html.includes(">See every card in your read<") && /font:400 11px\/1\.5[^"]*;color:#8e8e93/.test(html));
const glance = renderArticle({ ...art, length: "glance" }, { more: "https://catchemtcg.com/reads/brief?t=x" });
t("glance has three moves with Read more anchors and one supply line", (glance.match(/>Read more</g) || []).length === 3 && glance.includes("#top-move") && glance.includes("Supply: ") && !glance.includes("Moving down"));
const deep = renderArticle({ ...art, length: "deep" });
t("deep dive adds why it matters and charts on rows", deep.includes("Why it matters") && (deep.match(/valign="bottom"/g) || []).length > (html.match(/valign="bottom"/g) || []).length);
// "A listing is not a sale." is the house disclaimer and the only allowed use.
const visibleA = [html, glance, deep].join(" ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/A listing is not a sale\./g, " ");
t("no dashes, sold, sales, NM, Near Mint or advice in any length", !/[\u2013\u2014]/.test(html + glance + deep) && !/\bsold\b|\bsales?\b|\bNM\b|Near Mint/i.test(visibleA));

// Lengths and gates
t("Deep dive is Premium only", cleanLength("deep", false) === "standard" && cleanLength("deep", true) === "deep" && cleanLength("glance", false) === "glance");
t("the plan carries the length and Deep dive needs plan.deep", followFromPlan({ length: "deep", deep: false }).length === "standard" && followFromPlan({ length: "deep", deep: true }).length === "deep" && followFromPlan({ length: "glance" }).length === "glance");
t("free plans cannot keep Deep dive and get a note", (() => { const g = gatePlan({ length: "deep" }, { premium: false }); return g.plan.length === "standard" && g.notes.some((n) => n.includes("Deep dive is in Premium")); })() && gatePlan({ length: "deep" }, { premium: true }).plan.length === "deep");
t("the form carries length and vintage focus", (() => { const f = new URLSearchParams("length=glance&focus=vintage"); const p = planFromFields(f); return p.length === "glance" && p.focus === "vintage"; })());
t("the length picker locks Deep dive for free", /value="deep"[^>]*disabled/.test(lengthPicker({}, false)) && !/value="deep"[^>]*disabled/.test(lengthPicker({}, true)));
const offPage = renderReadsPage({ signedIn: true });
const onPage = renderReadsPage({ signedIn: true, emailArmed: true, premium: true });
t("while the key is unset /reads says coming soon and has no email field", offPage.includes("Email delivery is coming soon.") && !offPage.includes('type="email"') && !offPage.includes('type="radio" name="length"'));
t("with the key set /reads shows email and the length choice", onPage.includes('type="email"') && onPage.includes('type="radio" name="length"') && !onPage.includes("coming soon"));
t("four collector presets as 44px rounded buttons", PRESETS.length === 4 && ["Sealed collector", "Chase card hunter", "Vintage fan", "Set completer"].every((l) => offPage.includes(l)) && offPage.includes(".rd-preset{min-height:44px") && offPage.includes("Vintage, WOTC era"));
t("the picker copy has no dashes", !/[\u2013\u2014]/.test(offPage + onPage));

// Send path: #291 ledger and routes, article body
const files = { "reads.json": readsDoc, "price-hold.json": { ids: holdIds }, "movers.json": movers, "listings-counted.json": listings, "sets.json": setsDoc };
const publicFetch = async (url) => { const name = String(url).split("/public/").pop(); return files[name] ? new Response(JSON.stringify(files[name]), { status: 200 }) : new Response("missing", { status: 404 }); };
const ctx = await loadContext(publicFetch);
t("the context loads the public dated files", ctx.movers?.singles?.length === 6 && ctx.listings?.products?.length === 2 && ctx.holdIds["tcgcsv-555"]);
await store.put(`reads:d:${ID}`, JSON.stringify({ channels: { discord: true, email: true }, frequency: "daily", length: "glance", deep: true, sets: [], watch: [] }));
await store.put(`reads-email:${ID}`, JSON.stringify({ email: TO, status: "confirmed" }));
const outbox = { day: "2026-10-18", members: [{ discordId: ID, lead: "Your daily Catch'em read, Oct 18.", reads: [{ line: "Ledian 144/142 is $6.30 on TCGplayer market, as of Oct 18.", cardId: "tcgcsv-1001", kind: "card" }] }] };
await store.put("custom-reads:outbox", JSON.stringify(outbox));
const run = await deliverOutboxEmails({ store, env, outbox, fetchImpl: resend, feedReads: [], articleCtx: ctx });
const sent = calls.length ? JSON.parse(calls[0].init.body) : {};
t("one confirmed member gets one article letter", run.sent === 1 && calls.length === 1 && sent.html.includes("Three moves") && sent.html.includes("ce-card"));
t("the #291 stop link and List-Unsubscribe headers stay", /\/reads\/email\/stop\?id=/.test(sent.headers["List-Unsubscribe"]) && sent.headers["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click" && sent.html.includes("/reads/email/stop?id="));
t("the #291 day ledger is kept", JSON.parse(store.m.get("reads-email-sent:2026-10-18")).includes(ID));
const again = await deliverOutboxEmails({ store, env, outbox, fetchImpl: resend, feedReads: [], articleCtx: ctx });
t("no double send the same day", again.sent === 0 && calls.length === 1);
t("glance Read more opens the signed brief page", sent.html.includes("https://catchemtcg.com/reads/brief?id=" + ID + "&amp;d=2026-10-18&amp;t=") && sent.text.includes("/reads/brief?id="));
t("no address in the letter body", !sent.html.includes(TO) && !sent.text.includes(TO));
const brief = await briefLink(env, "https://catchemtcg.com", ID, "2026-10-18");
const page = await handleBrief(new Request(brief), env, { ctx });
const pageHtml = await page.text();
t("the brief page is the Standard read with section anchors", page.status === 200 && pageHtml.includes('id="top-move"') && pageHtml.includes("Moving down") && !pageHtml.includes("/reads/email/stop"));
const bad = await handleBrief(new Request(brief.replace(/t=[0-9a-f]+/, "t=00")), env, { ctx });
t("a forged brief link is refused", (await bad.text()).includes("Link not valid"));
const stale = await handleBrief(new Request(await briefLink(env, "https://catchemtcg.com", ID, "2026-10-11")), env, { ctx });
t("an old brief link says the read moved on", (await stale.text()).includes("moved on"));
const routed = await worker.fetch(new Request("https://catchemtcg.com/reads/brief"), { FEED_KV: store }, { waitUntil() {} });
t("the worker serves /reads/brief", routed.status === 200 && (await routed.text()).includes("Not available"));
const quietOutbox = { day: "2026-10-19", members: outbox.members };
await deliverOutboxEmails({ store, env, outbox: quietOutbox, fetchImpl: resend, feedReads: [], articleCtx: { movers: { singles: [], sealed: [] }, listings: { products: [] }, reads: { reads: [] }, sets: { sets: [] }, holdIds: {} } });
const plain = JSON.parse(calls[1].init.body);
t("a day with nothing to write up falls back to the #291 letter", calls.length === 2 && plain.html.includes("Ledian 144/142") && !plain.html.includes("Three moves"));
const off = await deliverOutboxEmails({ store, env: { FEED_KV: store }, outbox: { day: "2026-10-20", members: outbox.members }, fetchImpl: resend, articleCtx: ctx });
t("nothing sends without READS_EMAIL_KEY", off.armed === false && calls.length === 2);

if (fail) { console.log(fail + " failed"); process.exit(1); }
console.log("reads article ok");
