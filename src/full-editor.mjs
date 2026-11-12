import { BUILD_SHA } from "./build-stamp.mjs";
import { rewriteOfficeFilters } from "./post-office-filters.mjs";
import { ensureAffiliation } from "./affiliation.mjs";
import { browserAssetUrl, fetchRepo } from "./data.mjs";
import { prefillBootTag } from "./office-path.mjs";
import { SEALED_JS } from "./office-sealed.mjs";

// The Post Office editor (Catchem-data research/assets/play.html).
// Card scans are proxied same-origin so the picture canvas can read them.

export const EDITOR_URL = browserAssetUrl("research/assets/play.html");
export const PAPER_URL = browserAssetUrl("research/assets/" + "paper-" + "rows.json");
export const POCKET_URL = browserAssetUrl("research/assets/" + "pocket-" + "rows.json");
export const PAPER_PATH = "/data/editor/" + "paper-" + "rows.json";
export const POCKET_PATH = "/data/editor/" + "pocket-" + "rows.json";

export const EXPORT_SIZES = [
  ["X", 1600, 900],
  ["Facebook", 1200, 630],
  ["Instagram", 1080, 1350],
  ["YouTube", 1280, 720],
];

const htmlCache = new Map();

export function setKey(name) {
  let t = String(name || "").toLowerCase().replace(/pokémon/g, "pokemon");
  const cut = t.lastIndexOf(":");
  if (cut >= 0) t = t.slice(cut + 1);
  t = t.replace(/&/g, " and ");
  t = t.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  return t;
}

const ERA = new Set(["sm", "xy", "bw", "dp", "hgss", "pop", "ex"]);
const DENY_STRIP = new Set(["base set", "base", "promos", "promo", "black star promos"]);

export function indexKeys(setName) {
  const key = setKey(setName);
  const keys = new Set([key]);
  const parts = key.split(" ");
  if (parts.length > 1 && ERA.has(parts[0])) {
    const rest = parts.slice(1).join(" ");
    if (rest && !DENY_STRIP.has(rest)) keys.add(rest);
  }
  return [...keys];
}

const SET_ALIAS = {
  "hidden fates shiny vault": ["shiny vault"],
  "shining fates shiny vault": ["shiny vault"],
  "expedition base set": ["expedition"],
  "crown zenith galarian gallery": ["galarian gallery"],
  "swsh black star promos": ["sword and shield promo cards"],
  "sm black star promos": ["sm promos"],
  "xy black star promos": ["xy promos"],
  "bw black star promos": ["black and white promos"],
  "dp black star promos": ["diamond and pearl promos"],
  "hgss black star promos": ["hgss promos"],
  "wizards black star promos": ["wotc promo"],
  "nintendo black star promos": ["nintendo promos"],
  "best of game": ["best of promos"],
  "sword and shield": ["sword and shield base set"],
  xy: ["xy base set"],
  "sun and moon": ["sm base set"],
};

export function lookupKeys(setName) {
  const key = setKey(setName);
  const keys = new Set([key]);
  if (key === "base") keys.add("base set");
  if (key === "151") keys.add("scarlet and violet 151");
  if (key.startsWith("hs ")) keys.add(key.slice(3));
  if (key.includes(" and ")) keys.add(key.replace(/ and /g, " "));
  const parts = key.split(" ");
  if (parts.length > 1 && ERA.has(parts[0])) {
    const rest = parts.slice(1).join(" ");
    if (rest && !DENY_STRIP.has(rest)) keys.add(rest);
  }
  for (const extra of SET_ALIAS[key] || []) keys.add(extra);
  return [...keys];
}

export function numOfId(id) {
  const tail = String(id || "").split("-").pop();
  if (/^[A-Za-z]+\d+$/.test(tail)) return tail.toUpperCase();
  if (/^\d+$/.test(tail)) return String(Number(tail));
  return "";
}

export function numOfPrinted(value) {
  const raw = String(value || "");
  const coded = raw.match(/^([A-Za-z]+\d+)\b/);
  if (coded) return coded[1].toUpperCase();
  const match = raw.match(/^(\d+)/);
  return match ? String(Number(match[1])) : "";
}

export function nameKey(name) {
    return String(name || "")
    .toLowerCase()
    .replace(/★/g, " star ")
    .replace(/δ/g, " delta ")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function scoreName(paper, lite) {
  if (!paper || !lite) return 0;
  if (paper === lite) return 5;
  if (lite.startsWith(paper + " ") || paper.startsWith(lite + " ")) return 4;
  if (lite.startsWith(paper) || paper.startsWith(lite)) return 3;
  const left = paper.split(" ");
  const right = lite.split(" ");
  if (left[0] && left[0] === right[0] && left[0].length > 3) {
    if (left[1] && right[1] && left[1] === right[1]) return 3;
    if (!left[1] || !right[1]) return 2;
  }
  return 0;
}

function pick(cands, name) {
  let best = 0;
  let ties = [];
  for (const cand of cands || []) {
    const score = scoreName(name, cand.name);
    if (score > best) {
      best = score;
      ties = [cand];
    } else if (score === best && score > 0) ties.push(cand);
  }
  if (best < 2 || !ties.length) return null;
  ties.sort((a, b) => Math.abs(a.name.length - name.length) - Math.abs(b.name.length - name.length) || b.price - a.price);
  return ties[0];
}

export function patchPaperRows(rows, lite) {
  const bySetNum = new Map();
  for (const row of lite || []) {
    if (!row || row[5] === "sealed") continue;
    const price = Number(row[6]);
    if (!Number.isFinite(price) || price <= 0) continue;
    const own = setKey(row[2]);
    const rec = { price, name: nameKey(row[1]), set: own, num: numOfPrinted(row[3]), id: row[0], exact: new Set([own]) };
    if (!rec.num) continue;
    for (const key of indexKeys(row[2])) {
      if (key === own) rec.exact.add(key);
      const bucket = key + "|" + rec.num;
      if (!bySetNum.has(bucket)) bySetNum.set(bucket, []);
      bySetNum.get(bucket).push(rec);
    }
  }
  let matched = 0;
  const out = (rows || []).map((row) => {
    const copy = row.slice();
    const name = nameKey(row[1]);
    const num = numOfId(row[0]);
    let found = null;
    if (num) {
      const exactPool = [];
      const aliasPool = [];
      for (const key of lookupKeys(row[2])) {
        const hit = bySetNum.get(key + "|" + num);
        if (!hit) continue;
        for (const cand of hit) (cand.exact.has(key) ? exactPool : aliasPool).push(cand);
      }
      found = pick(exactPool, name) || pick(aliasPool, name);
    }
    if (found) {
      copy[6] = Math.round(found.price * 100) / 100;
      copy[22] = found.id;
      if (copy.length > 18) copy[18] = 0;
      matched += 1;
    } else if (copy.length > 6) {
      copy[6] = 0;
      if (copy.length > 18) copy[18] = 0;
    }
    return copy;
  });
  return { rows: out, matched, total: out.length };
}

// Branding on the picture is free to keep or remove for everyone. No plan, price, or
// paywall copy ships in the editor (Tyler, Nov 11 2026). Runs after cleanOfficeCopy.
const BRANDING_COPY = [
  [">Premium · monetize</button>", ">Remove branding</button>"],
  ['data-seat="free">Free · fun</button>', 'data-seat="free">Keep branding</button>'],
  ["Free edit. Catch'Em stays on the picture. Premium ($9/mo) if you monetize.", "Catch'Em is on the picture. Remove branding any time, free."],
  ["Free is fun and wears Catch'Em. Premium takes Catch'Em off if you monetize. ", "Catch'Em branding is on by default and free to remove. "],
  ["<b>Free · fun</b>", "<b>Keep branding</b>"],
  [" The desk is yours. Monetize needs Premium.", " The desk is yours."],
  ["<b>Premium · $9/mo</b>", "<b>Remove branding</b>"],
  ["Monetize the file. Your mark or a clean file. Catch'Em comes off the edit. We bill when beta closes . unlock on this phone now.", "Your mark or a clean file. Catch'Em comes off the edit. Free for everyone."],
  ["Free is for fun. Premium is the paywall on the edit . not the scans.", "Branding is free to keep or remove."],
  ['("Premium. Mark: "', '("Branding off. Mark: "'],
  ["Free is for fun. The fact writes the picture, CatchEmTCG.com sits in the margin. Premium ($9/mo) takes Catch'Em off if you monetize the file.", "The fact writes the picture, CatchEmTCG.com sits in the margin. Remove branding takes it off, free."],
  ['"Premium edit. Catch\'Em is off. Blank mark = clean file."', '"Branding off. Catch\'Em is off. Blank mark = clean file."'],
  ["Fact sits under the card. Premium file. Long-press.", "Fact sits under the card. Branding off. Long-press."],
  ["Fact sits under the card. Catch'Em stays .  fun is free. Premium takes the mark off to monetize. Long-press.", "Fact sits under the card. Catch'Em is on it. Remove branding takes it off, free. Long-press."],
  ["how to (get paid|monetize|farm impressions)", "how to (get paid|monet[a-z]+|farm impressions)"],
  ["Refuse. Monetization-coaching posts are ineligible.", "Refuse. Payout-coaching posts are ineligible."],
];
export const PLAN_COPY = /premium|\$9\b|\/mo\b|monetiz|paywall|\bper month\b|a month\b/i;

export function freeBranding(html) {
  let out = String(html || "");
  for (const [from, to] of BRANDING_COPY) out = out.split(from).join(to);
  return out;
}

export function cleanOfficeCopy(html) {
  let out = String(html || "");
  out = out.replaceAll("Hold for the", "Press and keep for the");
  out = out.replaceAll("Hold to jump", "Press and keep to jump");
  out = out.replaceAll("Hold the card", "Look at the card");
  out = out.replaceAll("Hold the last card", "Keep the last card up");
  out = out.replaceAll(">Hold<", ">Stop<");
  out = out.replaceAll("Hold. ", "Stop. ");
  out = out.replaceAll("\u2014", ". ");
  out = out.replaceAll("\u2013", ". ");
  return out;
}

const SIZE_JS = `<script id="sizes-boot">
(function(){
  var sizes = ${JSON.stringify(EXPORT_SIZES)};
  function boot(){
    var dock = document.getElementById("compose-dock");
    if (!dock || document.getElementById("sizes")) return;
    var row = document.createElement("div");
    row.id = "sizes";
    row.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 14px";
    sizes.forEach(function(spec){
      var button = document.createElement("button");
      button.type = "button";
      button.className = "sec";
      button.textContent = spec[0] + " " + spec[1] + "x" + spec[2];
      button.onclick = function(){ saveSize(spec[0], spec[1], spec[2]); };
      row.appendChild(button);
    });
    var preview = document.getElementById("preview");
    if (preview && preview.parentNode === dock) preview.insertAdjacentElement("afterend", row);
    else dock.appendChild(row);
    var next = document.createElement("p");
    next.id = "next-step";
    next.className = "note";
    next.hidden = true;
    next.textContent = "Save the picture, then Post.";
    row.insertAdjacentElement("afterend", next);
    if (preview) {
      var showNext = function(){ if (preview.getAttribute("src") || preview.src) next.hidden = false; };
      preview.addEventListener("load", showNext);
      showNext();
    }
  }
  function saveSize(label, w, h){
    var shown = document.getElementById("preview");
    var stage = document.querySelector("#compose-dock canvas");
    function paint(im){
      var out = document.createElement("canvas");
      out.width = w; out.height = h;
      var g = out.getContext("2d");
      g.fillStyle = "#070910";
      g.fillRect(0, 0, w, h);
      var iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
      if (!iw || !ih) return;
      var scale = Math.max(w / iw, h / ih);
      var dw = Math.round(iw * scale), dh = Math.round(ih * scale);
      g.drawImage(im, Math.round((w - dw) / 2), Math.round((h - dh) / 2), dw, dh);
      out.toBlob(function(blob){
        if (!blob) return;
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "catchem-" + String(label).toLowerCase() + ".png";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, "image/png");
    }
    if (shown && shown.src && shown.src.indexOf("data:") === 0) {
      var im = new Image();
      im.onload = function(){ paint(im); };
      im.src = shown.src;
      return;
    }
    if (stage && stage.width > 2) { try { paint(stage); } catch (err) {} }
  }
  boot();
  setTimeout(boot, 0);
})();
</script>`;

// Download the picture, the price + chart overlay, and phone placement of the dock.
const SHARE_JS = `<script id="share-boot">
(function(){
  var OVERLAY_PATH = ${JSON.stringify("/post-office/api/overlay")};
  var GOLD = "#d9b779";
  var data = {};
  function $(id){ return document.getElementById(id); }
  function pinIds(){
    if (window.__ceSealed && window.__ceSealed.on()) return window.__ceSealed.ids();
    var list = window.pins || [];
    var out = [];
    for (var i = 0; i < list.length && out.length < 4; i++) {
      var c = list[i];
      var id = typeof c === "string" ? c : (c && (c.id || c.i)) || "";
      if (id && out.indexOf(String(id)) < 0) out.push(String(id));
    }
    return out;
  }
  function overlayOn(){ var box = $("ov-on"); return !!(box && box.checked); }
  function rebuild(){
    var prev = $("preview");
    if (prev && prev.style.display === "block" && $("btn-compose")) $("btn-compose").click();
  }
  function fetchOverlay(ids, done){
    var key = ids.join(",");
    if (!key) { done(); return; }
    if (ids.every(function(id){ return data[id] !== undefined; })) { done(); return; }
    fetch(OVERLAY_PATH + "?ids=" + encodeURIComponent(key), { credentials: "same-origin" })
      .then(function(r){ return r.json(); })
      .then(function(j){
        (j && j.cards || []).forEach(function(c){ data[c.id] = c; });
        ids.forEach(function(id){ if (data[id] === undefined) data[id] = null; });
        done();
      })
      .catch(function(){ ids.forEach(function(id){ if (data[id] === undefined) data[id] = null; }); done(); });
  }
  function money(v){ return "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  var M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function nice(d){ var p = String(d).split("-"); return M[+p[1] - 1] + " " + (+p[2]) + ", " + p[0]; }
  function curve(g, xy){
    g.moveTo(xy[0][0], xy[0][1]);
    for (var i = 0; i < xy.length - 1; i++) {
      var p0 = xy[i - 1] || xy[i], p1 = xy[i], p2 = xy[i + 1], p3 = xy[i + 2] || p2;
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      var lo = Math.min(p1[1], p2[1]), hi = Math.max(p1[1], p2[1]);
      c1y = Math.max(lo, Math.min(hi, c1y)); c2y = Math.max(lo, Math.min(hi, c2y));
      g.bezierCurveTo(c1x, c1y, c2x, c2y, p2[0], p2[1]);
    }
  }
  function drawRow(g, card, x, y, w, h){
    var pad = 18;
    g.fillStyle = "#efe9de";
    g.textAlign = "left";
    g.textBaseline = "top";
    g.font = "600 22px Georgia, 'Times New Roman', serif";
    var name = String(card.name || "");
    while (name.length > 4 && g.measureText(name).width > w * 0.42) name = name.slice(0, -2);
    if (name !== String(card.name || "")) name = name.replace(/\\s+\\S*$/, "") + "…";
    g.fillText(name, x + pad, y + 14);
    var m = String(card.price).match(/^TCGplayer market: (\\$[\\d,]+(?:\\.\\d+)?) \\((\\d{4}-\\d{2}-\\d{2})\\)$/);
    g.fillStyle = GOLD;
    g.font = "600 34px 'Helvetica Neue', Helvetica, Arial, sans-serif";
    g.fillText(m ? m[1] : "", x + pad, y + 44);
    g.fillStyle = "#c4baab";
    g.font = "15px 'Helvetica Neue', Helvetica, Arial, sans-serif";
    g.fillText("TCGplayer market, " + (m ? nice(m[2]) : ""), x + pad, y + 86);
    if (card.listings && card.listings.n >= 0 && card.listings.day) {
      g.fillText(Number(card.listings.n).toLocaleString("en-US") + " eBay listings counted, " + nice(card.listings.day), x + pad, y + 108);
    }
    var ch = card.chart;
    var cx = x + w * 0.48, cw = w * 0.52 - pad, cy = y + 18, chh = h - 58;
    if (!ch || !ch.points || ch.points.length < 2) {
      g.fillStyle = "#8f8b85";
      g.font = "14px 'Helvetica Neue', Helvetica, Arial, sans-serif";
      g.fillText("No 90-day series on file.", cx, cy + chh / 2 - 8);
      return;
    }
    var first = ch.points[0][0], lastDay = ch.points[ch.points.length - 1][0];
    var t0 = Date.parse(first + "T00:00:00Z"), t1 = Date.parse(lastDay + "T00:00:00Z");
    var lo = ch.domain[0], hi = ch.domain[1];
    function X(d){ return cx + (t1 > t0 ? (Date.parse(d + "T00:00:00Z") - t0) / (t1 - t0) : 1) * cw; }
    function Y(v){ return cy + (1 - (v - lo) / (hi - lo || 1)) * chh; }
    var xy = ch.points.map(function(p){ return [X(p[0]), Y(p[1])]; });
    var floor = cy + chh;
    var grad = g.createLinearGradient(0, cy, 0, floor);
    grad.addColorStop(0, "rgba(217,183,121,0.28)");
    grad.addColorStop(1, "rgba(217,183,121,0)");
    g.beginPath(); curve(g, xy); g.lineTo(xy[xy.length - 1][0], floor); g.lineTo(xy[0][0], floor); g.closePath();
    g.fillStyle = grad; g.fill();
    g.beginPath(); curve(g, xy);
    g.strokeStyle = GOLD; g.lineWidth = 2.5; g.lineCap = "round"; g.lineJoin = "round"; g.stroke();
    g.font = "13px 'Helvetica Neue', Helvetica, Arial, sans-serif";
    g.fillStyle = "#c4baab";
    g.textBaseline = "top";
    g.textAlign = "left";
    g.fillText(nice(first), cx, floor + 6);
    g.textAlign = "right";
    g.fillText(nice(lastDay) + " · last 90 days", cx + cw, floor + 6);
    [[ch.high, "High"], [ch.low, "Low"]].forEach(function(tag, i){
      if (i && tag[0][0] === ch.high[0] && tag[0][1] === ch.high[1]) return;
      var px = X(tag[0][0]), py = Y(tag[0][1]);
      g.beginPath(); g.arc(px, py, 4, 0, Math.PI * 2);
      g.fillStyle = i ? "#efe9de" : "#12100e"; g.fill();
      g.strokeStyle = "#efe9de"; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = "#efe9de";
      g.font = "600 12px 'Helvetica Neue', Helvetica, Arial, sans-serif";
      g.textAlign = px > cx + cw * 0.6 ? "right" : "left";
      g.textBaseline = i ? "top" : "bottom";
      var label = tag[1] + " " + money(tag[0][1]) + " · " + nice(tag[0][0]);
      g.fillText(label, px + (g.textAlign === "right" ? -8 : 8), py + (i ? 6 : -6));
    });
  }
  // Called from the picture's paintBoard with its finished canvas.
  window.__ceOverlay = function(canvas, sel){
    if (!overlayOn()) return canvas;
    var rows = (sel || []).map(function(c){ return data[c && c.id]; }).filter(function(c){ return c && c.price; });
    var note = $("ov-note");
    if (!rows.length) {
      if (note) note.textContent = (sel || []).some(function(c){ return data[c && c.id] === undefined; }) ? "Loading prices…" : "No TCGplayer market price on file for these picks.";
      return canvas;
    }
    if (note) note.textContent = "Price and chart: TCGplayer market, same date as the post text.";
    var rowH = 150;
    var out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = canvas.height + rowH * rows.length;
    var g = out.getContext("2d");
    g.drawImage(canvas, 0, 0);
    g.fillStyle = "#12100e";
    g.fillRect(0, canvas.height, out.width, rowH * rows.length);
    rows.forEach(function(card, k){
      var y = canvas.height + k * rowH;
      g.strokeStyle = "rgba(239,233,222,0.12)"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(18, y + 0.5); g.lineTo(out.width - 18, y + 0.5); g.stroke();
      drawRow(g, card, 0, y, out.width, rowH);
    });
    return out;
  };
  function fname(){
    var ids = pinIds();
    return "catchem-" + (ids.length ? ids.join("-").replace(/[^A-Za-z0-9-]/g, "").slice(0, 60) : "picture") + ".png";
  }
  function download(){
    var prev = $("preview");
    var src = prev && prev.getAttribute("src");
    if (!src) return;
    var a = document.createElement("a");
    a.href = src;
    a.download = fname();
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  function boot(){
    var dock = $("compose-dock");
    var prev = $("preview");
    if (!dock || !prev || $("share-row")) return;
    var opt = document.createElement("label");
    opt.id = "ov-opt";
    opt.style.cssText = "display:flex;align-items:center;gap:10px;min-height:44px;margin:4px 0";
    opt.innerHTML = '<input type="checkbox" id="ov-on" style="width:22px;height:22px"> <span>Price, date, and 90-day chart on the picture</span>';
    var note = document.createElement("p");
    note.id = "ov-note";
    note.className = "note";
    var row = document.createElement("div");
    row.id = "share-row";
    row.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin:8px 0";
    var dl = document.createElement("button");
    dl.type = "button";
    dl.className = "go";
    dl.id = "go-download";
    dl.textContent = "Download";
    dl.disabled = true;
    dl.onclick = download;
    row.appendChild(dl);
    prev.insertAdjacentElement("beforebegin", opt);
    opt.insertAdjacentElement("afterend", note);
    prev.insertAdjacentElement("afterend", row);
    var sync = function(){ var has = !!prev.getAttribute("src"); dl.disabled = !has; dock.classList.toggle("dock-empty", !has); };
    prev.addEventListener("load", sync);
    sync();
    $("ov-on").onchange = function(){
      if (!overlayOn()) { note.textContent = ""; rebuild(); return; }
      var ids = pinIds();
      if (!ids.length) { note.textContent = "Pin a card or a sealed product first."; return; }
      note.textContent = "Loading prices…";
      fetchOverlay(ids, rebuild);
    };
    var make = $("btn-compose");
    if (make) make.addEventListener("click", function(){
      if (!overlayOn()) return;
      var ids = pinIds();
      if (ids.some(function(id){ return data[id] === undefined; })) fetchOverlay(ids, rebuild);
    }, true);
  }
  // Phone: the tray, Make the picture, and the preview sit under the title, above the filters.
  function phone(){
    var dock = $("compose-dock");
    var banner = $("banner");
    if (!dock || !banner || !window.matchMedia) return;
    var mq = window.matchMedia("(max-width: 899px)");
    var home = document.createComment("compose-dock-home");
    dock.parentNode.insertBefore(home, dock);
    function place(){
      if (mq.matches) { if (banner.nextSibling !== dock) banner.insertAdjacentElement("afterend", dock); dock.classList.add("dock-top"); }
      else if (home.parentNode && home.nextSibling !== dock) { home.parentNode.insertBefore(dock, home.nextSibling); dock.classList.remove("dock-top"); }
    }
    place();
    if (mq.addEventListener) mq.addEventListener("change", place);
    // Pins are made further down, so a slim bar keeps Make the picture one tap away.
    var make = $("btn-compose");
    if (!make || $("phone-make")) return;
    var bar = document.createElement("div");
    bar.id = "phone-make";
    bar.hidden = true;
    bar.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:20;padding:8px 16px calc(8px + env(safe-area-inset-bottom));background:#12100e;border-top:1px solid #2f2b26";
    var go = document.createElement("button");
    go.type = "button";
    go.className = "go";
    go.style.cssText = "width:100%;min-height:48px";
    go.onclick = function(){ make.click(); dock.scrollIntoView({ block: "start", behavior: "smooth" }); };
    bar.appendChild(go);
    document.body.appendChild(bar);
    var seen = true;
    function paint(){
      var n = pinIds().length;
      go.textContent = "Make the picture (" + n + ")";
      bar.hidden = !(mq.matches && n > 0 && !seen);
    }
    if (window.IntersectionObserver) {
      new IntersectionObserver(function(list){ seen = list[0].isIntersecting; paint(); }).observe(make);
    }
    document.addEventListener("click", function(){ setTimeout(paint, 0); }, true);
    paint();
  }
  boot();
  phone();
})();
</script>`;

const AI_JS = `<script id="ai-boot">
(function(){
  var tone = "informative";
  var seat = null;
  var signInHref = "/auth/discord?next=/post-office";
  function boot(){
    var dock = document.getElementById("compose-dock");
    if (!dock || document.getElementById("ai-panel")) return;
    var panel = document.createElement("div");
    panel.id = "ai-panel";
    panel.style.cssText = "margin:12px 0 20px;padding:12px;border:1px solid #3a3428;border-radius:12px";
    var anchor = document.getElementById("next-step") || document.getElementById("sizes");
    if (anchor && anchor.parentNode === dock) anchor.insertAdjacentElement("afterend", panel);
    else dock.appendChild(panel);
    load(panel);
  }
  function ids(){
    if (window.__ceSealed && window.__ceSealed.on()) return window.__ceSealed.ids();
    var tray = (window.tray && window.tray.length) ? window.tray : (window.pins || []);
    var out = [];
    for (var i = 0; i < tray.length && out.length < 4; i++) {
      var c = tray[i] || {};
      var id = typeof c === "string" ? c : (c.cid || "");
      if (!id && String(c.i || "").indexOf("tcgp-") === 0) id = c.i;
      if (!id && c && c.i) id = String(c.i);
      if (id && out.indexOf(id) < 0) out.push(id);
    }
    return out;
  }
  function showLine(panel, text, href){
    panel.innerHTML = "";
    var p = document.createElement("p");
    p.id = "ai-line";
    p.style.cssText = "margin:0;color:#d9c7a2";
    var line = String(text || "");
    if (href && line.indexOf("Sign in with Discord") === 0) {
      var a = document.createElement("a");
      a.href = href;
      a.textContent = "Sign in with Discord";
      p.appendChild(a);
      p.appendChild(document.createTextNode(line.slice("Sign in with Discord".length)));
    } else {
      p.textContent = line;
    }
    panel.appendChild(p);
  }
  function quotaText(view){
    var bits = [];
    if (view && view.ideas) bits.push("Ideas left today: " + view.ideas.left);
    if (view && view.post) bits.push("Post text left today: " + view.post.left);
    return bits.join(". ") + ".";
  }
  function controls(panel, view){
    seat = view;
    panel.innerHTML = "";
    var quota = document.createElement("p");
    quota.id = "ai-quota";
    quota.style.cssText = "margin:0 0 8px;color:#d9c7a2";
    quota.textContent = quotaText(view);
    panel.appendChild(quota);
    var idea = document.createElement("button");
    idea.type = "button";
    idea.className = "sec";
    idea.id = "go-idea";
    idea.textContent = "Ideas";
    idea.onclick = function(){ ask(panel, "/api/ideas"); };
    panel.appendChild(idea);
    var tones = document.createElement("div");
    tones.id = "ai-tones";
    tones.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin:8px 0";
    ["informative", "hype", "chill", "funny"].forEach(function(name){
      var b = document.createElement("button");
      b.type = "button";
      b.className = "sec";
      b.setAttribute("data-tone", name);
      b.textContent = name.charAt(0).toUpperCase() + name.slice(1);
      b.setAttribute("aria-pressed", name === tone ? "true" : "false");
      b.onclick = function(){
        tone = name;
        tones.querySelectorAll("button").forEach(function(n){
          n.setAttribute("aria-pressed", n.getAttribute("data-tone") === tone ? "true" : "false");
        });
      };
      tones.appendChild(b);
    });
    panel.appendChild(tones);
    var write = document.createElement("button");
    write.type = "button";
    write.className = "go";
    write.id = "go-text";
    write.textContent = "Write the post";
    write.onclick = function(){ ask(panel, "/api/post-text"); };
    panel.appendChild(write);
    var out = document.createElement("div");
    out.id = "ai-out";
    panel.appendChild(out);
  }
  function copy(text, button){
    var done = function(){ button.textContent = "Copied"; };
    function fallback(){
      var ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (err) {}
      ta.remove();
      done();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else fallback();
  }
  function showLines(lines){
    var out = document.getElementById("ai-out");
    if (!out) return;
    out.innerHTML = "";
    var all = [];
    lines.forEach(function(text){
      all.push(text);
      var p = document.createElement("p");
      p.textContent = text;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "sec";
      b.textContent = "Copy text";
      b.onclick = function(){ copy(text, b); };
      var x = document.createElement("a");
      x.className = "sec ai-x";
      x.href = "https://x.com/intent/post?text=" + encodeURIComponent(text);
      x.target = "_blank";
      x.rel = "noopener";
      x.textContent = "Post to X";
      x.style.cssText = "display:inline-flex;align-items:center;min-height:44px;padding:0 14px;margin-left:8px;text-decoration:none;background:#1a1815;color:#efe9de;border:1px solid #403a33;border-radius:10px;font:600 14px/1 'IBM Plex Sans',system-ui,sans-serif";
      out.appendChild(p);
      out.appendChild(b);
      out.appendChild(x);
    });
    var every = document.createElement("button");
    every.type = "button";
    every.id = "go-copy";
    every.className = "sec";
    every.textContent = "Copy all text";
    every.onclick = function(){ copy(all.join("\\n\\n"), every); };
    out.appendChild(every);
  }
  function ask(panel, path){
    var picked = ids();
    var out = document.getElementById("ai-out");
    if (!picked.length) {
      if (out) out.textContent = "Pick a card or a sealed product from the live catalog first.";
      return;
    }
    if (out) out.textContent = "Working…";
    fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: picked, tone: tone, platform: "x" })
    }).then(function(res){
      return res.json().then(function(data){ return { status: res.status, data: data || {} }; });
    }).then(function(pack){
      var data = pack.data;
      if (pack.status === 401 || pack.status === 403) {
        showLine(panel, data.line || "Ideas need Discord sign-in. Ideas are 3 a day. Discord sign-in is not turned on yet.", pack.status === 401 && data.ready ? signInHref : "");
        return;
      }
      if (data.card && !data.ideas && !data.variations) {
        if (out) out.textContent = (data.card.title ? data.card.title + ". " : "") + (data.card.body || "");
        return;
      }
      var lines = data.ideas || data.variations || [];
      if (!lines.length) {
        if (out) out.textContent = data.error || "Nothing came back.";
        return;
      }
      showLines(lines);
      if (data.quota) {
        if (!seat) seat = {};
        if (path.indexOf("post-text") >= 0) seat.post = data.quota;
        else seat.ideas = data.quota;
        var quota = document.getElementById("ai-quota");
        if (quota) quota.textContent = quotaText(seat);
      }
    }).catch(function(){
      if (out) out.textContent = "Ideas did not load.";
    });
  }
  function load(panel){
    fetch("/api/session").then(function(r){ return r.json(); }).then(function(view){
      if (!view || !view.signedIn || view.open === false) {
        var line = (view && view.line) || "Ideas need Discord sign-in. Ideas are 3 a day. Discord sign-in is not turned on yet.";
        showLine(panel, line, view && view.open !== false && view.ready ? signInHref : "");
      } else {
        controls(panel, view);
      }
    }).catch(function(){
      showLine(panel, "Ideas did not load.", false);
    });
  }
  boot();
  setTimeout(boot, 0);
})();
</script>`;

function escStamp(value) {
  return String(value || "")
    .split("&").join("&amp;")
    .split("<").join("&lt;")
    .split(">").join("&gt;")
    .split('"').join("&quot;");
}

function stripMarketPrompts(html) {
  let out = String(html || "");
  const sellChip = '<button class="chip" data-i="sell">' + ["Sell", "ing"].join("") + "</button>";
  out = out.split(sellChip).join("");
  const buyLine = 'add("question", "' + ["Would you", "still", "buy"].join(" ") + ' the " + first.s + " " + first.n + " today?");';
  out = out.split(buyLine).join("");
  out = out.split('"' + ["For", "sale"].join(" ") + '"').join('""');
  out = out.split('"<b>' + ["We will not make a", "sell", "image for singles."].join(" ") + '</b><br>"').join('""');
  out = out.split('"' + "The whole question on a single is condition, and a " + ["buyer", "needs"].join(" ") + ' to see the card you are actually sending. "').join('""');
  return out;
}

const SITE_SKIN = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style id="site-skin">
:root{--r-xs:6px;--r-sm:10px;--r-md:14px;--r-lg:20px;--r-pill:999px;--r-card:4.8%/3.4%}
img,svg,canvas,video,iframe{border-radius:var(--r-xs)}iframe,table{border-radius:var(--r-md)}input,select,textarea,button{border-radius:var(--r-sm)}dialog{border-radius:var(--r-lg)}.dock{border-radius:var(--r-lg) var(--r-lg) 0 0}img.card-face,.card-face{border-radius:var(--r-card)!important}
:root{
  --paper:#12100e;--sheet:#1a1815;--ink:#efe9de;--mute:#c4baab;
  --line:#2f2b26;--accent:#d9b779;--accent-ink:#1a1407;
  --font:"IBM Plex Sans",system-ui,sans-serif;
}
html,body{background:#12100e;color:#efe9de;font:400 16px/1.5 "IBM Plex Sans",system-ui,sans-serif}
a{color:#d9b779}
body>header{display:none}
main{max-width:1040px;padding:18px 16px calc(28px + env(safe-area-inset-bottom))}
.banner{font:500 28px/1.15 Fraunces,Georgia,serif;letter-spacing:-.02em;color:#efe9de;border-bottom:1px solid #2f2b26}
.media button,.rail button,.chip,.ghost,#q-hints button,#pairs button,nav button,.arr,button.sec{
  background:#1a1815;color:#efe9de;border:1px solid #403a33;border-radius:10px;
  font:600 14px/1 "IBM Plex Sans",system-ui,sans-serif;min-height:44px;
}
.media button.go,.go,.rail button.on,.chip.on,nav button.on,#q-hints button.fix,#pairs button.on{
  background:#d9b779;color:#1a1407;border-color:transparent;border-radius:10px;
}
.ghost,.media button.ghost{background:#1a1815;color:#efe9de;border:1px solid #403a33}
textarea,input[type="search"],.tiny{background:#12100e;color:#efe9de;border:1px solid #403a33;border-radius:10px;font-family:"IBM Plex Sans",system-ui,sans-serif}
button:focus-visible,a:focus-visible,textarea:focus-visible,input:focus-visible{outline:2px solid #d9b779}
@media(max-width:389px){.banner{font-size:22px}}
@media(max-height:800px){#banner{display:block}}
</style>`;

function siteSkin(html) {
  const out = String(html || "");
  if (!out.includes("Pin two cards. We make a picture.") || out.includes('id="site-skin"')) return out;
  return out.includes("</head>") ? out.replace("</head>", SITE_SKIN + "</head>") : SITE_SKIN + out;
}

function rewritePlayAssets(html) {
  let out = String(html || "");
  const assetFn = [
    "    function assetUrl(path) {",
    "      var p = String(path || \"\");",
    "      if (/^https?:\\/\\//i.test(p)) return p;",
    "      if (p.charAt(0) === \"/\") p = p.slice(1);",
    "      try { return new URL(p, document.baseURI).toString(); } catch (e) { return \"/\" + p; }",
    "    }",
  ].join("\n");
  const assetNext = [
    "    function assetUrl(path) {",
    "      var p = String(path || \"\");",
    "      if (/^https?:\\/\\//i.test(p)) return p;",
    "      if (p.charAt(0) === \"/\") p = p.slice(1);",
    "      var cut = p.indexOf(\"#\");",
    "      if (cut >= 0) p = p.slice(0, cut);",
    "      return " + JSON.stringify(browserAssetUrl("research/assets/")) + " + p;",
    "    }",
  ].join("\n");
  if (out.includes(assetFn)) out = out.split(assetFn).join(assetNext);
  const tcgFn = [
    "    function tcgImg(path, hi) {",
    "      var m = String(path || \"\").match(/^\\/(?:img|thumb)\\/([^/]+)\\/([^/?#]+)/);",
    "      if (!m) return path;",
    "      return \"https://images.pokemontcg.io/\" + m[1] + \"/\" + m[2] + (hi ? \"_hires.png\" : \".png\");",
    "    }",
  ].join("\n");
  const tcgNext = [
    "    function tcgImg(path, hi) {",
    "      var m = String(path || \"\").match(/^\\/(?:img|thumb)\\/([^/]+)\\/([^/?#]+)/);",
    "      if (!m) return path;",
    "      return \"/data/editor/tcg/\" + m[1] + \"/\" + m[2] + (hi ? \"_hires.png\" : \".png\");",
    "    }",
  ].join("\n");
  if (out.includes(tcgFn)) out = out.split(tcgFn).join(tcgNext);
  const fetchFn = [
    "    function fetchJson(url) {",
    "      return fetch(url).then(function (r) {",
    "        if (!r.ok) throw new Error(\"miss \" + url);",
    "        return r.json();",
    "      });",
    "    }",
  ].join("\n");
  const fetchNext = [
    "    function fetchJson(url) {",
    "      return fetch(url).then(function (r) {",
    "        if (!r.ok) return null;",
    "        return r.json();",
    "      }).catch(function () { return null; });",
    "    }",
  ].join("\n");
  if (out.includes(fetchFn)) out = out.split(fetchFn).join(fetchNext);
  return out;
}

const SCREEN_FNS = [
  "    function applyRowPrices(rows) {",
  "      var by = {};",
  "      (rows || []).forEach(function (r) {",
  "        if (!r || !r.length || !r[0]) return;",
  "        var n = Number(r[6]);",
  "        if (!Number.isFinite(n) || n <= 0) return;",
  "        by[r[0]] = n;",
  "      });",
  "      CARDS.forEach(function (c) {",
  "        if (by[c.id] != null) c.usd = by[c.id];",
  "      });",
  "    }",
  "    function storedPrice(c) {",
  "      var n = Number(c && c.usd);",
  "      return Number.isFinite(n) && n > 0 ? n : 0;",
  "    }",
  "    function pictureInFile(c) {",
  "      var s = c && String(c.src || \"\").trim();",
  "      if (!s || /^https?:/i.test(s)) return false;",
  "      return s.indexOf(\"/cards/c30/ir-moltres.png\") !== -1",
  "        || s.indexOf(\"/cards/c30/ir-articuno.png\") !== -1",
  "        || s.indexOf(\"/cards/c30/ir-zapdos.png\") !== -1;",
  "    }",
  "    function screenCap() {",
  "      try {",
  "        if (window.matchMedia && window.matchMedia(\"(max-width: 767px)\").matches) return 12;",
  "      } catch (e) {}",
  "      return 24;",
  "    }",
  "    var screenAsk = 0;",
  "    var screenKey = \"\";",
  "    function listKey() {",
  "      return [medium, paperLang, prompt, mon, q, setFilter, era].join(\"|\");",
  "    }",
  "    function screenRows(rows) {",
  "      var lead = (rows || []).slice();",
  "      lead.sort(function (a, b) { return storedPrice(b) - storedPrice(a); });",
  "      return { lead: lead };",
  "    }",
].join("\n");

export function rewriteFirstScreen(html) {
  let out = String(html || "");
  if (!out.includes("Pin two cards. We make a picture.") || out.includes("function screenRows")) return out;
  const bootOld = '.then(function (d) { merge(d || [], ""); bootPaint("Visuals"); return fetchJson(assetUrl("cards/full/index.json?v=19sep-share")); })\n      .then(function (d) { merge(d || [], ""); bootPaint("English"); return fetchJson(assetUrl("cards/jp/index.json?v=11sep-vis2")); })\n      .then(function (d) { merge(d || [], " jp"); return fetchJson(assetUrl("cards/prices.json?v=16sep-price")); })\n      .then(function (d) { applyPrices(d); bootPaint("Closed beta"); finishBoot(); return syncLiveSets(); })';
  const bootNew = '.then(function (d) { merge(d || [], ""); bootPaint("Closed beta"); finishBoot(); })';
  if (out.includes(bootOld)) out = out.split(bootOld).join(bootNew);
  if (out.includes("    function paintStrip() {") && !out.includes("function applyRowPrices")) {
    out = out.replace("    function paintStrip() {", SCREEN_FNS + "\n    function paintStrip() {");
  }
  const shownOld = "      var shown = rows;\n";
  const shownNew = [
    "      var key = listKey();",
    "      if (key !== screenKey) { screenKey = key; screenAsk = screenCap(); }",
    "      var pack = screenRows(rows);",
    "      var shown = pack.lead.slice(0, screenAsk);",
    "      var more = shown.length < pack.lead.length;",
    "",
  ].join("\n");
  if (out.includes(shownOld)) out = out.split(shownOld).join(shownNew);
  const moreOld = "      }).join(\"\");\n      }\n      paintTray();";
  const moreNew = "      }).join(\"\");\n      if (more) $(\"strip\").insertAdjacentHTML(\"beforeend\", \"<button type=\\\"button\\\" class=\\\"ghost\\\" data-more=\\\"1\\\">More</button>\");\n      }\n      paintTray();";
  if (out.includes(moreOld)) out = out.split(moreOld).join(moreNew);
  const clickOld = "        paintMons(); paintSets(); paintPrompts(); paintStrip();\n        return;\n      }\n      var b = e.target.closest(\"[data-id]\");";
  const clickNew = "        paintMons(); paintSets(); paintPrompts(); paintStrip();\n        return;\n      }\n      var moreBtn = e.target.closest(\"[data-more]\");\n      if (moreBtn) {\n        screenAsk = (screenAsk || screenCap()) + screenCap();\n        paintStrip();\n        return;\n      }\n      var b = e.target.closest(\"[data-id]\");";
  if (out.includes(clickOld)) out = out.split(clickOld).join(clickNew);
  const thumbOld = [
    "    function thumbOf(c) {",
    "      var s = srcOf(c);",
    '      if (s.indexOf("/img/") === 0 || s.indexOf("/thumb/") === 0) return tcgImg(s, true);',
    '      if (s.indexOf("/cards/") === 0) return assetUrl(s);',
    "      return s;",
    "    }",
  ].join("\n");
  const thumbNew = [
    "    function thumbOf(c) {",
    "      var s = srcOf(c);",
    "      if (!pictureInFile(c)) return \"\";",
    '      if (s.indexOf("/cards/") === 0) return assetUrl(s);',
    "      return \"\";",
    "    }",
  ].join("\n");
  if (out.includes(thumbOld)) out = out.split(thumbOld).join(thumbNew);
  const scanOld = [
    "    function scanUrls(c) {",
    "      var s = srcOf(c) || \"\";",
    "      var out = [];",
    "      function add(u) { if (u && out.indexOf(u) === -1) out.push(u); }",
    "      if (!s) return out;",
    "      if (/^https?:\\/\\//i.test(s)) { add(s); return out; }",
    "      if (s.indexOf(\"/img/\") === 0 || s.indexOf(\"/thumb/\") === 0) {",
    "        add(tcgImg(s, true));",
    "        add(tcgImg(s, false));",
    "      }",
    "      add(hiresOf(c));",
    "      if (s.charAt(0) === \"/\") add(s);",
    "      add(assetUrl(s));",
    "      return out;",
    "    }",
  ].join("\n");
  const scanNew = [
    "    function scanUrls(c) {",
    "      var s = srcOf(c) || \"\";",
    "      if (!pictureInFile(c)) return [];",
    "      if (s.indexOf(\"/cards/\") === 0) return [assetUrl(s)];",
    "      return [];",
    "    }",
  ].join("\n");
  if (out.includes(scanOld)) out = out.split(scanOld).join(scanNew);
  const faceOld = [
    "        return \"<button type=\\\"button\\\" class=\\\"card\" + on + \"\\\" data-id=\\\"\" + c.id + \"\\\">\" + flag +",
    "          \"<img class=\\\"\" + (print + still + pixel).trim() + \"\\\" alt=\\\"\" + esc(c.name || \"\") + \"\\\" loading=\\\"lazy\\\" decoding=\\\"async\\\" src=\\\"\" + thumbOf(c) + \"\\\" onload=\\\"killPrintedBack(this)\\\" onerror=\\\"this.style.visibility='hidden'\\\" />\" +",
    "          \"<div class=\\\"meta\\\"><strong>\" + esc(c.name) + \"</strong>\" +",
    "          \"<div class=\\\"fact\\\">\" + esc(factOf(c)) + \"</div></div></button>\";",
  ].join("\n");
  const faceNew = [
    "        var shot = pictureInFile(c) ? thumbOf(c) : \"\";",
    "        var face = shot ? \"<img class=\\\"\" + (print + still + pixel).trim() + \"\\\" alt=\\\"\" + esc(c.name || \"\") + \"\\\" loading=\\\"lazy\\\" decoding=\\\"async\\\" src=\\\"\" + shot + \"\\\" onload=\\\"killPrintedBack(this)\\\" />\" : \"\";",
    "        var line = shot ? factOf(c) : \"The picture is missing.\";",
    "        return \"<button type=\\\"button\\\" class=\\\"card\" + on + \"\\\" data-id=\\\"\" + c.id + \"\\\">\" + flag +",
    "          face +",
    "          \"<div class=\\\"meta\\\"><strong>\" + esc(c.name) + \"</strong>\" +",
    "          \"<div class=\\\"fact\\\">\" + esc(line) + \"</div></div></button>\";",
  ].join("\n");
  if (out.includes(faceOld)) out = out.split(faceOld).join(faceNew);
  const dumpOld = "\"<img alt=\\\"\\\" loading=\\\"lazy\\\" decoding=\\\"async\\\" src=\\\"\" + thumbOf(c) + \"\\\" onload=\\\"killPrintedBack(this)\\\" onerror=\\\"this.style.visibility='hidden'\\\" />\" +";
  const dumpNew = "(thumbOf(c) ? \"<img alt=\\\"\\\" loading=\\\"lazy\\\" decoding=\\\"async\\\" src=\\\"\" + thumbOf(c) + \"\\\" onload=\\\"killPrintedBack(this)\\\" />\" : \"<span class=\\\"note\\\">The picture is missing.</span>\") +";
  if (out.includes(dumpOld)) out = out.split(dumpOld).join(dumpNew);
  const slotOld = "\"<img src=\\\"\" + thumbOf(c) + \"\\\" alt=\\\"\" + (c.name || \"\") + \"\\\" onload=\\\"killPrintedBack(this)\\\" onerror=\\\"this.style.visibility='hidden'\\\" />\" +";
  const slotNew = "(thumbOf(c) ? \"<img src=\\\"\" + thumbOf(c) + \"\\\" alt=\\\"\" + (c.name || \"\") + \"\\\" onload=\\\"killPrintedBack(this)\\\" />\" : \"<span class=\\\"note\\\">The picture is missing.</span>\") +";
  if (out.includes(slotOld)) out = out.split(slotOld).join(slotNew);
  return out;
}

export function rewriteLoadedLines(html) {
  let out = String(html || "");
  if (!out.includes("Pin two cards. We make a picture.")) return out;
  const pinOld = 'pins = ["base1-63", "sv3pt5-170"];';
  if (out.includes(pinOld)) out = out.split(pinOld).join("pins = [];");
  const lineOld = [
    "    function pickLine(who) {",
    "      var safe = path151For(who, \"line\");",
    "      if (safe) return safe;",
    "      var fam = evoFamily(who);",
    "      if (!fam || fam.length < 2) return [];",
    "      if (fam[0] === \"Eevee\" && fam.length > 3) {",
    "        if (who === \"Eevee\") {",
    "          var night = cohesiveCombos([\"Eevee\", \"Espeon\", \"Umbreon\"]);",
    "          if (night.length) return night[0];",
    "          var eevee = hottest(paperOf(\"Eevee\"));",
    "          var tops = [\"Umbreon\", \"Espeon\", \"Sylveon\"].map(function (sp) { return hottest(rolePool(sp)); }).filter(Boolean);",
    "          return [eevee].concat(tops.slice(0, 2)).filter(Boolean);",
    "        }",
    "        fam = [\"Eevee\", who];",
    "      }",
    "      var combos = cohesiveCombos(fam);",
    "      return combos[0] || [];",
    "    }",
  ].join("\n");
  const lineNew = [
    "    function pickLine(who) {",
    "      var safe = path151For(who, \"line\");",
    "      return safe || [];",
    "    }",
  ].join("\n");
  if (out.includes(lineOld)) out = out.split(lineOld).join(lineNew);
  const offerOld = [
    "        var fam = evoFamily(who);",
    "        var linePath = path151For(who, \"line\");",
    "        if (linePath) {",
    "          offers.push({ v: \"line\", l: \"Evo line\", s: linePath.map(function (c) { return c.name; }).join(\" → \") });",
    "        } else if (fam && fam.length >= 2) {",
    "          var lineOk = fam.every(function (sp) { return rolePool(sp).length; });",
    "          if (fam[0] === \"Eevee\" && fam.length > 3) lineOk = rolePool(\"Eevee\").length && rolePool(who === \"Eevee\" ? \"Umbreon\" : who).length;",
    "          if (lineOk) {",
    "            var lineLab = fam[0] === \"Eevee\" && who !== \"Eevee\" ? (\"Eevee → \" + who) : (fam[0] + \" → \" + fam[fam.length - 1]);",
    "            offers.push({ v: \"line\", l: \"Evo line\", s: lineLab });",
    "          }",
    "        }",
  ].join("\n");
  const offerNew = [
    "        var linePath = path151For(who, \"line\");",
    "        if (linePath) {",
    "          offers.push({ v: \"line\", l: \"Evo line\", s: linePath.map(function (c) { return c.name; }).join(\" → \") });",
    "        }",
  ].join("\n");
  if (out.includes(offerOld)) out = out.split(offerOld).join(offerNew);
  const trioOld = [
    "      if (kind === \"trio\") {",
    "        var birds = path151For(who, \"trio\");",
    "        if (birds) return birds;",
    "      }",
  ].join("\n");
  const trioNew = [
    "      if (kind === \"trio\") {",
    "        var birds = path151For(who, \"trio\");",
    "        return birds || [];",
    "      }",
  ].join("\n");
  if (out.includes(trioOld)) out = out.split(trioOld).join(trioNew);
  return out;
}

export function patchEditorHtml(html, asOf, mark = "") {
  const date = String(asOf || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("price date");
  let out = stripMarketPrompts(String(html || ""));
  const fetchPaper = 'fetch("' + "paper-" + "rows.json";
  const fetchPocket = 'fetch("' + "pocket-" + "rows.json";
  out = out.split(fetchPaper).join('fetch("' + PAPER_PATH);
  out = out.split(fetchPocket).join('fetch("' + POCKET_PATH);
  out = out.replace(/const PRICES_AS_OF = "[^"]*";/, 'const PRICES_AS_OF = "' + date + '";');
  out = out.split('dateNote = "priced " + PRICES_AS_OF;').join('dateNote = "TCGplayer market (" + PRICES_AS_OF + ")";');
  const stale = ["sells", "for", "about"].join(" ");
  out = out.split(' + " ' + stale + ' " + ').join(' + ". TCGplayer market $" + ');
  out = out.split(' + " for about " + ').join(' + ". TCGplayer market $" + ');
  out = out.split('? fname() : "catchem") + ".jpg"').join('? fname() : "catchem.png")');
  out = out.split('? fname() : "catchem") + (b.type.indexOf("jpeg") >= 0 ? ".jpg" : ".png")').join('? fname() : "catchem.png")');
  const trayFact = '<p class="note" id="tray-fact"></p>';
  if (out.includes(trayFact) && !out.includes('id="price-date"')) {
    out = out.replace(trayFact, trayFact + '<p class="note" id="price-date">Prices: TCGplayer market (' + date + ").</p>");
  }
  out = out.split("if (r[21]) o.mech = r[21];").join("if (r[21]) o.mech = r[21];\n  if (r[22]) o.cid = r[22];");
  out = out.split("let INDEX = [], tray = []").join("var INDEX = [], tray = []");
  out = out.split('var png = canvas.toDataURL("image/png");').join('var png = (window.__ceOverlay ? window.__ceOverlay(canvas, sel) : canvas).toDataURL("image/png");');
  out = out.split("window.__PAPER_ROWS : CORE_ROWS.slice()").join("window.__PAPER_ROWS : []");
  out = out.replace(
    '<button type="button" data-view="replies">Replies</button>',
    '<button type="button" class="lab-only" data-view="replies">Replies</button>',
  );
  out = out.replace(
    '<button type="button" data-view="review">Review</button>',
    '<button type="button" class="lab-only" data-view="review">Review</button>',
  );
  out = out.replace(
    '<button type="button" data-view="desk">Desk</button>',
    '<button type="button" class="lab-only" data-view="desk">Desk lab</button>',
  );
  if (!out.includes('id="office-dock"')) {
    const dockCss = '<style id="office-dock">#compose-dock{position:sticky;bottom:0;z-index:5;background:#12100e;padding:8px 0 12px}#compose-dock.dock-top{position:static;padding:4px 0 8px;border-bottom:1px solid #2f2b26;margin-bottom:12px}#compose-dock.dock-top.dock-empty #sizes,#compose-dock.dock-top.dock-empty #share-row,#compose-dock.dock-top.dock-empty #ov-opt,#compose-dock.dock-top.dock-empty #ov-note,#compose-dock.dock-top.dock-empty #ai-panel,#compose-dock.dock-top.dock-empty #next-step{display:none!important}#seat-row[hidden],#edit-seat[hidden],#phone-make[hidden]{display:none!important}@media(min-width:900px){#compose-dock{position:static;padding:0}}</style>';
    out = out.includes("</head>") ? out.replace("</head>", dockCss + "</head>") : dockCss + out;
  }
  out = rewritePlayAssets(out);
  out = rewriteFirstScreen(out);
  out = rewriteLoadedLines(out);
  out = rewriteOfficeFilters(out);
  out = siteSkin(out);
  if (out.includes("Pin two cards. We make a picture.") && !out.includes('id="dl"')) {
    const hook = '<div id="dl" hidden></div>';
    out = out.includes("</body>") ? out.replace("</body>", hook + "</body>") : out + hook;
  }
  if (!out.includes('id="sizes-boot"')) out += SIZE_JS;
  if (!out.includes('id="ai-boot"')) out += AI_JS;
  if (!out.includes('id="share-boot"')) out += SHARE_JS;
  if (!out.includes('id="sealed-boot"')) out += SEALED_JS;
  if (!out.includes('id="path-boot"')) out += prefillBootTag();
  if (mark && !out.includes('id="post-build"')) {
    const stamp = '<p id="post-build" style="margin:12px 16px 28px;color:#9a907f;font:13px/1.4 system-ui,sans-serif">' + escStamp(mark) + "</p>";
    out = out.includes("</body>") ? out.replace("</body>", stamp + "</body>") : out + stamp;
  }
  return freeBranding(ensureAffiliation(cleanOfficeCopy(out)));
}

export function editorCacheKey() {
  return String(BUILD_SHA || "dev").slice(0, 12) || "dev";
}

export function resetEditorCache() {
  htmlCache.clear();
}

export async function editorDocument(asOf, fetchImpl = fetch, mark = "") {
  const key = "play.html?v=" + editorCacheKey();
  let raw = htmlCache.get(key);
  if (raw == null) {
    const res = await fetchRepo("research/assets/play.html", fetchImpl, { cache: "no-store" });
    if (!res.ok) throw new Error("play.html " + res.status);
    raw = await res.text();
    htmlCache.set(key, raw);
  }
  return patchEditorHtml(raw, asOf, mark);
}

// Paper rows always take today's price and catalog id from search-lite (column 6 and
// column 22). The baked file in Catchem-data carries old prices and only 22 columns, so
// it is never served as is: a row with no live match ships with price 0, not a stale one.
const PAPER_TTL_MS = 30 * 60 * 1000;

export async function patchedPaper(fetchImpl = fetch, now = Date.now()) {
  const key = "patched-paper";
  const hit = htmlCache.get(key);
  if (hit && now - hit.at < PAPER_TTL_MS) return hit.body;
  const res = await fetchRepo("research/assets/" + "paper-" + "rows.json", fetchImpl, { cache: "no-store" });
  if (!res.ok) throw new Error("paper " + res.status);
  const rows = JSON.parse(await res.text());
  const { loadJson } = await import("./data.mjs");
  const lite = await loadJson("search-lite.json", fetchImpl);
  if (!Array.isArray(lite) || !lite.length) throw new Error("search-lite");
  const patched = patchPaperRows(rows, lite);
  const body = JSON.stringify(patched.rows);
  htmlCache.set(key, { body, at: now });
  htmlCache.set("patched-paper-stats", { matched: patched.matched, total: patched.total });
  return body;
}

export const POCKET_IMG_PREFIX = "/data/editor/pocket/";
const POCKET_HOSTS = /^https:\/\/(assets\.tcgdex\.net\/en\/tcgp\/|limitlesstcg\.nyc3\.cdn\.digitaloceanspaces\.com\/pocket\/|www\.serebii\.net\/tcgpocket\/)/;

// Pocket pictures are the checked URL Catchem-data stores for each id (column 14).
// They are proxied same-origin, like the paper scans, so the picture canvas can read them.
export function pocketImageMap(rows) {
  const map = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || !/^tcgp-[A-Za-z0-9-]+$/.test(String(r[0] || ""))) continue;
    if (POCKET_HOSTS.test(String(r[14] || ""))) map.set(String(r[0]), String(r[14]));
  }
  return map;
}

export function patchPocketRows(rows) {
  const map = pocketImageMap(rows);
  return (Array.isArray(rows) ? rows : []).map((r) => {
    if (!Array.isArray(r)) return r;
    const out = r.slice();
    if (out.length > 14) out[14] = map.has(String(r[0])) ? POCKET_IMG_PREFIX + r[0] : 0;
    return out;
  });
}

async function pocketRowsRaw(fetchImpl) {
  const key = "pocket-raw";
  if (htmlCache.has(key)) return JSON.parse(htmlCache.get(key));
  const res = await fetchRepo("research/assets/" + "pocket-" + "rows.json", fetchImpl, { cache: "no-store" });
  if (!res.ok) throw new Error("pocket " + res.status);
  const text = await res.text();
  htmlCache.set(key, text);
  return JSON.parse(text);
}

export async function pocketDocument(fetchImpl = fetch) {
  const key = "patched-pocket";
  if (htmlCache.has(key)) return htmlCache.get(key);
  const body = JSON.stringify(patchPocketRows(await pocketRowsRaw(fetchImpl)));
  htmlCache.set(key, body);
  return body;
}

export async function pocketImageUrl(id, fetchImpl = fetch) {
  const map = pocketImageMap(await pocketRowsRaw(fetchImpl));
  return map.get(String(id || "")) || "";
}
