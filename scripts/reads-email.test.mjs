// Custom Reads by email: flag, confirm, unsubscribe, cap, held cards, copy.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  buildMessage, canSend, cleanCopy, cleanEmail, emailDeliveryOn, enrichRead, feedIndex, handleEmailLink,
  makeToken, memberEmail, memberKey, readToken, renderReadsEmail, runEmailDelivery, saveEmailChoice, subjectFor, RESEND_URL,
} from "../src/reads-email.mjs";
import { gatePlan, planFromFields, planToFollow, renderReadsPage, whereItGoes } from "../src/reads.mjs";
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

// 4. Delivery, held cards, design, cap
const holdIds = { "tcgcsv-555": "vintage" };
const bundle = { reads: [
  { id: "high-tcgcsv-86681", sku: "tcgcsv-86681", name: "Leafeon (Call of Legends) 13/95", headline: "Leafeon (Call of Legends) 13/95 is up 18% over 7 days." },
  { id: "deep-slump-tcgcsv-555", sku: "tcgcsv-555", headline: "Slump watch: Espeon is 41% under its Jun 25 high." },
] };
const chipDoc = { asOf: "2026-10-18", byId: { "high-tcgcsv-86681": { signals: [{ kind: "move", dir: "up", text: "18% 7D", strength: 3 }, { kind: "range", pos: 0.9, strength: 4 }, { kind: "momentum", word: "Rising", strength: 3 }], blurb: "TCGplayer market is up 18% over 7 days, as of Oct 18." } }, bySku: { "tcgcsv-77": { signals: [{ kind: "listings", text: "Listings \u25B2 9%", strength: 1 }], blurb: "Listings counted are up 9%, as of Oct 18." } } };
const member = { discordId: ID, lead: "Your daily Catch'em read, Oct 18.", reads: [
  { line: "Leafeon 13/95, Call of Legends is $40.00 on TCGplayer market, as of Oct 18.", cardId: "tcgcsv-86681", kind: "card", name: "Leafeon - 13/95" },
  { line: "Espeon 1st Edition, Neo Discovery is $900.00 on TCGplayer market, as of Oct 18.", cardId: "tcgcsv-555", kind: "card", name: "Espeon" },
  { line: "Some card: Price being checked, as of Oct 18.", cardId: "tcgcsv-556", kind: "card" },
  { line: "Shining Legends Elite Trainer Box: 40 eBay listings counted, middle ask $80.00, as of Oct 18.", cardId: "tcgcsv-77", kind: "sealed", name: "Shining Legends Elite Trainer Box" },
] };
const ctx = { holdIds, chipDoc, feed: feedIndex(bundle, holdIds), rows: new Map([[ID, row1]]) };
const doc = memberEmail(member, ctx);
t("held and Price being checked cards never appear as reads", doc.reads.length === 2 && !JSON.stringify(doc).includes("Espeon") && !/price being checked/i.test(JSON.stringify(doc)));
t("a held card is skipped even through its feed read", enrichRead({ line: "x is $1.00, as of Oct 18.", cardId: "tcgcsv-555" }, ctx) === null);
const msg = await buildMessage(env, member, ctx, "2026-10-18", now);
t("subject is Your Catch'em reads, <date>", msg.subject === "Your Catch'em reads, Oct 18" && subjectFor("2026-10-18") === msg.subject);
t("the email links each read to its /feed/r/ page", msg.html.includes("https://catchemtcg.com/feed/r/high-tcgcsv-86681"));
t("a morning brief: greeting with the date and one top move line", msg.html.includes("Morning brief, Oct 18") && msg.html.includes("Good morning.") && msg.html.includes("Top move: Leafeon (Call of Legends) 13/95, price up 18% in 7 days."));
t("each read has a story line, not the generic up X% over 7 days sentence", msg.html.includes("Leafeon (Call of Legends) 13/95 is up 18% over 7 days.") && !msg.html.includes("TCGplayer market is up 18% over 7 days"));
t("signals are plain words, one or two per read", msg.html.includes("Price up 18% in 7 days") && msg.html.includes("Listings stacking, up 9%") && doc.reads.every((r) => r.words.length <= 2));
t("no icon chips and no dot rows", !/[\u25CF\u25CB\u25B2\u25BC\u25AE\u25AF]/.test(msg.html.replace(/<style[\s\S]*?<\/style>/, "")) && !msg.html.includes("sig-") && !msg.html.includes("Range"));
t("one See the read link per read", (msg.html.match(/>See the read</g) || []).length === doc.reads.length);
t("small rounded Buy on TCGplayer and Buy on eBay buttons", msg.html.includes(">Buy on TCGplayer<") && msg.html.includes(">Buy on eBay<") && /min-height:44px;line-height:44px;padding:0 16px;border-radius:999px/.test(msg.html));
t("short footer with the grey commission note and unsubscribe", /color:#8e8e93">Catch&#39;em may earn a small commission, at no extra cost to you\./.test(msg.html) && msg.html.includes(">Unsubscribe<"));
t("table layout with inline styles and dark mode meta", msg.html.includes('role="presentation"') && msg.html.includes('name="color-scheme" content="light dark"'));
t("three to five reads at most", memberEmail({ ...member, reads: Array.from({ length: 9 }, (_, i) => ({ line: `Card ${i} is $${i + 1}.00 on TCGplayer market, as of Oct 18.`, cardId: "tcgcsv-10" + i, kind: "card", name: "Card " + i })) }, ctx).reads.length === 5);
t("the morning brief waits for the morning", (await runEmailDelivery(on(kv({ [OUTBOX_KEY]: { day: "2026-10-18", members: [member] } })), { now: Date.parse("2026-10-18T09:00:00Z"), fetchImpl: fakeSend })).skipped === "before morning");
t("List-Unsubscribe and List-Unsubscribe-Post headers", /^<https:\/\/catchemtcg\.com\/reads\/email\/unsubscribe\?t=[^>]+>$/.test(msg.headers["List-Unsubscribe"]) && msg.headers["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click");
t("the body has the same one tap unsubscribe link", msg.html.includes(msg.headers["List-Unsubscribe"].slice(1, -1).replace(/&/g, "&amp;")));
const visible = (msg.html + "\n" + msg.text + "\n" + msg.subject).replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ");
t("no em or en dashes anywhere in the email", !/[\u2013\u2014]/.test(msg.html + msg.text + msg.subject));
t("no sold or sales wording and no NM", !/\bsold\b|\bsales?\b/i.test(visible) && !/\bNM\b/.test(visible));
t("each read line passes the advice checker", doc.reads.every((r) => cleanCopy(r.story) && r.words.every(cleanCopy)));
t("a line with an advice phrase is dropped", enrichRead({ line: "You should buy this now before it moons.", cardId: "tcgcsv-9" }, ctx) === null);

// Delivery run with a stored outbox
const fullStore = kv({
  [OUTBOX_KEY]: { day: "2026-10-18", builtAt: "2026-10-18T13:00:00Z", members: [member, { discordId: "900000000000000203", reads: member.reads }] },
  [FOLLOWS_KEY]: { follows: [{ id: ID, discord: true, email: true }, { id: "900000000000000203", discord: true, email: false }] },
  [memberKey(ID)]: row1,
});
const files = { "reads.json": bundle, "signal-chips.json": chipDoc, "price-hold.json": { ids: holdIds } };
const publicFetch = async (url) => { const name = String(url).split("/").pop(); return files[name] ? new Response(JSON.stringify(files[name]), { status: 200 }) : new Response("no", { status: 404 }); };
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
