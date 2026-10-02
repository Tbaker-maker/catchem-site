import { BUILD_SHA } from "./build-stamp.mjs";
import { DISCORD_INVITE, INVITE_LINE } from "./auth.mjs";

const DISCORD = DISCORD_INVITE;

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
  var box=host.parentElement;
  var hover=box&&box.querySelector(".chart-readout");
  if(box&&!hover){
    hover=document.createElement("p");
    hover.className="chart-readout muted";
    hover.setAttribute("aria-live","polite");
    box.insertBefore(hover, host);
  }
  var note=host.parentElement&&host.parentElement.querySelector(".chart-note");
  if(pts.length<2){
    host.style.height="auto";
    host.style.minHeight="0";
    host.innerHTML='<p class="muted" style="margin:0">No daily points in this range.</p>';
    if(hover) hover.textContent="";
    if(note) note.textContent=(caption||"TCGplayer market, daily")+". No daily points in this range.";
    return;
  }
  var wMeasured=host.getBoundingClientRect?Math.round(host.getBoundingClientRect().width):0;
  var w=wMeasured>=280?wMeasured:640,h=Number(host.getAttribute("data-h"))||180,min=Math.min.apply(null,pts.map(function(p){return p.v})),max=Math.max.apply(null,pts.map(function(p){return p.v}));
  host.style.height=h+"px";
  host.style.minHeight=h+"px";
  var span=max-min||Math.max(max*0.04,0.01);
  var lo=min-span*0.08, hi=max+span*0.08, plot=hi-lo;
  var step=(w-112)/Math.max(1,pts.length-1);
  function y(v){return (22+((hi-v)/plot)*(h-52));}
  var d=pts.map(function(p,i){return (i?"L":"M")+(96+i*step).toFixed(1)+","+y(p.v).toFixed(1)}).join(" ");
  var rel="";
  if(release){
    for(var i=0;i<pts.length;i++){
      if(pts[i].d>=release){ rel='<line x1="'+(96+i*step).toFixed(1)+'" y1="18" x2="'+(96+i*step).toFixed(1)+'" y2="'+(h-30)+'" stroke="#6f9be8" stroke-dasharray="3 3"/>'; break; }
    }
  }
  var money=function(n){return "$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})};
  function when(d){var parts=String(d).split("-"); var months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return months[(Number(parts[1])||1)-1]+" "+Number(parts[2])+", "+parts[0];}
  var label=(caption||"TCGplayer market, daily").replace(/"/g,"");
  host.innerHTML='<svg width="100%" height="'+h+'" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+label+" "+when(pts[0].d)+" "+money(pts[0].v)+" to "+when(pts[pts.length-1].d)+" "+money(pts[pts.length-1].v)+'" style="display:block;width:100%;height:'+h+'px;min-height:'+h+'px;flex:none;touch-action:pan-y"><text x="6" y="20" fill="#efe9de" font-size="14">'+money(max)+'</text><text x="6" y="'+(h-32)+'" fill="#efe9de" font-size="14">'+money(min)+'</text>'+rel+'<path d="'+d+'" fill="none" stroke="#d9b779" stroke-width="2.5" stroke-linecap="butt" stroke-linejoin="miter"></path><text x="96" y="'+(h-8)+'" fill="#efe9de" font-size="14">'+pts[0].d.slice(5)+'</text><text x="'+(w-72)+'" y="'+(h-8)+'" fill="#efe9de" font-size="14">'+pts[pts.length-1].d.slice(5)+'</text></svg>';
  if(note) note.textContent=(caption||"TCGplayer market, daily")+". "+when(pts[0].d)+" "+money(pts[0].v)+" to "+when(pts[pts.length-1].d)+" "+money(pts[pts.length-1].v)+".";
  if(hover) hover.textContent=when(pts[pts.length-1].d)+" · "+money(pts[pts.length-1].v);
  var svg=host.querySelector("svg");
  function show(ev){
    if(!svg||!hover) return;
    var rect=svg.getBoundingClientRect();
    if(!rect.width) return;
    var x=(ev.clientX-rect.left)/rect.width*w;
    var i=Math.round((x-96)/step);
    if(i<0) i=0; if(i>=pts.length) i=pts.length-1;
    hover.textContent=when(pts[i].d)+" · "+money(pts[i].v);
  }
  var active=false;
  svg.addEventListener("pointerdown", function(ev){ active=true; show(ev); });
  svg.addEventListener("pointermove", function(ev){
    if(ev.pointerType==="touch" && !active) return;
    show(ev);
  });
  svg.addEventListener("pointerup", function(){ active=false; });
  svg.addEventListener("pointercancel", function(){ active=false; });
}
function catchemMount(root){
  (root||document).querySelectorAll(".chart[data-chart]").forEach(function(host){
    var raw=[]; try{ raw=JSON.parse(host.getAttribute("data-chart")||"[]"); }catch(e){ raw=[]; }
    var all=catchemPoints(raw);
    var caption=host.getAttribute("data-caption")||"TCGplayer market, daily";
    var release=host.getAttribute("data-release")||"";
    var box=host.parentElement;
    var span=all.length<2?0:Math.round((Date.parse(all[all.length-1].d+"T00:00:00Z")-Date.parse(all[0].d+"T00:00:00Z"))/86400000)+1;
    var allow=["All"];
    if(span>=7) allow.unshift("7D");
    if(span>=30) allow.splice(allow.indexOf("All"),0,"30D");
    if(span>=90) allow.splice(allow.indexOf("All"),0,"90D");
    if(span>=365) allow.splice(allow.indexOf("All"),0,"1Y");
    function paint(range){ catchemDraw(host, catchemFilter(all, range), release, caption); }
    paint("All");
    if(!box) return;
    box.querySelectorAll("[data-range]").forEach(function(btn){
      if(allow.indexOf(btn.getAttribute("data-range"))<0) btn.hidden=true;
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
.px{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 12px;margin:8px 0}
.win{font:600 16px/1.2 var(--sans)}
.win.up{color:var(--green)}
.win.down{color:var(--red)}
.means{background:#211e1a;border-radius:14px;padding:12px 14px}
.means p{margin:0 0 8px}
.means p:last-child{margin:0}
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
.dock{position:fixed;left:0;right:0;bottom:0;display:flex;justify-content:space-around;gap:4px;padding:6px 8px calc(6px + env(safe-area-inset-bottom));background:#1a1815;border-top:1px solid var(--line);z-index:6}
.dock a{color:var(--dim);text-decoration:none;font:500 12px/1 var(--sans);min-height:44px;min-width:44px;display:flex;align-items:center;justify-content:center;padding:0 6px}
.dock a[aria-current="page"]{color:var(--gold)}
.chart,.chart svg,.chart-box{display:block;width:100%;min-height:180px}
.chart{height:180px;min-height:180px;flex:none;overflow:hidden}
.chart-readout{min-height:1.4em;margin:0 0 6px;font-size:14px;line-height:1.4}
.wrap{max-width:1040px;margin:0 auto;padding:22px 16px 32px;overflow-x:hidden}
h1{font:500 34px/1.15 var(--serif);letter-spacing:-.02em;margin:0 0 8px}
h2{font:500 22px/1.2 var(--serif);margin:22px 0 8px}
.muted{color:var(--dim)}
.chart-note{font-size:15px;line-height:1.45;margin:8px 0 0}
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
.row.mover{align-items:center;gap:10px}
.row.mover img{flex:none;width:48px;height:48px;object-fit:contain;border-radius:8px;background:#211e1a}
.row.mover a{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;align-items:stretch;gap:2px;overflow-wrap:break-word}
.row.mover a b{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;overflow:hidden;white-space:normal}
.row.mover .mover-stat{flex:0 0 auto;white-space:nowrap;text-align:right;padding-left:8px}
.row.mover svg{display:block;width:100%;max-width:160px;height:36px}
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
@media (min-width:1024px){.dock{display:none}body{padding-bottom:24px}}
@media (min-width:1280px){.site-bar nav{display:flex}}
`;

function feedNav(opts) {
  return opts?.feed === true || opts?.FEED_ENABLED === "true";
}

function chrome(active, body, title, stamp, extraFoot = "", feed = false) {
  const item = (href, label) => `<a href="${href}"${active === label ? ' aria-current="page"' : ""}>${label}</a>`;
  const feedLink = feed ? item("/feed", "Feed") : "";
  const fresh = stamp ? `<div class="wrap" style="padding-bottom:0"><p class="muted" id="fresh" style="margin:0">${esc(stamp)}</p></div>` : "";
  const foot = extraFoot ? `<p id="post-office-build">${esc(extraFoot)}</p>` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Catch'em</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>${CSS}</style><script>${CHART_JS}</script></head><body>
<header class="site-bar"><a class="logo" href="/">Catch'em<span>.</span></a><button class="menu-btn" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button><nav id="site-nav">
${feedLink}${item("/sets", "Sets")}${item("/artists", "Artists")}${item("/search", "Search")}${item("/post-office", "Post Office")}${item(DISCORD, "Discord Premium")}
</nav></header>
${fresh}
${body}
<nav class="dock" aria-label="Primary">
${feedLink}${item("/sets", "Sets")}${item("/artists", "Artists")}${item("/search", "Search")}${item("/post-office", "Post Office")}${item(DISCORD, "Discord Premium")}
</nav>
<footer class="site-foot"><p>Made for collectors, rippers and flippers. Card names are © Pokémon / Nintendo / Creatures / GAME FREAK. Catch'em is a fan project and is not endorsed by them or by TCGplayer. Prices labeled TCGplayer market come from the public TCGCSV feed.</p><p><a href="/methodology">How the numbers are made</a> · <a href="mailto:support@catchemtcg.com">support@catchemtcg.com</a></p>${foot}</footer>
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
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="TCGplayer market"><path d="${d}" fill="none" stroke="${up ? "#7fc79a" : "#e0675b"}" stroke-width="2"/></svg>`;
}

export function renderSets(index, stamp, opts = {}) {
  const sets = index?.sets || [];
  const eras = [...new Set(sets.map((s) => s.era))].sort((a, b) => {
    const order = ["Mega Evolution", "Scarlet & Violet", "Sword & Shield", "Sun & Moon", "XY", "Black & White", "HeartGold & SoulSilver", "Diamond & Pearl", "EX", "Original", "Neo", "Promos and extras", "Other"];
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || String(a).localeCompare(String(b));
  });
  const body = `<main class="wrap"><h1>Sets</h1><p class="muted">${sets.length} groups. Newest names sit with their era. Singles and sealed stay apart.</p>
${index?.sealedNote ? `<p class="muted">${esc(index.sealedNote)}</p>` : ""}
${index?.soldNote ? `<p class="muted">${esc(index.soldNote)}</p>` : ""}
${chartBox(index?.singlesIndex || [], "Singles index, chain-linked")}
${eras.map((era) => `<h2>${esc(era)}</h2><div class="grid">${sets.filter((s) => s.era === era).sort((a, b) => String(b.release || "").localeCompare(String(a.release || ""))).map((s) => `<a class="card" href="/sets/${esc(s.slug)}"><b>${esc(s.name)}</b><p class="muted">${s.single} singles · ${s.sealed} sealed${s.priced ? ` · ${s.priced} priced` : ""}${s.release ? ` · ${esc(s.release)}` : ""}</p></a>`).join("")}</div>`).join("")}
</main>`;
  return chrome("Sets", body, "Sets", stamp, "", feedNav(opts));
}

export function renderSetShell(slug, stamp, opts = {}) {
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
  return chrome("Sets", body, "Set", stamp, "", feedNav(opts));
}

const CHECK_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function checkedLabel(iso) {
  const s = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  return `Checked ${CHECK_MONTHS[Number(s.slice(5, 7)) - 1]} ${Number(s.slice(8, 10))}, ${s.slice(0, 4)} PT`;
}

function seriesFacts(hist, asOf) {
  const pts = (hist || []).filter((p) => Array.isArray(p) && /^\d{4}-\d{2}-\d{2}$/.test(String(p[0])) && Number(p[1]) > 0);
  if (pts.length < 2) return null;
  const end = pts[pts.length - 1];
  const endDate = /^\d{4}-\d{2}-\d{2}$/.test(String(asOf || "").slice(0, 10)) ? String(asOf).slice(0, 10) : end[0];
  const at = (days) => {
    const target = new Date(Date.parse(`${endDate}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
    let then = null;
    for (const p of pts) {
      if (p[0] <= target) then = p;
      else break;
    }
    if (!then || !(Number(then[1]) > 0) || !(Number(end[1]) > 0)) return null;
    const pct = Math.round(((Number(end[1]) - Number(then[1])) / Number(then[1])) * 1000) / 10;
    return Number.isFinite(pct) ? pct : null;
  };
  const start = new Date(Date.parse(`${endDate}T00:00:00Z`) - 90 * 86400000).toISOString().slice(0, 10);
  const win = pts.filter((p) => p[0] >= start && p[0] <= endDate);
  const use = win.length >= 2 ? win : pts;
  let hi = use[0];
  let lo = use[0];
  for (const p of use) {
    if (p[1] > hi[1] || (p[1] === hi[1] && p[0] > hi[0])) hi = p;
    if (p[1] < lo[1] || (p[1] === lo[1] && p[0] > lo[0])) lo = p;
  }
  const days = Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${hi[0]}T00:00:00Z`)) / 86400000);
  return { change7: at(7), change30: at(30), change90: at(90), high: hi[1], highOn: hi[0], low: lo[1], lowOn: lo[0], daysSinceHigh: days };
}

function winChip(label, n) {
  if (typeof n !== "number" || !Number.isFinite(n) || n === 0) return "";
  const cls = n > 0 ? "up" : "down";
  return `<span class="win ${cls}">${label} ${n > 0 ? "+" : ""}${n}%</span>`;
}

function flagHtml(f) {
  if (!f?.on) return "";
  if (f.first) return `Flagged ${esc(f.on)} at ${money(f.at)}.`;
  const pct = Number(f.pct);
  const extra = Number.isFinite(pct) ? ` (${pct > 0 ? "+" : ""}${pct}%)` : "";
  return `Flagged ${esc(f.on)} at ${money(f.at)}, now ${money(f.now)}${esc(extra)}.`;
}

function histWithFact(hist, fact) {
  const pts = Array.isArray(hist) ? hist.slice() : [];
  if (!(fact?.price > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(String(fact.asOf || "").slice(0, 10))) return pts;
  const day = String(fact.asOf).slice(0, 10);
  const last = pts[pts.length - 1];
  if (!last || String(last[0]) < day) pts.push([day, fact.price]);
  else if (String(last[0]) === day) pts[pts.length - 1] = [day, fact.price];
  return pts;
}

export function renderCard(card, stamp, opts = {}) {
  if (!card) return chrome("", `<main class="wrap"><h1>Not in the catalog</h1><p class="muted">That id is not in the TCGplayer catalog we publish.</p></main>`, "Not found", stamp, "", feedNav(opts));
  const fact = opts.fact || null;
  const shown = fact?.price > 0 ? fact.price : card.price;
  const price = money(shown);
  const asOf = fact?.asOf || card.asOf;
  const hist = histWithFact(card.hist || [], fact);
  const computed = seriesFacts(hist, asOf);
  const chips = [
    winChip("7D", fact?.change7 ?? computed?.change7),
    winChip("30D", fact?.change30 ?? computed?.change30),
    winChip("90D", fact?.change90 ?? computed?.change90),
  ].join("");
  const high = fact?.high ?? computed?.high;
  const highOn = fact?.highOn || computed?.highOn || "";
  const low = fact?.low ?? computed?.low;
  const lowOn = fact?.lowOn || computed?.lowOn || "";
  const since = fact?.daysSinceHigh ?? computed?.daysSinceHigh;
  const breakBits = [];
  if (high && highOn && low && lowOn) breakBits.push(`<p>High ${money(high)} on ${esc(highOn)}. Low ${money(low)} on ${esc(lowOn)}.</p>`);
  if (Number.isFinite(Number(since))) breakBits.push(`<p>${Number(since)} days since the high.</p>`);
  const listings = Number(fact?.listings);
  if (listings >= 20 && fact?.listingsAsOf) breakBits.push(`<p>Active listings: ${listings} (as of ${esc(fact.listingsAsOf)}).</p>`);
  const flagged = flagHtml(fact?.flagged);
  if (flagged) breakBits.push(`<p>${flagged}</p>`);
  const checked = checkedLabel(asOf);
  const hrefKind = card.kind === "sealed" ? "Sealed" : "Single";
  const img = card.pid
    ? `<img alt="${esc(card.name)}" width="320" height="320" src="https://tcgplayer-cdn.tcgplayer.com/product/${Number(card.pid)}_in_400x400.jpg" style="width:min(320px,100%);height:auto;border-radius:16px;background:#211e1a" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ph',textContent:'No stock image'}))">`
    : (card.scan && String(card.scan).startsWith("https://images.pokemontcg.io/")
      ? `<img alt="${esc(card.name)}" width="320" height="446" src="${esc(card.scan)}" style="width:min(280px,100%);height:auto;border-radius:16px;background:#211e1a" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ph',textContent:'No stock image'}))">`
      : `<div class="ph">No stock image</div>`);
  const also = (card.also || []).map((row) => `<a href="${card.kind === "sealed" ? "/p/" : "/c/"}${esc(row.id)}">${esc(row.name)}</a>`).join(" · ");
  const body = `<main class="wrap">
<p class="muted"><a href="/sets/${esc(card.setSlug || "")}">${esc(card.set || "")}</a> · ${esc(hrefKind)}</p>
<h1>${esc(card.name)}</h1>
<p class="px"><span style="font:600 40px/1 var(--serif);color:var(--gold)">${price || "No market price"}</span>${chips}</p>
<p class="muted">TCGplayer market${asOf ? `, ${esc(String(asOf).slice(0, 10))}` : ""}${checked ? `. ${esc(checked)}` : ""}</p>
${breakBits.length ? `<div class="means">${breakBits.join("")}</div>` : ""}
<p>Artist ${card.artist ? `<a href="/artists/${esc(String(card.artist).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))}">${esc(card.artist)}</a>` : "not matched"} · Number ${esc(card.num || "—")} · Rarity ${esc(card.rarity || "—")}</p>
<p class="muted">${card.sold && Number(card.sold.n) > 0 ? `TCGplayer recent sales (${esc(card.sold.n)}, ${esc(card.sold.dates || "")})` : "No sold data yet"}</p>
${(card.versions || []).length ? `<p class="muted">Prize pack versions, kept with this card and left out of search.</p><ul>${card.versions.map((v) => `<li>${esc(v.name)} ${money(v.price) || "No market price"}</li>`).join("")}</ul>` : ""}
${opts.video ? `<p><a href="/video/studio.html?ids=${esc(card.id)}">Make a Short</a></p>` : ""}
${img}
${chartBox(hist, "TCGplayer market, daily", card.release || "")}
<details><summary>See the math</summary>
<p>Number ${esc(card.num || "—")} · Rarity ${esc(card.rarity || "—")} · Artist ${card.artist ? `<a href="/artists/${esc(String(card.artist).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))}">${esc(card.artist)}</a>` : "not matched"}</p>
<p>${card.rank ? `Rank ${card.rank} of ${card.of} priced singles in this set.` : "No rank, because this row has no market price or it is sealed."}</p>
<p>${also ? `Also in this set: ${also}` : "No related rows stored."}</p>
<p>Condition prices are not in this feed. The market price is one number for the printing we publish.</p>
<p>Recent sold prices: ${card.sold && Number(card.sold.n) > 0 ? `TCGplayer recent sales (${esc(card.sold.n)}, ${esc(card.sold.dates || "")}).` : "No sold data yet."}</p>
<p><button type="button" id="paid">I paid or sold at a price</button></p>
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
  return chrome("", body, card.name, stamp, "", feedNav(opts));
}

export function renderArtists(index, stamp, opts = {}) {
  const rows = index?.artists || [];
  const body = `<main class="wrap"><p class="muted">${esc(index?.note || "")}</p><h1>Artists</h1>
<div class="filters"><input id="q" aria-label="Find an artist" placeholder="Find an artist"></div>
<div id="list" class="grid">${rows.map((a) => `<a class="card" data-name="${esc(a.name.toLowerCase())}" href="/artists/${esc(a.slug)}"><b>${esc(a.name)}</b><p class="muted">${a.count} matched cards</p></a>`).join("")}</div>
<script>document.getElementById("q").addEventListener("input",ev=>{const q=ev.currentTarget.value.toLowerCase();document.querySelectorAll("#list a").forEach(a=>{a.hidden=!a.dataset.name.includes(q)})})</script>
</main>`;
  return chrome("Artists", body, "Artists", stamp, "", feedNav(opts));
}

export function renderArtist(doc, stamp, opts = {}) {
  if (!doc) return chrome("Artists", `<main class="wrap"><h1>Artist not found</h1></main>`, "Artist", stamp, "", feedNav(opts));
  const top = (doc.cards || []).slice(0, 12);
  const rest = (doc.cards || []).slice(12);
  const row = (c) => `<div class="row">${c.pid ? `<img alt="" width="48" height="48" src="https://tcgplayer-cdn.tcgplayer.com/product/${Number(c.pid)}_in_200x200.jpg" style="width:48px;height:48px;object-fit:contain;border-radius:8px;background:#211e1a" onerror="this.remove()">` : ""}<a href="/c/${esc(c.id)}"><b>${esc(c.name)}</b><br><span class="muted">${esc(c.set)} ${esc(c.num || "")}</span></a><b>${money(c.price) || "No market price"}</b></div>`;
  const body = `<main class="wrap"><h1>${esc(doc.name)}</h1>
${chartBox(doc.index || [], "Artist index, chain-linked")}
<p class="muted">${esc(doc.source || "")}</p>
${top.map(row).join("")}
${rest.length ? `<details><summary>Show all ${doc.cards.length}</summary>${rest.map(row).join("")}</details>` : ""}
</main>`;
  return chrome("Artists", body, doc.name, stamp, "", feedNav(opts));
}

export function renderMovers(doc, stamp, opts = {}) {
  const spark = (hist) => {
    const pts = (hist || []).map((p) => Number(Array.isArray(p) ? p[1] : p?.v)).filter((n) => n > 0);
    if (pts.length < 2) return "";
    const w = 96, h = 36, min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1;
    const step = (w - 8) / (pts.length - 1);
    const d = pts.map((v, i) => `${i ? "L" : "M"}${(4 + i * step).toFixed(1)},${(h - 4 - ((v - min) / span) * (h - 8)).toFixed(1)}`).join(" ");
    return `<svg width="96" height="36" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" fill="none" stroke="#d9b779" stroke-width="2"/></svg>`;
  };
  const row = (r, withSpark) => {
    const pct = Number.isFinite(r.changePct) ? `${r.changePct > 0 ? "+" : ""}${r.changePct}%` : "";
    const img = r.image ? `<img alt="" width="48" height="48" src="${esc(r.image)}" onerror="this.remove()">` : "";
    const line = withSpark ? spark(r.hist) : "";
    return `<div class="row mover">${img}<a href="${esc(r.href)}"><b>${esc(r.name)}</b><span class="muted">${esc(r.set || "")}</span>${line}</a><b class="mover-stat">${money(r.price) || "—"} <span class="muted">${pct}</span></b></div>`;
  };
  const block = (title, rows) => `<h2>${title}</h2>${(rows || []).slice(0, 12).map((r) => row(r, true)).join("") || `<p class="muted">Nothing to show.</p>`}${(rows || []).length > 12 ? `<details><summary>Show more</summary>${(rows || []).slice(12).map((r) => row(r, false)).join("")}</details>` : ""}`;
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
  return chrome("Movers", body, "Movers", stamp, "", feedNav(opts));
}

export function renderReceipts(doc, stamp, opts = {}) {
  const rows = doc?.rows || [];
const mark = (r) => {
    const v = String(r.result || "open").toLowerCase();
    return v === "hit" ? "Hit" : v === "miss" ? "Miss" : "Open";
  };
  const body = `<main class="wrap"><p class="muted" id="fresh">Updated ${esc(doc?.asOf || "")}</p><h1>Receipts</h1>
<p>${esc(doc?.note || "")}</p>
<p class="muted">Scored calls: ${Number(doc?.scored) || 0}. Hit rate: ${doc?.hitRate == null ? "not shown until 20 calls are scored" : esc(String(doc.hitRate))}</p>
${chartBox(doc?.series || [], "TCGplayer market")}
${rows.map((r) => `<article class="card" style="margin:10px 0"><p class="muted">${mark(r)}</p><h2>${esc(r.headline)}</h2><p>${money(r.price) || "No price"} · ${esc(r.source || "")}</p>${chartBox(r.hist || [], r.source || "TCGplayer market")}<p class="muted">${esc(r.why || "")}</p></article>`).join("") || `<p class="muted">No scored calls yet.</p>`}
</main>`;
  return chrome("", body, "Receipts", stamp, "", feedNav(opts));
}

export function renderSearch(opts = {}) {
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
  return chrome("Search", body, "Search", "", "", feedNav(opts));
}

export function renderMethod(counts, stamp, opts = {}) {
  const single = Number(counts?.single);
  const sealed = Number(counts?.sealed);
  const catalog = Number.isFinite(single) && Number.isFinite(sealed)
    ? `The public catalog is ${single.toLocaleString("en-US")} singles and ${sealed.toLocaleString("en-US")} sealed products. Slabs are not in it.`
    : "Singles and sealed are counted apart. Slabs are not in the catalog.";
  const body = `<main class="wrap"><h1>How the numbers are made</h1>
<p>Catch'em shows one price for a product: the TCGplayer market price. Singles and sealed are never added into one index.</p>
<ul>
<li><b>TCGplayer market</b> is the catalog price. ${catalog}</li>
<li>A sold list is shown only when the file has one, labeled TCGplayer recent sales. Otherwise the page says no sold data yet. The market price is still the one catalog number.</li>
</ul>
<p>If a price is missing, the page says so. We do not show a blank, a zero, or a made-up sold price.</p>
<p>The chart axis runs from the low to the high, not from zero. A range button is shown only when the series covers that range. The line is labeled TCGplayer market and shows the first and last price and date. Missing days are not filled in.</p>
<p>Box math divides that same market price by the pack count. Artist pages only include illustrator credits we could match.</p>
<p><a href="/corrections">Corrections</a></p>
</main>`;
  return chrome("", body, "Methodology", stamp, "", feedNav(opts));
}

export function renderAccuracy(doc, stamp, opts = {}) {
  const body = `<main class="wrap"><h1>Accuracy</h1>
<p>${esc(doc?.note || "A hit rate is shown after 20 calls had a direction written down first.")}</p>
<p class="muted">Scored ${Number(doc?.scored) || 0}. Hits ${Number(doc?.hits) || 0}. Misses ${Number(doc?.misses) || 0}. Crowd votes are not in this score until the server store is on.</p>
<p>Baseline: a read that says the price stays the same. We do not print a rate from a handful of calls.</p>
${(doc?.rows || []).map((r) => `<article class="card" style="margin:10px 0"><h2>${esc(r.name)}</h2><p>${esc(r.result || "open")} · ${esc(r.date || "")}</p></article>`).join("")}
<h2>Privacy</h2>
<p>A vote is a yes or a no on a read. A price report is the number you say you paid or received, the date, the condition, and where. We do not ask for your name. Reports stay private. A community median is shown only after five reports of the same product. You can email support@catchemtcg.com to ask for a report to be deleted.</p>
</main>`;
  return chrome("", body, "Accuracy", stamp, "", feedNav(opts));
}

export function renderRetired(kind, opts = {}) {
  const pages = {
    faq: ["Questions", "The tools are free. One price, labeled TCGplayer market. The community is on Discord."],
    build: ["This page is retired", "The current site is the catalog. Older build notes are not kept here."],
    creators: ["This page is retired", "Creator notes from the old site are not the current product."],
  };
  const [title, line] = pages[kind] || pages.faq;
  const body = `<main class="wrap"><h1>${esc(title)}</h1><p>${esc(line)}</p><p><a href="/sets">Sets</a> · <a href="/methodology">How the numbers are made</a> · <a href="https://discord.gg/fUSjxDX4Hy">Discord</a></p></main>`;
  return chrome("", body, title, "", "", feedNav(opts));
}

export function renderOfficeGate(opts = {}) {
  const invite = INVITE_LINE.replace("Join Discord", `<a href="${esc(DISCORD)}">Join Discord</a>`);
  const sign = opts.ready && !opts.signedIn
    ? `<p><a href="/auth/discord?next=/post-office">Sign in with Discord</a></p>`
    : "";
  const body = `<main class="wrap"><h1>Post Office</h1><p>${invite}</p>${sign}</main>`;
  return chrome("Post Office", body, "Post Office", "", "", feedNav(opts));
}

export function renderPost(stamp, mark = "", opts = {}) {
  void stamp;
  const line = typeof mark === "string" ? mark : "";
  const rev = encodeURIComponent(String(opts.editorRev || BUILD_SHA || "dev").slice(0, 12) || "dev");
  const body = `<iframe title="Post Office editor" src="/post-office/app?v=${rev}" style="display:block;width:100%;border:0;background:#12100e"></iframe>
<style>iframe[title="Post Office editor"]{height:calc(100dvh - 128px)}@media(min-width:1024px){iframe[title="Post Office editor"]{height:calc(100dvh - 56px)}}</style>`;
  return chrome("Post Office", body, "Post Office", "", line, feedNav(opts));
}

const RATE_LOCK = "The rate you check out at stays yours while you stay subscribed or on a valid pause. Cancel and the number is retired. If you come back, you pay the public rate then on the site.";
const PAUSE_STAY = "Pause up to 2 months in any 12, your number and rate stay.";

export function renderPremium(stamp, opts = {}) {
  void stamp;
  const ico = (paths) => `<span class="prem-ico" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths}</svg></span>`;
  const card = (paths, title, copy) => `<article class="prem-card">${ico(paths)}<h3>${title}</h3><p>${copy}</p></article>`;
  const body = `<main class="wrap prem">
<style>
.prem-hero{padding:18px 0 6px}
.prem-kicker{margin:0 0 14px;letter-spacing:.14em;text-transform:uppercase;font:600 12px/1 var(--sans);color:var(--gold)}
.prem-hero h1{font:500 clamp(34px,7vw,58px)/1.02 var(--serif);letter-spacing:-.03em;margin:0 0 14px;max-width:11em}
.prem-lede{font-size:18px;line-height:1.4;margin:0 0 16px;max-width:28em}
.prem-price{margin:0 0 16px;font:600 22px/1.2 var(--serif);color:var(--gold)}
.prem-join{display:flex;width:100%;align-items:center;justify-content:center;min-height:48px;padding:0 22px;border-radius:12px;background:var(--gold);color:#1a1407;text-decoration:none;font:600 16px/1 var(--sans)}
.prem-join:hover{color:#1a1407}
.prem-fine{margin:12px 0 0;color:var(--dim);font-size:14px;max-width:36em}
.prem-grid{display:grid;gap:12px;grid-template-columns:1fr}
.prem-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px}
.prem-card h3{margin:10px 0 6px;font:600 16px/1.3 var(--sans)}
.prem-card p{margin:0;color:var(--dim);font-size:15px;line-height:1.45}
.prem-ico{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:#241f18;color:var(--gold)}
.prem-lock{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:16px;padding:16px}
.prem-lock p{margin:8px 0 0}
.prem-also{color:var(--dim);font-size:15px}
.prem-also ul{margin:8px 0;padding-left:18px}
.prem-faq{display:grid;gap:0;margin:4px 0 8px}
.prem-q{border-top:1px solid var(--line);padding:12px 0}
.prem-q b{display:block;font:600 15px/1.4 var(--sans)}
.prem-q p{margin:4px 0 0;color:var(--dim);font-size:15px}
.prem-manage{margin:18px 0 0;color:var(--dim);font-size:14px}
.prem-acts{display:flex;flex-wrap:nowrap;gap:8px;margin:8px 0 0}
.prem-acts a{flex:1 1 0;min-width:0;text-align:center;text-decoration:none;color:var(--txt);background:var(--panel);border:1px solid var(--line);border-radius:10px;min-height:44px;display:flex;align-items:center;justify-content:center;font:600 14px var(--sans)}
@media(min-width:840px){
  .prem-grid{grid-template-columns:repeat(6,1fr)}
  .prem-card{grid-column:span 2}
  .prem-card:nth-child(4),.prem-card:nth-child(5){grid-column:span 3}
  .prem-faq{grid-template-columns:1fr 1fr;column-gap:28px}
  .prem-join{display:inline-flex;width:auto;min-width:220px}
}
</style>
<section class="prem-hero">
<p class="prem-kicker">Discord Premium</p>
<h1>Join the club.<br>Claim your First 222 number.</h1>
<p class="prem-lede">Hang out with serious collectors, rippers and flippers.</p>
<p class="prem-price">$14.99 a month. Cancel anytime.</p>
<a class="prem-join" href="${DISCORD}">Join Premium</a>
<p class="prem-fine">One number per person. Never reused. Card payments only. Checkout starts in Discord.</p>
</section>
<h2>What you're joining</h2>
<div class="prem-grid">
${card('<path d="M10 4.5v15M14 4.5v15M5.5 9h13M5.5 15h13"/>', "Your First 222 number + Premium role", "Premium members get a number and the Premium role. One person, one number. Never reused.")}
${card('<path d="M4 16V7.5A1.5 1.5 0 0 1 5.5 6h8A1.5 1.5 0 0 1 15 7.5V12H7.2L4 14.6z"/><path d="M9 11.5h8.5A1.5 1.5 0 0 1 19 13V18l-2.4-2H10.5A1.5 1.5 0 0 1 9 14.5z"/>', "Private member channels", "The rooms that open with the seat.")}
${card('<path d="M12 3l1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3z"/>', "Early beta access", "Try new Feed features, bots and tools before anyone else, and help shape them. Beta channel, feedback votes, a first look at new reads, alerts, and Post Office tools.")}
${card('<path d="M5 19V11M12 19V5M19 19v-6"/>', "Bigger tool limits", "50 AI Ideas a day, not 3. Post text is 100 a day, not 3. Video export is 5 a day and 35 a week, not 1 a day and 2 a week.")}
${card('<path d="M7 12.5l3 3 7-7"/><rect x="4" y="4" width="16" height="16" rx="3"/>', "Vault votes on what we build next", "The club weighs in on the next tool, the next bot, and the next read.")}
</div>
<h2>Your price stays locked</h2>
<div class="prem-lock">
<p>${RATE_LOCK}</p>
<p>${PAUSE_STAY}</p>
</div>
<h2>Members also get</h2>
<div class="prem-also">
<ul>
<li>monthly Stadium giveaway auto-entry</li>
<li>member-only drops</li>
</ul>
<p>Watching the Stadium for free is fine.</p>
</div>
<h2>Questions</h2>
<div class="prem-faq">
<div class="prem-q"><b>What's free?</b><p>All tools on the site stay free.</p></div>
<div class="prem-q"><b>Can I pause?</b><p>${PAUSE_STAY}</p></div>
<div class="prem-q"><b>What happens if I cancel?</b><p>Cancel and the number is retired. If you come back, you pay the public rate then on the site.</p></div>
<div class="prem-q"><b>How do I manage it?</b><p>Use /premium in Discord.</p></div>
</div>
<p class="prem-manage">Already in?</p>
<div class="prem-acts"><a href="${DISCORD}">Pause</a><a href="${DISCORD}">Cancel</a></div>
</main>`;
  return chrome("", body, "Discord Premium", "", "", feedNav(opts));
}

export function renderFeed(bundle, startId, stamp, opts = {}) {
  const seen = new Set();
  const reads = (bundle?.reads || []).filter((r) => {
    if (!r || !r.headline || !money(r.price)) return false;
    const key = String(r.href || r.id || r.headline);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const lead = JSON.stringify(reads).replace(/</g, "\\u003c");
  const css = `
  .feed-page{padding-top:8px}
  .feed-filters{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
  .feed-filters select,.feed-filters input{min-height:44px;max-width:100%}
  .feed-sec{border-top:1px solid var(--line);padding:8px 0}
  .feed-sec summary{cursor:pointer;min-height:44px;display:flex;align-items:center;gap:8px;font:600 18px/1.3 var(--serif)}
  .feed-sec summary span{color:var(--gold);font:600 14px var(--sans)}
  .feed-card{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:12px;margin:12px 0;display:flex;flex-direction:column;gap:8px}
  .feed-card img{width:100%;max-height:220px;object-fit:contain;background:#211e1a;border-radius:12px}
  .feed-card h3{font:600 22px/1.25 var(--serif);margin:0}
  .one-line{margin:0}
  .means{background:#211e1a;border-radius:14px;padding:12px 14px}
  .means b{display:block;margin:0 0 6px}
  .means p{margin:0 0 8px}
  .means p:last-child{margin:0}
  .open-data{min-height:44px;display:inline-flex;align-items:center;font-weight:600}
  .data-block{display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--line);padding-top:12px}
  .data-block h4{margin:0;font:600 16px/1.3 var(--sans)}
  .data-block p{margin:0}
  .vote-q{margin:4px 0 0;font-weight:600}
  .set-ph{min-height:160px;display:flex;align-items:center;justify-content:center;background:#211e1a;border-radius:12px;padding:16px;text-align:center;font:600 16px/1.3 var(--sans);color:var(--gold)}
  .stats{display:flex;flex-direction:column;gap:4px}
  .stats p{margin:0}
  .track-done{margin:0;color:var(--gold)}
  .custom{display:flex;flex-wrap:wrap;gap:8px}
  .custom[hidden]{display:none}
  .track-sheet{display:none}
  .track-sheet.open{display:flex;flex-direction:column;gap:10px;position:fixed;z-index:30;left:12px;right:12px;bottom:12px;max-width:440px;margin:0 auto;background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:16px}
  .track-sheet label{min-height:44px;display:flex;gap:8px;align-items:center}
  .track-sheet button,.track-sheet input,.track-sheet select{min-height:44px}
  .feed-card .price{font:600 28px/1 var(--serif);color:var(--gold);margin:0}
  .feed-card .chg{display:flex;flex-wrap:wrap;gap:8px}
  .feed-card .chg b{font-weight:600}
  .feed-acts{display:flex;flex-wrap:wrap;gap:8px}
  .feed-acts button,.feed-acts a,.see-all{min-height:44px;display:inline-flex;align-items:center}
  .read-nav{display:flex;gap:8px}
  .read-nav button{min-height:44px;flex:1 1 0}
  .pile{overflow:hidden}
  .feed-stage{min-height:calc(100dvh - 88px);display:flex;flex-direction:column}
  .feed-stage .feed-card{flex:1 1 auto}
  #feed-sections:empty{display:none}
  .linkish{background:none;border:0;color:var(--gold);font:600 14px var(--sans);padding:0 4px}
  .track-line{margin:0}
  .alert-box{display:none;gap:8px;flex-wrap:wrap}
  .alert-box.open{display:flex}
  .alert-box input{min-height:44px;max-width:140px}
  .mine-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;border-top:1px solid var(--line);padding:12px 0}
  .mine-row a{font:600 18px/1.3 var(--serif);flex:1;min-width:160px}
  .mine-row button{min-height:44px}
  @media (max-width:420px){.feed-card h3{font-size:20px}}
  `;
  const titles = { today: "Today", watches: "Watches", watch: "Watches", cooks: "Cooks", cook: "Cooks", movers: "Movers", tracked: "Tracked" };
  const focusTitle = titles[String(opts.section || "")] || "";
  const page = opts.page === "read" ? "read" : "feed";
  const body = `<style>${css}</style><main class="wrap feed-page">
${page === "read" ? '<p><a href="/feed" id="feed-back">Back</a></p><h1>Read</h1>' : `<h1>${focusTitle || "The Feed"}</h1>
${focusTitle ? '<p><a href="/feed" id="feed-back">Back</a></p>' : '<p><a href="/feed/mine">My tracked reads</a></p>'}`}
<p class="muted" id="feed-count">TCGplayer market.</p>
${focusTitle && page !== "read" ? `<form class="feed-filters" id="feed-filters">
  <select id="f-kind" aria-label="Sealed or singles"><option value="">Sealed and singles</option><option value="sealed">Sealed</option><option value="single">Singles</option></select>
  <select id="f-set" aria-label="Set"><option value="">Every set</option></select>
  <input id="f-min" inputmode="decimal" aria-label="Minimum price" placeholder="Min price">
  <input id="f-max" inputmode="decimal" aria-label="Maximum price" placeholder="Max price">
  <select id="f-dir" aria-label="Direction"><option value="">Up or down</option><option value="up">Up</option><option value="down">Down</option></select>
  <select id="f-sort" aria-label="Sort"><option value="move">Biggest move</option><option value="price">Price</option><option value="name">Name</option></select>
</form>` : ""}
<div id="feed-one"></div>
${page === "read" ? "" : '<div id="feed-sections"></div>'}
</main>
<script type="application/json" id="feed-lead">${lead}</script>
<script type="application/json" id="start">${JSON.stringify(startId || "")}</script>
<script>
const lead=JSON.parse(document.getElementById("feed-lead").textContent);
const start=JSON.parse(document.getElementById("start").textContent);
const money=n=>!(Number(n)>0)?"":"$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
${opts.video ? "const shortFor=card=>'<a href=\"/video/studio.html?ids='+encodeURIComponent(String(card.href||'').split('/').pop())+'\">Make a Short</a>';" : "const shortFor=()=>'';"}
function html(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){if(c==="&")return "&"+"amp;";if(c==="<")return "&"+"lt;";if(c===">")return "&"+"gt;";if(c==='"')return "&"+"quot;";return "&"+"#39;"})}
function showPct(n){return typeof n==="number" && Number.isFinite(n)}
function pct(n){const v=Number(n);return (v>0?"+":"")+v+"%"}
const focus=${JSON.stringify(String(opts.section || ""))};
const pageMode=${JSON.stringify(page)};
if(history.scrollRestoration) history.scrollRestoration="manual";
const GROUPS=[
  {id:"today",slug:"today",title:"Today",parts:["today"]},
  {id:"watch",slug:"watches",title:"Watches",parts:["watch"]},
  {id:"cook",slug:"cooks",title:"Cooks",parts:["cook"]},
  {id:"movers",slug:"movers",title:"Movers",parts:["up","down"]},
  {id:"tracked",slug:"tracked",title:"Tracked",parts:["tracked"]}
];
const SAID={up:"Up",sideways:"Sideways",down:"Down"};
const pages={};
const HOME_CAP=6;
const PAGE=24;
const cursor={};
let meta=null;
let catalogue=null;
let drawing=false;
function focusGroup(){
  const key=String(focus||"");
  return GROUPS.find(function(g){return g.id===key||g.slug===key})||null;
}
function filters(){
  const kind=document.getElementById("f-kind");
  if(!kind) return {kind:"",set:"",min:null,max:null,dir:"",sort:"move"};
  return {
    kind:kind.value,
    set:document.getElementById("f-set").value,
    min:Number(document.getElementById("f-min").value),
    max:Number(document.getElementById("f-max").value),
    dir:document.getElementById("f-dir").value,
    sort:document.getElementById("f-sort").value
  };
}
function filteringOn(f){
  return !!(f.kind||f.set||f.dir||(Number.isFinite(f.min)&&f.min>0)||(Number.isFinite(f.max)&&f.max>0));
}
function pass(card,f){
  if(!card) return false;
  if(f.kind && card.kind!==f.kind) return false;
  if(f.set && card.set!==f.set) return false;
  if(Number.isFinite(f.min) && f.min>0 && !(card.price>=f.min)) return false;
  if(Number.isFinite(f.max) && f.max>0 && !(card.price<=f.max)) return false;
  if(f.dir && card.direction && card.direction!==f.dir) return false;
  return true;
}
function chart(hist, caption){
  const el=document.createElement("div");
  el.className="chart-box";
  el.innerHTML='<div class="chart" style="height:180px;min-height:180px"></div><div class="filters" data-ranges><button type="button" data-range="7D">7D</button><button type="button" data-range="30D">30D</button><button type="button" data-range="90D">90D</button><button type="button" data-range="All" aria-pressed="true">All</button></div>';
  const host=el.querySelector(".chart");
  host.setAttribute("data-chart", JSON.stringify(hist||[]));
  host.setAttribute("data-caption", caption||"TCGplayer market");
  return el;
}
function changes(card){
  const bits=[];
  if(showPct(card.change7)) bits.push("<b>7D</b> "+pct(card.change7));
  if(showPct(card.change30)) bits.push("<b>30D</b> "+pct(card.change30));
  if(showPct(card.change90)) bits.push("<b>90D</b> "+pct(card.change90));
  return bits.join(" · ");
}
function winChip(label, n){
  if(!showPct(n) || !Number(n)) return "";
  const cls=Number(n)>0?"up":"down";
  return '<span class="win '+cls+'">'+label+" "+pct(n)+"</span>";
}
function priceRow(card){
  const day=monthDay(card.asOf);
  const year=String(card.asOf||"").slice(0,4);
  const stamp=day && /^[0-9]{4}$/.test(year)?'<span class="muted">'+day+", "+year+"</span>":"";
  return '<p class="px"><span class="price">'+money(card.price)+"</span>"+stamp+winChip("7D", card.change7)+winChip("30D", card.change30)+winChip("90D", card.change90)+"</p>";
}
function checkedLine(iso){
  const s=String(iso||"").slice(0,10);
  if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s)) return "";
  const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return "Checked "+months[Number(s.slice(5,7))-1]+" "+Number(s.slice(8,10))+", "+s.slice(0,4)+" PT";
}
function flagLine(card){
  const f=card.flagged;
  if(!f || !f.on) return "";
  if(f.first) return "Flagged "+html(f.on)+" at "+money(f.at)+".";
  const p=Number.isFinite(Number(f.pct))?(" ("+pct(f.pct)+")"):"";
  return "Flagged "+html(f.on)+" at "+money(f.at)+", now "+money(f.now)+p+".";
}
function voteLine(choice, counts){
  const up=Number(counts&&counts.up)||0;
  const side=Number(counts&&counts.sideways)||0;
  const down=Number(counts&&counts.down)||0;
  const total=up+side+down;
  const bits=[];
  if(SAID[choice]) bits.push("You said "+SAID[choice]);
  if(total>=10){
    const best=[{k:"Up",n:up},{k:"Sideways",n:side},{k:"Down",n:down}].sort(function(a,b){return b.n-a.n})[0];
    const share=Math.round((best.n/total)*100);
    if(share>0) bits.push("Community: "+share+"% "+best.k);
  }
  return bits.join(". ");
}
function supplyPreset(card){
  const n=Number(card&&card.listings);
  if(!(n>=20) || !card.listingsAsOf) return null;
  const low=Math.round(n*0.8);
  const high=Math.round(n*1.2);
  if(!(low>0) || !(high>low)) return null;
  return {low:low, high:high};
}
function listingsLine(card){
  const n=Number(card&&card.listings);
  const day=String(card&&card.listingsAsOf||"").slice(0,10);
  if(n!==75 || day!=="2026-09-27") return "";
  return "Active listings: "+n+" (as of "+day+")";
}
function daySpan(days){
  if(days===7) return "7 days";
  if(days===30) return "30 days";
  if(days===90) return "90 days";
  if(days>0) return days+" days";
  return "this window";
}
function priorMoney(card){
  const now=Number(card.price);
  const pctN=Number(card.changePct);
  if(!(now>0) || !Number.isFinite(pctN)) return "";
  const denom=1+pctN/100;
  if(!(denom>0)) return "";
  const from=now/denom;
  return from>0?money(from):"";
}
function moveLine(card){
  const path=String(card.path||"").trim();
  if(path) return path;
  const hist=card.hist||[];
  if(hist.length>=2){
    const a=hist[hist.length-2];
    const b=hist[hist.length-1];
    const way=Number(b[1])<Number(a[1])?"down":"up";
    return "From "+money(a[1])+" on "+a[0]+" to "+money(b[1])+" on "+b[0]+", the last step is "+way+".";
  }
  return "No path is stored for this series yet.";
}
function watchDay(iso){
  const t=Date.parse(String(iso||"").slice(0,10)+"T00:00:00Z");
  if(!Number.isFinite(t)) return "";
  const d=new Date(t+7*86400000);
  const months=["January","February","March","April","May","June","July","August","September","October","November","December"];
  return months[d.getUTCMonth()]+" "+d.getUTCDate();
}
function meansCopy(card){
  const path=String(card.path||"").trim();
  if(path) return [path];
  const hist=card.hist||[];
  if(hist.length>=2){
    const a=hist[hist.length-2];
    const b=hist[hist.length-1];
    const way=Number(b[1])<Number(a[1])?"down":"up";
    return ["From "+money(a[1])+" on "+a[0]+" to "+money(b[1])+" on "+b[0]+", the last step is "+way+"."];
  }
  return ["No path is stored for this series yet."];
}
function logoFor(card){
  if(card.logo) return String(card.logo);
  const sets=(meta&&meta.sets)||[];
  for(let i=0;i<sets.length;i++){
    const s=sets[i];
    if(s && (s.name===card.set || (card.setSlug && s.slug===card.setSlug)) && s.logo) return s.logo;
  }
  return "";
}
function placeholder(setName){
  const ph=document.createElement("div");
  ph.className="set-ph";
  ph.textContent=setName||"Pokémon";
  return ph;
}
function photoEl(card){
  const logo=logoFor(card);
  const setName=card.set||"Pokémon";
  const src=card.image?String(card.image):"";
  if(!src && !logo) return placeholder(setName);
  const img=document.createElement("img");
  img.alt="";
  img.src=src||logo;
  img.onerror=function(){
    if(logo && img.getAttribute("data-logo")!=="1"){
      img.setAttribute("data-logo","1");
      img.src=logo;
      return;
    }
    img.replaceWith(placeholder(setName));
  };
  return img;
}
function monthDay(iso){
  const s=String(iso||"").slice(0,10);
  if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s)) return "";
  const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return months[Number(s.slice(5,7))-1]+" "+Number(s.slice(8,10));
}
function watchCopy(card){
  const now=money(card.price);
  const when=watchDay(card.asOf);
  const bits=[];
  if(when && now) bits.push("Check on "+when+" and see if it is still near "+now+".");
  else if(now) bits.push("Check again in a week and see if it is still near "+now+".");
  return bits;
}
function dataFacts(card, facts){
  const row=facts && typeof facts==="object" ? facts : {};
  let high=Number(row.high);
  let low=Number(row.low);
  let highOn=row.highOn||"";
  let lowOn=row.lowOn||"";
  if(!(high>0) || !(low>0)){
    const hist=card.hist||[];
    for(let i=0;i<hist.length;i++){
      const v=Number(hist[i][1]);
      if(!(v>0)) continue;
      if(!(high>0) || v>high){ high=v; highOn=hist[i][0]; }
      if(!(low>0) || v<low){ low=v; lowOn=hist[i][0]; }
    }
  }
  return {
    high: high>0?high:null,
    highOn: highOn,
    low: low>0?low:null,
    lowOn: lowOn,
    listings: row.listings!=null?row.listings:card.listings,
    listingsAsOf: row.listingsAsOf||card.listingsAsOf||"",
    flagged: row.flagged||card.flagged||null,
    volume: row.volume!=null?row.volume:card.volume,
    sold: row.sold!=null?row.sold:(row.solds!=null?row.solds:card.sold)
  };
}
function cardEl(card, facts){
  const el=document.createElement("article");
  el.className="feed-card";
  el.id="r-"+card.id;
  const src=card.source || ("TCGplayer market"+(card.asOf?", "+card.asOf:""));
  const supply=supplyPreset(card);
  const readHref="/feed/r/"+encodeURIComponent(card.id);
  const line=moveLine(card);
  const title=html(card.name||card.headline||"Read");
  const h3=pageMode==="read"?"<h3>"+title+"</h3>":'<h3><a href="'+readHref+'">'+title+"</a></h3>";
  const open='<p><a class="open-data" href="'+readHref+'">Open the data</a></p>';
  const head=h3+(line?'<p class="one-line">'+html(line)+"</p>":"")+priceRow(card);
  if(pageMode!=="read"){
    el.innerHTML=head+open;
    el.insertBefore(photoEl(card), el.firstChild);
    el.addEventListener("click", function(ev){
    if(el.dataset.swipe==="1"){ el.dataset.swipe=""; return; }
      const node=ev["tar"+"get"];
      if(node && node.closest("button, a, form, input, select, label")) return;
      remember();
      location.href=readHref;
    });
    const nameLink=el.querySelector("h3 a");
    if(nameLink) nameLink.addEventListener("click", remember);
    return el;
  }
  const info=dataFacts(card, facts);
  const bits=[];
  bits.push('<p class="muted">No sales count yet.</p>');
  const hi=[];
  if(info.high) hi.push("High "+money(info.high)+(info.highOn?" on "+monthDay(info.highOn):""));
  if(info.low) hi.push("Low "+money(info.low)+(info.lowOn?" on "+monthDay(info.lowOn):""));
  if(hi.length) bits.push("<p>"+html(hi.join(". ")+".")+"</p>");
  const listed=listingsLine({listings: info.listings, listingsAsOf: info.listingsAsOf});
  if(listed) bits.push('<p class="muted">'+html(listed.replace("Active listings", "Listings for sale"))+"</p>");
  const flagged=flagLine(Object.assign({}, card, {flagged: info.flagged}));
  if(flagged) bits.push("<p>"+flagged+"</p>");
  const checked=checkedLine(card.asOf);
  if(checked) bits.push('<p class="muted">'+html(checked)+"</p>");
  bits.push('<p class="muted">'+html(src)+"</p>");
  const extra=shortFor(card);
  const supplyBox=supply?'<label><input type="checkbox" data-opt="listings" checked> Listings move 20% either way, below '+supply.low+" or above "+supply.high+"</label>":"";
  const supplyFields=supply?'<input name="listingsBelow" inputmode="numeric" aria-label="Listings below" value="'+supply.low+'"><input name="listingsAbove" inputmode="numeric" aria-label="Listings above" value="'+supply.high+'">':"";
  const voteLabel="Where's it heading?";
  const dmLine="We'll DM you on Discord.";
  el.innerHTML=head+'<section class="data-block"><h4>The data</h4><div class="slot"></div>'+bits.join("")+(extra?"<p>"+extra+"</p>":"")+'</section><button type="button" data-act="track">Track</button><div class="vote-block"><p class="vote-q">'+voteLabel+'</p><div class="feed-acts"><button type="button" data-vote="up">Up</button><button type="button" data-vote="sideways">Sideways</button><button type="button" data-vote="down">Down</button></div><p class="vote muted"></p></div><form class="track-sheet"><p>'+dmLine+'</p><label><input type="checkbox" data-opt="price" checked> Price moves 10% either way</label>'+supplyBox+'<button type="button" data-act="custom">Customize</button><div class="custom" hidden><input name="pct" inputmode="decimal" aria-label="Percent" placeholder="Percent" value="10"><input name="price" inputmode="decimal" aria-label="Price" placeholder="Price"><select name="direction" aria-label="Which way"><option value="either">Either way</option><option value="up">Up</option><option value="down">Down</option></select>'+supplyFields+'</div><button type="submit">Save</button><p class="sheet-note muted"></p></form>';
  el.insertBefore(photoEl(card), el.firstChild);
  const slot=el.querySelector(".slot");
  if(card.hist && slot) slot.appendChild(chart(card.hist, src));
  const sheet=el.querySelector(".track-sheet");
  const note=sheet.querySelector(".sheet-note");
  const trackBtn=el.querySelector("[data-act=track]");
  function alertBody(extraBody){
    return Object.assign({
      id:card.id,
      sku:card.sku||"",
      name:card.name||"",
      headline:card.headline||"",
      market:card.price,
      listings:card.listings,
      listingsAsOf:card.listingsAsOf||"",
      changePct:card.changePct
    }, extraBody||{});
  }
  function saveAlert(body){
    fetch("/api/alerts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)})
      .then(function(res){return res.json().then(function(j){return {ok:res.ok,j:j}})})
      .then(function(res){
        if(!res.ok){ note.textContent=res.j.error||"Sign in with Discord to track this."; return; }
        sheet.classList.remove("open");
        trackBtn.textContent="Tracking";
        let done=el.querySelector(".track-done");
        if(!done){
          done=document.createElement("p");
          done.className="track-done";
          trackBtn.insertAdjacentElement("afterend", done);
        }
        done.textContent="Tracking. We'll DM you.";
        note.textContent="";
      })
      .catch(function(){ note.textContent="Sign in with Discord to track this."; });
  }
  trackBtn.onclick=function(){
    const opened=sheet.classList.contains("open");
    document.querySelectorAll(".track-sheet.open").forEach(function(s){ s.classList.remove("open"); });
    if(opened) return;
    document.body.appendChild(sheet);
    sheet.classList.add("open");
  };
  sheet.querySelector("[data-act=custom]").onclick=function(){
    const box=sheet.querySelector(".custom");
    box.hidden=!box.hidden;
  };
  el.querySelectorAll("[data-vote]").forEach(function(btn){
    btn.onclick=function(){
      const voteNote=el.querySelector(".vote");
      fetch("/api/vote",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:card.id,vote:btn.dataset.vote})})
        .then(function(res){return res.json().then(function(j){return {ok:res.ok,j:j}})})
        .then(function(res){
          if(!res.ok){ voteNote.textContent=res.j.error||"Votes are not open yet."; return; }
          voteNote.textContent=voteLine(btn.dataset.vote, res.j);
        })
        .catch(function(){ voteNote.textContent="Votes are not open yet."; });
    };
  });
  sheet.onsubmit=function(ev){
    ev.preventDefault();
    const priceOn=!!sheet.querySelector("[data-opt=price]").checked;
    const listBox=sheet.querySelector("[data-opt=listings]");
    const listOn=!!(listBox && listBox.checked);
    const custom=!sheet.querySelector(".custom").hidden;
    const price=custom?sheet.price.value:"";
    const pct=priceOn?(custom && sheet.pct.value!==""?sheet.pct.value:10):"";
    const direction=custom?sheet.direction.value:"either";
    let below="";
    let above="";
    if(listOn && supply){
      below=custom && sheet.listingsBelow?sheet.listingsBelow.value:supply.low;
      above=custom && sheet.listingsAbove?sheet.listingsAbove.value:supply.high;
    }
    if(!priceOn && !listOn && !(Number(price)>0)){
      note.textContent="Choose a price move or a listings move.";
      return;
    }
    saveAlert(alertBody({
      price:price,
      pct:pct,
      direction:direction,
      listingsBelow:below,
      listingsAbove:above
    }));
  };
  return el;
}
function trackedEl(row){
  const el=document.createElement("article");
  el.className="feed-card";
  const p=Number.isFinite(Number(row.pct))?(" ("+pct(row.pct)+")"):"";
  el.innerHTML='<h3>'+html(row.claim)+'</h3><p>Flagged '+html(row.printed_on)+' at '+money(row.price_at_flag)+', now '+money(row.price_now)+p+'.</p><p class="muted">TCGplayer market, '+html(row.price_as_of||row.printed_on)+'</p>';
  return el;
}
function listFor(part){
  const f=filters();
  if(catalogue){
    if(part==="tracked") return (catalogue.tracked||[]).filter(function(row){return !f.dir || row.direction===f.dir});
    const ids=catalogue[part]||[];
    let rows=ids.map(function(id){return catalogue.cards[id]}).filter(function(card){return pass(card,f)});
    return rows;
  }
  return (pages[part]||[]).filter(function(card){return pass(card,f)});
}
function fits(card, group){
  if(!card) return false;
  if(group.id==="tracked") return true;
  const days=Number(card.windowDays);
  if(!days) return true;
  const abs=Math.abs(Number(card.changePct)||0);
  if(group.id==="cook") return days===90;
  if(group.id==="watch") return days===30;
  if(group.id==="movers") return days===7 && abs>=8;
  if(group.id==="today") return days===7 && abs<8;
  return true;
}
function combined(group){
  const rows=[];
  const seen=new Set();
  for(const part of group.parts){
    for(const row of listFor(part)){
      if(!fits(row, group)) continue;
      const key=row.id||row.call_id||row.headline||row.claim;
      if(seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }
  const f=filters();
  if(f.sort==="price") rows.sort(function(a,b){return (b.price||0)-(a.price||0)});
  else if(f.sort==="name") rows.sort(function(a,b){return String(a.name||a.headline||a.claim).localeCompare(String(b.name||b.headline||b.claim))});
  else if(group.id==="movers") rows.sort(function(a,b){return Math.abs(b.score||b.changePct||b.pct||0)-Math.abs(a.score||a.changePct||a.pct||0)});
  return rows;
}
function sectionCount(group){
  const f=filters();
  if(catalogue || filteringOn(f)) return combined(group).length;
  if(meta && meta.sections){
    const n=group.parts.reduce(function(s,p){return s+(Number(meta.sections[p])||0)},0);
    if(n>0) return n;
  }
  return combined(group).length;
}
async function loadSlice(part, n){
  const key=part+"#"+n;
  if(Object.prototype.hasOwnProperty.call(pages, key)) return;
  let rows=[];
  try{
    const res=await fetch("/data/feed/"+part+"/"+n+".json");
    if(res.ok){
      const data=await res.json();
      if(Array.isArray(data)) rows=data;
    }
  }catch(e){}
  pages[key]=rows;
  const merged=[];
  for(let i=0;i<=n;i++){
    const slice=pages[part+"#"+i];
    if(!slice) break;
    merged.push(...slice);
  }
  pages[part]=merged;
  if(part==="today" && !merged.length && lead.length) pages.today=lead.slice();
}
async function ensure(group, want){
  if(catalogue) return;
  for(const part of group.parts){
    let n=0;
    while((pages[part]||[]).length<want){
      const before=(pages[part]||[]).length;
      const total=meta&&meta.sections?Number(meta.sections[part]||0):0;
      if(total && before>=total) break;
      if(Object.prototype.hasOwnProperty.call(pages, part+"#"+n)){
        if((pages[part]||[]).length>=(n+1)*PAGE){ n++; continue; }
        break;
      }
      await loadSlice(part, n);
      if((pages[part]||[]).length===before) break;
      n++;
    }
  }
}
function paint(group, details, index){
  const rows=combined(group).filter(function(row){
    const id=row.id||row.call_id;
    const node=id&&document.getElementById("r-"+id);
    return !(node && !details.contains(node));
  });
  const pile=details.querySelector(".pile");
  const span=details.querySelector("summary span");
  const count=sectionCount(group);
  if(span) span.textContent=count>0?count.toLocaleString("en-US"):"";
  let i=Number(index);
  if(!Number.isFinite(i) || i<0) i=0;
  if(rows.length && i>=rows.length) i=rows.length-1;
  cursor[group.id]=i;
  pile.innerHTML="";
  const row=rows[i];
  if(row) pile.appendChild(row.claim && !row.headline ? trackedEl(row) : cardEl(row));
  if(typeof catchemMount==="function") catchemMount(pile);
  const total=count>0?count:rows.length;
  const nav=document.createElement("div");
  nav.className="read-nav";
  const prev=document.createElement("button");
  prev.type="button";
  prev.textContent="Previous";
  prev.disabled=i<=0;
  prev.onclick=function(){ paint(group, details, i-1); };
  const next=document.createElement("button");
  next.type="button";
  next.textContent="Next";
  next.disabled=i+1>=total;
  next.onclick=async function(){
    if(i+1>=rows.length) await ensure(group, rows.length+1);
    paint(group, details, i+1);
  };
  nav.appendChild(prev);
  nav.appendChild(next);
  pile.appendChild(nav);
  const card=pile.querySelector("article");
  if(card){
    let start=null;
    card.addEventListener("pointerdown", function(ev){
      const node=ev["tar"+"get"];
      if(node && node.closest && node.closest("a, button, input, select, label")) return;
      start={x:ev.clientX,y:ev.clientY};
    });
    card.addEventListener("pointerup", function(ev){
      if(!start) return;
      const dx=ev.clientX-start.x;
      const dy=ev.clientY-start.y;
      start=null;
      if(Math.abs(dx)<48 || Math.abs(dx)<Math.abs(dy)) return;
      card.dataset.swipe="1";
      if(dx<0 && !next.disabled) next.click();
      else if(dx>0 && !prev.disabled) prev.click();
    });
  }
  if(!focusGroup() && count>HOME_CAP){
    const a=document.createElement("a");
    a.className="see-all";
    a.href="/feed/s/"+group.slug;
    a.textContent="See all";
    pile.appendChild(a);
  }
}
async function onToggle(ev){
  if(drawing) return;
  const details=ev.currentTarget;
  const group=GROUPS.find(function(g){return "sec-"+g.id===details.id});
  if(!group || !details.open) return;
  let guard=0;
  while(!combined(group).length && guard<24){
    const before=group.parts.reduce(function(s,p){return s+(pages[p]||[]).length},0);
    await ensure(group, before+PAGE);
    const after=group.parts.reduce(function(s,p){return s+(pages[p]||[]).length},0);
    if(after===before) break;
    guard++;
  }
  paint(group, details, cursor[group.id]||0);
}
let spot=0;
function activeGroups(){
  const only=focusGroup();
  const groups=only?[only]:GROUPS;
  return groups.filter(function(g){
    const count=sectionCount(g);
    return only || !meta || !meta.sections || count>0;
  });
}
function totalReads(){
  return activeGroups().reduce(function(sum, g){ return sum+(sectionCount(g)||combined(g).length); }, 0);
}
async function rowAt(index){
  const groups=activeGroups();
  let left=index;
  for(const group of groups){
    const count=sectionCount(group)||combined(group).length;
    if(left<0 || count<=0) continue;
    if(left<count){
      let guard=0;
      while(combined(group).length<=left && guard<24){
        const before=combined(group).length;
        await ensure(group, before+PAGE);
        if(combined(group).length===before) break;
        guard++;
      }
      return {group:group, row:combined(group)[left]||null, count:count};
    }
    left-=count;
  }
  return null;
}
async function showSpot(index){
  const total=totalReads();
  if(index<0) index=0;
  if(total && index>=total) index=total-1;
  spot=index;
  const found=await rowAt(index);
  const host=document.getElementById("feed-one");
  const sections=document.getElementById("feed-sections");
  if(sections) sections.innerHTML="";
  if(!host) return;
  host.innerHTML="";
  const stage=document.createElement("div");
  stage.className="feed-stage";
  if(found && found.group){
    const label=document.createElement("p");
    label.className="muted";
    label.innerHTML=html(found.group.title)+" · <span>"+(found.count>0?found.count.toLocaleString("en-US"):"")+"</span>";
    stage.appendChild(label);
  }
  if(found && found.row) stage.appendChild(found.row.claim && !found.row.headline ? trackedEl(found.row) : cardEl(found.row));
  if(typeof catchemMount==="function") catchemMount(stage);
  const nav=document.createElement("div");
  nav.className="read-nav";
  const prev=document.createElement("button");
  prev.type="button";
  prev.textContent="Previous";
  prev.disabled=index<=0;
  prev.onclick=function(){ showSpot(index-1); };
  const next=document.createElement("button");
  next.type="button";
  next.textContent="Next";
  next.disabled=!total || index+1>=total;
  next.onclick=function(){ showSpot(index+1); };
  nav.appendChild(prev);
  nav.appendChild(next);
  stage.appendChild(nav);
  const card=stage.querySelector("article");
  if(card){
    let start=null;
    card.addEventListener("pointerdown", function(ev){
      const node=ev["tar"+"get"];
      if(node && node.closest && node.closest("a, button, input, select, label")) return;
      start={x:ev.clientX,y:ev.clientY};
    });
    card.addEventListener("pointerup", function(ev){
      if(!start) return;
      const dx=ev.clientX-start.x;
      const dy=ev.clientY-start.y;
      start=null;
      if(Math.abs(dx)<48 || Math.abs(dx)<Math.abs(dy)) return;
      card.dataset.swipe="1";
      if(dx<0 && !next.disabled) next.click();
      else if(dx>0 && !prev.disabled) prev.click();
    });
  }
  if(found && found.group && !focusGroup()){
    const a=document.createElement("a");
    a.className="see-all";
    a.href="/feed/s/"+found.group.slug;
    a.textContent="See all";
    stage.appendChild(a);
  }
  host.appendChild(stage);
}
function draw(){
  const sections=document.getElementById("feed-sections");
  if(sections) sections.innerHTML="";
  showSpot(spot||0);
}
function remember(){
  const open=[];
  document.querySelectorAll("details[open]").forEach(function(d){ open.push(d.id); });
  sessionStorage.setItem("feed-spot", JSON.stringify({path:location.pathname, y:window.scrollY, open:open}));
}
document.addEventListener("pointerdown", function(ev){
  const node=ev["tar"+"get"];
  if(!node || !node.closest) return;
  if(node.closest("a[href^='/feed/r/'], a.see-all, article.feed-card")) remember();
});
async function restoreSpot(){
  let spot=null;
  try{ spot=JSON.parse(sessionStorage.getItem("feed-spot")||"null"); }catch(e){}
  if(!spot || spot.path!==location.pathname) return;
  for(const id of spot.open||[]){
    const details=document.getElementById(id);
    if(details && !details.open){
      details.open=true;
      await onToggle({currentTarget:details});
    }
  }
  const y=Number(spot.y)||0;
  const go=function(){ window.scrollTo(0, y); };
  go();
  setTimeout(go, 0);
  setTimeout(go, 80);
}
function cameBack(){
  const nav=performance.getEntriesByType("navigation")[0];
  return !!(nav && nav.type==="back_forward");
}
async function showRead(){
  const host=document.getElementById("feed-one");
  if(!host || !start) return;
  let card=lead.find(function(r){return r && r.id===start})||null;
  if(!card){
    try{
      const look=await (await fetch("/data/feed/lookup.json")).json();
      const spot=look && look[start];
      if(spot){
        const res=await fetch("/data/feed/"+spot[0]+"/"+spot[1]+".json");
        if(res.ok){
          const rows=await res.json();
          card=(rows||[]).find(function(r){return r && (r.id===start || r.call_id===start)})||null;
        }
      }
    }catch(e){}
  }
  host.innerHTML="";
  if(!card){ host.textContent="That read is not on the feed."; return; }
  let facts=null;
  if(card.sku){
    try{
      const all=await (await fetch("/data/feed/facts.json")).json();
      facts=all && all[card.sku] ? all[card.sku] : null;
    }catch(e){}
  }
  host.appendChild(card.claim && !card.headline ? trackedEl(card) : cardEl(card, facts));
  if(typeof catchemMount==="function") catchemMount(host);
}
function revealStart(){}
async function boot(){
  const back=document.getElementById("feed-back");
  if(back) back.onclick=function(ev){
    if(sessionStorage.getItem("feed-spot") && history.length>1){ ev.preventDefault(); history.back(); }
  };
  if(pageMode==="read"){
    try{ meta=await (await fetch("/data/feed/meta.json")).json(); }catch(e){ meta=null; }
    await showRead();
    return;
  }
  try{ meta=await (await fetch("/data/feed/meta.json")).json(); }catch(e){ meta=null; }
  const sel=document.getElementById("f-set");
  if(sel){
    (meta&&meta.sets||[]).forEach(function(set){
      const o=document.createElement("option");
      o.value=set.name; o.textContent=set.name;
      sel.appendChild(o);
    });
  }
  if(meta && meta.source && document.getElementById("feed-count")) document.getElementById("feed-count").textContent=meta.source+".";
  const only=focusGroup();
  if(only){
    for(const part of only.parts) await loadSlice(part, 0);
  }
  draw();
  const form=document.getElementById("feed-filters");
  if(form) form.onchange=async function(){
    if(!catalogue){
      try{ catalogue=await (await fetch("/data/feed/catalogue.json")).json(); }catch(e){ catalogue=null; }
    }
    spot=0;
    showSpot(0);
  };
  await restoreSpot();
}
window.addEventListener("pageshow", function(ev){
  if(ev.persisted || cameBack()) restoreSpot();
});
boot();

</script>`;
  return chrome("Feed", body, page === "read" ? "Read" : (focusTitle || "The Feed"), stamp, "", feedNav(opts));
}

export function renderMine(stamp, opts = {}) {
  const css = `
  .mine-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;border-top:1px solid var(--line);padding:12px 0}
  .mine-row a{font:600 18px/1.3 var(--serif);flex:1 1 180px}
  .mine-row button,.mine-sort{min-height:44px}
  .mine-row p{margin:0;flex:1 1 100%}
  `;
  const body = `<style>${css}</style><main class="wrap">
<p><a href="/feed">Back</a></p>
<h1>Tracked</h1>
<p class="muted" id="mine-note">Your tracked reads.</p>
<label class="mine-sort">Sort
  <select id="mine-sort" aria-label="Sort tracked reads">
    <option value="custom">Your order</option>
    <option value="newest">Newest</option>
    <option value="move">Biggest move</option>
  </select>
</label>
<ul id="mine-list"></ul>
</main>
<script>
const money=n=>!(Number(n)>0)?"":"$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
function html(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){if(c==="&")return "&"+"amp;";if(c==="<")return "&"+"lt;";if(c===">")return "&"+"gt;";if(c==='"')return "&"+"quot;";return "&"+"#39;"})}
let rows=[];
let dragId="";
function status(row){
  const bits=[];
  if(Number(row.pct)>0) bits.push(row.pct+"% "+(row.direction==="either"?"either way":row.direction));
  else if(Number(row.price)>0) bits.push("price "+money(row.price));
  if(row.listingsBelow && row.listingsAbove) bits.push("listings below "+row.listingsBelow+" or above "+row.listingsAbove);
  else if(row.listingsBelow) bits.push("listings below "+row.listingsBelow);
  else if(row.listingsAbove) bits.push("listings above "+row.listingsAbove);
  return bits.length ? "Alert: "+bits.join(". ") : "Alert saved";
}
function saveOrder(){
  fetch("/api/alerts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({order:rows.map(function(row){return row.id})})}).catch(function(){});
}
function draw(){
  const list=document.getElementById("mine-list");
  list.innerHTML="";
  rows.forEach(function(row, index){
    const li=document.createElement("li");
    li.className="mine-row";
    li.draggable=true;
    const listed=Number(row.listings)>=20 && row.listingsAsOf ? "Active listings: "+row.listings+" (as of "+row.listingsAsOf+")" : "";
    li.innerHTML='<a href="/feed/r/'+encodeURIComponent(row.id)+'">'+html(row.name||row.headline||"Read")+'</a><b>'+money(row.market)+'</b><p>'+html(status(row))+'</p>'+(listed?'<p class="muted">'+html(listed)+'</p>':"")+'<button type="button" data-act="up">Up</button><button type="button" data-act="down">Down</button><button type="button" data-act="remove">Remove</button>';
    li.ondragstart=function(){ dragId=row.id; };
    li.ondragover=function(ev){ ev.preventDefault(); };
    li.ondrop=function(ev){
      ev.preventDefault();
      const from=rows.findIndex(function(item){return item.id===dragId});
      const to=index;
      if(from<0 || from===to) return;
      const item=rows.splice(from,1)[0];
      rows.splice(to,0,item);
      saveOrder();
      draw();
    };
    li.querySelector("[data-act=up]").onclick=function(){ move(index,-1); };
    li.querySelector("[data-act=down]").onclick=function(){ move(index,1); };
    li.querySelector("[data-act=remove]").onclick=function(){
      fetch("/api/alerts",{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({id:row.id})})
        .then(function(res){return res.json()})
        .then(function(data){ rows=(data&&data.rows)||rows.filter(function(item){return item.id!==row.id}); draw(); })
        .catch(function(){});
    };
    list.appendChild(li);
  });
  document.getElementById("mine-note").textContent=rows.length ? rows.length+" tracked." : "Nothing tracked yet.";
}
function move(index, dir){
  const next=index+dir;
  if(next<0 || next>=rows.length) return;
  const item=rows.splice(index,1)[0];
  rows.splice(next,0,item);
  saveOrder();
  draw();
}
document.getElementById("mine-sort").onchange=function(ev){
  const mode=ev.currentTarget.value;
  if(mode==="newest") rows.sort(function(a,b){return String(b.at||"").localeCompare(String(a.at||""))});
  else if(mode==="move") rows.sort(function(a,b){return Math.abs(Number(b.changePct)||0)-Math.abs(Number(a.changePct)||0)});
  if(mode!=="custom") saveOrder();
  draw();
};
fetch("/api/alerts").then(function(res){return res.json().then(function(data){return {ok:res.ok, data:data}})}).then(function(res){
  if(!res.ok){
    document.getElementById("mine-note").textContent="Sign in with Discord to see your tracked reads.";
    document.getElementById("mine-sort").parentElement.hidden=true;
    return;
  }
  rows=res.data.rows||[];
  draw();
}).catch(function(){
  document.getElementById("mine-note").textContent="Sign in with Discord to see your tracked reads.";
});
</script>`;
  return chrome("Tracked", body, "Tracked", stamp, "", feedNav(opts));
}

export function renderAll(bundle, stamp, opts = {}) {
  const reads = bundle?.reads || [];
  const body = `<main class="wrap"><p class="muted">Updated ${esc(bundle?.asOf || "")}. The short list is <a href="/feed">one read at a time</a>.</p><h1>All reads</h1>
${reads.map((r) => `<div class="row"><a href="/feed/r/${esc(r.id)}"><b>${esc(r.headline)}</b></a><b>${money(r.price) || ""}</b></div>`).join("")}
</main>`;
  return chrome("Feed", body, "All reads", stamp, "", feedNav(opts));
}
