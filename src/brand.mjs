// One public mark. Paper, ink, gold. A system font. Rounded corners.
// IMAGE_HOSTS in index.mjs is the same two hosts. Do not add a host here.

export const BRAND = Object.freeze({
  paper: "#12100e",
  ink: "#efe9de",
  gold: "#d9b779",
  dim: "#b7b1a6",
  line: "#2f2b26",
  up: "#7fc79a",
  wordmark: "Catch'em",
  font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  radius: 22,
});

export const ALLOWED_IMAGE_HOSTS = Object.freeze([
  "images.pokemontcg.io",
  "tcgplayer-cdn.tcgplayer.com",
]);

export function allowedImageUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  let url;
  try {
    url = new URL(raw);
  } catch {
    return "";
  }
  if (url.protocol !== "https:") return "";
  if (!ALLOWED_IMAGE_HOSTS.includes(url.hostname)) return "";
  return url.href;
}
