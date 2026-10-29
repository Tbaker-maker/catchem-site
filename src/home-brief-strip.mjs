// Compact Morning Brief strip on the static home page.
// Uses published collection data already on the device. No data pulls.
// Copy rules: no em/en dashes, listings counted, no NM on sealed, no advice.

export const HOME_BRIEF_HIDE_KEY = "catchem-brief-home-hide";
export const HOME_BRIEF_MARK = 'id="home-brief-strip"';

const STRIP_CSS = `<style id="home-brief-strip-css">
.home-brief{display:none;margin:0 0 22px;padding:14px 16px;border-radius:18px;border:1px solid var(--line,#2f2b26);background:#1a1815}
.home-brief.is-on{display:block}
.home-brief .hb-row{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}
.home-brief .hb-copy{min-width:0;flex:1 1 180px}
.home-brief .hb-kicker{margin:0 0 4px;color:var(--gold,#d9b779);font:600 12px/1.2 var(--sans)}
.home-brief .hb-title{margin:0 0 6px;font:600 18px/1.3 var(--sans);color:var(--ink,#efe9de)}
.home-brief .hb-line{margin:0;color:var(--soft,#c4baab);font:500 14px/1.4 var(--sans)}
.home-brief .hb-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.home-brief a.hb-go,.home-brief button.hb-hide{min-height:44px;min-width:44px;padding:0 14px;border-radius:999px;font:600 14px/1 var(--sans);cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
.home-brief a.hb-go{background:var(--gold,#d9b779);color:#1a1407;border:0}
.home-brief button.hb-hide{background:transparent;border:1px solid var(--line,#2f2b26);color:var(--soft,#c4baab)}
@media (max-width:420px){.home-brief{padding:12px 12px}}
</style>`;

const STRIP_HTML = `<aside id="home-brief-strip" class="home-brief" hidden aria-live="polite">
<div class="hb-row">
  <div class="hb-copy">
    <p class="hb-kicker">Morning Brief</p>
    <p class="hb-title" id="hb-title"></p>
    <p class="hb-line" id="hb-line"></p>
  </div>
  <div class="hb-actions">
    <a class="hb-go" href="/collection">Open collection</a>
    <button type="button" class="hb-hide" id="hb-hide">Hide</button>
  </div>
</div>
</aside>`;

export function homeBriefStripSource() {
  return `(function(){
var KEY=${JSON.stringify(HOME_BRIEF_HIDE_KEY)};
function hidden(){ try { return localStorage.getItem(KEY)==="1"; } catch(e){ return false; } }
function setHidden(){ try { localStorage.setItem(KEY,"1"); } catch(e){} }
function rows(){ try { var cur=JSON.parse(localStorage.getItem("catchem-collection")||"[]"); return Array.isArray(cur)?cur:[]; } catch(e){ return []; } }
function goal(){ try { return String(localStorage.getItem("catchem-collection-goal")||"collecting"); } catch(e){ return "collecting"; } }
function prefs(){ try { var cur=JSON.parse(localStorage.getItem("catchem-brief-prefs")||"{}"); return { pinned:Array.isArray(cur.pinned)?cur.pinned:[], hidden:Array.isArray(cur.hidden)?cur.hidden:[] }; } catch(e){ return { pinned:[], hidden:[] }; } }
function money(n){ var x=Number(n); if(!(x>0)) return ""; return "$"+x.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function lineFor(sec){
  if(!sec) return "";
  if(sec.id==="moved" && sec.rows && sec.rows[0]){
    var r=sec.rows[0];
    return (r.name||"Item")+": "+(money(r.from)||"?")+" to "+(money(r.to)||"?")+" ("+(r.pct>0?"+":"")+r.pct+"%).";
  }
  if((sec.id==="gaps"||sec.id==="cost") && sec.closest){
    var c=sec.closest;
    return (c.name||"Set")+": "+(c.have||0)+" of "+(c.total||0)+". Cost to finish "+(money(c.cost)||"not on file")+".";
  }
  if((sec.id==="cheapest"||sec.id==="rarest") && sec.rows && sec.rows[0]){
    var g=sec.rows[0];
    return (g.name||"Card")+": "+(money(g.price)||"not on file")+".";
  }
  if(sec.id==="cashout" && sec.cashout && sec.cashout.gross>0){
    return "Gross "+(money(sec.cashout.gross))+". Modeled net "+(money(sec.cashout.net))+".";
  }
  if(sec.id==="liquidity" && sec.rows && sec.rows[0]){
    var l=sec.rows[0];
    return (l.name||"Item")+(l.listings!=null?": listings counted "+l.listings:"")+".";
  }
  if(sec.id==="demand" && sec.rows && sec.rows[0]){
    var d=sec.rows[0];
    return (d.name||"Item")+": 7D "+(d.change7>0?"+":"")+d.change7+"%.";
  }
  if(sec.id==="risk" && sec.risk && sec.risk.topShare!=null){
    return (sec.risk.topName||"Top item")+" is "+Math.round(sec.risk.topShare*100)+"% of value.";
  }
  if(sec.id==="reads" && sec.rows && sec.rows[0]){
    var rd=sec.rows[0];
    return (rd.name||"Card")+". "+String(rd.headline||"").slice(0,90);
  }
  return "";
}
function sectionHas(sec){
  if(!sec) return false;
  if(sec.rows && sec.rows.length) return true;
  if(sec.closest && sec.closest.total) return true;
  if(sec.cashout && sec.cashout.gross>0) return true;
  if(sec.risk && sec.risk.topShare!=null) return true;
  return false;
}
function paint(sec){
  var box=document.getElementById("home-brief-strip");
  if(!box) return;
  var title=document.getElementById("hb-title");
  var line=document.getElementById("hb-line");
  var text=lineFor(sec);
  if(!sec || !text){ box.hidden=true; box.classList.remove("is-on"); return; }
  if(title) title.textContent=sec.title||"Morning Brief";
  if(line) line.textContent=text;
  box.hidden=false; box.classList.add("is-on");
}
function boot(){
  var box=document.getElementById("home-brief-strip");
  if(!box) return;
  var hideBtn=document.getElementById("hb-hide");
  if(hideBtn) hideBtn.onclick=function(){ setHidden(); box.hidden=true; box.classList.remove("is-on"); };
  if(hidden()){ box.hidden=true; return; }
  var holdings=rows();
  if(!holdings.length){ box.hidden=true; return; }
  fetch("/api/collection/smart",{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({ holdings:holdings, goal:goal(), briefPrefs:prefs(), setDocs:[], reads:[], views:{}, prevHoldings:[] })
  }).then(function(r){ return r.json(); }).then(function(smart){
    if(!smart||!smart.ok||!smart.brief||!Array.isArray(smart.brief.sections)) return;
    var top=null;
    for(var i=0;i<smart.brief.sections.length;i++){
      if(sectionHas(smart.brief.sections[i]) && lineFor(smart.brief.sections[i])){ top=smart.brief.sections[i]; break; }
    }
    paint(top);
  }).catch(function(){});
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
})();`;
}

export function paintHomeBriefStrip(html) {
  const src = String(html || "");
  if (!src || src.includes(HOME_BRIEF_MARK)) return src;
  let out = src;
  if (!out.includes("home-brief-strip-css")) {
    out = out.includes("</head>")
      ? out.replace("</head>", STRIP_CSS + "</head>")
      : STRIP_CSS + out;
  }
  if (out.includes('<hr class="rule">')) {
    out = out.replace('<hr class="rule">', STRIP_HTML + '\n<hr class="rule">');
  } else if (out.includes("</header>")) {
    // after first main hero header close inside main is hard; fall back before main end
    out = out.replace("</main>", STRIP_HTML + "</main>");
  } else {
    out += STRIP_HTML;
  }
  const script = `<script>${homeBriefStripSource()}</script>`;
  if (out.includes("</body>")) out = out.replace("</body>", script + "</body>");
  else out += script;
  return out;
}
