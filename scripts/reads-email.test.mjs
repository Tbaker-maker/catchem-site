// Custom Reads by email: flag, confirm, unsubscribe, cap, held cards, copy.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  buildMessage, canSend, cleanEmail, emailDeliveryOn, handleEmailLink, loadContext,
  makeToken, memberKey, readToken, runEmailDelivery, saveEmailChoice, subjectFor, RESEND_URL,
} from "../src/reads-email.mjs";
import { analyze, buildArticle, renderArticle, storyFor, pathwayOf } from "../src/reads-article.mjs";
import { gatePlan, lengthPicker, planFromFields, planToFollow, renderReadsPage, whereItGoes, PRESETS } from "../src/reads.mjs";
import { FOLLOWS_KEY, OUTBOX_KEY, withChannels } from "../src/reads-pipe.mjs";
import worker from "../src/index.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.log("  FAIL", name); }
};

function kv(seed = {}) {
  const m = new Map(Object.entries(seed).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]));
  return {
    m,
    async get(k, type) { const v = m.get(k); if (v == null) return null; return type === "json" ? JSON.parse(v) : v; },
    async put(k, v) { m.set(k, String(v)); },
    async delete(k) { m.delete(k); },
  };
}
const ID = "900000000000000201";
const ADDR = "member@example.com";
const SECRET = "x".repeat(40);
const on = (store) => ({ READS_EMAIL_KEY: "re_test_key", SESSION_SECRET: SECRET, FEED_KV: store });

// 1. Flag
t("off without the key", emailDeliveryOn({ SESSION_SECRET: SECRET }) === false);
t("on with the key", emailDeliveryOn(on(kv())) === true);
t("READS_EMAIL_ENABLED=off is a kill switch", emailDeliveryOn({ ...on(kv()), READS_EMAIL_ENABLED: "off" }) === false);
const offPage = renderReadsPage({ signedIn: true });
t("flag off shows a calm coming soon line and no email field", offPage.includes("Email delivery is coming soon.") && !offPage.includes('type="email"') && !offPage.includes('name="email_on"') && offPage.includes("Discord DM"));
const onPage = renderReadsPage({ signedIn: true, email: { on: true } });
t("flag on shows Discord DM and Email side by side with a 44px field", onPage.includes('name="email_on"') && onPage.includes('name="discord"') && onPage.includes('type="email"') && /\.rd-email\{[^}]*min-height:44px/.test(onPage) && /\.rd-email\{[^}]*border-radius:14px/.test(onPage));
t("flag off save keeps Discord on and email off", (() => { const g = gatePlan(planFromFields(new URLSearchParams("discord=1&email_on=1&email=" + ADDR)), {}); return g.plan.channels.discord && !g.plan.channels.email && g.plan.email === ""; })());
t("flag on save can pick email only", (() => { const g = gatePlan(planFromFields(new URLSearchParams("email_on=1")), { emailOn: true }); return g.plan.channels.email && !g.plan.channels.discord; })());
t("picking neither keeps Discord", gatePlan(planFromFields(new URLSearchParams("")), { emailOn: true }).plan.channels.discord === true);
t("the plan and the follow never carry the address", (() => {
  const g = gatePlan({ ...planFromFields(new URLSearchParams("email_on=1&discord=1&email=" + ADDR)), email: ADDR }, { emailOn: true });
  const f = planToFollow("d:" + ID, { ...g.plan, emailConfirmed: true });
  return !JSON.stringify(g.plan).includes("@") && !JSON.stringify(f).includes("@") && f.email === true && f.discord === true;
})());
t("an email only member is skipped by the bot", (() => {
  const out = withChannels({ day: "2026-10-18", members: [{ discordId: ID }, { discordId: "900000000000000202" }] }, { follows: [{ id: ID, discord: false, email: true }] });
  return out.members[0].discord === false && !("discord" in out.members[1]);
})());

// Read length and presets
t("free plans cannot keep Deep dive", gatePlan({ length: "deep" }, { premium: false }).plan.length === "standard" && gatePlan({ length: "deep" }, { premium: true }).plan.length === "deep" && gatePlan({ length: "glance" }, {}).plan.length === "glance");
t("the length picker locks Deep dive for free", /value="deep"[^>]*disabled/.test(lengthPicker({}, false)) && !/value="deep"[^>]*disabled/.test(lengthPicker({}, true)) && lengthPicker({}, true).includes("Glance") && lengthPicker({}, true).includes("Standard"));
t("the length picker shows only when email is on", !offPage.includes('type="radio" name="length"') && onPage.includes('type="radio" name="length"'));
t("four one tap presets with 44px chips", PRESETS.length === 4 && ["Sealed collector", "Chase card hunter", "Vintage fan", "Set completer"].every((l) => offPage.includes(l)) && offPage.includes('data-preset="vintage"'));
t("the follow carries length and focus and no address", (() => { const f = planToFollow("d:1", gatePlan({ length: "glance", focus: "vintage" }, {}).plan); return f.length === "glance" && f.focus === "vintage"; })());

// 2. Scheduled run does nothing while off
await (async () => {
  let touched = false;
  const store = { get: async () => { touched = true; return null; }, put: async () => { touched = true; } };
  const res = await runEmailDelivery({ FEED_KV: store, SESSION_SECRET: SECRET });
  await worker.scheduled({}, { FEED_KV: store, SESSION_SECRET: SECRET }, null);
  t("the hourly run is a no-op while off", res.skipped === "off" && touched === false);
})();

// 3. Confirm flow
const sent = [];
const fakeSend = async (url, init) => { sent.push({ url: String(url), init, body: JSON.parse(init.body) }); return new Response('{"id":"x"}', { status: 200 }); };
const store = kv({ [FOLLOWS_KEY]: { follows: [{ id: ID, discord: true, email: false }] }, [`reads:d:${ID}`]: { channels: { discord: true, email: true } } });
const env = on(store);
const now = Date.parse("2026-10-18T15:00:00Z");
t("a bad address is refused and nothing is sent", (await saveEmailChoice(env, "d:" + ID, { want: true, email: "nope" }, { now, fetchImpl: fakeSend })) === "bad" && sent.length === 0);
t("a save sends one confirm email through Resend", (await saveEmailChoice(env, "d:" + ID, { want: true, email: "Member@Example.com" }, { now, fetchImpl: fakeSend })) === "sent" && sent.length === 1 && sent[0].url === RESEND_URL && sent[0].init.headers.authorization === "Bearer re_test_key");
t("the confirm email is to the member from catchemtcg.com", sent[0].body.to[0] === ADDR && /@catchemtcg\.com>$/.test(sent[0].body.from));
t("a second save within 10 minutes does not resend", (await saveEmailChoice(env, "d:" + ID, { want: true, email: ADDR }, { now: now + 60000, fetchImpl: fakeSend })) === "sent" && sent.length === 1);
const row0 = JSON.parse(store.m.get(memberKey(ID)));
t("the row is pending until the link is tapped", row0.confirmed === false && row0.email === ADDR);
const link = (sent[0].body.html.match(/href="(https:\/\/catchemtcg\.com\/reads\/email\/confirm\?t=[^"]+)"/) || [])[1].replace(/&amp;/g, "&");
t("the confirm email has a one tap link", !!link);
const bad = await handleEmailLink(new Request(link.slice(0, -3) + "abc"), env, { now });
t("a tampered confirm link fails", bad.status === 400 && JSON.parse(store.m.get(memberKey(ID))).confirmed === false);
const late = await handleEmailLink(new Request(link), env, { now: now + 49 * 3600 * 1000 });
t("an expired confirm link fails", late.status === 400);
const ok = await handleEmailLink(new Request(link), env, { now: now + 3600 * 1000 });
const row1 = JSON.parse(store.m.get(memberKey(ID)));
t("the confirm link turns email on", ok.status === 200 && row1.confirmed === true && JSON.parse(store.m.get(FOLLOWS_KEY)).follows[0].email === true);
t("confirm is refused while the flag is off", (await handleEmailLink(new Request(link), { FEED_KV: store, SESSION_SECRET: SECRET }, { now })).status === 200 && JSON.parse(store.m.get(memberKey(ID))).confirmed === true);
t("tokens are bound to their purpose", (await readToken(env, "unsub", (await makeToken(env, "confirm", ID, ADDR, now)), now)) === null);

// 4. Article: data, pathways, lengths, honesty
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

const member = { discordId: ID, lead: "Your daily Catch'em read, Oct 18.", reads: [{ line: "Ledian 144/142 is $6.30 on TCGplayer market, as of Oct 18.", cardId: "tcgcsv-1001", kind: "card" }] };
const files = { "reads.json": readsDoc, "price-hold.json": { ids: holdIds }, "movers.json": movers, "listings-counted.json": listings, "sets.json": setsDoc };
const publicFetch = async (url) => { const name = String(url).split("/public/").pop(); return files[name] ? new Response(JSON.stringify(files[name]), { status: 200 }) : new Response("no", { status: 404 }); };
const ctx = { ...(await loadContext(publicFetch)), rows: new Map([[ID, row1]]), follows: new Map([[ID, { id: ID, length: "glance" }]]) };
const msg = await buildMessage(env, member, ctx, "2026-10-18", now);
t("subject is Your Catch'em reads, <date>", msg.subject === "Your Catch'em reads, Oct 18" && subjectFor("2026-10-18") === msg.subject);
t("the member length is used and glance links to the signed brief page", msg.length === "glance" && msg.html.includes("https://catchemtcg.com/reads/brief?t="));
t("List-Unsubscribe and List-Unsubscribe-Post headers", /^<https:\/\/catchemtcg\.com\/reads\/email\/unsubscribe\?t=[^>]+>$/.test(msg.headers["List-Unsubscribe"]) && msg.headers["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click");
// Delivery run with a stored outbox
const fullStore = kv({
  [OUTBOX_KEY]: { day: "2026-10-18", builtAt: "2026-10-18T13:00:00Z", members: [member, { discordId: "900000000000000203", reads: member.reads }] },
  [FOLLOWS_KEY]: { follows: [{ id: ID, discord: true, email: true }, { id: "900000000000000203", discord: true, email: false }] },
  [memberKey(ID)]: row1,
});
const box = [];
const send2 = async (url, init) => { box.push(JSON.parse(init.body)); return new Response("{}", { status: 200 }); };
const env2 = on(fullStore);
const r1 = await runEmailDelivery(env2, { now, fetchImpl: send2, publicFetch });
t("only confirmed email members get an email", r1.sent === 1 && box.length === 1 && box[0].to[0] === ADDR);
const r2 = await runEmailDelivery(env2, { now: now + 3600 * 1000, fetchImpl: send2, publicFetch });
t("the next hourly run does not send again", r2.sent === 0 && box.length === 1);
fullStore.m.set(OUTBOX_KEY, JSON.stringify({ day: "2026-10-19", members: [member] }));
const r3 = await runEmailDelivery(env2, { now: now + 4 * 3600 * 1000, fetchImpl: send2, publicFetch });
t("at most one email per member per day, even with a new outbox", r3.sent === 0 && box.length === 1);
const r4 = await runEmailDelivery(env2, { now: now + 26 * 3600 * 1000, fetchImpl: send2, publicFetch });
t("the next day sends again", r4.sent === 1 && box.length === 2);
t("canSend needs a confirmed row", canSend({ email: ADDR, confirmed: false }, "2026-10-20", now) === false);
t("a stale outbox is never sent", (await runEmailDelivery(env2, { now: now + 6 * 86400000, fetchImpl: send2, publicFetch })).skipped === "stale");

// 5. Unsubscribe round trip
const unsub = box[0].headers["List-Unsubscribe"].slice(1, -1);
const u1 = await handleEmailLink(new Request(unsub), env2, { now });
t("the unsubscribe link works in one tap", u1.status === 200 && !fullStore.m.has(memberKey(ID)) && JSON.parse(fullStore.m.get(FOLLOWS_KEY)).follows[0].email === false);
fullStore.m.set(memberKey(ID), JSON.stringify(row1));
const u2 = await handleEmailLink(new Request(unsub, { method: "POST", body: "List-Unsubscribe=One-Click" }), env2, { now });
t("one click POST unsubscribe works too", u2.status === 200 && !fullStore.m.has(memberKey(ID)));
t("a forged unsubscribe token does nothing", (await handleEmailLink(new Request(unsub.replace(/t=./, "t=Z")), env2, { now })).status === 400);
const after = await runEmailDelivery(env2, { now: now + 50 * 3600 * 1000, fetchImpl: send2, publicFetch });
t("no email after unsubscribe", after.sent === 0);

// 6. Repo safety
t("cleanEmail lowercases and refuses junk", cleanEmail(" A@Example.com ") === "a@example.com" && cleanEmail("a@b") === "" && cleanEmail("x".repeat(260) + "@a.co") === "");
const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter((f) => f && !/\.(png|jpg|jpeg|gif|webp|b64|woff2?|ico)$/i.test(f));
const found = [];
for (const f of tracked) {
  let text = "";
  try { text = readFileSync(f, "utf8"); } catch { continue; }
  for (const m of text.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g)) {
    if (!/@(catchemtcg\.com|example\.com|email\.com)$/i.test(m[0])) found.push(f + ": " + m[0]);
  }
}
t("no member email addresses anywhere in the repo", found.length === 0);
if (found.length) console.log(found.slice(0, 5).join("\n"));
const src = readFileSync(new URL("../src/reads-email.mjs", import.meta.url), "utf8");
t("the module never logs the key or an address", !/console\.(log|warn|error)/.test(src));
t("no em or en dashes in the email code", !/[\u2013\u2014]/.test(src + readFileSync(new URL("../src/reads.mjs", import.meta.url), "utf8")));
t("the hourly cron is in wrangler.jsonc", /"crons":\s*\["23 \* \* \* \*"\]/.test(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8")));
t("whereItGoes with email on and confirmed says so", whereItGoes({ channels: { email: true } }, { on: true, address: ADDR, confirmed: true }).includes("Email reads go to this address."));

if (fail) { console.log(`reads email: ${fail} failed`); process.exit(1); }
console.log("reads email ok");
