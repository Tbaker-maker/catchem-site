// Ideas and post text. Facts come from the catalog. No key is sent to the browser.
// Prompt follows docs/access-and-ai-search/POST-TEXT-STYLE-GUIDE.md.

import { editionLabel, priceLine } from "./post-copy.mjs";
import { commit, peek, readUser } from "./quota.mjs";

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

export const STYLE_PROMPT = `You write short social copy for Catch'em, a Pokémon TCG collector site. Write as a real collector talking to collectors, rippers, and flippers: warm, specific, and a little fun. Lead with a concrete supplied fact.

SOURCE OF TRUTH — USE ONLY THESE SUPPLIED FACTS:
{facts}

REQUESTED TONE:
{tone}

REQUESTED PLATFORM:
{platform}

NON-NEGOTIABLE RULES:
- Use only the facts in SOURCE OF TRUTH. Never invent or look up a card, price, date, artist, set, number, or claim.
- Always spell Pokémon with the accent.
- If a price is supplied, write it as “TCGplayer market: [price] ([date])”. Never use a price without its date. If either is missing, omit the price.
- Never use investment language: buy, sell, hold, floor, target, plays, picks, bullish, bearish, invest, ROI, or “to the moon.” Do not use crypto, NFT, or Web3 language.
- Do not promise a future price, pull, grade, or outcome.
- Return exactly 3 clearly different variations for the platform.
- X: each variation is at most 280 characters.
- This prompt follows POST-TEXT-STYLE-GUIDE.md.`;

let liteCache = null;
let pocketCache = null;
let asOfCache = "";

export function resetCatalogCache() {
  liteCache = null;
  pocketCache = null;
  asOfCache = "";
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

export async function factsFor(ids, fetchImpl) {
  const date = await asOf(fetchImpl);
  const want = new Set((ids || []).map(String));
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
  return { asOf: date, cards: out };
}

function lineOf(card) {
  const bits = [card.name, card.printing, card.edition].filter(Boolean);
  if (card.artist) bits.push("art by " + card.artist);
  if (card.price && card.price !== "No market price") bits.push(card.price);
  return bits.join(". ") + ".";
}

export function factIdeas(cards) {
  return (cards || []).slice(0, 3).map((card, i) => {
    const lead = ["Notable print", "Same catalog row", "Read the printing"][i] || "Catalog row";
    return `${lead}: ${lineOf(card)}`;
  });
}

export function factPost(cards) {
  const card = cards && cards[0];
  if (!card) return [];
  const price = card.price && card.price !== "No market price" ? card.price : "";
  const artist = card.artist ? ` Art by ${card.artist}.` : "";
  const a = `${card.name}, ${card.printing}, ${card.edition}.${artist}${price ? " " + price + "." : ""}`.replace(/\s+/g, " ").trim();
  const b = `${card.edition} printing ${card.printing}. ${card.name}.${artist}${price ? " " + price + "." : ""}`.replace(/\s+/g, " ").trim();
  const c = [card.name, card.edition, price].filter(Boolean).join(" — ") + ".";
  return [a, b, c].map((t) => t.slice(0, 280));
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
  const parts = String(text || "").split(/\n+/).map((s) => s.replace(/^\s*\d+[\).\s-]+/, "").trim()).filter(Boolean);
  return parts.slice(0, 3);
}

export async function handleIdeas(request, env, fetchImpl = fetch) {
  const userGate = peek(await (await import("./quota.mjs")).readUser(request, env), "ideas");
  if (!userGate.ok) return json(userGate, userGate.status);
  let body = {};
  try { body = await request.json(); } catch { body = {}; }
  const facts = await factsFor(body.ids || [], fetchImpl);
  if (!facts.cards.length) return json({ ok: false, error: "No catalog rows for those ids." }, 400);
  let ideas = null;
  const drafted = await modelText(env, "Give exactly 3 short catalog ideas. Use only the JSON facts. No prices you were not given. Spell Pokémon with the accent.", JSON.stringify(facts), env.AI_IDEAS_MODEL || "grok-3");
  if (drafted) {
    const parts = splitThree(drafted);
    if (parts.length === 3 && parts.every((p) => acceptable(p, facts.cards))) ideas = parts;
  }
  if (!ideas) ideas = factIdeas(facts.cards);
  const { readUser } = await import("./quota.mjs");
  commit(await readUser(request, env), "ideas");
  return json({ ok: true, ideas, asOf: facts.asOf, model: drafted ? "catalog-model" : "fact-pack" });
}

export async function handlePostText(request, env, fetchImpl = fetch) {
  const { readUser } = await import("./quota.mjs");
  const user = await readUser(request, env);
  const userGate = peek(user, "post-text");
  if (!userGate.ok) return json(userGate, userGate.status);
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
  if (!variations) variations = factPost(facts.cards);
  commit(user, "post-text");
  return json({ ok: true, variations, asOf: facts.asOf, model });
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
