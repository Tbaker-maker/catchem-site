// Custom Reads picker. No network. Email is stored only when opted in and is never sent here.

import { readUser } from "./quota.mjs";

export const RARITIES = ["Illustration Rare", "Special Illustration Rare", "Ultra Rare"];
export const ERAS = ["Scarlet and Violet", "Sword and Shield", "Sun and Moon", "Mega Evolution"];
const FREE_CAP = 1;
const PREMIUM_CAP = 25;

export function blankPlan() {
  return {
    sets: [],
    pokemon: [],
    rarities: [],
    eras: [],
    sealed: false,
    singles: false,
    watch: [],
    frequency: "weekly",
    channels: { discord: true, email: false },
    email: "",
    addons: { news: false, games: false, all: false },
    deep: false,
  };
}

function cleanList(value, cap = 25) {
  const parts = Array.isArray(value) ? value : String(value || "").split(",");
  const out = [];
  for (const part of parts) {
    const text = String(part || "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (!text || out.includes(text)) continue;
    out.push(text);
    if (out.length >= cap) break;
  }
  return out;
}

function productId(value) {
  const id = String(value || "").trim();
  return /^tcgcsv-[A-Za-z0-9-]+$/.test(id) ? id : "";
}

export function followCount(plan) {
  if (!plan) return 0;
  return (plan.sets?.length || 0)
    + (plan.pokemon?.length || 0)
    + (plan.rarities?.length || 0)
    + (plan.eras?.length || 0)
    + (plan.sealed ? 1 : 0)
    + (plan.singles ? 1 : 0)
    + (plan.watch?.length || 0);
}

export function gatePlan(plan, { premium = false } = {}) {
  const next = blankPlan();
  const notes = [];
  next.sets = cleanList(plan?.sets);
  next.pokemon = cleanList(plan?.pokemon);
  next.rarities = cleanList(plan?.rarities).filter((name) => RARITIES.includes(name));
  next.eras = cleanList(plan?.eras).filter((name) => ERAS.includes(name));
  next.sealed = plan?.sealed === true;
  next.singles = plan?.singles === true;
  next.watch = [];
  for (const row of plan?.watch || []) {
    const name = String(row?.name || "").replace(/\s+/g, " ").trim().slice(0, 80);
    const id = productId(row?.id);
    const kind = row?.kind === "sealed" ? "sealed" : "card";
    if (!name && !id) continue;
    next.watch.push({ kind, id, name });
  }
  const asked = String(plan?.frequency || "weekly");
  next.frequency = ["daily", "weekly", "monthly", "quarterly"].includes(asked) ? asked : "weekly";
  if (!premium && next.frequency !== "weekly") {
    next.frequency = "weekly";
    notes.push("A free seat is one weekly read. Daily and other schedules are in Premium.");
  }
  next.channels.discord = plan?.channels?.discord !== false;
  next.channels.email = plan?.channels?.email === true;
  next.email = next.channels.email ? String(plan?.email || "").trim().slice(0, 120) : "";
  if (next.channels.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email)) {
    next.channels.email = false;
    next.email = "";
    notes.push("Email stays off until the address is filled in. Discord stays on.");
  }
  if (!next.channels.discord && !next.channels.email) next.channels.discord = true;
  next.addons.all = plan?.addons?.all === true;
  next.addons.news = next.addons.all || plan?.addons?.news === true;
  next.addons.games = next.addons.all || plan?.addons?.games === true;
  const cap = premium ? PREMIUM_CAP : FREE_CAP;
  const full = followCount(next);
  while (followCount(next) > cap) {
    if (next.watch.length) next.watch.pop();
    else if (next.eras.length) next.eras.pop();
    else if (next.rarities.length) next.rarities.pop();
    else if (next.pokemon.length) next.pokemon.pop();
    else if (next.sets.length) next.sets.pop();
    else if (next.singles) next.singles = false;
    else if (next.sealed) next.sealed = false;
    else break;
  }
  if (full > cap) notes.push(premium ? "25 follows saved." : "A free seat keeps one weekly read.");
  next.deep = premium === true;
  return { plan: next, notes };
}

export function typePlan(line) {
  const raw = String(line || "").replace(/\s+/g, " ").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const plan = blankPlan();
  if (/\bdaily\b/.test(lower)) plan.frequency = "daily";
  else if (/\bmonthly\b/.test(lower)) plan.frequency = "monthly";
  else if (/\bquarterly\b/.test(lower)) plan.frequency = "quarterly";
  if (/\bsealed\b/.test(lower)) plan.sealed = true;
  if (/\bsingles?\b/.test(lower)) plan.singles = true;
  if (/\bnews\b/.test(lower)) plan.addons.news = true;
  if (/\bgames?\b/.test(lower)) plan.addons.games = true;
  if (/\ball in one\b/.test(lower) || /\bevery add-on\b/.test(lower)) plan.addons.all = true;
  for (const name of RARITIES) if (lower.includes(name.toLowerCase())) plan.rarities.push(name);
  for (const name of ERAS) if (lower.includes(name.toLowerCase())) plan.eras.push(name);
  const from = raw.match(/\bfrom\s+([^,.]+)/i);
  if (from) {
    const setName = from[1].replace(/\b(daily|weekly|monthly|quarterly)\b/ig, "").trim();
    if (setName && !plan.eras.includes(setName) && !ERAS.some((era) => era.toLowerCase() === setName.toLowerCase())) plan.sets = [setName.slice(0, 80)];
  }
  const head = raw.split(/\bfrom\b/i)[0]
    .replace(/\b(daily|weekly|monthly|quarterly|sealed|singles?|news|games?|all in one|every add-on)\b/ig, " ")
    .replace(/[,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const watchName = head.replace(new RegExp(RARITIES.concat(ERAS).join("|"), "ig"), "").replace(/\s+/g, " ").trim();
  if (watchName) plan.watch = [{ kind: plan.sealed && !/\bcard\b/i.test(raw) ? "sealed" : "card", id: "", name: watchName.slice(0, 80) }];
  return plan;
}

export function planFromFields(fields) {
  if (fields && typeof fields.get !== "function" && (Array.isArray(fields.sets) || Array.isArray(fields.watch) || fields.addons || fields.channels)) {
    return fields;
  }
  const get = (key) => fields.get?.(key) ?? fields[key] ?? "";
  const all = (key) => typeof fields.getAll === "function" ? fields.getAll(key) : [].concat(fields[key] || []);
  const on = (key) => all(key).some((value) => String(value) === "1" || value === true);
  const watch = [];
  for (const kept of all("keep")) {
    const [kind, id, ...name] = String(kept).split(":");
    watch.push({ kind: kind === "sealed" ? "sealed" : "card", id, name: name.join(":") });
  }
  const extraName = String(get("watch_name") || "").trim();
  const extraId = String(get("watch_id") || "").trim();
  if (extraName || extraId) watch.push({ kind: get("watch_kind") === "sealed" ? "sealed" : "card", id: extraId, name: extraName });
  return {
    sets: get("sets"),
    pokemon: get("pokemon"),
    rarities: all("rarity"),
    eras: all("era"),
    sealed: on("sealed"),
    singles: on("singles"),
    watch,
    frequency: String(get("frequency") || "weekly"),
    channels: { discord: on("discord"), email: on("email_on") },
    email: String(get("email") || ""),
    addons: { news: on("news"), games: on("games"), all: on("all") },
  };
}

export function preSend(text) {
  const body = String(text || "").trim();
  if (!body) return { ok: false, why: "empty" };
  if (/—|–/.test(body)) return { ok: false, why: "copy" };
  const emptySection = ["no", "data"].join(" ");
  if (body.toLowerCase().includes(emptySection)) return { ok: false, why: "copy" };
  if (/\b(buy|sell|hold|support|resistance|bottom|printed|play|target|invest|stack|crypto)\b|load up/i.test(body)) return { ok: false, why: "copy" };
  return { ok: true };
}

export function emailLetter(plan, payload) {
  if (!plan?.channels?.email) return "";
  const parts = [];
  const watch = (payload?.watch || []).map((row) => String(row?.line || "").trim()).filter((line) => line && line.length <= 220);
  if (watch.length) parts.push(["Your watchlist", ...watch].join("\n"));
  const lead = String(payload?.lead || "").trim();
  if (lead && lead.length <= 220) parts.push(lead);
  if (plan.addons?.news) {
    const rows = (payload?.news || []).filter((row) => row?.headline && row?.line && /^https:\/\//.test(String(row.url || "")) && String(row.line).length <= 220);
    if (rows.length) parts.push(rows.map((row) => `${row.headline}\n${row.line}\n${row.url}`).join("\n\n"));
  }
  if (plan.addons?.games) {
    const rows = (payload?.games || []).filter((row) => row?.headline && row?.line && /^https:\/\//.test(String(row.url || "")) && String(row.line).length <= 220);
    if (rows.length) parts.push(rows.map((row) => `${row.headline}\n${row.line}\n${row.url}`).join("\n\n"));
  }
  const text = parts.join("\n\n").trim();
  return preSend(text).ok ? text : "";
}

export function emailSendAllowed(env) {
  return !!(env && String(env.READS_EMAIL_KEY || "").trim());
}

export function bumpClick(row, kind) {
  const opens = Number(row?.opens) || 0;
  const taps = Number(row?.taps) || 0;
  if (kind === "open") return { opens: opens + 1, taps };
  if (kind === "tap") return { opens, taps: taps + 1 };
  return { opens, taps };
}

export function planPreview(plan) {
  const blocks = [];
  const watch = (plan?.watch || []).map((row) => row.name || row.id).filter(Boolean);
  if (watch.length) blocks.push({ title: "Your watchlist", text: watch.join(", ") });
  const follows = [...(plan?.sets || []), ...(plan?.pokemon || []), ...(plan?.rarities || []), ...(plan?.eras || [])];
  if (follows.length) blocks.push({ title: "Follows", text: follows.join(", ") });
  if (plan?.sealed) blocks.push({ title: "Sealed", text: "Sealed products you picked." });
  if (plan?.singles) blocks.push({ title: "Singles", text: "Singles you picked." });
  if (plan?.addons?.news) blocks.push({ title: "Pokemon news", text: "A headline, one line, and a link when that day's file has one." });
  if (plan?.addons?.games) blocks.push({ title: "Video games", text: "A short release or event line when that day's file has one." });
  return blocks;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => {
    if (ch === "&") return "&" + "amp;";
    if (ch === "<") return "&" + "lt;";
    if (ch === ">") return "&" + "gt;";
    if (ch === '"') return "&" + "quot;";
    return "&#" + "39;";
  });
}

function box(name, label, on) {
  return `<label class="rd-check"><input type="checkbox" name="${name}" value="1"${on ? " checked" : ""}> ${esc(label)}</label>`;
}

function choice(name, value, on) {
  return `<label class="rd-check"><input type="checkbox" name="${name}" value="${esc(value)}"${on ? " checked" : ""}> ${esc(value)}</label>`;
}

export function renderReadsPage(state = {}) {
  const signedIn = state.signedIn === true;
  const premium = state.premium === true;
  const base = state.plan && typeof state.plan === "object" ? state.plan : blankPlan();
  const draft = { ...base, watch: [...(base.watch || [])] };
  const cardId = productId(state.card);
  const sealedId = productId(state.sealed);
  if (cardId && !draft.watch.some((row) => row.id === cardId)) draft.watch.push({ kind: "card", id: cardId, name: "" });
  if (sealedId && !draft.watch.some((row) => row.id === sealedId)) draft.watch.push({ kind: "sealed", id: sealedId, name: "" });
  const suggestion = typePlan(state.line || "");
  const gatedSuggestion = suggestion ? gatePlan(suggestion, { premium }) : null;
  const notes = [];
  if (state.saved) notes.push("Saved.");
  if (gatedSuggestion) notes.push(...gatedSuggestion.notes);
  const preview = planPreview(gatedSuggestion?.plan || draft);
  const freq = draft.frequency || "weekly";
  const freqBox = (value, label) => {
    const locked = !premium && value !== "weekly";
    return `<label class="rd-check"><input type="radio" name="frequency" value="${value}"${freq === value ? " checked" : ""}${locked ? " disabled" : ""}> ${esc(label)}</label>`;
  };
  const keep = (draft.watch || []).map((row) => {
    const value = `${row.kind}:${row.id}:${row.name || ""}`;
    const label = row.name || row.id;
    return `<label class="rd-check"><input type="checkbox" name="keep" value="${esc(value)}" checked> ${esc(label)}</label>`;
  }).join("");
  const suggest = gatedSuggestion ? `<form class="rd-card" method="post" action="/api/reads">
<h2>Ready plan</h2>
<p>${esc(planPreview(gatedSuggestion.plan).map((block) => block.title + ": " + block.text).join(" "))}</p>
<input type="hidden" name="sets" value="${esc(gatedSuggestion.plan.sets.join(", "))}">
<input type="hidden" name="pokemon" value="${esc(gatedSuggestion.plan.pokemon.join(", "))}">
<input type="hidden" name="frequency" value="${esc(gatedSuggestion.plan.frequency)}">
${gatedSuggestion.plan.rarities.map((name) => `<input type="hidden" name="rarity" value="${esc(name)}">`).join("")}
${gatedSuggestion.plan.eras.map((name) => `<input type="hidden" name="era" value="${esc(name)}">`).join("")}
${gatedSuggestion.plan.sealed ? `<input type="hidden" name="sealed" value="1">` : ""}
${gatedSuggestion.plan.singles ? `<input type="hidden" name="singles" value="1">` : ""}
${gatedSuggestion.plan.watch.map((row) => `<input type="hidden" name="keep" value="${esc(`${row.kind}:${row.id}:${row.name}`)}">`).join("")}
<input type="hidden" name="discord" value="1">
${gatedSuggestion.plan.addons.news ? `<input type="hidden" name="news" value="1">` : ""}
${gatedSuggestion.plan.addons.games ? `<input type="hidden" name="games" value="1">` : ""}
${gatedSuggestion.plan.addons.all ? `<input type="hidden" name="all" value="1">` : ""}
<button type="submit">Keep this plan</button>
</form>` : "";
  const previewHtml = preview.length ? `<section class="rd-card">${preview.map((block) => `<h2>${esc(block.title)}</h2><p>${esc(block.text)}</p>`).join("")}</section>` : "";
  const sign = signedIn ? "" : `<p><a href="/auth/discord?next=/reads">Sign in with Discord</a> to save this read.</p>`;
  return `<main id="main" tabindex="-1" class="rd-wrap">
<style>
.rd-wrap{max-width:440px;margin:0 auto;padding:16px 14px 88px;background:#f2f2f7;color:#1c1c1e;border-radius:28px}
.rd-wrap h1{font-size:28px;line-height:1.15;margin:8px 0}
.rd-card{background:#fff;border-radius:22px;padding:16px;margin:0 0 12px}
.rd-card h2{font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#8e8e93;margin:0 0 8px}
.rd-check{display:flex;gap:8px;align-items:center;margin:8px 0;font-size:16px}
.rd-wrap input[type="text"],.rd-wrap input[type="email"]{width:100%;box-sizing:border-box;border:0;background:#f2f2f7;border-radius:14px;padding:12px;font-size:16px}
.rd-wrap button{display:block;width:100%;border:0;border-radius:999px;background:#1c1c1e;color:#fff;padding:12px;font-weight:600;font-size:16px}
.rd-note{color:#636366;font-size:14px}
.rd-later{color:#8e8e93}
</style>
<h1>Your reads</h1>
<p class="rd-note">${premium ? "Premium can use a daily read and up to 25 follows." : "Free is one weekly read. Daily and more follows are in Premium."} <a href="/premium">Premium</a></p>
${notes.map((note) => `<p class="rd-note">${esc(note)}</p>`).join("")}
${sign}
${suggest}
${previewHtml}
<form class="rd-card" method="get" action="/reads">
<h2>Type a line</h2>
<p class="rd-note">One plain line becomes a plan. Nothing is saved until you tap Keep this plan.</p>
<input type="text" name="line" value="${esc(state.line || "")}" maxlength="180" placeholder="Eeveelutions from Scarlet and Violet, weekly">
<button type="submit">Show a plan</button>
</form>
<form class="rd-card" method="post" action="/api/reads">
<h2>What to follow</h2>
<label>Sets <input type="text" name="sets" value="${esc((draft.sets || []).join(", "))}"></label>
<label>Pokemon <input type="text" name="pokemon" value="${esc((draft.pokemon || []).join(", "))}"></label>
${RARITIES.map((name) => choice("rarity", name, (draft.rarities || []).includes(name))).join("")}
${ERAS.map((name) => choice("era", name, (draft.eras || []).includes(name))).join("")}
${box("singles", "Singles", draft.singles === true)}
${box("sealed", "Sealed products", draft.sealed === true)}
${keep ? `<h2>Your watchlist</h2>${keep}` : ""}
<label>Add a name <input type="text" name="watch_name" maxlength="80"></label>
<label>Catalog id <input type="text" name="watch_id" value="" maxlength="80"></label>
<label class="rd-check"><input type="radio" name="watch_kind" value="card" checked> Card</label>
<label class="rd-check"><input type="radio" name="watch_kind" value="sealed"> Sealed product</label>
<h2>How often</h2>
${freqBox("daily", "Daily")}
${freqBox("weekly", "Weekly")}
${freqBox("monthly", "Monthly")}
${freqBox("quarterly", "Quarterly")}
<h2>Where it goes</h2>
<input type="hidden" name="discord" value="0">
${box("discord", "Discord DM", draft.channels?.discord !== false)}
<input type="hidden" name="email_on" value="0">
${box("email_on", "Email, optional", draft.channels?.email === true)}
<label>Email <input type="email" name="email" value="${esc(draft.email || "")}" autocomplete="email"></label>
<p class="rd-later">App later.</p>
<h2>Add-ons</h2>
<input type="hidden" name="news" value="0">
${box("news", "Pokemon news", draft.addons?.news === true)}
<input type="hidden" name="games" value="0">
${box("games", "Video games", draft.addons?.games === true)}
<input type="hidden" name="all" value="0">
${box("all", "All in one", draft.addons?.all === true)}
<p class="rd-note">Off unless you turn one on. All in one turns on every add-on.</p>
<button type="submit">Save read</button>
</form>
<script>fetch("/api/reads/click",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({kind:"open",id:"reads"})}).catch(function(){});</script>
</main>`;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function loadStoredPlan(store, sub) {
  if (!store || !sub) return blankPlan();
  const row = await store.get(`reads:${sub}`, "json");
  return row && typeof row === "object" ? row : blankPlan();
}

export async function handleReads(request, env) {
  const user = await readUser(request, env);
  const form = (request.headers.get("content-type") || "").includes("application/x-www-form-urlencoded");
  const back = new URL("/reads", request.url);
  if (!user?.sub) {
    if (form) return Response.redirect(new URL("/auth/discord?next=/reads", request.url), 303);
    return json({ ok: false, error: "Sign in with Discord to save a read." }, 401);
  }
  const store = env?.FEED_KV;
  if (request.method === "GET") {
    const plan = await loadStoredPlan(store, user.sub);
    return json({ ok: true, plan, premium: user.premium === true });
  }
  if (request.method !== "POST") return json({ ok: false, error: "Use POST." }, 405);
  if (!store) {
    if (form) {
      back.searchParams.set("line", "Reads are not open yet.");
      return Response.redirect(back, 303);
    }
    return json({ ok: false, error: "Reads are not open yet." }, 503);
  }
  let fields;
  if (form) fields = new URLSearchParams(await request.text());
  else {
    try { fields = await request.json(); } catch { return json({ ok: false, error: "Bad read." }, 400); }
  }
  const { plan, notes } = gatePlan(planFromFields(fields), { premium: user.premium === true });
  plan.savedAt = new Date().toISOString();
  await store.put(`reads:${user.sub}`, JSON.stringify(plan));
  if (form) {
    back.searchParams.set("saved", "1");
    return Response.redirect(back, 303);
  }
  return json({ ok: true, plan, notes, emailArmed: emailSendAllowed(env) });
}

export async function handleReadsClick(request, env) {
  if (request.method !== "POST") return json({ ok: false, error: "Use POST." }, 405);
  const user = await readUser(request, env);
  if (!user?.sub) return json({ ok: false, error: "Sign in with Discord." }, 401);
  const store = env?.FEED_KV;
  if (!store) return json({ ok: false, error: "Reads are not open yet." }, 503);
  let body = {};
  try { body = await request.json(); } catch { return json({ ok: false, error: "Bad click." }, 400); }
  const kind = body.kind === "tap" ? "tap" : body.kind === "open" ? "open" : "";
  const id = String(body.id || "").slice(0, 40).replace(/[^a-z0-9-]/gi, "");
  if (!kind || !id) return json({ ok: false, error: "Bad click." }, 400);
  const key = `reads-clicks:${id}`;
  const next = bumpClick(await store.get(key, "json"), kind);
  await store.put(key, JSON.stringify(next));
  return json({ ok: true, ...next });
}
