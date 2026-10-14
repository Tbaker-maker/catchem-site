// Share and search tags for worker-rendered pages that do not set their own.
// Every page gets a description, canonical URL, and Open Graph / Twitter tags.
// The share image is Catch'em's own og.png, or for a card or product page the
// picture the site itself serves on that page (a same-origin path), never a store URL.
const ORIGIN = "https://catchemtcg.com";
const OG_IMAGE = `${ORIGIN}/og.png`;

const escAttr = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const unesc = (s) => String(s ?? "").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

export function canonicalPath(pathname) {
  let path = String(pathname || "/").split("?")[0].split("#")[0];
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (path.endsWith(".html")) path = path.slice(0, -5);
  return path || "/";
}

export function describePage(kind, name) {
  const n = String(name || "").trim();
  switch (kind) {
    case "set": return n && n !== "Set" ? `Every card and sealed product in ${n}, with TCGplayer market prices and set completion.` : "A Pokémon TCG set with TCGplayer market prices and set completion.";
    case "product": return n ? `${n}: TCGplayer market price and store links on Catch'em.` : "A sealed Pokémon TCG product with its TCGplayer market price.";
    case "card": return n ? `${n}: TCGplayer market price and store links on Catch'em.` : "A Pokémon TCG card with its TCGplayer market price.";
    case "pokemon": return n ? `Every ${n} card in the catalog, with TCGplayer market prices.` : "Pokémon TCG cards with TCGplayer market prices.";
    case "artist": return n && n !== "Artist" ? `Pokémon TCG cards illustrated by ${n}, with TCGplayer market prices.` : "Pokémon TCG cards by illustrator.";
    case "sets": return "Every Pokémon TCG set, with card counts and TCGplayer market prices.";
    case "rip": return "Rip value. History-based estimates of opening a pack or sealed product, from dated pull rates and singles prices. Not advice.";
    case "artists": return "Pokémon TCG illustrators and the cards they drew.";
    case "search": return "Search every Pokémon TCG card and sealed product by name, set, or number.";
    default: return "Prices, reads and set pages for every Pokémon card and pack, from Base Set to the latest drops.";
  }
}

// Adds tags only when the page has no description yet, and only to 200 pages.
// Card and product pages: the hero picture served from this origin, if any.
export function pageImage(html, kind) {
  if (kind !== "card" && kind !== "product") return "";
  const m = String(html || "").match(/<img\b[^>]*\bloading="eager"[^>]*\bsrc="(\/[^"]+)"/i) || String(html || "").match(/<img\b[^>]*\bsrc="(\/[^"]+)"[^>]*\bloading="eager"/i);
  if (!m || m[1].startsWith("//")) return "";
  return ORIGIN + unesc(m[1]);
}

// Card and product pages: name plus the dated header price when the page shows one.
export function pageDescription(html, kind, name) {
  const base = describePage(kind, name);
  if (kind !== "card" && kind !== "product") return base;
  const m = String(html || "").match(/(\$[0-9][0-9,]*\.[0-9]{2})[\s\S]{0,200}?((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) [0-9]{1,2}, [0-9]{4})/);
  if (!m) return base;
  return `${name}: ${m[1]} TCGplayer market on ${m[2]}. Price chart and 12-month range on Catch'em.`;
}

export function addShareMeta(html, pathname, kind) {
  const s = String(html ?? "");
  if (!/<head\b/i.test(s) || /<meta\s+name="description"/i.test(s)) return s;
  const m = s.match(/<title>([^<]*)<\/title>/i);
  if (!m) return s;
  const fullTitle = unesc(m[1]).trim();
  const name = fullTitle.replace(/\s*·\s*Catch'em\s*$/, "");
  const url = ORIGIN + canonicalPath(pathname);
  const desc = pageDescription(s, kind, name);
  const pic = pageImage(s, kind);
  const image = pic || OG_IMAGE;
  const size = pic ? "" : `\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">`;
  const alt = pic ? name : "Catch'em. Prices, reads and set pages for every Pokémon card and pack, from Base Set to the latest drops.";
  const tags = `<meta name="description" content="${escAttr(desc)}">
<link rel="canonical" href="${escAttr(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Catch'em">
<meta property="og:url" content="${escAttr(url)}">
<meta property="og:title" content="${escAttr(fullTitle)}">
<meta property="og:description" content="${escAttr(desc)}">
<meta property="og:image" content="${escAttr(image)}">${size}
<meta property="og:image:alt" content="${escAttr(alt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escAttr(fullTitle)}">
<meta name="twitter:description" content="${escAttr(desc)}">
<meta name="twitter:image" content="${escAttr(image)}">`;
  return s.replace(m[0], `${m[0]}\n${tags}`);
}

export async function withShareMeta(response, pathname, kind) {
  if (!response || response.status !== 200) return response;
  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/html")) return response;
  const body = addShareMeta(await response.text(), pathname, kind);
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}
