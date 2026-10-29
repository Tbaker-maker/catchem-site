// Branded 1200x630 share card. SVG so the worker stays light: no raster
// library, one cached response, the card photo is a same-origin path only.
import { BRAND } from "./brand.mjs";
const ORIGIN = "https://catchemtcg.com";
const ERA_COLOR = {
  "mega evolution": "#7eb6ff",
  "scarlet & violet": "#e23d3d",
  "scarlet and violet": "#e23d3d",
  "sword & shield": "#8eb4e8",
  "sword and shield": "#8eb4e8",
  "sun & moon": "#f0a020",
  "sun and moon": "#f0a020",
  "xy": "#f2d04b",
  "black & white": "#d0d0d0",
  "black and white": "#d0d0d0",
  "heartgold & soulsilver": "#e0b050",
  "diamond & pearl": "#d8b4f8",
  "ex": "#c8a2ff",
  original: "#e8c872",
  neo: "#9fd6c2",
  "promos and extras": BRAND.gold,
};

const xml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "\u0026amp;",
  "<": "\u0026lt;",
  ">": "\u0026gt;",
  '"': "\u0026quot;",
  "'": "\u0026apos;",
}[c]));

export function safeImagePath(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.includes("..") || raw.includes("\\") || raw.includes(" ")) return "";
  let path = raw;
  if (path.startsWith(ORIGIN)) path = path.slice(ORIGIN.length);
  if (!path.startsWith("/")) return "";
  if (/^\/data\/editor\/tcg\/[a-z0-9]+\/[A-Za-z0-9._-]+$/i.test(path)) return path;
  if (/^\/img\/[a-z0-9]+\/logo\.png$/i.test(path)) return path;
  return "";
}

function moneyText(price) {
  const n = Number(price);
  if (!(n > 0)) return "";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function changeText(change) {
  if (change === "" || change == null) return "";
  const n = Number(change);
  if (!Number.isFinite(n)) return "";
  const rounded = Math.round(n * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}%`;
}

function clip(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function kindOf(fields) {
  const k = String(fields && fields.kind || "").toLowerCase();
  if (k === "read") return "read";
  if (k === "set" || k === "done" || k === "complete") return "set";
  return "card";
}

function dayText(value) {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return "";
}

export function shareCardUrl(fields) {
  const q = new URLSearchParams();
  const kind = kindOf(fields);
  q.set("k", kind);
  const name = clip(fields && fields.name, 80);
  if (name) q.set("n", name);
  const num = clip(fields && fields.num, 24);
  if (num && !/^not in the file$/i.test(num)) q.set("num", num);
  const price = moneyText(fields && fields.price);
  if (price) q.set("p", price.replace(/[$,]/g, ""));
  const change = changeText(fields && fields.change);
  if (change) q.set("c", change.replace("%", ""));
  const img = safeImagePath(fields && fields.img);
  if (img) q.set("img", img);
  const setName = clip(fields && fields.setName, 48);
  if (setName) q.set("set", setName);
  const era = clip(fields && fields.era, 32);
  if (era) q.set("era", era);
  if (fields && fields.sealed) q.set("s", "1");
  const day = dayText(fields && fields.date);
  if (day) q.set("d", day);
  return `${ORIGIN}/og/card.svg?${q.toString()}`;
}

export function setCompleteShareUrl(fields = {}) {
  const have = Number(fields.have);
  const total = Number(fields.total);
  const num = Number.isFinite(have) && Number.isFinite(total) && total > 0
    ? `${Math.round(have)}/${Math.round(total)}`
    : "";
  return shareCardUrl({
    kind: "set",
    name: fields.name || fields.setName || "Set complete",
    setName: fields.setName || fields.name || "",
    img: fields.logo || fields.img || "",
    num,
    date: fields.date || fields.asOf || "",
    era: fields.era || "",
  });
}

export function readShareUrl(read) {
  if (!read || typeof read !== "object") return "";
  return shareCardUrl({
    kind: "read",
    name: read.name || read.headline || "",
    num: read.number || "",
    price: read.price,
    change: read.changePct,
    img: read.image,
    setName: read.set || "",
  });
}

function setCompleteSvg(q) {
  const name = clip(q.get("n") || q.get("set"), 80) || "Set complete";
  const setName = clip(q.get("set"), 48) || name;
  const num = clip(q.get("num"), 24);
  const day = dayText(q.get("d"));
  const img = safeImagePath(q.get("img"));
  const era = clip(q.get("era"), 32);
  const eraColor = ERA_COLOR[era.toLowerCase()] || BRAND.gold;
  const logo = img
    ? `<image href="${xml(ORIGIN + img)}" x="420" y="150" width="360" height="160" preserveAspectRatio="xMidYMid meet"/>`
    : `<text x="600" y="240" text-anchor="middle" fill="${BRAND.gold}" font-family="${BRAND.font}" font-size="42" font-weight="700">${BRAND.wordmark}</text>`;
  const countLine = num
    ? `<text x="600" y="470" text-anchor="middle" fill="${BRAND.ink}" font-family="${BRAND.font}" font-size="36" font-weight="600">${xml(num)} complete</text>`
    : `<text x="600" y="470" text-anchor="middle" fill="${BRAND.ink}" font-family="${BRAND.font}" font-size="36" font-weight="600">Set complete</text>`;
  const dateLine = day
    ? `<text x="600" y="520" text-anchor="middle" fill="${BRAND.dim}" font-family="${BRAND.font}" font-size="24">${xml(day)}</text>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img">
<title>${xml(setName)} complete</title>
<rect width="1200" height="630" rx="36" fill="#12100e"/>
<rect x="18" y="18" width="1164" height="594" rx="28" fill="none" stroke="${eraColor}" stroke-width="6"/>
<text x="600" y="96" text-anchor="middle" fill="${BRAND.gold}" font-family="${BRAND.font}" font-size="28">${BRAND.wordmark}</text>
${logo}
<text x="600" y="360" text-anchor="middle" fill="${BRAND.ink}" font-family="${BRAND.font}" font-size="44" font-weight="700">${xml(setName)}</text>
<text x="600" y="410" text-anchor="middle" fill="${BRAND.gold}" font-family="${BRAND.font}" font-size="26">Set complete</text>
${countLine}
${dateLine}
<text x="600" y="590" text-anchor="middle" fill="${BRAND.ink}" fill-opacity="0.07" font-family="${BRAND.font}" font-size="96">${BRAND.wordmark}</text>
</svg>
`;
}

export function shareSvg(search) {
  const q = search instanceof URLSearchParams ? search : new URLSearchParams(String(search || ""));
  if (String(q.get("k") || "").toLowerCase() === "set") return setCompleteSvg(q);
  const name = clip(q.get("n"), 80) || "Catch'em";
  const num = clip(q.get("num"), 24);
  const price = moneyText(q.get("p"));
  const change = changeText(q.get("c"));
  const img = safeImagePath(q.get("img"));
  const setName = clip(q.get("set"), 48);
  const era = clip(q.get("era"), 32);
  const eraColor = ERA_COLOR[era.toLowerCase()] || BRAND.gold;
  const up = change.startsWith("+");
  const sealed = q.get("s") === "1";
  const changeColor = !change ? BRAND.dim : up ? BRAND.up : BRAND.dim;
  const photo = img
    ? `<image href="${xml(ORIGIN + img)}" x="56" y="78" width="280" height="392" preserveAspectRatio="xMidYMid meet" clip-path="url(#cardclip)"/>`
    : `<text x="196" y="290" text-anchor="middle" fill="${BRAND.gold}" font-family="${BRAND.font}" font-size="28">${BRAND.wordmark}</text>`;
  const badge = setName
    ? `<g><rect x="390" y="118" width="${Math.min(520, 28 + setName.length * 16)}" height="44" rx="22" fill="none" stroke="${eraColor}" stroke-width="3"/><text x="412" y="148" fill="${eraColor}" font-family="${BRAND.font}" font-size="22" font-weight="600">${xml(setName)}</text></g>`
    : "";
  const numLine = num ? `<text x="390" y="250" fill="${BRAND.dim}" font-family="${BRAND.font}" font-size="28">${xml(num)}</text>` : "";
  const priceLine = price
    ? `<text x="390" y="360" fill="${BRAND.ink}" font-family="${BRAND.font}" font-size="72">${xml(price)}</text><text x="390" y="408" fill="${BRAND.gold}" font-family="${BRAND.font}" font-size="22">${sealed ? "" : (q.get("cond") === "NM" ? "NM · " : "")}TCGplayer market</text>`
    : `<text x="390" y="360" fill="${BRAND.dim}" font-family="${BRAND.font}" font-size="28">No market price on file</text>`;
  const changeLine = change
    ? `<text x="390" y="470" fill="${changeColor}" font-family="${BRAND.font}" font-size="36" font-weight="700">${xml(change)}</text>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img">
<title>${xml(name)}</title>
<rect width="1200" height="630" rx="36" fill="#12100e"/>
<rect x="18" y="18" width="1164" height="594" rx="28" fill="none" stroke="${BRAND.gold}" stroke-width="6"/>
<clipPath id="cardclip"><rect x="56" y="78" width="280" height="392" rx="18"/></clipPath>
<rect x="56" y="78" width="280" height="392" rx="18" fill="#1a1815"/>
${photo}
<text x="600" y="590" text-anchor="middle" fill="${BRAND.ink}" fill-opacity="0.07" font-family="${BRAND.font}" font-size="96">${BRAND.wordmark}</text>
<text x="390" y="78" fill="${BRAND.gold}" font-family="${BRAND.font}" font-size="28">${BRAND.wordmark}</text>
${badge}
<text x="390" y="210" fill="${BRAND.ink}" font-family="${BRAND.font}" font-size="42">${xml(name)}</text>
${numLine}
${priceLine}
${changeLine}
</svg>
`;
}

export function handleShareCard(request, url) {
  const svg = shareSvg(url.searchParams);
  const headers = {
    "content-type": "image/svg+xml; charset=utf-8",
    "cache-control": "public, max-age=86400",
    "x-content-type-options": "nosniff",
  };
  return new Response(request.method === "HEAD" ? null : svg, { status: 200, headers });
}
