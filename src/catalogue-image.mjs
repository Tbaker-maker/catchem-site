// A picture is the Post Office catalogue hit for that id, or the official
// TCGplayer / pokemontcg image for that same id. A name is never a match.
// A miss is a branded tile. News is always a Catch'em tile, never a source preview.

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
  const RAW = "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/research/assets";
  const src = String(path || "");
  if (!/^(?:\/img\/|\/cards\/|\/thumb\/)/.test(src) || src.includes("..")) return "";
  const m = src.match(/^\/(?:img|thumb)\/([A-Za-z0-9]+)\/([A-Za-z0-9._-]+)$/);
  if (m) {
    const file = /\.[A-Za-z0-9]+$/.test(m[2]) ? m[2] : m[2] + "_hires.png";
    return "/data/editor/tcg/" + m[1] + "/" + file;
  }
  if (/^\/cards\/[A-Za-z0-9._/-]+$/.test(src)) return RAW + src;
  return "";
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

export function officialSrc(row, map) {
  const obj = row && typeof row === "object" ? row : { id: row };
  const cat = imageForId(map, obj.id);
  if (cat) return { src: cat, crop: obj.kind !== "sealed" };
  const pid = tcgPid(obj);
  const stored = String(obj.image || obj.scan || "");
  const sealed = obj.kind === "sealed";
  if (pid && stored.includes("/product/" + pid)) return { src: "/api/card-img?pid=" + pid, crop: !sealed };
  if (pid) return { src: "/api/card-img?pid=" + pid, crop: !sealed };
  const file = ptcgFile(obj.cardId) || ptcgFile(obj.sku) || ptcgFile(obj.id);
  if (file) return { src: "/data/editor/tcg/" + file, crop: true };
  return { src: "", crop: false };
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
  const logo = /^https:\/\//.test(String(info.logo || ""))
    ? '<img alt="" width="44" height="22" loading="lazy" decoding="async" src="' + esc(info.logo) + '">'
    : "";
  return '<div class="tile tile-' + k + '" role="img" aria-label="Catch\'em ' + esc(type) + '"><span class="mark">Catch\'em<span class="dot">.</span></span>' + logo + '<span class="ptype">' + esc(type) + '</span></div>';
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
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const row = card && typeof card === "object" ? card : {};
  const n = newsVariant(row.id || row.href || row.source);
  const source = String(row.source || "News").trim() || "News";
  const tag = String(row.place || "").trim();
  const day = String(row.asOf || "").slice(0, 10);
  let when = "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) when = months[Number(day.slice(5, 7)) - 1] + " " + Number(day.slice(8, 10)) + ", " + day.slice(0, 4);
  const label = [source, tag, when].filter(Boolean).join(", ");
  return '<div class="news-tile v' + n + '" role="img" aria-label="Catch\'em news, ' + esc(label) + '"><p class="mark">Catch\'em<span class="dot">.</span></p><p class="src">' + esc(source) + '</p>' + (tag ? '<p class="tag">' + esc(tag) + '</p>' : "") + (when ? '<p class="when">' + esc(when) + '</p>' : "") + '</div>';
}

export function imageTag(src, kind, alt, row) {
  const info = row && typeof row === "object" ? row : {};
  if (!src) return brandedTile(kind, info);
  const k = tileKind(kind);
  const big = k === "card";
  const w = k === "logo" ? 160 : big ? 280 : 64;
  const h = k === "logo" ? 64 : big ? 392 : 88;
  const face = !!(info.catalogueCrop || info.crop) && info.kind !== "sealed" && k !== "logo";
  const crop = face ? ' data-crop-card="1" onload="if(window.cropCardEdge)cropCardEdge(this)"' : "";
  return '<img alt="' + escapeAttr(alt || "") + '" width="' + w + '" height="' + h + '" loading="lazy" decoding="async" src="' + escapeAttr(src) + '" class="' + (face ? "shot card-face" : "shot") + '" data-tile="' + k + '" data-fallback="' + escapeAttr(brandedTile(kind, info)) + '"' + crop + ' onerror="this.outerHTML=this.getAttribute(\'data-fallback\')">';
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
