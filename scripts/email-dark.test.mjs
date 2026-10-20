// Reads emails: white by default, brand dark look in dark mode, Outlook hooks, AA contrast.
import assert from "node:assert/strict";
import { DARK, darkCss } from "../src/reads-article.mjs";
import { readsEmailHtml } from "../src/reads-email.mjs";

const lum = (hex) => {
  const v = hex.replace("#", "").match(/../g).map((h) => parseInt(h, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

export async function run() {
  let fail = 0;
  const t = (name, fn) => { try { fn(); } catch (e) { fail++; console.error("FAIL email-dark:", name, e.message); } };
  const css = darkCss();
  t("media query and outlook hooks", () => {
    assert.match(css, /@media \(prefers-color-scheme: dark\)/);
    assert.match(css, /\[data-ogsb\] \.ce-page\{background:#12100e/);
    assert.match(css, /\[data-ogsc\] \.ce-ink\{color:#efe9de/);
    assert.match(css, /\.ce-btn-dark\{background:#d9b779/);
    assert.match(css, /\.ce-prem-below\{background:#123d22/);
    assert.match(css, /\.ce-prem-above\{background:#3a2f0c/);
    assert.match(css, /\[data-ogsb\] \.ce-prem-below\{background:#123d22/);
    assert.match(css, /\[data-ogsc\] \.ce-prem-above\{color:#f6dc86/);
  });
  t("AA contrast in dark mode", () => {
    for (const [fg, bg] of [["ink", "card"], ["dim", "card"], ["soft", "card"], ["ink", "tile"], ["soft", "page"], ["goldInk", "gold"], ["ink", "card"], ["up", "upBg"], ["dn", "dnBg"], ["gold", "card"], ["premBelow", "premBelowBg"], ["premAbove", "premAboveBg"]]) {
      assert.ok(ratio(DARK[fg], DARK[bg]) >= 4.5, `${fg} on ${bg} ${ratio(DARK[fg], DARK[bg]).toFixed(2)}`);
    }
  });
  t("AA contrast for light buttons and text", () => {
    assert.ok(ratio("#ffffff", "#1c1c1e") >= 4.5);
    assert.ok(ratio("#636366", "#ffffff") >= 4.5);
    assert.ok(ratio("#0d6b32", "#e5f6ea") >= 4.5);
    assert.ok(ratio("#6b4e00", "#fff4cc") >= 4.5);
  });
  t("fallback letter is white by default and carries the dark hooks", () => {
    const html = readsEmailHtml({ lead: "Lead", day: "2026-10-19", reads: [{ headline: "H", href: "https://catchemtcg.com/r", tcgUrl: "https://x", ebayUrl: "https://y" }] });
    assert.match(html, /name="color-scheme" content="light dark"/);
    assert.match(html, /name="supported-color-schemes" content="light dark"/);
    assert.match(html, /class="ce-page" style="margin:0;padding:0;background:#f2f2f7/);
    assert.match(html, /\[data-ogsc\]/);
    assert.match(html, /class="ce-btn-dark"[^>]*>Buy on TCGplayer/);
  });
  return fail;
}

const failed = await run();
if (failed) { console.log(failed + " failed"); process.exit(1); }
console.log("email dark ok");
