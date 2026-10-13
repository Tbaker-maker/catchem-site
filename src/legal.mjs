// /terms, /privacy, /disclaimer: rendered from LEGAL_TEXT in the site chrome.
import { LEGAL_TEXT } from "./legal-text.mjs";
import { pageChrome } from "./ui.mjs";

export const LEGAL_UPDATED = "Last updated: 13 October 2026";
export const LEGAL_PATHS = { "/terms": "terms", "/privacy": "privacy", "/disclaimer": "disclaimer" };
const TITLES = { terms: "Terms of Service", privacy: "Privacy Policy", disclaimer: "Disclaimer" };

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const inline = (s) => esc(s).replace(/support@catchemtcg\.com/g, '<a href="mailto:support@catchemtcg.com">support@catchemtcg.com</a>');

export function legalBody(key) {
  const lines = String(LEGAL_TEXT[key] || "").split("\n");
  const out = [];
  let list = false;
  const close = () => { if (list) { out.push("</ul>"); list = false; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { close(); continue; }
    if (line.startsWith("# ")) { close(); out.push(`<h1>${inline(line.slice(2))}</h1><p class="lg-date muted">${LEGAL_UPDATED}</p>`); continue; }
    if (line.startsWith("## ")) { close(); out.push(`<h2>${inline(line.slice(3))}</h2>`); continue; }
    if (line.startsWith("- ")) { if (!list) { out.push("<ul>"); list = true; } out.push(`<li>${inline(line.slice(2))}</li>`); continue; }
    close();
    out.push(`<p>${inline(line)}</p>`);
  }
  close();
  return out.join("\n");
}

const CSS = `<style>.lg{max-width:720px;margin:0 auto;padding:28px 16px 48px}.lg-card{background:#1a1815;border:1px solid #2f2b26;border-radius:22px;padding:28px 22px}.lg h1{margin:0 0 6px}.lg-date{margin:0 0 18px}.lg h2{margin:26px 0 8px;font-size:20px}.lg p,.lg li{line-height:1.65}.lg ul{padding-left:20px;margin:8px 0}.lg li{margin:6px 0}.lg-nav{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 0}.lg-nav a{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border-radius:999px;border:1px solid #3a352e;text-decoration:none}</style>`;

export function renderLegal(key, stamp = "", opts = {}) {
  if (!TITLES[key]) return "";
  const nav = Object.entries(LEGAL_PATHS).filter(([, k]) => k !== key).map(([p, k]) => `<a href="${p}">${TITLES[k]}</a>`).join("");
  const body = `<main id="main" tabindex="-1" class="lg">${CSS}<article class="lg-card">${legalBody(key)}</article><nav class="lg-nav" aria-label="Legal">${nav}</nav></main>`;
  return pageChrome("", body, TITLES[key], stamp, "", opts.feed === true);
}
