import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import worker, { pageKind } from "../src/index.mjs";
import { banGuard } from "../src/advice-rules.mjs";
import { checkoutLeak, isWaitlist, paintPublicHtml, premiumEmailBlock, premiumMode, premiumPlainLine } from "../src/premium-mode.mjs";
import {
  confirmLetter, confirmToken, joinWaitlist, launchAllowed, leaveToken, memoryKv, noteConverted,
  renderAdminPage, renderPlacePage, renderWaitlistPage, runLaunch, waitlistCounts,
} from "../src/premium-waitlist.mjs";

const PAGE = { skipKinds: ["house"] };
const guard = banGuard("premium-waitlist", null, PAGE);
let fail = 0;
const t = (name, ok) => { if (!ok) { fail++; console.log("FAIL", name); } };

const mailEnv = { READS_EMAIL_KEY: "re_test_key_that_is_long_enough_for_mail" };
const addr = "you@email.com";
const other = "member@example.com";

function captureFetch() {
  const calls = [];
  return {
    calls,
    fetch: async (url, opts) => {
      calls.push({ url: String(url), body: String(opts?.body || "") });
      if (String(url).includes("api.resend.com")) return { ok: true, json: async () => ({ id: "em" }) };
      if (String(url).includes("api.stripe.com")) {
        return { ok: true, json: async () => ({ id: "cs_test_123", url: "https://checkout.stripe.com/c/pay/cs_test_123", payment_status: "paid", status: "complete" }) };
      }
      return { ok: false, json: async () => ({}) };
    },
  };
}

t("mode defaults to waitlist", premiumMode({}) === "waitlist" && premiumMode({ PREMIUM_MODE: "" }) === "waitlist" && premiumMode({ PREMIUM_MODE: "LIVE " }) === "live" && premiumMode({ PREMIUM_MODE: "yes" }) === "waitlist" && isWaitlist({}) === true);

const page = renderWaitlistPage();
const main = page.slice(page.indexOf("<main"), page.indexOf("</main>"));
t("one email field and an optional discord field", (main.match(/type="email"/g) || []).length === 1 && main.includes('name="discord"') && main.includes("optional"));
t("one join button", (main.match(/Join the Premium waitlist/g) || []).length === 1 && main.includes('class="pwl-join"') && /min-height:48px/.test(main));
t("price line and real perks only", main.includes("$14.99/month when we open") && main.includes("Premium reads in Discord") && main.includes("up to 25") && main.includes("listings counted") && main.includes("All site tools stay free") && !main.includes("First 222") && !/Stadium|raffle|Coming soon/i.test(main));
t("waitlist page has no checkout leak", checkoutLeak(page) === "");
t("waitlist copy has no dash and no advice", !/[\u2013\u2014]/.test(main) && !guard.test(main.replace(/<style>[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ")));
t("gate fails closed on a stripe link and on Get Premium", checkoutLeak('<a href="https://checkout.stripe.com/c/pay">Pay</a>') === "checkout.stripe.com" && checkoutLeak("<a>Get Premium</a>") === "Get Premium" && checkoutLeak("<button>Join the Premium waitlist</button>") === "");

const home = await readFile(new URL("../index.html", import.meta.url), "utf8");
const painted = paintPublicHtml(home, "/", {});
t("home rewrite drops First 222 and keeps the price", painted.includes("Join the Premium waitlist") && painted.includes("$14.99/month when we open") && !painted.includes("First 222") && checkoutLeak(painted) === "" && painted.includes('href="/premium" rel="noopener">Discord Premium') && painted.includes(">Join Discord<"));
t("live home is unchanged", paintPublicHtml(home, "/", { PREMIUM_MODE: "live" }).includes("See Premium") && paintPublicHtml(home, "/", { PREMIUM_MODE: "live" }).includes("First 222"));

const block = premiumEmailBlock("waitlist");
const liveBlock = premiumEmailBlock("live");
t("email upsell is waitlist by default and live has no stripe url", block.includes("Join the Premium waitlist") && block.includes("$14.99/month when we open") && checkoutLeak(block) === "" && !liveBlock.includes("checkout.stripe.com") && liveBlock.includes("See Premium") && !/[\u2013\u2014]/.test(block + premiumPlainLine("waitlist")));

const letter = confirmLetter({ confirmUrl: "https://catchemtcg.com/premium/confirm?t=abc", leaveUrl: "https://catchemtcg.com/premium/leave?t=abc" });
t("confirm mail is white with dark hooks and the price", letter.includes("background:#f2f2f7") && letter.includes("prefers-color-scheme: dark") && letter.includes("[data-ogsc]") && letter.includes("#d9b779") && letter.includes("$14.99/month when we open") && letter.includes("Unsubscribe") && !letter.includes(addr) && checkoutLeak(letter) === "");

const kv = memoryKv();
const logs = [];
const orig = console.log;
console.log = (...args) => { logs.push(args.join(" ")); orig(...args); };
const sent = captureFetch();
const first = await joinWaitlist({ env: mailEnv, kv, email: "  " + addr + " ", discord: "@Cool_Name", origin: "https://catchemtcg.com", fetchImpl: sent.fetch, now: Date.parse("2026-10-20T20:00:00Z") });
t("join sends one confirm and stores nothing in the response", first.ok === true && sent.calls.length === 1 && sent.calls[0].url === "https://api.resend.com/emails");
const mailBody = sent.calls[0].body;
t("confirm mail does not get logged", !logs.join("\n").includes(addr) && mailBody.includes(addr) && mailBody.includes("Confirm your Premium waitlist spot"));
const again = await joinWaitlist({ env: mailEnv, kv, email: addr.toUpperCase(), discord: "", origin: "https://catchemtcg.com", fetchImpl: sent.fetch, now: Date.parse("2026-10-20T21:00:00Z") });
t("pending dedupe does not add a second day", again.ok === true);
const countsPending = await waitlistCounts(kv);
t("pending is counted once", countsPending.total === 1 && countsPending.confirmed === 0 && countsPending.days["2026-10-20"] === 1);
const token = sent.calls.at(-1).body.match(/premium\/confirm\?t=([a-f0-9]{64})/)[1];
const row = await confirmToken(kv, token, Date.parse("2026-10-20T22:00:00Z"));
t("confirm assigns place 1", row && row.place === 1 && row.status === "confirmed");
const againPlace = await confirmToken(kv, token);
t("a second confirm keeps the same place", againPlace.place === 1);
const joinedAgain = await joinWaitlist({ env: mailEnv, kv, email: addr, origin: "https://catchemtcg.com", fetchImpl: sent.fetch });
t("confirmed dedupe does not mint a place or send again", joinedAgain.already === true && sent.calls.length === 2);

const sent2 = captureFetch();
const second = await joinWaitlist({ env: mailEnv, kv, email: other, discord: "no spaces", origin: "https://catchemtcg.com", fetchImpl: sent2.fetch, now: Date.parse("2026-10-21T18:00:00Z") });
t("a second person can join", second.ok === true);
const token2 = sent2.calls[0].body.match(/premium\/confirm\?t=([a-f0-9]{64})/)[1];
const row2 = await confirmToken(kv, token2);
t("the next confirm is place 2", row2.place === 2);
t("bad discord name is not stored", row2.discord === "");

const left = await leaveToken(kv, token2);
t("unsubscribe removes", left === true);
const afterLeave = await waitlistCounts(kv);
t("removed drops out of the total", afterLeave.total === 1 && afterLeave.confirmed === 1);
const rejoined = await joinWaitlist({ env: mailEnv, kv, email: other, origin: "https://catchemtcg.com", fetchImpl: sent2.fetch, now: Date.parse("2026-10-21T19:00:00Z") });
t("rejoin after remove is allowed", rejoined.ok === true);
const token3 = sent2.calls.at(-1).body.match(/premium\/confirm\?t=([a-f0-9]{64})/)[1];
const row3 = await confirmToken(kv, token3);
t("rejoin gets a new place and does not reuse 2", row3.place === 3);

const noKv = await joinWaitlist({ env: mailEnv, kv: null, email: addr, fetchImpl: sent.fetch });
t("missing kv writes nowhere", noKv.status === 503 && noKv.error === "not-ready");
const noMail = await joinWaitlist({ env: {}, kv: memoryKv(), email: addr, fetchImpl: sent.fetch });
t("missing mail key does not pretend success", noMail.status === 503 && noMail.error === "mail-off");
const boom = memoryKv();
const failedMail = await joinWaitlist({ env: mailEnv, kv: boom, email: "you@email.com", fetchImpl: async () => ({ ok: false }) });
t("a failed confirm mail leaves no row", failedMail.error === "mail-failed" && (await waitlistCounts(boom)).total === 0 && (await waitlistCounts(boom)).days["2026-10-20"] == null);

const admin = renderAdminPage(await waitlistCounts(kv));
t("admin shows counts only", admin.includes("Total: 2") && admin.includes("Confirmed: 2") && admin.includes("2026-10-20: 1") && !admin.includes("member@example.com"));
const placeHtml = renderPlacePage(3, "/premium/leave?t=abc");
const placeMain = placeHtml.slice(placeHtml.indexOf("<main"), placeHtml.indexOf("</main>"));
t("place page names the number", placeMain.includes("You're #3 on the list.") && !placeMain.includes("example.com") && !/First 222|checkout\.stripe/.test(placeMain));
console.log = orig;

const assets = { fetch: async () => new Response(home, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }) };
const env = { ASSETS: assets, PUBLIC_FETCH: async () => new Response("no", { status: 404 }) };
const premium = await worker.fetch(new Request("https://catchemtcg.com/premium"), env);
const premiumHtml = await premium.text();
t("worker premium is the waitlist", pageKind("/premium") === "premium" && premium.status === 200 && premiumHtml.includes("Join the Premium waitlist") && checkoutLeak(premiumHtml) === "");
const homeOff = await (await worker.fetch(new Request("https://catchemtcg.com/"), env)).text();
t("worker home is the waitlist club", homeOff.includes("Join the Premium waitlist") && checkoutLeak(homeOff) === "" && !homeOff.includes(">Get Premium<"));
const live = await (await worker.fetch(new Request("https://catchemtcg.com/premium"), { ...env, PREMIUM_MODE: "live" })).text();
t("live worker premium restores Get Premium", live.includes(">Get Premium</a>") && live.includes("https://discord.gg/fUSjxDX4Hy"));

const store = memoryKv();
const workerMail = captureFetch();
const workerEnv = { ...env, ...mailEnv, PREMIUM_WAITLIST: store, PREMIUM_ADMIN_TOKEN: "admin-token-value", PUBLIC_FETCH: workerMail.fetch };
const posted = await worker.fetch(new Request("https://catchemtcg.com/api/premium/waitlist", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: addr, discord: "name" }),
}), workerEnv);
const postedText = await posted.text();
t("bot json join hides the address", posted.status === 200 && postedText.includes('"ok":true') && !postedText.includes(addr));
const denied = await worker.fetch(new Request("https://catchemtcg.com/premium/admin"), workerEnv);
t("admin without the header is 404", denied.status === 404);
const allowed = await worker.fetch(new Request("https://catchemtcg.com/premium/admin", { headers: { "x-premium-admin": "admin-token-value" } }), workerEnv);
const adminHtml = await allowed.text();
t("admin header shows counts and no email", allowed.status === 200 && adminHtml.includes("Total:") && !adminHtml.includes(addr));

t("launch is off by default", launchAllowed({}) === false && launchAllowed({ PREMIUM_MODE: "live", PREMIUM_LAUNCH: "test", STRIPE_SECRET_KEY: "sk_live_nope", STRIPE_PRICE_ID: "price" }) === false);
const launchOff = await runLaunch({ env: { PREMIUM_MODE: "waitlist", PREMIUM_LAUNCH: "test", STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_ID: "price_x", READS_EMAIL_KEY: mailEnv.READS_EMAIL_KEY }, kv: store, fetchImpl: captureFetch().fetch });
t("runLaunch sends nothing while the switch is waitlist", launchOff.off === true && launchOff.sent === 0);
const blocked = await worker.fetch(new Request("https://catchemtcg.com/api/premium/launch", { method: "POST" }), workerEnv);
t("launch route is 404 while off", blocked.status === 404);

const ready = memoryKv();
const stripeCalls = captureFetch();
await joinWaitlist({ env: mailEnv, kv: ready, email: addr, origin: "https://catchemtcg.com", fetchImpl: stripeCalls.fetch });
const tok = stripeCalls.calls[0].body.match(/premium\/confirm\?t=([a-f0-9]{64})/)[1];
await confirmToken(ready, tok);
const launchEnv = { PREMIUM_MODE: "live", PREMIUM_LAUNCH: "test", STRIPE_SECRET_KEY: "sk_test_example", STRIPE_PRICE_ID: "price_test", READS_EMAIL_KEY: mailEnv.READS_EMAIL_KEY, PREMIUM_WAITLIST: ready };
const launched = await runLaunch({ env: launchEnv, kv: ready, fetchImpl: stripeCalls.fetch });
t("armed test launch records a checkout and does not use a live key", launched.sent === 1 && stripeCalls.calls.some((c) => c.url.includes("api.stripe.com")) && !stripeCalls.calls.some((c) => c.body.includes("sk_live_") || c.url.includes("sk_live_")));
const marked = await noteConverted({ ...launchEnv, PREMIUM_WAITLIST: ready }, "cs_test_123", stripeCalls.fetch);
t("a paid test session can be marked converted", marked === true);
const liveKey = await noteConverted({ ...launchEnv, STRIPE_SECRET_KEY: "sk_live_secret", PREMIUM_WAITLIST: ready }, "cs_test_123", async () => { throw new Error("stripe was called"); });
t("a live stripe key is not read", liveKey === false);

const script = spawnSync(process.execPath, ["scripts/premium-launch.mjs"], {
  cwd: new URL("..", import.meta.url),
  env: { ...process.env, PREMIUM_MODE: "live", PREMIUM_LAUNCH: "test", STRIPE_SECRET_KEY: "sk_test_example" },
  encoding: "utf8",
});
t("the launch script stays off", script.status === 0 && script.stdout.includes("premium launch: off"));

if (fail) { console.log(fail + " failed"); process.exit(1); }
console.log("premium waitlist ok");
