import { BUILD_SHA } from "./build-stamp.mjs";

// The Post Office editor (Catchem-data research/assets/play.html).
// Card scans are proxied same-origin so the picture canvas can read them.

const RAW = "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/research/assets/";
export const EDITOR_URL = RAW + "play.html";
export const PAPER_URL = RAW + "paper-" + "rows.json";
export const POCKET_URL = RAW + "pocket-" + "rows.json";
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

const SIZE_JS = `<script id="sizes-boot">
(function(){
  var sizes = ${JSON.stringify(EXPORT_SIZES)};
  function boot(){
    var dl = document.getElementById("dl");
    if (!dl || document.getElementById("sizes")) return;
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
    dl.parentNode.insertBefore(row, dl.nextSibling);
  }
  function saveSize(label, w, h){
    var shown = document.getElementById("outimg");
    var stage = document.getElementById("cv");
    function paint(im){
      var out = document.createElement("canvas");
      out.width = w; out.height = h;
      var g = out.getContext("2d");
      g.fillStyle = "#070910";
      g.fillRect(0, 0, w, h);
      var iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
      if (!iw || !ih) return;
      var scale = Math.min(w / iw, h / ih);
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

const AI_JS = `<script id="ai-boot">
(function(){
  var tone = "informative";
  var seat = null;
  var signInHref = "/auth/discord?next=/post-office";
  function boot(){
    var dl = document.getElementById("dl");
    if (!dl || document.getElementById("ai-panel")) return;
    var panel = document.createElement("div");
    panel.id = "ai-panel";
    panel.style.cssText = "margin:12px 0 20px;padding:12px;border:1px solid #3a3428;border-radius:12px";
    var anchor = document.getElementById("sizes") || dl;
    anchor.parentNode.insertBefore(panel, anchor.nextSibling);
    load(panel);
  }
  function ids(){
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
    if (href) {
      var a = document.createElement("a");
      a.href = href;
      a.textContent = "Sign in with Discord";
      p.appendChild(a);
      p.appendChild(document.createTextNode(" to use Ideas. A free seat is 3 a day. Premium is 50 a day."));
    } else {
      p.textContent = text;
    }
    panel.appendChild(p);
  }
  function quotaText(view){
    var bits = [];
    if (view && view.ideas) bits.push("Ideas left today: " + view.ideas.left);
    if (view && view.post) bits.push("Post text left today: " + view.post.left);
    return bits.join(". ") + (view && view.premium ? ". Premium." : ". Free.");
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
      b.textContent = "Copy";
      b.onclick = function(){ copy(text, b); };
      out.appendChild(p);
      out.appendChild(b);
    });
    var every = document.createElement("button");
    every.type = "button";
    every.id = "go-copy";
    every.className = "sec";
    every.textContent = "Copy all";
    every.onclick = function(){ copy(all.join("\\n\\n"), every); };
    out.appendChild(every);
  }
  function ask(panel, path){
    var picked = ids();
    var out = document.getElementById("ai-out");
    if (!picked.length) {
      if (out) out.textContent = "Pick a card from the live catalog first.";
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
      if (pack.status === 401) {
        showLine(panel, data.line || "Ideas need a signed-in seat. Free is 3 a day. Premium is 50 a day. Discord sign-in is not turned on yet.", data.ready ? signInHref : "");
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
      if (!view || !view.signedIn) {
        showLine(panel, (view && view.line) || "Ideas need a signed-in seat. Free is 3 a day. Premium is 50 a day. Discord sign-in is not turned on yet.", view && view.ready ? signInHref : "");
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
    "      return " + JSON.stringify(RAW) + " + p;",
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
  "      var lead = [];",
  "      (rows || []).forEach(function (c) {",
  "        if (pictureInFile(c)) lead.push(c);",
  "      });",
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
  out = out.split(' + " ' + stale + ' " + ').join(' + " — TCGplayer market $" + ');
  out = out.split(' + " for about " + ').join(' + " — TCGplayer market $" + ');
  out = out.split('? fname() : "catchem") + ".jpg"').join('? fname() : "catchem.png")');
  out = out.split('? fname() : "catchem") + (b.type.indexOf("jpeg") >= 0 ? ".jpg" : ".png")').join('? fname() : "catchem.png")');
  out = out.split("if (r[21]) o.mech = r[21];").join("if (r[21]) o.mech = r[21];\n  if (r[22]) o.cid = r[22];");
  out = out.split("let INDEX = [], tray = []").join("var INDEX = [], tray = []");
  out = out.split("window.__PAPER_ROWS : CORE_ROWS.slice()").join("window.__PAPER_ROWS : []");
  out = rewritePlayAssets(out);
  out = rewriteFirstScreen(out);
  out = siteSkin(out);
  if (out.includes("Pin two cards. We make a picture.") && !out.includes('id="dl"')) {
    const hook = '<div id="dl" hidden></div>';
    out = out.includes("</body>") ? out.replace("</body>", hook + "</body>") : out + hook;
  }
  if (!out.includes('id="sizes-boot"')) out += SIZE_JS;
  if (!out.includes('id="ai-boot"')) out += AI_JS;
  if (mark && !out.includes('id="post-build"')) {
    const stamp = '<p id="post-build" style="margin:12px 16px 28px;color:#9a907f;font:13px/1.4 system-ui,sans-serif">' + escStamp(mark) + "</p>";
    out = out.includes("</body>") ? out.replace("</body>", stamp + "</body>") : out + stamp;
  }
  return out;
}

export function editorCacheKey() {
  return String(BUILD_SHA || "dev").slice(0, 12) || "dev";
}

async function textOf(url, fetchImpl) {
  if (htmlCache.has(url)) return htmlCache.get(url);
  const res = await fetchImpl(url, { cache: "no-store" });
  if (!res.ok) throw new Error(url + " " + res.status);
  const body = await res.text();
  htmlCache.set(url, body);
  return body;
}

export function resetEditorCache() {
  htmlCache.clear();
}

export async function editorDocument(asOf, fetchImpl = fetch, mark = "") {
  const raw = await textOf(EDITOR_URL + "?v=" + editorCacheKey(), fetchImpl);
  return patchEditorHtml(raw, asOf, mark);
}

export async function patchedPaper(fetchImpl = fetch) {
  const key = "patched-paper";
  if (htmlCache.has(key)) return htmlCache.get(key);
  const [paperRes, lite] = await Promise.all([
    textOf(PAPER_URL, fetchImpl),
    (async () => {
      const { loadJson } = await import("./data.mjs");
      return loadJson("search-lite.json", fetchImpl);
    })(),
  ]);
  const rows = JSON.parse(paperRes);
  const patched = patchPaperRows(rows, lite);
  const body = JSON.stringify(patched.rows);
  htmlCache.set(key, body);
  htmlCache.set("patched-paper-stats", patched);
  return body;
}

export async function pocketDocument(fetchImpl = fetch) {
  return textOf(POCKET_URL, fetchImpl);
}
