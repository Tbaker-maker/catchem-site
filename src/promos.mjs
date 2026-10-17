// /promos. Cards come from /data/promos.json, already priced and tagged.
// Era, art type, and source type are chips. Sealed promo packs are a tab
// with no condition words. A trend arrow uses the day count stored on the row.

const ERAS = ["Mega", "Scarlet & Violet", "Sword & Shield", "Older"];
const ARTS = ["Special Illustration Rare", "Illustration Rare", "Full Art", "Alt Art", "Trainer Gallery", "Textured or Etched", "Holo", "Reverse Holo", "Regular"];
const SOURCES = ["Premium Collection", "UPC", "ETB", "Tin", "Box", "League", "Prerelease", "McDonald's", "Pokemon Center"];

function chips(id, label, values, first) {
  const buttons = ['<button type="button" data-v="" aria-pressed="true">' + first + "</button>"].concat(
    values.map((value) => '<button type="button" data-v="' + String(value).replace(/"/g, "") + '">' + value + "</button>"),
  );
  return '<div class="art-chips" id="' + id + '" role="group" aria-label="' + label + '">' + buttons.join("") + "</div>";
}

// No regex in this string. It is pasted into a classic script, where a regex
// literal loses its backslashes.
const PAGE_JS = `
var doc=null;
function money(n){return !(n>0)?"":"$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});}
function html(s){
  var raw=String(s==null?"":s);
  var out="";
  for(var i=0;i<raw.length;i++){
    var c=raw.charAt(i);
    if(c==="&") out+="&"+"amp;";
    else if(c==="<") out+="&"+"lt;";
    else if(c===">") out+="&"+"gt;";
    else if(c==='"') out+="&"+"quot;";
    else if(c==="'") out+="&"+"#39;";
    else out+=c;
  }
  return out;
}
function pressed(id){
  var b=document.querySelector("#"+id+" button[aria-pressed="+String.fromCharCode(34)+"true"+String.fromCharCode(34)+"]");
  return b?String(b.getAttribute("data-v")||""):"";
}
function arrow(trend){
  if(!trend||!trend.label) return "";
  var dir=trend.dir==="up"?"up":trend.dir==="down"?"down":"flat";
  var mark=dir==="up"?"▲":dir==="down"?"▼":"■";
  var n=Number(trend.pct);
  var text=dir==="flat"?"flat":((n>0?"+":"")+n+"%");
  return '<span class="promo-trend '+dir+'">'+mark+" "+html(text)+" "+html(trend.label)+"</span>";
}
function pidOf(id){
  var s=String(id||"");
  var mark="tcgcsv-";
  var at=s.indexOf(mark);
  if(at<0) return "";
  var n="";
  var i=at+mark.length;
  while(i<s.length && s.charAt(i)>="0" && s.charAt(i)<="9"){ n+=s.charAt(i); i++; }
  return n;
}
function tile(row, sealed){
  var href=(sealed?"/p/":"/c/")+encodeURIComponent(row.id);
  var pid=pidOf(row.id);
  var src=pid?"/api/card-img?pid="+pid:"";
  var img=src?'<img alt="'+html(row.name)+'" width="64" height="89" loading="lazy" decoding="async" class="'+(sealed?"shot":"shot card-face thumb")+'" '+(sealed?"":'data-crop-card="1" onload="if(window.cropCardEdge)cropCardEdge(this)" ')+'src="'+src+'">':'<span class="promo-blank" aria-hidden="true"></span>';
  var bits=[];
  if(row.num) bits.push("#"+html(row.num));
  if(!sealed && row.art) bits.push('<span class="artchip">'+html(row.art)+"</span>");
  if(!sealed && row.source) bits.push(html(row.source));
  var when=doc&&doc.asOf?String(doc.asOf):"";
  return '<a class="promo-tile" href="'+href+'">'+img+'<span class="promo-copy"><b>'+html(row.name)+"</b>"+(bits.length?'<span class="muted">'+bits.join(" · ")+"</span>":"")+'<span class="promo-price"><b>'+money(row.price)+"</b>"+arrow(row.trend)+"</span>"+(when?'<span class="muted">'+html(when)+"</span>":"")+"</span></a>";
}
function draw(){
  var tab=pressed("promo-tabs")||"cards";
  var era=pressed("promo-era");
  var art=pressed("promo-art");
  var source=pressed("promo-source");
  var box=document.getElementById("promo-list");
  var note=document.getElementById("promo-note");
  var rows=tab==="sealed"?(doc.sealed||[]):(doc.cards||[]);
  if(tab!=="sealed"){
    rows=rows.filter(function(r){
      if(era && r.era!==era) return false;
      if(art && r.art!==art) return false;
      if(source && r.source!==source) return false;
      return true;
    });
  }
  document.getElementById("promo-art").hidden=tab==="sealed";
  document.getElementById("promo-source").hidden=tab==="sealed";
  document.getElementById("promo-era").hidden=tab==="sealed";
  if(!rows.length){ box.innerHTML=""; note.hidden=false; note.textContent=tab==="sealed"?"No sealed promo packs in this file.":"No promos match these filters."; return; }
  note.hidden=true;
  box.innerHTML=rows.map(function(r){ return tile(r, tab==="sealed"); }).join("");
}
function bind(id){
  var root=document.getElementById(id);
  if(!root) return;
  root.addEventListener("click",function(ev){
    var b=ev.target.closest("button");
    if(!b||!root.contains(b)) return;
    root.querySelectorAll("button").forEach(function(x){ x.setAttribute("aria-pressed", x===b?"true":"false"); });
    draw();
  });
}
fetch("/data/promos.json").then(function(r){ return r.ok?r.json():null; }).then(function(body){
  doc=body&&Array.isArray(body.cards)?body:null;
  if(!doc){ document.getElementById("promo-note").hidden=false; document.getElementById("promo-note").textContent="Promos did not load."; return; }
  var head=document.getElementById("promo-count");
  if(head) head.textContent=doc.count+" promos tracked. "+(doc.source||"TCGplayer market")+" price, "+String(doc.asOf||"")+".";
  draw();
}).catch(function(){
  var note=document.getElementById("promo-note");
  note.hidden=false;
  note.textContent="Promos did not load.";
});
["promo-tabs","promo-era","promo-art","promo-source"].forEach(bind);
`;

export function renderPromos() {
  const css = `<style>
.promo-page{max-width:1100px}
.promo-page h1{font:600 34px/1.1 var(--serif);margin:8px 0}
.promo-tabs{margin-top:12px}
.promo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;margin:12px 0 28px}
.promo-tile{display:flex;gap:10px;align-items:flex-start;min-height:44px;padding:10px;border-radius:16px;background:#1a1815;border:1px solid #2f2b26;color:inherit;text-decoration:none}
.promo-tile img{width:64px;height:88px;object-fit:contain;border-radius:8px;background:#12100e;flex:0 0 auto}
.promo-blank{width:64px;height:88px;border-radius:8px;background:#12100e;flex:0 0 auto}
.promo-copy{display:flex;flex-direction:column;gap:4px;min-width:0}
.promo-copy b{font:600 14px/1.3 var(--sans)}
.promo-price{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.promo-trend{font:600 12px/1 var(--sans)}
.promo-trend.up{color:#7fc79a}
.promo-trend.down{color:#e0675b}
.promo-trend.flat{color:#aeaeb2}
.art-chips{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0;max-width:100%}
.art-chips button{min-height:44px;padding:0 14px;border-radius:999px;border:1px solid #2f2b26;background:#1a1815;color:inherit;font:600 13px/1 var(--sans);cursor:pointer}
.art-chips button[aria-pressed="true"]{border-color:var(--gold);color:var(--gold)}
.artchip{display:inline-flex;align-items:center;min-height:22px;padding:0 8px;border-radius:999px;background:#3a3a3e;color:#aeaeb2;font:600 12px/1 var(--sans)}
@media(max-width:640px){.promo-page h1{font-size:28px}.promo-grid{grid-template-columns:1fr}}
</style>`;
  return `<main id="main" tabindex="-1" class="wrap promo-page">
${css}
<h1>Promos</h1>
<p class="muted" id="promo-count">Promos tracked. TCGplayer market price.</p>
${chips("promo-tabs", "Promo list", ["Sealed promos"], "Cards")}
${chips("promo-era", "Era", ERAS, "All eras")}
${chips("promo-art", "Art type", ARTS, "All art")}
${chips("promo-source", "Source product", SOURCES, "All sources")}
<p class="muted" id="promo-note" hidden>No promos match these filters.</p>
<div class="promo-grid" id="promo-list"></div>
</main>
<script>
${PAGE_JS}
</script>`;
}
