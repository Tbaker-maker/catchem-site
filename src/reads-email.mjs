// Custom Reads by email. Off unless the READS_EMAIL_KEY worker secret is set
// (Resend API key) and READS_EMAIL_ENABLED is not "off". Addresses, confirm
// state and the last sent day live only in FEED_KV under reads-email:<id>.
// Nothing here is written to git, logged, or sent to the nightly. The key is
// never echoed. One email per member per day at most, from the same outbox
// the nightly already builds for the Discord DMs.

import { FOLLOWS_KEY, OUTBOX_KEY, cleanOutbox } from "./reads-pipe.mjs";
import { banGuard } from "./advice-rules.mjs";
import { ebaySearchUrl, tcgStoreUrl, SHOP_NOTE, setAffiliateConfig } from "./pokemon.mjs";
import { AFFILIATION, TCGPLAYER_ATTRIBUTION } from "./affiliation.mjs";
import { loadJson } from "./data.mjs";

const GUARD = banGuard("email read");
export const EMAIL_KEY_PREFIX = "reads-email:";
export const SITE = "https://catchemtcg.com";
export const DEFAULT_FROM = "Catch'em reads <reads@catchemtcg.com>";
export const RESEND_URL = "https://api.resend.com/emails";
const CONFIRM_TTL_MS = 48 * 3600 * 1000;
const UNSUB_TTL_MS = 400 * 24 * 3600 * 1000;
const CONFIRM_GAP_MS = 10 * 60 * 1000;
const MAX_READS = 5;
// A morning brief. Nothing goes out before this UTC hour (14 is 7 AM PT).
const SEND_HOUR_UTC = 14;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// The switch. The key alone turns it on; READS_EMAIL_ENABLED=off is the kill switch.
export function emailDeliveryOn(env) {
  if (!env) return false;
  if (!String(env.READS_EMAIL_KEY || "").trim()) return false;
  if (String(env.READS_EMAIL_ENABLED || "").trim().toLowerCase() === "off") return false;
  if (!String(env.SESSION_SECRET || "").trim()) return false;
  return true;
}

export function cleanEmail(value) {
  const s = String(value || "").trim().toLowerCase();
  if (s.length < 6 || s.length > 254) return "";
  if (!/^[a-z0-9._%+'-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,24}$/.test(s)) return "";
  if (s.includes("..")) return "";
  return s;
}

export function memberKey(id) {
  const clean = String(id || "").replace(/^d:/, "").replace(/[^0-9A-Za-z_-]/g, "").slice(0, 32);
  return clean ? EMAIL_KEY_PREFIX + clean : "";
}

export function maskEmail(email) {
  const s = cleanEmail(email);
  if (!s) return "";
  const [user, host] = s.split("@");
  return user.charAt(0) + "\u2022\u2022\u2022@" + host;
}

export function dayLabel(day) {
  const m = String(day || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? MONTHS[Number(m[2]) - 1] + " " + Number(m[3]) : "";
}

export function subjectFor(day) {
  const when = dayLabel(day);
  return when ? "Your Catch'em reads, " + when : "Your Catch'em reads";
}

// ---------- signed tokens (confirm and unsubscribe) ----------

const enc = new TextEncoder();
function b64url(bytes) {
  let bin = "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s) {
  const pad = String(s).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "===".slice((pad.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function hmacB64(secret, text) {
  const key = await crypto.subtle.importKey("raw", enc.encode(String(secret)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(text)));
}
export async function emailHash(email) {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode("reads-email|" + cleanEmail(email)));
  return b64url(digest).slice(0, 22);
}
function signingSecret(env) {
  return String(env?.SESSION_SECRET || "");
}

export async function makeToken(env, purpose, id, email, now = Date.now()) {
  const secret = signingSecret(env);
  if (!secret) return "";
  const ttl = purpose === "confirm" ? CONFIRM_TTL_MS : UNSUB_TTL_MS;
  const body = b64url(enc.encode(JSON.stringify({ p: purpose, id: String(id), h: await emailHash(email), exp: now + ttl })));
  return body + "." + (await hmacB64(secret, purpose + "|" + body));
}

export async function readToken(env, purpose, token, now = Date.now()) {
  const secret = signingSecret(env);
  const raw = String(token || "");
  const dot = raw.lastIndexOf(".");
  if (!secret || dot < 1) return null;
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const want = await hmacB64(secret, purpose + "|" + body);
  if (want.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff) return null;
  let doc;
  try { doc = JSON.parse(new TextDecoder().decode(fromB64url(body))); } catch { return null; }
  if (!doc || doc.p !== purpose || !doc.id || !doc.h) return null;
  if (!(Number(doc.exp) > now)) return null;
  return { id: String(doc.id), h: String(doc.h) };
}

export function confirmUrl(token) { return SITE + "/reads/email/confirm?t=" + encodeURIComponent(token); }
export function unsubUrl(token) { return SITE + "/reads/email/unsubscribe?t=" + encodeURIComponent(token); }

// ---------- copy checks ----------

export function cleanCopy(text) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (!s) return false;
  if (/[\u2013\u2014]/.test(s)) return false;
  if (/\bsold\b|\bsales?\b/i.test(s)) return false;
  if (s.toLowerCase().includes(["no", "data"].join(" "))) return false;
  if (GUARD.test(s)) return false;
  return true;
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

// ---------- reads for one member ----------

export function isHeld(row, holdIds) {
  const id = String(row?.cardId || row?.sku || "");
  if (id && holdIds && holdIds[id]) return true;
  const text = [row?.line, row?.headline, row?.blurb].join(" ");
  return /price being checked/i.test(text);
}

function chipHit(chipDoc, readId, sku) {
  const byId = chipDoc?.byId || {};
  const bySku = chipDoc?.bySku || {};
  const pick = (row) => (row && Array.isArray(row.signals) && row.signals.length ? row : null);
  return pick(readId && byId[readId]) || pick(sku && bySku[sku]) || null;
}

// The feed read for this product, so the email links to the same /feed/r/ page.
export function feedIndex(bundle, holdIds) {
  const map = new Map();
  const stale = new Set((bundle?.priceStaleIds || []).map(String));
  for (const read of bundle?.reads || []) {
    const sku = String(read?.sku || "");
    if (!sku || !read?.id || map.has(sku)) continue;
    if (stale.has(String(read.id)) || read.stale) continue;
    if (holdIds && holdIds[sku]) continue;
    map.set(sku, read);
  }
  return map;
}

// A short, specific story line for a read. Never the generic chip blurb
// ("TCGplayer market is up 18% over 7 days"). The feed headline wins when it
// says something specific; otherwise the dated fact line from the nightly.
const GENERIC = /^(TCGplayer market|Listings counted) (is|are) (up|down|flat)\b/i;
export function storyLine(feedHeadline, line) {
  const head = String(feedHeadline || "").replace(/\s+/g, " ").trim();
  const fact = String(line || "").replace(/\s+/g, " ").trim();
  const pick = head && !GENERIC.test(head) && head !== fact ? head.replace(/^[A-Z][a-z]+ watch:\s*/, "") : fact;
  return shortStory(pick);
}

// Keep it short: the first sentence when the whole thing runs long.
export function shortStory(text) {
  const s = String(text || "").trim();
  if (s.length <= 150) return s;
  const m = s.match(/^(.{40,}?[.])\s+(?=[A-Z])/);
  return m && m[1].length <= 200 ? m[1] : s;
}

function pctOf(text) {
  const m = String(text || "").match(/(\d+(?:\.\d+)?)\s*%/);
  return m ? m[1] : "";
}
function daysOf(text) {
  const m = String(text || "").match(/(\d+)\s*D\b/i);
  return m ? m[1] : "7";
}

// One or two key signals, written as plain words. Supply leads.
export function signalWords(signals) {
  const out = [];
  const list = Array.isArray(signals) ? signals : [];
  const listing = list.find((s) => s && s.kind === "listings");
  if (listing) {
    const t = String(listing.text || "");
    const pct = pctOf(t);
    const days = /\b(\d+)\s*d\b/i.test(t) ? t.match(/\b(\d+)\s*d\b/i)[1] + "d" : "";
    const down = /\u25BC|\bdown\b|-\s*\d/i.test(t);
    const up = /\u25B2|\bup\b|\+\s*\d/i.test(t);
    if (pct && (up || down)) out.push((down ? "Listings draining" : "Listings stacking") + ", " + (down ? "down " : "up ") + pct + "%" + (days ? " in " + days : ""));
    else if (pct) out.push("Listings counted flat");
  }
  const move = list.find((s) => s && s.kind === "move" && s.dir !== "dash");
  if (move) {
    const pct = pctOf(move.text);
    const days = daysOf(move.text);
    if (move.dir === "up" && pct) out.push("Price up " + pct + "% in " + days + " days");
    else if (move.dir === "down" && pct) out.push("Price down " + pct + "% in " + days + " days");
    else out.push("Price flat over " + days + " days");
  }
  if (out.length < 2) {
    const mom = list.find((s) => s && s.kind === "momentum" && s.word);
    if (mom && String(mom.word).toLowerCase() !== "flat") out.push("Momentum " + String(mom.word).toLowerCase());
  }
  if (out.length < 2) {
    const gone = list.find((s) => s && s.kind === "gone");
    if (gone) out.push("Listings going " + String(gone.word || "steady").toLowerCase());
  }
  return out.slice(0, 2);
}

function titleOf(row, feed) {
  const raw = String(feed?.name || row?.name || "").replace(/\s+-\s+/g, " ").replace(/\s+/g, " ").trim();
  return raw.length <= 90 ? raw : "";
}

export function enrichRead(row, ctx = {}) {
  if (!row || typeof row !== "object") return null;
  const line = String(row.line || "").replace(/\s+/g, " ").trim();
  if (!line || line.length > 220) return null;
  if (isHeld(row, ctx.holdIds)) return null;
  const sku = /^tcgcsv-\d+$/.test(String(row.cardId || "")) ? String(row.cardId) : "";
  const feed = sku && ctx.feed ? ctx.feed.get(sku) : null;
  const chip = chipHit(ctx.chipDoc, feed?.id, sku);
  if ((chip?.signals || []).some((s) => s && s.kind === "move" && s.dir === "dash")) return null;
  const story = storyLine(feed?.headline, line);
  const title = titleOf(row, feed);
  const words = signalWords(chip?.signals);
  if (isHeld({ line: story, headline: title }, null)) return null;
  for (const text of [story, title, ...words].filter(Boolean)) if (!cleanCopy(text)) return null;
  let href = SITE + "/feed";
  if (feed?.id) href = SITE + "/feed/r/" + encodeURIComponent(feed.id);
  else if (sku) href = SITE + "/c/" + encodeURIComponent(sku);
  else if (row.set) href = SITE + "/sets/" + encodeURIComponent(String(row.set));
  const sealed = row.kind === "sealed";
  const shop = sku ? { tcg: tcgStoreUrl({ id: sku }), ebay: ebaySearchUrl({ name: row.name || feed?.name || "", kind: sealed ? "sealed" : "single" }) } : null;
  const move = (chip?.signals || []).find((s) => s && s.kind === "move" && (s.dir === "up" || s.dir === "down"));
  const size = move ? Number(pctOf(move.text)) || 0 : 0;
  return { title, story, words, href, shop, sealed, size, moveWord: move ? words.find((w) => w.startsWith("Price ")) || "" : "" };
}

// The top move for the greeting: the biggest price move among the picked reads.
export function topMove(reads) {
  const best = [...(reads || [])].filter((r) => r.size > 0 && r.moveWord && r.title).sort((a, b) => b.size - a.size)[0];
  if (best) return "Top move: " + best.title + ", " + best.moveWord.charAt(0).toLowerCase() + best.moveWord.slice(1) + ".";
  return reads?.[0]?.story || "";
}

export function memberEmail(member, ctx = {}) {
  const reads = [];
  for (const row of member?.reads || []) {
    const hit = enrichRead(row, ctx);
    if (hit) reads.push(hit);
    if (reads.length >= MAX_READS) break;
  }
  const extra = (rows) => (rows || []).filter((r) => r && cleanCopy(r.headline) && cleanCopy(r.line) && /^https:\/\//.test(String(r.url || ""))).slice(0, 2);
  const news = extra(member?.news);
  const games = extra(member?.games);
  if (!reads.length && !news.length && !games.length) return null;
  const top = topMove(reads);
  return { top: cleanCopy(top) ? top : "", reads, news, games };
}

// ---------- email markup: a morning brief (tables and inline styles for Gmail) ----------

const C = {
  page: "#f4f2ee", card: "#ffffff", ink: "#1c1c1e", dim: "#48484a", soft: "#8e8e93", line: "#e7e3dc",
  gold: "#8a6a2f", goldBg: "#fbf6ec",
};
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function smallButton(href, label, dark) {
  const bg = dark ? C.ink : C.card;
  const fg = dark ? "#ffffff" : C.ink;
  const border = dark ? C.ink : "#cfcac2";
  return `<td style="padding:0 8px 0 0"><a href="${esc(href)}" target="_blank" rel="sponsored noopener" class="${dark ? "ce-btn-dark" : "ce-btn-light"}" style="display:inline-block;min-height:44px;line-height:44px;padding:0 16px;border-radius:999px;background:${bg};border:1px solid ${border};color:${fg};font:600 14px/44px ${FONT};text-decoration:none;white-space:nowrap">${esc(label)}</a></td>`;
}
function button(href, label, dark) { return smallButton(href, label, dark); }

function readBlock(read, i, total) {
  const shopBits = [];
  if (read.shop?.tcg) shopBits.push(smallButton(read.shop.tcg, "Buy on TCGplayer", true));
  if (read.shop?.ebay) shopBits.push(smallButton(read.shop.ebay, "Buy on eBay", false));
  const shop = shopBits.length ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 0"><tr>${shopBits.join("")}</tr></table>` : "";
  const words = read.words.length ? `<p class="ce-gold" style="margin:8px 0 0;font:600 13px/1.4 ${FONT};color:${C.gold}">${read.words.map(esc).join(" &middot; ")}</p>` : "";
  const rule = i < total - 1 ? `border-bottom:1px solid ${C.line};` : "";
  return `<tr><td class="ce-rule" style="padding:18px 20px;${rule}">
${read.title ? `<p class="ce-ink" style="margin:0 0 4px;font:700 16px/1.3 ${FONT};color:${C.ink}">${esc(read.title)}</p>` : ""}
<p class="ce-dim" style="margin:0;font:400 15px/1.5 ${FONT};color:${C.dim}">${esc(read.story)}</p>
${words}
<p style="margin:6px 0 0"><a href="${esc(read.href)}" target="_blank" class="ce-ink" style="display:inline-block;min-height:44px;line-height:44px;font:600 15px/44px ${FONT};color:${C.ink};text-decoration:underline">See the read</a></p>
${shop}
</td></tr>`;
}

function extraBlock(title, rows) {
  if (!rows?.length) return "";
  const items = rows.map((r) => `<p class="ce-dim" style="margin:0 0 10px;font:400 15px/1.45 ${FONT};color:${C.dim}"><a href="${esc(r.url)}" target="_blank" class="ce-ink" style="color:${C.ink};font-weight:600;text-decoration:none">${esc(r.headline)}</a><br>${esc(r.line)}</p>`).join("");
  return `<tr><td style="padding:16px 20px;border-top:1px solid ${C.line}"><p style="margin:0 0 10px;font:600 12px/1 ${FONT};letter-spacing:.06em;text-transform:uppercase;color:${C.soft}">${esc(title)}</p>${items}</td></tr>`;
}

function shell({ title, preheader, body, footer }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${esc(title)}</title>
<style>
:root{color-scheme:light dark;supported-color-schemes:light dark}
@media (prefers-color-scheme: dark){.ce-page{background:#111111 !important}.ce-card{background:#1c1c1e !important;border-color:#2c2c2e !important}.ce-brief{background:#2a2419 !important;border-color:#2c2c2e !important}.ce-ink{color:#f2f2f7 !important}.ce-dim{color:#c7c7cc !important}.ce-gold{color:#d9b779 !important}.ce-rule{border-color:#2c2c2e !important}.ce-btn-dark{background:#f2f2f7 !important;color:#1c1c1e !important;border-color:#f2f2f7 !important}.ce-btn-light{background:#1c1c1e !important;color:#f2f2f7 !important;border-color:#48484a !important}}
</style></head>
<body style="margin:0;padding:0;background:${C.page}" class="ce-page">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader || "")}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" class="ce-page" style="background:${C.page}"><tr><td align="center" style="padding:20px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px">
${body}
<tr><td style="padding:16px 8px 28px;font:400 12px/1.5 ${FONT};color:${C.soft}">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

function card(inner) {
  return `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.card}" class="ce-card" style="background:${C.card};border:1px solid ${C.line};border-radius:20px">${inner}</table></td></tr>`;
}

export function renderReadsEmail(doc, { day, unsubscribe, manage = SITE + "/reads" } = {}) {
  const when = dayLabel(day);
  const brand = `<tr><td style="padding:4px 8px 14px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${C.ink}" style="background:${C.ink};border-radius:10px;width:28px;height:28px;text-align:center;font:800 15px/28px ${FONT};color:#d9b779">C</td><td class="ce-ink" style="padding-left:10px;font:700 16px/1 ${FONT};color:${C.ink}">Catch'em</td></tr></table></td></tr>`;
  const greet = `<tr><td class="ce-brief" bgcolor="${C.goldBg}" style="padding:22px 20px 18px;background:${C.goldBg};border-radius:20px 20px 0 0;border-bottom:1px solid ${C.line}">
<p class="ce-gold" style="margin:0;font:600 12px/1 ${FONT};letter-spacing:.06em;text-transform:uppercase;color:${C.gold}">${esc(when ? "Morning brief, " + when : "Morning brief")}</p>
<h1 class="ce-ink" style="margin:8px 0 0;font:700 22px/1.3 ${FONT};color:${C.ink}">Good morning. Here are your reads.</h1>
${doc.top ? `<p class="ce-dim" style="margin:8px 0 0;font:400 15px/1.45 ${FONT};color:${C.dim}">${esc(doc.top)}</p>` : ""}
</td></tr>`;
  const reads = doc.reads.map((r, i) => readBlock(r, i, doc.reads.length)).join("");
  const body = brand + card(greet + reads + extraBlock("Pokemon news", doc.news) + extraBlock("Video games", doc.games));
  const footer = [
    `<span style="color:${C.soft}">${esc(SHOP_NOTE)}</span>`,
    `TCGplayer market and eBay listings counted${when ? ", " + esc(when) : ""}. ${esc(TCGPLAYER_ATTRIBUTION)}`,
    `<a href="${esc(unsubscribe)}" style="color:${C.soft};text-decoration:underline">Unsubscribe</a> &nbsp;&middot;&nbsp; <a href="${esc(manage)}" style="color:${C.soft};text-decoration:underline">Change your reads</a>`,
  ].map((line) => `<p style="margin:0 0 6px;color:${C.soft}">${line}</p>`).join("");
  return shell({ title: subjectFor(day), preheader: doc.top || doc.reads[0]?.story || "", body, footer });
}

export function readsEmailText(doc, { day, unsubscribe } = {}) {
  const when = dayLabel(day);
  const out = ["Good morning. Here are your Catch'em reads" + (when ? " for " + when : "") + "."];
  if (doc.top) out.push(doc.top);
  out.push("");
  for (const r of doc.reads) {
    if (r.title) out.push(r.title);
    out.push(r.story);
    if (r.words.length) out.push(r.words.join(" \u00B7 "));
    out.push("See the read: " + r.href);
    if (r.shop?.tcg) out.push("Buy on TCGplayer: " + r.shop.tcg);
    if (r.shop?.ebay) out.push("Buy on eBay: " + r.shop.ebay);
    out.push("");
  }
  for (const [title, rows] of [["Pokemon news", doc.news], ["Video games", doc.games]]) {
    if (!rows?.length) continue;
    out.push(title);
    for (const r of rows) out.push(r.headline, r.line, r.url, "");
  }
  out.push(SHOP_NOTE, "Unsubscribe: " + unsubscribe, "Change your reads: " + SITE + "/reads");
  return out.join("\n");
}

export function renderConfirmEmail(link) {
  const inner = `<tr><td style="padding:22px 20px">
<p style="margin:0;font:600 12px/1 ${FONT};letter-spacing:.06em;text-transform:uppercase;color:${C.gold}">Catch'em</p>
<h1 class="ce-ink" style="margin:8px 0 8px;font:700 22px/1.3 ${FONT};color:${C.ink}">Confirm your email</h1>
<p class="ce-dim" style="margin:0 0 16px;font:400 15px/1.45 ${FONT};color:${C.dim}">Tap the button to get your Custom Reads by email. Nothing is sent until you confirm. The link works for 48 hours.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${button(link, "Confirm email", true)}</tr></table>
<p style="margin:14px 0 0;font:400 13px/1.45 ${FONT};color:${C.soft}">If you did not ask for this, you can ignore this email.</p>
</td></tr>`;
  return shell({ title: "Confirm your Catch'em reads email", preheader: "One tap and your reads come by email.", body: card(inner), footer: `<p style="margin:0">${esc(AFFILIATION)}</p>` });
}


// ---------- sending ----------

export async function sendEmail(env, msg, fetchImpl = fetch) {
  const key = String(env?.READS_EMAIL_KEY || "").trim();
  if (!key) return { ok: false, why: "off" };
  const res = await fetchImpl(RESEND_URL, {
    method: "POST",
    headers: { authorization: "Bearer " + key, "content-type": "application/json", ...(msg.idem ? { "idempotency-key": msg.idem } : {}) },
    body: JSON.stringify({ from: String(env?.READS_EMAIL_FROM || DEFAULT_FROM), to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text, headers: msg.headers || {} }),
  });
  return { ok: res.ok, status: res.status };
}

export async function sendConfirm(env, id, email, { now = Date.now(), fetchImpl = fetch } = {}) {
  const token = await makeToken(env, "confirm", id, email, now);
  const link = confirmUrl(token);
  return sendEmail(env, {
    to: email,
    subject: "Confirm your Catch'em reads email",
    html: renderConfirmEmail(link),
    text: "Tap to get your Catch'em reads by email: " + link + "\nNothing is sent until you confirm. The link works for 48 hours.",
  }, fetchImpl);
}

// Save on /reads. Email on: store pending and send a confirm link (spaced 10 minutes).
// Email off: drop the row. Returns a short state word for the page.
export async function saveEmailChoice(env, id, { want, email }, { now = Date.now(), fetchImpl = fetch } = {}) {
  const store = env?.FEED_KV;
  const key = memberKey(id);
  if (!store || !key || !emailDeliveryOn(env)) return "off";
  const prev = await store.get(key, "json");
  if (!want) {
    if (prev) await store.delete(key);
    return prev ? "stopped" : "none";
  }
  const addr = cleanEmail(email);
  if (!addr) return "bad";
  if (prev && prev.email === addr && prev.confirmed === true) return "on";
  const same = prev && prev.email === addr;
  if (same && now - Date.parse(prev.confirmSentAt || 0) < CONFIRM_GAP_MS) return "sent";
  const row = { email: addr, confirmed: false, askedAt: new Date(now).toISOString(), confirmSentAt: new Date(now).toISOString(), lastSentDay: same ? prev.lastSentDay || "" : "", lastSentAt: same ? prev.lastSentAt || "" : "" };
  await store.put(key, JSON.stringify(row));
  const sent = await sendConfirm(env, String(id).replace(/^d:/, ""), addr, { now, fetchImpl }).catch(() => ({ ok: false }));
  return sent.ok ? "sent" : "fail";
}

export async function loadEmailRow(env, id) {
  const key = memberKey(id);
  if (!env?.FEED_KV || !key) return null;
  const row = await env.FEED_KV.get(key, "json");
  return row && typeof row === "object" ? row : null;
}

async function setFollowEmail(store, id, on) {
  const doc = await store.get(FOLLOWS_KEY, "json");
  if (!doc || !Array.isArray(doc.follows)) return;
  let hit = false;
  const follows = doc.follows.map((row) => {
    if (!row || String(row.id) !== String(id)) return row;
    hit = true;
    return { ...row, email: on };
  });
  if (hit) await store.put(FOLLOWS_KEY, JSON.stringify({ ...doc, follows }));
}

async function setPlanEmail(store, id, on) {
  for (const key of ["reads:d:" + id, "reads:" + id]) {
    const plan = await store.get(key, "json");
    if (plan && typeof plan === "object") {
      await store.put(key, JSON.stringify({ ...plan, channels: { ...(plan.channels || {}), email: on } }));
    }
  }
}

function page(title, text, status = 200) {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title></head>
<body style="margin:0;background:${C.page};font-family:${FONT};color:${C.ink}"><main style="max-width:440px;margin:0 auto;padding:40px 16px">
<div style="background:#fff;border-radius:22px;padding:22px 20px"><p style="margin:0;font-weight:600;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:${C.gold}">Catch'em</p><h1 style="font-size:24px;margin:8px 0">${esc(title)}</h1><p style="margin:0 0 16px;color:${C.dim};font-size:16px;line-height:1.45">${esc(text)}</p>
<a href="/reads" style="display:inline-block;min-height:44px;line-height:44px;padding:0 20px;border-radius:999px;background:${C.ink};color:#fff;text-decoration:none;font-weight:600">Your reads</a></div>
<p style="color:${C.soft};font-size:12px;margin:16px 4px">${esc(AFFILIATION)}</p></main></body></html>`;
  return new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
}

export function isEmailPath(pathname) {
  return pathname === "/reads/email/confirm" || pathname === "/reads/email/unsubscribe";
}

// GET confirm: one tap turns email on. GET or POST unsubscribe: one tap turns it off.
export async function handleEmailLink(request, env, { now = Date.now() } = {}) {
  const url = new URL(request.url);
  const store = env?.FEED_KV;
  if (!store) return page("Not open yet", "Email reads are not open yet.", 503);
  if (url.pathname === "/reads/email/confirm") {
    if (request.method !== "GET") return page("Use the link", "Open the link from your email.", 405);
    if (!emailDeliveryOn(env)) return page("Email delivery is coming soon", "Your reads still come by Discord DM.");
    const tok = await readToken(env, "confirm", url.searchParams.get("t"), now);
    const row = tok ? await loadEmailRow(env, tok.id) : null;
    if (!tok || !row || (await emailHash(row.email)) !== tok.h) return page("This link has run out", "Save your reads again on catchemtcg.com/reads and we will send a fresh link.", 400);
    if (row.confirmed !== true) {
      await store.put(memberKey(tok.id), JSON.stringify({ ...row, confirmed: true, confirmedAt: new Date(now).toISOString() }));
      await setFollowEmail(store, tok.id, true);
    }
    return page("Email reads are on", "Your next read comes by email after the next nightly run, on the schedule you picked.");
  }
  if (request.method !== "GET" && request.method !== "POST") return page("Use the link", "Open the link from your email.", 405);
  const tok = await readToken(env, "unsub", url.searchParams.get("t"), now);
  if (!tok) return page("This link has run out", "You can turn email off on catchemtcg.com/reads.", 400);
  const row = await loadEmailRow(env, tok.id);
  if (row && (await emailHash(row.email)) === tok.h) {
    await store.delete(memberKey(tok.id));
    await setFollowEmail(store, tok.id, false);
    await setPlanEmail(store, tok.id, false);
  }
  if (request.method === "POST") return new Response("Unsubscribed", { status: 200, headers: { "cache-control": "no-store" } });
  return page("You are unsubscribed", "No more reads by email. You can turn it back on from Your reads at any time.");
}

// ---------- the hourly delivery ----------

export function utcDay(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

export function canSend(row, outboxDay, now = Date.now()) {
  if (!row || row.confirmed !== true || !cleanEmail(row.email)) return false;
  if (row.lastOutboxDay && row.lastOutboxDay === outboxDay) return false;
  if (row.lastSentAt && utcDay(Date.parse(row.lastSentAt)) === utcDay(now)) return false;
  if (row.lastSentAt && now - Date.parse(row.lastSentAt) < 20 * 3600 * 1000) return false;
  return true;
}

async function loadContext(fetchImpl) {
  const [bundle, chipDoc, hold] = await Promise.all([
    loadJson("reads.json", fetchImpl).catch(() => null),
    loadJson("signal-chips.json", fetchImpl).catch(() => null),
    loadJson("price-hold.json", fetchImpl).catch(() => null),
  ]);
  const holdIds = hold?.ids && typeof hold.ids === "object" ? hold.ids : {};
  return { holdIds, chipDoc, feed: feedIndex(bundle, holdIds) };
}

export async function buildMessage(env, member, ctx, day, now = Date.now()) {
  const doc = memberEmail(member, ctx);
  if (!doc) return null;
  const id = String(member.discordId || "").replace(/^d:/, "");
  const row = ctx.rows?.get(id);
  const token = await makeToken(env, "unsub", id, row?.email || "", now);
  const unsubscribe = unsubUrl(token);
  return {
    to: row?.email || "",
    subject: subjectFor(day),
    html: renderReadsEmail(doc, { day, unsubscribe }),
    text: readsEmailText(doc, { day, unsubscribe }),
    headers: { "List-Unsubscribe": "<" + unsubscribe + ">", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    idem: "reads-" + id + "-" + day,
  };
}

export async function runEmailDelivery(env, { now = Date.now(), fetchImpl = fetch, publicFetch } = {}) {
  if (!emailDeliveryOn(env)) return { skipped: "off", sent: 0 };
  const store = env?.FEED_KV;
  if (!store) return { skipped: "storage", sent: 0 };
  const outbox = cleanOutbox(await store.get(OUTBOX_KEY, "json"));
  if (!outbox || !outbox.members.length) return { skipped: "empty", sent: 0 };
  const hour = Number.isInteger(Number(env?.READS_EMAIL_HOUR_UTC)) && String(env?.READS_EMAIL_HOUR_UTC ?? "") !== "" ? Number(env.READS_EMAIL_HOUR_UTC) : SEND_HOUR_UTC;
  if (new Date(now).getUTCHours() < hour) return { skipped: "before morning", sent: 0 };
  const age = now - Date.parse(outbox.day + "T00:00:00Z");
  if (!(age >= -86400000 && age < 2 * 86400000)) return { skipped: "stale", sent: 0 };
  const follows = await store.get(FOLLOWS_KEY, "json");
  const wantEmail = new Set((follows?.follows || []).filter((f) => f && f.email === true).map((f) => String(f.id)));
  const rows = new Map();
  for (const m of outbox.members) {
    const id = String(m.discordId || "");
    if (!wantEmail.has(id)) continue;
    const row = await loadEmailRow(env, id);
    if (canSend(row, outbox.day, now)) rows.set(id, row);
  }
  if (!rows.size) return { skipped: "none due", sent: 0 };
  setAffiliateConfig(env);
  const ctx = { ...(await loadContext(publicFetch || fetchImpl)), rows };
  let sent = 0;
  let failed = 0;
  for (const m of outbox.members) {
    const id = String(m.discordId || "");
    if (!rows.has(id)) continue;
    const msg = await buildMessage(env, m, ctx, outbox.day, now);
    if (!msg || !msg.to) continue;
    const res = await sendEmail(env, msg, fetchImpl).catch(() => ({ ok: false }));
    if (!res.ok) { failed++; continue; }
    sent++;
    await store.put(memberKey(id), JSON.stringify({ ...rows.get(id), lastOutboxDay: outbox.day, lastSentDay: utcDay(now), lastSentAt: new Date(now).toISOString() }));
  }
  return { sent, failed, day: outbox.day };
}
