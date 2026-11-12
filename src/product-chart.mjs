// Product page chart: one figure, switchable views. Every number on it comes from a
// published series for this product:
//   price    TCGplayer market (own nightly pull, tcgcsv archive, earlier fan-site days)
//   listings eBay listings counted on a night (active listings, never sales)
// A view shows only when its series has at least two real points. Price days with no
// file carry the last real price (the sitewide chart rule); the tooltip snaps to real
// days only. Listings are bars on real nights only, so a night with no count is empty.
// There is no sales or demand view: no sold data is published.
import { fillDaily, historySources } from "./history-chart.mjs";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const DAY = 86400000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const longDay = (d) => { const p = String(d).split("-"); return `${MONTHS[+p[1] - 1]} ${+p[2]}, ${p[0]}`; };

// Real listings nights: [[date, count]], counts may be 0, sorted, one per date.
export function listingPoints(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const d = Array.isArray(row) ? row[0] : row && row.date;
    const n = Number(Array.isArray(row) ? row[1] : row && row.listingCount);
    if (!ISO.test(String(d || "").slice(0, 10)) || !Number.isFinite(n) || n < 0) continue;
    map.set(String(d).slice(0, 10), Math.round(n));
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

// Views this product can honestly show, in tab order.
export function chartViews(priceReal, listReal) {
  const views = [];
  if (priceReal >= 2) views.push(["price", "Price"]);
  if (listReal >= 2) views.push(["listings", "Listings"]);
  if (priceReal >= 2 && listReal >= 2) views.push(["both", "Price + listings"]);
  if (priceReal >= 2) views.push(["change", "% change"]);
  return views;
}

// Sealed pages open on Price + listings when that view exists; otherwise the first tab.
export function defaultView(views) {
  for (const row of views || []) if (row && row[0] === "both") return "both";
  return views && views[0] ? views[0][0] : "";
}

// Y range for the price, combined, and % change views. Price views span at least
// MIN_SPAN of the middle price (about +-5%), so a 1% move does not fill the plot.
export const MIN_SPAN = 0.1;
export function yDomain(vals, view) {
  var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
  if (view === "change") { mn = Math.min(mn, 0); mx = Math.max(mx, 0); }
  else { var mid = (mn + mx) / 2, need = Math.abs(mid) * 0.1; if (mx - mn < need) { mn = mid - need / 2; mx = mid + need / 2; } }
  var pad = (mx - mn) * 0.14 || Math.abs(mx) * 0.05 || 1;
  return [mn - pad, mx + pad];
}

export function productChart({ price = [], listings = [], asOf = "", ownLabel, path = "" } = {}) {
  const priceReal = (price || []).filter((p) => Array.isArray(p) && ISO.test(String(p[0])) && Number(p[1]) > 0 && !p[3]);
  const list = listingPoints(listings);
  const views = chartViews(priceReal.length, list.length);
  if (!views.length) return "";
  const start = defaultView(views);
  const filled = priceReal.length >= 2 ? fillDaily(priceReal) : [];
  const dates = [...filled.map((p) => p[0]), ...list.map((p) => p[0])].sort();
  const spanDays = dates.length ? (Date.parse(dates.at(-1)) - Date.parse(dates[0])) / DAY : 0;
  const ranges = [["1M", 31], ["3M", 92], ["6M", 183], ["1Y", 366], ["All", 0]].filter(([, d]) => d === 0 || spanDays > d * 0.5);
  const pills = ranges.map(([l, d], i) => `<button type="button" class="hc-pill" data-days="${d}" aria-pressed="${i === ranges.length - 1 ? "true" : "false"}">${l}</button>`).join("");
  const tabs = views.length > 1
    ? `<div class="pc-tabs" role="group" aria-label="Chart data">${views.map(([k, l]) => `<button type="button" class="pc-tab" data-view="${k}" aria-pressed="${k === start ? "true" : "false"}">${esc(l)}</button>`).join("")}</div>`
    : "";
  const rawPath = String(path || "");
  const markPath = /^\/[pc]\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawPath) && !/\/tcgcsv-\d+$/.test(rawPath) ? rawPath : "";
  const srcs = (priceReal.length >= 2 ? historySources(priceReal, ownLabel) : []).map((line) => line.replace(/\d{4}-\d{2}-\d{2}/g, longDay));
  if (list.length >= 2) srcs.push(`eBay listings counted, active listings each night, ${longDay(list[0][0])} to ${longDay(list.at(-1)[0])}`);
  const lastDay = String(asOf || "").slice(0, 10) || (dates.at(-1) || "");
  const markSrc = priceReal.length >= 2 ? "TCGplayer market" : "eBay listings counted";
  const sum = priceReal.length >= 2
    ? `Price from ${esc(priceReal[0][0])} to ${esc(priceReal.at(-1)[0])}.${list.length >= 2 ? ` eBay listings counted from ${esc(list[0][0])} (${list[0][1]}) to ${esc(list.at(-1)[0])} (${list.at(-1)[1]}).` : ""}`
    : `eBay listings counted from ${esc(list[0][0])} (${list[0][1]}) to ${esc(list.at(-1)[0])} (${list.at(-1)[1]}).`;
  return `<style>${PRODUCT_CHART_CSS}</style><figure class="hc pc" id="chart" data-view="${start}" data-p="${esc(JSON.stringify(filled))}" data-l="${esc(JSON.stringify(list))}">
<p class="hc-sum">${sum}</p>
${tabs}
<div class="hc-top"><div class="hc-read"><span class="hc-price"></span><span class="hc-date muted"></span></div><div class="hc-pills" role="group" aria-label="Chart range">${pills}</div></div>
<div class="pc-units muted" aria-hidden="true"><span class="pc-ul"></span><span class="pc-ur"></span></div>
<div class="hc-plot"><svg class="hc-svg" viewBox="0 0 600 220" preserveAspectRatio="none" role="img" aria-label="${views.map((v) => esc(v[1])).join(", ")} chart"></svg><div class="hc-gls" aria-hidden="true"></div><div class="pc-tags" aria-hidden="true"></div><div class="hc-tip" hidden></div></div>
<div class="hc-axis muted"></div>
<p class="pc-mark" aria-hidden="true" data-day="${esc(lastDay ? longDay(lastDay) : "")}" data-src-price="TCGplayer market"${list.length >= 2 ? ` data-src-listings="eBay listings counted" data-src-both="TCGplayer market, eBay listings counted"` : ""}><b>Catch'em<span>.</span></b>${markPath ? ` <span class="pc-mark-path">${esc(markPath)}</span>` : ""} <span class="pc-mark-t">${esc(markSrc)}${lastDay ? `, ${esc(longDay(lastDay))}` : ""}</span></p>
${list.length >= 2 ? `<p class="pc-key muted"><span class="pc-k"><span class="pc-sw pc-sw-p"></span>Price</span><span class="pc-k"><span class="pc-sw pc-sw-l"></span>eBay listings counted (active listings each night)</span></p>` : ""}
<p class="pc-src muted">${srcs.map(esc).join(". ")}${srcs.length ? "." : ""}</p>
<p class="pc-foot"><button type="button" class="pc-cam-btn" aria-pressed="false">Camera mode</button></p>
<button type="button" class="pc-cam-x" aria-label="Exit camera mode">&times;</button>
</figure><script>(function(){var run=function(){${PRODUCT_CHART_JS}};var el=document.getElementById("chart");if(!el||!("IntersectionObserver" in window)){run();return;}var io=new IntersectionObserver(function(es){if(es.some(function(e){return e.isIntersecting;})){io.disconnect();run();}},{rootMargin:"240px"});io.observe(el);})();</script>`;
}

export const PRODUCT_CHART_CSS = `.pc .pc-tabs{display:flex;gap:4px;padding:3px;margin:0 0 10px;border-radius:14px;background:rgba(255,255,255,.06)}
.pc-tab{flex:1 1 auto;appearance:none;border:0;background:transparent;color:inherit;font:600 13px/1.15 var(--sans);min-height:44px;padding:6px 10px;border-radius:11px;cursor:pointer;opacity:.7;white-space:nowrap}
.pc-tab[aria-pressed="true"]{background:rgba(255,255,255,.14);opacity:1}.pc-tab:focus-visible,.pc-cam-btn:focus-visible{outline:2px solid #d9b779;outline-offset:2px}
.pc-units{display:flex;justify-content:space-between;font-size:11px;margin:0 0 2px;min-height:14px}
.pc-tags{position:absolute;inset:0;pointer-events:none}.pc-tag{position:absolute;font-size:11px;line-height:1;padding:2px 6px;border-radius:999px;background:rgba(20,18,16,.85);border:1px solid rgba(255,255,255,.14);white-space:nowrap;transform:translate(-50%,-140%)}.pc-tag.lo{transform:translate(-50%,40%)}
.pc .hc-gl.r{left:auto;right:2px}.pc .hc-gl.l{right:auto;left:2px}
.pc-key{display:flex;flex-wrap:wrap;align-items:center;gap:4px 14px;font-size:12px;margin:6px 0 0}.pc-k{display:inline-flex;align-items:center;gap:6px}.pc-sw{display:inline-block;width:12px;height:12px;border-radius:3px;flex:none}.pc-sw-p{background:#d9b779}.pc-sw-l{background:#7fc79a}
.pc .hc-gl{opacity:.75;padding:1px 4px;border-radius:6px;background:rgba(20,18,16,.72)}
.pc-src{font-size:12px;margin:6px 0 0}
.pc-foot{margin:8px 0 0;display:flex;justify-content:flex-end}
.pc-cam-btn{appearance:none;border:1px solid rgba(255,255,255,.18);background:transparent;color:inherit;font:600 13px/1 var(--sans);min-height:44px;padding:0 14px;border-radius:999px;cursor:pointer}
.pc-cam-btn[aria-pressed="true"]{background:#d9b779;color:#141210;border-color:#d9b779}
.pc{position:relative}
.pc-mark{display:none;margin:6px 0 0;text-align:right;font:500 12px/1.2 var(--sans);opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pc-mark b{font:600 14px/1 var(--serif)}.pc-mark b span{color:#d9b779}
.pc-cam-x{display:none;position:absolute;top:4px;right:4px;width:28px;height:28px;padding:0;border:0;border-radius:50%;background:rgba(255,255,255,.08);color:inherit;font:400 18px/28px var(--sans);opacity:.45;cursor:pointer;z-index:3}.pc-cam-x:hover,.pc-cam-x:focus-visible{opacity:1;outline:2px solid #d9b779}
.pc-up{color:#7fc79a}.pc-down{color:#e88b7f}
html.pc-cam .site-bar,html.pc-cam .stale-banner,html.pc-cam #fresh,html.pc-cam .dock,html.pc-cam .site-foot,html.pc-cam .shop-block,html.pc-cam .shop-btns,html.pc-cam .shop-note,html.pc-cam .skip-link,html.pc-cam .item-jump,html.pc-cam #qsheet,html.pc-cam #qback,html.pc-cam .rv-actions,html.pc-cam .add-read,html.pc-cam .glance-photo,html.pc-cam .cp-photo{display:none!important}
html.pc-cam .pc-mark{display:block;font:500 16px/1.35 var(--sans);opacity:.92;white-space:normal}html.pc-cam .pc-mark b{font:600 22px/1.1 var(--serif)}html.pc-cam .pc-mark-path{margin:0 6px 0 2px}html.pc-cam .pc-src,html.pc-cam .pc-key,html.pc-cam .pc-foot{display:none!important}html.pc-cam .pc-cam-x{display:block;width:44px;height:44px;font:400 22px/44px var(--sans);top:8px;right:8px}html.pc-cam .pc{box-shadow:none;padding-top:38px}html.pc-cam .pc .hc-plot{height:260px}
html.pc-cam #price{scroll-margin-top:8px}html.pc-cam .chg dd{font-size:18px}html.pc-cam .yr-line{font-size:15px;letter-spacing:0;white-space:normal}
@media(max-width:420px){.pc .pc-tabs{display:grid;grid-template-columns:1fr 1fr}.pc-tab{padding:6px 4px}}`;

// Client script. Kept free of dashed strokes: the price line stays solid.
export const PRODUCT_CHART_JS = `(function(){
var yDomain=${yDomain.toString()};
var M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function ms(d){return Date.parse(d+"T00:00:00Z");}
function short(d){var p=d.split("-");return M[+p[1]-1]+" "+(+p[2])+(+p[0]===new Date().getUTCFullYear()?"":", "+p[0]);}
function nice(d){var p=d.split("-");return M[+p[1]-1]+" "+(+p[2])+", "+p[0];}
function money(v){return "$"+Number(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});}
function grid$(v,span){return v>=100&&span>=20?"$"+Math.round(v).toLocaleString("en-US"):money(v);}
function cnt(v){return Math.round(Number(v)).toLocaleString("en-US");}
function pct(v){var r=Math.round(v*10)/10;return (r>0?"+":"")+r.toFixed(1)+"%";}
function smooth(xy){var d="M"+xy[0][0].toFixed(1)+","+xy[0][1].toFixed(1);for(var i=0;i<xy.length-1;i++){var p0=xy[i-1]||xy[i],p1=xy[i],p2=xy[i+1],p3=xy[i+2]||p2;var c1x=p1[0]+(p2[0]-p0[0])/6,c1y=p1[1]+(p2[1]-p0[1])/6,c2x=p2[0]-(p3[0]-p1[0])/6,c2y=p2[1]-(p3[1]-p1[1])/6;var lo=Math.min(p1[1],p2[1]),hi=Math.max(p1[1],p2[1]);c1y=Math.max(lo,Math.min(hi,c1y));c2y=Math.max(lo,Math.min(hi,c2y));d+=" C"+c1x.toFixed(1)+","+c1y.toFixed(1)+" "+c2x.toFixed(1)+","+c2y.toFixed(1)+" "+p2[0].toFixed(1)+","+p2[1].toFixed(1);}return d;}
function cam(on){document.documentElement.classList.toggle("pc-cam",on);document.querySelectorAll(".pc-cam-btn").forEach(function(b){b.setAttribute("aria-pressed",on?"true":"false");b.textContent=on?"Exit camera mode":"Camera mode";});if(on){var f=document.getElementById("price")||document.querySelector("figure.pc");if(f&&f.scrollIntoView)f.scrollIntoView({block:"start"});}}
function mount(fig){if(fig.dataset.ready)return;fig.dataset.ready="1";
var P=JSON.parse(fig.getAttribute("data-p")||"[]"),L=JSON.parse(fig.getAttribute("data-l")||"[]");
var svg=fig.querySelector(".hc-svg"),plot=fig.querySelector(".hc-plot"),tip=fig.querySelector(".hc-tip"),gls=fig.querySelector(".hc-gls"),tags=fig.querySelector(".pc-tags"),ax=fig.querySelector(".hc-axis"),ul=fig.querySelector(".pc-ul"),ur=fig.querySelector(".pc-ur"),priceEl=fig.querySelector(".hc-price"),dateEl=fig.querySelector(".hc-date");
var W=600,H=220,PT=16,PB=6,GOLD="#d9b779",GREEN="#7fc79a",gid="pg"+Math.random().toString(36).slice(2,8);
var view=fig.getAttribute("data-view")||"price",days=0,st={};
var Preal=function(arr){return arr.filter(function(p){return !p[3];});};
function draw(){
  var useP=view!=="listings",useL=view==="listings"||view==="both";
  var ends=[];if(useP&&P.length)ends.push(ms(P[P.length-1][0]));if(useL&&L.length)ends.push(ms(L[L.length-1][0]));
  var end=Math.max.apply(null,ends),from=days?end-days*864e5:-Infinity;
  // The overlay covers the nights that have both series.
  if(view==="both"&&L.length)from=Math.max(from,ms(L[0][0]));
  var p=useP?P.filter(function(x){return ms(x[0])>=from;}):[],l=useL?L.filter(function(x){return ms(x[0])>=from;}):[];
  if(useP&&Preal(p).length<2)p=P.slice(-2);if(useL&&l.length<2)l=L.slice(-2);
  var starts=[];if(p.length)starts.push(ms(p[0][0]));if(l.length)starts.push(ms(l[0][0]));
  var t0=Math.min.apply(null,starts),t1=end;if(t1<=t0)t1=t0+864e5;
  var nDays=Math.max(1,Math.round((t1-t0)/864e5)),bw=Math.max(1.2,Math.min(14,W/(nDays+1)*0.7)),inset=useL?bw/2+1:0;
  function X(d){return inset+((ms(d)-t0)/(t1-t0))*(W-2*inset);}
  var body="",gl="",tg="";
  var base=null,pr=Preal(p);if(view==="change"&&pr.length)base=pr[0][1];
  function val(x){return view==="change"?(x[1]/base-1)*100:x[1];}
  var Yp=null,Yl=null;
  if(useP&&p.length){
    var dom=yDomain(p.map(val),view),mn=dom[0],mx=dom[1];
    var top=PT,bot=view==="both"?H*.62:H-PB;
    Yp=function(v){return top+(1-(v-mn)/(mx-mn))*(bot-top);};
    for(var k=1;k<=3;k++){var gy=top+(bot-top)*k/4,gv=mn+(1-(gy-top)/(bot-top))*(mx-mn);body+='<line x1="0" x2="'+W+'" y1="'+gy.toFixed(1)+'" y2="'+gy.toFixed(1)+'" stroke="rgba(255,255,255,.06)" stroke-width="1" vector-effect="non-scaling-stroke"/>';gl+='<span class="hc-gl l" style="top:'+(gy/H*100).toFixed(2)+'%">'+(view==="change"?pct(gv):grid$(gv,mx-mn))+'</span>';}
    if(view==="change"){var zy=Yp(0).toFixed(1);body+='<line x1="0" x2="'+W+'" y1="'+zy+'" y2="'+zy+'" stroke="rgba(255,255,255,.28)" stroke-width="1" vector-effect="non-scaling-stroke"/>';}
  }
  if(useL&&l.length){
    var lmx=Math.max.apply(null,l.map(function(x){return x[1];}))*1.12||1,ltop=view==="both"?H*.66:PT,lbot=H-PB;
    Yl=function(v){return ltop+(1-v/lmx)*(lbot-ltop);};
    if(view==="listings"){for(var j=1;j<=3;j++){var ly=ltop+(lbot-ltop)*j/4;body+='<line x1="0" x2="'+W+'" y1="'+ly.toFixed(1)+'" y2="'+ly.toFixed(1)+'" stroke="rgba(255,255,255,.06)" stroke-width="1" vector-effect="non-scaling-stroke"/>';gl+='<span class="hc-gl l" style="top:'+(ly/H*100).toFixed(2)+'%">'+cnt(lmx*(1-(ly-ltop)/(lbot-ltop)))+'</span>';}}
    else{gl+='<span class="hc-gl r" style="top:'+(ltop/H*100+6).toFixed(2)+'%">'+cnt(lmx)+'</span>';}
    l.forEach(function(x){var y=Yl(x[1]);body+='<rect class="pc-bar" x="'+(X(x[0])-bw/2).toFixed(2)+'" y="'+y.toFixed(1)+'" width="'+bw.toFixed(2)+'" height="'+Math.max(0,lbot-y).toFixed(1)+'" rx="1" fill="'+GREEN+'" fill-opacity="'+(view==="both"?".55":".8")+'"/>';});
  }
  if(useP&&p.length){
    var segs=[],run=null;
    p.forEach(function(x){var fade=x[2]==="f"||x[2]==="g",xy=[X(x[0]),Yp(val(x))];if(!run||run.fade!==fade){if(run)run.pts.push(xy);run={fade:fade,pts:[xy]};segs.push(run);}else run.pts.push(xy);});
    var floor=view==="both"?H*.62:H-PB;
    segs.forEach(function(s){var q=s.pts;if(q.length<2){body+='<circle cx="'+q[0][0].toFixed(1)+'" cy="'+q[0][1].toFixed(1)+'" r="2.5" fill="'+GOLD+'"/>';return;}var d=smooth(q);
      if(view!=="change")body+='<path d="'+d+" L"+q[q.length-1][0].toFixed(1)+","+floor+" L"+q[0][0].toFixed(1)+","+floor+' Z" fill="url(#'+gid+')"'+(s.fade?' fill-opacity=".4"':"")+'/>';
      body+='<path d="'+d+'" fill="none" stroke="'+GOLD+'" stroke-opacity="'+(s.fade?".35":"1")+'" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>';});
    if(view==="price"&&pr.length>=2){
      var hi=pr[0],lo=pr[0];pr.forEach(function(x){if(x[1]>=hi[1])hi=x;if(x[1]<=lo[1])lo=x;});
      [[hi,"High"],[lo,"Low"]].forEach(function(h,i){if(i&&h[0]===hi)return;var y=Yp(h[0][1]);body+='<line x1="0" x2="'+W+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="#efe9de" stroke-opacity=".22" stroke-width="1" vector-effect="non-scaling-stroke"/><circle cx="'+X(h[0][0]).toFixed(1)+'" cy="'+y.toFixed(1)+'" r="3.5" fill="'+(i?"#efe9de":"none")+'" stroke="#efe9de" stroke-width="1.5" vector-effect="non-scaling-stroke"/>';
        var xp=Math.max(12,Math.min(88,X(h[0][0])/W*100));tg+='<span class="pc-tag'+(i?" lo":"")+'" style="left:'+xp.toFixed(1)+'%;top:'+(y/H*100).toFixed(2)+'%">'+h[1]+" "+money(h[0][1])+" · "+short(h[0][0])+'</span>';});
    }
  }
  svg.innerHTML='<defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+GOLD+'" stop-opacity=".28"/><stop offset="1" stop-color="'+GOLD+'" stop-opacity="0"/></linearGradient></defs>'+body+'<line class="hc-x" x1="0" x2="0" y1="'+PT+'" y2="'+(H-PB)+'" stroke="rgba(255,255,255,.35)" stroke-width="1" vector-effect="non-scaling-stroke" visibility="hidden"/><circle class="hc-dot" r="4" fill="'+(view==="listings"?GREEN:GOLD)+'" stroke="#141210" stroke-width="2" visibility="hidden"/>';
  gls.innerHTML=gl;tags.innerHTML=tg;
  var mid=new Date((t0+t1)/2).toISOString().slice(0,10),a=new Date(t0).toISOString().slice(0,10),b=new Date(t1).toISOString().slice(0,10);
  ax.innerHTML="<span>"+short(a)+"</span><span>"+short(mid)+"</span><span>"+short(b)+"</span>";
  ul.textContent=view==="listings"?"Listings counted":view==="change"?"% change from "+(pr.length?short(pr[0][0]):""):"Price (USD)";
  ur.textContent=view==="both"?"Listings counted":"";
  // Readout: newest real point and its move from the first real point in range.
  var lr=view==="listings"?l:pr;if(lr.length){var last=lr[lr.length-1],first=lr[0];
    if(view==="listings"){var dn=last[1]-first[1];priceEl.textContent=cnt(last[1])+" listings counted";dateEl.innerHTML=short(last[0])+(lr.length>1?' · <span class="'+(dn>0?"pc-up":dn<0?"pc-down":"")+'">'+(dn>0?"+":"")+cnt(dn)+(first[1]>0?" ("+pct(dn/first[1]*100)+")":"")+"</span> since "+short(first[0]):"");}
    else{var ch=(last[1]/first[1]-1)*100;priceEl.textContent=view==="change"?pct(ch):money(last[1]);dateEl.innerHTML=short(last[0])+' · <span class="'+(ch>0?"pc-up":ch<0?"pc-down":"")+'">'+(view==="change"?money(last[1]):pct(ch))+"</span> "+(view==="change"?"on "+short(last[0]):"since "+short(first[0]));}}
  var mk=fig.querySelector(".pc-mark-t"),mw=fig.querySelector(".pc-mark");if(mk){var md=mw.getAttribute("data-day"),ms_=mw.getAttribute("data-src-"+(view==="change"?"price":view))||mw.getAttribute("data-src-price")||"";mk.textContent=ms_+(md?", "+md:"");}
  st={p:p,l:l,X:X,Yp:Yp,Yl:Yl,val:val};
}
function near(cx){var r=plot.getBoundingClientRect(),x=(cx-r.left)/r.width*W,pool=[];
  if(view!=="listings")Preal(st.p).forEach(function(q){pool.push(q[0]);});if(view==="listings"||view==="both")st.l.forEach(function(q){pool.push(q[0]);});
  var best=null,bd=1e9;pool.forEach(function(d){var k=Math.abs(st.X(d)-x);if(k<bd){bd=k;best=d;}});return best;}
function at(arr,d){for(var i=0;i<arr.length;i++)if(arr[i][0]===d)return arr[i];return null;}
function show(cx){var d=near(cx);if(!d)return;var x=st.X(d),y,html="";
  var pp=at(st.p,d),lp=at(st.l,d);
  if(view==="listings"){y=st.Yl(lp[1]);html="<b>"+cnt(lp[1])+" listings counted</b><span>"+nice(d)+"</span>";}
  else if(view==="change"){y=st.Yp(st.val(pp));html="<b>"+pct(st.val(pp))+"</b><span>"+money(pp[1])+" · "+nice(d)+"</span>";}
  else{if(pp){y=st.Yp(pp[1]);html="<b>"+money(pp[1])+"</b>"+(pp[3]?"<span>last price on file "+short(pp[3])+"</span>":"");}else{y=st.Yl(lp[1]);html="<b>No price file that day</b>";}
    if(view==="both")html+="<span>"+(lp?cnt(lp[1])+" listings counted":"No listings count that night")+"</span>";html+="<span>"+nice(d)+"</span>";}
  var ln=svg.querySelector(".hc-x"),dot=svg.querySelector(".hc-dot"),r=plot.getBoundingClientRect();
  ln.setAttribute("x1",x);ln.setAttribute("x2",x);ln.setAttribute("visibility","visible");dot.setAttribute("cx",x);dot.setAttribute("cy",y);dot.setAttribute("visibility","visible");
  tip.hidden=false;tip.innerHTML=html;var px=x/W*r.width,py=y/H*r.height,hw=tip.offsetWidth/2+4;tip.style.left=Math.max(hw,Math.min(r.width-hw,px))+"px";var th=tip.offsetHeight+12;tip.style.top=(py-th<0?py+12:py-th)+"px";}
function hide(){tip.hidden=true;var ln=svg.querySelector(".hc-x"),dot=svg.querySelector(".hc-dot");if(ln)ln.setAttribute("visibility","hidden");if(dot)dot.setAttribute("visibility","hidden");}
plot.addEventListener("pointermove",function(e){show(e.clientX);});plot.addEventListener("pointerdown",function(e){show(e.clientX);});plot.addEventListener("pointerleave",hide);
fig.querySelectorAll(".hc-pill").forEach(function(b){b.addEventListener("click",function(){fig.querySelectorAll(".hc-pill").forEach(function(o){o.setAttribute("aria-pressed",o===b?"true":"false");});days=+b.getAttribute("data-days");hide();draw();});});
fig.querySelectorAll(".pc-tab").forEach(function(b){b.addEventListener("click",function(){fig.querySelectorAll(".pc-tab").forEach(function(o){o.setAttribute("aria-pressed",o===b?"true":"false");});view=b.getAttribute("data-view");fig.setAttribute("data-view",view);hide();draw();});});
fig.querySelectorAll(".pc-cam-x").forEach(function(b){b.addEventListener("click",function(){cam(false);});});
fig.querySelectorAll(".pc-cam-btn").forEach(function(b){b.addEventListener("click",function(){cam(!document.documentElement.classList.contains("pc-cam"));});});
var q=typeof location!=="undefined"?location.search:"";var vm=/[?&]view=(price|listings|both|change)\\b/.exec(q);if(vm){var t=fig.querySelector('.pc-tab[data-view="'+vm[1]+'"]');if(t)t.click();}
draw();if(/[?&]camera=1\\b/.test(q))cam(true);}
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&document.documentElement.classList.contains("pc-cam"))cam(false);});
function all(){document.querySelectorAll("figure.pc[data-p]").forEach(mount);}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",all);else all();})();`;
