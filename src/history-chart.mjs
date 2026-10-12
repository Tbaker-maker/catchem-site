// Price history chart: one smooth line, soft gradient fill, light gridlines,
// range pills, hover or tap tooltip. A missing stretch is a gap, never a filled line.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const DAY = 86400000;
const isoOf = (n) => new Date(n * DAY).toISOString().slice(0, 10);

// Long series is "epochDay:price,..." (change-only, 7-day heartbeat). Own nightly series wins.
export function mergeHistory(own, longPacked) {
  const mine = (own || []).filter((p) => Array.isArray(p) && /^\d{4}-\d{2}-\d{2}$/.test(String(p[0])) && Number(p[1]) > 0).map((p) => [String(p[0]), Number(p[1]), "n"]);
  const firstOwn = mine.length ? mine[0][0] : "9999-12-31";
  const long = String(longPacked || "").split(",").map((b) => b.split(":")).filter((b) => b.length === 2 && Number(b[1]) > 0).map(([d, v]) => [isoOf(Number(d)), Number(v), "a"]).filter((p) => p[0] < firstOwn);
  return [...long, ...mine].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

export function historySources(points, ownLabel = "TCGplayer market price via tcgcsv, our nightly pull") {
  const out = [];
  const a = points.filter((p) => p[2] === "a");
  const n = points.filter((p) => p[2] === "n");
  if (a.length) out.push(`TCGplayer market price via tcgcsv daily archive, ${a[0][0]} to ${a.at(-1)[0]}`);
  if (n.length) out.push(`${ownLabel}, ${n[0][0]} to ${n.at(-1)[0]}`);
  return out;
}

export function historyChart(points, { asOf = "", color = "#d9b779", ownLabel } = {}) {
  const pts = (points || []).filter((p) => p && Number(p[1]) > 0);
  if (pts.length < 2) return `<div class="hc hc-empty"><p class="muted">Not enough price days on file yet. Missing days show as gaps.</p></div>`;
  const src = historySources(pts, ownLabel);
  const spanDays = (Date.parse(pts.at(-1)[0]) - Date.parse(pts[0][0])) / DAY;
  const ranges = [["1M", 31], ["3M", 92], ["6M", 183], ["1Y", 366], ["All", 0]].filter(([, d]) => d === 0 || spanDays > d * 0.5);
  const pills = ranges.map(([l, d], i) => `<button type="button" class="hc-pill" data-days="${d}" aria-pressed="${i === ranges.length - 1 ? "true" : "false"}">${l}</button>`).join("");
  return `<figure class="hc" data-pts="${esc(JSON.stringify(pts))}" data-color="${esc(color)}">
<div class="hc-top"><div class="hc-read"><span class="hc-price"></span><span class="hc-date muted"></span></div><div class="hc-pills" role="group" aria-label="Chart range">${pills}</div></div>
<div class="hc-plot"><svg class="hc-svg" viewBox="0 0 600 220" preserveAspectRatio="none" role="img" aria-label="Price history. Gaps are days with no price on file."></svg><div class="hc-tip" hidden></div></div>
<div class="hc-axis muted"></div>
<figcaption class="hc-src muted">${src.map(esc).join(". ")}. Missing days show as gaps.${asOf ? ` As of ${esc(asOf)}.` : ""}</figcaption>
</figure>`;
}

export const HISTORY_CSS = `.hc{margin:16px 0;padding:16px 16px 12px;border-radius:20px;background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.08);box-shadow:0 8px 30px rgba(0,0,0,.18)}
.hc-top{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-bottom:8px}
.hc-read{display:flex;flex-direction:column;gap:2px;min-height:40px}.hc-price{font-size:22px;font-weight:650;letter-spacing:-.01em}.hc-date{font-size:13px}
.hc-pills{display:inline-flex;gap:4px;padding:3px;border-radius:999px;background:rgba(255,255,255,.06)}
.hc-pill{appearance:none;border:0;background:transparent;color:inherit;font:inherit;font-size:13px;font-weight:600;padding:6px 12px;border-radius:999px;cursor:pointer;opacity:.7;transition:background .2s,opacity .2s}
.hc-pill[aria-pressed="true"]{background:rgba(255,255,255,.14);opacity:1}.hc-pill:focus-visible{outline:2px solid #d9b779;outline-offset:2px}
.hc-plot{position:relative;height:220px;touch-action:pan-y}.hc-svg{width:100%;height:100%;display:block;overflow:visible}
.hc-tip{position:absolute;top:6px;transform:translateX(-50%);pointer-events:none;padding:6px 10px;border-radius:12px;background:rgba(24,22,20,.92);border:1px solid rgba(255,255,255,.1);font-size:12px;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,.3)}
.hc-axis{display:flex;justify-content:space-between;font-size:11px;margin-top:2px}
.hc-src{margin:8px 2px 0;font-size:12px;line-height:1.45}
@media(max-width:600px){.hc{padding:14px 12px 10px;border-radius:18px}.hc-plot{height:180px}.hc-pill{padding:6px 10px}}`;

export const HISTORY_JS = `(function(){
function money(v){return "$"+Number(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});}
var M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function nice(d){var p=d.split("-");return M[+p[1]-1]+" "+(+p[2])+", "+p[0];}
function ms(d){return Date.parse(d+"T00:00:00Z");}
function smooth(xy){if(xy.length<2)return "M"+xy[0][0]+","+xy[0][1];var d="M"+xy[0][0].toFixed(1)+","+xy[0][1].toFixed(1);for(var i=0;i<xy.length-1;i++){var p0=xy[i-1]||xy[i],p1=xy[i],p2=xy[i+1],p3=xy[i+2]||p2;var c1x=p1[0]+(p2[0]-p0[0])/6,c1y=p1[1]+(p2[1]-p0[1])/6,c2x=p2[0]-(p3[0]-p1[0])/6,c2y=p2[1]-(p3[1]-p1[1])/6;var lo=Math.min(p1[1],p2[1]),hi=Math.max(p1[1],p2[1]);c1y=Math.max(lo,Math.min(hi,c1y));c2y=Math.max(lo,Math.min(hi,c2y));d+=" C"+c1x.toFixed(1)+","+c1y.toFixed(1)+" "+c2x.toFixed(1)+","+c2y.toFixed(1)+" "+p2[0].toFixed(1)+","+p2[1].toFixed(1);}return d;}
function mount(fig){if(fig.dataset.ready)return;fig.dataset.ready="1";
var all=JSON.parse(fig.getAttribute("data-pts")||"[]"),color=fig.getAttribute("data-color")||"#d9b779";
var svg=fig.querySelector(".hc-svg"),tip=fig.querySelector(".hc-tip"),plot=fig.querySelector(".hc-plot"),priceEl=fig.querySelector(".hc-price"),dateEl=fig.querySelector(".hc-date");
var W=600,H=220,PT=14,PB=4,view=all,gid="g"+Math.random().toString(36).slice(2,8);
function head(p,a){priceEl.textContent=money(p[1]);dateEl.textContent=nice(p[0])+(a?"":" · latest");}
function draw(days){var end=ms(all[all.length-1][0]);view=days?all.filter(function(p){return ms(p[0])>=end-days*864e5;}):all;if(view.length<2)view=all.slice(-2);
var vals=view.map(function(p){return p[1]}),mn=Math.min.apply(null,vals),mx=Math.max.apply(null,vals),pad=(mx-mn)*.12||mx*.05||1;mn-=pad;mx+=pad;
var t0=ms(view[0][0]),t1=ms(view[view.length-1][0])||t0+1;
function X(d){return t1===t0?W/2:((ms(d)-t0)/(t1-t0))*W;}function Y(v){return PT+(1-(v-mn)/(mx-mn))*(H-PT-PB);}
var segs=[],run=[];view.forEach(function(p,i){var prev=view[i-1];if(prev){var gap=(ms(p[0])-ms(prev[0]))/864e5;var lim=(p[2]==="a"&&prev[2]==="a")?8:(p[2]==="n"&&prev[2]==="n")?1:3;if(gap>lim&&run.length){segs.push(run);run=[];}}run.push([X(p[0]),Y(p[1])]);});if(run.length)segs.push(run);
var g="";for(var k=1;k<=3;k++){var y=(PT+(H-PT-PB)*k/4).toFixed(1);g+='<line x1="0" x2="'+W+'" y1="'+y+'" y2="'+y+'" stroke="rgba(255,255,255,.07)" stroke-width="1" vector-effect="non-scaling-stroke"/>';}
var body="";segs.forEach(function(s){if(s.length===1){body+='<circle cx="'+s[0][0].toFixed(1)+'" cy="'+s[0][1].toFixed(1)+'" r="2.5" fill="'+color+'"/>';return;}var d=smooth(s);body+='<path d="'+d+" L"+s[s.length-1][0].toFixed(1)+","+(H-PB)+" L"+s[0][0].toFixed(1)+","+(H-PB)+' Z" fill="url(#'+gid+')" stroke="none"/><path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>';});
var lab="";var ax=fig.querySelector(".hc-axis");if(ax)ax.innerHTML="<span>"+nice(view[0][0])+"</span><span>"+nice(view[view.length-1][0])+"</span>";
svg.innerHTML='<defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+color+'" stop-opacity=".28"/><stop offset="1" stop-color="'+color+'" stop-opacity="0"/></linearGradient></defs>'+g+body+lab+'<line class="hc-x" x1="0" x2="0" y1="'+PT+'" y2="'+(H-PB)+'" stroke="rgba(255,255,255,.35)" stroke-width="1" vector-effect="non-scaling-stroke" visibility="hidden"/><circle class="hc-dot" r="4" fill="'+color+'" stroke="#141210" stroke-width="2" visibility="hidden"/>';
svg._X=X;svg._Y=Y;head(view[view.length-1]);}
function near(cx){var r=plot.getBoundingClientRect(),x=(cx-r.left)/r.width*W,best=view[0],bd=1e9;view.forEach(function(p){var d=Math.abs(svg._X(p[0])-x);if(d<bd){bd=d;best=p;}});return best;}
function show(cx){var p=near(cx),x=svg._X(p[0]),y=svg._Y(p[1]),r=plot.getBoundingClientRect();var ln=svg.querySelector(".hc-x"),dot=svg.querySelector(".hc-dot");ln.setAttribute("x1",x);ln.setAttribute("x2",x);ln.setAttribute("visibility","visible");dot.setAttribute("cx",x);dot.setAttribute("cy",y);dot.setAttribute("visibility","visible");tip.hidden=false;tip.textContent=nice(p[0])+"  "+money(p[1]);var px=x/W*r.width;tip.style.left=Math.max(60,Math.min(r.width-60,px))+"px";head(p,1);}
function hide(){tip.hidden=true;var ln=svg.querySelector(".hc-x"),dot=svg.querySelector(".hc-dot");if(ln)ln.setAttribute("visibility","hidden");if(dot)dot.setAttribute("visibility","hidden");head(view[view.length-1]);}
plot.addEventListener("pointermove",function(e){show(e.clientX);});plot.addEventListener("pointerdown",function(e){show(e.clientX);});plot.addEventListener("pointerleave",hide);
fig.querySelectorAll(".hc-pill").forEach(function(b){b.addEventListener("click",function(){fig.querySelectorAll(".hc-pill").forEach(function(o){o.setAttribute("aria-pressed",o===b?"true":"false");});hide();draw(+b.getAttribute("data-days"));});});
draw(0);}
function all(){document.querySelectorAll("figure.hc[data-pts]").forEach(mount);}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",all);else all();})();`;
