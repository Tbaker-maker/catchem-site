// Phone tabs. Flag TF_TABS defaults off.
// Feed, Collection, Heatmap, Rip value, Reads, Releases. A page that already has that dock keeps it. Indexes stays under More.

export const FLAG = "TF_TABS";

const INK = "#12100e";
const IVORY = "#efe9de";
const GOLD = "#d9b779";

export function tabsOn(env) {
  return String(env && env.TF_TABS || "").trim().toLowerCase() === "on";
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


const TABS = [
  ["/feed", "Feed"],
  ["/collection", "Collection"],
  ["/heatmap", "Heatmap"],
  ["/rip", "Rip value"],
  ["/reads", "Reads"],
  ["/releases", "Releases"],
];

const MORE = [
  ["/search", "Search"],
  ["/sets", "Sets"],
  ["/watchlist", "Watchlist"],
  ["/pulse", "Pulse"],
  ["/indexes", "Indexes"],
  ["/premium", "Premium"],
  ["/methodology", "Methodology"],
];

export function tabBar(active) {
  const tabs = TABS.map(([href, label]) => {
    const on = active === label ? ' aria-current="page"' : "";
    return `<a href="${href}"${on}>${esc(label)}</a>`;
  }).join("");
  const more = MORE.map(([href, label]) => `<a href="${href}">${esc(label)}</a>`).join("");
  return `<nav class="dock tf-dock" aria-label="Primary" data-tf-tabs="1">${tabs}<button type="button" class="tf-more" aria-expanded="false" aria-controls="tf-more">More</button></nav>
<div id="tf-more" class="tf-more-sheet" hidden><div class="tf-more-panel" role="dialog" aria-modal="true" aria-label="More">${more}<button type="button" class="tf-more-close">Close</button></div></div>`;
}

export const TAB_CSS = `
.tf-dock{position:fixed;left:0;right:0;bottom:0;z-index:6;display:flex;gap:2px;padding:6px 6px calc(6px + env(safe-area-inset-bottom));background:#1a1815;border-top:1px solid #2f2b26;border-radius:20px 20px 0 0}
.tf-dock a,.tf-more{flex:1 1 0;min-height:48px;min-width:44px;display:flex;align-items:center;justify-content:center;padding:4px 2px;border-radius:14px;color:#c4baab;text-decoration:none;background:transparent;border:0;font:600 11px/1.1 "IBM Plex Sans",system-ui,sans-serif}
.tf-dock a[aria-current="page"]{color:${GOLD}}
.tf-more-sheet{position:fixed;inset:0;z-index:7;background:rgba(18,16,14,.55);display:flex;align-items:flex-end}
.tf-more-sheet[hidden]{display:none}
.tf-more-panel{width:min(520px,100%);margin:0 auto;padding:16px 16px calc(16px + env(safe-area-inset-bottom));background:${INK};color:${IVORY};border-radius:22px 22px 0 0;display:grid;gap:8px}
.tf-more-panel a,.tf-more-close{min-height:44px;display:flex;align-items:center;padding:0 12px;border-radius:14px;color:${IVORY};text-decoration:none;background:#1a1815;border:0;font:600 16px/1 "IBM Plex Sans",system-ui,sans-serif}
html[data-theme="light"] .tf-dock{background:${IVORY};border-top-color:#e2dacb}
html[data-theme="light"] .tf-dock a,html[data-theme="light"] .tf-more{color:#5c564e}
html[data-theme="light"] .tf-more-panel{background:${IVORY};color:${INK}}
html[data-theme="light"] .tf-more-panel a,html[data-theme="light"] .tf-more-close{background:#fff;color:${INK}}
`;

export const TAB_JS = `(function(){
  var btn = document.querySelector(".tf-more");
  var sheet = document.getElementById("tf-more");
  if (!btn || !sheet) return;
  function set(on){ sheet.hidden = !on; btn.setAttribute("aria-expanded", on ? "true" : "false"); }
  btn.addEventListener("click", function(){ set(sheet.hidden); });
  sheet.addEventListener("click", function(ev){ if (ev.target === sheet || ev.target.classList.contains("tf-more-close")) set(false); });
  document.addEventListener("keydown", function(ev){ if (ev.key === "Escape") set(false); });
})();`;

export function watchMain() {
  return `<main id="main">
    <p class="kicker">Watchlist</p>
    <h1>On this device.</h1>
    <p id="tf-watch-empty">Nothing saved on this device yet.</p>
    <p class="muted">Sign in is optional. This list stays on the device.</p>
    <ul id="tf-watch-list"></ul>
  </main>`;
}

export const WATCH_JS = `(function(){
  var list = document.getElementById("tf-watch-list");
  var empty = document.getElementById("tf-watch-empty");
  if (!list) return;
  var rows = [];
  try { rows = JSON.parse(localStorage.getItem("catchem-watch") || "[]"); } catch (e) { rows = []; }
  if (!Array.isArray(rows) || !rows.length) return;
  empty.hidden = true;
  list.innerHTML = rows.slice(0, 12).map(function(row){
    var name = String(row && (row.name || row.headline) || "Saved item");
    var href = String(row && row.href || "/");
    return '<li><a href="'+href.replace(/"/g,"")+'>'+name.replace(/[&<>]/g,"")+'</a></li>';
  }).join("");
})();`;

export function pageWrap(main, theme, title, active) {
  const mode = theme === "light" ? "light" : "dark";
  return `<!doctype html><html lang="en" data-theme="${mode}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Catch'em</title>
<style>
*{box-sizing:border-box}body{margin:0;background:${INK};color:${IVORY};font:16px/1.45 "IBM Plex Sans",system-ui,sans-serif;padding:16px 16px 96px}
html[data-theme="light"] body{background:${IVORY};color:${INK}}
html[data-theme="light"] a,html[data-theme="light"] .kicker,html[data-theme="light"] .logo span,html[data-theme="light"] .tf-tab[aria-pressed="true"],html[data-theme="light"] .tf-chip[aria-pressed="true"],html[data-theme="light"] .tf-dock a[aria-current="page"]{color:#7a5a1e}
h1{font:500 40px/1.05 Georgia,serif}
.logo{font:600 28px/1 Georgia,serif;color:inherit;text-decoration:none;min-height:44px;display:inline-flex;align-items:center}.logo span{color:${GOLD}}
.kicker{letter-spacing:.08em;text-transform:uppercase;color:${GOLD};font:600 12px/1 system-ui}
${TAB_CSS}
</style></head><body>
<a class="logo" href="/">Catch'em<span>.</span></a>
${main}
${tabBar(active)}
<script>${TAB_JS}</script>
</body></html>`;
}

export function previewPage(theme, which) {
  if (which === "watch") return pageWrap(watchMain() + `<script>${WATCH_JS}</script>`, theme, "Watchlist", "Watchlist");
  return pageWrap(`<main id="main"><p class="kicker">Home</p><h1>Six tools. The rest is under More.</h1></main>`, theme, "Tabs", "Feed");
}

const SIX = ["/feed", "/collection", "/heatmap", "/rip", "/reads", "/releases"];

export function injectTabs(html, pathname) {
  const src = String(html || "");
  if (src.includes("data-tf-tabs")) return src;
  const hasSix = SIX.every((href) => src.includes('href="' + href + '"'));
  if (hasSix && src.includes('class="dock"')) return src;
  const active = TABS.find(([href]) => href === pathname);
  const bar = `<style>${TAB_CSS}</style>${tabBar(active ? active[1] : "")}<script>${TAB_JS}</script>`;
  if (src.includes("</body>")) return src.replace("</body>", bar + "</body>");
  return src;
}

export function watchResponse(request) {
  const theme = new URL(request.url).searchParams.get("theme") === "light" ? "light" : "dark";
  const html = pageWrap(watchMain() + `<script>${WATCH_JS}</script>`, theme, "Watchlist", "Watchlist");
  return new Response(request.method === "HEAD" ? null : html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function paintTabs(res, request) {
  if (!res || request.method === "HEAD") return res;
  const type = res.headers.get("content-type") || "";
  if (!type.includes("text/html")) return res;
  const headers = new Headers(res.headers);
  headers.delete("content-length");
  return new Response(injectTabs(await res.text(), new URL(request.url).pathname), { status: res.status, statusText: res.statusText, headers });
}
