// Ideas and post text. Facts come from the catalog. No key is sent to the browser.
// Prompt follows docs/access-and-ai-search/POST-TEXT-STYLE-GUIDE.md.

import { editionLabel, priceLine } from "./post-copy.mjs";
import { commit, ideasSignInLine, peek, readUser, usageOf } from "./quota.mjs";
import { discordReady, INVITE_LINE, officeAllowed } from "./auth.mjs";

const LITE = "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/research/assets/public/search-lite.json";
const POCKET = "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/data/pocket-catalogue.json";
const COUNTS = "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/research/assets/public/counts.json";

const BANNED = new RegExp(
  "\\b(buy|sell|sold|hold|floor|target|plays|picks|bullish|bearish|invest|roi|crypto|nft|web3)\\b|to the moon|"
  + ["sells", "for"].join(" ") + "|"
  + ["about", "0"].join(" ") + "|"
  + "catalog" + "ue",
  "i",
);
const POST_MODEL = "grok-4.20-0309-non-reasoning";

export const STYLE_PROMPT = `You write short social copy for Catch'em, a Pokémon TCG collector site. Write as a real collector talking to collectors, rippers, and flippers: warm, specific, conversational, and a little fun. Lead with a concrete fact when possible: artist, set, card number, pull rate, or current TCGplayer market price.

SOURCE OF TRUTH — USE ONLY THESE SUPPLIED FACTS:
{facts}

REQUESTED TONE:
{tone}

REQUESTED PLATFORM:
{platform}

NON-NEGOTIABLE RULES:
- Use only the facts in SOURCE OF TRUTH. Never invent or look up a card, product, price, date, pull rate, artist, set, number, or claim.
- Always spell Pokémon with the accent.
- If a price is supplied, write it as "TCGplayer market: [price] ([date])", using the supplied price and date. Never use a price without its supplied date. If either is missing, omit the price.
- Never use investment language: buy, sell, hold, floor, target, plays, picks, bullish, bearish, invest, ROI, or "to the moon." Do not use crypto, NFT, or Web3 language.
- Do not promise or guarantee a future price, pull, grade, value, or outcome.
- Do not use generic hype without a concrete detail.
- Do not browse or rely on outside knowledge.
- Return exactly 3 clearly different variations. Keep every variation factual and within the requested platform format.

FORMAT REQUIREMENTS:
- X: each variation is at most 280 characters and has 1-2 relevant hashtags when hashtags fit.
- Instagram: each variation has one hook line, then 2-4 short lines, and no more than 8 hashtags.
- TikTok: each variation is at most 150 characters.
- YouTube: each variation has a title of at most 70 characters and a description of exactly 3 short lines.
- Discord: each variation is a compact, conversational post with short paragraphs or bullets as useful.

TONE GUIDANCE:
- hype = energetic but specific, not shouty
- chill = low-key and appreciative
- funny = light and observant; the joke must be anchored to a supplied detail
- informative = clear, useful, and concise

Output only the 3 variations. Label them Variation 1, Variation 2, and Variation 3. Do not add a preface, explanation, fact check, or extra variation.
This prompt follows POST-TEXT-STYLE-GUIDE.md.`;

let liteCache = null;
let pocketCache = null;
let asOfCache = "";
let paperIdMap = null;

export function resetCatalogCache() {
  liteCache = null;
  pocketCache = null;
  asOfCache = "";
  paperIdMap = null;
}

async function loadLite(fetchImpl) {
  if (liteCache) return liteCache;
  const res = await fetchImpl(LITE);
  if (!res.ok) throw new Error("catalog");
  liteCache = await res.json();
  return liteCache;
}

export async function pocketRows(fetchImpl) {
  if (pocketCache) return pocketCache;
  const res = await fetchImpl(POCKET);
  if (!res.ok) return [];
  const data = await res.json();
  pocketCache = Object.entries(data.cards || {}).map(([id, c]) => [
    id,
    c.name || "",
    c.setName || "",
    c.number || "",
    c.artist || "",
    "pocket",
    0,
    c.setId || "",
    c.rarity || "",
    c.image || "",
  ]);
  return pocketCache;
}

async function asOf(fetchImpl) {
  if (asOfCache) return asOfCache;
  try {
    const res = await fetchImpl(COUNTS);
    const data = await res.json();
    asOfCache = String(data.asOf || "").slice(0, 10);
  } catch {
    asOfCache = "";
  }
  return asOfCache;
}

export function rowFact(row, date) {
  const labels = editionLabel(row);
  const price = row[5] === "pocket" ? "No market price" : priceLine(row[6], date);
  return {
    id: row[0],
    name: row[1],
    edition: labels.edition,
    printing: labels.printing,
    artist: row[4] || "",
    kind: row[5],
    price,
  };
}

async function ensurePaperMap(fetchImpl) {
  if (paperIdMap) return paperIdMap;
  paperIdMap = new Map();
  try {
    const { patchedPaper } = await import("./full-editor.mjs");
    const rows = JSON.parse(await patchedPaper(fetchImpl));
    for (const row of rows) if (row && row[0] && row[22]) paperIdMap.set(String(row[0]), String(row[22]));
  } catch { /* catalog id map stays empty */ }
  return paperIdMap;
}

async function resolveIds(ids, fetchImpl) {
  const list = (ids || []).map(String).filter(Boolean).slice(0, 4);
  const direct = list.filter((id) => id.startsWith("tcgcsv-") || id.startsWith("tcgp-"));
  const paper = list.filter((id) => !id.startsWith("tcgcsv-") && !id.startsWith("tcgp-"));
  if (!paper.length) return direct;
  await ensurePaperMap(fetchImpl);
  const extra = paper.map((id) => paperIdMap.get(id)).filter(Boolean);
  return [...new Set(direct.concat(extra))];
}

function catalogId(id) {
  const s = String(id);
  if (s.startsWith("tcgcsv-") || s.startsWith("tcgp-")) return s;
  return paperIdMap ? (paperIdMap.get(s) || "") : "";
}

export async function factsFor(ids, fetchImpl) {
  const date = await asOf(fetchImpl);
  const requested = (ids || []).map(String).filter(Boolean).slice(0, 4);
  const resolved = await resolveIds(requested, fetchImpl);
  const want = new Set(resolved);
  const out = [];
  if ([...want].some((id) => id.startsWith("tcgcsv-"))) {
    const lite = await loadLite(fetchImpl);
    for (const row of lite) {
      if (want.has(row[0])) out.push(rowFact(row, date));
    }
  }
  if ([...want].some((id) => id.startsWith("tcgp-"))) {
    const pocket = await pocketRows(fetchImpl);
    for (const row of pocket) {
      if (want.has(row[0])) out.push(rowFact(row, date));
    }
  }
  const byId = new Map(out.map((card) => [card.id, card]));
  const pins = requested.map((id) => {
    const cat = catalogId(id);
    return { id, card: (cat && byId.get(cat)) || null };
  });
  return { asOf: date, cards: out, pins };
}

function lineOf(card) {
  const bits = [card.name, card.printing, card.edition].filter(Boolean);
  if (card.artist) bits.push("art by " + card.artist);
  if (card.price && card.price !== "No market price") bits.push(card.price);
  return bits.join(". ") + ".";
}

export function factIdeas(cards, pins) {
  const rows = Array.isArray(cards) ? cards.filter(Boolean) : [];
  const asked = Array.isArray(pins) ? pins : [];
  const byId = new Map(rows.map((card) => [String(card.id), card]));
  const parts = [];
  if (asked.length) {
    for (const pin of asked) {
      const id = String(pin && pin.id != null ? pin.id : pin || "");
      if (!id) continue;
      const card = (pin && pin.card) || byId.get(id) || null;
      parts.push(card && card.name ? lineOf(card) : "No catalog row for " + id + ".");
    }
  } else {
    for (const card of rows) parts.push(lineOf(card));
  }
  if (!parts.length) return [];
  const all = parts.join(" ");
  return [
    `Notable Pokémon print: ${all}`,
    `Same Pokémon catalog row: ${all}`,
    `Pinned Pokémon cards: ${all}`,
  ];
}

function detail(card) {
  const bits = [card.name];
  if (card.printing && card.printing !== "Printing not labeled") bits.push(card.printing);
  if (card.edition && card.edition !== "Edition not labeled") bits.push(card.edition);
  if (card.artist) bits.push("art by " + card.artist);
  return bits.filter(Boolean).join(", ");
}

function toneLines(card, tone) {
  const base = detail(card);
  if (tone === "hype") {
    return [
      `${base}. That Pokémon artwork still knows how to stop a binder page.`,
      `A whole table leans in for this Pokémon. ${base}.`,
      `${base}. Worth a second look in the Pokémon binder.`,
    ];
  }
  if (tone === "chill") {
    return [
      `${base}. A Pokémon card to slow down and look at.`,
      `Quietly one of those Pokémon binder cards. ${base}.`,
      `${base}. Easy to sit with, Pokémon and all.`,
    ];
  }
  if (tone === "funny") {
    return [
      `${base}. The Pokémon binder page has entered its dramatic era.`,
      `${base}. Every other Pokémon card just asked for the same spotlight.`,
      `${base}. Pokémon, and a little theatrical about it.`,
    ];
  }
  return [
    `${base}. A clean Pokémon note for the binder.`,
    `Card details, Pokémon: ${base}.`,
    `${base}. Useful Pokémon reference, and nothing extra.`,
  ];
}

function fitLine(sentence, price) {
  let text = String(sentence || "").replace(/\s+/g, " ").trim();
  if (price) {
    const tail = " " + price + ".";
    const room = 280 - tail.length;
    if (text.length > room) text = text.slice(0, Math.max(0, room)).replace(/\s+\S*$/, "").trim();
    text = (text + tail).replace(/\s+/g, " ").trim();
  } else if (text.length > 280) {
    text = text.slice(0, 277).replace(/\s+\S*$/, "").trim() + "…";
  }
  return text;
}

export function factPost(cards, tone = "informative") {
  const list = cards || [];
  const card = list[0];
  if (!card) return [];
  const price = card.price && card.price !== "No market price" ? card.price : "";
  const mood = ["hype", "chill", "funny", "informative"].includes(tone) ? tone : "informative";
  const lines = toneLines(card, mood);
  if (list[1]) {
    const extra = lineOf(list[1]).replace(/\.$/, "");
    lines[2] = `${lines[2].replace(/\.$/, "")} Also ${extra}.`;
  }
  return lines.map((line) => fitLine(line, price));
}

export function acceptable(text, cards) {
  const body = String(text || "");
  if (!body.trim() || BANNED.test(body)) return false;
  const allowed = new Set((cards || []).map((c) => c.price).filter((p) => p && p.startsWith("TCGplayer market:")));
  const found = body.match(/TCGplayer market:[^.]*/g) || [];
  return found.every((hit) => [...allowed].some((ok) => hit.includes(ok.replace("TCGplayer market: ", "")) || hit.trim() === ok));
}

async function modelText(env, system, user, model) {
  const key = env && (env.AI_API_KEY || env.XAI_API_KEY);
  if (!key) return null;
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { authorization: "Bearer " + key, "content-type": "application/json" },
    body: JSON.stringify({
      model: model || "grok-3",
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || null;
}

function splitThree(text) {
  const parts = String(text || "").split(/\n+/).map((s) => s.replace(/^\s*(variation\s*)?\d+[\).:\s-]*/i, "").trim()).filter(Boolean);
  return parts.slice(0, 3);
}

export async function handleIdeas(request, env, fetchImpl = fetch) {
  const user = await readUser(request, env);
  if (!officeAllowed(user, env)) {
    return json({ ok: false, signedIn: !!user, line: INVITE_LINE, ready: discordReady(env) }, 403);
  }
  const userGate = peek(user, "ideas");
  if (!userGate.ok) return json({ ...userGate, line: ideasSignInLine(discordReady(env)), ready: discordReady(env) }, userGate.status);
  let body = {};
  try { body = await request.json(); } catch { body = {}; }
  const facts = await factsFor(body.ids || [], fetchImpl);
  if (!facts.cards.length) {
    const missing = (facts.pins || []).map((pin) => "No catalog row for " + pin.id + ".");
    return json({ ok: false, error: missing.length ? missing.join(" ") : "No catalog rows for those ids." }, 400);
  }
  let ideas = null;
  let fromModel = false;
  const drafted = await modelText(env, "Give exactly 3 short catalog ideas. Use only the JSON facts. No prices you were not given. Spell Pokémon with the accent. Do not use investment language.", JSON.stringify(facts), env.AI_IDEAS_MODEL || "grok-3");
  if (drafted) {
    const parts = splitThree(drafted);
    if (parts.length === 3 && parts.every((p) => acceptable(p, facts.cards))) {
      ideas = parts;
      fromModel = true;
    }
  }
  if (!ideas) ideas = factIdeas(facts.cards, facts.pins);
  commit(user, "ideas");
  return json({ ok: true, ideas, asOf: facts.asOf, quota: usageOf(user, "ideas"), model: fromModel ? "catalog-model" : "fact-pack" });
}

export async function handlePostText(request, env, fetchImpl = fetch) {
  const user = await readUser(request, env);
  if (!officeAllowed(user, env)) {
    return json({ ok: false, signedIn: !!user, line: INVITE_LINE, ready: discordReady(env) }, 403);
  }
  const userGate = peek(user, "post-text");
  if (!userGate.ok) return json({ ...userGate, line: ideasSignInLine(discordReady(env)), ready: discordReady(env) }, userGate.status);
  let body = {};
  try { body = await request.json(); } catch { body = {}; }
  const facts = await factsFor((body.ids || []).slice(0, 4), fetchImpl);
  if (!facts.cards.length) return json({ ok: false, error: "No catalog rows for those ids." }, 400);
  const tone = ["hype", "chill", "funny", "informative"].includes(body.tone) ? body.tone : "informative";
  const platform = ["x", "instagram", "tiktok", "youtube", "discord"].includes(body.platform) ? body.platform : "x";
  const system = STYLE_PROMPT.replace("{facts}", JSON.stringify(facts)).replace("{tone}", tone).replace("{platform}", platform);
  const drafted = await modelText(env, system, "Write the 3 variations now.", env.AI_MODEL || POST_MODEL);
  let variations = null;
  let model = "fact-pack";
  if (drafted) {
    const parts = splitThree(drafted);
    if (parts.length === 3 && parts.every((p) => acceptable(p, facts.cards))) {
      variations = parts;
      model = env.AI_MODEL || POST_MODEL;
    }
  }
  if (!variations) variations = factPost(facts.cards, tone);
  commit(user, "post-text");
  return json({ ok: true, variations, asOf: facts.asOf, tone, quota: usageOf(user, "post-text"), model });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function handleVideoQuota(request, env) {
  const { readUser } = await import("./quota.mjs");
  const user = await readUser(request, env);
  let body = {};
  try { body = await request.json(); } catch { body = {}; }
  const gate = peek(user, "video");
  if (!gate.ok) return json({ ...gate, weekUsed: gate.weekUsed || 0, dayUsed: gate.dayUsed || 0, premium: false }, gate.status);
  if (body.action === "complete") commit(user, "video");
  const after = peek(user, "video");
  return json({
    ok: true,
    signedIn: true,
    premium: user.premium === true,
    dayUsed: after.dayUsed,
    weekUsed: after.weekUsed,
    dayCap: after.dayCap,
    weekCap: after.weekCap,
  });
}
