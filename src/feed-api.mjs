// Votes and price alerts. Both need FEED_KV. Discord DM delivery is a later change.
import { readUser } from "./quota.mjs";

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

const VOTES = new Set(["up", "sideways", "down"]);

export async function handleVote(request, env) {
  const store = env?.FEED_KV;
  if (!store) return json({ ok: false, error: "Votes are not open yet." }, 503);
  const url = new URL(request.url);
  if (request.method === "GET") {
    const id = String(url.searchParams.get("id") || "").slice(0, 80);
    if (!id) return json({ ok: false, error: "Missing read." }, 400);
    const counts = await store.get(`votes:${id}`, "json") || { up: 0, sideways: 0, down: 0 };
    return json({ ok: true, ...counts });
  }
  if (request.method !== "POST") return json({ ok: false, error: "Use POST." }, 405);
  const user = await readUser(request, env);
  if (!user?.sub) return json({ ok: false, error: "Sign in with Discord to vote." }, 401);
  let body = {};
  try { body = await request.json(); } catch { return json({ ok: false, error: "Bad vote." }, 400); }
  const id = String(body.id || "").slice(0, 80);
  const vote = String(body.vote || "");
  if (!id || !VOTES.has(vote)) return json({ ok: false, error: "Bad vote." }, 400);
  const key = `vote:${id}:${user.sub}`;
  const prev = await store.get(key);
  const counts = await store.get(`votes:${id}`, "json") || { up: 0, sideways: 0, down: 0 };
  if (prev && VOTES.has(prev) && counts[prev] > 0) counts[prev] -= 1;
  counts[vote] += 1;
  await store.put(key, vote);
  await store.put(`votes:${id}`, JSON.stringify(counts));
  return json({ ok: true, ...counts });
}

export async function handleAlert(request, env) {
  const store = env?.FEED_KV;
  if (!store) return json({ ok: false, error: "Alerts are not open yet." }, 503);
  if (request.method !== "POST") return json({ ok: false, error: "Use POST." }, 405);
  const user = await readUser(request, env);
  if (!user?.sub) return json({ ok: false, error: "Sign in with Discord to save an alert." }, 401);
  let body = {};
  try { body = await request.json(); } catch { return json({ ok: false, error: "Bad alert." }, 400); }
  const id = String(body.id || "").slice(0, 80);
  const sku = String(body.sku || "");
  if (!id || !sku.startsWith("tcgcsv-")) return json({ ok: false, error: "Bad alert." }, 400);
  const price = Number(body.price);
  const pct = Number(body.pct);
  const direction = body.direction === "down" ? "down" : "up";
  if (!(price > 0) && !(pct > 0)) return json({ ok: false, error: "Add a price or a percent." }, 400);
  const listKey = `alerts:${user.sub}`;
  const list = await store.get(listKey, "json") || [];
  const cap = user.premium === true ? 25 : 3;
  if (!list.includes(id) && list.length >= cap) {
    return json({ ok: false, error: user.premium ? "25 alerts saved." : "A free seat can save 3 alerts." }, 429);
  }
  const row = {
    id,
    sku,
    price: price > 0 ? price : null,
    pct: pct > 0 ? pct : null,
    direction,
    at: new Date().toISOString(),
  };
  await store.put(`alert:${user.sub}:${id}`, JSON.stringify(row));
  if (!list.includes(id)) list.push(id);
  await store.put(listKey, JSON.stringify(list));
  return json({ ok: true, saved: list.length, cap });
}
