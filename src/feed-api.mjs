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

export async function handleFollow(request, env) {
  const store = env?.FEED_KV;
  if (!store) return json({ ok: false, error: "Follows are not open yet." }, 503);
  if (request.method !== "POST") return json({ ok: false, error: "Use POST." }, 405);
  const user = await readUser(request, env);
  if (!user?.sub) return json({ ok: false, error: "Sign in with Discord to follow." }, 401);
  let body = {};
  try { body = await request.json(); } catch { return json({ ok: false, error: "Bad follow." }, 400); }
  const id = String(body.id || "").slice(0, 80);
  const sku = String(body.sku || "");
  if (!id || !sku.startsWith("tcgcsv-")) return json({ ok: false, error: "Bad follow." }, 400);
  const listKey = `follows:${user.sub}`;
  const list = await store.get(listKey, "json") || [];
  if (list.includes(id)) return json({ ok: true, following: true, saved: list.length });
  const cap = user.premium === true ? 25 : 3;
  if (list.length >= cap) {
    return json({ ok: false, error: user.premium ? "25 follows saved." : "A free seat can follow 3 reads." }, 429);
  }
  list.push(id);
  await store.put(`follow:${user.sub}:${id}`, JSON.stringify({ id, sku, at: new Date().toISOString() }));
  await store.put(listKey, JSON.stringify(list));
  return json({ ok: true, following: true, saved: list.length, cap });
}

export async function handleAlert(request, env) {
  const store = env?.FEED_KV;
  if (!store) return json({ ok: false, error: "Alerts are not open yet." }, 503);
  const user = await readUser(request, env);
  if (!user?.sub) return json({ ok: false, error: "Sign in with Discord to save an alert." }, 401);
  const listKey = `alerts:${user.sub}`;
  const loadRows = async () => {
    const list = await store.get(listKey, "json") || [];
    const rows = [];
    for (const id of list) {
      const row = await store.get(`alert:${user.sub}:${id}`, "json");
      if (row) rows.push(row);
    }
    return rows;
  };
  if (request.method === "GET") return json({ ok: true, rows: await loadRows() });
  if (request.method !== "POST" && request.method !== "DELETE") return json({ ok: false, error: "Use POST." }, 405);
  let body = {};
  try { body = await request.json(); } catch { return json({ ok: false, error: "Bad alert." }, 400); }
  if (request.method === "DELETE") {
    const id = String(body.id || "").slice(0, 80);
    const list = (await store.get(listKey, "json") || []).filter((item) => item !== id);
    await store.delete(`alert:${user.sub}:${id}`);
    await store.put(listKey, JSON.stringify(list));
    return json({ ok: true, rows: await loadRows() });
  }
  if (Array.isArray(body.order)) {
    const list = await store.get(listKey, "json") || [];
    const next = body.order.map((id) => String(id || "").slice(0, 80)).filter((id) => list.includes(id));
    for (const id of list) if (!next.includes(id)) next.push(id);
    await store.put(listKey, JSON.stringify(next));
    return json({ ok: true, rows: await loadRows() });
  }
  const id = String(body.id || "").slice(0, 80);
  const sku = String(body.sku || "");
  if (!id || !sku.startsWith("tcgcsv-")) return json({ ok: false, error: "Bad alert." }, 400);
  const price = Number(body.price);
  const pct = Number(body.pct);
  const direction = body.direction === "down" ? "down" : body.direction === "either" ? "either" : "up";
  const below = Number(body.listingsBelow);
  const above = Number(body.listingsAbove);
  if (!(price > 0) && !(pct > 0) && !(below > 0) && !(above > 0)) return json({ ok: false, error: "Add a price or a percent." }, 400);
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
    listingsBelow: below > 0 ? Math.round(below) : null,
    listingsAbove: above > 0 ? Math.round(above) : null,
    name: String(body.name || "").slice(0, 120),
    headline: String(body.headline || "").slice(0, 180),
    market: Number(body.market) > 0 ? Number(body.market) : null,
    listings: Number(body.listings) >= 20 ? Math.round(Number(body.listings)) : null,
    listingsAsOf: /^\d{4}-\d{2}-\d{2}$/.test(String(body.listingsAsOf || "")) ? String(body.listingsAsOf) : null,
    changePct: Number.isFinite(Number(body.changePct)) ? Number(body.changePct) : null,
    at: new Date().toISOString(),
  };
  await store.put(`alert:${user.sub}:${id}`, JSON.stringify(row));
  if (!list.includes(id)) list.push(id);
  await store.put(listKey, JSON.stringify(list));
  return json({ ok: true, saved: list.length, cap });
}
