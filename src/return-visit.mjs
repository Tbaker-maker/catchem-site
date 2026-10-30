// Device-only return visit, watchlist, and trust lines.
// No account, no send, no invented price or date.
// A missing movers file yields an empty payload and the features stay quiet.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const VISIT_KEY = "catchem-visit-day";
export const WATCH_KEY = "catchem-product-watch";
export const HOOK_KEY = "catchem-alert-hooks";

export function isoDay(value) {
  const s = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

export function shiftDay(iso, days) {
  const d = isoDay(iso);
  if (!d || !Number.isFinite(days)) return "";
  return new Date(Date.parse(d + "T00:00:00Z") + days * 86400000).toISOString().slice(0, 10);
}

export function monthDay(iso) {
  const d = isoDay(iso);
  if (!d) return "";
  return MONTHS[Number(d.slice(5, 7)) - 1] + " " + Number(d.slice(8, 10));
}

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "\u0026amp;",
    "<": "\u0026lt;",
    ">": "\u0026gt;",
    '"': "\u0026quot;",
    "'": "&#39;",
  }[c]));
}

export function pointsOf(hist) {
  const out = [];
  const seen = new Set();
  for (const point of hist || []) {
    const day = isoDay(Array.isArray(point) ? point[0] : point && point.date);
    const price = Number(Array.isArray(point) ? point[1] : point && point.price);
    if (!day || !(price > 0) || seen.has(day)) continue;
    seen.add(day);
    const raw = Array.isArray(point) ? point[2] : point && point.listings;
    const row = { date: day, price };
    if (Number.isInteger(raw) && raw >= 0) row.listings = raw;
    out.push(row);
  }
  out.sort((a, b) => (a.date < b.date ? -1 : 1));
  return out;
}

function onOrBefore(points, day) {
  let hit = null;
  for (const point of points) {
    if (point.date <= day) hit = point;
    else break;
  }
  return hit;
}

function gapDays(a, b) {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}

// Median absolute day to day percent. Long holes are not one quiet day.
// Null means the history is too thin to call a normal swing.
export function typicalSwing(hist) {
  const pts = pointsOf(hist);
  const abs = [];
  for (let i = 1; i < pts.length; i++) {
    const gap = gapDays(pts[i - 1].date, pts[i].date);
    if (gap < 1 || gap > 3) continue;
    const prev = pts[i - 1].price;
    if (!(prev > 0)) continue;
    abs.push(Math.abs((pts[i].price - prev) / prev) * 100);
  }
  if (abs.length < 5) return null;
  abs.sort((a, b) => a - b);
  const mid = Math.floor(abs.length / 2);
  return abs.length % 2 ? abs[mid] : (abs[mid - 1] + abs[mid]) / 2;
}

// Percent from the price on fromDay to the price on toDay.
// The earlier price has to sit on that day or one of the two days before it.
// A flat one-decimal move is not a change.
export function priceMove(hist, fromDay, toDay) {
  const from = isoDay(fromDay);
  const to = isoDay(toDay);
  if (!from || !to || from > to) return null;
  const pts = pointsOf(hist);
  const start = onOrBefore(pts, from);
  const end = onOrBefore(pts, to);
  if (!start || !end) return null;
  if (gapDays(start.date, from) > 2) return null;
  if (gapDays(end.date, to) > 2) return null;
  if (end.date < start.date || !(start.price > 0)) return null;
  const pct = Math.round(((end.price - start.price) / start.price) * 1000) / 10;
  if (!Number.isFinite(pct) || pct === 0) return null;
  const move = { pct, from: start.date, to: end.date, fromPrice: start.price, toPrice: end.price };
  if (Number.isInteger(start.listings) && Number.isInteger(end.listings)) {
    move.listings = end.listings - start.listings;
  }
  return move;
}

function scoreOf(pct, swing) {
  const size = Math.abs(pct);
  if (!(size > 0) || swing == null) return null;
  if (swing === 0) return 1e9;
  return size / swing;
}

function productBits(row) {
  return {
    id: String(row.id || ""),
    name: String(row.name || "").replace(/\s+/g, " ").trim(),
    href: String(row.href || ""),
    kind: row.kind === "sealed" ? "sealed" : "single",
    source: row.source || "TCGplayer market",
  };
}

function ranked(rows, limit) {
  rows.sort((a, b) => (b.score - a.score) || (Math.abs(b.pct) - Math.abs(a.pct)) || a.name.localeCompare(b.name));
  return rows.slice(0, limit);
}

export function returnLines(products, lastVisit, asOf, limit = 5) {
  const visit = isoDay(lastVisit);
  const end = isoDay(asOf);
  if (!visit || !end || visit >= end) return [];
  const rows = [];
  for (const product of products || []) {
    if (!product || !product.name || !product.href) continue;
    const swing = typicalSwing(product.hist);
    const move = priceMove(product.hist, visit, end);
    const score = move ? scoreOf(move.pct, swing) : null;
    if (!move || score == null) continue;
    rows.push({ ...productBits(product), ...move, since: move.from, score });
  }
  return ranked(rows, limit);
}

export function weekLines(products, asOf, limit = 3) {
  const end = isoDay(asOf);
  const from = end ? shiftDay(end, -7) : "";
  if (!from) return [];
  const rows = [];
  for (const product of products || []) {
    if (!product || !product.name || !product.href) continue;
    const move = priceMove(product.hist, from, end);
    if (!move) continue;
    rows.push({ ...productBits(product), ...move, since: move.from, score: Math.abs(move.pct) });
  }
  return ranked(rows, limit);
}

export function formatLine(row) {
  if (!row || !row.name || !Number.isFinite(row.pct) || row.pct === 0) return "";
  const since = monthDay(row.since || row.from);
  if (!since) return "";
  const dir = row.pct > 0 ? "up" : "down";
  let line = `${row.name}: ${dir} ${Math.abs(row.pct).toFixed(1)}% since ${since}`;
  if (Number.isInteger(row.listings) && row.listings !== 0) {
    const way = row.listings > 0 ? "up" : "down";
    line += `, listings counted ${way} ${Math.abs(row.listings)}`;
  }
  return /[\u2014\u2013]/.test(line) ? "" : line;
}

export function howWeKnow({ source, date, listings, track } = {}) {
  const raw = String(source || "").replace(/[\u2014\u2013]/g, "").trim();
  let src = "";
  if (/eBay asks/i.test(raw)) src = "eBay asks";
  else if (/TCGplayer market/i.test(raw)) src = raw;
  const day = isoDay(date);
  if (!src || !day) return "";
  let line = `${src} price, ${monthDay(day)}`;
  if (Number.isInteger(listings) && listings >= 0) line += `. ${listings.toLocaleString("en-US")} listings counted`;
  const extra = String(track || "").replace(/\s+/g, " ").trim();
  if (extra && !/[\u2014\u2013]/.test(extra)) {
    const bit = /track record/i.test(extra) ? extra : `Track record: ${extra}`;
    line += `. ${bit.slice(0, 180)}`;
  }
  return /[\u2014\u2013]/.test(line) ? "" : line;
}

export function standoutFact(hist, asOf) {
  const end = isoDay(asOf);
  if (!end) return "";
  const move = priceMove(hist, shiftDay(end, -7), end);
  if (!move) return "";
  const dir = move.pct > 0 ? "up" : "down";
  return `${dir} ${Math.abs(move.pct).toFixed(1)}% since ${monthDay(move.from)}`;
}

function knownSource(source) {
  const raw = String(source || "");
  return /eBay asks/i.test(raw) || /TCGplayer market/i.test(raw);
}

function toPayload(row, asOf) {
  const text = formatLine(row);
  const know = howWeKnow({ source: row.source, date: row.to || asOf });
  if (!text || !know || !knownSource(row.source)) return null;
  return {
    id: row.id,
    name: row.name,
    href: row.href,
    kind: row.kind,
    text,
    know,
  };
}

function earliestDay(products) {
  let day = "";
  for (const product of products || []) {
    const pts = pointsOf(product.hist);
    if (pts.length && (!day || pts[0].date < day)) day = pts[0].date;
  }
  return day;
}

export function productsFromMovers(doc) {
  const asOf = isoDay(doc && doc.asOf);
  const seen = new Map();
  if (!asOf || !doc) return { asOf: "", products: [] };
  for (const key of ["sealed", "singles"]) {
    for (const row of doc[key] || []) {
      const id = String(row && row.id || "");
      const href = String(row && row.href || "");
      if (!/^tcgcsv-\d+$/.test(id) || !/^\/(c|p)\/tcgcsv-\d+$/.test(href) || seen.has(id)) continue;
      const hist = pointsOf(row.hist);
      if (hist.length < 2) continue;
      const name = String(row.name || "").replace(/\s+/g, " ").trim();
      if (!name) continue;
      seen.set(id, {
        id,
        name,
        href,
        kind: key === "sealed" ? "sealed" : "single",
        source: "TCGplayer market",
        price: Number(row.price) > 0 ? Number(row.price) : hist[hist.length - 1].price,
        hist: hist.map((point) => (point.listings != null ? [point.date, point.price, point.listings] : [point.date, point.price])),
      });
    }
  }
  return { asOf, products: [...seen.values()] };
}

export function buildVisitPayload(model, opts = {}) {
  const asOf = isoDay(model && model.asOf);
  const products = (model && model.products) || [];
  const empty = { asOf: asOf || "", source: "TCGplayer market", mode: "week", title: "", note: "", lines: [], suggestions: [] };
  if (!asOf || !products.length) return empty;
  const ids = (opts.ids || []).filter((id) => /^tcgcsv-\d+$/.test(id)).slice(0, 25);
  const wanted = new Set(ids);
  const pool = wanted.size ? products.filter((row) => wanted.has(row.id)) : products;
  const visit = isoDay(opts.since);
  let mode = "week";
  let title = "Biggest moves this week";
  let note = "";
  let rows = [];
  const cap = wanted.size || 0;
  if (!visit) {
    rows = weekLines(pool, asOf, cap || 3);
  } else if (visit >= asOf) {
    mode = "today";
    title = "Since your last visit";
    note = "No price change is on file since this morning.";
  } else {
    mode = "return";
    title = "Since your last visit";
    const start = earliestDay(products);
    if (start && visit < shiftDay(start, -2)) {
      note = `Price history on file starts ${monthDay(start)}, after ${monthDay(visit)}.`;
    } else {
      rows = returnLines(pool, visit, asOf, cap || 5);
      if (!rows.length) note = `No price change is on file since ${monthDay(visit)}.`;
    }
  }
  const suggestRows = weekLines(products.filter((row) => !wanted.has(row.id)), asOf);
  return {
    asOf,
    source: "TCGplayer market",
    mode,
    title,
    note,
    lines: rows.map((row) => toPayload(row, asOf)).filter(Boolean),
    suggestions: suggestRows.map((row) => toPayload(row, asOf)).filter(Boolean),
  };
}

export function alertHookDoc(items) {
  return {
    version: 1,
    send: false,
    endpoint: "",
    items: (items || []).slice(0, 25).map((row) => ({
      id: String(row.id || ""),
      name: String(row.name || ""),
      href: String(row.href || ""),
    })).filter((row) => /^tcgcsv-\d+$/.test(row.id)),
  };
}

export function receiptTap(text) {
  const t = String(text || "").trim();
  if (!t || /[\u2014\u2013]/.test(t)) return "";
  return `<span class="itap" tabindex="0" role="button" aria-label="How we know: ${esc(t)}"><span class="itap-i" aria-hidden="true">i</span><span class="itap-pop" role="tooltip">${esc(t)}</span></span>`;
}

function attr(s) {
  return esc(s);
}

export function returnActions(card, opts = {}) {
  const id = String(card && (card.id || card.sku) || "");
  if (!/^tcgcsv-\d+$/.test(id)) return "";
  const kind = card.kind === "sealed" ? "sealed" : "single";
  const href = (kind === "sealed" ? "/p/" : "/c/") + id;
  const name = String(card.name || "").replace(/\s+/g, " ").trim();
  const end = isoDay(opts.asOf || card.asOf);
  const series = opts.series || card.hist || [];
  const price = Number(opts.price) > 0 ? Number(opts.price) : 0;
  const sourceCode = /eBay asks/i.test(String(opts.source || "")) ? "ebay" : "tcg";
  const source = sourceCode === "ebay" ? "eBay asks" : "TCGplayer market";
  const fact = end && price > 0 ? standoutFact(series, end) : "";
  const know = price > 0 ? howWeKnow({ source, date: end, track: opts.track || "" }) : "";
  const pts = pointsOf(series).slice(-24).map((point) => point.date + ":" + point.price).join(",");
  const pid = id.slice("tcgcsv-".length);
  const img = "/api/card-img?pid=" + pid;
  const showPrice = price > 0 && know ? String(price) : "";
  return `<p class="rv-actions"><button type="button" class="rv-watch" data-rv-id="${attr(id)}" data-rv-name="${attr(name)}" data-rv-href="${attr(href)}" data-rv-kind="${kind}">Watch</button><button type="button" class="rv-share" data-rv-share="product" data-rv-name="${attr(name)}" data-rv-price="${attr(showPrice)}" data-rv-date="${attr(end)}" data-rv-fact="${attr(know ? fact : "")}" data-rv-source="${attr(sourceCode)}" data-rv-img="${attr(img)}" data-rv-pts="${attr(pts)}" data-rv-kind="${kind}">Share</button></p>`;
}

export function feedShareButton(asOf) {
  const day = isoDay(asOf);
  return `<p class="rv-share-row"><button type="button" id="rv-share" data-rv-share="feed" data-rv-name="The Feed" data-rv-date="${attr(day)}" data-rv-source="tcg">Share</button></p>`;
}

export function watchDocument() {
  return `<main id="main" tabindex="-1" class="wrap watch-page" data-rv-page="watch">
<h1>Watch</h1>
<p class="rv-empty" id="rv-empty">Nothing saved on this device yet.</p>
<p class="rv-invite" id="rv-invite">Tap Watch on a product, or start with one of these.</p>
<div id="rv-suggest" class="rv-cards" aria-busy="true"></div>
<h2 id="rv-changed-h" hidden>What changed</h2>
<div id="rv-changed" class="rv-cards"></div>
<div id="rv-quiet" class="rv-cards"></div>
</main>`;
}

export const RETURN_CSS = `.rv-actions{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0 4px}.rv-actions button,.rv-share-row button,.rv-card button{min-height:44px;padding:0 16px;border-radius:999px;border:1px solid #3a342c;background:#1c1916;color:#efe9de;font:600 15px/1 var(--sans,system-ui,sans-serif);cursor:pointer}.rv-actions button[aria-pressed=true],.rv-card button[aria-pressed=true]{background:#d9b779;color:#1a1407;border-color:#d9b779}.rv-share-row{margin:0 16px 12px}.rv-cards{display:grid;gap:12px;margin:12px 0 20px}.rv-card{display:grid;grid-template-columns:72px 1fr auto;gap:12px;align-items:center;padding:14px 16px;border-radius:22px;background:#1a1815;border:1px solid #2f2b26}.rv-card img{width:72px;height:72px;object-fit:contain;border-radius:16px;background:#221e1a}.rv-card a{color:inherit;text-decoration:none;font:600 17px/1.35 var(--serif,Georgia,serif)}.rv-card p{margin:4px 0 0;color:#c4baab;font:500 14px/1.45 var(--sans,system-ui,sans-serif)}.rv-empty,.rv-invite{color:#c4baab;margin:6px 0}.watch-page h1{margin:8px 0 12px;font:500 clamp(32px,5vw,44px)/1.1 var(--serif,Georgia,serif)}.rv-skel{height:72px;border-radius:22px;background:#1a1815}@media(max-width:700px){.rv-card{grid-template-columns:72px 1fr}.rv-card button{grid-column:1 / -1;justify-self:start}}`;

export const RETURN_BOOT = `(function(){
  var IDP=["tcg","csv","-"].join("");
  function idOk(id){ var s=String(id||""); return s.indexOf(IDP)===0 && /^\\d+$/.test(s.slice(IDP.length)); }
  var WATCH_KEY="catchem-product-watch";
  var HOOK_KEY="catchem-alert-hooks";
  var MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function readWatch(){
    try{ var cur=JSON.parse(localStorage.getItem(WATCH_KEY)||"[]"); return Array.isArray(cur)?cur.filter(function(row){return row&&idOk(row.id);}):[]; }
    catch(e){ return []; }
  }
  function writeWatch(rows){
    var next=rows.slice(0,25);
    try{ localStorage.setItem(WATCH_KEY, JSON.stringify(next)); }catch(e){}
    try{
      var hook={version:1,send:false,endpoint:"",items:next.map(function(row){return {id:row.id,name:row.name||"",href:row.href||""};})};
      localStorage.setItem(HOOK_KEY, JSON.stringify(hook));
    }catch(e){}
  }
  function paintButtons(){
    var rows=readWatch();
    var on={};
    rows.forEach(function(row){ on[row.id]=1; });
    document.querySelectorAll("button.rv-watch").forEach(function(btn){
      var id=btn.getAttribute("data-rv-id")||"";
      var saved=!!on[id];
      btn.setAttribute("aria-pressed", saved?"true":"false");
      btn.textContent=saved?"Watching":"Watch";
    });
  }
  function toggle(btn){
    var id=btn.getAttribute("data-rv-id")||"";
    if(!idOk(id)) return;
    var rows=readWatch().filter(function(row){return row.id!==id;});
    if(btn.getAttribute("aria-pressed")!=="true"){
      rows.unshift({id:id,name:btn.getAttribute("data-rv-name")||"",href:btn.getAttribute("data-rv-href")||"",kind:btn.getAttribute("data-rv-kind")||"",savedAt:new Date().toISOString()});
    }
    writeWatch(rows);
    paintButtons();
    if(document.getElementById("rv-changed")) loadWatch();
  }
  function monthDay(iso){
    if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(iso||"")) return "";
    return MONTHS[Number(iso.slice(5,7))-1]+" "+Number(iso.slice(8,10));
  }
  function money(n){
    var x=Number(n);
    if(!(x>0)) return "";
    return "$"+x.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  function round(g,x,y,w,h,r,fill){
    g.beginPath();
    g.moveTo(x+r,y);
    g.arcTo(x+w,y,x+w,y+h,r);
    g.arcTo(x+w,y+h,x,y+h,r);
    g.arcTo(x,y+h,x,y,r);
    g.arcTo(x,y,x+w,y,r);
    g.closePath();
    g.fillStyle=fill;
    g.fill();
  }
  function wrap(g,text,x,y,max,size,color){
    g.fillStyle=color;
    g.font="500 "+size+"px Georgia, serif";
    var words=String(text||"").split(" ");
    var line="";
    var drawn=0;
    words.forEach(function(word){
      if(drawn>=3) return;
      var next=line?line+" "+word:word;
      if(g.measureText(next).width>max && line){
        g.fillText(line,x,y);
        y+=size+8;
        drawn++;
        line=word;
      }else line=next;
    });
    if(line && drawn<3) g.fillText(line,x,y);
    return y+size+10;
  }
  function spark(g,pts,x,y,w,h){
    if(pts.length<2) return;
    var min=pts[0], max=pts[0];
    pts.forEach(function(p){ if(p<min) min=p; if(p>max) max=p; });
    var span=max-min||1;
    var step=(w-8)/(pts.length-1);
    g.beginPath();
    pts.forEach(function(p,i){
      var px=x+4+i*step;
      var py=y+h-8-((p-min)/span)*(h-16);
      if(i) g.lineTo(px,py); else g.moveTo(px,py);
    });
    g.strokeStyle="#d9b779";
    g.lineWidth=4;
    g.lineJoin="round";
    g.lineCap="round";
    g.stroke();
  }
  function finishCard(canvas){
    var link=document.createElement("a");
    link.href=canvas.toDataURL("image/png");
    link.download="catchem-share.png";
    link.click();
  }
  function drawShare(btn){
    var name=btn.getAttribute("data-rv-name")||"Catch'em";
    var price=money(btn.getAttribute("data-rv-price"));
    var date=monthDay(btn.getAttribute("data-rv-date")||"");
    var fact=btn.getAttribute("data-rv-fact")||"";
    var code=btn.getAttribute("data-rv-source")||"";
    var source=code==="tcg"?"TCGplayer market":code==="ebay"?"eBay asks":code;
    var imgSrc=btn.getAttribute("data-rv-img")||"";
    var pts=[];
    String(btn.getAttribute("data-rv-pts")||"").split(",").forEach(function(bit){
      var pair=bit.split(":");
      var v=Number(pair[1]);
      if(pair[0] && v>0) pts.push(v);
    });
    var canvas=document.createElement("canvas");
    canvas.width=1200; canvas.height=675;
    var g=canvas.getContext("2d");
    g.fillStyle="#12100e";
    g.fillRect(0,0,1200,675);
    round(g,28,28,1144,619,32,"#161410");
    g.fillStyle="#d9b779";
    g.font="600 32px Georgia, serif";
    g.fillText("Catch'em", 72, 96);
    if(date){
      g.fillStyle="#c4baab";
      g.font="500 24px system-ui, sans-serif";
      g.textAlign="right";
      g.fillText(date, 1100, 96);
      g.textAlign="left";
    }
    round(g,72,140,300,420,28,"#221e1a");
    function words(){
      var y=wrap(g,name,420,190,680,42,"#efe9de");
      if(price){
        g.fillStyle="#efe9de";
        g.font="600 64px Georgia, serif";
        g.fillText(price, 420, y+54);
        y+=78;
      }
      if(fact) y=wrap(g,fact,420,y+10,680,28,"#c4baab");
      spark(g,pts,420,470,640,110);
      if(source && date){
        g.fillStyle="#8f877a";
        g.font="500 20px system-ui, sans-serif";
        g.fillText(source+", "+date, 420, 620);
      }
      finishCard(canvas);
    }
    if(!imgSrc){ words(); return; }
    var img=new Image();
    img.onload=function(){
      var maxW=260, maxH=380;
      var scale=Math.min(maxW/img.width, maxH/img.height);
      var w=img.width*scale, h=img.height*scale;
      g.drawImage(img, 72+(300-w)/2, 140+(420-h)/2, w, h);
      words();
    };
    img.onerror=words;
    img.src=imgSrc;
  }
  function cardHtml(row, saved){
    var pid=String(row.id||"").replace(IDP,"");
    var face=/^\\d+$/.test(pid)?'<img alt="" width="72" height="72" src="/api/card-img?pid='+pid+'">':'<span></span>';
    var know=row.know?'<span class="itap" tabindex="0" role="button" aria-label="How we know: '+escapeHtml(row.know)+'"><span class="itap-i" aria-hidden="true">i</span><span class="itap-pop" role="tooltip">'+escapeHtml(row.know)+'</span></span>':'';
    return '<article class="rv-card">'+face+'<div><a href="'+escapeHtml(row.href||"#")+'">'+escapeHtml(row.name||"")+'</a><p>'+escapeHtml(row.text||"")+know+'</p></div><button type="button" class="rv-watch" data-rv-id="'+escapeHtml(row.id||"")+'" data-rv-name="'+escapeHtml(row.name||"")+'" data-rv-href="'+escapeHtml(row.href||"")+'" data-rv-kind="'+(row.kind==="sealed"?"sealed":"single")+'" aria-pressed="'+(saved?"true":"false")+'">'+(saved?"Watching":"Watch")+'</button></article>';
  }
  function escapeHtml(s){
    return String(s==null?"":s).replace(/[&<>"']/g,function(c){
      if(c==="&") return "&"+"amp;";
      if(c==="<") return "&"+"lt;";
      if(c===">") return "&"+"gt;";
      if(c==='"') return "&"+"quot;";
      return "&"+"#39;";
    });
  }
  function loadWatch(){
    var root=document.getElementById("rv-changed");
    if(!root) return;
    var rows=readWatch();
    var empty=document.getElementById("rv-empty");
    var invite=document.getElementById("rv-invite");
    var suggest=document.getElementById("rv-suggest");
    var head=document.getElementById("rv-changed-h");
    var quiet=document.getElementById("rv-quiet");
    var since="";
    try{ since=localStorage.getItem("catchem-visit-day")||""; }catch(e){}
    var ids=rows.map(function(row){return row.id;}).join(",");
    var url="/api/return-visit?watch=1"+(since?"&since="+encodeURIComponent(since):"")+(ids?"&ids="+encodeURIComponent(ids):"");
    fetch(url).then(function(res){return res.ok?res.json():null;}).catch(function(){return null;}).then(function(doc){
      if(suggest) suggest.removeAttribute("aria-busy");
      var lines=(doc&&doc.lines)||[];
      var ideas=(doc&&doc.suggestions)||[];
      var have={};
      lines.forEach(function(line){ have[line.id]=line; });
      if(!rows.length){
        if(empty) empty.hidden=false;
        if(invite) invite.hidden=false;
        if(head) head.hidden=true;
        root.innerHTML="";
        if(quiet) quiet.innerHTML="";
        if(suggest) suggest.innerHTML=ideas.map(function(row){return cardHtml(row,false);}).join("");
      }else{
        if(empty) empty.hidden=true;
        if(invite) invite.hidden=true;
        if(suggest) suggest.innerHTML="";
        if(head) head.hidden=!lines.length;
        root.innerHTML=lines.map(function(row){return cardHtml(row,true);}).join("");
        var rest=rows.filter(function(row){return !have[row.id];});
        if(quiet) quiet.innerHTML=rest.map(function(row){
          return cardHtml({id:row.id,name:row.name,href:row.href,kind:row.kind,text:"No change on file for this window.",know:""}, true);
        }).join("");
      }
      paintButtons();
    });
  }
  document.addEventListener("click", function(ev){
    var node=ev.target;
    if(!node||!node.closest) return;
    var watch=node.closest("button.rv-watch");
    if(watch){ ev.preventDefault(); toggle(watch); return; }
    var share=node.closest(".rv-share, #rv-share");
    if(share){ ev.preventDefault(); drawShare(share); }
  });
  paintButtons();
  loadWatch();
})();`;

export async function handleReturnVisit(url, fetchImpl) {
  let doc = null;
  try {
    const { loadJson } = await import("./data.mjs");
    doc = await loadJson("movers.json", fetchImpl);
  } catch {
    doc = null;
  }
  const since = isoDay(url.searchParams.get("since"));
  const ids = String(url.searchParams.get("ids") || "").split(",").map((id) => id.trim()).filter((id) => /^tcgcsv-\d+$/.test(id)).slice(0, 25);
  const body = buildVisitPayload(productsFromMovers(doc), { since, ids });
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
