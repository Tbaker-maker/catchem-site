import { createRank } from "./catalog-rank.mjs";
import { queryShardIds } from "./search-shards.mjs";

export function homeFinderSource() {
  return `(function(){
function __name(t,v){try{Object.defineProperty(t,"name",{value:v,configurable:true})}catch(e){}return t}
var rankApi=(${createRank.toString()})();
var queryShardIds=${queryShardIds.toString()};
var input=document.getElementById("home-q");
var box=document.getElementById("home-finder");
if(!input||!box) return;
var form=input.form;
var manifestP=null;
var shardCache={};
var rows=[];
var active=-1;
var timer=0;
function manifest(){
  if(manifestP) return manifestP;
  manifestP=fetch("/data/feed/search/manifest.json").then(function(r){ return r.ok?r.json():null; }).catch(function(){ return null; });
  return manifestP;
}
input.addEventListener("focus", function(){ manifest(); });
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g, function(c){ if(c==="&") return "&"+"amp;"; if(c==="<") return "&"+"lt;"; if(c===">") return "&"+"gt;"; if(c==='"') return "&"+"quot;"; return "&"+"#39;"; }); }
function paint(hits){
  var list=(hits||[]).slice(0,8);
  if(!list.length){ box.hidden=true; box.innerHTML=""; input.setAttribute("aria-expanded","false"); input.removeAttribute("aria-activedescendant"); return; }
  if(active>=list.length) active=-1;
  box.hidden=false;
  input.setAttribute("aria-expanded","true");
  box.innerHTML=list.map(function(r,i){
    var href=(r[5]==="sealed"?"/p/":"/c/")+encodeURIComponent(r[0]);
    var pid=String(r[0]||"").match(/(\\d+)$/);
    var img=pid?'<img alt="" width="36" height="50" src="/api/card-img?pid='+pid[1]+'" onerror="this.remove()">':"";
    return '<a class="finder-opt" role="option" id="home-opt-'+i+'" href="'+href+'" aria-selected="'+(i===active?"true":"false")+'">'+img+'<span class="finder-copy"><b>'+esc(r[1])+'</b><span>'+esc(r[2]||"")+'</span></span><span class="finder-type">'+esc(rankApi.typeLabel(r))+'</span></a>';
  }).join("");
}
async function loadRows(q){
  var doc=await manifest();
  if(!doc||!doc.shards){
    if(!loadRows.lite) loadRows.lite=await (await fetch("/data/search-lite.json")).json();
    rows=loadRows.lite;
    return;
  }
  var ids=queryShardIds(rankApi.expandQuery(q)).filter(function(id){ return doc.shards[id]; });
  await Promise.all(ids.map(function(id){
    if(shardCache[id]) return;
    return fetch("/data/feed/search/shards/"+id+".json").then(function(r){ return r.ok?r.json():[]; }).then(function(body){ shardCache[id]=body; }).catch(function(){ shardCache[id]=[]; });
  }));
  var seen={}; rows=[];
  ids.forEach(function(id){ (shardCache[id]||[]).forEach(function(row){ if(row&&!seen[row[0]]){ seen[row[0]]=1; rows.push(row); } }); });
}
async function suggest(){
  var q=input.value.trim();
  if(q.length<2){ paint([]); return; }
  try { await loadRows(q); } catch(e) { paint([]); return; }
  paint(rankApi.rankCatalog(q, rows, 8));
}
input.addEventListener("input", function(){ active=-1; clearTimeout(timer); timer=setTimeout(suggest, 80); });
async function go(ev){
  var q=input.value.trim();
  if(q.length<2) return;
  if(ev) ev.preventDefault();
  var chosen=box.querySelector('.finder-opt[aria-selected="true"]');
  if(chosen && ev && ev.type==="keydown"){ location.href=chosen.getAttribute("href"); return; }
  try { await loadRows(q); } catch(e) { location.href="/search?q="+encodeURIComponent(q); return; }
  var pick=rankApi.pickTarget(q, rows, 8);
  if(pick.mode==="page" && pick.href) location.href=pick.href;
  else location.href="/search?q="+encodeURIComponent(q);
}
if(form) form.addEventListener("submit", go);
var feedBtn=document.querySelector(".actions a.btn-primary");
if(feedBtn) feedBtn.addEventListener("click", function(ev){
  if(feedBtn.getAttribute("href")!=="/feed") return;
  if(input.value.trim().length<2) return;
  go(ev);
});
input.addEventListener("keydown", function(ev){
  var opts=[].slice.call(box.querySelectorAll(".finder-opt"));
  if(ev.key==="Escape"){ paint([]); return; }
  if((ev.key==="ArrowDown"||ev.key==="ArrowUp") && opts.length){
    ev.preventDefault();
    var cur=opts.findIndex(function(a){ return a.getAttribute("aria-selected")==="true"; });
    var next=ev.key==="ArrowDown"?cur+1:cur-1;
    if(next<0) next=opts.length-1;
    if(next>=opts.length) next=0;
    active=next;
    opts.forEach(function(a,i){ a.setAttribute("aria-selected", i===next?"true":"false"); });
    input.setAttribute("aria-activedescendant", opts[next].id);
    return;
  }
  if(ev.key==="Enter") go(ev);
});
})();`;
}
