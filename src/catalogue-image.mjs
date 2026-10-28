// A picture is the Post Office catalogue hit for that id, or the official
// TCGplayer / pokemontcg image for that same id. A name is never a match.
// A miss is a branded tile. News is always a Catch'em tile, never a source preview.

import { browserAssetUrl } from "./data.mjs";

function escapeAttr(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "\u0026amp;",
    "<": "\u0026lt;",
    ">": "\u0026gt;",
    '"': "\u0026quot;",
    "'": "\u0026#39;",
  }[c]));
}

export function cataloguePath(map, id) {
  if (!map || id == null || id === "") return "";
  const raw = map[id];
  if (typeof raw !== "string") return "";
  const path = raw.trim().split(/[?#]/)[0];
  if (!/^(?:\/img\/|\/cards\/|\/thumb\/)/.test(path)) return "";
  if (path.includes("..") || path.includes("//")) return "";
  return path;
}

export function catalogueUrl(path) {
  const src = String(path || "");
  if (!/^(?:\/img\/|\/cards\/|\/thumb\/)/.test(src) || src.includes("..")) return "";
  const logo = src.match(/^\/img\/([A-Za-z0-9]+)\/logo\.png$/i);
  if (logo) return "/img/" + logo[1].toLowerCase() + "/logo.png";
  const m = src.match(/^\/(?:img|thumb)\/([A-Za-z0-9]+)\/([A-Za-z0-9._-]+)$/);
  if (m) {
    const file = /\.[A-Za-z0-9]+$/.test(m[2]) ? m[2] : m[2] + "_hires.png";
    return "/data/editor/tcg/" + m[1] + "/" + file;
  }
  if (/^\/cards\/[A-Za-z0-9._/-]+$/.test(src)) return browserAssetUrl("research/assets" + src);
  return "";
}

// A hires miss falls through to the plain file, then the classic "_A" low-res
// file (cel25c/17_hires.png is not published; cel25c/17_A.png is).
export function editorImageFallbacks(rest) {
  const clean = String(rest || "");
  const out = [];
  const add = (p) => { if (p && out.indexOf(p) < 0) out.push(p); };
  add(clean);
  if (clean.endsWith("_hires.png")) add(clean.slice(0, -"_hires.png".length) + ".png");
  const stem = clean.replace(/_hires\.png$/, "").replace(/\.png$/, "");
  if (stem && !/_A$/i.test(stem)) add(stem + "_A.png");
  return out;
}

export function imageForId(map, id) {
  return catalogueUrl(cataloguePath(map, id));
}

export function tcgPid(row) {
  const obj = row && typeof row === "object" ? row : null;
  const sku = obj ? String(obj.sku || "") : "";
  const skuHit = sku.match(/^tcgcsv-(\d+)$/);
  if (skuHit) return Number(skuHit[1]);
  const id = String(obj ? (obj.id || "") : (row || ""));
  const embedded = id.match(/tcgcsv-(\d+)/);
  if (embedded) return Number(embedded[1]);
  const pid = obj ? Number(obj.pid) : 0;
  if (pid > 0) return Math.trunc(pid);
  const tcgId = obj ? String(obj.tcgcsvId || "").match(/^tcgcsv-(\d+)$/) : null;
  if (tcgId) return Number(tcgId[1]);
  const reviewed = obj ? String(obj.tcgPlayerId == null ? "" : obj.tcgPlayerId) : "";
  if (/^\d+$/.test(reviewed) && Number(reviewed) > 0) return Number(reviewed);
  return 0;
}

export function ptcgFile(id) {
  const m = String(id || "").match(/^([a-z0-9]+)-(\d+[a-z]?)$/i);
  if (!m || m[1].toLowerCase() === "tcgcsv") return "";
  return m[1] + "/" + m[2] + "_hires.png";
}

export function productTypeLabel(row) {
  const kind = String(row && row.kind || "").toLowerCase();
  const blob = (String(row && row.subtype || "") + " " + String(row && row.name || "")).toLowerCase();
  if (kind === "logo" || kind === "set") return "Set";
  if (/\bcase\b/.test(blob)) return "Case";
  if (/\bupc\b|ultra-premium|ultra premium/.test(blob)) return "UPC";
  if (/\betb\b|elite trainer/.test(blob)) return "ETB";
  if (/mini tin/.test(blob)) return "Mini Tin";
  if (/\btin\b/.test(blob)) return "Tin";
  if (/booster box/.test(blob)) return "Booster Box";
  if (kind === "sealed" || kind === "product") return "Sealed";
  return "Single";
}


// A passed sealed cutout beats the TCGplayer studio photo. Fails keep the CDN
// image. Paths are under research/assets/public and served as /data/...
export function sealedCutoutSrc(row, cutDoc) {
  if (!row || !cutDoc || !Array.isArray(cutDoc.products)) return null;
  const id = String(row.id || "");
  const pid = tcgPid(row);
  const siteId = pid ? "tcgcsv-" + pid : "";
  let hit = null;
  for (const p of cutDoc.products) {
    if (!p || p.pass !== true || !p.file) continue;
    if (p.id === id || (siteId && p.siteId === siteId) || (pid && Number(p.tcgPlayerId) === pid)) {
      hit = p;
      break;
    }
  }
  if (!hit) return null;
  const file = String(hit.file).replace(/^\/+/, "");
  if (!/^cutouts\/[A-Za-z0-9._-]+\.(webp|png)$/.test(file)) return null;
  const src = "/data/" + file;
  const alts = [];
  if (pid) alts.push("/api/card-img?pid=" + pid);
  return { src, crop: false, alts };
}

export function officialSrc(row, map, opts) {
  // Ordered by id: Post Office catalogue, then the pokemontcg.io scan for that
  // same setId-number, then the TCGplayer photo when images.tcgplayer is on.
  // A tile only when all of those miss. Default is on until Tyler turns it off.
  const obj = row && typeof row === "object" ? row : { id: row };
  const sealed = obj.kind === "sealed";
  const allowTcg = opts && typeof opts.tcgplayerImages === "boolean"
    ? opts.tcgplayerImages
    : !(typeof globalThis !== "undefined" && globalThis.CATCHEM_TCG_IMAGES === false);
  const list = [];
  const cat = imageForId(map, obj.id);
  if (cat) list.push(cat);
  const file = sealed ? "" : (ptcgFile(obj.cardId) || ptcgFile(obj.sku) || ptcgFile(obj.id));
  if (file) list.push("/data/editor/tcg/" + file);
  const pid = tcgPid(obj);
  if (allowTcg && pid) list.push("/api/card-img?pid=" + pid);
  const uniq = list.filter((u, i) => u && list.indexOf(u) === i);
  if (!uniq.length) return { src: "", crop: false, alts: [] };
  return { src: uniq[0], crop: !sealed, alts: uniq.slice(1) };
}

export function altAttr(hit) {
  const alts = hit && Array.isArray(hit.alts) ? hit.alts.filter((u) => /^[A-Za-z0-9:/._?=&-]+$/.test(String(u))) : [];
  return alts.length ? ' data-alts="' + alts.join("|") + '"' : "";
}

export function nextImage(img) {
  if (!img || !img.getAttribute) return false;
  const rest = String(img.getAttribute("data-alts") || "").split("|").filter(Boolean);
  if (!rest.length) return false;
  img.setAttribute("data-alts", rest.slice(1).join("|"));
  img.src = rest[0];
  return true;
}

function tileKind(kind) {
  if (kind === "sealed" || kind === "logo" || kind === "row") return kind;
  return "card";
}

export function brandedTile(kind, row) {
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "\u0026amp;",
      "<": "\u0026lt;",
      ">": "\u0026gt;",
      '"': "\u0026quot;",
      "'": "\u0026#39;",
    }[c]));
  }
  function faceKind(kind) {
    if (kind === "sealed" || kind === "logo" || kind === "row") return kind;
    return "card";
  }
  const k = faceKind(kind);
  const info = row && typeof row === "object" ? row : {};
  const type = productTypeLabel({ ...info, kind: info.kind || (k === "logo" ? "set" : k === "sealed" ? "sealed" : "single") });
  const rawLogo = String(info.logo || "");
  const showLogo = k !== "logo" && (/^https:\/\//.test(rawLogo) || /^\/img\/[a-z0-9]+\/logo\.png$/i.test(rawLogo));
  const logo = showLogo
    ? '<img alt="" width="44" height="22" loading="lazy" decoding="async" src="' + esc(rawLogo) + '">'
    : "";
  const named = k === "logo" ? String(info.name || "").trim() : "";
  const plate = named
    ? '<span class="tname">' + esc(named) + '</span>'
    : '<span class="ptype">' + esc(type) + '</span>';
  const label = named || type;
  return '<div class="tile tile-' + k + '" role="img" aria-label="Catch\'em ' + esc(label) + '"><span class="mark">Catch\'em<span class="dot">.</span></span>' + logo + plate + '</div>';
}

export function newsVariant(id) {
  const s = String(id || "");
  let n = 0;
  for (let i = 0; i < s.length; i++) n = (n + s.charCodeAt(i) * (i + 1)) % 4;
  return n;
}

export function newsTile(card) {
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "\u0026amp;",
      "<": "\u0026lt;",
      ">": "\u0026gt;",
      '"': "\u0026quot;",
      "'": "\u0026#39;",
    }[c]));
  }
  const row = card && typeof card === "object" ? card : {};
  const source = String(row.source || "News").trim() || "News";
  const label = [source, row.place, row.asOf].filter(Boolean).join(", ");
  const src = String(row.image || row.logo || "");
  const local = src.startsWith("/img/") || src.startsWith("/news-img/") || src.startsWith("/data/") || src.startsWith("/api/card-img");
  if (local) {
    const fit = row.image ? "cover" : "contain";
    const kind = row.image ? "news-art" : "news-art logo";
    return '<div class="news-tile ' + kind + '" role="img" aria-label="' + esc(label) + '"><img alt="" width="640" height="360" loading="lazy" decoding="async" src="' + esc(src) + '" style="object-fit:' + fit + '"></div>';
  }
  return '<div class="news-tile news-plain" role="img" aria-label="' + esc(label) + '"></div>';
}

export function imageTag(src, kind, alt, row) {
  const info = row && typeof row === "object" ? row : {};
  if (!src) return brandedTile(kind, info);
  const k = tileKind(kind);
  const big = k === "card";
  const w = k === "logo" ? 160 : big ? 280 : 64;
  const h = k === "logo" ? 64 : big ? 392 : 88;
  const face = !!(info.catalogueCrop || info.crop) && info.kind !== "sealed" && k !== "logo";
  const alts = altAttr({ alts: info.alts });
  const crop = face ? ' data-crop-card="1" onload="if(window.cropCardEdge)cropCardEdge(this)"' : "";
  return '<img alt="' + escapeAttr(alt || "") + '" width="' + w + '" height="' + h + '" loading="lazy" decoding="async" src="' + escapeAttr(src) + '" class="' + (face ? "shot card-face" : "shot") + '" data-tile="' + k + '" data-fallback="' + escapeAttr(brandedTile(kind, info)) + '"' + alts + crop + ' onerror="var a=(this.getAttribute(\'data-alts\')||\'\').split(\'|\').filter(Boolean);if(a.length){this.setAttribute(\'data-alts\',a.slice(1).join(\'|\'));this.src=a[0]}else{this.outerHTML=this.getAttribute(\'data-fallback\')}">';
}

export function visualGaps(html) {
  const src = String(html || "");
  const gaps = [];
  if (src.includes("The picture is missing.")) gaps.push("missing-text");
  const parts = src.split('<div class="row');
  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i].slice(0, 1500);
    if (!chunk.includes("<img") && !chunk.includes('class="tile') && !chunk.includes("news-tile") && !chunk.includes("brandedTile(") && !chunk.includes("imageTag(") && !chunk.includes("'+img+") && !chunk.includes("'+tick+img+") && !chunk.includes("'+face+")) {
      gaps.push("row-" + i);
    }
  }
  return gaps;
}
