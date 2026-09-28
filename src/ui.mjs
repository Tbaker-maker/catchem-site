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

const CSS = `
:root{--bg:#12100e;--panel:#1a1815;--line:#2f2b26;--txt:#efe9de;--dim:#c4baab;--gold:#d9b779;--green:#7fc79a;--red:#e0675b;--serif:'Fraunces',Georgia,serif;--sans:'IBM Plex Sans',system-ui,sans-serif}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--txt);font:16px/1.5 var(--sans)}
body{overflow-x:hidden;padding-bottom:72px}
a{color:var(--gold)}
.site-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 16px;padding:12px 16px;border-bottom:1px solid var(--line);background:var(--bg);position:sticky;top:0;z-index:5}
.site-bar .logo{font:600 26px/1 var(--serif);color:var(--txt);text-decoration:none;letter-spacing:-.03em}
.site-bar .logo span{color:var(--gold)}
.site-bar nav{display:flex;flex-wrap:wrap;gap:8px 14px}
.site-bar nav a{color:var(--dim);text-decoration:none;font:500 14px/1 var(--sans);min-height:44px;display:inline-flex;align-items:center}
.site-bar nav a[aria-current="page"],.site-bar nav a:hover{color:var(--gold)}
.dock{position:fixed;left:0;right:0;bottom:0;display:flex;justify-content:space-around;gap:4px;padding:6px 8px calc(6px + env(safe-area-inset-bottom));background:#1a1815;border-top:1px solid var(--line);z-index:6}
.dock a{color:var(--dim);text-decoration:none;font:500 12px/1 var(--sans);min-height:44px;min-width:44px;display:flex;align-items:center;justify-content:center;padding:0 6px}
.dock a[aria-current="page"]{color:var(--gold)}
.wrap{max-width:1040px;margin:0 auto;padding:22px 16px 32px}
h1{font:500 34px/1.15 var(--serif);letter-spacing:-.02em;margin:0 0 8px}
h2{font:500 22px/1.2 var(--serif);margin:22px 0 8px}
.muted{color:var(--dim)}
.counts{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.counts b{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 12px;min-width:44px}
.counts b span{display:block;font:400 12px/1.3 var(--sans);color:var(--dim)}
.card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px}
.ph{width:100%;aspect-ratio:1;border-radius:12px;background:#211e1a;display:grid;place-items:center;color:var(--dim);font-size:13px}
.row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line);min-height:44px;align-items:center}
.row a{color:var(--txt);text-decoration:none}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
.filters{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.filters input,.filters select{background:var(--bg);color:var(--txt);border:1px solid var(--line);border-radius:10px;min-height:44px;padding:0 10px;font:15px var(--sans)}
button{min-height:44px;padding:0 14px;border-radius:10px;border:1px solid var(--line);background:var(--panel);color:var(--txt);font:600 14px var(--sans);cursor:pointer}
button.primary{background:var(--gold);color:#1a1407;border-color:transparent}
.site-foot{max-width:1040px;margin:0 auto;padding:8px 16px 24px;color:var(--dim);font-size:14px}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{scroll-behavior:auto!important;transition:none!important}}
`;

function chrome(active, body, title) {
  const item = (href, label) => `<a href="${href}"${active === label ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Catch'em</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>
<header class="site-bar"><a class="logo" href="/">Catch'em<span>.</span></a><nav>
${item("/feed", "The Feed")}${item("/sets", "Sets")}${item("/board", "Movers")}${item("/artists", "Artists")}${item("/post-office", "Post Office")}${item(DISCORD, "Discord Premium")}
</nav></header>
${body}
<nav class="dock" aria-label="Primary">
${item("/feed", "The Feed")}${item("/sets", "Sets")}${item("/board", "Movers")}${item("/artists", "Artists")}${item("/search", "Search")}
</nav>
<footer class="site-foot"><p>Made for collectors, rippers and flippers. Card names are © Pokémon / Nintendo / Creatures / GAME FREAK. Catch'em is a fan project and is not endorsed by them or by TCGplayer.</p><p><a href="mailto:support@catchemtcg.com">support@catchemtcg.com</a></p></footer>
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

export function renderSets(index) {
  const sets = index?.sets || [];
  const eras = [...new Set(sets.map((s) => s.era))];
  const body = `<main class="wrap"><p class="muted" id="fresh">Market prices from ${esc(index?.asOf || "")}. Source: TCGplayer market.</p>
<h1>Sets</h1><p class="muted">${sets.length} groups. Singles and sealed stay in their own counts.</p>
${eras.map((era) => `<h2>${esc(era)}</h2><div class="grid">${sets.filter((s) => s.era === era).map((s) => `<a class="card" href="/sets/${esc(s.slug)}"><b>${esc(s.name)}</b><p class="muted">${s.single} singles · ${s.sealed} sealed${s.priced ? ` · ${s.priced} priced` : ""}${s.release ? ` · ${esc(s.release)}` : ""}</p>${s.upShare == null ? "" : `<p class="muted">${s.upShare}% of priced rows were up since yesterday</p>`}</a>`).join("")}</div>`).join("")}
</main>`;
  return chrome("Sets", body, "Sets");
}

export function renderSetShell(slug) {
  const body = `<main class="wrap"><p class="muted" id="fresh">Loading the set.</p><h1 id="title">Set</h1>
<div class="filters"><select id="kind" aria-label="Kind"><option value="">Singles and sealed</option><option value="single">Singles</option><option value="sealed">Sealed</option></select>
<input id="q" aria-label="Filter by name, rarity, or artist" placeholder="Name, rarity, artist">
<select id="sort" aria-label="Sort"><option value="price">Price</option><option value="name">Name</option><option value="num">Number</option></select>
</div><div id="list"></div><button id="more" type="button">Show more</button></main>
<script type="application/json" id="meta">${JSON.stringify({ slug }).replace(/</g, "\\u003c")}</script>
<script>
const slug=JSON.parse(document.getElementById("meta").textContent).slug;
const money=n=>!(n>0)?"No market price":"$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
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
    return '<div class="row">'+img+'<a href="'+href+'"><b>'+r.name.replace(/[&<>]/g,"")+'</b><br><span class="muted">'+(r.num||"")+' '+(r.rarity||"")+(r.artist?" · "+r.artist:"")+'</span></a><b>'+money(r.price)+'</b></div>';
  }).join("") || '<p class="muted">Nothing matches.</p>';
  document.getElementById("more").hidden=shown>=list.length;
}
fetch("/data/sets/"+encodeURIComponent(slug)+".json").then(r=>{if(!r.ok) throw 0; return r.json()}).then(data=>{
  document.getElementById("title").textContent=data.name;
  document.getElementById("fresh").textContent="Updated "+data.asOf+" · "+data.source+" · "+data.single+" singles · "+data.sealed+" sealed";
  rows=(data.items||[]).filter(r=>r&&r.name);
  draw();
}).catch(()=>{document.getElementById("fresh").textContent="This set did not load."});
["kind","q","sort"].forEach(id=>document.getElementById(id).addEventListener("input",()=>{shown=48;draw()}));
document.getElementById("more").addEventListener("click",()=>{shown+=48;draw()});
</script>`;
  return chrome("Sets", body, "Set");
}

export function renderCard(card) {
  if (!card) return chrome("", `<main class="wrap"><h1>Not in the catalog</h1><p class="muted">That id is not in the TCGplayer catalog we publish.</p></main>`, "Not found");
  const price = money(card.price);
  const hrefKind = card.kind === "sealed" ? "Sealed" : "Single";
  const img = card.pid
    ? `<img alt="${esc(card.name)}" src="https://tcgplayer-cdn.tcgplayer.com/product/${Number(card.pid)}_in_400x400.jpg" style="width:min(320px,100%);border-radius:16px;background:#211e1a" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ph',textContent:'No image'}))">`
    : `<div class="ph">No image</div>`;
  const pct = Number.isFinite(Number(card.pct)) ? `${card.pct > 0 ? "up" : card.pct < 0 ? "down" : "unchanged"} ${Math.abs(card.pct)}% since yesterday` : "No day-to-day change to show.";
  const body = `<main class="wrap"><p class="muted" id="fresh">Updated ${esc(card.asOf || "")} · ${esc(card.source || "TCGplayer market")}</p>
<p class="muted"><a href="/sets/${esc(card.setSlug || "")}">${esc(card.set || "")}</a> · ${esc(hrefKind)}</p>
<h1>${esc(card.name)}</h1>${img}
<p style="font:600 36px/1 var(--serif);color:var(--gold)">${price || "No market price"}</p>
<p class="muted">${esc(pct)}</p>
<ul class="muted"><li>Number ${esc(card.num || "—")}</li><li>Rarity ${esc(card.rarity || "—")}</li><li>Artist ${esc(card.artist || "not matched")}</li><li>Kind ${esc(card.kind)}</li></ul>
<p class="muted">This is a TCGplayer market price, not an eBay ask and not a sold price. Sold prices are not on this page.</p>
${card.artist ? `<p><a href="/artists/${esc(String(card.artist).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))}">More by ${esc(card.artist)}</a></p>` : ""}
</main>`;
  return chrome("", body, card.name);
}

export function renderArtists(index) {
  const rows = index?.artists || [];
  const body = `<main class="wrap"><p class="muted">${esc(index?.note || "")}</p><h1>Artists</h1>
<div class="filters"><input id="q" aria-label="Find an artist" placeholder="Find an artist"></div>
<div id="list" class="grid">${rows.map((a) => `<a class="card" data-name="${esc(a.name.toLowerCase())}" href="/artists/${esc(a.slug)}"><b>${esc(a.name)}</b><p class="muted">${a.count} matched cards</p></a>`).join("")}</div>
<script>document.getElementById("q").addEventListener("input",ev=>{const q=ev.currentTarget.value.toLowerCase();document.querySelectorAll("#list a").forEach(a=>{a.hidden=!a.dataset.name.includes(q)})})</script>
</main>`;
  return chrome("Artists", body, "Artists");
}

export function renderArtist(doc) {
  if (!doc) return chrome("Artists", `<main class="wrap"><h1>Artist not found</h1></main>`, "Artist");
  const body = `<main class="wrap"><p class="muted">${esc(doc.source || "")}</p><h1>${esc(doc.name)}</h1>
${(doc.cards || []).map((c) => `<div class="row"><a href="/c/${esc(c.id)}"><b>${esc(c.name)}</b><br><span class="muted">${esc(c.set)} ${esc(c.num || "")}</span></a><b>${money(c.price) || "No market price"}</b></div>`).join("")}
</main>`;
  return chrome("Artists", body, doc.name);
}

export function renderMovers(doc) {
  const block = (title, rows) => `<h2>${title}</h2>${(rows || []).map((r) => `<div class="row">${r.image ? `<img alt="" width="48" height="48" src="${esc(r.image)}" style="width:48px;height:48px;object-fit:contain;border-radius:8px;background:#211e1a" onerror="this.remove()">` : ""}<a href="${esc(r.href)}"><b>${esc(r.name)}</b><br><span class="muted">${esc(r.set || "")}</span></a><b>${money(r.price) || "—"} <span class="muted">${Number.isFinite(r.changePct) ? (r.changePct > 0 ? "+" : "") + r.changePct + "%" : ""}</span></b></div>`).join("") || `<p class="muted">Nothing to show.</p>`}`;
  const body = `<main class="wrap"><p class="muted" id="fresh">Updated ${esc(doc?.asOf || "")}. ${esc(doc?.note || "")}</p>
<h1>Movers</h1>
<div class="filters"><button type="button" data-tab="singles">Singles</button><button type="button" data-tab="sealed">Sealed</button><button type="button" data-tab="slabs">Slabs</button></div>
<div id="singles">${block("Singles", doc?.singles)}</div>
<div id="sealed" hidden>${block("Sealed", doc?.sealed)}</div>
<div id="slabs" hidden><h2>Slabs</h2><p class="muted">Hidden until a graded feed exists. Slabs are not mixed into the singles or sealed lists.</p></div>
<script>document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{["singles","sealed","slabs"].forEach(id=>document.getElementById(id).hidden=id!==b.dataset.tab)}))</script>
</main>`;
  return chrome("Movers", body, "Movers");
}

export function renderReceipts(doc) {
  const rows = doc?.rows || [];
  const body = `<main class="wrap"><p class="muted" id="fresh">Updated ${esc(doc?.asOf || "")}</p><h1>Receipts</h1>
<p>${esc(doc?.note || "")}</p>
<p class="muted">Hit rate: ${doc?.hitRate == null ? "not scored yet" : esc(String(doc.hitRate))}</p>
${rows.map((r) => `<article class="card" style="margin:10px 0"><h2>${esc(r.headline)}</h2><p>${money(r.price) || "No price"} · ${esc(r.source || "")}</p><p class="muted">${esc(r.why || "")}</p></article>`).join("") || `<p class="muted">No scored calls yet.</p>`}
</main>`;
  return chrome("", body, "Receipts");
}

export function renderSearch() {
  const body = `<main class="wrap"><h1>Search</h1><p class="muted">Name, set, number, or artist across the catalog.</p>
<div class="filters"><input id="q" aria-label="Search the catalog" placeholder="Charizard, 199/165, or an artist" autofocus></div>
<p class="muted" id="meta">Loading the index.</p><div id="list"></div>
<script>
const money=n=>!(n>0)?"":"$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
let rows=[];
function draw(){
  const q=document.getElementById("q").value.trim().toLowerCase();
  if(q.length<2){document.getElementById("list").innerHTML="";document.getElementById("meta").textContent=rows.length+" names loaded. Type at least 2 letters.";return}
  const hits=rows.filter(r=>(r[1]+" "+r[2]+" "+r[3]+" "+r[4]).toLowerCase().includes(q)).slice(0,40);
  document.getElementById("meta").textContent=hits.length+" shown";
  document.getElementById("list").innerHTML=hits.map(r=>{
    const href=(r[5]==="sealed"?"/p/":"/c/")+encodeURIComponent(r[0]);
    const label=r[1].replace(/[&<>]/g,"");
    return '<div class="row"><a href="'+href+'"><b>'+label+'</b><br><span class="muted">'+r[5]+' · '+(r[3]||"")+' '+(r[4]||"")+'</span></a><b>'+(money(r[6])||"No market price")+'</b></div>';
  }).join("")||'<p class="muted">No match.</p>';
}
fetch("/data/search-lite.json").then(r=>r.json()).then(data=>{rows=data;document.getElementById("meta").textContent=rows.length+" names loaded.";draw()}).catch(()=>{document.getElementById("meta").textContent="Search did not load."});
document.getElementById("q").addEventListener("input",draw);
</script></main>`;
  return chrome("Search", body, "Search");
}

export function renderMethod(counts) {
  const single = Number(counts?.single);
  const sealed = Number(counts?.sealed);
  const catalog = Number.isFinite(single) && Number.isFinite(sealed)
    ? `The public catalog is ${single.toLocaleString("en-US")} singles and ${sealed.toLocaleString("en-US")} sealed products. Slabs are not in it.`
    : "Singles and sealed are counted apart. Slabs are not in the catalog.";
  const body = `<main class="wrap"><h1>How the numbers are made</h1>
<p>Catch'em publishes two different prices, and they are never added together.</p>
<ul>
<li><b>TCGplayer market</b> is the catalog price on singles and sealed products. ${catalog}</li>
<li><b>eBay ask</b> is the asking median on the smaller sealed list we track every day. It is labeled eBay ask. It is not a sold price.</li>
</ul>
<p>A one-day move is marked <b>Early</b>. A longer eBay history is marked <b>Tracked</b>. If a price is missing, the page says so. We do not print a blank, a zero, or a made-up sold price.</p>
<p>Singles, sealed, and slabs each stay on their own list. There is no mixed index.</p>
<h2>How a page is built</h2>
<p>Box math divides an eBay ask by the pack count for that product. It is not advice. Artist pages only include illustrator credits we could match, and the page says the coverage is partial. Charts label the axis. A two-point line is two days, not a month.</p>
<p><a href="/receipts">Receipts</a> keep revisits visible. A hit rate waits until a direction was written down first.</p>
<p><a href="/corrections">Corrections</a></p>
</main>`;
  return chrome("", body, "Methodology");
}

export function renderPost() {
  const body = `<main class="wrap"><h1>Post Office</h1>
<p>The full catalogue: every card and every artist. Pick one and the post is ready for X or Facebook.</p>
<p class="muted">Opening soon. The catalog is already on <a href="/sets">Sets</a> and <a href="/artists">Artists</a>. The Feed is open.</p>
</main>`;
  return chrome("Post Office", body, "Post Office");
}

export function renderFeed(bundle, startId) {
  const reads = (bundle?.reads || []).filter((r) => r && r.headline && money(r.price) && !/\b(buy|sell|hold|floor|target|play|pick|bullish|bearish|crypto|nft|web3|ticker)\b/i.test(r.headline));
  const safe = JSON.stringify(reads).replace(/</g, "\\u003c");
  const css = `
  html,body{overflow:hidden;height:100%}
  .site-foot{display:none}body{padding-bottom:0}
  .site-bar{position:fixed;top:0;left:0;right:0}
  #snap{position:fixed;top:58px;right:0;bottom:62px;left:0;overflow-y:auto;scroll-snap-type:y mandatory;overscroll-behavior:contain}
  .slide{height:100%;scroll-snap-align:start;scroll-snap-stop:always;display:grid;place-items:center;padding:12px 16px}
  .read{width:min(420px,100%);max-height:100%;overflow:auto;background:var(--panel);border:1px solid var(--line);border-radius:20px;padding:16px;display:flex;flex-direction:column;gap:8px}
  .read img{width:100%;max-height:220px;object-fit:contain;background:#211e1a;border-radius:14px}
  .kicker{letter-spacing:.12em;text-transform:uppercase;font-size:12px;color:var(--gold)}
  .price{font:600 40px/1 var(--serif);color:var(--gold);margin:0}
  .more{display:none}.more.open{display:block}
  @media (prefers-reduced-motion:reduce){#snap{scroll-snap-type:none}}
  `;
  const body = `<style>${css}</style><div id="snap" tabindex="0"></div>
<script type="application/json" id="reads">${safe}</script>
<script type="application/json" id="start">${JSON.stringify(startId || "")}</script>
<script>
const reads=JSON.parse(document.getElementById("reads").textContent);
const start=JSON.parse(document.getElementById("start").textContent);
const money=n=>!(Number(n)>0)?"":"$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const snap=document.getElementById("snap");
function chart(hist){
  const pts=(hist||[]).map(Number).filter(n=>n>0);
  if(pts.length<2) return "";
  const w=280,h=64,min=Math.min(...pts),max=Math.max(...pts),span=max-min||1;
  const step=(w-12)/(pts.length-1);
  const d=pts.map((v,i)=>(i?"L":"M")+(6+i*step).toFixed(1)+","+(h-8-((v-min)/span)*(h-16)).toFixed(1)).join(" ");
  return '<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+pts.length+' points"><path d="'+d+'" fill="none" stroke="#d9b779" stroke-width="2"/></svg><p class="muted" style="font-size:12px">'+pts.length+' points. Axis runs from the low to the high, not from zero. '+(pts.length>=7?"Tracked":"Early")+'.</p>';
}
function slide(r,i){
  const el=document.createElement("section");
  el.className="slide"; el.id="r-"+r.id; el.dataset.i=i;
  const pct=Number.isFinite(r.changePct)?(r.changePct>0?"+":"")+r.changePct+"%":"no day-to-day change";
  const img=r.image?'<img alt="" src="'+r.image.replace(/"/g,"")+'" onerror="this.remove()">':'<div class="ph">No image</div>';
  el.innerHTML='<article class="read"><p class="kicker">'+(i+1)+' of '+reads.length+' · '+r.type+' · '+r.confidence+'</p>'+img+'<h2 style="font:500 26px/1.2 var(--serif);margin:0">'+r.headline.replace(/[&<>]/g,"")+'</h2><p class="price">'+money(r.price)+'</p><p class="muted">'+pct+' · '+r.source+' · '+r.asOf+'</p>'+chart(r.history)+'<p class="muted">'+r.why.replace(/[&<>]/g,"")+'</p><div><button type="button" data-act="more">Details</button> <button type="button" data-act="share">Share</button></div><div class="more"><p class="muted">'+(r.set||"")+' '+(r.number||"")+' '+(r.rarity||"")+'</p><p>Sold prices are not in this read.</p><p><a href="'+r.href+'">Open the page</a></p><p>Will this move keep going? Saved on this device only. Not a crowd count.</p><button type="button" data-vote="yes">I think it keeps going</button> <button type="button" data-vote="no">I think it fades</button><p class="vote muted"></p><button type="button" data-react="up">This is exciting</button> <button type="button" data-react="down">This is disappointing</button></div></article>';
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
  const vote=el.querySelector(".vote");
  const saved=localStorage.getItem("catchem-vote-"+r.id);
  if(saved) vote.textContent="Saved on this device: "+saved;
  el.querySelectorAll("[data-vote]").forEach(b=>b.onclick=()=>{localStorage.setItem("catchem-vote-"+r.id,b.dataset.vote);vote.textContent="Saved on this device: "+b.dataset.vote});
  el.querySelectorAll("[data-react]").forEach(b=>b.onclick=()=>{localStorage.setItem("catchem-react-"+r.id,b.dataset.react);vote.textContent="Reaction saved on this device."});
  return el;
}
reads.forEach((r,i)=>snap.appendChild(slide(r,i)));
const end=document.createElement("section");
end.className="slide";
end.innerHTML='<article class="read"><p class="kicker">You\\'re caught up</p><h2 style="font:500 28px/1.2 var(--serif);margin:0">That is today\\'s list.</h2><p>Card prices, game prices, charts, a Pokémon fact and the news. Written short, so you can read it in a minute.</p><p><a href="/feed/all">All reads</a> · <a href="/receipts">Receipts</a></p><p><b>Discord Premium is $14.99/mo.</b> It is a Discord seat. Stadium giveaways seat Premium members automatically. The first 222 seats are numbered and never reissued. The tools on this site stay free.</p><p><a class="primary" style="display:inline-flex;align-items:center;min-height:44px" href="${DISCORD}">Join Discord</a></p></article>';
snap.appendChild(end);
const all=document.createElement("section");
all.className="slide"; all.id="all-reads";
all.innerHTML='<article class="read"><h2>All reads</h2>'+reads.map(r=>'<p><a href="/feed/r/'+encodeURIComponent(r.id)+'">'+r.headline.replace(/[&<>]/g,"")+'</a></p>').join("")+'</article>';
if(location.pathname.endsWith("/all")) snap.appendChild(all);
let startAt=reads.findIndex(r=>r.id===start);
if(startAt<0) startAt=0;
function go(i){
  const node=snap.children[Math.max(0,Math.min(snap.children.length-1,i))];
  if(node) snap.scrollTo({top:node.offsetTop,behavior:"auto"});
}
if(startAt>0) go(startAt);
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
  return chrome("The Feed", body, "The Feed");
}

export function renderAll(bundle) {
  const reads = bundle?.reads || [];
  const body = `<main class="wrap"><p class="muted">Updated ${esc(bundle?.asOf || "")}. The short list is <a href="/feed">one read at a time</a>.</p><h1>All reads</h1>
${reads.map((r) => `<div class="row"><a href="/feed/r/${esc(r.id)}"><b>${esc(r.headline)}</b></a><b>${money(r.price) || ""}</b></div>`).join("")}
</main>`;
  return chrome("The Feed", body, "All reads");
}
