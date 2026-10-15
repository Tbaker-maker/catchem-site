// Branded 1200x630 share card. SVG so the worker stays light: no raster
// library, one cached response, the card photo is a same-origin path only.
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
  "promos and extras": "#d4af37",
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

export function shareCardUrl(fields) {
  const q = new URLSearchParams();
  q.set("k", fields && fields.kind === "read" ? "read" : "card");
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
  return `${ORIGIN}/og/card.svg?${q.toString()}`;
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

export function shareSvg(search) {
  const q = search instanceof URLSearchParams ? search : new URLSearchParams(String(search || ""));
  const name = clip(q.get("n"), 80) || "Catch'em";
  const num = clip(q.get("num"), 24);
  const price = moneyText(q.get("p"));
  const change = changeText(q.get("c"));
  const img = safeImagePath(q.get("img"));
  const setName = clip(q.get("set"), 48);
  const era = clip(q.get("era"), 32);
  const eraColor = ERA_COLOR[era.toLowerCase()] || "#d4af37";
  const up = change.startsWith("+");
  const sealed = q.get("s") === "1";
  const changeColor = !change ? "#b7b1a6" : up ? "#7fc79a" : "#e07a6a";
  const photo = img
    ? `<image href="${xml(ORIGIN + img)}" x="56" y="78" width="280" height="392" preserveAspectRatio="xMidYMid meet" clip-path="url(#cardclip)"/>`
    : `<text x="196" y="290" text-anchor="middle" fill="#d4af37" font-family="Georgia, serif" font-size="28">Catch'em</text>`;
  const badge = setName
    ? `<g><rect x="390" y="118" width="${Math.min(520, 28 + setName.length * 16)}" height="44" rx="22" fill="none" stroke="${eraColor}" stroke-width="3"/><text x="412" y="148" fill="${eraColor}" font-family="system-ui, sans-serif" font-size="22" font-weight="600">${xml(setName)}</text></g>`
    : "";
  const numLine = num ? `<text x="390" y="250" fill="#b7b1a6" font-family="system-ui, sans-serif" font-size="28">${xml(num)}</text>` : "";
  const priceLine = price
    ? `<text x="390" y="360" fill="#efe9de" font-family="Georgia, serif" font-size="72">${xml(price)}</text><text x="390" y="408" fill="#d4af37" font-family="system-ui, sans-serif" font-size="22">${sealed ? "" : "NM · "}TCGplayer market</text>`
    : `<text x="390" y="360" fill="#b7b1a6" font-family="system-ui, sans-serif" font-size="28">No market price on file</text>`;
  const changeLine = change
    ? `<text x="390" y="470" fill="${changeColor}" font-family="system-ui, sans-serif" font-size="36" font-weight="700">${xml(change)}</text>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img">
<title>${xml(name)}</title>
<rect width="1200" height="630" rx="36" fill="#12100e"/>
<rect x="18" y="18" width="1164" height="594" rx="28" fill="none" stroke="#2f2b26" stroke-width="2"/>
<clipPath id="cardclip"><rect x="56" y="78" width="280" height="392" rx="18"/></clipPath>
<rect x="56" y="78" width="280" height="392" rx="18" fill="#1a1815"/>
${photo}
<text x="390" y="78" fill="#d4af37" font-family="Georgia, serif" font-size="28">Catch'em</text>
${badge}
<text x="390" y="210" fill="#efe9de" font-family="Georgia, serif" font-size="42">${xml(name)}</text>
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
