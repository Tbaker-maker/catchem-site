// Discord sign-in for the AI seat. No session is minted without SESSION_SECRET.
// If Discord is not configured, the page is one line and has no button.

import { avatarUrl, ideasSignInLine, readUser, signSession, usageOf } from "./quota.mjs";
import { postOfficeOn } from "./post-office-flag.mjs";

export const DISCORD_INVITE = "https://discord.gg/fUSjxDX4Hy";
export const INVITE_LINE = "This tool is invite only.";

function officeHome(env) {
  return postOfficeOn(env) ? "/post-office" : "/";
}

// Comma-separated Discord user ids (POST_OFFICE_ALLOWLIST), set as a Worker secret.
// The ids never live in this public repo. Missing or empty lets nobody in.
export function officeAllowIds(env) {
  const ids = [];
  for (const part of String(env?.POST_OFFICE_ALLOWLIST || "").split(/[,\s]+/)) {
    let id = part.trim();
    if (id.startsWith("d:")) id = id.slice(2);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function officeAllowed(user, env) {
  const ids = officeAllowIds(env);
  if (!ids.length) return false;
  if (!user || !user.sub) return false;
  const sub = String(user.sub);
  const id = sub.startsWith("d:") ? sub.slice(2) : sub;
  return !!id && ids.includes(id);
}

// Clean invite only screen for any Post Office page a visitor is not cleared for.
export function inviteOnlyDocument(env, signedIn = false) {
  const action = signedIn
    ? `<a class="btn ghost" href="/auth/logout">Use another account</a>`
    : discordReady(env)
      ? `<a class="btn" href="/auth/discord?next=/post-office">Sign in with Discord</a>`
      : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><title>Invite only · Catch'em</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f5f7;color:#1d1d1f;font:17px/1.5 -apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Arial,sans-serif;padding:24px}
.card{background:#fff;border-radius:24px;box-shadow:0 8px 40px rgba(0,0,0,.08);padding:44px 36px;max-width:420px;width:100%;text-align:center}
h1{font-size:28px;font-weight:600;letter-spacing:-.02em;margin:0 0 10px}p{color:#6e6e73;margin:0 0 28px}
.btn{display:inline-block;background:#1d1d1f;color:#fff;text-decoration:none;border-radius:980px;padding:12px 24px;font-weight:500;margin:4px}
.btn.ghost{background:#f5f5f7;color:#1d1d1f}a.back{display:block;margin-top:20px;color:#6e6e73;font-size:15px;text-decoration:none}
</style></head><body><main class="card"><h1>${INVITE_LINE}</h1><p>Post Office is open to approved Discord members.</p>${action}<a class="back" href="/">Back to Catch'em</a></main></body></html>`;
}

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
  const back = officeHome(env);
  const backLabel = postOfficeOn(env) ? "Back to Post Office" : "Back to Catch'em";
  const about = postOfficeOn(env)
    ? "Sign in to Catch'em with Discord to use Post Office Ideas."
    : "Sign in to Catch'em with Discord.";
  const link = ready
    ? `<p><a href="/auth/discord?next=${back}">Sign in with Discord</a> to use Ideas. A free seat is 3 a day.</p>`
    : `<p>${line}</p>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="description" content="${about}"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><title>Sign in · Catch'em</title></head><body style="margin:24px;font:16px/1.5 sans-serif;background:#12100e;color:#efe9de">${link}<p><a href="${back}">${backLabel}</a></p><footer><p>Not affiliated with Nintendo, The Pokémon Company, or Creatures.</p><p>Catch'em. From Base Set to the latest drops.</p></footer></body></html>`;
}

export async function sessionView(request, env) {
  const ready = discordReady(env);
  const user = await readUser(request, env);
  if (!user) return { signedIn: false, ready, line: ideasSignInLine(ready), open: false };
  if (!officeAllowed(user, env)) return { signedIn: true, ready, line: INVITE_LINE, open: false };
  return {
    signedIn: true,
    ready: true,
    premium: user.premium === true,
    name: user.name || "",
    avatar: avatarUrl(user),
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
  const next = url.searchParams.get("next") || officeHome(env);
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
  const next = cut >= 0 ? saved.slice(cut + 1) : officeHome(env);
  if (!code || !state || state !== savedState) {
    return html(`<p>Discord did not finish. <a href="/auth/discord?next=${officeHome(env)}">Sign in with Discord</a> to try again.</p>`);
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
  const dest = next.startsWith("/") && !next.startsWith("//") ? next : officeHome(env);
  const office = postOfficeOn(env) && (dest === "/post-office" || dest.startsWith("/post-office/"));
  let premium = false;
  if (env.ACCESS_API_URL && env.ACCESS_API_SECRET) {
    let access = null;
    try {
      const check = await fetchImpl(env.ACCESS_API_URL.replace(/\/$/, "") + "/access/check?discord_id=" + encodeURIComponent(me.id), {
        headers: { "x-access-secret": env.ACCESS_API_SECRET },
      });
      if (check.ok) access = await check.json();
    } catch {
      access = null;
    }
    if (office) {
      if (!access) return html(`<p>The seat check did not answer. Try again in a minute.</p>`);
      if (access.approved !== true) return html(`<p>You're on the list. We'll let you in soon.</p>`);
      premium = access.premium === true;
    } else if (access && access.approved === true) {
      premium = access.premium === true;
    }
  }
  const name = String(me.global_name || me.username || "").slice(0, 32);
  const avatar = typeof me.avatar === "string" ? me.avatar : "";
  const session = await signSession({ sub: "d:" + me.id, premium, name, avatar }, env.SESSION_SECRET);
  const headers = new Headers({ location: dest, "cache-control": "no-store" });
  headers.append("set-cookie", `ce_session=${encodeURIComponent(session)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`);
  headers.append("set-cookie", "ce_oauth=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
  return new Response(null, { status: 302, headers });
}

export function logout(request, env) {
  let dest = officeHome(env);
  try {
    const next = new URL(request?.url || "https://catchemtcg.com/auth/logout").searchParams.get("next") || "";
    if (next.startsWith("/") && !next.startsWith("//")) dest = next;
  } catch { /* keep the return */ }
  const headers = new Headers({ location: dest, "cache-control": "no-store" });
  headers.append("set-cookie", "ce_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
  return new Response(null, { status: 302, headers });
}
