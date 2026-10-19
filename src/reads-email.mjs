// Custom Reads email. Addresses live only in FEED_KV. Nothing here is written
// to the public repo. Sending stays off until the worker secret READS_EMAIL_KEY
// is set (a Resend API key). The key is never logged.

import { isClean } from "./advice-rules.mjs";
import { SHOP_NOTE, ebaySearchUrl, setAffiliateConfig, tcgStoreUrl } from "./pokemon.mjs";
import { WEEKDAY_NAMES, darkCss, articleForPlan, articleText, cleanLength, followFromPlan, loadContext, renderArticle } from "./reads-article.mjs";

export const EMAIL_FROM = "Catch'em <reads@catchemtcg.com>";
export const EMAIL_KEY = "READS_EMAIL_KEY";
const ORIGIN = "https://catchemtcg.com";

export function emailSendAllowed(env) {
  return !!(env && String(env[EMAIL_KEY] || "").trim());
}

export function validEmail(value) {
  const email = String(value || "").trim().toLowerCase().slice(0, 120);
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) return "";
  if (email.includes("..")) return "";
  return email;
}

export function emailKey(discordId) {
  const id = String(discordId || "").replace(/^d:/, "");
  return /^\d{5,25}$/.test(id) ? `reads-email:${id}` : "";
}

export function maskEmail(value) {
  const email = validEmail(value);
  const at = email.indexOf("@");
  if (at < 1) return "";
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

function sameText(a, b) {
  const x = String(a || "");
  const y = String(b || "");
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return diff === 0;
}

async function hmacHex(secret, body) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function mailSecret(env) {
  const token = String(env?.CUSTOM_READS_TOKEN || "");
  if (token.length >= 32) return token;
  const key = String(env?.[EMAIL_KEY] || "");
  return key.length >= 32 ? key : "";
}

export function readsDateLabel(day) {
  const m = String(day || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[Number(m[2]) - 1];
  if (!month) return "";
  return `${month} ${Number(m[3])}, ${m[1]}`;
}

export function readsSubject(day) {
  const label = readsDateLabel(day);
  return label ? `Your Catch'em reads, ${label}` : "Your Catch'em reads";
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

function scrub(value, sealed = false) {
  let text = String(value || "").replace(/[\u2013\u2014]/g, ", ").replace(/\s+/g, " ").trim();
  if (sealed) {
    text = text
      .replace(/\s*\((?:NM|Near Mint)\)/gi, "")
      .replace(/\bNear Mint\b/gi, "")
      .replace(/\bNM\b/g, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([.,])/g, "$1")
      .trim();
  }
  return text;
}

function shopFor(row, sealed) {
  const name = scrub(row?.name || "", sealed);
  const card = {
    id: String(row?.cardId || ""),
    name,
    set: scrub(row?.setName || "", sealed),
    num: String(row?.number || "").trim(),
    kind: sealed ? "sealed" : "single",
  };
  if (!card.id && !card.name) return { tcg: "", ebay: "" };
  return {
    tcg: tcgStoreUrl(card) || "",
    ebay: card.name ? (ebaySearchUrl(card) || "") : "",
  };
}

// A held card, or a line that says the price is being checked, is not a read.
export function normalizeEmailRead(row) {
  if (!row || typeof row !== "object") return null;
  if (row.held === true || row.priceHeld === true || row.priceStatus === "checking" || row.priceStatus === "held") return null;
  const sealed = row.kind === "sealed";
  const headline = scrub(row.headline || row.name || "", sealed);
  const blurb = scrub(row.blurb || row.line || "", sealed);
  const blob = `${headline} ${blurb}`;
  if (/price being checked/i.test(blob)) return null;
  if (!headline && !blurb) return null;
  if (/[\u2013\u2014]/.test(headline + blurb)) return null;
  if (/\b(sold|sales)\b/i.test(blob)) return null;
  const chips = [];
  // Same tag and stage words as the site tiles, only when one fired.
  const tl = row.tiles && typeof row.tiles === "object" ? row.tiles : {};
  for (const word of [tl.listings?.tag?.word, tl.listings?.stage?.word, tl.price?.stage?.word]) {
    if (/^(Few sellers hold most|Spread out|Building|Slowing|Stalled|Reversing)$/.test(String(word || "")) && !chips.some((c) => c.text === word)) chips.push({ text: word });
  }
  for (const chip of row.signals || row.chips || []) {
    if (!chip || chip.kind === "dash" || chip.dir === "dash") continue;
    const text = scrub(chip.text || chip.word || chip.badge || chip.tag || "", sealed);
    if (!text || /price being checked/i.test(text) || /\b(sold|sales)\b/i.test(text)) continue;
    // No strength dots. The site shows data bars on the chip itself.
    chips.push({ text });
    if (chips.length >= 4) break;
  }
  const id = String(row.readId || "").trim();
  const href = /^[A-Za-z0-9._:-]{3,80}$/.test(id) ? `${ORIGIN}/feed/r/${encodeURIComponent(id)}` : "";
  const shops = shopFor(row, sealed);
  const title = headline || blurb;
  const body = blurb && blurb !== title ? blurb : "";
  return {
    headline: title,
    blurb: body,
    chips,
    href,
    tcgUrl: /^https:\/\//.test(shops.tcg) ? shops.tcg : "",
    ebayUrl: /^https:\/\//.test(shops.ebay) ? shops.ebay : "",
    kind: sealed ? "sealed" : "card",
  };
}

export function attachFeed(rows, feedReads) {
  const bySku = new Map();
  for (const read of feedReads || []) {
    const sku = String(read?.sku || "");
    if (!/^tcgcsv-\d+$/.test(sku) || bySku.has(sku)) continue;
    if (read.held === true || read.priceStatus === "checking" || read.priceStatus === "held") continue;
    const blob = `${read.headline || ""} ${read.blurb || ""}`;
    if (/price being checked/i.test(blob)) continue;
    bySku.set(sku, read);
  }
  return (rows || []).map((row) => {
    const hit = row?.cardId ? bySku.get(String(row.cardId)) : null;
    if (!hit) return row;
    return {
      ...row,
      readId: String(hit.id || ""),
      headline: row.headline || hit.headline || row.name || "",
      blurb: row.blurb || hit.blurb || row.line || "",
      signals: Array.isArray(hit.signals) ? hit.signals : row.signals,
      tiles: hit.tiles && typeof hit.tiles === "object" ? hit.tiles : row.tiles,
    };
  });
}

function chipHtml(chip) {
  return `<span class="ce-tile ce-ink" style="display:inline-block;min-height:32px;line-height:32px;padding:0 12px;margin:0 6px 6px 0;border-radius:999px;background:#f2f2f7;color:#1c1c1e;font:600 13px/32px Arial,Helvetica,sans-serif;">${esc(chip.text)}</span>`;
}

function button(href, label, light = false) {
  const bg = light ? "#f2f2f7" : "#1c1c1e";
  const color = light ? "#1c1c1e" : "#ffffff";
  return `<a href="${esc(href)}" class="${light ? "ce-btn-light" : "ce-btn-dark"}" style="display:inline-block;min-height:44px;line-height:44px;padding:0 16px;margin:0 8px 8px 0;border-radius:999px;background:${bg};color:${color};text-decoration:none;font:600 15px/44px Arial,Helvetica,sans-serif;">${esc(label)}</a>`;
}

export function readsEmailHtml({ lead, day, reads, stopUrl }) {
  const when = readsDateLabel(day);
  const cards = (reads || []).map((read) => {
    const title = read.href
      ? `<a href="${esc(read.href)}" class="ce-ink" style="color:#1c1c1e;text-decoration:none;">${esc(read.headline)}</a>`
      : esc(read.headline);
    const open = read.href ? `<p style="margin:8px 0 0;">${button(read.href, "Open this read", true)}</p>` : "";
    const shops = [
      read.tcgUrl ? button(read.tcgUrl, "Buy on TCGplayer") : "",
      read.ebayUrl ? button(read.ebayUrl, "Buy on eBay") : "",
    ].join("");
    const note = shops ? `<p class="ce-soft" style="margin:4px 0 0;color:#8e8e93;font:13px/1.4 Arial,Helvetica,sans-serif;">${esc(SHOP_NOTE)}</p>` : "";
    const blurb = read.blurb ? `<p class="ce-dim" style="margin:8px 0 0;color:#3a3a3c;font:15px/1.45 Arial,Helvetica,sans-serif;">${esc(read.blurb)}</p>` : "";
    const chips = read.chips?.length ? `<p style="margin:10px 0 0;">${read.chips.map(chipHtml).join("")}</p>` : "";
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="ce-card" style="margin:0 0 12px;background:#ffffff;border-radius:22px;"><tr><td style="padding:18px 16px;"><h2 class="ce-ink" style="margin:0;font:700 20px/1.3 Arial,Helvetica,sans-serif;color:#1c1c1e;">${title}</h2>${chips}${blurb}${open}${shops ? `<p style="margin:12px 0 0;">${shops}</p>` : ""}${note}</td></tr></table>`;
  }).join("");
  const stop = stopUrl
    ? `<p class="ce-soft" style="margin:16px 0 0;color:#8e8e93;font:13px/1.45 Arial,Helvetica,sans-serif;">You follow this read. <a href="${esc(stopUrl)}" style="color:#636366;">Unsubscribe</a></p>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${esc(readsSubject(day))}</title>
<style>:root{color-scheme:light dark;supported-color-schemes:light dark}
${darkCss()}
</style></head>
<body class="ce-page" style="margin:0;padding:0;background:#f2f2f7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="ce-page" style="background:#f2f2f7;"><tr><td align="center" style="padding:16px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;"><tr><td class="ce-ink ce-brand" style="padding:8px 6px 14px;font:700 15px/1.2 Arial,Helvetica,sans-serif;color:#1c1c1e;">Catch'em${when ? `<span class="ce-soft" style="float:right;color:#8e8e93;font-weight:500;">${esc(when)}</span>` : ""}</td></tr>
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="ce-card" style="background:#ffffff;border-radius:22px;margin:0 0 12px;"><tr><td style="padding:18px 16px;"><p class="ce-ink" style="margin:0;font:700 22px/1.3 Arial,Helvetica,sans-serif;color:#1c1c1e;">${esc(lead || readsSubject(day))}</p></td></tr></table>
${cards}
${stop}
</td></tr></table>
</td></tr></table></body></html>`;
}

export function readsEmailText({ lead, day, reads, stopUrl }) {
  const parts = [lead || readsSubject(day)];
  for (const read of reads || []) {
    const chips = (read.chips || []).map((chip) => chip.text).join(", ");
    const lines = [read.headline, chips, read.blurb, read.href, read.tcgUrl ? "Buy on TCGplayer" : "", read.ebayUrl ? "Buy on eBay" : ""].filter(Boolean);
    if (read.tcgUrl || read.ebayUrl) lines.push(SHOP_NOTE);
    parts.push(lines.join("\n"));
  }
  if (stopUrl) parts.push(`Unsubscribe: ${stopUrl}`);
  return parts.join("\n\n").trim();
}

export function emailCopyOk(text) {
  const body = String(text || "");
  if (!body || /[\u2013\u2014]/.test(body)) return false;
  if (/\b(sold|sales)\b/i.test(body)) return false;
  if (/price being checked/i.test(body)) return false;
  const chunks = body.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return chunks.every((line) => isClean(line));
}

export function listHeaders(stopUrl) {
  if (!/^https:\/\/catchemtcg\.com\/reads\/email\/stop\?/.test(String(stopUrl || ""))) return {};
  return {
    "List-Unsubscribe": `<${stopUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export async function emailLink(env, origin, purpose, discordId, email) {
  const secret = mailSecret(env);
  const id = String(discordId || "").replace(/^d:/, "");
  const to = validEmail(email);
  if (!secret || !/^\d{5,25}$/.test(id) || !to) return "";
  const mac = await hmacHex(secret, `${purpose}:${id}:${to}`);
  const path = purpose === "stop" ? "/reads/email/stop" : "/reads/email/confirm";
  const url = new URL(path, origin || ORIGIN);
  url.searchParams.set("id", id);
  url.searchParams.set("t", mac);
  return url.toString();
}

export async function emailLinkOk(env, purpose, discordId, email, mac) {
  const secret = mailSecret(env);
  const id = String(discordId || "").replace(/^d:/, "");
  const to = validEmail(email);
  if (!secret || !to) return false;
  const expect = await hmacHex(secret, `${purpose}:${id}:${to}`);
  return sameText(expect, String(mac || "").trim());
}

async function postResend({ env, to, subject, html, text, headers, fetchImpl }) {
  const key = String(env?.[EMAIL_KEY] || "").trim();
  if (!key || !validEmail(to)) return false;
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [validEmail(to)],
        subject,
        html,
        text,
        headers: headers || {},
      }),
    });
    return !!res?.ok;
  } catch {
    return false;
  }
}

export async function sendConfirmEmail({ env, store, id, email, origin, fetchImpl = fetch }) {
  if (!emailSendAllowed(env)) return false;
  const confirmUrl = await emailLink(env, origin, "confirm", id, email);
  const stopUrl = await emailLink(env, origin, "stop", id, email);
  if (!confirmUrl || !stopUrl) return false;
  const lead = "Confirm this email to get your Catch'em reads.";
  const html = readsEmailHtml({
    lead,
    day: "",
    reads: [{
      headline: "Open the confirm link",
      blurb: "Nothing is sent until you open this link. You can stop mail from any letter.",
      chips: [],
      href: confirmUrl,
      tcgUrl: "",
      ebayUrl: "",
    }],
    stopUrl,
  }).replaceAll("Open this read", "Confirm this email");
  const text = `${lead}\n\n${confirmUrl}\n\nUnsubscribe: ${stopUrl}`;
  if (!emailCopyOk(text)) return false;
  const ok = await postResend({
    env,
    to: email,
    subject: "Confirm your Catch'em reads email",
    html,
    text,
    headers: listHeaders(stopUrl),
    fetchImpl,
  });
  if (!ok || !store) return ok;
  const rec = await store.get(emailKey(id), "json");
  if (rec && validEmail(rec.email) === validEmail(email)) {
    rec.confirmSentAt = new Date().toISOString();
    await store.put(emailKey(id), JSON.stringify(rec));
  }
  return ok;
}

export async function emailView(store, sub) {
  const key = emailKey(sub);
  if (!store || !key) return { status: "", email: "" };
  const rec = await store.get(key, "json");
  const email = validEmail(rec?.email);
  if (!email) return { status: "", email: "" };
  const status = rec.status === "confirmed" || rec.status === "pending" || rec.status === "stopped" ? rec.status : "";
  return { status, email };
}

export async function rememberEmail(store, sub, rawEmail, env, fetchImpl = fetch, origin = ORIGIN) {
  const key = emailKey(sub);
  const id = String(sub || "").replace(/^d:/, "");
  const email = validEmail(rawEmail);
  if (!store || !key || !email) return "bad";
  const prev = await store.get(key, "json");
  const same = prev && validEmail(prev.email) === email;
  let status = "pending";
  if (same && prev.status === "confirmed") status = "confirmed";
  const rec = {
    email,
    status,
    updatedAt: new Date().toISOString(),
    confirmedAt: status === "confirmed" ? (prev?.confirmedAt || new Date().toISOString()) : "",
    confirmSentAt: status === "pending" && same ? (prev?.confirmSentAt || "") : (status === "confirmed" ? (prev?.confirmSentAt || "") : ""),
  };
  await store.put(key, JSON.stringify(rec));
  if (status === "confirmed") return "confirmed";
  if (!emailSendAllowed(env)) return "off";
  if (rec.confirmSentAt) return "pending";
  await sendConfirmEmail({ env, store, id, email, origin, fetchImpl });
  return "pending";
}

export async function clearEmailChoice(store, sub) {
  const key = emailKey(sub);
  if (!store || !key) return;
  const prev = await store.get(key, "json");
  if (!prev) return;
  prev.status = "stopped";
  prev.updatedAt = new Date().toISOString();
  await store.put(key, JSON.stringify(prev));
}

function notePage(title, text) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title></head><body style="margin:0;background:#f2f2f7;color:#1c1c1e;font:16px/1.45 Arial,Helvetica,sans-serif"><main style="max-width:440px;margin:0 auto;padding:28px 16px"><section style="background:#ffffff;border-radius:22px;padding:22px"><h1 style="margin:0 0 8px;font-size:28px;">${esc(title)}</h1><p style="margin:0 0 16px;">${esc(text)}</p><a href="/reads" style="display:inline-block;min-height:44px;line-height:44px;padding:0 18px;border-radius:999px;background:#1c1c1e;color:#ffffff;text-decoration:none;font-weight:600;">Back to your reads</a></section><p style="color:#8e8e93;font-size:13px;">Not affiliated with Nintendo, The Pokémon Company, or Creatures.</p></main></body></html>`;
}

function htmlResponse(body) {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}

async function setPlanEmail(store, id, on) {
  const key = `reads:d:${id}`;
  const plan = await store.get(key, "json");
  if (!plan || typeof plan !== "object") return;
  plan.channels = { ...(plan.channels || {}), discord: true, email: on === true };
  plan.email = "";
  await store.put(key, JSON.stringify(plan));
}

// ---------- phase 2: per member read history (FEED_KV only, never an address) ----------

export function statsKey(discordId) {
  const id = String(discordId || "").replace(/^d:/, "");
  return /^\d{5,25}$/.test(id) ? `reads-email-stats:${id}` : "";
}

export async function loadStats(store, id) {
  const key = statsKey(id);
  const row = store && key ? await store.get(key, "json") : null;
  return { sent: Array.isArray(row?.sent) ? row.sent.filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s?.day || ""))) : [], awayDay: String(row?.awayDay || "") };
}

async function saveStats(store, id, stats) {
  const key = statsKey(id);
  if (!store || !key) return;
  await store.put(key, JSON.stringify({ sent: stats.sent.slice(-20), awayDay: stats.awayDay || "", updatedAt: new Date().toISOString() }));
}

export async function recordSend(store, id, entry, away = false) {
  const stats = await loadStats(store, id);
  stats.sent = stats.sent.filter((s) => s.day !== entry.day);
  stats.sent.push({ day: entry.day, length: entry.length || "", weekday: entry.weekday || "", opens: 0 });
  if (away) stats.awayDay = entry.day;
  await saveStats(store, id, stats);
}

// A Read more tap on /reads/brief counts as one open for that send day.
export async function recordOpen(store, id, day) {
  const stats = await loadStats(store, id);
  const hit = stats.sent.find((s) => s.day === day);
  if (!hit) return false;
  hit.opens = Math.min(99, (Number(hit.opens) || 0) + 1);
  await saveStats(store, id, stats);
  return true;
}

const GAP = { daily: 1, weekly: 7, monthly: 31, quarterly: 92 };
function daysBetween(a, b) { return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000); }

// What the article needs from history: the last read day (report card) and,
// when the member missed reads, the day the catch up starts.
export function historyFor(stats, plan, day) {
  const past = stats.sent.filter((s) => s.day < day).sort((a, b) => (a.day < b.day ? -1 : 1));
  if (!past.length) return {};
  const sinceDay = past[past.length - 1].day;
  const gap = daysBetween(sinceDay, day);
  const every = GAP[String(plan?.frequency || "weekly")] || 7;
  let awaySince = "";
  if (gap > every * 2) awaySince = sinceDay; // paused or missed at least one read
  else {
    const lastThree = past.slice(-3);
    const recentAway = stats.awayDay && daysBetween(stats.awayDay, day) < 7;
    if (lastThree.length === 3 && lastThree.every((s) => !(s.opens > 0)) && !recentAway && daysBetween(lastThree[0].day, day) >= 3) awaySince = lastThree[0].day;
  }
  if (awaySince && daysBetween(awaySince, day) > 30) awaySince = new Date(Date.parse(day + "T00:00:00Z") - 30 * 86400000).toISOString().slice(0, 10);
  return { sinceDay, awaySince };
}

const LENGTH_LABEL = { glance: "Glance", standard: "Standard", deep: "Deep dive" };

// Learns your length. Only a suggestion: nothing changes until the member taps.
export function suggestLength(stats, current, premium) {
  const same = stats.sent.filter((s) => s.length === current);
  const last5 = same.slice(-5);
  const opened = (rows) => rows.filter((s) => s.opens > 0).length;
  if (current === "glance" && last5.length >= 3 && opened(last5) >= 3) return { to: "standard", why: `You opened Read more on ${opened(last5)} of your last ${last5.length} Glance reads.` };
  if (current === "standard" && premium && last5.length >= 5 && opened(last5) >= 4) return { to: "deep", why: `You opened ${opened(last5)} of your last ${last5.length} reads on the site.` };
  const last6 = same.slice(-6);
  if ((current === "standard" || current === "deep") && last6.length >= 6 && opened(last6) === 0) return { to: current === "deep" ? "standard" : "glance", why: `You have not opened your last ${last6.length} ${LENGTH_LABEL[current]} reads on the site.` };
  return null;
}

export async function lengthLink(env, origin, discordId, length, weekday = "") {
  const secret = mailSecret(env);
  const id = String(discordId || "").replace(/^d:/, "");
  if (!secret || !/^\d{5,25}$/.test(id) || !LENGTH_LABEL[length] || (weekday && !WEEKDAY_NAMES[weekday])) return "";
  const mac = await hmacHex(secret, `length:${id}:${length}:${weekday}`);
  const url = new URL("/reads/email/length", origin || ORIGIN);
  url.searchParams.set("id", id);
  url.searchParams.set("l", length);
  if (weekday) url.searchParams.set("w", weekday);
  url.searchParams.set("t", mac);
  return url.toString();
}

// GET shows one Switch button; the POST from that button makes the change.
// Mail scanners open links on their own, so a GET never changes the plan.
export async function handleLengthLink(request, env) {
  const url = new URL(request.url);
  const id = String(url.searchParams.get("id") || "");
  const length = String(url.searchParams.get("l") || "");
  const weekday = String(url.searchParams.get("w") || "");
  const mac = String(url.searchParams.get("t") || "");
  const store = env?.FEED_KV;
  const secret = mailSecret(env);
  if (!store || !secret || !/^\d{5,25}$/.test(id) || !LENGTH_LABEL[length] || (weekday && !WEEKDAY_NAMES[weekday])) return htmlResponse(notePage("Not available", "This link is not active."));
  if (!sameText(await hmacHex(secret, `length:${id}:${length}:${weekday}`), mac)) return htmlResponse(notePage("Link not valid", "Change your read length on your reads page."));
  const label = LENGTH_LABEL[length] + (weekday ? ` on ${WEEKDAY_NAMES[weekday]}s` : "");
  if (request.method === "GET") {
    return htmlResponse(notePage(`Switch to ${label}?`, "One tap below. You can change it back any time on your reads page.").replace(
      `<a href="/reads"`,
      `<form method="post" action="${esc(url.pathname + url.search)}" style="margin:0 0 12px"><button type="submit" style="min-height:44px;padding:0 20px;border:0;border-radius:999px;background:#1c1c1e;color:#ffffff;font:600 16px Arial,Helvetica,sans-serif">Switch to ${esc(label)}</button></form><a href="/reads"`,
    ));
  }
  if (request.method !== "POST") return htmlResponse(notePage("Not available", "Open the link from the letter."));
  const plan = await store.get(`reads:d:${id}`, "json");
  if (!plan || typeof plan !== "object") return htmlResponse(notePage("Not available", "Save your reads first."));
  const next = cleanLength(length, plan.deep === true);
  if (weekday) plan.lengthByDay = { ...(plan.lengthByDay || {}), [weekday]: next };
  else plan.length = next;
  await store.put(`reads:d:${id}`, JSON.stringify(plan));
  return htmlResponse(notePage("Length saved", `Your reads are ${LENGTH_LABEL[next]}${weekday ? ` on ${WEEKDAY_NAMES[weekday]}s` : ""} from the next one.`));
}

// Glance "Read more" opens the Standard version on the site. The link is signed
// for one member and one outbox day, and shows no address.
export async function briefLink(env, origin, discordId, day) {
  const secret = mailSecret(env);
  const id = String(discordId || "").replace(/^d:/, "");
  if (!secret || !/^\d{5,25}$/.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(String(day || ""))) return "";
  const mac = await hmacHex(secret, `brief:${id}:${day}`);
  const url = new URL("/reads/brief", origin || ORIGIN);
  url.searchParams.set("id", id);
  url.searchParams.set("d", day);
  url.searchParams.set("t", mac);
  return url.toString();
}

export async function handleBrief(request, env, { fetchImpl = fetch, ctx = null } = {}) {
  const url = new URL(request.url);
  const id = String(url.searchParams.get("id") || "");
  const day = String(url.searchParams.get("d") || "");
  const mac = String(url.searchParams.get("t") || "");
  const store = env?.FEED_KV;
  const secret = mailSecret(env);
  if (!store || !secret || !/^\d{5,25}$/.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return htmlResponse(notePage("Not available", "This link is not active."));
  if (!sameText(await hmacHex(secret, `brief:${id}:${day}`), mac)) return htmlResponse(notePage("Link not valid", "Open the latest read from your email."));
  const outbox = await store.get("custom-reads:outbox", "json");
  if (String(outbox?.day || "") !== day) return htmlResponse(notePage("This read has moved on", "A newer read is out. The Feed has today's moves."));
  const plan = await store.get(`reads:d:${id}`, "json");
  setAffiliateConfig(env);
  let context = ctx;
  if (!context) { try { context = await loadContext(fetchImpl); } catch { context = null; } }
  await recordOpen(store, id, day);
  const stats = await loadStats(store, id);
  const sentRow = stats.sent.find((s) => s.day === day);
  const pageLength = sentRow?.length === "deep" && plan?.deep === true ? "deep" : "standard";
  const doc = await articleForPlan(plan, context, day, pageLength, historyFor(stats, plan, day));
  if (!doc) return htmlResponse(notePage("Quiet day", "Nothing moved enough to write up. The Feed has today's moves."));
  return htmlResponse(renderArticle(doc, { page: true }));
}

export async function handleEmailLink(request, env) {
  const url = new URL(request.url);
  const purpose = url.pathname === "/reads/email/stop" ? "stop" : "confirm";
  if (request.method !== "GET" && request.method !== "POST") return htmlResponse(notePage("Not available", "Open the link from the letter."));
  const id = String(url.searchParams.get("id") || "");
  const mac = String(url.searchParams.get("t") || "");
  const store = env?.FEED_KV;
  const key = emailKey(id);
  if (!store || !key) return htmlResponse(notePage("Not available", "This link is not active."));
  const rec = await store.get(key, "json");
  const email = validEmail(rec?.email);
  if (!email || !await emailLinkOk(env, purpose, id, email, mac)) {
    return htmlResponse(notePage("Link not valid", "This link does not match a saved email. Save again on your reads page."));
  }
  if (purpose === "stop") {
    rec.status = "stopped";
    rec.updatedAt = new Date().toISOString();
    await store.put(key, JSON.stringify(rec));
    await setPlanEmail(store, id, false);
    return htmlResponse(notePage("Email stopped", "You will not get Catch'em reads by email. Discord DMs are unchanged. You can turn email on again from your reads page."));
  }
  rec.status = "confirmed";
  rec.confirmedAt = rec.confirmedAt || new Date().toISOString();
  rec.updatedAt = new Date().toISOString();
  await store.put(key, JSON.stringify(rec));
  await setPlanEmail(store, id, true);
  return htmlResponse(notePage("Email confirmed", "Reads will go out on your schedule. Free is weekly. Premium is daily. At most one letter a day."));
}

function addonCards(member) {
  const out = [];
  for (const row of [...(member?.news || []), ...(member?.games || [])]) {
    const headline = scrub(row?.headline || "");
    const blurb = scrub(row?.line || "");
    const href = /^https:\/\/[^\s<>"]+$/.test(String(row?.url || "")) ? String(row.url) : "";
    if (!headline || !blurb || !href) continue;
    if (/price being checked/i.test(headline + blurb)) continue;
    if (!isClean(headline) || !isClean(blurb)) continue;
    out.push({ headline, blurb, chips: [], href, tcgUrl: "", ebayUrl: "", kind: "card" });
    if (out.length >= 3) break;
  }
  return out;
}

// The approved white card article, built from the member's plan and the public
// dated files. Null when the day is too quiet, so the plain letter goes instead.
export async function articleLetter({ env, id, plan, ctx, day, stopUrl, origin = ORIGIN, stats = { sent: [], awayDay: "" } }) {
  if (!ctx) return null;
  let doc = null;
  const history = historyFor(stats, plan, day);
  try { doc = await articleForPlan(plan, ctx, day, "", history); } catch { doc = null; }
  // Nothing to write up is the quietest day: Glance sends nothing then either.
  if (!doc) return followFromPlan(plan, day).length === "glance" ? { skip: "quiet", length: "glance" } : null;
  // Quiet day mode: Glance sends nothing. A watchlist report card or a catch up still goes.
  if (doc.quiet && doc.length === "glance" && !doc.report && !doc.away) return { skip: "quiet", length: doc.length };
  const more = await briefLink(env, origin, id, day);
  const tip = suggestLength(stats, doc.length, plan?.deep === true);
  const tipHref = tip ? await lengthLink(env, origin, id, tip.to, doc.weekday || "") : "";
  const suggest = tip && tipHref ? { text: `${tip.why} ${LENGTH_LABEL[tip.to]} might suit you${doc.weekday ? ` on ${WEEKDAY_NAMES[doc.weekday]}s` : ""}.`, label: `Try ${LENGTH_LABEL[tip.to]}`, href: tipHref, to: tip.to } : null;
  const html = renderArticle(doc, { unsubscribe: stopUrl, more, suggest });
  const text = articleText(doc, { unsubscribe: stopUrl, more, suggest });
  return { html, text, length: doc.length, weekday: doc.weekday || "", path: doc.path, away: !!doc.away, quiet: !!doc.quiet, suggest };
}

export async function deliverOutboxEmails({ store, env, outbox, fetchImpl = fetch, origin = ORIGIN, feedReads = null, articleCtx = undefined } = {}) {
  if (!emailSendAllowed(env)) return { armed: false, sent: 0, skipped: 0 };
  const day = String(outbox?.day || "");
  if (!store || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return { armed: true, sent: 0, skipped: 0 };
  let feed = feedReads;
  if (!Array.isArray(feed)) {
    try {
      const { loadJson } = await import("./data.mjs");
      const doc = await loadJson("reads.json", fetchImpl);
      feed = Array.isArray(doc?.reads) ? doc.reads : [];
    } catch {
      feed = [];
    }
  }
  let ctx = articleCtx;
  const article = async () => {
    if (ctx === undefined) {
      try { setAffiliateConfig(env); ctx = await loadContext(fetchImpl); } catch { ctx = null; }
    }
    return ctx;
  };
  const ledgerKey = `reads-email-sent:${day}`;
  const prior = await store.get(ledgerKey, "json");
  const ledger = new Set(Array.isArray(prior) ? prior.map(String) : []);
  let sent = 0;
  let skipped = 0;
  for (const member of outbox.members || []) {
    if (sent >= 80) break;
    const id = String(member?.discordId || "");
    if (!/^\d{5,25}$/.test(id)) continue;
    if (ledger.has(id)) { skipped++; continue; }
    const rec = await store.get(emailKey(id), "json");
    const plan = await store.get(`reads:d:${id}`, "json");
    if (plan?.channels?.email !== true) { skipped++; continue; }
    const email = validEmail(rec?.email);
    if (!email || rec.status !== "confirmed") {
      if (email && rec.status === "pending" && !rec.confirmSentAt) {
        await sendConfirmEmail({ env, store, id, email, origin, fetchImpl });
      }
      skipped++;
      continue;
    }
    const stopUrl = await emailLink(env, origin, "stop", id, email);
    if (!stopUrl) { skipped++; continue; }
    const stats = await loadStats(store, id);
    let letter = await articleLetter({ env, id, plan, ctx: await article(), day, stopUrl, origin, stats });
    if (letter?.skip) { skipped++; continue; }
    if (letter && (!emailCopyOk(letter.text) || /[\u2013\u2014]/.test(letter.html))) letter = null;
    if (!letter) {
      const prepared = attachFeed(member.reads || [], feed).map(normalizeEmailRead).filter(Boolean);
      const reads = [...prepared, ...addonCards(member)];
      if (!reads.length) { skipped++; continue; }
      const lead = scrub(member.lead || "") || readsSubject(day);
      letter = { html: readsEmailHtml({ lead, day, reads, stopUrl }), text: readsEmailText({ lead, day, reads, stopUrl }) };
    }
    const { html, text } = letter;
    if (!emailCopyOk(text) || /[\u2013\u2014]/.test(html)) { skipped++; continue; }
    const ok = await postResend({
      env,
      to: email,
      subject: readsSubject(day),
      html,
      text,
      headers: listHeaders(stopUrl),
      fetchImpl,
    });
    if (!ok) { skipped++; continue; }
    ledger.add(id);
    sent++;
    await store.put(ledgerKey, JSON.stringify([...ledger]));
    await recordSend(store, id, { day, length: letter.length || "", weekday: letter.weekday || "" }, letter.away === true);
  }
  return { armed: true, sent, skipped };
}
