export const AFFILIATION = "Not affiliated with Nintendo, The Pokémon Company, or Creatures.";

// Every HTML page gets this sentence. A page that already has a footer keeps
// it and gains the sentence. A page with no footer gets one.
export function ensureAffiliation(html) {
  const s = String(html ?? "");
  if (!s || s.includes(AFFILIATION)) return s;
  const block = `<p class="affiliation">${AFFILIATION}</p>`;
  if (/<footer\b[^>]*>/i.test(s)) return s.replace(/<footer\b[^>]*>/i, (m) => m + block);
  if (/<\/body>/i.test(s)) return s.replace(/<\/body>/i, `<footer>${block}</footer></body>`);
  if (/<!doctype html/i.test(s) || /<html\b/i.test(s) || /<main\b/i.test(s) || /<h1\b/i.test(s)) {
    return `${s}<footer>${block}</footer>`;
  }
  return s;
}
