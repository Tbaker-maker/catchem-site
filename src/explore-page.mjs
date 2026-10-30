// Explore. Flag TF_EXPLORE defaults off.
// Every item below is a live Catch'em path. Any of them is at most 2 taps from this page.

export const FLAG = "TF_EXPLORE";

const INK = "#12100e";
const IVORY = "#efe9de";
const GOLD = "#d9b779";

export function exploreOn(env) {
  return String(env && env.TF_EXPLORE || "").trim().toLowerCase() === "on";
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


export const CATALOG = [
  { tab: "Sets", name: "Scarlet and Violet 151", href: "/sets/sv3pt5", era: "Modern", price: "Has a price", source: "TCGplayer market" },
  { tab: "Sets", name: "Mega Evolution, Delta Reign", href: "/sets/me06-delta-reign", era: "Modern", price: "Has a price", source: "TCGplayer market" },
  { tab: "Cards", name: "Charizard ex 199/165", href: "/c/tcgcsv-517045", era: "Modern", price: "No price", source: "TCGplayer market" },
  { tab: "Cards", name: "Heat Rotom", href: "/c/tcgcsv-86043", era: "Vintage", price: "Has a price", source: "TCGplayer market" },
  { tab: "Sealed", name: "151 Elite Trainer Box", href: "/p/tcgcsv-503313", era: "Modern", price: "Has a price", source: "TCGplayer market" },
  { tab: "News", name: "Delta Reign news line", href: "/sets/me06-delta-reign", era: "Modern", price: "Has a price", source: "TCGplayer market" },
  { tab: "Reads", name: "Your reads", href: "/reads", era: "Modern", price: "No price", source: "Catch'em reads" },
];

export const TABS = ["Sets", "Cards", "Sealed", "News", "Reads"];
export const CHIPS = ["Modern", "Vintage", "Has a price"];

export const INTERESTING = [
  CATALOG[4],
  CATALOG[3],
  CATALOG[1],
];

export function keepLinks(pathname) {
  const here = String(pathname || "");
  const picked = [];
  for (const row of CATALOG) {
    if (row.href === here) continue;
    if (picked.some((p) => p.href === row.href)) continue;
    picked.push(row);
    if (picked.length === 3) break;
  }
  return picked;
}

export function keepRow(pathname) {
  const rows = keepLinks(pathname);
  const links = rows.map((row) => `<a href="${esc(row.href)}">${esc(row.name)}</a>`).join("");
  return `<section class="tf-keep" data-tf-keep="1" aria-labelledby="tf-keep-h"><h2 id="tf-keep-h">Keep exploring</h2><div class="tf-row">${links}</div></section>`;
}

export function exploreMain() {
  const tabs = TABS.map((tab, i) => `<button type="button" class="tf-tab" data-tab="${esc(tab)}" aria-pressed="${i === 0 ? "true" : "false"}">${esc(tab)}</button>`).join("");
  const chips = CHIPS.map((chip) => `<button type="button" class="tf-chip" data-chip="${esc(chip)}" aria-pressed="false">${esc(chip)}</button>`).join("");
  const items = CATALOG.map((row) => `<li data-tab="${esc(row.tab)}" data-era="${esc(row.era)}" data-price="${esc(row.price)}" data-name="${esc(row.name)}"><a href="${esc(row.href)}">${esc(row.name)}</a><span>${esc(row.price)}</span></li>`).join("");
  const now = INTERESTING.map((row) => `<a href="${esc(row.href)}">${esc(row.name)}</a>`).join("");
  return `<main id="main" class="tf-explore">
    <p class="kicker">Explore</p>
    <h1>Wander.</h1>
    <nav class="tf-crumbs" aria-label="Breadcrumb"><a href="/explore">Explore</a> <span id="tf-crumb">/ Sets</span></nav>
    <form role="search" action="/explore" method="get">
      <label for="tf-q">Search</label>
      <input id="tf-q" name="q" type="search" placeholder="Search the list">
    </form>
    <div class="tf-tabs" role="group" aria-label="Kind">${tabs}</div>
    <div class="tf-chips" role="group" aria-label="Filters">${chips}</div>
    <label for="tf-sort">Sort</label>
    <select id="tf-sort"><option value="name">Name</option><option value="file">On the page first</option></select>
    <section aria-labelledby="tf-now-h"><h2 id="tf-now-h">Interesting right now</h2><div class="tf-row">${now}</div></section>
    <section aria-labelledby="tf-recent-h"><h2 id="tf-recent-h">Recently viewed</h2><p id="tf-recent">Nothing viewed on this device yet.</p></section>
    <ul id="tf-list">${items}</ul>
    <p><a class="tf-surprise" id="tf-surprise" href="${esc(CATALOG[4].href)}">Surprise me</a></p>
    ${keepRow("/explore")}
  </main>`;
}

export const EXPLORE_CSS = `
.tf-explore h1{font:500 44px/1 Georgia,serif;margin:8px 0}
.tf-crumbs a,.tf-tab,.tf-chip,.tf-surprise,.tf-row a,.tf-explore input,.tf-explore select{min-height:44px;min-width:44px}
.tf-tabs,.tf-chips,.tf-row{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
.tf-tab,.tf-chip,.tf-surprise{border-radius:999px;border:1px solid #2f2b26;background:#1a1815;color:${IVORY};padding:0 14px;font:600 15px/1 "IBM Plex Sans",system-ui,sans-serif;text-decoration:none;display:inline-flex;align-items:center}
.tf-tab[aria-pressed="true"],.tf-chip[aria-pressed="true"]{border-color:${GOLD};color:${GOLD}}
.tf-explore input,.tf-explore select{width:100%;border-radius:14px;border:1px solid #2f2b26;background:#1a1815;color:${IVORY};padding:0 12px;font:16px/1 system-ui}
.tf-explore ul{list-style:none;margin:12px 0;padding:0;display:grid;gap:8px}
.tf-explore li a{display:flex;min-height:44px;align-items:center;color:inherit;text-decoration:none;font:600 18px/1.3 Georgia,serif}
.tf-explore li span{display:block;color:#c4baab;font:14px/1.3 "IBM Plex Sans",system-ui,sans-serif}
.tf-keep{margin-top:18px}
html[data-theme="light"] .tf-tab,html[data-theme="light"] .tf-chip,html[data-theme="light"] .tf-surprise,html[data-theme="light"] .tf-explore input,html[data-theme="light"] .tf-explore select{background:#fff;color:${INK};border-color:#e2dacb}
html[data-theme="light"] .tf-explore li span{color:#5c564e}
`;

export const EXPLORE_JS = `(function(){
  var list = document.getElementById("tf-list");
  if (!list) return;
  var q = document.getElementById("tf-q");
  var sort = document.getElementById("tf-sort");
  var crumb = document.getElementById("tf-crumb");
  var tabs = [].slice.call(document.querySelectorAll(".tf-tab"));
  var chips = [].slice.call(document.querySelectorAll(".tf-chip"));
  var state = { tab: "Sets", chips: [], q: "" };
  function apply(){
    var rows = [].slice.call(list.children);
    rows.forEach(function(li){
      var ok = li.getAttribute("data-tab") === state.tab;
      var era = li.getAttribute("data-era");
      var price = li.getAttribute("data-price");
      state.chips.forEach(function(chip){
        if (chip === "Modern" || chip === "Vintage") ok = ok && era === chip;
        if (chip === "Has a price") ok = ok && price === "Has a price";
      });
      if (state.q && li.getAttribute("data-name").toLowerCase().indexOf(state.q) < 0) ok = false;
      li.hidden = !ok;
    });
    var visible = rows.filter(function(li){ return !li.hidden; });
    if (sort && sort.value === "name") {
      visible.sort(function(a, b){ return a.getAttribute("data-name").localeCompare(b.getAttribute("data-name")); });
      visible.forEach(function(li){ list.appendChild(li); });
    }
    if (crumb) crumb.textContent = "/ " + state.tab;
  }
  tabs.forEach(function(btn){
    btn.addEventListener("click", function(){
      state.tab = btn.getAttribute("data-tab");
      tabs.forEach(function(o){ o.setAttribute("aria-pressed", o === btn ? "true" : "false"); });
      apply();
    });
  });
  chips.forEach(function(btn){
    btn.addEventListener("click", function(){
      var name = btn.getAttribute("data-chip");
      var on = btn.getAttribute("aria-pressed") === "true";
      if (on) {
        state.chips = state.chips.filter(function(c){ return c !== name; });
        btn.setAttribute("aria-pressed", "false");
      } else if (state.chips.length < 3) {
        state.chips.push(name);
        btn.setAttribute("aria-pressed", "true");
      }
      apply();
    });
  });
  if (q) q.addEventListener("input", function(){ state.q = q.value.trim().toLowerCase(); apply(); });
  if (sort) sort.addEventListener("change", apply);
  var recent = document.getElementById("tf-recent");
  try {
    var seen = JSON.parse(localStorage.getItem("catchem-explore-seen") || "[]");
    if (recent && Array.isArray(seen) && seen.length) recent.textContent = seen.slice(0, 4).map(function(r){ return r.name; }).join(", ");
  } catch (e) {}
  list.addEventListener("click", function(ev){
    var a = ev.target.closest && ev.target.closest("a");
    if (!a) return;
    try {
      var cur = JSON.parse(localStorage.getItem("catchem-explore-seen") || "[]");
      if (!Array.isArray(cur)) cur = [];
      cur.unshift({ name: a.textContent, href: a.getAttribute("href") });
      localStorage.setItem("catchem-explore-seen", JSON.stringify(cur.slice(0, 8)));
    } catch (e) {}
  });
  var surprise = document.getElementById("tf-surprise");
  var hrefs = [].slice.call(list.querySelectorAll("a")).map(function(a){ return a.getAttribute("href"); }).filter(function(h, i, all){ return h && all.indexOf(h) === i; });
  if (surprise && hrefs.length) {
    surprise.addEventListener("click", function(ev){
      ev.preventDefault();
      location.href = hrefs[Math.floor(Math.random() * hrefs.length)];
    });
  }
  try {
    var key = "tf-scroll:" + location.pathname + location.search;
    var y = sessionStorage.getItem(key);
    if (y) requestAnimationFrame(function(){ scrollTo(0, Number(y) || 0); });
    addEventListener("pagehide", function(){ sessionStorage.setItem(key, String(scrollY || 0)); });
  } catch (e) {}
  apply();
})();`;

export function pageWrap(main, theme, title) {
  const mode = theme === "light" ? "light" : "dark";
  return `<!doctype html><html lang="en" data-theme="${mode}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Catch'em</title>
<style>
*{box-sizing:border-box}body{margin:0;background:${INK};color:${IVORY};font:16px/1.45 "IBM Plex Sans",system-ui,sans-serif;padding:16px 16px 40px}
html[data-theme="light"] body{background:${IVORY};color:${INK}}
html[data-theme="light"] a,html[data-theme="light"] .kicker,html[data-theme="light"] .logo span,html[data-theme="light"] .tf-tab[aria-pressed="true"],html[data-theme="light"] .tf-chip[aria-pressed="true"],html[data-theme="light"] .tf-dock a[aria-current="page"]{color:#7a5a1e}
.logo{font:600 28px/1 Georgia,serif;color:inherit;text-decoration:none;min-height:44px;display:inline-flex;align-items:center}.logo span{color:${GOLD}}
a{color:${GOLD}}.kicker{letter-spacing:.08em;text-transform:uppercase;color:${GOLD};font:600 12px/1 system-ui}
${EXPLORE_CSS}
</style></head><body>
<a class="logo" href="/">Catch'em<span>.</span></a>
${main}
<script>${EXPLORE_JS}</script>
</body></html>`;
}

export function previewPage(theme) {
  return pageWrap(exploreMain(), theme, "Explore");
}

export function exploreResponse(request) {
  const theme = new URL(request.url).searchParams.get("theme") === "light" ? "light" : "dark";
  return new Response(request.method === "HEAD" ? null : previewPage(theme), {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export function wantsKeep(pathname) {
  const p = String(pathname || "");
  return p.startsWith("/sets/") || p.startsWith("/c/") || p.startsWith("/p/") || p === "/reads";
}

export function injectKeep(html, pathname) {
  const src = String(html || "");
  if (!wantsKeep(pathname) || src.includes("data-tf-keep") || !src.includes("</body>")) return src;
  return src.replace("</body>", keepRow(pathname) + `<style>${EXPLORE_CSS}</style></body>`);
}

export async function paintExplore(res, request) {
  if (!res || request.method === "HEAD") return res;
  const type = res.headers.get("content-type") || "";
  if (!type.includes("text/html")) return res;
  const headers = new Headers(res.headers);
  headers.delete("content-length");
  return new Response(injectKeep(await res.text(), new URL(request.url).pathname), { status: res.status, statusText: res.statusText, headers });
}

export const TAP_PATHS = [
  { name: "Surprise me to a sealed product", taps: 1, steps: ["Surprise me"] },
  { name: "Sealed tab to 151 Elite Trainer Box", taps: 2, steps: ["Sealed", "151 Elite Trainer Box"] },
  { name: "Cards tab to Charizard ex", taps: 2, steps: ["Cards", "Charizard ex 199/165"] },
  { name: "Sets tab to 151", taps: 2, steps: ["Sets", "Scarlet and Violet 151"] },
  { name: "News tab to Delta Reign", taps: 2, steps: ["News", "Delta Reign news line"] },
];
