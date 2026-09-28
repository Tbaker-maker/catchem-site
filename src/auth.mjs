// Discord sign-in for the AI seat. No session is minted without SESSION_SECRET.
// If Discord is not configured, the page is one line and has no button.

import { ideasSignInLine, readUser, signSession, usageOf } from "./quota.mjs";

export function discordReady(env) {
  return !!(env && env.SESSION_SECRET && env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET);
}

function originOf(request) {
  return new URL(request.url).origin;
}

function html(body, status = 200, extra = {}) {
  const headers = new Headers(extra);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(body, { status, headers });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export function signInDocument(env) {
  const ready = discordReady(env);
  const line = ideasSignInLine(ready);
  const link = ready
    ? `<p><a href="/auth/discord?next=/post-office">Sign in with Discord</a> to use Ideas. A free seat is 3 a day. Premium is 50 a day.</p>`
    : `<p>${line}</p>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Sign in · Catch'em</title></head><body style="margin:24px;font:16px/1.5 sans-serif;background:#12100e;color:#efe9de">${link}<p><a href="/post-office">Back to Post Office</a></p></body></html>`;
}

export async function sessionView(request, env) {
  const ready = discordReady(env);
  const user = await readUser(request, env);
  if (!user) return { signedIn: false, ready, line: ideasSignInLine(ready) };
  return {
    signedIn: true,
    ready: true,
    premium: user.premium === true,
    ideas: usageOf(user, "ideas"),
    post: usageOf(user, "post-text"),
  };
}

export function handleSession(request, env) {
  return sessionView(request, env).then((view) => json(view));
}

export function handleSignIn(request, env) {
  return html(signInDocument(env));
}

export function beginDiscord(request, env) {
  if (!discordReady(env)) return html(signInDocument(env));
  const url = new URL(request.url);
  const next = url.searchParams.get("next") || "/post-office";
  const state = crypto.randomUUID();
  const redirect = "https://discord.com/oauth2/authorize?" + new URLSearchParams({
    response_type: "code",
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: originOf(request) + "/auth/discord/callback",
    scope: "identify email",
    state,
    prompt: "consent",
  });
  const headers = new Headers({ location: redirect, "cache-control": "no-store" });
  headers.append("set-cookie", `ce_oauth=${encodeURIComponent(state + "|" + next)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);
  return new Response(null, { status: 302, headers });
}

function cookieValue(header, name) {
  const raw = String(header || "").split(";").map((p) => p.trim()).find((p) => p.startsWith(name + "="));
  if (!raw) return "";
  try { return decodeURIComponent(raw.slice(name.length + 1)); } catch { return ""; }
}

export async function finishDiscord(request, env, fetchImpl = fetch) {
  if (!discordReady(env)) return html(signInDocument(env));
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const saved = cookieValue(request.headers.get("cookie"), "ce_oauth");
  const cut = saved.indexOf("|");
  const savedState = cut >= 0 ? saved.slice(0, cut) : "";
  const next = cut >= 0 ? saved.slice(cut + 1) : "/post-office";
  if (!code || !state || state !== savedState) {
    return html(`<p>Discord did not finish. <a href="/auth/discord?next=/post-office">Sign in with Discord</a> to try again.</p>`);
  }
  const tokenRes = await fetchImpl("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: originOf(request) + "/auth/discord/callback",
    }),
  });
  if (!tokenRes.ok) return html(`<p>Discord did not finish. <a href="/signin">Back</a></p>`);
  const token = await tokenRes.json();
  const meRes = await fetchImpl("https://discord.com/api/users/@me", {
    headers: { authorization: "Bearer " + (token.access_token || "") },
  });
  if (!meRes.ok) return html(`<p>Discord did not finish. <a href="/signin">Back</a></p>`);
  const me = await meRes.json();
  if (!me || !me.id) return html(`<p>Discord did not finish. <a href="/signin">Back</a></p>`);
  let premium = false;
  if (env.ACCESS_API_URL && env.ACCESS_API_SECRET) {
    const check = await fetchImpl(env.ACCESS_API_URL.replace(/\/$/, "") + "/access/check?discord_id=" + encodeURIComponent(me.id), {
      headers: { "x-access-secret": env.ACCESS_API_SECRET },
    });
    if (!check.ok) return html(`<p>The seat check did not answer. Try again in a minute.</p>`);
    const access = await check.json();
    if (!access || access.approved !== true) {
      return html(`<p>You're on the list. We'll let you in soon.</p>`);
    }
    premium = access.premium === true;
  }
  const session = await signSession({ sub: "d:" + me.id, premium }, env.SESSION_SECRET);
  const dest = next.startsWith("/") && !next.startsWith("//") ? next : "/post-office";
  const headers = new Headers({ location: dest, "cache-control": "no-store" });
  headers.append("set-cookie", `ce_session=${encodeURIComponent(session)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`);
  headers.append("set-cookie", "ce_oauth=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
  return new Response(null, { status: 302, headers });
}

export function logout() {
  const headers = new Headers({ location: "/post-office", "cache-control": "no-store" });
  headers.append("set-cookie", "ce_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
  return new Response(null, { status: 302, headers });
}
