export const AFFILIATION = "Not affiliated with Nintendo, The Pokémon Company, or Creatures.";
// TCGplayer's required attribution. Every page with prices shows it.
export const TCGPLAYER_ATTRIBUTION = "This product uses TCGplayer data but is not endorsed or certified by TCGplayer.";

// Every HTML page gets this sentence. A page that already has a footer keeps
// it and gains the sentence. A page with no footer gets one.
export function ensureAffiliation(html) {
  const s = String(html ?? "");
  if (!s) return s;
  const parts = [];
  if (!s.includes(AFFILIATION)) parts.push(AFFILIATION);
  if (!s.includes(TCGPLAYER_ATTRIBUTION)) parts.push(TCGPLAYER_ATTRIBUTION);
  if (!parts.length) return s;
  const block = parts.map((line) => `<p class="affiliation">${line}</p>`).join("");
  if (/<footer\b[^>]*>/i.test(s)) return s.replace(/<footer\b[^>]*>/i, (m) => m + block);
  if (/<\/body>/i.test(s)) return s.replace(/<\/body>/i, `<footer>${block}</footer></body>`);
  if (/<!doctype html/i.test(s) || /<html\b/i.test(s) || /<main\b/i.test(s) || /<h1\b/i.test(s)) {
    return `${s}<footer>${block}</footer>`;
  }
  return s;
}
