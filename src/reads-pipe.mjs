// Custom Reads pipe. The nightly in Catchem-data reads saved follows from here
// and hands back the night's DM outbox. The bot reads that outbox. Every call
// needs the CUSTOM_READS_TOKEN worker secret as a bearer token. Nothing here
// is public, and the token is never echoed back.

export const FOLLOWS_KEY = "custom-reads:follows";
export const OUTBOX_KEY = "custom-reads:outbox";
const MAX_OUTBOX = 900000;

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}

// True only when Save stores the follow AND the nightly can read it.
export function readsPipeReady(env) {
  return !!(env?.FEED_KV && String(env?.CUSTOM_READS_TOKEN || "").length >= 32);
}

function sameText(a, b) {
  const x = String(a || "");
  const y = String(b || "");
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return diff === 0;
}

export function bearerOk(request, env) {
  const secret = String(env?.CUSTOM_READS_TOKEN || "");
  if (secret.length < 32) return false;
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return false;
  return sameText(header.slice(7).trim(), secret);
}

export function removeFollow(doc, id) {
  const want = String(id || "").replace(/^d:/, "");
  const follows = (Array.isArray(doc?.follows) ? doc.follows : []).filter((row) => row && String(row.id) !== want);
  return { ...(doc && typeof doc === "object" ? doc : {}), follows };
}

export function cleanOutbox(doc) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return null;
  const day = String(doc.day || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const members = (Array.isArray(doc.members) ? doc.members : [])
    .filter((row) => row && typeof row === "object" && /^\d{5,25}$/.test(String(row.discordId || "")));
  return { day, builtAt: String(doc.builtAt || ""), members };
}

// GET /api/reads/export        -> saved follows (the nightly reads this)
// GET /api/reads/outbox        -> tonight's DM outbox (the bot reads this)
// PUT /api/reads/outbox        -> the nightly stores the outbox
// DELETE /api/reads/export?id= -> drop one follow (test rows, support)
export async function handleReadsPipe(request, env) {
  const url = new URL(request.url);
  if (!String(env?.CUSTOM_READS_TOKEN || "")) return json({ ok: false, error: "Not set up." }, 503);
  if (!bearerOk(request, env)) return json({ ok: false, error: "Not allowed." }, 401);
  const store = env?.FEED_KV;
  if (!store) return json({ ok: false, error: "Storage is not bound." }, 503);
  if (url.pathname === "/api/reads/export") {
    if (request.method === "GET") {
      const doc = await store.get(FOLLOWS_KEY, "json");
      const follows = Array.isArray(doc?.follows) ? doc.follows : [];
      return json({ ok: true, rule: doc?.rule || "", follows });
    }
    if (request.method === "DELETE") {
      const id = url.searchParams.get("id") || "";
      if (!id) return json({ ok: false, error: "Missing id." }, 400);
      const next = removeFollow(await store.get(FOLLOWS_KEY, "json"), id);
      await store.put(FOLLOWS_KEY, JSON.stringify(next));
      return json({ ok: true, follows: next.follows.length });
    }
    return json({ ok: false, error: "Use GET." }, 405);
  }
  if (url.pathname === "/api/reads/outbox") {
    if (request.method === "GET") {
      const doc = await store.get(OUTBOX_KEY, "json");
      return json({ ok: true, ...(cleanOutbox(doc) || { day: "", builtAt: "", members: [] }) });
    }
    if (request.method === "PUT" || request.method === "POST") {
      const text = await request.text();
      if (text.length > MAX_OUTBOX) return json({ ok: false, error: "Too large." }, 413);
      let doc;
      try { doc = JSON.parse(text); } catch { return json({ ok: false, error: "Bad outbox." }, 400); }
      const clean = cleanOutbox(doc);
      if (!clean) return json({ ok: false, error: "Bad outbox." }, 400);
      await store.put(OUTBOX_KEY, JSON.stringify(clean));
      return json({ ok: true, day: clean.day, members: clean.members.length });
    }
    return json({ ok: false, error: "Use GET or PUT." }, 405);
  }
  return json({ ok: false, error: "Not found." }, 404);
}

export function isPipePath(pathname) {
  return pathname === "/api/reads/export" || pathname === "/api/reads/outbox";
}
