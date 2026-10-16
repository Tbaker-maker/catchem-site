// Article preview images. Only a host we already read, and only when its
// robots allow that path. A third-party image host is not cached.

const PAGE_HOSTS = new Set(["press.pokemon.com"]);
const IMAGE_HOSTS = new Set(["press.pokemon.com"]);

function hostOf(url) {
  try { return new URL(String(url || "")).hostname.toLowerCase(); }
  catch { return ""; }
}

function metaContent(tag) {
  const m = String(tag || "").match(/\bcontent\s*=\s*(["'])([\s\S]*?)\1/i);
  return m ? m[2].replace(/&/g, "&").trim() : "";
}

export function ogImageFrom(html, pageUrl) {
  if (!PAGE_HOSTS.has(hostOf(pageUrl))) return "";
  const raw = String(html || "");
  const tags = raw.match(/<meta\b[^>]*>/gi) || [];
  let content = "";
  for (const tag of tags) {
    if (!/\bproperty\s*=\s*(["'])og:image\1/i.test(tag)) continue;
    content = metaContent(tag);
    if (content) break;
  }
  if (!content) return "";
  let abs = "";
  try { abs = new URL(content, pageUrl).href; }
  catch { return ""; }
  if (!IMAGE_HOSTS.has(hostOf(abs))) return "";
  if (abs.includes("/Files/File") || abs.includes("/Files/Download")) return "";
  return abs;
}
