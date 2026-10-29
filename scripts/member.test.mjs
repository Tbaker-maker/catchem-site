import { readFileSync } from "node:fs";
import { signSession, readUser } from "../src/quota.mjs";
import { beginDiscord, finishDiscord } from "../src/auth.mjs";
import { handleAlert, watchRowsForBot } from "../src/feed-api.mjs";
import { handleMe, handleSmartCollection, handleCollectionImport, normalizeHolding, collectionSummary, renderCollection, renderAlerts, renderAccount } from "../src/member.mjs";
import { renderSetShell } from "../src/ui.mjs";
import { pageKind, renderPath } from "../src/index.mjs";

let fail = 0;
const t = (name, ok) => { console.log((ok ? "ok   " : "FAIL ") + name); if (!ok) fail++; };

function mem() {
  const box = new Map();
  return {
    async get(key, type) {
      if (!box.has(key)) return null;
      const value = box.get(key);
      return type === "json" ? JSON.parse(value) : value;
    },
    async put(key, value) { box.set(key, String(value)); },
    async delete(key) { box.delete(key); },
  };
}

t("pages have kinds", pageKind("/collection") === "collection" && pageKind("/alerts") === "alerts" && pageKind("/me") === "account");
const fetchImpl = async () => new Response("no", { status: 404 });
const collection = await (await renderPath("/collection", fetchImpl, { feed: true })).text();
const alerts = await (await renderPath("/alerts", fetchImpl, { feed: true })).text();
const account = await (await renderPath("/me", fetchImpl, { feed: true })).text();
t("collection page is a shell", collection.includes("<h1>My collection</h1>") && collection.includes('class="skel"') && collection.includes("min-height:44px") && !collection.includes("/collection-check") && !/[\u2014\u2013]/.test(collection));
t("smart collection chrome", collection.includes("Morning Brief") && collection.includes("Collection goal") && collection.includes('data-goal="collecting"') && collection.includes('data-goal="selling"') && collection.includes('data-goal="growth"') && collection.includes("Collection Score") && collection.includes("/api/collection/smart") && collection.includes("This set") && collection.includes("focusSet") && (collection.includes("Import CSV") || collection.includes("Import a CSV")) && collection.includes("/api/collection/import") && collection.includes("Email digest") && collection.includes("brief-email-on"));
t("first-run guide chrome", collection.includes('data-onboard="1"') && collection.includes("Add 3 cards you own") && collection.includes("guided-q") && collection.includes("guided-hits") && collection.includes("0 of 3") && collection.includes("sample-load") && collection.includes("Try a sample collection") && collection.includes("Skip guide") && collection.includes("prefers-reduced-motion") && !collection.includes("Goal panel") && !collection.includes("Sending stays off until the site flag") && !/tcgcsv ids/i.test(collection));
t("guided first collection chrome", collection.includes('id="guided-fill"') && collection.includes("Card suggestions") && collection.includes("popular cards") && collection.includes('id="toast"') && collection.includes("paintGuidedHits") && collection.includes("addGuidedCard") && collection.includes("finishGuided") && !/[—–]/.test(collection));
t("add cheapest missing chrome", collection.includes("addCheapestMissing") && collection.includes("cheapestAddButton") && collection.includes("data-add-cheap") && collection.includes("Add cheapest") && collection.includes("Undo last add") && collection.includes("showToast") && !/[—–]/.test(collection));
t("check slot stays off", !renderCollection("").includes("/collection-check") && renderCollection("", { collectionCheck: true }).includes('href="/collection-check"'));
t("alert settings are on the page", alerts.includes("<h1>Alert settings</h1>") && alerts.includes("Pause all alerts") && alerts.includes('type="time"') && alerts.includes('class="skel"') && !/[\u2014\u2013]/.test(alerts));
t("account has export and delete", account.includes("Export my data") && account.includes("Delete my account") && account.includes("Sign-in is optional") === false && !/[\u2014\u2013]/.test(account));

const sealed = normalizeHolding({ sku: "tcgcsv-9", name: "Box NM", kind: "sealed", condition: "NM", qty: 2, price: 10, asOf: "2026-10-16", listings: 22, listingsAsOf: "2026-10-16" });
t("sealed has no condition and no NM", sealed.kind === "sealed" && sealed.condition == null && !sealed.name.includes("NM") && sealed.listings === 22);
const withSet = normalizeHolding({ sku: "tcgcsv-3", name: "Pika", kind: "single", qty: 1, price: 4, set: "Demo", setSlug: "demo-set" });
t("setSlug stays on holding", withSet.setSlug === "demo-set" && withSet.set === "Demo");
const smartRes = await handleSmartCollection(new Request("https://catchemtcg.com/api/collection/smart", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    goal: "collecting",
    holdings: [{ sku: "tcgcsv-1", name: "Alpha", kind: "single", qty: 1, price: 10, setSlug: "demo-set" }],
    setDocs: [{ slug: "demo-set", name: "Demo Set", asOf: "2026-10-28", source: "TCGplayer market", items: [
      { id: "tcgcsv-1", name: "Alpha", kind: "single", price: 10, printings: [{ name: "Normal", price: 10, id: "tcgcsv-1", asOf: "2026-10-28" }, { name: "Reverse Holofoil", price: 4, id: "tcgcsv-11", asOf: "2026-10-28" }] },
      { id: "tcgcsv-3", name: "Gamma", kind: "single", price: 80, printings: [{ name: "Normal", price: 80, id: "tcgcsv-3", asOf: "2026-10-28" }] },
    ] }],
    prevHoldings: [{ sku: "tcgcsv-1", name: "Alpha", kind: "single", qty: 1, price: 8, asOf: "2026-10-27" }],
  }),
}));
const smartBody = await smartRes.json();

const importRes = await handleCollectionImport(new Request("https://catchemtcg.com/api/collection/import", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    action: "preview",
    text: "id,name,set\ntcgcsv-1,Alpha,Demo",
    catalogue: [{ sku: "tcgcsv-1", name: "Alpha", set: "Demo", setSlug: "demo-set", kind: "single", price: 10 }],
  }),
}));
const importBody = await importRes.json();
t("import preview api", importRes.status === 200 && importBody.ok && importBody.accepted === 1 && importBody.rows[0].holding.setSlug === "demo-set");
t("smart api returns brief", smartRes.status === 200 && smartBody.ok && smartBody.brief && smartBody.score && smartBody.goal === "collecting" && smartBody.panels.collecting.closest);
const single = normalizeHolding({ sku: "tcgcsv-3", name: "Pika", kind: "single", qty: 1, price: 4, change7: 10 });
t("single defaults to NM", single.condition === "NM");
const summary = collectionSummary([single, sealed]);
t("summary adds the prices on file", summary.value === 24 && summary.windows.d7.n === 1 && summary.windows.d30.n === 0);

const secret = "member-secret";
const cookie = "ce_session=" + encodeURIComponent(await signSession({ sub: "d:7", premium: false, name: "Blu", avatar: "abc" }, secret));
const user = await readUser(new Request("https://catchemtcg.com/", { headers: { cookie } }), { SESSION_SECRET: secret });
t("session keeps name and avatar hash", user.name === "Blu" && user.avatar === "abc" && user.premium === false);
const env = { SESSION_SECRET: secret, FEED_KV: mem() };
let last = 0;
for (let i = 0; i < 26; i++) {
  const res = await handleAlert(new Request("https://catchemtcg.com/api/alerts", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ id: "read-" + i, sku: "tcgcsv-" + (1000 + i), price: 10, name: "N" + i, direction: "above" }),
  }), env);
  last = res.status;
}
t("the 26th alert stops at 25", last === 429);
const botRows = watchRowsForBot(Array.from({ length: 30 }, (_, i) => ({ sku: "tcgcsv-" + i, name: "N", price: 5, direction: "up", kind: i === 0 ? "sealed" : "single" })));
t("bot payload uses the same cap", botRows.length === 25 && botRows[0].price_dir === "above" && botRows[0].kind === "sealed");

const held = await handleMe(new Request("https://catchemtcg.com/api/me", {
  method: "POST",
  headers: { cookie, "content-type": "application/json" },
  body: JSON.stringify({ action: "holding", sku: "tcgcsv-9", name: "Box NM", kind: "sealed", condition: "NM", qty: 2, price: 10, asOf: "2026-10-16" }),
}), env);
const heldBody = await held.json();
t("account stores the sealed row", held.status === 200 && heldBody.collection[0].condition == null && heldBody.collection[0].name === "Box");
const prefs = await handleMe(new Request("https://catchemtcg.com/api/me", {
  method: "POST",
  headers: { cookie, "content-type": "application/json" },
  body: JSON.stringify({ action: "prefs", pauseAll: true, quietStart: "22:00", quietEnd: "08:00" }),
}), env);
const prefsBody = await prefs.json();
t("quiet hours save", prefs.status === 200 && prefsBody.prefs.pauseAll === true && prefsBody.prefs.quietStart === "22:00" && prefsBody.prefs.quietEnd === "08:00");
const exported = await handleMe(new Request("https://catchemtcg.com/api/me/export", { headers: { cookie } }), env);
const exportText = await exported.text();
t("export is the account json", exported.headers.get("content-disposition").includes("catchem-export.json") && exportText.includes("tcgcsv-9") && !exportText.includes("NM"));
const deleted = await handleMe(new Request("https://catchemtcg.com/api/me", {
  method: "POST",
  headers: { cookie, "content-type": "application/json" },
  body: JSON.stringify({ action: "delete" }),
}), env);
t("delete clears the cookie and the rows", deleted.headers.get("set-cookie").includes("Max-Age=0") && (await deleted.json()).deleted === true);
const after = await handleMe(new Request("https://catchemtcg.com/api/me", { headers: { cookie } }), env);
t("deleted account is empty", (await after.json()).collection.length === 0);

const discordEnv = { SESSION_SECRET: secret, DISCORD_CLIENT_ID: "id", DISCORD_CLIENT_SECRET: "sec", ACCESS_API_URL: "https://bot.example", ACCESS_API_SECRET: "top" };
async function callback(next) {
  const begin = beginDiscord(new Request("https://catchemtcg.com/auth/discord?next=" + next), discordEnv);
  const state = new URL(begin.headers.get("location")).searchParams.get("state");
  const oauth = begin.headers.get("set-cookie").split(";")[0];
  const fake = async (url) => {
    const u = String(url);
    if (u.includes("oauth2/token")) return Response.json({ access_token: "t" });
    if (u.includes("/users/@me")) return Response.json({ id: "42", username: "blu", global_name: "Blu", avatar: "abc" });
    if (u.includes("/access/check")) return Response.json({ approved: false, premium: true });
    return new Response("no", { status: 500 });
  };
  return finishDiscord(new Request("https://catchemtcg.com/auth/discord/callback?code=c&state=" + state, { headers: { cookie: oauth } }), discordEnv, fake);
}
const browse = await callback("/collection");
const sessionCookie = (browse.headers.get("set-cookie") || "");
t("browse sign-in does not need Post Office approval", browse.status === 302 && browse.headers.get("location") === "/collection" && sessionCookie.includes("ce_session="));
const office = await callback("/post-office");
t("a closed Post Office does not hold the seat", office.status === 302 && office.headers.get("location") === "/post-office" && (office.headers.get("set-cookie") || "").includes("ce_session="));
discordEnv.POST_OFFICE = "on";
const officeHeld = await callback("/post-office");
t("an open Post Office still refuses an unapproved member", officeHeld.status === 200 && (await officeHeld.text()).includes("on the list") && !(officeHeld.headers.get("set-cookie") || "").includes("ce_session="));

const ui = readFileSync(new URL("../src/ui.mjs", import.meta.url), "utf8");
t("device list uses the same 25", ui.includes("cur.slice(0,25)") && ui.includes("function mergeLocalWatch()"));
t("render helpers exist", typeof renderAlerts === "function" && typeof renderAccount === "function");


const setShell = renderSetShell("demo-set", "");
const jump = setShell.slice(setShell.indexOf("my-set-jump"), setShell.indexOf("my-set-jump") + 280);
t("set page links to collection focus", setShell.includes("/collection?set=demo-set") && setShell.includes("My missing cards") && jump.includes("cost to finish") && !/[\u2014\u2013]/.test(jump));

if (fail) process.exit(1);
console.log("member ok");

// Client scripts inside template literals must double-escape quotes, or the
// browser hits SyntaxError and the whole collection page goes dead.
const collectionSrc = readFileSync(new URL("../src/member.mjs", import.meta.url), "utf8");
const clientStart = collectionSrc.indexOf("const CLIENT = `");
const clientEnd = collectionSrc.indexOf("`;\n\nconst ALERT_JS", clientStart);
const clientLit = collectionSrc.slice(clientStart + "const CLIENT = `".length, clientEnd);
function evalTemplate(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && i + 1 < s.length) {
      const n = s[i + 1];
      if (n === "\\" || n === "`" || n === '"' || n === "'") { out += n; i++; continue; }
      if (n === "n") { out += "\n"; i++; continue; }
    }
    out += s[i];
  }
  return out;
}
let clientOk = false;
try { new Function(evalTemplate(clientLit)); clientOk = true; } catch { clientOk = false; }
t("collection CLIENT script parses", clientOk);

const vtSrc = readFileSync(new URL("../src/variant-tracker.mjs", import.meta.url), "utf8");
const vtBodyStart = vtSrc.indexOf("const body = `");
const vtBodyEnd = vtSrc.indexOf("`;\n  return chrome", vtBodyStart);
const vtEmitted = evalTemplate(vtSrc.slice(vtBodyStart + "const body = `".length, vtBodyEnd));
const vtScript = (vtEmitted.match(/<script>([\s\S]*)<\/script>/) || [])[1] || "";
let vtOk = false;
try { new Function(vtScript); vtOk = true; } catch { vtOk = false; }
t("variant tracker script parses", vtOk);
