import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import worker from "../src/index.mjs";
import { handleReads } from "../src/reads.mjs";
import { handleReadsPipe, FOLLOWS_KEY } from "../src/reads-pipe.mjs";
import { signSession } from "../src/quota.mjs";
import { gatePlan } from "../src/reads.mjs";
import {
  attachFeed,
  deliverOutboxEmails,
  emailCopyOk,
  emailLink,
  handleEmailLink,
  normalizeEmailRead,
  readsEmailHtml,
  readsEmailText,
  readsSubject,
} from "../src/reads-email.mjs";

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

const TOKEN = "t".repeat(48);
const KEY = "re_test_key_not_real";
const ID = "123456789012345678";
const TO = "member@example.com";
const store = kv();
const calls = [];
const fetchImpl = async (url, init = {}) => {
  calls.push({ url: String(url), init });
  return new Response(JSON.stringify({ id: "ok" }), { status: 200 });
};
const env = {
  FEED_KV: store,
  CUSTOM_READS_TOKEN: TOKEN,
  READS_EMAIL_KEY: KEY,
  SESSION_SECRET: "s".repeat(40),
};

const good = normalizeEmailRead({
  line: "Umbreon ex 161/131, Prismatic Evolutions is $12.00 on TCGplayer market, as of Oct 18.",
  name: "Umbreon ex",
  number: "161/131",
  setName: "Prismatic Evolutions",
  cardId: "tcgcsv-9001",
  kind: "card",
  readId: "move-tcgcsv-9001",
  signals: [{ kind: "move", text: "4% 7D", strength: 3 }, { kind: "dash", text: "Price being checked", dir: "dash" }],
});
const held = normalizeEmailRead({ headline: "Held card", blurb: "Still listed.", held: true, cardId: "tcgcsv-2" });
const checking = normalizeEmailRead({ headline: "Price being checked", line: "Price being checked", cardId: "tcgcsv-3" });
const sealed = normalizeEmailRead({
  kind: "sealed",
  name: "Prismatic Evolutions ETB NM",
  line: "Prismatic Evolutions ETB: 12 eBay listings counted, middle ask $90.00, as of Oct 18.",
  cardId: "tcgcsv-77",
  setName: "Prismatic Evolutions",
  readId: "sealed-tcgcsv-77",
});
t("held and price being checked never become reads", held === null && checking === null && good && good.chips.length === 1 && good.chips[0].strength === 3);
t("a sealed read drops NM", sealed && !/\bNM\b/.test(sealed.headline) && !/\bNM\b/.test(sealed.blurb) && sealed.href.includes("/feed/r/"));
t("a read links to the feed page and the shops", good.href === "https://catchemtcg.com/feed/r/move-tcgcsv-9001" && good.tcgUrl.includes("tcgplayer.com/product/9001") && good.ebayUrl.includes("ebay.com"));

const fed = attachFeed(
  [{ cardId: "tcgcsv-9001", line: "A dated line, as of Oct 18.", name: "Umbreon ex" }],
  [{ id: "deep-tcgcsv-9001", sku: "tcgcsv-9001", headline: "Umbreon moved.", blurb: "TCGplayer market is up 4% over 7 days, as of Oct 18.", signals: [{ kind: "move", text: "4% 7D", strength: 4 }] }, { id: "held-read", sku: "tcgcsv-2", headline: "Price being checked", held: true }],
);
t("a feed read is attached and a held feed read is not", fed[0].readId === "deep-tcgcsv-9001" && fed.length === 1);

const stopUrl = "https://catchemtcg.com/reads/email/stop?id=" + ID + "&t=abc";
const html = readsEmailHtml({ lead: "Your weekly Catch'em read, Oct 18.", day: "2026-10-18", reads: [good, sealed], stopUrl });
const text = readsEmailText({ lead: "Your weekly Catch'em read, Oct 18.", day: "2026-10-18", reads: [good, sealed], stopUrl });
t("the letter is branded and rounded", html.includes("Catch'em") && html.includes("border-radius:22px") && html.includes("min-height:44px") && html.includes("color:#8e8e93") && html.includes("Buy on TCGplayer") && html.includes("Buy on eBay") && html.includes("small commission"));
t("the letter links each read and has a stop link", html.includes("https://catchemtcg.com/feed/r/move-tcgcsv-9001") && html.includes("https://catchemtcg.com/feed/r/sealed-tcgcsv-77") && html.includes("/reads/email/stop?id=" + ID) && html.includes("Unsubscribe"));
t("the letter has strength dots and no dashes or forbidden words", html.includes("border-radius:999px") && html.includes("8a6a2f") && !/[\u2013\u2014]/.test(html) && !/\b(sold|sales)\b/i.test(text) && !/price being checked/i.test(html) && !html.includes(TO));
t("the letter copy passes the checker", emailCopyOk(text) && readsSubject("2026-10-18") === "Your Catch'em reads, Oct 18, 2026" && !/[\u2013\u2014]/.test(readsSubject("2026-10-18")));

const off = await deliverOutboxEmails({ store, env: { FEED_KV: store }, outbox: { day: "2026-10-18", members: [] }, fetchImpl, feedReads: [] });
t("sending stays off without the key", off.armed === false && off.sent === 0 && calls.length === 0);

await store.put(`reads:d:${ID}`, JSON.stringify({ channels: { discord: true, email: true }, frequency: "weekly", email: "" }));
await store.put(`reads-email:${ID}`, JSON.stringify({ email: TO, status: "confirmed" }));
const outbox = {
  day: "2026-10-18",
  members: [{
    discordId: ID,
    lead: "Your weekly Catch'em read, Oct 18.",
    reads: [
      good,
      { headline: "Price being checked", line: "Price being checked", cardId: "tcgcsv-3" },
      { headline: "Held one", held: true, line: "Held one is $1.00, as of Oct 18." },
      sealed,
    ],
  }],
};
const first = await deliverOutboxEmails({ store, env, outbox, fetchImpl, feedReads: [] });
t("one confirmed member gets one letter", first.armed === true && first.sent === 1 && calls.length === 1);
const payload = JSON.parse(calls[0].init.body);
t("the provider call is Resend and keeps the address out of the letter", calls[0].url === "https://api.resend.com/emails" && calls[0].init.headers.authorization === `Bearer ${KEY}` && payload.from === "Catch'em <reads@catchemtcg.com>" && payload.to[0] === TO && payload.subject === "Your Catch'em reads, Oct 18, 2026" && !payload.html.includes(TO) && !payload.html.includes("Price being checked") && !/[\u2013\u2014]/.test(payload.html));
t("the letter carries List-Unsubscribe", payload.headers["List-Unsubscribe"].includes("/reads/email/stop?id=" + ID) && payload.headers["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click");
const second = await deliverOutboxEmails({ store, env, outbox, fetchImpl, feedReads: [] });
t("a second pass the same day does not send again", second.sent === 0 && calls.length === 1);

const link = await emailLink(env, "https://catchemtcg.com", "stop", ID, TO);
const stopped = await handleEmailLink(new Request(link), env);
const stoppedHtml = await stopped.text();
t("the unsubscribe link works in one click", stopped.status === 200 && stoppedHtml.includes("Email stopped") && !/[\u2013\u2014]/.test(stoppedHtml));
const afterStop = await deliverOutboxEmails({
  store,
  env,
  outbox: { ...outbox, day: "2026-10-19" },
  fetchImpl,
  feedReads: [],
});
t("a stopped member gets no later letter", afterStop.sent === 0 && calls.length === 1);

const session = await signSession({ sub: "d:" + ID, premium: false }, env.SESSION_SECRET);
const save = await handleReads(new Request("https://catchemtcg.com/api/reads", {
  method: "POST",
  headers: { "content-type": "application/json", cookie: "ce_session=" + encodeURIComponent(session) },
  body: JSON.stringify({ sets: ["me-30th-celebration"], channels: { discord: true, email: true }, email: TO, frequency: "daily" }),
}), env, fetchImpl);
const saved = await save.json();
const plan = JSON.parse(store.m.get(`reads:d:${ID}`));
t("a free seat stays weekly and the address is not on the plan", save.status === 200 && saved.plan.frequency === "weekly" && saved.plan.channels.email === true && saved.plan.email === "" && !JSON.stringify(saved).includes(TO));
t("the address is only in the email record", JSON.parse(store.m.get(`reads-email:${ID}`)).email === TO && JSON.parse(store.m.get(`reads-email:${ID}`)).status === "pending");
const confirmCall = calls.find((row) => JSON.parse(row.init.body).subject.startsWith("Confirm"));
t("opt in sends a confirm letter before any read", !!confirmCall && JSON.parse(confirmCall.init.body).html.includes("Confirm this email") && !JSON.parse(confirmCall.init.body).html.includes(TO));

await store.put(FOLLOWS_KEY, JSON.stringify({ follows: [{ id: ID, discordId: ID, email: TO, sets: ["me-30th-celebration"] }] }));
const exported = await handleReadsPipe(new Request("https://catchemtcg.com/api/reads/export", { headers: { authorization: "Bearer " + TOKEN } }), { FEED_KV: store, CUSTOM_READS_TOKEN: TOKEN });
const exportBody = await exported.json();
t("the public follow export drops the address", exported.status === 200 && !JSON.stringify(exportBody).includes(TO) && !JSON.stringify(exportBody).includes("email"));

const free = gatePlan({ channels: { email: true }, email: TO, frequency: "daily", sets: ["me-30th-celebration"] }, { premium: false });
t("free email is still a weekly read", free.plan.frequency === "weekly" && free.plan.channels.email === true && free.plan.email === "");

const allow = new Set(["support@catchemtcg.com", "reads@catchemtcg.com", "you@email.com", TO]);
const roots = ["src", "scripts", "newsletter"];
const found = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name === "node_modules" || name.startsWith(".")) continue;
    const st = statSync(path);
    if (st.isDirectory()) walk(path);
    else if (/\.(mjs|js|html|json|yml|md)$/.test(name)) {
      const text = readFileSync(path, "utf8");
      for (const hit of text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []) {
        if (!allow.has(hit.toLowerCase())) found.push(`${path} ${hit}`);
      }
    }
  }
};
for (const root of roots) walk(new URL("../" + root, import.meta.url).pathname);
t("public files keep no member address", found.length === 0);
if (found.length) console.log(found.slice(0, 12).join("\n"));

const live = await worker.fetch(new Request("https://catchemtcg.com/reads/email/stop"), { FEED_KV: store, CUSTOM_READS_TOKEN: TOKEN }, { waitUntil() {} });
const liveHtml = await live.text();
t("the worker serves the stop page", live.status === 200 && liveHtml.includes("Not available") && !/[\u2013\u2014]/.test(liveHtml));

if (fail) { console.log(fail + " failed"); process.exit(1); }
console.log("reads email ok");
