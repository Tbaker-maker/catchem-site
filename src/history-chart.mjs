// Price history chart: one smooth line, soft gradient fill, light gridlines,
// range pills, hover or tap tooltip. A missing day carries the last real price forward;
// the tooltip names the last real date. The line starts at the first real price.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const DAY = 86400000;
const isoOf = (n) => new Date(n * DAY).toISOString().slice(0, 10);

// Long series is "epochDay:price,..." (change-only, 7-day heartbeat). Own nightly series wins.
// fillTo: our first own day when the data build added earlier fan-site days; those days are tagged "f".
export function mergeHistory(own, longPacked, fillTo = "") {
  const mine = (own || []).filter((p) => Array.isArray(p) && /^\d{4}-\d{2}-\d{2}$/.test(String(p[0])) && Number(p[1]) > 0).map((p) => [String(p[0]), Number(p[1]), fillTo && String(p[0]) < fillTo ? "f" : "n"]);
  const firstOwn = mine.length ? mine[0][0] : "9999-12-31";
  const long = String(longPacked || "").split(",").map((b) => b.split(":")).filter((b) => b.length === 2 && Number(b[1]) > 0).map(([d, v]) => [isoOf(Number(d)), Number(v), "a"]).filter((p) => p[0] < firstOwn);
  return [...long, ...mine].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

export function historySources(points, ownLabel = "TCGplayer market price via tcgcsv, our nightly pull") {
  const out = [];
  const a = points.filter((p) => p[2] === "a");
  const n = points.filter((p) => p[2] === "n");
  const f = points.filter((p) => p[2] === "f");
  if (f.length) out.push(`Earlier history comes from public fan-site data (PokeVizInvestor, TCGplayer market), ${f[0][0]} to ${f.at(-1)[0]}`);
  if (a.length) out.push(`TCGplayer market price via tcgcsv daily archive, ${a[0][0]} to ${a.at(-1)[0]}`);
  if (n.length) out.push(`${ownLabel}, ${n[0][0]} to ${n.at(-1)[0]}`);
  return out;
}

// Daily series with no gaps. A carried day is [date, value, tag, lastRealDate].
// Counts may be 0. A price of 0 is not a point.
export function fillDaily(points, opts = {}) {
  const allowZero = opts.allowZero === true;
  const keep = (n) => allowZero ? Number.isFinite(Number(n)) && Number(n) >= 0 : Number(n) > 0;
  const pts = (points || []).filter((p) => p && keep(p[1]));
  const out = [];
  for (const p of pts) {
    const last = out.at(-1);
    if (last) {
      const real = last[3] || last[0];
      for (let t = Date.parse(last[0]) + DAY; t < Date.parse(p[0]); t += DAY) out.push([new Date(t).toISOString().slice(0, 10), last[1], last[2], real]);
    }
    out.push([p[0], p[1], p[2]]);
  }
  return out;
}

export function historyChart(points, { asOf = "", color = "#d9b779", ownLabel, unit = "price", snap = "all" } = {}) {
  const count = unit === "count";
  const keep = (n) => count ? Number.isFinite(Number(n)) && Number(n) >= 0 : Number(n) > 0;
  const real = (points || []).filter((p) => p && keep(p[1]) && !p[3]);
  if (real.length < 2) {
    const line = count
      ? (real.length ? `First listings counted on ${esc(real[0][0])}. The line starts here and grows each night.` : "The line starts at the first night with listings counted.")
      : (real.length ? `First price on file ${esc(real[0][0])}. The line starts here and grows each night.` : "The line starts at the first price on file.");
    return `<div class="hc hc-empty"><p class="muted">${line}</p></div>`;
  }
  const pts = fillDaily(real, { allowZero: count });
  const carried = pts.filter((p) => p[3]).length;
  const spanDays = (Date.parse(pts.at(-1)[0]) - Date.parse(pts[0][0])) / DAY;
  const ranges = [["1M", 31], ["3M", 92], ["6M", 183], ["1Y", 366], ["All", 0]].filter(([, d]) => d === 0 || spanDays > d * 0.5);
  const pills = ranges.map(([l, d], i) => `<button type="button" class="hc-pill" data-days="${d}" aria-pressed="${i === ranges.length - 1 ? "true" : "false"}">${l}</button>`).join("");
  const label = count ? "eBay listings counted" : "Price history";
  return `<figure class="hc" data-unit="${esc(unit)}" data-snap="${esc(count ? "real" : snap)}" data-pts="${esc(JSON.stringify(pts))}" data-color="${esc(color)}">
<div class="hc-top"><div class="hc-read"><span class="hc-price"></span><span class="hc-date muted"></span></div><div class="hc-pills" role="group" aria-label="Chart range">${pills}</div></div>
<div class="hc-plot"><svg class="hc-svg" viewBox="0 0 600 220" preserveAspectRatio="none" role="img" aria-label="${esc(label)}"></svg><div class="hc-gls" aria-hidden="true"></div><div class="hc-tip" hidden></div></div>
<div class="hc-axis muted"></div>
</figure>`;
}

export const HISTORY_CSS = `.hc{margin:16px 0;padding:16px 16px 12px;border-radius:20px;background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.08);box-shadow:0 8px 30px rgba(0,0,0,.18)}
.hc-top{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-bottom:8px}
.hc-read{display:flex;flex-direction:column;gap:2px;min-height:40px}.hc-price{font-size:22px;font-weight:650;letter-spacing:-.01em}.hc-date{font-size:13px}
.hc-pills{display:inline-flex;gap:4px;padding:3px;border-radius:999px;background:rgba(255,255,255,.06)}
.hc-pill{appearance:none;border:0;background:transparent;color:inherit;font:inherit;font-size:13px;font-weight:600;padding:6px 12px;border-radius:999px;cursor:pointer;opacity:.7;transition:background .2s,opacity .2s}
.hc-pill[aria-pressed="true"]{background:rgba(255,255,255,.14);opacity:1}.hc-pill:focus-visible{outline:2px solid #d9b779;outline-offset:2px}
.hc-plot{position:relative;height:220px;touch-action:pan-y}.hc-svg{width:100%;height:100%;display:block;overflow:visible}
.hc-tip{position:absolute;top:6px;transform:translateX(-50%);pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:1px;padding:7px 12px;border-radius:14px;background:rgba(24,22,20,.94);border:1px solid rgba(255,255,255,.12);font-size:12px;white-space:nowrap;box-shadow:0 6px 20px rgba(0,0,0,.35);z-index:2}.hc-tip b{font-size:14px;font-weight:650}.hc-tip span{opacity:.7}
.hc-gls{position:absolute;inset:0;pointer-events:none}.hc-gl{position:absolute;right:2px;transform:translateY(-120%);font-size:10px;opacity:.38}
.hc-axis{display:flex;justify-content:space-between;font-size:11px;margin-top:2px}
.hc-gaps{}
@media(max-width:600px){.hc{padding:14px 12px 10px;border-radius:18px}.hc-plot{height:180px}.hc-pill{padding:6px 10px}}`;

export const HISTORY_JS = `(function(){
function money(v){return "$"+Number(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});}
var M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function nice(d){var p=d.split("-");return M[+p[1]-1]+" "+(+p[2])+", "+p[0];}
function ms(d){return Date.parse(d+"T00:00:00Z");}function iso(t){return new Date(t).toISOString().slice(0,10);}function short(d){var p=d.split("-");return M[+p[1]-1]+" "+(+p[2])+(+p[0]===new Date().getUTCFullYear()?"":", "+p[0]);}
function smooth(xy){if(xy.length<2)return "M"+xy[0][0]+","+xy[0][1];var d="M"+xy[0][0].toFixed(1)+","+xy[0][1].toFixed(1);for(var i=0;i<xy.length-1;i++){var p0=xy[i-1]||xy[i],p1=xy[i],p2=xy[i+1],p3=xy[i+2]||p2;var c1x=p1[0]+(p2[0]-p0[0])/6,c1y=p1[1]+(p2[1]-p0[1])/6,c2x=p2[0]-(p3[0]-p1[0])/6,c2y=p2[1]-(p3[1]-p1[1])/6;var lo=Math.min(p1[1],p2[1]),hi=Math.max(p1[1],p2[1]);c1y=Math.max(lo,Math.min(hi,c1y));c2y=Math.max(lo,Math.min(hi,c2y));d+=" C"+c1x.toFixed(1)+","+c1y.toFixed(1)+" "+c2x.toFixed(1)+","+c2y.toFixed(1)+" "+p2[0].toFixed(1)+","+p2[1].toFixed(1);}return d;}
function mount(fig){if(fig.dataset.ready)return;fig.dataset.ready="1";
var all=JSON.parse(fig.getAttribute("data-pts")||"[]"),color=fig.getAttribute("data-color")||"#d9b779",unit=fig.getAttribute("data-unit")||"price",snap=fig.getAttribute("data-snap")||"all";
var svg=fig.querySelector(".hc-svg"),tip=fig.querySelector(".hc-tip"),plot=fig.querySelector(".hc-plot"),priceEl=fig.querySelector(".hc-price"),dateEl=fig.querySelector(".hc-date");
var W=600,H=220,PT=14,PB=4,view=all,gid="g"+Math.random().toString(36).slice(2,8);
function showVal(v){return unit==="count"?Math.round(Number(v)).toLocaleString("en-US"):unit==="index"?(Math.round(Number(v)*10)/10).toLocaleString("en-US",{maximumFractionDigits:1}):money(v);}
function gridVal(v){if(unit!=="price")return showVal(v);var n=Number(v);return n>=100?"$"+Math.round(n).toLocaleString("en-US"):money(n);}
function head(p){priceEl.textContent=showVal(p[1]);dateEl.textContent=short(p[0]);}
function draw(days){var end=ms(all[all.length-1][0]);view=days?all.filter(function(p){return ms(p[0])>=end-days*864e5;}):all;if(view.length<2)view=all.slice(-2);
var vals=view.map(function(p){return p[1]}),mn=Math.min.apply(null,vals),mx=Math.max.apply(null,vals),pad=(mx-mn)*.12||mx*.05||1;mn-=pad;mx+=pad;
var t0=ms(view[0][0]),t1=ms(view[view.length-1][0])||t0+1;
function X(d){return t1===t0?W/2:((ms(d)-t0)/(t1-t0))*W;}function Y(v){return PT+(1-(v-mn)/(mx-mn))*(H-PT-PB);}
var segs=[],run=null;
view.forEach(function(p){
  var fade=p[2]==="f";
  var xy=[X(p[0]),Y(p[1])];
  if(!run||run.fade!==fade){
    if(run&&run.pts.length) run.pts.push(xy);
    run={fade:fade,pts:[xy]};
    segs.push(run);
  }else run.pts.push(xy);
});
var body="";
segs.forEach(function(seg){
  var s=seg.pts,op=seg.fade?".35":"1";
  if(s.length<2){body+='<circle cx="'+s[0][0].toFixed(1)+'" cy="'+s[0][1].toFixed(1)+'" r="2.5" fill="'+color+'" fill-opacity="'+op+'"/>';return;}
  var d=smooth(s);
  if(!seg.fade) body+='<path d="'+d+" L"+s[s.length-1][0].toFixed(1)+","+(H-PB)+" L"+s[0][0].toFixed(1)+","+(H-PB)+' Z" fill="url(#'+gid+')" stroke="none"/>';
  body+='<path d="'+d+'" fill="none" stroke="'+color+'" stroke-opacity="'+op+'" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>';
});
if(unit!=="count"){
  var hiP=null,loP=null;
  view.forEach(function(p){if(p[3])return;if(!hiP||p[1]>hiP[1])hiP=p;if(!loP||p[1]<loP[1])loP=p;});
  if(hiP) body+='<circle cx="'+X(hiP[0]).toFixed(1)+'" cy="'+Y(hiP[1]).toFixed(1)+'" r="3.5" fill="none" stroke="#efe9de" stroke-width="1.5"/>';
  if(loP&&loP!==hiP) body+='<circle cx="'+X(loP[0]).toFixed(1)+'" cy="'+Y(loP[1]).toFixed(1)+'" r="3.5" fill="#efe9de"/>';
}
var g="",gl="";for(var k=1;k<=3;k++){var yy=PT+(H-PT-PB)*k/4,y=yy.toFixed(1);g+='<line x1="0" x2="'+W+'" y1="'+y+'" y2="'+y+'" stroke="rgba(255,255,255,.06)" stroke-width="1" vector-effect="non-scaling-stroke"/>';var gv=mn+(1-(yy-PT)/(H-PT-PB))*(mx-mn);gl+='<span class="hc-gl" style="top:'+(yy/H*100).toFixed(2)+'%">'+gridVal(gv)+'</span>';}
var glBox=fig.querySelector(".hc-gls");if(glBox)glBox.innerHTML=gl;
var lab="";var ax=fig.querySelector(".hc-axis");if(ax)ax.innerHTML="<span>"+short(view[0][0])+"</span><span>"+short(view[view.length-1][0])+"</span>";
svg.innerHTML='<defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+color+'" stop-opacity=".28"/><stop offset="1" stop-color="'+color+'" stop-opacity="0"/></linearGradient></defs>'+g+body+lab+'<line class="hc-x" x1="0" x2="0" y1="'+PT+'" y2="'+(H-PB)+'" stroke="rgba(255,255,255,.35)" stroke-width="1" vector-effect="non-scaling-stroke" visibility="hidden"/><circle class="hc-dot" r="4" fill="'+color+'" stroke="#141210" stroke-width="2" visibility="hidden"/>';
svg._X=X;svg._Y=Y;head(view[view.length-1]);}
function near(cx){var r=plot.getBoundingClientRect(),x=(cx-r.left)/r.width*W,pool=view;if(snap==="real"){var reals=view.filter(function(p){return !p[3];});if(reals.length)pool=reals;}var best=pool[0],bd=1e9;pool.forEach(function(p){var d=Math.abs(svg._X(p[0])-x);if(d<bd){bd=d;best=p;}});return best;}
function srcOf(p){return unit==="count"?"Listings counted, eBay":p[2]==="f"?"PokeVizInvestor (TCGplayer market)":p[2]==="a"?"TCGplayer market, tcgcsv archive":"TCGplayer market";}function show(cx){var p=near(cx),x=svg._X(p[0]),y=svg._Y(p[1]),r=plot.getBoundingClientRect();var ln=svg.querySelector(".hc-x"),dot=svg.querySelector(".hc-dot");ln.setAttribute("x1",x);ln.setAttribute("x2",x);ln.setAttribute("visibility","visible");dot.setAttribute("cx",x);dot.setAttribute("cy",y);dot.setAttribute("visibility","visible");tip.hidden=false;tip.innerHTML="<b>"+showVal(p[1])+"</b><span>"+short(p[0])+(p[3]?" · last on file "+short(p[3]):"")+"</span>";var px=x/W*r.width,py=y/H*r.height;var hw=tip.offsetWidth/2+4;tip.style.left=Math.max(hw,Math.min(r.width-hw,px))+"px";var th=tip.offsetHeight+12;tip.style.top=(py-th<0?py+12:py-th)+"px";}
function hide(){tip.hidden=true;var ln=svg.querySelector(".hc-x"),dot=svg.querySelector(".hc-dot");if(ln)ln.setAttribute("visibility","hidden");if(dot)dot.setAttribute("visibility","hidden");}
plot.addEventListener("pointermove",function(e){show(e.clientX);});plot.addEventListener("pointerdown",function(e){show(e.clientX);});plot.addEventListener("pointerleave",hide);
fig.querySelectorAll(".hc-pill").forEach(function(b){b.addEventListener("click",function(){fig.querySelectorAll(".hc-pill").forEach(function(o){o.setAttribute("aria-pressed",o===b?"true":"false");});hide();draw(+b.getAttribute("data-days"));});});
draw(0);}
function all(){document.querySelectorAll("figure.hc[data-pts]").forEach(mount);}window.catchemHistoryMount=all;
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",all);else all();})();`;
