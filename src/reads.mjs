// Custom Reads picker. The address, when opted in, is stored in FEED_KV only.
// Letters are sent from reads-email.mjs, and only after a confirm click.

import { readUser } from "./quota.mjs";
import { FOLLOWS_KEY, readsPipeReady } from "./reads-pipe.mjs";
import { banGuard } from "./advice-rules.mjs";
import { SIGNAL_CSS, chipForSample, iconKeyHtml, signalRowHtml } from "./signal-chips.mjs";
import { clearEmailChoice, rememberEmail, validEmail } from "./reads-email.mjs";
import { WEEKDAYS, WEEKDAY_NAMES, cleanLength, cleanLengthByDay } from "./reads-article.mjs";
// Shared advice-phrase rules (Catchem-data rules/advice-phrases.json). Flag, never rewrite.
const READ_GUARD = banGuard("read");

export const RARITIES = ["Illustration Rare", "Special Illustration Rare", "Ultra Rare"];
export const ERAS = ["Scarlet and Violet", "Sword and Shield", "Sun and Moon", "Mega Evolution"];
// Set list dated 2026-10-17 from sets.json. Recommended is the newest main set with both singles and sealed.
export const SET_CHOICES = [
  { slug: "me-30th-celebration", name: "ME: 30th Celebration", recommended: true },
  { slug: "me-ascended-heroes", name: "ME: Ascended Heroes" },
  { slug: "me05-pitch-black", name: "ME05: Pitch Black" },
  { slug: "sv-prismatic-evolutions", name: "SV: Prismatic Evolutions" },
  { slug: "sv10-destined-rivals", name: "SV10: Destined Rivals" },
  { slug: "sv-black-bolt", name: "SV: Black Bolt" },
];
export const POKEMON_CHOICES = ["Pikachu", "Charizard", "Eevee", "Umbreon", "Mew"];
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
    product: "singles",
    channels: { discord: true, email: false },
    email: "",
    addons: { news: false, games: false, all: false },
    deep: false,
    length: "standard",
    lengthByDay: {},
    focus: "",
  };
}

// One tap starting points. They only set picker fields; Save still decides.
export const PRESETS = [
  { id: "sealed", label: "Sealed collector", note: "Sealed only, Standard read." },
  { id: "chase", label: "Chase card hunter", note: "Illustration Rares and SIRs, Glance read." },
  { id: "vintage", label: "Vintage fan", note: "WOTC era cards, before mid 2003." },
  { id: "completer", label: "Set completer", note: "Your set, Deep dive read." },
];

export const LENGTH_CHOICES = [
  { id: "glance", label: "Glance", note: "Headline and three moves. About 20 seconds." },
  { id: "standard", label: "Standard", note: "The full read. About a minute." },
  { id: "deep", label: "Deep dive", note: "Charts, run stage and set by set. Premium." },
];

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
  next.channels.discord = true;
  const askedEmail = plan?.channels?.email === true;
  const cleanMail = validEmail(plan?.email);
  next.channels.email = askedEmail && !!cleanMail;
  next.email = "";
  if (askedEmail && !cleanMail) notes.push("Enter an email to turn Email on.");
  next.product = plan?.product === "sealed" ? "sealed" : "singles";
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
  next.length = cleanLength(plan?.length, premium === true);
  if (String(plan?.length || "") === "deep" && next.length !== "deep") notes.push("Deep dive is in Premium, so this read is Standard.");
  next.focus = plan?.focus === "vintage" ? "vintage" : "";
  next.lengthByDay = cleanLengthByDay(plan?.lengthByDay, premium === true);
  if (!premium && Object.values(plan?.lengthByDay || {}).includes("deep")) notes.push("Deep dive days are in Premium, so those days are Standard.");
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
  const chipSets = all("set").map((value) => String(value || "").trim()).filter(Boolean);
  const chipPokemon = all("pokemon").map((value) => String(value || "").trim()).filter(Boolean);
  const product = String(get("product") || "singles") === "sealed" ? "sealed" : "singles";
  const rarities = all("rarity");
  const eras = all("era");
  const other = chipSets.length || chipPokemon.length || rarities.some(Boolean) || eras.some(Boolean) || watch.length;
  return {
    sets: chipSets.length ? chipSets : get("sets"),
    pokemon: chipPokemon.length ? chipPokemon : get("pokemon"),
    rarities,
    eras,
    sealed: product === "sealed" && !other,
    singles: product === "singles" && !other,
    watch,
    frequency: String(get("frequency") || "weekly"),
    channels: { discord: true, email: on("email_on") },
    email: String(get("email") || ""),
    product,
    addons: { news: on("news"), games: on("games"), all: on("all") },
    length: String(get("length") || "standard"),
    lengthByDay: Object.fromEntries(WEEKDAYS.map((w) => [w, String(get("len_" + w) || "")]).filter((row) => row[1])),
    focus: all("focus").includes("vintage") ? "vintage" : "",
  };
}

export function lengthPicker(shown, premium) {
  const now = cleanLength(shown?.length, premium === true);
  return `<h2>Read length</h2>
<div class="rd-chips">${LENGTH_CHOICES.map((row) => radio("length", row.id, row.label, now === row.id, row.id === "deep" && premium !== true)).join("")}</div>
<p class="rd-note">${LENGTH_CHOICES.map((row) => `${row.label}: ${row.note}`).join(" ")} Length is for email reads. Discord DMs stay short for now.</p>
${lengthByDayPicker(shown, premium)}`;
}

// Length by day: one row per weekday. "Same" uses the everyday length above.
export function lengthByDayPicker(shown, premium) {
  const by = cleanLengthByDay(shown?.lengthByDay, premium === true);
  const order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const opts = [["", "Same"], ["glance", "Glance"], ["standard", "Standard"], ["deep", "Deep dive"]];
  const rows = order.map((w) => `<fieldset class="rd-day"><legend>${WEEKDAY_NAMES[w]}</legend><div class="rd-chips">${opts.map(([v, label]) => radio("len_" + w, v, label, (by[w] || "") === v, v === "deep" && premium !== true)).join("")}</div></fieldset>`).join("");
  const count = Object.keys(by).length;
  return `<details class="rd-days"${count ? " open" : ""}><summary>Length by day${count ? ` (${count} set)` : ""}</summary>
<p class="rd-note">Pick a different length for any day, for example Glance on weekdays and Deep dive on Sunday. Same uses your everyday length.</p>
<div class="rd-chips"><button type="button" class="rd-preset" data-days="weekday-glance">Glance weekdays</button><button type="button" class="rd-preset" data-days="clear">All the same</button></div>
${rows}</details>`;
}

// Email shows only once sending is switched on. Before that, one quiet line.
export function whereItGoes(shown, state = {}) {
  const head = `<h2>Where it goes</h2>
<input type="hidden" name="discord" value="1">
<p class="rd-chip"><input type="checkbox" checked disabled> <span>Discord DM</span></p>`;
  if (state.emailArmed !== true) {
    return `${head}
<p class="rd-note" id="rd-mail-soon">Email delivery is coming soon.</p>`;
  }
  return `${head}
<label class="rd-chip"><input type="checkbox" name="email_on" value="1"${shown.channels?.email === true ? " checked" : ""}> <span>Email</span></label>
<label class="rd-mail">Email address<input type="email" name="email" inputmode="email" autocomplete="email" maxlength="120" value="${esc(state.emailValue || "")}"></label>
<p class="rd-note">Email stays off until you open the confirm link. Every letter has a one click stop link.</p>
${lengthPicker(shown, state.premium === true)}`;
}

export function preSend(text) {
  const body = String(text || "").trim();
  if (!body) return { ok: false, why: "empty" };
  if (/—|–/.test(body)) return { ok: false, why: "copy" };
  const emptySection = ["no", "data"].join(" ");
  if (body.toLowerCase().includes(emptySection)) return { ok: false, why: "copy" };
  if (READ_GUARD.test(body)) return { ok: false, why: "copy" };
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

export function recommendedPlan(plan) {
  const base = plan && typeof plan === "object" ? { ...blankPlan(), ...plan } : blankPlan();
  if (followCount(base) > 0) return base;
  return { ...base, sets: ["me-30th-celebration"], product: "singles", frequency: base.frequency || "weekly" };
}

export function sampleLines(plan, lines = {}) {
  const rows = [];
  const add = (key) => {
    const line = lines ? lines[key] : "";
    const text = String(line || "").trim();
    if (!text || rows.includes(text)) return;
    rows.push(text);
  };
  for (const slug of plan?.sets || []) add(`set:${slug}`);
  for (const name of plan?.pokemon || []) add(`pokemon:${name}`);
  for (const name of plan?.rarities || []) add(`rarity:${name}`);
  for (const name of plan?.eras || []) add(`era:${name}`);
  if (plan?.product === "sealed" || plan?.sealed === true) add("product:sealed");
  for (const row of plan?.watch || []) {
    if (!row?.id) continue;
    add(row.kind === "sealed" ? `sealed:${row.id}` : `card:${row.id}`);
  }
  return rows.slice(0, 6);
}

export function sampleRead(plan, lines = {}) {
  const rows = sampleLines(plan, lines);
  if (!rows.length) return "Sample read. The night file fills the dated lines.";
  return rows.join("\n\n");
}

export function planToFollow(discordId, plan) {
  const id = String(discordId || "").replace(/^d:/, "").replace(/[^0-9A-Za-z_-]/g, "").slice(0, 32) || "member";
  const product = plan?.product === "sealed" ? "sealed" : "singles";
  const cards = [];
  const sealedIds = [];
  for (const row of plan?.watch || []) {
    const pid = productId(row?.id);
    if (!pid) continue;
    if (row.kind === "sealed") sealedIds.push(pid);
    else cards.push(pid);
  }
  const kinds = [];
  if (product === "sealed" || plan?.sealed) kinds.push("sealed");
  if (product === "singles" || plan?.singles) kinds.push("single");
  return {
    id,
    discordId: id,
    sets: plan?.sets || [],
    cards,
    sealed: sealedIds,
    kinds,
    pokemon: plan?.pokemon || [],
    rarities: plan?.rarities || [],
    eras: plan?.eras || [],
    frequency: plan?.frequency || "weekly",
    product,
    news: plan?.addons?.news === true || plan?.addons?.all === true,
    games: plan?.addons?.games === true || plan?.addons?.all === true,
    savedAt: String(plan?.savedAt || ""),
  };
}

export function upsertFollow(doc, follow) {
  const follows = (Array.isArray(doc?.follows) ? doc.follows : []).filter((row) => row && row.id !== follow.id);
  follows.push(follow);
  return {
    rule: "Each follow is one Discord id. The nightly reads this list through /api/reads/export and never commits it. A night with no match is skipped.",
    follows,
  };
}

export function readsPickerEnabled(env) {
  return String(env?.READS_PICKER || "").toLowerCase() !== "off";
}

function choice(name, value, label, on) {
  return `<label class="rd-chip"><input type="checkbox" name="${name}" value="${esc(value)}" data-label="${esc(label)}"${on ? " checked" : ""}><span>${esc(label)}</span></label>`;
}

function radio(name, value, label, on, locked) {
  return `<label class="rd-chip"><input type="radio" name="${name}" value="${esc(value)}" data-label="${esc(label)}"${on ? " checked" : ""}${locked ? " disabled" : ""}><span>${esc(label)}</span></label>`;
}

// What Save says. It only promises a DM when the nightly can read the follow.
export function saveLine(state = {}) {
  if (state.note === "closed") return "Saving is not open yet, so nothing was stored.";
  if (!state.saved) return "";
  let emailBit = "";
  if (state.email === "pending") emailBit = " Check your inbox and open the confirm link. No read email goes out before that.";
  else if (state.email === "confirmed") emailBit = " Email is confirmed.";
  else if (state.email === "off") emailBit = " Your email is saved. Letters stay off until sending is switched on.";
  else if (state.email === "bad") emailBit = " Enter an email to turn Email on.";
  if (state.pipe === true) return "Saved. Your first read comes by Discord DM after the next nightly run." + emailBit;
  return "Saved. Reads by Discord DM are not switched on yet, so none will arrive for now." + emailBit;
}

export function renderReadsPage(state = {}) {
  if (state.picker === false) {
    return `<main id="main" tabindex="-1" class="rd-wrap"><h1>Your reads</h1><p>Reads are off.</p><p>Discord is the account link. <a href="https://discord.gg/fUSjxDX4Hy">Open Discord</a>.</p></main>`;
  }
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
  let shown = draft;
  if (gatedSuggestion) {
    const extra = draft.watch.filter((row) => row.id && !(gatedSuggestion.plan.watch || []).some((item) => item.id === row.id));
    shown = { ...gatedSuggestion.plan, watch: [...(gatedSuggestion.plan.watch || []), ...extra] };
  }
  shown = recommendedPlan(shown);
  if (!shown.product) shown.product = shown.sealed ? "sealed" : "singles";
  const notes = [];
  const saveNote = saveLine(state);
  if (saveNote) notes.push(saveNote);
  if (gatedSuggestion) notes.push(...gatedSuggestion.notes);
  const lineMap = state.preview?.lines && typeof state.preview.lines === "object" ? state.preview.lines : {};
  const sample = sampleRead(shown, lineMap);
  const chipDoc = state.preview?.chips && typeof state.preview.chips === "object" ? state.preview.chips : null;
  const matched = chipForSample(sample, chipDoc);
  const kinds = (matched?.signals || []).map((chip) => chip.kind);
  if ((matched?.signals || []).some((chip) => chip.strength >= 1 && chip.strength <= 5)) kinds.push("dots");
  if (matched && matched.strength >= 1 && matched.strength <= 5) kinds.push("score");
  const blob = Object.values(lineMap).join("\n");
  const catalog = [];
  const asOf = chipDoc?.asOf || "";
  for (const row of Object.values(chipDoc?.byId || {})) {
    const name = String(row?.name || "").trim();
    if (name.length < 8 || !blob.includes(name)) continue;
    catalog.push({ name, html: signalRowHtml(row, { href: "", light: true, asOf }) });
  }
  const catalogJson = JSON.stringify(catalog).replace(/</g, "\\u003c");
  const lineJson = JSON.stringify(lineMap).replace(/</g, "\\u003c");
  const keep = (shown.watch || []).map((row) => {
    const value = `${row.kind}:${row.id}:${row.name || ""}`;
    const label = row.name || row.id || "Saved product";
    return choice("keep", value, label, true);
  }).join("");
  const sign = signedIn ? "" : `<p><a href="/auth/discord?next=/reads">Sign in with Discord</a> to save this read.</p>`;
  const beacon = signedIn
    ? `<script>fetch("/api/reads/click",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({kind:"open",id:"reads"})}).catch(function(){});</script>`
    : "";
  return `<main id="main" tabindex="-1" class="rd-wrap">
<style>
.rd-wrap{max-width:440px;margin:0 auto;padding:16px 14px 96px;background:#f2f2f7;color:#1c1c1e;border-radius:28px}
.rd-wrap h1{font-size:28px;line-height:1.15;margin:8px 0}
.rd-card{background:#fff;border-radius:22px;padding:16px;margin:0 0 12px}
.rd-card h2{font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#8e8e93;margin:0 0 10px}
.rd-chips{display:flex;flex-wrap:wrap;gap:8px}
.rd-chip{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 14px;border-radius:999px;background:#f2f2f7;font-size:15px}
.rd-chip input{width:18px;height:18px}
.rd-rec{color:#8e8e93;font-size:12px;margin:0 0 8px}
.rd-sample{font-size:17px;line-height:1.35;margin:0;white-space:pre-wrap}
.rd-wrap button[type="submit"]{display:block;width:100%;min-height:44px;border:0;border-radius:999px;background:#1c1c1e;color:#fff;padding:12px;font-weight:600;font-size:16px}
.rd-note{color:#636366;font-size:14px}
.rd-mail{display:block;margin-top:8px}
.rd-preset{min-height:44px;padding:0 16px;border:0;border-radius:999px;background:#f2f2f7;color:#1c1c1e;font-size:15px;font-weight:600}
.rd-preset[aria-pressed="true"]{background:#1c1c1e;color:#fff}
.rd-days{margin:12px 0;border-radius:16px;background:#f8f8fa;padding:4px 12px}
.rd-days summary{min-height:44px;line-height:44px;font-weight:600;cursor:pointer}
.rd-day{border:0;margin:0 0 10px;padding:0}
.rd-day legend{font-size:13px;color:#636366;margin:0 0 6px;padding:0}
.rd-mail input{display:block;width:100%;box-sizing:border-box;min-height:44px;margin-top:6px;border:0;border-radius:16px;background:#f2f2f7;padding:0 14px;font-size:16px}
</style>
<h1>Your reads</h1>
<p class="rd-note">${premium ? "Premium can use a daily read and up to 25 follows." : "Free is one weekly read. Daily and more follows are in Premium."} <a href="/premium">Premium</a></p>
${notes.map((note) => `<p class="rd-note">${esc(note)}</p>`).join("")}
${sign}
<section class="rd-card" id="rd-preview">
<h2>Sample read</h2>
<p class="rd-sample" id="rd-sample">${esc(sample)}</p>
<style>${SIGNAL_CSS}</style>
<div id="rd-chip">${matched ? signalRowHtml(matched, { href: "", light: true, asOf }) : ""}</div>
${iconKeyHtml(chipDoc?.asOf || "", kinds)}
<script type="application/json" id="rd-lines">${lineJson}</script>
<script type="application/json" id="rd-chip-catalog">${catalogJson}</script>
</section>
<form class="rd-card" id="rd-form" method="post" action="/api/reads">
<h2>Quick start</h2>
<div class="rd-chips">${PRESETS.map((row) => `<button type="button" class="rd-preset" data-preset="${row.id}" title="${esc(row.note)}">${esc(row.label)}</button>`).join("")}</div>
<p class="rd-note" id="rd-preset-note">Tap one to fill the picks below. Nothing saves until you tap Save.</p>
<h2>Sets</h2>
<p class="rd-rec">Recommended starts on ME: 30th Celebration. Tap to change it.</p>
<div class="rd-chips">${SET_CHOICES.map((row) => choice("set", row.slug, row.name, (shown.sets || []).includes(row.slug))).join("")}</div>
<h2>Pokemon</h2>
<div class="rd-chips">${POKEMON_CHOICES.map((name) => choice("pokemon", name, name, (shown.pokemon || []).includes(name))).join("")}</div>
<h2>Rarity</h2>
<div class="rd-chips">${RARITIES.map((name) => choice("rarity", name, name, (shown.rarities || []).includes(name))).join("")}</div>
<h2>Era</h2>
<div class="rd-chips">${ERAS.map((name) => choice("era", name, name, (shown.eras || []).includes(name))).join("")}${choice("focus", "vintage", "Vintage, WOTC era", shown.focus === "vintage")}</div>
<h2>Singles or sealed</h2>
<div class="rd-chips">${radio("product", "singles", "Singles", shown.product !== "sealed", false)}${radio("product", "sealed", "Sealed", shown.product === "sealed", false)}</div>
${keep ? `<h2>Your watchlist</h2><div class="rd-chips">${keep}</div>` : ""}
<h2>How often</h2>
<div class="rd-chips">
${radio("frequency", "daily", "Daily", shown.frequency === "daily", !premium)}
${radio("frequency", "weekly", "Weekly", (shown.frequency || "weekly") === "weekly", false)}
${radio("frequency", "monthly", "Monthly", shown.frequency === "monthly", !premium)}
${radio("frequency", "quarterly", "Quarterly", shown.frequency === "quarterly", !premium)}
</div>
${whereItGoes(shown, state)}
<h2>Add-ons</h2>
<div class="rd-chips">
${choice("news", "1", "Pokemon news", shown.addons?.news === true)}
${choice("games", "1", "Video games", shown.addons?.games === true)}
${choice("all", "1", "All in one", shown.addons?.all === true)}
</div>
<p class="rd-note">Off unless you turn one on. All in one turns on every add-on.</p>
<button type="submit">Save</button>
</form>
<script>
(function(){
  var form = document.getElementById("rd-form");
  var out = document.getElementById("rd-sample");
  if (!form || !out) return;
  function paint(){
    var raw = {};
    try { raw = JSON.parse(document.getElementById("rd-lines").textContent || "{}"); } catch (e) { raw = {}; }
    var bits = [];
    function add(key){
      var line = raw[key];
      if (line && bits.indexOf(line) < 0) bits.push(line);
    }
    var setNodes = form.querySelectorAll('input[name="set"]');
    for (var i = 0; i < setNodes.length; i++) if (setNodes[i].checked) add("set:" + setNodes[i].value);
    function labels(name, prefix){
      var nodes = form.querySelectorAll('input[name="' + name + '"]');
      for (var j = 0; j < nodes.length; j++) if (nodes[j].checked) add(prefix + (nodes[j].getAttribute("data-label") || nodes[j].value));
    }
    labels("pokemon", "pokemon:");
    labels("rarity", "rarity:");
    labels("era", "era:");
    var product = "";
    var products = form.querySelectorAll('input[name="product"]');
    for (var k = 0; k < products.length; k++) if (products[k].checked) product = products[k].value;
    if (product === "sealed") add("product:sealed");
    var keeps = form.querySelectorAll('input[name="keep"]');
    for (var n = 0; n < keeps.length; n++) {
      if (!keeps[n].checked) continue;
      var parts = String(keeps[n].value || "").split(":");
      if (parts[1]) add((parts[0] === "sealed" ? "sealed:" : "card:") + parts[1]);
    }
    out.textContent = bits.length ? bits.slice(0, 6).join("\n\n") : "Sample read. The night file fills the dated lines.";
    var catalog = [];
    try { catalog = JSON.parse(document.getElementById("rd-chip-catalog").textContent || "[]"); } catch (e) { catalog = []; }
    var sample = out.textContent || "";
    var best = null;
    for (var c = 0; c < catalog.length; c++) {
      if (sample.indexOf(catalog[c].name) >= 0 && (!best || catalog[c].name.length > best.name.length)) best = catalog[c];
    }
    var host = document.getElementById("rd-chip");
    if (host) host.innerHTML = best ? best.html : "";
    var seen = {};
    if (host) host.querySelectorAll("[data-kind]").forEach(function (el) { seen[el.getAttribute("data-kind")] = 1; });
    if (host && host.querySelector(".sig-strength")) seen.dots = 1;
    if (host && host.querySelector(".sig-overall")) seen.score = 1;
    document.querySelectorAll(".icon-key-row").forEach(function (row) {
      row.hidden = !seen[row.getAttribute("data-icon")];
    });
  }
  form.addEventListener("change", paint);
  function setAll(name, values){
    var nodes = form.querySelectorAll('input[name="' + name + '"]');
    for (var i = 0; i < nodes.length; i++) if (!nodes[i].disabled) nodes[i].checked = values.indexOf(nodes[i].value) >= 0;
  }
  function pickOne(name, value){
    var nodes = form.querySelectorAll('input[name="' + name + '"]');
    for (var i = 0; i < nodes.length; i++) if (nodes[i].value === value && !nodes[i].disabled) nodes[i].checked = true;
  }
  var presets = {
    sealed: function(){ pickOne("product", "sealed"); setAll("rarity", []); setAll("focus", []); pickOne("length", "standard"); },
    chase: function(){ pickOne("product", "singles"); setAll("rarity", ["Special Illustration Rare", "Illustration Rare"]); setAll("focus", []); pickOne("length", "glance"); },
    vintage: function(){ pickOne("product", "singles"); setAll("focus", ["vintage"]); },
    completer: function(){ pickOne("product", "singles"); setAll("focus", []); pickOne("length", "standard"); pickOne("length", "deep"); }
  };
  var dayButtons = form.querySelectorAll("[data-days]");
  for (var d = 0; d < dayButtons.length; d++) {
    dayButtons[d].addEventListener("click", function(ev){
      var mode = ev.currentTarget.getAttribute("data-days");
      ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].forEach(function(w){
        pickOne("len_" + w, mode === "weekday-glance" && w !== "sat" && w !== "sun" ? "glance" : "");
      });
    });
  }
  var buttons = form.querySelectorAll(".rd-preset[data-preset]");
  for (var b = 0; b < buttons.length; b++) {
    buttons[b].addEventListener("click", function(ev){
      var id = ev.currentTarget.getAttribute("data-preset");
      if (!presets[id]) return;
      presets[id]();
      for (var k = 0; k < buttons.length; k++) buttons[k].setAttribute("aria-pressed", buttons[k] === ev.currentTarget ? "true" : "false");
      var note = document.getElementById("rd-preset-note");
      if (note) note.textContent = (ev.currentTarget.getAttribute("title") || "") + " Tap Save to keep it.";
      paint();
    });
  }
})();
</script>
${beacon}
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
  if (!row || typeof row !== "object") return blankPlan();
  return { ...row, email: "" };
}

export async function handleReads(request, env, fetchImpl = fetch) {
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
      back.searchParams.set("note", "closed");
      return Response.redirect(back, 303);
    }
    return json({ ok: false, error: "Reads are not open yet." }, 503);
  }
  let fields;
  if (form) fields = new URLSearchParams(await request.text());
  else {
    try { fields = await request.json(); } catch { return json({ ok: false, error: "Bad read." }, 400); }
  }
  const raw = planFromFields(fields);
  const { plan, notes } = gatePlan(raw, { premium: user.premium === true });
  plan.savedAt = new Date().toISOString();
  let emailState = "";
  const armed = emailSendAllowed(env);
  if (!armed && !raw.email) {
    const prior = await store.get(`reads:${user.sub}`, "json");
    plan.channels.email = prior?.channels?.email === true;
    if (prior?.length && !raw.length) plan.length = cleanLength(prior.length, user.premium === true);
    if (prior?.lengthByDay && !Object.keys(raw.lengthByDay || {}).length) plan.lengthByDay = cleanLengthByDay(prior.lengthByDay, user.premium === true);
  } else if (plan.channels.email) {
    emailState = await rememberEmail(store, user.sub, raw.email, env, fetchImpl, new URL(request.url).origin);
  } else if (raw.channels?.email === true) {
    emailState = "bad";
  } else {
    await clearEmailChoice(store, user.sub);
  }
  await store.put(`reads:${user.sub}`, JSON.stringify(plan));
  const follow = planToFollow(user.sub, plan);
  const prev = await store.get(FOLLOWS_KEY, "json");
  await store.put(FOLLOWS_KEY, JSON.stringify(upsertFollow(prev, follow)));
  if (form) {
    back.searchParams.set("saved", "1");
    if (emailState) back.searchParams.set("email", emailState);
    return Response.redirect(back, 303);
  }
  return json({ ok: true, plan, notes, pipe: readsPipeReady(env), emailArmed: emailSendAllowed(env), email: emailState });
}

export async function handleReadsClick(request, env) {
  if (request.method !== "POST") return json({ ok: false, error: "Use POST." }, 405);
  const user = await readUser(request, env);
  if (!user?.sub) return json({ ok: false, error: "Sign in with Discord." }, 401);
  const store = env?.FEED_KV;
  if (!store) return json({ ok: false, stored: false });
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
