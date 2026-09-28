import { editorBody } from "./editor-page.mjs";

const DISCORD = "https://discord.gg/fUSjxDX4Hy";

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "\u0026amp;",
    "<": "\u0026lt;",
    ">": "\u0026gt;",
    '"': "\u0026quot;",
    "'": "&#39;",
  }[c]));
}

export function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return null;
  return "$" + x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function clockLabel(iso) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return "";
  const clock = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(t));
  return `Updated ${clock} PT`;
}

export function chartBox(hist, caption = "TCGplayer market, daily", release = "") {
  const payload = esc(JSON.stringify(hist || []));
  return `<div class="chart-box"><div class="chart" data-chart="${payload}" data-release="${esc(release || "")}" data-caption="${esc(caption)}" style="height:180px;min-height:180px"></div><div class="filters" data-ranges><button type="button" data-range="7D">7D</button><button type="button" data-range="30D">30D</button><button type="button" data-range="90D">90D</button><button type="button" data-range="1Y">1Y</button><button type="button" data-range="All" aria-pressed="true">All</button></div><p class="muted chart-note"></p></div>`;
}

const CHART_JS = `
function catchemPoints(raw){
  var rows=Array.isArray(raw)?raw:[];
  var out=[];
  for(var i=0;i<rows.length;i++){
    var p=rows[i];
    var d=Array.isArray(p)?p[0]:(p&&p.d);
    var v=Number(Array.isArray(p)?p[1]:(p&&p.v!=null?p.v:p));
    if(d&&v>0) out.push({d:String(d).slice(0,10),v:v});
  }
  out.sort(function(a,b){return a.d<b.d?-1:a.d>b.d?1:0});
  var dedup=[];
  for(var j=0;j<out.length;j++){
    if(dedup.length&&dedup[dedup.length-1].d===out[j].d) dedup[dedup.length-1]=out[j];
    else dedup.push(out[j]);
  }
  return dedup;
}
function catchemFilter(pts,range){
  if(!pts.length||range==="All") return pts.slice();
  var days=range==="7D"?7:range==="30D"?30:range==="90D"?90:365;
  var end=Date.parse(pts[pts.length-1].d+"T00:00:00Z");
  var cut=new Date(end-(days-1)*86400000).toISOString().slice(0,10);
  return pts.filter(function(p){return p.d>=cut});
}
function catchemDraw(host,pts,release,caption){
  host.innerHTML="";
  host.style.height="180px";
  host.style.minHeight="180px";
  var note=host.parentElement&&host.parentElement.querySelector(".chart-note");
  var start=pts.length?pts[0].d:"";
  if(pts.length<2){
    host.style.height="auto";
    host.style.minHeight="0";
    host.innerHTML='<p class="muted" style="margin:0">No daily points in this range.</p>';
    if(note) note.textContent=(caption||"TCGplayer market, daily")+". No daily points in this range.";
    return;
  }
  var w=640,h=Number(host.getAttribute("data-h"))||180,min=Math.min.apply(null,pts.map(function(p){return p.v})),max=Math.max.apply(null,pts.map(function(p){return p.v}));
  host.style.height=h+"px";
  host.style.minHeight=h+"px";
  var span=max-min||Math.max(max*0.04,0.01);
  var lo=min-span*0.08, hi=max+span*0.08, plot=hi-lo;
  var step=(w-72)/Math.max(1,pts.length-1);
  function y(v){return (18+((hi-v)/plot)*(h-46));}
  var d=pts.map(function(p,i){return (i?"L":"M")+(56+i*step).toFixed(1)+","+y(p.v).toFixed(1)}).join(" ");
  var rel="";
  if(release){
    for(var i=0;i<pts.length;i++){
      if(pts[i].d>=release){ rel='<line x1="'+(56+i*step).toFixed(1)+'" y1="16" x2="'+(56+i*step).toFixed(1)+'" y2="'+(h-28)+'" stroke="#6f9be8" stroke-dasharray="3 3"/>'; break; }
    }
  }
  var money=function(n){return "$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})};
  var daysNote=pts.length===2?"2 days of history":pts.length+" points";
  host.innerHTML='<svg width="100%" height="'+h+'" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="TCGplayer market, daily, '+pts.length+' points" style="display:block;width:100%;height:'+h+'px;min-height:'+h+'px;flex:none"><text x="4" y="22" fill="#c4baab" font-size="12">'+money(max)+'</text><text x="4" y="'+(h-30)+'" fill="#c4baab" font-size="12">'+money(min)+'</text>'+rel+'<path d="'+d+'" fill="none" stroke="#d9b779" stroke-width="3"></path><text x="56" y="'+(h-8)+'" fill="#c4baab" font-size="12">'+pts[0].d.slice(5)+'</text><text x="'+(w-70)+'" y="'+(h-8)+'" fill="#c4baab" font-size="12">'+pts[pts.length-1].d.slice(5)+'</text></svg><p class="chart-hover muted" style="min-height:1.2em;margin:4px 0 0"></p>';
  if(note) note.textContent=(caption||"TCGplayer market, daily")+". "+daysNote+". Axis from the low to the high, not from zero."+(release?" Release "+release+".":"");
  var svg=host.querySelector("svg");
  var hover=host.querySelector(".chart-hover");
  function show(ev){
    var rect=svg.getBoundingClientRect();
    var x=(ev.clientX-rect.left)/rect.width*w;
    var i=Math.round((x-56)/step);
    if(i<0) i=0; if(i>=pts.length) i=pts.length-1;
    if(hover) hover.textContent=pts[i].d+" · "+money(pts[i].v);
  }
  svg.addEventListener("mousemove", show);
  svg.addEventListener("click", show);
}
function catchemMount(root){
  (root||document).querySelectorAll(".chart[data-chart]").forEach(function(host){
    var raw=[]; try{ raw=JSON.parse(host.getAttribute("data-chart")||"[]"); }catch(e){ raw=[]; }
    var all=catchemPoints(raw);
    var caption=host.getAttribute("data-caption")||"TCGplayer market, daily";
    var release=host.getAttribute("data-release")||"";
    var box=host.parentElement;
    function paint(range){ catchemDraw(host, catchemFilter(all, range), release, caption); }
    paint("All");
    if(!box) return;
    box.querySelectorAll("[data-range]").forEach(function(btn){
      btn.addEventListener("click", function(){
        box.querySelectorAll("[data-range]").forEach(function(x){ x.setAttribute("aria-pressed","false"); });
        btn.setAttribute("aria-pressed","true");
        paint(btn.getAttribute("data-range"));
      });
    });
  });
}
`;

const CSS = `
:root{--bg:#12100e;--panel:#1a1815;--line:#2f2b26;--txt:#efe9de;--dim:#c4baab;--gold:#d9b779;--green:#7fc79a;--red:#e0675b;--serif:'Fraunces',Georgia,serif;--sans:'IBM Plex Sans',system-ui,sans-serif}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--txt);font:16px/1.5 var(--sans)}
body{overflow-x:hidden;padding-bottom:72px}
a{color:var(--gold)}
.site-bar{display:flex;flex-wrap:nowrap;align-items:center;justify-content:space-between;gap:10px 16px;padding:0 16px;height:56px;min-height:56px;max-height:56px;border-bottom:1px solid var(--line);background:var(--bg);position:sticky;top:0;z-index:5}
.site-bar .logo{font:600 26px/1 var(--serif);color:var(--txt);text-decoration:none;letter-spacing:-.03em}
.site-bar .logo span{color:var(--gold)}
.menu-btn{display:none;min-height:44px}
.site-bar nav{display:flex;flex-wrap:wrap;gap:8px 14px}
.site-bar nav a{color:var(--dim);text-decoration:none;font:500 14px/1 var(--sans);min-height:44px;display:inline-flex;align-items:center}
.site-bar nav a[aria-current="page"],.site-bar nav a:hover{color:var(--gold)}
@media (max-width:1279px){
  .menu-btn{display:inline-flex;align-items:center;justify-content:center}
  .site-bar nav{display:none;position:absolute;top:100%;left:0;right:0;background:#1a1815;border-bottom:1px solid var(--line);padding:8px 12px;flex-direction:column}
  .site-bar nav.open{display:flex}
}
@media (min-width:1024px){.dock{display:none}body{padding-bottom:24px}}
.chart,.chart svg,.chart-box{display:block;width:100%;min-height:180px}
.chart{height:180px;min-height:180px;flex:none}
.dock{position:fixed;left:0;right:0;bottom:0;display:flex;justify-content:space-around;gap:4px;padding:6px 8px calc(6px + env(safe-area-inset-bottom));background:#1a1815;border-top:1px solid var(--line);z-index:6}
.dock a{color:var(--dim);text-decoration:none;font:500 12px/1 var(--sans);min-height:44px;min-width:44px;display:flex;align-items:center;justify-content:center;padding:0 6px}
.dock a[aria-current="page"]{color:var(--gold)}
.wrap{max-width:1040px;margin:0 auto;padding:22px 16px 32px;overflow-x:hidden}
h1{font:500 34px/1.15 var(--serif);letter-spacing:-.02em;margin:0 0 8px}
h2{font:500 22px/1.2 var(--serif);margin:22px 0 8px}
.muted{color:var(--dim)}
.counts{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.counts b{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 12px;min-width:44px}
.counts b span{display:block;font:400 12px/1.3 var(--sans);color:var(--dim)}
.card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px;min-width:0}
.ph{width:100%;aspect-ratio:1;border-radius:12px;background:#211e1a;display:grid;place-items:center;color:var(--dim);font-size:13px}
.row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line);min-height:44px;align-items:center;min-width:0;max-width:100%}
.row a{color:var(--txt);text-decoration:none;min-width:0;flex:1;overflow-wrap:anywhere}
.row b{overflow-wrap:anywhere}
.row > b{flex:none;white-space:nowrap}
.row svg{flex:none}
img,svg{max-width:100%}
.filters input,.filters select{max-width:100%;min-width:0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(240px,100%),1fr));gap:12px}
.filters{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.filters input,.filters select{background:var(--bg);color:var(--txt);border:1px solid var(--line);border-radius:10px;min-height:44px;padding:0 10px;font:15px var(--sans)}
button{min-height:44px;padding:0 14px;border-radius:10px;border:1px solid var(--line);background:var(--panel);color:var(--txt);font:600 14px var(--sans);cursor:pointer}
button.primary{background:var(--gold);color:#1a1407;border-color:transparent}
.site-foot{max-width:1040px;margin:0 auto;padding:8px 16px 24px;color:var(--dim);font-size:14px}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{scroll-behavior:auto!important;transition:none!important}}
@media (max-width:1279px){
  .menu-btn{display:inline-flex;align-items:center;justify-content:center}
  .site-bar nav{display:none;position:absolute;top:56px;left:0;right:0;background:#1a1815;border-bottom:1px solid var(--line);padding:8px 12px;flex-direction:column}
  .site-bar nav.open{display:flex}
}
@media (min-width:1280px){.dock{display:none}body{padding-bottom:24px}.site-bar nav{display:flex}}
`;

function chrome(active, body, title, stamp) {
  const item = (href, label) => `<a href="${href}"${active === label ? ' aria-current="page"' : ""}>${label}</a>`;
  const fresh = stamp ? `<div class="wrap" style="padding-bottom:0"><p class="muted" id="fresh" style="margin:0">${esc(stamp)}</p></div>` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Catch'em</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>${CSS}</style><script>${CHART_JS}</script></head><body>
<header class="site-bar"><a class="logo" href="/">Catch'em<span>.</span></a><button class="menu-btn" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button><nav id="site-nav">
${item("/feed", "The Feed")}${item("/sets", "Sets")}${item("/board", "Movers")}${item("/artists", "Artists")}${item("/search", "Search")}${item("/post-office", "Post Office")}${item(DISCORD, "Discord Premium")}
</nav></header>
${fresh}
${body}
<nav class="dock" aria-label="Primary">
${item("/feed", "The Feed")}${item("/sets", "Sets")}${item("/board", "Movers")}${item("/artists", "Artists")}${item("/search", "Search")}
</nav>
<footer class="site-foot"><p>Made for collectors, rippers and flippers. Card names are © Pokémon / Nintendo / Creatures / GAME FREAK. Catch'em is a fan project and is not endorsed by them or by TCGplayer. Prices labeled TCGplayer market come from the public TCGCSV feed.</p><p><a href="/methodology">How the numbers are made</a> · <a href="mailto:support@catchemtcg.com">support@catchemtcg.com</a></p></footer>
<script>var menuBtn=document.querySelector(".menu-btn");var siteNav=document.getElementById("site-nav");if(menuBtn&&siteNav)menuBtn.addEventListener("click",function(){var open=siteNav.classList.toggle("open");menuBtn.setAttribute("aria-expanded",open?"true":"false")});if(window.catchemMount) catchemMount(document); else if(typeof catchemMount==="function") catchemMount(document);</script>
</body></html>`;
}

function spark(values) {
  const pts = (values || []).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (pts.length < 2) return "";
  const w = 280, h = 72, min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1;
  const step = (w - 16) / (pts.length - 1);
  const d = pts.map((v, i) => `${i ? "L" : "M"}${(8 + i * step).toFixed(1)},${(h - 10 - ((v - min) / span) * (h - 24)).toFixed(1)}`).join(" ");
  const up = pts[pts.length - 1] >= pts[0];
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="price, ${pts.length} points, axis from low to high not from zero"><path d="${d}" fill="none" stroke="${up ? "#7fc79a" : "#e0675b"}" stroke-width="2"/></svg><p class="muted" style="font-size:12px;margin:4px 0 0">${pts.length} points · axis runs from the low to the high, not from zero</p>`;
}

export function renderSets(index, stamp) {
  const sets = index?.sets || [];
  const eras = [...new Set(sets.map((s) => s.era))].sort((a, b) => {
    const order = ["Mega Evolution", "Scarlet & Violet", "Sword & Shield", "Sun & Moon", "XY", "Black & White", "HeartGold & SoulSilver", "Diamond & Pearl", "EX", "Original", "Neo", "Promos and extras", "Other"];
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || String(a).localeCompare(String(b));
  });
  const body = `<main class="wrap"><h1>Sets</h1><p class="muted">${sets.length} groups. Newest names sit with their era. Singles and sealed stay apart.</p>
${chartBox(index?.singlesIndex || [], "Singles index, chain-linked")}
${eras.map((era) => `<h2>${esc(era)}</h2><div class="grid">${sets.filter((s) => s.era === era).sort((a, b) => String(b.release || "").localeCompare(String(a.release || ""))).map((s) => `<a class="card" href="/sets/${esc(s.slug)}"><b>${esc(s.name)}</b><p class="muted">${s.single} singles · ${s.sealed} sealed${s.priced ? ` · ${s.priced} priced` : ""}${s.release ? ` · ${esc(s.release)}` : ""}</p></a>`).join("")}</div>`).join("")}
</main>`;
  return chrome("Sets", body, "Sets", stamp);
}

export function renderSetShell(slug, stamp) {
  const body = `<main class="wrap"><h1 id="title">Set</h1>
<div id="lines"></div><div id="charts"></div>
<div class="filters"><select id="kind" aria-label="Kind"><option value="">Singles and sealed</option><option value="single">Singles</option><option value="sealed">Sealed</option></select>
<input id="q" aria-label="Filter by name, rarity, or artist" placeholder="Name, rarity, artist">
<select id="sort" aria-label="Sort"><option value="price">Price</option><option value="name">Name</option><option value="num">Number</option></select>
</div><div id="list"></div><button id="more" type="button">Show more</button></main>
<script type="application/json" id="meta">${JSON.stringify({ slug }).replace(/</g, "\\u003c")}</script>
<script>
const slug=JSON.parse(document.getElementById("meta").textContent).slug;
const money=n=>!(n>0)?"No market price":"$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
function html(s){
  return String(s==null?"":s).replace(/[&<>"']/g,function(c){
    if(c==="&") return "&"+"amp;";
    if(c==="<") return "&"+"lt;";
    if(c===">") return "&"+"gt;";
    if(c==='"') return "&"+"quot;";
    return "&"+"#39;";
  });
}
let rows=[], shown=48;
function draw(){
  const kind=document.getElementById("kind").value;
  const q=document.getElementById("q").value.trim().toLowerCase();
  const sort=document.getElementById("sort").value;
  let list=rows.filter(r=>!kind||r.kind===kind);
  if(q) list=list.filter(r=>(r.name+" "+(r.rarity||"")+" "+(r.artist||"")+" "+(r.num||"")).toLowerCase().includes(q));
  list.sort((a,b)=>sort==="name"?a.name.localeCompare(b.name):sort==="num"?String(a.num).localeCompare(String(b.num)):((b.price||0)-(a.price||0)));
  const view=list.slice(0, shown);
  document.getElementById("list").innerHTML=view.map(r=>{
    const href=r.kind==="sealed"?"/p/"+encodeURIComponent(r.id):"/c/"+encodeURIComponent(r.id);
    const img=r.pid?'<img alt="" width="64" height="64" style="width:64px;height:64px;object-fit:contain;border-radius:8px;background:#211e1a" src="https://tcgplayer-cdn.tcgplayer.com/product/'+r.pid+'_in_200x200.jpg" onerror="this.remove()">':"";
    return '<div class="row">'+img+'<a href="'+href+'"><b>'+html(r.name)+'</b><br><span class="muted">'+html(r.num||"")+' '+html(r.rarity||"")+(r.artist?" · "+html(r.artist):"")+'</span></a><b>'+money(r.price)+'</b></div>';
  }).join("") || '<p class="muted">Nothing matches.</p>';
  document.getElementById("more").hidden=shown>=list.length;
}
fetch("/data/sets/"+encodeURIComponent(slug)+".json").then(r=>{if(!r.ok) throw 0; return r.json()}).then(data=>{
  document.getElementById("title").textContent=data.name;
  const moneyLine=n=>!(n>0)?"":"$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
  const link=(row,kind)=>row?'<p><b>'+(kind==="sealed"?"Sealed line":"Chase line")+'</b> <a href="'+(kind==="sealed"?"/p/":"/c/")+encodeURIComponent(row.id)+'">'+html(row.name)+'</a> '+moneyLine(row.price)+'</p>':"";
  document.getElementById("lines").innerHTML=(data.logo?'<img alt="" width="120" height="48" src="'+String(data.logo).replace(/"/g,"")+'" style="height:48px;width:auto;background:#211e1a;border-radius:8px">':"")+link(data.sealedLine,"sealed")+link(data.chaseLine,"single");
  document.getElementById("charts").innerHTML='<div class="chart-box"><p class="muted">Singles index</p><div class="chart" id="single-chart" data-caption="Singles index, chain-linked. TCGplayer market, daily" style="height:180px;min-height:180px"></div><div class="filters" data-ranges><button type="button" data-range="7D">7D</button><button type="button" data-range="30D">30D</button><button type="button" data-range="90D">90D</button><button type="button" data-range="1Y">1Y</button><button type="button" data-range="All" aria-pressed="true">All</button></div><p class="muted chart-note"></p></div><div class="chart-box"><p class="muted">Sealed index</p><div class="chart" id="sealed-chart" data-caption="Sealed index, chain-linked. TCGplayer market, daily" style="height:180px;min-height:180px"></div><div class="filters" data-ranges><button type="button" data-range="7D">7D</button><button type="button" data-range="30D">30D</button><button type="button" data-range="90D">90D</button><button type="button" data-range="1Y">1Y</button><button type="button" data-range="All" aria-pressed="true">All</button></div><p class="muted chart-note"></p></div>';
  document.getElementById("single-chart").setAttribute("data-chart", JSON.stringify(data.singleIndex||[]));
  document.getElementById("sealed-chart").setAttribute("data-chart", JSON.stringify(data.sealedIndex||[]));
  document.getElementById("single-chart").setAttribute("data-release", data.release||"");
  document.getElementById("sealed-chart").setAttribute("data-release", data.release||"");
  if(typeof catchemMount==="function") catchemMount(document.getElementById("charts"));
  rows=(data.items||[]).filter(r=>r&&r.name);
  draw();
}).catch(()=>{document.getElementById("title").textContent="This set did not load."});
["kind","q","sort"].forEach(id=>document.getElementById(id).addEventListener("input",()=>{shown=48;draw()}));
document.getElementById("more").addEventListener("click",()=>{shown+=48;draw()});
</script>`;
  return chrome("Sets", body, "Set", stamp);
}

export function renderCard(card, stamp, opts = {}) {
  if (!card) return chrome("", `<main class="wrap"><h1>Not in the catalog</h1><p class="muted">That id is not in the TCGplayer catalog we publish.</p></main>`, "Not found", stamp);
  const price = money(card.price);
  const hrefKind = card.kind === "sealed" ? "Sealed" : "Single";
  const img = card.pid
    ? `<img alt="${esc(card.name)}" width="320" height="320" src="https://tcgplayer-cdn.tcgplayer.com/product/${Number(card.pid)}_in_400x400.jpg" style="width:min(320px,100%);height:auto;border-radius:16px;background:#211e1a" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ph',textContent:'No stock image'}))">`
    : (card.scan && String(card.scan).startsWith("https://images.pokemontcg.io/")
      ? `<img alt="${esc(card.name)}" width="320" height="446" src="${esc(card.scan)}" style="width:min(280px,100%);height:auto;border-radius:16px;background:#211e1a" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ph',textContent:'No stock image'}))">`
      : `<div class="ph">No stock image</div>`);
  const pct = Number.isFinite(Number(card.pct)) ? `${card.pct > 0 ? "up" : card.pct < 0 ? "down" : "unchanged"} ${Math.abs(card.pct)}% from the last print` : "No day-to-day change to show.";
  const also = (card.also || []).map((row) => `<a href="${card.kind === "sealed" ? "/p/" : "/c/"}${esc(row.id)}">${esc(row.name)}</a>`).join(" · ");
  const low = money(card.low);
  const body = `<main class="wrap">
<p class="muted"><a href="/sets/${esc(card.setSlug || "")}">${esc(card.set || "")}</a> · ${esc(hrefKind)}</p>
<h1>${esc(card.name)}</h1>
<p style="font:600 40px/1 var(--serif);color:var(--gold)">${price || "No market price"}</p>
<p class="muted">${esc(pct)} · TCGplayer market${card.asOf ? ` (${esc(String(card.asOf).slice(0, 10))})` : ""}</p>
<p>Artist ${card.artist ? `<a href="/artists/${esc(String(card.artist).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))}">${esc(card.artist)}</a>` : "not matched"} · Number ${esc(card.num || "—")} · Rarity ${esc(card.rarity || "—")}</p>
<p class="muted">${card.sold && Number(card.sold.n) > 0 ? `TCGplayer recent sales (${esc(card.sold.n)}, ${esc(card.sold.dates || "")})` : "No sold data yet"}</p>
${(card.versions || []).length ? `<p class="muted">Prize pack versions, kept with this card and left out of search.</p><ul>${card.versions.map((v) => `<li>${esc(v.name)} ${money(v.price) || "No market price"}</li>`).join("")}</ul>` : ""}
${opts.video ? `<p><a href="/video/studio.html?ids=${esc(card.id)}">Make a Short</a></p>` : ""}
${img}
${chartBox(card.hist || [], "TCGplayer market, daily", "")}
<details><summary>Why</summary>
<p>${esc(card.artist ? `${card.name} is illustrated by ${card.artist}.` : "No illustrator credit is matched for this row.")} ${esc(pct)}</p>
<p>Sales counts are not in this feed, so there is no activity label.</p>
<p>${low ? `Lowest listed price ${low}. That is a listing, not a sold price, and it is not the market price above.` : "A lowest listed price was not stored for this row."}</p>
<p>Confidence: ${esc((card.hist || []).length >= 7 ? "Tracked" : "Early")}. Source: TCGplayer market, dated ${esc(card.asOf || "")}.</p>
</details>
<details><summary>See the math</summary>
<p>Number ${esc(card.num || "—")} · Rarity ${esc(card.rarity || "—")} · Artist ${card.artist ? `<a href="/artists/${esc(String(card.artist).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))}">${esc(card.artist)}</a>` : "not matched"}</p>
<p>${card.rank ? `Rank ${card.rank} of ${card.of} priced singles in this set.` : "No rank, because this row has no market price or it is sealed."}</p>
<p>${also ? `Also in this set: ${also}` : "No related rows stored."}</p>
<p>Condition prices are not in this feed. The market price is one number for the printing we publish.</p>
<p>Recent sold prices: ${card.sold && Number(card.sold.n) > 0 ? `TCGplayer recent sales (${esc(card.sold.n)}, ${esc(card.sold.dates || "")}).` : "No sold data yet."} TCGplayer market is the one price above, not a sold list.</p>
<p><a href="/accuracy">Accuracy</a> · <button type="button" id="paid">I paid or sold at a price</button></p>
<form id="paid-form" hidden>
<label>Price <input name="price" inputmode="decimal" required></label>
<label>Date <input name="date" type="date" required></label>
<label>Condition <input name="condition" required></label>
<label>Where <input name="where" required></label>
<button type="submit">Send</button>
<p class="muted" id="paid-status"></p>
<p class="muted">A report stays private. A community median shows only after 5 reports of the same product. We do not attach your name. Proof photos are not accepted on this page.</p>
</form>
</details>
<script type="application/json" id="paid-id">${esc(card.id)}</script>
<script>
document.getElementById("paid").addEventListener("click",function(){document.getElementById("paid-form").hidden=false});
document.getElementById("paid-form").addEventListener("submit",function(ev){
  ev.preventDefault();
  var fd=new FormData(ev.currentTarget);
  var status=document.getElementById("paid-status");
  fetch("/api/report",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:document.getElementById("paid-id").textContent,price:fd.get("price"),date:fd.get("date"),condition:fd.get("condition"),where:fd.get("where")})})
    .then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j}})})
    .then(function(res){status.textContent=res.ok?"Saved.":(res.j&&res.j.error)||"Not stored. The server store is not on."})
    .catch(function(){status.textContent="Not stored. The server store is not on."});
});
</script>
</main>`;
  return chrome("", body, card.name, stamp);
}

export function renderArtists(index, stamp) {
  const rows = index?.artists || [];
  const body = `<main class="wrap"><p class="muted">${esc(index?.note || "")}</p><h1>Artists</h1>
<div class="filters"><input id="q" aria-label="Find an artist" placeholder="Find an artist"></div>
<div id="list" class="grid">${rows.map((a) => `<a class="card" data-name="${esc(a.name.toLowerCase())}" href="/artists/${esc(a.slug)}"><b>${esc(a.name)}</b><p class="muted">${a.count} matched cards</p></a>`).join("")}</div>
<script>document.getElementById("q").addEventListener("input",ev=>{const q=ev.currentTarget.value.toLowerCase();document.querySelectorAll("#list a").forEach(a=>{a.hidden=!a.dataset.name.includes(q)})})</script>
</main>`;
  return chrome("Artists", body, "Artists", stamp);
}

export function renderArtist(doc, stamp) {
  if (!doc) return chrome("Artists", `<main class="wrap"><h1>Artist not found</h1></main>`, "Artist", stamp);
  const top = (doc.cards || []).slice(0, 12);
  const rest = (doc.cards || []).slice(12);
  const row = (c) => `<div class="row">${c.pid ? `<img alt="" width="48" height="48" src="https://tcgplayer-cdn.tcgplayer.com/product/${Number(c.pid)}_in_200x200.jpg" style="width:48px;height:48px;object-fit:contain;border-radius:8px;background:#211e1a" onerror="this.remove()">` : ""}<a href="/c/${esc(c.id)}"><b>${esc(c.name)}</b><br><span class="muted">${esc(c.set)} ${esc(c.num || "")}</span></a><b>${money(c.price) || "No market price"}</b></div>`;
  const body = `<main class="wrap"><h1>${esc(doc.name)}</h1>
${chartBox(doc.index || [], "Artist index, chain-linked")}
<p class="muted">${esc(doc.source || "")}</p>
${top.map(row).join("")}
${rest.length ? `<details><summary>Show all ${doc.cards.length}</summary>${rest.map(row).join("")}</details>` : ""}
</main>`;
  return chrome("Artists", body, doc.name, stamp);
}

export function renderMovers(doc, stamp) {
  const spark = (hist) => {
    const pts = (hist || []).map((p) => Number(Array.isArray(p) ? p[1] : p?.v)).filter((n) => n > 0);
    if (pts.length < 2) return "";
    const w = 96, h = 36, min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1;
    const step = (w - 8) / (pts.length - 1);
    const d = pts.map((v, i) => `${i ? "L" : "M"}${(4 + i * step).toFixed(1)},${(h - 4 - ((v - min) / span) * (h - 8)).toFixed(1)}`).join(" ");
    return `<svg width="96" height="36" viewBox="0 0 ${w} ${h}" style="flex:none;width:96px;height:36px" aria-hidden="true"><path d="${d}" fill="none" stroke="#d9b779" stroke-width="2"/></svg>`;
  };
  const block = (title, rows) => `<h2>${title}</h2>${(rows || []).slice(0, 12).map((r) => `<div class="row">${r.image ? `<img alt="" width="48" height="48" src="${esc(r.image)}" style="width:48px;height:48px;object-fit:contain;border-radius:8px;background:#211e1a" onerror="this.remove()">` : ""}<a href="${esc(r.href)}"><b>${esc(r.name)}</b><br><span class="muted">${esc(r.set || "")}</span></a>${spark(r.hist)}<b>${money(r.price) || "—"} <span class="muted">${Number.isFinite(r.changePct) ? (r.changePct > 0 ? "+" : "") + r.changePct + "%" : ""}</span></b></div>`).join("") || `<p class="muted">Nothing to show.</p>`}${(rows || []).length > 12 ? `<details><summary>Show more</summary>${(rows || []).slice(12).map((r) => `<div class="row"><a href="${esc(r.href)}"><b>${esc(r.name)}</b></a><b>${money(r.price) || "—"}</b></div>`).join("")}</details>` : ""}`;
  const body = `<main class="wrap"><p class="muted">Updated ${esc(doc?.asOf || "")}. ${esc(doc?.note || "")}</p>
<h1>Movers</h1>
<div id="index-charts"></div>
<div class="filters"><button type="button" data-tab="singles" aria-pressed="true">Singles</button><button type="button" data-tab="sealed">Sealed</button><button type="button" data-tab="slabs">Slabs</button></div>
<div id="singles">${block("Rising", doc?.singlesRising || doc?.singles)}${block("Falling", doc?.singlesFalling)}</div>
<div id="sealed" hidden>${block("Rising", doc?.sealedRising)}${block("Falling", doc?.sealedFalling)}</div>
<div id="slabs" hidden><h2>Slabs</h2><p class="muted">Hidden until a graded feed exists. Slabs are not mixed into the singles or sealed lists.</p></div>
<script>
document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{["singles","sealed","slabs"].forEach(id=>{document.getElementById(id).hidden=id!==b.dataset.tab});document.querySelectorAll("[data-tab]").forEach(x=>x.setAttribute("aria-pressed", x===b?"true":"false"))}));
fetch("/data/indexes.json").then(r=>r.json()).then(idx=>{
  const box=document.getElementById("index-charts");
  box.innerHTML='<div class="chart-box"><div class="chart" id="m-single" data-caption="Singles index, chain-linked. TCGplayer market, daily" style="height:180px;min-height:180px"></div><div class="filters" data-ranges><button type="button" data-range="All" aria-pressed="true">All</button></div><p class="chart-note muted"></p></div>';
  document.getElementById("m-single").setAttribute("data-chart", JSON.stringify(idx.singles||[]));
  if(typeof catchemMount==="function") catchemMount(box);
}).catch(()=>{});
</script>
</main>`;
  return chrome("Movers", body, "Movers", stamp);
}

export function renderReceipts(doc, stamp) {
  const rows = doc?.rows || [];
const mark = (r) => {
    const v = String(r.result || "open").toLowerCase();
    return v === "hit" ? "Hit" : v === "miss" ? "Miss" : "Open";
  };
  const body = `<main class="wrap"><p class="muted" id="fresh">Updated ${esc(doc?.asOf || "")}</p><h1>Receipts</h1>
<p>${esc(doc?.note || "")}</p>
<p class="muted">Scored calls: ${Number(doc?.scored) || 0}. Hit rate: ${doc?.hitRate == null ? "not shown until 20 calls are scored" : esc(String(doc.hitRate))}</p>
${chartBox(doc?.series || [], "Calls versus the later market print")}
${rows.map((r) => `<article class="card" style="margin:10px 0"><p class="muted">${mark(r)}</p><h2>${esc(r.headline)}</h2><p>${money(r.price) || "No price"} · ${esc(r.source || "")}</p>${chartBox(r.hist || [], "TCGplayer market, daily")}<p class="muted">${esc(r.why || "")}</p></article>`).join("") || `<p class="muted">No scored calls yet.</p>`}
</main>`;
  return chrome("", body, "Receipts", stamp);
}

export function renderSearch() {
  const body = `<main class="wrap"><h1>Search</h1><p class="muted">Nicknames, numbers, artists, and set shorthand. 151 ETB means the Elite Trainer Box, not a warehouse bundle.</p>
<div class="filters"><input id="q" aria-label="Search the catalog" placeholder="Moonbreon, 215/203, or Keiichiro Ito" autofocus></div>
<p class="muted" id="meta">Loading the index.</p><div id="list"></div>
<script type="module">
import * as search from "/data/search-rank.mjs";
const rankCatalog=search.rankCatalog;
const searchCatalog=search.searchCatalog;
const money=n=>!(n>0)?"":"$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
function html(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){if(c==="&")return "&"+"amp;";if(c==="<")return "&"+"lt;";if(c===">")return "&"+"gt;";if(c==='"')return "&"+"quot;";return "&"+"#39;"})}
let rows=[];
function rowHtml(r){
  const href=(r[5]==="sealed"?"/p/":"/c/")+encodeURIComponent(r[0]);
  return '<div class="row"><a href="'+href+'"><b>'+html(r[1])+'</b><br><span class="muted">'+html(r[5])+' · '+html(r[2]||"")+' '+html(r[3]||"")+' '+html(r[4]||"")+'</span></a><b>'+(money(r[6])||"No market price")+'</b></div>';
}
function draw(){
  const q=document.getElementById("q").value.trim();
  if(q.length<2){document.getElementById("list").innerHTML="";document.getElementById("meta").textContent=rows.length+" names loaded. Type at least 2 letters.";return}
  const found=typeof searchCatalog==="function"?searchCatalog(q, rows, 40):{hits:rankCatalog(q, rows, 40),nearest:[]};
  const shown=found.hits||[];
  const near=found.nearest||[];
  if(!shown.length){
    document.getElementById("meta").textContent="Not in the TCGplayer catalog.";
    document.getElementById("list").innerHTML=(near.length?'<p class="muted">Nearest names</p>':"")+near.map(rowHtml).join("")||'<p class="muted">No nearby name.</p>';
    return;
  }
  document.getElementById("meta").textContent=shown.length+" shown";
  document.getElementById("list").innerHTML=shown.map(rowHtml).join("");
}
fetch("/data/search-lite.json").then(r=>r.json()).then(data=>{rows=data;document.getElementById("meta").textContent=rows.length+" names loaded.";draw()}).catch(()=>{document.getElementById("meta").textContent="Search did not load."});
document.getElementById("q").addEventListener("input",draw);
</script></main>`;
  return chrome("Search", body, "Search");
}

export function renderMethod(counts, stamp) {
  const single = Number(counts?.single);
  const sealed = Number(counts?.sealed);
  const catalog = Number.isFinite(single) && Number.isFinite(sealed)
    ? `The public catalog is ${single.toLocaleString("en-US")} singles and ${sealed.toLocaleString("en-US")} sealed products. Slabs are not in it.`
    : "Singles and sealed are counted apart. Slabs are not in the catalog.";
  const body = `<main class="wrap"><h1>How the numbers are made</h1>
<p>Catch'em prints one price for a product: the TCGplayer market price. Singles and sealed are never added into one index.</p>
<ul>
<li><b>TCGplayer market</b> is the catalog price. ${catalog}</li>
<li>A sold list is printed only when the file has one, labeled TCGplayer recent sales. Otherwise the page says no sold data yet. The market price is still the one catalog number.</li>
</ul>
<p>A one-day move is marked <b>Early</b>. If a price is missing, the page says so. We do not print a blank, a zero, or a made-up sold price.</p>
<p>Charts say how many daily points they have. Two days is not a month. History starts on the first day we stored.</p>
<p>Box math divides that same market price by the pack count. Artist pages only include illustrator credits we could match.</p>
<p><a href="/receipts">Receipts</a> keep revisits visible. A hit rate waits until a direction was written down first.</p>
<p><a href="/corrections">Corrections</a></p>
</main>`;
  return chrome("", body, "Methodology", stamp);
}

export function renderAccuracy(doc, stamp) {
  const body = `<main class="wrap"><h1>Accuracy</h1>
<p>${esc(doc?.note || "A hit rate is shown after 20 calls had a direction written down first.")}</p>
<p class="muted">Scored ${Number(doc?.scored) || 0}. Hits ${Number(doc?.hits) || 0}. Misses ${Number(doc?.misses) || 0}. Crowd votes are not in this score until the server store is on.</p>
<p>Baseline: a read that says the price stays the same. We do not print a rate from a handful of calls.</p>
${(doc?.rows || []).map((r) => `<article class="card" style="margin:10px 0"><h2>${esc(r.name)}</h2><p>${esc(r.result || "open")} · ${esc(r.date || "")}</p></article>`).join("")}
<h2>Privacy</h2>
<p>A vote is a yes or a no on a read. A price report is the number you say you paid or received, the date, the condition, and where. We do not ask for your name. Reports stay private. A community median is shown only after five reports of the same product. You can email support@catchemtcg.com to ask for a report to be deleted.</p>
</main>`;
  return chrome("", body, "Accuracy", stamp);
}

export function renderRetired(kind) {
  const pages = {
    faq: ["Questions", "The tools are free. One price, labeled TCGplayer market. The Feed is one read at a time. The community is on Discord."],
    build: ["This page is retired", "The current site is the Feed and the catalog. Older build notes are not kept here."],
    creators: ["This page is retired", "Creator notes from the old site are not the current product. The Feed is open."],
  };
  const [title, line] = pages[kind] || pages.faq;
  const body = `<main class="wrap"><h1>${esc(title)}</h1><p>${esc(line)}</p><p><a href="/feed">The Feed</a> · <a href="/sets">Sets</a> · <a href="/methodology">How the numbers are made</a> · <a href="https://discord.gg/fUSjxDX4Hy">Discord</a></p></main>`;
  return chrome("", body, title);
}

export function renderPost(stamp, opts = {}) {
  return chrome("Post Office", editorBody(opts.asOf || "", opts), "Post Office", stamp);
}

export function renderFeed(bundle, startId, stamp, opts = {}) {
  const seen = new Set();
  const reads = (bundle?.reads || []).filter((r) => {
    if (!r || !r.headline || !money(r.price) || /\b(buy|sell|hold|floor|target|play|pick|bullish|bearish|crypto|nft|web3|ticker)\b/i.test(r.headline)) return false;
    const key = String(r.href || r.id || r.headline);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const safe = JSON.stringify(reads).replace(/</g, "\\u003c");
  const css = `
  html,body{overflow:hidden;height:100%}
  .site-foot,.wrap{display:none}body{padding-bottom:0}
  .site-bar{position:fixed;top:0;left:0;right:0}
  #snap{position:fixed;top:56px;right:0;bottom:62px;left:0;overflow:hidden;scroll-snap-type:y mandatory;overscroll-behavior:contain;touch-action:none}
  @media (min-width:1024px){#snap{bottom:0}}
  .slide{height:100%;min-height:100%;max-height:100%;scroll-snap-align:start;scroll-snap-stop:always;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:8px 16px}
  .read{width:min(420px,100%);max-height:100%;overflow:hidden;background:var(--panel);border:1px solid var(--line);border-radius:20px;padding:12px;display:flex;flex-direction:column;gap:6px}
  .read img{width:100%;max-height:18vh;object-fit:contain;background:#211e1a;border-radius:14px;flex:none}
  #snap .chart,#snap .chart svg,#snap .chart-box{min-height:0;height:auto}
  #snap .chart{height:96px;min-height:96px}
  #snap .filters{margin:2px 0}
  #snap button{min-height:32px;padding:0 10px;font-size:13px}
  .kicker{letter-spacing:.08em;text-transform:uppercase;font-size:12px;color:var(--gold);margin:0}
  .price{font:600 28px/1 var(--serif);color:var(--gold);margin:0}
  .more{display:none}.more.open{display:block}
  @media (prefers-reduced-motion:reduce){#snap{scroll-snap-type:none}}
  `;
  const stampJs = JSON.stringify(stamp || "");
  const body = `<style>${css}</style><div id="snap" tabindex="0"></div>
<script type="application/json" id="reads">${safe}</script>
<script type="application/json" id="start">${JSON.stringify(startId || "")}</script>
<script>
const reads=JSON.parse(document.getElementById("reads").textContent);
const start=JSON.parse(document.getElementById("start").textContent);
const stamp=${stampJs};
const money=n=>!(Number(n)>0)?"":"$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
function html(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){if(c==="&")return "&"+"amp;";if(c==="<")return "&"+"lt;";if(c===">")return "&"+"gt;";if(c==='"')return "&"+"quot;";return "&"+"#39;"})}
const snap=document.getElementById("snap");
function chart(hist){
  const el=document.createElement("div");
  el.className="chart-box";
  el.innerHTML='<div class="chart" style="height:180px;min-height:180px"></div><div class="filters" data-ranges><button type="button" data-range="7D">7D</button><button type="button" data-range="30D">30D</button><button type="button" data-range="90D">90D</button><button type="button" data-range="1Y">1Y</button><button type="button" data-range="All" aria-pressed="true">All</button></div><p class="muted chart-note"></p>';
  const host=el.querySelector(".chart");
  host.setAttribute("data-chart", JSON.stringify(hist||[]));
  host.setAttribute("data-caption", "TCGplayer market, daily");
  host.setAttribute("data-h","96");
  if(typeof catchemMount==="function") catchemMount(el);
  return el;
}
function slide(r,i){
  const el=document.createElement("section");
  el.className="slide"; el.id="r-"+r.id; el.dataset.i=i;
  const pct=Number.isFinite(r.changePct)?(r.changePct>0?"+":"")+r.changePct+"%":"no day-to-day change";
  const img=r.image && !/ebay/i.test(r.image)?'<img alt="" width="320" height="240" src="'+r.image.replace(/"/g,"")+'" onerror="this.replaceWith(Object.assign(document.createElement(\\'div\\'),{className:\\'ph\\',textContent:\\'No stock image\\'}))">':'<div class="ph">No stock image</div>';
  const shortLink = opts.video ? '<a href="/video/studio.html?ids='+encodeURIComponent(String(r.href||"").split("/").pop())+'">Make a Short</a>' : "";
  el.innerHTML='<article class="read"><p class="kicker">'+(stamp?stamp+' · ':'')+(i+1)+' of '+reads.length+' · '+r.type+' · '+r.confidence+'</p>'+img+'<h2 style="font:500 22px/1.2 var(--serif);margin:0">'+html(r.headline)+'</h2><p class="price">'+money(r.price)+'</p><p class="muted">'+pct+' · '+html(r.source)+'</p><div class="slot"></div><div><button type="button" data-act="more">Why</button> <button type="button" data-act="share">Share</button> '+shortLink+'</div><div class="more"><p>'+html(r.why||"")+'</p><p class="muted">Sales counts are not in this feed. '+(r.low>0?"Lowest listed price is a listing, not this market price.":"No lowest listed price is stored on this read.")+'</p><p class="muted">Confidence: '+html(r.confidence||"Early")+'. Source: '+html(r.source||"TCGplayer market")+'. </p><p><a href="'+html(r.href)+'">Open the page</a></p><p>Will this move keep going?</p><button type="button" data-vote="yes">I think it keeps going</button> <button type="button" data-vote="no">I think it fades</button><p class="vote muted"></p></div></article>';
  el.querySelector(".slot").appendChild(chart(r.hist&&r.hist.length?r.hist:r.history));
  el.querySelector("[data-act=more]").onclick=()=>el.querySelector(".more").classList.toggle("open");
  el.querySelector("[data-act=share]").onclick=async()=>{
    const url=location.origin+"/feed/r/"+encodeURIComponent(r.id);
    const text=r.headline+" "+money(r.price);
    try{
      const c=document.createElement("canvas"); c.width=1200; c.height=630;
      const g=c.getContext("2d");
      g.fillStyle="#12100e"; g.fillRect(0,0,1200,630);
      g.fillStyle="#d9b779"; g.font="600 28px sans-serif"; g.fillText("Catch'em",64,80);
      g.fillStyle="#efe9de"; g.font="500 48px Georgia, serif";
      const words=String(r.headline).split(" "); let line="", y=200;
      for(const w of words){ const next=line?line+" "+w:w; if(g.measureText(next).width>1040){ g.fillText(line,64,y); y+=62; line=w; } else line=next; }
      if(line) g.fillText(line,64,y);
      g.fillStyle="#d9b779"; g.font="600 64px Georgia, serif"; g.fillText(money(r.price)||"",64,y+100);
      const blob=await new Promise(res=>c.toBlob(res,"image/png"));
      const file=new File([blob],"catchem-read.png",{type:"image/png"});
      if(navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file],title:"Catch'em",text,url}); return; }
    }catch(e){}
    if(navigator.share){try{await navigator.share({title:"Catch'em",text,url});return}catch(e){}}
    try{await navigator.clipboard.writeText(url+" "+text)}catch(e){}
  };
  el.querySelectorAll("[data-vote]").forEach(b=>b.onclick=()=>{
    const voteEl=el.querySelector(".vote");
    fetch("/api/vote",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:r.id,vote:b.dataset.vote})})
      .then(res=>res.json().then(j=>({ok:res.ok,j})))
      .then(res=>{ voteEl.textContent=res.ok?("Votes "+(res.j.yes||0)+" keep going, "+(res.j.no||0)+" fade."):"Your vote was not stored. The server store is not on."; })
      .catch(()=>{ voteEl.textContent="Your vote was not stored. The server store is not on."; });
  });
  return el;
}
reads.forEach((r,i)=>snap.appendChild(slide(r,i)));
const end=document.createElement("section");
end.className="slide";
end.innerHTML='<article class="read"><p class="kicker">Caught up</p><h2 style="font:500 28px/1.2 var(--serif);margin:0">That is today\\'s list.</h2><p>Card prices and charts. Written short, so you can read it in a minute.</p><p><a href="/feed/all">All reads</a> · <a href="/receipts">Receipts</a></p><p><b>Discord Premium is $14.99/mo.</b> It is a Discord seat. Stadium giveaways seat Premium members automatically. The first 222 seats are numbered and never reissued. The tools on this site stay free.</p><p><a class="primary" style="display:inline-flex;align-items:center;min-height:44px" href="${DISCORD}">Join Discord</a></p></article>';
snap.appendChild(end);
const all=document.createElement("section");
all.className="slide"; all.id="all-reads";
all.innerHTML='<article class="read"><h2>All reads</h2>'+reads.map(r=>'<p><a href="/feed/r/'+encodeURIComponent(r.id)+'">'+html(r.headline)+'</a></p>').join("")+'</article>';
if(location.pathname.endsWith("/all")) snap.appendChild(all);
let startAt=reads.findIndex(r=>r.id===start);
if(startAt<0) startAt=0;
function go(i){
  const node=snap.children[Math.max(0,Math.min(snap.children.length-1,i))];
  if(node) snap.scrollTo({top:node.offsetTop,behavior:"auto"});
}
if(startAt>0) go(startAt);
let lockUntil=0;
snap.addEventListener("wheel",function(ev){
  ev.preventDefault();
  const now=Date.now();
  if(now<lockUntil) return;
  if(Math.abs(ev.deltaY)<4) return;
  lockUntil=now+500;
  const h=snap.clientHeight||1;
  const i=Math.round(snap.scrollTop/h);
  go(ev.deltaY>0?i+1:i-1);
},{passive:false});
let touchY=0;
snap.addEventListener("touchstart",function(ev){ touchY=ev.changedTouches[0].clientY; },{passive:true});
snap.addEventListener("touchend",function(ev){
  const dy=touchY-ev.changedTouches[0].clientY;
  if(Math.abs(dy)<28) return;
  const h=snap.clientHeight||1;
  const i=Math.round(snap.scrollTop/h);
  go(dy>0?i+1:i-1);
},{passive:true});
addEventListener("keydown",e=>{
  if(e.key!=="ArrowDown" && e.key!=="ArrowUp" && e.key!=="j" && e.key!=="k") return;
  const box=document.activeElement;
  if(box && (box.tagName==="INPUT"||box.tagName==="TEXTAREA")) return;
  e.preventDefault();
  const h=snap.clientHeight||1;
  const i=Math.round(snap.scrollTop/h);
  go(e.key==="ArrowDown"||e.key==="j"?i+1:i-1);
});
</script>`;
  return chrome("The Feed", body, "The Feed", stamp);
}

export function renderAll(bundle, stamp) {
  const reads = bundle?.reads || [];
  const body = `<main class="wrap"><p class="muted">Updated ${esc(bundle?.asOf || "")}. The short list is <a href="/feed">one read at a time</a>.</p><h1>All reads</h1>
${reads.map((r) => `<div class="row"><a href="/feed/r/${esc(r.id)}"><b>${esc(r.headline)}</b></a><b>${money(r.price) || ""}</b></div>`).join("")}
</main>`;
  return chrome("The Feed", body, "All reads", stamp);
}
