// Home, one first action. Flag TF_HOME_V2 defaults off.
// No price is printed here. A sealed price belongs on the product page, with its source and date.

export const FLAG = "TF_HOME_V2";
export const ONE_LINE = "Open the Feed.";

const INK = "#12100e";
const IVORY = "#efe9de";
const GOLD = "#d9b779";

export function homeOn(env) {
  return String(env && env.TF_HOME_V2 || "").trim().toLowerCase() === "on";
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => {
    if (c === "&") return "&" + "amp;";
    if (c === "<") return "&" + "lt;";
    if (c === ">") return "&" + "gt;";
    if (c === '"') return "&" + "quot;";
    return "&" + "#39;";
  });
}


export function homeBlock() {
  const tools = [
    ["/feed", "Feed", "Open the Feed."],
    ["/collection", "Collection", "Your cards."],
    ["/heatmap", "Heatmap", "Month by month."],
    ["/rip", "Rip value", "What the box lists."],
    ["/reads", "Reads", "A short list."],
    ["/releases", "Releases", "Dated next."],
  ];
  const tiles = tools.map(([href, name, note]) => `<a class="tf-tile" href="${href}"><b>${esc(name)}</b><span>${esc(note)}</span></a>`).join("");
  return `<section id="tf-home-v2" aria-labelledby="tf-home-h">
    <p class="kicker">Start here</p>
    <h2 id="tf-home-h">${esc(ONE_LINE)}</h2>
    <p><a class="tf-go" href="/feed">${esc(ONE_LINE)}</a></p>
    <section id="since-visit" aria-live="polite">
      <h2>Since your last visit</h2>
      <p id="since-copy">Checking this device.</p>
      <p class="muted">Saved on this device only. Sign in is optional.</p>
    </section>
    <div class="tf-tiles">${tiles}</div>
  </section>`;
}

export const HOME_CSS = `
#tf-home-v2 h1{font:500 34px/1.15 Georgia,serif;margin:12px 0}
.tf-tiles{display:grid;gap:12px}
.tf-tile{display:flex;flex-direction:column;gap:4px;min-height:72px;padding:16px;border-radius:22px;background:#1a1815;color:${IVORY};text-decoration:none;border:1px solid #2f2b26}
.tf-tile b{font:600 18px/1.2 "IBM Plex Sans",system-ui,sans-serif}
.tf-tile span{color:#c4baab}
.tf-go{display:inline-flex;align-items:center;justify-content:center;min-height:48px;min-width:44px;padding:0 18px;border-radius:16px;background:${GOLD};color:${INK};text-decoration:none;font:600 18px/1 "IBM Plex Sans",system-ui,sans-serif}
html[data-theme="light"] .tf-tile{background:#fff;color:${INK};border-color:#e2dacb}
html[data-theme="light"] .tf-tile span{color:#5c564e}
@media(min-width:900px){.tf-tiles{grid-template-columns:repeat(3,minmax(0,1fr))}}
`;

export const HOME_JS = `(function(){
  var key = "catchem-home-v2";
  var el = document.getElementById("since-copy");
  if (!el) return;
  var prev = "";
  try { prev = localStorage.getItem(key) || ""; } catch (e) {}
  if (!prev) el.textContent = "First visit on this device. Sign in is optional.";
  else el.textContent = "Last visit on this device: " + prev;
  var day = "";
  try { day = new Date().toISOString().slice(0, 10); } catch (e) { day = ""; }
  try { if (day) localStorage.setItem(key, day); } catch (e) {}
})();`;

export function injectHome(html) {
  const src = String(html || "");
  if (!src.includes("</body>") || src.includes('id="tf-home-v2"')) return src;
  const block = `<style>${HOME_CSS}</style>${homeBlock()}<script>${HOME_JS}</script>`;
  if (src.includes("</h1>")) return src.replace("</h1>", "</h1>" + block);
  return src.replace("</body>", block + "</body>");
}

export async function paintHome(res, request) {
  if (!res || request.method === "HEAD") return res;
  const url = new URL(request.url);
  if (url.pathname !== "/") return res;
  const type = res.headers.get("content-type") || "";
  if (!type.includes("text/html")) return res;
  const headers = new Headers(res.headers);
  headers.delete("content-length");
  return new Response(injectHome(await res.text()), { status: res.status, statusText: res.statusText, headers });
}

export function previewPage(theme) {
  const mode = theme === "light" ? "light" : "dark";
  return `<!doctype html><html lang="en" data-theme="${mode}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Catch'em</title>
<style>*{box-sizing:border-box}body{margin:0;background:${INK};color:${IVORY};font:16px/1.45 "IBM Plex Sans",system-ui,sans-serif;padding:16px 16px 40px}
html[data-theme="light"] body{background:${IVORY};color:${INK}}
html[data-theme="light"] a,html[data-theme="light"] .kicker,html[data-theme="light"] .logo span,html[data-theme="light"] .tf-tab[aria-pressed="true"],html[data-theme="light"] .tf-chip[aria-pressed="true"],html[data-theme="light"] .tf-dock a[aria-current="page"]{color:#7a5a1e}
a{color:${GOLD}}.logo{font:600 28px/1 Georgia,serif;color:inherit;text-decoration:none;min-height:44px;display:inline-flex;align-items:center}.logo span{color:${GOLD}}
${HOME_CSS}
</style></head><body>
<a class="logo" href="/">Catch'em<span>.</span></a>
${homeBlock()}
<script>${HOME_JS}</script>
</body></html>`;
}
