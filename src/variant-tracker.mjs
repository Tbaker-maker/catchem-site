// Master-set variant tracker. Every printing and finish on a set, vs holdings.
// Copy rules: no em/en dashes, listings counted, no NM on sealed, no advice.

import { expandMasterRows, setGaps } from "./smart-collection.mjs";
import { pageChrome as chrome } from "./ui.mjs";

function focusSlug(raw) {
  const slug = String(raw || "").trim().toLowerCase();
  return /^[a-z0-9-]+$/.test(slug) ? slug : "";
}

export function buildVariantTracker(setDoc, holdings) {
  const slug = focusSlug(setDoc?.slug);
  const owned = new Set(
    (Array.isArray(holdings) ? holdings : [])
      .filter((r) => r && /^tcgcsv-\d+$/.test(String(r.id || "")))
      .map((r) => String(r.id)),
  );
  const rows = expandMasterRows(setDoc, { sealedOnly: false }).map((row) => ({
    ...row,
    finish: row.printing || "Normal",
    owned: owned.has(row.id),
  }));
  const sealed = expandMasterRows(setDoc, { sealedOnly: true }).map((row) => ({
    ...row,
    finish: "",
    owned: owned.has(row.id),
  }));
  const gaps = setGaps(holdings, setDoc, { mode: "singles" });
  const sealedGaps = setGaps(holdings, setDoc, { mode: "sealed" });
  const finishes = [...new Set(rows.map((r) => r.finish).filter(Boolean))];
  const byFinish = finishes.map((finish) => {
    const list = rows.filter((r) => r.finish === finish);
    const have = list.filter((r) => r.owned).length;
    return {
      finish,
      total: list.length,
      have,
      missing: list.length - have,
      pct: list.length ? Math.round((have / list.length) * 1000) / 1000 : null,
    };
  });
  return {
    slug,
    name: setDoc?.name || slug,
    asOf: setDoc?.asOf || "",
    source: setDoc?.source || "TCGplayer market",
    rows,
    sealed,
    finishes: byFinish,
    singles: gaps,
    sealedGaps,
    href: slug ? `/variants?set=${encodeURIComponent(slug)}` : "/variants",
    setHref: slug ? `/sets/${encodeURIComponent(slug)}` : "/sets",
  };
}

export function variantSummaryLine(tracker) {
  if (!tracker || !tracker.singles) return "No set on file.";
  const g = tracker.singles;
  const pct = g.pct == null ? "-" : `${Math.round(g.pct * 1000) / 10}%`;
  return `${tracker.name}: ${g.have} of ${g.total} printings (${pct}). Cost to finish ${g.cost > 0 ? `$${g.cost.toFixed(2)}` : "not on file"}.`;
}

const VT_CSS = `.vt .rowcard{padding:14px;border-radius:18px;background:#1a1815;border:1px solid #2f2b26;margin:10px 0}.vt .finish{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.vt .chip{padding:8px 12px;border-radius:999px;border:1px solid #2f2b26;font:600 13px/1.2 var(--sans)}.vt table{width:100%;border-collapse:collapse}.vt td,.vt th{padding:8px 6px;text-align:left;border-bottom:1px solid #2f2b26;font:500 14px/1.3 var(--sans)}.vt .muted{opacity:.7}`;

export function renderVariants(stamp, opts = {}) {
  const focus = focusSlug(opts.set);
  const body = `<style>${VT_CSS}</style><main id="main" tabindex="-1" class="wrap vt"><h1>Variant tracker</h1>
<p class="muted">Master set view of every printing and finish. Owned rows come from My collection. Prices are TCGplayer market when on file.</p>
<label>Set slug<input id="set-slug" value="${focus}" placeholder="sv08-surging-sparks" autocomplete="off"></label>
<button type="button" id="load-set">Load set</button>
<p id="vt-note" class="muted"></p>
<section id="vt-summary" class="rowcard" hidden></section>
<section id="vt-finishes" class="rowcard" hidden><h2>Finishes</h2><div class="finish" id="finish-box"></div></section>
<section id="vt-rows" class="rowcard" hidden><h2>Printings</h2><div id="rows-box"></div></section>
<p><a class="tap quiet" href="/collection">My collection</a> <a class="tap quiet" id="set-link" href="/sets">Set page</a></p>
<script>
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){ if(c==="&") return "&"+"amp;"; if(c==="<") return "&"+"lt;"; if(c===">") return "&"+"gt;"; if(c==='"') return "&"+"quot;"; return "&"+"#39;"; }); }
function money(n){ return !(Number(n)>0)?"":"$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function localRows(){ try { var cur=JSON.parse(localStorage.getItem("catchem-collection")||"[]"); return Array.isArray(cur)?cur:[]; } catch(err){ return []; } }
function holdings(){
  return fetch("/api/me").then(function(r){ return r.ok?r.json():null; }).then(function(j){
    if(j&&Array.isArray(j.collection)) return j.collection;
    return localRows();
  }).catch(function(){ return localRows(); });
}
function paint(tracker){
  var note=document.getElementById("vt-note");
  var sum=document.getElementById("vt-summary");
  var fin=document.getElementById("vt-finishes");
  var rows=document.getElementById("vt-rows");
  var link=document.getElementById("set-link");
  if(!tracker||!tracker.slug){
    note.textContent="Pick a set slug to load every printing.";
    sum.hidden=true; fin.hidden=true; rows.hidden=true;
    return;
  }
  note.textContent=(tracker.source||"TCGplayer market")+(tracker.asOf?" · "+tracker.asOf:"");
  link.href=tracker.setHref||("/sets/"+tracker.slug);
  var g=tracker.singles||{};
  sum.hidden=false;
  sum.innerHTML="<h2>"+esc(tracker.name)+"</h2><p>"+esc(g.have)+" of "+esc(g.total)+" printings ("+(g.pct==null?"-":(Math.round(g.pct*1000)/10)+"%")+"). Cost to finish "+esc(money(g.cost)||"not on file")+" across "+esc(g.costPriced||0)+" priced gaps.</p>";
  fin.hidden=false;
  document.getElementById("finish-box").innerHTML=(tracker.finishes||[]).map(function(f){
    return "<span class=\\"chip\\">"+esc(f.finish)+": "+f.have+"/"+f.total+"</span>";
  }).join("")||"<p class=\\"muted\\">No finishes on file.</p>";
  rows.hidden=false;
  var html="<p><label><input type=\\"checkbox\\" id=\\"missing-only\\"> Missing only</label></p>";
  html+="<table><thead><tr><th>Owned</th><th>Card</th><th>Finish</th><th>Price</th></tr></thead><tbody>";
  (tracker.rows||[]).forEach(function(r){
    html+="<tr data-owned=\\""+(r.owned?"1":"0")+"\\"><td>"+(r.owned?"Yes":"No")+"</td><td><a href=\\""+esc(r.href)+"\\">"+esc(r.name)+"</a>"+(r.rarity?" <span class=\\"muted\\">"+esc(r.rarity)+"</span>":"")+"</td><td>"+esc(r.finish||"")+"</td><td>"+esc(money(r.price)||"not on file")+"</td></tr>";
  });
  html+="</tbody></table>";
  document.getElementById("rows-box").innerHTML=html;
  var box=document.getElementById("missing-only");
  if(box) box.onchange=function(){
    document.querySelectorAll("#rows-box tr[data-owned]").forEach(function(tr){
      tr.hidden = box.checked && tr.getAttribute("data-owned")==="1";
    });
  };
}
function load(){
  var slug=String(document.getElementById("set-slug").value||"").trim().toLowerCase();
  if(!/^[a-z0-9-]+$/.test(slug)){ paint(null); document.getElementById("vt-note").textContent="Enter a set slug like sv08-surging-sparks."; return; }
  try {
    var url=new URL(location.href); url.searchParams.set("set", slug); history.replaceState({}, "", url.pathname+"?"+url.searchParams.toString());
  } catch(err){}
  document.getElementById("vt-note").textContent="Loading.";
  Promise.all([
    fetch("/data/sets/"+encodeURIComponent(slug)+".json").then(function(r){ return r.ok?r.json():null; }),
    holdings()
  ]).then(function(pair){
    var doc=pair[0], holds=pair[1]||[];
    if(!doc){ paint(null); document.getElementById("vt-note").textContent="Set not on file."; return; }
    return fetch("/api/collection/variants",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({ setDoc:doc, holdings:holds })
    }).then(function(r){ return r.json(); }).then(function(j){
      if(j&&j.ok) paint(j.tracker); else { paint(null); document.getElementById("vt-note").textContent="Could not build tracker."; }
    });
  }).catch(function(){ paint(null); document.getElementById("vt-note").textContent="Could not load set."; });
}
document.getElementById("load-set").onclick=load;
if(document.getElementById("set-slug").value) load();
</script>`;
  return chrome("Variant tracker", body, "Variant tracker", stamp, "", true);
}

export async function handleVariantTracker(request) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Use POST." }), {
      status: 405,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
  try {
    const body = await request.json();
    const tracker = buildVariantTracker(body?.setDoc, body?.holdings);
    return new Response(JSON.stringify({ ok: true, tracker }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Bad variant request." }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
}
