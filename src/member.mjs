// Account pages. Sign-in is optional. FEED_KV holds the rows when it is bound.
import { FOLLOWS_KEY, removeFollow } from "./reads-pipe.mjs";
import { pageChrome as chrome } from "./ui.mjs";
import { readUser, avatarUrl } from "./quota.mjs";
import { WATCH_CAP } from "./watch-cap.mjs";
import { pushWatches } from "./feed-api.mjs";
import { buildSmartPayload, defaultGoal, normalizeBriefPrefs, normalizeGoal } from "./smart-collection.mjs";
import { previewImport, holdingsFromPreview } from "./collection-import.mjs";
import { morningBriefEmailArmed, readBriefEmailPrefs, saveBriefEmailPrefs, normalizeBriefEmailPrefs } from "./morning-brief-email.mjs";

const CONDITIONS = ["NM", "LP", "MP", "HP", "DMG"];

function json(obj, status = 200, extra = {}) {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  for (const [key, value] of Object.entries(extra)) headers.set(key, value);
  return new Response(JSON.stringify(obj), { status, headers });
}

function dayOk(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function clockOk(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ""));
}

function numOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeHolding(raw) {
  const sku = String(raw?.sku || raw?.id || "");
  const id = /^tcgcsv-\d+$/.test(sku) ? sku : "";
  if (!id) return null;
  const kind = raw?.kind === "sealed" ? "sealed" : "single";
  let name = String(raw?.name || id).replace(/\s+/g, " ").trim().slice(0, 120);
  if (kind === "sealed") name = name.replace(/\bNM\b/g, "").replace(/\s+/g, " ").trim();
  const qty = Math.max(1, Math.min(99, Math.round(Number(raw?.qty) || 1)));
  const price = Number(raw?.price);
  const listings = Number(raw?.listings);
  return {
    id,
    name: name || id,
    kind,
    condition: kind === "single" ? (CONDITIONS.includes(raw?.condition) ? raw.condition : "NM") : null,
    qty,
    price: price > 0 ? Math.round(price * 100) / 100 : null,
    asOf: dayOk(raw?.asOf) ? String(raw.asOf) : "",
    source: "TCGplayer market price",
    change7: numOrNull(raw?.change7),
    change30: numOrNull(raw?.change30),
    change90: numOrNull(raw?.change90),
    listings: kind === "sealed" && Number.isFinite(listings) && listings >= 0 ? Math.round(listings) : null,
    listingsAsOf: kind === "sealed" && dayOk(raw?.listingsAsOf) ? String(raw.listingsAsOf) : "",
    set: String(raw?.set || "").replace(/\s+/g, " ").trim().slice(0, 80),
    setSlug: /^[a-z0-9-]+$/.test(String(raw?.setSlug || "")) ? String(raw.setSlug) : "",
    href: kind === "sealed" ? `/p/${id}` : `/c/${id}`,
  };
}

export function collectionSummary(rows) {
  const items = Array.isArray(rows) ? rows.filter(Boolean) : [];
  let value = 0;
  const windows = {
    d7: { base: 0, delta: 0, n: 0 },
    d30: { base: 0, delta: 0, n: 0 },
    d90: { base: 0, delta: 0, n: 0 },
  };
  for (const row of items) {
    if (!(row.price > 0) || !(row.qty > 0)) continue;
    const line = row.price * row.qty;
    value += line;
    for (const [key, field] of [["d7", "change7"], ["d30", "change30"], ["d90", "change90"]]) {
      if (!Number.isFinite(row[field])) continue;
      windows[key].n += 1;
      windows[key].base += line;
      windows[key].delta += line * (row[field] / 100);
    }
  }
  const top = items
    .filter((row) => Number.isFinite(row.change7) && row.price > 0)
    .slice()
    .sort((a, b) => Math.abs(b.change7) - Math.abs(a.change7))
    .slice(0, 5);
  return {
    value: Math.round(value * 100) / 100,
    n: items.length,
    windows,
    top,
  };
}

function prefsOf(raw) {
  const start = clockOk(raw?.quietStart) ? String(raw.quietStart) : "";
  const end = clockOk(raw?.quietEnd) ? String(raw.quietEnd) : "";
  return { pauseAll: raw?.pauseAll === true, quietStart: start, quietEnd: end };
}

async function readList(store, key) {
  if (!store) return [];
  const list = await store.get(key, "json");
  return Array.isArray(list) ? list : [];
}

async function accountBundle(store, user) {
  const sub = user.sub;
  const holdings = await readList(store, `collection:${sub}`);
  const ids = await readList(store, `alerts:${sub}`);
  const alerts = [];
  for (const id of ids) {
    const row = await store.get(`alert:${sub}:${id}`, "json");
    if (row) alerts.push(row);
  }
  const followIds = await readList(store, `follows:${sub}`);
  const prefs = prefsOf(await store.get(`prefs:${sub}`, "json"));
  return { holdings, alerts, followIds, prefs };
}

async function syncAlerts(env, user, store) {
  const ids = await readList(store, `alerts:${user.sub}`);
  const prefs = prefsOf(await store.get(`prefs:${user.sub}`, "json"));
  const rows = [];
  for (const id of ids) {
    const row = await store.get(`alert:${user.sub}:${id}`, "json");
    if (row) rows.push({ ...row, pauseAll: prefs.pauseAll, quietStart: prefs.quietStart, quietEnd: prefs.quietEnd });
  }
  await pushWatches(env, user, rows);
}

export async function handleSmartCollection(request) {
  if (request.method !== "POST") return json({ ok: false, error: "Use POST." }, 405);
  let body = {};
  try { body = await request.json(); } catch { return json({ ok: false, error: "Bad smart request." }, 400); }
  const holdings = Array.isArray(body.holdings) ? body.holdings.map(normalizeHolding).filter(Boolean) : [];
  const prevHoldings = Array.isArray(body.prevHoldings) ? body.prevHoldings.map(normalizeHolding).filter(Boolean) : [];
  const setDocs = Array.isArray(body.setDocs) ? body.setDocs.filter((d) => d && typeof d === "object").slice(0, 12) : [];
  const reads = Array.isArray(body.reads) ? body.reads.slice(0, 200) : [];
  const views = body.views && typeof body.views === "object" ? body.views : {};
  const goal = normalizeGoal(body.goal) || defaultGoal(holdings);
  const briefPrefs = normalizeBriefPrefs(body.briefPrefs || { pinned: body.briefPinned, hidden: body.briefHidden });
  const payload = buildSmartPayload({ holdings, prevHoldings, setDocs, reads, views, goal, briefPrefs });
  return json(payload);
}


export async function handleCollectionImport(request) {
  if (request.method !== "POST") return json({ ok: false, error: "Use POST." }, 405);
  let body = {};
  try { body = await request.json(); } catch { return json({ ok: false, error: "Bad import request." }, 400); }
  const action = String(body.action || "preview");
  const catalogue = Array.isArray(body.catalogue) ? body.catalogue.slice(0, 20000) : [];
  if (action === "preview") {
    const text = String(body.text || "").slice(0, 1_000_000);
    const preview = previewImport({ text, catalogue });
    return json(preview, preview.ok ? 200 : 400);
  }
  if (action === "holdings") {
    const holdings = holdingsFromPreview(body.preview).map(normalizeHolding).filter(Boolean);
    return json({ ok: true, holdings, n: holdings.length });
  }
  return json({ ok: false, error: "Unknown import action." }, 400);
}

export async function handleMe(request, env) {
  const store = env?.FEED_KV;
  const user = await readUser(request, env);
  if (!user?.sub) return json({ ok: false, error: "Sign in with Discord to use the account." }, 401);
  if (!store) return json({ ok: false, error: "Account saves are not open yet." }, 503);
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/api/me/export") {
    const bundle = await accountBundle(store, user);
    const body = JSON.stringify({
      profile: { id: user.sub, name: user.name || "", premium: user.premium === true },
      collection: bundle.holdings,
      alerts: bundle.alerts,
      follows: bundle.followIds,
      prefs: bundle.prefs,
    }, null, 1);
    return new Response(body, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": "attachment; filename=\"catchem-export.json\"",
        "cache-control": "no-store",
      },
    });
  }
  if (request.method === "GET") {
    const bundle = await accountBundle(store, user);
    return json({
      ok: true,
      cap: WATCH_CAP,
      user: { name: user.name || "", premium: user.premium === true, avatar: avatarUrl(user) },
      collection: bundle.holdings,
      summary: collectionSummary(bundle.holdings),
      alerts: bundle.alerts,
      prefs: bundle.prefs,
    });
  }
  if (request.method === "DELETE") return wipe(store, user);
  if (request.method !== "POST") return json({ ok: false, error: "Use POST." }, 405);
  let body = {};
  try { body = await request.json(); } catch { return json({ ok: false, error: "Bad account request." }, 400); }
  if (body.action === "delete") return wipe(store, user);
  if (body.action === "brief-email") {
    const saved = await saveBriefEmailPrefs(store, user.sub, { optIn: body.optIn === true, email: body.email, goal: body.goal });
    if (!saved.ok) return json({ ok: false, error: "Could not save email preference." }, 503);
    return json({ ok: true, prefs: saved.prefs, armed: morningBriefEmailArmed(env) });
  }
  if (body.action === "prefs") {
    const prefs = prefsOf(body);
    await store.put(`prefs:${user.sub}`, JSON.stringify(prefs));
    await syncAlerts(env, user, store);
    return json({ ok: true, prefs });
  }
  if (body.action === "remove") {
    const id = String(body.id || "");
    const list = (await readList(store, `collection:${user.sub}`)).filter((row) => row && row.id !== id);
    await store.put(`collection:${user.sub}`, JSON.stringify(list));
    return json({ ok: true, collection: list, summary: collectionSummary(list) });
  }
  if (body.action === "holding" || body.action === "merge") {
    const incoming = body.action === "merge" ? (Array.isArray(body.rows) ? body.rows : []) : [body];
    let list = await readList(store, `collection:${user.sub}`);
    for (const raw of incoming) {
      const row = normalizeHolding(raw);
      if (!row) continue;
      list = list.filter((item) => item && item.id !== row.id);
      list.unshift(row);
    }
    list = list.slice(0, 200);
    await store.put(`collection:${user.sub}`, JSON.stringify(list));
    return json({ ok: true, collection: list, summary: collectionSummary(list) });
  }
  return json({ ok: false, error: "Bad account request." }, 400);
}

async function wipe(store, user) {
  const alertIds = await readList(store, `alerts:${user.sub}`);
  for (const id of alertIds) await store.delete(`alert:${user.sub}:${id}`);
  const followIds = await readList(store, `follows:${user.sub}`);
  for (const id of followIds) await store.delete(`follow:${user.sub}:${id}`);
  await store.delete(`alerts:${user.sub}`);
  await store.delete(`follows:${user.sub}`);
  await store.delete(`collection:${user.sub}`);
  await store.delete(`prefs:${user.sub}`);
  await store.delete(`member:${user.sub}`);
  const reads = await store.get(FOLLOWS_KEY, "json");
  if (reads) await store.put(FOLLOWS_KEY, JSON.stringify(removeFollow(reads, user.sub)));
  await store.delete(`reads:${user.sub}`);
  const headers = { "set-cookie": "ce_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0" };
  return json({ ok: true, deleted: true }, 200, headers);
}

const CSS = `
.mem{display:flex;flex-direction:column;gap:14px;max-width:720px}
.mem h1{margin:0}
.mem p{margin:0}
.tap,.mem button,.mem select,.mem input{min-height:44px;border-radius:12px;font:600 16px/1 var(--sans)}
.mem button,.mem a.tap{display:inline-flex;align-items:center;justify-content:center;padding:0 16px;border:0;background:#d9b779;color:#1a1407;text-decoration:none;width:fit-content}
.mem button.quiet,.mem a.quiet{background:transparent;color:inherit;border:1px solid var(--line)}
.mem input,.mem select{background:#1a1815;color:inherit;border:1px solid var(--line);padding:0 12px;width:100%}
.mem .rowcard{border:1px solid var(--line);border-radius:16px;padding:12px;display:flex;flex-direction:column;gap:8px}
.skel{height:88px;border-radius:16px;background:#1c1a17}
.switch{display:flex;align-items:center;gap:12px;min-height:44px}
.switch input{width:44px;height:44px;flex:0 0 44px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.goal-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.goal-row button{width:100%}
.goal-row button[aria-pressed="true"]{background:#d9b779;color:#1a1407;border:0}
.brief-sec{display:flex;flex-direction:column;gap:8px}
.brief-sec header{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.brief-sec h3{margin:0;font:600 16px/1.3 var(--sans)}
.score-pill{font:600 28px/1.1 var(--serif);color:var(--gold)}
.progress{height:10px;border-radius:999px;background:#2a2621;overflow:hidden;margin:6px 0}
.progress>span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#c4a35a,#e4d2a0);width:0;transition:width .45s ease}
.celebrate{padding:12px 14px;border-radius:16px;border:1px solid rgba(212,175,55,.45);background:rgba(212,175,55,.10);color:var(--gold);font:600 16px/1.35 var(--sans)}
.streak{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;border:1px solid var(--line);font:600 13px/1.2 var(--sans);color:var(--gold)}
.mem details.rowcard{gap:10px}
.mem details.rowcard>summary{cursor:pointer;font:600 18px/1.3 var(--sans);list-style:none}
.mem details.rowcard>summary::-webkit-details-marker{display:none}
.mem .empty-cta{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}
@media(max-width:700px){.grid2,.goal-row{grid-template-columns:1fr}}
.mem .muted{color:#c4beb3;opacity:1}
.mem button.quiet,.mem a.quiet{min-height:44px;min-width:44px;padding:0 12px}
.mem #hits{display:flex;flex-direction:column;gap:6px}
.mem #hits button{width:100%;justify-content:flex-start;text-align:left}
.mem .onboard{border:1px solid var(--line);border-radius:18px;padding:14px;display:flex;flex-direction:column;gap:10px;background:#1a1815}
.mem .onboard ol{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:8px}
.mem .onboard li{line-height:1.35}
.mem .onboard[hidden],.mem .empty-cta[hidden]{display:none}
.mem .empty-cta{border:1px dashed var(--line);border-radius:18px;padding:14px;display:flex;flex-direction:column;gap:10px}
.mem .progress-rail{height:8px;border-radius:999px;background:#2a2622;overflow:hidden}
.mem .progress-fill{height:100%;width:0;border-radius:999px;background:#d9b779;transition:width .35s ease}
.mem .celebrate{display:none}
.mem .celebrate.is-on{display:block}
@media (prefers-reduced-motion:reduce){
  .mem .progress-fill{transition:none!important}
  .mem .celebrate,.mem .celebrate *{animation:none!important;transition:none!important}
}
.mem .guided-progress{display:flex;flex-direction:column;gap:8px}
.mem .guided-progress .count{font:600 15px/1.3 var(--sans)}
.mem #guided-hits{display:flex;flex-direction:column;gap:6px}
.mem #guided-hits button{width:100%;justify-content:flex-start;text-align:left;min-height:44px}
.mem #guided-hits button .meta{display:block;font:500 13px/1.3 var(--sans);opacity:.75;margin-top:2px}
.mem .toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:40;max-width:min(92vw,420px);padding:12px 14px;border-radius:16px;border:1px solid var(--line);background:#1a1815;box-shadow:0 8px 28px rgba(0,0,0,.35);display:none;gap:10px;align-items:center;flex-wrap:wrap}
.mem .toast.is-on{display:flex}
.mem .toast[hidden]{display:none!important}
`;

function shell(title, active, body, stamp) {
  return chrome(active, `<style>${CSS}</style><main id="main" tabindex="-1" class="wrap mem">${body}</main>`, title, stamp, "", true);
}

export function renderCollection(stamp, opts = {}) {
  const check = opts.collectionCheck === true
    ? `<p><a class="tap" href="/collection-check">Collection check</a></p>`
    : "";
  const body = `<h1>My collection</h1>
<p>Sign-in is optional. Saves on this device stay here until you sign in, then they join the account.</p>
<p class="muted">Pick one goal. Your score and Morning Brief follow it. Singles keep a condition. Sealed items do not. Totals use TCGplayer market price and the date on each line.</p>
${check}
<section id="onboard" class="onboard" aria-labelledby="onboard-h" data-onboard="1" hidden>
<h2 id="onboard-h">Add 3 cards you own</h2>
<p class="muted">Under a minute. Skip any time. Prices use TCGplayer market on file.</p>
<div class="guided-progress" aria-labelledby="guided-count">
<p id="guided-count" class="count" role="status" aria-live="polite">0 of 3</p>
<div class="progress-rail" aria-hidden="true"><div id="guided-fill" class="progress-fill" style="width:0%"></div></div>
</div>
<label for="guided-q">Find a card you own<input id="guided-q" name="guided-q" autocomplete="off" placeholder="Search by name" aria-autocomplete="list" aria-controls="guided-hits" aria-describedby="guided-hint"></label>
<p id="guided-hint" class="muted">Suggestions use popular cards and ones you opened recently.</p>
<div id="guided-hits" role="listbox" aria-label="Card suggestions"></div>
<p>
<button type="button" class="tap" id="sample-load">Try a sample collection</button>
<button type="button" class="quiet" id="onboard-skip">Skip guide</button>
</p>
<p id="onboard-note" class="muted" role="status" aria-live="polite"></p>
</section>
<div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
<section class="rowcard" aria-labelledby="goal-h">
<h2 id="goal-h">Collection goal</h2>
<p class="muted">One choice. Change it any time.</p>
<div class="goal-row" role="group" aria-label="Collection goal">
<button type="button" data-goal="collecting" aria-pressed="false">Collecting</button>
<button type="button" data-goal="selling" aria-pressed="false">Selling</button>
<button type="button" data-goal="growth" aria-pressed="false">Growth</button>
</div>
<p id="goal-note" class="muted"></p>
<p id="score-line"><span class="muted">Collection Score</span> <span id="score" class="score-pill" aria-live="polite">-</span> <span id="brief-streak" class="streak" hidden></span></p>
</section>
<form id="add-form" class="rowcard" aria-labelledby="add-h">
<h2 id="add-h">Add something</h2>
<p class="muted">Search by name. Tap a hit, then Add.</p>
<label for="q">Find a card or sealed item<input id="q" name="q" autocomplete="off" placeholder="Name or product id" aria-autocomplete="list" aria-controls="hits"></label>
<div id="hits" role="listbox" aria-label="Search hits"></div>
<div class="grid2">
<label for="kind">Kind<select id="kind" name="kind"><option value="single">Single</option><option value="sealed">Sealed</option></select></label>
<label id="cond-label" for="cond">Condition<select id="cond" name="condition"><option>NM</option><option>LP</option><option>MP</option><option>HP</option><option>DMG</option></select></label>
<label for="qty">Quantity<input id="qty" name="qty" inputmode="numeric" value="1"></label>
</div>
<button type="submit">Add</button>
<p id="add-note" class="muted" role="status"></p>
<p class="empty-cta"><button type="button" class="tap" id="empty-sample">Try a sample collection</button> <a class="tap quiet" href="/sets">Browse sets</a> <a class="tap quiet" href="/search">Search the catalogue</a></p>
</form>
<section id="brief" class="rowcard" aria-labelledby="brief-h">
<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap"><h2 id="brief-h" style="margin:0">Morning Brief</h2></div>
<p class="muted">What changed for your goal. Pin or hide a section. Source and date stay on each number.</p>
<div id="brief-body" aria-live="polite"><p class="muted">Add your first card above to open your Morning Brief.</p><p class="empty-cta"><a class="tap" href="#add-form">Add a card</a> <a class="tap quiet" href="/sets">Or browse a set</a></p></div>
</section>
<section id="focus-set" class="rowcard" aria-labelledby="focus-h" hidden>
<h2 id="focus-h">This set</h2>
<p id="focus-note" class="muted"></p>
<div id="focus-celebrate" class="celebrate" hidden>Set complete. Nice work.</div>
<div class="progress" id="focus-progress" hidden aria-hidden="true"><span id="focus-progress-bar"></span></div>
<div id="focus-body"><p class="muted">Open a set and tap My missing cards to land here.</p></div>
<p><a class="tap quiet" id="focus-back" href="/sets">Back to sets</a> <button type="button" class="quiet" id="focus-clear">Clear set focus</button></p>
</section>
<section id="panel" class="rowcard" aria-labelledby="panel-h">
<h2 id="panel-h">For your goal</h2>
<div id="panel-body"><p class="muted">Your collecting, selling, or growth view lands here once you add items.</p><p class="empty-cta"><a class="tap quiet" href="#add-form">Add a card</a></p></div>
</section>
<details id="brief-email" class="rowcard brief-email">
<summary>Email digest</summary>
<p class="muted">Get the Morning Brief by email. Digests are not sending yet. Save your address and we will use it when they go live.</p>
<label class="switch"><input id="brief-email-on" type="checkbox"> Email me the Morning Brief</label>
<label>Email<input id="brief-email-addr" type="email" autocomplete="email" maxlength="120" placeholder="you@email.com"></label>
<button type="button" id="brief-email-save">Save email preference</button>
<p id="brief-email-note" class="muted"></p>
</details>
<details id="import" class="rowcard" aria-labelledby="import-h">
<summary id="import-h">Import a CSV</summary>
<p class="muted">Upload a file with product ids, or names and sets. Preview first. Nothing saves until you confirm.</p>
<label>CSV file<input id="csv-file" type="file" accept=".csv,text/csv"></label>
<textarea id="csv-text" rows="4" placeholder="id,name,set,qty,condition,kind" aria-label="CSV text"></textarea>
<button type="button" id="csv-preview">Preview import</button>
<p id="csv-note" class="muted"></p>
<div id="csv-preview-box"></div>
<button type="button" id="csv-confirm" hidden>Save previewed rows</button>
</details>
<div id="skel" class="skel" aria-hidden="true"></div>
<p id="total" aria-live="polite"></p>
<p id="windows"></p>
<section id="empty-cta" class="empty-cta" hidden>
<h2>Nothing saved yet</h2>
<p class="muted">Try a sample, search for a card you own, or import a CSV. Your Morning Brief stays empty until the first save.</p>
<p>
<button type="button" class="tap" id="empty-sample">Try a sample collection</button>
<a class="tap quiet" href="/sets">Browse sets</a>
</p>
</section>
<div id="celebrate" class="celebrate" role="status" aria-live="polite"></div>
<h2>Top movers</h2>
<div id="movers"></div>
<h2>Saved</h2>
<div id="saved"></div>
<script>
${CLIENT}
</script>`;
  return shell("My collection", "My collection", body, stamp);
}

export function renderAlerts(stamp) {
  const body = `<h1>Alert settings</h1>
<p>Set the number to cross, and whether the note should fire above or below it. Premium gets the Discord DM. Everyone else can still save 25.</p>
<form id="prefs" class="rowcard">
<label class="switch"><input id="pause" type="checkbox"> Pause all alerts</label>
<div class="grid2">
<label>Quiet from<input id="q0" type="time" value=""></label>
<label>Quiet until<input id="q1" type="time" value=""></label>
</div>
<button type="submit">Save settings</button>
<p id="pref-note" class="muted"></p>
</form>
<p><a class="tap quiet" href="/auth/discord?next=/alerts">Sign in with Discord</a></p>
<div id="skel" class="skel" aria-hidden="true"></div>
<div id="rows"></div>
<script>
${ALERT_JS}
</script>`;
  return shell("Alerts", "Alerts", body, stamp);
}

export function renderAccount(stamp) {
  const body = `<h1>Account</h1>
<p>Catch'em stores your Discord id, the name and avatar Discord sends, and whether the server role says Premium. The watchlist, collection, and alert settings stay on the account when you are signed in, and on this device when you are not.</p>
<p><a class="tap" href="/api/me/export">Export my data</a></p>
<p><button type="button" id="ask-delete" class="quiet">Delete my account</button></p>
<form id="delete-form" hidden>
<p>This removes the watchlist, collection, and alert settings stored for this sign-in. It does not close the Discord account.</p>
<button type="submit">Delete my account now</button>
</form>
<p id="acct-note" class="muted"></p>
<p><a class="tap quiet" href="/auth/logout?next=/feed">Sign out</a></p>
<script>
var ask=document.getElementById("ask-delete");
var form=document.getElementById("delete-form");
ask.onclick=function(){ form.hidden=false; };
form.onsubmit=function(ev){
  ev.preventDefault();
  fetch("/api/me",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"delete"})})
    .then(function(res){ return res.json().then(function(j){ return {ok:res.ok,j:j}; }); })
    .then(function(res){
      document.getElementById("acct-note").textContent=res.ok?"Account data deleted.":(res.j.error||"Could not delete.");
      if(res.ok){ try { localStorage.removeItem("catchem-watch"); localStorage.removeItem("catchem-collection"); } catch(err) {} }
    })
    .catch(function(){ document.getElementById("acct-note").textContent="Could not delete."; });
};
</script>`;
  return shell("Account", "Account", body, stamp);
}

const CLIENT = `
var MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function dayLabel(iso){ var m=/^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(String(iso||"")); if(!m) return ""; return MONTHS[Number(m[2])-1]+" "+Number(m[3]); }
function money(n){ return !(Number(n)>0)?"":"$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){ if(c==="&") return "&"+"amp;"; if(c==="<") return "&"+"lt;"; if(c===">") return "&"+"gt;"; if(c==='"') return "&"+"quot;"; return "&"+"#39;"; }); }
function signedIn(){ return fetch("/api/session").then(function(r){ return r.json(); }).catch(function(){ return {signedIn:false}; }); }
function localRows(){ try { var cur=JSON.parse(localStorage.getItem("catchem-collection")||"[]"); return Array.isArray(cur)?cur:[]; } catch(err){ return []; } }
function saveLocal(rows){ try { localStorage.setItem("catchem-collection", JSON.stringify(rows)); } catch(err) {} }
function snapRows(){ try { var cur=JSON.parse(localStorage.getItem("catchem-collection-snap")||"null"); return cur && Array.isArray(cur.rows)?cur.rows:[]; } catch(err){ return []; } }
function saveSnap(rows){ try { localStorage.setItem("catchem-collection-snap", JSON.stringify({ at:new Date().toISOString().slice(0,10), rows:rows })); } catch(err) {} }
function loadGoal(){ try { return String(localStorage.getItem("catchem-collection-goal")||""); } catch(err){ return ""; } }
function saveGoal(g){ try { localStorage.setItem("catchem-collection-goal", g); } catch(err) {} }
function loadBriefPrefs(){ try { var cur=JSON.parse(localStorage.getItem("catchem-brief-prefs")||"{}"); return { pinned:Array.isArray(cur.pinned)?cur.pinned:[], hidden:Array.isArray(cur.hidden)?cur.hidden:[] }; } catch(err){ return { pinned:[], hidden:[] }; } }
function saveBriefPrefs(p){ try { localStorage.setItem("catchem-brief-prefs", JSON.stringify(p||{pinned:[],hidden:[]})); } catch(err) {} }
function todayStamp(){ try { return new Date().toISOString().slice(0,10); } catch(err){ return ""; } }
function loadBriefStreak(){
  try {
    var cur=JSON.parse(localStorage.getItem("catchem-brief-streak")||"null");
    if(!cur || typeof cur!=="object") return { count:0, last:"" };
    return { count:Number(cur.count)||0, last:String(cur.last||"") };
  } catch(err){ return { count:0, last:"" }; }
}
function touchBriefStreak(){
  var today=todayStamp();
  if(!today) return { count:0, last:"" };
  var cur=loadBriefStreak();
  if(cur.last===today) return cur;
  var y=new Date(today+"T12:00:00Z");
  y.setUTCDate(y.getUTCDate()-1);
  var yest=y.toISOString().slice(0,10);
  var next={ count:(cur.last===yest?(cur.count||0)+1:1), last:today };
  try { localStorage.setItem("catchem-brief-streak", JSON.stringify(next)); } catch(err) {}
  return next;
}
function paintBriefStreak(){
  var el=document.getElementById("brief-streak");
  if(!el) return;
  var cur=touchBriefStreak();
  if(!(cur.count>0)){ el.hidden=true; el.textContent=""; return; }
  el.hidden=false;
  el.textContent=cur.count===1?"Brief opened today":("Brief streak · "+cur.count+" days");
}
function loadViews(){ try { var cur=JSON.parse(localStorage.getItem("catchem-views")||"{}"); return cur && typeof cur==="object"?cur:{}; } catch(err){ return {}; } }
function bumpView(id){ if(!id) return; var v=loadViews(); v[id]=(Number(v[id])||0)+1; try { localStorage.setItem("catchem-views", JSON.stringify(v)); } catch(err) {} }
function sourceLine(row){ var when=dayLabel(row.asOf); return "TCGplayer market price"+(when?", "+when:"")+(row.kind==="single"&&row.condition?", "+row.condition:""); }
function windowLine(label, block){
  if(!block || !block.n || !(block.base>0)) return label+": not on file";
  var pct=block.delta/block.base*100;
  var shown=(pct>0?"+":"")+pct.toFixed(1)+"%";
  return label+": "+shown+" on "+money(block.base)+" that has this window";
}
function setGoalButtons(goal){
  document.querySelectorAll("[data-goal]").forEach(function(btn){
    btn.setAttribute("aria-pressed", btn.getAttribute("data-goal")===goal?"true":"false");
  });
  var note={ collecting:"Collecting tracks master sets, gaps, and cost to finish.", selling:"Selling ranks liquidity and demand, with cashout up front.", growth:"Growth leads with concentration risk and reads on items you own." };
  document.getElementById("goal-note").textContent=note[goal]||"";
}
function rowLink(row){
  if(!row) return "";
  var href=row.href||"#";
  return "<a href=\\""+esc(href)+"\\" data-view=\\""+esc(row.id||"")+"\\">"+esc(row.name||row.id||"")+"</a>";
}
function paintBrief(brief){
  paintBriefStreak();
  var box=document.getElementById("brief-body");
  if(!brief || !brief.sections || !brief.sections.length){ box.innerHTML="<p class=\\"muted\\">Add your first card above to open your Morning Brief.</p><p class=\\"empty-cta\\"><a class=\\"tap\\" href=\\"#add-form\\">Add a card</a> <a class=\\"tap quiet\\" href=\\"/sets\\">Or browse a set</a></p>"; return; }
  var prefs=loadBriefPrefs();
  box.innerHTML="";
  brief.sections.forEach(function(sec){
    var card=document.createElement("article");
    card.className="brief-sec";
    var pinOn=prefs.pinned.indexOf(sec.id)>=0;
    var tools="<div><button type=\\"button\\" class=\\"quiet\\" data-pin=\\""+esc(sec.id)+"\\" aria-label=\\""+(pinOn?"Unpin ":"Pin ")+esc(sec.title)+"\\">"+(pinOn?"Unpin":"Pin")+"</button> <button type=\\"button\\" class=\\"quiet\\" data-hide=\\""+esc(sec.id)+"\\" aria-label=\\"Hide "+esc(sec.title)+"\\">Hide</button></div>";
    var body="";
    if(sec.id==="moved"){
      body=(sec.rows&&sec.rows.length)?sec.rows.map(function(r){ return "<p>"+rowLink(r)+": "+esc(money(r.from))+" to "+esc(money(r.to))+" ("+(r.pct>0?"+":"")+r.pct+"%). "+esc(r.source)+(r.asOf?", "+dayLabel(r.asOf):"")+".</p>"; }).join(""):("<p class=\\"muted\\">"+esc(sec.empty)+"</p>");
    } else if(sec.id==="gaps" || sec.id==="cost"){
      var c=sec.closest;
      body=c?("<p>"+esc(c.name)+": "+c.have+" of "+c.total+" ("+Math.round(c.pct*100)+"%). Cost to finish "+esc(money(c.cost)||"not on file")+" across "+c.costPriced+" priced gaps. Source "+esc(c.source||"TCGplayer market")+(c.asOf?", "+dayLabel(c.asOf):"")+".</p>"):("<p class=\\"muted\\">"+esc(sec.empty)+"</p>");
    } else if(sec.id==="cheapest" || sec.id==="rarest"){
      body=(sec.rows&&sec.rows.length)?("<p class=\\"muted\\">"+esc(sec.setName||"")+(sec.asOf?", "+dayLabel(sec.asOf):"")+".</p>"+sec.rows.map(function(r){ return "<p>"+rowLink(r)+(r.printing?" · "+esc(r.printing):"")+": "+esc(money(r.price))+"</p>"; }).join("")):("<p class=\\"muted\\">"+esc(sec.empty)+"</p>");
    } else if(sec.id==="cashout"){
      var cash=sec.cashout;
      if(cash&&cash.gross>0){
        var tierLines=(cash.tiers||[]).map(function(t){ return "<p class=\\"muted\\">"+esc(t.label)+": keep "+Math.round(t.keep*100)+"% on "+t.n+" line"+(t.n===1?"":"s")+" ("+esc(money(t.gross))+" to "+esc(money(t.net))+").</p>"; }).join("");
        var method=cash.method||{};
        body="<p>Gross "+esc(money(cash.gross))+". Modeled net "+esc(money(cash.net))+".</p><p class=\\"muted\\">Source "+esc(method.source||"TCGplayer market price")+". Keep rates use "+esc(method.listingsSource||"listings counted")+".</p>"+tierLines+"<p class=\\"muted\\">"+esc(cash.note||"")+"</p>";
      } else body="<p class=\\"muted\\">"+esc(sec.empty)+"</p>";
    } else if(sec.id==="liquidity"){
      body=(sec.rows&&sec.rows.length)?sec.rows.map(function(r){ var lc=r.listings!=null?("Listings counted "+r.listings+(r.listingsAsOf?", "+dayLabel(r.listingsAsOf):"")):"Listings counted: not on file"; return "<p>"+rowLink(r)+". "+esc(lc)+".</p>"; }).join(""):("<p class=\\"muted\\">"+esc(sec.empty)+"</p>");
    } else if(sec.id==="demand"){
      body=(sec.rows&&sec.rows.length)?sec.rows.map(function(r){ return "<p>"+rowLink(r)+": 7D "+(r.change7>0?"+":"")+r.change7+"%. "+esc(money(r.price))+(r.asOf?", "+dayLabel(r.asOf):"")+". TCGplayer market.</p>"; }).join(""):("<p class=\\"muted\\">"+esc(sec.empty)+"</p>");
    } else if(sec.id==="risk"){
      var risk=sec.risk;
      body=risk&&risk.topShare!=null?("<p>Top item "+esc(risk.topName)+" is "+Math.round(risk.topShare*100)+"% of "+esc(money(risk.total))+". "+risk.n+" priced lines.</p>"):("<p class=\\"muted\\">"+esc(sec.empty)+"</p>");
    } else if(sec.id==="reads"){
      body=(sec.rows&&sec.rows.length)?sec.rows.map(function(r){ return "<p>"+rowLink(r)+". "+esc(r.headline||"")+(r.asOf?" ("+dayLabel(r.asOf)+")":"")+".</p>"; }).join(""):("<p class=\\"muted\\">"+esc(sec.empty)+"</p>");
    } else body="<p class=\\"muted\\">"+esc(sec.empty||"")+"</p>";
    card.innerHTML="<header><h3>"+esc(sec.title)+"</h3>"+tools+"</header>"+body;
    box.appendChild(card);
  });
  box.querySelectorAll("[data-pin]").forEach(function(btn){
    btn.onclick=function(){
      var id=btn.getAttribute("data-pin");
      var prefs=loadBriefPrefs();
      if(prefs.pinned.indexOf(id)>=0) prefs.pinned=prefs.pinned.filter(function(x){ return x!==id; });
      else { prefs.pinned=prefs.pinned.filter(function(x){ return x!==id; }); prefs.pinned.unshift(id); prefs.hidden=prefs.hidden.filter(function(x){ return x!==id; }); }
      saveBriefPrefs(prefs); refreshSmart(state.rows, state.summary);
    };
  });
  box.querySelectorAll("[data-hide]").forEach(function(btn){
    btn.onclick=function(){
      var id=btn.getAttribute("data-hide");
      var prefs=loadBriefPrefs();
      if(prefs.hidden.indexOf(id)<0) prefs.hidden.push(id);
      prefs.pinned=prefs.pinned.filter(function(x){ return x!==id; });
      saveBriefPrefs(prefs); refreshSmart(state.rows, state.summary);
    };
  });
  box.querySelectorAll("[data-view]").forEach(function(a){ a.addEventListener("click", function(){ bumpView(a.getAttribute("data-view")); }); });
}
function paintPanel(goal, panels){
  var box=document.getElementById("panel-body");
  var panelH=document.getElementById("panel-h"); if(panelH){ panelH.textContent=goal==="selling"?"Selling view":(goal==="growth"?"Growth view":"Collecting view"); } if(!panels){ box.innerHTML="<p class=\\"muted\\">Add items to fill this view.</p><p class=\\"empty-cta\\"><a class=\\"tap quiet\\" href=\\"#add-form\\">Add a card</a></p>"; return; }
  if(goal==="selling"){
    var cash=panels.selling&&panels.selling.cashout;
    var liq=(panels.selling&&panels.selling.liquidity)||[];
    var method=cash&&cash.method?cash.method:{};
    var tierBits=(cash&&cash.tiers||[]).slice(0,4).map(function(t){ return "<p class=\\"muted\\">"+esc(t.label)+": keep "+Math.round(t.keep*100)+"%. </p>"; }).join("");
    box.innerHTML=(cash&&cash.gross>0?("<p>Cashout gross "+esc(money(cash.gross))+", modeled net "+esc(money(cash.net))+".</p><p class=\\"muted\\">Source "+esc(method.source||"TCGplayer market price")+". Method: keep rate from listings counted on sealed rows.</p>"+tierBits):"<p class=\\"muted\\">No market prices on file.</p>")+liq.slice(0,5).map(function(r){ return "<p>"+rowLink(r)+(r.listings!=null?": listings counted "+r.listings:": listings counted not on file")+".</p>"; }).join("");

  } else if(goal==="growth"){
    var risk=panels.growth&&panels.growth.risk;
    var reads=(panels.growth&&panels.growth.reads)||[];
    box.innerHTML=(risk&&risk.topShare!=null?("<p>Concentration: "+esc(risk.topName)+" is "+Math.round(risk.topShare*100)+"% of value.</p>"):"<p class=\\"muted\\">Save priced items to see risk.</p>")+(reads.length?reads.map(function(r){ return "<p>"+rowLink(r)+". "+esc(r.headline||"")+"</p>"; }).join(""):"<p class=\\"muted\\">No reads on your items today.</p>");
  } else {
    var close=panels.collecting&&panels.collecting.closest;
    var gaps=(panels.collecting&&panels.collecting.singlesGaps)||[];
    box.innerHTML=(close?("<p>"+esc(close.name)+": "+close.have+"/"+close.total+". Cost to finish "+esc(money(close.cost)||"not on file")+".</p><p class=\\"muted\\">Cheapest gap "+esc((close.cheapest[0]&&close.cheapest[0].name)||"none")+". Rarest gap "+esc((close.rarest[0]&&close.rarest[0].name)||"none")+".</p>"):"<p class=\\"muted\\">Add cards from one set to track completion.</p>")+gaps.slice(0,3).map(function(g){ return "<p>"+esc(g.name)+": "+Math.round((g.pct||0)*100)+"%.</p>"; }).join("");
  }
  box.querySelectorAll("[data-view]").forEach(function(a){ a.addEventListener("click", function(){ bumpView(a.getAttribute("data-view")); }); });
}
var state={ rows:[], summary:null, goal:loadGoal()||"collecting", setIndex:[], catalogueReads:[], focusSet:"" };
function readFocusSet(){
  try {
    var q=new URLSearchParams(location.search||"");
    var s=String(q.get("set")||"").trim().toLowerCase();
    return /^[a-z0-9-]+$/.test(s)?s:"";
  } catch(err){ return ""; }
}
state.focusSet=readFocusSet();
function paintFocus(focus){
  var sec=document.getElementById("focus-set");
  var body=document.getElementById("focus-body");
  var note=document.getElementById("focus-note");
  var back=document.getElementById("focus-back");
  if(!sec||!body) return;
  if(!state.focusSet){ sec.hidden=true; body.innerHTML=""; if(note) note.textContent=""; var cele0=document.getElementById("focus-celebrate"); if(cele0) cele0.hidden=true; var pw=document.getElementById("focus-progress"); if(pw){ pw.hidden=true; } return; }
  sec.hidden=false;
  if(back) back.href="/sets/"+encodeURIComponent(state.focusSet);
  if(!focus){
    if(note) note.textContent="Loading "+state.focusSet+" gaps.";
    body.innerHTML="<p class=\\"muted\\">Loading set gaps.</p>";
    return;
  }
  if(note) note.textContent=(focus.name||state.focusSet)+" · source "+(focus.source||"TCGplayer market")+(focus.asOf?", "+dayLabel(focus.asOf):"")+".";
  var g=focus.singles||{};
  var pctNum=g.pct==null?null:Math.round(g.pct*1000)/10;
  var pct=pctNum==null?"-":pctNum+"%";
  var barWrap=document.getElementById("focus-progress");
  var bar=document.getElementById("focus-progress-bar");
  var cele=document.getElementById("focus-celebrate");
  if(barWrap&&bar){
    if(g.total>0 && pctNum!=null){
      barWrap.hidden=false; barWrap.setAttribute("aria-hidden","false");
      bar.style.width=Math.max(0, Math.min(100, pctNum))+"%";
    } else { barWrap.hidden=true; bar.style.width="0%"; }
  }
  if(cele){
    var done=g.total>0 && g.missing===0;
    cele.hidden=!done;
  }
  var lines=[];
  lines.push("<p><b>Completion</b> "+(g.have||0)+" of "+(g.total||0)+" ("+pct+"). Missing "+(g.missing||0)+".</p>");
  lines.push("<p><b>Cost to finish</b> "+esc(money(g.cost)||"not on file")+" across "+(g.costPriced||0)+" priced gaps.</p>");
  var cheap=(g.cheapest||[]).slice(0,5);
  var rare=(g.rarest||[]).slice(0,5);
  lines.push("<h3>Cheapest missing</h3>"+(cheap.length?cheap.map(function(r){ return "<p>"+rowLink(r)+(r.printing?" · "+esc(r.printing):"")+": "+esc(money(r.price))+"</p>"; }).join(""):"<p class=\\"muted\\">No priced gaps on file.</p>"));
  lines.push("<h3>Rarest missing</h3>"+(rare.length?rare.map(function(r){ return "<p>"+rowLink(r)+(r.printing?" · "+esc(r.printing):"")+": "+esc(money(r.price))+"</p>"; }).join(""):"<p class=\\"muted\\">No priced gaps on file.</p>"));
  if(focus.sealed && focus.sealed.total){
    var s=focus.sealed;
    lines.push("<p class=\\"muted\\">Sealed in this set: "+s.have+" of "+s.total+". Cost to finish "+esc(money(s.cost)||"not on file")+".</p>");
  }
  body.innerHTML=lines.join("");
  body.querySelectorAll("[data-view]").forEach(function(a){ a.addEventListener("click", function(){ bumpView(a.getAttribute("data-view")); }); });
}
function clearFocus(){
  state.focusSet="";
  try {
    var url=new URL(location.href);
    url.searchParams.delete("set");
    history.replaceState({}, "", url.pathname+(url.search||""));
  } catch(err){}
  paintFocus(null);
  refreshSmart(state.rows||[], state.summary||summarise(state.rows||[]));
}
function summarise(rows){
  var value=0, windows={d7:{base:0,delta:0,n:0},d30:{base:0,delta:0,n:0},d90:{base:0,delta:0,n:0}};
  rows.forEach(function(row){
    if(!(Number(row.price)>0)||!(Number(row.qty)>0)) return;
    var line=Number(row.price)*Number(row.qty); value+=line;
    [["d7","change7"],["d30","change30"],["d90","change90"]].forEach(function(pair){
      var pct=Number(row[pair[1]]);
      if(!Number.isFinite(pct)) return;
      windows[pair[0]].n+=1; windows[pair[0]].base+=line; windows[pair[0]].delta+=line*(pct/100);
    });
  });
  var top=rows.filter(function(row){ return Number.isFinite(Number(row.change7)) && Number(row.price)>0; }).slice().sort(function(a,b){ return Math.abs(b.change7)-Math.abs(a.change7); }).slice(0,5);
  return { value:Math.round(value*100)/100, n:rows.length, windows:windows, top:top };
}
function uniqueSlugs(rows){
  var out=[], seen={};
  rows.forEach(function(r){ var s=String(r.setSlug||""); if(s&&!seen[s]){ seen[s]=1; out.push(s); } });
  return out.slice(0,8);
}
function resolveSlug(slug, name){
  if(!slug && !name) return "";
  var sets=state.setIndex||[];
  if(slug && sets.some(function(s){ return s.slug===slug; })) return slug;
  var want=String(name||"").toLowerCase();
  for(var i=0;i<sets.length;i++){
    var n=String(sets[i].name||"").toLowerCase();
    if(want && (n===want || n.indexOf(want)>=0 || want.indexOf(n.replace(/^[^:]+:\\s*/,""))>=0)) return sets[i].slug;
  }
  return slug||"";
}
function loadSetDocs(rows){
  var slugs=uniqueSlugs(rows).map(function(s){
    var row=rows.filter(function(r){ return r.setSlug===s; })[0];
    return resolveSlug(s, row&&row.set);
  }).filter(Boolean);
  if(state.focusSet) slugs.unshift(state.focusSet);
  var uniq=[]; var seen={}; slugs.forEach(function(s){ if(!seen[s]){ seen[s]=1; uniq.push(s); } });
  return Promise.all(uniq.slice(0,8).map(function(slug){
    return fetch("/data/sets/"+encodeURIComponent(slug)+".json").then(function(r){ return r.ok?r.json():null; }).catch(function(){ return null; });
  })).then(function(docs){ return docs.filter(Boolean); });
}
function refreshSmart(rows, summary){
  state.rows=rows; state.summary=summary;
  var goal=state.goal||"collecting";
  setGoalButtons(goal);
  loadSetDocs(rows).then(function(setDocs){
    var prefs=loadBriefPrefs();
    return fetch("/api/collection/smart",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({
        holdings:rows,
        prevHoldings:snapRows(),
        setDocs:setDocs,
        reads:state.catalogueReads,
        views:loadViews(),
        goal:goal,
        briefPrefs:prefs,
        focusSet:state.focusSet||""
      })
    }).then(function(r){ return r.json(); });
  }).then(function(smart){
    if(!smart||!smart.ok) return;
    state.goal=smart.goal||goal;
    setGoalButtons(state.goal);
    document.getElementById("score").textContent=String(smart.score&&smart.score.score!=null?smart.score.score:"-");
    paintBrief(smart.brief);
    paintPanel(state.goal, smart.panels);
    paintFocus(smart.focusSet||(smart.panels&&smart.panels.collecting&&smart.panels.collecting.focus)||null);
  }).catch(function(){});
}
function paint(rows, summary){
  document.getElementById("skel").hidden=true;
  var total=document.getElementById("total");
  var value=summary && summary.value>0 ? money(summary.value) : "not on file";
  total.textContent="Total "+value+" across "+((summary&&summary.n)||rows.length)+" items.";
  var w=summary&&summary.windows||{};
  document.getElementById("windows").textContent=[windowLine("7D", w.d7), windowLine("30D", w.d30), windowLine("90D", w.d90)].join(". ")+".";
  var movers=document.getElementById("movers");
  movers.innerHTML="";
  (summary&&summary.top||[]).forEach(function(row){
    var card=document.createElement("article");
    card.className="rowcard";
    var pct=(row.change7>0?"+":"")+row.change7+"%";
    card.innerHTML="<h3>"+esc(row.name)+"</h3><p>7D "+esc(pct)+". "+esc(money(row.price))+"</p><p class=\\"muted\\">"+esc(sourceLine(row))+"</p>";
    movers.appendChild(card);
  });
  if(!(summary&&summary.top&&summary.top.length)) movers.innerHTML="<p class=\\"muted\\">No 7-day move on file.</p>";
  var box=document.getElementById("saved");
  box.innerHTML="";
  var empty=document.getElementById("empty-cta");
  if(empty) empty.hidden=!!rows.length;
  syncOnboard(rows);
  if(!rows.length) box.innerHTML="<p class=\\"muted\\">Nothing saved yet. Use the guide above or add one card.</p>";
  rows.forEach(function(row){
    var card=document.createElement("article");
    card.className="rowcard";
    var cond=row.kind==="sealed"?"":(" "+(row.condition||"NM"));
    var listed=row.kind==="sealed" ? (row.listings!=null && row.listingsAsOf ? "Listings counted "+row.listings+", "+dayLabel(row.listingsAsOf)+"." : "Listings counted: not on file.") : "";
    card.innerHTML="<h3><a href=\\""+esc(row.href||"#")+"\\" data-view=\\""+esc(row.id)+"\\">"+esc(row.name)+"</a></h3><p>"+esc(money(row.price)||"No market price on file")+" x "+esc(row.qty)+esc(cond)+"</p><p class=\\"muted\\">"+esc(sourceLine(row))+"</p>"+(listed?"<p class=\\"muted\\">"+esc(listed)+"</p>":"")+"<button type=\\"button\\" class=\\"quiet\\" data-id=\\""+esc(row.id)+"\\">Remove</button>";
    card.querySelector("button").onclick=function(){ remove(row.id); };
    card.querySelector("[data-view]").addEventListener("click", function(){ bumpView(row.id); });
    box.appendChild(card);
  });
  refreshSmart(rows, summary);
  saveSnap(rows);
}
function remove(id){
  signedIn().then(function(view){
    if(view && view.signedIn){
      fetch("/api/me",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"remove",id:id})})
        .then(function(r){ return r.json(); })
        .then(function(j){ if(j&&j.collection) paint(j.collection, j.summary); });
      return;
    }
    var rows=localRows().filter(function(row){ return row.id!==id; });
    saveLocal(rows); paint(rows, summarise(rows));
  });
}
function persistGoal(goal){
  state.goal=goal; saveGoal(goal); setGoalButtons(goal);
  signedIn().then(function(view){
    if(!(view&&view.signedIn)) return;
    var prefs=loadBriefPrefs();
    fetch("/api/me",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"prefs",goal:goal,briefPinned:prefs.pinned,briefHidden:prefs.hidden})}).catch(function(){});
  });
  refreshSmart(state.rows||[], state.summary||summarise(state.rows||[]));
}
document.querySelectorAll("[data-goal]").forEach(function(btn){
  btn.onclick=function(){ persistGoal(btn.getAttribute("data-goal")); };
});
var clearBtn=document.getElementById("focus-clear");
if(clearBtn) clearBtn.onclick=function(){ clearFocus(); };
if(state.focusSet){
  state.goal=state.goal||"collecting";
  if(!loadGoal()) { state.goal="collecting"; saveGoal("collecting"); }
  paintFocus(null);
}

var importPreview=null;
function paintImportPreview(preview){
  var box=document.getElementById("csv-preview-box");
  var note=document.getElementById("csv-note");
  var confirm=document.getElementById("csv-confirm");
  importPreview=preview;
  if(!preview||!preview.ok){
    note.textContent=(preview&&preview.error)||"Preview failed.";
    box.innerHTML="";
    confirm.hidden=true;
    return;
  }
  note.textContent="Matched "+preview.accepted+" · skipped "+preview.rejected+(preview.truncated?" · first 500 rows only":"")+". "+(preview.note||"");
  box.innerHTML=(preview.rows||[]).slice(0,40).map(function(row){
    if(row.ok){
      var h=row.holding;
      return "<p>"+esc(h.name)+(h.setSlug?" · "+esc(h.setSlug):"")+" · "+esc(h.kind)+" x "+esc(h.qty)+(h.condition?" · "+esc(h.condition):"")+"</p>";
    }
    return "<p class=\\"muted\\">Skip: "+esc((row.input&& (row.input.name||row.input.id))||"?")+" ("+esc(row.reason)+")</p>";
  }).join("")+(preview.rows.length>40?"<p class=\\"muted\\">Showing first 40 preview lines.</p>":"");
  confirm.hidden=!(preview.accepted>0);
}
document.getElementById("csv-file").onchange=function(ev){
  var file=ev.target.files&&ev.target.files[0];
  if(!file) return;
  var reader=new FileReader();
  reader.onload=function(){ document.getElementById("csv-text").value=String(reader.result||""); };
  reader.readAsText(file);
};
document.getElementById("csv-preview").onclick=function(){
  var text=document.getElementById("csv-text").value||"";
  document.getElementById("csv-note").textContent="Building preview.";
  fetch("/api/collection/import",{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({ action:"preview", text:text, catalogue:catalogue })
  }).then(function(r){ return r.json(); }).then(paintImportPreview).catch(function(){ paintImportPreview({ ok:false, error:"Preview failed." }); });
};
document.getElementById("csv-confirm").onclick=function(){
  if(!importPreview||!(importPreview.accepted>0)) return;
  fetch("/api/collection/import",{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({ action:"holdings", preview:importPreview })
  }).then(function(r){ return r.json(); }).then(function(j){
    var rows=(j&&j.holdings)||[];
    if(!rows.length){ document.getElementById("csv-note").textContent="Nothing to save."; return; }
    signedIn().then(function(view){
      if(view&&view.signedIn){
        fetch("/api/me",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"merge",rows:rows})})
          .then(function(r){ return r.json(); })
          .then(function(me){
            document.getElementById("csv-note").textContent="Saved "+rows.length+" rows to the account.";
            if(me&&me.collection) paint(me.collection, me.summary||summarise(me.collection));
            document.getElementById("csv-confirm").hidden=true;
          });
        return;
      }
      var local=localRows();
      var byId={}; local.forEach(function(r){ byId[r.id]=r; });
      rows.forEach(function(r){ byId[r.id]=r; });
      var next=Object.keys(byId).map(function(k){ return byId[k]; });
      saveLocal(next); paint(next, summarise(next));
      document.getElementById("csv-note").textContent="Saved "+rows.length+" rows on this device.";
      document.getElementById("csv-confirm").hidden=true;
    });
  }).catch(function(){ document.getElementById("csv-note").textContent="Save failed."; });
};
function loadBriefEmailLocal(){
  try { return JSON.parse(localStorage.getItem("catchem-brief-email")||"{}"); } catch(err){ return {}; }
}
function saveBriefEmailLocal(p){ try { localStorage.setItem("catchem-brief-email", JSON.stringify(p||{})); } catch(err) {} }
function paintBriefEmailForm(prefs, armed){
  var on=document.getElementById("brief-email-on");
  var addr=document.getElementById("brief-email-addr");
  var note=document.getElementById("brief-email-note");
  if(!on||!addr) return;
  on.checked=!!(prefs&&prefs.optIn);
  if(prefs&&prefs.email) addr.value=prefs.email;
  note.textContent=armed?"Digests can send when you are opted in.":"Digests are not sending yet. Your preference is saved for when they go live.";
}
document.getElementById("brief-email-save").onclick=function(){
  var prefs={ optIn:document.getElementById("brief-email-on").checked, email:document.getElementById("brief-email-addr").value, goal:state.goal||"" };
  saveBriefEmailLocal(prefs);
  signedIn().then(function(view){
    if(!(view&&view.signedIn)){
      document.getElementById("brief-email-note").textContent="Saved on this device. Sign in to keep it on the account.";
      return;
    }
    fetch("/api/me",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"brief-email",optIn:prefs.optIn,email:prefs.email,goal:prefs.goal})})
      .then(function(r){ return r.json().then(function(j){ return {ok:r.ok,j:j}; }); })
      .then(function(res){ document.getElementById("brief-email-note").textContent=res.ok?"Email preference saved on the account.":(res.j.error||"Not saved."); })
      .catch(function(){ document.getElementById("brief-email-note").textContent="Not saved."; });
  });
};
paintBriefEmailForm(loadBriefEmailLocal(), false);
fetch("/api/collection/brief-email").then(function(r){ return r.ok?r.json():null; }).then(function(j){
  if(!j) return;
  if(j.prefs) paintBriefEmailForm(j.prefs, !!j.armed);
  else paintBriefEmailForm(loadBriefEmailLocal(), !!j.armed);
}).catch(function(){});

var catalogue=[];
fetch("/data/feed/catalogue.json").then(function(r){ return r.ok?r.json():null; }).then(function(doc){
  var seen={};
  Object.keys((doc&&doc.cards)||{}).forEach(function(key){
    var row=doc.cards[key];
    if(!row||!row.sku||seen[row.sku]) return;
    seen[row.sku]=1; catalogue.push(row);
  });
  state.catalogueReads=catalogue.filter(function(row){ return row && row.headline; }).map(function(row){
    return { id:row.sku, name:row.name, headline:row.headline, asOf:row.asOf||(doc&&doc.asOf)||"", source:"Catch'em read", href:row.kind==="sealed"?("/p/"+row.sku):("/c/"+row.sku) };
  });
  paintGuidedHits("");
}).catch(function(){});
fetch("/data/sets.json").then(function(r){ return r.ok?r.json():null; }).then(function(doc){
  state.setIndex=Array.isArray(doc&&doc.sets)?doc.sets:[];
}).catch(function(){});
document.getElementById("kind").onchange=function(){
  document.getElementById("cond-label").hidden=document.getElementById("kind").value==="sealed";
};
document.getElementById("q").oninput=function(){
  var q=document.getElementById("q").value.trim().toLowerCase();
  var box=document.getElementById("hits");
  box.innerHTML="";
  if(q.length<2) return;
  catalogue.filter(function(row){ return String(row.name||"").toLowerCase().indexOf(q)>=0 || String(row.sku||"")===q; }).slice(0,6).forEach(function(row){
    var b=document.createElement("button");
    b.type="button"; b.className="quiet"; b.setAttribute("role","option"); b.setAttribute("aria-label",(row.name||"")+" "+(money(row.price)||""));
    b.textContent=row.name+" "+(money(row.price)||"");
    b.onclick=function(){ document.getElementById("q").dataset.sku=row.sku; document.getElementById("q").dataset.set=row.set||""; document.getElementById("q").dataset.setSlug=row.setSlug||""; document.getElementById("q").value=row.name; document.getElementById("kind").value=row.kind==="sealed"?"sealed":"single"; document.getElementById("kind").onchange(); box.innerHTML=""; };
    box.appendChild(b);
  });
};
document.getElementById("add-form").onsubmit=function(ev){
  ev.preventDefault();
  var q=document.getElementById("q");
  var sku=q.dataset.sku||"";
  if(!/^tcgcsv-\\d+$/.test(sku)) sku=/^tcgcsv-\\d+$/.test(q.value.trim())?q.value.trim():"";
  var found=catalogue.filter(function(row){ return row.sku===sku; })[0]||null;
  if(!found && !sku){ document.getElementById("add-note").textContent="Pick an item from the list."; return; }
  var kind=document.getElementById("kind").value==="sealed"?"sealed":"single";
  var row={
    sku:sku, id:sku, name:found?found.name:q.value.trim(), kind:kind,
    condition:kind==="sealed"?null:document.getElementById("cond").value,
    qty:document.getElementById("qty").value, price:found?found.price:null, asOf:found?found.asOf:"",
    change7:found?found.change7:null, change30:found?found.change30:null, change90:found?found.change90:null,
    set:found?found.set:(q.dataset.set||""), setSlug:found?found.setSlug:(q.dataset.setSlug||""),
    listings:found&&found.listings!=null?found.listings:null, listingsAsOf:found&&found.listingsAsOf?found.listingsAsOf:""
  };
  signedIn().then(function(view){
    if(view && view.signedIn){
      fetch("/api/me",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(Object.assign({action:"holding"}, row))})
        .then(function(r){ return r.json().then(function(j){ return {ok:r.ok,j:j}; }); })
        .then(function(res){ document.getElementById("add-note").textContent=res.ok?"Saved to the account.":(res.j.error||"Not saved."); if(res.ok) paint(res.j.collection, res.j.summary); });
      return;
    }
    var rows=localRows().filter(function(item){ return item.id!==sku; });
    rows.unshift(row); saveLocal(rows); paint(rows, summarise(rows));
    document.getElementById("add-note").textContent="Saved on this device.";
  });
};
function onboardDismissed(){ try { return localStorage.getItem("catchem-onboard")==="done"; } catch(err){ return false; } }
function setOnboardDone(){ try { localStorage.setItem("catchem-onboard","done"); } catch(err){} }
function syncOnboard(rows){
  var box=document.getElementById("onboard");
  if(!box) return;
  var n=(rows&&rows.length)||0;
  var show=!onboardDismissed() && n<3;
  box.hidden=!show;
  paintGuidedProgress(n);
  if(show) paintGuidedHits((document.getElementById("guided-q")||{}).value||"");
}
function paintGuidedProgress(n){
  var count=document.getElementById("guided-count");
  var fill=document.getElementById("guided-fill");
  var have=Math.max(0, Math.min(3, Number(n)||0));
  if(count) count.textContent=have+" of 3";
  if(fill) fill.style.width=(have/3*100)+"%";
}
function holdingFromCat(row){
  if(!row||!row.sku) return null;
  var kind=row.kind==="sealed"?"sealed":"single";
  return {
    id:row.sku, sku:row.sku, name:row.name, kind:kind,
    condition:kind==="sealed"?null:"NM", qty:1,
    price:Number(row.price)>0?Number(row.price):null, asOf:row.asOf||"",
    change7:row.change7!=null?row.change7:null, change30:row.change30!=null?row.change30:null, change90:row.change90!=null?row.change90:null,
    set:row.set||"", setSlug:row.setSlug||"",
    listings:row.listings!=null?row.listings:null, listingsAsOf:row.listingsAsOf||"",
    href:(kind==="sealed"?"/p/":"/c/")+row.sku, source:"TCGplayer market price"
  };
}
function saveHolding(row, opts){
  opts=opts||{};
  if(!row||!row.sku) return Promise.resolve(null);
  return signedIn().then(function(view){
    if(view && view.signedIn){
      return fetch("/api/me",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(Object.assign({action:"holding"}, row))})
        .then(function(r){ return r.json().then(function(j){ return {ok:r.ok,j:j}; }); })
        .then(function(res){
          if(res.ok && res.j && res.j.collection) paint(res.j.collection, res.j.summary||summarise(res.j.collection));
          return res;
        });
    }
    var rows=localRows().filter(function(item){ return item.id!==row.sku; });
    rows.unshift(row); saveLocal(rows); paint(rows, summarise(rows));
    return { ok:true, j:{ collection:rows } };
  });
}
var SAMPLE_SKUS=["tcgcsv-42402","tcgcsv-250320","tcgcsv-250332","tcgcsv-223073"];
var POPULAR_SKUS=["tcgcsv-42402","tcgcsv-250320","tcgcsv-250332","tcgcsv-223073","tcgcsv-45214","tcgcsv-85564","tcgcsv-232082","tcgcsv-47947"];
function sampleHoldings(){
  var bySku={};
  catalogue.forEach(function(row){ if(row&&row.sku) bySku[row.sku]=row; });
  var fallback=[
    {sku:"tcgcsv-42402",name:"Pikachu",kind:"single",set:"Base Set",setSlug:"base-set",price:12.5,asOf:"2026-10-28",change7:16.7},
    {sku:"tcgcsv-250320",name:"Charizard",kind:"single",set:"Celebrations: Classic Collection",setSlug:"celebrations-classic-collection",price:129.63,asOf:"2026-10-28",change7:-8.8},
    {sku:"tcgcsv-250332",name:"Umbreon Star",kind:"single",set:"Celebrations: Classic Collection",setSlug:"celebrations-classic-collection",price:73.89,asOf:"2026-10-28",change7:-3.1},
    {sku:"tcgcsv-223073",name:"Charizard VMAX (Secret)",kind:"single",set:"Champion's Path",setSlug:"champion-s-path",price:188.13,asOf:"2026-10-28",change7:-6.1}
  ];
  return SAMPLE_SKUS.map(function(sku,i){
    var hit=bySku[sku]||fallback[i];
    if(!hit) return null;
    return holdingFromCat(hit)||holdingFromCat(Object.assign({sku:sku}, hit));
  }).filter(Boolean);
}
function guidedSuggest(q){
  var query=String(q||"").trim().toLowerCase();
  var owned={};
  (state.rows||localRows()).forEach(function(r){ if(r&&r.id) owned[r.id]=1; });
  var views=loadViews();
  var scored=[];
  catalogue.forEach(function(row){
    if(!row||!row.sku||owned[row.sku]) return;
    if(row.kind==="sealed") return;
    var name=String(row.name||"").toLowerCase();
    var sku=String(row.sku||"");
    if(query){
      if(name.indexOf(query)<0 && sku!==query) return;
    }
    var score=0;
    if(POPULAR_SKUS.indexOf(sku)>=0) score+=50;
    if(Number(views[sku])>0) score+=20+Math.min(20, Number(views[sku]));
    if(Number.isFinite(Number(row.change7))) score+=Math.min(15, Math.abs(Number(row.change7))/2);
    if(Number(row.price)>0 && Number(row.price)<40) score+=5;
    if(!query && score<=0) return;
    scored.push({ row:row, score:score, name:name });
  });
  if(!query){
    scored.sort(function(a,b){ return b.score-a.score || a.name.localeCompare(b.name); });
    return scored.slice(0,6).map(function(x){ return x.row; });
  }
  scored.sort(function(a,b){ return b.score-a.score || a.name.localeCompare(b.name); });
  return scored.slice(0,6).map(function(x){ return x.row; });
}
function paintGuidedHits(q){
  var box=document.getElementById("guided-hits");
  if(!box) return;
  box.innerHTML="";
  var onboard=document.getElementById("onboard");
  if(onboard && onboard.hidden) return;
  var rows=guidedSuggest(q);
  if(!rows.length){
    box.innerHTML=q && String(q).trim().length>=2 ? "<p class=\\"muted\\">No match on file. Try another name.</p>" : "<p class=\\"muted\\">Catalogue is loading suggestions.</p>";
    return;
  }
  rows.forEach(function(row){
    var b=document.createElement("button");
    b.type="button"; b.className="quiet"; b.setAttribute("role","option");
    var price=money(row.price)||"price not on file";
    var when=dayLabel(row.asOf);
    var label=(row.name||"")+" · "+price+(when?" · "+when:"");
    b.setAttribute("aria-label","Add "+(row.name||"card")+", "+price+(when?", "+when:"")+", TCGplayer market");
    b.innerHTML="<span>"+esc(row.name||"")+"</span><span class=\\"meta\\">"+esc(price)+(when?" · "+esc(when):"")+" · TCGplayer</span>";
    b.onclick=function(){ addGuidedCard(row); };
    box.appendChild(b);
  });
}
function finishGuided(rows){
  setOnboardDone();
  syncOnboard(rows||[]);
  var note=document.getElementById("onboard-note");
  if(note) note.textContent="Three on file. Your score and Morning Brief are ready.";
  maybeCelebrate(rows||[]);
  var score=document.getElementById("score-line");
  if(score){ try { score.scrollIntoView({ behavior:(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)?"auto":"smooth", block:"nearest" }); } catch(err){} }
}
function addGuidedCard(catRow){
  var row=holdingFromCat(catRow);
  if(!row) return;
  if(!state.goal){ state.goal="collecting"; saveGoal("collecting"); }
  var note=document.getElementById("onboard-note");
  saveHolding(row).then(function(res){
    if(!(res&&res.ok)){ if(note) note.textContent="Could not save that card."; return; }
    var rows=(res.j&&res.j.collection)||localRows();
    var n=rows.length;
    paintGuidedProgress(n);
    if(note) note.textContent=n>=3 ? "Three on file." : ("Saved "+(row.name||"card")+". "+n+" of 3.");
    if(n>=3) finishGuided(rows);
    else paintGuidedHits((document.getElementById("guided-q")||{}).value||"");
  }).catch(function(){ if(note) note.textContent="Could not save that card."; });
}
function loadSample(){
  var rows=sampleHoldings();
  if(!rows.length){
    var note=document.getElementById("onboard-note");
    if(note) note.textContent="Sample is not ready yet. Search for a card you own.";
    return;
  }
  setOnboardDone();
  if(!state.goal) { state.goal="collecting"; saveGoal("collecting"); }
  signedIn().then(function(view){
    if(view&&view.signedIn){
      fetch("/api/me",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"merge",rows:rows})})
        .then(function(r){ return r.json(); })
        .then(function(me){
          var note=document.getElementById("onboard-note");
          if(note) note.textContent="Sample saved to the account. Scroll to your Morning Brief.";
          if(me&&me.collection) paint(me.collection, me.summary||summarise(me.collection));
          maybeCelebrate(me&&me.collection||rows);
        });
      return;
    }
    saveLocal(rows); paint(rows, summarise(rows));
    var note=document.getElementById("onboard-note");
    if(note) note.textContent="Sample saved on this device. Scroll to your Morning Brief.";
    maybeCelebrate(rows);
  });
}
function maybeCelebrate(rows){
  var el=document.getElementById("celebrate");
  if(!el||!(rows&&rows.length)) return;
  el.textContent="Nice. "+rows.length+" item"+(rows.length===1?"":"s")+" on file. Your Morning Brief is ready.";
  el.className="celebrate is-on";
}
var guidedQ=document.getElementById("guided-q");
if(guidedQ){
  guidedQ.oninput=function(){ paintGuidedHits(guidedQ.value); };
  guidedQ.onfocus=function(){ paintGuidedHits(guidedQ.value); };
}
var sampleBtn=document.getElementById("sample-load");
if(sampleBtn) sampleBtn.onclick=function(){ loadSample(); };
var emptySample=document.getElementById("empty-sample");
if(emptySample) emptySample.onclick=function(){ loadSample(); };
var skipBtn=document.getElementById("onboard-skip");
if(skipBtn) skipBtn.onclick=function(){ setOnboardDone(); syncOnboard(state.rows||[]); var note=document.getElementById("onboard-note"); if(note) note.textContent="Guide hidden. Add a card any time."; };
syncOnboard([]);
signedIn().then(function(view){
  if(view && view.signedIn){
    var local=localRows();
    var start=local.length?fetch("/api/me",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"merge",rows:local})}):fetch("/api/me");
    start.then(function(r){ return r.json(); }).then(function(j){
      if(j && j.prefs && j.prefs.goal){ state.goal=j.prefs.goal; saveGoal(j.prefs.goal); }
      if(j && j.prefs){ saveBriefPrefs({ pinned:j.prefs.briefPinned||[], hidden:j.prefs.briefHidden||[] }); }
      if(j && j.collection){ try { localStorage.setItem("catchem-collection","[]"); } catch(err) {} paint(j.collection, j.summary||summarise(j.collection)); }
      else document.getElementById("skel").hidden=true;
    }).catch(function(){ document.getElementById("skel").hidden=true; });
    return;
  }
  var rows=localRows(); paint(rows, summarise(rows));
});
`;

const ALERT_JS = `
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){ if(c==="&") return "&"+"amp;"; if(c==="<") return "&"+"lt;"; if(c===">") return "&"+"gt;"; if(c==='"') return "&"+"quot;"; return "&"+"#39;"; }); }
function paint(rows){
  document.getElementById("skel").hidden=true;
  var box=document.getElementById("rows");
  box.innerHTML="";
  if(!rows.length){ box.innerHTML="<p class=\\"muted\\">No alerts yet. Use Track on a feed card, or add one here after it is saved.</p>"; return; }
  rows.forEach(function(row){
    var card=document.createElement("form");
    card.className="rowcard";
    var dir=row.priceDir||(row.direction==="down"?"below":row.direction==="up"?"above":"above");
    card.innerHTML="<h2>"+esc(row.name||row.sku||row.id)+"</h2><label>Number to cross<input name=\\"price\\" inputmode=\\"decimal\\" value=\\""+esc(row.price||"")+"\\"></label><label>Direction<select name=\\"dir\\"><option value=\\"above\\""+(dir==="above"?" selected":"")+">Above</option><option value=\\"below\\""+(dir==="below"?" selected":"")+">Below</option></select></label><label>Listings counted number<input name=\\"listings\\" inputmode=\\"numeric\\" value=\\""+esc(row.listingsAt||row.listingsAbove||row.listingsBelow||"")+"\\"></label><button type=\\"submit\\">Save</button><p class=\\"muted\\"></p>";
    card.onsubmit=function(ev){
      ev.preventDefault();
      var note=card.querySelector("p");
      var body={ id:row.id, sku:row.sku, name:row.name, kind:row.kind, market:row.market, price:card.price.value, priceDir:card.dir.value, direction:card.dir.value==="below"?"down":"up", listingsAt:card.listings.value, listingsDir:card.dir.value };
      fetch("/api/alerts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)})
        .then(function(r){ return r.json().then(function(j){ return {ok:r.ok,j:j}; }); })
        .then(function(res){ note.textContent=res.ok?"Saved.":(res.j.error||"Not saved."); })
        .catch(function(){ note.textContent="Not saved."; });
    };
    box.appendChild(card);
  });
}
fetch("/api/me").then(function(r){ return r.ok?r.json():null; }).then(function(me){
  if(me && me.prefs){
    document.getElementById("pause").checked=!!me.prefs.pauseAll;
    if(me.prefs.quietStart) document.getElementById("q0").value=me.prefs.quietStart;
    if(me.prefs.quietEnd) document.getElementById("q1").value=me.prefs.quietEnd;
  }
  if(me && me.alerts){ paint(me.alerts); return; }
  return fetch("/api/alerts").then(function(r){ return r.ok?r.json():{rows:[]}; }).then(function(j){ paint((j&&j.rows)||[]); });
}).catch(function(){ document.getElementById("skel").hidden=true; });
document.getElementById("prefs").onsubmit=function(ev){
  ev.preventDefault();
  var body={ action:"prefs", pauseAll:document.getElementById("pause").checked, quietStart:document.getElementById("q0").value, quietEnd:document.getElementById("q1").value };
  fetch("/api/me",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)})
    .then(function(r){ return r.json().then(function(j){ return {ok:r.ok,j:j}; }); })
    .then(function(res){ document.getElementById("pref-note").textContent=res.ok?"Settings saved.":(res.j.error||"Sign in to save settings on the account."); })
    .catch(function(){ document.getElementById("pref-note").textContent="Not saved."; });
};
`;
