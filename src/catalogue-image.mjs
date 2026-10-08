// Post Office catalogue only. A row shows a picture when its id is a key.
// A name, a TCGplayer product id, or any other host is not a match.

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

function tileKind(kind) {
  if (kind === "sealed" || kind === "logo" || kind === "row") return kind;
  return "card";
}

export function brandedTile(kind) {
  const k = tileKind(kind);
  return '<div class="tile tile-' + k + '" aria-hidden="true"><span>Catch\'em<span class="dot">.</span></span></div>';
}

export function imageTag(src, kind, alt) {
  if (!src) return brandedTile(kind);
  const k = tileKind(kind);
  return '<img alt="' + escapeAttr(alt) + '" src="' + escapeAttr(src) + '" class="shot" data-tile="' + k + '" data-fallback="' + escapeAttr(brandedTile(k)) + '" onerror="this.outerHTML=this.getAttribute(\'data-fallback\')">';
}
