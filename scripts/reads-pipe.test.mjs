// Custom Reads pipe: bearer only, never echoes the token, Save copy is honest.
import worker from "../src/index.mjs";
import { handleReadsPipe, readsPipeReady, removeFollow, cleanOutbox, FOLLOWS_KEY } from "../src/reads-pipe.mjs";
import { renderReadsPage, saveLine, planToFollow, upsertFollow } from "../src/reads.mjs";

let fail = 0;
const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail++; console.log("  FAIL", name); } };

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
const req = (path, init = {}) => new Request("https://catchemtcg.com" + path, init);
const auth = { authorization: "Bearer " + TOKEN };

const store = kv();
const env = { FEED_KV: store, CUSTOM_READS_TOKEN: TOKEN };
const follow = planToFollow("d:123456789012345678", { sets: ["me-30th-celebration"], product: "singles", frequency: "weekly", watch: [], addons: {}, savedAt: "2026-10-17T17:00:00Z" });
await store.put(FOLLOWS_KEY, JSON.stringify(upsertFollow(null, follow)));

let r = await handleReadsPipe(req("/api/reads/export"), env);
t("no bearer is refused", r.status === 401);
r = await handleReadsPipe(req("/api/reads/export", { headers: { authorization: "Bearer wrong" } }), env);
t("a wrong bearer is refused", r.status === 401);
r = await handleReadsPipe(req("/api/reads/export", { headers: auth }), env);
let body = await r.json();
t("the right bearer gets the follows", r.status === 200 && body.follows.length === 1 && body.follows[0].id === "123456789012345678");
t("the follow keeps when it was saved", body.follows[0].savedAt === "2026-10-17T17:00:00Z");
t("the token is never in a reply", !JSON.stringify(body).includes(TOKEN));
r = await handleReadsPipe(req("/api/reads/export", { headers: auth }), { FEED_KV: store });
t("no secret set means not set up", r.status === 503);
r = await handleReadsPipe(req("/api/reads/export", { headers: auth }), { CUSTOM_READS_TOKEN: TOKEN });
t("no storage bound is a clear 503", r.status === 503);

const outbox = { day: "2026-10-17", builtAt: "x", members: [{ discordId: "123456789012345678", lead: "Hi" }, { discordId: "d:1" }] };
r = await handleReadsPipe(req("/api/reads/outbox", { method: "PUT", headers: auth, body: JSON.stringify(outbox) }), env);
body = await r.json();
t("the nightly can store the outbox and bad ids drop", r.status === 200 && body.members === 1);
r = await handleReadsPipe(req("/api/reads/outbox", { method: "PUT", body: JSON.stringify(outbox) }), env);
t("the outbox cannot be written without the bearer", r.status === 401);
r = await handleReadsPipe(req("/api/reads/outbox", { headers: auth }), env);
body = await r.json();
t("the bot reads the outbox", body.day === "2026-10-17" && body.members.length === 1);
t("a bad outbox day is refused", cleanOutbox({ day: "today", members: [] }) === null);

r = await handleReadsPipe(req("/api/reads/export?id=123456789012345678", { method: "DELETE", headers: auth }), env);
body = await r.json();
t("a test follow can be removed", body.follows === 0);
t("removeFollow takes the d: form too", removeFollow({ follows: [{ id: "5" }] }, "d:5").follows.length === 0);

t("ready needs storage and a long token", readsPipeReady(env) && !readsPipeReady({ FEED_KV: store }) && !readsPipeReady({ CUSTOM_READS_TOKEN: TOKEN }) && !readsPipeReady({ FEED_KV: store, CUSTOM_READS_TOKEN: "short" }));
t("Save only promises a DM when the pipe is ready", saveLine({ saved: true, pipe: true }).includes("after the next nightly") && !saveLine({ saved: true, pipe: false }).includes("after the next nightly"));
t("Save says nothing was stored when storage is off", saveLine({ note: "closed" }).includes("nothing was stored"));
const pageOff = renderReadsPage({ signedIn: true, saved: true, pipe: false });
t("the page shows the honest line", pageOff.includes("not switched on yet") && !pageOff.includes("after the next nightly"));
t("no em or en dashes in Save copy", ![saveLine({ saved: true, pipe: true }), saveLine({ saved: true }), saveLine({ note: "closed" })].some((s) => /[\u2013\u2014]/.test(s)));

if (worker && typeof worker.fetch === "function") {
  const live = await worker.fetch(req("/api/reads/export"), { ...env, ASSETS: { fetch: async () => new Response("x") } }, { waitUntil() {} });
  t("the worker routes the pipe and refuses no bearer", live.status === 401);
}

if (fail) { console.log(`${fail} failed`); process.exit(1); }
console.log("reads pipe ok");
