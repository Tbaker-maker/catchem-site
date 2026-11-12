// Post Office sealed mode: booster boxes, ETBs, bundles, tins, blisters, and the rest of
// the sealed rows in search-lite. Price is the row's TCGplayer market price with the
// catalog date (counts.json), the same line Ideas and Write the post print. The picture
// is the passed cutout when there is one, else the product photo through /api/card-img.
// Sealed never carries a condition (no NM): a sealed product has one state.
// The browser side reuses the card flow: #preview, Download, sizes, the overlay hook,
// Ideas, and Write the post all read window.__ceSealed when sealed mode is on.
import { loadCatalogue, loadJson } from "./data.mjs";

export const SEALED_PATH = "/data/editor/" + "sealed-" + "rows.json";
export const SEALED_TYPES = ["Booster Box", "ETB", "Bundle", "Tin", "Blister", "Pack", "UPC", "Collection", "Case", "Other"];

const fold = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function sealedType(name) {
  const n = fold(name);
  if (/\bcases?\b/.test(n)) return "Case";
  if (/elite trainer box|\betb\b/.test(n)) return "ETB";
  if (/booster box|booster display/.test(n)) return "Booster Box";
  if (/\bbundle\b/.test(n)) return "Bundle";
  if (/\btins?\b/.test(n)) return "Tin";
  if (/blister/.test(n)) return "Blister";
  if (/ultra[- ]premium|\bupc\b/.test(n)) return "UPC";
  if (/\bpacks?\b|\bbooster\b/.test(n)) return "Pack";
  if (/collection|\bbox\b|\bkit\b|\bdeck\b/.test(n)) return "Collection";
  return "Other";
}

export function pidOf(id) {
  const m = String(id || "").match(/^tcgcsv-(\d+)$/);
  return m ? Number(m[1]) : 0;
}

export function cutoutMap(doc) {
  const map = new Map();
  for (const p of (doc && Array.isArray(doc.products) ? doc.products : [])) {
    if (!p || p.pass !== true || !p.file) continue;
    const file = String(p.file).replace(/^\/+/, "");
    if (!/^cutouts\/[A-Za-z0-9._-]+\.(webp|png)$/.test(file)) continue;
    const src = "/data/" + file;
    if (p.siteId) map.set(String(p.siteId), src);
    if (Number(p.tcgPlayerId) > 0) map.set("tcgcsv-" + Number(p.tcgPlayerId), src);
  }
  return map;
}


const ISO = /^\d{4}-\d{2}-\d{2}$/;

// Sourced US MSRP only: high or medium confidence, with a check date. Never estimate.
export function acceptMsrp(row) {
  if (!row || typeof row !== "object") return null;
  const usd = Number(row.msrpUsd);
  if (!(usd > 0)) return null;
  const conf = String(row.confidence || "").toLowerCase();
  if (conf !== "high" && conf !== "medium") return null;
  const date = String(row.dateChecked || "").slice(0, 10);
  if (!ISO.test(date)) return null;
  return { usd: Math.round(usd * 100) / 100, date };
}

// Published rip value is the file's average pull value, with its date. Missing EV or date stays off.
export function acceptRip(row, docAsOf) {
  if (!row || typeof row !== "object") return null;
  const ev = Number(row.contentsEV);
  if (!(ev > 0)) return null;
  const date = String(row.priceAsOf || docAsOf || "").slice(0, 10);
  if (!ISO.test(date)) return null;
  return { ev: Math.round(ev * 100) / 100, date };
}

function slugMaps(cutDoc, msrpDoc) {
  const slugToId = {};
  const idToSlug = {};
  const remember = (slug, id) => {
    const s = String(slug || "").trim();
    const key = String(id || "");
    if (!s || !key.startsWith("tcgcsv-")) return;
    if (!slugToId[s]) slugToId[s] = key;
    if (!idToSlug[key]) idToSlug[key] = s;
  };
  for (const p of (cutDoc && Array.isArray(cutDoc.products) ? cutDoc.products : [])) {
    if (!p) continue;
    const id = p.siteId ? String(p.siteId) : (Number(p.tcgPlayerId) > 0 ? "tcgcsv-" + Number(p.tcgPlayerId) : "");
    remember(p.id, id);
    remember(p.siteId, id);
  }
  const products = msrpDoc && msrpDoc.products && typeof msrpDoc.products === "object" ? msrpDoc.products : {};
  for (const [key, row] of Object.entries(products)) {
    const pid = Number(row && row.tcgPlayerId);
    if (pid > 0) remember(key, "tcgcsv-" + pid);
  }
  return { slugToId, idToSlug };
}

function ripIndex(ripDoc) {
  const byId = new Map();
  const asOf = ripDoc && ripDoc.asOf ? String(ripDoc.asOf).slice(0, 10) : "";
  for (const row of (ripDoc && Array.isArray(ripDoc.rows) ? ripDoc.rows : [])) {
    if (!row || !row.id) continue;
    const hit = acceptRip(row, asOf);
    if (hit) byId.set(String(row.id), hit);
  }
  return byId;
}

function msrpIndex(msrpDoc) {
  const byPid = new Map();
  const byKey = new Map();
  const products = msrpDoc && msrpDoc.products && typeof msrpDoc.products === "object" ? msrpDoc.products : {};
  for (const [key, row] of Object.entries(products)) {
    const hit = acceptMsrp(row);
    if (!hit) continue;
    byKey.set(key, hit);
    const pid = Number(row.tcgPlayerId);
    if (pid > 0 && !byPid.has(pid)) byPid.set(pid, hit);
  }
  return { byPid, byKey };
}

// extras[id] = { msrp, msrpDate, rip, ripDate, slug } only when a real number exists.
// slugs maps a product slug (swsh11-etb) onto the catalog tcgcsv id.
export function extrasById(lite, cutDoc, msrpDoc, ripDoc) {
  const { slugToId, idToSlug } = slugMaps(cutDoc, msrpDoc);
  const msrp = msrpIndex(msrpDoc);
  const rip = ripIndex(ripDoc);
  const extras = {};
  const slugs = { ...slugToId };
  for (const r of Array.isArray(lite) ? lite : []) {
    if (!Array.isArray(r) || r[5] !== "sealed") continue;
    const id = String(r[0] || "");
    const pid = pidOf(id);
    if (!pid) continue;
    const slug = idToSlug[id] || "";
    const m = msrp.byPid.get(pid) || (slug && msrp.byKey.get(slug)) || null;
    const ev = rip.get(id) || (slug && rip.get(slug)) || null;
    if (!m && !ev && !slug) continue;
    const extra = {};
    if (m) { extra.msrp = m.usd; extra.msrpDate = m.date; }
    if (ev) { extra.rip = ev.ev; extra.ripDate = ev.date; }
    if (slug) extra.slug = slug;
    extras[id] = extra;
  }
  return { extras, slugs };
}

export async function loadSealedSidecar(fetchImpl = fetch) {
  const load = async (fn) => { try { return await fn(); } catch { return null; } };
  const [cutDoc, msrpDoc, ripDoc] = await Promise.all([
    load(() => loadJson("sealed-cutouts.json", fetchImpl)),
    load(() => loadCatalogue("msrp-sourced.json", fetchImpl)),
    load(() => loadCatalogue("derived/rip-roi.json", fetchImpl)),
  ]);
  return { cutDoc, msrpDoc, ripDoc };
}

// Rows: [id, name, set, type, price, cutout, pid]. Priced rows first, highest first.
// A row with no price keeps 0 and shows "No market price on file", never a guess.
export function sealedRows(lite, cutDoc, asOf, msrpDoc, ripDoc) {
  const cuts = cutoutMap(cutDoc);
  const rows = [];
  for (const r of Array.isArray(lite) ? lite : []) {
    if (!Array.isArray(r) || r[5] !== "sealed") continue;
    const id = String(r[0] || "");
    const pid = pidOf(id);
    if (!pid || !r[1]) continue;
    const price = Number(r[6]);
    rows.push([id, String(r[1]), String(r[2] || ""), sealedType(r[1]), Number.isFinite(price) && price > 0 ? Math.round(price * 100) / 100 : 0, cuts.get(id) || "", pid]);
  }
  rows.sort((a, b) => (b[4] > 0) - (a[4] > 0) || b[4] - a[4] || (a[1] < b[1] ? -1 : 1));
  const types = {};
  for (const r of rows) types[r[3]] = (types[r[3]] || 0) + 1;
  const date = /^\d{4}-\d{2}-\d{2}/.test(String(asOf || "")) ? String(asOf).slice(0, 10) : "";
  const { extras, slugs } = extrasById(lite, cutDoc, msrpDoc, ripDoc);
  return { asOf: date, source: "TCGplayer market", types, rows, extras, slugs };
}

const TTL_MS = 30 * 60 * 1000;
let cache = null;
export function resetSealedCache() { cache = null; }

export async function sealedDocument(fetchImpl = fetch, now = Date.now()) {
  if (cache && now - cache.at < TTL_MS) return cache.body;
  const lite = await loadJson("search-lite.json", fetchImpl);
  if (!Array.isArray(lite) || !lite.length) throw new Error("search-lite");
  const [{ cutDoc, msrpDoc, ripDoc }, counts] = await Promise.all([
    loadSealedSidecar(fetchImpl),
    loadJson("counts.json", fetchImpl).catch(() => null),
  ]);
  const asOf = String(counts?.asOf || "");
  const body = JSON.stringify(sealedRows(lite, cutDoc, asOf, msrpDoc, ripDoc));
  cache = { body, at: now };
  return body;
}

export const SEALED_JS = `<script id="sealed-boot">
(function(){
  var PATH = ${JSON.stringify(SEALED_PATH)};
  var TYPES = ${JSON.stringify(SEALED_TYPES)};
  var MAX = 4;
  var on = false, doc = null, picks = [], type = "", q = "", ask = 0, loading = false;
  var M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function nice(d){ var p = String(d).split("-"); return p.length === 3 ? M[+p[1] - 1] + " " + (+p[2]) + ", " + p[0] : ""; }
  function money(v){ return "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  var phoneAsk = 12, deskAsk = 24;
  function cap(){ try { return window.matchMedia && window.matchMedia("(max-width: 767px)").matches ? phoneAsk : deskAsk; } catch (e) { return deskAsk; } }
  function rowOf(id){ var rows = doc && doc.rows || []; for (var i = 0; i < rows.length; i++) if (rows[i][0] === id) return rows[i]; return null; }
  function extraOf(id){ return doc && doc.extras && doc.extras[id] ? doc.extras[id] : null; }
  function priceText(r){
    var bits = [r && r[4] > 0 && doc && doc.asOf ? "TCGplayer market " + money(r[4]) + " · " + nice(doc.asOf) : "No market price on file"];
    var x = r ? extraOf(r[0]) : null;
    if (x && x.msrp > 0) bits.push("MSRP " + money(x.msrp));
    if (x && x.rip > 0 && x.ripDate) bits.push("Average pull value " + money(x.rip) + " · " + nice(x.ripDate));
    return bits.join(". ");
  }
  function photo(r){ return "/api/card-img?pid=" + r[6]; }
  function firstSrc(r){ return r[5] || photo(r); }
  window.__ceSealedPicFail = function(img){
    var alt = img.getAttribute("data-alt");
    if (alt && img.getAttribute("src") !== alt) { img.setAttribute("src", alt); return; }
    img.style.visibility = "hidden";
  };
  function imgTag(r, cls){
    return '<img class="' + cls + '" alt="' + esc(r[1]) + '" loading="lazy" decoding="async" src="' + esc(firstSrc(r)) + '" data-alt="' + esc(photo(r)) + '" onerror="__ceSealedPicFail(this)">';
  }
  function list(){
    var rows = doc && doc.rows || [];
    var needle = q.toLowerCase().split(/\\s+/).filter(Boolean);
    return rows.filter(function(r){
      if (type && r[3] !== type) return false;
      if (!needle.length) return true;
      var hay = (r[1] + " " + r[2]).toLowerCase();
      return needle.every(function(w){ return hay.indexOf(w) >= 0; });
    });
  }
  function paintTypes(){
    var box = $("sealed-types");
    if (!box || !doc) return;
    var counts = doc.types || {};
    var html = '<button type="button" class="' + (type ? "ghost" : "go") + '" data-stype="">All</button>';
    TYPES.forEach(function(t){
      if (!counts[t]) return;
      html += '<button type="button" class="' + (type === t ? "go" : "ghost") + '" data-stype="' + esc(t) + '">' + esc(t) + "</button>";
    });
    box.innerHTML = html;
  }
  function paintGrid(){
    var grid = $("sealed-grid");
    if (!grid) return;
    if (!doc) { grid.innerHTML = '<p class="note">' + (loading ? "Opening sealed products…" : "Sealed products did not load.") + "</p>"; return; }
    var hits = list();
    if (!ask) ask = cap();
    var shown = hits.slice(0, ask);
    $("sealed-count").textContent = hits.length.toLocaleString("en-US") + " sealed product" + (hits.length === 1 ? "" : "s") + (doc.asOf ? ". Prices: TCGplayer market, " + nice(doc.asOf) + "." : ".");
    grid.innerHTML = shown.map(function(r){
      var pin = picks.indexOf(r[0]) >= 0;
      return '<button type="button" class="card s-card' + (pin ? " pin" : "") + '" data-sid="' + esc(r[0]) + '" aria-pressed="' + (pin ? "true" : "false") + '">' +
        '<span class="s-pic">' + imgTag(r, "s-img") + "</span>" +
        '<span class="meta"><strong>' + esc(r[1]) + '</strong><span class="s-set">' + esc(r[2]) + " · " + esc(r[3]) + '</span><span class="s-price">' + esc(priceText(r)) + "</span></span></button>";
    }).join("") + (shown.length < hits.length ? '<button type="button" class="ghost s-more" data-smore="1">More</button>' : "") +
      (hits.length ? "" : '<p class="note">No sealed product matches that. Try a set name or a type.</p>');
  }
  function paintTray(){
    var tray = $("sealed-tray");
    var make = $("btn-compose");
    var live = $("preview") && $("preview").style.display === "block";
    if (make && on) { make.disabled = !picks.length; make.textContent = picks.length && live ? "Update the picture" : "Make the picture"; }
    if (!tray) return;
    if (!picks.length) { tray.innerHTML = '<span class="empty">Tap a sealed product to pin. Up to four. Order is the picture.</span>'; return; }
    tray.innerHTML = picks.map(function(id, i){
      var r = rowOf(id);
      if (!r) return "";
      return '<div class="slot"><button type="button" class="drop" data-sdrop="' + esc(id) + '" aria-label="Remove ' + esc(r[1]) + '">×</button>' + imgTag(r, "s-slot") + '<span class="pos">' + (i + 1) + "</span></div>";
    }).join("");
  }
  function paintAll(){ paintTypes(); paintGrid(); paintTray(); }
  function load(){
    if (doc || loading) return;
    loading = true;
    paintGrid();
    fetch(PATH).then(function(r){ return r.ok ? r.json() : null; }).then(function(d){
      loading = false;
      doc = d && Array.isArray(d.rows) ? d : null;
      paintAll();
    }).catch(function(){ loading = false; doc = null; paintGrid(); });
  }
  var bannerWas = "";
  function enter(){
    if (on) return;
    on = true;
    var vis = $("visuals");
    if (vis) vis.classList.add("ce-sealed");
    [].forEach.call($("media").querySelectorAll("button"), function(b){ b.className = b.hasAttribute("data-sealed") ? "go" : "ghost"; });
    var ban = $("banner");
    if (ban) { bannerWas = ban.textContent; ban.textContent = "Pick sealed products. We make a picture."; }
    var prev = $("preview");
    if (prev) { prev.removeAttribute("src"); prev.style.display = "none"; prev.dispatchEvent(new Event("load")); }
    if ($("compose-note")) $("compose-note").textContent = "";
    load();
    paintAll();
  }
  function leave(){
    if (!on) return;
    on = false;
    var vis = $("visuals");
    if (vis) vis.classList.remove("ce-sealed");
    var ban = $("banner");
    if (ban && bannerWas) ban.textContent = bannerWas;
    var prev = $("preview");
    if (prev) { prev.removeAttribute("src"); prev.style.display = "none"; prev.dispatchEvent(new Event("load")); }
    if ($("compose-note")) $("compose-note").textContent = "";
    if (typeof window.paintTray === "function") { try { window.paintTray(); } catch (e) {} }
  }
  function toggle(id){
    var at = picks.indexOf(id);
    var note = $("compose-note");
    if (at >= 0) picks.splice(at, 1);
    else if (picks.length >= MAX) { if (note) note.textContent = "Four is the most. Drop one first."; return; }
    else picks.push(id);
    if (note) note.textContent = "";
    paintGrid(); paintTray();
  }
  function markText(){
    try { if (typeof window.seatMark === "function") return window.seatMark(); } catch (e) {}
    var studio = false;
    try { studio = localStorage.getItem("ce-seat") === "studio"; } catch (e) {}
    if (!studio) return "CatchEmTCG.com";
    try { return (localStorage.getItem("ce-mark") || "").trim().slice(0, 28); } catch (e) { return ""; }
  }
  function studio(){ try { return localStorage.getItem("ce-seat") === "studio"; } catch (e) { return false; } }
  function loadPic(r, done){
    var urls = [r[5], photo(r)].filter(Boolean);
    var k = 0;
    function next(){
      if (k >= urls.length) { done(null); return; }
      var im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = function(){ done(im); };
      im.onerror = function(){ k++; next(); };
      im.src = urls[k];
    }
    next();
  }
  function wrap(g, text, maxW, maxLines){
    var words = String(text).split(/\\s+/), lines = [], line = "";
    words.forEach(function(w){
      var t = line ? line + " " + w : w;
      if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    });
    if (line) lines.push(line);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/\\s+\\S*$/, "") + "…"; }
    return lines;
  }
  function draw(sel, pics){
    var n = sel.length;
    var W = n === 1 ? 1080 : n === 2 ? 1400 : 1600;
    var H = n === 1 ? 1080 : 900;
    var c = document.createElement("canvas");
    c.width = W; c.height = H;
    var g = c.getContext("2d");
    g.imageSmoothingEnabled = true;
    if (g.imageSmoothingQuality) g.imageSmoothingQuality = "high";
    var bg = g.createRadialGradient(W / 2, H * 0.42, 40, W / 2, H * 0.42, Math.max(W, H) * 0.75);
    bg.addColorStop(0, "#26221d"); bg.addColorStop(1, "#0c0c0e");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    var pad = 48, gap = 36, capH = n === 1 ? 170 : 150, top = 96;
    var slotW = (W - pad * 2 - gap * (n - 1)) / n, slotH = H - top - capH - 40;
    g.fillStyle = "#c4baab";
    g.font = "600 22px 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif";
    g.textAlign = "left"; g.textBaseline = "top";
    g.fillText("SEALED · POKÉMON TCG", pad, 40);
    sel.forEach(function(r, k){
      var im = pics[k];
      var x = pad + k * (slotW + gap);
      var iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
      var s = Math.min(slotW / iw, slotH / ih);
      var dw = iw * s, dh = ih * s;
      var dx = x + (slotW - dw) / 2, dy = top + (slotH - dh);
      g.save();
      g.fillStyle = "rgba(0,0,0,0.45)";
      g.beginPath(); g.ellipse(x + slotW / 2, top + slotH + 6, dw * 0.46, 14, 0, 0, Math.PI * 2); g.fill();
      g.restore();
      g.drawImage(im, dx, dy, dw, dh);
      var cy = top + slotH + 34;
      g.fillStyle = "#efe9de";
      g.textAlign = "center";
      g.font = "600 " + (n === 1 ? 40 : n === 2 ? 34 : 28) + "px Fraunces, Georgia, 'Times New Roman', serif";
      var lines = wrap(g, r[1], slotW - 12, 2);
      lines.forEach(function(l, i){ g.fillText(l, x + slotW / 2, cy + i * (n === 1 ? 48 : 40)); });
      g.fillStyle = "#c4baab";
      g.font = (n === 1 ? 24 : 21) + "px 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif";
      g.fillText(r[2] + " · " + r[3], x + slotW / 2, cy + lines.length * (n === 1 ? 48 : 40) + 6);
    });
    var mark = markText();
    if (mark) {
      g.textAlign = "right"; g.textBaseline = "bottom";
      g.fillStyle = studio() ? "#efe9de" : "#7EB6FF";
      g.font = "600 22px 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif";
      g.fillText(mark, W - pad, H - 20);
    }
    return c;
  }
  function make(){
    var note = $("compose-note");
    var sel = picks.map(rowOf).filter(Boolean);
    if (!sel.length) { if (note) note.textContent = "Pick a sealed product first."; return; }
    if (note) note.textContent = "Making the picture…";
    var pics = new Array(sel.length), left = sel.length, missing = [];
    sel.forEach(function(r, k){
      loadPic(r, function(im){
        pics[k] = im;
        if (!im) missing.push(r[1]);
        if (--left) return;
        if (missing.length) { if (note) note.textContent = "No picture on file for " + missing.join(", ") + ". Drop it and pick another."; return; }
        var canvas = draw(sel, pics);
        var out = window.__ceOverlay ? window.__ceOverlay(canvas, sel.map(function(r){ return { id: r[0] }; })) : canvas;
        var png;
        try { png = out.toDataURL("image/png"); } catch (e) { if (note) note.textContent = "The picture did not save."; return; }
        var prev = $("preview");
        prev.src = png;
        prev.style.display = "block";
        prev.setAttribute("data-lay", "sealed-" + sel.length);
        if (typeof window.syncSeatRow === "function") { try { window.syncSeatRow(); } catch (e) {} }
        paintTray();
        if (note) note.textContent = studio()
          ? "Product photo, not a listing. Branding off."
          : "Product photo, not a listing. Catch'Em is on it. Remove branding takes it off, free.";
      });
    });
  }
  function resolveId(id){
    if (rowOf(id)) return id;
    if (doc && doc.slugs && doc.slugs[id]) return doc.slugs[id];
    var rows = doc && doc.rows || [];
    var needle = String(id || "").toLowerCase();
    for (var i = 0; i < rows.length; i++) if (String(rows[i][0]).toLowerCase() === needle) return rows[i][0];
    return "";
  }
  function prefill(ids){
    enter();
    if (!doc) return null;
    var found = [], names = [];
    (ids || []).forEach(function(id){
      var hit = resolveId(id);
      if (!hit || found.indexOf(hit) >= 0 || found.length >= MAX) return;
      found.push(hit);
      var r = rowOf(hit);
      if (r) names.push(r[1]);
    });
    picks = found;
    paintAll();
    return { ids: found, names: names };
  }
  window.__ceSealed = {
    on: function(){ return on; },
    ids: function(){ return picks.slice(0, MAX); },
    rows: function(){ return picks.map(rowOf).filter(Boolean); },
    ready: function(){ return !!doc; },
    prefill: prefill
  };
  function boot(){
    var media = $("media");
    if (!media || $("sealed-panel")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ghost";
    btn.setAttribute("data-sealed", "1");
    btn.textContent = "Sealed";
    media.insertBefore(btn, media.children[1] || null);
    media.addEventListener("click", function(e){
      if (e.target.closest("[data-sealed]")) { enter(); return; }
      if (e.target.closest("[data-med]")) leave();
    });
    var panel = document.createElement("div");
    panel.id = "sealed-panel";
    panel.innerHTML = '<input type="search" id="sealed-q" placeholder="Lost Origin · Evolving Skies ETB · 151 tin" autocomplete="off" enterkeyhint="search" aria-label="Search sealed products">' +
      '<p class="lab">TYPE</p><div id="sealed-types"></div>' +
      '<p id="sealed-count" class="note"></p><div id="sealed-grid"></div>';
    media.insertAdjacentElement("afterend", panel);
    var well = $("tray-well");
    if (well) {
      var st = document.createElement("div");
      st.id = "sealed-tray";
      var tray = $("tray");
      if (tray) tray.insertAdjacentElement("afterend", st); else well.appendChild(st);
    }
    panel.addEventListener("click", function(e){
      var t = e.target.closest("[data-stype]");
      if (t) { type = t.getAttribute("data-stype"); ask = 0; paintTypes(); paintGrid(); return; }
      if (e.target.closest("[data-smore]")) { ask = (ask || cap()) + cap(); paintGrid(); return; }
      var c = e.target.closest("[data-sid]");
      if (c) toggle(c.getAttribute("data-sid"));
    });
    $("sealed-q").addEventListener("input", function(e){ q = e.target.value || ""; ask = 0; paintGrid(); });
    if (well) well.addEventListener("click", function(e){
      var d = e.target.closest("[data-sdrop]");
      if (d) { toggle(d.getAttribute("data-sdrop")); }
    });
    var go = $("btn-compose");
    if (go) go.addEventListener("click", function(e){
      if (!on) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      make();
    }, true);
    var clear = $("btn-clear");
    if (clear) clear.addEventListener("click", function(e){
      if (!on) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      picks = [];
      var prev = $("preview");
      if (prev) { prev.removeAttribute("src"); prev.style.display = "none"; prev.dispatchEvent(new Event("load")); }
      if ($("compose-note")) $("compose-note").textContent = "";
      paintGrid(); paintTray();
    }, true);
    // Keep or remove branding redraws the sealed picture, like it does for cards.
    var redraw = 0;
    function again(){
      if (!on) return;
      var prev = $("preview");
      if (!prev || prev.style.display !== "block") return;
      clearTimeout(redraw);
      redraw = setTimeout(make, 60);
    }
    document.addEventListener("click", function(e){ if (e.target.closest("[data-seat]")) again(); }, true);
    if ($("studio-mark")) $("studio-mark").addEventListener("input", again);
    var css = document.createElement("style");
    css.id = "sealed-css";
    css.textContent = "#sealed-panel{display:none}#sealed-tray{display:none}" +
      "#visuals.ce-sealed #sealed-panel{display:block}#visuals.ce-sealed #sealed-tray{display:flex;flex-wrap:wrap;gap:8px}" +
      "#visuals.ce-sealed>:not(#banner):not(#media):not(#sealed-panel):not(#compose-dock){display:none!important}" +
      "#visuals.ce-sealed #tray,#visuals.ce-sealed #tray-fact,#visuals.ce-sealed #price-date{display:none!important}" +
      "#sealed-q{width:100%;box-sizing:border-box;min-height:44px;padding:0 12px;margin:4px 0 10px;font-size:16px}" +
      "#sealed-types{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;margin-bottom:6px}#sealed-types button{flex:0 0 auto;padding:0 14px;white-space:nowrap}" +
      "#sealed-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin:8px 0 16px}" +
      "@media(max-width:480px){#sealed-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}" +
      ".s-card{display:flex;flex-direction:column;align-items:stretch;text-align:left;padding:8px;background:#1a1815;border:1px solid #2f2b26;border-radius:12px;color:#efe9de;cursor:pointer;min-height:44px}" +
      ".s-card.pin{border-color:#d9b779;box-shadow:0 0 0 2px #d9b779 inset}" +
      ".s-pic{display:flex;align-items:center;justify-content:center;aspect-ratio:1/1;background:#12100e;border-radius:8px;overflow:hidden}" +
      ".s-img{max-width:92%;max-height:92%;object-fit:contain}" +
      ".s-card .meta{display:flex;flex-direction:column;gap:2px;margin-top:6px;font-size:13px;line-height:1.3}" +
      ".s-card strong{font-size:14px}.s-set{color:#c4baab}.s-price{color:#d9b779;font-weight:600}" +
      ".s-more{grid-column:1/-1}" +
      "#sealed-tray .slot{position:relative;width:84px;height:84px;background:#1a1815;border:1px solid #2f2b26;border-radius:10px;display:flex;align-items:center;justify-content:center}" +
      "#sealed-tray .s-slot{max-width:76px;max-height:76px;object-fit:contain}" +
      "#sealed-tray .drop{position:absolute;top:-8px;right:-8px;width:28px;height:28px;min-height:28px;border-radius:50%;padding:0}" +
      "#sealed-tray .pos{position:absolute;bottom:2px;left:6px;font-size:12px;color:#c4baab}";
    document.head.appendChild(css);
  }
  boot();
  setTimeout(boot, 0);
})();
</script>`;
