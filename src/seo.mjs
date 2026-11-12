// Share and search tags for worker-rendered pages that do not set their own.
// Every page gets a description, canonical URL, and Open Graph / Twitter tags.
// The share image is Catch'em's own og.png, or for a card or product page the
// picture the site itself serves on that page (a same-origin path), never a store URL.
// Product and card pages also get a unique title (name, type, set when it is not
// already in the name, and the dated market price) and Product JSON-LD. Offers
// are included only when a real market price is on the page. No ratings, review
// counts, or sold counts are invented.

const ORIGIN = "https://catchemtcg.com";
const OG_IMAGE = `${ORIGIN}/og.png`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const escAttr = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const unesc = (s) => String(s ?? "").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

export function canonicalPath(pathname) {
  let path = String(pathname || "/").split("?")[0].split("#")[0];
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (path.endsWith(".html")) path = path.slice(0, -5);
  return path || "/";
}

export function typeLabel(kind) {
  if (kind === "product") return "Sealed";
  if (kind === "card") return "Card";
  return "";
}

export function pageSetName(html) {
  const m = String(html || "").match(/href="(\/sets\/[a-z0-9-]+)">([^<]+)</i);
  return m ? unesc(m[2]).trim() : "";
}

export function setAlreadyInName(name, setName) {
  const n = String(name || "").trim().toLowerCase();
  const s = String(setName || "").trim().toLowerCase();
  if (!n || !s) return true;
  if (n.includes(s)) return true;
  const rest = s.replace(/^[a-z0-9.]+(?:\s*[:\-]\s*)/i, "").trim();
  return rest.length >= 4 && n.includes(rest);
}

function formatMoney(price) {
  return `$${Number(price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDay(iso) {
  const [y, mo, d] = String(iso).split("-").map(Number);
  if (!(y > 0 && mo >= 1 && mo <= 12 && d >= 1)) return "";
  return `${MONTHS[mo - 1]} ${d}, ${y}`;
}

function parseEnglishDate(text) {
  const m = String(text || "").match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) ([0-9]{1,2}), ([0-9]{4})$/);
  if (!m) return "";
  const mo = MONTHS.indexOf(m[1]) + 1;
  const d = Number(m[2]);
  const y = Number(m[3]);
  if (!(mo >= 1 && d >= 1 && y > 0)) return "";
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// The page's own dated market price, never a flip tile's "from" price.
export function extractMarketPrice(html) {
  const s = String(html || "");
  const rvDate = (s.match(/data-rv-date="(\d{4}-\d{2}-\d{2})"/) || [])[1] || "";
  const rvPrice = Number((s.match(/data-rv-price="([0-9]+(?:\.[0-9]{1,2})?)"/) || [])[1] || NaN);
  if (rvDate && rvPrice > 0) {
    const date = formatDay(rvDate);
    if (!date) return null;
    return { money: formatMoney(rvPrice), date, price: rvPrice, dateIso: rvDate };
  }
  const src = headerPriceHtml(html);
  const m = src.match(/(\$[0-9][0-9,]*\.[0-9]{2})[\s\S]{0,200}?((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) [0-9]{1,2}, [0-9]{4})/);
  if (!m) return null;
  const price = Number(m[1].replace(/[$,]/g, ""));
  if (!(price > 0)) return null;
  return { money: m[1], date: m[2], price, dateIso: parseEnglishDate(m[2]) };
}

export function describePage(kind, name, setName) {
  const n = String(name || "").trim();
  const where = setName ? ` in ${setName}` : "";
  switch (kind) {
    case "set": return n && n !== "Set" ? `Every card and sealed product in ${n}, with TCGplayer market prices and set completion.` : "A Pokémon TCG set with TCGplayer market prices and set completion.";
    case "product": return n ? `${n}, a sealed Pokémon TCG product${where}, with its TCGplayer market price and store links on Catch'em.` : "A sealed Pokémon TCG product with its TCGplayer market price.";
    case "card": return n ? `${n}, a Pokémon TCG card${where}, with its TCGplayer market price and store links on Catch'em.` : "A Pokémon TCG card with its TCGplayer market price.";
    case "pokemon": return n ? `Every ${n} card in the catalog, with TCGplayer market prices.` : "Pokémon TCG cards with TCGplayer market prices.";
    case "artist": return n && n !== "Artist" ? `Pokémon TCG cards illustrated by ${n}, with TCGplayer market prices.` : "Pokémon TCG cards by illustrator.";
    case "sets": return "Every Pokémon TCG set, with card counts and TCGplayer market prices.";
    case "promos": return "Every priced Pokémon TCG promo, with the TCGplayer market price and the art type.";
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

// The page's own dated price line, never a flip tile's "from" price.
export function headerPriceHtml(html) {
  const s = String(html || "");
  const dd = s.match(/<dt>Price<\/dt><dd>([^<]*)<\/dd>/);
  if (dd) return dd[1];
  return s.replace(/<button\b[^>]*class="tl[" ][\s\S]*?<\/button>/g, "");
}

export function productPageTitle(kind, name, market, setName) {
  const n = String(name || "").trim();
  if (!n) return "Catch'em";
  const bits = [`${n} price`];
  const typ = typeLabel(kind);
  if (typ) bits.push(typ);
  if (setName && !setAlreadyInName(n, setName)) bits.push(setName);
  if (market?.money && market?.date) bits.push(`${market.money} on ${market.date}`);
  bits.push("Catch'em");
  return bits.join(" · ");
}

// Card and product pages: name plus the dated header price when the page shows one.
export function pageDescription(html, kind, name) {
  const setName = pageSetName(html);
  const base = describePage(kind, name, setName);
  if (kind !== "card" && kind !== "product") return base;
  const market = extractMarketPrice(html);
  if (!market) return base;
  const typ = kind === "product" ? "sealed" : "card";
  const where = setName ? ` in ${setName}` : "";
  return `${name} (${typ})${where}: ${market.money} TCGplayer market on ${market.date}. Price chart and 12-month range on Catch'em.`;
}

export function addShareMeta(html, pathname, kind) {
  const s = String(html ?? "");
  if (!/<head\b/i.test(s) || /<meta\s+name="description"/i.test(s)) return s;
  const m = s.match(/<title>([^<]*)<\/title>/i);
  if (!m) return s;
  const fullTitle = unesc(m[1]).trim();
  const name = fullTitle.replace(/\s*·\s*Catch'em\s*$/, "");
  const url = ORIGIN + canonicalPath(pathname);
  const path = canonicalPath(pathname);
  const setName = pageSetName(s);
  const market = (kind === "card" || kind === "product") ? extractMarketPrice(s) : null;
  const pageTitle = (kind === "card" || kind === "product") ? productPageTitle(kind, name, market, setName) : fullTitle;
  const desc = path === "/reads" ? "Pick the Pokémon cards, sets and sealed products you follow and get a dated read on them by email or Discord DM." : pageDescription(s, kind, name);
  const pic = pageImage(s, kind);
  // X, Facebook, Discord and iMessage do not render an SVG share image, so
  // og:image and twitter:image are always raster: the page's own hero picture
  // (JPEG or PNG from this origin) or og.png. The branded SVG frame
  // (/og/frame.svg) stays for in-site use until it has a PNG renderer.
  const raster = pic && !/\.svg(?:$|[?#])/i.test(pic) ? pic : "";
  const image = raster || OG_IMAGE;
  const size = raster
    ? ""
    : `\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">`;
  const alt = pic ? name : "Catch'em. Prices, reads and set pages for every Pokémon card and pack, from Base Set to the latest drops.";
  const ogType = (kind === "card" || kind === "product") ? "product" : "website";
  const tags = `<meta name="description" content="${escAttr(desc)}">
<link rel="canonical" href="${escAttr(url)}">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="Catch'em">
<meta property="og:url" content="${escAttr(url)}">
<meta property="og:title" content="${escAttr(pageTitle)}">
<meta property="og:description" content="${escAttr(desc)}">
<meta property="og:image" content="${escAttr(image)}">${size}
<meta property="og:image:alt" content="${escAttr(alt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escAttr(pageTitle)}">
<meta name="twitter:description" content="${escAttr(desc)}">
<meta name="twitter:image" content="${escAttr(image)}">
<meta name="twitter:image:alt" content="${escAttr(alt)}">${structuredData(s, path, kind, name, image, { market, setName, desc })}`;
  return s.replace(m[0], `<title>${escAttr(pageTitle)}</title>\n${tags}`);
}

export async function withShareMeta(response, pathname, kind) {
  if (!response || response.status !== 200) return response;
  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/html")) return response;
  const body = addShareMeta(await response.text(), pathname, kind);
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

function ldScript(o) {
  return `\n<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;
}

// JSON-LD: WebSite on the home page, a breadcrumb on set, card and product pages.
// Product and card pages also get a Product node. An Offer is included only when
// a real market price is on the page. No ratings, review counts, or sold counts.
export function structuredData(html, path, kind, name, pic, extra = {}) {
  if (path === "/") return ldScript({ "@context": "https://schema.org", "@type": "WebSite", name: "Catch'em", url: `${ORIGIN}/`, potentialAction: { "@type": "SearchAction", target: `${ORIGIN}/search?q={q}`, "query-input": "required name=q" } });
  if (kind !== "card" && kind !== "product" && kind !== "set") return "";
  const items = [{ name: "Catch'em", item: `${ORIGIN}/` }, { name: "Sets", item: `${ORIGIN}/sets` }];
  const setName = extra.setName || pageSetName(html);
  if (kind !== "set") {
    const setM = String(html || "").match(/href="(\/sets\/[a-z0-9-]+)">([^<]+)</);
    if (setM) items.push({ name: unesc(setM[2]).trim(), item: ORIGIN + setM[1] });
  }
  items.push({ name, item: ORIGIN + path });
  let out = ldScript({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((x, i) => ({ "@type": "ListItem", position: i + 1, name: x.name, item: x.item })) });
  if (kind !== "card" && kind !== "product") return out;
  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    url: ORIGIN + path,
    brand: { "@type": "Brand", name: "Pokémon" },
  };
  if (extra.desc) product.description = extra.desc;
  if (pic) product.image = pic;
  if (setName) product.category = setName;
  const typ = typeLabel(kind);
  if (typ) product.additionalProperty = [{ "@type": "PropertyValue", name: "type", value: typ }];
  const market = extra.market || extractMarketPrice(html);
  if (market && market.price > 0) {
    const offer = {
      "@type": "Offer",
      url: ORIGIN + path,
      price: market.price.toFixed(2),
      priceCurrency: "USD",
      seller: { "@type": "Organization", name: "TCGplayer" },
    };
    product.offers = offer;
  }
  return out + ldScript(product);
}
