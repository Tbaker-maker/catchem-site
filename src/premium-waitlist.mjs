// Premium waitlist. Addresses live in the PREMIUM_WAITLIST KV binding only.
// Nothing here is written to git, logs, or a public file. Confirm mail uses
// the same Resend path as reads (READS_EMAIL_KEY). Launch mail stays off
// unless PREMIUM_MODE=live, PREMIUM_LAUNCH=test, and the Stripe key is sk_test_.

import { pageChrome } from "./ui.mjs";
import { EMAIL_FROM, EMAIL_KEY, emailSendAllowed, validEmail } from "./reads-email.mjs";
import { darkCss } from "./reads-article.mjs";
import { isWaitlist, premiumMode } from "./premium-mode.mjs";

const PRICE = "$14.99/month when we open";
const ORIGIN = "https://catchemtcg.com";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => {
    if (ch === "&") return "&" + "amp;";
    if (ch === "<") return "&" + "lt;";
    if (ch === ">") return "&" + "gt;";
    if (ch === '"') return "&" + "quot;";
    return "&" + "#39;";
  });
}

export function normDiscord(value) {
  const s = String(value || "").trim().replace(/^@+/, "").slice(0, 32);
  if (!s) return "";
  return /^[A-Za-z0-9._]{2,32}$/.test(s) ? s : "";
}

export function ptDay(now = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
}

export async function emailHash(email) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(email || "")));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

function newToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function rowKey(hash) {
  return `pwl:row:${hash}`;
}

function tokenKey(token) {
  return `pwl:token:${token}`;
}

async function readMeta(kv) {
  const meta = await kv.get("pwl:meta", "json");
  const next = Number(meta?.next);
  const days = meta?.days && typeof meta.days === "object" ? { ...meta.days } : {};
  return { next: Number.isInteger(next) && next >= 1 ? next : 1, days };
}

async function listRowKeys(kv) {
  const names = [];
  let cursor = undefined;
  do {
    const page = await kv.list({ prefix: "pwl:row:", cursor });
    for (const key of page?.keys || []) names.push(key.name);
    cursor = page && page.list_complete === false ? page.cursor : "";
  } while (cursor);
  return names;
}

export function memoryKv() {
  const rows = new Map();
  return {
    async get(key, type) {
      const value = rows.get(key);
      if (value == null) return null;
      if (type === "json") {
        try { return JSON.parse(value); } catch { return null; }
      }
      return value;
    },
    async put(key, value) { rows.set(key, String(value)); },
    async delete(key) { rows.delete(key); },
    async list({ prefix } = {}) {
      const keys = [...rows.keys()].filter((name) => !prefix || name.startsWith(prefix)).sort();
      return { keys: keys.map((name) => ({ name })), list_complete: true };
    },
  };
}

function page(body, title, feed = false) {
  return pageChrome("Discord Premium", body, title, "", "", feed === true);
}

function shellCss() {
  return `<style>
.pwl-hero{padding:8px 0 4px}
.pwl-kicker{margin:0 0 10px;letter-spacing:.14em;text-transform:uppercase;font:600 12px/1 var(--sans);color:var(--gold)}
.pwl-hero h1{font:500 clamp(32px,6vw,48px)/1.08 var(--serif);letter-spacing:-.02em;margin:0 0 10px}
.pwl-lede{font-size:18px;line-height:1.4;margin:0 0 8px;max-width:28em}
.pwl-price{margin:0 0 18px;font:600 22px/1.2 var(--serif);color:var(--gold)}
.pwl-grid{display:grid;gap:12px;margin:0 0 22px}
.pwl-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px}
.pwl-card h2{margin:0 0 6px;font:600 16px/1.3 var(--sans)}
.pwl-card p{margin:0;color:var(--dim);font-size:15px;line-height:1.45}
.pwl-form{display:grid;gap:12px;max-width:28em}
.pwl-form label{display:grid;gap:6px;font:600 14px/1.3 var(--sans)}
.pwl-form input{min-height:48px;border-radius:12px;border:1px solid var(--line);background:var(--panel);color:inherit;padding:0 14px;font:500 16px/1 var(--sans)}
.pwl-form input:focus{outline:2px solid var(--gold);outline-offset:2px}
.pwl-join{display:flex;width:100%;align-items:center;justify-content:center;min-height:48px;padding:0 22px;border:0;border-radius:12px;background:var(--gold);color:#1a1407;font:600 16px/1 var(--sans);cursor:pointer}
.pwl-note{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px 16px;margin:0 0 16px}
.pwl-fine{margin:12px 0 0;color:var(--dim);font-size:14px}
.pwl-leave{display:inline-flex;align-items:center;min-height:44px;margin-top:12px}
@media(min-width:840px){.pwl-grid{grid-template-columns:1fr 1fr}.pwl-join{width:auto;min-width:260px}}
</style>`;
}

export function renderWaitlistPage({ feed = false, notice = "" } = {}) {
  const note = notice ? `<p class="pwl-note" role="status">${esc(notice)}</p>` : "";
  const body = `<main id="main" tabindex="-1" class="wrap pwl">
${shellCss()}
<section class="pwl-hero">
<p class="pwl-kicker">Premium</p>
<h1>Premium waitlist</h1>
<p class="pwl-lede">One list for people who want Premium when it opens.</p>
<p class="pwl-price">${PRICE}.</p>
${note}
</section>
<div class="pwl-grid">
<article class="pwl-card"><h2>Premium reads in Discord</h2><p>The deeper reads land in the members-only #reads channel.</p></article>
<article class="pwl-card"><h2>Watchlist pings</h2><p>Watch up to 25 cards or products. We DM you when the price or listings counted crosses the number you set. Free members can save 25 too, without the DM.</p></article>
<article class="pwl-card"><h2>Members-only Discord</h2><p>Premium channels, the weekly recap, and the leaderboard.</p></article>
<article class="pwl-card"><h2>Site tools</h2><p>All site tools stay free.</p></article>
</div>
<form class="pwl-form" method="POST" action="/api/premium/waitlist">
<label for="pwl-email">Email
<input id="pwl-email" name="email" type="email" required autocomplete="email" inputmode="email" maxlength="120" placeholder="you@email.com">
</label>
<label for="pwl-discord">Discord username, optional
<input id="pwl-discord" name="discord" type="text" maxlength="32" autocomplete="off" placeholder="name">
</label>
<button class="pwl-join" type="submit">Join the Premium waitlist</button>
</form>
<p class="pwl-fine"><small>By joining you agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>. We email a confirm link. One tap leaves the list.</small></p>
</main>`;
  return page(body, "Premium waitlist", feed);
}

export function renderPlacePage(place, leaveUrl) {
  const n = Number(place);
  const leave = leaveUrl ? `<p><a class="pwl-leave" href="${esc(leaveUrl)}">Leave the list</a></p>` : "";
  const body = `<main id="main" tabindex="-1" class="wrap pwl">
${shellCss()}
<section class="pwl-hero">
<p class="pwl-kicker">Premium</p>
<h1>You're #${n} on the list.</h1>
<p class="pwl-price">${PRICE}.</p>
<p>We will email one checkout link when Premium opens. No date is set.</p>
${leave}
</section>
</main>`;
  return page(body, "You're on the list");
}

export function renderLeftPage() {
  const body = `<main id="main" tabindex="-1" class="wrap pwl">
${shellCss()}
<section class="pwl-hero">
<h1>You're off the list.</h1>
<p>We will not email you a checkout link. You can join again from the Premium page.</p>
<p><a class="pwl-leave" href="/premium">Premium</a></p>
</section>
</main>`;
  return page(body, "Off the list");
}

export function renderAdminPage(counts) {
  const days = Object.entries(counts?.days || {}).sort((a, b) => a[0] < b[0] ? 1 : -1);
  const list = days.length ? `<ul>${days.map(([day, n]) => `<li>${esc(day)}: ${Number(n) || 0}</li>`).join("")}</ul>` : `<p>No sign-ups yet.</p>`;
  const body = `<main id="main" tabindex="-1" class="wrap pwl">
${shellCss()}
<h1>Premium waitlist</h1>
<p>Total: ${Number(counts?.total) || 0}</p>
<p>Confirmed: ${Number(counts?.confirmed) || 0}</p>
<h2>Daily sign-ups</h2>
${list}
</main>`;
  return page(body, "Premium waitlist admin");
}

function htmlResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export function confirmLetter({ confirmUrl, leaveUrl }) {
  const css = darkCss();
  const lead = "Confirm your place on the Premium waitlist.";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>Confirm your Premium waitlist spot</title>
<style>:root{color-scheme:light dark}${css}</style></head>
<body class="ce-page" style="margin:0;padding:0;background:#f2f2f7"><div style="display:none;max-height:0;overflow:hidden">${esc(lead)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="ce-page" bgcolor="#f2f2f7" style="background:#f2f2f7"><tr><td align="center" style="padding:24px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:420px"><tr><td class="ce-card" bgcolor="#ffffff" style="background:#ffffff;border-radius:16px;padding:22px">
<p class="ce-ink ce-brand" style="margin:0 0 8px;font:700 15px/1 -apple-system,BlinkMacSystemFont,sans-serif;color:#1c1c1e">Catch'em</p>
<p class="ce-ink" style="margin:0 0 8px;font:600 20px/1.3 -apple-system,BlinkMacSystemFont,sans-serif;color:#1c1c1e">${esc(lead)}</p>
<p class="ce-dim" style="margin:0 0 16px;font:400 15px/1.45 -apple-system,BlinkMacSystemFont,sans-serif;color:#636366">${PRICE}. No date is set.</p>
<a href="${esc(confirmUrl)}" class="ce-btn-dark" style="display:inline-block;min-height:44px;line-height:44px;padding:0 18px;border-radius:999px;background:#1c1c1e;color:#ffffff;font:600 15px/44px -apple-system,BlinkMacSystemFont,sans-serif;text-decoration:none">Confirm your place</a>
<p class="ce-soft" style="margin:16px 0 0;font:400 13px/1.45 -apple-system,BlinkMacSystemFont,sans-serif;color:#8e8e93">Leave the list any time: <a href="${esc(leaveUrl)}" style="color:#8e8e93">Unsubscribe</a></p>
</td></tr></table></td></tr></table></body></html>`;
}

export function confirmText({ confirmUrl, leaveUrl }) {
  return `Confirm your place on the Premium waitlist.\n${PRICE}. No date is set.\n\n${confirmUrl}\n\nUnsubscribe: ${leaveUrl}`;
}

async function sendMail({ env, to, subject, html, text, leaveUrl, fetchImpl }) {
  const key = String(env?.[EMAIL_KEY] || "").trim();
  const dest = validEmail(to);
  if (!key || !dest) return false;
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [dest],
        subject,
        html,
        text,
        headers: leaveUrl ? { "List-Unsubscribe": `<${leaveUrl}>` } : {},
      }),
    });
    return !!res?.ok;
  } catch {
    return false;
  }
}

function links(origin, token) {
  const base = String(origin || ORIGIN).replace(/\/$/, "");
  return {
    confirmUrl: `${base}/premium/confirm?t=${encodeURIComponent(token)}`,
    leaveUrl: `${base}/premium/leave?t=${encodeURIComponent(token)}`,
  };
}

async function sendConfirm({ env, to, token, origin, fetchImpl }) {
  const { confirmUrl, leaveUrl } = links(origin, token);
  const html = confirmLetter({ confirmUrl, leaveUrl });
  const text = confirmText({ confirmUrl, leaveUrl });
  return sendMail({
    env,
    to,
    subject: "Confirm your Premium waitlist spot",
    html,
    text,
    leaveUrl,
    fetchImpl,
  });
}

export async function joinWaitlist({ env, kv, email, discord, origin = ORIGIN, fetchImpl = fetch, now = Date.now() }) {
  if (!kv || typeof kv.get !== "function" || typeof kv.put !== "function") return { status: 503, error: "not-ready" };
  const to = validEmail(email);
  if (!to) return { status: 400, error: "bad-email" };
  if (!emailSendAllowed(env)) return { status: 503, error: "mail-off" };
  const hash = await emailHash(to);
  const key = rowKey(hash);
  const existing = await kv.get(key, "json");
  if (existing && existing.status === "confirmed") return { status: 200, ok: true, already: true };
  const token = newToken();
  const fresh = !existing || existing.status === "removed";
  const row = {
    email: to,
    discord: normDiscord(discord) || (fresh ? "" : (existing.discord || "")),
    status: "pending",
    place: null,
    created: fresh ? new Date(now).toISOString() : (existing.created || new Date(now).toISOString()),
    confirmedAt: "",
    token,
  };
  await kv.put(key, JSON.stringify(row));
  if (existing?.token) await kv.delete(tokenKey(existing.token));
  await kv.put(tokenKey(token), hash);
  const meta = await readMeta(kv);
  const day = ptDay(now);
  if (fresh) {
    meta.days[day] = (Number(meta.days[day]) || 0) + 1;
    await kv.put("pwl:meta", JSON.stringify(meta));
  }
  const sent = await sendConfirm({ env, to, token, origin, fetchImpl });
  if (!sent) {
    if (fresh) {
      await kv.delete(key);
      await kv.delete(tokenKey(token));
      meta.days[day] = Math.max(0, (Number(meta.days[day]) || 1) - 1);
      if (!meta.days[day]) delete meta.days[day];
      await kv.put("pwl:meta", JSON.stringify(meta));
    } else if (existing) {
      await kv.put(key, JSON.stringify(existing));
      if (existing.token) await kv.put(tokenKey(existing.token), hash);
      await kv.delete(tokenKey(token));
    }
    return { status: 503, error: "mail-failed" };
  }
  return { status: 200, ok: true };
}

export async function confirmToken(kv, token, now = Date.now()) {
  const raw = String(token || "");
  if (!/^[a-f0-9]{64}$/.test(raw)) return null;
  const hash = await kv.get(tokenKey(raw));
  if (!hash || !/^[a-f0-9]{32}$/.test(String(hash))) return null;
  const key = rowKey(hash);
  const row = await kv.get(key, "json");
  if (!row || row.token !== raw || row.status === "removed") return null;
  if (row.status === "confirmed" && Number(row.place) >= 1) return row;
  const meta = await readMeta(kv);
  const place = meta.next;
  meta.next = place + 1;
  row.status = "confirmed";
  row.place = place;
  row.confirmedAt = new Date(now).toISOString();
  await kv.put("pwl:meta", JSON.stringify(meta));
  await kv.put(key, JSON.stringify(row));
  return row;
}

export async function leaveToken(kv, token) {
  const raw = String(token || "");
  if (!/^[a-f0-9]{64}$/.test(raw)) return false;
  const hash = await kv.get(tokenKey(raw));
  if (!hash) return false;
  const key = rowKey(hash);
  const row = await kv.get(key, "json");
  if (!row || row.status === "removed") {
    await kv.delete(tokenKey(raw));
    return !!row;
  }
  row.status = "removed";
  row.token = "";
  await kv.delete(tokenKey(raw));
  await kv.put(key, JSON.stringify(row));
  return true;
}

export async function waitlistCounts(kv) {
  if (!kv) return { total: 0, confirmed: 0, days: {} };
  const names = await listRowKeys(kv);
  let total = 0;
  let confirmed = 0;
  for (const name of names) {
    const row = await kv.get(name, "json");
    if (!row || row.status === "removed") continue;
    total += 1;
    if (row.status === "confirmed") confirmed += 1;
  }
  const meta = await readMeta(kv);
  return { total, confirmed, days: meta.days };
}

function noticeFor(error) {
  if (error === "bad-email") return "Enter an email address.";
  return "The waitlist is not ready yet.";
}

async function readJoinFields(request) {
  const type = String(request.headers.get("content-type") || "");
  if (type.includes("application/json")) {
    let data = {};
    try { data = await request.json(); } catch { data = {}; }
    return { email: data?.email, discord: data?.discord, json: true };
  }
  let form;
  try { form = await request.formData(); } catch { form = null; }
  return { email: form?.get("email"), discord: form?.get("discord"), json: false };
}

function adminOk(request, env) {
  const token = String(env?.PREMIUM_ADMIN_TOKEN || "");
  if (token.length < 16) return false;
  return String(request.headers.get("x-premium-admin") || "") === token;
}

export function launchAllowed(env) {
  if (premiumMode(env) !== "live") return false;
  if (String(env?.PREMIUM_LAUNCH || "").trim() !== "test") return false;
  const key = String(env?.STRIPE_SECRET_KEY || "");
  if (!key.startsWith("sk_test_")) return false;
  if (key.startsWith("sk_live_") || key.includes("sk_live_")) return false;
  if (!String(env?.STRIPE_PRICE_ID || "").trim()) return false;
  return true;
}

async function stripeTestSession({ env, email, fetchImpl }) {
  const key = String(env?.STRIPE_SECRET_KEY || "");
  if (!key.startsWith("sk_test_") || key.startsWith("sk_live_")) return null;
  const price = String(env?.STRIPE_PRICE_ID || "").trim();
  if (!price) return null;
  const body = new URLSearchParams();
  body.set("mode", "subscription");
  body.set("success_url", "https://catchemtcg.com/?premium=success&session_id={CHECKOUT_SESSION_ID}");
  body.set("cancel_url", "https://catchemtcg.com/?premium=cancel");
  body.set("customer_email", email);
  body.set("line_items[0][price]", price);
  body.set("line_items[0][quantity]", "1");
  const res = await fetchImpl("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res?.ok) return null;
  const data = await res.json();
  const url = String(data?.url || "");
  const id = String(data?.id || "");
  if (!url.startsWith("https://checkout.stripe.com/") || !id.startsWith("cs_")) return null;
  return { url, id };
}

function launchLetter(url) {
  const css = darkCss();
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>Premium is open</title><style>${css}</style></head>
<body class="ce-page" style="margin:0;background:#f2f2f7"><table role="presentation" width="100%" class="ce-page" bgcolor="#f2f2f7"><tr><td align="center" style="padding:24px 14px"><table role="presentation" width="100%" style="max-width:420px"><tr><td class="ce-card" bgcolor="#ffffff" style="background:#ffffff;border-radius:16px;padding:22px">
<p class="ce-ink" style="margin:0 0 8px;font:600 20px/1.3 -apple-system,sans-serif;color:#1c1c1e">Premium is open.</p>
<p class="ce-dim" style="margin:0 0 16px;font:400 15px/1.45 -apple-system,sans-serif;color:#636366">$14.99 USD a month. This link is a test checkout.</p>
<a href="${esc(url)}" class="ce-btn-dark" style="display:inline-block;min-height:44px;line-height:44px;padding:0 18px;border-radius:999px;background:#1c1c1e;color:#ffffff;text-decoration:none">Open checkout</a>
</td></tr></table></td></tr></table></body></html>`;
}

// Sends nothing unless launchAllowed is true. Callers must not invoke this
// while the switch is still the waitlist.
export async function runLaunch({ env, kv, fetchImpl = fetch, limit = 20 }) {
  if (!launchAllowed(env) || !kv) return { off: true, sent: 0 };
  const names = await listRowKeys(kv);
  let sent = 0;
  for (const name of names) {
    if (sent >= limit) break;
    const row = await kv.get(name, "json");
    if (!row || row.status !== "confirmed" || row.checkoutSentAt) continue;
    const to = validEmail(row.email);
    if (!to) continue;
    const session = await stripeTestSession({ env, email: to, fetchImpl });
    if (!session) continue;
    const ok = await sendMail({
      env,
      to,
      subject: "Premium is open",
      html: launchLetter(session.url),
      text: `Premium is open. $14.99 USD a month. Test checkout: ${session.url}`,
      fetchImpl,
    });
    if (!ok) continue;
    row.checkoutSentAt = new Date().toISOString();
    row.checkoutSessionId = session.id;
    await kv.put(name, JSON.stringify(row));
    sent += 1;
  }
  return { off: false, sent };
}

export async function noteConverted(env, sessionId, fetchImpl = fetch) {
  const key = String(env?.STRIPE_SECRET_KEY || "");
  const id = String(sessionId || "");
  if (!key.startsWith("sk_test_") || key.startsWith("sk_live_") || !id.startsWith("cs_test_")) return false;
  const kv = env?.PREMIUM_WAITLIST;
  if (!kv) return false;
  let paid = false;
  try {
    const res = await fetchImpl("https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(id), {
      headers: { authorization: `Bearer ${key}` },
    });
    if (!res?.ok) return false;
    const data = await res.json();
    paid = data?.payment_status === "paid" || data?.status === "complete";
  } catch {
    return false;
  }
  if (!paid) return false;
  const names = await listRowKeys(kv);
  for (const name of names) {
    const row = await kv.get(name, "json");
    if (!row || row.checkoutSessionId !== id) continue;
    if (!row.convertedAt) {
      row.convertedAt = new Date().toISOString();
      await kv.put(name, JSON.stringify(row));
    }
    return true;
  }
  return false;
}

export async function handlePremiumRequest(request, env, fetchImpl = fetch) {
  const url = new URL(request.url);
  let path = url.pathname;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  const kv = env?.PREMIUM_WAITLIST;

  if (path === "/api/premium/waitlist" && request.method === "POST") {
    const fields = await readJoinFields(request);
    const result = await joinWaitlist({
      env,
      kv,
      email: fields.email,
      discord: fields.discord,
      origin: url.origin,
      fetchImpl,
    });
    if (fields.json) {
      if (result.ok) return jsonResponse({ ok: true });
      return jsonResponse({ ok: false, error: result.error || "not-ready" }, result.status || 503);
    }
    const notice = result.ok ? "Check your email to confirm your place." : noticeFor(result.error);
    return htmlResponse(renderWaitlistPage({ feed: env?.FEED_ENABLED === "true", notice }), result.ok ? 200 : (result.status || 503));
  }

  if (path === "/premium/confirm" && request.method === "GET") {
    if (!kv) return htmlResponse(renderWaitlistPage({ notice: "The waitlist is not ready yet." }), 503);
    const row = await confirmToken(kv, url.searchParams.get("t") || "");
    if (!row || !row.place) return htmlResponse(renderWaitlistPage({ notice: "This confirm link is no longer active." }), 404);
    const leave = `${url.origin}/premium/leave?t=${encodeURIComponent(row.token)}`;
    return htmlResponse(renderPlacePage(row.place, leave));
  }

  if (path === "/premium/leave" && request.method === "GET") {
    if (!kv) return htmlResponse(renderLeftPage());
    await leaveToken(kv, url.searchParams.get("t") || "");
    return htmlResponse(renderLeftPage());
  }

  if (path === "/premium/admin" && request.method === "GET") {
    if (!adminOk(request, env)) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
    const counts = await waitlistCounts(kv);
    const body = renderAdminPage(counts);
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-robots-tag": "noindex",
      },
    });
  }

  if (path === "/api/premium/launch") {
    if (request.method !== "POST" || !launchAllowed(env) || !adminOk(request, env)) {
      return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
    }
    const result = await runLaunch({ env, kv, fetchImpl });
    return jsonResponse({ ok: !result.off, sent: result.sent });
  }

  return null;
}

export { isWaitlist };
