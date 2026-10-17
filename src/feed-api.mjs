// Votes, follows, and price alerts. Account rows need FEED_KV.
// Discord DMs are sent by the bot from the synced watch list. Premium only.
import { readUser } from "./quota.mjs";
import { WATCH_CAP } from "./watch-cap.mjs";

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

function priceDirOf(value) {
  const d = String(value || "either");
  if (d === "up" || d === "above") return "above";
  if (d === "down" || d === "below") return "below";
  return "either";
}

export function watchRowsForBot(rows) {
  const out = [];
  for (const row of rows || []) {
    const sku = String(row?.sku || "");
    const fromId = String(row?.id || "").match(/tcgcsv-\d+/);
    const id = sku.startsWith("tcgcsv-") ? sku : (fromId ? fromId[0] : "");
    if (!id) continue;
    const market = Number(row.market);
    let priceAt = Number(row.price) > 0 ? Number(row.price) : (Number(row.price_at) > 0 ? Number(row.price_at) : null);
    let priceDir = priceDirOf(row.priceDir || row.price_dir || row.direction);
    if (priceAt == null && Number(row.pct) > 0 && market > 0) {
      const pct = Number(row.pct);
      if (priceDir === "below") priceAt = Math.round(market * (1 - pct / 100) * 100) / 100;
      else {
        priceAt = Math.round(market * (1 + pct / 100) * 100) / 100;
        if (priceDir === "either") priceDir = "above";
      }
    }
    let listingsAt = null;
    let listingsDir = "either";
    const named = Number(row.listingsAt ?? row.listings_at);
    const below = Number(row.listingsBelow);
    const above = Number(row.listingsAbove);
    if (named >= 20) {
      listingsAt = Math.round(named);
      listingsDir = priceDirOf(row.listingsDir || row.listings_dir);
    } else if (above >= 20 && !(below >= 20)) {
      listingsAt = Math.round(above);
      listingsDir = "above";
    } else if (below >= 20 && !(above >= 20)) {
      listingsAt = Math.round(below);
      listingsDir = "below";
    }
    out.push({
      id,
      name: String(row.name || "").slice(0, 120),
      kind: row.kind === "sealed" ? "sealed" : "single",
      price_at: priceAt,
      price_dir: priceDir,
      listings_at: listingsAt,
      listings_dir: listingsDir,
      pause_all: row.pause_all === true || row.pauseAll === true,
      quiet_start: String(row.quiet_start || row.quietStart || "").slice(0, 5),
      quiet_end: String(row.quiet_end || row.quietEnd || "").slice(0, 5),
    });
    if (out.length >= WATCH_CAP) break;
  }
  return out;
}

export async function pushWatches(env, user, rows) {
  if (!env?.ACCESS_API_URL || !env?.ACCESS_API_SECRET || !user?.sub) return;
  const id = String(user.sub).startsWith("d:") ? String(user.sub).slice(2) : "";
  if (!/^\d+$/.test(id)) return;
  try {
    await fetch(String(env.ACCESS_API_URL).replace(/\/$/, "") + "/member/watch", {
      method: "POST",
      headers: { "content-type": "application/json", "x-access-secret": env.ACCESS_API_SECRET },
      body: JSON.stringify({ discord_id: id, rows: watchRowsForBot(rows) }),
    });
  } catch {
    // The account row is already saved. A quiet bot does not undo it.
  }
}

function alertFrom(body) {
  const id = String(body.id || "").slice(0, 80);
  const sku = String(body.sku || "");
  const price = Number(body.price);
  const pct = Number(body.pct);
  const priceDir = priceDirOf(body.priceDir || body.direction);
  const direction = priceDir === "above" ? "up" : priceDir === "below" ? "down" : "either";
  const below = Number(body.listingsBelow);
  const above = Number(body.listingsAbove);
  const listingsAt = Number(body.listingsAt);
  return {
    id,
    sku,
    price: price > 0 ? price : null,
    pct: pct > 0 ? pct : null,
    direction,
    priceDir,
    listingsBelow: below > 0 ? Math.round(below) : null,
    listingsAbove: above > 0 ? Math.round(above) : null,
    listingsAt: listingsAt >= 20 ? Math.round(listingsAt) : null,
    listingsDir: priceDirOf(body.listingsDir || (listingsAt >= 20 ? body.listingsDir : "")),
    name: String(body.name || "").slice(0, 120),
    headline: String(body.headline || "").slice(0, 180),
    market: Number(body.market) > 0 ? Number(body.market) : null,
    listings: Number(body.listings) >= 20 ? Math.round(Number(body.listings)) : null,
    listingsAsOf: /^\d{4}-\d{2}-\d{2}$/.test(String(body.listingsAsOf || "")) ? String(body.listingsAsOf) : null,
    changePct: Number.isFinite(Number(body.changePct)) ? Number(body.changePct) : null,
    kind: body.kind === "sealed" ? "sealed" : "single",
    href: String(body.href || "").startsWith("/") ? String(body.href).slice(0, 180) : "",
    at: new Date().toISOString(),
  };
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
    const left = await loadRows();
    await pushWatches(env, user, left);
    return json({ ok: true, rows: left });
  }
  if (body.merge === true && Array.isArray(body.rows)) {
    const prefs = await store.get(`prefs:${user.sub}`, "json") || {};
    let list = await store.get(listKey, "json") || [];
    for (const raw of body.rows) {
      if (!raw || typeof raw !== "object") continue;
      const row = alertFrom(raw);
      if (!row.id || !row.sku.startsWith("tcgcsv-")) continue;
      if (!(row.price > 0) && !(row.pct > 0) && !(row.listingsBelow > 0) && !(row.listingsAbove > 0) && !(row.listingsAt >= 20)) continue;
      if (!list.includes(row.id) && list.length >= WATCH_CAP) break;
      row.pauseAll = prefs.pauseAll === true;
      row.quietStart = prefs.quietStart || "";
      row.quietEnd = prefs.quietEnd || "";
      await store.put(`alert:${user.sub}:${row.id}`, JSON.stringify(row));
      if (!list.includes(row.id)) list.push(row.id);
    }
    await store.put(listKey, JSON.stringify(list.slice(0, WATCH_CAP)));
    const merged = await loadRows();
    await pushWatches(env, user, merged);
    return json({ ok: true, saved: list.length, cap: WATCH_CAP, rows: merged });
  }
  if (Array.isArray(body.order)) {
    const list = await store.get(listKey, "json") || [];
    const next = body.order.map((id) => String(id || "").slice(0, 80)).filter((id) => list.includes(id));
    for (const id of list) if (!next.includes(id)) next.push(id);
    await store.put(listKey, JSON.stringify(next));
    return json({ ok: true, rows: await loadRows() });
  }
  const row = alertFrom(body);
  if (!row.id || !row.sku.startsWith("tcgcsv-")) return json({ ok: false, error: "Bad alert." }, 400);
  if (!(row.price > 0) && !(row.pct > 0) && !(row.listingsBelow > 0) && !(row.listingsAbove > 0) && !(row.listingsAt >= 20)) {
    return json({ ok: false, error: "Add a number to cross." }, 400);
  }
  const list = await store.get(listKey, "json") || [];
  if (!list.includes(row.id) && list.length >= WATCH_CAP) {
    return json({ ok: false, error: "The list holds 25." }, 429);
  }
  const prefs = await store.get(`prefs:${user.sub}`, "json") || {};
  row.pauseAll = prefs.pauseAll === true;
  row.quietStart = prefs.quietStart || "";
  row.quietEnd = prefs.quietEnd || "";
  await store.put(`alert:${user.sub}:${row.id}`, JSON.stringify(row));
  if (!list.includes(row.id)) list.push(row.id);
  await store.put(listKey, JSON.stringify(list));
  const saved = await loadRows();
  await pushWatches(env, user, saved);
  return json({ ok: true, saved: list.length, cap: WATCH_CAP, rows: saved });
}
